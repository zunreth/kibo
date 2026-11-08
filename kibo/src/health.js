// R-03: dead-man switch. The bot pings an external check (healthchecks.io or equivalent); if the
// cron stops firing, the ping stops arriving and the alarm is raised from outside this machine —
// which matters because the monitor we already have runs on the very VPS it watches.
//
// Deliberately optional: with no HEALTHCHECK_URL secret this is a no-op, so nothing breaks before
// the owner creates the check. `/fail` is pinged on a failed tick so a broken cron is not mistaken
// for a dead worker.

export const HC_MIN_GAP_MS = 60000;
let HC_LAST = 0;

export async function hcPing(env, ok) {
  const raw = env && env.HEALTHCHECK_URL;
  if (!raw) return false;
  const now = Date.now();
  // A cron tick is a minute apart, but a retry storm must not turn into a ping storm.
  if (ok && now - HC_LAST < HC_MIN_GAP_MS) return false;
  HC_LAST = now;
  const url = ok ? String(raw) : String(raw).replace(/\/+$/, "") + "/fail";
  try {
    await fetch(url, { signal: AbortSignal.timeout(8000) });
    return true;
  } catch (_) {
    return false;
  }
}
