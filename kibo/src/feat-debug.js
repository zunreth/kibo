// feat-debug — owner-only debug mode: toggle + per-command log ring (session-grouped) + realtime stream + full-log dump.
// Debug ON (flag "debug_flag" = "1"):
//   1) tiap command/callback/notify + kejadian internal (AI call, tool, error) dicatat ring in-memory (max DBG_RING_MAX).
//   2) GET /dbg balas "1" -> glm-watch.sh self-gate.
//   3) realtime stream: selama jendela DBG_STREAM_MS (default 1 mnt) sejak dinyalain, tiap log di-push ke chat owner
//      (throttle DBG_STREAM_MIN_GAP), abis itu auto-off (ring tetep).
//   4) /debug log [N] (default 3): dump full trace dari N sesi command terakhir — biar error bisa dianalisis langsung.
// Debug OFF: gak ada logging, /dbg balas "0", glm-watch senyap.
import { esc, notify, tg } from './base.js';
import { uiLang, fmtWIB } from './ui.js';
import { DEBUG_FLAG, DBG_RING_MAX, DBG_STREAM_MS, DBG_STREAM_MIN_GAP, WIB, LIVE_CTX } from './consts.js';

const DBG_RING = [];
export function clearDbgRing() { DBG_RING.length = 0; SESS_LABELS.clear(); SESS_CUR = 0; }
let DBG_ACTIVE = false;
let DBG_ACTIVE_AT = 0;
let STREAM_UNTIL = 0;   // ms: auto-stop push realtime
let STREAM_LAST = 0;    // ms push terakhir (throttle)
const REFRESH_MS = 5000;

// session grouping — tiap cmd/cb/notify mulai "sesi" baru; log internal (ai/tool/err) nempel ke sesi itu.
let SESS_CUR = 0;
const SESS_LABELS = new Map(); // id -> {label, t}
function beginSession(kind, msg) {
  const id = ++SESS_CUR;
  const label = kind === "cmd" ? String(msg).slice(0, 40)
    : kind === "cb" ? String(msg).slice(0, 40)
    : "notify";
  SESS_LABELS.set(id, { label, t: Math.floor(Date.now() / 1000) });
  if (SESS_LABELS.size > 32) SESS_LABELS.delete(SESS_LABELS.keys().next().value);
  return id;
}

const envMax = (env, k, d) => { const n = parseInt(String((env && env[k]) || ""), 10); return !isNaN(n) && n > 0 ? n : d; };
const dbgStreamMax = env => envMax(env, "DBG_STREAM_MS", DBG_STREAM_MS);
const dbgStreamGap = env => envMax(env, "DBG_STREAM_MIN_GAP", DBG_STREAM_MIN_GAP);

const pad2 = n => String(n).padStart(2, "0");
function compactWIB(sec) {
  const d = new Date((sec + WIB) * 1000);
  return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + ":" + pad2(d.getUTCSeconds()) + " WIB";
}

function pushLive(env, entry) {
  const now = Date.now();
  if (now >= STREAM_UNTIL) return;
  if (now - STREAM_LAST < dbgStreamGap(env)) return;  // throttled (tetap di ring)
  STREAM_LAST = now;
  const line = "\uD83D\uDC1E <b>[" + esc(entry.k) + "]</b> " + esc(entry.v) + " \u00B7 " + compactWIB(entry.t);
  const job = env.KV.get("owner_chat")
    .then(owner => { if (owner) return tg(env, "sendMessage", { chat_id: owner, text: line, parse_mode: "HTML" }); })
    .catch(() => {});
  try { if (LIVE_CTX && typeof LIVE_CTX.waitUntil === "function") LIVE_CTX.waitUntil(job); } catch (_) {}
}

// Sync + fire-and-forget refresh — gak nge-block KV read per command.
export function dbgLog(env, kind, msg) {
  const now = Date.now();
  if (now - DBG_ACTIVE_AT > REFRESH_MS) {
    DBG_ACTIVE_AT = now;
    env.KV.get(DEBUG_FLAG).then(v => { DBG_ACTIVE = v === "1"; }).catch(() => {});
  }
  if (!DBG_ACTIVE) return;
  let s = SESS_CUR;
  if (kind === "cmd" || kind === "cb" || kind === "notify") s = beginSession(kind, msg);
  const entry = { t: Math.floor(now / 1000), k: kind, v: String(msg).slice(0, 240), s };
  DBG_RING.push(entry);
  if (DBG_RING.length > DBG_RING_MAX) DBG_RING.splice(0, DBG_RING.length - DBG_RING_MAX);
  pushLive(env, entry);
}

export function armStream(env) {
  STREAM_UNTIL = Date.now() + dbgStreamMax(env);
  STREAM_LAST = 0;
}
function streamActive() {
  return Date.now() < STREAM_UNTIL;
}

export async function setDebug(env, on) {
  DBG_ACTIVE = !!on;
  DBG_ACTIVE_AT = Date.now();
  if (on) armStream(env); else STREAM_UNTIL = 0;
  try { await env.KV.put(DEBUG_FLAG, on ? "1" : "0"); } catch (_) {}
}

export async function getDebug(env) {
  try { return (await env.KV.get(DEBUG_FLAG)) === "1"; } catch (_) { return false; }
}

// GET /dbg -> "1"|"0" (text) — dibaca glm-watch.sh buat self-gate alert edge-stall.
export async function handleDbgFlag(request, env) {
  if (request.method !== "GET") return new Response("method not allowed", { status: 405 });
  const on = await getDebug(env);
  return new Response(on ? "1" : "0", { headers: { "content-type": "text/plain" } });
}

export async function renderDebugView(env) {
  const L = await uiLang(env);
  const on = await getDebug(env);
  const rows = DBG_RING.slice(-14).reverse();
  const logText = rows.length
    ? rows.map(r => "\u2022 " + fmtWIB(r.t, L) + " <b>[" + esc(r.k) + "]</b> " + esc(r.v)).join("\n")
    : L.dbgEmpty;
  const streaming = on && streamActive();
  const streamLine = on ? (streaming ? L.dbgStreamArmed(Math.max(1, Math.round(dbgStreamMax(env) / 60000))) : L.dbgStreamHint) : "";
  const text = L.dbgTitle(on) + (on ? L.dbgDescOn : L.dbgDescOff) + (streamLine ? "\n" + streamLine : "") + "\n\n\ud83e\udea9 <b>" + L.dbgLogLbl + "</b> (" + DBG_RING.length + "):\n" + logText;
  const rowsKb = [
    [{ text: on ? L.dbgOffBtn : L.dbgOnBtn, callback_data: on ? "dbg:off" : "dbg:on" }]
  ];
  if (on) rowsKb.push([{ text: L.dbgStreamBtn, callback_data: "dbg:stream" }, { text: L.dbgLogBtn, callback_data: "dbg:log" }]);
  rowsKb.push([{ text: L.dbgClearBtn, callback_data: "dbg:clear" }]);
  rowsKb.push([{ text: L.back, callback_data: "nav:cfg" }, { text: L.home, callback_data: "menu" }]);
  return { text, markup: { inline_keyboard: rowsKb } };
}

export async function renderLogView(env, n) {
  const L = await uiLang(env);
  n = Math.max(1, Math.min(10, parseInt(String(n), 10) || 3));
  // grup ring by session, urut dari sesi terbaru; ambil n sesi terakhir (yang punya minimal 1 entry)
  const bySess = new Map();
  for (const r of DBG_RING) { if (!bySess.has(r.s)) bySess.set(r.s, []); bySess.get(r.s).push(r); }
  const sessOrder = [...bySess.keys()].sort((a, b) => b - a).slice(0, n);
  let body = "";
  if (!sessOrder.length) body = mN(L.dbgLogEmpty);
  for (const sid of sessOrder) {
    const sl = SESS_LABELS.get(sid);
    const head = (sl ? esc(sl.label) : "#" + sid) + " \u00B7 " + fmtWIB((sl && sl.t) || Math.floor(Date.now() / 1000), L);
    body += "\ud83D\uDCD1 <b>" + head + "</b>\n" + bySess.get(sid).map(r => "   \u2022 <b>[" + esc(r.k) + "]</b> " + esc(r.v)).join("\n") + "\n\n";
  }
  const text = L.dbgLogTitle(n) + body.trim() + "\n\n" + L.dbgLogHow;
  const nums = [3, 5, 10].map(k => ({ text: k === n ? "\u2705 " + k : String(k), callback_data: "dbg:log:" + k }));
  return { text, markup: { inline_keyboard: [nums, [{ text: L.back, callback_data: "nav:dbg" }, { text: L.home, callback_data: "menu" }]] } };
}
const mN = t => t;

export async function handleDebug(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\S+\s*/, "") || "").trim().toLowerCase();
  if (arg === "on" || arg === "1") { await setDebug(env, true); return notify(env, chatId, L.dbgOnPop); }
  if (arg === "off" || arg === "0") { await setDebug(env, false); return notify(env, chatId, L.dbgOffPop); }
  if (arg === "clear") { DBG_RING.length = 0; SESS_LABELS.clear(); SESS_CUR = 0; return notify(env, chatId, L.dbgCleared); }
  if (arg === "stream") { armStream(env); return notify(env, chatId, L.dbgStreamPop); }
  if (arg === "log" || /^log\s+\d+$/.test(arg)) {
    const n2 = arg.split(/\s+/)[1] ? parseInt(arg.split(/\s+/)[1], 10) : 3;
    const v = await renderLogView(env, n2);
    return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  }
  const v = await renderDebugView(env);
  return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}
