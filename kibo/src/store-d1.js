import { wrapKV } from "./kv.js";

export const KV_SIDE = ["owner_chat", "otp_mask", "mail_hist"];

let SWEEP_LAST = 0;

export function wrapStore(env) {
  const kvL = wrapKV(env);
  env.__kvShadow = kvL; // writer to the raw KV fallback (used by shadowSync)
  const db = env.DB;
  if (!db) return kvL;

  async function d1Get(k) {
    const row = await db.prepare("SELECT val, exp FROM kv WHERE key = ?1").bind(k).first();
    if (!row) return null;
    if (row.exp !== null && row.exp < Date.now()) {
      // NF-251017-3: hapus hanya kalau exp masih yang kadaluarsa — put yang renew di antara SELECT/DELETE gak ikut kebuang
      try { await db.prepare("DELETE FROM kv WHERE key = ?1 AND exp = ?2").bind(k, row.exp).run(); } catch (_) {}
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
        // B11: TTL asli ikut diselametin (exp epoch-ms -> expiration epoch-detik, clamp >=60s) — tanpa ini gagal-D1 jadi bayangan permanen di KV (NF-251017-2)
        try { await kvL.put(k, val, exp ? { expiration: Math.max(Math.floor(exp / 1000), Math.floor(Date.now() / 1000) + 60) } : undefined); } catch (_) {}
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
    const sh = await readShadowMarker(env);
    return { ok, ms, rows: c ? c.n : null, ttl: c && c.ttl ? c.ttl : 0, wr: c && c.wr ? c.wr : 0, sh };
  } catch (_) { return { ok, ms, rows: null, ttl: null, wr: null, sh: null }; }
}

// --- D1 -> KV shadow mirror (fallback consistency) ---
const SHADOW_MARKER = "__shadow_sync";
const SHADOW_KEY1 = "quest";

async function rawKV(env) {
  // write to the raw fallback KV (bypass wrapStore so it doesn't loop back to D1)
  const w = env.__kvShadow || wrapKV(env);
  return { put: (k, v, opts) => w.put(k, v, opts), get: (k) => w.get(k) };
}

async function readShadowMarker(env) {
  try {
    const w = await rawKV(env);
    const raw = await w.get(SHADOW_MARKER);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return { at: j.at || 0, n: j.n || 0, keys: j.keys || [] };
  } catch (_) { return null; }
}

export async function shadowInfo(env) {
  const m = await readShadowMarker(env);
  if (!m) return null;
  const ageMs = Date.now() - (m.at || 0);
  return { ageMs, n: m.n, keys: m.keys || [] };
}

export async function shadowSync(env, now) {
  const db = env.DB;
  if (!db) return;
  now = now === undefined ? Date.now() : now;
  // KV free quota is tight (~1000 writes/day). We never full-mirror more than
  // once per SHADOW_INTERVAL (default 6h), based on the durable marker's age
  // (survives isolate eviction), and only touch the "hot" quest/chain keys in
  // between (throttled). This keeps drift low without burning the write budget.
  try {
    const r = await db.prepare("SELECT key, val, exp FROM kv WHERE key != '__sysdiag'").bind().all();
    const results = Array.isArray(r) ? r : (r && r.results) || [];
    const w = await rawKV(env);
    const marker = await readShadowMarker(env);
    const lastFull = marker ? marker.at : 0;
    const full = now - lastFull > (env.SHADOW_INTERVAL_MS || 21600000); // 6h
    const lastHot = marker && marker.hotAt ? marker.hotAt : 0;
    const hot = (now - lastHot > (env.SHADOW_HOT_MS || 600000)) && !full; // 10min
    let n = 0, keys = [];
    for (const row of results || []) {
      const kk = row && row.key;
      if (!kk || KV_SIDE.includes(kk)) continue;
      if (row.exp !== null && row.exp < now) continue;
      const ttl = row.exp ? Math.max(60, Math.floor((row.exp - now) / 1000)) : undefined;
      const isHot = kk.startsWith("chain:") || kk === SHADOW_KEY1;
      if (full || (hot && isHot)) {
        // change-detection: only write when the shadow copy differs, so the
        // steady-state write budget stays near zero (full mirror of N keys only
        // re-writes actual drift, hot refresh only re-writes when quest changed).
        try {
          const cur = await w.get(kk);
          if (cur === row.val) continue;
        } catch (_) { /* missing/read-err -> write below */ }
        await w.put(kk, row.val, ttl ? { expirationTtl: ttl } : undefined);
        n++; keys.push(kk);
      }
    }
    if (full || n) {
      try {
        const m = await readShadowMarker(env);
        await w.put(SHADOW_MARKER, JSON.stringify({ at: full ? now : (m && m.at) || 0, hotAt: now, n, keys }), { expirationTtl: 86400 });
      } catch (_) {}
    }
    if (full) console.error("shadowSync: full mirror", n, "keys");
  } catch (e) {
    console.error("shadowSync:", String((e && e.message) || e).slice(0, 140));
  }
}
