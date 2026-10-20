import { tg, notify, reply, getJSON, putJSON, esc, mdTg } from "./base.js";
import { uiLang, fmtWIB, UI_SEP } from "./ui.js";
import {
  CHAR_KEY, CMEM_PREFIX, REL_PREFIX, HIST_SUM_KEY, RP_SAVES_PREFIX, RP_CKPT_PREFIX,
  CHAPTERS_PREFIX, RP_SAVES_MAX, KNOB_PREFIX, PLOT_DIR_KEY, OOC_KEY, SCENE_KEY, STATS_KEY,
  AIST_FIRST_PREFIX, AIST_MSG_PREFIX, AIST_REC_PREFIX, AIST_WRAP_PREFIX, AIST_WRAP_GAP_MS,
  SYS_AISTATS_WRAP, LANG_KEY
} from "./consts.js";
import { getActiveCard } from "./feat-chars.js";
import { chatStream } from "./feat-personal.js";
import { stripThink, langLine } from "./ai.js";

const stageOf = (L, aff) => L.relStages[Math.min(4, Math.floor(aff / 20))];

export async function aistData(env, card) {
  const id = card.id;
  const [rel, mems, sum, chaps, saves, ckpt, knobs, plot, ooc, sc, rec, fsRaw, msgRaw] = await Promise.all([
    getJSON(env, REL_PREFIX + id, null),
    getJSON(env, CMEM_PREFIX + id, []),
    getJSON(env, HIST_SUM_KEY + "_" + id, null),
    getJSON(env, CHAPTERS_PREFIX + id, []),
    getJSON(env, RP_SAVES_PREFIX + id, []),
    getJSON(env, RP_CKPT_PREFIX + id, null),
    getJSON(env, KNOB_PREFIX + id, null),
    getJSON(env, PLOT_DIR_KEY, null),
    getJSON(env, OOC_KEY, null),
    getJSON(env, SCENE_KEY, null),
    getJSON(env, AIST_REC_PREFIX + id, null),
    env.KV.get(AIST_FIRST_PREFIX + id),
    env.KV.get(AIST_MSG_PREFIX + id),
  ]);
  return { rel, mems, sum, chaps, saves, ckpt, knobs, plot, ooc, sc, rec,
    fs: fsRaw ? parseInt(fsRaw, 10) || 0 : 0, msgN: msgRaw ? parseInt(msgRaw, 10) || 0 : 0 };
}

export async function renderAistatsHub(env) {
  const L = await uiLang(env);
  const cards = await getJSON(env, CHAR_KEY, []);
  const rels = await Promise.all(cards.map(c => getJSON(env, REL_PREFIX + c.id, null)));
  const st = (await getJSON(env, STATS_KEY, null)) || { t: { c: 0 } };
  const bonds = cards.map((c, i) => ({ c, aff: rels[i] && typeof rels[i].aff === "number" ? rels[i].aff : -1 }))
    .sort((a, b) => b.aff - a.aff);
  const rows = bonds.slice(0, 12).map(b => [{
    text: b.aff >= 0 ? "\u2764\uFE0F " + b.aff + " \u00b7 " + (b.c.name || "#" + b.c.id) : "\u{1F916} " + (b.c.name || "#" + b.c.id),
    callback_data: "aist:" + b.c.id }]);
  const text = L.aiHubHead + UI_SEP + L.aiHubIntro((st.t && st.t.c) || 0, cards.length) + (cards.length ? "" : "\n" + L.aiNone);
  return { text, markup: { inline_keyboard: rows.concat([[{ text: L.home, callback_data: "menu" }]]) } };
}

export async function renderAistatDetail(env, card) {
  const L = await uiLang(env);
  const d = await aistData(env, card);
  let t = L.aiDetHead(esc(card.name || "#" + card.id)) + UI_SEP;
  if (d.rel && typeof d.rel.aff === "number") {
    t += L.aiBond(d.rel.aff, stageOf(L, d.rel.aff), esc(d.rel.mood || "-"));
    if (d.rel.note) t += L.stRelNote(esc(String(d.rel.note).slice(0, 120)));
  } else t += L.aiBond0;
  if (d.fs) t += L.aiKnown(Math.max(1, Math.floor((Date.now() - d.fs) / 86400000)), d.msgN);
  else t += L.aiKnown0;
  if (d.sc && String(d.sc.b) === String(card.id) && d.sc.jeal_ts) t += L.aiScene(fmtWIB(Math.floor(d.sc.jeal_ts / 1000)));
  t += L.aiMemHead + L.aiCmem((d.mems || []).length);
  if (d.sum && d.sum.text) t += L.stMem(d.sum.n || 0, d.sum.ts ? fmtWIB(Math.floor(d.sum.ts / 1000)) : "-")
    + L.stMemQ(esc(String(d.sum.text).slice(0, 200)) + (String(d.sum.text).length > 200 ? "\u2026" : ""));
  else t += L.stMem0;
  t += (d.chaps || []).length ? L.aiChap(d.chaps.length, esc(String(d.chaps[0].title || "-"))) : L.aiChap0;
  t += L.aiSaves((d.saves || []).length, ((d.ckpt && d.ckpt.slots) || []).length);
  const kn = [];
  if (d.knobs && d.knobs.vibe) kn.push("vibe: " + d.knobs.vibe);
  if (d.knobs && d.knobs.outfit) kn.push("outfit: " + d.knobs.outfit);
  if (d.plot) kn.push("plot: " + String(d.plot).slice(0, 40));
  if (d.ooc === "on") kn.push("OOC");
  t += kn.length ? L.aiKnob(esc(kn.join(" \u00b7 "))) : L.aiKnob0;
  const r = d.rec || {};
  t += (r.pvpW || r.pvpL || r.betW || r.betL) ? L.aiRec(r.pvpW || 0, r.pvpL || 0, r.betW || 0, r.betL || 0, r.net || 0) : L.aiRec0;
  return { text: t, markup: { inline_keyboard: [
    [{ text: L.bWrapped, callback_data: "aistw:" + card.id }],
    [{ text: L.back, callback_data: "aistb" }, { text: L.home, callback_data: "menu" }]
  ] } };
}

export async function aistWrapped(env, chatId, card, mid) {
  const L = await uiLang(env);
  const wk = AIST_WRAP_PREFIX + card.id;
  const last = parseInt((await env.KV.get(wk)) || "0", 10) || 0;
  if (last && Date.now() - last < AIST_WRAP_GAP_MS) { await notify(env, chatId, L.aiWrapThrottle); return; }
  await env.KV.put(wk, String(Date.now()));
  const v = await renderAistatDetail(env, card);
  if (mid) await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: v.text + L.aiWrapWait, parse_mode: "HTML", reply_markup: v.markup });
  try {
    const d = await aistData(env, card);
    const lines = ["CHARACTER: " + (card.name || "#" + card.id), "VERIFIED DATA (use ONLY these numbers):"];
    if (d.rel && typeof d.rel.aff === "number") {
      lines.push("- Affinity: " + d.rel.aff + "/100 (stage: " + stageOf(L, d.rel.aff) + ")");
      lines.push("- Current mood: " + (d.rel.mood || "-"));
      if (d.rel.note) lines.push("- Recent dynamic note: " + d.rel.note);
    } else lines.push("- Affinity: not formed yet (no bond data)");
    if (d.fs) {
      lines.push("- Known for: " + Math.max(1, Math.floor((Date.now() - d.fs) / 86400000)) + " days");
      lines.push("- Total messages exchanged: " + d.msgN);
    } else lines.push("- Just met (no first-seen data yet)");
    lines.push("- Character memories stored: " + (d.mems || []).length);
    if (d.sum && d.sum.text) lines.push("- Rolling summary: ~" + (d.sum.n || 0) + " msgs condensed" + (d.sum.ts ? ", last updated " + fmtWIB(Math.floor(d.sum.ts / 1000)) : ""));
    if ((d.chaps || []).length) lines.push("- Chapters titled: " + d.chaps.length + " (latest: \"" + (d.chaps[0].title || "-") + "\")");
    const r = d.rec || {};
    if (r.pvpW || r.pvpL || r.betW || r.betL) lines.push("- Game record vs user: PvP " + (r.pvpW || 0) + "-" + (r.pvpL || 0) + ", bets " + (r.betW || 0) + "-" + (r.betL || 0) + ", net " + ((r.net || 0) >= 0 ? "+" : "") + (r.net || 0) + " points");
    const kn = [];
    if (d.knobs && d.knobs.vibe) kn.push("vibe " + d.knobs.vibe);
    if (d.knobs && d.knobs.outfit) kn.push("outfit " + d.knobs.outfit);
    if (d.plot) kn.push("plot " + d.plot);
    if (d.ooc === "on") kn.push("OOC");
    if (kn.length) lines.push("- Active roleplay knobs: " + kn.join(", "));
    const msgs = [{ role: "system", content: SYS_AISTATS_WRAP }, { role: "user", content: lines.join("\n") + "\n\n" + langLine(await env.KV.get(LANG_KEY)) }];
    let out = "";
    for await (const dd of chatStream(env, msgs, 700)) out += dd;
    const txt = stripThink(out).trim();
    if (!txt) throw new Error("empty wrapped");
    await reply(env, chatId, mdTg(esc(txt)));
  } catch (_) {
    await env.KV.delete(wk).catch(() => {});
    await reply(env, chatId, L.aiWrapFail);
  }
}

export async function gameRecBump(env, game, winner, pts) {
  try {
    const card = await getActiveCard(env);
    if (!card) return;
    const k = AIST_REC_PREFIX + card.id;
    const r = (await getJSON(env, k, null)) || { pvpW: 0, pvpL: 0, betW: 0, betL: 0, net: 0 };
    if (game === "pvp") {
      if (winner === "U") { r.pvpW = (r.pvpW || 0) + 1; r.net = (r.net || 0) + pts; }
      else if (winner === "C") { r.pvpL = (r.pvpL || 0) + 1; r.net = (r.net || 0) - pts; }
    } else if (game === "bet") {
      if (winner === "U") r.betW = (r.betW || 0) + 1; else r.betL = (r.betL || 0) + 1;
      r.net = (r.net || 0) + pts;
    }
    await putJSON(env, k, r);
  } catch (_) {}
}
