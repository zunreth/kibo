
import { TODO_KEY, TODO_MAX, TODO_TEXT_CAP, WIB } from './consts.js';
import { getJSON, putJSON, reply, notify, esc, tg } from './base.js';
import { uiLang, fmtWIB, UI_SEP } from './ui.js';
import { parseRemind } from './feat-remind.js';

const nowS = () => Math.floor(Date.now() / 1000);
const dayWIB = sec => { const d = new Date(((sec || nowS()) + WIB) * 1000); const p = n => String(n).padStart(2, "0"); return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()); };
const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

export function parseDue(spec, atSec) {
  const s = clean(spec).toLowerCase();
  if (!s) return null;
  const sec = atSec || nowS();
  const r = parseRemind(s, sec);
  if (r) return r;
  if (/^(besok|tomorrow)$/.test(s) || /^(lusa)$/.test(s)) {
    const wib = new Date((sec + WIB) * 1000);
    const add = /^lusa$/.test(s) ? 2 : 1;
    return Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + add, 9, 0, 0) / 1000 - WIB;
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], 9, 0, 0) / 1000 - WIB;
    return isFinite(t) ? t : null;
  }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (m) {
    const y = new Date((sec + WIB) * 1000).getUTCFullYear();
    let t = Date.UTC(y, +m[2] - 1, +m[1], 9, 0, 0) / 1000 - WIB;
    if (t < sec - 86400) t = Date.UTC(y + 1, +m[2] - 1, +m[1], 9, 0, 0) / 1000 - WIB;
    return isFinite(t) ? t : null;
  }
  return null;
}

export async function todoList(env) {
  return (await getJSON(env, TODO_KEY, [])).filter(t => t && t.text);
}
async function save(env, arr) {
  while (arr.length > TODO_MAX) {
    const i = arr.map((t, n) => ({ t, n })).reverse().find(x => x.t.done);
    if (!i) break;
    arr.splice(i.n, 1);
  }
  await putJSON(env, TODO_KEY, arr);
  return arr;
}

export function todoLine(t, atSec) {
  const sec = atSec || nowS();
  const bits = [];
  if (t.due && !t.done) {
    const left = Math.round((t.due - sec) / 86400);
    if (t.due < sec) bits.push("overdue " + Math.abs(Math.round((sec - t.due) / 86400)) + "d");
    else if (dayWIB(t.due) === dayWIB(sec)) bits.push("today");
    else if (left === 1) bits.push("tomorrow");
    else bits.push(fmtWIB(t.due).slice(0, 10));
  }
  if (t.rec) bits.push("every " + t.rec);
  const subs = (t.sub || []);
  return (t.done ? "\u2705 " : "\u2B1C ") + "#" + t.id + " " + esc(t.text) +
    (bits.length ? " \u00B7 " + bits.join(" \u00B7 ") : "") +
    (subs.length ? " \u00B7 " + subs.filter(x => x.done).length + "/" + subs.length : "");
}

export function sortTodos(arr, atSec) {
  const sec = atSec || nowS();
  return arr.slice().sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    const ad = a.due || Infinity, bd = b.due || Infinity;
    if (ad !== bd) return ad - bd;
    return (a.id || 0) - (b.id || 0);
  });
}

export function splitTodoInput(body, atSec) {
  const sec = atSec || nowS();
  let text = clean(body);
  let rec = null;
  const rm = text.match(/\s@(daily|harian|weekly|mingguan)$/i);
  if (rm) { rec = /^d/i.test(rm[1]) ? "daily" : "weekly"; text = text.slice(0, rm.index).trim(); }
  const tk = text.split(/\s+/).filter(Boolean);
  let due = null, cut = tk.length;
  for (let len = Math.min(4, tk.length - 1); len >= 1; len--) {
    const d = parseDue(tk.slice(-len).join(" "), sec);
    if (d) { due = d; cut = tk.length - len; break; }
  }
  return { text: tk.slice(0, cut).join(" "), due, rec };
}

export async function todoAdd(env, text, due, rec) {
  const t = clean(text).slice(0, TODO_TEXT_CAP);
  if (!t) return { ok: false, why: "empty" };
  const arr = await todoList(env);
  const open = arr.filter(x => !x.done).length;
  if (open >= TODO_MAX) return { ok: false, why: "full", max: TODO_MAX };
  const id = arr.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
  arr.push({ id, text: t, due: due || null, done: false, created: nowS(), done_ts: null, rec: rec || null, fired: null });
  await save(env, arr);
  return { ok: true, id, text: t, due: due || null, rec: rec || null, open: open + 1 };
}

function find(arr, who) {
  const q = clean(who).toLowerCase().replace(/^#/, "");
  if (!q) return { hit: null, why: "empty" };
  const byId = arr.find(t => String(t.id) === q);
  if (byId) return { hit: byId };
  const exact = arr.filter(t => t.text.toLowerCase() === q);
  if (exact.length === 1) return { hit: exact[0] };
  const part = arr.filter(t => t.text.toLowerCase().includes(q));
  if (!part.length) return { hit: null, why: "gone" };
  if (part.length > 1) return { hit: null, why: "many", hits: part };
  return { hit: part[0] };
}

export async function todoDone(env, who, atSec) {
  const sec = atSec || nowS();
  const arr = await todoList(env);
  const f = find(arr, who);
  if (!f.hit) return { ok: false, why: f.why, hits: f.hits };
  const t = f.hit;
  if (t.done) return { ok: false, why: "already", text: t.text };
  t.done = true;
  t.done_ts = sec;
  if (t.rec) {
    const step = t.rec === "weekly" ? 7 * 86400 : 86400;
    const base = t.due && t.due > sec ? t.due : sec;
    const id = arr.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
    arr.push({ id, text: t.text, due: base + step, done: false, created: sec, done_ts: null, rec: t.rec, fired: null });
  }
  const left = (await save(env, arr)).filter(x => !x.done).length;
  return { ok: true, id: t.id, text: t.text, left, respawned: !!t.rec };
}

export async function todoDel(env, who) {
  const arr = await todoList(env);
  const f = find(arr, who);
  if (!f.hit) return { ok: false, why: f.why, hits: f.hits };
  const keep = arr.filter(x => x.id !== f.hit.id);
  await save(env, keep);
  return { ok: true, id: f.hit.id, text: f.hit.text, left: keep.filter(x => !x.done).length };
}

export async function todoSnooze(env, who, untilSec) {
  const arr = await todoList(env);
  const f = find(arr, who);
  if (!f.hit) return { ok: false, why: f.why, hits: f.hits };
  if (!untilSec) return { ok: false, why: "when" };
  f.hit.due = untilSec;
  f.hit.fired = null;
  await save(env, arr);
  return { ok: true, id: f.hit.id, text: f.hit.text, due: untilSec };
}

export async function todoDueToday(env, atSec) {
  const sec = atSec || nowS();
  const today = dayWIB(sec);
  return (await todoList(env)).filter(t => !t.done && t.due && dayWIB(t.due) === today);
}
export async function todoOverdue(env, atSec) {
  const sec = atSec || nowS();
  return (await todoList(env)).filter(t => !t.done && t.due && t.due < sec && dayWIB(t.due) !== dayWIB(sec));
}

function todoView(L, arr, atSec) {
  const sec = atSec || nowS();
  const open = arr.filter(t => !t.done);
  const done = arr.filter(t => t.done);
  const body = open.length ? open.map(t => todoLine(t, sec)).join("\n") : L.tdEmpty;
  const tail = done.length ? "\n\n" + L.tdDoneHead(done.length) + "\n" + done.slice(-3).map(t => todoLine(t, sec)).join("\n") : "";
  const rows = open.slice(0, 6).map(t => [{ text: "\u2705 #" + t.id, callback_data: "todo:" + t.id }]);
  rows.push([{ text: L.tdHintBtn, callback_data: "menu" }]);
  return { text: L.tdHead + UI_SEP + body + tail + "\n" + UI_SEP + L.tdUsage, markup: { inline_keyboard: rows } };
}

export async function handleTodo(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = String((msg && msg.text) || "").replace(/^\/\S+\s*/, "").trim();
  const arr = await todoList(env);
  if (!raw) {
    const v = todoView(L, sortTodos(arr), nowS());
    return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  }
  const low = raw.toLowerCase();
  const sub = (low.match(/^([a-z]+)\b/) || [])[1] || "";
  const rest = raw.replace(/^[a-zA-Z]+\s*/, "").trim();

  if (/^(done|check|beres|selesai|kelar)$/.test(sub)) {
    const r = await todoDone(env, rest);
    if (!r.ok) return reply(env, chatId, r.why === "already" ? L.tdAlready(esc(r.text)) : r.why === "many" ? L.tdMany(r.hits.map(t => "#" + t.id + " " + esc(t.text)).join(" · ")) : L.tdGone(esc(rest)));
    return reply(env, chatId, L.tdDoneOk(esc(r.text), r.left) + (r.respawned ? "\n" + L.tdRespawn : ""));
  }
  if (/^(del|delete|rm|hapus|buang)$/.test(sub)) {
    const r = await todoDel(env, rest);
    if (!r.ok) return reply(env, chatId, r.why === "many" ? L.tdMany(r.hits.map(t => "#" + t.id + " " + esc(t.text)).join(" · ")) : L.tdGone(esc(rest)));
    return reply(env, chatId, L.tdDelOk(esc(r.text), r.left));
  }
  if (/^(snooze|nanti|tunda)$/.test(sub)) {
    const parts = rest.split(/\s+/);
    let until = null, used = 0;
    for (let len = Math.min(3, parts.length - 1); len >= 1; len--) {
      const t = parseDue(parts.slice(0, len).join(" "), nowS());
      if (t) { until = t; used = len; break; }
    }
    const who = parts.slice(used).join(" ");
    if (!until) return reply(env, chatId, L.tdSnoozeHow);
    const r = await todoSnooze(env, who, until);
    if (!r.ok) return reply(env, chatId, r.why === "many" ? L.tdMany(r.hits.map(t => "#" + t.id + " " + esc(t.text)).join(" · ")) : L.tdGone(esc(who)));
    return reply(env, chatId, L.tdSnoozeOk(esc(r.text), fmtWIB(r.due, L)));
  }
  if (/^(list|ls|ls)$/.test(sub)) {
    const v = todoView(L, sortTodos(arr), nowS());
    return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  }

  const body = /^(add|tambah|baru)$/.test(sub) ? rest : raw;
  const sp = splitTodoInput(body);
  const r = await todoAdd(env, sp.text, sp.due, sp.rec);
  if (!r.ok) return reply(env, chatId, r.why === "full" ? L.tdFull(r.max) : L.tdUsage);
  return reply(env, chatId, L.tdAddOk(r.id, esc(r.text), r.due ? fmtWIB(r.due, L) : "-") + (r.rec ? "\n" + L.tdRecSet(r.rec) : "") + "\n" + L.tdOpenLeft(r.open));
}

export async function handleTodoCb(env, chatId, mid, arg) {
  const L = await uiLang(env);
  const r = await todoDone(env, arg);
  const arr = sortTodos(await todoList(env));
  const v = todoView(L, arr, nowS());
  if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  if (!r.ok) return r.why === "already" ? L.tdAlready(esc(r.text)) : L.tdGone(String(arg));
  return L.tdDonePop(esc(r.text));
}

export async function todoCron(env, atSec) {
  const sec = atSec || nowS();
  const arr = await todoList(env);
  let changed = false;
  const L = await uiLang(env);
  for (const t of arr) {
    if (t.done || !t.due || t.fired || t.due > sec) continue;
    t.fired = sec;
    changed = true;
    const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
    if (owner) await notify(env, owner, L.tdPing(esc(t.text), t.id));
  }
  if (changed) await putJSON(env, TODO_KEY, arr);
  return changed;
}
