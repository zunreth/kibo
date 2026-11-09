import { tg, reply, getJSON, putJSON, scheduleDelete, tgErrLog, tgUpTmo, NH_FMT_ALIAS, nhDefFmt, nhHost, nhPdfQ } from "./base.js";
import { uiLang, SEP_LINE } from "./ui.js";
import { UA, UA_BOT, DL_CACHE_PREFIX, DL_CACHE_TTL_MS, DL_MAX_LINKS, DL_SEND_MAX, DL_URL_SEND_MAX, DL_SEND_PHOTO_MAX, FGSI_IG_URL, FGSI_KEY, KYIO_BASE, DL_DEL_MS, DELQ_KEY, DL_MENU_TTL_MS, DL_PICK_PREFIX, DL_SAV_PREFIX, DL_SAV_TTL_MS, DL_BIG_PREFIX, YT_PICK_PREFIX, YT_BUILD_PREFIX, YT_JOB_PREFIX, YT_BUSY_PREFIX, YT_RESOLVE_PREFIX, YT_RESOLVE_DEAD_MS, YT_CACHE_PREFIX, YT_CACHE_TTL_MS, YT_CACHE_TTL_TMP_MS, YT_UP_PREFIX, YT_AIO_PREFIX, SC_CID_KEY, SC_CID_TTL_MS, SC_SEG_MAX, PURUBOY_BASE, BTCH_BASE, NEXRAY_BASE, SPARKY_BASE, YT_UPLOAD_MAX, YTS_MAX, NH_SAVE_PREFIX, NH_SAVES_KEY, NH_AUTODEL_MS, NH_JOB_PREFIX, NH_JOB_TTL_MS, NH_BUSY_PREFIX, NH_KEEP_PREFIX, NH_CACHE_PREFIX, NH_CACHE_TTL_MS, NH_CACHE_TTL_TMP_MS, NH_RECENT_KEY, NH_RECENT_MAX, NH_STAT_PREFIX, NH_STAT_TTL_MS, NH_DEAD_MS, VAULT_CHAT_KEY, FILE_INDEX_KEY } from "./consts.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));

// v2.78.1: the resolve chain needs one wall-clock budget, not just per-hop timeouts.
// Per-hop caps add up far past what a single webhook may take (btch alone is 3 × 45 s, and the
// handler stops waiting for the chain at 55 s), so a slow source used to be cut off mid-chain and
// its "fetching…" placeholder was never replaced. Measured on this account: work that continues
// after the response is delivered is killed at ~30 s (a 28 s ctx.waitUntil sleep completes, a 32 s
// one does not) — so the chain must finish while the request is still open.
const YT_BUDGET_MS = env => parseInt((env && env.YT_RESOLVE_BUDGET_MS) || "", 10) || 40000;
// One wall-clock budget per interactive media chain, so every hop can ask what is left instead of
// spending its own timeout and pushing the whole chain past the point where the isolate is cut.
// The absolute deadline matters as much as the remaining time: a body read that stalls after a 200
// still has to be abandoned, or the per-hop cap is spent twice.
function wallBudget(total) {
  const t0 = Date.now();
  const deadline = t0 + total;
  return {
    left: () => deadline - Date.now(),
    deadline: () => deadline,
    // what a single hop may spend: its own cap, never more than what is left
    slice: cap => Math.max(0, Math.min(cap, deadline - Date.now()))
  };
}
const ytBudget = env => wallBudget(YT_BUDGET_MS(env));
const scBudget = env => wallBudget(parseInt((env && env.SC_RESOLVE_BUDGET_MS) || "", 10) || 40000);
// The timeout to hand a fetch inside a hop: values under a second abort before the request even
// starts, so floor it — the budget check above is what decides whether the hop runs at all.
const hopMs = ms => Math.max(1000, Math.floor(ms || 0));
// Metadata hops have no delivery side effects, so abandoning one is safe: the loser of the race is
// simply left to expire. Upload hops must NOT be raced — an abandoned upload can still deliver.
async function ytWithin(ms, fn, fallback) {
  if (ms <= 0) return fallback;
  let to = null;
  try {
    return await Promise.race([fn(), new Promise(r => { to = setTimeout(() => r(fallback), ms); })]);
  } catch (_) { return fallback; } finally { if (to) clearTimeout(to); }
}

export function syndToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/[.0]/g, "");
}

export function dlPlatform(raw) {
  let u;
  try { u = new URL(raw); } catch (_) { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const h = u.hostname.replace(/^www\./, "").toLowerCase();
  if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
  if (/(^|\.)x\.com$/.test(h) || /(^|\.)twitter\.com$/.test(h)) return "x";
  if (/(^|\.)youtube\.com$/.test(h) || h === "youtu.be") return "youtube";
  if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
  if (/(^|\.)spotify\.com$/.test(h)) return "spotify";
  if (/(^|\.)facebook\.com$/.test(h) || h === "fb.watch" || /(^|\.)fb\.com$/.test(h)) return "facebook";
  if (/(^|\.)soundcloud\.com$/.test(h) || h === "snd.sc") return "soundcloud";
  return null;
}

export function xStatus(u) {
  const m = u.pathname.match(/\/([^/]+)\/status(?:es)?\/(\d{5,})/);
  return m ? { user: m[1], id: m[2] } : null;
}

const fnv1a = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

async function getJSONh(url, ms) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(ms || 15000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}
// Metadata nhdl: 100% dari Worker `nhdl-w` (mirror cin.guru + fallback nhentai API + cache — VPS-independent).
async function nhMeta(env, id) {
  const base = (env.NH_API || "").replace(/\/+$/, "");
  if (!base) return null;
  return getJSONh(base + "/api/gallery/" + id, 15000);
}
function nhDl(env, id, fmt) {
  const base = (env.NH_DL || "").replace(/\/+$/, "");
  if (!base) return "";
  return base + "/dl/" + id + "?format=" + (fmt || "zip");
}
async function getText(url, ua) {
  try {
    const r = await fetch(url, { headers: { "user-agent": ua || UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await r.text();
  } catch (_) { return null; }
}

async function tikwmResolve(url) {
  const j = await getJSONh("https://tikwm.com/api/?url=" + encodeURIComponent(url));
  const d = j && j.code === 0 && j.data;
  if (!d) return null;
  const items = [];
  if (Array.isArray(d.images) && d.images.length) {
    for (const u of d.images.slice(0, DL_MAX_LINKS - 1)) items.push({ kind: "photo", url: String(u) });
  } else {
    if (d.hdplay && d.hdplay !== d.play) items.push({ kind: "video", fmt: "HD", url: String(d.hdplay) });
    const v = d.play || d.wmplay;
    if (v) items.push({ kind: "video", url: String(v) });
  }
  if (d.music) items.push({ kind: "audio", url: String(d.music) });
  return items.length ? { items: items.slice(0, DL_MAX_LINKS), meta: { title: d.title || "", author: d.author ? String(d.author.nickname || d.author.unique_id || "") : "", duration: Number(d.duration) || 0 } } : null;
}

async function fsTtResolve(url) {
  const j = await getJSONh("https://api.fromscratch.web.id/v1/api/down/tiktok?url=" + encodeURIComponent(url));
  const d = j && j.status === 200 && j.data;
  if (!d) return null;
  const nw = d.no_watermark ? String(d.no_watermark) : "";
  const mu = d.music ? String(d.music) : "";
  const items = [];
  if (nw.startsWith("https://") && nw !== mu && !nw.includes("/pacific/")) items.push({ kind: "video", url: nw });
  if (mu.startsWith("https://") && !mu.includes("/pacific/")) items.push({ kind: "audio", url: mu });
  const slide = !(nw.startsWith("https://") && nw !== mu);
  return items.length ? { items: items.slice(0, DL_MAX_LINKS), meta: { title: d.title || "", slide } } : null;
}

function ttEmbedParse(html) {
  if (!html) return null;
  const seen = new Set();
  for (const m of html.matchAll(/https:[^"'\s\\]+?~tplv-photomode-image[^"'\s\\]*/g)) {
    const p = m[0].replace(/&amp;/g, "&");
    if (p.startsWith("https://") && p.includes("tiktokcdn") && !p.includes("photomode-image-cover") && !seen.has(p)) seen.add(p);
  }
  if (!seen.size) return null;
  return { items: [...seen].slice(0, DL_MAX_LINKS).map(u => ({ kind: "photo", url: u })) };
}
async function ttEmbedResolve(url) {
  const m = String(url).match(/(\d{15,})/);
  if (!m) return null;
  for (const ua of [UA_BOT, UA]) {
    const r = ttEmbedParse(await getText("https://www.tiktok.com/embed/" + m[1], ua));
    if (r) return r;
  }
  return null;
}

// puruboy-api (vercel, keyless, upstream beda: ssstik.io / yt-dlp via e2b sandbox) — instansi komunitas = ephemeral → tail fallback SETELAH btch; YT-nya lambat (spin-up sandbox) → timeout 35s
async function puruTtResolve(env, url) {
  const base = String((env && env.PURU_BASE) || "https://puruboy-api.vercel.app").replace(/\/+$/, "");
  const j = await getJSONh(base + "/api/downloader/tiktok?url=" + encodeURIComponent(url));
  if (!j || !j.success) return null;
  const vu = String(j.video_url || "");
  const mu = String(j.mp3_url || "");
  const items = [];
  if (dlUrlOk(vu)) items.push({ kind: "video", url: vu });
  if (dlUrlOk(mu)) items.push({ kind: "audio", url: mu });
  return items.length ? { items: items.slice(0, DL_MAX_LINKS), meta: { title: String(j.caption || "").slice(0, 120), author: String(j.author || "") } } : null;
}
async function fgsiIgResolve(url) {
  const j = await getJSONh(FGSI_IG_URL + "?apikey=" + encodeURIComponent(FGSI_KEY) + "&url=" + encodeURIComponent(url));
  const arr = j && j.status === true && j.data && Array.isArray(j.data.url) ? j.data.url : [];
  const items = arr.map(x => {
    const s = String((x && x.url) || "");
    const kind = /video|mp4/i.test(String((x && x.type) || "") + String((x && x.ext) || "")) || /\.mp4/i.test(s) ? "video" : "photo";
    return { kind, url: s };
  }).filter(x => x.url.startsWith("https://"));
  return items.length ? { items: items.slice(0, DL_MAX_LINKS) } : null;
}

async function fxResolve(user, id) {
  const j = await getJSONh("https://api.fxtwitter.com/" + encodeURIComponent(user) + "/status/" + id);
  const tw = (j && j.tweet) || {};
  const m = tw.media;
  if (!m) return null;
  const items = (m.videos || []).map(v => ({ kind: "video", url: String(v.url || "") }))
    .concat((m.photos || []).map(p => ({ kind: "photo", url: String(p.url || "") })))
    .filter(x => x.url);
  return items.length ? { items: items.slice(0, DL_MAX_LINKS), meta: { caption: tw.text || "", author: tw.author ? String(tw.author.name || "") : "" } } : null;
}
async function syndResolve(id) {
  if (!/^\d{5,}$/.test(String(id))) return null;
  const j = await getJSONh("https://cdn.syndication.twimg.com/tweet-result?id=" + id + "&token=" + syndToken(id) + "&lang=en");
  const md = j && Array.isArray(j.mediaDetails) ? j.mediaDetails : [];
  const items = [];
  for (const m of md) {
    if (m.type === "video" || m.type === "animated_gif") {

      const vs = (((m.video_info || {}).variants) || []).filter(v => v.content_type === "video/mp4").sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (vs[0] && vs[0].url) items.push({ kind: "video", url: String(vs[0].url) });
    } else if (m.media_url_https) {
      let u = String(m.media_url_https);
      if (u.includes("pbs.twimg.com/media/") && !/:\w+$/.test(u)) u += ":orig";
      items.push({ kind: "photo", url: u });
    }
  }
  return items.length ? { items: items.slice(0, DL_MAX_LINKS) } : null;
}

function igCode(u) {
  const m = u.pathname.match(/\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,})/);
  return m ? { type: m[1], code: m[2] } : null;
}
const unesc = s => {
  let p = String(s).replace(/&amp;/g, "&");
  for (let i = 0; i < 6; i++) {
    const q = p.replace(/\\u([0-9a-fA-F]{4})|\\([\s\S])/g, (m, u, c) => u ? String.fromCharCode(parseInt(u, 16)) : c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c).replace(/&amp;/g, "&");
    if (q === p) break;
    p = q;
  }
  return p.replace(/\\+$/, "");
};

function igEfgCover(p) {
  try {
    const m = String(p).match(/(?:&|\?|;)efg=([^&"'\s]+)/);
    if (!m) return false;
    return atob(m[1].replace(/%3D/gi, "=").replace(/-/g, "+").replace(/_/g, "/")).includes("video_");
  } catch (_) { return false; }
}
export function igParseEmbed(html) {
  if (!html) return null;
  const ev = [];
  for (const m of html.matchAll(/is_video(?:[^a-z]|u003[0-9a-fA-F]){0,40}?(true|false)|video_url|display_url/g)) {
    if (m[1] !== undefined) ev.push({ i: m.index, k: "iv", v: m[1] === "true" });
    else ev.push({ i: m.index, k: m[0] === "video_url" ? "vu" : "du" });
  }
  const seen = new Set();
  const items = [];
  let vid = false;
  for (const e of ev) {
    if (e.k === "iv") { vid = e.v; continue; }
    const seg = html.slice(e.i, e.i + 1200);
    const m = seg.match(/https:[^"'\s<>]+/);
    if (!m) continue;
    // NF-161016-3: video_url yang nilainya null/kosong jangan makan URL kunci berikutnya (display_url)
    if (e.k === "vu" && (m.index > 60 || /display_url|thumbnail_src|video_url/.test(seg.slice(9, m.index)))) continue;
    const p = unesc(m[0]);
    if (!p.startsWith("https://") || !(p.includes("cdninstagram.com") || p.includes("fbcdn.net")) || seen.has(p)) continue;
    seen.add(p);
    if (e.k === "vu") items.push({ kind: "video", url: p });
    else if (!vid && !igEfgCover(p)) items.push({ kind: "photo", url: p });
  }
  if (!items.length && (ev.some(e => e.k === "iv" && e.v) || html.includes('data-media-type="GraphVideo"'))) return null;

  if (!items.length) for (const m of html.matchAll(/EmbeddedMediaImage[^>]*?src="([^"]+)"/g)) {
    const p = unesc(m[1]);
    if (p && p.startsWith("https://") && !seen.has(p)) { seen.add(p); items.push({ kind: "photo", url: p }); }
  }
  if (!items.length) return null;
  const n = items.length;
  return { items: items.slice(0, DL_MAX_LINKS).map((it, i) => (n > 1 ? { ...it, pos: i + 1, total: n } : it)) };
}
async function igEmbedResolve(url) {
  let u; try { u = new URL(url); } catch (_) { return null; }
  const c = igCode(u);
  if (!c) return null;
  const eurl = "https://www.instagram.com/" + (c.type === "reels" ? "reel" : c.type) + "/" + c.code + "/embed/captioned/";
  let blocked = false;
  for (const ua of [UA_BOT, UA]) {
    const html = await getText(eurl, ua);
    const r = igParseEmbed(html);
    if (r) return r;
    if (html && !/is_video|data-media-type="GraphVideo"/.test(html)) blocked = true;
  }
  return blocked ? { blocked: 1 } : null;
}

const IG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function igCodeToId(code) {
  let id = 0n;
  for (const ch of String(code)) {
    const i = IG_ALPHABET.indexOf(ch);
    if (i < 0) return null;
    id = id * 64n + BigInt(i);
  }
  return id;
}
function igInfoItems(j) {
  const one = it => {
    const vs = Array.isArray(it && it.video_versions) ? it.video_versions.slice().sort((a, b) => (b.width || 0) - (a.width || 0)) : [];
    const cs = Array.isArray(it && it.image_versions2 && it.image_versions2.candidates) ? it.image_versions2.candidates.slice().sort((a, b) => (b.width || 0) - (a.width || 0)) : [];
    if (vs[0] && vs[0].url) return { kind: "video", url: String(vs[0].url) };
    if (cs[0] && cs[0].url) return { kind: "photo", url: String(cs[0].url) };
    return null;
  };
  const it0 = j && Array.isArray(j.items) && j.items[0];
  let items = [];
  if (it0 && Array.isArray(it0.carousel_media)) for (const ch of it0.carousel_media) { const r = one(ch); if (r) items.push(r); }
  else if (it0) { const r = one(it0); if (r) items.push(r); }
  items = items.filter(x => x.url.startsWith("https://") && (x.url.includes("cdninstagram.com") || x.url.includes("fbcdn.net")));
  const n = items.length;
  return n ? items.slice(0, DL_MAX_LINKS).map((it, i) => (n > 1 ? { ...it, pos: i + 1, total: n } : it)) : null;
}
async function igCookieResolve(env, url) {
  if (!env || !env.IG_COOKIE) return null;
  let u; try { u = new URL(url); } catch (_) { return null; }
  const c = igCode(u);
  if (!c) return null;
  const id = igCodeToId(c.code);
  if (id === null) return null;
  const ck = String(env.IG_COOKIE).includes("=") ? String(env.IG_COOKIE) : "sessionid=" + String(env.IG_COOKIE).trim();
  const headers = { "user-agent": UA, "x-ig-app-id": "936619743392459", "x-requested-with": "XMLHttpRequest", accept: "*/*", cookie: ck };
  for (const host of ["https://i.instagram.com", "https://www.instagram.com"]) {
    let j = null;
    try {
      const r = await fetch(host + "/api/v1/media/" + id + "/info/" + (host.includes("www") ? "?__d=dis" : ""), { headers, signal: AbortSignal.timeout(15000) });
      if (r.ok) j = await r.json().catch(() => null);
      else if (r.status === 400 || r.status === 401) { const e = await r.json().catch(() => null); if (e && (e.message === "login_required" || e.error_type === "auth")) return { authdead: 1 }; }
    } catch (_) {}
    if (j) {
      if (j.message === "login_required" || j.error_type === "auth") return { authdead: 1 };
      const items = igInfoItems(j);
      if (items) return { items };
    }
  }
  return null;
}

async function btchPlat(env, url, plat) {
  // btch-downloader-api (vercel, keyless) — flaky (502 transien ~2/3 dari CF egress, VPS lancar) → 3 attempt, selalu paling belakang di chain
  const base = String((env && env.BTCH_BASE) || "https://btch-downloader-api-green.vercel.app").replace(/\/+$/, "");
  const ep = base + "/api/download/" + plat + "?url=" + encodeURIComponent(url);
  const gap = Number(env && env.DL_BTCH_GAP_MS) > 0 ? Number(env.DL_BTCH_GAP_MS) : 2000;
  let j = null;
  for (let i = 0; i < 3 && !j; i++) {
    if (i) await sleep(gap);
    const r = await getJSONh(ep);
    if (r && r.success && r.normalized) j = r;
    else if (r && r.success && r.result) j = r; // gate longgar (mapper di bawah yang bedah shape flat/nested — respons aneh = null jujur)
  }
  // spotify = bentuk sendiri: formats[] (MP3 full-track, spotimate.io JWT-signed), gak ada normalized.media — shape-nya ASUP NAJIS: flat result.formats (riset pagi) vs nested result.result.formats + developer wrapper (live 22 Okt sore) → dua-duanya diterima
  const sp = j && j.result ? (Array.isArray(j.result.formats) ? j.result : j.result.result && Array.isArray(j.result.result.formats) ? j.result.result : null) : null;
  if (sp) {
    const items = sp.formats.filter(x => x && dlUrlOk(x.url)).map(x => ({ kind: "audio", url: String(x.url) })).slice(0, DL_MAX_LINKS);
    return items.length ? { items, meta: { title: String(sp.title || "").slice(0, 120) } } : null;
  }
  const m = j && j.normalized && Array.isArray(j.normalized.media) ? j.normalized.media : null;
  if (!m || !m.length) return null;
  // btch suka mislabel foto sbg type:"video" (DeirfZNvNc0 = foto → "Video"); proxy rapidcdn = octet-stream + CF-fronted (sniff fetch keblokir CF-to-CF) → decode JWT token di URL dulu (gratis), sniff cuma fallback
  const items = (await Promise.all(m.filter(x => x && dlUrlOk(x.url)).map(async x => {
    let kind = x.type === "audio" ? "audio" : x.type === "image" || x.type === "photo" ? "photo" : "video";
    let url = String(x.url);
    if (kind === "video") {
      const tk = btchTokenKind(url);
      if (tk === "image") kind = "photo";
      else {
        const src = btchTokenUrl(url);
        if (src) {
          // proxy rapidcdn = TG gak bisa fetch (sendVideo by URL nolak) + worker gak bisa full-GET (CF-to-CF keblokir) → video item = swap ke underlying scontent asli (signed ~1 hari, di atas TTL cache /dl 1 jam); foto tetep proxy (jalur foto udah live-verified)
          url = src;
          if (!tk) { const ct = await btchSniff(env, url); if (ct.startsWith("image/")) kind = "photo"; }
        } else {
          const ct = await btchSniff(env, url);
          if (ct.startsWith("image/")) kind = "photo";
        }
      }
    }
    return { kind, fmt: "", url };
  }))).slice(0, DL_MAX_LINKS);
  return items.length ? { items } : null;
}
const btchTokenUrl = u => {
  try {
    const tk = (String(u).split("token=")[1] || "").split("&")[0];
    const seg = tk.split(".");
    if (seg.length < 2) return "";
    const b = atob(seg[1].replace(/-/g, "+").replace(/_/g, "/"));
    const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
    const src = String((j && j.url) || "");
    return src.startsWith("https://") ? src : "";
  } catch (_) { return ""; }
};
const btchTokenKind = u => {
  const src = btchTokenUrl(u);
  return /\.(jpg|jpeg|png|webp|gif|heic|heif)(?:[?#]|$)/i.test(src) ? "image" : /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(src) ? "video" : "";
};
async function btchSniff(env, url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-31" }, signal: AbortSignal.timeout(dlSizeMs(env)) });
    if (!r.ok) return "";
    const b = new Uint8Array(await r.arrayBuffer());
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
    if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
    if (b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
    if (b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
    if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      const br = String.fromCharCode(b[8], b[9], b[10], b[11]);
      return ["heic", "heix", "hevc", "heim", "hevm", "mif1", "msf1"].includes(br) ? "image/heic" : "video/mp4";
    }
    return "";
  } catch (_) { return ""; }
}
const ytMediaCt = ct => !ct || ct === "application/octet-stream" || ct === "binary/octet-stream" || /^(audio|video|image)\//.test(ct);
async function ytMeta(env, url) {
  try {
    const id = (String(url).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/) || [])[1];
    if (!id) return null;
    const [oe, vd] = await Promise.all([
      getJSONh("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id), 8000),
      getJSONh("https://returnyoutubedislikeapi.com/votes?videoId=" + id, 8000)
    ]);
    if (!oe || !oe.title) return null;
    const m = { title: String(oe.title).slice(0, 180), author: String(oe.author_name || "").slice(0, 60), views: vd && +vd.viewCount > 0 ? +vd.viewCount : 0, likes: vd && +vd.likes > 0 ? +vd.likes : 0, dislikes: vd && +vd.dislikes > 0 ? +vd.dislikes : 0, subs: "" }; // oEmbed = title+author (keyless, CF-OK 107ms); RYD = views+likes+dislikes (25ms)
    const au = String(oe.author_url || "");
    if (au.startsWith("https://www.youtube.com/")) {
      try {
        const ch = await fetch(au + "/about?hl=en", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) });
        const t = ch.ok ? await ch.text() : "";
        m.subs = (t.match(/"subscriberCountText":"([^"]+?) subscribers?"/) || [])[1] || ""; // about page = data utuh dari CF egress (406ms) — innertube = LOGIN_REQUIRED, ini satu-satunya jalur subs keyless; hl=en = angka udah compact (1.41M)
      } catch (_) {}
    }
    return m;
  } catch (_) { return null; }
}
const fmtViews = n => n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B" : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(n); // v2.68.8: +tier B (video super-viral 4.2B — dulu 4247.2M)
const durToSec = s => { const m = String(s || "").match(/(?:(\d+):)?(\d+):(\d{2})/); return m ? ((+(m[1] || 0)) * 3600) + (+m[2] * 60) + +m[3] : 0; };
async function ytDurSeconds(env, url) { // durasi menu YT — innertube keyless, id-match videoId (probe 23 Okt: query videoId → hasil #1 = video itu sendiri)
  const id = (String(url).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/) || [])[1];
  if (!id) return 0;
  const res = await ytSearch(id);
  const it = res && res.items && res.items.find(x => x.id === id);
  if (!it || !it.dur || it.dur === "LIVE") return 0;
  return durToSec(it.dur);
}
// v2.76.0: btch's /api/download/youtube is the only YT resolver still alive (probe 9 Nov 2026).
// It returns a 360p mp4 behind a CDN proxy that answers 200 + video/mp4 + content-range from a
// worker, yet refuses Telegram's own fetchers — hence nip:1 ("no in-Telegram URL path") on the
// item: the worker streams the bytes itself and re-uploads (<= DL_SEND_MAX).
async function btchYtResolve(env, url) {
  const base = String((env && env.BTCH_BASE) || "https://btch-downloader-api-green.vercel.app").replace(/\/+$/, "");
  const ep = base + "/api/download/youtube?url=" + encodeURIComponent(url);
  const gap = Number(env && env.DL_BTCH_GAP_MS) > 0 ? Number(env.DL_BTCH_GAP_MS) : 2000;
  let res = null;
  for (let i = 0; i < 3 && !res; i++) {
    if (i) await sleep(gap);
    const j = await getJSONh(ep, 20000);
    if (j && j.success && j.result) res = j.result;
  }
  if (!res || !dlUrlOk(res.mp4)) return null;
  return { items: [{ kind: "video", fmt: "360p", url: String(res.mp4), nip: 1 }], meta: { title: String(res.title || "").slice(0, 180), author: String(res.author || "").slice(0, 60) } };
}
async function ytResolve(env, url) {
  const r = await btchYtResolve(env, url);
  if (!r || !r.items || !r.items.length) return r;
  const pr = await Promise.all(r.items.map(it => dlProbe(env, it.url))); // v2.76.0: validate the tail before it becomes a button — dead/expired CDN links are dropped, never shown
  const alive = r.items.filter((_, i) => ytMediaCt(pr[i].ct) && pr[i].st < 400);
  if (!alive.length) return null;
  const mt = r.meta || {}; // v2.68.5: metadata YT buat menu (loader.to gak bawa meta sama sekali — menu URL-only polos)
  if (!mt.title || !mt.views || !mt.likes) { const em = await ytMeta(env, url); if (em) { mt.title = mt.title || em.title; mt.author = mt.author || em.author; mt.views = mt.views || em.views; mt.likes = mt.likes || em.likes; mt.dislikes = mt.dislikes || em.dislikes; mt.subs = mt.subs || em.subs; } }
  if (!mt.duration) { const d = await ytDurSeconds(env, url); if (d) mt.duration = d; } // v2.68.x: durasi menu — innertube keyless, id-match (gak terima top-hit random); L/R data senyap kalau gak ketemu
  return Object.assign({}, r, { items: alive, meta: mt });
}

async function ttCanonical(url) {
  try {
    const u = new URL(url);
    if (!/^(vt|vm)\.tiktok\.com$/.test(u.hostname.replace(/^www\./, ""))) return url;
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
    return r && r.url ? r.url : url;
  } catch (_) { return url; }
}
async function ttMeta(env, url) { // keyless tiktok.com/oembed (probe 23 Okt: 200 dari CF egress) — tanpa token, beda dari IG yang butuh cookie; blog tt 23 Okt
  try {
    const r = await getJSONh("https://www.tiktok.com/oembed?url=" + encodeURIComponent(url), 8000);
    if (!r || !r.title) return null;
    return { title: String(r.title).slice(0, 180), author: String(r.author_name || "").slice(0, 60) };
  } catch (_) { return null; }
}
async function rawResolve(env, url, plat) {
  if (plat === "tiktok") {
    const cu = await ttCanonical(url);

    let r = await btchPlat(env, url, "tiktok"); // v2.68.x reorder: btch primary — embed 429 (mati), tikwm bakar quota shared CF IP → duluan btch, 0 buang kerja mati
    if (!r) {
      let rr = (await tikwmResolve(cu)) || (await fsTtResolve(cu));
      if (rr && rr.meta && rr.meta.slide) {
        const e = await ttEmbedResolve(cu);
        if (e) rr = { items: e.items.concat(rr.items), meta: { title: rr.meta.title || "" } };
      }
      r = rr || (await ttEmbedResolve(url)) || (await tikwmResolve(url)) || (await fsTtResolve(url)) || (await nxTtResolve(env, url)) || (await spTtResolve(env, url)) || (await puruTtResolve(env, url));
    }
    if (r && !(r.meta && r.meta.title && r.meta.author)) { const tm = await ttMeta(env, cu); if (tm) { r.meta = r.meta || {}; r.meta.title = r.meta.title || tm.title; r.meta.author = r.meta.author || tm.author; } } // oEmbed tiktok keyless = judul+author (blog tt 23 Okt)
    return r;
  }
  if (plat === "x") {
    const s = xStatus(new URL(url));
    if (!s) return null;
    return (await fxResolve(s.user, s.id)) || (await vxResolve(s.user, s.id)) || (await syndResolve(s.id));
  }
  if (plat === "youtube") return ytResolve(env, url);
  if (plat === "instagram") {

    const e = await igEmbedResolve(url);
    if (e && e.items) return e;
    const ck = await igCookieResolve(env, url);
    if (ck && ck.items) return ck;
    const f = await fgsiIgResolve(url);
    if (f) return f;
    const nxig = await nxIgResolve(env, url); // v2.78.0: full carousels, independent upstream
    if (nxig) return nxig;
    const bt = await btchPlat(env, url, "instagram");
    if (bt) return bt;
    if (ck && ck.authdead) return { authdead: 1 };
    return e && e.blocked ? { blocked: 1 } : null;
  }
  if (plat === "facebook") {
    // v2.78.0: two keyless resolvers, both measured 9 Nov — nexray hands out fbcdn low/high and
    // sparky points at the very same fbcdn object (5,388,007 B, avc1+mp4a, 206 from our egress).
    const n = await nxFbResolve(env, url);
    if (n) return n;
    return await spFbResolve(env, url);
  }
  if (plat === "spotify") {
    const b = await btchPlat(env, url, "spotify");
    if (b) return b;
    const n = await nxSpotifyResolve(env, url); // fallback #2: independent of spotimate, same 320 kbps source
    if (n) return n;
    const k = await kyioSpotifyResolve(url); // fallback #3 (kyio 10 RPM shared-IP — cache 1h di atasnya, jarang kepanggil)
    return k ? { items: k.items, meta: { title: k.title || "" } } : null;
  }
  return null;
}

async function dlResolve(env, url, plat) {
  const ck = DL_CACHE_PREFIX + fnv1a(plat + "|" + url);
  const c = await getJSON(env, ck, null);
  if (c && c.exp > Date.now() && c.v) return c.v;
  const v = await rawResolve(env, url, plat);
  if (v && v.items && v.items.length) {
    try { await putJSON(env, ck, { v, exp: Date.now() + DL_CACHE_TTL_MS }, env.DB ? { ttlMs: DL_CACHE_TTL_MS } : undefined); } catch (_) {}
  }
  return v;
}

// v2.69.7: HARD cap buat resolve biar placeholder "working…" SELALU diganti pesan jujur dalam budget
// (fix NF-251024-1: chain IG serial embed→cookie→fgsi→btch bisa molor >resp deadline dari CF egress,
//  handleDl cuma nulis pesan final SETELAH seluruh chain kelar → placeholder keliatan macet/gak pernah jujur).
// Kalau resolve nyerempet cap → balik { hardTimeout:1 } → caller tampil dlTimeout jujur, bukan diem di "working…".
// .catch side guard bikin late-reject dari resolve yang udah kepotong gak jadi unhandled rejection.
const dlHardMs = env => parseInt((env && env.DL_RESOLVE_HARD_MS) || "", 10) || 30000;
// v2.78.2: the hard cap takes what is left of the chain budget instead of a flat 30 s — a
// resolver that eats the whole budget resolves to a hardTimeout, and the caller answers honestly
// instead of starting a send phase it can no longer finish. No artificial floor: tests drive this
// with sub-second caps, and an exhausted budget must resolve to a hardTimeout immediately.
async function dlResolveHard(env, url, plat, budget) {
  const cap = budget ? budget.slice(dlHardMs(env)) : dlHardMs(env);
  try {
    return await Promise.race([
      dlResolve(env, url, plat).catch(() => ({ hardErr: 1 })),
      new Promise(r => setTimeout(() => r({ hardTimeout: 1 }), cap))
    ]);
  } catch (_) { return null; }
}

const dlUrlOk = u => typeof u === "string" && /^https:\/\/\S+$/.test(u);
export const dlRows = (L, items, perRow = 4) => {
  const flat = items.filter(it => dlUrlOk(it.url)).map((it, i) => ({ text: it.kind === "video" ? L.dlBtnVideo(it.fmt || "") : it.kind === "audio" ? L.dlBtnAudio : L.dlBtnPhoto(i + 1), url: it.url }));
  const rows = [];
  for (let i = 0; i < flat.length; i += perRow) rows.push(flat.slice(i, i + perRow));
  return rows;
};
// v2.78.2: plain Direct Link rows for the budget-exhausted exit — every item becomes a link
// button, so a slow resolver still ends with useful buttons instead of a dead placeholder.
const dlLinkRows = (L, items, perRow = 3) => {
  const flat = items.filter(it => dlUrlOk(it.url)).map((it, i) => ({ text: (it.kind === "video" ? "🎥" : it.kind === "audio" ? "\uD83C\uDFB5" : "\uD83D\uDDBC foto " + (i + 1)) + " · " + (it.kind === "photo" ? L.dlBtnPhoto(i + 1).replace(/^.*?\s/, "") : (it.fmt || (it.kind === "audio" ? "audio" : "video"))), url: it.url }));
  const rows = [];
  for (let i = 0; i < flat.length; i += perRow) rows.push(flat.slice(i, i + perRow));
  return rows;
};

const dlSizeMs = env => parseInt(env.DL_SIZE_TIMEOUT_MS || "", 10) || 15000;
// probe gabungan 1x Range fetch: status + content-type + ukuran — validasi ekor YT + gate Direct Link di menu (v2.68.3)
async function dlProbe(env, url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(dlSizeMs(env)) });
    try { if (r.body) r.body.cancel(); } catch (_) {}
    const cr = r.headers.get("content-range");
    return { st: r.status, ct: (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase(), sz: cr ? +(cr.split("/")[1] || 0) : +(r.headers.get("content-length") || 0) };
  } catch (_) { return { st: 0, ct: "", sz: 0 }; }
}
async function dlSize(env, url, budget) {
  try {
    const ms = budget ? Math.max(1000, budget.slice(5000)) : dlSizeMs(env);
    if (ms <= 0) return 0;
    const r = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(Math.min(dlSizeMs(env), ms)) });
    if (!r.ok) return 0;
    const cr = r.headers.get("content-range");
    return cr ? +(cr.split("/")[1] || 0) : +(r.headers.get("content-length") || 0);
  } catch (_) { return 0; }
}
const dlCap = (title, src) => { const t = title ? hesc(String(title).slice(0, 180)) : ""; const s = src ? "\n🔗 " + hesc(String(src).slice(0, 300)) : ""; return (t + s).trim(); };
const audioExt = m => m === "audio/mpeg" ? "mp3" : m === "audio/ogg" ? "ogg" : m === "audio/wav" ? "wav" : m === "audio/flac" ? "flac" : "m4a";
const mimeLabel = m => m === "audio/mpeg" ? "MP3" : m === "audio/ogg" ? "OGG" : m === "audio/wav" ? "WAV" : m === "audio/flac" ? "FLAC" : m === "audio/mp4" ? "M4A" : "";
async function audioUpload(env, chatId, url, title, fcap, tok) {
  const f = await dlFetchCap(url, DL_SEND_MAX);
  if (!f) return null;
  const ct = f.ct;
  const safe = String(title || "audio").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "audio";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("title", safe);
  if (fcap) { form.append("caption", fcap); form.append("parse_mode", "HTML"); }
  const auRows = [[{ text: "💾 Save", callback_data: "dlsav:" + tok }]];
  if (dlUrlOk(url)) auRows.push([{ text: "🔗 Direct Link", url }]);
  form.append("reply_markup", JSON.stringify({ inline_keyboard: auRows }));
  form.append("audio", new Blob(f.chunks, { type: ct || "audio/mp4" }), safe + "." + audioExt(ct));
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendAudio", { method: "POST", body: form, signal: tgUpTmo(env) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) tgErrLog(env, "sendAudio", j);
    if (env.__probe && j && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: "sendAudio", chat: chatId, text: String(fcap || "").slice(0, 400), fn: (j.result && j.result.audio && j.result.audio.file_name) || (safe + "." + audioExt(ct)) });
    return j;
  } catch (_) { return null; }
}
async function dlSendFiles(env, chatId, items, title, L, src, budget) {
  const rest = [];
  const photos = [];
  let count = 0;
  for (const it of items) {
    // v2.78.2: the send loop shares the chain budget — a carousel must not start an upload it
    // cannot finish. Anything not yet sent lands in `rest` (= links in the menu) instead.
    if (budget && budget.left() < 6000) { rest.push(it); continue; }
    const capUrl = it.kind === "photo" ? DL_SEND_PHOTO_MAX : it.nip ? DL_SEND_MAX : DL_URL_SEND_MAX; // v2.76.0: nip hosts are gated by our upload cap, not by the Telegram by-URL limit
    const sz = await dlSize(env, it.url, budget);
    // sz=0 = ukuran gak ketahuan (CDN downloader modern: savenow.to = chunked, no content-length, Range diabaikan) — video/audio TETEP dicoba (TG yang nentuin via limit by-URL, fallback bytes dlFetchCap bail di DL_SEND_MAX); foto tetep butuh size (jalur lama by-URL 5MB)
    if (sz > capUrl) { rest.push(it); continue; }
    if (it.kind === "photo") { if (!sz) rest.push(it); else photos.push(it); continue; }
    const isVid = it.kind === "video";
    const tok = rndTok();
    try { await putJSON(env, DL_SAV_PREFIX + tok, { c: chatId, k: it.kind, t: String(title || "").slice(0, 60), exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
    const fcap = dlCap(title, src) + (it.pos ? "\n🎬 " + it.pos + "/" + it.total : "");
    const svRows = [[{ text: "💾 Save", callback_data: "dlsav:" + tok }]];
    if (dlUrlOk(it.url)) svRows.push([{ text: "🔗 Direct Link", url: it.url }]);
    const body = { chat_id: chatId, reply_markup: { inline_keyboard: svRows } };
    if (isVid) { body.video = it.url; body.supports_streaming = true; if (fcap) { body.caption = fcap; body.parse_mode = "HTML"; } }
    else { body.audio = it.url; if (title) body.title = String(title).slice(0, 60); if (fcap) { body.caption = fcap; body.parse_mode = "HTML"; } }
    let s = null;
    if (!isVid) s = await audioUpload(env, chatId, it.url, title, fcap, tok); // v2.68.7: audio = multipart SELALU duluan (filename = judul lagu; probe sz bisa flake → dulu size-gated = kadang keby-URL-an = audio-proxy.mp3 lagi); by-URL cuma fallback
    if (isVid && it.nip) s = await videoUpload(env, chatId, it.url, fcap, tok); // v2.76.0: nip host never serves Telegram — upload the bytes ourselves right away
    else if (!s || !s.ok) s = await tg(env, isVid ? "sendVideo" : "sendAudio", body);
    if (isVid && !it.nip && (!s || !s.ok)) s = await videoUpload(env, chatId, it.url, fcap, tok);
    if (!isVid && s && s.ok && s.result && !s.result.audio && s.result.document) {
      try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: s.result.message_id }); } catch (_) {}
      s = await audioUpload(env, chatId, it.url, title, fcap, tok);
    } else if (!isVid && (!s || !s.ok)) {
      s = await audioUpload(env, chatId, it.url, title, fcap, tok);
    }
    const r = s && s.ok && s.result;
    if (r) {
      count++;
      const mv = r.video || r.audio || {};
      try { await putJSON(env, DL_SAV_PREFIX + tok, { c: chatId, m: r.message_id, f: mv.file_id || "", k: it.kind, mime: mv.mime_type || "", s: mv.file_size || sz, t: String(title || "").slice(0, 60), exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
      await deleteLater(env, chatId, r.message_id, dlDelMs(env));
    } else { rest.push(it); try { await putJSON(env, DL_BIG_PREFIX + fnv1a(it.url), { u: it.url, exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {} } // catet URL gak bisa dikirim → menu berikutnya langsung Direct Link (v2.68.3)
  }
  const pcap = dlCap(title, src);
  if (photos.length === 1) {
    const body = { chat_id: chatId, photo: photos[0].url };
    if (pcap) { body.caption = pcap; body.parse_mode = "HTML"; }
    if (dlUrlOk(photos[0].url)) body.reply_markup = { inline_keyboard: [[{ text: "🔗 Direct Link", url: photos[0].url }]] };
    let s = await tg(env, "sendPhoto", body);
    if (!s || !s.ok) s = await photoUpload(env, chatId, photos[0].url, pcap, body.reply_markup);
    if (s && s.ok) count++; else rest.push(photos[0]);
  } else if (photos.length > 1) {
    for (let i = 0; i < photos.length; i += 10) {
      const grp = photos.slice(i, i + 10);
      const media = grp.map((p, j) => ({ type: "photo", media: p.url, caption: i === 0 && j === 0 && pcap ? pcap : undefined, parse_mode: i === 0 && j === 0 && pcap ? "HTML" : undefined }));
      const s = await tg(env, "sendMediaGroup", { chat_id: chatId, media });
      if (s && s.ok) count += grp.length; else rest.push(...grp);
    }
  }
  return { count, rest: rest.slice(0, DL_MAX_LINKS) };
}

// download STREAMING dgn bail-out di cap — dulu arrayBuffer telanjang: file raksasa (2GB loader.to) = OOM isolate / 60s timeout sia-sia
async function dlFetchCap(url, cap) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) });
    if (!r.ok || !r.body) return null;
    const ct = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (ct && ct !== "application/octet-stream" && ct !== "binary/octet-stream" && !/^(audio|video|image)\//.test(ct)) return null;
    const rd = r.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const cr = await rd.read();
      if (cr.done) break;
      got += cr.value.length;
      if (got > cap) { try { await rd.cancel(); } catch (_) {} return null; }
      chunks.push(cr.value);
    }
    if (!got) return null;
    return { chunks, ct, size: got }; // Blob(f.chunks) di caller — dulu concat Uint8Array manual = +1x copy memori (cap penuh = 2x-3x peak)
  } catch (_) { return null; }
}
async function videoUpload(env, chatId, url, fcap, tok) {
  const f = await dlFetchCap(url, DL_SEND_MAX);
  if (!f) return null;
  const ct = f.ct;
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("video", new Blob(f.chunks, { type: "video/mp4" }), "video.mp4");
  form.append("supports_streaming", "true");
  if (fcap) { form.append("caption", fcap); form.append("parse_mode", "HTML"); }
  const vuRows = [[{ text: "\ud83d\udcbe Save", callback_data: "dlsav:" + tok }]];
  if (dlUrlOk(url)) vuRows.push([{ text: "🔗 Direct Link", url }]);
  form.append("reply_markup", JSON.stringify({ inline_keyboard: vuRows }));
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendVideo", { method: "POST", body: form, signal: tgUpTmo(env) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) tgErrLog(env, "sendVideo", j);
    if (env.__probe && j && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: "sendVideo", chat: chatId, text: String(fcap || "").slice(0, 400) });
    return j;
  } catch (_) { return null; }
}
async function photoUpload(env, chatId, url, cap, mark) {
  let buf = null;
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) return null;
    buf = await r.arrayBuffer();
  } catch (_) { return null; }
  if (!buf || !buf.byteLength || buf.byteLength > DL_SEND_PHOTO_MAX) return null;
  const form = new FormData();
  form.append("chat_id", chatId);
  if (cap) { form.append("caption", cap); form.append("parse_mode", "HTML"); }
  if (mark) form.append("reply_markup", JSON.stringify(mark));
  form.append("photo", new Blob([buf], { type: "image/jpeg" }), "photo.jpg");
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendPhoto", { method: "POST", body: form, signal: tgUpTmo(env) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) tgErrLog(env, "sendPhoto", j);
    if (env.__probe && j && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: "sendPhoto", chat: chatId, text: String(cap || "").slice(0, 400) });
    return j;
  } catch (_) { return null; }
}
const dlDelMs = env => parseInt(env.DL_DEL_MS || "", 10) || DL_DEL_MS;
const dlMenuMs = env => parseInt(env.DL_MENU_MS || "", 10) || DL_MENU_TTL_MS;
export async function deleteLater(env, chatId, mid, ms, keepKey) {
  scheduleDelete(env, chatId, mid, ms, keepKey);
  try {
    const q = ((await getJSON(env, DELQ_KEY, [])) || []).filter(x => !(x && x.c === chatId && x.m === mid));
    q.push(keepKey ? { c: chatId, m: mid, t: Date.now() + ms, k: keepKey } : { c: chatId, m: mid, t: Date.now() + ms });
    await putJSON(env, DELQ_KEY, q.slice(-20), env.DB ? { ttlMs: 3600000 } : undefined);
  } catch (_) {}
}
const rndTok = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmtDur = s => { s = Math.round(Number(s) || 0); return s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : ""; };
export function dlMenuText(L, plat, meta, photosDone, vaItems, urlOnly, note) {
  const names = { tiktok: "TikTok", x: "X (Twitter)", youtube: "YouTube", instagram: "Instagram", song: "Song search", spotify: "Spotify", facebook: "Facebook", soundcloud: "SoundCloud" };
  const lines = [L.dlMenuHead];
  if (photosDone) lines.push(L.dlPhotosDone(photosDone));
  const vids = (vaItems || []).filter(x => x.kind === "video" && x.pos);
  for (let i = 0; i < vids.length; i++) lines.push("🎥 Video " + (i + 1) + "/" + vids.length + " → " + vids[i].pos + "/" + vids[i].total);
  lines.push(L.dlType + " " + (names[plat] || plat));
  if (meta.title) lines.push(L.dlTitle + " " + hesc(String(meta.title).slice(0, 180)));
  if (meta.author) lines.push(L.dlAuthor + " " + hesc(String(meta.author).slice(0, 60)));
  if (meta.subs) lines.push(L.dlSubs + " " + hesc(String(meta.subs).slice(0, 30)));
  if (meta.views) lines.push(L.dlViews + " " + fmtViews(+meta.views));
  if (meta.likes) lines.push(L.dlLikes + " " + fmtViews(+meta.likes));
  if (meta.dislikes) lines.push(L.dlDislikes + " " + fmtViews(+meta.dislikes)); // RYD estimate aja (YT sembunyiin dislikes sejak 2021) — angka kecil, gak ngaku presisi
  if (meta.caption) lines.push(L.dlCaption + " " + hesc(String(meta.caption).slice(0, 180)));
  if (meta.duration) lines.push(L.dlDuration + " " + fmtDur(meta.duration));
  if (meta.slide) lines.push(L.dlSlideNote);
  lines.push(SEP_LINE, urlOnly ? L.dlUrlNote : L.dlPickNote); // v2.68.5: hint correlate — URL-only = bukan "file keirim auto-delete"
  if (note) lines.push(note);
  return lines.join("\n");
}
async function dlMenuShow(env, chatId, L, phMid, plat, vaItems, meta, photosDone, linkRows, src, note, budget, linksFallback) {
  const multi = vaItems.length > 1;
  const rows = [];
  // v2.78.2: the probe row costs one fetch per variant; on a nearly-empty budget skip it and let
  // the fallback rows carry the links instead of dying mid-menu.
  const pr = budget && budget.left() < 12000
    ? vaItems.map(() => ({ st: 200, ct: "", sz: 0 }))
    : await Promise.all(vaItems.map(it => dlProbe(env, it.url))); // 1x probe (ct+size) per varian — label audio + gate Direct Link
  for (let i = 0; i < vaItems.length; i++) {
    const it = vaItems[i];
    let lbl = it.fmt || "";
    if (it.kind === "audio" && !lbl) lbl = mimeLabel(pr[i].ct) || "MP3";
    // v2.76.0: nip items (host that refuses Telegram's fetchers, e.g. the YT 360p proxy) are gated
    // by our own multipart upload cap instead — a by-URL send would never work for them.
    const cap = it.nip ? DL_SEND_MAX : DL_URL_SEND_MAX;
    let big = pr[i].sz > cap || (!it.nip && plat === "youtube" && !pr[i].sz && it.kind === "video"); // v2.68.10: forceBig = VIDEO doang — MP3 lagu normal ringan (≤15MB) = dicoma + multipart (audioUpload, filename judul); video YT memang 23-63MB (v2.68.4)
    if (!big) { const b = await getJSON(env, DL_BIG_PREFIX + fnv1a(it.url), null); big = !!(b && b.exp > Date.now()); } // dipelajari dari pick gagal — sz=0 pun bisa ketahuan gak bisa dikirim
    if (big && dlUrlOk(it.url)) { // v2.68.3: varian yang pasti gagal kirim = tombol Direct Link dari awal (no double-press)
      rows.push([{ text: it.kind === "video" ? (it.pos ? "🎥 " + it.pos + "/" + it.total : "🎥 " + (it.fmt || L.dlVideoBtn)) : "🎵 " + lbl, url: it.url }]);
      continue;
    }
    const tok = rndTok();
    try { await putJSON(env, DL_PICK_PREFIX + tok, { c: chatId, item: it, t: meta.title || "", s: src || "", multi, exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
    rows.push([{ text: it.kind === "video" ? (it.pos ? "🎥 " + it.pos + "/" + it.total : "🎥 " + (it.fmt || L.dlVideoBtn)) : "🎵 " + lbl, callback_data: "dlpick:" + tok }]);
  }
  for (const r of linkRows || []) rows.push(r);
  // v2.78.2: every variant became a URL button (big / gated) — same honest exit, and on an empty
  // budget force the link buttons so the menu is still usable.
  const urlOnly = rows.length > 0 && !rows.some(rw => (rw || []).some(b => b.callback_data)); // semua tombol = URL button (gak ada varian file)
  if (budget && budget.left() < 8000 && linksFallback && linksFallback.length) {
    for (const it of vaItems) { if (dlUrlOk(it.url) && !rows.some(rw => (rw || []).some(b => b.url === it.url))) rows.unshift([{ text: it.kind === "video" ? "🎥 " + (it.fmt || "video") : it.kind === "audio" ? "\uD83C\uDFB5 audio" : "foto", url: it.url }]); }
  }
  const text = dlMenuText(L, plat, meta, photosDone, vaItems, urlOnly, note);
  let mid = phMid;
  if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text, parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
  else {
    const j = await tg(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
    mid = j && j.ok && j.result ? j.result.message_id : 0;
  }
  if (mid) await deleteLater(env, chatId, mid, dlMenuMs(env));
}
export async function handleDlPick(env, cbId, chatId, mid, tok) {
  const L = await uiLang(env);
  const e = await getJSON(env, DL_PICK_PREFIX + tok, null);
  const multi = !!(e && e.multi);
  if (!multi) { try { await env.KV.delete(DL_PICK_PREFIX + tok); } catch (_) {} }
  if (!e || !e.item) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.dlExpired }); return; }
  const sent = await dlSendFiles(env, chatId, [e.item], e.t || "", L, e.s || "", wallBudget(parseInt((env && env.DL_PICK_BUDGET_MS) || "", 10) || 55000)); // v2.78.2: the tap path gets a budget too — out of budget = honest link-only menu, not a dead end
  if (multi) {
    if (!sent.count) {
      const rows = dlRows(L, [e.item]);
      await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.dlLinkOnly, parse_mode: "HTML", reply_markup: rows.length ? { inline_keyboard: rows } : undefined });
      await deleteLater(env, chatId, mid, dlMenuMs(env));
    }
    await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: sent.count ? L.dlPickOk : L.dlPickFail });
    return;
  }
  if (sent.count) {
    await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.dlFileOk + " · " + L.dlDelNote, parse_mode: "HTML" });
    await deleteLater(env, chatId, mid, dlDelMs(env));
  } else {
    await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.dlLinkOnly, parse_mode: "HTML", reply_markup: dlRows(L, [e.item]).length ? { inline_keyboard: dlRows(L, [e.item]) } : undefined });
    await deleteLater(env, chatId, mid, dlMenuMs(env));
  }
  await tg(env, "answerCallbackQuery", { callback_query_id: cbId });
}
export async function delQsweep(env) {
  let q;
  try { q = await getJSON(env, DELQ_KEY, []); } catch (_) { return; }
  if (!Array.isArray(q) || !q.length) return;
  const now = Date.now();
  const due = q.filter(e => e && e.t <= now), keep = q.filter(e => e && e.t > now);
  for (const e of due) {
    // v2.71.0: entry bawa keep-key (tombol 💾 ditekan) → jangan hapus, cuma keluar dari antrean
    if (e && e.k) { let kept = null; try { kept = await env.KV.get(e.k); } catch (_) {} if (kept) continue; }
    try { await tg(env, "deleteMessage", { chat_id: e.c, message_id: e.m }); } catch (_) {}
  }
  if (!due.length) return;
  try { if (keep.length) await putJSON(env, DELQ_KEY, keep, env.DB ? { ttlMs: 3600000 } : undefined); else await env.KV.delete(DELQ_KEY); } catch (_) {}
}

export async function handleDl(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const url = raw.split(/\s+/)[0];
  const plat = url ? dlPlatform(url) : null;
  if (!plat) return reply(env, chatId, L.dlUsage);
  // v2.78.0: SoundCloud has no resolver left, so the bytes are assembled here instead of resolved.
  if (plat === "soundcloud") return handleSoundCloud(env, msg, chatId);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const ph = await tg(env, "sendMessage", { chat_id: chatId, text: L.dlWorking, parse_mode: "HTML" });
  const phMid = ph && ph.ok && ph.result ? ph.result.message_id : 0;
  // v2.76.0: YouTube never goes through the generic resolver path — it has its own menu
  // (360p instant + 720p/MP3 builder). Doing it here keeps the failure text honest.
  if (plat === "youtube") return ytMenuShow(env, chatId, L, phMid, url, {});
  // v2.78.2: same treatment the YouTube chain got in 2.78.1. The resolve hard-cap covers a dead
  // resolver, but a *slow* resolver that succeeds at 28–30 s left nothing for the send phase (photos
  // one by one, then the menu edit) — the isolate died mid-way and the "working…" placeholder stayed
  // forever, and there was no watchdog record for this path at all. One budget for the whole chain,
  // hops get b.slice(), and a record the cron watchdog closes if the invocation dies anyway.
  const recKey = YT_RESOLVE_PREFIX + rndTok();
  const budget = wallBudget(parseInt((env && env.DL_RESOLVE_BUDGET_MS) || "", 10) || 60000);
  if (phMid) { try { await putJSON(env, recKey, { chat: chatId, mid: phMid, kind: "resolve", vid: "dl", ts: Date.now() }, env.DB ? { ttlMs: 10 * 60 * 1000 } : undefined); } catch (_) {} }
  const linksOf = items => items.map(it => it && it.url).filter(u => dlUrlOk(u)).slice(0, DL_MAX_LINKS);
  try {
  let res = null;
  // The resolve hard-cap now shares the chain budget: a resolver that eats the whole budget resolves
  // to a hardTimeout, which the failure branch reports honestly (dlTimeout) instead of leaving the
  // send phase nothing to work with.
  try { res = await dlResolveHard(env, url, plat, budget); } catch (_) {}
  const items = res && res.items ? res.items.slice(0, DL_MAX_LINKS) : [];
  if (!items.length) {
    const failText = (res && res.hardTimeout) || plat === "youtube" ? L.dlTimeout : (res && res.authdead ? L.dlIgAuth() : res && res.blocked ? L.dlIgBlocked() : L.dlFailRes(plat));
    if (phMid) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: failText, parse_mode: "HTML" });
      await deleteLater(env, chatId, phMid, dlDelMs(env));
    } else await reply(env, chatId, failText);
    return;
  }
  // Out of budget after a slow resolve: post the links right away (Telegram opens them in a browser)
  // instead of dying mid-photo-send with the placeholder still up.
  if (budget.left() < 10000) {
    const links = linksOf(items);
    const t = (links.length ? L.dlSlowLinks(links) : L.dlTimeout);
    if (phMid) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: t, parse_mode: "HTML", reply_markup: links.length ? { inline_keyboard: dlLinkRows(L, items) } : undefined });
      await deleteLater(env, chatId, phMid, dlMenuMs(env));
    } else await reply(env, chatId, t);
    return;
  }
  const meta = res.meta || {};
  const photos = items.filter(x => x.kind === "photo");
  const va = items.filter(x => x.kind !== "photo");
  let photosDone = 0;
  let linkRows = [];
  if (photos.length) {
    const ps = await dlSendFiles(env, chatId, photos, meta.title || "", L, url, budget);
    photosDone = ps.count;
    linkRows = dlRows(L, photos); // v2.67.0: semua foto bawa Direct Link (urutan asli carousel) — tombol nyempil di konfirmasi/menu
  }
  if (!va.length) {
    const t = L.dlPhotosDone(photosDone);
    const mk = (photos.length > 1 || photosDone < photos.length) && linkRows.length ? { inline_keyboard: linkRows } : undefined;
    if (phMid) await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: t, parse_mode: "HTML", reply_markup: mk });
    return;
  }
  // Second low-budget exit: photos consumed the rest of the budget, so hand the video/audio
  // variants over as links rather than starting a probe menu we cannot finish.
  if (budget.left() < 8000) {
    const links = linksOf(items);
    const rows = linkRows.concat(dlLinkRows(L, va));
    const t = L.dlSlowLinks(links);
    if (phMid) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: t, parse_mode: "HTML", reply_markup: rows.length ? { inline_keyboard: rows } : undefined });
      await deleteLater(env, chatId, phMid, dlMenuMs(env));
    } else await reply(env, chatId, t);
    return;
  }
  return dlMenuShow(env, chatId, L, phMid, plat, va, meta, photosDone, linkRows, url, undefined, budget, linksOf(items));
  } finally {
    try { await env.KV.delete(recKey); } catch (_) {}
  }
}

const hesc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/* v2.76.0: kyio's yt-play audio resolver removed — it now returns a redirector.googlevideo.com URL
   that is bound to the resolving IP, so neither Telegram nor the worker can fetch it. */
async function kyioSpotifyResolve(u) {
  const j = await getJSONh(KYIO_BASE + "/api/v2/dl/spotify-sc?q=" + encodeURIComponent(u), 30000); // sama: kyio lambat dari CF egress
  const r = j && j.status === true && j.result;
  const d = r && r.download ? String(r.download) : "";
  if (!d.startsWith("https://")) return null;
  const title = ((r.artist ? String(r.artist) + " - " : "") + String(r.title || "")).slice(0, 120);
  return { items: [{ kind: "audio", url: d }], title };
}
async function musicCached(env, cacheTag, key, resolveFn) {
  const ck = DL_CACHE_PREFIX + fnv1a(cacheTag + "|" + key.toLowerCase());
  const c = await getJSON(env, ck, null);
  if (c && c.exp > Date.now() && c.v) return c.v;
  const v = await resolveFn();
  if (v && v.items && v.items.length) {
    try { await putJSON(env, ck, { v, exp: Date.now() + DL_CACHE_TTL_MS }, env.DB ? { ttlMs: DL_CACHE_TTL_MS } : undefined); } catch (_) {}
  }
  return v;
}
async function musicReply(env, chatId, L, res, plat, src) {
  const ph = await tg(env, "sendMessage", { chat_id: chatId, text: L.dlWorking, parse_mode: "HTML" });
  const phMid = ph && ph.ok && ph.result ? ph.result.message_id : 0;
  const items = res && res.items ? res.items.slice(0, DL_MAX_LINKS) : [];
  if (!items.length) {
    const t = L.dlFailRes(plat);
    if (phMid) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: t, parse_mode: "HTML" });
      await deleteLater(env, chatId, phMid, dlDelMs(env));
    } else await reply(env, chatId, t);
    return;
  }
  return dlMenuShow(env, chatId, L, phMid, plat, items, { title: (res && res.title) || "" }, 0, [], src || "");
}
export async function handleSong(env, msg, chatId) {
  const L = await uiLang(env);
  const q = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!q || /^https?:\/\//.test(q)) return reply(env, chatId, L.songUsage);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  // v2.76.0: kyio's yt-play now hands back an IP-locked googlevideo URL (dead end for Telegram),
  // so /song searches YouTube itself and opens the same builder menu as /dl and /yts.
  let res = null;
  try { res = await musicCached(env, "yts", q, () => ytSearch(q)); } catch (_) { res = null; }
  const top = res && res.items ? res.items[0] : null;
  if (!res) return reply(env, chatId, L.dlFailRes("YouTube search"));
  if (!top) return reply(env, chatId, L.ytsNone(hesc(q.slice(0, 80))));
  const url = "https://www.youtube.com/watch?v=" + top.id;
  return ytMenuShow(env, chatId, L, 0, url, { title: top.t || "", author: top.ch || "", views: top.views || 0, duration: durToSec(top.dur) });
}
export async function handleSpotify(env, msg, chatId) {
  const L = await uiLang(env);
  const q = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  let ok = false;
  try { ok = /(^|\.)spotify\.com$/.test(new URL(q).hostname.replace(/^www\./, "")); } catch (_) {}
  if (!ok) return reply(env, chatId, L.spotUsage);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  let res = null;
  try { res = await musicCached(env, "spotify", q, () => kyioSpotifyResolve(q)); } catch (_) {}
  return musicReply(env, chatId, L, res, "spotify", q);
}

// ===== v2.78.0: SoundCloud, done by hand (no keyless resolver survives) =====
// Chain, verified end to end from a Worker: homepage → the one asset bundle that carries
// client_id (32 chars, ~2.9 MB, 63 ms) → /resolve → transcodings[] (all HLS now) → the playlist
// URL → #EXT-X-MAP init.mp4 + one .m4s per segment, concatenated in order. The result is a valid
// fragmented MP4 that Telegram accepts as audio (probed: ok:true, audio/mp4, 5,447,799 B).
async function scClientId(env) {
  try {
    const c = await getJSON(env, SC_CID_KEY, null);
    if (c && c.id && c.ts && Date.now() - Number(c.ts) < SC_CID_TTL_MS) return String(c.id);
  } catch (_) {}
  // The homepage links several bundles; the id lives in the biggest one. Walk them newest-first
  // instead of hardcoding a hash — SoundCloud renames that file on every deploy.
  const hp = await getText("https://soundcloud.com/", UA);
  const assets = [...new Set((String(hp || "").match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[0-9a-zA-Z._-]*\.js/g) || []))].reverse();
  for (const a of assets) {
    const js = await getText(a, UA);
    const m = String(js || "").match(/client_id[:=]"([A-Za-z0-9]{32})/);
    if (m) {
      try { await putJSON(env, SC_CID_KEY, { id: m[1], ts: Date.now() }, env.DB ? { ttlMs: SC_CID_TTL_MS } : undefined); } catch (_) {}
      return m[1];
    }
  }
  return "";
}
// Permalinks are the reliable input; /resolve answers 404 for anything that is not a track or set.
async function scResolveTrack(env, url) {
  const cid = await scClientId(env);
  if (!cid) return null;
  const j = await getJSONh("https://api-v2.soundcloud.com/resolve?url=" + encodeURIComponent(url) + "&client_id=" + cid, 20000);
  if (!j || !j.kind) return null;
  if (j.kind !== "track") return { set: 1, title: String(j.title || "").slice(0, 110) }; // playlists are a later step, not a silent fail
  const tc = (j.media && Array.isArray(j.media.transcodings) ? j.media.transcodings : []).slice().sort((a, b) => (b.quality === "hq" ? 1 : 0) - (a.quality === "hq" ? 1 : 0));
  const pick = tc.find(x => String(x.preset) === "aac_160k") || tc[0];
  if (!pick || !pick.url) return null;
  return { cid, tcUrl: String(pick.url), title: String(j.title || "").slice(0, 110), artist: String((j.user && j.user.username) || "").slice(0, 60), dur: Math.round((Number(j.duration) || 0) / 1000), fmt: String(pick.preset || "").replace("aac_", "") + "k" };
}
// Segment fetch, a few at a time: 27 serial requests would be slow, an unbounded burst gets
// throttled. Four at a time measured 1.4 s for the whole track. The per-segment timeout follows
// what is left of the chain's budget: a stalled CDN used to be able to spend 25 s each and leave
// the "pulling the track…" message behind forever.
async function scHlsBytes(env, plUrl, bud) {
  const mp = await getText(plUrl, UA);
  if (!mp) return null;
  const init = (String(mp).match(/#EXT-X-MAP:URI="([^"]+)"/) || [])[1] || "";
  const segs = String(mp).split("\n").filter(l => l.startsWith("https://"));
  if (!segs.length) return null;
  // One metric: a Worker may open 50 subrequests, and the metadata calls above already spent a few.
  // A 27-segment track (5 min) measured 33 total. Anything past ~35 segments will not fit, so say so
  // instead of dying halfway with a truncated file.
  if (segs.length > 35) return { tooBig: 1 };
  const parts = [init].concat(segs).filter(Boolean);
  const chunks = [];
  let got = 0;
  const segMs = hopMs(bud ? bud.slice(25000) : 25000);
  for (let i = 0; i < parts.length; i += 4) {
    if (bud && bud.left() < 8000) return { stuck: 1 }; // out of budget mid-assembly: say so, do not truncate
    const rs = await Promise.all(parts.slice(i, i + 4).map(u => fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(segMs) }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null)));
    for (const b of rs) {
      if (!b || !b.byteLength) continue;
      got += b.byteLength;
      if (got > SC_SEG_MAX) return null; // a set, not a track — do not blow the isolate
      chunks.push(new Uint8Array(b));
    }
    if (env.__probe) env.__probe.push({ mid: null, method: "scseg", chat: 0, text: (i + 4) + "/" + parts.length + " " + got });
  }
  if (!chunks.length) return null;
  const head = chunks.map(c => String.fromCharCode(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7])).join("");
  if (!head.includes("ftyp")) return null; // not an MP4 = the CDN answered something else
  return { chunks, size: got };
}
async function scFetch(env, url, bud) {
  const t = await scResolveTrack(env, url);
  if (!t || !t.tcUrl) return t && t.set ? t : null;
  if (bud && bud.left() < 15000) return { stuck: 1 };
  const pl = await getJSONh(t.tcUrl + "?client_id=" + t.cid, 20000);
  const plUrl = pl && pl.url ? String(pl.url) : "";
  if (!plUrl.startsWith("https://")) return null;
  const f = await scHlsBytes(env, plUrl, bud);
  if (!f) return null;
  if (f.stuck) return { stuck: 1, title: t.title };
  if (f.tooBig) return { tooBig: 1, title: t.title };
  return Object.assign({ chunks: f.chunks, size: f.size }, t);
}
async function scUpload(env, chatId, sc, title) {
  const name = String(title || sc.artist || "SoundCloud").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "audio";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("audio", new Blob(sc.chunks, { type: "audio/mp4" }), name + ".m4a");
  form.append("title", name);
  if (sc.artist) form.append("performer", String(sc.artist));
  if (sc.dur > 0) form.append("duration", String(sc.dur));
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendAudio", { method: "POST", body: form, signal: tgUpTmo(env) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) tgErrLog(env, "sendAudio", j);
    if (env.__probe && j && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: "sendAudio", chat: chatId, text: "SC " + name, fn: name + ".m4a" });
    return j;
  } catch (_) { return null; }
}
export async function handleSoundCloud(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const url = (raw.split(/\s+/)[0] || "").split("?")[0];
  if (!/^https?:\/\//.test(url)) return reply(env, chatId, L.dlUsage);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const ph = await tg(env, "sendMessage", { chat_id: chatId, text: L.scWorking, parse_mode: "HTML" });
  const phMid = ph && ph.ok && ph.result ? ph.result.message_id : 0;
  // The assembly is a bounded burst of segment fetches. Budgeted, so a stalled CDN ends in a message
  // instead of a "pulling the track…" that stays on screen after the invocation is cut.
  const bud = scBudget(env);
  const recKey = YT_RESOLVE_PREFIX + rndTok();
  try { await putJSON(env, recKey, { chat: chatId, mid: phMid, kind: "sc", vid: "sc", ts: Date.now() }, env.DB ? { ttlMs: 10 * 60 * 1000 } : undefined); } catch (_) {}
  const sc = await scFetch(env, url, bud).catch(() => null);
  const fail = async t => {
    if (phMid) { await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: t, parse_mode: "HTML" }); await deleteLater(env, chatId, phMid, dlDelMs(env)); }
    else await reply(env, chatId, t);
    try { await env.KV.delete(recKey); } catch (_) {}
  };
  if (!sc) return fail(L.scFail);
  if (sc.stuck) return fail(L.ytStuck);
  if (sc.set) return fail(L.scSet);
  if (sc.tooBig) return fail(L.scLong);
  const title = sc.artist ? sc.artist + " - " + sc.title : sc.title;
  const j = await scUpload(env, chatId, sc, title);
  if (!j || !j.ok) return fail(L.scSendFail);
  try { await env.KV.delete(recKey); } catch (_) {}
  const mid = (j.result && j.result.message_id) || 0;
  if (mid) await deleteLater(env, chatId, mid, dlDelMs(env));
  if (phMid) { await tg(env, "deleteMessage", { chat_id: chatId, message_id: phMid }); }
}
// ===== /yts — YouTube search (v2.68.8) =====
// innertube youtubei/v1/search (WEB client, keyless) = JALAN dari CF egress (probe 22 Okt: 200 + 18-19 videoRenderer, metadata lengkap) — 1 call udah bawa durasi/views/published, gak perlu RYD/oEmbed di sini
const parseViews = s => { const m = String(s || "").match(/([\d.,]+)\s*([KMB])?\s*view/i); if (!m) return 0; const n = parseFloat(String(m[1]).replace(/,/g, "")); if (!isFinite(n)) return 0; return Math.round(n * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2] || ""] || 1)); };
async function ytSearch(q) {
  try {
    const r = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": UA, "accept-language": "en-US,en;q=0.9", origin: "https://www.youtube.com", referer: "https://www.youtube.com/" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20241126.01.00", hl: "en", gl: "US" } }, query: q.slice(0, 200) }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const secs = ((((j || {}).contents || {}).twoColumnSearchResultsRenderer || {}).primaryContents || {}).sectionListRenderer || {};
    const items = [];
    for (const s of (secs.contents || [])) {
      if (items.length >= YTS_MAX) break;
      for (const is of (((s.itemSectionRenderer || {}).contents) || [])) {
        const v = is.videoRenderer;
        if (!v || !v.videoId || !v.title) continue;
        const live = (v.badges || []).some(b => b && b.metadataBadgeRenderer && b.metadataBadgeRenderer.label === "LIVE");
        items.push({ id: v.videoId, t: ((v.title.runs || [])[0] || {}).text || "", ch: (((v.ownerText || {}).runs || [])[0] || {}).text || "", dur: (v.lengthText && v.lengthText.simpleText) || (live ? "LIVE" : ""), views: parseViews(v.viewCountText && v.viewCountText.simpleText), pub: (v.publishedTimeText && v.publishedTimeText.simpleText) || "" });
        if (items.length >= YTS_MAX) break;
      }
    }
    return { items };
  } catch (_) { return null; }
}
const ytsMetaLines = it => { const seg = []; if (it.ch) seg.push("   👤 " + hesc(String(it.ch).slice(0, 60))); if (it.dur) seg.push("   ⏱ " + hesc(String(it.dur).slice(0, 12))); if (it.views) seg.push("   👁 " + fmtViews(it.views)); if (it.pub) seg.push("   📅 " + hesc(String(it.pub).slice(0, 30))); return seg; };
// v2.69.9: kirim gallery jadi album foto Telegram (sendMediaGroup 10/chunk) + auto-delete + simpan referensi
async function nhAlbumDeliver(env, chatId, L, id, title, numPages, pages, ctrlMid) {
  const CH = 10;
  const mids = [];
  const chunks = [];
  for (let i = 0; i < pages.length; i += CH) chunks.push(pages.slice(i, i + CH));
  const caps = title + (numPages ? " · " + numPages + " hal" : "");
  // v2.73.0: satu chunk gagal (misal 1 URL 404) jangan buang 10 halaman — retry sekali, lalu fallback satu-satu
  let failed = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const media = chunks[ci].map((p, i) => ({ type: "photo", media: p.url, caption: (ci === 0 && i === 0) ? caps : "" }));
    let got = null;
    for (let a = 0; a < 2 && !got; a++) {
      const j = await tg(env, "sendMediaGroup", { chat_id: chatId, media });
      if (j && j.ok && Array.isArray(j.result)) got = j.result;
      else if (!a) await sleep(400);
    }
    if (got) {
      for (const m of got) if (m && m.message_id) mids.push(m.message_id);
    } else {
      for (let i = 0; i < chunks[ci].length; i++) {
        const p = chunks[ci][i];
        const j = await tg(env, "sendPhoto", { chat_id: chatId, photo: p.url, caption: (ci === 0 && i === 0) ? caps : undefined });
        if (j && j.ok && j.result && j.result.message_id) mids.push(j.result.message_id);
        else failed++;
        if (i < chunks[ci].length - 1) await sleep(120);
      }
    }
    if (ci < chunks.length - 1) await sleep(300);
  }
  const dlUrl = nhDl(env, id, "zip");
  let ctrl = ctrlMid;
  if (!ctrl) {
    const tok = rndTok();
    try { await putJSON(env, NH_SAVE_PREFIX + tok, { id, t: title.slice(0, 120), n: numPages }, env.DB ? { ttlMs: NH_AUTODEL_MS } : undefined); } catch (_) {}
    const kb = [[{ text: L.nhSaveBtn, callback_data: "nhsave:" + tok }, { text: L.nhsZip, callback_data: "nhnz:" + id }]].concat(dlUrl ? [[{ text: L.nhDlBtn, url: dlUrl }]] : []);
    const txt = L.nhAlbumCtrl(title, numPages) + (failed ? "\n" + L.nhAlbumFail(failed) : "");
    const cj = await tg(env, "sendMessage", { chat_id: chatId, text: txt, parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
    ctrl = cj && cj.ok && cj.result ? cj.result.message_id : 0;
  }
  const ms = parseInt(env.NH_AUTODEL_MS || "", 10) || NH_AUTODEL_MS;
  for (const mid of mids) scheduleDelete(env, chatId, mid, ms);
  if (ctrl) scheduleDelete(env, chatId, ctrl, ms);
  return { mids };
}

export async function handleNh(env, msg, chatId) {
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const L = await uiLang(env);
  const parts = raw.split(/\s+/);
  // R-12: `/nh last [fmt]` re-sends the newest cached build instead of dispatching another one.
  if (/^last$/i.test(parts[0] || "")) return nhLast(env, chatId, parts[1]);
  if (!raw) return reply(env, chatId, L.nhUsage);
  // R-48: digits are an id, a link is a link, everything else is a search. No guessing.
  if (/^\d{1,10}$/.test(parts[0])) return nhRun(env, chatId, parts[0], parts[1], parts[2]);
  const link = nhLinkId(raw);
  if (link) return nhRun(env, chatId, link.id, link.fmt || "", "");
  if (/^https?:\/\//i.test(raw)) return reply(env, chatId, L.nhUsage);
  return nhSearch(env, chatId, raw);
}

// ===== R-48: /nh <query> search =====
// The official API needs a key (v2 search -> 400, legacy -> 403), so results are read from the
// mirror's search page. Brittle by nature: any parse failure or non-200 is reported to the user
// instead of pretending there were no results.
const NH_SITE = "https://nhentai.to";
const NH_SITE_UA = "Mozilla/5.0 (compatible; kibo/2.75; +https://github.com/ruqes/kibo)";
const NH_SEARCH_MAX = 12;

export function nhUnesc(s) {
  return String(s || "")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

export function nhParseSearch(html, max) {
  const out = [];
  const blocks = String(html || "").split('<div class="gallery"').slice(1);
  for (const b of blocks) {
    const id = (b.match(/href="\/g\/(\d{1,10})\//) || [])[1];
    if (!id) continue;
    const title = nhUnesc((b.match(/alt="([^"]*)"/) || [])[1] || "").replace(/\s+/g, " ").trim();
    const thumb = (b.match(/src="(https:\/\/[^"]+)"/) || [])[1] || "";
    out.push({ id: Number(id), title: title.slice(0, 110), thumb });
    if (out.length >= (max || NH_SEARCH_MAX)) break;
  }
  return out;
}

export async function nhSearch(env, chatId, query) {
  const L = await uiLang(env);
  const q = String(query || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!q) return reply(env, chatId, L.nhUsage);
  let html = "";
  try {
    const r = await fetch(NH_SITE + "/search?q=" + encodeURIComponent(q), {
      headers: { "user-agent": NH_SITE_UA, accept: "text/html" },
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    html = await r.text();
  } catch (e) {
    return reply(env, chatId, L.nhSearchFail(String((e && e.message) || e).slice(0, 90)));
  }
  const hits = nhParseSearch(html, NH_SEARCH_MAX);
  if (!hits.length) return reply(env, chatId, L.nhSearchEmpty(hesc(q)));
  const lines = [L.nhSearchHead(hesc(q)), ""];
  // v2.75.2: caption carries the full numbered list; the buttons are just numbers so a row fits
  // five of them and the keyboard stays small (owner: "biar muat banyak").
  const rows = [];
  hits.forEach((h, i) => {
    lines.push((i + 1) + ". " + hesc(h.title));
    if (i % 5 === 0) rows.push([]);
    rows[rows.length - 1].push({ text: String(i + 1), callback_data: "nh:" + h.id });
  });
  lines.push("", L.nhSearchHint);
  return tg(env, "sendMessage", { chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
}

// v2.71.0: link NH yang ditempel di chat (bukan command) → {id, fmt} atau null.
// Cuma "link doang" (± kata format) yang dianggap permintaan — kalimat biasa gak dibajak.
const NH_LINK_RE = /https?:\/\/(?:www\.)?(?:nhentai\.net|nhentai\.to|cin\.guru)\/(?:g|v)\/(\d{1,10})\b/i;
export function nhLinkId(text) {
  const t = String(text || "");
  const m = t.match(NH_LINK_RE);
  if (!m) return null;
  const rest = t.replace(m[0], " ").replace(/[.,;!?\s/]+$/, "").replace(/^[\s/]+/, "").trim().toLowerCase();
  if (rest && !NH_FMT_ALIAS[rest]) return null;
  return { id: m[1], fmt: rest || "" };
}

// v2.71.0: satu pintu buat /nh manual, link auto-detect, dan format default dari /settings
export async function nhRun(env, chatId, idRaw, fmtRaw, extraRaw) {
  const L = await uiLang(env);
  const id = Number(String(idRaw || "").trim());
  if (!id || !Number.isInteger(id)) return reply(env, chatId, L.nhUsage);
  // v2.73.0: "refresh" (posisi format atau setelahnya) = buang cache & build ulang
  const freshRe = /^(refresh|fresh|rebuild|ulang)$/;
  let fmtIn = String(fmtRaw || "").trim().toLowerCase();
  let fresh = false;
  if (freshRe.test(fmtIn)) { fresh = true; fmtIn = ""; }
  if (freshRe.test(String(extraRaw || "").trim().toLowerCase())) fresh = true;
  let fmt = "";
  if (fmtIn) { fmt = NH_FMT_ALIAS[fmtIn] || ""; if (!fmt) return reply(env, chatId, L.nhBadFmt); }
  if (!fmt) fmt = await nhDefFmt(env); // default dari /settings → album kalau belum pernah diset
  await tg(env, "sendChatAction", { chat_id: chatId, action: fmt === "album" ? "upload_photo" : "upload_document" });
  let title = "NH #" + id, numPages = 0, pages = [];
  try {
    const meta = await nhMeta(env, id);
    if (meta && meta.title) title = String(meta.title).slice(0, 110);
    if (meta && meta.num_pages) numPages = meta.num_pages;
    if (meta && Array.isArray(meta.pages) && meta.pages.length) pages = meta.pages;
  } catch (_) {}
  if (fmt === "album") {
    if (pages.length) return nhAlbumDeliver(env, chatId, L, id, title, numPages, pages, 0);
    return reply(env, chatId, "⚠️ Album gagal dibuka (metadata dari Worker tidak tersedia). Coba lagi, atau pakai <code>/nh " + id + " zip</code> buat file.");
  }
  // v2.73.0: cache — id+fmt yang sama udah pernah dibikin → kirim langsung, gak dispatch GHA
  if (fresh) await nhCacheDrop(env, id, fmt);
  else {
    const hit = await nhCacheGet(env, id, fmt);
    if (hit) return nhCacheDeliver(env, chatId, L, id, fmt, hit);
  }
  const url = nhDl(env, id, fmt);
  if (url) {
    const j = await tg(env, "sendDocument", { chat_id: chatId, document: url, caption: title + (numPages ? " · " + numPages + " hal" : "") });
    if (j && j.ok) return;
    return reply(env, chatId, L.nhFail(url));
  }
  // v2.70.4: tanpa NH_DL (VPS mati) tapi GH_DISPATCH ada → zip lewat GitHub Actions builder (async)
  if (env.GH_DISPATCH && env.NH_API) return nhBuilderGo(env, chatId, L, id, fmt);
  return reply(env, chatId, L.nhCfg);
}

// ===== v2.73.0: cache build, counter, watchdog =====
// cache: id+fmt yang udah pernah dibuild → kirim langsung, gak perlu dispatch GHA lagi
async function nhCacheGet(env, id, fmt) {
  if (!id || !fmt || fmt === "album") return null;
  const k = NH_CACHE_PREFIX + id + ":" + fmt;
  let e = null;
  try { e = await getJSON(env, k, null); } catch (_) { return null; }
  if (!e || !e.u || !/^https:\/\//.test(String(e.u))) return null;
  const ttl = Number(e.ttl) || NH_CACHE_TTL_MS;
  if (e.ts && Date.now() - Number(e.ts) > ttl) {
    try { await env.KV.delete(k); } catch (_) {}
    return null;
  }
  return e;
}
async function nhCachePut(env, id, fmt, o) {
  if (!id || !fmt || fmt === "album") return;
  const u = String((o && o.u) || "");
  if (!/^https:\/\/\S+$/.test(u)) return;
  const host = String((o && o.host) || "").toLowerCase();
  // provider permanen boleh di-cache lama; host auto-expire cuma sebentar (link bisa mati)
  // builder ngirim nama host penuh ("kappa.lol"/"x0.at"), jadi dicocokin per prefix
  const ttl = /^kappa/.test(host) ? NH_CACHE_TTL_MS : NH_CACHE_TTL_TMP_MS;
  const e = { u, host, t: String((o && o.t) || "").slice(0, 110), n: Number((o && o.n) || 0) || 0, mb: Math.round((Number((o && o.mb) || 0)) * 10) / 10, ts: Date.now(), ttl };
  try { await putJSON(env, NH_CACHE_PREFIX + id + ":" + fmt, e, env.DB ? { ttlMs: ttl } : undefined); } catch (_) {}
  await nhRecentPush(env, id, fmt, e.t);
}

// R-12: `/nh last` needs to know what was built most recently, and the cache layout
// (nh_cache:<id>:<fmt>) cannot be listed. One small index, newest first, capped.
export async function nhRecentPush(env, id, fmt, title) {
  if (!id || !fmt || fmt === "album") return;
  try {
    const cur = (await getJSON(env, NH_RECENT_KEY, [])) || [];
    const rest = (Array.isArray(cur) ? cur : []).filter(x => !(x && Number(x.id) === Number(id) && x.fmt === fmt));
    rest.unshift({ id: Number(id), fmt: String(fmt), t: String(title || "").slice(0, 90), ts: Date.now() });
    await putJSON(env, NH_RECENT_KEY, rest.slice(0, NH_RECENT_MAX));
  } catch (_) {}
}

export async function nhLast(env, chatId, fmtRaw) {
  const L = await uiLang(env);
  let cur = [];
  try { cur = JSON.parse((await env.KV.get(NH_RECENT_KEY)) || "[]"); } catch (_) { cur = []; }
  if (!Array.isArray(cur) || !cur.length) return reply(env, chatId, L.nhLastEmpty);
  const want = String(fmtRaw || "").trim().toLowerCase();
  const fmt = want ? NH_FMT_ALIAS[want] || "" : "";
  if (want && !fmt) return reply(env, chatId, L.nhBadFmt);
  const pick = fmt ? cur.find(x => x && x.fmt === fmt) : cur[0];
  if (!pick) return reply(env, chatId, L.nhLastNone(fmt));
  const cached = await nhCacheGet(env, pick.id, pick.fmt);
  if (!cached) return reply(env, chatId, L.nhLastGone(pick.id, pick.fmt));
  return nhRun(env, chatId, String(pick.id), pick.fmt);
}
async function nhCacheDrop(env, id, fmt) {
  if (!id || !fmt || fmt === "album") return;
  try { await env.KV.delete(NH_CACHE_PREFIX + id + ":" + fmt); } catch (_) {}
}
// kirim hasil dari cache — perilaku sama kayak hasil builder: file + tombol 💾/⬇️ + auto-hapus 5 mnt
async function nhCacheDeliver(env, chatId, L, id, fmt, e) {
  const n = Number(e.n) || 0;
  const cap = "<b>📦 NH " + hesc(String(id)) + "</b> (" + hesc(String(fmt).slice(0, 12)) + (n ? " · " + n + " hal" : "") + ")" + (e.t ? " — " + hesc(String(e.t).slice(0, 90)) : "") + "\n<i>" + hesc(L.nhCacheTag) + "</i>";
  const tok = rndTok();
  const kb = { inline_keyboard: [[{ text: L.nhSaveBtn, callback_data: "nhsave:" + tok }, { text: L.nhDlBtn, url: e.u }]] };
  const dj = await tg(env, "sendDocument", { chat_id: chatId, document: e.u, caption: cap, parse_mode: "HTML", reply_markup: kb });
  let mid = dj && dj.ok && dj.result ? dj.result.message_id : 0;
  if (!mid) {
    const j = await tg(env, "sendMessage", { chat_id: chatId, text: cap + "\n" + e.u, parse_mode: "HTML", reply_markup: kb });
    mid = j && j.ok && j.result ? j.result.message_id : 0;
  }
  if (mid) {
    try { await putJSON(env, NH_SAVE_PREFIX + tok, { id, t: e.t || "", n, u: e.u, m: mid }, env.DB ? { ttlMs: NH_AUTODEL_MS } : undefined); } catch (_) {}
    await deleteLater(env, chatId, mid, NH_AUTODEL_MS, NH_KEEP_PREFIX + mid);
  }
  try { await nhStatInc(env, "hit"); } catch (_) {}
  return "";
}
// counter harian (hari WIB) — dibaca /settings → NH → stats
function nhDayKey(ms) {
  const d = new Date((ms || Date.now()) + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
export async function nhStatInc(env, field, n) {
  const k = NH_STAT_PREFIX + nhDayKey();
  let o = null;
  try { o = await getJSON(env, k, null); } catch (_) { o = null; }
  if (!o || typeof o !== "object") o = {};
  o[field] = (Number(o[field]) || 0) + (Number(n) || 1);
  o.at = Date.now();
  try { await putJSON(env, k, o, env.DB ? { ttlMs: NH_STAT_TTL_MS } : undefined); } catch (_) {}
  return o;
}
export async function nhStatGet(env, ms) {
  let o = null;
  try { o = await getJSON(env, NH_STAT_PREFIX + nhDayKey(ms), null); } catch (_) { o = null; }
  return o && typeof o === "object" ? o : {};
}
// Watchdog: a builder job that never got its callback (runner died / queued forever) is closed,
// the chat is told, and the busy key is released. Jobs live in D1 (kv table) so the scan is SQL;
// env.KV.list is the fallback for dev/test.
// v2.78.1: resolves (`ytr:`) are swept the same way. A resolve record outlives its invocation when
// Cloudflare kills the isolate mid-chain, and that is exactly how a placeholder used to stay forever.
export async function nhWatchdog(env) {
  let n = 0;
  n += await jobSweep(env, NH_JOB_PREFIX, job => NH_BUSY_PREFIX + job.chat + ":" + job.id + ":" + job.fmt, false);
  n += await jobSweep(env, YT_JOB_PREFIX, job => YT_BUSY_PREFIX + job.chat + ":" + (ytIdOf(job.u) || job.u) + ":" + job.kind, "yt");
  n += await jobSweep(env, YT_RESOLVE_PREFIX, job => YT_BUSY_PREFIX + job.chat + ":" + job.vid + ":" + job.kind, "resolve");
  return n;
}
async function jobSweep(env, prefix, busyOf, kind) {
  const now = Date.now();
  const rows = [];
  try {
    if (env.DB) {
      const r = await env.DB.prepare("SELECT key, val FROM kv WHERE key LIKE ?1 LIMIT 40").bind(prefix + "%").all();
      for (const x of (r && r.results) || []) if (x && x.key) rows.push(x);
    } else if (env.KV && typeof env.KV.list === "function") {
      const ls = await env.KV.list({ prefix });
      for (const k of (ls && ls.keys) || []) rows.push({ key: k.name, val: await env.KV.get(k.name) });
    }
  } catch (_) { return 0; }
  let n = 0;
  for (const r of rows) {
    if (n >= 10) break;
    let job = null;
    try { job = JSON.parse(r.val); } catch (_) { continue; }
    if (!job || !job.chat || !job.ts) continue;
    if (now - Number(job.ts) < (kind === "resolve" ? YT_RESOLVE_DEAD_MS : NH_DEAD_MS)) continue;
    try { await env.KV.delete(r.key); } catch (_) {}
    try { await env.KV.delete(busyOf(job)); } catch (_) {}
    const L = await uiLang(env);
    // A dead "send to chat" pull left the chat with a wait message and no buttons at all. Put the
    // card back instead of explaining a file that will never arrive.
    if (kind === "resolve" && job.via === "up" && job.u) {
      try { await ytLinkCard(env, job.chat, L, job.mid, job.u, job.kind || "360", job.t || "", job.sz || 0, { fmt: job.f || "" }, job.tok, L.ytUpFail); } catch (_) {}
      n++;
      continue;
    }
    const txt = kind === "resolve" ? L.ytStuck : kind === "yt" ? L.ytDead : L.nhDead;
    let told = false;
    if (job.mid) {
      try {
        const e = await tg(env, "editMessageText", { chat_id: job.chat, message_id: job.mid, text: txt, parse_mode: "HTML" });
        told = !!(e && e.ok);
      } catch (_) { told = false; }
    }
    if (!told) { try { await reply(env, job.chat, txt); } catch (_) {} }
    if (kind !== "yt" && kind !== "resolve") { try { await nhStatInc(env, "timeout"); } catch (_) {} }
    n++;
  }
  return n;
}

// v2.70.4: async zip builder lewat GitHub Actions (VPS-independent) — job key KV sekali pakai + repository_dispatch
async function nhBuilderGo(env, chatId, L, id, fmt) {
  // v2.70.5: anti-dobel — id+fmt sama dari chat yang sama masih berjalan → tolak (busy key TTL = TTL job)
  const busyKey = NH_BUSY_PREFIX + chatId + ":" + id + ":" + fmt;
  let busy = null;
  try { busy = await getJSON(env, busyKey, null); } catch (_) {}
  if (busy && busy.tok) return reply(env, chatId, L.nhBusy);
  const tok = rndTok();
  // v2.71.0: pesan "⏳ building…" disimpen id-nya di job → dihapus pas /nhcb dateng
  const wj = await reply(env, chatId, L.nhZipWait);
  const wmid = wj && wj.result && wj.result.message_id ? wj.result.message_id : 0;
  try { await putJSON(env, NH_JOB_PREFIX + tok, { id, fmt, chat: chatId, mid: wmid, ts: Date.now() }, env.DB ? { ttlMs: NH_JOB_TTL_MS } : undefined); } catch (_) {}
  try { await putJSON(env, busyKey, { tok, id, fmt, chat: chatId }, env.DB ? { ttlMs: NH_JOB_TTL_MS } : undefined); } catch (_) {}
  const repo = String(env.NHBUILD_REPO || "ruqes/nhzip");
  const meta = String(env.NH_API || "").replace(/\/+$/, "");
  const cb = String(env.SELF_BASE || "").replace(/\/+$/, "") + "/nhcb";
  const host = await nhHost(env); // v2.72.0: provider pilihan owner (auto|x0at|kappa)
  const pdfq = await nhPdfQ(env); // v2.73.0: preset kualitas PDF (normal|small)
  try {
    const r = await fetch("https://api.github.com/repos/" + repo + "/dispatches", {
      method: "POST",
      headers: { authorization: "Bearer " + env.GH_DISPATCH, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "kibo" },
      body: JSON.stringify({ event_type: "nh", client_payload: { id: String(id), fmt, meta, cb, tok, host, pdfq } }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw new Error("github " + r.status);
  } catch (e) {
    try { await env.KV.delete(NH_JOB_PREFIX + tok); } catch (_) {}
    try { await env.KV.delete(busyKey); } catch (_) {}
    try { await nhStatInc(env, "fail"); } catch (_) {}
    if (wmid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: wmid }); } catch (_) {} }
    return reply(env, chatId, L.nhBuilderFail("dispatch " + String((e && e.message) || e).slice(0, 120)));
  }
  return "";
}

// v2.70.4: callback dari GHA builder — {tok, url} sukses / {tok, err} gagal; job key sekali pakai
export async function handleNhCb(request, env) {
  const jr = (st, o) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json" } });
  let body = {};
  try { body = await request.json(); } catch (_) { return jr(400, { ok: false, err: "bad json" }); }
  const tok = String(body.tok || "").slice(0, 64);
  const job = tok ? await getJSON(env, NH_JOB_PREFIX + tok, null) : null;
  try { if (tok) await env.KV.delete(NH_JOB_PREFIX + tok); } catch (_) {}
  if (!job || !job.chat) return jr(404, { ok: false, err: "job tak dikenal / expired" });
  // v2.70.5: busy key dilepas pas callback masuk (sukses ATAU gagal) — boleh build lagi
  try { await env.KV.delete(NH_BUSY_PREFIX + job.chat + ":" + job.id + ":" + job.fmt); } catch (_) {}
  const L = await uiLang(env);
  // v2.71.0: pesan "⏳ building the zip…" dihapus begitu hasilnya dateng (sukses maupun gagal)
  if (job.mid) { try { await tg(env, "deleteMessage", { chat_id: job.chat, message_id: job.mid }); } catch (_) {} }
  if (body.err) {
    try { await nhStatInc(env, "fail"); } catch (_) {}
    await reply(env, job.chat, L.nhBuilderFail(String(body.err).slice(0, 300)));
    return jr(200, { ok: true });
  }
  const url = String(body.url || "").trim().slice(0, 500);
  if (!/^https:\/\/\S+$/.test(url)) return jr(400, { ok: false, err: "url gak valid" });
  const bTitle = String(body.title || "").slice(0, 110);
  const bPages = parseInt(String(body.pages || ""), 10) || 0;
  const bWarn = String(body.warn || "").slice(0, 90); // v2.72.0: "2 halaman gagal" / "scroll 60/124 hal"
  const cap = "<b>📦 NH " + hesc(job.id) + "</b> (" + hesc(String(body.fmt || job.fmt || "zip").slice(0, 12)) + (bPages ? " · " + hesc(String(bPages).slice(0, 6)) + " hal" : "") + ")" + (bTitle ? " — " + hesc(bTitle.slice(0, 90)) : "") + (bWarn ? "\n<i>" + hesc(bWarn.slice(0, 80)) + "</i>" : "");
  // v2.71.0: hasil build = pesan auto-hapus + tombol 💾 → kalau gak ditekan, ilang sendiri (NH_AUTODEL_MS)
  const stok = rndTok();
  const kb = { inline_keyboard: [[{ text: L.nhSaveBtn, callback_data: "nhsave:" + stok }, { text: L.nhDlBtn, url }]] };
  const dj = await tg(env, "sendDocument", { chat_id: job.chat, document: url, caption: cap, parse_mode: "HTML", reply_markup: kb });
  let mid = dj && dj.ok && dj.result ? dj.result.message_id : 0;
  if (!mid) {
    const j = await tg(env, "sendMessage", { chat_id: job.chat, text: cap + "\n" + url, parse_mode: "HTML", reply_markup: kb });
    mid = j && j.ok && j.result ? j.result.message_id : 0;
  }
  if (mid) {
    try { await putJSON(env, NH_SAVE_PREFIX + stok, { id: job.id, t: bTitle, n: bPages, u: url, m: mid }, env.DB ? { ttlMs: NH_AUTODEL_MS } : undefined); } catch (_) {}
    await deleteLater(env, job.chat, mid, NH_AUTODEL_MS, NH_KEEP_PREFIX + mid);
  }
  // v2.73.0: catet + simpen ke cache — build berikutnya (id+fmt sama) gak perlu GHA lagi
  await nhCachePut(env, job.id, String(body.fmt || job.fmt || "zip"), { u: url, host: body.host, t: bTitle, n: bPages, mb: (Number(body.size) || 0) / 1048576 });
  try {
    await nhStatInc(env, "ok");
    const mb = Math.round(((Number(body.size) || 0) / 1048576) * 10) / 10;
    if (mb > 0) await nhStatInc(env, "mb", mb);
  } catch (_) {}
  return jr(200, { ok: true });
}

// v2.71.0: satu tempat buat nyatet gallery yang disimpen (FILE_INDEX buat /files + NH_SAVES buat /nhs)
async function nhIndexPush(env, o) {
  let ok = false;
  try {
    const list = await getJSON(env, FILE_INDEX_KEY, []);
    const id = list.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
    list.unshift({ id, name: String(o.title || "NH #" + o.id).slice(0, 110), fid: o.fid || "", kind: o.kind || "document", mime: o.mime || "", size: o.size || 0, ts: Date.now(), nh: o.id, pages: o.n || 0 });
    await putJSON(env, FILE_INDEX_KEY, list);
    ok = true;
  } catch (_) {}
  try {
    const cur = JSON.parse(await env.KV.get(NH_SAVES_KEY) || "[]");
    if (!cur.find((x) => String(x.id) === String(o.id))) cur.push({ id: o.id, t: String(o.title || "").slice(0, 120), n: o.n || 0, at: Date.now() });
    await env.KV.put(NH_SAVES_KEY, JSON.stringify(cur.slice(-100)));
  } catch (_) {}
  return ok;
}

// v2.71.0: simpen FILE hasil builder — tahan auto-delete + copy pesannya ke vault (gak upload ulang)
async function nhSaveFile(env, cbId, chatId, L, e, vaultId) {
  try { await env.KV.put(NH_KEEP_PREFIX + e.m, "1", { expirationTtl: 2592000 }); } catch (_) {}
  try {
    const q = ((await getJSON(env, DELQ_KEY, [])) || []).filter(x => !(x && x.c === chatId && x.m === e.m));
    await putJSON(env, DELQ_KEY, q.slice(-20), env.DB ? { ttlMs: 3600000 } : undefined);
  } catch (_) {}
  const title = String(e.t || "NH #" + e.id).slice(0, 110);
  let fid = "", kind = "document";
  try {
    const cp = await tg(env, "copyMessage", { chat_id: vaultId, from_chat_id: chatId, message_id: e.m, caption: title.slice(0, 200) });
    if (cp && cp.ok && cp.result) {
      if (cp.result.document) { fid = cp.result.document.file_id || ""; kind = "document"; }
      else if (cp.result.photo) { fid = cp.result.photo[cp.result.photo.length - 1].file_id || ""; kind = "photo"; }
      else kind = "text";
    }
  } catch (_) {}
  const ok = await nhIndexPush(env, { id: e.id, title, fid, kind, n: e.n || 0 });
  try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: ok ? L.nhSaved : "gagal simpen ke vault" }); } catch (_) {}
}

export async function handleNhSave(env, cbId, chatId, tok) {
  const L = await uiLang(env);
  const e = await getJSON(env, NH_SAVE_PREFIX + tok, null);
  try { await env.KV.delete(NH_SAVE_PREFIX + tok); } catch (_) {}
  if (!e || !e.id) { try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: "expired" }); } catch (_) {} return; }
  const v = await getJSON(env, VAULT_CHAT_KEY, null);
  if (!v || !v.id) { try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.nhSaveNoVault }); } catch (_) {} return; }
  if (e.m) return nhSaveFile(env, cbId, chatId, L, e, v.id); // v2.71.0: hasil /nh <id> zip|pdf|scroll
  const meta = await nhMeta(env, e.id);
  const pages = meta && Array.isArray(meta.pages) ? meta.pages : [];
  const title = (meta && meta.title) ? String(meta.title).slice(0, 110) : (e.t || "NH #" + e.id);
  if (!pages.length) { try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: "gak bisa ambil halaman" }); } catch (_) {} return; }
  try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: "menyimpan " + pages.length + " hal ke vault…" }); } catch (_) {}
  const CH = 10, chunks = [];
  for (let i = 0; i < pages.length; i += CH) chunks.push(pages.slice(i, i + CH));
  let firstFid = "", saved = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const media = chunks[ci].map((p, i) => ({ type: "photo", media: p.url, caption: (ci === 0 && i === 0) ? (title + " · saved") : "" }));
    const j = await tg(env, "sendMediaGroup", { chat_id: v.id, media });
    if (j && j.ok && Array.isArray(j.result)) {
      saved += j.result.length;
      if (ci === 0 && j.result[0] && Array.isArray(j.result[0].photo)) firstFid = j.result[0].photo[j.result[0].photo.length - 1].file_id;
    } else break;
    if (ci < chunks.length - 1) await sleep(300);
  }
  if (saved) await nhIndexPush(env, { id: e.id, title, fid: firstFid, kind: "photo", mime: "image/jpeg", size: 0, n: saved });
  try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: saved ? L.nhSaved + " ✓ (" + saved + " hal di vault)" : "gagal kirim ke vault" }); } catch (_) {}
}

// v2.73.0: tombol "Bikin ZIP" dari album / /nhs — cache dulu, kalau belum ada baru dispatch builder
export async function handleNhNzip(env, cbId, chatId, idRaw) {
  const L = await uiLang(env);
  const id = Number(String(idRaw || "").trim());
  if (!id || !Number.isInteger(id)) { try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: "id gak valid" }); } catch (_) {} return; }
  const hit = await nhCacheGet(env, id, "zip");
  try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: hit ? L.nhCachePop : L.nhZipPop }); } catch (_) {}
  if (hit) return nhCacheDeliver(env, chatId, L, id, "zip", hit);
  if (env.GH_DISPATCH && env.NH_API) return nhBuilderGo(env, chatId, L, id, "zip");
  return reply(env, chatId, L.nhCfg);
}

export async function handleNhs(env, msg, chatId) {
  const L = await uiLang(env);
  // v2.75.2: `/nhs <query>` = search (owner mental model: nhs = nh-search). Bare `/nhs` stays the
  // saved list, because that is what the button "💾 Save" has always fed.
  const query = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (query) return nhSearch(env, chatId, query);
  let cur = []; try { cur = JSON.parse(await env.KV.get(NH_SAVES_KEY) || "[]"); } catch (_) {}
  if (!cur.length) return reply(env, chatId, L.nhsEmpty);
  const lines = [L.nhsHead(cur.length), ""];
  const rows = [];
  cur.slice(-20).reverse().forEach((x, i) => {
    lines.push((i + 1) + ". <b>" + (x.t ? hesc(String(x.t).slice(0, 60)) : "NH #" + x.id) + "</b>");
    // v2.75.1: tombol "link file" mati diam-diam sejak NH_DL dicabut (2.70.5) — yang beneran ada cuma
    // open album + build ZIP, jadi dua itu doang yang ditampilkan.
    rows.push([{ text: L.nhsOpen, callback_data: "nhop:" + x.id }, { text: L.nhsZip, callback_data: "nhnz:" + x.id }]);
  });
  return tg(env, "sendMessage", { chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
}

export async function handleNhop(env, cbId, chatId, id) {
  const L = await uiLang(env);
  try {
    await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: "🖼" });
    await tg(env, "sendChatAction", { chat_id: chatId, action: "upload_photo" });
    const meta = await nhMeta(env, id);
    const pages = meta && Array.isArray(meta.pages) ? meta.pages : [];
    if (!pages.length) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: "not found" }); return; }
    const title = (meta && meta.title) ? String(meta.title).slice(0, 110) : "NH #" + id;
    const n = meta && meta.num_pages ? meta.num_pages : 0;
    return nhAlbumDeliver(env, chatId, L, id, title, n, pages, 0);
  } catch (_) { try { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: "L" }); } catch (_) {} }
}

export async function handleYts(env, msg, chatId) {
  const L = await uiLang(env);
  const q = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!q) return reply(env, chatId, L.ytsUsage);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  let res = null;
  try { res = await musicCached(env, "yts", q, () => ytSearch(q)); } catch (_) {}
  if (!res) return reply(env, chatId, L.dlFailRes("YouTube search")); // sumber down — beda dari emang gak ada hasil
  const items = (res.items || []).slice(0, YTS_MAX);
  if (!items.length) return reply(env, chatId, L.ytsNone(hesc(q.slice(0, 80))));
  const toks = [];
  for (const it of items) {
    const tok = rndTok();
    toks.push(tok);
    try { await putJSON(env, YT_PICK_PREFIX + tok, { c: chatId, u: "https://www.youtube.com/watch?v=" + it.id, t: String(it.t || "").slice(0, 120), ch: String(it.ch || "").slice(0, 60), v: it.views || 0, exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
  }
  const lines = [L.ytsHead(hesc(q.slice(0, 80))), ""];
  for (let i = 0; i < items.length; i++) {
    lines.push("<b>" + (i + 1) + ".</b> <a href=\"https://youtu.be/" + items[i].id + "\">" + hesc(String(items[i].t).slice(0, 120)) + "</a>");
    lines.push(...ytsMetaLines(items[i]));
    lines.push("");
  }
  lines.pop(); // buang blank terakhir — SEP nempel item terakhir, blank CUMA antar item (v2.68.9)
  lines.push(SEP_LINE, L.ytsPick);
  const kb = [items.map((_, i) => ({ text: String(i + 1), callback_data: "ytpick:" + toks[i] }))];
  kb.push([{ text: L.ytsOpen, url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) }]);
  const j = await tg(env, "sendMessage", { chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
  const mid = j && j.ok && j.result ? j.result.message_id : 0;
  if (mid) await deleteLater(env, chatId, mid, dlMenuMs(env));
}
export async function handleYtsPick(env, cbId, chatId, mid, tok) {
  const L = await uiLang(env);
  const e = await getJSON(env, YT_PICK_PREFIX + tok, null);
  try { await env.KV.delete(YT_PICK_PREFIX + tok); } catch (_) {}
  if (!e || !e.u) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.dlExpired }); return; }
  await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.popSearching });
  // The menu is local data — no resolver round-trip, so it opens instantly and never waits on a
  // third-party host that may be dead. Every quality is a builder job from here.
  return ytMenuShow(env, chatId, L, mid, e.u, { title: e.t || "", author: e.ch || "", views: e.v || 0 });
}

// ===== v2.76.0: YouTube delivery =====
// Two ways in, one menu: the 360p variant is a normal dlsav button (the worker downloads the
// bytes and re-uploads them, because the CDN proxy refuses Telegram's fetchers), while 720p and
// MP3 are builder jobs on GitHub Actions (yt-dlp → kappa.lol → /ytcb). Nothing here needs the VPS.
const ytIdOf = u => (String(u).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/) || [])[1] || "";
const mbLabel = sz => (sz ? (sz / 1048576 >= 1024 ? (sz / 1073741824).toFixed(1) + " GB" : Math.round(sz / 1048576) + " MB") : "?");

// One resolver call gives the real rung list and sizes; cached per video so the menu stays instant.
async function pbQualities(env, url) {
  const vid = ytIdOf(url) || url;
  let c = null;
  try { c = await getJSON(env, "yt_q:" + vid, null); } catch (_) { c = null; }
  if (c && Array.isArray(c.q) && c.ts && Date.now() - Number(c.ts) < 6 * 60 * 60 * 1000) return { q: c.q, gated: !!c.gated };
  const r = await pbYtEx(env, url, "1080");
  let q = r.ok && Array.isArray(r.q) ? r.q.map(x => ({ h: String(x.quality || "").replace(/p$/, ""), sz: Number(x.size) || 0 })).filter(x => /^\d{3,4}$/.test(x.h)) : [];
  // A gated clip is a property of the video, so remembering it is safe and saves a doomed resolve.
  const gated = !r.ok && pbGated(r.err);
  // Gated (or every rung refused): nexray still reads the clip, and its muxed 360p is a real file.
  // One honest button beats an empty menu that only says "the resolver can't read this".
  if (!q.length) {
    const a = await nxAio(env, url);
    if (a.u) q = [{ h: "360", sz: a.sz }];
  }
  if (q.length || gated) { try { await putJSON(env, "yt_q:" + vid, { q, gated, ts: Date.now() }, env.DB ? { ttlMs: 6 * 60 * 60 * 1000 } : undefined); } catch (_) {} }
  return { q, gated };
}

export async function ytMenuShow(env, chatId, L, mid, url, metaRaw) {
  const meta = Object.assign({}, metaRaw || {});
  if (!meta.title || !meta.views || !meta.duration) {
    let em = null;
    try { em = await ytMeta(env, url); } catch (_) { em = null; }
    if (em) {
      for (const k of ["title", "author", "views", "likes", "dislikes", "subs", "duration"]) if (!meta[k] && em[k]) meta[k] = em[k];
    }
  }
  if (!meta.duration) { try { const d = await ytDurSeconds(env, url); if (d) meta.duration = d; } catch (_) {} }
  const tok = rndTok();
  try { await putJSON(env, YT_BUILD_PREFIX + tok, { c: chatId, u: url, t: String(meta.title || "").slice(0, 120), ch: String(meta.author || "").slice(0, 60), exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
  // Buttons mirror what the provider actually offers, with its own sizes — no phantom rungs.
  // When the clip is gated there is nothing to mirror, so offer only what still works.
  const pq = await pbQualities(env, url);
  const qs = pq.q || [];
  const rungs = qs.length ? qs.map(x => x.h) : pq.gated ? [] : ["144", "240", "360", "480", "720", "1080"];
  const rows = [];
  for (let i = 0; i < rungs.length; i += 3) {
    rows.push(rungs.slice(i, i + 3).map(h => ({
      text: L.ytQ(h) + (qs.find(x => x.h === h) ? " \u00b7 " + mbLabel(qs.find(x => x.h === h).sz) : ""),
      callback_data: "ytb:" + h + ":" + tok
    })));
  }
  rows.push([{ text: L.ytBMp3, callback_data: "ytb:mp3:" + tok }, { text: L.ytsWatch, url }]);
  rows.push([{ text: L.ytBBtch, callback_data: "ytb:btch:" + tok }]);
  return dlMenuShow(env, chatId, L, mid, "youtube", [], meta, 0, rows, url, pq.gated && !qs.length ? L.ytMenuGated : L.ytMenuNote);
}

async function ytCacheGet(env, vid, kind) {
  if (!vid || !kind) return null;
  let e = null;
  try { e = await getJSON(env, YT_CACHE_PREFIX + vid + ":" + kind, null); } catch (_) { return null; }
  if (!e || !e.u || !/^https:\/\//.test(String(e.u))) return null;
  const ttl = Number(e.ttl) || YT_CACHE_TTL_MS;
  if (e.ts && Date.now() - Number(e.ts) > ttl) {
    try { await env.KV.delete(YT_CACHE_PREFIX + vid + ":" + kind); } catch (_) {}
    return null;
  }
  return e;
}
async function ytCachePut(env, vid, kind, o) {
  if (!vid || !kind) return;
  const u = String((o && o.u) || "");
  if (!/^https:\/\/\S+$/.test(u)) return;
  const host = String((o && o.host) || "").toLowerCase();
  // Cache only as long as the link actually lives: a permanent host may be kept for a month,
  // sendit.sh dies after a day (or five downloads).
  const ttl = /^kappa/.test(host) ? YT_CACHE_TTL_MS
    : /^sendit/.test(host) ? 20 * 60 * 60 * 1000
    : /^puruboy/.test(host) ? 6 * 60 * 60 * 1000 // token-gated proxy, short life
    : YT_CACHE_TTL_TMP_MS;
  try { await putJSON(env, YT_CACHE_PREFIX + vid + ":" + kind, { u, host, t: String((o && o.t) || "").slice(0, 110), fmt: String((o && o.fmt) || "").slice(0, 12), exp: String((o && o.exp) || "").slice(0, 40), sz: Number((o && o.sz) || 0) || 0, ts: Date.now(), ttl }, env.DB ? { ttlMs: ttl } : undefined); } catch (_) {}
}

// Send one built file. Telegram's by-URL ceiling is 20 MB, but that is a delivery detail, not a
// download limit: anything bigger arrives as a direct link on a temporary host, never as an error.
async function ytDeliver(env, chatId, L, mid, fileUrl, kind, title, size, cached, meta) {
  const m = meta || {};
  const sz = Number(size) || 0;
  const mb = sz ? (sz / 1048576).toFixed(1) : "";
  const head = "<b>" + (kind === "mp3" ? "\uD83C\uDFB5" : "\uD83C\uDFAC") + " " + hesc(String(title || "YouTube").slice(0, 110)) + "</b>";
  const kb = { inline_keyboard: [[{ text: L.ytDlBtnSz(mb || "?"), url: fileUrl }]] };
  let j = null;
  if (kind === "mp3") j = await tg(env, "sendAudio", { chat_id: chatId, audio: fileUrl, title: String(title || "audio").slice(0, 60), caption: head, parse_mode: "HTML", reply_markup: kb });
  else if (!sz || sz <= DL_URL_SEND_MAX) j = await tg(env, "sendVideo", { chat_id: chatId, video: fileUrl, supports_streaming: true, caption: head, parse_mode: "HTML", reply_markup: kb });
  if (!j || !j.ok) {
    if (kind !== "mp3" && sz && sz > DL_URL_SEND_MAX) j = null; // doomed by-URL upload — skip straight to the link
    else j = await tg(env, "sendDocument", { chat_id: chatId, document: fileUrl, caption: head, parse_mode: "HTML", reply_markup: kb });
  }
  const okMid = j && j.ok && j.result ? j.result.message_id : 0;
  if (!okMid) {
    // Big render or a host Telegram refuses: hand over the link instead of failing.
    const txt = head + "\n" + L.ytLinkMeta(m.fmt || (kind === "mp3" ? "MP3" : ""), mb, m.exp || "") + "\n<i>" + L.ytLinkNote + "</i>" + (cached ? "\n<i>" + L.ytCacheTag + "</i>" : "");
    const lj = await tg(env, "sendMessage", { chat_id: chatId, text: txt, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb });
    const lmid = lj && lj.ok && lj.result ? lj.result.message_id : 0;
    if (mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {} }
    return !!lmid;
  }
  if (mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {} }
  await deleteLater(env, chatId, okMid, dlDelMs(env));
  return true;
}

// Quality the owner picked. 144p…1080p is what the resolver actually offers; GHA is the fallback.
const YT_KINDS = ["144", "240", "360", "480", "720", "1080", "mp3"];
const YT_CAP_MB = { "144": 60, "240": 80, "360": 120, "480": 200, "720": 300, "1080": 500, mp3: 120 };

// puruboy = yt-dlp in an E2B sandbox, keyless, with a quality parameter and real sizes. Its
// download URL is a token-gated proxy that refuses Telegram's fetchers (verified: sendVideo by
// URL = 400 "failed to get HTTP URL content"), so the bytes come through us instead.
// A failed resolve is not one thing: ytdownloader.tech answers 422 "That video could not be read"
// for age/region-gated clips, while ordinary failures are network noise. Callers need that
// distinction to say something true, so the reason rides along instead of collapsing into null.
async function pbYtEx(env, url, kind, tries, tmo) {
  const q = kind === "mp3" ? "type=audio" : "quality=" + kind;
  // The resolver caches the file token per (video, rung) and keeps serving it after it expires,
  // so a plain call can hand us a dead link. A unique param forces a freshly minted token.
  const api = String(env.PURUBOY_BASE || PURUBOY_BASE).replace(/\/+$/, "") + "/api/downloader/youtube?url=" + encodeURIComponent(url) + "&" + q + "&_=" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  let err = "";
  for (let i = 0; i < (tries || 2); i++) {
    try {
      const r = await fetch(api, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(tmo || 60000) });
      const j = await r.json().catch(() => null);
      const u = j && j.success && j.download ? String(j.download.url || "") : "";
      if (/^https:\/\/\S+$/.test(u)) {
        const want = kind === "mp3" ? "" : kind + "p";
        const qs = Array.isArray(j.qualities) ? j.qualities : [];
        const row = qs.find(x => String(x.quality || "") === want) || null;
        return { ok: true, u, t: String(j.title || "").slice(0, 110), dur: Number(j.duration) || 0, sz: Number((j.download.size) || (row && row.size) || 0) || 0, fmt: kind === "mp3" ? "MP3" : kind + "p", q: qs, err: "" };
      }
      if (!err) err = j && j.error ? String(j.error).slice(0, 140) : "http " + r.status;
    } catch (e) { if (!err) err = String((e && e.message) || e).slice(0, 140); }
  }
  return { ok: false, err };
}
async function pbYt(env, url, kind, tries, tmo) {
  const r = await pbYtEx(env, url, kind, tries, tmo);
  return r.ok ? r : null;
}
// "could not be read" = the clip itself is gated (age / region / private), not a resolver outage.
const pbGated = err => /could not be read|private|region|deleted|unavailable|not available|members/i.test(String(err || ""));

// btch (btch-downloader-api-green.vercel.app) is the fast source: its proxy pushed 41 MB in
// 1.4 s when measured, and it hands out both mp4 and mp3. No quality ladder — one file per kind.
// Metadata helpers pass their own timeout; the chain above already capped what is left.
async function btchYt(env, url, kind, tmo) {
  // Canonical watch URL: the short form silently drops the mp3 field on some clips.
  const id = ytIdOf(url);
  const target = id ? "https://www.youtube.com/watch?v=" + id : url;
  const api = String(env.BTCH_BASE || BTCH_BASE).replace(/\/+$/, "") + "/api/download/youtube?url=" + encodeURIComponent(target) + (kind === "mp3" ? "&type=audio" : "");
  // The caller's wall-clock budget decides how many tries fit: three 12 s attempts only make sense
  // when there is time for them. A healthy btch answers in 1–3 s, so the caps below are generous.
  const total = Math.min(tmo || 45000, 45000);
  if (total <= 2000) return null; // out of budget: a doomed request only burns what is left
  const gap = 2000;
  const tries = total >= 14000 ? 3 : total >= 7000 ? 2 : 1;
  const per = Math.min(12000, Math.max(2500, Math.floor((total - (tries - 1) * gap) / tries)));
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(gap);
    try {
      const r = await fetch(api, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(per) });
      const j = await r.json().catch(() => null);
      if (env.__probe) env.__probe.push({ mid: null, method: "btch", chat: 0, text: r.status + " " + String(JSON.stringify(j || {})).slice(0, 120) });
      const res = j && j.result ? j.result : null;
      const u = res ? String(kind === "mp3" ? res.mp3 || "" : res.mp4 || "") : "";
      if (/^https:\/\/\S+$/.test(u)) {
        let sz = 0;
        try {
          const h = await fetch(u, { headers: { "user-agent": UA, range: "bytes=0-0" }, signal: AbortSignal.timeout(Math.min(15000, per)) });
          const cr = h.headers.get("content-range") || "";
          sz = Number(cr.split("/")[1]) || Number(h.headers.get("content-length")) || 0;
        } catch (_) {}
        return { u, t: String(res.title || "").slice(0, 110), sz, fmt: kind === "mp3" ? "MP3" : "BTCH" };
      }
    } catch (_) {}
  }
  return null;
}
const btchAudio = (env, url, tmo) => btchYt(env, url, "mp3", tmo);

// Nexray's ytmp3 is the one audio source that survives: it answers with a link to a public proxy
// (beta.123tokyo.xyz) that serves a real MP3 to any caller, unlike every video route we have seen
// (measured 3.7 MB, ID3 v2.3, 64 kbps, 1.7 MB/s from an unrelated host). Its aio route is not used
// here — those googlevideo URLs are signed for the resolver's own IP and answer 403 for us.
async function nxMp3(env, url) {
  const id = ytIdOf(url);
  const target = id ? "https://www.youtube.com/watch?v=" + id : url;
  const api = String(env.NEXRAY_BASE || NEXRAY_BASE).replace(/\/+$/, "") + "/downloader/ytmp3?url=" + encodeURIComponent(target) + "&_=" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  for (let i = 0; i < 2; i++) {
    if (i) await sleep(1200);
    try {
      const r = await fetch(api, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(45000) });
      const j = await r.json().catch(() => null);
      if (env.__probe) env.__probe.push({ mid: null, method: "nexray", chat: 0, text: r.status + " " + String(JSON.stringify(j || {})).slice(0, 120) });
      const res = j && j.status && j.result ? j.result : null;
      const u = res ? String(res.url || "") : "";
      if (/^https:\/\/\S+$/.test(u)) return { u, t: String(res.title || "").slice(0, 110), sz: Number(res.filesize) || 0, fmt: "MP3" };
    } catch (_) {}
  }
  return null;
}

// Nexray's non-YouTube routes. Measured 9 Nov: /downloader/spotify hands back a 320 kbps MP3 on
// rapid.spotidown.app (8.7 MB, 3.2 MB/s), /downloader/tiktok hands back the original TikTok CDN
// video plus its audio track. They share no upstream with btch or ssstik, which is the point —
// a second opinion on the days those two answer 502.
async function nxGet(env, path, tmo) {
  const base = String(env.NEXRAY_BASE || NEXRAY_BASE).replace(/\/+$/, "");
  try {
    const j = await getJSONh(base + path, tmo || 30000);
    if (env.__probe) env.__probe.push({ mid: null, method: "nexray", chat: 0, text: String(JSON.stringify(j || {})).slice(0, 120) });
    return j;
  } catch (_) { return null; }
}
async function nxSpotifyResolve(env, url) {
  const j = await nxGet(env, "/downloader/spotify?url=" + encodeURIComponent(url));
  const r = j && j.status && j.result ? j.result : null;
  const u = r ? String(r.url || "") : "";
  if (!dlUrlOk(u)) return null;
  const title = ((r.artist ? String(r.artist) + " - " : "") + String(r.title || "")).slice(0, 120);
  return { items: [{ kind: "audio", url: u }], title };
}
async function nxTtResolve(env, url) {
  const j = await nxGet(env, "/downloader/tiktok?url=" + encodeURIComponent(url));
  const r = j && j.status && j.result ? j.result : null;
  if (!r) return null;
  const items = [];
  if (dlUrlOk(r.data)) items.push({ kind: "video", url: String(r.data) });
  const mu = r.music_info && r.music_info.url;
  if (dlUrlOk(mu)) items.push({ kind: "audio", url: String(mu) });
  if (!items.length) return null;
  const a = r.author || {};
  return { items: items.slice(0, DL_MAX_LINKS), meta: { title: String(r.title || "").slice(0, 180), author: String(a.nickname || a.fullname || "").slice(0, 60) } };
}

// v2.78.0: nexray /downloader/aio is the only YouTube source left that still answers for a gated
// clip (ytdownloader.tech 422s every rung, and that empty menu is a dead end). Of its 12-21 entries
// exactly one is playable without muxing: itag 18, a progressive 360p carrying avc1 + mp4a in the
// same file (verified by atom scan, 11.8 MB). 136/137 are DASH video-only, so the Worker cannot use
// them — and the URLs are signed to the resolving address, which is why the tail is probed here and
// never trusted just because the JSON looked fine.
async function nxAio(env, url) {
  const vid = ytIdOf(url) || String(url);
  let c = null;
  try { c = await getJSON(env, YT_AIO_PREFIX + vid, null); } catch (_) { c = null; }
  if (c && c.ts && Date.now() - Number(c.ts) < 6 * 60 * 60 * 1000) return { u: c.u || "", sz: Number(c.sz) || 0, rungs: Array.isArray(c.rungs) ? c.rungs : [], t: c.t || "" };
  const j = await nxGet(env, "/downloader/aio?url=" + encodeURIComponent(url), 40000);
  const r = j && j.status && j.result ? j.result : null;
  const medias = r && Array.isArray(r.medias) ? r.medias : [];
  let u = "";
  const rungs = [];
  for (const m of medias) {
    const mu = String((m && m.url) || "");
    const it = (mu.match(/[?&]itag=(\d+)/) || [])[1] || "";
    const h = (String((m && m.quality) || "").match(/(\d{3,4})p/) || [])[1] || "";
    // two entries are labelled "mp4 360p" (itag 18 progressive vs itag 134 video-only) — the
    // itag in the URL is the only thing that tells them apart
    if (h && String((m && m.ext) || "") === "mp4") rungs.push(h);
    if (it === "18" && !u) u = mu;
  }
  let sz = 0;
  if (u) {
    const pr = await dlProbe(env, u);
    if (pr.st >= 400 || !ytMediaCt(pr.ct)) u = ""; else sz = pr.sz;
  }
  const out = { u, sz, rungs, t: String((r && r.title) || "").slice(0, 110) };
  if (u || rungs.length) { try { await putJSON(env, YT_AIO_PREFIX + vid, Object.assign({ ts: Date.now() }, out), env.DB ? { ttlMs: 6 * 60 * 60 * 1000 } : undefined); } catch (_) {} }
  return out;
}

// v2.78.0: api.vxtwitter.com is the same fixupx family as fxtwitter with a flatter schema
// (mediaURLs[] + media_extended[]). Probed from CF egress: 200, 1.4 KB — a cheap second opinion
// for the days fxtwitter is slow or answers an empty tweet object.
async function vxResolve(user, id) {
  const j = await getJSONh("https://api.vxtwitter.com/" + encodeURIComponent(user) + "/status/" + id, 15000);
  if (!j) return null;
  const ext = Array.isArray(j.media_extended) ? j.media_extended : [];
  const urls = Array.isArray(j.mediaURLs) ? j.mediaURLs.map(u => String(u || "")).filter(dlUrlOk) : [];
  const items = urls.map((u, i) => ({ kind: /\.mp4(?:[?#]|$)/i.test(u) || (ext[i] && ext[i].type === "video") ? "video" : "photo", url: u }));
  if (!items.length) return null;
  return { items: items.slice(0, DL_MAX_LINKS), meta: { caption: String(j.text || ""), author: String(j.user_name || "") } };
}

// v2.78.0: sparky (keyless Koyeb instance, 20/20 burst + 20/20 sequential in the Nov sweep).
// Only the video is taken: its audio field is a tiktokcdn mp4 container, and a "video/mp4" blob
// sent through sendAudio is a coin flip at Telegram. nexray already supplies real audio.
async function spTtResolve(env, url) {
  const base = String(env.SPARKY_BASE || SPARKY_BASE).replace(/\/+$/, "");
  const j = await getJSONh(base + "/api/downloader/tiktok?url=" + encodeURIComponent(url), 25000);
  const d = j && j.status && j.data ? j.data : null;
  if (!d || !dlUrlOk(d.video)) return null;
  const a = d.author || {};
  return { items: [{ kind: "video", url: String(d.video) }], meta: { title: String(d.title || "").slice(0, 180), author: String(a.nickname || a.unique_id || "").slice(0, 60) } };
}

// v2.78.0: nexray IG. The only route that still returns a FULL carousel (8/8 items on the probe
// post). Its media URLs sit behind d.rapidcdn.app, an octet-stream proxy Telegram refuses — the
// JWT in ?token= carries the real scontent URL, so unwrap it the same way btch items are.
async function nxIgResolve(env, url) {
  const j = await nxGet(env, "/downloader/instagram?url=" + encodeURIComponent(url), 30000);
  const arr = j && j.status && Array.isArray(j.result) ? j.result : [];
  const items = arr.map(x => ({ kind: x && x.type === "video" ? "video" : "photo", url: String((x && x.url) || "") })).filter(x => dlUrlOk(x.url));
  for (const it of items) { const src = btchTokenUrl(it.url); if (src) it.url = src; }
  const n = items.length;
  if (!n) return null;
  return { items: items.slice(0, DL_MAX_LINKS).map((it, i) => (n > 1 ? Object.assign({}, it, { pos: i + 1, total: n }) : it)) };
}

// v2.78.0: Facebook. fbcdn answers our Range probe with 206 + video/mp4 + avc1/mp4a, and both
// resolvers hand out the same object, so the chain is two hosts deep without extra work. HD goes
// first; SD is the smaller sibling when the HD file is too big for one isolate.
async function nxFbResolve(env, url) {
  const j = await nxGet(env, "/downloader/facebook?url=" + encodeURIComponent(url), 30000);
  const r = j && j.status && j.result ? j.result : null;
  if (!r) return null;
  const items = [];
  if (dlUrlOk(r.video_hd)) items.push({ kind: "video", fmt: "HD", url: String(r.video_hd) });
  if (dlUrlOk(r.video_sd)) items.push({ kind: "video", fmt: "SD", url: String(r.video_sd) });
  if (!items.length) return null;
  return { items: items.slice(0, DL_MAX_LINKS), meta: { title: String(r.title || "").slice(0, 180) } };
}
async function spFbResolve(env, url) {
  const base = String(env.SPARKY_BASE || SPARKY_BASE).replace(/\/+$/, "");
  const j = await getJSONh(base + "/api/downloader/fbdl?url=" + encodeURIComponent(url), 25000);
  const d = j && j.status && j.data ? j.data : null;
  if (!d) return null;
  const items = [];
  if (dlUrlOk(d.high)) items.push({ kind: "video", fmt: "HD", url: String(d.high) });
  if (dlUrlOk(d.low)) items.push({ kind: "video", fmt: "SD", url: String(d.low) });
  if (!items.length) return null;
  return { items: items.slice(0, DL_MAX_LINKS), meta: { title: String(d.title || "").slice(0, 180) } };
}

// Resolver bytes → Telegram. 40 MB is our own ceiling (one isolate holds the blob); past that the
// link is the honest answer, because Telegram cannot fetch these hosts itself.
async function ytPull(env, chatId, url, ms) {
  // The file endpoints are rate limited and answer 403/5xx in bursts, and a 200 whose body stalls
  // costs the whole attempt. So: a bounded attempt (12 s is plenty for a host that answered in 0.3 s
  // when it was measured), and a second try only when the budget can afford one.
  const per = Math.max(2000, Math.min(ms || 12000, 12000));
  const tries = (ms || 0) >= 26000 ? 2 : 1;
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(1500);
    let f = null;
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(per) });
      const ct = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (env.__probe) env.__probe.push({ mid: null, method: "ytfetch", chat: chatId, text: r.status + " " + ct + " " + (r.headers.get("content-length") || "?") });
      if (r.ok && r.body) {
        const rd = r.body.getReader();
        const chunks = [];
        let got = 0;
        for (;;) {
          const cr = await rd.read();
          if (cr.done) break;
          got += cr.value.length;
          if (got > YT_UPLOAD_MAX) { try { await rd.cancel(); } catch (_) {} got = -1; break; }
          chunks.push(cr.value);
        }
        if (got > 0) f = { chunks, size: got };
      }
    } catch (e) { if (env.__probe) env.__probe.push({ mid: null, method: "ytfetch", chat: chatId, text: "ERR " + String((e && e.message) || e).slice(0, 80) }); }
    if (f) return f;
  }
  return null;
}

async function ytUploadResolved(env, chatId, L, mid, url, kind, title, fmt, tmo) {
  const f = await ytPull(env, chatId, url, tmo);
  if (!f) return false;
  const head = "<b>" + (kind === "mp3" ? "\uD83C\uDFB5" : "\uD83C\uDFAC") + " " + hesc(String(title || "YouTube").slice(0, 110)) + "</b>\n" + L.ytLinkMeta(fmt, (f.size / 1048576).toFixed(1), "");
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append(kind === "mp3" ? "audio" : "video", new Blob(f.chunks, { type: kind === "mp3" ? "audio/mpeg" : "video/mp4" }), kind === "mp3" ? "audio.mp3" : "video.mp4");
  if (kind !== "mp3") form.append("supports_streaming", "true");
  form.append("caption", head);
  form.append("parse_mode", "HTML");
  form.append("reply_markup", JSON.stringify({ inline_keyboard: [[{ text: L.ytDlBtnSz((f.size / 1048576).toFixed(1)), url: url }]] }));
  let j = null;
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/" + (kind === "mp3" ? "sendAudio" : "sendVideo"), { method: "POST", body: form, signal: tgUpTmo(env) });
    j = await r.json().catch(() => null);
    if (!j || !j.ok) tgErrLog(env, "sendVideo", j);
  } catch (_) { j = null; }
  const okMid = j && j.ok && j.result ? j.result.message_id : 0;
  if (env.__probe && j && j.ok) env.__probe.push({ mid: okMid || null, method: kind === "mp3" ? "sendAudio" : "sendVideo", chat: chatId, text: String(head).slice(0, 400) });
  if (mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {} }
  if (okMid) await deleteLater(env, chatId, okMid, dlDelMs(env));
  return !!okMid;
}

// No audio-only source survives right now (ytdownloader.tech's mp3 queue times out, btch's audio
// proxy stalls), but every rung we can already fetch is an mp4 with the audio track inside it.
// Telegram accepts that container as `sendAudio` when it is named .m4a (verified: 200, audio/mp4),
// so an audio request still ends as playable audio instead of a GitHub build.
async function ytSendAsAudio(env, chatId, L, mid, url, title, dur, fmt, tmo) {
  const f = await ytPull(env, chatId, url, tmo);
  if (!f) return false;
  const name = String(title || "YouTube").slice(0, 60);
  const head = "<b>\uD83C\uDFB5 " + hesc(String(title || "YouTube").slice(0, 110)) + "</b>\n" + L.ytLinkMeta(fmt || "audio", (f.size / 1048576).toFixed(1), "");
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("audio", new Blob(f.chunks, { type: "audio/mp4" }), "audio.m4a");
  form.append("title", name);
  if (Number(dur) > 0) form.append("duration", String(Math.round(Number(dur))));
  form.append("caption", head);
  form.append("parse_mode", "HTML");
  form.append("reply_markup", JSON.stringify({ inline_keyboard: [[{ text: L.ytDlBtnSz((f.size / 1048576).toFixed(1)), url: url }]] }));
  let j = null;
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendAudio", { method: "POST", body: form, signal: tgUpTmo(env) });
    j = await r.json().catch(() => null);
    if (!j || !j.ok) tgErrLog(env, "sendAudio", j);
  } catch (_) { j = null; }
  const okMid = j && j.ok && j.result ? j.result.message_id : 0;
  if (env.__probe && j && j.ok) env.__probe.push({ mid: okMid || null, method: "sendAudio", chat: chatId, text: String(head).slice(0, 400) });
  if (mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {} }
  if (okMid) await deleteLater(env, chatId, okMid, dlDelMs(env));
  return !!okMid;
}

// Link card — instant, and the honest answer for hosts Telegram refuses to fetch. A second
// button pulls the bytes through the Worker when the owner actually wants it in the chat.
async function ytLinkCard(env, chatId, L, mid, fileUrl, kind, title, size, meta, upTok, note) {
  const m = meta || {};
  const mb = size ? (size / 1048576).toFixed(1) : "";
  const head = "<b>" + (kind === "mp3" ? "\uD83C\uDFB5" : "\uD83C\uDFAC") + " " + hesc(String(title || "YouTube").slice(0, 110)) + "</b>";
  const txt = head + "\n" + L.ytLinkMeta(m.fmt || (kind === "mp3" ? "MP3" : ""), mb, m.exp || "") + "\n<i>" + (note || L.ytLinkNote) + "</i>";
  const rows = [[{ text: L.ytDlBtnSz(mb || "?"), url: fileUrl }]];
  if (upTok) rows.push([{ text: L.ytToChat, callback_data: "ytup:" + upTok }]);
  const j = await tg(env, "sendMessage", { chat_id: chatId, text: txt, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: rows } });
  const okMid = j && j.ok && j.result ? j.result.message_id : 0;
  if (mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {} }
  return !!okMid;
}

// "Send it into the chat": the resolver link is unfetchable for Telegram, so the bytes come
// through this isolate. Slow on purpose — it only runs when the owner taps the button.
export async function handleYtUpload(env, cbId, chatId, mid, tok) {
  const L = await uiLang(env);
  const e = await getJSON(env, YT_UP_PREFIX + tok, null);
  if (!e || !e.u) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.dlExpired }); return; }
  await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.ytUpPop });
  if (mid) { try { await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.ytUpWait, parse_mode: "HTML" }); } catch (_) {} }
  // Same trap as the resolve chain: the message above replaced a card that carried the only retry
  // buttons, so a chain that never comes back leaves the chat with nothing. Budget it, and leave a
  // record the watchdog turns back into a card if the invocation dies anyway.
  const recKey = YT_RESOLVE_PREFIX + rndTok();
  const b = ytBudget(env);
  const inBudget = () => b.left() > 6000;
  try { await putJSON(env, recKey, { chat: chatId, mid: mid || 0, kind: e.k || "360", vid: ytIdOf(e.y) || String(e.y || ""), ts: Date.now(), via: "up", u: e.u, t: e.t || "", f: e.f || "", sz: e.sz || 0, tok }, env.DB ? { ttlMs: 10 * 60 * 1000 } : undefined); } catch (_) {}
  try {
  const ok = await ytUploadResolved(env, chatId, L, mid, e.u, e.k || "360", e.t || "", e.f || "", b.slice(45000));
  if (ok) { try { await env.KV.delete(YT_UP_PREFIX + tok); } catch (_) {} return; }
  // The stored link is the stale one (resolver tokens expire in minutes): resolve again and retry
  // before telling anyone the pull failed.
  let ok2 = false;
  if (e.y && e.k === "mp3" && inBudget()) {
    // A stored MP3 link is a Nexray proxy link; minting a fresh one costs a single request.
    const nx = await nxMp3(env, e.y);
    if (nx) ok2 = await ytUploadResolved(env, chatId, L, mid, nx.u, "mp3", e.t || nx.t || "", "MP3", b.slice(45000));
  }
  if (!ok2 && e.y) {
    // The requested rung may be the one the resolver cannot fetch right now; try the others too.
    const rungs = e.k === "mp3" ? ["144", "360", "240"] : [e.k || "360", "360", "144"].filter((v, i, a) => a.indexOf(v) === i);
    for (const rung of rungs) {
      if (!inBudget()) break;
      const fr = await pbYtEx(env, e.y, rung, 1, b.slice(30000));
      if (!fr.ok) continue;
      if (e.k === "mp3") ok2 = await ytSendAsAudio(env, chatId, L, mid, fr.u, e.t || fr.t || "", fr.dur, "M4A", b.slice(30000));
      else ok2 = await ytUploadResolved(env, chatId, L, mid, fr.u, e.k || "360", e.t || fr.t || "", fr.fmt, b.slice(30000));
      if (ok2) break;
    }
  }
  if (ok2) { try { await env.KV.delete(YT_UP_PREFIX + tok); } catch (_) {} return; }
  // Keep the buttons: telling someone to "use the link button" after deleting it is a dead end.
  await ytLinkCard(env, chatId, L, mid, e.u, e.k || "360", e.t || "", e.sz || 0, { fmt: e.f || "" }, tok, L.ytUpFail);
  } finally {
    try { await env.KV.delete(recKey); } catch (_) {}
  }
}

// 720p / MP3 button: cache hit = instant, otherwise dispatch one builder job.
export async function handleYtBuild(env, cbId, chatId, mid, arg) {
  const L = await uiLang(env);
  const s = String(arg || "");
  const cut = s.indexOf(":");
  const req = cut < 0 ? s : s.slice(0, cut);
  const tok = cut < 0 ? "" : s.slice(cut + 1);
  const kind = YT_KINDS.indexOf(req) >= 0 ? req : req === "btch" ? "btch" : req === "best" || req === "720" ? "720" : "";
  const e = kind ? await getJSON(env, YT_BUILD_PREFIX + tok, null) : null;
  if (!e || !e.u) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.dlExpired }); return; }
  const vid = ytIdOf(e.u) || e.u;
  const busyKey = YT_BUSY_PREFIX + chatId + ":" + vid + ":" + kind;
  let busy = null;
  try { busy = await getJSON(env, busyKey, null); } catch (_) { busy = null; }
  if (busy && busy.tok) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.ytBusy }); return; }
  const hit = await ytCacheGet(env, vid, kind);
  if (hit && /^(btch|vidsnap)/.test(String(hit.host || ""))) {
    // Dead links must not be replayed: btch/vidsnap 403 in a browser, so forget the entry.
    try { await env.KV.delete(YT_CACHE_PREFIX + vid + ":" + kind); } catch (_) {}
  } else if (hit) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.ytCachePop });
    if (/^puruboy/.test(String(hit.host || "")) || /ytdownloader\.tech/.test(String(hit.u || ""))) {
      // Telegram cannot fetch these hosts — same card + "send to chat" as the first time
      const upTok = rndTok();
      try { await putJSON(env, YT_UP_PREFIX + upTok, { c: chatId, u: hit.u, y: e.u, k: kind, t: hit.t || e.t || "", f: hit.fmt || "", sz: hit.sz || 0, exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
      const card = await ytLinkCard(env, chatId, L, mid, hit.u, kind, hit.t || e.t || "", hit.sz || 0, { fmt: hit.fmt }, upTok);
      if (card) return;
    }
    const ok = await ytDeliver(env, chatId, L, mid, hit.u, kind, hit.t || e.t || "", hit.sz || 0, true, { fmt: hit.fmt, exp: hit.exp });
    if (!ok) await reply(env, chatId, L.ytLinkOnly(hit.u));
    return;
  }
  await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.ytBuildPop });
  let wmid = mid || 0;
  if (wmid) await tg(env, "editMessageText", { chat_id: chatId, message_id: wmid, text: L.ytBuildWait(kind), parse_mode: "HTML" });
  else { const wj = await reply(env, chatId, L.ytBuildWait(kind)); wmid = (wj && wj.result && wj.result.message_id) || 0; }
  // v2.78.1: everything below runs while the webhook is still open, and the handler stops waiting at
  // 55 s (RESP_DEADLINE_MS). So the chain gets one wall-clock budget, and a record the watchdog can
  // close for the case the budget cannot cover: an invocation that dies anyway (CPU kill, isolate
  // recycle). Without both, the placeholder above is the last thing the chat ever sees — the
  // "fetching BTCH…" that never lands.
  const recKey = YT_RESOLVE_PREFIX + rndTok();
  const b = ytBudget(env);
  const inBudget = () => b.left() > 6000;
  try { await putJSON(env, recKey, { chat: chatId, mid: wmid, kind, vid, ts: Date.now() }, env.DB ? { ttlMs: 10 * 60 * 1000 } : undefined); } catch (_) {}
  try { await putJSON(env, busyKey, { tok: recKey, kind }, env.DB ? { ttlMs: 10 * 60 * 1000 } : undefined); } catch (_) {}
  try {
  // Primary path: resolve here (seconds), post the link instantly, no GitHub Actions.
  if (kind === "btch") {
    // Owner's second source. Its proxy 403s in a browser ("Access to api.vidsnap.app was denied")
    // and throttles for us, so it is upload-only: never hand out a link we know is dead.
    const b1 = await btchYt(env, e.u, "video", b.slice(45000));
    if (b1 && await ytUploadResolved(env, chatId, L, wmid, b1.u, kind, b1.t || e.t || "", "BTCH", b.slice(45000))) return;
    // btch refuses some clips outright (502 on every retry). The resolver still reads them, so fall
    // back to its 360p rung instead of ending at a build card.
    if (inBudget()) {
      const pv = await pbYtEx(env, e.u, "360", 2, b.slice(30000));
      if (pv.ok && await ytUploadResolved(env, chatId, L, wmid, pv.u, "360", pv.t || e.t || "", pv.fmt, b.slice(45000))) return;
    }
  }
  const pbx = !inBudget() || kind === "mp3" || kind === "btch" ? { ok: false, err: "" } : await pbYtEx(env, e.u, kind, 2, b.slice(30000));
  const pb = pbx.ok ? pbx : null;
  if (pb) {
    await ytCachePut(env, vid, kind, { u: pb.u, host: "puruboy", t: pb.t || e.t || "", sz: pb.sz, fmt: pb.fmt, exp: "" });
    const upTok = rndTok();
    try { await putJSON(env, YT_UP_PREFIX + upTok, { c: chatId, u: pb.u, y: e.u, k: kind, t: pb.t || e.t || "", f: pb.fmt, sz: pb.sz || 0, exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
    const card = await ytLinkCard(env, chatId, L, wmid, pb.u, kind, pb.t || e.t || "", pb.sz || 0, { fmt: pb.fmt }, upTok);
    if (card) return;
  }
  // The rung the owner asked for is gone. btch reads plenty of what ytdownloader.tech refuses, so
  // try it once — a 360p file beats a dead end — before offering a GitHub build.
  if (!pb && inBudget() && kind !== "btch" && kind !== "mp3") {
    // v2.78.0: nexray's progressive 360p — the only source measured to answer for gated clips.
    const a = await ytWithin(b.slice(25000), () => nxAio(env, e.u), null);
    if (a && a.u && await ytUploadResolved(env, chatId, L, wmid, a.u, "360", a.t || e.t || "", "360p", b.slice(45000))) return;
    const b2 = await btchYt(env, e.u, "video", b.slice(30000));
    if (b2 && await ytUploadResolved(env, chatId, L, wmid, b2.u, kind, b2.t || e.t || "", "BTCH", b.slice(45000))) return;
  }
  if (kind === "mp3" && inBudget()) {
    // Nexray first: it is the only provider that returns an actual MP3 file. Everything below it is
    // the older chain (btch audio, then a muxed mp4 re-sent as .m4a) and stays as fallback.
    const nx = await nxMp3(env, e.u);
    if (nx && await ytUploadResolved(env, chatId, L, wmid, nx.u, "mp3", nx.t || e.t || "", "MP3", b.slice(45000))) return;
    // Audio: every provider proxy either stalls (~300 KB) or 403s, so try the bytes once and fall
    // through to the confirmed GitHub build instead of handing over a dead link.
    const a = await btchAudio(env, e.u, b.slice(25000));
    if (a && await ytUploadResolved(env, chatId, L, wmid, a.u, "mp3", a.t || e.t || "", "MP3", b.slice(30000))) return;
    // No audio-only source is alive, but the muxed mp4 carries the audio track — send that as audio.
    // Rungs fail independently at the resolver ("pick another format"), so walk a short ladder.
    let last = null;
    for (const rung of ["144", "360", "240"]) {
      if (!inBudget()) break;
      const pv = await pbYtEx(env, e.u, rung, 1, b.slice(25000));
      if (!pv.ok) continue;
      last = pv;
      if (await ytSendAsAudio(env, chatId, L, wmid, pv.u, pv.t || e.t || "", pv.dur, "M4A", b.slice(30000))) return;
    }
    // The bytes refused us (the file endpoints rate limit in bursts). The link still opens in a
    // browser and plays the audio, so hand that over instead of a build card that would need the
    // very same bytes.
    if (last) {
      const upTok = rndTok();
      try { await putJSON(env, YT_UP_PREFIX + upTok, { c: chatId, u: last.u, y: e.u, k: "mp3", t: last.t || e.t || "", f: "M4A", sz: last.sz || 0, exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
      if (await ytLinkCard(env, chatId, L, wmid, last.u, "mp3", last.t || e.t || "", last.sz || 0, { fmt: "M4A" }, upTok)) return;
    }
  }
  // The budget ran out mid-chain: the sources above are slow, not dead, and asking for a GitHub
  // build would be a lie. Say what actually happened and let the next tap start a fresh budget.
  if (!inBudget()) {
    if (wmid) await tg(env, "editMessageText", { chat_id: chatId, message_id: wmid, text: L.ytStuck, parse_mode: "HTML" });
    else await reply(env, chatId, L.ytStuck);
    return;
  }
  // Resolver is out: ask before spending a GitHub Actions run — never dispatch on our own.
  const gtok = rndTok();
  try { await putJSON(env, YT_BUILD_PREFIX + gtok, { c: chatId, u: e.u, t: String(e.t || "").slice(0, 120), exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
  const ask = (pbGated(pbx.err) ? L.ytGhaAskGate : L.ytGhaAsk(kind)) + "\n" + L.ytGhaNote;
  const kb = { inline_keyboard: [[{ text: L.ytGhaBtn, callback_data: "ytg:" + kind + ":" + gtok }]] };
  if (wmid) await tg(env, "editMessageText", { chat_id: chatId, message_id: wmid, text: ask, parse_mode: "HTML", reply_markup: kb });
  else await tg(env, "sendMessage", { chat_id: chatId, text: ask, parse_mode: "HTML", reply_markup: kb });
  } finally {
    // The record must not outlive the chain: the watchdog only exists for the case where this line
    // never runs because Cloudflare killed the isolate.
    try { await env.KV.delete(recKey); } catch (_) {}
    try { await env.KV.delete(busyKey); } catch (_) {}
  }
  return;
}

// Confirmed GitHub Actions build — the last resort, and only after the owner taps the button.
export async function handleYtGha(env, cbId, chatId, mid, arg) {
  const L = await uiLang(env);
  const s = String(arg || "");
  const cut = s.indexOf(":");
  const req = cut < 0 ? s : s.slice(0, cut);
  const tok = cut < 0 ? "" : s.slice(cut + 1);
  const kind = YT_KINDS.indexOf(req) >= 0 ? req : "";
  const e = kind ? await getJSON(env, YT_BUILD_PREFIX + tok, null) : null;
  if (!e || !e.u) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.dlExpired }); return; }
  await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.ytGhaPop });
  const vid = ytIdOf(e.u) || e.u;
  const busyKey = YT_BUSY_PREFIX + chatId + ":" + vid + ":" + kind;
  const jtok = rndTok();
  try { await putJSON(env, YT_JOB_PREFIX + jtok, { chat: chatId, mid: mid || 0, u: e.u, kind, t: String(e.t || "").slice(0, 110), ts: Date.now() }, env.DB ? { ttlMs: NH_JOB_TTL_MS } : undefined); } catch (_) {}
  try { await putJSON(env, busyKey, { tok: jtok, kind }, env.DB ? { ttlMs: NH_JOB_TTL_MS } : undefined); } catch (_) {}
  const repo = String(env.NHBUILD_REPO || "ruqes/nhzip");
  const cb = String(env.SELF_BASE || "").replace(/\/+$/, "") + "/ytcb";
  // MP3 builds must not touch YouTube from the runner (yt-dlp is bot-walled there): hand the
  // builder the resolver's mp4 proxy instead and let ffmpeg strip the video track.
  let src = "";
  if (kind === "mp3") {
    const p = await pbYtEx(env, e.u, "144"); // the resolver's mp4 is the source that actually loads
    src = p.ok ? p.u : "";
    if (!src) { const v = await btchYt(env, e.u, "video"); src = v ? v.u : ""; }
  }
  let err = "";
  try {
    const r = await fetch("https://api.github.com/repos/" + repo + "/dispatches", {
      method: "POST",
      headers: { authorization: "Bearer " + env.GH_DISPATCH, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "kibo" },
      body: JSON.stringify({ event_type: "yt", client_payload: { url: e.u, kind, max_mb: YT_CAP_MB[kind] || 500, src, cb, tok: jtok } }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) err = "github " + r.status;
  } catch (e2) { err = String((e2 && e2.message) || e2); }
  if (!err) {
    const msg = L.ytBuildWait(kind);
    if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: msg, parse_mode: "HTML" });
    else await reply(env, chatId, msg);
    return;
  }
  try { await env.KV.delete(YT_JOB_PREFIX + jtok); } catch (_) {}
  try { await env.KV.delete(busyKey); } catch (_) {}
  const msg = L.ytBuildFail(err.slice(0, 120));
  if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: msg, parse_mode: "HTML" });
  else await reply(env, chatId, msg);
}

// Builder callback — {tok, url, kind, title, size} on success or {tok, err} on failure.
export async function handleYtCb(request, env) {
  const jr = (st, o) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json" } });
  let body = {};
  try { body = await request.json(); } catch (_) { return jr(400, { ok: false, err: "bad json" }); }
  const tok = String(body.tok || "").slice(0, 64);
  const job = tok ? await getJSON(env, YT_JOB_PREFIX + tok, null) : null;
  try { if (tok) await env.KV.delete(YT_JOB_PREFIX + tok); } catch (_) {}
  if (!job || !job.chat) return jr(404, { ok: false, err: "job unknown / expired" });
  const vid = ytIdOf(job.u) || job.u;
  try { await env.KV.delete(YT_BUSY_PREFIX + job.chat + ":" + vid + ":" + job.kind); } catch (_) {}
  const L = await uiLang(env);
  if (body.err) {
    const msg = L.ytBuildFail(String(body.err).slice(0, 300));
    if (job.mid) await tg(env, "editMessageText", { chat_id: job.chat, message_id: job.mid, text: msg, parse_mode: "HTML" });
    else await reply(env, job.chat, msg);
    return jr(200, { ok: true });
  }
  const url = String(body.url || "").trim().slice(0, 500);
  if (!/^https:\/\/\S+$/.test(url)) return jr(400, { ok: false, err: "url invalid" });
  const title = String(body.title || job.t || "").slice(0, 110);
  const size = Number(body.size) || 0;
  const meta = { fmt: String(body.fmt || "").slice(0, 12), exp: String(body.exp || "").slice(0, 40) };
  await ytCachePut(env, vid, job.kind, { u: url, host: body.host, t: title, sz: size, fmt: meta.fmt, exp: meta.exp });
  const ok = await ytDeliver(env, job.chat, L, job.mid, url, job.kind, title, size, false, meta);
  if (!ok) await reply(env, job.chat, L.ytLinkOnly(url));
  return jr(200, { ok: true });
}
