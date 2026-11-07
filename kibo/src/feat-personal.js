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
  HIST_SUM_KEY,
  REL_PREFIX,
  REL_GAP_MS,
  SYS_REL,
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
  AUTO_DL_KEY,
  DIVE_DEF_KEY,
  DIVE_MODES,
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
  SHIELD_MAX,
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
import { d1Stats, shadowInfo } from './store-d1.js';
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
  UI_SEP,
  uiBar,
  uiLang,
  fmtTok,
  fmtWIB,
  nowWIB,
} from './ui.js';
import { getDebug, dbgLog } from './feat-debug.js';
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
  renderReminders,
  QUEST_MARK_RE,
  SQ_MARK_RE,
  SIDEQ_MAX,
  SIDEQ_DAILY,
  questSys,
  sideQSys,
  questScan,
  sideQuestNew,
  handleSideqCb,
  sideQuestResolve,
  handleJournal,
  sendDigest,
  addReminder,
  parseRec,
  parseRemind,
  handleRemind,
  listReminders,
  delReminder,
  questDay,
  questOfDay,
  XP_PER_LEVEL,
  REROLL_LIMIT,
  expAdd,
  RR_LOCK,
  questReroll,
  questReset,
  questKb,
  fireQuest,
  questView,
  handleQuest,
  handleQuestCb,
  NAG_AT,
  remindMsg,
  runCron,
  lootLine,
  photoqVerify,
} from './feat-remind.js';
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
  chatTurn,
} from './chat.js';
import {
  getActiveCard,
} from './feat-chars.js';
import {
  vaultSave,
} from './feat-vault.js';
export async function handleTranscribe(env, msg, chatId) {
  const L = await uiLang(env);
  const f = msg.voice || msg.audio;
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const bytes = await tgFileBytes(env, f.file_id);
  let out = null;

  const u8b = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8b.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8b.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  try {
    out = await env.AI.run(AI_STT, { audio: b64, task: "transcribe" });
  } catch (e) {
    try { out = await env.AI.run(AI_STT_FB, { audio: [...new Uint8Array(bytes)] }); }
    catch (e2) { await reply(env, chatId, L.sttFail + esc(String((e2 && e2.message) || e2)).slice(0, 120)); return; }
  }
  const t = (out && out.text) || "";
  await reply(env, chatId, t ? L.sttHead + esc(t) : L.sttEmpty);
  if (t) await chatTurn(env, chatId, t.slice(0, 2000), undefined, msg.message_id);
}

export async function handleCaption(env, msg, chatId) {
  const L = await uiLang(env);
  if ((msg.caption || "").trim().toLowerCase().startsWith("/save")) return vaultSave(env, msg, chatId, msg.caption.trim().slice(5).trim());
  const pf = await getJSON(env, PRESET_IMPORT_KEY, null);
  if (pf && pf.ts) {
    await env.KV.delete(PRESET_IMPORT_KEY);
    await reply(env, chatId, (await uiLang(env)).pimpPhotoWarn);
    return;
  }
  const importWait = parseInt((await env.KV.get(CHAR_IMPORT_KEY)) || "0", 10);
  if (importWait && Date.now() - importWait <= 600000) {
    await env.KV.delete(CHAR_IMPORT_KEY);
    await reply(env, chatId, L.cardPhotoWarn);
    return;
  }
  if ((msg.caption || "").trim().toLowerCase().startsWith("/pq")) return photoqVerify(env, msg, chatId);
  const sizes = msg.photo || [];
  const best = sizes[sizes.length - 1];
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const bytes = await tgFileBytes(env, best.file_id);

  const vrun = pmt => env.AI.run(AI_VISION, { image: [...new Uint8Array(bytes)], prompt: pmt, max_tokens: 300 });
  let out = null;
  try {
    out = await vrun("Describe this image briefly in casual English.");
  } catch (e) {
    if (/5016/.test(String((e && e.message) || e))) {
      try { await env.AI.run(AI_VISION, { prompt: "agree", max_tokens: 8 }); } catch (_) {}
      try { out = await vrun("Describe this image briefly in casual English."); } catch (_) {}
    }
    if (!out) { await reply(env, chatId, L.visFail + esc(String((e && e.message) || e)).slice(0, 120)); return; }
  }
  const t = (out && (out.description || out.response)) || "";
  if (!t) { await reply(env, chatId, L.visEmpty); return; }

  await chatTurn(env, chatId, ((msg.caption ? msg.caption + "\n" : "") + "[user sent a photo, its contents: " + t + "]").slice(0, 2000), undefined, msg.message_id);
}

export async function* sseObj(body) {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try { yield JSON.parse(d); } catch (_) {}
    }
  }
}

async function* sseText(body, pick) {
  for await (const j of sseObj(body)) {
    const t = pick(j);
    if (t) yield t;
  }
}

export async function* chatStream(env, messages, maxTokens, timeoutMs = 60000) {
  const cfg = await aiConf(env);
  if (cfg.base && cfg.key && cfg.model) {
    dbgLog(env, "ai", "model=" + cfg.model + " @" + String(cfg.base).slice(0, 28));
    const r = await aiFetchRetry(cfg.base.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + cfg.key },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({ model: cfg.model, messages: messages, max_tokens: maxTokens, stream: true })
    });
    if (!r.ok || !r.body) { dbgLog(env, "ai", "ERR model=" + cfg.model + " HTTP " + r.status); throw new Error("AI provider HTTP " + r.status); }
    const cfilt = makeThinkFilter();
    const qf2 = makeQuoteFilter();
    for await (const tk of sseText(r.body, j => (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || "")) {
      const v = qf2.push(cfilt.push(tk));
      if (v) yield v;
    }
    const ctail = qf2.push(cfilt.flush());
    const ctail2 = qf2.flush();
    if (ctail) yield ctail;
    if (ctail2) yield ctail2;
    return;
  }
  const s = await env.AI.run(AI_TEXT, { messages: messages, max_tokens: maxTokens, stream: true });
  yield* sseText(s, j => j.response || "");
}

export async function* chatFast(env, messages, maxTokens) {
  const s = await env.AI.run(AI_TEXT, { messages: messages, max_tokens: maxTokens, stream: true });
  yield* sseText(s, j => j.response || "");
}

const REL_STAGES_EN = ["distant", "wary", "familiar", "warm", "bonded"];
export function relStage(aff) { return REL_STAGES_EN[Math.min(4, Math.max(0, Math.floor(aff / 20)))]; }
export async function relGet(env, id) { return getJSON(env, REL_PREFIX + id, null); }
export async function relPurge(env, id) { await env.KV.delete(REL_PREFIX + id); }
export async function relEval(env, hist) {
  try {
    const card = await getActiveCard(env);
    if (!card) return null;
    const prev = await relGet(env, card.id);
    const now = Date.now();
    if (prev && prev.ts && now - prev.ts < (Number(env.REL_GAP_MS) || REL_GAP_MS)) return null;
    if (!hist || hist.length < 8) return null;
    const convo = hist.slice(-12).map(m => (m.role === "user" ? "User: " : "AI: ") + String(m.content || "")).join("\n").slice(0, 6000);
    const cur = prev ? "affinity " + prev.aff + "/100" + (prev.mood ? ", mood: " + prev.mood : "") + (prev.note ? ", note: " + prev.note : "") : "affinity 50/100 (neutral start)";
    const msgs = [{ role: "system", content: SYS_REL }, { role: "user", content: "Current state: " + cur + "\n\nRecent dialogue:\n" + convo }];
    let out = "";
    for await (const d of chatStream(env, msgs, 120)) out += d;
    out = stripThink(out).trim();
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    let j; try { j = JSON.parse(m[0]); } catch (_) { return null; }
    const d = Math.max(-10, Math.min(10, Number(j.d) || 0));
    const base = prev && typeof prev.aff === "number" ? prev.aff : 50;
    const rec = {
      aff: Math.max(0, Math.min(100, base + d)),
      mood: String(j.mood || (prev && prev.mood) || "calm").slice(0, 40),
      note: String(j.note || (prev && prev.note) || "").slice(0, 200),
      ts: now, n: ((prev && prev.n) || 0) + 1
    };
    await putJSON(env, REL_PREFIX + card.id, rec);
    return rec;
  } catch (e) { return null; }
}

export const TOTP_KEY = "totp";
export const TOTP_PERIOD = 30;
export const TOTP_MAX = 20;

export function b32dec(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  s = String(s || "").toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "").replace(/0/g, "O").replace(/1/g, "L").replace(/8/g, "B");
  if (!s.length || [...s].some(c => !A.includes(c))) return null;
  let bits = 0, val = 0;
  const out = [];
  for (const c of s) {
    val = (val << 5) | A.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return out.length ? new Uint8Array(out) : null;
}

export async function totpCode(secret, atSec) {
  const key = b32dec(secret);
  if (!key) return null;
  let c = Math.floor(atSec / TOTP_PERIOD);
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
  const off = mac[19] & 0xf;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 1000000).padStart(6, "0");
}

export async function renderTotp(env) {
  const L = await uiLang(env);
  const arr = await getJSON(env, TOTP_KEY, []);
  if (!arr.length) return { text: L.totpEmpty, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  const now = Math.floor(Date.now() / 1000);
  const rem = TOTP_PERIOD - (now % TOTP_PERIOD);
  const lines = [];
  for (const e of arr) lines.push("<b>#" + e.id + " " + esc(e.label) + "</b>: <code>" + ((await totpCode(e.secret, now)) || "??????") + "</code> \u2022 " + rem + "s");
  return { text: L.totpTitle + UI_SEP + lines.join("\n"), markup: { inline_keyboard: [[{ text: L.totpRefresh, callback_data: "trefresh" }], [{ text: L.home, callback_data: "menu" }]] } };
}

export async function handleTotp(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!body) {
    const v = await renderTotp(env);
    await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    return;
  }
  const sub = body.split(/\s+/)[0].toLowerCase();
  const arr = await getJSON(env, TOTP_KEY, []);
  if (sub === "add") {
    const rest = body.slice(3).trim();
    const sp = rest.indexOf(" ");
    const label = sp > 0 ? rest.slice(0, sp).slice(0, 40) : "";
    const secret = sp > 0 ? rest.slice(sp + 1).trim() : "";
    if (!label || !b32dec(secret)) { await reply(env, chatId, L.totpUsage); return; }
    if (arr.length >= TOTP_MAX) { await reply(env, chatId, L.totpFull); return; }
    const id = arr.reduce((m, e) => Math.max(m, e.id || 0), 0) + 1;
    arr.push({ id, label, secret: secret.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, ""), ts: Date.now() });
    await putJSON(env, TOTP_KEY, arr);
    if (msg.message_id) await tg(env, "deleteMessage", { chat_id: chatId, message_id: msg.message_id });
    await reply(env, chatId, L.totpAddOk(id, esc(label)));
    return;
  }
  if (sub === "del") {
    const k = body.slice(3).trim().replace(/^#/, "");
    const i = arr.findIndex(e => String(e.id) === k || (e.label || "").toLowerCase() === k.toLowerCase());
    if (i < 0) { await notify(env, chatId, L.totpMiss); return; }
    const gone = arr.splice(i, 1)[0];
    await putJSON(env, TOTP_KEY, arr);
    await notify(env, chatId, L.totpDelOk(gone.id, esc(gone.label)));
    return;
  }
  await reply(env, chatId, L.totpUsage);
}

export async function handleTts(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim().toLowerCase();
  const cur = (await env.KV.get(TTS_KEY)) === "on";
  const next = arg === "on" ? true : arg === "off" ? false : !cur;
  await env.KV.put(TTS_KEY, next ? "on" : "off");
  await notify(env, chatId, next ? L.ttsOnPop : L.ttsOffPop);
  if (next) await reply(env, chatId, L.ttsOnNote);
}

export function renderMemories(list, L) {
  L = L || UI.en;
  if (!list.length) return { text: L.memEmpty, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  return {
    text: L.memTitle + (list.length ? UI_SEP + list.map(x => "#" + x.id + " \u2014 " + esc(x.text)).join("\n") : ""),
    markup: { inline_keyboard: list.map(x => [{ text: "\u{1F5D1} #" + x.id, callback_data: "mdel:" + x.id }]).concat([[{ text: L.home, callback_data: "menu" }]]) }
  };
}

export function renderCharMems(card, list, L) {
  L = L || UI.en;
  const back = [[{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]];
  if (!list.length) return { text: L.cmemEmpty(card.name), markup: { inline_keyboard: back } };
  return {
    text: L.cmemTitle(card.name) + (list.length ? UI_SEP + list.map(x => "#" + x.id + " \u2014 " + esc(x.text)).join("\n") : "") + L.cmemNote,
    markup: { inline_keyboard: list.map(x => [{ text: "\u{1F5D1} #" + x.id, callback_data: "cmdel:" + x.id }]).concat(back) }
  };
}

export async function handleCmems(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const card = await getActiveCard(env);
  if (!card) { await reply(env, chatId, L.noCharCmems); return; }
  const key = CMEM_PREFIX + card.id;
  const sub = body.split(/\s+/)[0].toLowerCase();
  if (sub === "add") {
    const t = body.replace(/^add\s+/i, "").trim();
    if (!t) { await reply(env, chatId, L.cmemsAdd); return; }
    const id = await saveMemory(env, t, key);
    await notify(env, chatId, L.cmemsSaved(esc(card.name), id, esc(t.slice(0, 200))));
    return;
  }
  if (sub === "del") {
    const id = parseInt(body.split(/\s+/)[1], 10);
    if (isNaN(id)) { await reply(env, chatId, L.cmemsDel); return; }
    if (!(await deleteMemory(env, id, key))) { await reply(env, chatId, L.memGone(id)); return; }
    await notify(env, chatId, L.cmemsForgotten(id, esc(card.name)));
    return;
  }
  const view = renderCharMems(card, await getJSON(env, key, []), L);
  await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function saveMemory(env, raw, key) {
  key = key || MEM_KEY;
  const text = String(raw || "").slice(0, 200).trim();
  if (!text) return 0;
  const list = await getJSON(env, key, []);
  const id = list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  list.push({ id: id, ts: Date.now(), text: text });
  while (list.length > MEM_MAX) list.shift();
  await putJSON(env, key, list);
  return id;
}

export async function deleteMemory(env, id, key) {
  key = key || MEM_KEY;
  let list = await getJSON(env, key, []);
  const before = list.length;
  list = list.filter(x => x.id !== id);
  if (list.length === before) return false;
  await putJSON(env, key, list);
  return true;
}

export async function handleRemember(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!body) { await reply(env, chatId, L.remUse); return; }
  const id = await saveMemory(env, body);
  await notify(env, chatId, L.remembered(id, esc(body.slice(0, 200))));
}

export const maskCode = c => "\u2022".repeat(Math.min(String(c || "").length, 12));

export async function renderOtpView(env) {
  const L = await uiLang(env);
  const showCode = (await env.KV.get("otp_mask")) === "off";
  const now = Date.now();
  let hist = [];
  try { hist = JSON.parse((await env.KV.get("mail_hist")) || "[]"); } catch (_) {}

  if (env.FAILOVER_TOKEN) {
    try {
      const ph = JSON.parse((await fvGet(env, "mail_hist")) || "[]");
      if (Array.isArray(ph)) hist = hist.concat(ph.filter(h => h && h.id).map(h => ({ ...h, old: true })));
    } catch (_) {}
  }
  const byId = new Map();
  for (const h of hist) { if (!h || !h.id) continue; const p = byId.get(h.id); if (!p || (!p.old && h.old)) byId.set(h.id, h); }
  const fresh = [...byId.values()].filter(h => now - h.ts < 600000).sort((a, b) => b.ts - a.ts);
  if (!fresh.length) return { text: L.otpEmpty, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  const ago = ts => { const m = Math.floor((now - ts) / 60000); return L.otpAgo(m); };
  const cd = h => h.code ? "<code>" + (showCode ? esc(h.code) : maskCode(h.code)) + "</code> \u2014 " : "";
  const text = L.otpTitle + UI_SEP + fresh.map(h =>
    "\u2022 " + cd(h) + "<b>" + esc(h.svc || h.from || "?") + "</b>" + (h.subj ? " \u2014 " + esc(h.subj.slice(0, 60)) : "") + " (" + ago(h.ts) + ")"
  ).join("\n") + L.otpHint;
  const ob = h => (h.old ? (env.FV_OTP_BASE || "") : (env.OTP_BASE || ""));
  const kbRows = fresh.map(h => ob(h).startsWith("https://") ? [{ text: ((h.svc || h.from || "email") + (h.code ? " \u{1F511}" + (showCode ? h.code : maskCode(h.code)) : "")).slice(0, 40), url: ob(h) + "/e/" + h.id }] : null).filter(Boolean);
  kbRows.push([{ text: showCode ? L.otpMaskShow : L.otpMaskMask, callback_data: "otpmask" }]);
  kbRows.push([{ text: L.home, callback_data: "menu" }]);
  return { text: text, markup: { inline_keyboard: kbRows } };
}

export async function handleOtp(env, chatId) {
  const v = await renderOtpView(env);
  await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}

export async function handleMe(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (!body) {
    const p = await getJSON(env, PERSONA_KEY, null);
    if (!p) { await reply(env, chatId, L.meNoneCmd); return; }
    await reply(env, chatId, L.meCur(esc(p.name), p.desc ? esc(p.desc) : ""));
    return;
  }
  if (body.toLowerCase() === "off") {
    await env.KV.delete(PERSONA_KEY);
    await notify(env, chatId, L.meOffMsg);
    return;
  }
  const parts = body.split("|");
  const name = (parts[0] || "").trim().slice(0, 32);
  const desc = (parts[1] || "").trim().slice(0, 300);
  if (!name) { await reply(env, chatId, L.meNoName); return; }
  await putJSON(env, PERSONA_KEY, { name, desc, ts: Math.floor(Date.now() / 1000) });
  await notify(env, chatId, L.meSet(esc(name), desc ? esc(desc) : ""));
}

export async function listMemories(env, chatId) {
  const view = renderMemories(await getJSON(env, MEM_KEY, []), await uiLang(env));
  await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function delMemory(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const id = parseInt(body, 10);
  if (!(await deleteMemory(env, id))) { await reply(env, chatId, L.memGone(esc(body))); return; }
  await notify(env, chatId, L.memForgotten(id));
}

function sysInfoOf(env) {
  return {
    acct: env.CF_ACCT || "",
    ns: env.CF_KV_NS || "",
    sub: String(env.SELF_BASE || "").replace(/^https:\/\//, "").split(".")[0] || "your-worker",
    zone: env.OTP_ZONE || "",
    cron: env.CRON_EXPR || "* * * * *"
  };
}
export function maskId(s, keep) {
  s = String(s || "");
  return s.length <= keep * 2 ? s : s.slice(0, keep) + "…" + s.slice(-keep);
}
export function fmtDur(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + "s";
  const m = Math.floor(sec / 60);
  if (m < 60) return m + "m" + (sec % 60) + "s";
  return Math.floor(m / 60) + "j" + (m % 60) + "m";
}

export async function kvQuotaReal(env, acct, token) {
  if (!token) return null;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const q = '{viewer{accounts(filter:{accountTag:"' + acct + '"}){kvOperationsAdaptiveGroups(limit:10,filter:{datetime_geq:"' + day + 'T00:00:00Z"}){dimensions{actionType}sum{requests}}}}}';
    const r = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { "content-type": "application/json", "authorization": "Bearer " + token }, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    const accs = j && j.data && j.data.viewer && j.data.viewer.accounts;
    if (!accs || !accs.length || !accs[0].kvOperationsAdaptiveGroups) return null;
    let w = 0, rd = 0;
    for (const g of accs[0].kvOperationsAdaptiveGroups) {
      const n = (g.sum && g.sum.requests) || 0;
      const k = g.dimensions && g.dimensions.actionType;
      if (k === "write") w += n; else if (k === "read") rd += n;
    }
    return { w, r: rd };
  } catch (_) { return null; }
}

export async function handleSys(env, chatId, mid) {
  const v = await sysView(env);
  if (mid) return tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}

export const KV_LIMITS = { w: 1000, r: 100000 };
export const SEP = "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
export function fmtNum(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
export function kvBar(pct) {
  const fill = Math.max(pct > 0 ? 1 : 0, Math.min(10, Math.ceil(pct / 10)));
  return "\u2588".repeat(fill) + "\u2591".repeat(10 - fill);
}

export function kvUsage(icon, label, used, limit, est, L) {
  const head = icon + " <b>" + label + "</b>";
  if (used === null || used === undefined || !limit) {
    return head + "\n<code>Unknown / " + fmtNum(limit) + "</code>\n<code>" + "\u2591".repeat(10) + "</code>\n" + L.sysRemain + ": Unknown";
  }
  const pct = (used / limit) * 100;
  const rem = Math.max(0, limit - used);
  const pre = est ? "~" : "";
  return head + "\n<code>" + pre + fmtNum(used) + " / " + fmtNum(limit) + "</code> \u00b7 " + pct.toFixed(1) + "%\n" +
    "<code>" + kvBar(pct) + "</code>" + (pct >= 80 ? " \u26a0\ufe0f" : "") + "\n" +
    L.sysRemain + ": " + pre + fmtNum(rem);
}
export async function sysView(env) {
  const L = await uiLang(env);
  const cfq = LAST_CF || {};
  let kvOk = false, kvMs = 0;
  try {
    const t0 = Date.now();
    await env.KV.put("__sysdiag", String(t0));
    const v = await env.KV.get("__sysdiag");
    await env.KV.delete("__sysdiag");
    if (v) { kvOk = true; kvMs = Date.now() - t0; }
  } catch (_) {}
  const fvflag = await fvFlag(env);
  const fq = await kvQuotaReal(env, FV_ACCOUNT, env.FAILOVER_TOKEN);
  await flushStatsBuf(env);
  const s = (await getJSON(env, STATS_KEY, null)) || { d: {}, t: { c: 0, i: 0, o: 0 } };
  const day = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
  const td = (s.d || {})[day] || { c: 0, i: 0, o: 0 };
  const pq = await kvQuotaReal(env, sysInfoOf(env).acct, env.KVQ_TOKEN);
  const mainSec = "\u{1F7E2} <b>MAIN KV \u00b7 " + L.sysActive + "</b>" + (fvflag ? "\n" + L.sysMainFvNote : "") + "\n" +
    L.sysAcct(maskId(sysInfoOf(env).acct, 4)) + "\n" +
    L.sysNs(maskId(sysInfoOf(env).ns, 4)) + "\n" +
    (kvOk ? L.sysConnOk(kvMs) : L.sysConnFail) + "\n" +
    kvUsage("\u270d\ufe0f", "Writes", pq ? pq.w : td.c * 3, KV_LIMITS.w, !pq, L) + "\n" +
    kvUsage("\u{1F4D6}", "Reads", pq ? pq.r : null, KV_LIMITS.r, false, L) +
    (pq ? "" : "\n" + L.sysEstNote);
  const d1s = await d1Stats(env);
  let d1Sec = !d1s ? "" : (d1s.ok && d1s.rows !== null ? L.sysD1(d1s.ms, d1s.rows, d1s.ttl, d1s.wr) : L.sysD1Fail);
  const sh = d1s && d1s.sh ? await shadowInfo(env) : null;
  if (d1s && sh) {
    const age = fmtDur(sh.ageMs);
    d1Sec += "\n" + (sh.ageMs > 86400000 * 2 ? L.sysD1ShDrift(age) : L.sysD1Sh(age, sh.n));
  } else if (d1s && d1s.ok) {
    d1Sec += "\n" + L.sysD1ShNone;
  }
  const partnerSec = (fvflag ? "\u{1F7E0} <b>PARTNER KV \u00b7 " + L.sysFvActive + "</b>" : "\u{1F7E1} <b>PARTNER KV \u00b7 " + L.sysStandby + "</b>") + "\n" +
    L.sysAcct(maskId(FV_ACCOUNT, 4)) + "\n" +
    L.sysNs(maskId(FV_NS, 4)) + "\n" +
    kvUsage("\u270d\ufe0f", "Writes", fq ? fq.w : null, KV_LIMITS.w, false, L) + "\n" +
    kvUsage("\u{1F4D6}", "Reads", fq ? fq.r : null, KV_LIMITS.r, false, L) +
    (fq ? "" : "\n" + L.sysFvQFail);
  const cfai = await aiConf(env);
  let aiHost = "-";
  try { aiHost = new URL(cfai.base).host; } catch (_) {}
  let wh = L.sysWhFail;
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/getWebhookInfo", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j && j.ok && j.result && j.result.url) {
      const u = new URL(j.result.url);
      wh = L.sysWhOk(u.host, j.result.pending_update_count || 0, j.result.last_error_message ? esc(String(j.result.last_error_message).slice(0, 60)) : L.sysWhNoErr);
    }
  } catch (_) {}
  const pop = cfq.colo && cfq.colo !== "-" ? " \u00b7 POP " + esc(cfq.colo) + (cfq.city ? " (" + esc(cfq.city) + ")" : "") : "";
  const secs = [["TG_TOKEN", env.TG_TOKEN], ["AI_KEY", env.AI_KEY], ["AI_BASE", env.AI_BASE], ["AI_MODEL", env.AI_MODEL], ["SEARCH_KEY", env.SEARCH_KEY], ["HOOK_PATH", env.HOOK_PATH], ["KVQ_TOKEN", env.KVQ_TOKEN], ["FAILOVER_TOKEN", env.FAILOVER_TOKEN]];
  const workerSec = "\u{1F5A5}\ufe0f <b>WORKER</b>\n<code>" + sysInfoOf(env).sub + ".workers.dev</code>" + pop + "\n" +
    L.sysMisc(fmtDur(Date.now() - INCEPTION), sysInfoOf(env).cron) + "\n" +
    L.sysSecrets(secs.filter(x => x[1]).map(x => x[0]).join(", "));

  let cmdSec = L.sysCmdEmpty;
  try {
    const cu = (await getJSON(env, "cmduse", null)) || { d: {} };
    const days = Object.keys(cu.d || {}).sort().slice(-7);
    const agg = {};
    for (const dd of days) for (const [k, n] of Object.entries(cu.d[dd] || {})) agg[k] = (agg[k] || 0) + n;
    const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    if (rows.length) {
      const tot = rows.reduce((a, r) => a + r[1], 0);
      cmdSec = L.sysCmdTitle + "\n" + rows.slice(0, 10).map(r => "<code>" + esc(L.sysCmdRow(r[0], r[1])) + "</code>").join("\n") + "\n" + L.sysCmdTotal(tot);
    }
  } catch (_) {}
  return {
    text: [L.sysTitle, mainSec, d1Sec, partnerSec, L.sysAI(cfai.model, aiHost), wh, cmdSec, workerSec, L.sysOtp(sysInfoOf(env).zone)].filter(Boolean).join(SEP) + L.sysFoot,
    markup: { inline_keyboard: [[{ text: L.back, callback_data: "nav:stats" }, { text: L.home, callback_data: "menu" }]] }
  };
}

export function helpText(L) {
  return L.helpArr.join("\n");
}

export function helpParts(L) {
  const rows = L.helpArr;
  const parts = [];
  let cur = [], len = 0;
  for (const row of rows) {
    const rl = String(row).length + 1;
    const isHead = /^<b>[A-Z]/.test(row);
    if (len + rl > 3800 && (isHead || len > 2000)) { parts.push(cur.join("\n")); cur = []; len = 0; }
    cur.push(row); len += rl;
  }
  if (cur.length) parts.push(cur.join("\n"));
  return parts;
}

import { profEconLine } from './feat-econ.js';

export async function renderProfile(env) {
  const L = await uiLang(env);
  const e = await getJSON(env, "exp", { xp: 0 });
  const xp = e.xp || 0;
  const lv = Math.floor(xp / XP_PER_LEVEL) + 1;
  const cur = xp % XP_PER_LEVEL;
  const bar = uiBar(cur, XP_PER_LEVEL);
  const nowSec = Math.floor(Date.now() / 1000);
  const day = questDay(nowSec);
  const q = await getJSON(env, "quest", {});
  const rr = await getJSON(env, "quest_rr", { day: "", n: 0 });
  const rrN = (rr.day === day ? rr.n : 0);
  const persona = await getJSON(env, PERSONA_KEY, null);
  const qs = (q.day !== day) ? L.profQNone : q.done ? L.profQDone : q.skipped ? L.profQSkip : L.profQTodo;

  const econLine = "\n" + L.profShield(q.shields || 0, SHIELD_MAX) + (q.loot && q.loot.d === day ? lootLine(q.loot, L) : "") + await profEconLine(env, L);
  const text = L.profTitle + (persona ? esc(persona.name) : "\u2014") + UI_SEP +
    L.profLv(lv, xp) + "\n" + bar + " " + cur + "/" + XP_PER_LEVEL + "\n" + L.profNext(XP_PER_LEVEL - cur, lv + 1) + "\n" +
    "\u{1F3AF} " + L.profQLine(qs, q.streak || 0, q.points || 0) + "\n" +
    "\u{1F4B0} " + L.qPoin + ": " + (q.points || 0) + "\n" +
    L.profRrLine(rrN) + econLine;
  return { text, markup: { inline_keyboard: [
    [{ text: L.profReroll + " (" + rrN + "/" + REROLL_LIMIT + ")", callback_data: "qreroll" }, { text: L.profReset, callback_data: "qreset:ask:p" }],
    [{ text: L.bMe, callback_data: "nav:me" }, { text: L.bAch, callback_data: "ec:ach" }],
    [{ text: L.home, callback_data: "menu" }]
  ] } };
}

export async function renderStatsView(env) {
  const L = await uiLang(env);
  const cf = await aiConf(env);
  const cust = await getJSON(env, AI_CFG_KEY, null);
  const prov = cust ? (cust.label || cust.base) + " (custom)" : "default (env)";
  await flushStatsBuf(env);
  const s = (await getJSON(env, STATS_KEY, null)) || { d: {}, t: { c: 0, i: 0, o: 0 } };
  const day = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
  const td = (s.d || {})[day] || { c: 0, i: 0, o: 0 };
  const days = Object.keys(s.d || {}).sort().slice(-7);
  const w7 = days.reduce((a, k) => ({ c: a.c + s.d[k].c, i: a.i + s.d[k].i, o: a.o + s.d[k].o }), { c: 0, i: 0, o: 0 });
  const t = s.t || { c: 0, i: 0, o: 0 };

  const q = await getJSON(env, "quest", {});
  const d1s = await d1Stats(env);
  return {
    text: L.stTitle + L.statsModel(cf.model, prov) + UI_SEP + L.stUse + L.stRow(L.stToday, td) + "\n" + L.stRow(L.st7, w7) + "\n" + L.stRow(L.stTotal, t) + L.stPoin(q.points || 0, q.streak || 0) + (d1s && d1s.rows !== null ? L.stD1(d1s.rows, d1s.wr) : "") + (t.c ? "" : L.stEmpty),
    markup: { inline_keyboard: [
      [{ text: L.stRefresh, callback_data: "nav:stats" }],
      [{ text: L.bAiStats, callback_data: "nav:aistats" }, { text: L.bSys, callback_data: "sys" }, { text: L.bProf, callback_data: "nav:profile" }],
      [{ text: L.home, callback_data: "menu" }]
    ] }
  };
}

export async function renderMeView(env) {
  const L = await uiLang(env);
  const p = await getJSON(env, PERSONA_KEY, null);
  const kb = [];
  if (p) kb.push([{ text: L.meOff, callback_data: "meoff" }]);
  kb.push([{ text: L.back, callback_data: "nav:profile" }, { text: L.home, callback_data: "menu" }]);
  return { text: L.meTitle + UI_SEP + (p ? L.meNow(p) : L.meNone), markup: { inline_keyboard: kb } };
}

export async function renderUiLangView(env) {
  const en = (await env.KV.get(UI_LANG_KEY)) === "en";
  const L = en ? UI.en : UI.id;
  return {
    text: L.uiTitle + (en ? "English" : "Indonesia") + UI_SEP + L.uiNote,
    markup: { inline_keyboard: [
      [{ text: (en ? "\u2705 " : "") + L.bLangEn, callback_data: "uilang:en" }, { text: (!en ? "\u2705 " : "") + L.bLangId, callback_data: "uilang:id" }],
      [{ text: L.back, callback_data: "nav:cfg" }, { text: L.home, callback_data: "menu" }]
    ] }
  };
}

function helpSections(L) {
  const secs = [];
  let cur = null;
  for (const line of L.helpArr) {
    if (/^<b>.+<\/b>$/.test(line)) { cur = { t: line.slice(3, -4), body: [line] }; secs.push(cur); }
    else if (cur) cur.body.push(line);
  }
  return secs;
}

export function renderHelpMenu(L) {
  const secs = helpSections(L);
  const rows = [];
  for (let i = 0; i < secs.length; i += 3) rows.push(secs.slice(i, i + 3).map((s, j) => ({ text: s.t, callback_data: "help:" + (i + j) })));
  rows.push([{ text: L.bHelpFull, callback_data: "helpfull" }]);
  rows.push([{ text: L.home, callback_data: "menu" }]);
  return { text: L.helpHead, markup: { inline_keyboard: rows } };
}

export function renderHelpCat(L, i) {
  const s = helpSections(L)[i];
  if (!s) return renderHelpMenu(L);
  return { text: s.body.join("\n"), markup: { inline_keyboard: [[{ text: L.back, callback_data: "helpback" }], [{ text: L.home, callback_data: "menu" }]] } };
}

async function obWelcome(env, chatId, L) {
  await tg(env, "sendMessage", { chat_id: chatId, text: L.obHead + L.obBody, parse_mode: "HTML", reply_markup: { inline_keyboard: [
    [{ text: L.bLangEn, callback_data: "ob:lang:en" }, { text: L.bLangId, callback_data: "ob:lang:id" }]
  ] } });
}

export async function handleStart(env, msg, chatId) {
  const L = await uiLang(env);
  await flushStatsBuf(env);
  const fresh = !(await env.KV.get(CHAR_KEY)) && !(await env.KV.get(PERSONA_KEY));
  if (fresh) return obWelcome(env, chatId, L);
  const s = (await getJSON(env, STATS_KEY, null)) || { d: {} };
  const day = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
  const td = (s.d || {})[day] || { c: 0, i: 0, o: 0 };
  const text = "\u{1F916} <b>kibo v" + BOT_VER + "</b>\n" + L.startLine + "\n" + L.menuToday(td.c, fmtTok(td.i + td.o));
  await tg(env, "sendMessage", { chat_id: chatId, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: [
    [{ text: L.home, callback_data: "menu" }, { text: L.bStats, callback_data: "nav:stats" }],
    [{ text: L.bCfg, callback_data: "nav:cfg" }]
  ] } });
}

export async function listProviderModels(base) {
  try {
    const r = await fetch(base.replace(/\/+$/, "") + "/models", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const j = await r.json();
    const arr = (((j || {}).data) || j.models || []).map(m => (m && (m.id || m.name)) || "").filter(Boolean);
    return arr.length ? arr : null;
  } catch (_) { return null; }
}

export async function handleWizard(env, wiz, msg, text, chatId) {
  const L = await uiLang(env);
  if (wiz.step === "url") {
    const base = (text || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/\S+$/.test(base)) return reply(env, chatId, L.wizUrlBad);
    await reply(env, chatId, L.wizUrlSaved(base));
    const models = await listProviderModels(base);
    await putJSON(env, WIZ_KEY, { step: "model", base: base, models: models || undefined, ts: Math.floor(Date.now() / 1000) });
    if (models) {
      const rows = models.slice(0, 12).map((m, i) => [{ text: (i + 1) + ". " + String(m).slice(0, 40), callback_data: "wpick:" + i }]);
      rows.push([{ text: L.wizBtnManual, callback_data: "wskip" }]);
      rows.push([{ text: L.home, callback_data: "menu" }]);
      await tg(env, "sendMessage", { chat_id: chatId, text: L.wizModelsTitle + models.slice(0, 12).map((m, i) => (i + 1) + ". <code>" + esc(String(m).slice(0, 60)) + "</code>").join("\n") + L.wizModelsHint, parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
    } else {
      await reply(env, chatId, L.wizManualFail(base));
    }
    return;
  }
  if (wiz.step === "model") {
    const model = (text || "").trim().slice(0, 100);
    wiz.model = model; wiz.step = "key"; wiz.ts = Math.floor(Date.now() / 1000);
    delete wiz.models;
    await putJSON(env, WIZ_KEY, wiz);
    return reply(env, chatId, L.wizAskKey(model));
  }
  if (wiz.step === "key") {
    const key = (text || "").trim().slice(0, 300);
    if (msg.message_id) await tg(env, "deleteMessage", { chat_id: chatId, message_id: msg.message_id });
    await putJSON(env, AI_CFG_KEY, { base: wiz.base, key: key, model: wiz.model, label: (wiz.base || "").replace(/^https?:\/\//, "").split("/")[0] || wiz.base, ts: Date.now() });
    await env.KV.delete(WIZ_KEY);
    await tg(env, "sendMessage", { chat_id: chatId, text: L.wizDone(wiz.model || "?", wiz.base || "?"), parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "\u{1F9E0} " + L.cfgModel, callback_data: "nav:model" }], [{ text: L.home, callback_data: "menu" }]] } });
  }
}

export async function renderModelView(env) {
  const L = await uiLang(env);
  const cf = await aiConf(env);
  const custom = await getJSON(env, AI_CFG_KEY, null);
  const kb = [
    [{ text: L.mdlList, callback_data: "mmodels" }, { text: (custom ? "\u2705 " : "") + L.mdlCustom, callback_data: "mcustom" }]
  ];
  if (custom) kb.push([{ text: L.mdlReset, callback_data: "mreset" }]);
  kb.push([{ text: L.back, callback_data: "nav:cfg" }, { text: L.home, callback_data: "menu" }]);
  return {
    text: L.mdlTitle + " <code>" + esc(cf.model || "?") + "</code>\n" + L.mdlProvider + ": \u2705 " + esc(custom ? (custom.label || custom.base) : "default (env)") + (custom ? " (custom)" : "") + UI_SEP + L.mdlHint,
    markup: { inline_keyboard: kb }
  };
}

export async function renderLenView(env) {
  const L = await uiLang(env);
  const cur = (await env.KV.get(LEN_KEY)) || "medium";
  const rows = ["short", "medium", "long"].map(k => [{ text: (k === cur ? "\u2705 " : "") + k, callback_data: "len:" + k }]);
  rows.push([{ text: L.back, callback_data: "nav:cfg" }, { text: L.home, callback_data: "menu" }]);
  return { text: L.lenTitle(cur) + UI_SEP + L.lenNote, markup: { inline_keyboard: rows } };
}

export async function renderLangView(env) {
  const L = await uiLang(env);
  const cur = (await env.KV.get(LANG_KEY)) || "English";
  return {
    text: L.langTitle(cur) + UI_SEP + L.langNote,
    markup: { inline_keyboard: [
      [{ text: (cur === "English" ? "\u2705 " : "") + L.bLangEn, callback_data: "lang:en" }, { text: (cur === "Indonesian" ? "\u2705 " : "") + L.bLangId, callback_data: "lang:id" }],
      [{ text: L.bLangCustom, callback_data: "langc" }],
      [{ text: L.back, callback_data: "nav:cfg" }, { text: L.home, callback_data: "menu" }]
    ] }
  };
}

export async function renderCfgView(env) {
  const L = await uiLang(env);
  const ttsOn = (await env.KV.get(TTS_KEY)) === "on";
  const lenCur = (await env.KV.get(LEN_KEY)) || "medium";
  const langCur = (await env.KV.get(LANG_KEY)) || "English";
  const uiCur = (await env.KV.get(UI_LANG_KEY)) === "id" ? "Indonesia" : "English";
  const adlOn = (await env.KV.get(AUTO_DL_KEY)) !== "off";
  const dvCur = (await env.KV.get(DIVE_DEF_KEY)) || "";
  const dvMode = DIVE_MODES.find(m => m.k === dvCur);
  const dvShort = dvMode ? dvMode.name : L.cfgDiveAskLbl;
  const dbgOn = await getDebug(env);
  return {
    text: L.cfgTitle + UI_SEP + L.cfgLenCur(lenCur) + L.cfgLangCur(esc(langCur)) + L.cfgUiCur(uiCur) + L.cfgAutoCur(adlOn ? "ON" : "OFF"),
    markup: { inline_keyboard: [
      [{ text: L.cfgModel, callback_data: "nav:model" }, { text: L.cfgLen, callback_data: "nav:len" }],
      [{ text: L.cfgLang, callback_data: "nav:lang" }, { text: L.cfgUi, callback_data: "nav:uilang" }],
      [{ text: ttsOn ? L.cfgTtsOn : L.cfgTtsOff, callback_data: "ttsg" }],
      [{ text: adlOn ? L.cfgAutoOn : L.cfgAutoOff, callback_data: "autodlg" }],
      [{ text: L.cfgDiveBtn(dvShort), callback_data: "nav:divecfg" }],
      [{ text: L.cfgDbgBtn(dbgOn), callback_data: "nav:dbg" }],
      [{ text: L.home, callback_data: "menu" }]
    ] }
  };
}

export async function renderDiveCfg(env) {
  const L = await uiLang(env);
  const cur = (await env.KV.get(DIVE_DEF_KEY)) || "";
  const lbl = { chill: L.cfgDiveChill, normal: L.cfgDiveNormal, deep: L.cfgDiveDeep }[cur] || L.cfgDiveAskLbl;
  return {
    text: L.cfgDiveTitle + UI_SEP + L.cfgDiveHow + L.cfgDiveCur(lbl),
    markup: { inline_keyboard: [
      ...DIVE_MODES.map(m => [{ text: (cur === m.k ? "\u2705 " : "") + L.diveModeB(m), callback_data: "dvset:" + m.k }]),
      [{ text: (cur ? "" : "\u2705 ") + L.cfgDiveAsk, callback_data: "dvset:ask" }],
      [{ text: L.back, callback_data: "nav:cfg" }, { text: L.home, callback_data: "menu" }]
    ] }
  };
}

export async function handleModel(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (body.toLowerCase() === "set") {
    await putJSON(env, WIZ_KEY, { step: "url", ts: Math.floor(Date.now() / 1000) });
    await reply(env, chatId, (await uiLang(env)).wizAskUrl);
    return;
  }
  if (body.toLowerCase().startsWith("set ")) {
    const parts = body.slice(4).split("|").map(s => s.trim());
    if (parts.length < 2 || !/^https?:\/\//.test(parts[0])) { await reply(env, chatId, L.modelUse); return; }
    const cf = await aiConf(env);
    const key = parts[2] !== undefined ? parts[2] : cf.key;
    await putJSON(env, AI_CFG_KEY, { base: parts[0], model: parts[1], key: key || "", label: parts[0], ts: Date.now() });
    await env.KV.delete(WIZ_KEY);
    if (msg.message_id) await tg(env, "deleteMessage", { chat_id: chatId, message_id: msg.message_id });
    await reply(env, chatId, L.modelSaved(esc(parts[0]), esc(parts[1])));
    return;
  }
  const v = await renderModelView(env);
  await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}

export async function handleLen(env, msg, chatId) {
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim().toLowerCase();
  if (arg && LEN_HINT[arg]) { await env.KV.put(LEN_KEY, arg); await notify(env, chatId, (await uiLang(env)).lenSet(arg)); return; }
  const v = await renderLenView(env);
  await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}

export async function handleLang(env, msg, chatId) {
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim();
  if (arg) {
    await env.KV.put(LANG_KEY, arg);
    await notify(env, chatId, (await uiLang(env)).langSet(esc(arg)));
    return;
  }
  const v = await renderLangView(env);
  await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}
