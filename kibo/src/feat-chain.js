import { getJSON, putJSON, tg, reply, esc, notify } from './base.js';
import { uiLang, UI_SEP } from './ui.js';
import { addPts, questDay } from './feat-remind.js';
import { chatStream } from './feat-personal.js';
import { stripThink, langLine } from './ai.js';
import { deleteLater } from './feat-media.js';
import { CHAIN_KEY, CHAIN_STEP_PTS, CHAIN_BONUS, CHAIN_SHIELD, SHIELD_MAX, CHAIN_GEN_STALE_MS, UI_LANG_KEY, SYS_CHAIN, SYS_CHAT, LIVE_CTX } from './consts.js';

async function grantChainShield(env) {
  try {
    const q = await getJSON(env, "quest", {});
    if ((q.shields || 0) >= SHIELD_MAX) return 0;
    q.shields = (q.shields || 0) + 1;
    await putJSON(env, "quest", q);
    return 1;
  } catch (_) { return 0; }
}

async function chainView(env, chatId, L) {
  const c = await getJSON(env, CHAIN_KEY + chatId, null);
  if (c && c.state === "gen") return { text: L.chainTitle + UI_SEP + L.chainGenWait };
  if (c && c.state === "active") {
    const lines = c.steps.map((s, i) => (i < c.done ? "\u2705 " : "\u2B1C ") + esc(s)).join("\n");
    return { text: L.chainTitle + UI_SEP + L.chainArc(esc(c.name)) + "\n" + L.chainProg(c.done, c.steps.length) + "\n" + lines + "\n\n" + L.chainDayNote, markup: { inline_keyboard: [[{ text: L.chainQuitBtn, callback_data: "chain:quit" }], [{ text: L.home, callback_data: "menu" }]] } };
  }
  return { text: L.chainTitle + UI_SEP + L.chainIdle + "\n" + L.chainHint, markup: { inline_keyboard: [[{ text: L.chainStartBtn, callback_data: "chain:start" }], [{ text: L.home, callback_data: "menu" }]] } };
}

const sendView = (env, chatId, v) => tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });

export async function handleChain(env, msg, chatId) {
  const L = await uiLang(env);
  return sendView(env, chatId, await chainView(env, chatId, L));
}

export async function chainStartCb(env, chatId, mid, L) {
  const cur = await getJSON(env, CHAIN_KEY + chatId, null);
  if (cur && cur.state === "gen" && Date.now() - (cur.started || 0) < CHAIN_GEN_STALE_MS) return L.chainGenPop;
  if (cur && cur.state === "active") {
    const v = await chainView(env, chatId, L);
    if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    return "";
  }
  await putJSON(env, CHAIN_KEY + chatId, { state: "gen", started: Date.now() });
  const genMid = mid;
  if (genMid) await tg(env, "editMessageText", { chat_id: chatId, message_id: genMid, text: L.chainGenWait, parse_mode: "HTML" });
  try {
    const sysChain = SYS_CHAIN + langLine(await env.KV.get(UI_LANG_KEY));
    const arcAsk = "Compose the arc now.";
    let out = "";
    for await (const d of chatStream(env, [{ role: "system", content: sysChain }, { role: "user", content: arcAsk }], 250, 50000)) out += d;
    const line = (stripThink(out).split("\n").map(s => s.trim()).filter(Boolean).pop() || "").replace(/^["']|["']$/g, "");
    const parts = line.split("|").map(s => s.trim()).filter(Boolean);
    if (parts.length < 6 || !parts[0] || parts.slice(1, 6).some(s => !s)) throw new Error("arc parse failed: " + line.slice(0, 80));
    const arc = { state: "active", name: parts[0].slice(0, 80), steps: parts.slice(1, 6).map(s => s.slice(0, 80)), done: 0, startDay: questDay(Math.floor(Date.now() / 1000)), lastStepDay: "" };
    await putJSON(env, CHAIN_KEY + chatId, arc);
    const v = await chainView(env, chatId, await uiLang(env));
    if (genMid) await tg(env, "editMessageText", { chat_id: chatId, message_id: genMid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    else { const j = await sendView(env, chatId, v); if (j && j.ok && j.result) await deleteLater(env, chatId, j.result.message_id, 300000); }
  } catch (e) {
    await putJSON(env, CHAIN_KEY + chatId, { state: "idle" });
    const L2 = await uiLang(env);
    if (genMid) { await tg(env, "editMessageText", { chat_id: chatId, message_id: genMid, text: L2.chainTitle + UI_SEP + L2.chainGenFail, parse_mode: "HTML" }); await deleteLater(env, chatId, genMid, 20000); }
    else await reply(env, chatId, L2.chainGenFail);
  }
  return "";
}

export async function chainQuitCb(env, chatId, mid, L) {
  const c = await getJSON(env, CHAIN_KEY + chatId, null);
  if (c && c.state === "active" && c.done > 0) {
    const v = { text: L.chainQuitAsk(esc(c.name), c.done, c.steps.length), markup: { inline_keyboard: [[{ text: L.chainQuitYes, callback_data: "chain:quit2" }, { text: L.chainQuitNo, callback_data: "chain:view" }], [{ text: L.home, callback_data: "menu" }]] } };
    if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    return "";
  }
  return chainQuit2Cb(env, chatId, mid, L);
}
export async function chainQuit2Cb(env, chatId, mid, L) {
  const c = await getJSON(env, CHAIN_KEY + chatId, null);
  const nm = c && c.name ? esc(c.name) : "";
  await putJSON(env, CHAIN_KEY + chatId, { state: "idle" });
  const v = await chainView(env, chatId, L);
  if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  return L.chainQuit(nm);
}
export async function chainViewCb(env, chatId, mid, L) {
  const v = await chainView(env, chatId, L);
  if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
  return "";
}

export async function chainStep(env, chatId) {
  const key = CHAIN_KEY + chatId;
  const c = await getJSON(env, key, null);
  if (!c || c.state !== "active") return;
  const today = questDay(Math.floor(Date.now() / 1000));
  if (c.lastStepDay === today) return;
  c.done = Math.min(c.steps.length, c.done + 1);
  c.lastStepDay = today;
  const L = await uiLang(env);
  if (c.done >= c.steps.length) {
    c.state = "done";
    await putJSON(env, key, c, { ttlMs: 36 * 3600 * 1000 });
    const shields = await grantChainShield(env);
    await addPts(env, CHAIN_BONUS);
    await notify(env, chatId, L.chainBonus(esc(c.name), CHAIN_BONUS, shields, CHAIN_SHIELD));
    if (LIVE_CTX && LIVE_CTX.waitUntil) LIVE_CTX.waitUntil(celebrate(env, chatId, c.name).catch(() => {}));
  } else {
    await putJSON(env, key, c);
    await addPts(env, CHAIN_STEP_PTS);
    await notify(env, chatId, L.chainStepUp(c.done, c.steps.length, CHAIN_STEP_PTS));
  }
}

async function celebrate(env, chatId, name) {
  let out = "";
  for await (const d of chatStream(env, [
    { role: "system", content: SYS_CHAT + langLine(await env.KV.get(UI_LANG_KEY)) },
    { role: "user", content: "Event: the user just completed their 5-day quest arc \"" + name + "\" (every step cleared). Celebrate briefly and warmly in-character, 1-2 lines, no lists, no headers." }
  ], 120, 30000)) out += d;
  const t = stripThink(out).trim();
  if (t) await tg(env, "sendMessage", { chat_id: chatId, text: "\uD83C\uDF89 " + esc(t.slice(0, 300)), parse_mode: "HTML" });
}

export async function chainCron(env, nowSec) {
  return;
}
