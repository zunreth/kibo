
import { reply, getJSON, tgErrLog, tgUpTmo } from './base.js';
import { uiLang } from './ui.js';
import { COUNTDOWN_KEY, QR_MAX_CHARS, QR_API } from './consts.js';
import { todoList } from './feat-todo.js';

const pad = n => String(n).padStart(2, "0");
const icsStamp = sec => {
  const d = new Date(sec * 1000);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
};
const icsDate = dayStr => String(dayStr || "").replace(/-/g, "");
export function icsEsc(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line) {
  if (line.length <= 73) return line;
  const out = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) { out.push(" " + rest.slice(0, 72)); rest = rest.slice(72); }
  if (rest) out.push(" " + rest);
  return out.join("\r\n");
}

export function buildIcs({ reminders, todos, countdowns, nowSec, calName }) {
  const now = nowSec || Math.floor(Date.now() / 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kibo//kibo//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsEsc(calName || "kibo"),
  ];
  const ev = (uid, start, end, summary, allDay, desc) => {
    lines.push("BEGIN:VEVENT");
    lines.push("UID:" + uid);
    lines.push("DTSTAMP:" + icsStamp(now));
    if (allDay) {
      lines.push("DTSTART;VALUE=DATE:" + icsDate(start));
      lines.push("DTEND;VALUE=DATE:" + icsDate(end));
    } else {
      lines.push("DTSTART:" + icsStamp(start));
      lines.push("DTEND:" + icsStamp(end));
    }
    lines.push(fold("SUMMARY:" + icsEsc(summary)));
    if (desc) lines.push(fold("DESCRIPTION:" + icsEsc(desc)));
    lines.push("END:VEVENT");
  };
  for (const r of reminders || []) {
    if (!r || typeof r.at !== "number") continue;
    if (r.rec) {
      lines.push("BEGIN:VEVENT");
      lines.push("UID:kibo-rem-" + r.id + "@kibo");
      lines.push("DTSTAMP:" + icsStamp(now));
      lines.push("DTSTART:" + icsStamp(r.at));
      lines.push("DTEND:" + icsStamp(r.at + 60));
      lines.push(fold("SUMMARY:" + icsEsc(r.text)));
      lines.push("RRULE:FREQ=" + (r.rec.kind === "daily" ? "DAILY" : "WEEKLY"));
      lines.push("END:VEVENT");
    } else ev("kibo-rem-" + r.id + "@kibo", r.at, r.at + 60, r.text, false, "kibo reminder");
  }
  for (const t of todos || []) {
    if (!t || !t.due || t.done) continue;
    ev("kibo-todo-" + t.id + "@kibo", t.due, t.due + 1800, t.text, false, "kibo todo" + (t.rec ? " (repeats " + t.rec + ")" : ""));
  }
  for (const c of countdowns || []) {
    if (!c || !c.day || !/^\d{4}-\d{2}-\d{2}$/.test(c.day)) continue;
    const start = c.day;
    const endDay = new Date(Date.UTC(+c.day.slice(0, 4), +c.day.slice(5, 7) - 1, +c.day.slice(8, 10)) + 86400000).toISOString().slice(0, 10);
    ev("kibo-cd-" + c.id + "@kibo", start, endDay, c.name, true, "kibo countdown");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function handleIcs(env, chatId) {
  const L = await uiLang(env);
  const nowSec = Math.floor(Date.now() / 1000);
  const [remObj, todos, cds] = await Promise.all([
    getJSON(env, "reminders", {}),
    todoList(env),
    getJSON(env, COUNTDOWN_KEY, []),
  ]);
  const reminders = Object.keys(remObj || {})
    .map(k => Object.assign({ id: k }, remObj[k]))
    .filter(r => r && !r.done && typeof r.at === "number");
  const ics = buildIcs({ reminders, todos, countdowns: cds, nowSec, calName: "kibo" });
  const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
  if (!events) return reply(env, chatId, L.icsEmpty);

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", L.icsCap(events, reminders.length, (todos || []).filter(t => t.due && !t.done).length, (cds || []).length));
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([ics], { type: "text/calendar" }), "kibo.ics");
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendDocument", { method: "POST", body: form, signal: tgUpTmo(env) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) { tgErrLog(env, "sendDocument", j); return reply(env, chatId, L.icsFail); }
    if (env.__probe && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: "sendDocument", chat: chatId, text: "kibo.ics (" + events + " events)" });
    return j;
  } catch (_) {
    tgErrLog(env, "sendDocument", null);
    return reply(env, chatId, L.icsFail);
  }
}

export function qrFetchUrl(text, size) {
  const px = Math.min(1000, Math.max(120, parseInt(size, 10) || 512));
  return QR_API + "?size=" + px + "x" + px + "&margin=12&data=" + encodeURIComponent(String(text));
}

export async function handleQr(env, msg, chatId) {
  const L = await uiLang(env);
  const body = String((msg && msg.text) || "").replace(/^\/\S+\s*/, "").trim();
  const target = body || "";
  if (!target) return reply(env, chatId, L.qrUsage);
  if (target.length > QR_MAX_CHARS) return reply(env, chatId, L.qrTooLong(target.length, QR_MAX_CHARS));

  let buf = null;
  try {
    const r = await fetch(qrFetchUrl(target), { signal: tgUpTmo(env) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    buf = await r.arrayBuffer();
  } catch (_) { return reply(env, chatId, L.qrFail); }
  if (!buf || !buf.byteLength) return reply(env, chatId, L.qrFail);

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", L.qrCap(esc4(target)));
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([buf], { type: "image/png" }), "qr.png");
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendPhoto", { method: "POST", body: form, signal: tgUpTmo(env) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) { tgErrLog(env, "sendPhoto", j); return reply(env, chatId, L.qrFail); }
    if (env.__probe && j.ok) env.__probe.push({ mid: (j.result && j.result.message_id) || null, method: "sendPhoto", chat: chatId, text: String(target).slice(0, 400) });
    return j;
  } catch (_) {
    tgErrLog(env, "sendPhoto", null);
    return reply(env, chatId, L.qrFail);
  }
}
const esc4 = s => String(s).slice(0, 120).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
