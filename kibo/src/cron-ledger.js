import { getJSON, putJSON } from "./base.js";

// R-02: cron heartbeat ledger. One key holds the last run of every scheduled job, so a job that
// quietly stops firing shows up in /sys instead of being discovered weeks later. Writes are
// throttled to once per CRON_BEAT_WRITE_MS unless the ok/fail state changes, because this code runs
// every minute and the KV write budget is 1000/day (a beat per job per minute would eat it whole).

export const CRON_LEDGER_KEY = "cron_beat";
export const CRON_BEAT_WRITE_MS = 5 * 60 * 1000;

// [job name, expected interval in minutes] — used to decide when a heartbeat counts as stale.
export const CRON_JOBS = [
  ["cron", 1], ["stats", 1], ["nuke", 1], ["d1", 1], ["shadow", 1], ["delq", 1],
  ["nhwatch", 1], ["dive", 1], ["divegen", 1], ["gameidle", 1]
];

// A job is stale when it misses three of its own intervals, with a 10 minute floor so a slow
// isolate start is not reported as a failure.
export function cronStaleAt(job, ts) {
  const iv = (CRON_JOBS.find(j => j[0] === job) || ["", 5])[1];
  return Date.now() - ts > Math.max(10 * 60000, iv * 3 * 60000);
}

export async function cronLedger(env) {
  return (await getJSON(env, CRON_LEDGER_KEY, null)) || {};
}

// The ledger is one JSON blob, so two beats running at the same time (they do: every job is fired
// through one Promise.all) would each read-modify-write it and clobber each other — heartbeats go
// missing, ages drift, and a healthy job starts looking stale. Every beat is therefore queued
// through this chain: reads and writes stay strictly sequential inside the isolate.
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
