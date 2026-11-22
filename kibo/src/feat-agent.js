
import {
  SLEEP_LOG_KEY, SLEEP_GN_KEY, HABITS_KEY, EXP_KEY, COUNTDOWN_KEY, COUNTDOWN_MAX, COUNTDOWN_NAME_CAP,
} from './consts.js';
import { getJSON, putJSON } from './base.js';
import { fmtWIB } from './ui.js';
import { questDay, XP_PER_LEVEL, journalAdd } from './feat-remind.js';
import { habitCheck, expenseAdd, dayWIB, monWIB, rp } from './feat-life.js';

const nowS = () => Math.floor(Date.now() / 1000);
const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const esc1 = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

export function reminderLine(r, id) {
  const rec = r.rec ? (r.rec.kind === "daily" ? " (every day)" : " (weekly)") : "";
  return "#" + id + " — " + fmtWIB(r.at) + " — " + esc1(r.text) + rec;
}

export function activeReminders(obj) {
  return Object.keys(obj || {})
    .map(k => ({ id: parseInt(k, 10), r: obj[k] }))
    .filter(x => x.r && !x.r.done && typeof x.r.at === "number")
    .sort((a, b) => a.r.at - b.r.at);
}

export async function agentReminders(env, chatId, a) {
  const action = String((a && a.action) || "list").toLowerCase();
  const obj = await getJSON(env, "reminders", {});
  const active = activeReminders(obj);
  const all = () => active.length ? active.map(x => reminderLine(x.r, x.id)).join("\n") : "none";
  if (action !== "del" && action !== "delete" && action !== "cancel") {
    return active.length ? "active reminders (" + active.length + "):\n" + all() : "no active reminders";
  }
  if (!active.length) return "no active reminders — nothing to cancel";
  let hit = null;
  const rawId = String((a && (a.id ?? a.rem_id)) ?? "").replace(/^#/, "").trim();
  if (rawId) hit = active.find(x => String(x.id) === rawId) || null;
  if (!hit && a && a.match) {
    const q = esc1(a.match).toLowerCase();
    const hits = active.filter(x => String(x.r.text).toLowerCase().includes(q));
    if (hits.length > 1) {
      return "several reminders match \"" + esc1(a.match) + "\": " + hits.map(x => "#" + x.id + " \"" + esc1(x.r.text) + "\"").join(", ") + " — call reminders again with the exact id";
    }
    hit = hits[0] || null;
  }
  if (!hit) return "nothing matched, so nothing was cancelled. current list:\n" + all();
  obj[hit.id].done = true;
  await putJSON(env, "reminders", obj);
  return "cancelled reminder #" + hit.id + " (\"" + esc1(hit.r.text) + "\", was " + fmtWIB(hit.r.at) + ") — " + (active.length - 1) + " active left";
}

function daysLeft(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000;
  const today = Date.UTC(+dayWIB(nowS()).slice(0, 4), +dayWIB(nowS()).slice(5, 7) - 1, +dayWIB(nowS()).slice(8, 10)) / 1000;
  return Math.round((target - today) / 86400);
}

export async function agentStatus(env) {
  const [q, xpRaw, remObj, sleepLog, gn, habits, cd, journal, spend] = await Promise.all([
    getJSON(env, "quest", {}),
    getJSON(env, "exp", { xp: 0 }),
    getJSON(env, "reminders", {}),
    getJSON(env, SLEEP_LOG_KEY, []),
    getJSON(env, SLEEP_GN_KEY, null),
    getJSON(env, HABITS_KEY, []),
    getJSON(env, COUNTDOWN_KEY, []),
    getJSON(env, "journal", []),
    getJSON(env, EXP_KEY, []),
  ]);
  const sec = nowS();
  const xp = Math.max(0, Number(xpRaw && xpRaw.xp) || 0);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const out = ["kibo status @ " + fmtWIB(sec)];
  out.push("level " + level + " (xp " + num(xp) + ", " + (xp % XP_PER_LEVEL) + "/" + XP_PER_LEVEL + " to next) · points " + num(q.points));

  const today = questDay(sec);
  const qState = q.day === today ? (q.done ? "done" : q.skipped ? "skipped" : "not done yet") : "not delivered yet today";
  out.push("daily quest " + today + ": " + qState + " · streak " + (q.streak || 0) + (q.shields ? " · shields " + q.shields : ""));

  const sq = await getJSON(env, "squest", {});
  const openSq = ((sq.day || "") === today ? (sq.list || []) : []).filter(x => x && !x.done && !x.skipped);
  if (openSq.length) out.push("side quests open: " + openSq.map(x => esc1(x.text)).join(" | "));

  const active = activeReminders(remObj);
  out.push("reminders: " + (active.length ? active.length + " active, next " + fmtWIB(active[0].r.at) + " \"" + esc1(active[0].r.text) + "\"" : "none active"));

  const sl = (sleepLog || []).filter(e => e && typeof e.h === "number").slice(0, 7);
  if (gn) out.push("sleep: in bed since " + fmtWIB(Number(gn)) + " (session still open, no wake-up logged)");
  else if (sl.length) {
    const avg = Math.round(sl.reduce((s, e) => s + e.h, 0) / sl.length * 10) / 10;
    out.push("sleep: last night " + sl[0].h + "h · " + sl.length + "-night avg " + avg + "h");
  } else out.push("sleep: no nights logged");

  const hs = (habits || []).filter(h => h && h.name);
  if (hs.length) {
    const done = hs.filter(h => h.last_done === today);
    const best = hs.slice().sort((a, b) => (b.streak || 0) - (a.streak || 0))[0];
    out.push("habits: " + done.length + "/" + hs.length + " done today (" + hs.map(h => h.name + (h.last_done === today ? " \u2705" : " \u2b1c")).join(", ") + ") · best streak " + esc1(best.name) + " " + (best.streak || 0));
  } else out.push("habits: none set up");

  const mon = monWIB(sec);
  const rows = (spend || []).filter(e => e && typeof e.amt === "number" && monWIB(Math.floor(e.ts / 1000)) === mon);
  out.push("spending " + mon + ": " + rp(rows.reduce((s, e) => s + e.amt, 0)) + " across " + rows.length + " entries");

  const jr = (journal || []).filter(e => e && e.ts);
  const week = jr.filter(e => Date.now() - e.ts < 7 * 86400000);
  out.push("journal: " + jr.length + " entries total" + (jr.length ? ", " + week.length + " in the last 7 days (latest " + fmtWIB(Math.floor(jr[jr.length - 1].ts / 1000)) + ")" : ""));

  const ups = (cd || []).filter(c => c && c.name && c.day)
    .map(c => ({ c, d: daysLeft(c.day) }))
    .filter(x => x.d !== null)
    .sort((a, b) => a.d - b.d);
  if (ups.length) {
    const next = ups.filter(x => x.d >= 0)[0] || ups[0];
    out.push("countdowns: " + ups.length + " · next " + esc1(next.c.name) + " in " + next.d + " day" + (next.d === 1 ? "" : "s"));
  } else out.push("countdowns: none");

  return out.join("\n");
}

export async function agentJournal(env, a) {
  const action = String((a && a.action) || "read").toLowerCase();
  if (action === "write" || action === "add" || action === "save") {
    const r = await journalAdd(env, a && (a.text || a.body));
    if (!r.ok) return "error: the entry was empty — write something first";
    return "journal entry saved (" + r.n + " total" + (r.moods.length ? ", feelings: " + r.moods.map(m => "#" + m).join(" ") : "") + ")";
  }
  const arr = (await getJSON(env, "journal", [])).filter(e => e && e.text);
  if (!arr.length) return "the journal is empty";
  const want = Math.min(10, Math.max(1, parseInt((a && (a.count || a.n)) || 3, 10) || 3));
  return "last " + Math.min(want, arr.length) + " journal entries (newest last):\n" +
    arr.slice(-want).map(e => "[" + fmtWIB(Math.floor(e.ts / 1000)) + "] " + esc1(e.text) + (e.moods && e.moods.length ? " (" + e.moods.map(m => "#" + m).join(" ") + ")" : "")).join("\n");
}

export async function agentHabits(env, a) {
  const action = String((a && a.action) || "list").toLowerCase();
  if (action === "check" || action === "done" || action === "tick") {
    const who = (a && (a.name || a.id)) || "";
    if (!String(who).trim()) return "error: which habit? pass name (or its id)";
    const r = await habitCheck(env, who);
    if (!r.ok && r.why === "already") return "habit \"" + esc1(r.name) + "\" is already ticked for today (streak " + r.streak + ") — nothing changed";
    if (!r.ok) return "error: no habit matches \"" + esc1(who) + "\"";
    return "habit \"" + esc1(r.name) + "\" ticked for today · streak " + r.streak + " · +" + r.pts + " points" + (r.wkHit ? " (weekly target hit: " + r.wkc + "/" + r.tgt + ")" : "");
  }
  const hs = (await getJSON(env, HABITS_KEY, [])).filter(h => h && h.name);
  if (!hs.length) return "no habits set up yet";
  const today = dayWIB(nowS());
  return "habits (" + hs.filter(h => h.last_done === today).length + "/" + hs.length + " done today):\n" +
    hs.map((h, i) => (i + 1) + ". " + esc1(h.name) + (h.last_done === today ? " \u2705" : " \u2b1c") + " · streak " + (h.streak || 0) + (h.tgt ? " · this week " + Math.min(h.wkc || 0, h.tgt) + "/" + h.tgt : "")).join("\n");
}

export async function agentExpense(env, a) {
  const amt = a && (a.amount ?? a.amt ?? a.value);
  const note = esc1(a && (a.note || a.text || a.for));
  if (amt === undefined || amt === null || String(amt).trim() === "") return "error: how much? pass amount (e.g. 25000 or \"25k\")";
  const r = await expenseAdd(env, amt, note);
  if (!r.ok) return "error: could not read that amount (" + esc1(amt) + ") — pass a plain number like 25000 or 25k";
  return "logged " + rp(r.amt) + (r.note ? " — " + r.note : "") + " · this month " + rp(r.total) + " across " + r.n + " entries";
}

export async function agentCountdown(env, a) {
  const action = String((a && a.action) || "list").toLowerCase();
  const arr = (await getJSON(env, COUNTDOWN_KEY, [])).filter(c => c && c.name && c.day);
  if (action === "list") {
    if (!arr.length) return "no countdowns yet";
    return "countdowns:\n" + arr.map(c => {
      const d = daysLeft(c.day);
      return "#" + c.id + " " + esc1(c.name) + " — " + c.day + (d === null ? "" : d > 0 ? " (in " + d + " days)" : d === 0 ? " (TODAY)" : " (" + -d + " days ago)");
    }).join("\n");
  }
  if (action === "del" || action === "delete" || action === "remove") {
    const id = parseInt(String((a && (a.id ?? a.name)) ?? "").replace(/^#/, ""), 10);
    const i = arr.findIndex(c => c.id === id);
    if (!(i >= 0)) return "error: no countdown with id " + (Number.isFinite(id) ? id : "?");
    const gone = arr.splice(i, 1)[0];
    await putJSON(env, COUNTDOWN_KEY, arr);
    return "countdown \"" + esc1(gone.name) + "\" (#" + gone.id + ") deleted";
  }
  const name = esc1(a && (a.name || a.text));
  const day = String((a && (a.date || a.day || a.when)) || "").trim();
  if (!name) return "error: what is the countdown for? pass name";
  if (daysLeft(day) === null) return "error: pass the date as YYYY-MM-DD (got \"" + day + "\")";
  if (arr.length >= COUNTDOWN_MAX) return "error: countdown list is full (" + COUNTDOWN_MAX + ") — delete one first";
  const id = (arr.reduce((m, c) => Math.max(m, c.id || 0), 0) || 0) + 1;
  arr.push({ id, name: name.slice(0, COUNTDOWN_NAME_CAP), day, created: nowS(), fired: 0 });
  await putJSON(env, COUNTDOWN_KEY, arr);
  const d = daysLeft(day);
  return "countdown \"" + esc1(name.slice(0, COUNTDOWN_NAME_CAP)) + "\" (#" + id + ") set for " + day + (d === 0 ? " — that is today" : " — in " + d + " days");
}
