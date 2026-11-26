import { mutateWith } from './once.js';

export async function questMutate(env, fn) {
  try {
    const out = await mutateWith(env, "quest", {}, cur => {
      const q = (cur && typeof cur === "object" && !Array.isArray(cur)) ? cur : {};
      const r = fn(q) || {};
      if (r.abort) return { val: q, okNow: false, r };
      const pts = q.points || 0, sh = q.shields || 0;
      return { val: q, okNow: back => (back.points || 0) === pts && (back.shields || 0) === sh && (!r.okNow || r.okNow(back)), r };
    });
    return out ? { q: out.val, r: out.r || {} } : null;
  } catch (_) {
    return null;
  }
}
