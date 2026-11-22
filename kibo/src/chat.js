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
  SCENE_KEY,
  REGEN_LOCK_KEY,
  CONT_CHAIN_KEY,
  SELF_BASE,
  NUKE_CAP,
  CHAT_HIST_MAX,
  HIST_KEEP,
  HIST_SUM_KEY,
  HIST_SUM_CAP,
  SYS_HIST_SUM,
  OOC_KEY, OOC_DIRECTIVE, OOC_REMINDER,
  LIFE_NOTE_KEY,
  MEM_KEY,
  MEM_MAX,
  OWNER_FALLBACK,
  CHAR_KEY,
  CHAR_ACTIVE_KEY,
  CHAR_MAX,
  CHAR_IMPORT_KEY,
  CMEM_PREFIX,
  REL_PREFIX, AIST_FIRST_PREFIX, AIST_MSG_PREFIX, AIST_REC_PREFIX,
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
  EDIT_MARKER, EDIT_SIM_MIN, EDIT_LEN_MIN, EDIT_REGEN_MAX_AGE_S,
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
  agentChat,
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
} from './feat-remind.js';
import {
  getActiveCard,
  renderChars,
  renderPresets,
  handlePresets,
  compilePreset,
  handlePresetDoc,
  renderMenu,
  sendMenu,
  handleChar,
  b64ToUTF8,
  pngCardJSON,
  cardToPrompt,
  handleDocument,
} from './feat-chars.js';
import {
  handleTranscribe,
  handleCaption,
  TOTP_KEY,
  TOTP_PERIOD,
  TOTP_MAX,
  b32dec,
  totpCode,
  renderTotp,
  handleTotp,
  handleTts,
  renderMemories,
  renderCharMems,
  handleCmems,
  saveMemory,
  deleteMemory,
  handleRemember,
  maskCode,
  renderOtpView,
  handleOtp,
  handleMe,
  listMemories,
  delMemory,
  maskId,
  fmtDur,
  kvQuotaReal,
  handleSys,
  KV_LIMITS,
  SEP,
  fmtNum,
  kvBar,
  kvUsage,
  sysView,
  helpText,
  renderProfile,
  renderStatsView,
  renderMeView,
  renderUiLangView,
  handleStart,
  listProviderModels,
  handleWizard,
  renderModelView,
  renderLenView,
  renderLangView,
  renderCfgView,
  handleModel,
  handleLen,
  handleLang,
  chatStream,
  relEval,
  relGet,
  relStage,
} from './feat-personal.js';
import { npLine, wxLine } from './feat-ctx.js';
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
import { knobLines, clearKnobField, plotLine, oocOn, knobReminder } from './feat-rp.js';
import { getScene, sceneTarget, chapterMaybe, jealousyMaybe, sendSceneParts, rpCheckpointMaybe } from './feat-story.js';

export async function histKeyOf(env, card) {
  const c = card || await getActiveCard(env);
  return c ? HIST_SUM_KEY + "_" + c.id : HIST_SUM_KEY;
}

async function takeLifeNotes(env) {
  try {
    const arr = await getJSON(env, LIFE_NOTE_KEY, []);
    if (!arr.length) return [];
    await env.KV.delete(LIFE_NOTE_KEY);
    return arr.map(n => n.t).filter(Boolean);
  } catch (_) { return []; }
}
export async function buildSys(env, lean, tgt, sc) {
  let card = await getActiveCard(env);
  let other = null;
  if (sc && sc.b) {
    const cards = await getJSON(env, CHAR_KEY, []);
    other = cards.find(c => String(c.id) === String(sc.b)) || null;
    if (other && tgt === "b") { const sw = other; other = card; card = sw; }
  }

  const hk = await histKeyOf(env, card);
  const [mems, persona, hsum, rel, knobs, pl, npL, wxL, ln, rlen, langRaw, ooc] = await Promise.all([
    getJSON(env, card ? CMEM_PREFIX + card.id : MEM_KEY, []),
    getJSON(env, PERSONA_KEY, null),
    getJSON(env, hk, null),
    card ? relGet(env, card.id) : Promise.resolve(null),
    knobLines(env, card),
    plotLine(env),
    npLine(env),
    wxLine(env),
    takeLifeNotes(env),
    env.KV.get(LEN_KEY),
    env.KV.get(LANG_KEY),
    oocOn(env),
  ]);
  let sys = (card ? card.prompt : SYS_CHAT) + "\nTime info: it is now " + nowWIB() + ". When looking for recent things, remember the current year.";
  if (mems.length) sys += "\n" + (card ? "Your persistent memories about the user & story (format '#id | text'):" : "Persistent facts about the user (long-term memory, format '#id | text'):") + "\n" + mems.map(m => "- #" + m.id + " | " + m.text).join("\n");
  if (env.AI_BASE) sys += "\nManage it yourself: if the user mentions something that is already done / no longer applies, delete the related memory with the forget tool (by '#id' above) then confirm briefly. Important new info → remember tool. User asks to be reminded → set_reminder tool (time formats: 2h, 21:30, besok 09:00, jumat 19:00).\nYou are not a narrator of the bot, you ARE the bot: you can also read and change its personal data — reminders (list / cancel), my_status (one snapshot: level, points, quest, sleep, habits, spending, journal, countdowns), journal (read / write), habits (list / check one off), log_expense (money spent), countdown (list / add / del). Whenever the user refers to something the bot already tracks (\"reminder gw apa aja\", \"udah gw kerjain belum\", \"berapa pengeluaran gw\", \"cancel yang tadi\"), CALL THE TOOL and answer from its result — never guess, never say you saved/cancelled/deleted something without calling the tool that does it, and never invent numbers. If a tool returns an error, say plainly what failed.";
  if (persona) sys += "\nThe user you are chatting with: their name is " + persona.name + (persona.desc ? ". " + persona.desc : "") + " \u2014 use that name to address them, not just 'user'.";
  sys = sys.split("{{user}}").join(persona ? persona.name : "User").split("{{char}}").join(card ? card.name : "kibo");

  if (hsum && hsum.text) sys += "\n\nCONTEXT MEMORY (auto-condensed summary of the earlier conversation, before the visible history):\n" + hsum.text;

  if (card && rel && typeof rel.aff === "number") sys += "\nRELATIONSHIP STATE with the user (evolves slowly over time): affinity " + rel.aff + "/100 (" + relStage(rel.aff) + ")" + (rel.mood ? ", current mood: " + rel.mood : "") + (rel.note ? ". Recent dynamic: " + rel.note : "") + ". Stay consistent with it.";

  for (const kl of knobs) sys += "\n" + kl;
  if (pl) sys += "\n" + pl;
  if (npL) sys += "\n" + npL;
  if (wxL) sys += "\n" + wxL;

  if (ln.length) sys += "\n\nLIFE PROGRESS (system-observed updates since the last conversation - work them in naturally if relevant, never dump stats): " + ln.join(" ");
  if (rlen && LEN_HINT[rlen]) sys += "\nReply length for the user: " + LEN_HINT[rlen];

  if (sc && other) {
    const responder = card.name || "the character";
    const partner = other.name || "the other character";
    let sceneBlock = "\n\nGROUP SCENE (multi-character roleplay): besides " + responder + ", " + partner + " is present in this scene. " + partner + " character notes:\n" + String(other.prompt || "").slice(0, 900) + "\nSCENE RULES: the reply may contain lines from both characters - EVERY spoken line must start with the speaker's name and a colon (example: " + partner + ': "hello"), narration stays neutral. This turn: ' + (tgt === "b" ? "the user is directly replying to " + responder + "'s last message, so " + responder + " leads the reply." : "no reply-target, so " + responder + " leads the reply by default.");
    sys += sceneBlock.split("{{user}}").join(persona ? persona.name : "User").split("{{char}}").join(responder);
  }
  sys += langLine(langRaw);
  if (ooc) sys += OOC_DIRECTIVE; else sys += RP_FORMAT;
  if (lean) {
    sys += "\n\nCONTINUATION MODE: this continues a reply cut by the runtime limit \u2014 do NOT re-analyze/re-verify/re-check rules, do NOT write any thinking process in the output. Write the prose directly, continuing from the context.";
    return sys;
  }

  const [activePresets, qctx] = await Promise.all([
    (await getJSON(env, PRESET_KEY, [])).filter(p => p && p.enabled && p.compiled).sort((a, b) => (a.id || 0) - (b.id || 0)),
    questSys(env),
  ]);
  if (activePresets.length) sys += "\n\n" + activePresets.map(p => "=== PRESET: " + p.name + " ===\n" + p.compiled).join("\n\n");

  if (qctx) sys += "\n\n" + qctx;

  sys += "\n\nIMPORTANT: never show your thinking/verification process (word counting, requirement checklists, POV checks, etc) in the output \u2014 that process is silently discarded. Reply ONLY with the final content ready for the user to read.";
  if (ooc) sys += OOC_REMINDER;
  else { const kr = await knobReminder(env, card); if (kr) sys += kr; }
  return sys;
}
export async function chatTurn(env, chatId, text, histPre, userMid, replyMid) {
  const [histFull, sc, activeRaw] = await Promise.all([
    getJSON(env, CHAT_HIST_KEY, []),
    histPre === undefined ? getScene(env) : Promise.resolve(null),
    env.KV.get(CHAR_ACTIVE_KEY),
  ]);
  const hist = histPre !== undefined ? histPre : histFull.slice(-HIST_KEEP);
  const t0 = Date.now();
  if (histPre === undefined) await chapterMaybe(env, null, hist);
  const tgt = sc ? (replyMid && sc.mb === replyMid ? "b" : "a") : null;
  const respId = sc && tgt === "b" && sc.b ? sc.b : (activeRaw ? parseInt(activeRaw, 10) || undefined : undefined);
  const sys = await buildSys(env, undefined, tgt, sc);
  const msgs = [{ role: "system", content: sys }].concat(hist.map(m => ({ role: m.role, content: m.content })), [{ role: "user", content: text }]);
  const ctrl = new AbortController();
  LIVE_GEN.set(String(chatId), ctrl);

  const turnTs = Math.floor(Date.now() / 1000);
  const gen = env.AI_BASE ? agentChat(env, msgs, chatId, ctrl.signal, turnTs) : chatStream(env, msgs, 1200);
  let raw = "";
  try {
    raw = await streamReply(env, chatId, "", gen, undefined, true, ctrl);
  } finally {
    LIVE_GEN.delete(String(chatId));

  }
  if (raw) {
    await bumpStats(env, sys.length + text.length + hist.reduce((a, m) => a + (m.content || "").length, 0), raw.length, respId);
    let final = raw.replace(/\n*(?:\u{1F504}|\u{1F6D1})[^\n]*/gu, "").trim();
    final = (await questScan(env, chatId, final)).stripped;
    const la = await getJSON(env, LAST_AI_KEY, null);

    let parts = null;
    const scNow = sc ? await getScene(env) : null;
    if (sc && scNow && String(scNow.b) === String(sc.b) && la && la.mid) {
      const cardS = await getActiveCard(env);
      parts = await sendSceneParts(env, chatId, final || raw, cardS, sc, la.mid);
      if (parts) {
        for (const e of parts.entries) e.ts = turnTs;
        await putJSON(env, LAST_AI_KEY, { mid: parts.lastMid, ts: turnTs });
      }
    }
    const uE = { role: "user", content: text }; if (userMid) uE.mid = userMid; uE.ts = turnTs;
    const aE = { role: "assistant", content: final || raw }; if (!parts && la && la.mid) aE.mid = la.mid; aE.ts = turnTs;
    const h = hist.concat(parts ? [uE, ...parts.entries] : [uE, aE]).slice(-CHAT_HIST_MAX);
    const goneMidTurn = histFull.length > 0 && (await env.KV.get(CHAT_HIST_KEY)) === null;
    if (!goneMidTurn) await putJSON(env, CHAT_HIST_KEY, h);
    if (sc) {
      const sc2 = await getScene(env);
      if (sc2 && String(sc2.b) === String(sc.b)) {
        if (parts) { sc2.ma = parts.mids.a || sc2.ma; sc2.mb = parts.mids.b || sc2.mb; }
        else if (la && la.mid) sc2[tgt === "b" ? "mb" : "ma"] = la.mid;
        await putJSON(env, SCENE_KEY, sc2);
        if (tgt === "b") { const cardA = await getActiveCard(env); await jealousyMaybe(env, chatId, cardA, h, sc2); }
      }
    }
    await flushNukeBuf(env);
    if (histPre === undefined && Date.now() - t0 < 35000) { await slimHist(env, histFull); await relEval(env, hist); await rpCheckpointMaybe(env, null, histFull, turnTs); }
    await ttsSpeak(env, chatId, final);
    await maybeAutoCont(env, raw);
  }
  return raw || "";
}

async function slimHist(env, histFull) {
  try {
    const overflow = histFull.length - HIST_KEEP;
    if (overflow <= 0) return null;
    const hk = await histKeyOf(env);
    const prev = await getJSON(env, hk, null);
    const now = Date.now();
    if (prev && prev.ts && now - prev.ts < (Number(env.HIST_SLIM_GAP_MS) || 20 * 60 * 1000)) return null;
    const dropped = histFull.slice(0, overflow);
    if (!dropped.length) return null;
    const convo = dropped.map(m => (m.role === "user" ? "User: " : "AI: ") + String(m.content || "")).join("\n").slice(0, 6000);
    const msgs = [{ role: "system", content: SYS_HIST_SUM }, { role: "user", content: (prev && prev.text ? "Current running summary:\n" + prev.text + "\n\n" : "") + "New dialogue that fell out of the recent context window:\n" + convo }];
    let out = "";
    for await (const d of chatStream(env, msgs, 400)) out += d;
    out = stripThink(out).trim();
    if (!out) return null;
    const rec = { text: out.slice(0, HIST_SUM_CAP), ts: now, n: ((prev && prev.n) || 0) + dropped.length };
    await putJSON(env, hk, rec);
    return rec;
  } catch (e) { return null; }
}

export async function maybeAutoCont(env, raw) {
  try {
    if (!/\u23F1/.test(String(raw))) {
      if (await env.KV.get(CONT_CHAIN_KEY)) await env.KV.delete(CONT_CHAIN_KEY);
      return;
    }
    if (!LIVE_CTX || !LIVE_CTX.waitUntil) return;
    const now = Date.now();
    const ch = (await getJSON(env, CONT_CHAIN_KEY, null)) || { n: 0, ts: now };
    if (now - (ch.ts || 0) >= 600000) ch.n = 0;
    if ((ch.n || 0) >= 2) return;
    await putJSON(env, CONT_CHAIN_KEY, { n: (ch.n || 0) + 1, ts: now });
    const owner = Number(await env.KV.get("owner_chat")) || 0;
    if (!owner) return;
    const upd = { update_id: now, message: { message_id: 990000000 + (ch.n || 0), date: Math.floor(now / 1000), chat: { id: owner, type: "private" }, from: { id: owner, is_bot: false, first_name: "owner" }, text: "/continue" } };
    LIVE_CTX.waitUntil(fetch((env.SELF_BASE || SELF_BASE) + "/hook/" + env.HOOK_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(upd), signal: AbortSignal.timeout(180000) }).then((r) => { if (!r.ok) throw new Error("selfhook " + r.status); }).catch(() => {}));
  } catch (_) {}
}

export async function handleAbort(env, chatId) {
  const L = await uiLang(env);
  const k = String(chatId);
  const ctrl = LIVE_GEN.get(k);
  if (ctrl && !ctrl.signal.aborted) {
    ctrl.abort(new Error("user /abort"));
    try { await env.KV.delete(REGEN_LOCK_KEY); } catch (_) {}
    return notify(env, chatId, L.abLive);
  }

  await putJSON(env, ABORT_KEY, { chat: k, ab: true, ts: Math.floor(Date.now() / 1000) });
  try { await env.KV.delete(REGEN_LOCK_KEY); } catch (_) {}
  return notify(env, chatId, L.abSent);
}

export async function handleUndo(env, chatId) {
  const L = await uiLang(env);
  const hist = await getJSON(env, CHAT_HIST_KEY, []);
  if (!hist.length) { await notify(env, chatId, L.undoEmpty); return; }
  let drop = 1;
  const last = hist[hist.length - 1];
  if (last && last.role === "assistant" && hist.length >= 2 && hist[hist.length - 2].role === "user") drop = 2;
  await putJSON(env, CHAT_HIST_KEY, hist.slice(0, hist.length - drop));
  await notify(env, chatId, L.undoDone(drop));
}

export async function handleRegen(env, chatId, showBtn) {
  const now = Math.floor(Date.now() / 1000);
  const lock = await getJSON(env, REGEN_LOCK_KEY, null);
  if (lock && now - (lock.ts || 0) < 95) {
    await notify(env, chatId, (await uiLang(env)).regenBusy);
    return;
  }
  const hist = await getJSON(env, CHAT_HIST_KEY, []);
  let ui = -1;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i] && hist[i].role === "user") { ui = i; break; }
  }
  if (ui < 0) {
    await notify(env, chatId, (await uiLang(env)).regenEmpty);
    return;
  }
  await putJSON(env, REGEN_LOCK_KEY, { ts: now }, { ttlMs: 90000 });
  try {
    const lastAi = await getJSON(env, LAST_AI_KEY, null);
    if (lastAi && lastAi.mid) await tg(env, "deleteMessage", { chat_id: chatId, message_id: lastAi.mid });
    const text = String((hist[ui] && hist[ui].content) || "");
    const trimmed = hist.slice(0, ui).slice(-CHAT_HIST_MAX);
    await putJSON(env, CHAT_HIST_KEY, trimmed);
    const raw = await chatTurn(env, chatId, text, trimmed);
    if (!raw || !showBtn) return;
    const L = await uiLang(env);
    const j = await tg(env, "sendMessage", {
      chat_id: chatId,
      text: L.regenQ,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: L.regenYes, callback_data: "regen:yes" }, { text: L.regenNo, callback_data: "regen:no" }]] }
    });
    const bmid = j && j.result && j.result.message_id;
    if (bmid) scheduleRegenBtnDrop(env, chatId, bmid);
  } finally {
    await env.KV.delete(REGEN_LOCK_KEY);
  }
}

export function scheduleRegenBtnDrop(env, chatId, mid) {
  const ms = parseInt((env && env.REGEN_BTN_MS) || "30000", 10);
  setTimeout(() => {
    tg(env, "deleteMessage", { chat_id: chatId, message_id: mid }).catch(() => {});
  }, ms);
}

export async function handleContinue(env, chatId) {
  const L = await uiLang(env);
  const hist = await getJSON(env, CHAT_HIST_KEY, []);
  let ai = -1;
  for (let i = hist.length - 1; i >= 0; i--) { if (hist[i] && hist[i].role === "assistant") { ai = i; break; } }
  const raw = ai >= 0 ? String((hist[ai] && hist[ai].content) || "") : "";
  if (!/\u23F1/.test(raw)) { await notify(env, chatId, L.contNone); return; }
  const partial = raw.replace(/\n*\u23F1[^\n]*/g, "").trim();

  const lastOp = partial.lastIndexOf(DET_OP);
  const contStart = lastOp >= 0 && partial.indexOf(DET_CL, lastOp) < 0 ? 2 : 0;

  const now = Math.floor(Date.now() / 1000);
  const lock = await getJSON(env, REGEN_LOCK_KEY, null);
  if (lock && now - (lock.ts || 0) < 95) { await notify(env, chatId, L.contBusy); return; }
  await putJSON(env, REGEN_LOCK_KEY, { ts: now }, { ttlMs: 90000 });
  const m1 = hist[ai].mid || 0;
  try {
    const sys = await buildSys(env, true);
    const base = partial
      ? hist.slice(0, ai + 1).map((m, idx) => idx === ai ? { role: "assistant", content: partial } : { role: m.role, content: m.content })
      : hist.slice(0, ai);
    const note = partial
      ? "(system note for AI) your last answer was just cut by the runtime limit EXACTLY MID-TEXT (last assistant entry above). CONTINUE precisely from where it stopped: do NOT repeat existing sentences, do NOT write a new opener/greeting/title, continue the sentence directly. Still follow all format & persona rules."
      : "(system note for AI) your answer was cut by the runtime limit before you wrote anything \u2014 write the FULL answer now from the start, straight prose without analysis/rule-checking.";
    const msgs = [{ role: "system", content: sys }].concat(base, [{ role: "user", content: note }]);
    const ctrl = new AbortController();
    LIVE_GEN.set(String(chatId), ctrl);
    let cont = "";
    try {
      const gen = env.AI_BASE ? agentChat(env, msgs, chatId, ctrl.signal, now, contStart, true) : chatStream(env, msgs, 1500);
      cont = await streamReply(env, chatId, "", gen, undefined, true, ctrl);
    } finally {
      LIVE_GEN.delete(String(chatId));
    }
    if (!cont) return;
    const contCut = /\u23F1/.test(cont);
    let contClean = stripQuoteMeta(cont.replace(/\n*(?:\u{1F504}|\u{1F6D1}|\u23F1)[^\n]*/gu, "").trim());
    contClean = (await questScan(env, chatId, contClean)).stripped;
    if (!contClean) return;
    const la = await getJSON(env, LAST_AI_KEY, null);
    hist[ai] = { role: "assistant", content: ((partial ? partial + "\n\n" : "") + contClean + (contCut ? "\n\n" + WD_CUT_NOTE.trim() : "")).trim(), mid: (la && la.mid) || m1, ts: hist[ai].ts || now };
    await putJSON(env, CHAT_HIST_KEY, hist.slice(-CHAT_HIST_MAX));
    await flushNukeBuf(env);
    await bumpStats(env, sys.length + msgs.reduce((a, m) => a + (m.content || "").length, 0), contClean.length);
    await ttsSpeak(env, chatId, contClean).catch(() => {});
    if (m1 && partial) {
      const fixText = mdTg(esc(partial.slice(0, 3500))) + (partial.length > 3500 ? " \u2026" : "");
      try { await tg(env, "editMessageText", { chat_id: chatId, message_id: m1, text: fixText, parse_mode: "HTML" }); } catch (_) {}
    } else if (m1) {
      try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: m1 }); } catch (_) {}
    }
  } finally {
    await env.KV.delete(REGEN_LOCK_KEY);
  }
}

export async function handleDelete(env, msg, chatId) {
  const L = await uiLang(env);
  const r = msg.reply_to_message;
  if (!r || !r.message_id) { await reply(env, chatId, L.delUsage); return; }
  const target = r.message_id;
  const okDel = await tryDeleteIds(env, chatId, [target]);
  const hist = await getJSON(env, CHAT_HIST_KEY, []);
  let i = hist.length - 1;
  while (i >= 0 && (!hist[i] || hist[i].mid !== target)) i--;
  const failNote = okDel ? "" : "\n" + L.delTgFail;
  if (i < 0) { await notify(env, chatId, L.delOkNoCtx + failNote); return; }
  const drop = (hist[i].role === "user" && hist[i + 1] && hist[i + 1].role === "assistant") ? 2 : 1;
  hist.splice(i, drop);
  await putJSON(env, CHAT_HIST_KEY, hist);
  await notify(env, chatId, L.delOk(drop) + failNote);
}

export async function handleRewind(env, msg, chatId) {
  const L = await uiLang(env);
  const r = msg.reply_to_message;
  if (!r || !r.message_id) { await reply(env, chatId, L.rwUsage); return; }
  const lock = await getJSON(env, REGEN_LOCK_KEY, null);
  const nowS = Math.floor(Date.now() / 1000);
  if (lock && nowS - (lock.ts || 0) < 120) { await notify(env, chatId, L.rwBusy); return; }
  const target = r.message_id;
  const t0 = r.date || nowS;
  const hist = await getJSON(env, CHAT_HIST_KEY, []);
  let idx = -1;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i] && hist[i].role === "assistant" && hist[i].mid === target) { idx = i; break; }
  }
  const tracked = await getJSON(env, NUKE_KEY, []);
  const ids = []; const seen = new Set([target]);
  for (const e of tracked) {
    if (!e || typeof e.i !== "number" || e.t <= t0 || nowS - e.t >= 47 * 3600 || seen.has(e.i)) continue;
    seen.add(e.i); ids.push(e.i);
  }
  if (idx >= 0) {
    const laR = await getJSON(env, LAST_AI_KEY, null);
    if (laR && typeof laR.mid === "number" && laR.mid !== target) {
      const lt = laR.ts || t0 + 1;
      if (lt > t0 && nowS - lt < 47 * 3600 && !seen.has(laR.mid)) { seen.add(laR.mid); ids.push(laR.mid); }
    }
    for (let k = idx + 1; k < hist.length; k++) {
      const he = hist[k];
      if (!he || typeof he.mid !== "number") continue;
      const et = typeof he.ts === "number" ? he.ts : t0 + 1;
      if (seen.has(he.mid) || et <= t0 || nowS - et >= 47 * 3600) continue;
      seen.add(he.mid); ids.push(he.mid);
    }
  }
  const ok = await tryDeleteIds(env, chatId, ids);
  if (idx >= 0) {
    await putJSON(env, CHAT_HIST_KEY, hist.slice(0, idx + 1));
    await putJSON(env, LAST_AI_KEY, { mid: target, ts: t0 });
    await notify(env, chatId, L.rwOk(ok, ids.length));
  } else {
    await notify(env, chatId, L.rwNoCtx(ok, ids.length));
  }
}

function normForSim(s) {
  return String(s || "").toLowerCase().replace(/[*_~>#]/g, " ").replace(/\s+/g, " ").trim();
}

function simRatio(a, b) {
  a = normForSim(a); b = normForSim(b);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  if (m > 4000 || n > 4000) return 0;
  if (Math.abs(m - n) > Math.max(m, n) * 0.5) return 0;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    const tmp = prev; prev = cur; cur = tmp;
  }
  return 1 - prev[n] / Math.max(m, n);
}

export async function maybeReplyEdit(env, msg, chatId) {
  const r = msg.reply_to_message;
  if (!r || !r.message_id) return false;
  const text = (msg.text || "").trim();
  if (!text) return false;
  const target = r.message_id;
  const marker = text.startsWith(EDIT_MARKER);
  const hist = await getJSON(env, CHAT_HIST_KEY, []);
  let idx = -1;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i] && hist[i].role === "assistant" && hist[i].mid === target) { idx = i; break; }
  }
  if (!marker && idx < 0) return false;
  const L = await uiLang(env);
  const newText = marker ? text.slice(EDIT_MARKER.length).trim() : text;
  if (marker && !newText) { await notify(env, chatId, L.edUsage); return true; }
  if (idx < 0) { await notify(env, chatId, L.edNoCtx); return true; }
  if (!marker) {
    if (normForSim(text).length < EDIT_LEN_MIN) return false;
    if (simRatio(text, String((hist[idx] && hist[idx].content) || "")) < EDIT_SIM_MIN) return false;
  }
  const nowS = Math.floor(Date.now() / 1000);
  const lock = await getJSON(env, REGEN_LOCK_KEY, null);
  if (lock && nowS - (lock.ts || 0) < 95) { await notify(env, chatId, L.rwBusy); return true; }
  const body = mdTg(esc(newText.slice(0, 3500))) + (newText.length > 3500 ? " \u2026" : "");
  const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: target, text: body, parse_mode: "HTML" });
  if (!j || !j.ok) {
    const d = String((j && j.description) || "");
    if (d.includes("message is not modified")) { await tryDeleteIds(env, chatId, [msg.message_id]); return true; }
    await reply(env, chatId, L.edFail + esc(d || "?"));
    return true;
  }
  hist[idx].content = newText;
  await putJSON(env, CHAT_HIST_KEY, hist);
  await tryDeleteIds(env, chatId, [msg.message_id]);
  return true;
}

export async function handleEditedMsg(env, msg) {
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const owner = await env.KV.get("owner_chat");
  const ofb = String(env.OWNER_FALLBACK || OWNER_FALLBACK);
  if (!owner) { if (ofb && String(chatId) !== ofb) return; await env.KV.put("owner_chat", String(chatId)); }
  else if (owner !== String(chatId)) return;
  const mid = msg.message_id;
  if (!mid) return;
  const text = (msg.text || "").trim();
  if (!text || text.startsWith("/")) return;
  const nowS = Math.floor(Date.now() / 1000);
  const ed = msg.edit_date || 0;
  if (!ed || nowS - ed > EDIT_REGEN_MAX_AGE_S) return;
  const hist = await getJSON(env, CHAT_HIST_KEY, []);
  let ui = -1;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i] && hist[i].role === "user" && hist[i].mid === mid) { ui = i; break; }
  }
  if (ui < 0) return;
  const lock = await getJSON(env, REGEN_LOCK_KEY, null);
  if (lock && nowS - (lock.ts || 0) < 95) return;
  const uiTs = (typeof hist[ui].ts === "number" && hist[ui].ts) || msg.date || 0;
  const seen = new Set([mid]);
  const ids = [];
  if (uiTs > 0) {
    const tracked = await getJSON(env, NUKE_KEY, []);
    for (const e of tracked) {
      if (!e || typeof e.i !== "number" || seen.has(e.i)) continue;
      const et = e.t || 0;
      if (et <= uiTs || nowS - et >= 47 * 3600) continue;
      seen.add(e.i); ids.push(e.i);
    }
  }
  const laR = await getJSON(env, LAST_AI_KEY, null);
  if (laR && typeof laR.mid === "number" && !seen.has(laR.mid)) {
    const lt = laR.ts || 0;
    if (lt > uiTs && nowS - lt < 47 * 3600) { seen.add(laR.mid); ids.push(laR.mid); }
  }
  for (let k = ui + 1; k < hist.length; k++) {
    const he = hist[k];
    if (!he || typeof he.mid !== "number" || seen.has(he.mid)) continue;
    const et = typeof he.ts === "number" ? he.ts : nowS;
    if (nowS - et >= 47 * 3600) continue;
    seen.add(he.mid); ids.push(he.mid);
  }
  await tryDeleteIds(env, chatId, ids);
  const trimmed = hist.slice(0, ui).slice(-CHAT_HIST_MAX);
  await putJSON(env, CHAT_HIST_KEY, trimmed);
  await putJSON(env, REGEN_LOCK_KEY, { ts: nowS }, { ttlMs: 90000 });
  try {
    await chatTurn(env, chatId, text, trimmed, mid);
  } finally {
    await env.KV.delete(REGEN_LOCK_KEY);
  }
}

export async function handleReaction(env, mr) {
  const owner = await env.KV.get("owner_chat");
  if (!owner || !mr.user || String(mr.user.id) !== owner) return;
  if (!Array.isArray(mr.new_reaction) || !mr.new_reaction.length) return;
  if (!mr.chat || String(mr.chat.id) !== owner || !mr.message_id) return;
  const tracked = await getJSON(env, NUKE_KEY, []);
  const nb = NUKE_BUFS.get(env);
  if (!tracked.some(x => x && x.i === mr.message_id) && !(nb && nb.buf.some(x => x.i === mr.message_id))) {
    const la = await getJSON(env, LAST_AI_KEY, null);
    if (!la || la.mid !== mr.message_id) return;
  }
  return handleRegen(env, mr.chat.id);
}

export async function resetCharData(env, card) {
  try {
    await Promise.all([
      env.KV.delete(REL_PREFIX + card.id),
      env.KV.delete(AIST_FIRST_PREFIX + card.id),
      env.KV.delete(AIST_MSG_PREFIX + card.id),
      env.KV.delete(AIST_REC_PREFIX + card.id),
      env.KV.delete(HIST_SUM_KEY + "_" + card.id),
    ]);
  } catch (_) {}
  await clearKnobField(env, card.id, "outfit");
}

export async function handleReset(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim().toLowerCase();
  if (arg === "char" || arg.startsWith("char ")) {
    const card = await getActiveCard(env);
    if (!card) { await reply(env, chatId, L.noCharReset); return; }
    const list = await getJSON(env, CMEM_PREFIX + card.id, []);
    await tg(env, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text: L.resetCharAsk(esc(card.name), list.length), reply_markup: { inline_keyboard: [[{ text: L.rstYesPurge, callback_data: "rsc:" + card.id }, { text: L.rstNo, callback_data: "rstcx" }]] } });
    return;
  }

  if (/^\d+$/.test(arg)) {
    const cards = await getJSON(env, CHAR_KEY, []);
    const target = cards.find(c => String(c.id) === arg) || cards[parseInt(arg, 10) - 1] || null;
    if (!target) { await reply(env, chatId, L.resetNumNF); return; }
    await tg(env, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text: L.resetNumAsk(esc(target.name || "#" + target.id), cards.indexOf(target) + 1), reply_markup: { inline_keyboard: [[{ text: L.rstYes, callback_data: "rsn:" + target.id }, { text: L.rstNo, callback_data: "rstcx" }]] } });
    return;
  }

  await tg(env, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text: L.rstAsk, reply_markup: { inline_keyboard: [[{ text: L.rstYes, callback_data: "rstok" }, { text: L.rstNo, callback_data: "rstcx" }]] } });
}
