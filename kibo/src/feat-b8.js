import { getJSON, putJSON, tg, reply, esc } from './base.js';
import { uiLang, UI_SEP } from './ui.js';
import { READLIST_KEY, READLIST_MAX, OTD_KEY, SHORT_KEY, SHORT_URL_MAX, WRAP_KEY, WRAP_GAP_MS, WRAP_TOP, LFM_TRACKS_MAX, WRAP_SHOW, LFM_USER_KEY, LFM_USER_DEFAULT, SYS_WRAP, LANG_KEY, PASTE_KEY, PASTE_MAX, PASTE_TTL_MS, WIB, UA } from './consts.js';

import { chatStream } from './feat-personal.js';
import { stripThink, langLine } from './ai.js';
import { mdTg, upstreamTmo } from './base.js';

async function editView(env, chatId, mid, view) {
  if (mid) {
    const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
    if (j && j.ok) return j;
    if (j && String(j.description || "").includes("message is not modified")) return j;
  }
  return tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

function rlBuild(L, rl) {
  const done = rl.list.filter(x => x.done).length;
  const lines = rl.list.length
    ? rl.list.map(x => (x.done ? "✅" : "⬜") + " #" + x.id + " <b>" + esc(x.title) + "</b>").join("\n")
    : L.rlEmpty;
  return {
    text: L.rlTitle + UI_SEP + L.rlProg(done, rl.list.length) + (lines ? "\n" + lines : "") + UI_SEP + L.rlHint,
    markup: { inline_keyboard: [
      ...(rl.list.length ? [rl.list.map(x => ({ text: (x.done ? "↩" : "✔") + " #" + x.id, callback_data: "rl:t:" + x.id })), rl.list.map(x => ({ text: "🗑 #" + x.id, callback_data: "rl:d:" + x.id }))] : []),
      [{ text: L.rlAdd, callback_data: "rl:add" }, { text: L.home, callback_data: "menu" }]
    ] }
  };
}

export async function rlItems(env, chatId) {
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  return (rl && rl.list) || [];
}
export async function rlAddCore(env, chatId, title) {
  const t = String(title || "").replace(/[<>]/g, "").trim().slice(0, 120);
  if (!t) return { ok: false, why: "empty" };
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  if ((rl.list || []).length >= READLIST_MAX) return { ok: false, why: "full", max: READLIST_MAX };
  const id = (rl.list || []).reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
  rl.list.unshift({ id, title: t, done: 0 });
  await putJSON(env, READLIST_KEY + chatId, rl);
  return { ok: true, id, title: t, n: rl.list.length };
}
export async function rlSetDone(env, chatId, id, done) {
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  const x = (rl.list || []).find(i => i.id === Number(id));
  if (!x) return null;
  x.done = done ? 1 : 0;
  await putJSON(env, READLIST_KEY + chatId, rl);
  return x;
}
export async function rlRemove(env, chatId, id) {
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  const x = (rl.list || []).find(i => i.id === Number(id));
  if (!x) return null;
  rl.list = rl.list.filter(i => i.id !== Number(id));
  await putJSON(env, READLIST_KEY + chatId, rl);
  return x;
}
export async function rlAdd(env, chatId, title) {
  const L = await uiLang(env);
  const r = await rlAddCore(env, chatId, title);
  if (!r.ok) return reply(env, chatId, r.why === "full" ? L.rlFull(READLIST_MAX) : L.rlUsage);
  return reply(env, chatId, L.rlAdded(r.id, esc(r.title)));
}

export async function rlView(env, chatId, mid) {
  const L = await uiLang(env);
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  return editView(env, chatId, mid, rlBuild(L, rl));
}

export async function rlToggle(env, chatId, mid, id) {
  const L = await uiLang(env);
  const cur = (await rlItems(env, chatId)).find(i => i.id === Number(id));
  if (cur) await rlSetDone(env, chatId, id, !cur.done);
  return editView(env, chatId, mid, rlBuild(L, { list: await rlItems(env, chatId) }));
}

export async function rlDel(env, chatId, mid, id) {
  const L = await uiLang(env);
  await rlRemove(env, chatId, id);
  return editView(env, chatId, mid, rlBuild(L, { list: await rlItems(env, chatId) }));
}

const OTD_API = "https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/";
function otdStrip(s) { return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
async function otdFetch(env) {
  const now = new Date(Date.now() + WIB * 1000);
  const mm = now.getUTCMonth() + 1, dd = now.getUTCDate();
  const key = OTD_KEY + mm + "-" + dd;
  const hit = await getJSON(env, key, null);
  if (hit && hit.exp > Date.now()) return hit.v;
  const r = await fetch(OTD_API + mm + "/" + dd, { headers: { "user-agent": "kibo-otd/1.0 (reading-list; no auth)" }, signal: upstreamTmo(env) });
  if (!r.ok) throw new Error("OTD HTTP " + r.status);
  const j = await r.json();
  const sel = (j.selected || []).slice(0, 5);
  const fact = { mm, dd, sel: sel.map(e => { const s = otdStrip(e.text); return { year: e.year, text: s.length > 240 ? s.slice(0, 240) + "…" : s }; }) };
  try { await putJSON(env, key, { v: fact, exp: Date.now() + 6 * 3600 * 1000 }); } catch (_) {}
  return fact;
}

export async function otdView(env, chatId, mid) {
  const L = await uiLang(env);
  let fact;
  try { fact = await otdFetch(env); } catch (_) {
    if (mid) return editView(env, chatId, mid, { text: L.otdFail, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } });
    return reply(env, chatId, L.otdFail);
  }
  const mo = (L.mons && L.mons[fact.mm - 1]) || String(fact.mm);
  const head = L.otdHeader((mo || ""), String(fact.dd), null).replace(/\n$/, "");
  let body;
  if (!fact.sel.length) body = L.otdIntro;
  else body = fact.sel.map(x => "<b>" + x.year + "</b> — " + esc(x.text)).join("\n\n");
  const view = { text: head + "\n\n" + body + "\n" + UI_SEP + L.otdHint, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  if (mid) return editView(env, chatId, mid, view);
  return tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

const CODE_ALPH = "abcdefghijkmnopqrstuvwxyz23456789";
export function rndCode(len) {
  const n = Math.max(4, Math.min(24, len || 7));
  const out = new Array(n);
  const g = globalThis.crypto;
  if (g && g.getRandomValues) {
    const buf = new Uint8Array(n);
    g.getRandomValues(buf);
    for (let i = 0; i < n; i++) out[i] = CODE_ALPH[buf[i] % CODE_ALPH.length];
  } else {
    for (let i = 0; i < n; i++) out[i] = CODE_ALPH[Math.floor(Math.random() * CODE_ALPH.length)];
  }
  return out.join("");
}
function shValid(u) { return /^https?:\/\//i.test(u) && u.length <= SHORT_URL_MAX; }
export function shortHost(env) {
  return String((env && (env.SHORT_HOST || env.SELF_BASE)) || "")
    .replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export async function shorten(env, raw) {
  const u = String(raw || "").trim();
  const host = shortHost(env);
  if (!u) return { ok: false, why: "empty" };
  if (!shValid(u)) return { ok: false, why: "bad", max: SHORT_URL_MAX };
  if (!host) return { ok: false, why: "nohost" };
  let code = rndCode(7);
  for (let i = 0; i < 3 && (await getJSON(env, SHORT_KEY + code, null)); i++) code = rndCode(7);
  await putJSON(env, SHORT_KEY + code, { url: u, ts: Date.now() });
  return { ok: true, code, short: "https://" + host + "/s/" + code, url: u };
}
export async function shortAdd(env, chatId, raw) {
  const L = await uiLang(env);
  const r = await shorten(env, raw);
  if (!r.ok) return reply(env, chatId, r.why === "bad" ? L.shnBad : L.shnUsage);
  return reply(env, chatId, L.shnMade(esc(r.short), esc(r.url)));
}

export async function shortResolve(env, code) {
  const hit = await getJSON(env, SHORT_KEY + String(code || "").trim(), null);
  return hit && hit.url ? hit.url : null;
}

async function lfmGet(env, method, extra) {
  const user = (await env.KV.get(LFM_USER_KEY)) || env.LASTFM_USER || LFM_USER_DEFAULT;
  const url = "https://ws.audioscrobbler.com/2.0/?method=" + method + "&format=json&user=" + encodeURIComponent(user) + "&api_key=" + env.LASTFM_KEY + (extra || "");
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: upstreamTmo(env) });
  if (!r.ok) throw new Error("LFM HTTP " + r.status);
  return r.json();
}
function thou(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function fmtDur(s) { if (s >= 86400) return Math.floor(s / 86400) + "d " + Math.floor((s % 86400) / 3600) + "h"; if (s >= 3600) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m"; return Math.max(1, Math.floor(s / 60)) + "m"; }
async function wrapFetch(env, period) {
  const jt = await lfmGet(env, "user.gettoptracks", "&limit=" + LFM_TRACKS_MAX + "&period=" + period);
  const raw = (jt.toptracks && jt.toptracks.track || []);
  const durs = raw.map(t => parseInt(t.duration, 10) || 0).filter(x => x > 0);
  const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 210;
  const tracks = raw.slice(0, WRAP_TOP).map(t => ({ name: t.name, artist: t.artist && t.artist.name, plays: parseInt(t.playcount, 10) || 0 }));
  let artists = [], artistsTotal = 0, scrobbles = 0;
  try {
    const ja = await lfmGet(env, "user.gettopartists", "&limit=5&period=" + period);
    artists = (ja.topartists && ja.topartists.artist || []).slice(0, 3).map(a => ({ name: a.name, plays: parseInt(a.playcount, 10) || 0 }));
    artistsTotal = (ja.topartists && ja.topartists["@attr"] ? parseInt(ja.topartists["@attr"].total, 10) : 0) || 0;
  } catch (_) {}
  try {
    const jr = await lfmGet(env, "user.getrecenttracks", "&limit=1&period=" + period);
    scrobbles = (jr.recenttracks && jr.recenttracks["@attr"] ? parseInt(jr.recenttracks["@attr"].total, 10) : 0) || 0;
  } catch (_) {}
  return { tracks, artists, artistsTotal, scrobbles, avgDur, distinctTracks: (jt.toptracks && jt.toptracks['@attr'] ? parseInt(jt.toptracks['@attr'].total, 10) : 0) };
}

export async function wrapView(env, chatId, mid, arg) {
  const L = await uiLang(env);
  if (!env.LASTFM_KEY) { await reply(env, chatId, L.wWrapOff); return; }
  const pk = WRAP_KEY + chatId;
  const last = parseInt((await env.KV.get(pk)) || "0", 10) || 0;
  if (last && Date.now() - last < WRAP_GAP_MS) { await reply(env, chatId, L.wThrottle); return; }
  await env.KV.put(pk, String(Date.now()));
  const period = /7day|1month|3month|6month|12month/.test(arg || "") ? arg : "1month";
  try {
    const d = await wrapFetch(env, period);
    if (!d.tracks.length) throw new Error("no tracks");
    const user = (await env.KV.get(LFM_USER_KEY)) || env.LASTFM_USER || LFM_USER_DEFAULT;
    const artistCount = new Set(d.tracks.map(t => t.artist)).size;
    const estSec = d.scrobbles ? d.scrobbles * d.avgDur : 0;
    const a0 = d.artists[0];
    const sharePct = a0 && d.scrobbles ? Math.round(a0.plays / d.scrobbles * 100) : 0;
    const stats = [];
    if (d.scrobbles) stats.push(L.wStatPlays(thou(d.scrobbles)));
    if (estSec) stats.push(L.wStatTime(fmtDur(estSec)));
    if (d.distinctTracks) stats.push(L.wStatSongs(thou(d.distinctTracks)));
    if (d.artistsTotal) stats.push(L.wStatArtists(thou(d.artistsTotal)));
    const lines = [
      "USERNAME: " + user,
      "PERIOD: " + period,
      "TOP TRACKS (verified, in order, with play counts):",
      ...d.tracks.map((t, i) => (i + 1) + ". \"" + t.name + "\" by " + t.artist + " — " + t.plays + " plays"),
      "TOP ARTISTS (verified): " + (d.artists.length ? d.artists.map(a => a.name + " (" + a.plays + " plays)").join(", ") : "n/a"),
      "PERIOD TOTALS (verified): " + d.scrobbles + " plays, " + d.distinctTracks + " different songs, " + (d.artistsTotal || artistCount) + " artists" + (estSec ? ", est. listening time " + fmtDur(estSec) : "") + (sharePct ? ", #1 artist = " + sharePct + "% of plays" : ""),
      "MOST PLAYED: " + d.tracks[0].name + " by " + d.tracks[0].artist + " (" + d.tracks[0].plays + " plays)"
    ];
    const msgs = [{ role: "system", content: SYS_WRAP }, { role: "user", content: lines.join("\n") + "\n\n" + langLine(await env.KV.get(LANG_KEY)) }];
    let out = "";
    for await (const dd of chatStream(env, msgs, 700)) out += dd;
    const txt = stripThink(out).trim();
    if (!txt) throw new Error("empty wrap");
    const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
    const trackLines = d.tracks.slice(0, WRAP_SHOW).map((t, i) => (medals[i] || (i + 1) + ".") + " <b>" + esc(t.name) + "</b> — " + esc(t.artist) + " · " + L.wPlays(t.plays));
    const artLines = d.artists.map((a, i) => (i + 1) + ". <b>" + esc(a.name) + "</b> · " + L.wPlays(a.plays));
    const view = L.wTitle
      + "📅 " + L.wPeriod(period) + UI_SEP + "\n"
      + trackLines.join("\n") + "\n\n"
      + L.wTopArtists + artLines.join("\n") + (a0 && sharePct ? "\n" + L.wArtistShare(esc(a0.name), sharePct) : "") + "\n\n"
      + L.wStats + stats.join("\n") + "\n" + UI_SEP + "\n"
      + L.wVibe + mdTg(esc(txt)) + UI_SEP + "\n"
      + L.wHint;
    await reply(env, chatId, view);
  } catch (_) {
    await env.KV.delete(pk).catch(() => {});
    let msg = L.wFail;
    if (!env.LASTFM_KEY) msg = L.wWrapOff;
    await reply(env, chatId, msg);
  }
}

export async function pasteAdd(env, chatId, raw) {
  const L = await uiLang(env);
  const t = String(raw || "").trim();
  if (!t) return reply(env, chatId, L.pasteUsage);
  if (t.length > PASTE_MAX) return reply(env, chatId, L.pasteBig(PASTE_MAX));
  const id = rndCode(10);
  await putJSON(env, PASTE_KEY + id, { t, ts: Date.now() }, { ttlMs: PASTE_TTL_MS });
  const host = shortHost(env);
  if (!host) return reply(env, chatId, L.pasteUsage);
  const url = "https://" + host + "/p/" + id;
  return reply(env, chatId, L.pasteMade(esc(t.slice(0, 40) + (t.length > 40 ? "…" : "")), esc(url), t.length, Math.round(PASTE_TTL_MS / 86400000)));
}

export async function pasteGet(env, id) {
  const hit = await getJSON(env, PASTE_KEY + String(id || "").trim(), null);
  return hit && hit.t ? hit.t : null;
}

const HN_KEY = "hn_top";
const HN_TTL_MS = 30 * 60 * 1000;
export async function hnTop(env, n) {
  let hits = [];
  try {
    const c = await getJSON(env, HN_KEY, null);
    if (c && Array.isArray(c.hits) && c.hits.length) hits = c.hits;
    if (!hits.length) {
      const r = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=20", { headers: { "user-agent": UA }, signal: upstreamTmo(env) });
      if (!r.ok) throw new Error("HN HTTP " + r.status);
      const j = await r.json().catch(() => null);
      hits = ((j && j.hits) || []).filter(h => h && h.title).slice(0, 15).map(h => ({ t: String(h.title), u: h.url || ("https://news.ycombinator.com/item?id=" + h.objectID), p: h.points || 0, c: h.num_comments || 0 }));
      if (hits.length) { try { await putJSON(env, HN_KEY, { hits }, env.DB ? { ttlMs: HN_TTL_MS } : undefined); } catch (_) {} }
    }
  } catch (_) { return []; }
  return hits.slice(0, Math.min(15, Math.max(1, n || 10)));
}
export async function handleHn(env, chatId, arg) {
  const L = await uiLang(env);
  let n = parseInt(String(arg || "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) n = 10;
  n = Math.min(n, 15);
  const hits = await hnTop(env, n);
  if (!hits.length) return reply(env, chatId, L.hnFail);
  const lines = hits.slice(0, n).map((h, i) => (i + 1) + ". <a href=\"" + esc(h.u) + "\">" + esc(h.t) + "</a> · " + h.p + " pts · " + h.c + " 💬");
  return reply(env, chatId, L.hnCard(lines.join("\n")));
}
