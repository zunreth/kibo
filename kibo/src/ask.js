import { getJSON, putJSON } from './base.js';
import { ASK_KEY } from './consts.js';

const ASK_TTL_MS = 600000;

export async function askSet(env, k, d) { await putJSON(env, ASK_KEY, { k, d: d || null, ts: Date.now() }); }

export async function askGet(env) {
  const a = await getJSON(env, ASK_KEY, null);
  if (!a || !a.k) return null;
  if (Date.now() - (a.ts || 0) >= ASK_TTL_MS) { await env.KV.delete(ASK_KEY); return null; }
  return a;
}

export async function askClear(env) { await env.KV.delete(ASK_KEY); }
