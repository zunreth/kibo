
export const HC_MIN_GAP_MS = 60000;
let HC_LAST = 0;

export async function hcPing(env, ok) {
  const raw = env && env.HEALTHCHECK_URL;
  if (!raw) return false;
  const now = Date.now();
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
