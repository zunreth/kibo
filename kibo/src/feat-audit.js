import { getJSON, putJSON, tg, reply } from './base.js';
import { uiLang } from './ui.js';
import {
  MEM_KEY, CMEM_PREFIX, CHAR_ACTIVE_KEY, EXP_KEY, HABITS_KEY, HABIT_PLAN_KEY, COUNTDOWN_KEY,
  SLEEP_LOG_KEY, SLEEP_GN_KEY, FOCUS_KEY, FOCUS_LOG_KEY, WX_LOC_KEY, WX_CTX_KEY, CAPSULE_KEY,
  TODO_KEY, READLIST_KEY,
} from './consts.js';

export const AUDIT_KEY = "audit";
export const AUDIT_SNAP_PREFIX = "audit_snap:";
export const AUDIT_MAX = 20;
export const AUDIT_TTL_MS = 24 * 3600 * 1000;

export async function auditKeysFor(env, name, chatId) {
  switch (name) {
    case "remember":
    case "forget": {
      let active = "";
      try { active = (await env.KV.get(CHAR_ACTIVE_KEY)) || ""; } catch (_) {}
      return [active ? CMEM_PREFIX + active : MEM_KEY];
    }
    case "set_reminder": return ["reminders"];
    case "mark_quest":
    case "quest": return ["quest"];
    case "mark_sidequest":
    case "new_sidequest": return ["squest"];
    case "journal": return ["journal"];
    case "habits": return [HABITS_KEY, HABIT_PLAN_KEY];
    case "log_expense": return [EXP_KEY];
    case "countdown": return [COUNTDOWN_KEY];
    case "sleep": return [SLEEP_LOG_KEY, SLEEP_GN_KEY];
    case "focus": return [FOCUS_KEY, FOCUS_LOG_KEY];
    case "weather": return [WX_LOC_KEY, WX_CTX_KEY];
    case "reading_list": return [READLIST_KEY + (chatId || "")];
    case "capsule": return [CAPSULE_KEY];
    case "todo": return [TODO_KEY];
    default: return [];
  }
}

export async function auditBefore(env, name, chatId) {
  try {
    const keys = await auditKeysFor(env, name, chatId);
    if (!keys.length) return null;
    const snaps = [];
    for (const key of keys) {
      let prev = null;
      try { prev = await getJSON(env, key, null); } catch (_) {}
      snaps.push({ key, prev });
    }
    return { name, snaps };
  } catch (_) {
    return null;
  }
}

const sameVal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isPlainObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const recKey = e => (e && typeof e === "object")
  ? (e.id !== undefined ? "i:" + e.id : (e.ts !== undefined ? "t:" + e.ts : "c:" + JSON.stringify(e)))
  : "v:" + JSON.stringify(e);

export function revertValue(prev, post, cur) {
  if (sameVal(prev, post)) return cur;
  if (Array.isArray(prev) && Array.isArray(post) && Array.isArray(cur)) {
    const prevMap = new Map(prev.map(e => [recKey(e), e]));
    const postMap = new Map(post.map(e => [recKey(e), e]));
    const added = new Set([...postMap.keys()].filter(k => !prevMap.has(k)));
    let out = cur.filter(e => !added.has(recKey(e)));
    const have = new Set(out.map(recKey));
    for (const [k, e] of prevMap) {
      if (postMap.has(k) || have.has(k)) continue;
      out.push(e);
      have.add(k);
    }
    out = out.map(e => {
      const k = recKey(e);
      if (!k || !prevMap.has(k) || !postMap.has(k)) return e;
      const before = prevMap.get(k), after = postMap.get(k);
      if (sameVal(before, after)) return e;
      return sameVal(e, after) ? before : e;
    });
    return out;
  }
  if (isPlainObj(prev) && isPlainObj(post) && isPlainObj(cur)) {
    const out = Object.assign({}, cur);
    for (const k of Object.keys(post)) {
      if (k in prev) continue;
      if (sameVal(out[k], post[k])) delete out[k];
    }
    for (const k of Object.keys(prev)) {
      if (k in post) continue;
      if (out[k] === undefined) out[k] = prev[k];
    }
    for (const k of Object.keys(post)) {
      if (!(k in prev) || sameVal(prev[k], post[k])) continue;
      if (sameVal(out[k], post[k])) out[k] = prev[k];
    }
    return out;
  }
  return sameVal(cur, post) ? prev : cur;
}

export async function auditAfter(env, snap, label) {
  if (!snap) return null;
  try {
    let changed = false;
    for (const s of snap.snaps) {
      let cur = null;
      try { cur = await getJSON(env, s.key, null); } catch (_) {}
      s.post = cur;
      if (!changed && JSON.stringify(cur) !== JSON.stringify(s.prev)) changed = true;
    }
    if (!changed) return null;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try { await putJSON(env, AUDIT_SNAP_PREFIX + id, snap.snaps, { ttlMs: AUDIT_TTL_MS }); } catch (_) {}
    const list = (await getJSON(env, AUDIT_KEY, [])) || [];
    const arr = Array.isArray(list) ? list : [];
    arr.unshift({
      id, ts: Date.now(), tool: snap.name,
      label: String(label || snap.name).slice(0, 120),
      keys: snap.snaps.map(s => s.key),
    });
    while (arr.length > AUDIT_MAX) arr.pop();
    await putJSON(env, AUDIT_KEY, arr);
    return id;
  } catch (_) {
    return null;
  }
}

export async function undoAudit(env, id) {
  try {
    const list = (await getJSON(env, AUDIT_KEY, [])) || [];
    const arr = Array.isArray(list) ? list : [];
    if (!arr.length) return { ok: false, why: "empty" };
    let entry = null;
    if (id) entry = arr.find(e => e && e.id === id) || null;
    else entry = arr[0];
    if (!entry) return { ok: false, why: "gone" };
    const snaps = await getJSON(env, AUDIT_SNAP_PREFIX + entry.id, null);
    if (!Array.isArray(snaps)) return { ok: false, why: "expired" };
    for (const s of snaps) {
      if (!s || !s.key) continue;
      const hasPost = Object.prototype.hasOwnProperty.call(s, "post");
      const cur = await getJSON(env, s.key, null);
      const next = hasPost ? revertValue(s.prev, s.post, cur) : s.prev;
      if (next === null || next === undefined) { try { await env.KV.delete(s.key); } catch (_) {} }
      else if (!sameVal(next, cur)) { try { await putJSON(env, s.key, next); } catch (_) {} }
    }
    try { await env.KV.delete(AUDIT_SNAP_PREFIX + entry.id); } catch (_) {}
    const rest = arr.filter(e => e && e.id !== entry.id);
    await putJSON(env, AUDIT_KEY, rest);
    return { ok: true, entry };
  } catch (e) {
    return { ok: false, why: "error" };
  }
}

export async function listAudit(env, n) {
  const list = (await getJSON(env, AUDIT_KEY, [])) || [];
  const arr = Array.isArray(list) ? list : [];
  return arr.slice(0, n || AUDIT_MAX);
}

export async function handleAudit(env, chatId, arg) {
  const L = await uiLang(env);
  const a = String(arg || "").trim().toLowerCase();
  if (a === "undo" || a === "last") {
    const r = await undoAudit(env, "");
    if (r.ok) return reply(env, chatId, L.auditUndone(String((r.entry && (r.entry.label || r.entry.tool)) || "change")));
    return reply(env, chatId, r.why === "expired" ? L.auditExpired : L.auditEmpty);
  }
  const list = await listAudit(env, 10);
  if (!list.length) return reply(env, chatId, L.auditEmpty);
  const rows = list.map(e => [{ text: "\u21A9\uFE0E " + String(e.label || e.tool).slice(0, 40), callback_data: "undo:" + e.id }]);
  return tg(env, "sendMessage", {
    chat_id: chatId, text: L.auditHead(list.length), parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
  });
}
