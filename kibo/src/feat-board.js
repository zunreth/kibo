
import { getJSON, putJSON, reply, esc, tg } from './base.js';
import { uiLang, UI_SEP } from './ui.js';
import {
  WIB, BRIEF_KEY, BRIEF_DEFAULT_H, NOW_KEY, SLEEP_LOG_KEY, SLEEP_GN_KEY,
  HABITS_KEY, EXP_KEY, COUNTDOWN_KEY, FOCUS_LOG_KEY,
} from './consts.js';
import {
  dayWIB, monWIB, rp, expSummary, expBudget, focusState,
} from './feat-life.js';
import { activeReminders, agentSearch } from './feat-agent.js';
import { todoList, sortTodos } from './feat-todo.js';
import { wxNow } from './feat-ctx.js';
import { hnTop } from './feat-b8.js';

const nowS = () => Math.floor(Date.now() / 1000);
const p2 = n => String(n).padStart(2, "0");
const hhmm = sec => { const d = new Date(((sec || 0) + WIB) * 1000); return p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()); };
const trim1 = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

function dayRange(sec) {
  const d = dayWIB(sec);
  const start = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 1000 - WIB;
  return { start, end: start + 86400 };
}
function dateLabel(L, sec) {
  const d = new Date(((sec || nowS()) + WIB) * 1000);
  return L.days[d.getUTCDay()] + ", " + d.getUTCDate() + " " + L.mons[d.getUTCMonth()] + " " + d.getUTCFullYear();
}
function wibMin(sec) {
  const d = new Date(((sec || nowS()) + WIB) * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

async function daySnapshot(env, chatId) {
  const sec = nowS();
  const [remObj, q, habits, sleepLog, gn, expArr, budget, cd, focus, tds] = await Promise.all([
    getJSON(env, "reminders", {}),
    getJSON(env, "quest", {}),
    getJSON(env, HABITS_KEY, []),
    getJSON(env, SLEEP_LOG_KEY, []),
    getJSON(env, SLEEP_GN_KEY, null),
    getJSON(env, EXP_KEY, []),
    expBudget(env),
    getJSON(env, COUNTDOWN_KEY, []),
    focusState(env, sec),
    todoList(env).catch(() => []),
  ]);
  const today = dayWIB(sec);
  const { start, end } = dayRange(sec);
  const active = activeReminders(remObj);
  const openTodos = sortTodos(tds.filter(t => t && !t.done), sec);
  return {
    todos: openTodos,
    tdOpen: openTodos.length,
    tdDue: openTodos.filter(t => t.due && dayWIB(t.due) === today).length,
    tdOver: openTodos.filter(t => t.due && t.due < sec && dayWIB(t.due) !== today).length,
    sec, today, start, end,
    q, focus,
    reminders: active,
    todayReminders: active.filter(x => x.r.at < end),
    sleepLog: (sleepLog || []).filter(e => e && typeof e.h === "number" && typeof e.gm === "number"),
    gn,
    habits: (habits || []).filter(h => h && h.name),
    spend: expSummary(expArr.filter(e => e && typeof e.amt === "number"), monWIB(sec), budget),
    countdowns: (cd || []).filter(c => c && c.name && c.day),
    chatId,
  };
}

function questStateText(L, s) {
  const q = s.q || {};
  const state = q.day === s.today ? (q.done ? L.brQuestDone : q.skipped ? L.brQuestSkip : L.brQuestIdle) : L.brQuestNone;
  return L.brQuestLine(state, q.streak || 0, q.shields || 0);
}

function newsLines(L, hits) {
  if (!hits || !hits.length) return L.brNewsFail;
  return hits.map((h, i) => (i + 1) + ". " + esc(trim1(h.t)) + " · " + h.p + " pts").join("\n");
}

export async function briefText(env, chatId, L) {
  const s = await daySnapshot(env, chatId);
  const [wx, hn] = await Promise.all([wxNow(env).catch(() => null), hnTop(env, 3).catch(() => [])]);
  const out = ["\u{1F305} <b>" + L.brTitle + "</b> " + L.brDash + " " + dateLabel(L, s.sec)];
  if (wx) out.push("\u26C5 <b>" + L.brLblWx + "</b> \u00B7 " + esc(wx.name) + " \u00B7 " + wx.t + "\u00B0C (" + L.brFeels + " " + wx.f + "\u00B0) \u00B7 " + esc(wx.desc) + " \u00B7 " + L.brRain(wx.rain) + " \u00B7 " + wx.hi + "\u00B0/" + wx.lo + "\u00B0");
  if (s.todayReminders.length) {
    out.push("\u23F0 <b>" + L.brLblRem + "</b> (" + s.todayReminders.length + ")\n" + s.todayReminders.slice(0, 5).map(x => "  " + hhmm(x.r.at) + " \u2014 " + esc(trim1(x.r.text))).join("\n"));
  } else out.push("\u23F0 <b>" + L.brLblRem + "</b> \u00B7 " + L.brNoRem);
  out.push("\u{1F3AF} <b>" + L.brLblQuest + "</b> \u00B7 " + questStateText(L, s));
  out.push("\u2705 <b>" + L.brLblTodo + "</b> \u00B7 " + (s.tdOpen
    ? L.brTodoLine(s.tdDue, s.tdOver, s.tdOpen, esc(trim1(s.todos[0].text)))
    : L.brNoTodo));

  const hs = s.habits;
  if (hs.length) {
    const done = hs.filter(h => h.last_done === s.today).length;
    out.push("\u{1F501} <b>" + L.brLblHabit + "</b> " + done + "/" + hs.length + " \u00B7 " + hs.slice(0, 6).map(h => esc(h.name) + (h.last_done === s.today ? " \u2705" : " \u2B1C")).join(", "));
  } else out.push("\u{1F501} <b>" + L.brLblHabit + "</b> \u00B7 " + L.brNoHabit);

  const lastNight = s.sleepLog[0];
  if (s.gn) out.push("\u{1F634} <b>" + L.brLblSleep + "</b> \u00B7 " + L.brSleepOpen(hhmm(Number(s.gn))));
  else if (lastNight) out.push("\u{1F634} <b>" + L.brLblSleep + "</b> \u00B7 " + L.brSleepLast(lastNight.h));
  else out.push("\u{1F634} <b>" + L.brLblSleep + "</b> \u00B7 " + L.brNoSleep);

  out.push("\u{1F4B8} <b>" + L.brLblMoney + "</b> \u00B7 " + (s.spend.rows.length
    ? rp(s.spend.total) + (s.spend.cap ? " / " + rp(s.spend.cap) + " (" + s.spend.pct + "%)" : "") + " \u00B7 " + L.brSpendN(s.spend.rows.length, s.spend.cats[0] ? s.spend.cats[0].cat : "-")
    : L.brNoSpend));

  const up = s.countdowns.map(c => ({ c, d: daysUntil(c.day) })).filter(x => x.d !== null && x.d >= 0).sort((a, b) => a.d - b.d)[0];
  if (up) out.push("\u23F3 <b>" + L.brLblCd + "</b> \u00B7 " + esc(trim1(up.c.name)) + " " + L.brInDays(up.d));

  out.push("\u{1F4F0} <b>" + L.brLblNews + "</b>\n" + newsLines(L, hn));
  return out.join("\n");
}

export async function sendBrief(env, chatId, L, quiet) {
  L = L || await uiLang(env);
  let text;
  try { text = await briefText(env, chatId, L); }
  catch (e) { if (quiet) return; return reply(env, chatId, L.brFail); }
  return reply(env, chatId, text);
}

export async function handleBrief(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = String((msg && msg.text) || "").replace(/^\/\S+\s*/, "").trim().toLowerCase();
  const cfg = await getJSON(env, BRIEF_KEY, null);
  if (!arg) return sendBrief(env, chatId, L);
  if (/^(on|off)$/.test(arg)) {
    const on = arg === "on";
    const cur = Object.assign({ h: BRIEF_DEFAULT_H, m: 0, on: true, day: "" }, cfg || {});
    if (cur.on === on) return reply(env, chatId, on ? L.brOnAlready(p2(cur.h) + ":" + p2(cur.m)) : L.brOffAlready);
    cur.on = on;
    await putJSON(env, BRIEF_KEY, cur);
    return reply(env, chatId, on ? L.brOnSet(p2(cur.h) + ":" + p2(cur.m)) : L.brOffNow);
  }
  const m = arg.match(/^(?:at|jam|pukul)?\s*(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!m) return reply(env, chatId, L.brUsage);
  const h = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0;
  if (!(h >= 0 && h <= 23) || !(mm >= 0 && mm <= 59)) return reply(env, chatId, L.brUsage);
  await putJSON(env, BRIEF_KEY, Object.assign({ on: true, day: "" }, cfg || {}, { h, m: mm, on: true }));
  return reply(env, chatId, L.brSet(p2(h) + ":" + p2(mm)));
}

export async function briefCron(env, nowSec) {
  const cfg = await getJSON(env, BRIEF_KEY, null);
  if (!cfg || !cfg.on) return;
  const sec = nowSec || nowS();
  const today = dayWIB(sec);
  if (cfg.day === today) return;
  const slot = (Number(cfg.h) || 0) * 60 + (Number(cfg.m) || 0);
  const at = wibMin(sec);
  if (at < slot) return;
  if (at > slot + 180) { cfg.day = today; await putJSON(env, BRIEF_KEY, cfg); return; }
  cfg.day = today;
  await putJSON(env, BRIEF_KEY, cfg);
  const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
  if (owner) await sendBrief(env, owner, await uiLang(env), true);
}

export async function nowView(env, chatId) {
  const L = await uiLang(env);
  const s = await daySnapshot(env, chatId);
  const out = ["\u{1F4DF} <b>" + L.nowTitle + "</b> \u00B7 " + hhmm(s.sec) + " WIB"];
  if (s.focus.busy) out.push("\u{1F3AF} <b>" + L.brLblFocus + "</b> \u00B7 " + L.nowFocusRun(Math.ceil(s.focus.left / 60), hhmm(s.focus.st.start + s.focus.st.dur)));
  else out.push("\u{1F3AF} <b>" + L.brLblFocus + "</b> \u00B7 " + L.nowNoFocus);
  out.push("\u{1F3AF} <b>" + L.brLblQuest + "</b> \u00B7 " + questStateText(L, s));
  out.push("\u2705 <b>" + L.brLblTodo + "</b> \u00B7 " + (s.tdOpen
    ? s.tdOpen + " open" + (s.tdDue ? " \u00B7 " + s.tdDue + " due today" : "") + (s.tdOver ? " \u00B7 " + s.tdOver + " overdue" : "") + " \u00B7 " + esc(trim1(s.todos[0].text))
    : L.brNoTodo));
  const next = s.reminders[0];
  out.push("\u23F0 <b>" + L.brLblRem + "</b> \u00B7 " + (next ? hhmm(next.r.at) + " " + esc(trim1(next.r.text)) + (s.reminders.length > 1 ? " " + L.nowMore(s.reminders.length - 1) : "") : L.brNoRem));
  if (s.habits.length) {
    const done = s.habits.filter(h => h.last_done === s.today).length;
    out.push("\u{1F501} <b>" + L.brLblHabit + "</b> \u00B7 " + done + "/" + s.habits.length + " \u00B7 " + s.habits.slice(0, 6).map(h => esc(h.name) + (h.last_done === s.today ? " \u2705" : " \u2B1C")).join(", "));
  }
  const lastNight = s.sleepLog[0];
  if (s.gn) out.push("\u{1F634} <b>" + L.brLblSleep + "</b> \u00B7 " + L.brSleepOpen(hhmm(Number(s.gn))));
  else if (lastNight) out.push("\u{1F634} <b>" + L.brLblSleep + "</b> \u00B7 " + L.brSleepLast(lastNight.h));
  out.push("\u{1F4B8} <b>" + L.brLblMoney + "</b> \u00B7 " + (s.spend.rows.length ? rp(s.spend.total) + (s.spend.cap ? " / " + rp(s.spend.cap) + " (" + s.spend.pct + "%)" : "") : L.brNoSpend));
  const up = s.countdowns.map(c => ({ c, d: daysUntil(c.day) })).filter(x => x.d !== null && x.d >= 0).sort((a, b) => a.d - b.d)[0];
  if (up) out.push("\u23F3 <b>" + L.brLblCd + "</b> \u00B7 " + esc(trim1(up.c.name)) + " " + L.brInDays(up.d));
  out.push("\u2500\u2500\u2500\n" + L.nowUpdated(hhmm(s.sec)));
  return {
    text: out.join("\n"),
    markup: { inline_keyboard: [[
      { text: L.nowRefresh, callback_data: "now:r" },
      { text: L.nowBriefBtn, callback_data: "now:b" },
    ], [{ text: L.home, callback_data: "menu" }]] },
  };
}

export async function handleNow(env, chatId) {
  const v = await nowView(env, chatId);
  const st = await getJSON(env, NOW_KEY, null);
  if (st && String(st.chat) === String(chatId) && st.mid) {
    const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: st.mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    if (j && j.ok) return;
    if (j && String(j.description || "").includes("not modified")) return;
  }
  const j = await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  const mid = j && j.ok && j.result ? j.result.message_id : 0;
  if (mid) await putJSON(env, NOW_KEY, { chat: chatId, mid, ts: Date.now() });
}

function daysUntil(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000;
  const t = dayWIB(nowS());
  const today = Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 1000;
  return Math.round((target - today) / 86400);
}

export async function reportText(env, chatId, L) {
  const s = await daySnapshot(env, chatId);
  const from = s.sec - 7 * 86400;
  const [journal, focusLog, remObj] = await Promise.all([
    getJSON(env, "journal", []),
    getJSON(env, FOCUS_LOG_KEY, []),
    getJSON(env, "reminders", {}),
  ]);
  const out = ["\u{1F4CA} <b>" + L.rptTitle + "</b> \u00B7 " + L.rpRange(dateLabel(L, from), dateLabel(L, s.sec))];

  const nights = s.sleepLog.filter(e => e.gm >= from);
  if (nights.length) {
    const avg = Math.round(nights.reduce((a, b) => a + b.h, 0) / nights.length * 10) / 10;
    const best = Math.max.apply(null, nights.map(e => e.h));
    out.push("\u{1F634} <b>" + L.brLblSleep + "</b> \u00B7 " + L.rpSleep(nights.length, avg, best));
  } else out.push("\u{1F634} <b>" + L.brLblSleep + "</b> \u00B7 " + L.brNoSleep);

  const q = s.q || {};
  out.push("\u{1F3AF} <b>" + L.brLblQuest + "</b> \u00B7 " + questStateText(L, s));

  const hs = s.habits;
  if (hs.length) {
    const wk = hs.map(h => {
      const tgt = h.tgt || 7;
      const done = h.wk === mondayOf(s.sec) ? Math.min(h.wkc || 0, tgt) : (h.last_done && h.last_done >= addDays(s.today, -6) ? 1 : 0);
      return L.rpHabitRow(esc(h.name), done, tgt, h.streak || 0);
    });
    out.push("\u{1F501} <b>" + L.brLblHabit + "</b>\n" + wk.join("\n"));
  }

  const week = s.spend.rows.filter(e => Math.floor(e.ts / 1000) >= from);
  if (week.length) {
    const total = week.reduce((a, b) => a + b.amt, 0);
    const byCat = new Map();
    for (const e of week) { const c = String(e.cat || "other"); byCat.set(c, (byCat.get(c) || 0) + e.amt); }
    const top = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])[0];
    out.push("\u{1F4B8} <b>" + L.brLblMoney + "</b> \u00B7 " + L.rpMoney(rp(total), week.length, top ? top[0] : "-", top ? rp(top[1]) : "-"));
  } else out.push("\u{1F4B8} <b>" + L.brLblMoney + "</b> \u00B7 " + L.brNoSpend);

  const jn = (journal || []).filter(e => e && e.ts && Math.floor(e.ts / 1000) >= from).length;
  out.push("\u{1F4DD} <b>" + L.brLblJournal + "</b> \u00B7 " + (jn ? L.rpJournal(jn) : L.rpNone));

  const fs = (focusLog || []).filter(x => x && x.ts >= from);
  out.push("\u{1F3AF} <b>" + L.brLblFocus + "</b> \u00B7 " + (fs.length ? L.rpFocus(fs.length, fs.reduce((a, b) => a + (b.min || 0), 0)) : L.rpNone));

  const done = Object.keys(remObj || {}).filter(k => { const r = remObj[k]; return r && r.done && typeof r.fired_ts === "number" && r.fired_ts >= from; }).length;
  const active = activeReminders(remObj).length;
  out.push("\u23F0 <b>" + L.brLblRem + "</b> \u00B7 " + L.rpRem(done, active));

  const marks = [];
  if (nights.length) marks.push(Math.min(1, (nights.reduce((a, b) => a + b.h, 0) / nights.length) / 7));
  if (hs.length) marks.push(Math.min(1, hs.reduce((a, h) => a + (h.wk === mondayOf(s.sec) ? Math.min(h.wkc || 0, h.tgt || 7) : 0), 0) / Math.max(1, hs.length * 7) * 3));
  if ((q.streak || 0) > 0) marks.push(Math.min(1, q.streak / 7));
  out.push(UI_SEP.trim());
  if (marks.length < 2) {
    out.push("\u26AA " + L.rpNoData);
    return out.join("\n");
  }
  let score = Math.round(marks.reduce((a, b) => a + b, 0) / marks.length * 100);
  if (s.spend.cap && s.spend.pct > 100) score = Math.max(0, score - 15);
  out.push((score >= 70 ? "\u2705 " : score >= 40 ? "\u{1F7E1} " : "\u{1F534} ") + L.rpVerdict(score));
  return out.join("\n");
}

function mondayOf(sec) {
  const d = dayWIB(sec);
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 1000 - WIB;
  const wd = new Date((t + WIB) * 1000).getUTCDay();
  return dayWIB(t - ((wd + 6) % 7) * 86400);
}
function addDays(day, n) {
  const t = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 1000 + n * 86400;
  return dayWIB(t - WIB);
}

export async function handleSearchAll(env, chatId, q) {
  const L = await uiLang(env);
  let out;
  try { out = await agentSearch(env, chatId, { query: q }); }
  catch (_) { return reply(env, chatId, L.sFail); }
  return reply(env, chatId, L.srchHead(esc(trim1(q))) + "\n" + esc(out));
}

export async function handleReport(env, chatId) {
  const L = await uiLang(env);
  let text;
  try { text = await reportText(env, chatId, L); }
  catch (_) { return reply(env, chatId, L.rpFail); }
  return reply(env, chatId, text);
}
