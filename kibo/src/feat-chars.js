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
  AIST_FIRST_PREFIX,
  HIST_SUM_KEY,
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
  OOC_KEY,
  SCENE_KEY,
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
  UI_SEP,
  uiBar,
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
import { profEconLine } from './feat-econ.js';
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
  vaultCopyToChannel,
  vaultSave,
} from './feat-vault.js';

export async function getActiveCard(env) {
  const [idRaw, cards] = await Promise.all([env.KV.get(CHAR_ACTIVE_KEY), getJSON(env, CHAR_KEY, [])]);
  const id = parseInt(idRaw || "0", 10);
  if (!id) return null;
  return cards.find(c => c.id === id) || null;
}

export function renderChars(cards, activeId, L) {
  L = L || UI.en;
  if (!cards.length) return { text: L.charsEmpty, markup: { inline_keyboard: [[{ text: L.cimpBtn, callback_data: "cimp" }], [{ text: L.bPresets, callback_data: "nav:presets" }, { text: L.bMe, callback_data: "nav:me" }], [{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]] } };
  return {
    text: L.charsTitle + UI_SEP + cards.map(c => (c.id === activeId ? "\u2705 " : "") + "#" + c.id + " \u2014 " + esc(c.name)).join("\n") + L.charsHint,
    markup: { inline_keyboard: [...cards.map(c => [{ text: (c.id === activeId ? "\u2705 " : "\u25B6\uFE0F ") + c.name.slice(0, 16), callback_data: "cact:" + c.id }, { text: "\u{1F5D1}", callback_data: "cdel:" + c.id }]), ...(activeId ? [[{ text: "\u2716\uFE0F Off", callback_data: "coff" }, { text: L.bMem + " char", callback_data: "nav:cmems" }]] : []), [{ text: L.galBtn, callback_data: "nav:cgal" }], [{ text: L.cimpBtn, callback_data: "cimp" }], [{ text: L.bPresets, callback_data: "nav:presets" }, { text: L.bMe, callback_data: "nav:me" }], [{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]] }
  };
}

export function renderPresets(list, L) {
  L = L || UI.en;
  const nav = [{ text: L.back, callback_data: "nav:char" }, { text: L.home, callback_data: "menu" }];
  if (!list.length) return { text: L.presetsEmpty, markup: { inline_keyboard: [[{ text: L.impBtn, callback_data: "pimp" }], nav] } };
  return {
    text: L.presetsTitle + list.map(p => (p.enabled ? "\u2705 " : "\u2B1C ") + "#" + p.id + " \u2014 " + esc(p.name)).join("\n") + L.presetsHint,
    markup: { inline_keyboard: list.map(p => [{ text: (p.enabled ? "\u2705 " : "\u2B1C ") + String(p.name).slice(0, 28), callback_data: "ptgl:" + p.id }, { text: "\u{1F5D1}", callback_data: "pdel:" + p.id }]).concat([[{ text: L.impBtn, callback_data: "pimp" }], nav]) }
  };
}

export async function handlePresets(env, msg, chatId) {
  const view = renderPresets(await getJSON(env, PRESET_KEY, []), await uiLang(env));
  await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export function compilePreset(j) {
  const prompts = Array.isArray(j && j.prompts) ? j.prompts : null;
  if (prompts && prompts.length) {
    const byId = {};
    prompts.forEach(p => { if (p && p.identifier != null) byId[p.identifier] = p; });
    let order = null;
    if (Array.isArray(j.prompt_order) && j.prompt_order.length) {
      const e = j.prompt_order.find(o => o && o.character_id === 100001) || j.prompt_order[0];
      if (e && Array.isArray(e.order)) order = e.order;
    }
    const parts = (order || prompts).map(x => {
      if (x && x.enabled === false) return "";
      const p = order ? byId[x.identifier] : x;
      return p && p.enabled !== false ? String(p.content || "") : "";
    });
    const joined = parts.filter(s => s && s.trim()).join("\n\n");
    if (joined.trim()) return joined;
  }
  if (typeof (j && j.system_prompt) === "string" && j.system_prompt.trim()) return j.system_prompt.trim();
  if (typeof (j && j.content) === "string" && j.content.trim()) return j.content.trim();
  return "";
}

export async function handlePresetDoc(env, msg, chatId, pf) {
  const L = await uiLang(env);
  await env.KV.delete(PRESET_IMPORT_KEY);
  if (Date.now() - pf.ts > 600000) { await reply(env, chatId, L.pimpExpired); return; }
  const doc = msg.document || {};
  if (doc.file_size && doc.file_size > 5 * 1024 * 1024) { await reply(env, chatId, L.fileBig); return; }
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  let bytes;
  try { bytes = await tgFileBytes(env, doc.file_id); } catch (e) { await reply(env, chatId, L.dlFail + esc((e && e.message) || e)); return; }
  const u8 = new Uint8Array(bytes);
  if (u8.length > 4 && u8[0] === 0x89 && u8[1] === 0x50) { await reply(env, chatId, L.presetPngWarn); return; }
  const txt = new TextDecoder().decode(u8);
  let j = null;
  try { j = JSON.parse(txt); } catch (_) {}
  if (!j || typeof j !== "object" || Array.isArray(j)) { await reply(env, chatId, L.presetBad); return; }
  const list = await getJSON(env, PRESET_KEY, []);
  if (list.length >= PRESET_MAX) { await reply(env, chatId, L.presetFull); return; }
  const compiled = (compilePreset(j) || JSON.stringify(j, null, 2)).slice(0, PRESET_COMPILED_CAP);
  const name = String(doc.file_name || "preset").replace(/\.json$/i, "").trim().slice(0, 40) || "preset";
  const id = list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  list.push({ id: id, name: name, enabled: true, raw: txt.slice(0, 20000), compiled: compiled, ts: Date.now() });
  await putJSON(env, PRESET_KEY, list);
  await notify(env, chatId, L.presetOk(id, name, compiled.length));
  if (pf.mid && pf.chat === chatId) {
    const view = renderPresets(list, L);
    await tg(env, "editMessageText", { chat_id: chatId, message_id: pf.mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
  }
}

export async function renderMenu(env) {
  const L = await uiLang(env);
  await flushStatsBuf(env);
  const s = (await getJSON(env, STATS_KEY, null)) || { d: {} };
  const day = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
  const td = (s.d || {})[day] || { c: 0, i: 0, o: 0 };

  const cf = await aiConf(env);
  const e = await getJSON(env, "exp", { xp: 0 });
  const lv = Math.floor((e.xp || 0) / XP_PER_LEVEL) + 1;
  const persona = await getJSON(env, PERSONA_KEY, null);
  const q = await getJSON(env, "quest", {});
  const qs = (q.day !== day) ? L.profQNone : q.done ? L.profQDone : q.skipped ? L.profQSkip : L.profQTodo;
  const dt = new Date(Date.now() + WIB * 1000);
  const dateLine = "\u{1F4C5} " + L.days[dt.getUTCDay()] + ", " + dt.getUTCDate() + " " + L.mons[dt.getUTCMonth()] + " \u00b7 " + String(dt.getUTCHours()).padStart(2, "0") + ":" + String(dt.getUTCMinutes()).padStart(2, "0") + " WIB";

  const xpCur = (e.xp || 0) % XP_PER_LEVEL;
  const econL = await profEconLine(env, L);
  return {
    text: "\u{1F916} <b>kibo</b> <i>\u00b7 v" + BOT_VER + "</i>" + UI_SEP + dateLine + "\n" +
      "\u{1F9E0} " + esc(cf.label || "default (env)") + (cf.model ? " \u00b7 <code>" + esc(cf.model) + "</code>" : "") + "\n" +
      "\u{1F464} " + (persona ? esc(persona.name) + " \u00b7 " : "") + L.profLv(lv, e.xp || 0) + "\n" +
      uiBar(xpCur, XP_PER_LEVEL) + "\n" +
      "\u{1F3AF} " + L.profQLine(qs, q.streak || 0, q.points || 0) + econL + "\n" +
      "\u{1F4CA} " + L.menuToday(td.c, fmtTok(td.i + td.o)) + UI_SEP +
      "\u{1F4A1} <i>" + L.facts[questOfDay(day)] + "</i>",
    markup: { inline_keyboard: [
      [{ text: L.bRp, callback_data: "nav:rp" }, { text: L.bMem, callback_data: "nav:mems" }],
      [{ text: L.bQuest, callback_data: "nav:quest" }, { text: L.bRem, callback_data: "nav:rem" }],
      [{ text: L.bEcon, callback_data: "ec:hub" }],
      [{ text: L.bRss, callback_data: "nav:rss" }, { text: L.bMail, callback_data: "nav:otp" }],

      [{ text: L.bGame, callback_data: "g" }, { text: L.bJ, callback_data: "nav:j" }],
      [{ text: L.bStats, callback_data: "nav:stats" }, { text: L.bCfg, callback_data: "nav:cfg" }, { text: L.bProf, callback_data: "nav:profile" }],
      [{ text: L.bVault, callback_data: "nav:vault" }, { text: L.bNew, callback_data: "rst" }]
    ] }
  };
}

export async function sendMenu(env, chatId) {
  const v = await renderMenu(env);
  await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
}

export async function handleChar(env, msg, chatId) {
  const L = await uiLang(env);
  const body = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  let cards = await getJSON(env, CHAR_KEY, []);
  const activeId = parseInt((await env.KV.get(CHAR_ACTIVE_KEY)) || "0", 10);

  const resetHist = id => { env.KV.delete(CHAT_HIST_KEY); if (id) env.KV.delete(HIST_SUM_KEY + "_" + id); };
  if (!body) {
    const view = renderChars(cards, activeId, await uiLang(env));
    await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
    return;
  }
  const sub = body.split(/\s+/)[0].toLowerCase();
  if (sub === "add") {
    const rest = body.replace(/^add\s+/i, "");
    let name = "", prompt = "";
    const sep = rest.indexOf("|");
    if (sep >= 0) { name = rest.slice(0, sep).trim(); prompt = rest.slice(sep + 1).trim(); }
    else { const sp = rest.search(/\s/); if (sp >= 0) { name = rest.slice(0, sp).trim(); prompt = rest.slice(sp + 1).trim(); } }
    if (!name || !prompt) { await reply(env, chatId, L.charAddUse); return; }
    if (cards.length >= CHAR_MAX) { await reply(env, chatId, L.charFull(CHAR_MAX)); return; }
    const id = cards.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
    cards.push({ id: id, name: name.slice(0, 32), prompt: prompt.slice(0, 1500), ts: Date.now() });
    await putJSON(env, CHAR_KEY, cards);
    await notify(env, chatId, L.charSaved(id, esc(name.slice(0, 32))));
    return;
  }
  if (sub === "list") {
    const view = renderChars(cards, activeId, await uiLang(env));
    await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
    return;
  }
  if (sub === "import") {
    await env.KV.put(CHAR_IMPORT_KEY, String(Date.now()));
    await reply(env, chatId, L.charImportAsk);
    return;
  }
  if (sub === "off") {
    await env.KV.delete(CHAR_ACTIVE_KEY);
    await env.KV.delete(SCENE_KEY);
    await env.KV.delete(OOC_KEY);
    await resetHist();
    await notify(env, chatId, L.charOff);
    return;
  }
  if (sub === "del") {
    const id = parseInt(body.split(/\s+/)[1], 10);
    const before = cards.length;
    cards = cards.filter(c => c.id !== id);
    if (cards.length === before) { await reply(env, chatId, L.charGone); return; }
    await putJSON(env, CHAR_KEY, cards);
    await env.KV.delete(CMEM_PREFIX + id);
    if (activeId === id) { await env.KV.delete(CHAR_ACTIVE_KEY); await resetHist(id); }
    await notify(env, chatId, L.charDeleted(id, activeId === id ? L.charBackDefault : ""));
    return;
  }

  let card;
  if (/^\d+$/.test(body)) card = cards.find(c => c.id === parseInt(body, 10));
  if (!card) {
    const want = body.toLowerCase();
    card = cards.find(c => c.name.toLowerCase() === want) || cards.find(c => c.name.toLowerCase().startsWith(want));
  }
  if (!card) { await reply(env, chatId, L.charNF(esc(body.slice(0, 40)))); return; }
  await env.KV.put(CHAR_ACTIVE_KEY, String(card.id));
  try { const fk = AIST_FIRST_PREFIX + card.id; if (!(await env.KV.get(fk))) await env.KV.put(fk, String(Date.now())); } catch (_) {}
  await resetHist();
  await notify(env, chatId, L.charOn(esc(card.name)));
}

export function b64ToUTF8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(u8);
}

export function pngCardJSON(u8) {
  if (u8.length < 16 || u8[0] !== 0x89 || u8[1] !== 0x50 || u8[2] !== 0x4e || u8[3] !== 0x47) return null;
  const dec = new TextDecoder();
  let off = 8;
  while (off + 12 <= u8.length) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const len = dv.getUint32(off);
    const type = dec.decode(u8.slice(off + 4, off + 8));
    if (off + 8 + len + 4 > u8.length) break;
    if (type === "tEXt") {
      const data = u8.slice(off + 8, off + 8 + len);
      const nul = data.indexOf(0);
      const key = nul > 0 ? dec.decode(data.slice(0, nul)) : "";
      if (key === "chara" || key === "ccv3") {
        try { return JSON.parse(b64ToUTF8(dec.decode(data.slice(nul + 1)))); } catch (_) {}
      }
    }
    if (type === "IEND") break;
    off += 12 + len;
  }
  return null;
}

export function cardToPrompt(d) {
  const parts = [];
  const add = (label, v) => { const s = String(v == null ? "" : v).trim(); if (s) parts.push(label + ": " + s); };
  parts.push('YOU ARE "' + String(d.name).trim() + '". Stay consistently in this character, never break character.');
  add("Description", d.description);
  add("Personality", d.personality || d.personality_summary);
  add("Scenario", d.scenario);
  add("Speech style examples", d.mes_example);
  add("Signature opener", d.first_mes);
  return parts.join("\n");
}

export async function handleDocument(env, msg, chatId) {
  const L = await uiLang(env);
  if ((msg.caption || "").trim().toLowerCase().startsWith("/save")) return vaultSave(env, msg, chatId, msg.caption.trim().slice(5).trim());
  const pf = await getJSON(env, PRESET_IMPORT_KEY, null);
  if (pf && pf.ts) return handlePresetDoc(env, msg, chatId, pf);
  const wait = parseInt((await env.KV.get(CHAR_IMPORT_KEY)) || "0", 10);
  if (!wait || Date.now() - wait > 600000) {
    await reply(env, chatId, L.charImportHow);
    return;
  }
  await env.KV.delete(CHAR_IMPORT_KEY);
  const doc = msg.document || {};
  if (doc.file_size && doc.file_size > 5 * 1024 * 1024) { await reply(env, chatId, L.fileBig); return; }
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  let bytes;
  try { bytes = await tgFileBytes(env, doc.file_id); } catch (e) { await reply(env, chatId, L.dlFail + esc((e && e.message) || e)); return; }
  const u8 = new Uint8Array(bytes);
  let j = null;
  try {
    if (u8.length > 8 && u8[0] === 0x89 && u8[1] === 0x50) j = pngCardJSON(u8);
    else j = JSON.parse(new TextDecoder().decode(u8));
  } catch (_) {}
  const d = j && (j.data || j);
  if (!d || !d.name) { await reply(env, chatId, L.charBad); return; }
  const cards = await getJSON(env, CHAR_KEY, []);
  if (cards.length >= CHAR_MAX) { await reply(env, chatId, L.charFull(CHAR_MAX)); return; }
  const id = cards.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  const name = String(d.name).trim().slice(0, 32);
  cards.push({ id: id, name: name, prompt: cardToPrompt(d).slice(0, 3500), img_file_id: doc.file_id || "", ts: Date.now() });
  await putJSON(env, CHAR_KEY, cards);
  const vlt = await getJSON(env, VAULT_CHAT_KEY, null);
  await vaultCopyToChannel(env, vlt, chatId, msg.message_id, "\u{1F3AD} card: " + name);
  await notify(env, chatId, L.charImported(id, esc(name), esc((doc.file_name || "file").slice(0, 40))));
}

function cardCapLine(prompt) {
  const m = String(prompt || "").match(/Description:\s*([^\n]+)/);
  return (m ? m[1] : String(prompt || "").split("\n")[0]).slice(0, 200).trim();
}

export async function renderGallery(env, L) {
  const cards = await getJSON(env, CHAR_KEY, []);
  const art = cards.filter(c => c.img_file_id);
  const plain = cards.filter(c => !c.img_file_id);
  let text = L.galTitle;
  if (!cards.length) text += L.galEmpty;
  else text += cards.map(c => (c.img_file_id ? "🖼 " : "✏️ ") + "#" + c.id + " — " + esc(c.name)).join("\n") + (plain.length ? "\n" + L.galPlain(plain.length) : "");
  const rows = art.map(c => [{ text: "🖼 " + c.name.slice(0, 24), callback_data: "cgal:" + c.id }]);
  return { text, markup: { inline_keyboard: rows.concat([[{ text: L.back, callback_data: "nav:char" }, { text: L.home, callback_data: "menu" }]]) } };
}

export async function sendCardArt(env, chatId, idStr, L, pop) {
  const card = (await getJSON(env, CHAR_KEY, [])).find(c => String(c.id) === String(idStr));
  if (!card) { await pop(L.galGone); return; }
  if (!card.img_file_id) { await pop(L.galNoArt); return; }
  await pop("");
  await tg(env, "sendPhoto", { chat_id: chatId, photo: card.img_file_id, caption: L.galCap(esc(card.name), esc(cardCapLine(card.prompt))), parse_mode: "HTML" });
}
