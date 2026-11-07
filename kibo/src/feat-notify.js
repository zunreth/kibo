// feat-notify — Notify API: POST /notify dgn bearer token statis (secret NOTIFY_TOKEN)
// → push PERMANEN ke owner chat. Notify-only (bukan request-bin): payload gak disimpen di mana pun.
import { getJSON, putJSON, tg, esc } from './base.js';
import { NOTIFY_DAY_KEY, NOTIFY_CAP } from './consts.js';
import { dbgLog } from './feat-debug.js';

const notifyDay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const jr = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { "content-type": "application/json" } });
const timingSafeEq = (a, b) => {
  const ab = new TextEncoder().encode(String(a)), bb = new TextEncoder().encode(String(b));
  if (ab.byteLength !== bb.byteLength) return false;
  let d = 0;
  for (let i = 0; i < ab.length; i++) d |= ab[i] ^ bb[i];
  return d === 0;
};

export async function handleNotify(request, env) {
  if (request.method !== "POST") return jr(405, { ok: false, err: "POST only" });
  if (!env.NOTIFY_TOKEN) return jr(503, { ok: false, err: "notify disabled — NOTIFY_TOKEN belum diset" });
  const auth = request.headers.get("authorization") || "";
  if (!timingSafeEq(auth, "Bearer " + env.NOTIFY_TOKEN)) return jr(401, { ok: false, err: "unauthorized" });
  let body = {};
  try { body = await request.json(); } catch (_) { return jr(400, { ok: false, err: "body bukan JSON valid" }); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 1000) return jr(400, { ok: false, err: "text wajib ada, 1..1000 char" });
  const owner = await env.KV.get("owner_chat");
  if (!owner) return jr(503, { ok: false, err: "owner chat belum ada — /start dulu di TG" });
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 40) : "";
  dbgLog(env, "notify", (source ? source + ": " : "") + text.slice(0, 80));
  const day = notifyDay();
  const rec = await getJSON(env, NOTIFY_DAY_KEY, null);
  const n = rec && rec.d === day ? rec.n || 0 : 0;
  if (n >= NOTIFY_CAP) return jr(429, { ok: false, err: "daily cap " + NOTIFY_CAP + " notify terlampaui" });
  const msg = (title ? "\uD83D\uDD14 <b>" + esc(title) + "</b>\n" : "\uD83D\uDD14 ") + (source ? "[" + esc(source) + "] " : "") + esc(text);
  const j = await tg(env, "sendMessage", { chat_id: owner, text: msg, parse_mode: "HTML" });
  if (!j || !j.ok) return jr(502, { ok: false, err: "telegram gak nerima (delivery checked)" });
  await putJSON(env, NOTIFY_DAY_KEY, { d: day, n: n + 1 }, { ttlMs: 36 * 3600 * 1000 });
  return jr(200, { ok: true });
}
