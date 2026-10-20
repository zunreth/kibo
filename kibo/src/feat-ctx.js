import { getJSON, putJSON, reply, esc } from "./base.js";
import { uiLang } from "./ui.js";
import { UA, WIB, LFM_USER_KEY, LFM_USER_DEFAULT, NP_KEY, NP_TTL_MS, NP_FRESH_MS, MAL_TTL_MS, WX_LOC_KEY, WX_CTX_KEY, WX_TTL_MS } from "./consts.js";

async function cachedJSON(env, key, ttlMs, fetcher) {
  const c = await getJSON(env, key, null);
  if (c && c.exp > Date.now() && c.v !== undefined) return c.v;
  const v = await fetcher();
  try { await putJSON(env, key, { v: v === undefined ? null : v, exp: Date.now() + ttlMs }, env.DB ? { ttlMs } : undefined); } catch (_) {}
  return v;
}

const KITSU_BASE = "https://kitsu.io/api/edge";
const STATUS_EN = { finished: "finished", current: "ongoing", upcoming: "upcoming", unreleased: "unreleased", tba: "tba" };
const SEASON_EN = ["winter", "winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall"];
async function kitsuGet(path) {
  const r = await fetch(KITSU_BASE + path, { headers: { "user-agent": UA, accept: "application/vnd.api+json" } });
  if (!r.ok) throw new Error("Kitsu HTTP " + r.status);
  return await r.json();
}
function stripTags(s) { return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function attachCats(j) {
  const inc = new Map((j.included || []).map(x => [x.id, x]));
  for (const d of j.data || []) {
    const rel = (d.relationships && d.relationships.categories && d.relationships.categories.data) || [];
    d._cats = rel.map(x => inc.get(x.id)).filter(Boolean).map(x => x.attributes && x.attributes.title).filter(Boolean);
  }
  return j.data || [];
}
function slimMedia(m, unit) {
  const a = m && m.attributes;
  if (!a) return null;
  const title = (a.titles && (a.titles.en || a.titles.en_jp)) || a.canonicalTitle;
  if (!title) return null;
  const year = a.startDate ? String(a.startDate).slice(0, 4) : "?";
  const n = unit === "ch" ? (a.chapterCount ? a.chapterCount + " ch" : "?") : (a.episodeCount ? a.episodeCount + " eps" : "?");
  const g = (m._cats || []).slice(0, 3).join(", ");
  const score = a.averageRating ? (parseFloat(a.averageRating) / 10).toFixed(1) : "-";
  return title + " (" + year + ") — ★" + score + " · " + n + " · " + (STATUS_EN[a.status] || a.status || "?") + (g ? "\nGenres: " + g : "") + (a.synopsis ? "\nSynopsis: " + stripTags(a.synopsis).slice(0, 220) + "..." : "");
}
function slimList(j, cap) {
  const d = (j && j.data) || [];
  if (!d.length) return null;
  return d.slice(0, cap).map((m, i) => { const a = m.attributes || {}; return (i + 1) + ". " + (a.canonicalTitle || "?") + (a.averageRating ? " (★" + (parseFloat(a.averageRating) / 10).toFixed(1) + ")" : ""); }).join("\n");
}
export async function animeLookup(env, kind, q) {
  kind = String(kind || "").toLowerCase().trim();
  q = String(q || "").trim().slice(0, 80);
  if (!["anime", "manga", "char", "season", "top", "random"].includes(kind)) throw new Error("anime_lookup: unknown kind '" + kind + "' (use anime|manga|char|season|top|random)");
  if (kind === "random") return slimMedia((await kitsuGet("/anime?page[limit]=1&page[offset]=" + Math.floor(Math.random() * 15000))).data[0], "eps") || "random pick failed, try again";
  const cacheKey = "kitsu:" + kind + ":" + q.toLowerCase();
  return cachedJSON(env, cacheKey, MAL_TTL_MS, async () => {
    if (kind === "anime") return slimMedia(attachCats(await kitsuGet("/anime?filter[text]=" + encodeURIComponent(q) + "&page[limit]=1&include=categories"))[0], "eps");
    if (kind === "manga") return slimMedia(attachCats(await kitsuGet("/manga?filter[text]=" + encodeURIComponent(q) + "&page[limit]=1&include=categories"))[0], "ch");
    if (kind === "char") {
      const j = await kitsuGet("/characters?filter[name]=" + encodeURIComponent(q) + "&page[limit]=1");
      const a = ((j.data || [])[0] || {}).attributes;
      if (!a) return null;
      const name = (a.names && (a.names.en || a.names.en_jp)) || a.canonicalName || "?";
      const about = stripTags(a.description);
      return name + (about ? "\nAbout: " + about.slice(0, 300) + "..." : "");
    }
    if (kind === "season") {
      const d = new Date((Math.floor(Date.now() / 1000) + WIB) * 1000);
      const s = slimList(await kitsuGet("/anime?filter[season]=" + SEASON_EN[d.getUTCMonth()] + "&filter[seasonYear]=" + d.getUTCFullYear() + "&sort=-userCount&page[limit]=5"), 5);
      return s ? "Currently airing this season:\n" + s : null;
    }
    if (kind === "top") { const s = slimList(await kitsuGet("/anime?sort=-userCount&page[limit]=5"), 5); return s ? "Most popular anime on Kitsu:\n" + s : null; }
    return null;
  });
}
export async function handleAnime(env, kind, chatId, q) {
  const L = await uiLang(env);
  q = String(q || "").trim().slice(0, 80);
  if (!q) return reply(env, chatId, L.malUsage(kind));
  let out = null;
  try { out = await animeLookup(env, kind, q); } catch (_) {}
  if (!out) return reply(env, chatId, L.malNone(esc(q)));
  await reply(env, chatId, (kind === "manga" ? L.mangaHead : L.animeHead) + esc(String(out).slice(0, 3000)));
}

async function lfmRaw(env) {
  if (!env.LASTFM_KEY) return null;
  const user = (await env.KV.get(LFM_USER_KEY)) || env.LASTFM_USER || LFM_USER_DEFAULT;
  const r = await fetch("https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&format=json&limit=1&user=" + encodeURIComponent(user) + "&api_key=" + env.LASTFM_KEY, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error("LastFM HTTP " + r.status);
  const j = await r.json();
  const t = j && j.recenttracks && Array.isArray(j.recenttracks.track) ? j.recenttracks.track[0] : null;
  if (!t || !t.name) return null;
  return { track: String(t.name).slice(0, 80), artist: String((t.artist && t.artist["#text"]) || "").slice(0, 80), live: !!(t["@attr"] && t["@attr"].nowplaying === "true"), uts: t.date && t.date.uts ? parseInt(t.date.uts, 10) : Math.floor(Date.now() / 1000) };
}
export async function lfmNow(env) {
  try { return await cachedJSON(env, NP_KEY, NP_TTL_MS, () => lfmRaw(env)); } catch (_) { return null; }
}
export async function npLine(env) {
  const t = await lfmNow(env);
  if (!t) return null;
  if (!t.live && Date.now() / 1000 - t.uts > NP_FRESH_MS / 1000) return null;
  const what = "\"" + t.track + "\"" + (t.artist ? " by " + t.artist : "");
  return t.live ? "RIGHT NOW the user is listening to: " + what + " (their music player is active)." : "The user recently listened to: " + what + ".";
}
export async function handleNp(env, chatId) {
  const L = await uiLang(env);
  if (!env.LASTFM_KEY) return reply(env, chatId, L.npOff);
  let t = null;
  try { t = await lfmRaw(env); } catch (_) {}
  if (!t) return reply(env, chatId, L.npNone);
  const age = Math.round((Date.now() / 1000 - t.uts) / 60);
  await reply(env, chatId, L.npCard(esc(t.track), esc(t.artist), t.live, age));
}

const WX_DESC = { 0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain", 71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains", 80: "light showers", 81: "showers", 82: "violent showers", 85: "snow showers", 86: "snow showers", 95: "thunderstorm", 96: "thunderstorm, hail", 99: "thunderstorm, hail" };
export async function geocode(env, q) {
  const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" + encodeURIComponent(q), { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error("Geocode HTTP " + r.status);
  const j = await r.json();
  const g = j && j.results && j.results[0];
  return g ? { lat: g.latitude, lon: g.longitude, name: [g.name, g.admin1, g.country].filter(Boolean).join(", ") } : null;
}
async function wxRaw(env) {
  const loc = await getJSON(env, WX_LOC_KEY, null);
  if (!loc || !loc.lat) return null;
  const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon + "&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto", { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error("OpenMeteo HTTP " + r.status);
  const j = await r.json();
  const c = j && j.current, d = j && j.daily;
  if (!c || !d || !Array.isArray(d.temperature_2m_max)) return null;
  return { name: loc.name, t: Math.round(c.temperature_2m), f: Math.round(c.apparent_temperature), desc: WX_DESC[c.weather_code] || "?", hi: Math.round(d.temperature_2m_max[0]), lo: Math.round(d.temperature_2m_min[0]), rain: (d.precipitation_probability_max && d.precipitation_probability_max[0]) || 0 };
}
export async function wxNow(env) {
  try { return await cachedJSON(env, WX_CTX_KEY, WX_TTL_MS, () => wxRaw(env)); } catch (_) { return null; }
}
export async function wxLine(env) {
  const w = await wxNow(env);
  if (!w) return null;
  return "Local weather for " + w.name + ": " + w.t + "\u00B0C (feels " + w.f + "\u00B0C), " + w.desc + ", today " + w.hi + "\u00B0/" + w.lo + "\u00B0, rain chance " + w.rain + "%.";
}
export async function handleWx(env, msg, chatId, q) {
  const L = await uiLang(env);
  q = String(q || "").trim().slice(0, 60);
  let loc = await getJSON(env, WX_LOC_KEY, null);
  if (q) {
    let g = null;
    try { g = await geocode(env, q); } catch (_) {}
    if (!g) return reply(env, chatId, L.wxLocNone(esc(q)));
    try { await putJSON(env, WX_LOC_KEY, { lat: g.lat, lon: g.lon, name: g.name }); } catch (_) {}
    try { await putJSON(env, WX_CTX_KEY, { v: null, exp: 0 }); } catch (_) {}
    loc = g;
  }
  if (!loc) return reply(env, chatId, L.wxAsk);
  const w = await wxNow(env);
  if (!w) return reply(env, chatId, L.wxNone);
  await reply(env, chatId, L.wxCard(esc(w.name), w));
}
