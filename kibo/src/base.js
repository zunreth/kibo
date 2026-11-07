import {
  AI_TEXT,
  AI_VISION,
  AI_STT,
  AI_STT_FB,
  AI_TTS,
  TTS_KEY,
  TTS_MAX,
  UA,
  WIB,
  DAYS,
  SYS_CHAT,
  SYS_SUMMARIZE,
  CHAT_HIST_KEY,
  NUKE_KEY,
  LAST_AI_KEY,
  REGEN_LOCK_KEY,
  CONT_CHAIN_KEY,
  SELF_BASE,
  NUKE_CAP,
  CHAT_HIST_MAX,
  MEM_KEY,
  MEM_MAX,
  OWNER_FALLBACK,
  CHAR_KEY,
  CHAR_ACTIVE_KEY,
  CHAR_MAX,
  CHAR_IMPORT_KEY,
  CMEM_PREFIX,
  PERSONA_KEY,
  AI_CFG_KEY,
  LEN_KEY,
  LANG_KEY,
  UI_LANG_KEY,
  STATS_KEY,
  BOT_VER,
  WIZ_KEY,
  PRESET_KEY,
  PRESET_MAX,
  PRESET_IMPORT_KEY,
  PRESET_COMPILED_CAP,
  RP_FORMAT,
  VAULT_CHAT_KEY,
  FILE_INDEX_KEY,
  VAULT_SNAPS_KEY,
  VAULT_CFG_KEY,
  VAULT_BIND_KEY,
  VAULT_REN_KEY,
  VAULT_OP_KEY,
  FILE_MAX,
  SNAP_MAX,
  ABORT_KEY,
  ABORT_TOK,
  NOTE_ABORT,
  WD_CUT_NOTE,
  LIVE_GEN,
  INCEPTION,
  LAST_CF,
  LIVE_CTX,
  setLiveCtx,
  setLastCf,
} from './consts.js';
import { dbgLog } from './feat-debug.js';

export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function mdTg(s) {
  return s
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*\n]+?)\*/g, "<i>$1</i>");
}

// NF-251019-4: shared env-knobbed upstream timeout (user-facing interactive fetches)
export const upstreamTmo = env => AbortSignal.timeout(parseInt((env && env.UPSTREAM_TIMEOUT_MS) || "", 10) || 15000);

export async function getJSON(env, k, d) {
  const v = await env.KV.get(k);
  if (!v) return d;
  try { return JSON.parse(v); } catch (_) { return d; }
}
export async function putJSON(env, k, v, opts) {
  await env.KV.put(k, JSON.stringify(v), opts);
}

export async function tg(env, method, payload) {
  if (!env.TG_TOKEN) throw new Error("TG_TOKEN not set");
  let j = null;
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/" + method, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    j = await r.json().catch(() => null);
  } catch (e) {
    dbgLog(env, "tg", method + " THREW " + String((e && e.message) || e).slice(0, 120));
    throw e; // propagate ke caller persis kayak dulu
  }
  if (!j || !j.ok) tgErrLog(env, method, j);
  if (j && j.ok && j.result && typeof j.result.message_id === "number") await trackNukeMsg(env, j.result.message_id);
  if (env.__probe && j && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: method, chat: payload.chat_id, text: String(payload.text || payload.caption || "").slice(0, 400) });
  return j;
}

// B11: delivery fail TG = catet ke ring debug juga (keliatan di /debug log), bukan cuman console
export function tgErrLog(env, method, j) {
  console.error("tg fail:", method, JSON.stringify((j && j.description) || "").slice(0, 200));
  dbgLog(env, "tg", method + " fail " + String((j && j.description) || (j ? "?" : "no-json")).slice(0, 140));
}

export async function reply(env, chatId, text) {
  return tg(env, "sendMessage", { chat_id: chatId, text: text, parse_mode: "HTML" });
}

export async function delCmd(env, chatId, mid) {
  if (typeof mid !== "number") return;
  try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {}
}

export async function notify(env, chatId, text) {
  const j = await reply(env, chatId, text);
  const mid = j && j.result && j.result.message_id;
  if (mid) scheduleDelete(env, chatId, mid);
  return j;
}
export function scheduleDelete(env, chatId, mid, ms) {
  if (ms === undefined) ms = parseInt(env.NOTIFY_MS || "", 10) || 15000;
  const job = (async () => {
    await new Promise(r => setTimeout(r, ms));
    try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }); } catch (_) {}
  })();
  try { if (LIVE_CTX && LIVE_CTX.waitUntil) LIVE_CTX.waitUntil(job); } catch (_) {}
}

export async function tgFileBytes(env, fileId) {
  const j = await tg(env, "getFile", { file_id: fileId });
  if (!j || !j.ok || !j.result.file_path) throw new Error("getFile failed");
  const url = "https://api.telegram.org/file/bot" + env.TG_TOKEN + "/" + j.result.file_path;
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.arrayBuffer();
}

export async function tryDeleteIds(env, chatId, ids) {
  let ok = 0;
  for (let k = 0; k < ids.length; k += 100) {
    const chunk = ids.slice(k, k + 100);
    let r = await tg(env, "deleteMessages", { chat_id: chatId, message_ids: chunk });
    if (r && !r.ok && r.parameters && r.parameters.retry_after) {
      await nukeSleep(Math.min(r.parameters.retry_after, 5) * 1000);
      r = await tg(env, "deleteMessages", { chat_id: chatId, message_ids: chunk });
    }
    if (r && r.ok) { ok += chunk.length; continue; }
    for (const mid of chunk) {
      let rr = await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid });
      if (!nukeGone(rr) && rr && rr.parameters && rr.parameters.retry_after) {
        await nukeSleep(Math.min(rr.parameters.retry_after, 5) * 1000);
        rr = await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid });
      }
      if (nukeGone(rr)) ok++;
      await nukeSleep(30);
    }
  }
  return ok;
}

export let KV_DEAF = 0;
export function setKV_DEAF(v) { KV_DEAF = v; }

export const NUKE_BUFS = new Map();
export function trackNukeMsg(env, mid) {
  if (typeof mid !== "number") return;
  let st = NUKE_BUFS.get(env);
  if (!st) { st = { buf: [], timer: null, lastFlush: 0, busy: false }; NUKE_BUFS.set(env, st); }
  st.buf.push({ i: mid, t: Math.floor(Date.now() / 1000) });
  if (st.timer) return;
  const ms = parseInt((env && env.NUKE_FLUSH_MS) || "60000", 10);
  const job = new Promise(res => setTimeout(res, ms)).then(() => flushNukeBuf(env));
  st.timer = setTimeout(() => { st.timer = null; flushNukeBuf(env); }, ms + 50);
  if (typeof LIVE_CTX !== "undefined" && LIVE_CTX && typeof LIVE_CTX.waitUntil === "function") { try { LIVE_CTX.waitUntil(job); } catch (_) {} }
}
export async function flushNukeBuf(env, force) {
  const st = NUKE_BUFS.get(env);
  if (!st || !st.buf.length) return;
  const ms = parseInt((env && env.NUKE_FLUSH_MS) || "60000", 10);
  if (!force && Date.now() - (st.lastFlush || 0) < ms) return;
  if (st.busy) { if (force) { await nukeSleep(120); return flushNukeBuf(env, true); } return; }
  st.busy = true;
  const add = st.buf; st.buf = [];
  try {
    if (Date.now() < KV_DEAF) { st.buf = add.concat(st.buf); st.lastFlush = Date.now(); return; }
    const arr = (await getJSON(env, NUKE_KEY, [])) || [];
    if (!Array.isArray(arr)) { st.buf = add.concat(st.buf); st.lastFlush = Date.now(); return; }
    const seen = new Set(arr.map(x => x && x.i));
    for (const e of add) if (!seen.has(e.i)) arr.push(e);
    await putJSON(env, NUKE_KEY, arr.slice(-NUKE_CAP));
    st.lastFlush = Date.now();
  } catch (_) { KV_DEAF = Date.now() + 90000; st.buf = add.concat(st.buf); st.lastFlush = Date.now(); }
  finally { st.busy = false; }
}

export const nukeGone = r => !!(r && (r.ok || String(r.description || "").includes("not found")));
export const nukeSleep = ms => new Promise(res => setTimeout(res, ms));
