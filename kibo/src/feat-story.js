import { RP_SAVES_PREFIX, RP_SAVES_MAX, RP_CKPT_PREFIX, RP_CKPT_MAX, RP_CKPT_EVERY, CHAPTERS_PREFIX, CHAPTERS_MAX, CHAPTER_GAP_MS, SCENE_KEY, JEAL_COOLDOWN_MS, JEAL_AFF_MIN, SYS_CHAPTER, CHAR_KEY, CHAT_HIST_KEY, CMEM_PREFIX, REL_PREFIX, PLOT_DIR_KEY, LAST_AI_KEY, HIST_SUM_KEY } from './consts.js';
import { getJSON, putJSON, esc, reply, notify, tg } from './base.js';
import { uiLang, fmtWIB, UI_SEP } from './ui.js';
import { getActiveCard } from './feat-chars.js';
import { stripThink } from './ai.js';
import { chatStream } from './feat-personal.js';

const sumKey = id => HIST_SUM_KEY + "_" + id;

const getSlots = async (env, id, ck) => { if (!ck) return getJSON(env, RP_SAVES_PREFIX + id, []); const j = await getJSON(env, RP_CKPT_PREFIX + id, null); return (j && j.slots) || []; };
const findSlot = (slots, name) => slots.find(s => s.name === name);

async function snapNow(env, card) {
  return {
    rel: await getJSON(env, REL_PREFIX + card.id, null),
    sum: await getJSON(env, sumKey(card.id), null),
    cmem: await getJSON(env, CMEM_PREFIX + card.id, null),
    plot: await getJSON(env, PLOT_DIR_KEY, null),
  };
}

export async function rpSaveSlot(env, card, name) {
  const slots = await getSlots(env, card.id);
  let evicted = false;
  if (slots.length >= RP_SAVES_MAX) { slots.shift(); evicted = true; }
  const snap = await snapNow(env, card);
  let t = Date.now();
  for (const s of slots) if (s && s.ts >= t) t = s.ts + 1;
  slots.push(Object.assign({ name, ts: t }, snap));
  await putJSON(env, RP_SAVES_PREFIX + card.id, slots);
  return { name, evicted };
}

export async function rpRestoreSlot(env, card, ts, ck) {
  const slots = await getSlots(env, card.id, ck);
  const s = slots.find(x => x && x.ts === ts);
  if (!s) return null;
  await rpSaveSlot(env, card, "pre-load");
  for (const [k, v] of [[REL_PREFIX + card.id, s.rel], [sumKey(card.id), s.sum], [CMEM_PREFIX + card.id, s.cmem], [PLOT_DIR_KEY, s.plot]]) {
    if (v == null) await env.KV.delete(k); else await putJSON(env, k, v);
  }
  await env.KV.delete(CHAT_HIST_KEY);
  return s;
}

export async function rpDelSlot(env, card, i) {
  const slots = await getSlots(env, card.id);
  if (!slots[i]) return null;
  const [gone] = slots.splice(i, 1);
  await putJSON(env, RP_SAVES_PREFIX + card.id, slots);
  return gone.name;
}

export async function renderRpSavesView(env) {
  const L = await uiLang(env);
  const card = await getActiveCard(env);
  if (!card) return { text: L.rpNoChar, markup: { inline_keyboard: [[{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]] } };
  const slots = await getSlots(env, card.id);
  const ckj = await getJSON(env, RP_CKPT_PREFIX + card.id, null);
  const autos = (ckj && ckj.slots) || [];
  const chaps = await getJSON(env, CHAPTERS_PREFIX + card.id, []);
  const body = slots.length
    ? slots.map((s, i) => "#" + (i + 1) + " — <b>" + esc(s.name) + "</b> (" + fmtWIB(Math.floor(s.ts / 1000), L) + ")").join("\n")
    : L.savesEmpty;
  const text = L.savesTitle + UI_SEP + body + L.savesHint + "\n\n📖 <b>" + L.chapterHead + "</b>\n" + (chaps.length ? chaps.slice(0, 5).map(c => "• " + esc(c.title)).join("\n") : L.chapterNone)
    + "\n\n⏱ <b>" + L.ckptHead + "</b>\n" + (autos.length ? autos.map((s, i) => "#" + (i + 1) + " — <b>" + esc(s.name) + "</b> (" + fmtWIB(Math.floor(s.ts / 1000), L) + ")").join("\n") : L.ckptNone);
  const rows = [[{ text: L.bSvSave, callback_data: "rpsave" }]];
  slots.forEach((s, i) => rows.push([{ text: L.bSvLoad + " " + (i + 1), callback_data: "rploadask:" + i }, { text: "🗑", callback_data: "rpdel:" + i }]));
  autos.forEach((s, i) => rows.push([{ text: L.bSvLoad + " auto " + (i + 1), callback_data: "rploadask:auto:" + i }]));
  rows.push([{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]);
  return { text, markup: { inline_keyboard: rows } };
}

export async function handleRp(env, msg, chatId) {
  const L = await uiLang(env);
  const card = await getActiveCard(env);
  if (!card) { await reply(env, chatId, L.rpNoChar); return; }
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim();
  if (!arg) {
    const v = await renderRpSavesView(env);
    await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    return;
  }
  const sp = arg.indexOf(" ");
  const sub = (sp === -1 ? arg : arg.slice(0, sp)).toLowerCase();
  const rest = sp === -1 ? "" : arg.slice(sp + 1).trim();
  if (sub === "save") {
    const name = (rest || "save-" + new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16).replace("T", " ")).slice(0, 40);
    const r = await rpSaveSlot(env, card, name);
    await notify(env, chatId, L.rpSaved(esc(r.name)) + (r.evicted ? " " + L.rpSaveFull : ""));
    return;
  }
  if (sub === "load") {
    if (!rest) { await reply(env, chatId, L.rpUse); return; }
    const slots = await getSlots(env, card.id);
    const i = slots.findIndex(s => s.name === rest);
    if (i === -1) { await reply(env, chatId, L.rpSlotGone); return; }
    await tg(env, "sendMessage", { chat_id: chatId, text: L.rpLoadAsk(esc(slots[i].name)), parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: L.bSvYes, callback_data: "rploadok:" + slots[i].ts }, { text: L.back, callback_data: "nav:rpsaves" }]] } });
    return;
  }
  if (sub === "del") {
    if (!rest) { await reply(env, chatId, L.rpUse); return; }
    const gone = await rpDelSlot(env, card, parseInt(rest, 10) - 1);
    await reply(env, chatId, gone ? L.rpDelDone(esc(gone)) : L.rpSlotGone);
    return;
  }
  await reply(env, chatId, L.rpUse);
}

export async function chapterMaybe(env, card, hist) {
  try {
    if (!card) card = await getActiveCard(env);
    if (!card) return;
    const la = await getJSON(env, LAST_AI_KEY, null);
    if (!la || !la.ts) return;
    const now = Date.now();
    if (now - la.ts * 1000 < CHAPTER_GAP_MS) return;
    const key = CHAPTERS_PREFIX + card.id;
    const chaps = await getJSON(env, key, []);
    if (chaps.length && chaps[0].end_ts >= la.ts) return;
    const sum = await getJSON(env, sumKey(card.id), null);
    const lines = (hist || []).slice(-10);
    if (!sum && lines.length < 6) return;
    const convo = lines.map(m => (m.role === "user" ? "User: " : "Char: ") + String(m.content || "")).join("\n").slice(0, 3000);
    const msgs = [{ role: "system", content: SYS_CHAPTER }, { role: "user", content: (sum ? "Rolling summary of the session:\n" + String(sum.text || "").slice(0, 1500) + "\n\n" : "") + "Last exchanges:\n" + convo }];
    let out = "";
    for await (const d of chatStream(env, msgs, 60)) out += d;
    const title = stripThink(out).trim().split("\n")[0].replace(/^["'#\d.\-\s]+/, "").replace(/["'#\s]+$/, "").slice(0, 80);
    if (!title) return;
    chaps.unshift({ ts: now, end_ts: la.ts, title });
    await putJSON(env, key, chaps.slice(0, CHAPTERS_MAX));
  } catch (_) {  }
}

export const getScene = env => getJSON(env, SCENE_KEY, null);

export async function sceneTarget(env, replyMid) {
  const sc = await getScene(env);
  if (!sc) return null;
  return replyMid && sc.mb === replyMid ? "b" : "a";
}

export async function handleScene(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim();
  if (arg.toLowerCase() === "off") {
    if (await getScene(env)) { await env.KV.delete(SCENE_KEY); await notify(env, chatId, L.sceneOff); }
    else await reply(env, chatId, L.sceneUse);
    return;
  }
  if (!arg) {
    const cur = await getScene(env);
    await reply(env, chatId, cur ? L.sceneStatus(esc(cur.bname)) : L.sceneUse);
    return;
  }
  const active = await getActiveCard(env);
  if (!active) { await reply(env, chatId, L.rpNoChar); return; }
  const cards = await getJSON(env, CHAR_KEY, []);
  let b = null;
  if (/^\d+$/.test(arg)) b = cards.find(c => String(c.id) === arg) || cards[parseInt(arg, 10) - 1] || null;
  else b = cards.find(c => (c.name || "").toLowerCase() === arg.toLowerCase());
  if (!b) { await reply(env, chatId, L.sceneNoChar); return; }
  if (String(b.id) === String(active.id)) { await reply(env, chatId, L.sceneUse); return; }
  await putJSON(env, SCENE_KEY, { b: b.id, bname: b.name, jeal_ts: 0, ma: 0, mb: 0 });
  await reply(env, chatId, L.sceneOn(esc(b.name)));
}

export async function jealousyMaybe(env, chatId, cardA, hist, sc) {
  try {
    if (!sc || !cardA) return;
    const now = Date.now();
    if (now - (sc.jeal_ts || 0) < JEAL_COOLDOWN_MS) return;
    const relA = await getJSON(env, REL_PREFIX + cardA.id, null);
    if (!relA || (relA.aff || 0) < JEAL_AFF_MIN) return;
    const convo = (hist || []).slice(-6).map(m => (m.role === "user" ? "User: " : "Char: ") + String(m.content || "")).join("\n").slice(0, 2500);
    const sys = cardA.prompt + "\nYou are " + cardA.name + " in an ongoing scene with the user. Another character (" + (sc.bname || "someone else") + ") just got the user's full attention this turn. React in ONE short in-character line — mild jealousy/possessiveness that matches your personality and current mood (" + (relA.mood || "calm") + "). No system talk, no meta.";
    const msgs = [{ role: "system", content: sys }, { role: "user", content: convo }];
    let out = "";
    for await (const d of chatStream(env, msgs, 120)) out += d;
    out = stripThink(out).trim();
    if (!out) return;
    await tg(env, "sendMessage", { chat_id: chatId, text: esc(out.slice(0, 500)), parse_mode: "HTML" });
    const cur = await getScene(env);
    if (cur && String(cur.b) === String(sc.b)) { cur.jeal_ts = now; await putJSON(env, SCENE_KEY, cur); }
  } catch (_) {  }
}

export async function rpCheckpointMaybe(env, card, histFull, turnTs) {
  try {
    if (!card) card = await getActiveCard(env);
    if (!card || !Array.isArray(histFull) || !histFull.length) return;
    const key = RP_CKPT_PREFIX + card.id;
    const ck = (await getJSON(env, key, null)) || { turnTs: 0, slots: [] };
    const added = histFull.filter(m => m && typeof m.ts === "number" && m.ts > (ck.turnTs || 0)).length;
    if (added < RP_CKPT_EVERY) return;
    const snap = await snapNow(env, card);
    let t = Date.now();
    for (const s of ck.slots) if (s && s.ts >= t) t = s.ts + 1;
    ck.slots.unshift(Object.assign({ name: "auto-" + new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16).replace("T", " "), ts: t }, snap));
    ck.slots = ck.slots.slice(0, RP_CKPT_MAX);
    ck.turnTs = turnTs || Math.floor(Date.now() / 1000);
    await putJSON(env, key, ck);
  } catch (_) {  }
}

function splitSceneReply(raw, card, sc) {
  if (!raw || !sc || !card) return null;
  const sp = [
    { name: String(card.name || "").toLowerCase(), id: card.id },
    { name: String(sc.bname || "").toLowerCase(), id: sc.b },
  ];
  if (!sp[0].name || !sp[1].name || sp[0].name === sp[1].name) return null;
  const segs = [];
  let cur = null;
  for (const ln of String(raw).split("\n")) {
    const t = ln.replace(/^[*\s]+/, "").replace(/[*\s]+$/, "");
    const hit = sp.findIndex(s => s.name && t.toLowerCase().startsWith(s.name + ":"));
    if (hit > -1) {
      const body = t.slice(sp[hit].name.length + 1).trim();
      if (cur && cur.sp === hit) cur.lines.push(body);
      else { cur = { sp: hit, lines: [body] }; segs.push(cur); }
    } else if (cur) cur.lines.push(ln);
    else { cur = { sp: -1, lines: [ln] }; segs.push(cur); }
  }
  const merged = [];
  let lead = null;
  for (const s of segs) {
    if (s.sp === -1 && !merged.length) { lead = s; continue; }
    if (merged.length && merged[merged.length - 1].sp === s.sp) merged[merged.length - 1].lines.push(...s.lines);
    else { if (lead) { s.lines.unshift(...lead.lines); lead = null; } merged.push(s); }
  }
  if (!merged.length) return null;
  while (merged.length > 2) { const tail = merged.pop(); merged[merged.length - 1].lines.push(...tail.lines); }
  if (merged.length < 2 || new Set(merged.map(s => s.sp)).size < 2) return null;
  return merged.map(s => ({ sp: s.sp, text: s.lines.join("\n").trim() })).filter(p => p.text);
}

export async function sendSceneParts(env, chatId, raw, card, sc, firstMid) {
  const parts = splitSceneReply(raw, card, sc);
  if (!parts) return null;
  const mids = {}, entries = [];
  let lastMid = firstMid;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const text = esc(p.text.slice(0, 3500));
    if (!text) continue;
    let mid;
    if (i === 0 && firstMid) {
      await tg(env, "editMessageText", { chat_id: chatId, message_id: firstMid, text, parse_mode: "HTML" });
      mid = firstMid;
    } else {
      const r = await tg(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
      mid = r && r.result && r.result.message_id;
    }
    if (!mid) continue;
    mids[p.sp === 0 ? "a" : "b"] = mid;
    entries.push({ role: "assistant", content: p.text, mid, ts: 0 });
    lastMid = mid;
  }
  return entries.length ? { mids, entries, lastMid } : null;
}
