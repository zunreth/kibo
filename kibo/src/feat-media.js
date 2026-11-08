import { tg, reply, getJSON, putJSON, scheduleDelete, tgErrLog, tgUpTmo, NH_FMT_ALIAS, nhDefFmt, nhHost, nhPdfQ } from "./base.js";
import { uiLang, SEP_LINE } from "./ui.js";
import { UA, UA_BOT, DL_CACHE_PREFIX, DL_CACHE_TTL_MS, DL_POLL_MS, DL_POLL_MAX, DL_MAX_LINKS, DL_YT_FORMATS, DL_SEND_MAX, DL_URL_SEND_MAX, DL_SEND_PHOTO_MAX, FGSI_IG_URL, FGSI_KEY, KYIO_BASE, DL_DEL_MS, DELQ_KEY, DL_MENU_TTL_MS, DL_PICK_PREFIX, DL_SAV_PREFIX, DL_SAV_TTL_MS, DL_BIG_PREFIX, YT_PICK_PREFIX, YTS_MAX, NH_SAVE_PREFIX, NH_SAVES_KEY, NH_AUTODEL_MS, NH_JOB_PREFIX, NH_JOB_TTL_MS, NH_BUSY_PREFIX, NH_KEEP_PREFIX, NH_CACHE_PREFIX, NH_CACHE_TTL_MS, NH_CACHE_TTL_TMP_MS, NH_RECENT_KEY, NH_RECENT_MAX, NH_STAT_PREFIX, NH_STAT_TTL_MS, NH_DEAD_MS, VAULT_CHAT_KEY, FILE_INDEX_KEY } from "./consts.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

async function fsYtResolve(env, url) {
  const gap = Number(env && env.FS_GAP_MS) > 0 ? Number(env.FS_GAP_MS) : 2500;
  const formats = [["mp4", "720"], ["mp3", ""]];
  const items = [];
  for (let i = 0; i < formats.length; i++) {
    const [t, f] = formats[i];
    if (i > 0) await sleep(gap);
    const j = await getJSONh("https://api.fromscratch.web.id/v1/api/down/youtube?url=" + encodeURIComponent(url) + "&type=" + t + (f ? "&format=" + f : ""));
    const d = j && j.status === 200 && j.data;
    const du = d && d.download_url ? String(d.download_url) : "";
    if (du.startsWith("https://") && !du.includes("/pacific/")) items.push({ kind: t === "mp3" ? "audio" : "video", fmt: t === "mp3" ? "" : f + "p", url: du });
  }
  return items.length ? { items: items.slice(0, DL_MAX_LINKS) } : null;
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
async function puruYtResolve(env, url) {
  const base = String((env && env.PURU_BASE) || "https://puruboy-api.vercel.app").replace(/\/+$/, "");
  const j = await getJSONh(base + "/api/downloader/youtube?url=" + encodeURIComponent(url), 35000);
  if (!j || !j.success || !Array.isArray(j.links)) return null;
  const lk = j.links.filter(x => x && dlUrlOk(x.url));
  // pilih link PALING PAKAI: yang bawa audio, mp4 dulu (webm 2160p no-audio = buang kalau ada yang laen)
  const withA = lk.filter(x => x.hasAudio !== false);
  const pick = withA.find(x => String(x.ext || "").toLowerCase() === "mp4") || withA[0] || lk[0];
  if (!pick) return null;
  const px = String(pick.ext || "").toLowerCase();
  const kind = px === "m4a" || px === "mp3" || px === "webma" ? "audio" : "video";
  return { items: [{ kind, fmt: String(pick.quality || ""), url: String(pick.url) }].slice(0, DL_MAX_LINKS), meta: { title: String(j.title || "").slice(0, 120), author: String(j.uploader || ""), duration: Number(j.duration) || 0 } };
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
async function ltoStart(format, url) {
  const j = await getJSONh("https://loader.to/ajax/download.php?format=" + format + "&url=" + encodeURIComponent(url));
  if (!j || !j.success || !j.progress_url) return null;
  const p = String(j.progress_url);
  return p.startsWith("http") ? p : "https://loader.to" + (p.startsWith("/") ? "" : "/") + p;
}
async function ltoPoll(env, progressUrl) {
  const ms = Number(env && env.DL_POLL_MS) > 0 ? Number(env.DL_POLL_MS) : DL_POLL_MS;
  const max = Number(env && env.DL_POLL_MAX) > 0 ? Number(env.DL_POLL_MAX) : DL_POLL_MAX;
  for (let i = 0; i < max; i++) {
    await sleep(ms);
    const j = await getJSONh(progressUrl);
    if (j && j.download_url) {
      const u = String(j.download_url);
      if (u.includes("/pacific/")) return null;
      return u;
    }
  }
  return null;
}
async function ltoMulti(env, url, formats) {
  const ps = await Promise.all(formats.map(f => ltoStart(f, url)));
  const outs = await Promise.all(ps.map(p => (p ? ltoPoll(env, p) : Promise.resolve(null))));
  const items = [];
  formats.forEach((f, i) => { if (outs[i]) items.push({ kind: f === "mp3" ? "audio" : "video", fmt: f === "mp3" ? "" : f + "p", url: outs[i] }); });
  return items.length ? { items } : null;
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
async function ytResolve(env, url) {
  const r = (await ltoMulti(env, url, DL_YT_FORMATS)) || (await fsYtResolve(env, url)) || (await btchPlat(env, url, "youtube")) || (await puruYtResolve(env, url));
  if (!r || !r.items || !r.items.length) return r;
  const pr = await Promise.all(r.items.map(it => dlProbe(env, it.url))); // v2.68.3: ekor YT divalidasi (22 Okt: loader.to = 302 halaman iklan savenow; puru = googlevideo 403 IP-locked) — URL mati dibuang, bukan tombol zombie
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
      r = rr || (await ttEmbedResolve(url)) || (await tikwmResolve(url)) || (await fsTtResolve(url)) || (await puruTtResolve(env, url));
    }
    if (r && !(r.meta && r.meta.title && r.meta.author)) { const tm = await ttMeta(env, cu); if (tm) { r.meta = r.meta || {}; r.meta.title = r.meta.title || tm.title; r.meta.author = r.meta.author || tm.author; } } // oEmbed tiktok keyless = judul+author (blog tt 23 Okt)
    return r;
  }
  if (plat === "x") {
    const s = xStatus(new URL(url));
    if (!s) return null;
    return (await fxResolve(s.user, s.id)) || (await syndResolve(s.id));
  }
  if (plat === "youtube") return ytResolve(env, url);
  if (plat === "instagram") {

    const e = await igEmbedResolve(url);
    if (e && e.items) return e;
    const ck = await igCookieResolve(env, url);
    if (ck && ck.items) return ck;
    const f = await fgsiIgResolve(url);
    if (f) return f;
    const bt = await btchPlat(env, url, "instagram");
    if (bt) return bt;
    if (ck && ck.authdead) return { authdead: 1 };
    return e && e.blocked ? { blocked: 1 } : null;
  }
  if (plat === "spotify") {
    const b = await btchPlat(env, url, "spotify");
    if (b) return b;
    const k = await kyioSpotifyResolve(url); // fallback #2 (kyio 10 RPM shared-IP — cache 1h di atasnya, jarang kepanggil)
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
async function dlResolveHard(env, url, plat) {
  try {
    return await Promise.race([
      dlResolve(env, url, plat).catch(() => ({ hardErr: 1 })),
      new Promise(r => setTimeout(() => r({ hardTimeout: 1 }), dlHardMs(env)))
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
async function dlSize(env, url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(dlSizeMs(env)) });
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
async function dlSendFiles(env, chatId, items, title, L, src) {
  const rest = [];
  const photos = [];
  let count = 0;
  for (const it of items) {
    const capUrl = it.kind === "photo" ? DL_SEND_PHOTO_MAX : DL_URL_SEND_MAX; // gate by-URL (TG limit 20MB) — band 15-20MB = by-URL doang (bytes fallback gak kuat)
    const sz = await dlSize(env, it.url);
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
    if (!s || !s.ok) s = await tg(env, isVid ? "sendVideo" : "sendAudio", body);
    if (isVid && (!s || !s.ok)) s = await videoUpload(env, chatId, it.url, fcap, tok);
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
export function dlMenuText(L, plat, meta, photosDone, vaItems, urlOnly) {
  const names = { tiktok: "TikTok", x: "X (Twitter)", youtube: "YouTube", instagram: "Instagram", song: "Song search", spotify: "Spotify" };
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
  return lines.join("\n");
}
async function dlMenuShow(env, chatId, L, phMid, plat, vaItems, meta, photosDone, linkRows, src) {
  const multi = vaItems.length > 1;
  const rows = [];
  const pr = await Promise.all(vaItems.map(it => dlProbe(env, it.url))); // 1x probe (ct+size) per varian — label audio + gate Direct Link (v2.68.3)
  for (let i = 0; i < vaItems.length; i++) {
    const it = vaItems[i];
    let lbl = it.fmt || "";
    if (it.kind === "audio" && !lbl) lbl = mimeLabel(pr[i].ct) || "MP3";
    let big = pr[i].sz > DL_URL_SEND_MAX || (plat === "youtube" && !pr[i].sz && it.kind === "video"); // v2.68.10: forceBig = VIDEO doang — MP3 lagu normal ringan (≤15MB) = dicoma + multipart (audioUpload, filename judul); video YT memang 23-63MB (v2.68.4)
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
  const urlOnly = rows.length > 0 && !rows.some(rw => (rw || []).some(b => b.callback_data)); // semua tombol = URL button (gak ada varian file)
  const text = dlMenuText(L, plat, meta, photosDone, vaItems, urlOnly);
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
  const sent = await dlSendFiles(env, chatId, [e.item], e.t || "", L, e.s || "");
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
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const ph = await tg(env, "sendMessage", { chat_id: chatId, text: L.dlWorking, parse_mode: "HTML" });
  const phMid = ph && ph.ok && ph.result ? ph.result.message_id : 0;
  let res = null;
  try { res = await dlResolveHard(env, url, plat); } catch (_) {}
  const items = res && res.items ? res.items.slice(0, DL_MAX_LINKS) : [];
  if (!items.length) {
    const failText = (res && res.hardTimeout) || plat === "youtube" ? L.dlTimeout : (res && res.authdead ? L.dlIgAuth() : res && res.blocked ? L.dlIgBlocked() : L.dlFailRes(plat));
    if (phMid) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: failText, parse_mode: "HTML" });
      await deleteLater(env, chatId, phMid, dlDelMs(env));
    } else await reply(env, chatId, failText);
    return;
  }
  const meta = res.meta || {};
  const photos = items.filter(x => x.kind === "photo");
  const va = items.filter(x => x.kind !== "photo");
  let photosDone = 0;
  let linkRows = [];
  if (photos.length) {
    const ps = await dlSendFiles(env, chatId, photos, meta.title || "", L, url);
    photosDone = ps.count;
    linkRows = dlRows(L, photos); // v2.67.0: semua foto bawa Direct Link (urutan asli carousel) — tombol nyempil di konfirmasi/menu
  }
  if (!va.length) {
    const t = L.dlPhotosDone(photosDone);
    const mk = (photos.length > 1 || photosDone < photos.length) && linkRows.length ? { inline_keyboard: linkRows } : undefined;
    if (phMid) await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: t, parse_mode: "HTML", reply_markup: mk });
    return;
  }
  return dlMenuShow(env, chatId, L, phMid, plat, va, meta, photosDone, linkRows, url);
}

const hesc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function kyioSongResolve(q) {
  const j = await getJSONh(KYIO_BASE + "/api/v2/dl/yt-play?q=" + encodeURIComponent(q), 30000); // CF egress: kyio latency 4-20s — timeout default 15s sering matteh = biang kerok fail /song live (probe 22 Okt)
  const r = j && j.status === true && j.result;
  if (!r) return null;
  // dual-shape: lama = audio/video absolut; baru 22 Okt = song{} + download.downloadURL RELATIF (proxy kyio = 200 audio/mpeg + content-length)
  const sgn = s => { const u = String(s || ""); return u.startsWith("https://") ? u : u.startsWith("/") ? KYIO_BASE + u : ""; };
  const d = r.download;
  const au = sgn(r.audio) || sgn(typeof d === "string" ? d : d && d.downloadURL);
  const vi = sgn(r.video);
  const items = [];
  if (au) items.push({ kind: "audio", url: au });
  if (vi && vi !== au) items.push({ kind: "video", url: vi });
  const sg = r.song || {};
  const st = String(sg.title || sg.videoId || "");
  const ar = String((sg.artist && sg.artist.name) || "");
  const pre = ar && !st.toLowerCase().includes(ar.toLowerCase()) ? ar + " - " : ""; // kyio 22 Okt: song.title udah sering bawa "Artist - Judul" — jangan dobel
  const title = String(r.title || pre + st).slice(0, 120);
  return items.length ? { items: items.slice(0, DL_MAX_LINKS), title } : null;
}
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
  let res = null;
  try { res = await musicCached(env, "song", q, () => kyioSongResolve(q)); } catch (_) {}
  return musicReply(env, chatId, L, res, "song", "");
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
  const parts = raw.split(/\s+/);
  // R-12: `/nh last [fmt]` re-sends the newest cached build instead of dispatching another one.
  if (/^last$/i.test(parts[0] || "")) return nhLast(env, chatId, parts[1]);
  return nhRun(env, chatId, parts[0], parts[1], parts[2]);
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
// watchdog: job yang gak pernah dapet callback (runner mati / queue kelamaan) → tutup, kabarin, lepas busy
// job kesimpen di D1 (kv table) jadi scan-nya lewat SQL; env.KV.list dipakai kalau gak ada D1 (dev/test)
export async function nhWatchdog(env) {
  const now = Date.now();
  const rows = [];
  try {
    if (env.DB) {
      const r = await env.DB.prepare("SELECT key, val FROM kv WHERE key LIKE ?1 LIMIT 40").bind(NH_JOB_PREFIX + "%").all();
      for (const x of (r && r.results) || []) if (x && x.key) rows.push(x);
    } else if (env.KV && typeof env.KV.list === "function") {
      const ls = await env.KV.list({ prefix: NH_JOB_PREFIX });
      for (const k of (ls && ls.keys) || []) rows.push({ key: k.name, val: await env.KV.get(k.name) });
    }
  } catch (_) { return 0; }
  let n = 0;
  for (const r of rows) {
    if (n >= 10) break;
    let job = null;
    try { job = JSON.parse(r.val); } catch (_) { continue; }
    if (!job || !job.chat || !job.ts) continue;
    if (now - Number(job.ts) < NH_DEAD_MS) continue;
    try { await env.KV.delete(r.key); } catch (_) {}
    try { await env.KV.delete(NH_BUSY_PREFIX + job.chat + ":" + job.id + ":" + job.fmt); } catch (_) {}
    const L = await uiLang(env);
    let told = false;
    if (job.mid) {
      try {
        const e = await tg(env, "editMessageText", { chat_id: job.chat, message_id: job.mid, text: L.nhDead, parse_mode: "HTML" });
        told = !!(e && e.ok);
      } catch (_) { told = false; }
    }
    if (!told) { try { await reply(env, job.chat, L.nhDead); } catch (_) {} }
    try { await nhStatInc(env, "timeout"); } catch (_) {}
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
  let cur = []; try { cur = JSON.parse(await env.KV.get(NH_SAVES_KEY) || "[]"); } catch (_) {}
  if (!cur.length) return reply(env, chatId, L.nhsEmpty);
  const lines = [L.nhsHead(cur.length), ""];
  const rows = [];
  cur.slice(-20).reverse().forEach((x, i) => {
    lines.push((i + 1) + ". <b>" + (x.t ? hesc(String(x.t).slice(0, 60)) : "NH #" + x.id) + "</b>");
    const dl = nhDl(env, x.id, "zip");
    rows.push([{ text: L.nhsOpen, callback_data: "nhop:" + x.id }, dl ? { text: L.nhsDl, url: dl } : { text: L.nhsZip, callback_data: "nhnz:" + x.id }]);
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
  await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.dlWorking, parse_mode: "HTML" });
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  let res = null;
  try { res = await dlResolveHard(env, e.u, "youtube"); } catch (_) {}
  const items = res && res.items ? res.items.filter(x => x.kind !== "photo").slice(0, DL_MAX_LINKS) : [];
  if (!items.length) {
    await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.dlTimeout, parse_mode: "HTML" });
    await deleteLater(env, chatId, mid, dlDelMs(env));
    return;
  }
  const meta = res.meta || {}; // v2.68.9: metadata hasil SEARCH di-merge — ytMeta (oEmbed/RYD/about) bisa gugel kalau resolve makan deadline 55s = menu polos (laporan owner 22 Okt)
  const merged = { title: meta.title || e.t || "", author: meta.author || e.ch || "", views: meta.views || e.v || 0, likes: meta.likes || 0, dislikes: meta.dislikes || 0, duration: meta.duration || 0, subs: meta.subs || "" };
  return dlMenuShow(env, chatId, L, mid, "youtube", items, merged, 0, [[{ text: L.ytsWatch, url: e.u }]], e.u);
}
