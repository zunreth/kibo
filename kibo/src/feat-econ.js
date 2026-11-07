import { getJSON, putJSON, tg, reply, notify, esc, mdTg } from './base.js';
import { uiLang, UI_SEP } from './ui.js';
import { addPts, rollLoot, lootLine, remindMsg, XP_PER_LEVEL } from './feat-remind.js';
import { getActiveCard } from './feat-chars.js';
import { vaultSave, vaultCopyToChannel, vaultMedia } from './feat-vault.js';
import { WIB, REL_PREFIX, CHAR_KEY, DIVE_STAT_KEY, GAME_SONG_STAT_KEY, GAME_FAN_STAT_KEY, UI_LANG_KEY, EC_INV_KEY, EC_GACHA_KEY, EC_CHARM_KEY, EC_BADGE_KEY, FILE_INDEX_KEY, FILE_MAX, VAULT_CHAT_KEY, SHIELD_MAX, SHOP_ITEMS, CHARM_EMOJI, CHARM_EPIC, CHARM_LEG, GACHA_ODDS, GACHA_COST, GACHA_COST5, GACHA_PITY, GACHA_JACKPOT, GACHA_REFUND, DIVE_GEM_PTS } from './consts.js';

async function editView(env, chatId, mid, view) {
  if (mid) {
    const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
    if (j && j.ok) return j;
    if (j && String(j.description || "").includes("message is not modified")) return j;
  }
  return tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

const nm = (it, lang) => it[lang === "id" ? "nid" : "nen"];
async function langOf(env) { return (await env.KV.get(UI_LANG_KEY)) === "id" ? "id" : "en"; }

async function shopView(env, L) {
  const q = await getJSON(env, "quest", {});
  const lang = await langOf(env);
  const fxOf = it => (lang === "id" ? it.fx_id : it.fx_en);
  const lineOf = it => it.e + " " + nm(it, lang) + " \u2014 " + it.p + " pts \u00b7 " + fxOf(it);
  const cat = L.shpSecG + "\n" + SHOP_ITEMS.filter(it => it.a).map(lineOf).join("\n") + "\n\n" + L.shpSecU + "\n" + SHOP_ITEMS.filter(it => !it.a).map(lineOf).join("\n");
  const rows = SHOP_ITEMS.map(it => [{ text: it.e + " " + nm(it, lang) + " \u2014 " + it.p, callback_data: "ec:buy:" + it.k }]);
  rows.push([{ text: L.shpInv, callback_data: "ec:inv" }, { text: L.shpGacha, callback_data: "ec:gacha" }]);
  rows.push([{ text: L.back, callback_data: "ec:hub" }, { text: L.home, callback_data: "menu" }]);
  return { text: L.shpTitle + L.shpWallet(q.points || 0) + UI_SEP + cat + L.shpHint, markup: { inline_keyboard: rows } };
}

export async function handleShop(env, chatId, mid) {
  const L = await uiLang(env);
  return editView(env, chatId, mid, await shopView(env, L));
}

export async function shopBuy(env, chatId, mid, item) {
  const L = await uiLang(env);
  const it = SHOP_ITEMS.find(x => x.k === item);
  if (!it) return;
  const q = await getJSON(env, "quest", {});
  if ((q.points || 0) < it.p) { await notify(env, chatId, L.shpPoor(it.p, q.points || 0)); return editView(env, chatId, mid, await shopView(env, L)); }
  await addPts(env, -it.p);
  const inv = await getJSON(env, EC_INV_KEY + chatId, {});
  inv[it.k] = (inv[it.k] || 0) + 1; inv.tb = (inv.tb || 0) + 1;
  await putJSON(env, EC_INV_KEY + chatId, inv);
  await notify(env, chatId, L.shpBought(it.e, nm(it, await langOf(env)), it.p, (q.points || 0) - it.p));
  await editView(env, chatId, mid, await shopView(env, L));
  await badgeCheck(env, chatId);
}

async function invView(env, L, cid) {
  const lang = await langOf(env);
  const icid = cid || (await chatIdOf(env));
  const [inv, q] = await Promise.all([getJSON(env, EC_INV_KEY + icid, {}), getJSON(env, "quest", {})]);
  const owned = SHOP_ITEMS.filter(it => (inv[it.k] || 0) > 0);
  const lines = owned.map(it => it.e + " " + nm(it, lang) + " \u00d7" + inv[it.k] + " \u2014 " + (lang === "id" ? it.fx_id : it.fx_en)).join("\n");
  const rows = owned.map(it => [{ text: L.invUse(it.e, nm(it, lang), inv[it.k]), callback_data: "ec:use:" + it.k }]);
  rows.push([{ text: L.shpShop, callback_data: "ec:shop" }, { text: L.shpGacha, callback_data: "ec:gacha" }]);
  rows.push([{ text: L.back, callback_data: "ec:hub" }, { text: L.home, callback_data: "menu" }]);
  return { text: L.invTitle + L.shpWallet(q.points || 0) + UI_SEP + (owned.length ? lines : L.invEmpty), markup: { inline_keyboard: rows } };
}

async function chatIdOf(env) { return (await env.KV.get("owner_chat")) || "0"; }
function chatIdArg(chatId) { return String(chatId || ""); }

export async function handleInv(env, chatId, mid) {
  const L = await uiLang(env);
  return editView(env, chatId, mid, await invView(env, L, chatIdArg(chatId)));
}

export async function invUse(env, chatId, mid, item) {
  const L = await uiLang(env);
  const it = SHOP_ITEMS.find(x => x.k === item);
  if (!it) return;
  const key = EC_INV_KEY + chatIdArg(chatId);
  const inv = await getJSON(env, key, {});
  if ((inv[it.k] || 0) <= 0) return editView(env, chatId, mid, await invView(env, L, chatIdArg(chatId)));
  if (it.a) {
    const card = await getActiveCard(env);
    if (!card) { await notify(env, chatId, L.invNoChar); return; }
    const rel = (await getJSON(env, REL_PREFIX + card.id, null)) || { aff: 50 };
    rel.aff = Math.min(100, (rel.aff || 50) + it.a); rel.ts = Date.now();
    await putJSON(env, REL_PREFIX + card.id, rel);
    inv[it.k]--; inv.tu = (inv.tu || 0) + 1;
    await putJSON(env, key, inv);
    await notify(env, chatId, L.invUsed(it.e, card.name, it.a, rel.aff));
    try { const ai = await remindMsg(env, 0, "the user just gave you a gift: " + nm(it, await langOf(env)) + " (bond +" + it.a + ")", 0, "gift"); if (ai) await reply(env, chatId, mdTg(esc(ai))); } catch (_) {}
    await badgeCheck(env, chatId);
    return editView(env, chatId, mid, await invView(env, L, chatIdArg(chatId)));
  }
  if (it.k === "shield") {
    const q = await getJSON(env, "quest", {});
    if ((q.shields || 0) >= SHIELD_MAX) { await notify(env, chatId, L.invShMax(SHIELD_MAX)); return; }
    q.shields = (q.shields || 0) + 1;
    await putJSON(env, "quest", q);
    inv[it.k]--; await putJSON(env, key, inv);
    await notify(env, chatId, L.invShOk(q.shields, SHIELD_MAX));
    return editView(env, chatId, mid, await invView(env, L, chatIdArg(chatId)));
  }
  if (it.k === "crate") {
    const loot = rollLoot();
    inv[it.k]--; await putJSON(env, key, inv);
    if (loot.tier !== "none") await addPts(env, loot.amt);
    const q = await getJSON(env, "quest", {});
    await notify(env, chatId, L.invCrate(lootLine(loot, L), q.points || 0));
    await editView(env, chatId, mid, await invView(env, L, chatIdArg(chatId)));
    await badgeCheck(env, chatId);
    return;
  }
}

function rollOne() {
  const r = Math.random();
  if (r < GACHA_ODDS.l) return { tier: "legend", charm: CHARM_LEG[Math.floor(Math.random() * CHARM_LEG.length)], pts: GACHA_JACKPOT };
  if (r < GACHA_ODDS.l + GACHA_ODDS.e) return { tier: "epic", charm: CHARM_EPIC[Math.floor(Math.random() * CHARM_EPIC.length)] };
  if (r < GACHA_ODDS.l + GACHA_ODDS.e + GACHA_ODDS.r) return { tier: "rare", item: Math.random() < 0.5 ? "bouquet" : "crate" };
  const s = Math.random();
  if (s < 0.4) return { tier: "common", item: "snack" };
  if (s < 0.7) return { tier: "common", item: "shield" };
  return { tier: "common", pts: GACHA_REFUND };
}

async function gachaView(env, L) {
  const cid = await chatIdOf(env);
  const [q, g] = await Promise.all([getJSON(env, "quest", {}), getJSON(env, EC_GACHA_KEY + cid, {})]);
  return { text: L.gTitle + L.gHead(q.points || 0, g.pity || 0, GACHA_PITY, g.leg || 0) + UI_SEP + L.gOdds, markup: { inline_keyboard: [
    [{ text: L.gPull(GACHA_COST), callback_data: "ec:pull" }],
    [{ text: L.gPull5(GACHA_COST5), callback_data: "ec:pull5" }],
    [{ text: L.gCharms, callback_data: "ec:chm" }, { text: L.shpInv, callback_data: "ec:inv" }],
    [{ text: L.shpShop, callback_data: "ec:shop" }],
    [{ text: L.back, callback_data: "ec:hub" }, { text: L.home, callback_data: "menu" }]
 ] } };
}

export async function handleGacha(env, chatId, mid) {
  const L = await uiLang(env);
  return editView(env, chatId, mid, await gachaView(env, L));
}

export async function gachaPull(env, chatId, mid, times) {
  const L = await uiLang(env);
  const lang = await langOf(env);
  const cost = times >= 5 ? GACHA_COST5 : GACHA_COST;
  const q = await getJSON(env, "quest", {});
  if ((q.points || 0) < cost) { await notify(env, chatId, L.gPoor(cost, q.points || 0)); return editView(env, chatId, mid, await gachaView(env, L)); }
  await addPts(env, -cost);
  const key = chatIdArg(chatId);
  const g = await getJSON(env, EC_GACHA_KEY + key, {});
  const inv = await getJSON(env, EC_INV_KEY + key, {});
  const ch = await getJSON(env, EC_CHARM_KEY + key, { owned: {}, eq: [] });
  if (!ch.owned) ch.owned = {}; if (!ch.eq) ch.eq = [];
  const cg = {}, grp = {}; let ref = 0;
  for (let i = 0; i < times; i++) {
    g.pity = (g.pity || 0) + 1;
    let roll = rollOne();
    if ((roll.tier === "common" || roll.tier === "rare") && g.pity >= GACHA_PITY) roll = { tier: "epic", charm: CHARM_EPIC[Math.floor(Math.random() * CHARM_EPIC.length)] };
    if (roll.charm) {
      ch.owned[roll.charm] = (ch.owned[roll.charm] || 0) + 1;
      if (ch.eq.length < 3 && !ch.eq.includes(roll.charm)) ch.eq.push(roll.charm);
      if (roll.tier === "legend") { g.leg = (g.leg || 0) + 1; await addPts(env, GACHA_JACKPOT); cg["l" + roll.charm] = (cg["l" + roll.charm] || 0) + 1; } else cg["e" + roll.charm] = (cg["e" + roll.charm] || 0) + 1;
    } else {
      if (roll.item) { inv[roll.item] = (inv[roll.item] || 0) + 1; const gk = roll.tier + ":" + roll.item; grp[gk] = (grp[gk] || 0) + 1; }
      else if (roll.pts) { await addPts(env, roll.pts); ref += roll.pts; }
    }
    if (roll.tier === "epic" || roll.tier === "legend") g.pity = 0;
  }
  const charmLines = Object.keys(cg).map(k => { const e = CHARM_EMOJI[k.slice(1)] || k.slice(1); return (k[0] === "l" ? L.gLeg(e) : L.gEpi(e)) + (cg[k] > 1 ? " \u00d7" + cg[k] : ""); });
  const iT = { common: "\u25ab\uFE0F", rare: "\u{1F539}" };
  const itemLines = Object.keys(grp).map(gk => { const it = SHOP_ITEMS.find(x => x.k === gk.slice(gk.indexOf(":") + 1)); return (iT[gk.slice(0, gk.indexOf(":"))] || "\u25ab\uFE0F") + " " + it.e + " " + nm(it, lang) + " \u00d7" + grp[gk]; });
  g.n = (g.n || 0) + times;
  await putJSON(env, EC_GACHA_KEY + key, g);
  await putJSON(env, EC_INV_KEY + key, inv);
  await putJSON(env, EC_CHARM_KEY + key, ch);
  await notify(env, chatId, L.gResX(times, charmLines, itemLines, ref, g.pity || 0));
  await editView(env, chatId, mid, await gachaView(env, L));
  await badgeCheck(env, chatId);
}

async function charmView(env, L) {
  const ch = await getJSON(env, EC_CHARM_KEY + (await chatIdOf(env)), { owned: {}, eq: [] });
  const owned = Object.keys(ch.owned || {});
  const eq = ch.eq || [];
  const rows = owned.map(k => [{ text: eq.includes(k) ? L.chBtnOn(CHARM_EMOJI[k] || k) : L.chBtnOff(CHARM_EMOJI[k] || k, ch.owned[k]), callback_data: "ec:cheq:" + k }]);
  rows.push([{ text: L.shpGacha, callback_data: "ec:gacha" }, { text: L.back, callback_data: "ec:hub" }, { text: L.home, callback_data: "menu" }]);
  const rar = k => (CHARM_LEG.includes(k) ? "\u{1F451} " : "\u{1F539} ") + (CHARM_EMOJI[k] || k);
  const lines = owned.map(k => rar(k) + " \u00d7" + ch.owned[k]).join(" \u00b7 ");
  return { text: L.chTitle + UI_SEP + (owned.length ? lines + L.chEqLine(eq.map(k => CHARM_EMOJI[k] || "").join(" "), eq.length) : L.chEmpty), markup: { inline_keyboard: rows } };
}

export async function handleCharms(env, chatId, mid) {
  const L = await uiLang(env);
  return editView(env, chatId, mid, await charmView(env, L));
}

export async function charmEq(env, chatId, mid, k) {
  const L = await uiLang(env);
  const key = EC_CHARM_KEY + chatIdArg(chatId);
  const ch = await getJSON(env, key, { owned: {}, eq: [] });
  if (!ch.owned || !ch.owned[k]) return editView(env, chatId, mid, await charmView(env, L));
  ch.eq = ch.eq || [];
  if (ch.eq.includes(k)) ch.eq = ch.eq.filter(x => x !== k);
  else if (ch.eq.length >= 3) { await notify(env, chatId, L.chFull(3)); return editView(env, chatId, mid, await charmView(env, L)); }
  else ch.eq.push(k);
  await putJSON(env, key, ch);
  return editView(env, chatId, mid, await charmView(env, L));
}

async function badgeStats(env, chatId) {
  const cid = chatIdArg(chatId) || (await chatIdOf(env));
  const card = await getActiveCard(env);
  const [q, exp, dive, gs, gf, inv, g, ch, files, chars] = await Promise.all([
    getJSON(env, "quest", {}), getJSON(env, "exp", {}), getJSON(env, DIVE_STAT_KEY + cid, null),
    getJSON(env, GAME_SONG_STAT_KEY + cid, null), getJSON(env, GAME_FAN_STAT_KEY + cid, null),
    getJSON(env, EC_INV_KEY + cid, {}), getJSON(env, EC_GACHA_KEY + cid, {}), getJSON(env, EC_CHARM_KEY + cid, {}),
    getJSON(env, FILE_INDEX_KEY, []), getJSON(env, CHAR_KEY, [])
  ]);
  const rel = card ? await getJSON(env, REL_PREFIX + card.id, null) : null;
  return { q, exp, dive, gs, gf, inv, g, ch, files, chars, rel, lv: Math.floor((exp.xp || 0) / XP_PER_LEVEL) + 1 };
}

export const BADGES = [
  { id: "pull1", e: "\u{1F381}", nid: "Gacha Pertama", ned: "First Pull", did: "coba /gacha sekali", den: "try /gacha once", chk: s => (s.g.n || 0) >= 1 },
  { id: "pull25", e: "\u{1F3B0}", nid: "High Roller", ned: "High Roller", did: "25 pull total", den: "25 pulls total", chk: s => (s.g.n || 0) >= 25 },
  { id: "leg1", e: "\u{1F451}", nid: "Rasa Legend", ned: "Legend Tasted", did: "dapat charm legend", den: "get a legend charm", chk: s => (s.g.leg || 0) >= 1 },
  { id: "buy10", e: "\u{1F6CD}\uFE0F", nid: "Shopaholic", ned: "Shopaholic", did: "beli 10 item di /shop", den: "buy 10 shop items", chk: s => (s.inv.tb || 0) >= 10 },
  { id: "gift5", e: "\u{1F490}", nid: "Tukang Kado", ned: "Gift Giver", did: "pakai 5 gift buat char", den: "use 5 gifts on chars", chk: s => (s.inv.tu || 0) >= 5 },
  { id: "aff60", e: "\u{1F463}", nid: "Dekat", ned: "Getting Close", did: "bond char aktif 60+", den: "active char bond 60+", chk: s => s.rel && (s.rel.aff || 0) >= 60 },
  { id: "aff90", e: "\u{1F48D}", nid: "Soulmate", ned: "Soulmate", did: "bond char aktif 90+", den: "active char bond 90+", chk: s => s.rel && (s.rel.aff || 0) >= 90 },
  { id: "w500", e: "\u{1F4B0}", nid: "Sultan 500", ned: "500 Club", did: "dompet 500 poin", den: "wallet 500 pts", chk: s => (s.q.points || 0) >= 500 },
  { id: "w2000", e: "\u{1F3E6}", nid: "Sultan 2000", ned: "2000 Club", did: "dompet 2000 poin", den: "wallet 2000 pts", chk: s => (s.q.points || 0) >= 2000 },
  { id: "lv5", e: "\u2B50", nid: "Level 5", ned: "Level 5", did: "capai level 5", den: "reach level 5", chk: s => s.lv >= 5 },
  { id: "lv10", e: "\u{1F31F}", nid: "Level 10", ned: "Level 10", did: "capai level 10", den: "reach level 10", chk: s => s.lv >= 10 },
  { id: "qstreak7", e: "\u{1F525}", nid: "Streak Quest 7", ned: "Quest Streak 7", did: "streak quest 7 hari", den: "7-day quest streak", chk: s => (s.q.streak || 0) >= 7 },
  { id: "dive10", e: "\u{1F30A}", nid: "Penyelam", ned: "Diver", did: "10 sesi /dive", den: "10 /dive sessions", chk: s => s.dive && (s.dive.plays || 0) >= 10 },
  { id: "dstreak3", e: "\u{1F420}", nid: "Arus Dalam", ned: "Deep Current", did: "streak dive 3 hari", den: "3-day dive streak", chk: s => s.dive && (s.dive.streak || 0) >= 3 },
  { id: "gem", e: "\u{1F48E}", nid: "the Krillion", ned: "the Krillion", did: "tangkap gem 💎 di /dive", den: "catch the 💎 gem in /dive", chk: s => s.dive && s.dive.best && (s.dive.best.p || 0) >= DIVE_GEM_PTS },
  { id: "song5", e: "\u{1F3A7}", nid: "Telinga Emas", ned: "Golden Ear", did: "streak tebak lagu 5", den: "5 song quiz streak", chk: s => s.gs && (s.gs.s || 0) >= 5 },
  { id: "fan1", e: "\u{1F3A4}", nid: "Real Fan", ned: "Real Fan", did: "menang ronde Real Fan", den: "win a Real Fan round", chk: s => s.gf && (s.gf.s || 0) >= 1 },
  { id: "vault10", e: "\u{1F4DA}", nid: "Arsiparis", ned: "Archivist", did: "10 file di vault", den: "10 files in vault", chk: s => s.files.length >= 10 },
  { id: "bm5", e: "\u{1F516}", nid: "Bookmarker", ned: "Bookmarker", did: "5 bookmark /bm", den: "5 /bm bookmarks", chk: s => s.files.filter(f => f.kind === "note").length >= 5 },
  { id: "charm4", e: "\u{1F9D7}", nid: "Kolektor Charm", ned: "Charm Collector", did: "punya 4 charm beda", den: "own 4 distinct charms", chk: s => Object.keys((s.ch.owned) || {}).length >= 4 },
  { id: "shields2", e: "\u{1F6E1}\uFE0F", nid: "Berlapis", ned: "Double Insurance", did: "2 shield siap", den: "hold 2 shields", chk: s => (s.inv.shield || 0) + (s.q.shields || 0) >= 2 },
  { id: "chars3", e: "\u{1F0CF}", nid: "Harem Council", ned: "Card Collector", did: "3 char atau lebih", den: "3+ chars", chk: s => s.chars.length >= 3 }
];

function todayWIB() { return new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10); }

export async function badgeCheck(env, chatId) {
  const L = await uiLang(env);
  const lang = await langOf(env);
  const cid = chatIdArg(chatId);
  if (!cid) return [];
  const st = await badgeStats(env, cid);
  const cur = await getJSON(env, EC_BADGE_KEY + cid, {});
  const got = [];
  for (const b of BADGES) if (!cur[b.id] && b.chk(st)) { cur[b.id] = todayWIB(); got.push(b); }
  if (got.length) {
    await putJSON(env, EC_BADGE_KEY + cid, cur);
    for (const b of got.slice(0, 3)) await notify(env, chatId, L.achNew(b.e, b[lang === "id" ? "nid" : "ned"]));
  }
  return got;
}

export async function handleAch(env, chatId, mid) {
  const L = await uiLang(env);
  const lang = await langOf(env);
  await badgeCheck(env, chatId);
  const cid = chatIdArg(chatId);
  const cur = await getJSON(env, EC_BADGE_KEY + cid, {});
  const lines = BADGES.map(b => (cur[b.id] ? "\u2705 " : "\ud83d\udd12 ") + b.e + " " + (cur[b.id] ? "<b>" + b[lang === "id" ? "nid" : "ned"] + "</b>" : b[lang === "id" ? "nid" : "ned"]) + " \u2014 " + b[lang === "id" ? "did" : "den"] + (cur[b.id] ? " \u00b7 " + cur[b.id] : ""));
  return editView(env, chatId, mid, { text: L.achTitle + L.achCount(Object.keys(cur).length, BADGES.length) + L.achLegend + UI_SEP + lines.join("\n"), markup: { inline_keyboard: [[{ text: L.back, callback_data: "nav:profile" }, { text: L.home, callback_data: "menu" }]] } });
}

export async function bmSave(env, msg, chatId, note) {
  const L = await uiLang(env);
  const src = msg.reply_to_message;
  if (!src) { await reply(env, chatId, L.bmHow); return; }
  note = String(note || "").replace(/[<>]/g, "").trim().slice(0, 60);
  const m = vaultMedia(src);
  if (m) return vaultSave(env, msg, chatId, note);
  const text = String(src.text || src.caption || "").slice(0, 2000);
  if (!text) { await reply(env, chatId, L.bmEmpty); return; }
  const v = await getJSON(env, VAULT_CHAT_KEY, null);
  const list = await getJSON(env, FILE_INDEX_KEY, []);
  if (list.length >= FILE_MAX) { await reply(env, chatId, L.vaultFull(FILE_MAX)); return; }
  const name = note || ("bm-" + new Date(Date.now() + WIB * 1000).toISOString().replace(/[^0-9]/g, "").slice(2, 12));
  const id = list.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
  list.unshift({ id: id, name: name, kind: "note", text: text + (note ? "\n\u2014 " + note : ""), size: text.length, ts: Date.now() });
  await putJSON(env, FILE_INDEX_KEY, list);
  const archived = await vaultCopyToChannel(env, v, chatId, src.message_id, note ? "\u{1F516} " + note : undefined);
  const savedMsg = L.bmSaved(id, name, archived);
  if (archived) await notify(env, chatId, savedMsg); else await reply(env, chatId, savedMsg);
  await badgeCheck(env, chatId);
}

async function econHubView(env, L) {
  const cid = await chatIdOf(env);
  const [q, g, ch, bd, inv] = await Promise.all([
    getJSON(env, "quest", {}), getJSON(env, EC_GACHA_KEY + cid, {}),
    getJSON(env, EC_CHARM_KEY + cid, {}), getJSON(env, EC_BADGE_KEY + cid, {}),
    getJSON(env, EC_INV_KEY + cid, {})
  ]);
  const eq = (ch.eq || []).map(k => CHARM_EMOJI[k] || "").filter(Boolean).join(" ");
  const owned = Object.keys(ch.owned || {}).length;
  const invKinds = Object.keys(inv || {}).filter(k => k !== "tb" && k !== "tu" && (inv[k] || 0) > 0);
  const invCount = invKinds.reduce((s, k) => s + (inv[k] || 0), 0);
  return { text: L.ehubTitle +
    L.gHead(q.points || 0, g.pity || 0, GACHA_PITY, g.leg || 0) +
    L.ehubPity(GACHA_COST, GACHA_COST5) + "\n" +
    L.ehubPulls(g.n || 0) + "\n" +
    L.ehubCharmOwn(eq, (ch.eq || []).length, owned) + "\n" +
    L.ehubInv2(invCount, invKinds.length) + UI_SEP + L.ehubHint,
    markup: { inline_keyboard: [
      [{ text: L.shpShop, callback_data: "ec:shop" }],
      [{ text: L.shpGacha, callback_data: "ec:gacha" }],
      [{ text: L.shpInv, callback_data: "ec:inv" }],
      [{ text: L.home, callback_data: "menu" }]
    ] } };
}

export async function handleHub(env, chatId, mid) {
  const L = await uiLang(env);
  return editView(env, chatId, mid, await econHubView(env, L));
}

export async function profEconLine(env, L) {
  const cid = await chatIdOf(env);
  if (!cid || cid === "0") return "";
  const [ch, bd] = await Promise.all([getJSON(env, EC_CHARM_KEY + cid, {}), getJSON(env, EC_BADGE_KEY + cid, {})]);
  const eq = (ch.eq || []).map(k => CHARM_EMOJI[k] || "").filter(Boolean).join(" ");
  const nb = Object.keys(bd || {}).length;
  if (!eq && !nb) return "";
  return (eq ? "\n" + L.profCharm(eq) : "") + (nb ? " \u2022 " + L.profBadge(nb) : "");
}
