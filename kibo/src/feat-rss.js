import {
  AI_TEXT,
  AI_VISION,
  AI_STT,
  AI_STT_FB,
  AI_TTS,
  TTS_KEY,
  TTS_MAX,
  UA,
  WIB,
  DAYS,
  SYS_CHAT,
  SYS_SUMMARIZE,
  CHAT_HIST_KEY,
  NUKE_KEY,
  LAST_AI_KEY,
  REGEN_LOCK_KEY,
  CONT_CHAIN_KEY,
  SELF_BASE,
  NUKE_CAP,
  CHAT_HIST_MAX,
  MEM_KEY,
  MEM_MAX,
  OWNER_FALLBACK,
  CHAR_KEY,
  CHAR_ACTIVE_KEY,
  CHAR_MAX,
  CHAR_IMPORT_KEY,
  CMEM_PREFIX,
  PERSONA_KEY,
  AI_CFG_KEY,
  LEN_KEY,
  LANG_KEY,
  UI_LANG_KEY,
  STATS_KEY,
  BOT_VER,
  WIZ_KEY,
  PRESET_KEY,
  PRESET_MAX,
  PRESET_IMPORT_KEY,
  PRESET_COMPILED_CAP,
  RP_FORMAT,
  VAULT_CHAT_KEY,
  FILE_INDEX_KEY,
  VAULT_SNAPS_KEY,
  VAULT_CFG_KEY,
  VAULT_BIND_KEY,
  VAULT_REN_KEY,
  VAULT_OP_KEY,
  FILE_MAX,
  SNAP_MAX,
  ABORT_KEY,
  ABORT_TOK,
  NOTE_ABORT,
  WD_CUT_NOTE,
  LIVE_GEN,
  INCEPTION,
  LAST_CF,
  LIVE_CTX,
  setLiveCtx,
  setLastCf,
} from './consts.js';
import {
  esc,
  mdTg,
  getJSON,
  putJSON,
  tg,
  reply,
  delCmd,
  notify,
  scheduleDelete,
  tgFileBytes,
  tryDeleteIds,
  KV_DEAF,
  NUKE_BUFS,
  trackNukeMsg,
  flushNukeBuf,
  nukeGone,
  nukeSleep,
} from './base.js';
import {
  STAMP_LAST,
  stampAlive,
  QUOTA_NOTED,
  onUpdErr,
  FV_ACCOUNT,
  FV_NS,
  FV_FLAG_KEY,
  FV_OTP_BASE,
  FV_MODE,
  fvActive,
  fvNextUTCMidnight,
  fvFetch,
  fvPut,
  fvGet,
  fvDelete,
  fvFlag,
  wrapKV,
  STATS_BUF,
  STATS_FLUSH_LAST,
  bumpStats,
  flushStatsBuf,
} from './kv.js';
import {
  UI,
  uiLang,
  fmtTok,
  fmtWIB,
  nowWIB,
  UI_SEP,
} from './ui.js';
import {
  TOOLS_AGENT,
  ddgHost,
  ddgLite,
  newsRSS,
  ddgHtml,
  wikiSearch,
  keyedSearch,
  webSearch,
  execTool,
  toolLabel,
  THINK_OP,
  THINK_CL,
  DET_OP,
  DET_CL,
  holdTail,
  makeThinkFilter,
  stripThink,
  QUOTE_META_RE,
  QUOTE_META_RE2,
  quoteIsMeta,
  makeQuoteFilter,
  stripQuoteMeta,
  streamReply,
  fetchPageText,
  ttsLang,
  audioBuf,
  tgUpload,
  ttsSpeak,
  LEN_HINT,
  langLine,
  aiConf,
  listBridgeModels,
} from './ai.js';

export function renderFeeds(feeds, L) {
  L = L || UI.en;
  if (!feeds.length) return { text: L.feedEmpty, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  return {
    text: L.feedTitle + UI_SEP + feeds.map(f => "#" + f.id + " \u2014 " + esc(f.title)).join("\n"),
    markup: { inline_keyboard: feeds.map(f => [{ text: "\u{1F5D1} #" + f.id, callback_data: "fdel:" + f.id }]).concat([[{ text: L.home, callback_data: "menu" }]]) }
  };
}

export async function resolveFeedUrl(u, env) {
  let m;
  if ((m = u.match(/youtube\.com\/channel\/(UC[\w-]+)/))) {
    return "https://www.youtube.com/feeds/videos.xml?channel_id=" + m[1];
  }
  if ((m = u.match(/youtube\.com\/@([\w.-]+)/))) {
    try {
      const r = await fetch("https://www.youtube.com/@" + m[1], { headers: { "user-agent": UA }, signal: AbortSignal.timeout(parseInt(env.RSS_TIMEOUT_MS || "") || 15000) });
      const html = await r.text();
      const cid = (html.match(/"channelId":"(UC[\w-]+)"/) || html.match(/channel\/(UC[\w-]{20,})/) || [])[1];
      if (cid) return "https://www.youtube.com/feeds/videos.xml?channel_id=" + cid;
    } catch (_) {}
    return u;
  }
  return u;
}

export function decodeEnt(s) {
  return String(s == null ? "" : s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function cleanTag(block, tag) {
  const m = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  if (!m) return "";
  const s = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return decodeEnt(s);
}

export function parseFeed(xml) {
  const items = [];
  const re = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < 30) {
    const block = m[0];
    const title = cleanTag(block, "title");
    const link = (block.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || cleanTag(block, "link");
    const guid = cleanTag(block, "guid") || cleanTag(block, "id") || link || title;
    items.push({ title: title, link: link, guid: guid });
  }
  return items;
}

export async function handleRss(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const sub = body.split(/\s+/)[0] || "";
  const nowSec = Math.floor(Date.now() / 1000);
  if (sub === "add") {
    const rawUrl = body.split(/\s+/).slice(1).find(x => /^https?:\/\//.test(x));
    if (!rawUrl) { await reply(env, chatId, L.rssAddUse); return; }
    const url = await resolveFeedUrl(rawUrl, env);
    let r;
    try { r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(parseInt(env.RSS_TIMEOUT_MS || "") || 15000) }); }
    catch (e) { await reply(env, chatId, L.rssFetchFail(e && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : String((e && e.message) || e || "error"))); return; }
    if (!r.ok) { await reply(env, chatId, L.rssFetchFail(r.status)); return; }
    const xml = await r.text();
    if (!/<(item|entry)[\s>]/i.test(xml)) { await reply(env, chatId, L.rssBad); return; }
    const title = decodeEnt(((xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()).slice(0, 120);
    const feeds = await getJSON(env, "feeds", []);
    let fid;
    const exist = feeds.find(f => f.url === url);
    if (exist) { fid = exist.id; }
    else {
      fid = parseInt((await env.KV.get("feed_seq")) || "0", 10) + 1;
      await env.KV.put("feed_seq", String(fid));
      feeds.push({ id: fid, url: url, title: title || url });
      await putJSON(env, "feeds", feeds);
    }
    const seen = await getJSON(env, "seen_" + fid, {});
    for (const it of parseFeed(xml).slice(0, 30)) {
      const g = it.guid || it.link || it.title;
      if (g) seen[g] = nowSec;
    }
    await putJSON(env, "seen_" + fid, seen);
    await notify(env, chatId, L.rssAdded(esc(title || url)));
  } else if (sub === "list") {
    const view = renderFeeds(await getJSON(env, "feeds", []), await uiLang(env));
    await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
  } else if (sub === "del") {
    const id = parseInt(body.split(/\s+/)[1], 10);
    if (!id) { await reply(env, chatId, L.rssDelUse); return; }
    let feeds = await getJSON(env, "feeds", []);
    const before = feeds.length;
    feeds = feeds.filter(f => f.id !== id);
    if (feeds.length === before) { await reply(env, chatId, L.rssGone(id)); return; }
    await putJSON(env, "feeds", feeds);
    await env.KV.delete("seen_" + id);
    await notify(env, chatId, L.rssDeleted(id));
  } else {
    await reply(env, chatId, L.rssUse);
  }
}

export async function checkFeeds(env, nowSec) {
  const feeds = await getJSON(env, "feeds", []);
  const owner = parseInt((await env.KV.get("owner_chat")) || "0", 10);
  for (const f of feeds) {
    try {
      const r = await fetch(f.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(parseInt(env.RSS_TIMEOUT_MS || "") || 15000) });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = parseFeed(xml);
      let sent = 0;
      let changed = false;
      const seen = await getJSON(env, "seen_" + f.id, {});
      for (const it of items.slice(0, 8)) {
        const guid = it.guid || it.link || it.title;
        if (!guid || seen[guid]) continue;
        seen[guid] = nowSec;
        changed = true;
        if (owner && sent < 5) {
          await reply(env, owner, "\u{1F4E3} <b>" + esc(f.title) + "</b>\n" + esc(it.title) + (it.link ? "\n" + esc(it.link) : ""));
          sent++;
        }
      }
      if (changed) {
        const keys = Object.keys(seen);
        if (keys.length > 400) {
          keys.sort((a, b) => seen[a] - seen[b]);
          for (const k of keys.slice(0, keys.length - 400)) delete seen[k];
        }
        await putJSON(env, "seen_" + f.id, seen);
      }
    } catch (e) {
      console.error("feed err:", f.url, (e && e.message) || e);
    }
  }
}
