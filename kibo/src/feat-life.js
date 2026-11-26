import {
  WIB,
  FOCUS_KEY, SLEEP_GN_KEY, SLEEP_LOG_KEY, HABITS_KEY, EXP_KEY, CAPSULE_KEY,
  SLEEP_WEEK_KEY, EXP_MONTH_KEY,
  COUNTDOWN_KEY, COUNTDOWN_MAX, COUNTDOWN_NAME_CAP,
  RESURFACE_KEY, RESURFACE_MIN_AGE_DAYS, RESURFACE_EVERY,
  AMA_KEY, AMA_GAP_MS, AMA_Q_CAP,
  ALARM_KEY, ALARM_DEF_H, REACTD_KEY, REACT_PROB, REACT_DAILY_CAP,
  CHAR_ACTIVE_KEY, REL_PREFIX,
  FOCUS_MIN, FOCUS_MAX, FOCUS_PTS, FOCUS_GRACE,
  SLEEP_CAP_H, SLEEP_LOG_MAX, HABIT_MAX, HABIT_PTS, EXP_MAX, EXP_NOTE_CAP,
  HABIT_WEEK_PTS, HABIT_MS, HABIT_WK_MS, LIFE_NOTE_KEY, LIFE_NOTE_MAX,
  HABIT_PLAN_KEY, HABIT_PLAN_HABITS_MAX,
  CAPSULE_PEND_MAX, CAPSULE_ARCH_MAX, CAPSULE_TEXT_CAP, CAPSULE_MIN_GAP,
  EXP_BUDGET_KEY, EXP_CAT_DEFAULT, EXP_CAT_CAP, FOCUS_LOG_KEY, FOCUS_LOG_MAX,
} from './consts.js';
import { getJSON, putJSON, reply, notify, esc, mdTg, tg, delCmd } from './base.js';
import { softWrite } from './kv.js';
import { mutateJSON, mutateWith } from './once.js';
import { uiLang, fmtWIB, UI_SEP } from './ui.js';
import { addPts, parseRemind, remindMsg } from './feat-remind.js';
import { getActiveCard } from './feat-chars.js';
import { chatStream } from './feat-personal.js';
import { stripThink } from './ai.js';
import { parseAmount, fmtMoney, curOf, sumByCur, loadMainCur, mainCur, normCur, roundMoney, curToken, isCur, setMainCur, MAIN_CUR_KEY, CURS, CUR_CODES } from './money.js';

const nowS = () => Math.floor(Date.now() / 1000);
const dayWIB = sec => { const d = new Date(((sec || nowS()) + WIB) * 1000); const p = n => String(n).padStart(2, "0"); return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()); };
const monWIB = sec => dayWIB(sec).slice(0, 7);
const dowWIB = sec => new Date(((sec || nowS()) + WIB) * 1000).getUTCDay();
const wkOf = sec => { const t = (sec || nowS()) + WIB; const d = new Date(t * 1000); const mon = new Date((t - ((d.getUTCDay() + 6) % 7) * 86400) * 1000); const p = n => String(n).padStart(2, "0"); return mon.getUTCFullYear() + "-" + p(mon.getUTCMonth() + 1) + "-" + p(mon.getUTCDate()); };
const rp = (n, cur) => fmtMoney(n, cur || mainCur());

async function lifeMsg(env, event, hint) {
  try { return await remindMsg(env, 0, event, 0, "life:" + hint); } catch (_) { return ""; }
}
const reactTail = (env, chatId, ai) => ai ? reply(env, chatId, "\u{1F4AC} " + mdTg(esc(ai))) : Promise.resolve();

export async function lifeNote(env, text) {
  await softWrite(env, "lifeNote", async () => {
    const arr = (await getJSON(env, LIFE_NOTE_KEY, [])).filter(n => n && n.t);
    arr.push({ t: String(text).slice(0, 200), ts: nowS() });
    while (arr.length > LIFE_NOTE_MAX) arr.shift();
    await putJSON(env, LIFE_NOTE_KEY, arr);
  });
}

function parseDur(raw) {
  const m = String(raw || "").match(/^(\d{1,4})\s*(m|menit|min|j|jam|h)?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return /^(j|jam|h)/.test(m[2] || "") ? n * 60 : n;
}
export async function focusState(env, atSec) {
  const sec = atSec || nowS();
  const st = await getJSON(env, FOCUS_KEY, null);
  const busy = !!(st && !st.settled && sec < st.start + st.dur);
  return { sec, st, busy, left: busy ? st.start + st.dur - sec : 0 };
}

export async function focusStart(env, minutes) {
  const n = Math.round(Number(minutes));
  if (!isFinite(n) || n < FOCUS_MIN || n > FOCUS_MAX) return { ok: false, why: "range", min: FOCUS_MIN, max: FOCUS_MAX };
  const { sec, busy, st } = await focusState(env);
  if (busy) return { ok: false, why: "busy", min: Math.round(st.dur / 60), left: Math.round((st.start + st.dur - sec) / 60) };
  await putJSON(env, FOCUS_KEY, { start: sec, dur: n * 60, settled: false });
  return { ok: true, min: n, endsAt: sec + n * 60 };
}

export async function focusEnd(env, how) {
  const { sec, st } = await focusState(env);
  if (!st || st.settled) return { ok: false, why: "gone" };
  const end = st.start + st.dur;
  await putJSON(env, FOCUS_KEY, Object.assign({}, st, { settled: true }));
  const min = Math.round(st.dur / 60);
  if (how === "done" && sec >= end && sec <= end + FOCUS_GRACE) {
    await softWrite(env, "focusLog", async () => {
      const log = (await getJSON(env, FOCUS_LOG_KEY, [])).filter(x => x && x.ts);
      log.unshift({ ts: sec, min });
      while (log.length > FOCUS_LOG_MAX) log.pop();
      await putJSON(env, FOCUS_LOG_KEY, log);
    });
    await addPts(env, FOCUS_PTS);
    const wallet = ((await getJSON(env, "quest", {})).points) || 0;
    return { ok: true, outcome: "claim", min, pts: FOCUS_PTS, wallet };
  }
  if (how === "stop" || sec < end) return { ok: true, outcome: "abort", min };
  return { ok: true, outcome: "late", min };
}

export async function handleFocus(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim().toLowerCase();
  if (raw === "done" || raw === "stop") {
    const r = await focusEnd(env, raw);
    if (!r.ok) return reply(env, chatId, L.fGone);
    if (r.outcome === "claim") {
      await reply(env, chatId, L.fClaimOk(r.pts, r.wallet));
      return reactTail(env, chatId, await lifeMsg(env, "the user just completed a " + r.min + "-minute focus session (+" + r.pts + " points)", "the user finished a focus session: praise them briefly and warmly, one line."));
    }
    if (r.outcome === "abort") {
      await reply(env, chatId, L.fAbort);
      return reactTail(env, chatId, await lifeMsg(env, "the user aborted their " + r.min + "-minute focus session early", "the user gave up on the focus session: mild loving disappointment (no hard scolding), one line."));
    }
    return reply(env, chatId, L.fKabur);
  }
  if (!raw) {
    const { busy, st, left } = await focusState(env);
    if (busy) return reply(env, chatId, L.fHead + "\n" + L.fRun(Math.round(st.dur / 60), left) + "\n" + L.fHow);
    return reply(env, chatId, L.fHead + "\n" + L.fIdle + "\n" + L.fHow);
  }
  const n = parseDur(raw);
  if (n === null || n < FOCUS_MIN || n > FOCUS_MAX) return reply(env, chatId, L.fRange(FOCUS_MIN, FOCUS_MAX));
  const r = await focusStart(env, n);
  if (!r.ok) return reply(env, chatId, L.fRun(r.min, r.left * 60) + "\n" + L.fHow);
  await reply(env, chatId, L.fSet(n));
}

async function focusCron(env, nowSec) {
  const st = await getJSON(env, FOCUS_KEY, null);
  if (!st || st.settled || nowSec <= st.start + st.dur + FOCUS_GRACE) return;
  await putJSON(env, FOCUS_KEY, Object.assign({}, st, { settled: true }));
  const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
  if (!owner) return;
  const L = await uiLang(env);
  await reply(env, owner, L.fKabur);
  return reactTail(env, owner, await lifeMsg(env, "the user let their focus session expire without claiming it", "the focus session expired unclaimed: gentle tease, no guilt-trip, one line."));
}

export async function focusIntercept(env, chatId, cmd, text, mid) {
  if (cmd === "/focus") return false;
  const sec = nowS();
  const st = await getJSON(env, FOCUS_KEY, null);
  if (!st || st.settled || sec >= st.start + st.dur) return false;
  await putJSON(env, FOCUS_KEY, Object.assign({}, st, { settled: true, voided: sec }));
  const L = await uiLang(env);
  if (cmd && cmd.startsWith("/") && mid) { try { await delCmd(env, chatId, mid); } catch (_) {} }
  const what = cmd ? "running the command " + cmd : (text ? 'chatting with you: "' + String(text).slice(0, 80) + '"' : "sending media");
  await reply(env, chatId, L.fCaught(Math.max(1, Math.ceil((st.start + st.dur - sec) / 60))));
  await reactTail(env, chatId, await lifeMsg(env, "the user got caught " + what + " just " + Math.max(1, Math.round((sec - st.start) / 60)) + " minutes into their " + Math.round(st.dur / 60) + "-minute focus session — the session is voided", "the user got caught cheating on their focus session by using the bot: call it out playfully like they just failed focus, one line."));
  return true;
}

export async function sleepMark(env, what) {
  const sec = nowS();
  if (what === "gn") {
    await putJSON(env, SLEEP_GN_KEY, sec);
    return { ok: true, action: "bed", at: sec };
  }
  const gn = await getJSON(env, SLEEP_GN_KEY, null);
  if (!gn) return { ok: false, why: "no-bed" };
  const h = Math.min(SLEEP_CAP_H, Math.round(((sec - gn) / 36) / 10) / 10);
  const log = (await getJSON(env, SLEEP_LOG_KEY, [])).filter(x => x && typeof x.gm === "number");
  log.unshift({ gn, gm: sec, h });
  while (log.length > SLEEP_LOG_MAX) log.pop();
  await putJSON(env, SLEEP_LOG_KEY, log);
  await env.KV.delete(SLEEP_GN_KEY);
  return { ok: true, action: "wake", h, bed: gn, woke: sec };
}

export async function handleSleep(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim().toLowerCase();
  if (raw === "gn") {
    const r = await sleepMark(env, "gn");
    return notify(env, chatId, L.sGnSet(fmtWIB(r.at, L)));
  }
  if (raw === "gm") {
    const r = await sleepMark(env, "gm");
    if (!r.ok) return reply(env, chatId, L.sGmNo);
    await reply(env, chatId, L.sGmOk(r.h));
    return reactTail(env, chatId, await lifeMsg(env, "the user just woke up; last night " + r.h + " hours (now in the sleep log)", r.h < 6 ? "the user slept under 6 hours: gently worry / tease about their sleep, one line." : "the user slept enough: greet them warmly, one line."));
  }
  const log = (await getJSON(env, SLEEP_LOG_KEY, [])).filter(x => x && typeof x.gm === "number").slice(0, 7);
  const gn = await getJSON(env, SLEEP_GN_KEY, null);
  const avg = log.length ? Math.round(log.reduce((a, b) => a + (b.h || 0), 0) / log.length * 10) / 10 : 0;
  const rows = log.map(e => "\u2022 " + fmtWIB(e.gm, L).replace(/ \d{2}:\d{2} WIB$/, "") + ": " + e.h + "h").join("\n");
  return reply(env, chatId, L.sHead + "\n" + (gn ? L.sOpen(fmtWIB(gn, L)) + "\n" : "") + (rows ? rows + "\n" + L.sAvg(avg, log.length) : L.sEmpty) + "\n" + L.sHow);
}

function habitsResetPure(arr, today, yesterday, wkNow) {
  let ch = false;
  const wk = wkNow || wkOf();
  for (const h of arr) {
    if (h.tgt) {
      if (h.wk !== wk) { if ((h.wkc || 0) < h.tgt && h.streak > 0) h.streak = 0; h.wk = wk; h.wkc = 0; ch = true; }
    } else if (h.last_done && h.last_done !== today && h.last_done < yesterday && h.streak > 0) { h.streak = 0; ch = true; }
  }
  return ch;
}
export async function habitView(env) {
  const L = await uiLang(env);
  const sec = nowS();
  const today = dayWIB(sec), yesterday = dayWIB(sec - 86400);
  const got = await mutateWith(env, HABITS_KEY, [], cur => {
    const a = cur.filter(h => h && h.name);
    habitsResetPure(a, today, yesterday, wkOf(sec));
    return { val: a, okNow: () => true };
  });
  const arr = (got && got.val) || [];
  const plan = await getJSON(env, HABIT_PLAN_KEY, null);
  try { if (plan) await planNudgeMaybe(env, plan); } catch (_) {}
  const rows = arr.map((h, i) => (i + 1) + ". " + esc(h.name) + " " + (h.last_done === today ? "\u2705" : "\u2b1c") + (h.tgt ? " " + L.hWkProg(Math.min(h.wkc || 0, h.tgt), h.tgt) : "") + " \u{1F525}" + (h.streak || 0) + (h.tgt ? "w" : "")).join("\n");
  const kb = { inline_keyboard: arr.map(h => [{ text: (h.last_done === today ? "\u2705 " : "") + h.name.slice(0, 20), callback_data: "habit:" + h.id }]).concat([[{ text: L.home, callback_data: "menu" }]]) };
  return { text: L.hHead + UI_SEP + (rows || L.hEmpty) + "\n" + L.hHow, markup: kb };
}
export async function handleHabit(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!raw) { const v = await habitView(env); return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  const sub = raw.split(/\s+/)[0].toLowerCase();
  if (sub === "plan") return handleHabitPlan(env, msg, chatId);
  if (sub === "add") {
    let rest = raw.slice(raw.indexOf(" ") + 1).trim();
    let tgt = 0;
    const mt = rest.match(/\s(\d)\s*$/);
    if (mt) { tgt = parseInt(mt[1], 10); rest = rest.slice(0, mt.index).trim(); }
    const name = rest.slice(0, 30);
    if (/^\d$/.test(rest)) return reply(env, chatId, L.hAddUsage);
    if (!name || raw.toLowerCase().trim() === "add") return reply(env, chatId, L.hAddUsage);
    if (tgt && (tgt < 1 || tgt > 7)) return reply(env, chatId, L.hTgtRange);
    const got = await mutateWith(env, HABITS_KEY, [], cur => {
      const a = cur.filter(h => h && h.name);
      if (a.length >= HABIT_MAX) return { val: a, okNow: false, full: true };
      a.push(Object.assign({ id: (a.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1), name, streak: 0, last_done: "" }, tgt ? { tgt, wk: wkOf(nowS()), wkc: 0 } : {}));
      return { val: a, okNow: back => back.some(h => h && h.name === name) };
    });
    if (!got || got.full) return reply(env, chatId, L.hFull(HABIT_MAX));
    return notify(env, chatId, tgt ? L.hAddOkW(esc(name), tgt) : L.hAddOk(esc(name)));
  }
  if (sub === "del") {
    const toks = raw.slice(3).trim().split(/[\s,]+/).filter(Boolean);
    if (!toks.length) return reply(env, chatId, L.hDelUsage);
    const got = await mutateWith(env, HABITS_KEY, [], cur => {
      const a = cur.filter(h => h && h.name);
      const want = new Set();
      let tried = 0, miss = 0;
      for (const tk of toks) {
        const m = tk.match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
        if (!m) continue;
        tried++;
        const x = parseInt(m[1], 10), y = m[2] ? parseInt(m[2], 10) : x;
        let hit = false;
        for (let i = Math.min(x, y); i <= Math.max(x, y); i++) if (i >= 1 && i <= a.length) { want.add(i); hit = true; }
        if (!hit) miss++;
      }
      if (!want.size) return { val: a, okNow: false, tried, miss, none: true };
      const gone = [], goneIds = [];
      const keep = a.filter((h, i) => {
        if (!want.has(i + 1)) return true;
        gone.push(esc(h.name)); goneIds.push(h.id);
        return false;
      });
      return { val: keep, okNow: back => !back.some(h => goneIds.includes(h.id)), gone, goneIds, tried, miss };
    });
    if (!got || got.none) return reply(env, chatId, (got && got.tried) ? L.hGone : L.hDelUsage);
    const { gone, goneIds, miss } = got;
    const plan = await getJSON(env, HABIT_PLAN_KEY, null);
    if (plan) {
      let ch = false;
      for (const hp of plan.habits) if (hp.hid > 0 && goneIds.includes(hp.hid)) { hp.hid = -1; ch = true; }
      if (ch) await putJSON(env, HABIT_PLAN_KEY, plan);
    }
    return notify(env, chatId, gone.length === 1 ? L.hDelOk(gone[0]) : L.hDelOkN(gone.length, gone.join(", "), miss));
  }
  return reply(env, chatId, L.hHow);
}
export async function habitCheck(env, idOrName, atSec) {
  const sec = atSec || nowS();
  const today = dayWIB(sec), yesterday = dayWIB(sec - 86400);
  const want = String(idOrName == null ? "" : idOrName).trim().toLowerCase();
  const out = await mutateWith(env, HABITS_KEY, [], cur => {
    const arr = cur.filter(h => h && h.name);
    habitsResetPure(arr, today, yesterday, wkOf(sec));
    const h = arr.find(x => String(x.id) === String(idOrName))
      || (want ? arr.find(x => String(x.name).toLowerCase() === want) : null)
      || (want ? arr.find(x => String(x.name).toLowerCase().includes(want)) : null);
    if (!h) return { val: arr, okNow: false, res: { ok: false, why: "gone" } };
    if (h.last_done === today) return { val: arr, okNow: false, res: { ok: false, why: "already", name: h.name, streak: h.streak || 0 } };
    let bonus = 0, wkHit = false;
    if (h.tgt) {
      const before = h.wkc || 0;
      h.wkc = Math.min(before + 1, h.tgt);
      wkHit = before < h.tgt && h.wkc === h.tgt;
      if (wkHit) { h.streak = (h.streak || 0) + 1; bonus = HABIT_WEEK_PTS; }
    } else {
      h.streak = h.last_done === yesterday ? (h.streak || 0) + 1 : 1;
    }
    h.last_done = today;
    const res = { ok: true, name: h.name, streak: h.streak || 0, wkc: h.wkc || 0, tgt: h.tgt || 0, wkHit, pts: HABIT_PTS + bonus };
    const hid = h.id;
    return { val: arr, okNow: back => { const x = back.find(y => String(y.id) === String(hid)); return !!x && x.last_done === today; }, res };
  });
  const r = (out && out.res) || { ok: false, why: "gone" };
  if (!r.ok) return r;
  await addPts(env, r.pts);
  const h = { name: r.name, streak: r.streak, wkc: r.wkc, tgt: r.tgt };
  if (r.wkHit) {
    await lifeNote(env, "hit this week's target for the habit '" + h.name + "' (" + h.wkc + "/" + h.tgt + " this week, " + h.streak + "-week streak)");
    if (HABIT_WK_MS.includes(h.streak)) await lifeNote(env, "the habit '" + h.name + "' reached a " + h.streak + "-week streak");
  } else {
    if (HABIT_MS.includes(h.streak)) await lifeNote(env, "the habit '" + h.name + "' reached a " + h.streak + "-day streak");
  }
  return r;
}

export async function handleHabitCb(env, chatId, mid, arg) {
  const L = await uiLang(env);
  const r = await habitCheck(env, arg);
  if (!r.ok) return r.why === "already" ? L.hAlr : L.hGone;
  if (r.wkHit) {
    await reactTail(env, chatId, await lifeMsg(env, "the user just hit this week's target for their habit '" + r.name + "' (" + r.wkc + "/" + r.tgt + ", week streak " + r.streak + ")", "the user completed their weekly habit target: big warm hype, one line."));
  } else {
    await reactTail(env, chatId, await lifeMsg(env, "the user checked in on their habit '" + r.name + "' (streak now " + r.streak + " day" + (r.streak === 1 ? "" : "s") + ")", "the user did their habit check-in: short hype, the streak is alive, one line."));
  }
  if (mid) await editHabitView(env, chatId, mid);
  return r.wkHit ? L.hDonePopW(r.streak, r.wkc, r.tgt, HABIT_PTS, r.pts - HABIT_PTS) : L.hDonePop(r.streak, HABIT_PTS);
}
async function editHabitView(env, chatId, mid) {
  try { const v = await habitView(env); await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); } catch (_) {}
}

export function normalizeAmountDigits(d) {
  const s = String(d == null ? "" : d);
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const hasDot = s.includes("."), hasComma = s.includes(",");
  if (hasDot && hasComma) {
    const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    return s.slice(0, last).replace(/[.,]/g, "") + "." + (s.slice(last + 1).replace(/[.,]/g, "") || "0");
  }
  const sep = hasDot ? "." : hasComma ? "," : "";
  if (!sep) return s;
  const parts = s.split(sep);
  if (parts.length > 2) return parts.join("");
  if (parts[1].length === 3) return parts[0] + parts[1];
  return parts[0] + "." + parts[1];
}
export const parseMoney = tok => { const r = parseAmount(tok, mainCur()); return r ? r.amt : null; };
export const parseAmt = tok => parseMoney(tok);
const CAT_RE = /(?:^|\s)#([\p{L}0-9_-]{1,20})/gu;
export function splitCat(note) {
  const raw = String(note == null ? "" : note);
  const cats = [];
  let m;
  CAT_RE.lastIndex = 0;
  while ((m = CAT_RE.exec(raw)) !== null) cats.push(m[1].toLowerCase());
  if (!cats.length) return { note: raw.trim(), cat: "" };
  CAT_RE.lastIndex = 0;
  const clean = raw.replace(CAT_RE, " ").replace(/\s+/g, " ").trim();
  return { note: clean, cat: cats[0].slice(0, EXP_CAT_CAP) };
}
function mtdOf(arr, mon, cur) {
  const m = mainCur();
  const rows = arr.filter(e => monWIB(Math.floor(e.ts / 1000)) === mon && curOf(e, m) === cur);
  const total = roundMoney(rows.reduce((a, b) => a + b.amt, 0), cur);
  const big = rows.reduce((a, b) => (b.amt > ((a && a.amt) || 0) ? b : a), null);
  return { rows, total, big };
}
const bigTxt = (b, cur) => (b ? rp(b.amt, cur) + " \u2014 " + esc(b.note || "-") : "-");

export function expSummary(arr, mon, budget, cur) {
  const m = mainCur();
  const want = normCur(cur, m);
  const by = new Map();
  for (const e of arr || []) {
    if (!e || typeof e.amt !== "number") continue;
    if (monWIB(Math.floor(e.ts / 1000)) !== mon) continue;
    const c = curOf(e, m);
    if (!by.has(c)) by.set(c, []);
    by.get(c).push(e);
  }
  const bucket = c => {
    const { rows, total, big } = mtdOf(by.get(c) || [], mon, c);
    const byCat = new Map();
    for (const e of rows) {
      const k = String(e.cat || EXP_CAT_DEFAULT).toLowerCase();
      const cur2 = byCat.get(k) || { cat: k, amt: 0, n: 0 };
      cur2.amt = roundMoney(cur2.amt + e.amt, c); cur2.n += 1;
      byCat.set(k, cur2);
    }
    const cats = Array.from(byCat.values()).sort((a, b) => b.amt - a.amt);
    const bud = budgetFor(budget, c);
    const cap = Number(bud.total) || 0;
    return {
      mon, cur: c, rows, total, big, cats, catCaps: bud.cats || {}, cap,
      left: cap ? roundMoney(cap - total, c) : 0, pct: cap ? Math.round(total / cap * 100) : 0,
    };
  };
  const main = bucket(want);
  main.others = [...by.keys()].filter(c => c !== want).map(bucket);
  return main;
}
export function expOtherLine(L, s) {
  if (!s || !s.others || !s.others.length) return "";
  const parts = s.others.map(o => rp(o.total, o.cur) + (o.rows.length > 1 ? " (" + o.rows.length + ")" : ""));
  return "\n" + (L && L.bAlso ? L.bAlso(parts.join(", ")) : "also: " + parts.join(", "));
}
export function expCatLines(L, s, max) {
  if (!s.cats.length) return "";
  return s.cats.slice(0, max || 5).map(c => {
    const pct = s.total ? Math.round(c.amt / s.total * 100) : 0;
    const cap = s.catCaps && s.catCaps[c.cat] ? " / " + rp(s.catCaps[c.cat], s.cur) : "";
    return L.bCatRow(c.cat, rp(c.amt, s.cur) + cap, pct);
  }).join("\n");
}
export function expBudgetLine(L, s) {
  if (!s.cap) return L.bNoBudget;
  if (s.pct > 100) return L.bOver(rp(s.total, s.cur), rp(s.cap, s.cur), s.pct, rp(-s.left, s.cur));
  const filled = Math.min(10, Math.max(0, Math.round(s.pct / 10)));
  return L.bBudget(rp(s.total, s.cur), rp(s.cap, s.cur), s.pct, rp(s.left, s.cur), "\u2588".repeat(filled) + "\u2591".repeat(10 - filled));
}
function budgetCard(L, s) {
  const body = [L.bMtd(rp(s.total, s.cur), s.rows.length, bigTxt(s.big, s.cur)), expBudgetLine(L, s)];
  const cats = expCatLines(L, s, 6);
  if (cats) body.push(cats);
  return body.join("\n");
}
function budgetFor(budget, cur) {
  const b = budget || {};
  const c = cur && b.curs && b.curs[cur];
  if (c) return { total: Number(c.total) || 0, cats: c.cats || {} };
  if (cur === mainCur()) return { total: Number(b.total) || 0, cats: b.cats || {} };
  return { total: 0, cats: {} };
}
export async function expBudget(env) {
  const b = await getJSON(env, EXP_BUDGET_KEY, null) || {};
  return { total: Number(b.total) || 0, cats: b.cats || {}, curs: b.curs || {} };
}
export async function setBudget(env, total, cat, cur) {
  const b = await expBudget(env);
  const c = normCur(cur, mainCur());
  const n = Math.max(0, Math.round(Number(total) || 0));
  if (c === mainCur()) {
    if (cat) { if (n) b.cats[cat] = n; else delete b.cats[cat]; } else b.total = n;
  } else {
    const box = b.curs[c] || { total: 0, cats: {} };
    if (cat) { box.cats = box.cats || {}; if (n) box.cats[cat] = n; else delete box.cats[cat]; } else box.total = n;
    b.curs[c] = box;
  }
  await putJSON(env, EXP_BUDGET_KEY, b);
  return b;
}
export async function handleBeli(env, msg, chatId) {
  const L = await uiLang(env);
  await loadMainCur(env);
  const main = mainCur();
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const arr = (await getJSON(env, EXP_KEY, [])).filter(e => e && typeof e.amt === "number");
  const mon = monWIB(nowS());
  const low = raw.toLowerCase();
  const budget = await expBudget(env);
  if (/^(budget|bujet)\b/.test(low)) {
    const toks = raw.replace(/^\S+\s*/, "").trim().split(/\s+/).filter(Boolean);
    if (!toks.length) { const s = expSummary(arr, mon, budget); return reply(env, chatId, L.bHead + "\n" + budgetCard(L, s) + expOtherLine(L, s)); }
    const money = parseAmount(toks[toks.length - 1], main);
    const cat = toks.length > 1 ? toks[0].toLowerCase() : "";
    if (!money) return reply(env, chatId, L.bBudgetBad);
    const nb = await setBudget(env, money.amt, cat, money.cur);
    const s = expSummary(arr, mon, nb, money.cur);
    return reply(env, chatId, (cat ? L.bBudgetCat(cat, rp(money.amt, money.cur)) : L.bBudgetSet(rp(money.amt, money.cur))) + "\n" + budgetCard(L, s));
  }
  if (!raw || low === "recap") {
    const s = expSummary(arr, mon, budget);
    if (low === "recap") {
      const top = s.rows.slice().sort((a, b) => b.amt - a.amt).slice(0, 5).map(e => "\u2022 " + rp(e.amt, s.cur) + " \u2014 " + esc(e.note || "-") + (e.cat ? " #" + esc(e.cat) : "")).join("\n");
      return reply(env, chatId, L.bHead + "\n" + L.bMtd(rp(s.total, s.cur), s.rows.length, bigTxt(s.big, s.cur)) + (top ? "\n" + top : "") + expOtherLine(L, s));
    }
    return reply(env, chatId, L.bHead + "\n" + budgetCard(L, s) + expOtherLine(L, s) + "\n" + L.bUsage);
  }
  const sp = raw.indexOf(" ");
  let head = sp < 0 ? raw : raw.slice(0, sp);
  let tail = sp < 0 ? "" : raw.slice(sp + 1);
  let money = parseAmount(head, main);
  if (money && !head.trim().match(/[A-Za-z$\u20AC\u00A3\u00A5\u20B9\u20B1\u0E3F]/)) {
    const t1 = (tail.split(/\s+/)[0] || "");
    const c1 = curToken(t1);
    if (c1) { const re = parseAmount(head + " " + t1, main); money = { amt: re ? re.amt : money.amt, cur: c1 }; tail = tail.slice(t1.length).trim(); }
  }
  const parsed = splitCat(tail);
  const note = parsed.note.slice(0, EXP_NOTE_CAP);
  if (!money) return reply(env, chatId, L.bBad);
  const rec = { ts: Date.now(), amt: money.amt, cur: money.cur, note };
  if (parsed.cat) rec.cat = parsed.cat;
  arr.unshift(rec);
  while (arr.length > EXP_MAX) arr.pop();
  await putJSON(env, EXP_KEY, arr);
  const sum = expSummary(arr, mon, await expBudget(env), money.cur);
  return reply(env, chatId, L.bOk(rp(rec.amt, rec.cur), esc(note || "-"), rp(sum.total, sum.cur) + (sum.cap ? " " + expBudgetLine(L, sum) : "")) + (parsed.cat ? "\n" + L.bCatAdded(parsed.cat) : "") + expOtherLine(L, sum));
}

export async function handleCur(env, msg, chatId) {
  const L = await uiLang(env);
  await loadMainCur(env);
  const arg = String(msg.text || "").replace(/^\/\S+\s*/, "").trim().toUpperCase();
  if (!arg) {
    return reply(env, chatId, L.curNow(mainCur(), fmtMoney(1234.5, mainCur())) + "\n" + L.curList(CUR_CODES.join(", ")));
  }
  if (!isCur(arg)) return reply(env, chatId, L.curBad(CUR_CODES.join(", ")));
  await env.KV.put(MAIN_CUR_KEY, arg);
  setMainCur(arg);
  return reply(env, chatId, L.curSet(arg, fmtMoney(1234.5, arg)));
}

export async function expenseAdd(env, amtTok, note) {
  await loadMainCur(env);
  const money = parseAmount(amtTok, mainCur());
  if (!money) return { ok: false, why: "bad" };
  const parsed = splitCat(note);
  const rec = { ts: Date.now(), amt: money.amt, cur: money.cur, note: parsed.note.slice(0, EXP_NOTE_CAP) };
  if (parsed.cat) rec.cat = parsed.cat;
  const arr = await mutateJSON(env, EXP_KEY, [], cur => {
    const list = Array.isArray(cur) ? cur.filter(e => e && typeof e.amt === "number") : [];
    const next = [rec].concat(list);
    while (next.length > EXP_MAX) next.pop();
    return { val: next, okNow: back => Array.isArray(back) && back.some(e => e && e.ts === rec.ts && e.amt === rec.amt) };
  });
  const sum = expSummary(arr, monWIB(nowS()), await expBudget(env), rec.cur);
  return { ok: true, amt: rec.amt, cur: rec.cur, note: rec.note, cat: parsed.cat || EXP_CAT_DEFAULT, total: sum.total, n: sum.rows.length, left: sum.left, cap: sum.cap, others: sum.others };
}

export { dayWIB, monWIB, rp, wkOf };

export async function capsuleItems(env) {
  return (await getJSON(env, CAPSULE_KEY, [])).filter(c => c && c.text);
}
export function capsulePending(arr) { return (arr || []).filter(c => c && c.text && !c.fired); }
export async function capsuleAdd(env, raw, atSec) {
  const sec = atSec || nowS();
  const arr = await capsuleItems(env);
  const toks = String(raw || "").trim().split(/\s+/).filter(Boolean);
  if (toks.length < 2) return { ok: false, why: "short" };
  let due = null, mi = 0;
  for (let len = Math.min(5, toks.length - 1); len >= 1; len--) {
    const t = parseRemind(toks.slice(0, len).join(" "), sec);
    if (t) { due = t; mi = len; break; }
  }
  if (!due) return { ok: false, why: "bad" };
  const text = toks.slice(mi).join(" ").slice(0, CAPSULE_TEXT_CAP);
  if (!text) return { ok: false, why: "short" };
  if (due < sec + CAPSULE_MIN_GAP) return { ok: false, why: "soon", min: Math.round(CAPSULE_MIN_GAP / 60) };
  if (capsulePending(arr).length >= CAPSULE_PEND_MAX) return { ok: false, why: "full", max: CAPSULE_PEND_MAX };
  arr.unshift({ created: sec, due, text, fired: 0 });
  while (arr.length > CAPSULE_PEND_MAX + CAPSULE_ARCH_MAX) arr.pop();
  await putJSON(env, CAPSULE_KEY, arr);
  return { ok: true, due, text };
}
export async function capsuleDel(env, n) {
  const arr = await capsuleItems(env);
  const pend = capsulePending(arr);
  const idx = parseInt(n, 10);
  if (!Number.isFinite(idx) || idx < 1 || !pend[idx - 1]) return { ok: false, why: "gone" };
  pend[idx - 1].fired = -1;
  while (arr.length > CAPSULE_PEND_MAX + CAPSULE_ARCH_MAX) arr.pop();
  await putJSON(env, CAPSULE_KEY, arr);
  return { ok: true, text: pend[idx - 1].text };
}
export async function handleCapsule(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!raw) {
    const pend = capsulePending(await capsuleItems(env));
    const rows = pend.map((c, i) => (i + 1) + ". " + fmtWIB(c.due, L) + " \u2014 " + esc(c.text.slice(0, 40)) + (c.text.length > 40 ? "\u2026" : "")).join("\n");
    return reply(env, chatId, L.cHead + "\n" + (rows || L.cEmpty) + "\n" + L.cUsage);
  }
  if (/^del\s+\d+$/i.test(raw)) {
    const r = await capsuleDel(env, raw.split(/\s+/)[1]);
    return r.ok ? notify(env, chatId, L.cDelOk) : reply(env, chatId, L.cGone);
  }
  const r = await capsuleAdd(env, raw);
  if (!r.ok) return reply(env, chatId, r.why === "full" ? L.cFull(CAPSULE_PEND_MAX) : r.why === "soon" ? L.cSoon : r.why === "bad" ? L.cBad : L.cShort);
  return reply(env, chatId, L.cOk(fmtWIB(r.due, L)));
}

async function capsuleCron(env, nowSec) {
  const arr = (await getJSON(env, CAPSULE_KEY, [])).filter(c => c && c.text);
  let changed = false;
  for (const c of arr) {
    if (c.fired || c.due > nowSec) continue;
    c.fired = nowSec; changed = true;
    const L = await uiLang(env);
    const card = await getActiveCard(env).catch(() => null);
    let intro = "";
    if (card) intro = await lifeMsg(env, "a time capsule the user wrote on " + fmtWIB(c.created, L) + " just opened. The letter says: \"" + c.text.slice(0, 300) + "\"", "deliver this letter: quote its opening warmly in-character, then hand it over, one or two lines.");
    const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
    if (owner) await reply(env, owner, L.cCard(fmtWIB(c.created, L), esc(c.text)) + (intro ? "\n\n\u{1F4AC} " + mdTg(esc(intro)) : ""));
  }
  if (changed) {
    while (arr.length > CAPSULE_PEND_MAX + CAPSULE_ARCH_MAX) arr.pop();
    await putJSON(env, CAPSULE_KEY, arr);
  }
}

import { chainCron } from './feat-chain.js';

export async function lifeCron(env, nowSec) {
  await focusCron(env, nowSec).catch(() => {});
  await capsuleCron(env, nowSec).catch(() => {});
  await countdownCron(env, nowSec).catch(() => {});
  await resurfaceCron(env, nowSec).catch(() => {});
  await alarmCron(env, nowSec).catch(() => {});
  await chainCron(env, nowSec).catch(() => {});
}

const p2 = n => String(n).padStart(2, "0");
export async function handleAlarm(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim().toLowerCase();
  const key = ALARM_KEY + chatId;
  const cur = (await getJSON(env, key, null)) || { on: 0, h: ALARM_DEF_H, m: 0 };
  if (!raw) return reply(env, chatId, L.alarmView(cur.on ? "ON \u2705" : "OFF \u274c", p2(cur.h) + ":" + p2(cur.m)));
  const a = raw.split(/\s+/);
  if (a[0] === "on") {
    let h = ALARM_DEF_H, m = 0;
    if (a[1]) {
      const mm = /^(\d{1,2})[:.](\d{2})$/.exec(a[1]);
      if (!mm || +mm[1] > 23 || +mm[2] > 59) return reply(env, chatId, L.alarmBad);
      h = +mm[1]; m = +mm[2];
    }
    await putJSON(env, key, { on: 1, h, m, last: cur.last });
    return reply(env, chatId, L.alarmOn(p2(h) + ":" + p2(m)));
  }
  if (a[0] === "off") {
    await putJSON(env, key, { on: 0, h: cur.h, m: cur.m, last: cur.last });
    return reply(env, chatId, L.alarmOff);
  }
  return reply(env, chatId, L.alarmUsage);
}

export async function alarmCron(env, nowSec) {
  const sec = nowSec || nowS();
  const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
  if (!owner) return;
  const cfg = await getJSON(env, ALARM_KEY + owner, null);
  if (!cfg || !cfg.on) return;
  const d = new Date((sec + WIB) * 1000);
  if (d.getUTCHours() !== cfg.h || d.getUTCMinutes() >= 5) return;
  const day = dayWIB(sec);
  if (cfg.last === day) return;
  await putJSON(env, ALARM_KEY + owner, { on: cfg.on, h: cfg.h, m: cfg.m, last: day });
  const ai = await lifeMsg(env, "MORNING GREETING: it just turned " + p2(cfg.h) + ":" + p2(cfg.m) + " in the user's timezone (WIB)", "say a short warm good morning in-character; one or two lines max, no list, no agenda");
  if (ai) await reply(env, owner, "\u2615 " + mdTg(esc(ai)));
}

export function reactPick(text, aff) {
  const t = String(text || "").toLowerCase();
  if (/(wkwk|haha|hehe|lmao|\u{1F602}|\u{1F923})/u.test(t)) return "\u{1F601}";
  if (/(mantap|gacor|keren|jago|pintar|\bnice\b|\bgg\b|\u{1F525})/u.test(t)) return "\u{1F525}";
  if (/(sayang|kangen|rindu|cinta|love|miss you)/.test(t)) return "\u2764";
  if (/(sedih|nangis|galau|nyesek|\u{1F622})/u.test(t)) return "\u{1F622}";
  return aff >= 60 ? "\u2764" : "\u{1F44D}";
}

export async function fReact(env, chatId, mid, text) {
  if (fnv1a(String(chatId) + "|" + String(mid)) % REACT_PROB !== 0) return;
  const day = dayWIB(nowS());
  const st = (await getJSON(env, REACTD_KEY, null)) || { d: {} };
  const used = ((st.d[day] || {})[String(chatId)]) || 0;
  if (used >= REACT_DAILY_CAP) return;
  let aff = 0;
  try {
    const ca = await getJSON(env, CHAR_ACTIVE_KEY, null);
    if (ca) {
      const rel = await getJSON(env, REL_PREFIX + ca, null);
      if (rel && typeof rel.aff === "number") aff = rel.aff;
    }
  } catch (_) {}
  const emoji = reactPick(text, aff);
  const j = await tg(env, "setMessageReaction", { chat_id: chatId, message_id: mid, reaction: [{ type: "emoji", emoji }] });
  if (!j || j.ok === false) return;
  const nd = { d: {} };
  const yd = dayWIB(nowS() - 86400);
  for (const k of Object.keys(st.d)) if (k >= yd) nd.d[k] = st.d[k];
  nd.d[day] = Object.assign({}, st.d[day] || {});
  nd.d[day][String(chatId)] = used + 1;
  await putJSON(env, REACTD_KEY, nd);
}

const cdDayMs = day => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };

export async function handleCountdown(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const sec = nowS();
  const arr = (await getJSON(env, COUNTDOWN_KEY, [])).filter(c => c && c.name && c.day);
  if (!raw) {
    const todayMs = cdDayMs(dayWIB(sec));
    const rows = arr.slice().sort((a, b) => (cdDayMs(a.day) || 0) - (cdDayMs(b.day) || 0)).map(c => {
      const left = Math.round(((cdDayMs(c.day) || 0) - todayMs) / 86400000);
      return "#" + c.id + " <b>" + esc(c.name) + "</b> \u2014 " + (left > 0 ? L.cdDays(left) : left === 0 ? L.cdToday : L.cdPast);
    }).join("\n");
    return reply(env, chatId, L.cdTitle + UI_SEP + (rows || L.cdEmpty) + "\n" + L.cdUsage);
  }
  if (/^del\s+\d+$/i.test(raw)) {
    const n = parseInt(raw.split(/\s+/)[1], 10);
    const got = await mutateWith(env, COUNTDOWN_KEY, [], cur => {
      const a = cur.filter(c => c && c.name && c.day);
      if (!a.some(c => c.id === n)) return { val: a, okNow: false, miss: true };
      return { val: a.filter(c => c.id !== n), okNow: back => !back.some(c => c.id === n) };
    });
    if (!got || got.miss) return reply(env, chatId, L.cdGone);
    return notify(env, chatId, L.cdDelOk);
  }
  const m = /^(.*?)(\d{4}-\d{2}-\d{2})\s*$/.exec(raw);
  const name = (m ? m[1] : "").trim().replace(/^[\s\-\u2014:]+/, "");
  const day = m ? m[2] : "";
  if (!name || !cdDayMs(day)) return reply(env, chatId, L.cdBad);

  const got = await mutateWith(env, COUNTDOWN_KEY, [], cur => {
    const a = cur.filter(c => c && c.name && c.day);
    if (a.length >= COUNTDOWN_MAX) return { val: a, okNow: false, full: true };
    const id = (a.reduce((m, c) => Math.max(m, c.id || 0), 0) || 0) + 1;
    a.push({ id, name: name.slice(0, COUNTDOWN_NAME_CAP), day, created: sec, fired: 0 });
    return { val: a, okNow: back => back.some(c => c.id === id) };
  });
  if (!got || got.full) return reply(env, chatId, L.cdFull(COUNTDOWN_MAX));
  return reply(env, chatId, L.cdAdded(esc(name.slice(0, COUNTDOWN_NAME_CAP)), day));
}

export async function countdownCron(env, nowSec) {
  const today = dayWIB(nowSec);
  const got = await mutateWith(env, COUNTDOWN_KEY, [], cur => {
    const arr = cur.filter(c => c && c.name && c.day);
    const fire = [];
    for (const c of arr) { if (c.fired || c.day !== today) continue; c.fired = nowSec; fire.push(c); }
    if (!fire.length) return { val: arr, okNow: false };
    return { val: arr, okNow: back => fire.every(f => (back.find(c => c.id === f.id) || {}).fired === nowSec), fire };
  });
  const fire = (got && got.fire) || [];
  if (!fire.length) return;
  const L = await uiLang(env);
  const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
  for (const c of fire) if (owner) await reply(env, owner, L.cdFire(esc(c.name)));
}

const fnv1a = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export { fnv1a };

export async function resurfaceCron(env, nowSec) {
  const sec = nowSec || nowS();
  const d = new Date((sec + WIB) * 1000);
  if (d.getUTCHours() !== 21 || d.getUTCMinutes() >= 5) return;
  const day = dayWIB(sec);
  if (fnv1a(day) % RESURFACE_EVERY !== 0) return;
  const flag = await getJSON(env, RESURFACE_KEY, null);
  if (flag === day) return;
  const all = (await getJSON(env, "journal", [])).filter(e => e && e.text);
  const old = all.filter(e => e.ts <= (sec * 1000) - RESURFACE_MIN_AGE_DAYS * 86400000);
  if (!old.length) return;
  await putJSON(env, RESURFACE_KEY, day);
  const pick = old[fnv1a(day + "p") % old.length];
  const when = fmtWIB(Math.floor(pick.ts / 1000), await uiLang(env));
  const ai = await lifeMsg(env, "while tidying memory you found the user's old journal entry from " + when + " that says: \"" + pick.text.slice(0, 200) + "\"", "bring this up out of nowhere, like stumbling on a fond memory; tease or react to it in-character, one or two lines");
  const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
  if (owner && ai) await reply(env, owner, "\u{1F9E0} " + mdTg(esc(ai)));
}

export async function handleAma(env, msg, chatId) {
  const L = await uiLang(env);
  const q = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!q) return reply(env, chatId, L.amaUsage);
  const pk = AMA_KEY + chatId;
  const last = parseInt((await env.KV.get(pk)) || "0", 10) || 0;
  if (last && Date.now() - last < AMA_GAP_MS) return notify(env, chatId, L.amaThrottle);
  await env.KV.put(pk, String(Date.now()));
  const ai = await lifeMsg(env, "the user asks a META question (out of the story): " + q.slice(0, AMA_Q_CAP), "one-off META mode: answer honestly as yourself (the AI behind this bot) about you, the user, or this story; keep your voice, 2-4 lines, no system formatting, no headers");
  if (!ai) {
    try { await env.KV.delete(pk); } catch (_) {}
    return reply(env, chatId, L.amaFail);
  }
  return reply(env, chatId, "\u{1F4AC} " + mdTg(esc(ai)));
}

export async function lifeDigest(env, L, nowSec) {
  const sec = nowSec || nowS();
  const today = dayWIB(sec), yesterday = dayWIB(sec - 86400);
  let data = "", tail = "";
  const got = await mutateWith(env, HABITS_KEY, [], cur => {
    const a = cur.filter(h => h && h.name);
    habitsResetPure(a, today, yesterday, wkOf(sec));
    return { val: a, okNow: () => true };
  });
  const habits = (got && got.val) || [];
  if (habits.length) {
    const pendD = habits.filter(h => !h.tgt && h.last_done !== today);
    const pendW = habits.filter(h => h.tgt && (h.wkc || 0) < h.tgt);
    if (pendD.length || pendW.length) {
      tail += "\n" + L.dgHabit(pendD.map(h => esc(h.name)).concat(pendW.map(h => esc(h.name) + " " + (h.wkc || 0) + "/" + h.tgt)).join(", "));
      data += "Habits pending: " + pendD.map(h => h.name + " (streak " + (h.streak || 0) + " days)").concat(pendW.map(h => h.name + " " + (h.wkc || 0) + "/" + h.tgt + " this week (streak " + (h.streak || 0) + " weeks)")).join(", ") + ". ";
    }
  }
  if (dowWIB(sec) === 1 && (await getJSON(env, SLEEP_WEEK_KEY, "")) !== today) {
    const log = (await getJSON(env, SLEEP_LOG_KEY, [])).filter(x => x && typeof x.gm === "number").slice(0, 7);
    if (log.length) {
      const avg = Math.round(log.reduce((a, b) => a + (b.h || 0), 0) / log.length * 10) / 10;
      await putJSON(env, SLEEP_WEEK_KEY, today);
      tail += "\n" + L.dgSleep(avg, log.length);
      data += "Sleep last " + log.length + " nights avg " + avg + "h. ";
    }
  }
  if (today.endsWith("-01") && (await getJSON(env, EXP_MONTH_KEY, "")) !== monWIB(sec)) {
    const arr = (await getJSON(env, EXP_KEY, [])).filter(e => e && typeof e.amt === "number");
    const prevMon = monWIB(sec - 86400);
    const rows = arr.filter(e => monWIB(Math.floor(e.ts / 1000)) === prevMon);
    if (rows.length) {
      const cur0 = mainCur();
      const { total, big } = mtdOf(rows, prevMon, cur0);
      await putJSON(env, EXP_MONTH_KEY, monWIB(sec));
      tail += "\n" + L.dgExp(prevMon, rp(total, cur0), rows.length, bigTxt(big, cur0));
      data += "Spending last month (" + prevMon + "): " + rp(total, cur0) + " in " + rows.length + " entries. ";
    }
  }
  return { data: data.trim(), tail };
}

const SYS_HPLAN = "HABIT_PLAN PROGRAM. You design a small habit-building program for a casual chat user. Reply with STRICT JSON only - no markdown fence, no commentary. Shape: {\"topic\":\"...\",\"habits\":[{\"name\":\"...\",\"target\":2,\"why\":\"...\"}],\"schedule\":\"...\"} - 2 to 4 habits that together serve the requested topic; each 'name' = 1-4 short words (max 30 chars); 'target' = times PER WEEK, start SLOW (1-3, never everything daily); 'why' = one short sentence; 'schedule' = a compact week-by-week plan (max 600 chars, plain newlines). Write 'why' and 'schedule' in the same language as the user's topic.";
const SYS_HPLAN_REVIEW = "HABIT_PLAN REVIEW. You review a user's AI-guided habit plan at its weekly checkpoint. Reply with STRICT JSON only - no markdown fence, no commentary. Shape: {\"notes\":\"...\",\"changes\":[{\"name\":\"...\",\"target\":3}],\"schedule\":\"...\"} - 'notes' = one-two sentences reacting to the ACTUAL progress data (encouraging, honest); 'changes' = ONLY habits whose weekly target should change ('target' 1-7: ramp up when met easily, lower when consistently missed; habits doing fine are omitted); 'schedule' = the revised compact plan (max 600 chars). Write 'notes' and 'schedule' in the same language as the habit plan topic.";

function validPlan(j) {
  if (!j || !Array.isArray(j.habits)) return null;
  const hs = j.habits.slice(0, HABIT_PLAN_HABITS_MAX).map(x => ({
    name: String((x && x.name) || "").trim().slice(0, 30),
    target: Math.max(1, Math.min(7, parseInt(x && x.target, 10) || 0)),
    why: String((x && x.why) || "").slice(0, 160)
  })).filter(h => h.name);
  if (!hs.length) return null;
  return { topic: String(j.topic || "").slice(0, 60), habits: hs, schedule: String(j.schedule || "").slice(0, 600) };
}
function validReview(j, plan) {
  if (!j) return null;
  const names = plan.habits.map(h => h.name.toLowerCase());
  const changes = (Array.isArray(j.changes) ? j.changes : []).map(c => ({
    name: String((c && c.name) || "").trim().slice(0, 30),
    target: Math.max(1, Math.min(7, parseInt(c && c.target, 10) || 0))
  })).filter(c => c.name && names.includes(c.name.toLowerCase()));
  return { notes: String(j.notes || "").slice(0, 300), changes, schedule: String(j.schedule || "").slice(0, 600) || plan.schedule || "" };
}
async function aiPlanJSON(env, sys, userMsg, cap) {
  let out = "";
  try {
    const msgs = [{ role: "system", content: sys }, { role: "user", content: userMsg }];
    for await (const d of chatStream(env, msgs, cap)) out += d;
  } catch (_) { return null; }
  const m = stripThink(out).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}
async function editPlanView(env, chatId, mid, v) {
  if (mid) {
    const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    if (j && j.ok) return;
  }
  await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}
function planRows(p, L, arr) {
  return p.habits.map(h => {
    const hh = arr ? arr.find(x => x.id === h.hid) : null;
    return L.hpRow(esc(h.name), h.target, hh ? (hh.wkc || 0) : 0, hh ? (hh.streak || 0) : 0, !!hh);
  }).join("\n");
}
function planConfirmView(p, L) {
  return {
    text: L.hpHead + "\n" + L.hpTopic(esc(p.topic || "-")) + "\n" + planRows(p, L, null) + "\n" + L.hpSchedule(esc(p.schedule || "")),
    markup: { inline_keyboard: p.habits.map((h, i) => [{ text: "➕ " + h.name.slice(0, 18) + " (" + h.target + "×)", callback_data: "hp:add:" + i }]).concat([[{ text: L.hpAddAll, callback_data: "hp:all" }, { text: L.hpSkip, callback_data: "hp:no" }], [{ text: L.home, callback_data: "menu" }]]) }
  };
}
function planAppliedView(p, L, arr) {
  return {
    text: L.hpHead + "\n" + L.hpTopic(esc(p.topic || "-")) + "\n" + planRows(p, L, arr) + "\n" + L.hpSchedule(esc(p.schedule || "")) + (p.last_review && p.last_review !== wkOf() ? "\n" + L.hpRevDue : ""),
    markup: { inline_keyboard: [[{ text: L.hpRevBtn, callback_data: "hp:review" }, { text: L.hpDelBtn, callback_data: "hp:no" }], [{ text: L.home, callback_data: "menu" }]] }
  };
}
function planReviewView(p, rv, L) {
  const ch = rv.changes.length ? rv.changes.map(c => {
    const old = (p.habits.find(h => h.name.toLowerCase() === c.name.toLowerCase()) || {}).target || "?";
    return L.hpRevRow(esc(c.name), old, c.target);
  }).join("\n") : L.hpRevNone;
  return {
    text: L.hpRevHead + "\n" + (rv.notes ? esc(rv.notes) + "\n" : "") + ch + (rv.schedule && rv.schedule !== p.schedule ? "\n" + L.hpSchedule(esc(rv.schedule)) : ""),
    markup: { inline_keyboard: [[{ text: L.hpApply, callback_data: "hp:rok" }, { text: L.hpRevSkip, callback_data: "hp:rskip" }], [{ text: L.home, callback_data: "menu" }]] }
  };
}
async function planNudgeMaybe(env, plan) {
  if (!plan.applied) return;
  const wk = wkOf();
  if (plan.last_review === wk || plan.nudged_wk === wk) return;
  plan.nudged_wk = wk;
  await putJSON(env, HABIT_PLAN_KEY, plan);
  await lifeNote(env, "the habit plan '" + (plan.topic || "custom") + "' is due for its weekly review — ask how the week went and point them to /habit plan review");
}
async function handleHabitPlan(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const arg = raw.replace(/^plan\s*/i, "").trim();
  const plan = await getJSON(env, HABIT_PLAN_KEY, null);
  if (/^del\b/i.test(arg)) {
    if (!plan) return reply(env, chatId, L.hpNone);
    await env.KV.delete(HABIT_PLAN_KEY);
    return notify(env, chatId, L.hpDelOk);
  }
  if (/^review\b/i.test(arg)) return habitPlanReview(env, chatId, 0);
  if (!arg) {
    if (!plan) return reply(env, chatId, L.hpHead + "\n" + L.hpEmpty + "\n" + L.hpUsage);
    await planNudgeMaybe(env, plan);
    const arr = (await getJSON(env, HABITS_KEY, [])).filter(h => h && h.name);
    const v = plan.applied ? planAppliedView(plan, L, arr) : planConfirmView(plan, L);
    return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  }
  if (plan && plan.applied) return reply(env, chatId, L.hpBusy(esc(plan.topic || "-")));
  await notify(env, chatId, L.hpGen(esc(arg.slice(0, 60))));
  const j = await aiPlanJSON(env, SYS_HPLAN, "Design a habit-building program for this topic: " + arg.slice(0, 200), 700);
  const p = validPlan(j);
  if (!p) return notify(env, chatId, L.hpFail);
  p.created = nowS(); p.applied = false; p.reviews = 0; p.last_review = ""; p.nudged_wk = "";
  await putJSON(env, HABIT_PLAN_KEY, p);
  const v = planConfirmView(p, L);
  return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}
async function habitPlanReview(env, chatId, mid) {
  const L = await uiLang(env);
  const plan = await getJSON(env, HABIT_PLAN_KEY, null);
  if (!plan) return reply(env, chatId, L.hpNone);
  if (!plan.applied) return reply(env, chatId, L.hpNoHabits);
  const arr = (await getJSON(env, HABITS_KEY, [])).filter(h => h && h.name);
  const prog = plan.habits.filter(h => h.hid > 0).map(h => {
    const hh = arr.find(x => x.id === h.hid) || {};
    return { name: h.name, target: hh.tgt || h.target, wkc: hh.wkc || 0, ws: hh.streak || 0 };
  });
  if (!prog.length) return reply(env, chatId, L.hpNoHabits);
  await notify(env, chatId, L.hpRevGen);
  const j = await aiPlanJSON(env, SYS_HPLAN_REVIEW, "Habit plan '" + (plan.topic || "custom") + "'. Current schedule: " + (plan.schedule || "-") + ". Progress THIS week per habit: " + prog.map(p2 => p2.name + " " + p2.wkc + "/" + p2.target + " (week streak " + p2.ws + ")").join("; ") + ". Suggest this week's adjustment.", 700);
  const rv = validReview(j, plan);
  if (!rv) return notify(env, chatId, L.hpRevFail);
  plan.rv = rv;
  await putJSON(env, HABIT_PLAN_KEY, plan);
  return editPlanView(env, chatId, mid, planReviewView(plan, rv, L));
}
export async function handleHplanCb(env, chatId, mid, arg) {
  const L = await uiLang(env);
  const plan = await getJSON(env, HABIT_PLAN_KEY, null);
  if (!plan) return L.hpNone;
  const parts = arg.split(":");
  const op = parts[0];
  if (op === "review") { await habitPlanReview(env, chatId, mid); return ""; }
  if (op === "no") {
    await env.KV.delete(HABIT_PLAN_KEY);
    await editPlanView(env, chatId, mid, { text: L.hpHead + "\n" + L.hpDelOk, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } });
    return "";
  }
  if (op === "add" || op === "all") {
    const picks = op === "all" ? plan.habits.map((_, i) => i) : [parseInt(parts[1], 10)];
    const got = await mutateWith(env, HABITS_KEY, [], cur => {
      const arr = cur.filter(h => h && h.name);
      const assigned = {};
      let added = 0, firstName = "", full = false;
      for (const i of picks) {
        const h = plan.habits[i];
        if (!h || h.hid) continue;
        if (arr.length >= HABIT_MAX) { full = true; continue; }
        if (arr.some(x => String(x.name).toLowerCase() === h.name.toLowerCase())) { assigned[i] = -1; continue; }
        const id = (arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1);
        arr.push(Object.assign({ id, name: h.name, streak: 0, last_done: "" }, { tgt: h.target, wk: wkOf(), wkc: 0 }));
        assigned[i] = id; added++;
        if (!firstName) firstName = h.name;
      }
      return { val: arr, okNow: back => Object.keys(assigned).every(k => assigned[k] === -1 || back.some(x => x.id === assigned[k])), assigned, added, firstName, full };
    });
    const arr = got.val;
    for (const k of Object.keys(got.assigned)) plan.habits[k].hid = got.assigned[k];
    if (got.added) {
      if (!plan.applied) { plan.applied = true; plan.wk = wkOf(); await lifeNote(env, "started an AI-guided habit plan '" + (plan.topic || "custom") + "'"); }
      await putJSON(env, HABIT_PLAN_KEY, plan);
    }
    await editPlanView(env, chatId, mid, plan.applied ? planAppliedView(plan, L, arr) : planConfirmView(plan, L));
    return got.full ? L.hFull(HABIT_MAX) : got.added ? L.hpAdded(esc(got.firstName)) : "";
  }
  if (op === "rok") {
    const rv = plan.rv;
    if (!rv) return "";
    const got = await mutateWith(env, HABITS_KEY, [], cur => {
      const arr = cur.filter(h => h && h.name);
      for (const c of rv.changes) {
        const h = arr.find(x => String(x.name).toLowerCase() === c.name.toLowerCase());
        if (h) h.tgt = c.target;
      }
      return { val: arr, okNow: () => true };
    });
    const arr = got.val;
    plan.schedule = rv.schedule || plan.schedule;
    plan.last_review = wkOf(); plan.nudged_wk = ""; plan.reviews = (plan.reviews || 0) + 1; plan.rv = null;
    await putJSON(env, HABIT_PLAN_KEY, plan);
    const sum = rv.changes.length ? rv.changes.map(c => c.name + " -> " + c.target + "x/week").join(", ") : "targets kept as is";
    await lifeNote(env, "habit plan '" + (plan.topic || "custom") + "' weekly review #" + plan.reviews + " applied: " + sum);
    await editPlanView(env, chatId, mid, planAppliedView(plan, L, arr));
    return L.hpApplied;
  }
  if (op === "rskip") {
    plan.rv = null;
    plan.last_review = wkOf(); plan.nudged_wk = ""; plan.reviews = (plan.reviews || 0) + 1;
    await putJSON(env, HABIT_PLAN_KEY, plan);
    const arr = (await getJSON(env, HABITS_KEY, [])).filter(h => h && h.name);
    await editPlanView(env, chatId, mid, planAppliedView(plan, L, arr));
    return L.hpSkipped;
  }
  return "";
}
