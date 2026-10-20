import { wrapKV } from "./kv.js";

export const KV_SIDE = ["owner_chat", "otp_mask", "mail_hist"];

let SWEEP_LAST = 0;

export function wrapStore(env) {
  const kvL = wrapKV(env);
  const db = env.DB;
  if (!db) return kvL;

  async function d1Get(k) {
    const row = await db.prepare("SELECT val, exp FROM kv WHERE key = ?1").bind(k).first();
    if (!row) return null;
    if (row.exp !== null && row.exp < Date.now()) {
      try { await db.prepare("DELETE FROM kv WHERE key = ?1").bind(k).run(); } catch (_) {}
      return null;
    }
    return row.val;
  }

  return {
    async get(k) {
      if (KV_SIDE.includes(k)) return await kvL.get(k);
      try {
        return await d1Get(k);
      } catch (_) {
        return await kvL.get(k);
      }
    },
    async put(k, val, opts) {
      if (KV_SIDE.includes(k)) return await kvL.put(k, val, opts);
      const exp = opts && opts.ttlMs ? Date.now() + opts.ttlMs : null;
      try {
        await db.prepare(
          "INSERT INTO kv (key, val, exp, updated) VALUES (?1, ?2, ?3, ?4) " +
          "ON CONFLICT(key) DO UPDATE SET val = ?2, exp = ?3, updated = ?4"
        ).bind(k, val, exp, Date.now()).run();
      } catch (e) {
        console.error("store-d1 put fail:", k, String((e && e.message) || e).slice(0, 140));
        try { await kvL.put(k, val, undefined); } catch (_) {}
      }
    },
    async delete(k) {
      if (KV_SIDE.includes(k)) return await kvL.delete(k);
      try {
        await db.prepare("DELETE FROM kv WHERE key = ?1").bind(k).run();
      } catch (_) {
        try { await kvL.delete(k); } catch (_) {}
      }
    },
  };
}

export async function d1Sweep(env) {
  const db = env.DB;
  if (!db) return;
  const now = Date.now();
  if (now - SWEEP_LAST < 3600000) return;
  SWEEP_LAST = now;
  try {
    await db.prepare("DELETE FROM kv WHERE exp IS NOT NULL AND exp < ?1").bind(now).run();
  } catch (e) {
    console.error("d1Sweep:", String((e && e.message) || e).slice(0, 140));
  }
}

export async function addPoints(env, key, n) {
  const db = env.DB;
  if (!db) throw new Error("addPoints butuh binding D1 (env.DB)");
  const step = Number(n) || 0;
  const row = await db.prepare(
    "INSERT INTO kv (key, val, exp, updated) VALUES (?1, ?2, NULL, ?3) " +
    "ON CONFLICT(key) DO UPDATE SET val = json_set(kv.val, '$.points', MAX(0, COALESCE(json_extract(kv.val, '$.points'), 0) + ?4)), updated = ?3 " +
    "RETURNING val"
  ).bind(key, JSON.stringify({ points: step }), Date.now(), step).first();
  return row && row.val ? JSON.parse(row.val) : null;
}

export async function d1Stats(env) {
  const db = env.DB;
  if (!db) return null;
  const now = Date.now();
  let ok = false, ms = 0;
  try {
    const t0 = Date.now();
    await db.prepare("INSERT OR REPLACE INTO kv (key, val, exp, updated) VALUES ('__sysdiag', '{}', NULL, ?1)").bind(now).run();
    const r = await db.prepare("SELECT val FROM kv WHERE key = '__sysdiag'").bind().first();
    await db.prepare("DELETE FROM kv WHERE key = '__sysdiag'").bind().run();
    ok = !!r; ms = Date.now() - t0;
  } catch (_) { return { ok: false, ms: -1, rows: null, ttl: null, wr: null }; }
  try {
    const d = new Date(now);
    const utc0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const c = await db.prepare("SELECT COUNT(*) AS n, SUM(exp IS NOT NULL) AS ttl, SUM(updated >= ?1) AS wr FROM kv WHERE key != '__sysdiag'").bind(utc0).first();
    return { ok, ms, rows: c ? c.n : null, ttl: c && c.ttl ? c.ttl : 0, wr: c && c.wr ? c.wr : 0 };
  } catch (_) { return { ok, ms, rows: null, ttl: null, wr: null }; }
}
