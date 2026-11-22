
import {
  SLEEP_LOG_KEY, SLEEP_GN_KEY, HABITS_KEY, EXP_KEY, COUNTDOWN_KEY, COUNTDOWN_MAX, COUNTDOWN_NAME_CAP,
  HABIT_MAX, HABIT_PLAN_KEY, MEM_KEY, CMEM_PREFIX, FILE_INDEX_KEY, READLIST_KEY, WX_LOC_KEY, WX_CTX_KEY,
  SLEEP_CAP_H, SHIELD_MAX, SHIELD_PRICE,
} from './consts.js';
import { getJSON, putJSON } from './base.js';
import { fmtWIB, UI } from './ui.js';
import { questDay, XP_PER_LEVEL, journalAdd, shieldBuy, questReroll, REROLL_LIMIT } from './feat-remind.js';
import {
  habitCheck, expenseAdd, dayWIB, monWIB, rp, wkOf, sleepMark, focusStart, focusEnd, focusState,
  expSummary, expBudget, capsuleItems, capsulePending, capsuleAdd, capsuleDel,
} from './feat-life.js';
import { rlItems, rlAddCore, rlSetDone, rlRemove, shorten, hnTop } from './feat-b8.js';
import { getActiveCard } from './feat-chars.js';
import { geocode, wxLine } from './feat-ctx.js';
import { doctorChecks, doctorLine, doctorLang, BAD, UNKNOWN } from './feat-doctor.js';

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
  if (action === "add" || action === "new") {
    const name = esc1(a && (a.name || a.text)).slice(0, 30);
    if (!name) return "error: what should the habit be called? pass name";
    const tgt = parseInt((a && (a.target || a.tgt)) || 0, 10) || 0;
    if (tgt && (tgt < 1 || tgt > 7)) return "error: a weekly target must be 1-7 days";
    const arr = (await getJSON(env, HABITS_KEY, [])).filter(h => h && h.name);
    if (arr.length >= HABIT_MAX) return "error: the habit list is full (" + HABIT_MAX + ") — delete one first";
    if (arr.some(h => h.name.toLowerCase() === name.toLowerCase())) return "error: a habit with that name already exists";
    const h = Object.assign({ id: (arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1), name, streak: 0, last_done: "" });
    if (tgt) Object.assign(h, { tgt, wk: wkOf(nowS()), wkc: 0 });
    arr.push(h);
    await putJSON(env, HABITS_KEY, arr);
    return "habit \"" + name + "\" (#" + h.id + ") added" + (tgt ? " with a weekly target of " + tgt + " days" : " — daily") + " · " + arr.length + " habits total";
  }
  if (action === "del" || action === "delete" || action === "remove") {
    const who = esc1(a && (a.name || a.id || a.text)).toLowerCase();
    if (!who) return "error: which habit? pass name (or its id)";
    const arr = (await getJSON(env, HABITS_KEY, [])).filter(h => h && h.name);
    const hits = arr.filter(h => String(h.id) === who || h.name.toLowerCase() === who)
      .concat(arr.filter(h => h.name.toLowerCase().includes(who) && !(String(h.id) === who || h.name.toLowerCase() === who)));
    if (!hits.length) return "error: no habit matches \"" + who + "\"";
    if (hits.length > 1) return "several habits match \"" + who + "\": " + hits.map(h => "#" + h.id + " " + h.name).join(", ") + " — call again with the exact name or id";
    const gone = hits[0];
    await putJSON(env, HABITS_KEY, arr.filter(h => h.id !== gone.id));
    const plan = await getJSON(env, HABIT_PLAN_KEY, null);
    if (plan && Array.isArray(plan.habits)) {
      let ch = false;
      for (const hp of plan.habits) if (hp.hid === gone.id) { hp.hid = -1; ch = true; }
      if (ch) await putJSON(env, HABIT_PLAN_KEY, plan);
    }
    return "habit \"" + esc1(gone.name) + "\" (#" + gone.id + ") deleted — " + (arr.length - 1) + " left";
  }
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
  if (/^(summary|list|read|stats|report)$/i.test(String((a && a.action) || ""))) {
    const mon = monWIB(nowS());
    const arr = (await getJSON(env, EXP_KEY, [])).filter(e => e && typeof e.amt === "number");
    const sum = expSummary(arr, mon, await expBudget(env));
    if (!sum.rows.length) return "no spending logged in " + mon + " yet";
    const lines = ["spending " + mon + ": " + rp(sum.total) + " across " + sum.rows.length + " entries"];
    for (const c of sum.cats) lines.push("· " + c.cat + ": " + rp(c.amt) + " (" + c.n + " entries, " + Math.round(c.amt / sum.total * 100) + "%)" + (sum.catCaps[c.cat] ? " of " + rp(sum.catCaps[c.cat]) : ""));
    if (sum.cap) lines.push("monthly budget " + rp(sum.cap) + " — " + (sum.left >= 0 ? rp(sum.left) + " left (" + sum.pct + "% used)" : "over by " + rp(-sum.left)));
    const big = sum.rows.slice().sort((x, y) => y.amt - x.amt)[0];
    if (big) lines.push("biggest: " + rp(big.amt) + " — " + esc1(big.note || "-"));
    return lines.join("\n");
  }
  if (amt === undefined || amt === null || String(amt).trim() === "") return "error: how much? pass amount (e.g. 25000 or \"25k\")";
  const r = await expenseAdd(env, amt, note);
  if (!r.ok) return "error: could not read that amount (" + esc1(amt) + ") — pass a plain number like 25000 or 25k";
  return "logged " + rp(r.amt) + (r.note ? " — " + r.note : "") + (r.cat && r.cat !== "other" ? " [" + r.cat + "]" : "") +
    " · this month " + rp(r.total) + " across " + r.n + " entries" + (r.cap ? " (" + (r.left >= 0 ? rp(r.left) + " left of " + rp(r.cap) : "over budget by " + rp(-r.left)) + ")" : "");
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

export async function agentSleep(env, a) {
  const action = String((a && (a.action || a.what)) || "stats").toLowerCase();
  const bed = /^(bed|gn|sleep|goodnight|tidur)$/.test(action);
  const wake = /^(wake|gm|morning|bangun)$/.test(action);
  if (bed || wake) {
    const r = await sleepMark(env, bed ? "gn" : "gm");
    if (!r.ok) return "error: no bedtime was logged, so there is nothing to wake up from — log the bed time first (action=bed)";
    if (r.action === "bed") return "bedtime logged at " + fmtWIB(r.at) + " — sleep well";
    return "wake-up logged: slept " + r.h + "h (bed " + fmtWIB(r.bed) + ")";
  }
  const [log, gn] = await Promise.all([getJSON(env, SLEEP_LOG_KEY, []), getJSON(env, SLEEP_GN_KEY, null)]);
  const sl = (log || []).filter(e => e && typeof e.h === "number").slice(0, 7);
  if (!sl.length && !gn) return "no sleep logged yet — the user can say 'goodnight' / 'morning' and I log it";
  const avg = sl.length ? Math.round(sl.reduce((s, e) => s + e.h, 0) / sl.length * 10) / 10 : 0;
  return (gn ? "session open since " + fmtWIB(Number(gn)) + " (no wake-up yet)\n" : "") +
    (sl.length ? sl.map(e => fmtWIB(e.gm) + " — " + e.h + "h").join("\n") + "\n" + sl.length + "-night average: " + avg + "h" : "no finished nights yet");
}

export async function agentFocus(env, a) {
  const action = String((a && a.action) || "status").toLowerCase();
  if (/^(start|begin|go)$/.test(action)) {
    const min = a && (a.minutes || a.min || a.n);
    const r = await focusStart(env, min);
    if (!r.ok && r.why === "range") return "error: a focus session must be " + r.min + "-" + r.max + " minutes";
    if (!r.ok) return "error: a " + r.min + "-minute session is still running (" + r.left + " min left) — finish or stop it first";
    return "focus session started: " + r.min + " min, ends " + fmtWIB(r.endsAt) + " — the bot is on do-not-disturb until then";
  }
  if (/^(done|finish|claim|stop|abort|end)$/.test(action)) {
    const how = /^(stop|abort|end)$/.test(action) ? "stop" : "done";
    const r = await focusEnd(env, how);
    if (!r.ok) return "error: no focus session is open";
    if (r.outcome === "claim") return "focus session finished and claimed: +" + r.pts + " points (wallet " + r.wallet + ")";
    if (r.outcome === "abort") return "focus session ended early (" + r.min + " min) — no points";
    return "focus session was over and its claim window had already passed — no points";
  }
  const { busy, st, left } = await focusState(env);
  if (!busy) return "no focus session running";
  return "focus running: " + Math.round(st.dur / 60) + " min total, " + Math.ceil(left / 60) + " min left (ends " + fmtWIB(st.start + st.dur) + ")";
}

export async function agentWeather(env, a) {
  const place = esc1(a && (a.place || a.city || a.q || a.location));
  if (place) {
    let g = null;
    try { g = await geocode(env, place); } catch (_) {}
    if (!g) return "error: could not find a place called \"" + place + "\"";
    try { await putJSON(env, WX_LOC_KEY, { lat: g.lat, lon: g.lon, name: g.name }); } catch (_) {}
    try { await putJSON(env, WX_CTX_KEY, { v: null, exp: 0 }); } catch (_) {}
  }
  const line = await wxLine(env);
  return line || "error: no weather location set yet — pass a place once and the bot remembers it";
}

export async function agentSearch(env, chatId, a) {
  const q = esc1(a && (a.query || a.q)).toLowerCase();
  if (!q) return "error: what should I search for?";
  const card = await getActiveCard(env).catch(() => null);
  const [mems, files, journal, remObj, cd, rl, caps] = await Promise.all([
    getJSON(env, card ? CMEM_PREFIX + card.id : MEM_KEY, []),
    getJSON(env, FILE_INDEX_KEY, []),
    getJSON(env, "journal", []),
    getJSON(env, "reminders", {}),
    getJSON(env, COUNTDOWN_KEY, []),
    getJSON(env, READLIST_KEY + (chatId || 0), { list: [] }),
    capsuleItems(env).catch(() => []),
  ]);
  const hit = s => String(s == null ? "" : s).toLowerCase().includes(q);
  const out = [];
  for (const m of (mems || [])) if (m && hit(m.text)) out.push("memory #" + m.id + ": " + esc1(m.text).slice(0, 180));
  for (const f of (files || [])) if (f && (hit(f.name) || hit(f.text))) out.push("saved \"" + esc1(f.name) + "\" (" + (f.kind || "file") + "): " + esc1(f.text || "").slice(0, 160));
  for (const e of (journal || [])) if (e && hit(e.text)) out.push("journal " + fmtWIB(Math.floor(e.ts / 1000)) + ": " + esc1(e.text).slice(0, 160));
  for (const k of Object.keys(remObj || {})) { const r = remObj[k]; if (r && !r.done && hit(r.text)) out.push("reminder #" + k + " (" + fmtWIB(r.at) + "): " + esc1(r.text)); }
  for (const c of (cd || [])) if (c && hit(c.name)) out.push("countdown #" + c.id + ": " + esc1(c.name) + " — " + c.day);
  for (const i of ((rl && rl.list) || [])) if (i && hit(i.title)) out.push("reading list: " + esc1(i.title) + (i.done ? " (done)" : ""));
  for (const c of (caps || [])) if (c && !c.fired && (hit(c.text) || hit(fmtWIB(c.due)))) out.push("time capsule (opens " + fmtWIB(c.due) + "): " + esc1(c.text).slice(0, 160));
  if (!out.length) return "nothing found for \"" + q + "\" in memories, saved notes, journal, reminders, countdowns, the reading list or the time capsules";
  const shown = out.slice(0, 12);
  return "found " + out.length + " hit(s) for \"" + q + "\":\n" + shown.join("\n") + (out.length > shown.length ? "\n… and " + (out.length - shown.length) + " more" : "");
}

export async function agentDoctor(env) {
  const L = await doctorLang(env);
  const checks = await doctorChecks(env);
  const bad = checks.filter(c => c.state === BAD);
  const unk = checks.filter(c => c.state === UNKNOWN);
  return "kibo self check:\n" + checks.map(c => doctorLine(L, c)).join("\n") +
    "\nverdict: " + (bad.length ? bad.length + " problem(s) — " + bad.map(c => c.k).join(", ") : "all good") + (unk.length ? " (" + unk.length + " unknown)" : "");
}


export async function agentReadingList(env, chatId, a) {
  const action = String((a && a.action) || "list").toLowerCase();
  const cid = chatId || 0;
  const items = (await rlItems(env, cid)).filter(x => x && x.title);
  const line = x => "\u2022 #" + x.id + " " + esc1(x.title) + (x.done ? " (read)" : "");
  if (action === "add" || action === "new") {
    const t = esc1(a && (a.title || a.text || a.name));
    if (!t) return "error: what should be added? pass title";
    const r = await rlAddCore(env, cid, t);
    if (!r.ok) return r.why === "full" ? "error: the reading list is full (" + r.max + ") — remove something first" : "error: the title is empty";
    return "added to the reading list: \"" + r.title + "\" (#" + r.id + ", " + r.n + " items)";
  }
  if (!items.length) return "the reading list is empty";
  if (action !== "list") {
    const q = esc1(a && (a.id ?? a.title ?? a.name)).toLowerCase().replace(/^#/, "");
    if (!q) return "error: which item? pass id or title";
    let hit = items.find(x => String(x.id) === q) || items.find(x => x.title.toLowerCase() === q);
    if (!hit) {
      const hits = items.filter(x => x.title.toLowerCase().includes(q));
      if (hits.length > 1) return "several items match \"" + q + "\": " + hits.map(line).join(" | ") + " — call again with the exact id";
      hit = hits[0];
    }
    if (!hit) return "error: nothing in the reading list matches \"" + q + "\"";
    if (action === "del" || action === "delete" || action === "remove") {
      await rlRemove(env, cid, hit.id);
      return "removed \"" + esc1(hit.title) + "\" from the reading list (" + (items.length - 1) + " left)";
    }
    const want = action === "done" || action === "read" || action === "finish";
    const nx = await rlSetDone(env, cid, hit.id, want);
    return "\"" + esc1(hit.title) + "\" marked " + (want ? "read" : "unread") + " · " + items.filter(x => (x.id === hit.id ? want : !!x.done)).length + "/" + items.length + " read";
  }
  const done = items.filter(x => x.done).length;
  return "reading list (" + done + "/" + items.length + " read):\n" + items.map(line).join("\n");
}

export async function agentCapsule(env, a) {
  const action = String((a && a.action) || "list").toLowerCase();
  if (action === "add" || action === "new" || action === "seal" || action === "write") {
    const text = esc1(a && (a.text || a.body || a.content || a.letter));
    const when = esc1(a && (a.when || a.after || a.delay || a.in));
    if (!text) return "error: what should the letter say? pass text";
    if (!when) return "error: when should it open? pass when (e.g. \"2h\", \"30m\", \"besok 09:00\")";
    const r = await capsuleAdd(env, when + " " + text);
    if (!r.ok) {
      if (r.why === "soon") return "error: a capsule has to open at least " + r.min + " minutes from now";
      if (r.why === "full") return "error: too many pending capsules (" + r.max + ") — delete one first";
      if (r.why === "bad") return "error: could not read the time \"" + when + "\" — examples: 2h, 30m, 3d, besok 09:00";
      return "error: the letter is empty";
    }
    return "time capsule sealed — it opens " + fmtWIB(r.due) + " (\"" + esc1(r.text).slice(0, 60) + "\")";
  }
  if (action !== "list") {
    const n = parseInt(esc1(a && (a.id ?? a.n ?? a.index)).replace(/^#/, ""), 10);
    const r = await capsuleDel(env, n);
    if (!r.ok) return "error: there is no pending capsule number " + (Number.isFinite(n) ? n : "?") + " — call capsule action=list to see the numbering";
    return "capsule deleted (\"" + esc1(r.text).slice(0, 60) + "\")";
  }
  const pend = capsulePending(await capsuleItems(env));
  if (!pend.length) return "no sealed capsules waiting";
  return "sealed capsules (" + pend.length + "):\n" + pend.map((c, i) => (i + 1) + ". opens " + fmtWIB(c.due) + " — " + esc1(c.text).slice(0, 80)).join("\n");
}

export async function agentHeadlines(env, a) {
  const n = Math.min(10, Math.max(1, parseInt((a && (a.count || a.n)) || 5, 10) || 5));
  const hits = await hnTop(env, n);
  if (!hits.length) return "error: the HN front page could not be fetched right now — say so plainly, do not invent headlines";
  return "hacker news front page (verified, " + hits.length + "):\n" +
    hits.map((h, i) => (i + 1) + ". " + esc1(h.t) + " — " + h.p + " pts, " + h.c + " comments — " + h.u).join("\n");
}

export async function agentShorten(env, a) {
  const url = esc1(a && (a.url || a.link));
  if (!url) return "error: which URL? pass url";
  const r = await shorten(env, url);
  if (r.ok) return "short link: " + r.short + " → " + r.url;
  if (r.why === "bad") return "error: that does not look like an http(s) link (max " + r.max + " characters)";
  if (r.why === "nohost") return "error: no short-link host is configured, so links cannot be shortened";
  return "error: url is empty";
}

export async function agentQuest(env, chatId, a) {
  const action = String((a && a.action) || "status").toLowerCase();
  const cid = chatId || parseInt((await env.KV.get("owner_chat")) || "0", 10);
  const q = await getJSON(env, "quest", {});
  if (/^(shield|buy|buy_shield)$/.test(action)) {
    const r = await shieldBuy(env);
    if (r.ok) return "shield bought: " + r.shields + "/" + SHIELD_MAX + " held, " + r.points + " points left (-" + r.price + ")";
    if (r.why === "max") return "error: shields are already full (" + r.max + ") — no point buying another";
    return "error: not enough points for a shield (" + r.price + " needed, " + r.points + " left) — say so, do not promise one";
  }
  if (action === "reroll" || action === "swap") {
    const r = await questReroll(env, cid, true);
    if (r === "ok") return "daily quest rerolled — the new one has been posted to the user";
    if (r === "limit") return "error: the reroll limit for today (" + REROLL_LIMIT + ") is used up";
    return "error: too fast — a reroll was just requested; wait a moment";
  }
  const shields = q.shields || 0;
  return "quest housekeeping:\nshields " + shields + "/" + SHIELD_MAX + " (cost " + SHIELD_PRICE + " points) · points " + num(q.points) +
    " · streak " + (q.streak || 0) + "\nbuy one with the quest tool (action=shield), reroll today's quest with action=reroll";
}
