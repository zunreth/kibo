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
import { tgErrLog, tgUpTmo } from './base.js';
import { dbgLog } from './feat-debug.js';
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
} from './ui.js';
import {
  sseObj,
  saveMemory,
  deleteMemory,
} from './feat-personal.js';
import {
  QUEST_MARK_RE,
  SQ_MARK_RE,
  addReminder,
  questMark,
  sideQuestNew,
  sideQuestResolve,
} from './feat-remind.js';
import {
  getActiveCard,
} from './feat-chars.js';
import { animeLookup } from './feat-ctx.js';
import {
  decodeEnt,
} from './feat-rss.js';
import {
  agentReminders,
  agentStatus,
  agentJournal,
  agentHabits,
  agentExpense,
  agentCountdown,
} from './feat-agent.js';

export const TOOLS_AGENT = [
  { type: "function", function: { name: "web_search", description: "Search the live web (news, prices, schedules, fresh facts). Use it when your knowledge might be stale.", parameters: { type: "object", properties: { query: { type: "string", description: "search keywords" } }, required: ["query"] } } },
  { type: "function", function: { name: "open_url", description: "Open a URL and read the page content as text.", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
  { type: "function", function: { name: "remember", description: "Store a durable long-term fact about the user (max 200 chars). Use it when the user shares important info that should persist across chats.", parameters: { type: "object", properties: { text: { type: "string", description: "the fact" } }, required: ["text"] } } },
  { type: "function", function: { name: "forget", description: "Delete a memory by id. Use it when the user says something was already done / is no longer valid — check the '#id | text' list in the system prompt, delete the stale ones, then confirm briefly.", parameters: { type: "object", properties: { id: { type: "integer", description: "memory id" } }, required: ["id"] } } },
  { type: "function", function: { name: "set_reminder", description: "Set a reminder for the user. Time formats: '2h', '30m', '21:30', 'besok 09:00' (=tomorrow), 'jumat 19:00' (=Friday 19:00).", parameters: { type: "object", properties: { when: { type: "string", description: "the time" }, text: { type: "string", description: "what to remind" } }, required: ["when", "text"] } } },
  { type: "function", function: { name: "anime_lookup", description: "Look up anime, manga, or characters (live data via Kitsu). Use it when the user asks about anime/manga titles, characters, the current season, or popularity charts.", parameters: { type: "object", properties: { kind: { type: "string", enum: ["anime", "manga", "char", "season", "top", "random"], description: "what to look up" }, q: { type: "string", description: "search query (title or character name); only needed for anime/manga/char" } }, required: ["kind"] } } },
  { type: "function", function: { name: "mark_quest", description: "Mark TODAY'S daily quest as done or skipped. Use it when the user says they completed the daily quest (or asks to skip it).", parameters: { type: "object", properties: { status: { type: "string", enum: ["done", "skip"], description: "the new quest status" } }, required: ["status"] } } },
  { type: "function", function: { name: "mark_sidequest", description: "Resolve the side quest you gave earlier as done or skipped, when the user says they finished it (or asks to skip).", parameters: { type: "object", properties: { status: { type: "string", enum: ["done", "skip"] } }, required: ["status"] } } },
  { type: "function", function: { name: "new_sidequest", description: "Record a NEW side quest the user asked for (a small bonus quest). The text is recorded by the system and re-posted to the user.", parameters: { type: "object", properties: { text: { type: "string", description: "short quest text" } }, required: ["text"] } } },
  { type: "function", function: { name: "reminders", description: "The user's reminders. action='list' returns every active reminder with its id and time. action='del' cancels one — pass id, or match=a chunk of its text. Always list first when the user is vague about which one.", parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "del"], description: "what to do" }, id: { type: "integer", description: "reminder id (for del)" }, match: { type: "string", description: "text to match when the id is unknown (for del)" } }, required: ["action"] } } },
  { type: "function", function: { name: "my_status", description: "One snapshot of the user's life data: level/XP, points, today's daily quest + streak/shields, open side quests, active reminders, last night's sleep, habits done today, money spent this month, journal activity, upcoming countdowns. Call it before answering anything like 'how am I doing', 'what's pending', 'how much did I spend'.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "journal", description: "The user's private journal. action='read' returns the latest entries (count=how many, default 3). action='write' appends an entry the user just dictated — keep their words and their #feeling tags.", parameters: { type: "object", properties: { action: { type: "string", enum: ["read", "write"], description: "what to do" }, text: { type: "string", description: "the entry (for write)" }, count: { type: "integer", description: "how many entries to read (default 3, max 10)" } }, required: ["action"] } } },
  { type: "function", function: { name: "habits", description: "The user's habit tracker. action='list' shows every habit with today's tick and streak. action='check' ticks one off for today and awards points — pass name (part of the habit name) or id.", parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "check"], description: "what to do" }, name: { type: "string", description: "habit name or id (for check)" } }, required: ["action"] } } },
  { type: "function", function: { name: "log_expense", description: "Record money the user spent. amount in rupiah, plain number (25000) or short form ('25k'). note = what it was for. Use it whenever the user mentions paying/buying something.", parameters: { type: "object", properties: { amount: { type: "string", description: "how much, e.g. 25000 or 25k" }, note: { type: "string", description: "what for, e.g. 'kopi'" } }, required: ["amount"] } } },
  { type: "function", function: { name: "countdown", description: "The days-until list (birthdays, deadlines, releases). action='list'; action='add' with name + date as YYYY-MM-DD; action='del' with id.", parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "add", "del"], description: "what to do" }, name: { type: "string", description: "what it is (for add)" }, date: { type: "string", description: "YYYY-MM-DD (for add)" }, id: { type: "integer", description: "countdown id (for del)" } }, required: ["action"] } } }
];

export function ddgHost(u) {
  const h = (String(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || "";
  return /(^|\.)duckduckgo\.com$/i.test(h);
}

export async function ddgLite(q) {
  const r = await fetch("https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return "";
  const html = await r.text();
  const links = [];
  const seen = new Set();
  const reA = /<a\s[^>]*>/gi;
  let m;
  while ((m = reA.exec(html)) && links.length < 8) {
    const tag = m[0];
    if (!/class=['"][^'"]*result-link/.test(tag)) continue;
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1] || "";
    if (!href) continue;
    let u = href;
    const um = href.match(/[?&]uddg=([^&]+)/);
    if (um) {
      try {
        let d = decodeURIComponent(um[1]);
        if (!/^https?:\/\//.test(d)) { try { d = decodeURIComponent(d); } catch (_) {} }
        u = d;
      } catch (_) {}
    }
    if (!/^https?:\/\//.test(u) || ddgHost(u) || seen.has(u)) continue;
    seen.add(u);
    const rest = html.slice(m.index);
    const endA = rest.indexOf("</a>");
    const title = endA > 0 ? decodeEnt(rest.slice(m[0].length, endA)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    links.push({ title: title, url: u });
  }
  const snippets = [];
  const reS = /class=['"][^'"]*result-snippet[^'"]*['"][^>]*>([\s\S]*?)<\/td>/gi;
  while ((m = reS.exec(html)) && snippets.length < 8) snippets.push(decodeEnt(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim());
  if (!links.length) return "";
  return links.slice(0, 5).map((l, i) => (i + 1) + ". " + (l.title || "(tanpa judul)") + "\n   " + l.url + (snippets[i] ? "\n   " + snippets[i].slice(0, 200) : "")).join("\n");
}

export async function newsRSS(q) {
  const r = await fetch("https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=id&gl=ID&ceid=ID:id", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return "";
  const xml = await r.text();
  const items = [];
  const re = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < 5) {
    const b = m[0];
    const t = ((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
    const l = ((b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "").trim();
    const d = ((b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "").trim();
    items.push({ t: decodeEnt(t).trim(), l: l, d: d });
  }
  if (!items.length) return "";
  return items.map((it, i) => (i + 1) + ". " + it.t + (it.d ? " (" + it.d + ")" : "") + "\n   " + it.l).join("\n") + "\n(hasil Google News)";
}

export async function ddgHtml(q) {
  const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return "";
  const html = await r.text();
  const links = [];
  const seen = new Set();
  const reA = /<a\s[^>]*class=['"][^'"]*result__a[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = reA.exec(html)) && links.length < 8) {
    const tag = m[0];
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1] || "";
    if (!href) continue;
    let u = href;
    const um = href.match(/[?&]uddg=([^&]+)/);
    if (um) {
      try {
        let d = decodeURIComponent(um[1]);
        if (!/^https?:\/\//.test(d)) { try { d = decodeURIComponent(d); } catch (_) {} }
        u = d;
      } catch (_) {}
    }
    if (!/^https?:\/\//.test(u) || ddgHost(u) || seen.has(u)) continue;
    seen.add(u);
    const title = decodeEnt(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    links.push({ title: title, url: u });
  }
  const snippets = [];
  const reS = /class=['"][^'"]*result__snippet[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = reS.exec(html)) && snippets.length < 8) snippets.push(decodeEnt(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim());
  if (!links.length) return "";
  return links.slice(0, 5).map((l, i) => (i + 1) + ". " + (l.title || "(tanpa judul)") + "\n   " + l.url + (snippets[i] ? "\n   " + snippets[i].slice(0, 200) : "")).join("\n");
}

export async function wikiSearch(q) {
  const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(q) + "&format=json&srlimit=5", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return "";
  const j = await r.json().catch(() => null);
  const arr = (j && j.query && j.query.search) || [];
  if (!arr.length) return "";
  return arr.slice(0, 5).map((it, i) => (i + 1) + ". " + decodeEnt(it.title).trim() + "\n   https://en.wikipedia.org/wiki/" + encodeURIComponent(String(it.title).replace(/ /g, "_")) + (it.snippet ? "\n   " + decodeEnt(it.snippet.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim().slice(0, 200) : "")).join("\n") + "\n(hasil Wikipedia)";
}

export async function keyedSearch(env, q) {
  const k = env.SEARCH_KEY;
  if (!k) return "";
  try {
    if (k.indexOf("tvly-") === 0) {
      const r = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json", "authorization": "Bearer " + k }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ query: q, max_results: 5 }) });
      if (!r.ok) return "";
      const j = await r.json().catch(() => null);
      const arr = (j && j.results) || [];
      if (!arr.length) return "";
      return arr.slice(0, 5).map((x, i) => (i + 1) + ". " + (x.title || "(tanpa judul)") + "\n   " + (x.url || "") + (x.content ? "\n   " + String(x.content).replace(/\s+/g, " ").trim().slice(0, 200) : "")).join("\n") + "\n(hasil Tavily)";
    }
    const r = await fetch("https://google.serper.dev/search", { method: "POST", headers: { "content-type": "application/json", "X-API-KEY": k }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ q: q, num: 5 }) });
    if (!r.ok) return "";
    const j = await r.json().catch(() => null);
    const arr = (j && j.organic) || [];
    if (!arr.length) return "";
    return arr.slice(0, 5).map((x, i) => (i + 1) + ". " + (x.title || "(tanpa judul)") + "\n   " + (x.link || "") + (x.snippet ? "\n   " + String(x.snippet).replace(/\s+/g, " ").trim().slice(0, 200) : "")).join("\n") + "\n(hasil Google/Serper)";
  } catch (_) { return ""; }
}

export async function webSearch(env, q) {
  let out = await keyedSearch(env, q);
  if (out) return out;
  try { out = await ddgLite(q); } catch (_) {}
  if (out) return out;
  try { out = await ddgHtml(q); } catch (_) {}
  if (out) return out;
  try { out = await wikiSearch(q); } catch (_) {}
  if (out) return out;
  try { out = await newsRSS(q); } catch (_) {}
  return out;
}

export async function execTool(env, name, argsJson, chatId) {
  dbgLog(env, "tool", name + " " + String(argsJson || "").slice(0, 140));
  let a = {};
  try { a = JSON.parse(argsJson || "{}"); } catch (_) {}
  let q = a.query || a.q || a.keywords || "";
  if (Array.isArray(q)) q = q.join(" ");
  const url = a.url || a.link || "";
  if (name === "remember") {
    const card = await getActiveCard(env);
    const id = await saveMemory(env, a.text, card ? CMEM_PREFIX + card.id : MEM_KEY);
    return id ? "saved as memory #" + id : "error: memory text is empty";
  }
  if (name === "forget") {
    const card = await getActiveCard(env);
    const mid2 = parseInt(a.id || a.mem_id || 0, 10);
    const ok = await deleteMemory(env, mid2, card ? CMEM_PREFIX + card.id : MEM_KEY);
    return ok ? "memory #" + mid2 + " deleted" : "error: memory #" + mid2 + " not found — check the '#id | text' list in the system prompt";
  }
  if (name === "set_reminder") {
    const r = await addReminder(env, chatId || parseInt((await env.KV.get("owner_chat")) || "0", 10), a.when, a.text);
    return r ? "reminder #" + r.id + " set: " + a.text + " @ " + fmtWIB(r.at, await uiLang(env)) : "error: couldn't parse the time. examples: 2h, 30m, 21:30, besok 09:00 (=tomorrow), jumat 19:00 (=Friday)";
  }
  if (name === "anime_lookup") {
    const out = await animeLookup(env, a.kind || "anime", q);
    return out || "no result found for that query \u2014 try a different spelling or a partial title";
  }
  if (name === "mark_quest") {
    const st = (a.status || "done").toLowerCase() === "skip" ? "skip" : "done";
    const r = await questMark(env, chatId || parseInt((await env.KV.get("owner_chat")) || "0", 10), st);
    return r.ok ? "daily quest marked " + st + " — points/streak recorded by the system" : "error: " + r.why + " (already resolved or not pitched today — do NOT call again, answer normally)";
  }
  if (name === "mark_sidequest") {
    const st = (a.status || "done").toLowerCase() === "skip" ? "skip" : "done";
    const ok = await sideQuestResolve(env, chatId || parseInt((await env.KV.get("owner_chat")) || "0", 10), st);
    return ok ? "side quest marked " + st : "error: no open side quest to resolve — answer normally";
  }
  if (name === "new_sidequest") {
    const t = String(a.text || "").trim().slice(0, 200);
    if (!t) return "error: quest text is empty";
    const ok = await sideQuestNew(env, chatId || parseInt((await env.KV.get("owner_chat")) || "0", 10), t);
    return ok ? "side quest recorded and re-posted to the user" : "error: could not record the side quest (slots may be full) — say so honestly WITHOUT any marker";
  }
  if (name === "reminders") return agentReminders(env, chatId || parseInt((await env.KV.get("owner_chat")) || "0", 10), a);
  if (name === "my_status") return agentStatus(env);
  if (name === "journal") return agentJournal(env, a);
  if (name === "habits") return agentHabits(env, a);
  if (name === "log_expense") return agentExpense(env, a);
  if (name === "countdown") return agentCountdown(env, a);
  if (name === "open_url" || (!q && url)) {
    if (!url) return "error: url is empty";
    const t = await fetchPageText(url);
    return t ? t.slice(0, 6000) : "couldn't open that page";
  }
  if (name !== "web_search") return "error: unknown tool \"" + name + "\" — do not call it again; answer from what you have";
  if (!q) return "error: query is empty";
  const out = await webSearch(env, q);
  if (!out) return "search tool returned nothing (providers may be temporarily blocked). DO NOT call web_search again — answer directly from your knowledge and mention the data may be stale. If the user named a specific site (wiki, docs, etc.), the open_url tool is still worth a try.";
  return out;
}

export function toolLabel(name, argsJson, L) {
  L = L || UI.en;
  let a = {};
  try { a = JSON.parse(argsJson || "{}"); } catch (_) {}
  if (name === "remember") return L.tlRemember + (a.text || "?");
  if (name === "forget") return L.tlForget + (a.id || "?");
  if (name === "set_reminder") return L.tlRemind + (a.when || "?") + ": " + (a.text || "?");
  if (name === "open_url") return L.tlOpen + (a.url || "?");
  if (name === "mark_quest") return L.tlMarkQ + (a.status || "done");
  if (name === "mark_sidequest") return L.tlMarkSq + (a.status || "done");
  if (name === "new_sidequest") return L.tlNewSq + (a.text || "?");
  if (name === "anime_lookup") {

    const k = a.kind || "anime";
    const lbl = { manga: L.tlManga, char: L.tlChar, season: L.tlSeason, top: L.tlTop, random: L.tlRandom }[k] || L.tlAnime;
    return lbl + (a.q || (k === "season" || k === "top" || k === "random" ? "" : "?"));
  }
  if (name === "reminders") return String(a.action || "list").toLowerCase() === "del" ? L.tlRemDel + (a.id || a.match || "?") : L.tlRemList;
  if (name === "my_status") return L.tlStatus;
  if (name === "journal") return String(a.action || "read").toLowerCase() === "write" ? L.tlJournalW : L.tlJournalR;
  if (name === "habits") return String(a.action || "list").toLowerCase() === "check" ? L.tlHabitChk + (a.name || a.id || "?") : L.tlHabitList;
  if (name === "log_expense") return L.tlExpense + (a.amount || "?") + (a.note ? " \u2014 " + a.note : "");
  if (name === "countdown") {
    const act = String(a.action || "list").toLowerCase();
    if (act === "del") return L.tlCdDel + (a.id || "?");
    if (act === "add") return L.tlCdAdd + (a.name || "?") + (a.date ? " \u2014 " + a.date : "");
    return L.tlCdList;
  }
  let q = a.query || a.q || a.keywords || "";
  if (Array.isArray(q)) q = q.join(" ");
  return L.tlSearch + ' "' + (q || "?") + '"';
}

export const THINK_OP = "<think>", THINK_CL = "</think>", DET_OP = "<details", DET_CL = "</details>";
export function holdTail(s, tags) {
  const maxLen = Math.max(...tags.map(t => t.length)) - 1;
  for (let k = Math.min(s.length, maxLen); k > 0; k--) {
    for (const t of tags) if (s.endsWith(t.slice(0, k))) return [s.slice(0, s.length - k), s.slice(s.length - k)];
  }
  return [s, ""];
}
export function makeThinkFilter(startMode) {
  let mode = startMode || 0;
  let buf = "";
  return {
    push(d) {
      buf += d;
      let out = "";
      for (;;) {
        if (mode === 1) {
          const i = buf.indexOf(THINK_CL);
          if (i >= 0) { buf = buf.slice(i + THINK_CL.length); mode = 0; continue; }
          const p = holdTail(buf, [THINK_CL]); buf = p[1]; return out;
        }
        if (mode === 2) {
          const i = buf.indexOf(DET_CL);
          if (i >= 0) { buf = buf.slice(i + DET_CL.length); mode = 0; continue; }
          const p = holdTail(buf, [DET_CL]); buf = p[1]; return out;
        }
        const it = buf.indexOf(THINK_OP), id = buf.indexOf(DET_OP);
        if (it >= 0 && (id < 0 || it < id)) { out += buf.slice(0, it); buf = buf.slice(it + THINK_OP.length); mode = 1; continue; }
        if (id >= 0) {
          const gt = buf.indexOf(">", id);
          if (gt < 0 && buf.length - id <= 160) { out += buf.slice(0, id); buf = buf.slice(id); return out; }
          if (gt >= 0) {
            const tag = buf.slice(id, gt + 1);
            out += buf.slice(0, id); buf = buf.slice(gt + 1);
            mode = 2; continue;
          }
          out += buf.slice(0, id + DET_OP.length); buf = buf.slice(id + DET_OP.length); continue;
        }
        const p = holdTail(buf, [THINK_OP, DET_OP]); buf = p[1]; return out + p[0];
      }
    },
    flush() {
      const t = buf; buf = "";
      return mode === 0 ? t : "";
    }
  };
}

export function stripThink(s) {
  let out = String(s || "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(new RegExp(DET_OP + "\\b[^>]*>[\\s\\S]*?" + DET_CL, "gi"), "");
  const om = out.match(/<think>[\s\S]*$/); if (om) out = out.slice(0, om.index);
  const dm = out.match(new RegExp(DET_OP + "\\b[^>]*>[\\s\\S]*$", "i")); if (dm) out = out.slice(0, dm.index);
  return out.replace(/^\s+/, "");
}

export const QUOTE_META_RE = /(word|paragraph|sentence|line)\s*count|\bPOV\b|check\s*bans?\b|\bbanned\b|\bban\s+list\b|within\s+\d+\s*[-\u2013\u2014~]+\s*\d+|\bsystem\s+prompt\b|output\s+language|double\s+quotes|time\s+header|self-?check|checklist|\brequirements?\b|\bconstraints?\b|word\s+target|total\s*[:=]?\s*~?\s*\d+\s*words/i;
export const QUOTE_META_RE2 = /fits\s+the\s+template|\bsystem\s+message\b|\boutput\s+rules?\b|\bno\s+tool\b|one\s+more\s+check|\bheader\s+syntax\b|\bmarker\b|\bformat\s+shows\b|i\s*'?ll\s+(go|keep|write|include|produce)|\bhmm\b\s*[,.]|\bi\s+think\s+a\b|let\s+me\s+(reconsider|finalize)|\bone\s+concern\b|\bgiven\s+the\b|should\s+i\s+include/i;
export function quoteIsMeta(block) {
  const t = block.replace(/^[\s>]+/gm, "");
  return QUOTE_META_RE.test(t) || QUOTE_META_RE2.test(t);
}
export function makeQuoteFilter() {
  let pend = "";
  let qacc = "";
  let started = false;
  const resolve = () => { const t = qacc; qacc = ""; if (!started) return ""; return quoteIsMeta(t) ? "" : t; };
  return {
    push(d) {
      pend += d;
      let out = "";
      for (;;) {
        const nl = pend.indexOf("\n");
        if (qacc) {
          if (nl < 0) {
            if (/^\s*>/.test(pend) || /^\s+$/.test(pend)) { qacc += pend; pend = ""; return out; }
            out += resolve();
            continue;
          }
          const line = pend.slice(0, nl + 1);
          if (/^\s*>/.test(line) || /^\s*$/.test(line)) { qacc += line; pend = pend.slice(line.length); continue; }
          out += resolve();
          continue;
        }
        if (nl < 0) {
          if (/^\s*>/.test(pend) || /^\s+$/.test(pend)) return out;
          if (pend.trim()) started = true;
          out += pend; pend = ""; return out;
        }
        const line = pend.slice(0, nl + 1);
        pend = pend.slice(line.length);
        if (/^\s*>/.test(line)) { qacc += line; continue; }
        if (line.trim()) started = true;
        out += line;
      }
    },
    flush() {
      let out = "";
      if (qacc) out += resolve();
      if (/^\s*>/.test(pend)) { if (started && !quoteIsMeta(pend)) out += pend; }
      else { if (pend.trim()) started = true; out += pend; }
      pend = "";
      return out;
    }
  };
}
export function stripQuoteMeta(s) {
  const lines = String(s || "").split("\n");
  const out = [];
  let qacc = null;
  let started = false;
  const flushQ = () => { if (qacc !== null) { const t = qacc.join("\n"); if (started && !quoteIsMeta(t)) out.push(t); qacc = null; } };
  for (const ln of lines) {
    if (/^\s*>/.test(ln) || (qacc !== null && /^\s*$/.test(ln))) { if (qacc === null) qacc = []; qacc.push(ln); continue; }
    flushQ();
    if (ln.trim()) started = true;
    out.push(ln);
  }
  flushQ();
  return out.join("\n");
}

export const AI_LOOP_MAX = 8, AI_LOOP_TTL_S = 600;
export function aiLoopHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export async function aiFetchRetry(url, init, env) {
  const req = init && init.signal ? init : Object.assign({}, init, { signal: AbortSignal.timeout(80000) });
  if (env && env.KV) {
    try {
      const h = aiLoopHash(url + "|" + String(req.body || ""));
      const k = "ai_loop:" + h;
      const n = (parseInt((await env.KV.get(k)) || "0", 10) || 0) + 1;
      if (n > AI_LOOP_MAX) {
        dbgLog(env, "ai", "loop-guard tripped x" + n + " " + h);
        throw new Error("AI loop guard: identical request repeated " + n + "x within " + Math.round(AI_LOOP_TTL_S / 60) + " min");
      }
      await env.KV.put(k, String(n), { ttlMs: AI_LOOP_TTL_S * 1000, expirationTtl: AI_LOOP_TTL_S });
    } catch (e) {
      if (/loop guard/.test(String(e && e.message))) throw e;
    }
  }
  let r = await fetch(url, { ...req, signal: req.signal }).catch(e => ({ __th: e }));
  if (r.__th || (!r.ok && r.status >= 500)) {
    if (req.signal && req.signal.aborted) { if (r.__th) throw r.__th; return r; }
    const why = r.__th ? "throw " + String((r.__th && r.__th.message) || r.__th).slice(0, 60) : "HTTP " + r.status;
    r = await fetch(url, { ...req, signal: req.signal });
    console.log("[AI] retry #2 (" + why + ")");
  }
  return r;
}

export async function* agentChat(env, msgs, chatId, extSig, turnTs, startMode, noTools) {
  const L = await uiLang(env);
  const cfg = await aiConf(env);
  const base = cfg.base.replace(/\/+$/, "");
  dbgLog(env, "ai", "model=" + cfg.model + " @" + base.slice(0, 28) + " tools=" + (noTools ? "off" : "on"));
  let yielded = 0;
  let lastAb = Date.now();
  const seenQ = new Set();
  for (let step = 0; step < 3; step++) {
    const ab0 = await getJSON(env, ABORT_KEY, null);
    if (ab0 && ab0.chat === String(chatId) && ab0.ab && (ab0.ts || 0) >= (turnTs || 0)) { yield ABORT_TOK; return; }

    const r = await aiFetchRetry(base + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + cfg.key },
      signal: extSig && typeof AbortSignal.any === "function" ? AbortSignal.any([extSig, AbortSignal.timeout(80000)]) : AbortSignal.timeout(80000),
      body: JSON.stringify({ model: cfg.model, messages: msgs, max_tokens: step > 0 ? 2500 : 1200, stream: true, tools: noTools ? undefined : TOOLS_AGENT })
    }, env);
    if (!r.ok || !r.body) { dbgLog(env, "ai", "ERR model=" + cfg.model + " HTTP " + r.status + " step=" + step); throw new Error("AI provider HTTP " + r.status); }
    let finish = "";
    let content = "";
    let think = 0;
    const tc = new Map();
    const filt = makeThinkFilter(startMode);
    const qf = makeQuoteFilter();
    let visReal = 0;
    for await (const j of sseObj(r.body)) {
      const c = j.choices && j.choices[0];
      if (!c) continue;
      if (Date.now() - lastAb > 2500) {
        lastAb = Date.now();
        const ab = await getJSON(env, ABORT_KEY, null);
        if (ab && ab.chat === String(chatId) && ab.ab && (ab.ts || 0) >= (turnTs || 0)) { yield ABORT_TOK; return; }
      }
      if (c.delta && c.delta.content) {
        content += c.delta.content;

        if (yielded > 0 || c.delta.content.trim()) {
          const vis = qf.push(filt.push(c.delta.content));
          if (vis) { if (vis.trim()) visReal += vis.trim().length; yielded += vis.length; yield vis; }
        }
      }
      if (c.delta && c.delta.reasoning_content) {
        think += c.delta.reasoning_content.length;

        if (think % 1500 < c.delta.reasoning_content.length) yield "\n\n\u{1F504} " + L.stThink + " (" + Math.floor(think / 1000) + "k)\n\n";
      }
      if (c.delta && c.delta.tool_calls) {
        for (const t of c.delta.tool_calls) {
          const cur = tc.get(t.index) || { id: "", name: "", args: "" };
          if (t.id) cur.id = t.id;
          if (t.function) {
            if (t.function.name) cur.name += t.function.name;
            if (t.function.arguments) cur.args += t.function.arguments;
          }
          tc.set(t.index, cur);
        }
      }
      if (c.finish_reason) finish = c.finish_reason;
    }
    const ftail = qf.push(filt.flush());
    const ftail2 = qf.flush();
    if (ftail) { yielded += ftail.length; yield ftail; }
    if (ftail2) { yielded += ftail2.length; yield ftail2; }
    if (finish !== "tool_calls" || !tc.size) {
      if (visReal) return;
      break;
    }
    const list = [...tc.values()];
    const calls = list.map((t, i) => ({ id: t.id || "call" + step + "_" + i, type: "function", function: { name: t.name || "web_search", arguments: t.args || "{}" } }));
    msgs.push({ role: "assistant", content: content, tool_calls: calls });
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      yield "\n\n\u{1F504} " + toolLabel(calls[i].function.name, t.args, L) + "...\n\n";
      let res;

      let a = {};
      try { a = JSON.parse(calls[i].function.arguments) || {}; } catch (e) {}
      const qkey = calls[i].function.name + "|" + String(a.query || a.q || a.keywords || a.url || "").toLowerCase().replace(/\s+/g, " ").trim();
      if ((calls[i].function.name === "web_search" || calls[i].function.name === "open_url") && seenQ.has(qkey)) {
        res = "(duplicate: " + calls[i].function.name + " was already called with the exact same parameters in a previous step \u2014 the result CANNOT be different. DO NOT call the tool again, answer the user now using the info you already have.)";
      } else {
        seenQ.add(qkey);
        try { res = await execTool(env, calls[i].function.name, t.args, chatId); } catch (e) { res = "error: " + ((e && e.message) || e); }
      }
      res = String(res);

      if ((calls[i].function.name === "web_search" || calls[i].function.name === "open_url") && res && !res.startsWith("error")) {
        if (step === 0) {
          res += "\n\n(If the info above is enough to answer the user, ANSWER NOW \u2014 do not call tools again. Call again only if you need different data.)";
        } else {
          res += "\n\n(This is search #" + (step + 1) + ". The results above are EVERYTHING there is \u2014 NO NEW INFO will come from searching again. Answer the user NOW using this info; if the data does not exist, honestly say so.)";
        }
      }
      msgs.push({ role: "tool", tool_call_id: calls[i].id, content: res.slice(0, 6000) });
    }
  }

  if (yielded < 40) {
    const clean = [];
    let toolText = "";
    for (const m of msgs) {
      if (m.role === "tool") { toolText += "\n\n- " + m.content; continue; }
      if (m.role === "assistant" && m.tool_calls) { clean.push({ role: "assistant", content: "(tool call)" }); continue; }
      clean.push(m);
    }
    clean.push({ role: "user", content: (toolText ? "(system note for AI) these are the tool results obtained so far:" + toolText.slice(-4000) + "\n\nNow ANSWER the user's question using the info above." : "(system note for AI) your previous answer was INVALID \u2014 it only contained leaked verification/checking process. Do NOT show the thinking process, output the final content directly.") + " Calling tools or writing <<<TOOL_CALL>>> format is FORBIDDEN \u2014 answer in plain words only. If the info is not enough, honestly say the data is not available." });
    const r2 = await aiFetchRetry(base + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + cfg.key },
      signal: extSig && typeof AbortSignal.any === "function" ? AbortSignal.any([extSig, AbortSignal.timeout(80000)]) : AbortSignal.timeout(80000),
      body: JSON.stringify({ model: cfg.model, messages: clean, max_tokens: 1500, stream: true })
    }, env);
    if (r2.ok && r2.body) {
      let out = "";
      let think2 = 0;
      for await (const j of sseObj(r2.body)) {
        const c = j.choices && j.choices[0];
        if (!c || !c.delta) continue;
        if (c.delta.reasoning_content) {
          think2 += c.delta.reasoning_content.length;
          if (think2 % 1500 < c.delta.reasoning_content.length) yield "\n\n\u{1F504} " + L.stThink + " (" + Math.floor(think2 / 1000) + "k)\n\n";
        }
        if (c.delta.content) out += c.delta.content;
      }

      out = stripQuoteMeta(stripThink(out)).replace(/<<<TOOL_CALL>>>[\s\S]*?(?:<<<END_TOOL_CALL>>>|$)/g, "").trim();
      if (out) { yield out; return; }
    }
  }
  yield L.stopped;
}

export async function streamReply(env, chatId, prefix, gen, maxLen, track, abCtrl) {
  prefix = prefix || "";
  maxLen = maxLen || 3500;
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  let acc = "";
  let mid = 0;
  let lastEdit = 0;
  let lastLen = 0;
  let statusMid = 0;
  let aborted = false;

  const wdMs = Number(env.GEN_WATCHDOG_MS) || 50000;
  const wdT0 = Date.now();
  let wdCut = false;
  const wdAbort = () => {
    if (wdCut) return;
    wdCut = true;
    try { if (abCtrl && !abCtrl.signal.aborted) abCtrl.abort(new Error("watchdog")); } catch (_) {}
  };

  const wdHardMs = parseInt(env.GEN_WATCHDOG_MAX_MS || "", 10) || Math.round(wdMs * 1.36);
  const wdStallMs = Number(env.WD_STALL_MS) || 4000;
  let lastTok = Date.now();
  let wdTimer = null;
  const wdTick = () => {
    const t2 = Date.now();
    if (t2 - wdT0 >= wdHardMs || t2 - lastTok >= wdStallMs) { wdAbort(); return; }
    wdTimer = setTimeout(wdTick, 1500);
  };
  wdTimer = setTimeout(wdTick, wdMs);
  const body = () => prefix + mdTg(esc(acc.slice(0, maxLen).replace(QUEST_MARK_RE, "").replace(SQ_MARK_RE, ""))) + (acc.length > maxLen ? " \u2026" : "");
  const send = async () => {
    const j = await tg(env, "sendMessage", { chat_id: chatId, text: body(), parse_mode: "HTML" });
    mid = (j && j.result && j.result.message_id) || 0;
  };
  const edit = async () => {
    if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: body(), parse_mode: "HTML" });
  };

  const showStatus = async (label) => {
    if (statusMid) { await tg(env, "editMessageText", { chat_id: chatId, message_id: statusMid, text: label }); return; }
    await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
    const j = await tg(env, "sendMessage", { chat_id: chatId, text: label });
    statusMid = (j && j.result && j.result.message_id) || 0;
  };
  const dropStatus = async () => {
    if (!statusMid) return;
    const sm = statusMid;
    statusMid = 0;
    await tg(env, "deleteMessage", { chat_id: chatId, message_id: sm });
  };
  try {
    for await (const tok of gen) {
      if (Date.now() - wdT0 >= wdHardMs) { wdAbort(); break; }
      if (tok === ABORT_TOK) { aborted = true; break; }
      if (tok.startsWith("\n\n\u{1F504}")) { await showStatus(tok.replace(/\n+/g, " ").trim()); continue; }
      if (statusMid) await dropStatus();
      acc += tok; lastTok = Date.now();
      if (!mid) { await send(); lastEdit = Date.now(); lastLen = acc.length; continue; }
      if (Date.now() - lastEdit > 2000 && acc.length - lastLen >= 60) {
        await edit();
        lastEdit = Date.now();
        lastLen = acc.length;
      }
    }
  } catch (e) {
    await dropStatus();
    if (abCtrl && abCtrl.signal.aborted) {

      if (abCtrl.signal.reason && abCtrl.signal.reason.message === "watchdog") { wdCut = true; }
      else { aborted = true; }
    }
    else if (!acc) {
      clearTimeout(wdTimer);
      await reply(env, chatId, "AI error: " + esc((e && e.message) || e));
      return "";
    } else console.error("stream kepotong:", (e && e.message) || e);
  }
  clearTimeout(wdTimer);
  await dropStatus();
  if (wdCut && !aborted) acc += WD_CUT_NOTE;
  if (aborted) acc += NOTE_ABORT;
  if (!acc) {
    await reply(env, chatId, (await uiLang(env)).aiEmpty);
    return "";
  }
  if (!mid) await send();
  if (wdCut && track && !aborted && mid) {
    const Lc = await uiLang(env);
    await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: body(), parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: Lc.contGo, callback_data: "cont:yes" }, { text: Lc.regenYes, callback_data: "regen:yes" }]] } });
  } else await edit();
  if (track && mid) await putJSON(env, LAST_AI_KEY, { mid: mid, ts: Math.floor(Date.now() / 1000) });
  return acc;
}

export async function fetchPageText(u) {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!r.ok) return "";
  const html = await r.text();
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const title = (s.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = decodeEnt(s).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return ("TITLE: " + decodeEnt(title).trim() + "\n\n" + s).trim();
}

export function ttsLang(v) {
  const s = String(v || "").toLowerCase();
  if (/spanish|spanyol|(^|[^a-z])es([^a-z]|$)/.test(s)) return "es";
  if (/french|prancis|(^|[^a-z])fr([^a-z]|$)/.test(s)) return "fr";
  if (/japan|jepang|(^|[^a-z])jp([^a-z]|$)/.test(s)) return "jp";
  if (/korea|(^|[^a-z])kr([^a-z]|$)/.test(s)) return "kr";
  if (/china|mandar|(^|[^a-z])zh([^a-z]|$)/.test(s)) return "zh";
  return "en";
}

export async function audioBuf(x) {
  if (x == null) return null;
  if (x instanceof ArrayBuffer) return x;
  if (x instanceof Uint8Array) return x.buffer;
  if (x instanceof ReadableStream) return await new Response(x).arrayBuffer();
  if (typeof x === "object" && x.audio != null) return await audioBuf(x.audio);
  if (typeof x === "string") {
    try {
      const b = atob(x);
      const u = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      return u.buffer;
    } catch (_) {}
  }
  return null;
}

export async function tgUpload(env, chatId, buf) {
  if (!env.TG_TOKEN) throw new Error("TG_TOKEN not set");
  const mk = field => {
    const fd = new FormData();
    fd.append("chat_id", String(chatId));
    fd.append(field, new Blob([buf], { type: "audio/wav" }), "reply.wav");
    return fd;
  };
  let r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendVoice", { method: "POST", body: mk("voice"), signal: tgUpTmo(env) });
  let j = await r.json().catch(() => null);
  if (!j || !j.ok) {
    r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendAudio", { method: "POST", body: mk("audio"), signal: tgUpTmo(env) });
    j = await r.json().catch(() => null);
  }
  if (!j || !j.ok) { tgErrLog(env, "tgUpload", j); throw new Error((j && j.description) || "HTTP " + r.status); }
  return j;
}

export async function ttsSpeak(env, chatId, text) {
  let L = null;
  try {
    if (!env.AI) return;
    if ((await env.KV.get(TTS_KEY)) !== "on") return;
    L = await uiLang(env);

    const qre = /"([^"]+)"|\u201c([^\u201d]+)\u201d/g;
    const body = (String(text || "").match(qre) || []).map(s => s.replace(/^["\u201c]|["\u201d]$/g, "").trim()).filter(Boolean).join(" \u2026 ").replace(/[*_~#]+/g, " ").replace(/\s+/g, " ").trim();
    if (!body) return;
    if (body.length > TTS_MAX) { await notify(env, chatId, L.ttsSkip); return; }
    const lng = ttsLang(await env.KV.get(LANG_KEY));
    const audio = await env.AI.run(AI_TTS, { prompt: body, lang: lng });
    const buf = await audioBuf(audio);
    if (!buf || buf.byteLength < 1000) throw new Error("empty audio");
    await tgUpload(env, chatId, buf);
  } catch (e) {
    const msg = "\u{1F507} " + (L ? L.ttsFail : "tts failed:") + " " + esc(String((e && e.message) || e).slice(0, 80));
    await notify(env, chatId, msg).catch(() => {});
  }
}

export const LEN_HINT = {
  short: "PENDEK \u2014 maksimal 1-2 kalimat, to the point.",
  medium: "SEDANG \u2014 sekitar 2-5 kalimat.",
  long: "PANJANG \u2014 bebas detail, boleh bertele-tele asal nyambung."
};

export function langLine(v) {
  const l = (v || "English").trim() || "English";
  if (/^(en|english)$/i.test(l)) return "\nOUTPUT LANGUAGE: write ALL your visible replies to the user in English. This overrides any earlier language instruction.";
  if (/^(id|indo|indonesian)$/i.test(l)) return "\nOUTPUT LANGUAGE: write ALL your visible replies to the user in casual Indonesian (use the 'lo' pronoun). This overrides any earlier language instruction.";
  return "\nOUTPUT LANGUAGE: write ALL your visible replies to the user in " + l + ". This overrides any earlier language instruction.";
}

export async function aiConf(env) {
  const c = await getJSON(env, AI_CFG_KEY, null);
  if (c && c.base && c.key && c.model) return c;
  return { base: env.AI_BASE || "", key: env.AI_KEY || "", model: env.AI_MODEL || "", label: "default (env)" };
}

export async function listBridgeModels(env) {
  const cf = await aiConf(env);
  if (!cf.base || !cf.key) return null;
  try {
    const r = await fetch(cf.base.replace(/\/+$/, "") + "/models", { headers: { "authorization": "Bearer " + cf.key }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.data || []).map(m => ({ id: m.id, name: m.display_name || m.id }));
  } catch (e) { return null; }
}
