import { tg, reply, getJSON, putJSON, scheduleDelete } from "./base.js";
import { uiLang, SEP_LINE } from "./ui.js";
import { UA, UA_BOT, DL_CACHE_PREFIX, DL_CACHE_TTL_MS, DL_POLL_MS, DL_POLL_MAX, DL_MAX_LINKS, DL_YT_FORMATS, DL_SEND_MAX, DL_SEND_PHOTO_MAX, FGSI_IG_URL, FGSI_KEY, KYIO_BASE, DL_DEL_MS, DELQ_KEY, DL_MENU_TTL_MS, DL_PICK_PREFIX, DL_SAV_PREFIX, DL_SAV_TTL_MS } from "./consts.js";

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
  return null;
}

export function xStatus(u) {
  const m = u.pathname.match(/\/([^/]+)\/status(?:es)?\/(\d{5,})/);
  return m ? { user: m[1], id: m[2] } : null;
}

const fnv1a = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

async function getJSONh(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
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
    const m = html.slice(e.i, e.i + 1200).match(/https:[^"'\s<>]+/);
    if (!m) continue;
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
async function ytResolve(env, url) {
  return (await ltoMulti(env, url, DL_YT_FORMATS)) || (await fsYtResolve(env, url));
}

async function ttCanonical(url) {
  try {
    const u = new URL(url);
    if (!/^(vt|vm)\.tiktok\.com$/.test(u.hostname.replace(/^www\./, ""))) return url;
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
    return r && r.url ? r.url : url;
  } catch (_) { return url; }
}
async function rawResolve(env, url, plat) {
  if (plat === "tiktok") {
    const cu = await ttCanonical(url);

    let r = (await tikwmResolve(cu)) || (await fsTtResolve(cu));
    if (r && r.meta && r.meta.slide) {
      const e = await ttEmbedResolve(cu);
      if (e) r = { items: e.items.concat(r.items), meta: { title: r.meta.title || "" } };
    }
    return r || (await ttEmbedResolve(url)) || (await tikwmResolve(url)) || (await fsTtResolve(url));
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
    if (ck && ck.authdead) return { authdead: 1 };
    return e && e.blocked ? { blocked: 1 } : null;
  }
  return null;
}

export async function dlResolve(env, url, plat) {
  const ck = DL_CACHE_PREFIX + fnv1a(plat + "|" + url);
  const c = await getJSON(env, ck, null);
  if (c && c.exp > Date.now() && c.v) return c.v;
  const v = await rawResolve(env, url, plat);
  if (v && v.items && v.items.length) {
    try { await putJSON(env, ck, { v, exp: Date.now() + DL_CACHE_TTL_MS }, env.DB ? { ttlMs: DL_CACHE_TTL_MS } : undefined); } catch (_) {}
  }
  return v;
}

const dlRows = (L, items) => items.map((it, i) => [{ text: it.kind === "video" ? L.dlBtnVideo(it.fmt || "") : it.kind === "audio" ? L.dlBtnAudio : L.dlBtnPhoto(i + 1), url: it.url }]);

const dlSizeMs = env => parseInt(env.DL_SIZE_TIMEOUT_MS || "", 10) || 15000;
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
async function dlMimeProbe(env, url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(dlSizeMs(env)) });
    if (!r.ok) return "";
    return (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  } catch (_) { return ""; }
}
async function audioUpload(env, chatId, url, title, fcap, tok) {
  let buf = null, ct = "";
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) return null;
    ct = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (ct && ct !== "application/octet-stream" && ct !== "binary/octet-stream" && !/^(audio|video)\//.test(ct)) return null;
    buf = await r.arrayBuffer();
  } catch (_) { return null; }
  if (!buf || !buf.byteLength || buf.byteLength > DL_SEND_MAX) return null;
  const safe = String(title || "audio").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "audio";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("title", safe);
  if (fcap) { form.append("caption", fcap); form.append("parse_mode", "HTML"); }
  form.append("reply_markup", JSON.stringify({ inline_keyboard: [[{ text: "💾 Save", callback_data: "dlsav:" + tok }]] }));
  form.append("audio", new Blob([buf], { type: ct || "audio/mp4" }), safe + "." + audioExt(ct));
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendAudio", { method: "POST", body: form });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) console.error("tg fail: sendAudio " + JSON.stringify((j && j.description) || "").slice(0, 200));
    if (env.__probe && j && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: "sendAudio", chat: chatId, text: String(fcap || "").slice(0, 400) });
    return j;
  } catch (_) { return null; }
}
async function dlSendFiles(env, chatId, items, title, L, src) {
  const rest = [];
  const photos = [];
  let count = 0;
  for (const it of items) {
    const cap = it.kind === "photo" ? DL_SEND_PHOTO_MAX : DL_SEND_MAX;
    const sz = await dlSize(env, it.url);
    if (!sz || sz > cap) { rest.push(it); continue; }
    if (it.kind === "photo") { photos.push(it); continue; }
    const isVid = it.kind === "video";
    const tok = rndTok();
    try { await putJSON(env, DL_SAV_PREFIX + tok, { c: chatId, k: it.kind, t: String(title || "").slice(0, 60), exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
    const fcap = dlCap(title, src) + (it.pos ? "\n🎬 " + it.pos + "/" + it.total : "");
    const body = { chat_id: chatId, reply_markup: { inline_keyboard: [[{ text: "💾 Save", callback_data: "dlsav:" + tok }]] } };
    if (isVid) { body.video = it.url; body.supports_streaming = true; if (fcap) { body.caption = fcap; body.parse_mode = "HTML"; } }
    else { body.audio = it.url; if (title) body.title = String(title).slice(0, 60); if (fcap) { body.caption = fcap; body.parse_mode = "HTML"; } }
    let s = await tg(env, isVid ? "sendVideo" : "sendAudio", body);
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
    } else rest.push(it);
  }
  const pcap = dlCap(title, src);
  if (photos.length === 1) {
    const body = { chat_id: chatId, photo: photos[0].url };
    if (pcap) { body.caption = pcap; body.parse_mode = "HTML"; }
    const s = await tg(env, "sendPhoto", body);
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

const dlDelMs = env => parseInt(env.DL_DEL_MS || "", 10) || DL_DEL_MS;
const dlMenuMs = env => parseInt(env.DL_MENU_MS || "", 10) || DL_MENU_TTL_MS;
async function deleteLater(env, chatId, mid, ms) {
  scheduleDelete(env, chatId, mid, ms);
  try {
    const q = ((await getJSON(env, DELQ_KEY, [])) || []).filter(x => !(x && x.c === chatId && x.m === mid));
    q.push({ c: chatId, m: mid, t: Date.now() + ms });
    await putJSON(env, DELQ_KEY, q.slice(-20), env.DB ? { ttlMs: 3600000 } : undefined);
  } catch (_) {}
}
const rndTok = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmtDur = s => { s = Math.round(Number(s) || 0); return s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : ""; };
export function dlMenuText(L, plat, meta, photosDone, vaItems) {
  const names = { tiktok: "TikTok", x: "X (Twitter)", youtube: "YouTube", instagram: "Instagram", song: "Song search", spotify: "Spotify" };
  const lines = [L.dlMenuHead];
  if (photosDone) lines.push(L.dlPhotosDone(photosDone));
  const vids = (vaItems || []).filter(x => x.kind === "video" && x.pos);
  for (let i = 0; i < vids.length; i++) lines.push("🎥 Video " + (i + 1) + "/" + vids.length + " → " + vids[i].pos + "/" + vids[i].total);
  lines.push(L.dlType + " " + (names[plat] || plat));
  if (meta.title) lines.push(L.dlTitle + " " + hesc(String(meta.title).slice(0, 180)));
  if (meta.author) lines.push(L.dlAuthor + " " + hesc(String(meta.author).slice(0, 60)));
  if (meta.caption) lines.push(L.dlCaption + " " + hesc(String(meta.caption).slice(0, 180)));
  if (meta.duration) lines.push(L.dlDuration + " " + fmtDur(meta.duration));
  if (meta.slide) lines.push(L.dlSlideNote);
  lines.push(SEP_LINE, L.dlPickNote);
  return lines.join("\n");
}
async function dlMenuShow(env, chatId, L, phMid, plat, vaItems, meta, photosDone, linkRows, src) {
  const multi = vaItems.length > 1;
  const rows = [];
  for (const it of vaItems) {
    const tok = rndTok();
    try { await putJSON(env, DL_PICK_PREFIX + tok, { c: chatId, item: it, t: meta.title || "", s: src || "", multi, exp: Date.now() + DL_SAV_TTL_MS }, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
    let lbl = it.fmt || "";
    if (it.kind === "audio" && !lbl) lbl = mimeLabel(await dlMimeProbe(env, it.url)) || "MP3";
    rows.push([{ text: it.kind === "video" ? (it.pos ? "🎥 " + it.pos + "/" + it.total : "🎥 " + (it.fmt || L.dlVideoBtn)) : "🎵 " + lbl, callback_data: "dlpick:" + tok }]);
  }
  for (const r of linkRows || []) rows.push(r);
  const text = dlMenuText(L, plat, meta, photosDone, vaItems);
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
  if (multi) { await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: sent.count ? L.dlPickOk : L.dlPickFail }); return; }
  if (sent.count) {
    await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.dlFileOk + " · " + L.dlDelNote, parse_mode: "HTML" });
    await deleteLater(env, chatId, mid, dlDelMs(env));
  } else {
    await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.dlLinkOnly, parse_mode: "HTML", reply_markup: { inline_keyboard: dlRows(L, [e.item]) } });
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
  for (const e of due) { try { await tg(env, "deleteMessage", { chat_id: e.c, message_id: e.m }); } catch (_) {} }
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
  try { res = await dlResolve(env, url, plat); } catch (_) {}
  const items = res && res.items ? res.items.slice(0, DL_MAX_LINKS) : [];
  if (!items.length) {
    const failText = plat === "youtube" ? L.dlTimeout : (res && res.authdead ? L.dlIgAuth() : res && res.blocked ? L.dlIgBlocked() : L.dlFailRes(plat));
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
    if (ps.rest.length) linkRows = dlRows(L, ps.rest);
  }
  if (!va.length && !linkRows.length) {
    const t = L.dlPhotosDone(photosDone);
    if (phMid) await tg(env, "editMessageText", { chat_id: chatId, message_id: phMid, text: t, parse_mode: "HTML" });
    return;
  }
  return dlMenuShow(env, chatId, L, phMid, plat, va, meta, photosDone, linkRows, url);
}

const hesc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function kyioSongResolve(q) {
  const j = await getJSONh(KYIO_BASE + "/api/v2/dl/yt-play?q=" + encodeURIComponent(q));
  const r = j && j.status === true && j.result;
  if (!r) return null;
  const items = [];
  const au = String(r.audio || "");
  const vi = String(r.video || "");
  if (au.startsWith("https://")) items.push({ kind: "audio", url: au });
  if (vi.startsWith("https://") && vi !== au) items.push({ kind: "video", url: vi });
  const title = String(r.title || "").slice(0, 120);
  return items.length ? { items: items.slice(0, DL_MAX_LINKS), title } : null;
}
async function kyioSpotifyResolve(u) {
  const j = await getJSONh(KYIO_BASE + "/api/v2/dl/spotify-sc?q=" + encodeURIComponent(u));
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
