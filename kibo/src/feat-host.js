// feat-host.js — /host file hosting: reply/caption/forward + /host → menu provider → upload → link.
// Provider: kappa.lol + femboy.beauty (JSON {link,delete}), pomf.lain.la + uguu.se + qu.ax (pomf shape), temp.sh (URL polos),
// gofile.io (2-step: servers -> uploadfile -> downloadPage). CATBOX/litterbox keluar menu 25 Okt: WAF BunkerWeb blok upload (mati dari VPS DAN CF egress — 412 / 403 / "No file!"),
// catbox permanent juga "Invalid uploader". Link catbox/litter tetap bisa di-fetch balik lewat hostLinkFind.
// Cap realistis: download bot TG ≤ 20MB. Retensi ditulis di TEXT menu (nomor = tombol satu row, ala /yts), tombol doang.
import { esc, tg, reply, scheduleDelete, tgFileBytes, getJSON, putJSON, tgErrLog } from "./base.js";
import { dbgLog } from "./feat-debug.js";
import { uiLang } from "./ui.js";
import { UA } from "./consts.js";

// timeout upstream /host — env-knob (pola upstreamTmo NF-251019-4; default = nilai lama, behavior gak berubah)
const hostTmo = env => AbortSignal.timeout(parseInt((env && env.HOST_TIMEOUT_MS) || "", 10) || 60000);

const TOK_PFX = "host_tok:";
const LAST_PFX = "host_last:"; // media terakhir per chat — buat /host polos (forward + cmd)
const TOK_TTL = 600000; // 10 menit — token menu basi setelah itu
const MENU_DEL_MS = 300000; // menu (dan hasilnya) ilang sendiri 5 mnt — pola /dl

const HOSTS = [
  { id: "kappa", short: "kappa", name: "kappa.lol", ret: "hostRetPerm", url: "https://kappa.lol/api/upload", field: "file", kind: "kappa" },
  { id: "femboy", short: "femboy", name: "femboy.beauty", ret: "hostRetPerm", url: "https://femboy.beauty/api/upload", field: "file", kind: "kappa" },
  { id: "lain", short: "lain", name: "pomf.lain.la", ret: "hostRetPerm", url: "https://pomf.lain.la/upload.php", field: "files[]", kind: "pomf" },
  { id: "uguu", short: "uguu", name: "uguu.se", ret: "hostRetTemp", url: "https://uguu.se/upload.php", field: "files[]", kind: "pomf" },
  { id: "quax", short: "quax", name: "qu.ax", ret: "hostRet30", url: "https://qu.ax/upload.php", field: "files[]", kind: "pomf" },
  { id: "tempsh", short: "tempsh", name: "temp.sh", ret: "hostRet3", url: "https://temp.sh/upload", field: "file", kind: "tempsh" },
  { id: "gofile", short: "gofile", name: "gofile.io", ret: "hostRet10", url: "https://api.gofile.io", field: "file", kind: "gofile" },
];

async function uploadTo(env, h, bytes, name, mime) {
  let url = h.url;
  if (h.kind === "gofile") { // 2-step: minta server upload aktif dulu, terus POST ke sana
    const sr = await fetch("https://api.gofile.io/servers", { headers: { "user-agent": UA }, signal: hostTmo(env) });
    const sj = await sr.json().catch(() => null);
    const srv = sj && sj.status === "ok" && sj.data && sj.data.servers && sj.data.servers[0] && sj.data.servers[0].name;
    if (!srv) throw new Error("servers HTTP " + sr.status);
    url = "https://" + srv + ".gofile.io/contents/uploadfile";
  }
  const fd = new FormData();
  fd.append(h.field, new Blob([bytes], { type: mime }), name);
  const r = await fetch(url, { method: "POST", body: fd, headers: { "user-agent": UA }, signal: hostTmo(env) });
  const t = await r.text();
  const why = "HTTP " + r.status + " " + t.slice(0, 100).replace(/\s+/g, " ");
  if (h.kind === "tempsh") { const s = t.trim(); if (/^https?:\/\/\S+$/.test(s)) return { url: s }; throw new Error(why); }
  let j = null;
  try { j = JSON.parse(t); } catch (_) { j = null; }
  if (h.kind === "kappa" && j && j.link) return { url: j.link, del: j.delete || null };
  if (h.kind === "gofile" && j && j.status === "ok" && j.data && j.data.downloadPage) return { url: j.data.downloadPage };
  if (h.kind === "pomf" && j && j.success && j.files && j.files[0] && j.files[0].url) return { url: j.files[0].url };
  throw new Error(why); // jujur: bawa status + potongan respons buat pesan fail
}

function ownFile(msg) {
  if (msg.photo && msg.photo.length) {
    const b = msg.photo[msg.photo.length - 1];
    return { fid: b.file_id, name: "image.jpg", mime: "image/jpeg" };
  }
  if (msg.document) return { fid: msg.document.file_id, name: msg.document.file_name || "file.bin", mime: msg.document.mime_type || "application/octet-stream" };
  return null;
}
// sumber file: reply ke foto/document, atau foto dengan caption
function pickFile(msg) {
  const rp = msg.reply_to_message || {};
  return ownFile(rp) || ownFile(msg);
}

async function hostMenu(env, chatId, f, L) {
  const tok = Math.random().toString(36).slice(2, 10);
  await putJSON(env, TOK_PFX + tok, { fid: f.fid, name: f.name, mime: f.mime, ts: Date.now() }, env.DB ? { ttlMs: TOK_TTL } : undefined); // name/mime ikut — kalau gak, upload = "file.bin"
  const list = HOSTS.map((h, i) => (i + 1) + ". " + h.name + " — " + L[h.ret]).join("\n");
  const rows = [HOSTS.map((h, j) => ({ text: String(j + 1), callback_data: "hostp:" + tok + ":" + h.id }))];
  rows.push([{ text: L.rstNo, callback_data: "hostcancel:" + tok }]);
  const j = await tg(env, "sendMessage", { chat_id: chatId, text: L.hostMenu + "\n\n" + list, parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
  const mid = j && j.ok && j.result ? j.result.message_id : 0;
  if (mid) scheduleDelete(env, chatId, mid, MENU_DEL_MS);
}

async function hostLast(env, chatId) {
  const r = await getJSON(env, LAST_PFX + chatId, null);
  return r && r.fid && Date.now() - (r.ts || 0) <= TOK_TTL ? r : null;
}

// catet media terakhir per chat (foto/document apapun, termasuk forward) — /host polos pake ini kalau gak nge-reply
export async function hostTrack(env, chatId, msg) {
  const f = ownFile(msg);
  if (f) { try { await putJSON(env, LAST_PFX + chatId, { fid: f.fid, name: f.name, mime: f.mime, ts: Date.now() }, env.DB ? { ttlMs: TOK_TTL } : undefined); } catch (_) {} }
}

export async function handleHostCmd(env, msg, chatId) {
  const L = await uiLang(env);
  const f = pickFile(msg) || await hostLast(env, chatId);
  if (!f) return reply(env, chatId, L.hostUsage);
  return hostMenu(env, chatId, f, L);
}

export async function handleHostPhoto(env, msg, chatId) {
  const L = await uiLang(env);
  const f = pickFile(msg);
  if (!f) return reply(env, chatId, L.hostUsage);
  return hostMenu(env, chatId, f, L);
}

export async function handleHostCb(env, cbId, chatId, mid, arg) {
  const L = await uiLang(env);
  const sep = arg.indexOf(":");
  const tok = sep < 0 ? arg : arg.slice(0, sep);
  const hid = sep < 0 ? "" : arg.slice(sep + 1);
  const h = HOSTS.find(x => x.id === hid);
  const rec = tok ? await getJSON(env, TOK_PFX + tok, null) : null;
  if (!h || !rec || !rec.fid || Date.now() - (rec.ts || 0) > TOK_TTL) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.hostGone });
    if (mid) { try { await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.hostGone, parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }); } catch (_) {} }
    return;
  }
  await env.KV.delete(TOK_PFX + tok); // one-shot
  await tg(env, "answerCallbackQuery", { callback_query_id: cbId });
  if (mid) { try { await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.hostUploading(esc(h.name)), parse_mode: "HTML" }); } catch (_) {} }
  await tg(env, "sendChatAction", { chat_id: chatId, action: "upload_document" });
  let out = null, why = "";
  try {
    const bytes = await tgFileBytes(env, rec.fid);
    out = await uploadTo(env, h, bytes, rec.name || "file.bin", rec.mime || "application/octet-stream");
  } catch (e) { out = null; why = String(e && e.message || e).slice(0, 120); }
  if (!out) {
    console.error("host fail:", h.id, why);
    dbgLog(env, "host", h.id + " fail " + why);
    if (mid) { try { await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.hostFail(esc(h.name), esc(why)), parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }); } catch (_) {} }
    return;
  }
  const lines = [L.hostDone(esc(h.name)), "", "<code>" + esc(out.url) + "</code>"];
  const rows = [[{ text: L.hostOpen, url: out.url }]];
  if (out.del) rows.push([{ text: L.hostDelBtn, url: out.del }]);
  if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: lines.join("\n"), parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
}

export async function handleHostCancel(env, cbId, chatId, mid, tok) {
  const L = await uiLang(env);
  if (tok) await env.KV.delete(TOK_PFX + tok);
  await tg(env, "answerCallbackQuery", { callback_query_id: cbId, text: L.cancelledMsg });
  if (mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {} }
}

// link provider polos di chat → bot fetch + kirim balik file-nya (request owner 25 Okt)
const HOST_LINK_RE = /https?:\/\/[^\s<>"']*?(?:kappa\.lol|femboy\.beauty|lain\.la|uguu\.se|catbox\.moe)\/\S+/i;
const HOST_FETCH_MAX = 20 * 1024 * 1024; // senada cap upload /host
const MIME_EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "video/mp4": ".mp4", "video/webm": ".webm", "application/zip": ".zip", "application/pdf": ".pdf", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "text/plain": ".txt" };

export function hostLinkFind(text) {
  const m = String(text || "").match(HOST_LINK_RE);
  return m ? m[0].replace(/[).,\]}>'"]+$/, "") : null;
}

async function sendDocBytes(env, chatId, bytes, name, mime) {
  try {
    const fd = new FormData();
    fd.append("chat_id", String(chatId));
    fd.append("document", new Blob([bytes], { type: mime }), name);
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendDocument", { method: "POST", body: fd, signal: AbortSignal.timeout(120000) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) tgErrLog(env, "sendDocument", j);
    return j;
  } catch (_) { tgErrLog(env, "sendDocument", null); return null; }
}

export async function handleHostFetch(env, chatId, url) {
  const L = await uiLang(env);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "upload_document" });
  let bytes = null, ct = "";
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: hostTmo(env) });
    ct = (r.headers.get("content-type") || "").split(";")[0].trim();
    if (!r.ok) throw new Error(String(r.status));
    const buf = await r.arrayBuffer();
    if (buf.byteLength > HOST_FETCH_MAX) throw new Error("too big");
    bytes = new Uint8Array(buf);
    if (!bytes.length) throw new Error("empty");
  } catch (_) { return reply(env, chatId, L.hostFetchFail(esc(url))); }
  let name = "";
  try { name = decodeURIComponent((new URL(url)).pathname.split("/").pop() || ""); } catch (_) { name = ""; }
  if (!name) name = "file";
  if (!/\.[A-Za-z0-9]{1,6}$/.test(name)) name += MIME_EXT[ct] || ".bin";
  const j = await sendDocBytes(env, chatId, bytes, name, ct || "application/octet-stream");
  if (!j || !j.ok) return reply(env, chatId, L.hostFetchFail(esc(url)));
}
