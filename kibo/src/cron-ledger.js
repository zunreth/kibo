import { getJSON, putJSON } from "./base.js";


export const CRON_LEDGER_KEY = "cron_beat";
export const CRON_BEAT_WRITE_MS = 5 * 60 * 1000;

export const CRON_JOBS = [
  ["cron", 1], ["stats", 1], ["nuke", 1], ["d1", 1], ["shadow", 1], ["delq", 1],
  ["nhwatch", 1], ["dive", 1], ["divegen", 1], ["gameidle", 1]
];

export function cronStaleAt(job, ts) {
  const iv = (CRON_JOBS.find(j => j[0] === job) || ["", 5])[1];
  return Date.now() - ts > Math.max(10 * 60000, iv * 3 * 60000);
}

export async function cronLedger(env) {
  return (await getJSON(env, CRON_LEDGER_KEY, null)) || {};
}

let BEAT_CHAIN = Promise.resolve();

export async function cronBeat(env, job, ok, err) {
  const run = BEAT_CHAIN.then(() => beatOnce(env, job, ok, err));
  BEAT_CHAIN = run.then(() => {}, () => {});
  return run;
}

async function beatOnce(env, job, ok, err) {
  const now = Date.now();
  let led;
  try { led = await cronLedger(env); } catch (_) { led = {}; }
  const prev = led[job] || {};
  const next = {
    ts: now,
    ok: !!ok,
    n: (prev.n || 0) + 1,
    fail: (prev.fail || 0) + (ok ? 0 : 1),
    err: ok ? "" : String((err && err.message) || err || "").slice(0, 120),
    w: prev.w || 0
  };
  const changed = prev.ok !== next.ok;
  if (!changed && now - (prev.w || 0) < CRON_BEAT_WRITE_MS) return next;
  next.w = now;
  led[job] = next;
  try { await putJSON(env, CRON_LEDGER_KEY, led); } catch (_) {}
  return next;
}
