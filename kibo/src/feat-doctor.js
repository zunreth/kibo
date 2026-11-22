
import { esc, tg } from "./base.js";
import { cronLedger, CRON_JOBS, cronStaleAt } from "./cron-ledger.js";
import { aiConf } from "./ai.js";
import { d1Stats } from "./store-d1.js";
import { fmtDur } from "./feat-personal.js";
import { UI, uiLang } from "./ui.js";

export const BACKUP_STAMP_KEY = "backup_last";
export const BACKUP_STALE_MS = 36 * 60 * 60 * 1000;
export const DOCTOR_PROBE_TMO = 8000;

export const OK = "ok", BAD = "bad", UNKNOWN = "unknown";

async function checkKV(env) {
  try {
    const t0 = Date.now();
    await env.KV.put("__doctorkv", String(t0));
    const v = await env.KV.get("__doctorkv");
    await env.KV.delete("__doctorkv");
    if (!v) return { k: "kv", state: BAD };
    return { k: "kv", state: OK, ms: Date.now() - t0 };
  } catch (_) { return { k: "kv", state: BAD } }
}

async function checkD1(env) {
  const s = await d1Stats(env);
  if (!s) return { k: "d1", state: UNKNOWN };
  if (!s.ok) return { k: "d1", state: BAD };
  return { k: "d1", state: OK, ms: s.ms, rows: s.rows };
}

async function checkCron(env) {
  let led = {};
  try { led = await cronLedger(env); } catch (_) { return { k: "cron", state: UNKNOWN } }
  const now = Date.now();
  const stale = [], fresh = [];
  for (const [job] of CRON_JOBS) {
    const b = led[job];
    if (!b || !b.ts) continue;
    (cronStaleAt(job, b.ts) || b.ok === false ? stale : fresh).push(job);
  }
  if (!fresh.length && !stale.length) return { k: "cron", state: UNKNOWN };
  const allStale = fresh.length === 0;
  return {
    k: "cron", state: allStale ? BAD : OK,
    fresh: fresh.length, total: fresh.length + stale.length, stale: stale.slice(0, 4),
    worstMs: stale.length ? Math.max(...stale.map(j => now - ((led[j] && led[j].ts) || now))) : 0
  };
}

async function checkAI(env) {
  let cf;
  try { cf = await aiConf(env); } catch (_) { return { k: "ai", state: UNKNOWN } }
  if (!cf || !cf.base || !cf.key) return { k: "ai", state: BAD, why: "no AI_BASE/AI_KEY" };
  let host = "-";
  try { host = new URL(cf.base).host; } catch (_) { return { k: "ai", state: BAD, why: "AI_BASE is not a URL" } }
  const t0 = Date.now();
  try {
    const r = await fetch(cf.base.replace(/\/+$/, "") + "/models", {
      headers: { authorization: "Bearer " + cf.key }, signal: AbortSignal.timeout(DOCTOR_PROBE_TMO)
    });
    const ms = Date.now() - t0;
    if (r.status === 401 || r.status === 403) return { k: "ai", state: BAD, why: "HTTP " + r.status + " (key rejected)", host, model: cf.model };
    if (r.status === 404 || r.status === 405) return { k: "ai", state: UNKNOWN, why: "no /models endpoint", host, model: cf.model, ms };
    if (!r.ok) return { k: "ai", state: BAD, why: "HTTP " + r.status, host, model: cf.model, ms };
    return { k: "ai", state: OK, host, model: cf.model, ms };
  } catch (e) {
    const why = /timeout|abort/i.test(String(e && e.name) + String(e && e.message)) ? "timeout " + Math.round(DOCTOR_PROBE_TMO / 1000) + "s" : "unreachable";
    return { k: "ai", state: BAD, why, host, model: (cf && cf.model) || "-", ms: Date.now() - t0 };
  }
}

async function checkNH(env) {
  const base = env && env.NH_API;
  if (!base) return { k: "nh", state: UNKNOWN, why: "no NH_API secret" };
  const t0 = Date.now();
  try {
    const r = await fetch(String(base).replace(/\/+$/, "") + "/", { signal: AbortSignal.timeout(DOCTOR_PROBE_TMO) });
    const ms = Date.now() - t0;
    if (r.status >= 500) return { k: "nh", state: BAD, why: "HTTP " + r.status, ms };
    return { k: "nh", state: OK, ms, code: r.status };
  } catch (e) {
    return { k: "nh", state: BAD, why: "unreachable", ms: Date.now() - t0 };
  }
}

async function checkBackup(env) {
  let raw = null;
  try { raw = await env.KV.get(BACKUP_STAMP_KEY); } catch (_) { return { k: "backup", state: UNKNOWN } }
  let ts = Number(String(raw == null ? "" : raw).replace(/["';\s]/g, ""));
  if (ts > 0 && ts < 1e12) ts *= 1000;
  if (!raw || !ts || !isFinite(ts)) return { k: "backup", state: UNKNOWN, why: "no stamp yet" };
  const age = Date.now() - ts;
  return { k: "backup", state: age > BACKUP_STALE_MS ? BAD : OK, ageMs: age };
}

export async function doctorChecks(env) {
  const probes = [checkKV, checkD1, checkCron, checkAI, checkNH, checkBackup];
  const out = [];
  for (const p of probes) {
    try { out.push(await p(env)); } catch (e) { out.push({ k: "?", state: UNKNOWN, why: String((e && e.message) || e).slice(0, 40) }) }
  }
  return out;
}

export function doctorLine(L, c) {
  if (c.k === "kv") return (c.state === OK ? "\u2705 " : c.state === UNKNOWN ? "\u2754 " : "\u26A0\uFE0F ") + L.doctorKV(c.state === OK ? c.ms : null);
  if (c.k === "d1") return (c.state === OK ? "\u2705 " : c.state === UNKNOWN ? "\u2754 " : "\u26A0\uFE0F ") + (c.state === OK ? L.doctorD1(c.rows, c.ms) : L.doctorD1Bad);
  if (c.k === "cron") return (c.state === OK ? "\u2705 " : c.state === UNKNOWN ? "\u2754 " : "\u26A0\uFE0F ") +
    (c.state === OK ? L.doctorCron(c.fresh, c.total) + (c.stale.length ? " \u00b7 " + esc(c.stale.join(",")) : "") : c.state === UNKNOWN ? L.doctorCronNone : L.doctorCronStale(c.stale.join(",")));
  if (c.k === "ai") return (c.state === OK ? "\u2705 " : c.state === UNKNOWN ? "\u2754 " : "\u26A0\uFE0F ") +
    (c.state === OK ? L.doctorAI(esc(c.model || "-"), esc(c.host || "-"), c.ms) : L.doctorAIBad(esc(c.model || "-"), esc(c.host || "-"), esc(c.why || "?")));
  if (c.k === "nh") return (c.state === OK ? "\u2705 " : c.state === UNKNOWN ? "\u2754 " : "\u26A0\uFE0F ") +
    (c.state === OK ? L.doctorNH(c.code, c.ms) : c.state === UNKNOWN ? L.doctorNHNone : L.doctorNHBad(esc(c.why || "?")));
  if (c.k === "backup") return (c.state === OK ? "\u2705 " : c.state === UNKNOWN ? "\u2754 " : "\u26A0\uFE0F ") +
    (c.state === OK ? L.doctorBackup(fmtDur(c.ageMs)) : c.state === UNKNOWN ? L.doctorBackupNone : L.doctorBackupOld(fmtDur(c.ageMs)));
  return "\u2754 " + esc(c.k) + " \u00b7 " + esc(c.why || "unknown");
}

export async function doctorLang(env) {
  try { return await uiLang(env); } catch (_) { return UI.en; }
}

export async function doctorView(env) {
  const L = await doctorLang(env);
  const checks = await doctorChecks(env);
  const bad = checks.filter(c => c.state === BAD);
  const unknown = checks.filter(c => c.state === UNKNOWN);
  const verdict = bad.length
    ? L.doctorProblems(bad.length) + " \u00b7 " + bad.map(c => c.k).join(", ")
    : L.doctorAllOk + (unknown.length ? " \u00b7 " + L.doctorUnknown(unknown.length) : "");
  const text = L.doctorTitle + "\n" + checks.map(c => doctorLine(L, c)).join("\n") + "\n\n" + verdict;
  return {
    text,
    ok: bad.length === 0,
    problems: bad.map(c => c.k),
    markup: { inline_keyboard: [[{ text: L.back, callback_data: "nav:stats" }, { text: L.home, callback_data: "menu" }]] }
  };
}

export async function handleDoctor(env, chatId, mid) {
  const v = await doctorView(env);
  if (mid) return tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}
