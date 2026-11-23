
import { getJSON } from "./base.js";

export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(36);
}

export function updateFingerprint(update) {
  if (!update || typeof update !== "object") return "";
  if (update.update_id === undefined || update.update_id === null) return "";
  const m = update.message || update.edited_message || (update.callback_query && update.callback_query.message) || {};
  const cq = update.callback_query || {};
  const part = [
    update.update_id,
    m.chat ? m.chat.id : "",
    m.message_id || "",
    (m.text || m.caption || "").slice(0, 120),
    cq.id || "",
    cq.data || "",
    update.edited_message ? "edited" : "",
    update.message_reaction ? "reaction" : ""
  ].join("|");
  return hashStr(part);
}

export const UPDATE_SEEN_PREFIX = "updseen:";
export const UPDATE_SEEN_TTL_MS = 10 * 60 * 1000;

export async function seenUpdate(env, update) {
  try {
    const fp = updateFingerprint(update);
    if (!fp) return false;
    const k = UPDATE_SEEN_PREFIX + fp;
    const hit = await env.KV.get(k);
    if (hit) return true;
    await env.KV.put(k, "1", { ttlMs: UPDATE_SEEN_TTL_MS });
    return false;
  } catch (_) {
    return false;
  }
}

export async function forgetUpdate(env, update) {
  try {
    const fp = updateFingerprint(update);
    if (fp) await env.KV.delete(UPDATE_SEEN_PREFIX + fp);
  } catch (_) {}
}

export const CRON_LOCK_KEY = "cron_lock";
export const CRON_LOCK_MS = 120 * 1000;

export async function cronLock(env, nowMs) {
  const now = nowMs || Date.now();
  try {
    const cur = await getJSON(env, CRON_LOCK_KEY, null);
    const held = cur && Number(cur.ts) || 0;
    if (held && now - held < CRON_LOCK_MS) return false;
    await env.KV.put(CRON_LOCK_KEY, JSON.stringify({ ts: now }), { ttlMs: 4 * CRON_LOCK_MS });
    return true;
  } catch (_) {
    return true;
  }
}

export async function cronUnlock(env) {
  try { await env.KV.delete(CRON_LOCK_KEY); } catch (_) {}
}

const CHAINS = new Map();

export async function mutateJSON(env, key, dflt, fn, tries) {
  const prev = CHAINS.get(key) || Promise.resolve();
  const run = prev.then(() => mutateOnce(env, key, dflt, fn, tries || 3), () => mutateOnce(env, key, dflt, fn, tries || 3));
  CHAINS.set(key, run.catch(() => {}));
  return run;
}

async function mutateOnce(env, key, dflt, fn, tries) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const cur = await getJSON(env, key, dflt);
    const prevStr = JSON.stringify(cur);
    const out = fn(cur);
    if (!out) return cur;
    if (!out.okNow) return out.val;
    if (JSON.stringify(out.val) === prevStr) return out.val;
    await env.KV.put(key, JSON.stringify(out.val), out.opts);
    const back = await getJSON(env, key, dflt);
    if (out.okNow(back)) return out.val;
    last = back;
  }
  return last;
}
