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
  MEM_EXTRACT_KEY,
  MEM_EXTRACT_MAX,
  SYS_MEM_EXTRACT,
  HIST_SUM_KEY,
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
  NOTE_TTL_MS,
  SHIELD_PRICE,
  SHIELD_MAX,
  LOOT_ODDS,
  LOOT_AMT,
  PHOTOQ_KEY, PHOTOQ_PTS, PHOTOQ_TASKS_EN, PHOTOQ_TASKS_ID,
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
import { mutateJSON } from './once.js';
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
  aiFetchRetry,
} from './ai.js';
import {
  fmtSize,
  vaultMedia,
  vaultTg,
  vaultCopyToChannel,
  vaultSave,
  handleVault,
  renderVault,
  renderFiles,
  handleFilesCmd,
  vaultSend,
  vaultMatch,
  vaultGet,
  vaultRm,
  handleVaultOp,
  vaultOpRefresh,
  vaultDoBind,
  vaultDoRename,
  SNAP_KEYS,
  vaultBackup,
  vaultRestore,
  vaultAutoBackup,
} from './feat-vault.js';
import {
  renderFeeds,
  resolveFeedUrl,
  decodeEnt,
  cleanTag,
  parseFeed,
  handleRss,
  checkFeeds,
} from './feat-rss.js';
import {
  sseObj,
  chatStream,
  saveMemory,
} from './feat-personal.js';
import {
  getActiveCard,
} from './feat-chars.js';
import { wxNow } from './feat-ctx.js';
import { lifeDigest, lifeCron } from './feat-life.js';
import { addPoints } from './store-d1.js';
export function renderReminders(obj, L) {
  L = L || UI.en;
  const list = Object.keys(obj).map(k => ({ id: k, r: obj[k] })).filter(x => x.r && !x.r.done).sort((a, b) => a.r.at - b.r.at);
  if (!list.length) return { text: L.remEmpty, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  return {
    text: L.remTitle + UI_SEP + list.map(x => "#" + x.id + " \u2014 " + (x.r.rec ? "\u{1F501} " + esc(recLabelOf(x.r, L)) + " \u2014 " + esc(x.r.text) + " \u2192 next: " + fmtWIB(x.r.at, L) : fmtWIB(x.r.at, L) + " \u2014 " + esc(x.r.text)) + (x.r.fired_ts !== undefined ? L.remWait(x.r.nags || 0) : "")).join("\n"),
    markup: { inline_keyboard: list.map(x => [{ text: "\u{1F5D1} #" + x.id, callback_data: "rdel:" + x.id }]).concat([[{ text: L.home, callback_data: "menu" }]]) }
  };
}

export const QUEST_MARK_RE = /\s*\[\[\s*QUEST\s*:\s*(done|skip)\s*\]\]\s*/gi;
export const SQ_MARK_RE = /\s*\[\[\s*SIDEQUEST\s*:\s*(?:new\s*\|\s*[^\]]+?|done|skip)\s*\]\]\s*/gi;
export const SIDEQ_MAX = 3;
export const SIDEQ_DAILY = 5;

export async function questSys(env) {
  const nowSec = Math.floor(Date.now() / 1000);
  const q = await getJSON(env, "quest", {});
  const day = questDay(nowSec);
  const pool = (await uiLang(env)).quests;
  const sq = await getJSON(env, "squest", {});
  const sl = ((sq.day || "") === day) ? sq : { day: day, n: 0, list: [] };
  const slot = SIDEQ_MAX - (sl.list || []).filter(x => !x.done && !x.skipped).length;
  const left = SIDEQ_DAILY - (sl.n || 0);

  let note = "";
  if (q.gNote && Date.now() - (q.gNote.ts || 0) < NOTE_TTL_MS) {
    note = "\n\nEVENT RESULT (system note, just happened): " + q.gNote.text + " React to it briefly in-character if it fits the moment; this note appears once then disappears.";
    q.gNote = null;
    try { await putJSON(env, "quest", q); } catch (_) {}
  }
  if (!(q.day === day && !q.done && !q.skipped && pool[q.idx])) return sideQSys(slot, left) + note;
  const e = await getJSON(env, "exp", { xp: 0 });
  const lv = Math.floor((e.xp || 0) / XP_PER_LEVEL) + 1;
  return "TODAY'S QUEST (from the system, not the user): '" + pool[q.idx] + "' \u2014 status: not done yet, streak " + (q.streak || 0) + " days, total " + (q.points || 0) + " points, XP " + (e.xp || 0) + " (Level " + lv + ") (each completion gives +10 points & +10 XP; the higher the streak, the prouder you get to act). Do NOT bring up this quest first unless the user mentions it or presses the button. If the user says they did this quest (or tells the outcome), praise them + act proud per your personality, then WRITE THE EXACT LAST LINE: [[QUEST:done]] \u2014 a system marker, the user must never see it & you need not explain it. (Alternative: call the mark_quest tool with status \"done\" \u2014 same effect. Use the marker OR the tool, never both.) If the user explains they can't do it right now and asks to skip it, write the last line: [[QUEST:skip]] (or mark_quest with status \"skip\"). Just asking around = reply normally WITHOUT any marker. " + sideQSys(slot, left) + note;
}

export function sideQSys(slot, left) {
  return (slot > 0 && left > 0
    ? "SIDE QUESTS (a real, tracked feature): the user can request bonus quests anytime. If the user ASKS for a side quest: give ONE small quest that fits the conversation/personality (different from the daily one), then write the EXACT LAST LINE: [[SIDEQUEST:new|short quest text]] \u2014 the text inside that marker is what the system records + re-posts neatly as the bot; the user must never see that line."
    : "SIDE QUESTS: slots full (max " + SIDEQ_MAX + " active / " + SIDEQ_DAILY + " per day) \u2014 honestly say you can't add more today, WITHOUT any marker.") + " If the user says they finished a side quest you gave: praise them + act proud per your personality, then write the EXACT LAST LINE: [[SIDEQUEST:done]] (or [[SIDEQUEST:skip]] if the user asks to skip) \u2014 a system marker, gets stripped, the user must never see it & you need not explain it. (The mark_sidequest tool does the same \u2014 marker OR tool, never both.) The Done/Skip buttons on the side quest message still work. NEVER use the QUEST marker without SIDE \u2014 that one is for the daily quest only. Slots left: " + slot + " active, " + left + " per day.";
}

export async function questScan(env, chatId, text) {
  if (!text || !text.includes("[[")) return { stripped: text };
  const stripped = text.replace(QUEST_MARK_RE, "").replace(SQ_MARK_RE, "").trim();
  const m = text.match(/\[\[\s*QUEST\s*:\s*(done|skip)\s*\]\]/i);
  const sm = text.match(/\[\[\s*SIDEQUEST\s*:\s*new\s*\|\s*([^\]]+?)\s*\]\]/i);
  const sd = text.match(/\[\[\s*SIDEQUEST\s*:\s*(done|skip)\s*\]\]/i);
  if (!m && !sm && !sd) return { stripped };
  if (sm) await sideQuestNew(env, chatId, sm[1]);
  if (sd) await sideQuestResolve(env, chatId, sd[1].toLowerCase());
  if (!m) return { stripped };
  await questMark(env, chatId, m[1].toLowerCase());
  return { stripped };
}

import { chainStep } from './feat-chain.js';

export async function questMark(env, chatId, act) {
  const nowSec = Math.floor(Date.now() / 1000);
  const day = questDay(nowSec);
  const q = await getJSON(env, "quest", {});
  const pool = (await uiLang(env)).quests;
  if (!(q.day === day && !q.done && !q.skipped && pool[q.idx])) return { ok: false, why: "no open daily quest today" };
  if (act === "done") {
    q.done = true;
    streakAdvance(q, day, nowSec);
    q.lastDone = day;
    q.loot = Object.assign({ d: day }, rollLoot());
    const qTotal = (q.points || 0) + 10 + q.loot.amt;
    q.gNote = { ts: Date.now(), text: lootNoteText(q.loot, qTotal) };
    const lvUp = await expAdd(env, 10);
    if (lvUp) await notify(env, chatId, (await uiLang(env)).lvUp(lvUp));
  } else q.skipped = true;
  await putJSON(env, "quest", q);
  if (act === "done") await addPts(env, 10 + q.loot.amt);
  if (act === "done") { try { await chainStep(env, chatId); } catch (_) {} }
  if (q.mid) {
    if (act === "done") { try { await tg(env, "setMessageReaction", { chat_id: chatId, message_id: q.mid, reaction: [{ type: "emoji", emoji: "\u{1F4AF}" }] }); } catch (_) {} }
    try { await tg(env, "editMessageReplyMarkup", { chat_id: chatId, message_id: q.mid, reply_markup: { inline_keyboard: [] } }); } catch (_) {}
  }
  return { ok: true };
}

export async function sideQuestNew(env, chatId, raw) {
  const L = await uiLang(env);
  const nowSec = Math.floor(Date.now() / 1000);
  const day = questDay(nowSec);
  const sq = await getJSON(env, "squest", {});
  const s = ((sq.day || "") === day) ? sq : { day: day, n: 0, list: [] };
  const act = (s.list || []).filter(x => !x.done && !x.skipped);
  if (act.length >= SIDEQ_MAX || (s.n || 0) >= SIDEQ_DAILY) return;
  s.n = (s.n || 0) + 1;
  const entry = { id: "sq" + nowSec.toString(36) + Math.floor(Math.random() * 46656).toString(36), text: String(raw || L.sqSpont).slice(0, 200), done: false, skipped: false, ts: nowSec };
  const lam = await getJSON(env, "last_ai_msg", null);
  if (lam && lam.mid) entry.amid = lam.mid;
  const j = await tg(env, "sendMessage", { chat_id: chatId, text: L.sqMsg(esc(entry.text)), parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: L.bDone, callback_data: "sideq:done:" + entry.id }, { text: L.bSkip, callback_data: "sideq:skip:" + entry.id }]] } });
  if (j && j.ok && j.result) entry.mid = j.result.message_id;
  s.list.push(entry);
  if (s.list.length > 20) s.list = s.list.slice(-20);
  await putJSON(env, "squest", s);
  return true;
}

export async function handleSideqCb(env, chatId, mid, arg) {
  const L = await uiLang(env);
  const sep = arg.indexOf(":");
  const act = sep < 0 ? "" : arg.slice(0, sep);
  const id = sep < 0 ? "" : arg.slice(sep + 1);
  const nowSec = Math.floor(Date.now() / 1000);
  const day = questDay(nowSec);
  const sq = await getJSON(env, "squest", {});
  const s = ((sq.day || "") === day) ? sq : { day: day, n: 0, list: [] };
  const e = (s.list || []).find(x => x.id === id);
  if (!e || e.done || e.skipped) return L.sqStale;
  let lvUp = 0, q = null;
  if (act === "done") {
    e.done = true;
    await addPts(env, 5);
    q = await getJSON(env, "quest", {});
    lvUp = await expAdd(env, 5);
    if (e.amid) { try { await tg(env, "setMessageReaction", { chat_id: chatId, message_id: e.amid, reaction: [{ type: "emoji", emoji: "\u{1F4AF}" }] }); } catch (_) {} }
  } else {
    e.skipped = true;
  }
  if (e.mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: e.mid }); } catch (_) {} }
  await putJSON(env, "squest", s);
  if (act === "done") { try { await chainStep(env, chatId); } catch (_) {} }
  return act === "done"
    ? L.sqDone(q ? q.points : 0, lvUp)
    : L.sqSkip;
}

export async function sideQuestResolve(env, chatId, act) {
  const nowSec = Math.floor(Date.now() / 1000);
  const day = questDay(nowSec);
  const sq = await getJSON(env, "squest", {});
  const s = ((sq.day || "") === day) ? sq : { day: day, n: 0, list: [] };
  const e = (s.list || []).filter(x => !x.done && !x.skipped).pop();
  if (!e) return false;
  if (act === "done") {
    e.done = true;
    await addPts(env, 5);
    const lvUp = await expAdd(env, 5);
    if (lvUp) await notify(env, chatId, (await uiLang(env)).lvUp(lvUp));
    if (e.amid) { try { await tg(env, "setMessageReaction", { chat_id: chatId, message_id: e.amid, reaction: [{ type: "emoji", emoji: "\u{1F4AF}" }] }); } catch (_) {} }
  } else e.skipped = true;
  if (e.mid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: e.mid }); } catch (_) {} }
  await putJSON(env, "squest", s);
  if (act === "done") { try { await chainStep(env, chatId); } catch (_) {} }
  return true;
}

export async function journalAdd(env, body) {
  const text = String(body || "").trim();
  if (!text) return { ok: false, why: "empty" };
  const moods = [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => m[1].toLowerCase()).slice(0, 5);
  const rec = { ts: Date.now(), text: text, moods: moods };
  const arr = await mutateJSON(env, "journal", [], cur => {
    const list = Array.isArray(cur) ? cur : [];
    const next = list.concat([rec]);
    while (next.length > 1000) next.shift();
    return { val: next, okNow: back => Array.isArray(back) && back.some(e => e && e.ts === rec.ts) };
  });
  return { ok: true, moods, n: arr.length };
}

export async function handleJournal(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!body) { await reply(env, chatId, L.jUsage); return; }
  const r = await journalAdd(env, body);
  if (!r.ok) { await reply(env, chatId, L.jUsage); return; }
  await notify(env, chatId, L.jSaved(fmtWIB(Math.floor(Date.now() / 1000), L)) + (r.moods.length ? L.jMood + r.moods.map(t => "#" + t).join(" ") : ""));
}

function memNorm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function memDupe(fact, texts) {
  const f = memNorm(fact);
  if (!f) return true;
  const words = f.split(' ').filter(w => w.length > 3);
  for (const t of texts) {
    const n = memNorm(t);
    if (!n) continue;
    if (n === f) return true;
    if (words.length > 2) {
      const nw = n.split(' ').filter(x => x.length > 3);
      const A = new Set(words), B = new Set(nw);
      let inter = 0;
      for (const w of A) if (B.has(w)) inter++;
      const union = new Set([...A, ...B]).size;
      if (union && inter / union >= 0.5) return true;
    }
  }
  return false;
}

export async function memExtractTry(env) {
  const day = questDay(Math.floor(Date.now() / 1000));
  const mk = MEM_EXTRACT_KEY + day;
  const done = await getJSON(env, mk, []);
  if (done.includes("ok")) return "done";
  const hist = (await getJSON(env, CHAT_HIST_KEY, [])).filter(m => m && m.content);
  if (hist.length < 6) return "skip";
  const cfg = await aiConf(env);
  if (!cfg.base || !cfg.key || !cfg.model) return "skip";
  const mems = await getJSON(env, MEM_KEY, []);
  const known = mems.slice(-50).map(m => "- #" + m.id + " | " + m.text).join("\n");
  const convo = hist.slice(-24).map(m => (m.role === "user" ? "User: " : "kibo: ") + String(m.content).slice(0, 400)).join("\n").slice(0, 9000);
  const msgs = [
    { role: "system", content: SYS_MEM_EXTRACT + (known ? "\n\nKNOWN FACTS (already saved):\n" + known : "") },
    { role: "user", content: "Recent dialogue:\n" + convo + "\n\nExtract the new durable facts (max 3, one per line), or DONE if none." }
  ];
  let out = "";
  try { for await (const d of chatStream(env, msgs, 300)) out += d; }
  catch (_) { return "fail"; }
  const clean = stripThink(String(out || "")).trim();
  if (!clean || clean.toUpperCase().startsWith("DONE")) {
    await putJSON(env, mk, done.concat("ok"));
    return "empty";
  }
  const facts = clean.split("\n").map(s => s.replace(/^[-*\d.)\s]+/, "").trim()).filter(s => s && s.length > 3 && s.length <= 220).slice(0, MEM_EXTRACT_MAX);
  const before = mems.length;
  for (const f of facts) {
    if (memDupe(f, mems.map(x => x.text))) continue;
    globalThis.__memAuto = true;
    let id = 0;
    try { id = await saveMemory(env, f); } finally { globalThis.__memAuto = false; }
    if (id) mems.push({ id: id, text: f });
  }
  const added = mems.length - before;
  await putJSON(env, mk, done.concat("ok"));
  return added ? "new:" + added : "empty";
}

export async function memRecapCron(env) {
  const now = new Date(Date.now() + WIB * 1000);
  if (now.getUTCDay() !== 0 || now.getUTCHours() !== 21 || now.getUTCMinutes() < 30 || now.getUTCMinutes() >= 40) return;
  const dayNow = questDay(Math.floor(Date.now() / 1000));
  const week = questDay(Math.floor(Date.now() / 1000) - 7 * 86400);
  const card = await getActiveCard(env);
  if (card) return;
  const rk = "mem_recap_" + week;
  if (await env.KV.get(rk)) return;
  const mems = await getJSON(env, MEM_KEY, []);
  if (mems.length < 3) { await env.KV.put(rk, "1"); return; }
  const cfg = await aiConf(env);
  if (!cfg.base || !cfg.key || !cfg.model) return;
  await env.KV.put(rk, "1");
  const lines = mems.slice(-50).map(m => "- #" + m.id + " | " + m.text).join("\n");
  const hist = (await getJSON(env, CHAT_HIST_KEY, [])).filter(m => m && m.content).slice(-24);
  const convo = hist.map(m => (m.role === "user" ? "User: " : "kibo: ") + String(m.content).slice(0, 300)).join("\n").slice(0, 6000);
  const msgs = [
    { role: "system", content: "You write a short weekly recap for the user from their assistant kibo's perspective. Use ONLY the memories and dialogue given - never invent events. 3-6 short lines (one line each, no markdown headers): promises made, plans in progress, open threads worth closing, memorable moments. End with one forward-looking line. Casual tone, no preamble, no thinking out loud." },
    { role: "user", content: "Stored memories:\n" + lines + "\n\nRecent dialogue:\n" + convo + "\n\nWrite this week's recap." }
  ];
  let out = "";
  try { for await (const d of chatStream(env, msgs, 400)) out += d; }
  catch (_) { await env.KV.delete(rk); return; }
  const clean = stripThink(out).trim();
  const chatId = parseInt((await env.KV.get("owner_chat")) || "0", 10);
  if (clean && chatId) await reply(env, chatId, "\u{1F4CD} <b>Weekly recap</b>\n" + mdTg(esc(clean.slice(0, 1800))));
}

export async function sendDigest(env, chatId, fromCron) {
  const L = await uiLang(env);
  chatId = chatId || parseInt((await env.KV.get("owner_chat")) || "0", 10);
  if (!chatId) return;
  const since = Date.now() - 86400000;
  const all = (await getJSON(env, "journal", [])).filter(e => e.ts >= since);
  if (!all.length) {
    if (!fromCron) await notify(env, chatId, L.digestEmpty);
    return;
  }
  let lifeT = { data: "", tail: "" };
  try { lifeT = await lifeDigest(env, L, Math.floor(Date.now() / 1000)); } catch (_) {}
  let out;
  if (all.length <= 5) {
    out = all.map(e => "\u2022 " + esc(e.text)).join("\n");
  } else {
    await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
    const joined = all.map(e => fmtWIB(Math.floor(e.ts / 1000), L) + ": " + e.text).join("\n");
    const res = await env.AI.run(AI_TEXT, {
      messages: [
        { role: "system", content: L.digestSys + langLine(await env.KV.get(LANG_KEY)) },
        { role: "user", content: (joined + (lifeT.data ? "\n\nLife data: " + lifeT.data : "")).slice(0, 12000) }
      ],
      max_tokens: 800
    });
    out = mdTg(esc(stripThink((res && res.response) || "").slice(0, 3000)));
    await bumpStats(env, joined.length, ((res && res.response) || "").length);
  }
  let wxTail = "";
  try { const w = await wxNow(env); if (w) wxTail = "\n\n" + L.wxDigest(w); } catch (_) {}
  await reply(env, chatId, L.digestHead(all.length) + out + wxTail + (lifeT.tail ? "\n" + lifeT.tail : ""));
}

export async function addReminder(env, chatId, spec, text, recInfo) {
  const nowSec = Math.floor(Date.now() / 1000);
  const target = recInfo ? recInfo.target : parseRemind(String(spec || ""), nowSec);
  if (!target) return null;
  let made = null;
  await mutateJSON(env, "reminders", {}, cur => {
    const obj = cur && typeof cur === "object" ? cur : {};
    const id = Object.keys(obj).reduce((mx, k) => Math.max(mx, parseInt(k, 10) || 0), 0) + 1;
    const r = { at: target, chat: chatId, text: String(text || "").slice(0, 300), done: false };
    if (recInfo) r.rec = recInfo.rec;
    obj[id] = r;
    made = { id: id, at: target };
    return { val: obj, okNow: back => !!(back && back[id]) };
  });
  return made;
}

export function parseRec(kindName, hh, mm, nowSec) {
  kindName = String(kindName || "").toLowerCase().trim();
  hh = parseInt(hh, 10); mm = parseInt(mm, 10);
  if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return null;
  const d = new Date((nowSec + WIB) * 1000);
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm, 0) / 1000 - WIB;
  if (kindName === "hari" || kindName === "day" || kindName === "everyday") {
    let target = base;
    if (target <= nowSec) target += 86400;
    return { rec: { kind: "daily" }, target: target };
  }
  if (DAYS[kindName] !== undefined) {
    const diff = (DAYS[kindName] - d.getUTCDay() + 7) % 7;
    let target = base + diff * 86400;
    if (target <= nowSec) target += 7 * 86400;
    return { rec: { kind: "weekly", dow: DAYS[kindName] }, target: target };
  }
  return null;
}

function recLabelOf(r, L) {
  if (!r || !r.rec) return L.recLabel;
  if (r.rec.kind === "daily") return L.recEvery;
  if (r.rec.kind === "weekly") return L.recDay(r.rec.dow);
  return L.recLabel;
}

export function parseRemind(spec, nowSec) {
  spec = spec.toLowerCase().trim();
  let m;
  if ((m = spec.match(/^(\d+)\s*(detik|s$|sec|seconds?|menit|m$|min|minutes?|jam|j$|h$|hours?|minggu|mng|ming|hari|d$|days?|hr|day)/))) {
    const n = parseInt(m[1], 10);
    const u = m[2];
    let sec;
    if (/^(s|sec|detik)/.test(u)) sec = n;
    else if (/^(m|min|menit)/.test(u)) sec = n * 60;
    else if (/^(j|jam|h|hours?)/.test(u)) sec = n * 3600;
    else if (/^(minggu|mng|ming)/.test(u)) sec = n * 604800;
    else sec = n * 86400;
    return nowSec + Math.max(sec, 30);
  }
  if ((m = spec.match(/^(besok\s+|tomorrow\s+)?(\d{1,2})[.:](\d{2})$/))) {
    const d = new Date((nowSec + WIB) * 1000);
    let target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), parseInt(m[2], 10), parseInt(m[3], 10), 0) / 1000 - WIB;
    if (m[1]) target += 86400;
    else if (target <= nowSec) target += 86400;
    return target;
  }
  if ((m = spec.match(/^(senin|selasa|rabu|kamis|jumat|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})[.:](\d{2})$/))) {
    const want = DAYS[m[1]];
    const d = new Date((nowSec + WIB) * 1000);
    const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) / 1000;
    const diff = (want - d.getUTCDay() + 7) % 7;
    let target = base + diff * 86400 + parseInt(m[2], 10) * 3600 + parseInt(m[3], 10) * 60 - WIB;
    if (target <= nowSec) target += 7 * 86400;
    return target;
  }
  return null;
}

export async function handleRemind(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const nowSec = Math.floor(Date.now() / 1000);

  const mr = body.match(/^tiap\s+(\S+)\s+(\d{1,2})[.:](\d{2})\s+([\s\S]+)$/i);
  if (mr) {
    const pr = parseRec(mr[1], mr[2], mr[3], nowSec);
    if (!pr) {
      await reply(env, chatId, L.remRecBad(esc(mr[1])));
      return;
    }
    const r = await addReminder(env, chatId, null, mr[4].trim(), pr);
    await notify(env, chatId, L.remRecOk(r.id, esc(mr[4].trim()), esc(recLabelOf(pr, L)), parseInt(mr[2], 10) + ":" + mr[3], fmtWIB(r.at, L)));
    return;
  }
  const m = body.match(/^(\S+)\s+([\s\S]+)$/);
  if (!m) {
    await reply(env, chatId, L.remUsage);
    return;
  }
  const target = parseRemind(m[1], nowSec);
  if (!target) {
    await reply(env, chatId, L.remBad);
    return;
  }
  const r = await addReminder(env, chatId, m[1], m[2].trim());
  await notify(env, chatId, L.remOk(r.id, esc(m[2].trim()), fmtWIB(r.at, L)));
}

export async function listReminders(env, chatId) {
  const view = renderReminders(await getJSON(env, "reminders", {}), await uiLang(env));
  await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function delReminder(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const id = body;
  const obj = await getJSON(env, "reminders", {});
  if (!obj[id] || obj[id].done) { await reply(env, chatId, L.remGone(esc(id))); return; }
  obj[id].done = true;
  await putJSON(env, "reminders", obj);
  await notify(env, chatId, L.remDeleted(esc(id)));
}

export function questDay(nowSec) {
  const d = new Date((nowSec + WIB) * 1000);
  const pad = n => String(n).padStart(2, "0");
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}

export function questOfDay(dayStr, pool) {
  let h = 0;
  for (const c of dayStr) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % (pool || UI.en.quests).length;
}

export const XP_PER_LEVEL = 100;
export const REROLL_LIMIT = 5;
export async function expAdd(env, n) {
  const e = await getJSON(env, "exp", { xp: 0 });
  const before = Math.floor((e.xp || 0) / XP_PER_LEVEL);
  e.xp = (e.xp || 0) + n;
  await putJSON(env, "exp", e);
  return Math.floor(e.xp / XP_PER_LEVEL) > before ? Math.floor(e.xp / XP_PER_LEVEL) + 1 : 0;
}

export async function addPts(env, n) {
  const step = Math.trunc(Number(n) || 0);
  try {
    const r = await addPoints(env, "quest", step);
    if (r) return;
  } catch (_) {}
  const q = await getJSON(env, "quest", {});
  q.points = Math.max(0, (q.points || 0) + step);
  await putJSON(env, "quest", q);
}

export function streakAdvance(q, day, nowSec) {
  const yesterday = questDay(nowSec - 86400);
  let kept = q.lastDone === yesterday;
  let shield = false;
  if (!kept && q.lastDone === questDay(nowSec - 2 * 86400) && (q.shields || 0) > 0) {
    q.shields = (q.shields || 0) - 1;
    kept = true;
    shield = true;
  }
  q.streak = kept ? (q.streak || 0) + 1 : 1;
  if (shield) q.shieldDay = day;
  return shield;
}

export function rollLoot(rand) {
  const r = typeof rand === "function" ? rand() : Math.random();
  if (r < LOOT_ODDS.none) return { tier: "none", amt: 0 };
  if (r < LOOT_ODDS.x2) return { tier: "x2", amt: LOOT_AMT.x2 };
  return { tier: "jack", amt: LOOT_AMT.jack };
}

export function lootLine(loot, L) {
  if (!loot) return "";
  if (loot.tier === "jack") return "\n🎁 " + L.lootJack(loot.amt);
  if (loot.tier === "x2") return "\n🎁 " + L.lootX2(loot.amt);
  return "\n🎁 " + L.lootNone;
}

export function lootNoteText(loot, total) {
  if (!loot) return "";
  if (loot.tier === "jack") return "The daily loot crate just rolled a JACKPOT: +" + loot.amt + " bonus points (wallet now " + total + ").";
  if (loot.tier === "x2") return "The daily loot crate just rolled 2x: +" + loot.amt + " bonus points (wallet now " + total + ").";
  return "The daily loot crate just rolled: empty (better luck tomorrow). Wallet stays at " + total + ".";
}

export const RR_LOCK = new Map();
export async function questReroll(env, chatId, quiet) {
  const nowMs = Date.now();
  const lt = RR_LOCK.get(chatId);
  if (lt && nowMs - lt < parseInt(env.RR_LOCK_MS || "15000", 10)) return "locked";
  RR_LOCK.set(chatId, nowMs);
  const nowSec = Math.floor(nowMs / 1000);
  const day = questDay(nowSec);
  const L = await uiLang(env);
  const pool = L.quests;
  const rr = await getJSON(env, "quest_rr", { day: "", n: 0 });
  if (rr.day !== day) { rr.day = day; rr.n = 0; }
  if (rr.n >= REROLL_LIMIT) { if (!quiet) await notify(env, chatId, L.rrLimit(REROLL_LIMIT)); return "limit"; }
  const q = await getJSON(env, "quest", {});
  const base = (q.day === day && pool[q.idx]) ? q.idx : questOfDay(day, pool);
  const idx = (base + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
  rr.n += 1;
  await putJSON(env, "quest_rr", rr);
  await putJSON(env, "quest", { day: day, idx: idx, done: false, skipped: false, delivered: false, streak: q.streak || 0, points: q.points || 0, lastDone: q.lastDone, mid: q.mid, shields: q.shields || 0, loot: q.loot, gNote: q.gNote });
  if (LIVE_CTX && LIVE_CTX.waitUntil) LIVE_CTX.waitUntil(fireQuest(env, nowSec).catch(() => {}));
  return "ok";
}
export async function questReset(env, chatId) {
  const L = await uiLang(env);
  await env.KV.delete("quest");
  await env.KV.delete("exp");
  await env.KV.delete("quest_rr");
  await notify(env, chatId, L.qresetMsg);
}

export async function shieldBuy(env) {
  const q = await getJSON(env, "quest", {});
  if ((q.shields || 0) >= SHIELD_MAX) return { ok: false, why: "max", max: SHIELD_MAX, shields: q.shields || 0 };
  if ((q.points || 0) < SHIELD_PRICE) return { ok: false, why: "poor", price: SHIELD_PRICE, points: q.points || 0 };
  q.shields = (q.shields || 0) + 1;
  await putJSON(env, "quest", q);
  await addPts(env, -SHIELD_PRICE);
  const w = await getJSON(env, "quest", {});
  return { ok: true, shields: w.shields || 0, points: w.points || 0, price: SHIELD_PRICE };
}
export async function handleShield(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = (msg.text || "").replace(/^\/\S+\s*/, "").trim().toLowerCase();
  const q = await getJSON(env, "quest", {});
  if (!arg.startsWith("buy")) return reply(env, chatId, L.shStatus(q.shields || 0, q.points || 0, SHIELD_MAX) + "\n" + L.shHow(SHIELD_PRICE));
  const r = await shieldBuy(env);
  if (!r.ok) {
    if (r.why === "max") return notify(env, chatId, L.shMax(SHIELD_MAX));
    return reply(env, chatId, L.shPoor(r.price, r.points));
  }
  return notify(env, chatId, L.shBought(r.shields, r.points));
}

export function questKb(L) {
  return { inline_keyboard: [[{ text: L.bDone, callback_data: "quest:done" }, { text: L.bSkip, callback_data: "quest:skip" }]] };
}

export function qresetConfirmView(L, fromQuest) {
  const o = fromQuest ? "q" : "p";
  return { text: L.qrConfirm, markup: { inline_keyboard: [
    [{ text: L.qrYes, callback_data: "qreset:yes:" + o }, { text: L.qrNo, callback_data: "qreset:no:" + o }],
    [{ text: L.home, callback_data: "menu" }]
  ] } };
}

export async function fireQuest(env, nowSec) {
  const L = await uiLang(env);
  const pool = L.quests;
  const q = await getJSON(env, "quest", {});
  const day = questDay(nowSec);
  if (q.day === day && (q.delivered || q.done || q.skipped)) return;
  const fresh = q.day !== day;
  const idx = fresh ? questOfDay(day, pool) : q.idx;
  if (!pool[idx]) return;
  const owner = await env.KV.get("owner_chat");
  if (!owner) return;

  const aiPitch = (await remindMsg(env, 0, pool[idx], 0, "questNew")).trim();
  const j = await tg(env, "sendMessage", aiPitch
    ? { chat_id: owner, text: mdTg(esc(aiPitch)), parse_mode: "HTML", reply_markup: questKb(L) }
    : { chat_id: owner, text: L.qCron(esc(pool[idx])), parse_mode: "HTML", reply_markup: questKb(L) });
  const mid = j && j.ok && j.result ? j.result.message_id : null;
  const st = fresh
    ? { day: day, idx: idx, done: false, skipped: false, delivered: true, streak: q.streak || 0, points: q.points || 0, lastDone: q.lastDone, mid: mid, shields: q.shields || 0 }
    : Object.assign({}, q, { delivered: true, mid: mid || q.mid });
  await putJSON(env, "quest", st);
}

export async function questView(env) {
  const nowSec = Math.floor(Date.now() / 1000);
  const day = questDay(nowSec);
  const q = await getJSON(env, "quest", {});
  const fresh = q.day !== day;
  const L = await uiLang(env);
  const pool = L.quests;
  const idx = fresh ? questOfDay(day, pool) : q.idx;
  if (!pool[idx]) return { text: L.questNA, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  const cur = fresh
    ? Object.assign({}, q, { day: day, idx: idx, done: false, skipped: false, delivered: true, streak: q.streak || 0, points: q.points || 0, lastDone: q.lastDone })
    : q;
  if (fresh) await putJSON(env, "quest", cur);
  const rr = await getJSON(env, "quest_rr", { day: "", n: 0 });
  const rrN = (rr.day === day ? rr.n : 0);
  const state = cur.done ? L.profQDone : cur.skipped ? L.profQSkip : L.qStateTodo;
  const sq = await getJSON(env, "squest", {});
  const sl = ((sq.day || "") === day) ? sq : { day: day, n: 0, list: [] };
  const act = (sl.list || []).filter(x => !x.done && !x.skipped);
  const text = "\u{1F3AF} <b>QUEST</b>" + UI_SEP +
    "\u{1F4CC} <b>Daily:</b> " + esc(pool[cur.idx]) + "\n" +
    L.qStatus(state, cur.streak || 0) + "\n" +
    "\u{1F4B0} " + L.qPoin + ": " + (cur.points || 0) + "\n" +
    L.qShield(q.shields || 0, SHIELD_MAX) + (q.loot && q.loot.d === day ? lootLine(q.loot, L) : "") + "\n" +
    "\u{1F4A0} " + L.qSide + " (" + act.length + "/" + SIDEQ_MAX + " \u2022 " + (sl.n || 0) + "/" + SIDEQ_DAILY + "): " + (act.length ? "" : L.qSideNone) +
    (act.length ? "\n" + act.map(x => "\u2022 " + esc(x.text)).join("\n") : "");

  const extra = [[{ text: L.profReroll + " (" + rrN + "/" + REROLL_LIMIT + ")", callback_data: "qreroll" }, { text: L.profReset, callback_data: "qreset:ask:q" }]];
  extra.push([{ text: L.pqBtn, callback_data: "pq" }]);
  const rows = (!fresh && (cur.done || cur.skipped)) ? extra : questKb(L).inline_keyboard.concat(extra);
  return { text, markup: { inline_keyboard: rows.concat([[{ text: L.home, callback_data: "menu" }]]) } };
}

export async function handleQuest(env, msg, chatId) {
  const v = await questView(env);
  const j = await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  if (j && j.ok && j.result) {
    const q = await getJSON(env, "quest", {});
    if (q.day === questDay(Math.floor(Date.now() / 1000)) && !q.mid) { q.mid = j.result.message_id; await putJSON(env, "quest", q); }
  }
}

export async function handleQuestCb(env, chatId, mid, arg) {
  const L = await uiLang(env);
  const pool = L.quests;
  const nowSec = Math.floor(Date.now() / 1000);
  const day = questDay(nowSec);
  const q = await getJSON(env, "quest", {});
  if (q.day !== day || !pool[q.idx]) {
    if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.questStale, parse_mode: "HTML", reply_markup: { inline_keyboard: [] } });
    return;
  }
  let reacted = false;
  let lvUp = 0;
  let shieldMsg = "";
  if (arg === "done" && !q.done && !q.skipped) {
    q.done = true;
    const sh = streakAdvance(q, day, nowSec);
    q.lastDone = day;
    q.loot = Object.assign({ d: day }, rollLoot());
    q.gNote = { ts: Date.now(), text: lootNoteText(q.loot, (q.points || 0) + 10 + q.loot.amt) };
    lvUp = await expAdd(env, 10);
    reacted = true;
    shieldMsg = sh ? L.shUsed + "\n" : "";
  } else if (arg === "skip" && !q.done && !q.skipped) {
    q.skipped = true;
    reacted = true;
  }
  if (reacted) await putJSON(env, "quest", q);
  if (q.done) await addPts(env, 10 + q.loot.amt);
  if (q.done) { try { await chainStep(env, chatId); } catch (_) {} }

  if (mid && reacted) {
    if (q.done) { try { await tg(env, "setMessageReaction", { chat_id: chatId, message_id: mid, reaction: [{ type: "emoji", emoji: "\u{1F4AF}" }] }); } catch (_) {} }
    try { await tg(env, "editMessageReplyMarkup", { chat_id: chatId, message_id: mid, reply_markup: { inline_keyboard: [] } }); } catch (_) {}
  }
  if (reacted) {
    const ai = await remindMsg(env, 0, pool[q.idx], 0, q.done ? "questDone" : "questSkip");
    if (ai) await reply(env, chatId, mdTg(esc(ai)));
    return q.done
      ? shieldMsg + L.qDone(q.streak || 0, (await getJSON(env, "quest", {})).points || 0, lvUp) + lootLine(q.loot, L)
      : L.qSkip;
  }
  return "";
}

export const NAG_AT = [180, 360, 600, 900];

export async function remindMsg(env, id, text, nagLevel, mode) {
  const cfg = await aiConf(env);
  if (!cfg.base || !cfg.key || !cfg.model) return "";
  try {
    const card = await getActiveCard(env);
    const mems = await getJSON(env, card ? CMEM_PREFIX + card.id : MEM_KEY, []);
    let sys = (card ? card.prompt : SYS_CHAT) + "\nTime info: it is now " + nowWIB() + ".";
    if (mems.length) sys += "\nPersistent memories (format '#id | text'):\n" + mems.map(m => "- #" + m.id + " | " + m.text).join("\n");
    const persona = await getJSON(env, PERSONA_KEY, null);
    if (persona) sys += "\nThe user you are chatting with: their name is " + persona.name + (persona.desc ? ". " + persona.desc : "") + ".";
    sys = sys.split("{{user}}").join(persona ? persona.name : "User").split("{{char}}").join(card ? card.name : "kibo") + langLine(await env.KV.get(LANG_KEY));
    const lifeHint = mode && String(mode).startsWith("life:") ? String(mode).slice(5) : null;
    const hint = lifeHint ? lifeHint : mode === "bet"
      ? "The user just played a coinflip bet against you with this outcome: " + text + ". React in ONE short in-character line (if they won: you pay up, grudgingly; if they lost: light smugness). No odds talk, no system talk."
      : mode === "gift"
        ? "The user just gave you a gift: " + text + ". React in ONE short in-character line \u2014 touched/happy, natural, no system talk, no price talk."
      : mode === "questNew"
      ? "This quest has NOT reached the user yet \u2014 you are the one delivering it now: pitch the quest in-character, mention its content, give encouragement + a natural invitation like a friend would, naming the user is fine. Do NOT use system formatting (no 'TODAY'S QUEST' header)."
      : mode === "questDone"
        ? "The user JUST pressed the done button for that quest: praise briefly + naturally, mentioning streak/points is fine, do not overdo it."
        : mode === "questSkip"
          ? "The user skipped that quest: accept it chill, no judgment, say a new quest arrives tomorrow."
          : nagLevel <= 0
            ? "The user just received that reminder: react chill, invite them to do it now."
            : nagLevel === 1
              ? "3 minutes passed, the user has not replied at all (maybe busy playing/working): nag a little, but stay patient."
              : nagLevel === 2
                ? "The user has ignored you 2x (6-10 minutes passed): nag hard, you may be a bit pushy."
                : "This is the FINAL nag before you stop: nag at maximum, drama is allowed, but stay loving toward the user.";
    const r = await aiFetchRetry(cfg.base.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + cfg.key },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ model: cfg.model, stream: true, max_tokens: 800, messages: [
        { role: "system", content: sys },
        { role: "user", content: "(system note for AI) " + (lifeHint ? "life event" : mode === "bet" ? "bet" : mode ? "quest" : "reminder message") + " '" + text + "' " + (mode === "questDone" ? "was just completed by the user (button)" : mode === "questSkip" ? "was just skipped by the user" : lifeHint ? "was just recorded by the system" : "was just sent to the user by you") + " (separate system message, the info has been delivered). " + hint + " Now write ONE Telegram message from you (as the character) to the user: 1-2 sentences of natural reaction like a normal chat. Do NOT repeat system formatting, markdown **bold** is FORBIDDEN, do not mention the words 'reminder', '#id', or system terms." }
      ] })
    }, env);
    if (!r.ok || !r.body) return "";
    let out = "";
    for await (const j of sseObj(r.body)) {
      const c = j.choices && j.choices[0];
      if (c && c.delta && c.delta.content) out += c.delta.content;
    }
    return stripThink(out).replace(/<<<TOOL_CALL>>>[\s\S]*?(?:<<<END_TOOL_CALL>>>|$)/g, "").trim().slice(0, 600);
  } catch (e) { return ""; }
}

export async function runCron(env) {
  const L = await uiLang(env);
  const nowSec = Math.floor(Date.now() / 1000);
  const ids = Object.keys(await getJSON(env, "reminders", {}));
  const alive = parseInt((await env.KV.get("last_user_msg")) || "0", 10);
  for (const id of ids) {
    let act = null;
    await mutateJSON(env, "reminders", {}, cur => {
      const obj = cur && typeof cur === "object" ? cur : {};
      const r = obj[id];
      if (!r || r.done || r.at > nowSec) return null;
      if (r.rec) {
        const step = r.rec.kind === "daily" ? 86400 : 7 * 86400;
        let next = r.at + step;
        while (next <= nowSec) next += step;
        const at = r.at;
        r.at = next;
        act = { kind: "rec", rec: r.rec, text: r.text, chat: r.chat, at: at };
        return { val: obj, okNow: back => !!(back && back[id] && back[id].at === next) };
      }
      if (r.fired_ts === undefined) {
        r.fired_ts = nowSec;
        r.nags = 0;
        act = { kind: "first", text: r.text, chat: r.chat, id: id };
        return { val: obj, okNow: back => !!(back && back[id] && back[id].fired_ts === nowSec) };
      }
      if (alive >= r.fired_ts) {
        r.done = true;
        return { val: obj, okNow: back => !!(back && back[id] && back[id].done) };
      }
      if (r.nags < NAG_AT.length && nowSec - r.fired_ts < NAG_AT[r.nags]) return null;
      if (r.nags < NAG_AT.length - 1) {
        r.nags++;
        const nags = r.nags;
        act = { kind: "nag", text: r.text, chat: r.chat, id: id, nags: nags };
        return { val: obj, okNow: back => !!(back && back[id] && back[id].nags === nags) };
      }
      r.done = true;
      act = { kind: "close", text: r.text, chat: r.chat, id: id };
      return { val: obj, okNow: back => !!(back && back[id] && back[id].done) };
    });
    if (!act) continue;
    const push = async (chat, text) => {
      try { const j = await reply(env, chat, text); return { delivered: !!(j && j.ok), threw: false }; }
      catch (_) { return { delivered: false, threw: true }; }
    };
    const talk = async () => {
      try { return await remindMsg(env, id, act.text, act.kind === "nag" ? act.nags : 0); } catch (_) { return ""; }
    };
    let res;
    if (act.kind === "rec") {
      res = await push(act.chat, "\u{1F501} <b>REMINDER #" + id + "</b> (" + esc(recLabelOf(act, L)) + ")\n" + esc(act.text));
      if (res.delivered) { const ai = await talk(); if (ai) await push(act.chat, mdTg(esc(ai))); }
    } else if (act.kind === "first") {
      res = await push(act.chat, "\u23F0 <b>REMINDER #" + id + "</b>\n" + esc(act.text));
      if (res.delivered) { const ai = await talk(); if (ai) await push(act.chat, mdTg(esc(ai))); }
    } else if (act.kind === "nag") {
      const ai = await talk();
      res = await push(act.chat, ai ? mdTg(esc(ai)) : L.nagMsg(id, esc(act.text)));
    } else {
      res = await push(act.chat, L.nagClose(esc(act.text)));
    }
    if (!res.delivered && res.threw) {
      await mutateJSON(env, "reminders", {}, back => {
        const obj = back && typeof back === "object" ? back : {};
        const r = obj[id];
        if (!r) return null;
        if (act.kind === "first" && r.fired_ts === nowSec) { delete r.fired_ts; r.nags = 0; }
        else if (act.kind === "nag" && r.nags === act.nags) { r.nags = Math.max(0, act.nags - 1); }
        else if (act.kind === "close" && r.done) { r.done = false; }
        else if (act.kind === "rec" && r.at !== act.at) { r.at = act.at; }
        else return null;
        return { val: obj, okNow: () => true };
      });
    }
  }

  await vaultAutoBackup(env, nowSec);
  const d = new Date(nowSec * 1000);
  if (d.getUTCMinutes() % 15 === 0) await checkFeeds(env, nowSec);
  const wib = new Date((nowSec + WIB) * 1000);
  const qDay = questDay(nowSec);
  if (wib.getUTCHours() === 7 && wib.getUTCMinutes() < 5 && (await getJSON(env, "digest_day", "")) !== qDay) { await putJSON(env, "digest_day", qDay); await sendDigest(env, null, true); }
  try { await memExtractTry(env); } catch (_) {}
  try { await memRecapCron(env); } catch (_) {}
  const pingSlot = questPingSlot(qDay);
  const wibMin = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  if (wibMin >= pingSlot && wibMin < pingSlot + 5) await fireQuest(env, nowSec);
  await lifeCron(env, nowSec);
}

const QPING_LO = 10 * 60, QPING_SPAN = 10 * 60;
export function questPingSlot(dayStr) {
  let h = 2166136261;
  for (const c of String(dayStr)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return QPING_LO + (h >>> 0) % QPING_SPAN;
}

export function photoqTaskIdx(dayStr) {
  let h = 0;
  for (const c of dayStr) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % PHOTOQ_TASKS_EN.length;
}

const PHOTOQ_PROMPT = chal => 'Judge a casual daily photo quest submission. The challenge was: "' + chal + '". This is a fun self-reported mission, not a strict contest - be LENIENT. Reply PASS for any genuine real-life photo that could plausibly satisfy it; open-ended challenges like "photograph whatever is in front of you right now" accept ANY real photo of a real scene. Reply FAIL only if the image is clearly NOT a real photo taken by a person (a screenshot, a drawing, a meme, a stock image), or it clearly shows something completely different from a challenge that names a SPECIFIC thing. When unsure, answer PASS. Reply with EXACTLY PASS or FAIL as the first word, then " - " and a short casual verdict (max 12 words). Nothing else.';

export async function photoqView(env, chatId, mid) {
  const L = await uiLang(env);
  const day = questDay(Math.floor(Date.now() / 1000));
  const st = await getJSON(env, PHOTOQ_KEY + chatId, null);
  const task = ((await env.KV.get(UI_LANG_KEY)) === "id" ? PHOTOQ_TASKS_ID : PHOTOQ_TASKS_EN)[photoqTaskIdx(day)];
  let status = "";
  if (st && st.d === day) status = "\n" + (st.passed ? L.pqDonePass(PHOTOQ_PTS) : L.pqDoneFail);
  const text = L.pqTitle + "\n" + L.pqTask(esc(task)) + status + "\n\n" + L.pqHow;
  const view = { text, markup: { inline_keyboard: [[{ text: L.back, callback_data: "nav:quest" }, { text: L.home, callback_data: "menu" }]] } };
  if (mid) {
    const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
    if (j && j.ok) return;
  }
  await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function photoqVerify(env, msg, chatId) {
  const L = await uiLang(env);
  const day = questDay(Math.floor(Date.now() / 1000));
  const st = (await getJSON(env, PHOTOQ_KEY + chatId, null)) || {};
  if (st.d === day && st.done) { await notify(env, chatId, st.passed ? L.pqDonePass(PHOTOQ_PTS) : L.pqDoneFail); return; }
  const sizes = msg.photo || [];
  const best = sizes[sizes.length - 1];
  if (!best) return reply(env, chatId, L.pqHow);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const task = ((await env.KV.get(UI_LANG_KEY)) === "id" ? PHOTOQ_TASKS_ID : PHOTOQ_TASKS_EN)[photoqTaskIdx(day)];
  let bytes;
  try { bytes = await tgFileBytes(env, best.file_id); } catch (e) { await reply(env, chatId, L.visFail + esc(String((e && e.message) || e)).slice(0, 120)); return; }
  const vrun = pmt => env.AI.run(AI_VISION, { image: [...new Uint8Array(bytes)], prompt: pmt, max_tokens: 120 });
  let out = null;
  try {
    out = await vrun(PHOTOQ_PROMPT(task));
  } catch (e) {
    if (/5016/.test(String((e && e.message) || e))) {
      try { await env.AI.run(AI_VISION, { prompt: "agree", max_tokens: 8 }); } catch (_) {}
      try { out = await vrun(PHOTOQ_PROMPT(task)); } catch (_) {}
    }
  }
  const t = String((out && (out.response || out.description)) || "");
  if (!t) return reply(env, chatId, L.visEmpty);
  const pass = /^pass\b/i.test(t.trim()) || !/^fail\b/i.test(t.trim());
  await putJSON(env, PHOTOQ_KEY + chatId, { d: day, done: true, passed: pass });
  if (!pass) return reply(env, chatId, L.pqFail + "\n" + esc(t.slice(0, 140)));
  await addPts(env, PHOTOQ_PTS);
  const w = await getJSON(env, "quest", {});
  await reply(env, chatId, L.pqPass(PHOTOQ_PTS, w.points || 0));
  try { await chainStep(env, chatId); } catch (_) {}
  let ai = "";
  try { ai = await remindMsg(env, 0, "photo quest PASS: the user's photo matched today's challenge (" + task + "). Vision verdict: " + t.slice(0, 100), 0, "life:react in ONE short in-character line to the user passing today's photo challenge - a little impressed, no system talk"); } catch (_) {}
  if (ai) await reply(env, chatId, "\u{1F4AC} " + mdTg(esc(ai)));
}
