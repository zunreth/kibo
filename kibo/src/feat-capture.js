
import { NOTE_KEY, NOTE_MAX, NOTE_TEXT_CAP, EXP_MAX } from './consts.js';
import { getJSON, putJSON, reply, esc } from './base.js';
import { uiLang, fmtWIB } from './ui.js';
import { expenseAdd } from './feat-life.js';
import { addReminder, parseRemind } from './feat-remind.js';
import { rlAddCore } from './feat-b8.js';
import { todoAdd, splitTodoInput } from './feat-todo.js';

const nowS = () => Math.floor(Date.now() / 1000);
const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

const NOT_MONEY = /^(langkah|kata|kali|orang|tahun|hari|jam|menit|detik|baris|halaman|lembar|poin|kalori|gram|ml|km|meter|chapter|eps?|episode|halaman)\b/i;

const URL_RE = /^https?:\/\/\S+$/i;
const REMIND_RE = /^(?:inget(?:in|kan)|ingatkan|remind(?:er)?|r)(?:\s+(?:me|aku|gw|gue|saya))?\s*[:,.-]?\s+([\s\S]+)$/i;
const TODO_RE = /^(?:todo|to-do|task|tugas|kerjain|kerjakan)\s*[:,.-]?\s+([\s\S]+)$/i;
const AMT_RE = /^(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta)?\s+([\s\S]+)$/i;

export function captureClassify(raw, atSec) {
  const text = clean(raw);
  if (!text) return { kind: "empty" };
  if (URL_RE.test(text)) return { kind: "link", url: text };

  let m = text.match(REMIND_RE);
  if (m) {
    const body = clean(m[1]);
    const toks = body.split(/\s+/);
    for (let len = Math.min(5, toks.length - 1); len >= 1; len--) {
      const at = parseRemind(toks.slice(0, len).join(" "), atSec || nowS());
      if (at) return { kind: "reminder", at, text: toks.slice(len).join(" ") };
    }
    return { kind: "reminder-no-time", text: body };
  }

  m = text.match(TODO_RE);
  if (m) return { kind: "todo", text: clean(m[1]) };

  m = text.match(AMT_RE);
  if (m) {
    const unit = !!m[2];
    const digits = m[1].replace(/[^\d]/g, "").length;
    const note = clean(m[3]);
    const moneyish = !NOT_MONEY.test(note) && note.length <= 80 && (unit || digits >= 4);
    if (moneyish) return { kind: "expense", amount: m[1] + (m[2] || ""), note };
  }
  return { kind: "note", text };
}

async function pushNote(env, text) {
  const arr = (await getJSON(env, NOTE_KEY, [])).filter(n => n && n.t);
  const id = arr.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
  arr.unshift({ id, t: String(text).slice(0, NOTE_TEXT_CAP), ts: Date.now() });
  while (arr.length > NOTE_MAX) arr.pop();
  await putJSON(env, NOTE_KEY, arr);
  return { id, n: arr.length };
}

export async function captureText(env, chatId, raw, opts) {
  const allowNote = !(opts && opts.noNote);
  const c = captureClassify(raw, nowS());
  if (c.kind === "empty") return { handled: false };
  if (c.kind === "note" && !allowNote) return { handled: false };
  const L = await uiLang(env);

  if (c.kind === "link") {
    const r = await rlAddCore(env, chatId || 0, c.url);
    if (!r.ok) {
      const s = await pushNote(env, "link " + c.url);
      return { handled: true, kind: "note", text: L.capLinkFull(esc(c.url), s.id) };
    }
    return { handled: true, kind: "link", text: L.capLink(r.id, esc(c.url)) };
  }
  if (c.kind === "reminder") {
    if (!c.text) return { handled: true, kind: "reminder-no-time", text: L.capRemindNoText };
    const r = await addReminder(env, chatId, null, c.text, { target: c.at });
    if (!r) return { handled: true, kind: "reminder-no-time", text: L.capRemindFail(esc(c.text)) };
    return { handled: true, kind: "reminder", text: L.capRemind(esc(c.text), fmtWIB(r.at, L)) };
  }
  if (c.kind === "reminder-no-time") {
    return { handled: true, kind: "reminder-no-time", text: L.capRemindNoTime(esc(c.text)) };
  }
  if (c.kind === "todo") {
    const sp = splitTodoInput(c.text, nowS());
    const r = await todoAdd(env, sp.text, sp.due, sp.rec);
    if (!r.ok) return { handled: true, kind: "todo", text: r.why === "full" ? L.tdFull(r.max) : L.tdUsage };
    return { handled: true, kind: "todo", text: L.capTodo(r.id, esc(r.text)) + (r.due ? L.capTodoDue(fmtWIB(r.due, L)) : "") };
  }
  if (c.kind === "expense") {
    const r = await expenseAdd(env, c.amount, c.note);
    if (!r.ok) {
      const s = await pushNote(env, clean(raw));
      return { handled: true, kind: "note", text: L.capNote(s.id, s.n) };
    }
    return { handled: true, kind: "expense", text: L.capExpense(rp_(r.amt), esc(r.note || "-"), rp_(r.total)) + (c.note.includes("#") ? "" : "\n" + L.capTagHint) };
  }
  const s = await pushNote(env, clean(raw));
  return { handled: true, kind: "note", text: L.capNote(s.id, s.n) };
}

const rp_ = n => "Rp" + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export async function handleCapture(env, msg, chatId) {
  const L = await uiLang(env);
  const body = String((msg && msg.text) || "").replace(/^\/\S+\s*/, "").trim();
  if (!body) {
    const notes = (await getJSON(env, NOTE_KEY, [])).filter(n => n && n.t).slice(0, 6);
    const rows = notes.map(n => "\u2022 #" + n.id + " " + esc(n.t.slice(0, 70)));
    return reply(env, chatId, L.capUsage + (rows.length ? "\n\n" + L.capRecent + "\n" + rows.join("\n") : ""));
  }
  const r = await captureText(env, chatId, body);
  if (!r.handled) return reply(env, chatId, L.capUsage);
  return reply(env, chatId, r.text);
}

export { pushNote };
