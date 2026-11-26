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
  AIST_MSG_PREFIX,
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
import {
  esc,
  mdTg,
  getJSON,
  putJSON,
  tg,
  reply,
  delCmd,
  notify,
  scheduleDelete,
  tgFileBytes,
  tryDeleteIds,
  KV_DEAF,
  setKV_DEAF,
  NUKE_BUFS,
  trackNukeMsg,
  flushNukeBuf,
  nukeGone,
  nukeSleep,
} from './base.js';

export let STAMP_LAST = 0;
export async function stampAlive(env) {
  try {
    if (Date.now() < KV_DEAF) return;
    const now = Math.floor(Date.now() / 1000);
    if (now - STAMP_LAST < parseInt((env && env.STAMP_THROTTLE_MS) || "60000", 10)) return;
    const cur = await env.KV.get("last_user_msg");
    if (cur && now - parseInt(cur, 10) < 30) { STAMP_LAST = now; return; }
    await env.KV.put("last_user_msg", String(now));
    STAMP_LAST = now;
  } catch (_) { setKV_DEAF(Date.now() + 90000); }
}

export let QUOTA_NOTED = false;
export async function onUpdErr(env, e) {
  const msg = String((e && e.message) || e || "");
  if (!/10048|usage limit/i.test(msg)) {
    console.error("handleUpdate:", (e && e.stack) || e);
    return errDm(env, e);
  }
  console.error("handleUpdate(kv-quota):", msg.slice(0, 120));
  if (QUOTA_NOTED) return;
  QUOTA_NOTED = true;
  try {
    const owner = await env.KV.get("owner_chat");
    if (owner) await tg(env, "sendMessage", { chat_id: owner, text: "\u26A1 Cloudflare KV free quota for today is used up \u2014 buttons/replies may go quiet until the 07:00 WIB reset. Chats still get through, but saved state (history/reminders) may not be recorded for a while." });
  } catch (_) {}
}

export const ERRDM_TTL_S = 3600;

export async function softWrite(env, tag, fn) {
  try {
    return await fn();
  } catch (e) {
    const wrapped = new Error(tag + ": " + String((e && e.message) || e).slice(0, 120));
    wrapped.stack = "at softWrite(" + tag + ")\n" + String((e && e.stack) || "");
    try { await errDm(env, wrapped); } catch (_) {  }
    return null;
  }
}

export async function errDm(env, e) {
  try {
    if (e && e.__tg) return;
    const owner = Number(await env.KV.get("owner_chat")) || 0;
    if (!owner) return;
    const stack = String((e && e.stack) || e || "").split("\n");
    const site = (stack.find(l => /\bat\b/.test(l) && !/onUpdErr|errDm/.test(l)) || stack[0] || "?").trim().slice(0, 140);
    const key = "errdm:" + site.replace(/[^\w./:-]+/g, "_").slice(0, 80);
    if (await env.KV.get(key)) return;
    await env.KV.put(key, "1", { ttlMs: ERRDM_TTL_S * 1000, expirationTtl: ERRDM_TTL_S });
    const text = "\u274C <b>handler error</b>\n<code>" + esc(String((e && e.message) || e || "?").slice(0, 200)) + "</code>\n<code>" + esc(site) + "</code>";
    await tg(env, "sendMessage", { chat_id: owner, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "\u{1F41E} /debug", callback_data: "dbg:log" }]] } });
  } catch (_) {}
}

export const FV_ACCOUNT = "0977dc508f898fc11b9e2f182503565f";
export const FV_NS = "dd38a8a6a22946eba677bff8101a15c2";
export const FV_FLAG_KEY = "failover_mode";
export const FV_OTP_BASE = "";
export let FV_MODE = null;

export function fvActive() { return !!(FV_MODE && FV_MODE.until > Date.now()); }
export function fvNextUTCMidnight() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
export function fvFetch(env, key, method, body, ttl) {
  const u = "https://api.cloudflare.com/client/v4/accounts/" + FV_ACCOUNT + "/storage/kv/namespaces/" + FV_NS + "/values/" + encodeURIComponent(key) + (ttl ? "?expiration_ttl=" + Math.max(60, Math.floor(ttl)) : "");
  const h = { "Authorization": "Bearer " + env.FAILOVER_TOKEN };
  if (body !== undefined) h["Content-Type"] = "text/plain";
  return fetch(u, { method: method, headers: h, body: body === undefined ? undefined : String(body), signal: AbortSignal.timeout(10000) });
}
export async function fvPut(env, key, val, opts) {
  try {
    const r = await fvFetch(env, key, "PUT", val, opts && opts.expirationTtl);
    if (!r.ok) console.error("fvPut:", key, r.status);
    return r.ok;
  } catch (_) { return false; }
}
export async function fvGet(env, key) {
  try {
    const r = await fvFetch(env, key, "GET");
    return r.ok ? await r.text() : null;
  } catch (_) { return null; }
}
export async function fvDelete(env, key) {
  try { await fvFetch(env, key, "DELETE"); } catch (_) {}
}
export async function fvFlag(env) {
  if (!env.FAILOVER_TOKEN) return null;
  try {
    const raw = await fvGet(env, FV_FLAG_KEY);
    const j = raw && JSON.parse(raw);
    return j && j.until > Date.now() ? j : null;
  } catch (_) { return null; }
}
export function wrapKV(env) {
  if (!env.FAILOVER_TOKEN) return env.KV;
  const prim = env.KV;
  return {
    async get(k) {
      const v = await prim.get(k);
      if (v !== null && v !== undefined) return v;
      if (fvActive()) return await fvGet(env, k);
      return v;
    },
    async put(k, val, opts) {
      if (FV_MODE && FV_MODE.until <= Date.now()) { FV_MODE = null; fvDelete(env, FV_FLAG_KEY); }
      if (fvActive()) {
        const ok = await fvPut(env, k, val, opts);
        if (!ok) throw new Error("KV failover PUT partner failed — 10048 " + k);
        return undefined;
      }
      try { return await prim.put(k, val, opts); }
      catch (e) {
        if (!/10048|usage limit/i.test(String((e && e.message) || e))) throw e;
        FV_MODE = { until: fvNextUTCMidnight() };
        await fvPut(env, FV_FLAG_KEY, JSON.stringify(FV_MODE));
        console.error("KV failover ON s/d", new Date(FV_MODE.until).toISOString());
        const ok = await fvPut(env, k, val, opts);
        if (!ok) throw e;
        return undefined;
      }
    },
    async delete(k) {
      if (fvActive()) {
        await Promise.all([prim.delete(k).catch(() => {}), fvDelete(env, k)]);
        return undefined;
      }
      return prim.delete(k);
    }
  };
}

export const STATS_BUF = new Map();
export let STATS_FLUSH_LAST = 0;
export async function bumpStats(env, inChars, outChars, charId) {
  if (Date.now() < KV_DEAF) return;
  let st = STATS_BUF.get(env);
  if (!st) { st = { c: 0, i: 0, o: 0 }; STATS_BUF.set(env, st); }
  st.c++; st.i += inChars || 0; st.o += outChars || 0;
  if (charId) { if (!st.ch) st.ch = {}; st.ch[charId] = (st.ch[charId] || 0) + 1; }
  const now = Date.now();
  if (now - STATS_FLUSH_LAST < parseInt((env && env.STATS_FLUSH_MS) || "300000", 10)) return;
  STATS_FLUSH_LAST = now;
  await flushStatsBuf(env);
}

const CMD_ALIAS = { "/journal": "/j" };
export function bumpCmd(env, cmd) {
  if (Date.now() < KV_DEAF) return;
  let c = String(cmd || "").trim().toLowerCase().split("@")[0];
  if (!c.startsWith("/")) return;
  if (CMD_ALIAS[c]) c = CMD_ALIAS[c];
  let st = STATS_BUF.get(env);
  if (!st) { st = { c: 0, i: 0, o: 0 }; STATS_BUF.set(env, st); }
  if (!st.cm) st.cm = {};
  st.cm[c] = (st.cm[c] || 0) + 1;
}

export async function flushStatsBuf(env) {
  const st = STATS_BUF.get(env);
  if (!st || !(st.c || st.i || st.o || (st.cm && Object.keys(st.cm).length))) return;
  STATS_BUF.set(env, { c: 0, i: 0, o: 0 });
  if (Date.now() < KV_DEAF) return;
  try {
    const s = (await getJSON(env, STATS_KEY, null)) || { d: {}, t: { c: 0, i: 0, o: 0 } };
    if (!s.t) s.t = { c: 0, i: 0, o: 0 };
    if (!s.d) s.d = {};
    const day = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
    const e = s.d[day] || (s.d[day] = { c: 0, i: 0, o: 0 });
    const i = Math.round(st.i / 4);
    const o = Math.round(st.o / 4);
    e.c += st.c; e.i += i; e.o += o;
    s.t.c += st.c; s.t.i += i; s.t.o += o;
    const ks = Object.keys(s.d).sort();
    while (ks.length > 30) delete s.d[ks.shift()];
    await putJSON(env, STATS_KEY, s);
    if (st.cm) {
      try {
        const cu = (await getJSON(env, "cmduse", null)) || { d: {} };
        if (!cu.d) cu.d = {};
        const cday = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
        const ce = cu.d[cday] || (cu.d[cday] = {});
        for (const [k, n] of Object.entries(st.cm)) ce[k] = (ce[k] || 0) + n;
        const cks = Object.keys(cu.d).sort();
        while (cks.length > 30) delete cu.d[cks.shift()];
        await putJSON(env, "cmduse", cu);
      } catch (_) {}
    }
    if (st.ch) for (const [cid, n] of Object.entries(st.ch)) {
      try {
        const mk = AIST_MSG_PREFIX + cid;
        const cur = parseInt((await env.KV.get(mk)) || "0", 10) || 0;
        await env.KV.put(mk, String(cur + n));
      } catch (_) {}
    }
  } catch (_) {}
}
