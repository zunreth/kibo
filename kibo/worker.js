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
  HIST_SUM_KEY,
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
  REL_PREFIX,
  PERSONA_KEY,
  AI_CFG_KEY,
  LEN_KEY,
  LANG_KEY,
  UI_LANG_KEY,
  STATS_KEY,
  VIBE_PRESETS, PLOT_DIR_KEY, OOC_KEY, RP_SAVES_PREFIX, RP_CKPT_PREFIX, CHAPTERS_PREFIX, SCENE_KEY,
  AIST_FIRST_PREFIX, AIST_MSG_PREFIX, AIST_REC_PREFIX, AIST_WRAP_PREFIX,
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
  AUTO_DL_KEY,
  DIVE_DEF_KEY,
  NH_DEF_KEY,
  NH_HOST_KEY,
  NH_PDFQ_KEY,
} from './src/consts.js';
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
} from './src/base.js';
import { askSet, askGet, askClear } from './src/ask.js';
import { cronBeat } from './src/cron-ledger.js';
import { hcPing } from './src/health.js';
const ASK_ROUTES = { rp: rpAsk, sfan: gameFanAsk };
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
  bumpCmd,
} from './src/kv.js';
import { wrapStore, d1Sweep, shadowSync } from './src/store-d1.js';
import { handleNotify } from './src/feat-notify.js';
import { handleDebug, handleDbgFlag, dbgLog, renderDebugView, renderLogView, setDebug, clearDbgRing, armStream } from './src/feat-debug.js';
import { handleChain, chainStartCb, chainQuitCb, chainQuit2Cb, chainViewCb } from './src/feat-chain.js';
import {
  UI,
  uiLang,
  fmtTok,
  fmtWIB,
  nowWIB,
} from './src/ui.js';
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
} from './src/ai.js';
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
  handleShield,
  XP_PER_LEVEL,
  REROLL_LIMIT,
  expAdd,
  RR_LOCK,
  questReroll,
  questReset,
  questKb,
  fireQuest,
  questView,
  qresetConfirmView,
  handleQuest,
  handleQuestCb,
  NAG_AT,
  remindMsg,
  runCron,
  photoqView, photoqVerify,
} from './src/feat-remind.js';
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
  renderGallery, sendCardArt,
} from './src/feat-chars.js';
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
  helpParts,
  renderHelpMenu,
  renderHelpCat,
  renderProfile,
  renderStatsView,
  renderUsageView,
  renderMeView,
  renderUiLangView,
  handleStart,
  listProviderModels,
  handleWizard,
  renderModelView,
  renderLenView,
  renderLangView,
  renderCfgView,
  renderNhSetHub,
  renderNhDefView,
  renderNhProvView,
  renderNhPdfqView,
  renderNhStatsView,
  renderDiveCfg,
  handleModel,
  handleLen,
  handleLang,
  chatStream,
} from './src/feat-personal.js';
import {
  fmtSize,
  vaultMedia,
  vaultTg,
  vaultCopyToChannel,
  vaultArchiveDl,
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
} from './src/feat-vault.js';
import {
  renderFeeds,
  resolveFeedUrl,
  decodeEnt,
  cleanTag,
  parseFeed,
  handleRss,
  checkFeeds,
} from './src/feat-rss.js';
import { handleGame, gameIntercept, gameMenu, gameWordStart, gameStop, gameQuizStart, gameQuizPick, pvpStart, pvpStop, handleBet, gameLyricStart, gameLyricPick, gameSongStart, gameSongPick, gameFanMenu, gameFanStart, gameFanPick, gameFanAskOpen, gameFanAsk, gameFanAskCancel, gameIdleTick, gameLeave } from './src/feat-game.js';
import { diveStart, diveSkip, diveStop, divePrac, diveModePick, diveIntercept, diveCronTick, divePreGen } from './src/feat-dive.js';
import { handleShop, shopBuy, handleInv, invUse, handleGacha, gachaPull, handleCharms, charmEq, handleAch, bmSave, handleHub } from './src/feat-econ.js';
import { rlAdd, rlView, rlToggle, rlDel, otdView, shortAdd, shortResolve, wrapView, pasteAdd, pasteGet, handleHn } from './src/feat-b8.js';
import { SHORT_KEY } from './src/consts.js';
import { handleDl, handleSong, handleSpotify, dlPlatform, delQsweep, handleDlPick, handleYts, handleYtsPick, handleYtBuild, handleYtCb, handleNh, handleNhSave, handleNhs, handleNhop, handleNhNzip, handleNhCb, nhLinkId, nhRun, nhWatchdog } from './src/feat-media.js';
import { handleSauceCmd, handleSaucePhoto } from './src/feat-sauce.js';
import { handleHostCmd, handleHostPhoto, handleHostCb, handleHostCancel, hostTrack, hostLinkFind, handleHostFetch } from './src/feat-host.js';
import { handleAnime, handleWx, handleNp } from './src/feat-ctx.js';
import { renderVibeView, handleVibe, setVibe, clearKnobField, purgeKnobs, handleOutfit, handlePlot, handleDice, handleOoc, renderRpMenu, renderOutfitView, renderPlotView, handleRpReset, rpAsk } from './src/feat-rp.js';
import { handleRp, handleScene, renderRpSavesView, rpSaveSlot, rpRestoreSlot, rpDelSlot, getScene } from './src/feat-story.js';
import { renderAistatsHub, renderAistatDetail, aistWrapped } from './src/feat-aistats.js';
import { handleFocus, handleSleep, handleHabit, handleBeli, handleCapsule, handleHabitCb, focusIntercept, handleHplanCb, handleCountdown, handleAma, handleAlarm, fReact } from './src/feat-life.js';
import {
  buildSys,
  chatTurn,
  histKeyOf,
  maybeAutoCont,
  handleAbort,
  handleRegen,
  scheduleRegenBtnDrop,
  handleContinue,
  handleDelete,
  handleRewind,
  handleEditedMsg,
  maybeReplyEdit,
  handleReaction,
  handleReset,
  resetCharData,
} from './src/chat.js';

export default {
  async fetch(request, env, ctx) {
    setLiveCtx(ctx);
    try { if (!env.__kvw) { env.KV = wrapStore(env); env.__kvw = true; } } catch (_) {}
    try { setLastCf({ colo: (request.cf && request.cf.colo) || "-", city: (request.cf && request.cf.city) || "" }); } catch (_) {}
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return new Response("kibo alive\n", { headers: { "content-type": "text/plain" } });
    }
    if (request.method === "GET" && url.pathname.startsWith("/s/")) {
      const target = await shortResolve(env, url.pathname.slice(3));
      if (target) return Response.redirect(target, 302);
      return new Response("not found", { status: 404 });
    }
    if (request.method === "GET" && url.pathname.startsWith("/p/")) {
      const t = await pasteGet(env, url.pathname.slice(3));
      if (t) return new Response(t, { headers: { "content-type": "text/plain; charset=utf-8" } });
      return new Response("not found", { status: 404 });
    }
    if (url.pathname === "/notify") return handleNotify(request, env);
    if (request.method === "POST" && url.pathname === "/nhcb") return handleNhCb(request, env); // v2.70.4: callback GHA builder zip
    if (request.method === "POST" && url.pathname === "/ytcb") return handleYtCb(request, env); // v2.76.0: callback GHA builder yt-dlp
    if (request.method === "GET" && url.pathname === "/dbg") return handleDbgFlag(request, env);
    if (request.method !== "POST" || !url.pathname.startsWith("/hook/")) {
      return new Response("not found", { status: 404 });
    }
    if (!env.HOOK_PATH || url.pathname !== "/hook/" + env.HOOK_PATH) {
      return new Response("forbidden", { status: 403 });
    }
    let update;
    try { update = await request.json(); } catch (_) { return new Response("bad json", { status: 400 }); }

    const isProbe = request.headers.get("x-zb-probe") === "1";
    const runEnv = isProbe ? Object.assign(Object.create(env), { __probe: [] }) : env;

    const p = handleUpdate(update, runEnv).catch(e => onUpdErr(runEnv, e));
    ctx.waitUntil(p);
    let toId = null;
    try {
      await Promise.race([p, new Promise(r => { toId = setTimeout(r, Number(env.RESP_DEADLINE_MS) || 55000); })]);
    } finally { clearTimeout(toId); }
    if (isProbe) {
      for (const s of runEnv.__probe) if (s.mid) scheduleDelete(runEnv, s.chat, s.mid, parseInt(env.PROBE_DEL_MS || "", 10) || 15000);
      return new Response(JSON.stringify({ ok: true, probe: true, sent: runEnv.__probe.length, out: runEnv.__probe.map(s => s.fn ? { method: s.method, mid: s.mid, text: s.text, fn: s.fn } : { method: s.method, mid: s.mid, text: s.text, kb: s.kb }) }), { headers: { "content-type": "application/json" } });
    }
    return new Response("ok");
  },
  async scheduled(event, env, ctx) {
    setLiveCtx(ctx);
    try { if (!env.__kvw) { env.KV = wrapStore(env); env.__kvw = true; } } catch (_) {}
    // R-02: every job leaves a heartbeat, so a job that stops firing becomes visible in /sys instead
    // of being noticed weeks later. A failing job reports through the R-05 path and marks the tick
    // unhealthy for the R-03 dead-man switch.
    ctx.waitUntil((async () => {
      let allOk = true;
      const beat = async (name, p) => {
        try {
          await p;
          await cronBeat(env, name, true);
        } catch (e) {
          allOk = false;
          await onUpdErr(env, e);
          await cronBeat(env, name, false, e);
        }
      };
      await beat("cron", runCron(env));
      await Promise.all([
        beat("stats", flushStatsBuf(env)), beat("nuke", flushNukeBuf(env)), beat("d1", d1Sweep(env)),
        beat("shadow", shadowSync(env)), beat("delq", delQsweep(env)),
        beat("nhwatch", nhWatchdog(env).catch(() => {})), beat("dive", diveCronTick(env).catch(() => {})),
        beat("divegen", divePreGen(env).catch(() => {})), beat("gameidle", gameIdleTick(env).catch(() => {}))
      ]);
      await hcPing(env, allOk);
    })());
  }
};

async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(env, update.callback_query);
  if (update.message_reaction) return handleReaction(env, update.message_reaction);

  if (update.edited_message) return handleEditedMsg(env, update.edited_message);
  const msg = update.message;
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const owner = await env.KV.get("owner_chat");
  const ofb = String(env.OWNER_FALLBACK || OWNER_FALLBACK);
  if (!owner) {
    if (ofb && String(chatId) !== ofb) return;
    await env.KV.put("owner_chat", String(chatId));
  } else if (owner !== String(chatId)) {
    return;
  }
  await stampAlive(env);
  await trackNukeMsg(env, msg.message_id);
  if (await maybeReplyEdit(env, msg, chatId)) return;

  const text = (msg.text || "").trim();
  const cmd = (text.split(/\s+/)[0] || "").split("@")[0].toLowerCase();
  if (cmd.startsWith("/")) { bumpCmd(env, cmd); dbgLog(env, "cmd", cmd); }
  if (cmd.startsWith("/") && cmd !== "/cancel") await env.KV.delete(VAULT_OP_KEY);
  if (await focusIntercept(env, chatId, cmd, text, msg.message_id)) return;

  if (msg.voice || msg.audio) return handleTranscribe(env, msg, chatId);
  if (msg.photo || msg.document) await hostTrack(env, chatId, msg);
  if (msg.photo && (msg.caption || "").trim().toLowerCase().startsWith("/sauce")) return handleSaucePhoto(env, msg, chatId);
  if (msg.photo && (msg.caption || "").trim().toLowerCase().startsWith("/host")) return handleHostPhoto(env, msg, chatId);
  if (msg.photo) return handleCaption(env, msg, chatId);
  if (msg.document) return handleDocument(env, msg, chatId);
  if (!cmd.startsWith("/") && text) { const hl = hostLinkFind(text); if (hl) return handleHostFetch(env, chatId, hl); }

  if (cmd === "/help") { const v = renderHelpMenu(await uiLang(env)); return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  if (cmd === "/start") return handleStart(env, msg, chatId);
  if (cmd === "/ping") return notify(env, chatId, "pong " + fmtWIB(Math.floor(Date.now() / 1000), await uiLang(env)));
  if (cmd === "/otp") return handleOtp(env, chatId);
  if (cmd === "/j" || cmd === "/journal") return handleJournal(env, msg, chatId);
  if (cmd === "/digest") return sendDigest(env, chatId, false);
  if (cmd === "/remind") return handleRemind(env, msg, chatId);
  if (cmd === "/reminds") return listReminders(env, chatId);
  if (cmd === "/del") return delReminder(env, msg, chatId);
  if (cmd === "/quest") {
    const qb = (msg.text || "").replace(/^\/\S+\s*/, "").trim().toLowerCase();
    if (qb.startsWith("reroll")) { const rs = await questReroll(env, chatId); if (rs === "locked") await notify(env, chatId, (await uiLang(env)).rrBusy); return; }
    if (qb.startsWith("reset")) return questReset(env, chatId);
    return handleQuest(env, msg, chatId);
  }
  if (cmd === "/tts") return handleTts(env, msg, chatId);
  if (cmd === "/totp") return handleTotp(env, msg, chatId);
  if (cmd === "/remember") return handleRemember(env, msg, chatId);
  if (cmd === "/mems") return listMemories(env, chatId);
  if (cmd === "/forget") return delMemory(env, msg, chatId);
  if (cmd === "/cmems") return handleCmems(env, msg, chatId);
  if (cmd === "/reset") { await delCmd(env, chatId, msg.message_id); return handleReset(env, msg, chatId); }
  if (cmd === "/regenerate" || cmd === "/regen") { await delCmd(env, chatId, msg.message_id); return handleRegen(env, chatId, true); }
  if (cmd === "/continue" || cmd === "/cont") { await delCmd(env, chatId, msg.message_id); return handleContinue(env, chatId); }
  if (cmd === "/abort") { await delCmd(env, chatId, msg.message_id); return handleAbort(env, chatId); }
  if (cmd === "/rewind") { await delCmd(env, chatId, msg.message_id); return handleRewind(env, msg, chatId); }
  if (cmd === "/delete") { await delCmd(env, chatId, msg.message_id); return handleDelete(env, msg, chatId); }
  if (cmd === "/rpreset") { await delCmd(env, chatId, msg.message_id); return handleRpReset(env, msg, chatId); }
  if (cmd === "/rp") { await delCmd(env, chatId, msg.message_id); return handleRp(env, msg, chatId); }
  if (cmd === "/scene") { await delCmd(env, chatId, msg.message_id); return handleScene(env, msg, chatId); }
  if (cmd === "/char") return handleChar(env, msg, chatId);
  if (cmd === "/presets") return handlePresets(env, msg, chatId);
  if (cmd === "/rss") return handleRss(env, msg, chatId);
  if (cmd === "/vault") return handleVault(env, chatId);
  if (cmd === "/save") return vaultSave(env, msg, chatId, text.slice(cmd.length).trim());
  if (cmd === "/files") return handleFilesCmd(env, msg, chatId, text.slice(cmd.length).trim(), 0);
  if (cmd === "/find") return handleFilesCmd(env, msg, chatId, text.slice(cmd.length).trim(), 0);
  if (cmd === "/get") return vaultGet(env, msg, chatId, text.slice(cmd.length).trim());
  if (cmd === "/rm") return vaultRm(env, msg, chatId, text.slice(cmd.length).trim());
  if (cmd === "/game") return handleGame(env, msg, chatId);
  if (cmd === "/dive") return diveStart(env, chatId, 0);
  if (cmd === "/dl") { await delCmd(env, chatId, msg.message_id); return handleDl(env, msg, chatId); }
  if (cmd === "/song") { await delCmd(env, chatId, msg.message_id); return handleSong(env, msg, chatId); }
  if (cmd === "/spotify") { await delCmd(env, chatId, msg.message_id); return handleSpotify(env, msg, chatId); }
  if (cmd === "/yts") { await delCmd(env, chatId, msg.message_id); return handleYts(env, msg, chatId); }
  if (cmd === "/nh") { await delCmd(env, chatId, msg.message_id); return handleNh(env, msg, chatId); }
  if (cmd === "/nhs") return handleNhs(env, msg, chatId);
  if (cmd === "/sauce") { await delCmd(env, chatId, msg.message_id); return handleSauceCmd(env, msg, chatId); }
  if (cmd === "/host") { await delCmd(env, chatId, msg.message_id); return handleHostCmd(env, msg, chatId); }
  if (cmd === "/bet") return handleBet(env, msg, chatId);
  if (cmd === "/shield") return handleShield(env, msg, chatId);
  if (cmd === "/anime") return handleAnime(env, "anime", chatId, text.slice(cmd.length).trim());
  if (cmd === "/manga") return handleAnime(env, "manga", chatId, text.slice(cmd.length).trim());
  if (cmd === "/weather") return handleWx(env, msg, chatId, text.slice(cmd.length).trim());
  if (cmd === "/cuaca") return handleWx(env, msg, chatId, text.slice(cmd.length).trim()); // alias
  if (cmd === "/hn") return handleHn(env, chatId, text.slice(cmd.length).trim());
  if (cmd === "/np") return handleNp(env, chatId);
  if (cmd === "/focus") { await delCmd(env, chatId, msg.message_id); return handleFocus(env, msg, chatId); }
  if (cmd === "/sleep") { await delCmd(env, chatId, msg.message_id); return handleSleep(env, msg, chatId); }
  if (cmd === "/habit") { await delCmd(env, chatId, msg.message_id); return handleHabit(env, msg, chatId); }
  if (cmd === "/beli") { await delCmd(env, chatId, msg.message_id); return handleBeli(env, msg, chatId); }
  if (cmd === "/shop") return handleShop(env, chatId, 0);
  if (cmd === "/gacha") return handleGacha(env, chatId, 0);
  if (cmd === "/inv") return handleInv(env, chatId, 0);
  if (cmd === "/ach") return handleAch(env, chatId, 0);
  if (cmd === "/bm") { await delCmd(env, chatId, msg.message_id); return bmSave(env, msg, chatId, String(msg.text || "").replace(/^\/bm(@[A-Za-z0-9_]+)?/, "").trim()); }
  if (cmd === "/capsule") { await delCmd(env, chatId, msg.message_id); return handleCapsule(env, msg, chatId); }
  if (cmd === "/countdown") return handleCountdown(env, msg, chatId);
  if (cmd === "/ama") return handleAma(env, msg, chatId);
  if (cmd === "/alarm") return handleAlarm(env, msg, chatId);
  if (cmd === "/chain") return handleChain(env, msg, chatId);
  if (cmd === "/menu") return sendMenu(env, chatId);
  if (cmd === "/rl") { const rest = String(msg.text || "").slice(cmd.length).trim(); if (/^add\s+/i.test(rest)) return rlAdd(env, chatId, rest.replace(/^add\s+/i, "")); return rlView(env, chatId, 0); }
  if (cmd === "/read") return rlAdd(env, chatId, String(msg.text || "").slice(cmd.length).trim());
  if (cmd === "/otd") return otdView(env, chatId, 0);
  if (cmd === "/shorten") return shortAdd(env, chatId, String(msg.text || "").slice(cmd.length).trim());
  if (cmd === "/wrap") return wrapView(env, chatId, 0, String(msg.text || "").slice(cmd.length).trim());
  if (cmd === "/paste") return pasteAdd(env, chatId, String(msg.text || "").slice(cmd.length).trim());
  if (cmd === "/settings") { const v = await renderCfgView(env); return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  if (cmd === "/aistats") { const v = await renderAistatsHub(env); return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  if (cmd === "/me") return handleMe(env, msg, chatId);
  if (cmd === "/model") return handleModel(env, msg, chatId);
  if (cmd === "/len") return handleLen(env, msg, chatId);
  if (cmd === "/lang") return handleLang(env, msg, chatId);
  if (cmd === "/vibe") return handleVibe(env, msg, chatId);
  if (cmd === "/outfit") return handleOutfit(env, msg, chatId);
  if (cmd === "/plot") return handlePlot(env, msg, chatId);
  if (cmd === "/dice") return handleDice(env, msg, chatId);
  if (cmd === "/ooc") return handleOoc(env, msg, chatId);
  if (cmd === "/stats") { const v = await renderStatsView(env); return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  if (cmd === "/profile") { const v = await renderProfile(env); return tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  if (cmd === "/sys") return handleSys(env, chatId);
  if (cmd === "/debug") return handleDebug(env, msg, chatId);
  if (text) {
    fReact(env, chatId, msg.message_id, text).catch(() => {});
    const bare = text.trim();
    if (/^https?:\/\/\S+$/.test(bare) && dlPlatform(bare) && (await env.KV.get(AUTO_DL_KEY)) !== "off") { await delCmd(env, chatId, msg.message_id); return handleDl(env, msg, chatId); }
    // v2.71.0: link nhentai / cin.guru yang ditempel = permintaan /nh (pakai format default)
    const nhHit = nhLinkId(bare);
    if (nhHit) { await delCmd(env, chatId, msg.message_id); return nhRun(env, chatId, nhHit.id, nhHit.fmt); }
    return handleText(env, msg, chatId);
  }
}

async function handleCallback(env, cb) {
  const owner = await env.KV.get("owner_chat");
  if (!owner || String(cb.from.id) !== owner) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }
  await stampAlive(env);
  const chatId = cb.message && cb.message.chat && cb.message.chat.id;
  const mid = cb.message && cb.message.message_id;
  if (chatId && await focusIntercept(env, chatId, "", "", mid)) { await tg(env, "answerCallbackQuery", { callback_query_id: cb.id }); return; }
  const sep = (cb.data || "").indexOf(":");
  const act = sep < 0 ? cb.data : cb.data.slice(0, sep);
  const arg = sep < 0 ? "" : cb.data.slice(sep + 1);
  dbgLog(env, "cb", act);
  const L = await uiLang(env);
  const pop = t => tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: t });
  const edit = async view => { if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup }); };
  const navRow = (back, cbBack) => [{ text: back ? L.back : L.home, callback_data: cbBack || "menu" }, { text: L.home, callback_data: "menu" }];

  if (act === "rdel" && chatId) {
    const obj = await getJSON(env, "reminders", {});
    if (obj[arg] && !obj[arg].done) {
      obj[arg].done = true;
      await putJSON(env, "reminders", obj);
    }
    await pop(L.popRemDel(arg));
    await edit(renderReminders(obj, L));
  } else if (act === "quest" && chatId) {
    const p = await handleQuestCb(env, chatId, mid, arg);
    if (p) await pop(p);
  } else if (act === "sideq" && chatId) {
    const p = await handleSideqCb(env, chatId, mid, arg);
    if (p) await pop(p);
  } else if (act === "habit" && chatId) {
    const p = await handleHabitCb(env, chatId, mid, arg);
    if (p) await pop(p);
  } else if (act === "hp" && chatId) {
    const p = await handleHplanCb(env, chatId, mid, arg);
    if (p) await pop(p);
  } else if (act === "qreroll" && chatId) {
    const rs = await questReroll(env, chatId);
    await pop(rs === "ok" ? L.popRrOk : rs === "locked" ? L.popRrBusy : L.popRrLimit(REROLL_LIMIT));
    if (rs === "ok" && mid) await edit(await renderProfile(env));
  } else if (act === "qreset" && chatId) {
    const sub = arg || "ask:p";
    if (sub.startsWith("yes:")) {
      await pop(L.popQreset);
      await questReset(env, chatId);
      if (mid) await edit(sub.endsWith(":q") ? await questView(env) : await renderProfile(env));
    } else if (mid) {
      await pop("");
      await edit(sub.startsWith("no:")
        ? (sub.endsWith(":q") ? await questView(env) : await renderProfile(env))
        : qresetConfirmView(L, sub.endsWith(":q")));
    } else await pop("");
  } else if (act === "fdel" && chatId) {
    const id = parseInt(arg, 10);
    let feeds = await getJSON(env, "feeds", []);
    feeds = feeds.filter(f => f.id !== id);
    await putJSON(env, "feeds", feeds);
    await env.KV.delete("seen_" + id);
    await pop(L.popFeedDel(id));
    await edit(renderFeeds(feeds, L));
  } else if (act === "mdel" && chatId) {
    const id = parseInt(arg, 10);
    const list = await getJSON(env, MEM_KEY, []);
    const entry = list.find(x => x.id === id);
    if (!entry) { await pop(L.popMemDel(id)); await edit(renderMemories(list, L)); }
    else {
      await pop();
      await edit({ text: L.memDelAsk("#" + id + " — " + esc(entry.text)), markup: { inline_keyboard: [[{ text: L.presetDelYes, callback_data: "mdelok:" + id }, { text: L.rstNo, callback_data: "nav:mems" }], navRow(1, "nav:mems")] } });
    }
  } else if (act === "mdelok" && chatId) {
    const id = parseInt(arg, 10);
    let list = await getJSON(env, MEM_KEY, []);
    list = list.filter(x => x.id !== id);
    await putJSON(env, MEM_KEY, list);
    await pop(L.popMemDel(id));
    await edit(renderMemories(list, L));
  } else if (act === "cact" && chatId) {
    const id = parseInt(arg, 10);
    const card = (await getJSON(env, CHAR_KEY, [])).find(c => c.id === id);
    if (card) {
      await env.KV.put(CHAR_ACTIVE_KEY, String(id));
      await env.KV.delete(CHAT_HIST_KEY);
      await pop(L.popCact(card.name));
    } else {
      await pop(L.popCardGone);
    }
    if (mid) {
      const cards = await getJSON(env, CHAR_KEY, []);
      await edit(renderChars(cards, card ? id : 0, L));
    }
  } else if (act === "cdel" && chatId) {
    const id = parseInt(arg, 10);
    const cardC = (await getJSON(env, CHAR_KEY, [])).find(c => c.id === id);
    if (!cardC) { await pop(L.popCardGone); return; }
    await pop();
    await edit({ text: L.charDelAsk(esc(cardC.name)), markup: { inline_keyboard: [[{ text: L.presetDelYes, callback_data: "cdelok:" + id }, { text: L.rstNo, callback_data: "nav:char" }], navRow(1, "nav:char")] } });
  } else if (act === "cdelok" && chatId) {
    const id = parseInt(arg, 10);
    let cards = await getJSON(env, CHAR_KEY, []);
    cards = cards.filter(c => c.id !== id);
    await putJSON(env, CHAR_KEY, cards);
    await env.KV.delete(CMEM_PREFIX + id);
    await env.KV.delete(REL_PREFIX + id);
    await purgeKnobs(env, id);
    await env.KV.delete(HIST_SUM_KEY + "_" + id);
    await env.KV.delete(RP_SAVES_PREFIX + id);
    await env.KV.delete(RP_CKPT_PREFIX + id);
    await env.KV.delete(CHAPTERS_PREFIX + id);
    await env.KV.delete(AIST_FIRST_PREFIX + id); await env.KV.delete(AIST_MSG_PREFIX + id); await env.KV.delete(AIST_REC_PREFIX + id); await env.KV.delete(AIST_WRAP_PREFIX + id);
    const wasActive = parseInt((await env.KV.get(CHAR_ACTIVE_KEY)) || "0", 10) === id;
    if (wasActive) await env.KV.delete(CHAR_ACTIVE_KEY);
    const sc0 = await getScene(env);
    if (sc0 && (String(sc0.b) === String(id) || wasActive)) await env.KV.delete(SCENE_KEY);
    await pop(L.popCdel(id));
    if (mid) {
      const cards = await getJSON(env, CHAR_KEY, []);
      await edit(renderChars(cards, wasActive ? 0 : parseInt((await env.KV.get(CHAR_ACTIVE_KEY)) || "0", 10), L));
    }
  } else if (act === "coff" && chatId) {
    const cardO = await getActiveCard(env);
    await pop();
    await edit({ text: L.coffAsk(esc(cardO ? cardO.name : "char")), markup: { inline_keyboard: [[{ text: L.coffYes, callback_data: "coffok" }, { text: L.rstNo, callback_data: "nav:char" }], navRow(1, "nav:char")] } });
  } else if (act === "coffok" && chatId) {
    await env.KV.delete(CHAR_ACTIVE_KEY);
    await env.KV.delete(CHAT_HIST_KEY);
    await env.KV.delete(SCENE_KEY);
    await pop(L.popCoff);
    if (mid) {
      const cards = await getJSON(env, CHAR_KEY, []);
      await edit(renderChars(cards, 0, L));
    }
  } else if (act === "chain" && chatId) {
    if (arg === "start" || arg === "quit" || arg === "quit2" || arg === "view") await pop("");
    const p = arg === "start" ? await chainStartCb(env, chatId, mid, L) : arg === "quit" ? await chainQuitCb(env, chatId, mid, L) : arg === "quit2" ? await chainQuit2Cb(env, chatId, mid, L) : arg === "view" ? await chainViewCb(env, chatId, mid, L) : "";
    if (p) await pop(p);
  } else if (act === "rpsave" && chatId) {
    const card = await getActiveCard(env);
    if (!card) { await pop(L.rpNoChar); return; }
    const name = "save-" + new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16).replace("T", " ");
    const r = await rpSaveSlot(env, card, name);
    await pop(L.rpSaved(r.name) + (r.evicted ? " " + L.rpSaveFull : ""));
    if (mid) await edit(await renderRpSavesView(env));
  } else if (act === "rploadask" && chatId) {
    const card = await getActiveCard(env);
    const isAuto = arg.startsWith("auto:");
    let slots = [];
    if (card) {
      if (isAuto) { const j = await getJSON(env, RP_CKPT_PREFIX + card.id, null); slots = (j && j.slots) || []; }
      else slots = await getJSON(env, RP_SAVES_PREFIX + card.id, []);
    }
    const s = slots[isAuto ? parseInt(arg.slice(5), 10) : parseInt(arg, 10)];
    if (!s) { await pop(L.rpSlotGone); return; }
    await pop("");
    if (mid) await edit({ text: L.rpLoadAsk(esc(s.name)), markup: { inline_keyboard: [[{ text: L.bSvYes, callback_data: "rploadok:" + (isAuto ? "auto:" : "") + s.ts }, { text: L.rstNo, callback_data: "nav:rpsaves" }]] } });
  } else if (act === "rploadok" && chatId) {
    const card = await getActiveCard(env);
    if (!card) { await pop(L.rpNoChar); return; }
    const isAuto = arg.startsWith("auto:");
    const s = await rpRestoreSlot(env, card, Number(isAuto ? arg.slice(5) : arg), isAuto);
    await pop(s ? L.popRpLoad(s.name) : L.rpSlotGone);
    if (mid) await edit(await renderRpSavesView(env));
  } else if (act === "rpdel" && chatId) {
    const card = await getActiveCard(env);
    if (!card) { await pop(L.rpNoChar); return; }
    const gone = await rpDelSlot(env, card, parseInt(arg, 10));
    await pop(gone ? L.rpDelDone(gone) : L.rpSlotGone);
    if (mid) await edit(await renderRpSavesView(env));
  } else if (act === "nav" && chatId) {
    let view;
    if (arg === "char") view = renderChars(await getJSON(env, CHAR_KEY, []), parseInt((await env.KV.get(CHAR_ACTIVE_KEY)) || "0", 10), L);
    else if (arg === "rem") view = renderReminders(await getJSON(env, "reminders", {}), L);
    else if (arg === "rss") view = renderFeeds(await getJSON(env, "feeds", []), L);
    else if (arg === "mems") view = renderMemories(await getJSON(env, MEM_KEY, []), L);
    else if (arg === "presets") view = renderPresets(await getJSON(env, PRESET_KEY, []), L);
    else if (arg === "cmems") {
      const c = await getActiveCard(env);
      view = c ? renderCharMems(c, await getJSON(env, CMEM_PREFIX + c.id, []), L) : { text: L.noActiveChar, markup: { inline_keyboard: navRow(1, "nav:char") } };
    }
    else if (arg === "stats") view = await renderStatsView(env);
    else if (arg === "usage") view = await renderUsageView(env);
    else if (arg === "aistats") view = await renderAistatsHub(env);
    else if (arg === "profile") view = await renderProfile(env);
    else if (arg === "quest") view = await questView(env);
    else if (arg === "me") view = await renderMeView(env);
    else if (arg === "otp") view = await renderOtpView(env);
    else if (arg === "uilang") view = await renderUiLangView(env);
    else if (arg === "j") view = { text: L.jMsg, markup: { inline_keyboard: [[{ text: L.bDig, callback_data: "dig" }], [{ text: L.home, callback_data: "menu" }]] } };
    else if (arg === "cfg") view = await renderCfgView(env);
    else if (arg === "nhset") view = await renderNhSetHub(env);
    else if (arg === "nhdef") view = await renderNhDefView(env);
    else if (arg === "nhprov") view = await renderNhProvView(env);
    else if (arg === "nhpdf") view = await renderNhPdfqView(env);
    else if (arg === "nhstats") view = await renderNhStatsView(env);
    else if (arg === "dbg") view = await renderDebugView(env);
    else if (arg === "divecfg") view = await renderDiveCfg(env);
    else if (arg === "vault") view = await renderVault(env, L);
    else if (arg === "model") view = await renderModelView(env);
    else if (arg === "len") view = await renderLenView(env);
    else if (arg === "vibe") view = await renderVibeView(env);
    else if (arg === "rp") view = await renderRpMenu(env);
    else if (arg === "plot") view = await renderPlotView(env);
    else if (arg === "outfit") view = await renderOutfitView(env);
    else if (arg === "rpsaves") view = await renderRpSavesView(env);
    else if (arg === "cgal") view = await renderGallery(env, L);
    else if (arg === "lang") view = await renderLangView(env);
    else view = await renderMenu(env);
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    await edit(view);
  } else if (act === "ttsg" && chatId) {
    const cur = (await env.KV.get(TTS_KEY)) === "on";
    await env.KV.put(TTS_KEY, cur ? "off" : "on");
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: cur ? L.ttsOffPop : L.ttsOnPop });
    await edit(await renderCfgView(env));
  } else if (act === "autodlg" && chatId) {
    const cur = (await env.KV.get(AUTO_DL_KEY)) !== "off";
    await env.KV.put(AUTO_DL_KEY, cur ? "off" : "on");
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: cur ? L.popAutoOff : L.popAutoOn });
    await edit(await renderCfgView(env));
  } else if (act === "nhdef" && chatId) {
    // v2.71.0: format default /nh (album|zip|pdf|scroll) — dipakai /nh tanpa format + link auto-detect
    const k = ["album", "zip", "pdf", "scroll"].includes(arg) ? arg : "album";
    await env.KV.put(NH_DEF_KEY, k);
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: L.nhDefPop(L.nhDefLbl(k)) });
    await edit(await renderNhDefView(env));
  } else if (act === "nhprov" && chatId) {
    // v2.72.0: provider upload builder (auto|x0at|kappa) — dikirim ke GHA di payload dispatch
    const k = ["auto", "x0at", "kappa"].includes(arg) ? arg : "auto";
    await env.KV.put(NH_HOST_KEY, k);
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: L.nhProvPop(L.nhProvLbl(k)) });
    await edit(await renderNhProvView(env));
  } else if (act === "nhpdfq" && chatId) {
    // v2.73.0: preset kualitas PDF (normal|small) — ikut payload dispatch
    const k = ["normal", "small"].includes(arg) ? arg : "normal";
    await env.KV.put(NH_PDFQ_KEY, k);
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: L.nhPdfPop(L.nhPdfLbl(k)) });
    await edit(await renderNhPdfqView(env));
  } else if (act === "dvset" && chatId) {
    const lbl = { chill: L.cfgDiveChill, normal: L.cfgDiveNormal, deep: L.cfgDiveDeep }[arg] || L.cfgDiveAskLbl;
    if (arg === "ask") await env.KV.delete(DIVE_DEF_KEY);
    else await env.KV.put(DIVE_DEF_KEY, arg);
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: arg === "ask" ? L.cfgDiveAskPop : L.cfgDivePop(lbl) });
    await edit(await renderDiveCfg(env));
  } else if (act === "dlpick" && chatId) {
    await handleDlPick(env, cb.id, chatId, mid, arg);
  } else if (act === "ytpick" && chatId) {
    await handleYtsPick(env, cb.id, chatId, mid, arg);
  } else if (act === "ytb" && chatId) {
    // v2.76.0: 720p / MP3 build button from the YouTube menu
    await handleYtBuild(env, cb.id, chatId, mid, arg);
  } else if (act === "nhsave" && chatId) {
    await handleNhSave(env, cb.id, chatId, arg);
  } else if (act === "nhop" && chatId) {
    await handleNhop(env, cb.id, chatId, arg);
  } else if (act === "nhnz" && chatId) {
    // v2.73.0: tombol "Bikin ZIP" (album & /nhs) — cache dulu, baru dispatch builder
    await handleNhNzip(env, cb.id, chatId, arg);
  } else if (act === "nh" && chatId) {
    // R-48: satu hasil search dipilih → jalur build biasa (id + format default)
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "\u{1F4E6}" });
    await nhRun(env, chatId, arg, "", "");
  } else if (act === "hostp" && chatId) {
    await handleHostCb(env, cb.id, chatId, mid, arg);
  } else if (act === "hostcancel" && chatId) {
    await handleHostCancel(env, cb.id, chatId, mid, arg);
  } else if (act === "dlsav" && chatId) {
    const r = await vaultArchiveDl(env, arg);
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: r.ok ? L.savOk : r.noVault ? L.savNoVault : r.full ? L.vaultFull(FILE_MAX) : r.dup ? L.savDup : L.savLate });
  } else if (act === "trefresh" && chatId) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    await edit(await renderTotp(env));
  } else if (act === "otpmask" && chatId) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    const isShow = (await env.KV.get("otp_mask")) === "off";
    await env.KV.put("otp_mask", isShow ? "on" : "off");
    await edit(await renderOtpView(env));
  } else if (act === "sys" && chatId) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    await handleSys(env, chatId, mid);
  } else if (act === "dbg" && chatId) {
    if (arg === "on") { await setDebug(env, true); dbgLog(env, "dbg", "on"); await pop(L.dbgOnPop); }
    else if (arg === "off") { await setDebug(env, false); await pop(L.dbgOffPop); }
    else if (arg === "stream") { armStream(env); dbgLog(env, "dbg", "stream"); await pop(L.dbgStreamPop); }
    else if (arg === "log" || /^log:\d+$/.test(arg)) { const nl = arg.split(":")[1] || "3"; await pop(""); await edit(await renderLogView(env, nl)); return; }
    else { await pop(L.dbgCleared); clearDbgRing(); }
    await edit(await renderDebugView(env));
  } else if (act === "mmodels" && chatId) {
    await pop(L.popSearching);
    const list = await listBridgeModels(env);
    let view;
    if (!list || !list.length) view = { text: L.mmFail, markup: { inline_keyboard: [navRow(true, "nav:model")] } };
    else {
      const cur = (await aiConf(env)).model;
      view = { text: L.mmTitle, markup: { inline_keyboard: list.slice(0, 12).map(m => [{ text: (m.id === cur ? "\u2705 " : "") + String(m.name || m.id).slice(0, 28), callback_data: "mpick:" + m.id }]).concat([navRow(true, "nav:model")]) } };
    }
    await edit(view);
  } else if (act === "mpick" && chatId) {
    const picked = arg;
    const cf = await aiConf(env);
    await putJSON(env, AI_CFG_KEY, { base: cf.base, key: cf.key, model: picked, label: cf.label || cf.base, ts: Date.now() });
    await pop(L.popPicked(picked));
    await edit({ text: L.pickedMsg(picked), markup: { inline_keyboard: [navRow(true, "nav:model")] } });
  } else if (act === "mreset" && chatId) {
    await env.KV.delete(AI_CFG_KEY);
    await pop(L.popReset);
    await edit(await renderModelView(env));
  } else if (act === "mcustom" && chatId) {
    await putJSON(env, WIZ_KEY, { step: "url", ts: Math.floor(Date.now() / 1000) });
    await pop(L.popWizStart);
    await edit({ text: L.wizAskUrl, markup: { inline_keyboard: [navRow(true, "nav:model")] } });
  } else if (act === "len" && chatId) {
    const v = arg;
    if (LEN_HINT[v]) await env.KV.put(LEN_KEY, v);
    await pop(L.popLen(v));
    await edit(await renderLenView(env));
  } else if (act === "lang" && chatId) {
    const v = arg === "id" ? "Indonesian" : "English";
    await env.KV.put(LANG_KEY, v);
    await pop(L.popLang(v));
    await edit(await renderLangView(env));
  } else if (act === "langc" && chatId) {
    await pop();
    await edit({ text: L.langcMsg, markup: { inline_keyboard: [navRow(true, "nav:lang")] } });
  } else if (act === "vibe" && chatId) {
    const card = await getActiveCard(env);
    if (card && VIBE_PRESETS.includes(arg)) { await setVibe(env, card, arg); await pop(L.popVibe(arg)); }
    else if (card && arg === "none") { await clearKnobField(env, card.id, "vibe"); await pop(L.vibeNone); }
    else await pop();
    await edit(await renderVibeView(env));
  } else if (act === "vibec" && chatId) {
    await pop();
    await edit({ text: L.vibeCustomHow, markup: { inline_keyboard: [navRow(true, "nav:vibe")] } });
  } else if (act === "outfitdel" && chatId) {
    const card = await getActiveCard(env);
    if (card) { await clearKnobField(env, card.id, "outfit"); await pop(L.outfitNone); }
    else await pop();
    if (mid) { const v = await renderOutfitView(env); await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  } else if (act === "plotdel" && chatId) {
    await env.KV.delete(PLOT_DIR_KEY);
    await pop(L.plotNone);
    if (mid) { const v = await renderPlotView(env); await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup }); }
  } else if (act === "oocoff" && chatId) {
    await env.KV.delete(OOC_KEY);
    await pop(L.popOocOff);
    if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.oocOff, parse_mode: "HTML", reply_markup: { inline_keyboard: [] } });
  } else if (act === "oocswitch" && chatId) {
    const was = (await env.KV.get(OOC_KEY)) === "on";
    if (was) await env.KV.delete(OOC_KEY); else await env.KV.put(OOC_KEY, "on");
    await pop(was ? L.popOocOff : L.popOocOn);
    await edit(await renderRpMenu(env));
  } else if (act === "uilang" && chatId) {
    const en = arg === "en";
    await env.KV.put(UI_LANG_KEY, en ? "en" : "id");
    await pop((en ? UI.en : UI.id).uiTitle + (en ? "English" : "Indonesia"));
    await edit(await renderUiLangView(env));
  } else if (act === "help" && chatId) {
    await pop();
    await edit(renderHelpCat(L, parseInt(arg, 10)));
  } else if (act === "helpback" && chatId) {
    await pop();
    await edit(renderHelpMenu(L));
  } else if (act === "helpfull" && chatId) {
    await pop();
    for (const p of helpParts(L)) await reply(env, chatId, p);
  } else if (act === "aist" && chatId) {
    const cards = await getJSON(env, CHAR_KEY, []);
    const c = cards.find(x => String(x.id) === String(arg));
    if (c) await edit(await renderAistatDetail(env, c));
    else await pop(L.charNF("#" + String(arg).slice(0, 6)));
  } else if (act === "aistb" && chatId) {
    await pop();
    await edit(await renderAistatsHub(env));
  } else if (act === "aistw" && chatId) {
    const cards = await getJSON(env, CHAR_KEY, []);
    const c = cards.find(x => String(x.id) === String(arg));
    if (c) await aistWrapped(env, chatId, c, mid);
  } else if (act === "cgal" && chatId) {
    await sendCardArt(env, chatId, arg, L, pop);
  } else if (act === "pq" && chatId) {
    await pop();
    await photoqView(env, chatId, mid);
  } else if (act === "askstart" && chatId) {
    await askSet(env, "rp", arg);
    await pop();
    await edit({ text: L.askHow, markup: { inline_keyboard: [[{ text: L.askCancel, callback_data: "askcancel" }], navRow(true, "nav:rp")] } });
  } else if (act === "askcancel" && chatId) {
    await askClear(env);
    await pop(L.askCancelMsg);
    await edit({ text: L.askGone, markup: { inline_keyboard: [navRow(true, "nav:rp")] } });
  } else if (act === "ob" && chatId) {
    const [obStep, obV] = arg.split(":");
    if (obStep === "lang") {
      await env.KV.put(UI_LANG_KEY, obV === "en" ? "en" : "id");
      const L2 = obV === "en" ? UI.en : UI.id;
      await pop();
      await edit({ text: L2.obCardAsk, markup: { inline_keyboard: [[{ text: L2.cimpBtn, callback_data: "cimp" }], [{ text: L2.bSkip, callback_data: "ob:skip" }]] } });
    } else if (obStep === "skip") {
      await pop();
      await edit({ text: L.obTour, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } });
    } else await pop();
  } else if (act === "meoff" && chatId) {
    const pme = await getJSON(env, PERSONA_KEY, null);
    if (!pme) { await pop(L.popMeOff); return; }
    await pop();
    await edit({ text: L.meOffAsk(esc(pme.name)), markup: { inline_keyboard: [[{ text: L.presetDelYes, callback_data: "meoffok" }, { text: L.rstNo, callback_data: "nav:me" }], navRow(1, "nav:me")] } });
  } else if (act === "meoffok" && chatId) {
    await env.KV.delete(PERSONA_KEY);
    await pop(L.popMeOff);
    await edit(await renderMeView(env));
  } else if (act === "wpick" && chatId) {
    const wiz = await getJSON(env, WIZ_KEY, null);
    const wi = parseInt(arg, 10);
    if (wiz && wiz.step === "model" && Array.isArray(wiz.models) && wiz.models[wi]) {
      wiz.model = String(wiz.models[wi]); wiz.step = "key"; wiz.ts = Math.floor(Date.now() / 1000);
      await putJSON(env, WIZ_KEY, wiz);
      await pop(L.popWizPicked(wiz.model));
      await edit({ text: L.wizAskKey(wiz.model), markup: { inline_keyboard: [] } });
    } else await pop();
  } else if (act === "wskip" && chatId) {
    await pop();
    await edit({ text: L.wizManualSkip, markup: { inline_keyboard: [] } });
  } else if (act === "ptgl" && chatId) {
    const id = parseInt(arg, 10);
    const list = await getJSON(env, PRESET_KEY, []);
    const p = list.find(x => x.id === id);
    if (p) {
      p.enabled = !p.enabled;
      await putJSON(env, PRESET_KEY, list);
      await pop(L.popPtgl(p.enabled, p.name));
    } else await pop(L.popPresetGone);
    if (mid) await edit(renderPresets(list, L));
  } else if (act === "pdel" && chatId) {
    const id = parseInt(arg, 10);
    const p = (await getJSON(env, PRESET_KEY, [])).find(x => x.id === id);
    if (!p) { await pop(L.popPresetGone); return; }
    await pop();
    await edit({ text: L.presetDelAsk(p.name), markup: { inline_keyboard: [[{ text: L.presetDelYes, callback_data: "pdelok:" + id }, { text: L.rstNo, callback_data: "nav:presets" }], [{ text: L.back, callback_data: "nav:presets" }, { text: L.home, callback_data: "menu" }]] } });
  } else if (act === "pdelok" && chatId) {
    const id = parseInt(arg, 10);
    let list = await getJSON(env, PRESET_KEY, []);
    list = list.filter(x => x.id !== id);
    await putJSON(env, PRESET_KEY, list);
    await pop(L.popPdel(id));
    if (mid) await edit(renderPresets(list, L));
  } else if (act === "pimp" && chatId) {
    await putJSON(env, PRESET_IMPORT_KEY, { ts: Date.now(), mid: mid || 0, chat: chatId });
    await pop(L.popPimp);
    await edit({ text: L.pimpMsg, markup: { inline_keyboard: [[{ text: L.back, callback_data: "nav:presets" }, { text: L.home, callback_data: "menu" }]] } });
  } else if (act === "cimp" && chatId) {
    await env.KV.put(CHAR_IMPORT_KEY, String(Date.now()));
    await pop(L.popCimp);
    await edit({ text: L.charImportAsk, markup: { inline_keyboard: [navRow(1, "nav:char")] } });
  } else if (act === "menu" && chatId) {
    await pop();
    await edit(await renderMenu(env));
  } else if (act === "dig" && chatId) {
    await pop(L.popDig);
    await sendDigest(env, chatId, false);
  } else if (act === "rst" && chatId) {
    await pop();
    await edit({ text: L.rstAsk, markup: { inline_keyboard: [[{ text: L.rstYes, callback_data: "rstok" }, { text: L.rstNo, callback_data: "menu" }]] } });
  } else if (act === "cmdel" && chatId) {
    const card = await getActiveCard(env);
    const id = parseInt(arg, 10);
    if (card) {
      const entry = (await getJSON(env, CMEM_PREFIX + card.id, [])).find(x => x.id === id);
      if (!entry) { await pop(L.popCmemDel(id)); if (mid) await edit(renderCharMems(card, await getJSON(env, CMEM_PREFIX + card.id, []), L)); }
      else {
        await pop();
        await edit({ text: L.cmemDelAsk("#" + id + " — " + esc(entry.text)), markup: { inline_keyboard: [[{ text: L.presetDelYes, callback_data: "cmdelok:" + id }, { text: L.rstNo, callback_data: "nav:cmems" }], navRow(1, "nav:cmems")] } });
      }
    } else {
      await pop(L.popCharGone);
      if (mid) await edit({ text: L.noActiveChar, markup: { inline_keyboard: navRow(1, "nav:char") } });
    }
  } else if (act === "cmdelok" && chatId) {
    const card = await getActiveCard(env);
    const id = parseInt(arg, 10);
    if (card) {
      const key = CMEM_PREFIX + card.id;
      let list = await getJSON(env, key, []);
      const before = list.length;
      list = list.filter(x => x.id !== id);
      if (list.length !== before) await putJSON(env, key, list);
      await pop(L.popCmemDel(id));
    } else {
      await pop(L.popCharGone);
    }
    if (mid) {
      const c = await getActiveCard(env);
      await edit(c ? renderCharMems(c, await getJSON(env, CMEM_PREFIX + c.id, []), L) : { text: L.noActiveChar, markup: { inline_keyboard: navRow(1, "nav:char") } });
    }
  } else if (act === "rsc" && chatId) {
    const card = await getActiveCard(env);
    if (card && String(card.id) === arg) {
      const list = await getJSON(env, CMEM_PREFIX + card.id, []);
      await env.KV.delete(CMEM_PREFIX + card.id);
      await env.KV.delete(CHAT_HIST_KEY);
      await env.KV.delete(HIST_SUM_KEY + "_" + card.id);
      await clearKnobField(env, card.id, "outfit");
      await env.KV.delete(SCENE_KEY);
      if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.rscDone(esc(card.name), list.length), parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } });
    } else {
      await pop(L.popCharDiff);
      if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.charDiffMsg, parse_mode: "HTML", reply_markup: { inline_keyboard: [] } });
    }
  } else if (act === "rstcx" && chatId) {
    await pop(L.popCancelled);
    if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: L.cancelledMsg, parse_mode: "HTML", reply_markup: { inline_keyboard: [] } });
  } else if (act === "rstok" && chatId) {
    const hist = await getJSON(env, CHAT_HIST_KEY, null);
    const n = Array.isArray(hist) ? hist.length : 0;
    await env.KV.delete(CHAT_HIST_KEY);
    await env.KV.delete(await histKeyOf(env));
    const cardR = await getActiveCard(env);
    if (cardR) await clearKnobField(env, cardR.id, "outfit");
    if (cardR) await resetCharData(env, cardR);
    await env.KV.delete(OOC_KEY);
    await pop(L.popRstOk);
    await edit({ text: L.rstDone(n), markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } });
  } else if (act === "rsn" && chatId) {
    const cardN = (await getJSON(env, CHAR_KEY, [])).find(c => String(c.id) === arg) || null;
    if (cardN) {
      await resetCharData(env, cardN);
      if (String(parseInt((await env.KV.get(CHAR_ACTIVE_KEY)) || "0", 10)) === String(cardN.id)) { await env.KV.delete(CHAT_HIST_KEY); await env.KV.delete(OOC_KEY); }
      await edit({ text: L.resetNumDone(esc(cardN.name || "#" + cardN.id)), markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } });
    } else {
      await pop(L.popCharGone);
      await edit({ text: L.resetNumNF, markup: { inline_keyboard: [] } });
    }
  } else if (act === "regen" && chatId) {
    if (arg === "yes") {
      await pop(L.popRegenGo);
      if (mid) await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid });
      await handleRegen(env, chatId, true);
    } else {
      await pop();
      if (mid) await tg(env, "deleteMessage", { chat_id: chatId, message_id: mid });
    }
  } else if (act === "cont" && chatId) {
    await pop(L.popContGo);
    await handleContinue(env, chatId);
  } else if (act === "vbind" && chatId) {
    await putJSON(env, VAULT_BIND_KEY, { ts: Math.floor(Date.now() / 1000) });
    await pop();
    await edit({ text: L.vaultBindHow, markup: { inline_keyboard: [[{ text: L.rstNo, callback_data: "nav:vault" }]] } });
  } else if (act === "vbackup" && chatId) {
    await pop(L.popDig);
    const okB = await vaultBackup(env, chatId, false);
    if (okB) await edit(await renderVault(env, L));
  } else if (act === "vrestore" && chatId) {
    const snaps = await getJSON(env, VAULT_SNAPS_KEY, []);
    await pop();
    if (!snaps.length) await edit({ text: L.vaultNoSnaps, markup: { inline_keyboard: [navRow(true, "nav:vault")] } });
    else await edit({ text: L.vaultSnapList, markup: { inline_keyboard: snaps.map(s => [{ text: "\u{1F5D3} " + fmtWIB(Math.floor(s.ts / 1000), L) + (s.auto ? " (auto)" : ""), callback_data: "snap:" + s.ts }]).concat([navRow(true, "nav:vault")]) } });
  } else if (act === "snap" && chatId) {
    const s = (await getJSON(env, VAULT_SNAPS_KEY, [])).find(x => x.ts === Number(arg));
    if (!s) { await pop(L.popSnapGone); return; }
    await pop();
    await edit({ text: L.vaultRestoreAsk(fmtWIB(Math.floor(s.ts / 1000), L)), markup: { inline_keyboard: [[{ text: L.snapGo, callback_data: "snapdo:" + s.ts }, { text: L.rstNo, callback_data: "vrestore" }], navRow(true, "nav:vault")] } });
  } else if (act === "snapdo" && chatId) {
    await pop(L.popDig);
    const res = await vaultRestore(env, chatId, Number(arg));
    await edit({ text: res, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } });
  } else if (act === "vauto" && chatId) {
    const cfg = await getJSON(env, VAULT_CFG_KEY, { auto: true });
    cfg.auto = cfg.auto === false;
    await putJSON(env, VAULT_CFG_KEY, cfg);
    await pop(L.vAutoPop(cfg.auto));
    await edit(await renderVault(env, L));
  } else if (act === "vunbind" && chatId) {
    const v = await getJSON(env, VAULT_CHAT_KEY, null);
    if (!v) { await pop(L.popVaultNoBind); return; }
    await pop();
    await edit({ text: L.vaultUnbindAsk(v.title), markup: { inline_keyboard: [[{ text: L.vaultUnbindBtn2, callback_data: "vunbindok" }, { text: L.rstNo, callback_data: "nav:vault" }], navRow(true, "nav:vault")] } });
  } else if (act === "vunbindok" && chatId) {
    await env.KV.delete(VAULT_CHAT_KEY);
    await env.KV.delete(VAULT_SNAPS_KEY);
    await env.KV.delete(VAULT_BIND_KEY);
    await env.KV.delete(VAULT_REN_KEY);
    await pop(L.popVaultUnbound);
    await edit(await renderVault(env, L));
  } else if (act === "fget" && chatId) {
    const f = (await getJSON(env, FILE_INDEX_KEY, [])).find(x => x.id === parseInt(arg, 10));
    if (!f) { await pop(L.fileGone); return; }
    await pop(L.popFileSent);
    await vaultSend(env, chatId, f);
  } else if (act === "fdelf" && chatId) {
    const f = (await getJSON(env, FILE_INDEX_KEY, [])).find(x => x.id === parseInt(arg, 10));
    if (!f) { await pop(L.fileGone); return; }
    await pop();
    await edit({ text: L.fileDelAsk(f.name), markup: { inline_keyboard: [[{ text: L.fileDelYes, callback_data: "fdelok:" + f.id }, { text: L.rstNo, callback_data: "files:0" }], navRow(true, "files:0")] } });
  } else if (act === "fdelok" && chatId) {
    const id = parseInt(arg, 10);
    const list = (await getJSON(env, FILE_INDEX_KEY, [])).filter(x => x.id !== id);
    await putJSON(env, FILE_INDEX_KEY, list);
    await pop(L.popFileDel(id));
    if (mid) await edit(renderFiles(list, L, 0));
  } else if (act === "fren" && chatId) {
    const f = (await getJSON(env, FILE_INDEX_KEY, [])).find(x => x.id === parseInt(arg, 10));
    if (!f) { await pop(L.fileGone); return; }
    await putJSON(env, VAULT_REN_KEY, { id: f.id, ts: Date.now() });
    await pop();
    await edit({ text: L.renAsk(f.name), markup: { inline_keyboard: [[{ text: L.rstNo, callback_data: "files:0" }]] } });
  } else if (act === "vdel" && chatId) {
    await putJSON(env, VAULT_OP_KEY, { op: "del", mid: mid, ts: Date.now() });
    await pop();
    await edit({ text: L.vdelAsk, markup: { inline_keyboard: [[{ text: L.rstNo, callback_data: "files:0" }]] } });
  } else if (act === "vren2" && chatId) {
    await putJSON(env, VAULT_OP_KEY, { op: "ren", mid: mid, ts: Date.now() });
    await pop();
    await edit({ text: L.vrenAsk, markup: { inline_keyboard: [[{ text: L.rstNo, callback_data: "files:0" }]] } });
  } else if (act === "files" && chatId) {
    await pop();
    await edit(renderFiles(await getJSON(env, FILE_INDEX_KEY, []), L, parseInt(arg, 10) || 0));
  } else if (act === "ec" && chatId) {
    await pop();
    if (arg === "hub") return handleHub(env, chatId, mid);
    if (arg === "shop") return handleShop(env, chatId, mid);
    if (arg === "inv") return handleInv(env, chatId, mid);
    if (arg === "gacha") return handleGacha(env, chatId, mid);
    if (arg === "chm") return handleCharms(env, chatId, mid);
    if (arg === "ach") return handleAch(env, chatId, mid);
    if (arg.startsWith("buy:")) return shopBuy(env, chatId, mid, arg.slice(4));
    if (arg.startsWith("use:")) return invUse(env, chatId, mid, arg.slice(4));
    if (arg.startsWith("cheq:")) return charmEq(env, chatId, mid, arg.slice(5));
    if (arg === "pull") return gachaPull(env, chatId, mid, 1);
    if (arg === "pull5") return gachaPull(env, chatId, mid, 5);
    return handleShop(env, chatId, mid);
  } else if (act === "rl" && chatId) {
    await pop();
    if (arg === "add") return reply(env, chatId, L.rlUsage);
    if (arg.startsWith("t:")) return rlToggle(env, chatId, mid, arg.slice(2));
    if (arg.startsWith("d:")) return rlDel(env, chatId, mid, arg.slice(2));
    return rlView(env, chatId, mid);
  } else if (act === "g" && chatId) {
    await pop();
    if (arg === "word") return gameWordStart(env, chatId, mid);
    if (arg === "stop") return gameStop(env, chatId, mid);
    if (arg === "quiz") return gameQuizStart(env, chatId, mid);
    if (arg === "pvp") return pvpStart(env, chatId, mid);
    if (arg === "pvpstop") return pvpStop(env, chatId, mid);
    if (arg === "lyric") return gameLyricStart(env, chatId, mid);
    if (arg.startsWith("la:")) return gameLyricPick(env, chatId, mid, parseInt(arg.slice(3), 10) || 0);
    if (arg === "song") return gameSongStart(env, chatId, mid);
    if (arg.startsWith("sg:")) return gameSongPick(env, chatId, mid, parseInt(arg.slice(3), 10) || 0);
    if (arg === "sfan") return gameFanMenu(env, chatId, mid);
    if (arg.startsWith("sfa:")) { const n = parseInt(arg.slice(4), 10); return gameFanStart(env, chatId, mid, isNaN(n) ? -1 : n); }
    if (arg === "sfap") return gameFanMenu(env, chatId, mid, 1);
    if (arg === "sfask") return gameFanAskOpen(env, chatId, mid);
    if (arg === "sfax") { const a = await askGet(env); await askClear(env); return gameFanStart(env, chatId, mid, -1, a && a.k === "sfax" ? a.d : null); }
    if (arg === "sfcx") return gameFanAskCancel(env, chatId, mid);
    if (arg === "back") { await gameLeave(env, chatId); return gameMenu(env, chatId, mid); }
    if (arg === "home") { await gameLeave(env, chatId); return edit(await renderMenu(env)); }
    if (arg.startsWith("fg:")) return gameFanPick(env, chatId, mid, parseInt(arg.slice(3), 10) || 0);
    if (arg.startsWith("qa:")) return gameQuizPick(env, chatId, mid, parseInt(arg.slice(3), 10) || 0);
    if (arg === "dive") return diveStart(env, chatId, mid);
    if (arg === "diveskip") return diveSkip(env, chatId, mid);
    if (arg === "divestop") return diveStop(env, chatId, mid);
    if (arg === "diveprac") return divePrac(env, chatId, mid);
    if (arg.startsWith("divemode:")) return diveModePick(env, chatId, mid, arg.slice(9));
    return gameMenu(env, chatId, mid);
  } else {
    await pop();
  }
}

async function handleText(env, msg, chatId) {
  const text = (msg.text || "").trim();
  if (!text) return;

  const wiz = await getJSON(env, WIZ_KEY, null);
  if (wiz && wiz.step && Math.floor(Date.now() / 1000) - (wiz.ts || 0) < 600) {
    if (!text.startsWith("/")) return handleWizard(env, wiz, msg, text, chatId);
    if (text.toLowerCase().startsWith("/cancel")) {
      await env.KV.delete(WIZ_KEY);
      return reply(env, chatId, (await uiLang(env)).wizCancel);
    }
  } else if (wiz) await env.KV.delete(WIZ_KEY);

  const Lv = await uiLang(env);
  const vb = await getJSON(env, VAULT_BIND_KEY, null);
  if (vb && Math.floor(Date.now() / 1000) - (vb.ts || 0) < 600) {
    if (text.toLowerCase().startsWith("/cancel")) { await env.KV.delete(VAULT_BIND_KEY); return notify(env, chatId, Lv.bindCancel); }
    if (msg.forward_from_chat && msg.forward_from_chat.type === "channel") { await env.KV.delete(VAULT_BIND_KEY); return vaultDoBind(env, msg.forward_from_chat, chatId); }
    return reply(env, chatId, Lv.vaultNotFwd);
  } else if (vb) await env.KV.delete(VAULT_BIND_KEY);
  const vr = await getJSON(env, VAULT_REN_KEY, null);
  if (vr && Date.now() - (vr.ts || 0) < 600000) {
    if (text.toLowerCase().startsWith("/cancel")) { await env.KV.delete(VAULT_REN_KEY); return notify(env, chatId, Lv.renCancel); }
    if (!text.startsWith("/")) { await env.KV.delete(VAULT_REN_KEY); return vaultDoRename(env, vr.id, text, chatId); }
  } else if (vr) await env.KV.delete(VAULT_REN_KEY);
  const vop = await getJSON(env, VAULT_OP_KEY, null);
  if (vop && vop.mid && Date.now() - (vop.ts || 0) < 600000) {
    if (!text.startsWith("/")) return handleVaultOp(env, vop, text, chatId);
    await env.KV.delete(VAULT_OP_KEY);
    if (text.toLowerCase().startsWith("/cancel")) return notify(env, chatId, (await uiLang(env)).vopCancel);
  } else if (vop) await env.KV.delete(VAULT_OP_KEY);

  const ask = await askGet(env);
  if (ask) {
    if (text.toLowerCase().startsWith("/cancel")) { await askClear(env); return notify(env, chatId, Lv.askCancelMsg); }
    if (!text.startsWith("/")) { const h = ASK_ROUTES[ask.k]; if (h) { await askClear(env); return h(env, chatId, ask.d, text, Lv); } }
  }

  const dvInt = await diveIntercept(env, chatId, text, msg);
  if (dvInt) return dvInt;

  const gInt = await gameIntercept(env, msg, chatId, text);
  if (gInt) return gInt;

  const urls = text.match(/https?:\/\/[^\s]+/g);
  if (urls && urls.length) {
    for (const u of urls.slice(0, 2)) {
      await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
      const content = await fetchPageText(u);
      if (!content || content.length < 200) {
        await reply(env, chatId, Lv.pageFail + esc(u));
        continue;
      }
      const gen = chatStream(env, [
        { role: "system", content: SYS_SUMMARIZE },
        { role: "user", content: content.slice(0, 12000) }
      ], 800);
      const rs = await streamReply(env, chatId, Lv.sumHead + esc(u) + "\n\n", gen);
      if (rs) await bumpStats(env, content.length, rs.length);
    }
    return;
  }

  if (text.startsWith("/")) {
    const freshCmd = !(await env.KV.get(CHAR_KEY)) && !(await env.KV.get(PERSONA_KEY));
    await reply(env, chatId, freshCmd ? Lv.stNudge : Lv.cmdUnknown);
    return;
  }

  return chatTurn(env, chatId, text, undefined, msg.message_id, msg.reply_to_message && msg.reply_to_message.message_id);
}
