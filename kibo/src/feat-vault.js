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
  REL_PREFIX, HIST_SUM_KEY, PLOT_DIR_KEY, SCENE_KEY, RP_SAVES_PREFIX, RP_CKPT_PREFIX, CHAPTERS_PREFIX,
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
  DL_SAV_PREFIX,
  DL_SAV_TTL_MS,
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
import {
  renderFeeds,
  resolveFeedUrl,
  decodeEnt,
  cleanTag,
  parseFeed,
  handleRss,
  checkFeeds,
} from './feat-rss.js';

export function fmtSize(n) {
  n = n || 0;
  if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
  if (n >= 1024) return Math.round(n / 1024) + " KB";
  return n + " B";
}

export function vaultMedia(m) {
  if (!m) return null;
  if (m.document) return { fid: m.document.file_id, kind: "document", name: m.document.file_name || "", mime: m.document.mime_type || "", size: m.document.file_size || 0 };
  if (m.photo) { const p = m.photo[m.photo.length - 1]; return { fid: p.file_id, kind: "photo", name: "", mime: "image/jpeg", size: p.file_size || 0 }; }
  if (m.video) return { fid: m.video.file_id, kind: "video", name: m.video.file_name || "", mime: m.video.mime_type || "", size: m.video.file_size || 0 };
  if (m.audio) return { fid: m.audio.file_id, kind: "audio", name: m.audio.file_name || "", mime: m.audio.mime_type || "", size: m.audio.file_size || 0 };
  if (m.voice) return { fid: m.voice.file_id, kind: "voice", name: "", mime: m.voice.mime_type || "audio/ogg", size: m.voice.file_size || 0 };
  if (m.video_note) return { fid: m.video_note.file_id, kind: "video", name: "", mime: m.video_note.mime_type || "video/mp4", size: m.video_note.file_size || 0 };
  if (m.animation) return { fid: m.animation.file_id, kind: "document", name: m.animation.file_name || "", mime: m.animation.mime_type || "", size: m.animation.file_size || 0 };
  if (m.sticker) return { fid: m.sticker.file_id, kind: "sticker", name: "", mime: "image/webp", size: m.sticker.file_size || 0 };
  return null;
}

export async function vaultTg(env, method, payload) {
  const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return r.json().catch(() => null);
}

export async function vaultCopyToChannel(env, v, fromChatId, messageId, caption) {
  try {
    if (!v || !v.id || !messageId) return false;
    const p = { chat_id: v.id, from_chat_id: fromChatId, message_id: messageId };
    if (caption) p.caption = caption;
    const c = await vaultTg(env, "copyMessage", p);
    return !!(c && c.ok);
  } catch (_) { return false; }
}

export async function vaultArchiveDl(env, tok) {
  const e = await getJSON(env, DL_SAV_PREFIX + tok, null);
  if (!e || !e.m) return { ok: false, late: true };
  if (e.used) return { ok: false, dup: true };
  const v = await getJSON(env, VAULT_CHAT_KEY, null);
  if (!v || !v.id) return { ok: false, noVault: true };
  const list = await getJSON(env, FILE_INDEX_KEY, []);
  if (list.length >= FILE_MAX) return { ok: false, full: true };
  try { await putJSON(env, DL_SAV_PREFIX + tok, Object.assign({}, e, { used: 1 }), env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {}
  const copied = await vaultCopyToChannel(env, v, e.c, e.m);
  if (!copied) { try { await putJSON(env, DL_SAV_PREFIX + tok, e, env.DB ? { ttlMs: DL_SAV_TTL_MS } : undefined); } catch (_) {} return { ok: false, late: true }; }
  const id = list.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
  let name = String(e.t || "").replace(/[<>]/g, "").trim().slice(0, 60);
  if (!name) name = (e.k === "photo" ? "photo_" : "file_") + new Date(Date.now() + WIB * 1000).toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  list.unshift({ id: id, name: name, fid: e.f || "", kind: e.k || "file", mime: e.mime || "", size: e.s || 0, ts: Date.now() });
  await putJSON(env, FILE_INDEX_KEY, list);
  return { ok: true, id: id, name: name };
}

export async function vaultSave(env, msg, chatId, customName) {
  const L = await uiLang(env);
  const v = await getJSON(env, VAULT_CHAT_KEY, null);
  const src = msg.reply_to_message || msg;
  const m = vaultMedia(src);
  if (!m) { await reply(env, chatId, L.vaultNoMedia); return; }
  const list = await getJSON(env, FILE_INDEX_KEY, []);
  if (list.length >= FILE_MAX) { await reply(env, chatId, L.vaultFull(FILE_MAX)); return; }
  let name = String(customName || m.name || "").replace(/[<>]/g, "").trim().slice(0, 60);
  if (!name) name = (m.kind === "photo" ? "photo_" : m.kind === "voice" ? "voice_" : "file_") + new Date(Date.now() + WIB * 1000).toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const id = list.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
  list.unshift({ id: id, name: name, fid: m.fid, kind: m.kind, mime: m.mime, size: m.size, ts: Date.now() });
  await putJSON(env, FILE_INDEX_KEY, list);
  const archived = await vaultCopyToChannel(env, v, chatId, src.message_id);
  const savedMsg = L.vaultSaved(id, name, fmtSize(m.size), archived);
  if (archived) await notify(env, chatId, savedMsg); else await reply(env, chatId, savedMsg);
}

export async function handleVault(env, chatId) {
  const L = await uiLang(env);
  const view = await renderVault(env, L);
  await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function renderVault(env, L) {
  const v = await getJSON(env, VAULT_CHAT_KEY, null);
  if (!v) return { text: L.vaultTitle + UI_SEP + L.vaultUnbound, markup: { inline_keyboard: [[{ text: L.vaultBindBtn, callback_data: "vbind" }], [{ text: L.home, callback_data: "menu" }]] } };
  const files = await getJSON(env, FILE_INDEX_KEY, []);
  const snaps = await getJSON(env, VAULT_SNAPS_KEY, []);
  const cfg = await getJSON(env, VAULT_CFG_KEY, { auto: true });
  const auto = !cfg || cfg.auto !== false;
  return {
    text: L.vaultTitle + UI_SEP + L.vaultStatus(v.title, files.length, snaps.length, auto),
    markup: { inline_keyboard: [
      [{ text: L.vaultBackupBtn, callback_data: "vbackup" }, { text: L.vaultRestoreBtn, callback_data: "vrestore" }],
      [{ text: (auto ? "\u2705 " : "\u2B1C ") + L.vaultAutoBtn, callback_data: "vauto" }],
      [{ text: "\u{1F4C1} /files", callback_data: "files:0" }, { text: L.vaultUnbindBtn, callback_data: "vunbind" }],
      [{ text: L.home, callback_data: "menu" }]
    ] }
  };
}

export function renderFiles(list, L, page) {
  L = L || UI.en;
  page = page || 0;
  const PER = 8;
  const nav = [{ text: L.back, callback_data: "nav:vault" }, { text: L.home, callback_data: "menu" }];
  if (!list.length) return { text: L.filesEmpty, markup: { inline_keyboard: [nav] } };
  const pages = Math.max(1, Math.ceil(list.length / PER));
  if (page >= pages) page = pages - 1;
  const rows = list.slice(page * PER, page * PER + PER).map(f => [
    { text: "#" + f.id + " " + String(f.name).slice(0, 26) + " \u00b7 " + fmtSize(f.size), callback_data: "fget:" + f.id }
  ]);
  rows.push([{ text: L.bFilesDel, callback_data: "vdel" }, { text: L.bFilesRen, callback_data: "vren2" }]);
  const pnav = [];
  if (page > 0) pnav.push({ text: "\u2B05\uFE0F", callback_data: "files:" + (page - 1) });
  pnav.push({ text: "\u{1F504}", callback_data: "files:" + page });
  if (pages > 1) pnav.push({ text: (page + 1) + "/" + pages, callback_data: "vpage" });
  if (page < pages - 1) pnav.push({ text: "\u27A1\uFE0F", callback_data: "files:" + (page + 1) });
  if (pnav.length) rows.push(pnav);
  rows.push(nav);
  const lines = list.slice(page * PER, page * PER + PER).map(f => "#" + f.id + " " + esc(f.name) + " \u00b7 " + fmtSize(f.size)).join("\n");
  return { text: L.filesTitle + list.length + (pages > 1 ? " \u00b7 hal " + (page + 1) + "/" + pages : "") + L.filesHint + UI_SEP + lines, markup: { inline_keyboard: rows } };
}

export async function handleFilesCmd(env, msg, chatId, kw, page) {
  const L = await uiLang(env);
  let list = await getJSON(env, FILE_INDEX_KEY, []);
  if (kw) { const k = String(kw).toLowerCase(); list = list.filter(f => String(f.name).toLowerCase().indexOf(k) >= 0); }
  if (kw && !list.length) { await reply(env, chatId, L.findEmpty(kw)); return; }
  const view = renderFiles(list, L, page || 0);
  await tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function vaultSend(env, chatId, f) {
  if (f.kind === "note") { await tg(env, "sendMessage", { chat_id: chatId, text: "\u{1F4DD} " + esc(f.name) + (f.text ? "\n" + esc(f.text) : "") }); return; }
  const spec = { document: ["sendDocument", "document"], photo: ["sendPhoto", "photo"], video: ["sendVideo", "video"], audio: ["sendAudio", "audio"], voice: ["sendVoice", "voice"], sticker: ["sendSticker", "sticker"] }[f.kind] || ["sendDocument", "document"];
  const p = { chat_id: chatId };
  p[spec[1]] = f.fid;
  if (f.kind !== "sticker") p.caption = "\u{1F4C4} " + esc(f.name);
  await tg(env, spec[0], p);
}

export async function vaultMatch(env, name) {
  const k = String(name || "").trim().toLowerCase();
  if (!k) return [];
  const list = await getJSON(env, FILE_INDEX_KEY, []);
  return list.filter(f => String(f.name).toLowerCase() === k || String(f.name).toLowerCase().indexOf(k) === 0 || String(f.id) === k);
}

export async function vaultGet(env, msg, chatId, name) {
  const m = await vaultMatch(env, name);
  if (m.length !== 1) { await handleFilesCmd(env, msg, chatId, name, 0); return; }
  await vaultSend(env, chatId, m[0]);
}

export async function vaultRm(env, msg, chatId, name) {
  const L = await uiLang(env);
  if (!String(name || "").trim()) { await reply(env, chatId, L.rmUse); return; }
  const m = await vaultMatch(env, name);
  if (!m.length) { await reply(env, chatId, L.fileNF(esc(name))); return; }
  if (m.length > 1) { await handleFilesCmd(env, msg, chatId, name, 0); return; }
  const list = await getJSON(env, FILE_INDEX_KEY, []);
  await putJSON(env, FILE_INDEX_KEY, list.filter(x => x.id !== m[0].id));
  await notify(env, chatId, L.fileDeleted(esc(m[0].name)));
}

export async function handleVaultOp(env, op, text, chatId) {
  const L = await uiLang(env);
  if (op.op === "ren") {
    const m = text.match(/^(\d+)\s+(.+)$/);
    if (!m) return reply(env, chatId, L.vrenAsk);
    const f = (await getJSON(env, FILE_INDEX_KEY, [])).find(x => x.id === parseInt(m[1], 10));
    if (!f) return reply(env, chatId, L.vopMiss(m[1]));
    await env.KV.delete(VAULT_OP_KEY);
    await vaultDoRename(env, f.id, m[2], chatId);
    return vaultOpRefresh(env, chatId, op.mid);
  }
  const ids = text.split(/[.,\s]+/).map(s => s.replace(/^#/, "")).filter(s => /^\d+$/.test(s)).map(s => parseInt(s, 10));
  if (!ids.length) return reply(env, chatId, L.vdelAsk);
  const list = await getJSON(env, FILE_INDEX_KEY, []);
  const del = list.filter(x => ids.includes(x.id)).map(x => "#" + x.id + " " + x.name);
  const miss = ids.filter(i => !list.some(x => x.id === i)).map(i => "#" + i);
  await putJSON(env, FILE_INDEX_KEY, list.filter(x => !ids.includes(x.id)));
  await env.KV.delete(VAULT_OP_KEY);
  const vdMsg = L.vdelDone(del, miss);
  if (del.length) await notify(env, chatId, vdMsg); else await reply(env, chatId, vdMsg);
  return vaultOpRefresh(env, chatId, op.mid);
}

export async function vaultOpRefresh(env, chatId, mid) {
  if (!mid) return;
  const view = renderFiles(await getJSON(env, FILE_INDEX_KEY, []), await uiLang(env), 0);
  await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function vaultDoBind(env, fc, chatId) {
  const L = await uiLang(env);
  const title = String(fc.title || "vault").slice(0, 60);
  const t = await vaultTg(env, "sendMessage", { chat_id: fc.id, text: L.vaultTestPost });
  if (!t || !t.ok) { await reply(env, chatId, L.vaultBindFail); return; }
  await putJSON(env, VAULT_CHAT_KEY, { id: fc.id, title: title, ts: Date.now() });
  await notify(env, chatId, L.vaultBound(title));
}

export async function vaultDoRename(env, id, newName, chatId) {
  const L = await uiLang(env);
  const list = await getJSON(env, FILE_INDEX_KEY, []);
  const f = list.find(x => x.id === id);
  if (!f) { await reply(env, chatId, L.renFileGone); return; }
  f.name = String(newName || "").replace(/[<>]/g, "").trim().slice(0, 60) || f.name;
  await putJSON(env, FILE_INDEX_KEY, list);
  await notify(env, chatId, L.renamed(esc(f.name)));
}

export const SNAP_KEYS = [CHAT_HIST_KEY, PERSONA_KEY, CHAR_KEY, CHAR_ACTIVE_KEY, PRESET_KEY, "mail_hist", "reminders", MEM_KEY, STATS_KEY, "feeds", LANG_KEY, LEN_KEY, UI_LANG_KEY, "owner_chat", VAULT_CFG_KEY, "quest", "quest_rr", "exp", "tts_out", "squest", PLOT_DIR_KEY, SCENE_KEY];

export async function vaultBackup(env, chatId, silent) {
  try {
    const v = await getJSON(env, VAULT_CHAT_KEY, null);
    if (!v) { if (!silent && chatId) await reply(env, chatId, (await uiLang(env)).vaultNeedBind); return false; }
    const data = {};
    for (const k of SNAP_KEYS) {
      const raw = await env.KV.get(k);
      if (raw == null) continue;
      try { data[k] = JSON.parse(raw); } catch (_) { data[k] = raw; }
    }

    const rpChars = await getJSON(env, CHAR_KEY, []);
    for (const c of rpChars) {
      for (const k of [REL_PREFIX + c.id, HIST_SUM_KEY + "_" + c.id, CMEM_PREFIX + c.id, RP_SAVES_PREFIX + c.id, RP_CKPT_PREFIX + c.id, CHAPTERS_PREFIX + c.id]) {
        const raw = await env.KV.get(k);
        if (raw == null) continue;
        try { data[k] = JSON.parse(raw); } catch (_) { data[k] = raw; }
      }
    }
    const payload = JSON.stringify({ kibo: "vault-snapshot", v: 1, ts: Date.now(), data: data });
    const day = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
    const form = new FormData();
    form.append("chat_id", String(v.id));
    form.append("caption", "\u{1F4BE} snapshot " + day + (silent ? " (auto)" : ""));
    form.append("document", new Blob([payload], { type: "application/json" }), "kibo-snapshot-" + day + ".json");
    const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendDocument", { method: "POST", body: form });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok || !j.result || !j.result.document) {
      if (!silent && chatId) await reply(env, chatId, (await uiLang(env)).vaultBackupFail);
      return false;
    }
    const snaps = await getJSON(env, VAULT_SNAPS_KEY, []);
    snaps.unshift({ ts: Date.now(), mid: j.result.message_id, fid: j.result.document.file_id, auto: !!silent });
    await putJSON(env, VAULT_SNAPS_KEY, snaps.slice(0, SNAP_MAX));
    if (!silent && chatId) await notify(env, chatId, (await uiLang(env)).vaultBackupOk(fmtSize(payload.length)));
    return true;
  } catch (e) {
    console.error("vaultBackup:", (e && e.stack) || e);
    if (!silent && chatId) await reply(env, chatId, "backup failed: " + esc((e && e.message) || e));
    return false;
  }
}

export async function vaultRestore(env, chatId, ts) {
  const L = await uiLang(env);
  const s = (await getJSON(env, VAULT_SNAPS_KEY, [])).find(x => x.ts === ts);
  if (!s) return L.vaultSnapBad;
  let bytes;
  try { bytes = await tgFileBytes(env, s.fid); } catch (e) { return "snapshot download failed: " + esc((e && e.message) || e); }
  let j = null;
  try { j = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes))); } catch (_) {}
  if (!j || j.v !== 1 || !j.data || typeof j.data !== "object") return L.vaultSnapBad;
  await vaultBackup(env, chatId, true);
  let n = 0;
  for (const k of Object.keys(j.data)) {
    if (k === "owner_chat") await env.KV.put("owner_chat", String(j.data[k]));
    else await putJSON(env, k, j.data[k]);
    n++;
  }
  return L.vaultRestored(n);
}

export async function vaultAutoBackup(env, nowSec) {
  try {
    const cfg = await getJSON(env, VAULT_CFG_KEY, null);
    if (cfg && cfg.auto === false) return;
    const v = await getJSON(env, VAULT_CHAT_KEY, null);
    if (!v) return;
    const snaps = await getJSON(env, VAULT_SNAPS_KEY, []);
    const last = snaps.length && snaps[0].ts ? snaps[0].ts : 0;
    if (last && nowSec * 1000 - last < 20 * 3600 * 1000) return;
    const okB = await vaultBackup(env, null, true);
    if (!okB) {
      const owner = (await env.KV.get("owner_chat")) || (env.OWNER_FALLBACK || OWNER_FALLBACK);
      await reply(env, owner, (await uiLang(env)).autoBackupFail);
    }
  } catch (_) {}
}
