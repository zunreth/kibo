import { getJSON, putJSON, tg, reply, esc } from './base.js';
import { uiLang, UI_SEP } from './ui.js';
import { READLIST_KEY, READLIST_MAX, OTD_KEY, SHORT_KEY, SHORT_COUNT_KEY, SHORT_URL_MAX, WRAP_KEY, WRAP_GAP_MS, WRAP_TOP, LFM_TRACKS_MAX, WRAP_SHOW, LFM_USER_KEY, LFM_USER_DEFAULT, SYS_WRAP, LANG_KEY, PASTE_KEY, PASTE_MAX, PASTE_TTL_MS, WIB, UA } from './consts.js';

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

export async function rlAdd(env, chatId, title) {
  const L = await uiLang(env);
  const t = String(title || "").replace(/[<>]/g, "").trim().slice(0, 120);
  if (!t) return reply(env, chatId, L.rlUsage);
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  if ((rl.list || []).length >= READLIST_MAX) return reply(env, chatId, L.rlFull(READLIST_MAX));
  const id = (rl.list || []).reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
  rl.list.unshift({ id, title: t, done: 0 });
  await putJSON(env, READLIST_KEY + chatId, rl);
  return reply(env, chatId, L.rlAdded(id, esc(t)));
}

export async function rlView(env, chatId, mid) {
  const L = await uiLang(env);
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  return editView(env, chatId, mid, rlBuild(L, rl));
}

export async function rlToggle(env, chatId, mid, id) {
  const L = await uiLang(env);
  const rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  const x = (rl.list || []).find(i => i.id === Number(id));
  if (x) { x.done = x.done ? 0 : 1; await putJSON(env, READLIST_KEY + chatId, rl); }
  return editView(env, chatId, mid, rlBuild(L, rl));
}

export async function rlDel(env, chatId, mid, id) {
  const L = await uiLang(env);
  let rl = await getJSON(env, READLIST_KEY + chatId, { list: [] });
  rl.list = (rl.list || []).filter(i => i.id !== Number(id));
  await putJSON(env, READLIST_KEY + chatId, rl);
  return editView(env, chatId, mid, rlBuild(L, rl));
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

const B62_ALPH = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function b62(n) { let s = ""; do { s = B62_ALPH[n % 62] + s; n = Math.floor(n / 62); } while (n > 0); return s; }
function shValid(u) { return /^https?:\/\//i.test(u) && u.length <= SHORT_URL_MAX; }

export async function shortAdd(env, chatId, raw) {
  const L = await uiLang(env);
  const u = String(raw || "").trim();
  if (!u) return reply(env, chatId, L.shnUsage);
  if (!shValid(u)) return reply(env, chatId, L.shnBad);
  const cnt = await getJSON(env, SHORT_COUNT_KEY, { n: 0 });
  const n = (cnt.n || 0) + 1;
  const code = b62(n);
  await putJSON(env, SHORT_KEY + code, { url: u, ts: Date.now() });
  await putJSON(env, SHORT_COUNT_KEY, { n });
  const host = env.SHORT_HOST || env.SELF_BASE || "";
  if (!host) return reply(env, chatId, L.shnUsage);
  const short = "https://" + host + "/s/" + code;
  return reply(env, chatId, L.shnMade(esc(short), esc(u)));
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

const PB62_ALPH = "abcdefghijklmnopqrstuvwxyz0123456789";
function pb62(n) { let s = ""; do { s = PB62_ALPH[n % 36] + s; n = Math.floor(n / 36); } while (n > 0); return s; }

export async function pasteAdd(env, chatId, raw) {
  const L = await uiLang(env);
  const t = String(raw || "").trim();
  if (!t) return reply(env, chatId, L.pasteUsage);
  if (t.length > PASTE_MAX) return reply(env, chatId, L.pasteBig(PASTE_MAX));
  const id = pb62(Date.now() % 216 + 1) + "-" + pb62(Math.floor(Math.random() * 46655) + 1);
  await putJSON(env, PASTE_KEY + id, { t, ts: Date.now() }, { ttlMs: PASTE_TTL_MS });
  const host = env.SHORT_HOST || env.SELF_BASE || "";
  if (!host) return reply(env, chatId, L.pasteUsage);
  const url = "https://" + host + "/p/" + id;
  return reply(env, chatId, L.pasteMade(esc(t.slice(0, 40) + (t.length > 40 ? "…" : "")), esc(url), t.length, Math.round(PASTE_TTL_MS / 86400000)));
}

export async function pasteGet(env, id) {
  const hit = await getJSON(env, PASTE_KEY + String(id || "").trim(), null);
  return hit && hit.t ? hit.t : null;
}

// /hn — HN front page via algolia (1 fetch keyless, CF-egress verified 28 Okt) — cache 30 mnt
const HN_KEY = "hn_top";
const HN_TTL_MS = 30 * 60 * 1000;
export async function handleHn(env, chatId, arg) {
  const L = await uiLang(env);
  let n = parseInt(String(arg || "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) n = 10;
  n = Math.min(n, 15);
  let hits = [], fail = false;
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
  } catch (_) { fail = true; }
  if (!hits.length) return reply(env, chatId, L.hnFail);
  const lines = hits.slice(0, n).map((h, i) => (i + 1) + ". <a href=\"" + esc(h.u) + "\">" + esc(h.t) + "</a> · " + h.p + " pts · " + h.c + " 💬");
  return reply(env, chatId, L.hnCard(lines.join("\n")));
}
