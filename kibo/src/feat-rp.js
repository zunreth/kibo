import { KNOB_PREFIX, PLOT_DIR_KEY, OOC_KEY, VIBE_PRESETS } from './consts.js';
import { getJSON, putJSON, esc, reply, notify, tg } from './base.js';
import { uiLang, UI_SEP } from './ui.js';
import { getActiveCard } from './feat-chars.js';

const VIBE_HINT = {
  serious: "noticeably more serious - measured, restrained, dry humor at most",
  balanced: "with the card's own natural energy as written - neither suppress nor amplify quirks",
  playful: "noticeably more playful - bouncy, teasing, quick to joke"
};

const getKnobs = (env, id) => getJSON(env, KNOB_PREFIX + id, null);
const putKnobs = (env, id, k) => putJSON(env, KNOB_PREFIX + id, k);

export async function clearKnobField(env, id, field) {
  const k = await getKnobs(env, id);
  if (k && k[field] !== undefined) { delete k[field]; await putKnobs(env, id, k); }
}

export async function purgeKnobs(env, id) { await env.KV.delete(KNOB_PREFIX + id); }

export async function knobLines(env, card) {
  const out = [];
  if (!card) return out;
  const k = await getKnobs(env, card.id);
  if (!k) return out;
  if (k.vibe) out.push("ENERGY DIAL (user-set, obey it): play this character " + (VIBE_HINT[k.vibe] || "with this user-set energy: " + k.vibe) + ". Apply from this reply onward, in every scene, while keeping their core identity.");
  if (k.outfit) out.push("WARDROBE (user-set, obey it): " + card.name + " is currently wearing: " + k.outfit + ". Reflect it in appearance and scene details from this reply onward until the story changes it.");
  return out;
}

export async function knobReminder(env, card) {
  const k = card ? await getKnobs(env, card.id) : null;
  const p = await env.KV.get(PLOT_DIR_KEY);
  const bits = [];
  if (k && k.vibe) bits.push("energy dial");
  if (k && k.outfit) bits.push("wardrobe");
  if (p) bits.push("story tone");
  return bits.length ? "\n\nREMINDER: actively obey the user's RP settings in this reply (" + bits.join(", ") + " - see the directives above)." : null;
}

export async function renderVibeView(env) {
  const L = await uiLang(env);
  const card = await getActiveCard(env);
  if (!card) return { text: L.vibeNoChar, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  const k = await getKnobs(env, card.id);
  const cur = (k && k.vibe) || "";
  const rows = [VIBE_PRESETS.map(p => ({ text: (p === cur ? "\u2705 " : "") + p, callback_data: "vibe:" + p }))];
  rows.push([{ text: L.bVibeDefault, callback_data: "vibe:none" }, { text: L.vibeCustom, callback_data: "vibec" }]);
  rows.push([{ text: L.bAskType, callback_data: "askstart:vibe" }]);
  rows.push([{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]);
  return { text: L.vibeHead + L.vibeCur(cur ? esc(cur) : L.vibeDefault) + L.vibeNote, markup: { inline_keyboard: rows } };
}

export async function setVibe(env, card, val) {
  const k = (await getKnobs(env, card.id)) || {};
  k.vibe = val;
  await putKnobs(env, card.id, k);
}

export async function handleVibe(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim();
  const card = await getActiveCard(env);
  if (!card) { await reply(env, chatId, L.vibeNoChar); return; }
  if (!arg) {
    const v = await renderVibeView(env);
    await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    return;
  }
  const low = arg.toLowerCase();
  if (low === "none") { await clearKnobField(env, card.id, "vibe"); await notify(env, chatId, L.vibeNone); return; }
  const val = VIBE_PRESETS.includes(low) ? low : arg.slice(0, 200);
  await setVibe(env, card, val);
  const disp = VIBE_PRESETS.includes(low) ? val : esc(val.length > 60 ? val.slice(0, 60) + "…" : val);
  await notify(env, chatId, L.vibeSet(disp));
}

export async function renderOutfitView(env) {
  const L = await uiLang(env);
  const card = await getActiveCard(env);
  if (!card) return { text: L.outfitNoChar, markup: { inline_keyboard: [[{ text: L.home, callback_data: "menu" }]] } };
  const k = await getKnobs(env, card.id);
  const rows = (k && k.outfit) ? [[{ text: L.bOutfitClr, callback_data: "outfitdel" }]] : [];
  rows.push([{ text: L.bAskType, callback_data: "askstart:outfit" }]);
  rows.push([{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]);
  return { text: (k && k.outfit) ? L.outfitCur(esc(card.name), esc(k.outfit)) : L.outfitUse(esc(card.name)), markup: { inline_keyboard: rows } };
}

export async function renderPlotView(env) {
  const L = await uiLang(env);
  const cur = await env.KV.get(PLOT_DIR_KEY);
  const rows = cur ? [[{ text: L.bPlotClr, callback_data: "plotdel" }]] : [];
  rows.push([{ text: L.bAskType, callback_data: "askstart:plot" }]);
  rows.push([{ text: L.back, callback_data: "nav:rp" }, { text: L.home, callback_data: "menu" }]);
  return { text: cur ? L.plotCur(esc(cur)) : L.plotUse, markup: { inline_keyboard: rows } };
}

export async function renderRpMenu(env) {
  const L = await uiLang(env);
  const ooc = await oocOn(env);
  const rows = [
    [{ text: L.rpChar, callback_data: "nav:char" }, { text: L.rpMem, callback_data: "nav:cmems" }],
    [{ text: L.rpVibe, callback_data: "nav:vibe" }, { text: L.rpPresets, callback_data: "nav:presets" }],
    [{ text: L.rpPlot, callback_data: "nav:plot" }, { text: L.rpOutfit, callback_data: "nav:outfit" }],
    [{ text: L.rpOocBtn(ooc), callback_data: "oocswitch" }],
    [{ text: L.rpSavesBtn, callback_data: "nav:rpsaves" }],
    [{ text: L.home, callback_data: "menu" }]
  ];
  return { text: L.rpTitle + UI_SEP + L.rpHint, markup: { inline_keyboard: rows } };
}

export async function handleOutfit(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim();
  const card = await getActiveCard(env);
  if (!card) { await reply(env, chatId, L.outfitNoChar); return; }
  const k = await getKnobs(env, card.id);
  if (!arg) {
    const v = await renderOutfitView(env);
    await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    return;
  }
  if (arg.toLowerCase() === "none") { await clearKnobField(env, card.id, "outfit"); await notify(env, chatId, L.outfitNone); return; }
  const kk = k || {};
  kk.outfit = arg.slice(0, 200);
  await putKnobs(env, card.id, kk);
  await notify(env, chatId, L.outfitSet(esc(card.name), esc(kk.outfit)));
}

export async function handlePlot(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim();
  if (!arg) {
    const v = await renderPlotView(env);
    await tg(env, "sendMessage", { chat_id: chatId, text: v.text, parse_mode: "HTML", reply_markup: v.markup });
    return;
  }
  if (arg.toLowerCase() === "none") { await env.KV.delete(PLOT_DIR_KEY); await notify(env, chatId, L.plotNone); return; }
  await env.KV.put(PLOT_DIR_KEY, arg.slice(0, 200));
  await notify(env, chatId, L.plotSet(esc(arg.length > 60 ? arg.slice(0, 60) + "…" : arg)));
}

export async function rpAsk(env, chatId, f, text, L) {
  const val = String(text || "").trim().slice(0, 200);
  if (!val) { await reply(env, chatId, L.askHow); return; }
  if (f === "vibe") {
    const card = await getActiveCard(env);
    if (!card) { await reply(env, chatId, L.vibeNoChar); return; }
    const low = val.toLowerCase();
    const v = VIBE_PRESETS.includes(low) ? low : val;
    await setVibe(env, card, v);
    const disp = VIBE_PRESETS.includes(low) ? v : esc(v.length > 60 ? v.slice(0, 60) + "…" : v);
    await notify(env, chatId, L.vibeSet(disp));
  } else if (f === "outfit") {
    const card = await getActiveCard(env);
    if (!card) { await reply(env, chatId, L.outfitNoChar); return; }
    const k = (await getKnobs(env, card.id)) || {};
    k.outfit = val;
    await putKnobs(env, card.id, k);
    await notify(env, chatId, L.outfitSet(esc(card.name), esc(val)));
  } else if (f === "plot") {
    await env.KV.put(PLOT_DIR_KEY, val);
    await notify(env, chatId, L.plotSet(esc(val.length > 60 ? val.slice(0, 60) + "…" : val)));
  }
}

export async function plotLine(env) {
  const p = await env.KV.get(PLOT_DIR_KEY);
  return p ? "STORY TONE DIRECTIVE (user-set, obey it): weight the story toward: " + p + ". Steer new scenes and dialogue toward this mix from this reply onward." : null;
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export async function handleDice(env, msg, chatId) {
  const L = await uiLang(env);
  await reply(env, chatId, L.diceHead + "\n" + L.dicePlace + " " + pick(L.dicePlaces) + "\n" + L.diceTwist + " " + pick(L.diceTwists) + "\n" + L.diceObj + " " + pick(L.diceObjs) + "\n" + L.diceNote);
}

export async function handleOoc(env, msg, chatId) {
  const L = await uiLang(env);
  const arg = ((msg.text || "").replace(/^\/\S+\s*/, "") || "").trim().toLowerCase();
  if (arg && arg !== "on" && arg !== "off") { await reply(env, chatId, L.oocUse); return; }
  const cur = (await env.KV.get(OOC_KEY)) === "on";
  const next = arg ? arg === "on" : !cur;
  if (next) await env.KV.put(OOC_KEY, "on"); else await env.KV.delete(OOC_KEY);
  await tg(env, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text: next ? L.oocOn : L.oocOff, reply_markup: next ? { inline_keyboard: [[{ text: L.bOocOff, callback_data: "oocoff" }]] } : undefined });
}
export async function oocOn(env) { return (await env.KV.get(OOC_KEY)) === "on"; }

export async function handleRpReset(env, msg, chatId) {
  const L = await uiLang(env);
  const card = await getActiveCard(env);
  const cleared = [];
  if (card) {
    const k = await getKnobs(env, card.id);
    if (k && k.vibe) cleared.push("vibe");
    if (k && k.outfit) cleared.push("outfit");
    if (k && (k.vibe || k.outfit)) await purgeKnobs(env, card.id);
  }
  if (await env.KV.get(PLOT_DIR_KEY)) { await env.KV.delete(PLOT_DIR_KEY); cleared.push("plot"); }
  await reply(env, chatId, cleared.length ? L.rpResetDone(cleared.join(", ")) : L.rpResetNone);
}
