import { tg, notify, getJSON, putJSON, esc, reply, mdTg, scheduleDelete } from "./base.js";
import { uiLang, UI_SEP } from "./ui.js";
import { GAME_WORD_KEY, GAME_QUIZ_KEY, GAME_PVP_KEY, WORD_REWARDS, QUIZ_PTS, QUIZ_HIST_KEY, QUIZ_HIST_MAX, WIB, BET_MIN, BET_MAX, BET_RAKE, PVP_STAKE, GAME_LYRIC_KEY, LYRIC_PTS, LYRIC_POOL_MAX, GAME_SONG_KEY, GAME_FAN_KEY, SONG_PTS, SONG_FAN_PTS, SONG_TRY_MAX, GAME_SONG_STAT_KEY, GAME_FAN_STAT_KEY, SONG_STREAK_CAP, FAN_MIN_SONGS, FAN_MENU_MAX, LFM_USER_KEY, LFM_USER_DEFAULT, UA, DIVE_STATE_KEY, DIVE_PRAC_KEY, GAME_IDLE_REG, GAME_IDLE_MS } from "./consts.js";
import { askSet, askClear } from "./ask.js";
import { questDay, addPts, remindMsg } from "./feat-remind.js";
import { chatStream } from "./feat-personal.js";
import { stripThink } from "./ai.js";
import { gameRecBump } from "./feat-aistats.js";

export const WORDS = [
  "agama", "aktif", "ambil", "badan", "bakar", "balik", "barat", "batas", "bawah", "bayar",
  "bayam", "bedak", "bekas", "belah", "belas", "benda", "beras", "besar", "beton", "bisik",
  "bocor", "bonus", "bukan", "bukit", "bulan", "bunga", "bunyi", "cabai", "cakap", "candi",
  "ceria", "cicak", "cinta", "denda", "deras", "desak", "detak", "dinas", "duduk", "dunia",
  "dusun", "fakta", "gadis", "gajah", "garis", "gatal", "gawat", "gelap", "gemuk", "genit",
  "gigit", "gosok", "halus", "hemat", "hapus", "harap", "harum", "heboh", "hijau", "hitam",
  "hutan", "idola", "iklan", "imbas", "indra", "ingat", "injak", "jabat", "jalan", "jaman",
  "janji", "jatuh", "jawab", "jenis", "jepit", "jeruk", "judul", "jumpa", "kabar", "kabel",
  "kadar", "kakak", "kalau", "kanan", "kapal", "karet", "kartu", "kasur", "kawan", "kayak",
  "kejar", "kelas", "kenal", "ketat", "keras", "kerja", "kilau", "kirim", "kotor", "kukis",
  "kulit", "kunci", "kurus", "lahir", "lampu", "lapar", "latih", "lawan", "lemah", "lensa",
  "lepas", "lidah", "lipat", "lisan", "mabuk", "mahal", "malam", "malas", "manis", "masak",
  "masuk", "mawar", "merah", "mesin", "milik", "minat", "minum", "mirip", "mobil", "motor",
  "mudah", "mulai", "nanas", "nawar", "niaga", "nikah", "nilai", "nomor", "ombak", "omong",
  "opini", "orbit", "organ", "orang", "pacul", "padat", "pagar", "paham", "paket", "panas",
  "panen", "papan", "paras", "pasar", "pasir", "patah", "patut", "pedas", "pekat", "perah",
  "pergi", "petir", "pikat", "pilih", "pirus", "pisau", "pohon", "pulsa", "punya", "rabun",
  "racik", "ragam", "rajin", "rakit", "ramai", "rapat", "rasio", "ratus", "rayap", "razia",
  "rebah", "rebus", "riang", "rindu", "roboh", "ruang", "rujak", "rumah", "sabar", "sabun",
  "sadar", "sajak", "sakit", "salam", "salju", "saung", "sawah", "seger", "sejuk", "selai",
  "semut", "senja", "sulam", "sepak", "seret", "serta", "sesal", "setia", "siaga", "sifat",
  "siapa", "singa", "siram", "sisir", "situs", "siung", "sogok", "solar", "sosok", "suami",
  "subur", "sukar", "sulap", "sulit", "sumur", "surat", "susun", "tabur", "tahun", "tajam",
  "takut", "taman", "tanam", "tanda", "tapak", "tarik", "tawar", "tebal", "terik", "tidur",
  "tiang", "tikus", "tirai", "tubuh", "tujuh", "tukar", "tulis", "tunas", "unjuk", "utama",
  "waktu", "walau", "wangi", "warna", "warta", "yakin", "zaman", "zebra"
];

export function gameWord(dayNum) { return WORDS[dayNum % WORDS.length].toUpperCase(); }
export function pvpWord(dayNum) {
  const w = WORDS[(dayNum + 97) % WORDS.length].toUpperCase();
  return w === gameWord(dayNum) ? WORDS[(dayNum + 98) % WORDS.length].toUpperCase() : w;
}
const pracWord = not => {
  let w = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
  while (not && w === not) w = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
  return w;
};
const dayNumOf = nowSec => Math.floor((nowSec + WIB) / 86400);
const todayDay = () => questDay(Math.floor(Date.now() / 1000));

function gridRow(g, target) {
  const t = target.split(""), r = Array(5).fill("⬛");
  for (let i = 0; i < 5; i++) if (g[i] === t[i]) { r[i] = "🟩"; t[i] = null; }
  for (let i = 0; i < 5; i++) if (r[i] === "⬛") { const j = t.indexOf(g[i]); if (j >= 0) { r[i] = "🟨"; t[j] = null; } }
  return r.join("");
}

const homeRow = L => [[{ text: L.back, callback_data: "g:back" }, { text: L.home, callback_data: "g:home" }]];

function gameView(st, L) {
  const rows = st.g.map(w => gridRow(w, st.t) + " <code>" + w + "</code>");
  let body;
  if (st.done === 1) body = L.gmWin(st.t, st.p ? 0 : WORD_REWARDS[st.g.length - 1]);
  else if (st.done === 2) body = st.gave ? L.gmStopd(st.t) : L.gmLose(st.t);
  else body = L.gmLeft(6 - st.g.length) + "\n" + L.gmHow;
  return {
    text: L.gmWordHead + "\n" + (st.p ? L.gmPracNote + "\n" : "") + (rows.length ? rows.join("\n") + "\n\n" : "") + body,
    markup: { inline_keyboard: st.done ? [[{ text: L.gmPrac, callback_data: "g:word" }]].concat(homeRow(L)) : [[{ text: L.gmStopB, callback_data: "g:stop" }]].concat(homeRow(L)) }
  };
}

async function editView(env, chatId, mid, view) {
  if (mid) {
    const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
    if (j && j.ok) return j;
    if (j && String(j.description || "").includes("message is not modified")) return j;
  }
  return tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export async function gameMenu(env, chatId, mid) {
  const L = await uiLang(env);
  const day = todayDay();
  const q = await getJSON(env, "quest", {});
  const stat = s => (!s || s.d !== day) ? "" : (s.done ? L.gmStDone : L.gmStActive);
  const stTag = s => (s && s.s > 1) ? " 🔥" + s.s : "";
  const ws = await getJSON(env, GAME_WORD_KEY + chatId, null);
  const zs = await getJSON(env, GAME_QUIZ_KEY + chatId, null);
  const ps = await getJSON(env, GAME_PVP_KEY + chatId, null);
  const ys = await getJSON(env, GAME_LYRIC_KEY + chatId, null);
  const ds = await getJSON(env, DIVE_STATE_KEY + chatId, null);
  const gs = await getJSON(env, GAME_SONG_KEY + chatId, null);
  const gf = await getJSON(env, GAME_FAN_KEY + chatId, null);
  const gst = await getJSON(env, GAME_SONG_STAT_KEY + chatId, null);
  const gfs = await getJSON(env, GAME_FAN_STAT_KEY + chatId, null);
  const text = L.gmTitle + "\n" + L.gmWallet(q.points || 0) + UI_SEP +
    "🔤 <b>" + L.gmWordName + "</b> — " + L.gmWordDesc + "\n" +
    "🧠 <b>" + L.gmQuizName + "</b> — " + L.gmQuizDesc + "\n" +
    "⚔️ <b>" + L.gmPvpName + "</b> — " + L.gmPvpDesc + "\n" +
    "🎵 <b>" + L.gmLyricName + "</b> — " + L.gmLyricDesc + "\n" +
    "🎧 <b>" + L.gmSongName + "</b> — " + L.gmSongDesc + "\n" +
    "🎤 <b>" + L.gmFanName + "</b> — " + L.gmFanDesc + "\n" +
    "🌊 <b>" + L.diveName + "</b> — " + L.diveDesc;
  const markup = { inline_keyboard: [
    [{ text: L.gmWordB(stat(ws)), callback_data: "g:word" }],
    [{ text: L.gmQuizB(stat(zs)), callback_data: "g:quiz" }],
    [{ text: L.gmPvpB(stat(ps)), callback_data: "g:pvp" }],
    [{ text: L.gmLyricB(stat(ys)), callback_data: "g:lyric" }],
    [{ text: L.gmSongB(stat(gs)) + stTag(gst), callback_data: "g:song" }],
    [{ text: L.gmFanB(stat(gf)), callback_data: "g:sfan" }],
    [{ text: L.gmDiveB(stat(ds)), callback_data: "g:dive" }],
    [{ text: L.home, callback_data: "menu" }]
  ] };
  return editView(env, chatId, mid, { text, markup });
}

export async function gameWordStart(env, chatId, mid) {
  const L = await uiLang(env);
  const day = todayDay();
  let st = await getJSON(env, GAME_WORD_KEY + chatId, null);
  if (st && st.d === day && st.done !== 0) {
    st = { d: day, t: pracWord(st.t), g: [], done: 0, p: 1, mid: mid || 0 };
    await putJSON(env, GAME_WORD_KEY + chatId, st);
  } else if (!st || st.d !== day) {
    st = { d: day, t: gameWord(dayNumOf(Math.floor(Date.now() / 1000))), g: [], done: 0, mid: mid || 0 };
    await putJSON(env, GAME_WORD_KEY + chatId, st);
  } else if (mid && st.mid !== mid) { st.mid = mid; await putJSON(env, GAME_WORD_KEY + chatId, st); }
  return editView(env, chatId, mid || st.mid, gameView(st, L));
}

export async function gameGuess(env, chatId, raw) {
  const L = await uiLang(env);
  const w = String(raw || "").trim().toUpperCase();
  const st = await getJSON(env, GAME_WORD_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done !== 0) { await notify(env, chatId, L.gmNoActive); return; }
  if (!/^[A-Z]{5}$/.test(w)) { await notify(env, chatId, L.gmNeed5); return; }
  if (st.g.includes(w)) { await notify(env, chatId, L.gmDup(w)); return; }
  st.g.push(w);
  let pts = 0;
  if (w === st.t) { st.done = 1; pts = st.p ? 0 : WORD_REWARDS[st.g.length - 1]; }
  else if (st.g.length >= 6) st.done = 2;
  await putJSON(env, GAME_WORD_KEY + chatId, st);
  if (pts) await addPts(env, pts);
  return editView(env, chatId, st.mid, gameView(st, L));
}

export async function gameStop(env, chatId, mid) {
  const st = await getJSON(env, GAME_WORD_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done !== 0) return gameMenu(env, chatId, mid);
  st.done = 2; st.gave = 1;
  await putJSON(env, GAME_WORD_KEY + chatId, st);
  const L = await uiLang(env);
  return editView(env, chatId, mid, gameView(st, L));
}

export async function gameIntercept(env, msg, chatId, text) {
  const t = String(text || "").trim();
  if (!/^[A-Za-z]{5}$/.test(t)) return null;
  const pv = await getJSON(env, GAME_PVP_KEY + chatId, null);
  if (pv && pv.d === todayDay() && pv.done !== 1) {
    await pvpGuess(env, chatId, pv.mid, t);
    return true;
  }
  const st = await getJSON(env, GAME_WORD_KEY + chatId, null);
  if (!st || st.done !== 0 || st.d !== todayDay()) return null;
  await gameGuess(env, chatId, t);
  return true;
}

export function pvpCandidates(target, guesses) {
  const obs = guesses.map(g => gridRow(g, target));
  return WORDS.map(w => w.toUpperCase()).filter(w => {
    if (guesses.includes(w)) return false;
    return guesses.every((g, i) => gridRow(g, w) === obs[i]);
  });
}

export function pvpNoteText(winner, word, stake) {
  if (winner === "U") return "PvP word guess: the user solved '" + word + "' first and won the " + stake + " point stake against you.";
  if (winner === "C") return "PvP word guess: you solved '" + word + "' first and took the " + stake + " point stake from the user.";
  return "PvP word guess: neither of you solved '" + word + "' — the " + stake + " point stake was refunded.";
}
export function betNoteText(win, amt, delta) {
  return win
    ? "Coinflip bet: the user wagered " + amt + " points against you and WON (net +" + delta + " after your 10% commission)."
    : "Coinflip bet: the user wagered " + amt + " points against you and LOST. You keep their points.";
}

function pvpView(st, L) {
  const rows = [];
  const n = Math.max(st.gU.length, st.gC.length);
  for (let i = 0; i < n; i++) {
    if (st.gU[i]) rows.push(L.pvpYou + "  " + gridRow(st.gU[i], st.t) + " <code>" + st.gU[i] + "</code>");
    if (st.gC[i]) rows.push(L.pvpChar + " " + gridRow(st.gC[i], st.t) + " <code>" + st.gC[i] + "</code>");
  }
  let body;
  if (st.done) body = st.winner === "U" ? L.pvpWin(st.t, st.stake) : st.winner === "C" ? L.pvpLose(st.t, st.stake) : L.pvpDraw(st.t);
  else body = (st.p ? L.gmPracNote + "\n" : "") + L.pvpTurn;
  const taunt = (!st.done && st.gC.length) ? "\n💬 " + L.pvpTaunts[Math.floor(Math.random() * L.pvpTaunts.length)] : "";
  return {
    text: L.gmPvpHead + "\n" + L.pvpHow + "\n\n" + (rows.length ? rows.join("\n") + "\n\n" : "") + body + taunt,
    markup: { inline_keyboard: st.done ? [[{ text: L.gmPrac, callback_data: "g:pvp" }]].concat(homeRow(L)) : [[{ text: L.gmStopB, callback_data: "g:pvpstop" }]].concat(homeRow(L)) }
  };
}

export async function pvpStart(env, chatId, mid) {
  const L = await uiLang(env);
  const day = todayDay();
  const old = await getJSON(env, GAME_PVP_KEY + chatId, null);
  if (old && old.d === day && old.done === 0) return editView(env, chatId, mid || old.mid, pvpView(old, L));
  const prac = !!(old && old.d === day && old.done !== 0);
  if (!prac) {
    const q = await getJSON(env, "quest", {});
    if ((q.points || 0) < PVP_STAKE) { await notify(env, chatId, L.pvpPoor(PVP_STAKE, q.points || 0)); return gameMenu(env, chatId, mid); }
  }
  const st = { d: day, t: prac ? pracWord(old && old.t) : pvpWord(dayNumOf(Math.floor(Date.now() / 1000))), gU: [], gC: [], done: 0, winner: null, stake: prac ? 0 : PVP_STAKE, p: prac ? 1 : 0, mid: mid || 0 };
  await putJSON(env, GAME_PVP_KEY + chatId, st);
  return editView(env, chatId, mid || st.mid, pvpView(st, L));
}

export async function pvpGuess(env, chatId, mid, raw) {
  const L = await uiLang(env);
  const w = String(raw || "").trim().toUpperCase();
  const st = await getJSON(env, GAME_PVP_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done !== 0) { await notify(env, chatId, L.gmNoActive); return; }
  if (!/^[A-Z]{5}$/.test(w)) { await notify(env, chatId, L.gmNeed5); return; }
  if (st.gU.includes(w)) { await notify(env, chatId, L.gmDup(w)); return; }
  st.gU.push(w);
  let winner = null;
  if (w === st.t) winner = "U";
  else {
    let pool = pvpCandidates(st.t, st.gC);
    if (!pool.length) pool = WORDS.map(x => x.toUpperCase()).filter(x => !st.gC.includes(x));
    const cg = pool[Math.floor(Math.random() * pool.length)];
    st.gC.push(cg);
    if (cg === st.t) winner = "C";
    else if (st.gU.length >= 6 && st.gC.length >= 6) winner = "D";
  }
  if (winner) await pvpSettle(env, chatId, st, winner);
  else await putJSON(env, GAME_PVP_KEY + chatId, st);
  return editView(env, chatId, st.mid || mid, pvpView(st, L));
}

export async function pvpSettle(env, chatId, st, winner) {
  st.done = 1; st.winner = winner;
  await putJSON(env, GAME_PVP_KEY + chatId, st);
  if (st.p) return;
  if (winner === "U") await addPts(env, st.stake);
  else if (winner === "C") await addPts(env, -st.stake);
  await gameRecBump(env, "pvp", winner, st.stake);
  const w3 = await getJSON(env, "quest", {});
  w3.gNote = { ts: Date.now(), text: pvpNoteText(winner, st.t, st.stake) };
  await putJSON(env, "quest", w3);
}

export async function pvpStop(env, chatId, mid) {
  const st = await getJSON(env, GAME_PVP_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done !== 0) return gameMenu(env, chatId, mid);
  st.done = 1; st.winner = "C";
  await putJSON(env, GAME_PVP_KEY + chatId, st);
  if (st.p) { const Lp = await uiLang(env); return editView(env, chatId, mid || st.mid, pvpView(st, Lp)); }
  await addPts(env, -st.stake);
  await gameRecBump(env, "pvp", "C", st.stake);
  const w3 = await getJSON(env, "quest", {});
  w3.gNote = { ts: Date.now(), text: pvpNoteText("C", st.t, st.stake) + " (The user gave up.)" };
  await putJSON(env, "quest", w3);
  const L = await uiLang(env);
  return editView(env, chatId, mid || st.mid, pvpView(st, L));
}

export async function handleBet(env, msg, chatId) {
  const L = await uiLang(env);
  const raw = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  const q = await getJSON(env, "quest", {});
  if (!raw) return reply(env, chatId, L.betStatus(q.points || 0) + "\n" + L.betHow);
  if (!/^\d+$/.test(raw)) return reply(env, chatId, L.betUsage);
  const n = parseInt(raw, 10);
  if (n < BET_MIN || n > BET_MAX) return reply(env, chatId, L.betRange(BET_MIN, BET_MAX));
  if ((q.points || 0) < n) return reply(env, chatId, L.betPoor(q.points || 0));
  const win = Math.random() < 0.5;
  const delta = win ? Math.round(n * (1 - BET_RAKE)) : -n;
  await addPts(env, delta);
  await gameRecBump(env, "bet", win ? "U" : "C", delta);
  const w = await getJSON(env, "quest", {});
  w.gNote = { ts: Date.now(), text: betNoteText(win, n, delta) };
  await putJSON(env, "quest", w);

  await reply(env, chatId, win ? L.betWin(n, delta, w.points || 0) : L.betLose(n, w.points || 0));
  let ai = "";
  try { ai = await remindMsg(env, 0, win ? "the user WON, you pay net +" + delta + " points" : "the user LOST, you keep their " + n + " points", 0, "bet"); } catch (_) {}
  if (ai) await reply(env, chatId, "\u{1F4AC} " + mdTg(esc(ai)));
}

const SYS_QUIZ = "You make a quick trivia mini-quiz for a casual chat user. Reply with STRICT JSON only - no markdown fence, no commentary. Shape: {\"qs\":[{\"q\":\"...\",\"o\":[\"opt1\",\"opt2\",\"opt3\",\"opt4\"],\"a\":0},{...},{...}]} - exactly 3 items; 'q' = short general-knowledge question, 'o' = exactly 4 short options, 'a' = index (0-3) of the single correct option. Spread the correct index across items (never all the same). Vary topics (geography, science, history, language, pop culture). Keep it fun and fair - no trick questions, nothing too obscure.";

const QUIZ_TOPICS = ["geography", "science", "history", "language & words", "pop culture", "music", "movies & TV", "food & drinks", "animals & nature", "space", "sports & games", "technology", "mythology", "literature", "art", "the human body"];
const QUIZ_ANGLES = ["unusual-but-learnable facts", "classic trivia everyone half-remembers", "everyday practical knowledge", "a wild mix of anything"];
export function quizAskPrompt(hist) {
  const shuf = [...QUIZ_TOPICS].sort(() => Math.random() - 0.5).slice(0, 3).join(", ");
  const angle = QUIZ_ANGLES[Math.floor(Math.random() * QUIZ_ANGLES.length)];
  const av = (hist || []).slice(-QUIZ_HIST_MAX).map(q => "- " + q).join("\n");
  return "Make today's 3-question quiz. Style angle: " + angle + ". Lean on these topics this round: " + shuf + "." + (av ? "\nDo NOT reuse or lightly rephrase any of these recent questions - ask genuinely different facts:\n" + av : "");
}

function validQuiz(j) {
  if (!j || !Array.isArray(j.qs) || j.qs.length !== 3) return null;
  const qs = j.qs.map(x => ({
    q: String((x && x.q) || "").slice(0, 200),
    o: ((x && Array.isArray(x.o)) ? x.o : []).slice(0, 4).map(v => String(v || "").slice(0, 60)),
    a: Math.max(0, Math.min(3, parseInt(x && x.a, 10) || 0))
  }));
  for (const x of qs) if (!x.q || x.o.length !== 4 || x.o.some(v => !v)) return null;
  return qs;
}

function quizQView(st, L, fb) {
  const x = st.qs[st.i];
  const rows = [[0, 1], [2, 3]].map(pr => pr.map(k => ({ text: String.fromCharCode(65 + k) + ". " + esc(x.o[k].slice(0, 40)), callback_data: "g:qa:" + k })));
  return { text: (st.p ? L.gmPracNote + "\n" : "") + L.gmQuizHead + " · " + L.gmQuizQ(st.i + 1) + (fb ? "\n" + fb : "") + "\n\n<b>" + esc(x.q) + "</b>", markup: { inline_keyboard: rows.concat(homeRow(L)) } };
}

function quizDoneView(st, L) {
  return { text: L.gmQuizHead + "\n" + L.gmQuizDone(st.sc, st.pts || 0), markup: { inline_keyboard: [[{ text: L.gmPrac, callback_data: "g:quiz" }]].concat(homeRow(L)) } };
}

export async function gameQuizStart(env, chatId, mid) {
  const L = await uiLang(env);
  const day = todayDay();
  const old = await getJSON(env, GAME_QUIZ_KEY + chatId, null);
  if (old && old.d === day && !old.done) return editView(env, chatId, mid, quizQView(old, L));
  const prac = !!(old && old.d === day && old.done);
  let hist = [];
  let out = "";
  try {
    hist = await getJSON(env, QUIZ_HIST_KEY + chatId, []);
    const msgs = [{ role: "system", content: SYS_QUIZ }, { role: "user", content: quizAskPrompt(hist) }];
    for await (const d of chatStream(env, msgs, 600)) out += d;
  } catch (_) { await notify(env, chatId, L.gmQuizFail); return; }
  const m = stripThink(out).match(/\{[\s\S]*\}/);
  let qs = null;
  if (m) { try { qs = validQuiz(JSON.parse(m[0])); } catch (_) {} }
  if (!qs) { await notify(env, chatId, L.gmQuizFail); return; }
  const st = { d: day, qs: qs, i: 0, sc: 0, p: prac ? 1 : 0, mid: mid || 0 };
  await putJSON(env, GAME_QUIZ_KEY + chatId, st);
  await putJSON(env, QUIZ_HIST_KEY + chatId, hist.concat(qs.map(x => x.q)).slice(-QUIZ_HIST_MAX));
  return editView(env, chatId, mid, quizQView(st, L));
}

export async function gameQuizPick(env, chatId, mid, k) {
  const L = await uiLang(env);
  const st = await getJSON(env, GAME_QUIZ_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done || !st.qs || !st.qs[st.i]) return gameMenu(env, chatId, mid);
  const x = st.qs[st.i];
  const ok = x.a === k;
  if (ok) st.sc++;
  st.i++;
  let view;
  if (st.i >= 3) {
    st.done = 1;
    st.pts = st.p ? 0 : QUIZ_PTS * st.sc;
    await putJSON(env, GAME_QUIZ_KEY + chatId, st);
    if (st.pts > 0) await addPts(env, st.pts);
    view = quizDoneView(st, L);
  } else {
    await putJSON(env, GAME_QUIZ_KEY + chatId, st);
    view = quizQView(st, L, ok ? L.gmCorrect : L.gmWrong(esc(x.o[x.a])));
  }
  return editView(env, chatId, mid, view);
}

export async function handleGame(env, msg, chatId) {
  const arg = (msg.text || "").replace(/^\/\S+\s*/, "").trim();
  if (arg) return gameGuess(env, chatId, arg);
  return gameMenu(env, chatId, 0);
}

const LYRIC_NUMS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

export function lyricPickLine(pl, title, artist) {
  const tl = baseTitle(title), al = artist.toLowerCase();
  const tl4 = tl.split(" ").slice(0, 4).join(" ");
  const cands = [];
  for (let ln of pl.split("\n")) {
    ln = ln.trim().replace(/^\[.*\]$|^\(.*\)$/, "").trim();
    if (ln.length < 18 || ln.length > 110) continue;
    const lo = ln.toLowerCase();
    if (lo.includes(tl) || (tl4.length > 8 && lo.includes(tl4)) || (al.length > 2 && lo.includes(al))) continue;
    const w = ln.split(/\s+/).length;
    if (w < 4 || w > 16) continue;
    cands.push(ln);
  }
  return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
}

async function lyricFetchReal(env, title, artist) {
  const H = { "user-agent": UA + " lyric-quiz/1.0" };
  const urls = [
    "https://lrclib.net/api/search?track_name=" + encodeURIComponent(title) + "&artist_name=" + encodeURIComponent(artist),
    "https://lrclib.net/api/search?q=" + encodeURIComponent(title + " " + artist)
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: H });
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j)) continue;
      for (const rec of j) {
        const pl = (rec && !rec.instrumental && typeof rec.plainLyrics === "string") ? rec.plainLyrics : "";
        const line = pl && lyricPickLine(pl, title, artist);
        if (line) return line;
      }
    } catch (_) {}
  }

  for (const m of ["https://lyricsplus.binimum.org", "https://lyricsplus.prjktla.my.id"]) {
    try {
      const r = await fetch(m + "/v2/lyrics/get?title=" + encodeURIComponent(title) + "&artist=" + encodeURIComponent(artist), { headers: H });
      if (!r.ok) continue;
      const j = await r.json();
      if (!j || !Array.isArray(j.lyrics)) continue;
      const pl = j.lyrics.map(x => (x && typeof x.text === "string") ? x.text : "").filter(Boolean).join("\n");
      const line = pl && lyricPickLine(pl, title, artist);
      if (line) return line;
    } catch (_) {}
  }
  return null;
}

async function lyricPoolRaw(env) {
  const user = (await env.KV.get(LFM_USER_KEY)) || env.LASTFM_USER || LFM_USER_DEFAULT;
  const get = async (period) => {
    const r = await fetch("https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&format=json&limit=50&period=" + period + "&user=" + encodeURIComponent(user) + "&api_key=" + env.LASTFM_KEY, { headers: { "user-agent": UA } });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = j && j.toptracks && Array.isArray(j.toptracks.track) ? j.toptracks.track : [];
    return arr.map(t => ({ t: String(t.name || "").slice(0, 80), a: String((t.artist && (t.artist["#text"] || t.artist.name)) || "").slice(0, 80), pc: parseInt(t.playcount, 10) || 0 })).filter(x => x.t && x.a);
  };
  const arr = await get("1month");
  let pool = arr.filter(x => x.pc >= 2).sort((x, y) => y.pc - x.pc);
  if (pool.length < 8) {
    const p2 = (await get("6month")).filter(x => x.pc >= 3).sort((x, y) => y.pc - x.pc);
    if (p2.length > pool.length) pool = p2;
  }
  if (!pool.length) pool = arr;
  const seen = new Set(); const ded = [];
  for (const x of pool) { const b = baseTitle(x.t); if (b && !seen.has(b)) { seen.add(b); ded.push(x); } }
  const fin = ded.length >= 4 ? ded : (pool.length >= 4 ? pool : null);
  return fin ? fin.slice(0, LYRIC_POOL_MAX) : null;
}

function baseTitle(t) {
  return t
    .replace(/[([][^)\]]*?(feat\.?|ft\.?|remaster|remastered|live|acoustic|version|ver\.|edit|mix|remix|radio|mono|stereo|deluxe|bonus|demo|instrumental|extended|sped up|slowed|re-recorded)[^)\]]*?[)\]]/gi, "")
    .replace(/\s+[-–—]\s*(feat\.?|ft\.?|remaster|remastered|live|acoustic|radio|single|version|ver\.|mono|stereo|deluxe|bonus|demo|instrumental|extended|remix|sped up|slowed).*$/i, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

const shuf = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };

function lyricView(st, L) {
  let body;
  if (st.done) body = st.win ? L.lyrWin(esc(st.song), esc(st.artist), st.p ? 0 : LYRIC_PTS) : L.lyrLose(esc(st.song), esc(st.artist));
  else body = L.lyrHow;
  const oN = (st.opts || []).map(o => (typeof o === "string" ? { t: o, a: "" } : o));
  const list = oN.map((o, i) => (i + 1) + ". <b>" + esc(o.t) + "</b>" + (o.a ? " <i>— " + esc(o.a) + "</i>" : "")).join("\n");
  return {
    text: (st.p ? L.gmPracNote + "\n" : "") + L.lyrHead + "\n" + body + "\n\n<i>" + esc(st.line) + "</i>" + (st.done ? "" : "\n\n" + list),
    markup: { inline_keyboard: st.done ? [[{ text: L.gmPrac, callback_data: "g:lyric" }]].concat(homeRow(L)) : [oN.map((o, i) => ({ text: LYRIC_NUMS[i] || String(i + 1), callback_data: "g:la:" + i }))] }
  };
}

export async function gameLyricStart(env, chatId, mid) {
  const L = await uiLang(env);
  const day = todayDay();
  const old = await getJSON(env, GAME_LYRIC_KEY + chatId, null);
  if (old && old.d === day && !old.done) return editView(env, chatId, mid || old.mid, lyricView(old, L));
  const prac = !!(old && old.d === day && old.done);
  if (!env.LASTFM_KEY) { await notify(env, chatId, L.lyrOff); return gameMenu(env, chatId, mid); }
  let pool = null;
  try { pool = await lyricPoolRaw(env); } catch (_) {}
  if (!pool) { await notify(env, chatId, L.lyrPoolFail); return gameMenu(env, chatId, mid); }
  let pick = null, line = "";
  for (const c of shuf(pool).slice(0, 5)) {
    line = await lyricFetchReal(env, c.t, c.a);
    if (line) { pick = c; break; }
  }
  if (!pick) { await notify(env, chatId, L.lyrFail); return gameMenu(env, chatId, mid); }
  const others = shuf(pool.filter(x => x.t !== pick.t && baseTitle(x.t) !== baseTitle(pick.t))).slice(0, 3);
  const opts = shuf([{ t: pick.t, a: pick.a }].concat(others.map(o => ({ t: o.t, a: o.a }))));
  const st = { d: day, song: pick.t, artist: pick.a, line: line, opts: opts, a: opts.findIndex(o => o.t === pick.t), done: 0, win: 0, p: prac ? 1 : 0, mid: mid || 0 };
  await putJSON(env, GAME_LYRIC_KEY + chatId, st);
  return editView(env, chatId, mid, lyricView(st, L));
}

export async function gameLyricPick(env, chatId, mid, k) {
  const L = await uiLang(env);
  const st = await getJSON(env, GAME_LYRIC_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done || !st.opts || !st.opts[k]) return gameMenu(env, chatId, mid);
  st.win = k === st.a;
  st.done = 1;
  await putJSON(env, GAME_LYRIC_KEY + chatId, st);
  if (st.win && !st.p) await addPts(env, LYRIC_PTS);
  return editView(env, chatId, mid, lyricView(st, L));
}

async function dzPreview(title, artist) {
  const qs = [title + ' ' + artist, 'artist:"' + artist + '" track:"' + title + '"'];
  for (const q of qs) {
    try {
      const r = await fetch("https://api.deezer.com/search?q=" + encodeURIComponent(q), { headers: { "user-agent": UA } });
      if (!r.ok) continue;
      const j = await r.json();
      const d = j && Array.isArray(j.data) ? j.data : [];
      for (const x of d) if (x && typeof x.preview === "string" && x.preview) return x.preview;
    } catch (_) {}
  }
  return null;
}

export async function gameLeave(env, chatId) {
  for (const key of [GAME_SONG_KEY, GAME_FAN_KEY]) {
    let st = null;
    try { st = await getJSON(env, key + chatId, null); } catch (_) {}
    if (!st || !st.amid) continue;
    try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: st.amid }); } catch (_) {}
    st.amid = 0;
    st.paused = 1;
    await putJSON(env, key + chatId, st);
  }
}

async function snippetRedeliver(env, chatId, st, key, L) {
  if (!st || !st.song || !st.artist) return 0;
  const pv = await dzPreview(st.song, st.artist);
  if (!pv) return 0;
  const sa = await tg(env, "sendAudio", { chat_id: chatId, audio: pv, caption: L.songCap, parse_mode: "HTML" });
  if (!sa || !sa.ok) return 0;
  st.amid = sa.result && sa.result.message_id || 0;
  delete st.paused;
  st.ts = Date.now();
  await putJSON(env, key + chatId, st);
  await gameIdleReg(env, chatId);
  return 1;
}

function songView(st, L) {
  let body;
  if (st.done) body = st.win ? L.songWin(esc(st.song), esc(st.artist), st.p ? 0 : (st.pts != null ? st.pts : (st.f ? SONG_FAN_PTS : SONG_PTS))) : L.songLose(esc(st.song), esc(st.artist));
  else body = L.songHow;
  const extra = st.done && !st.p ? (st.win ? "\n" + L.songStreak(st.stk || 0, st.stb || 0) : ((st.stw || 0) > 0 ? "\n" + L.songStreakEnd(st.stw) : "")) : "";
  const list = (st.opts || []).map((o, i) => (i + 1) + ". <b>" + esc(o.t) + "</b> <i>— " + esc(o.a) + "</i>").join("\n");
  return {
    text: (st.p ? L.gmPracNote + "\n" : "") + L.songHead + UI_SEP + body + extra + (st.done ? "" : "\n\n" + list),
    markup: { inline_keyboard: st.done ? [[{ text: L.gmPrac, callback_data: st.f ? "g:sfap" : "g:song" }]].concat(homeRow(L)) : [(st.opts || []).map((o, i) => ({ text: LYRIC_NUMS[i] || String(i + 1), callback_data: (st.f ? "g:fg:" : "g:sg:") + i }))].concat(homeRow(L)) }
  };
}

export async function gameSongStart(env, chatId, mid) {
  const L = await uiLang(env);
  const day = todayDay();
  const old = await getJSON(env, GAME_SONG_KEY + chatId, null);
  if (old && old.d === day && !old.done) {
    if (old.amid || !old.paused) return editView(env, chatId, mid || old.mid, songView(old, L));
    if (!(await snippetRedeliver(env, chatId, old, GAME_SONG_KEY, L))) { await notify(env, chatId, L.songReDel); return gameMenu(env, chatId, mid); }
    return editView(env, chatId, mid || old.mid, songView(old, L));
  }
  const prac = !!(old && old.d === day && old.done);
  if (!env.LASTFM_KEY) { await notify(env, chatId, L.songOff); return gameMenu(env, chatId, mid); }
  let pool = null;
  try { pool = await lyricPoolRaw(env); } catch (_) {}
  if (!pool) { await notify(env, chatId, L.songPoolFail); return gameMenu(env, chatId, mid); }
  let pick = null, preview = "", tried = 0;
  for (const c of shuf(pool).slice(0, SONG_TRY_MAX)) {
    tried++;
    const pv = await dzPreview(c.t, c.a);
    if (pv) { pick = c; preview = pv; break; }
  }
  if (!pick) { await notify(env, chatId, L.songFail(tried)); return gameMenu(env, chatId, mid); }
  const others = shuf(pool.filter(x => x.t !== pick.t && baseTitle(x.t) !== baseTitle(pick.t))).slice(0, 3);
  const opts = shuf([{ t: pick.t, a: pick.a }].concat(others.map(o => ({ t: o.t, a: o.a }))));
  const st = { d: day, song: pick.t, artist: pick.a, opts: opts, a: opts.findIndex(o => o.t === pick.t), done: 0, win: 0, p: prac ? 1 : 0, ts: Date.now(), mid: mid || 0 };

  const sa = await tg(env, "sendAudio", { chat_id: chatId, audio: preview, caption: L.songCap, parse_mode: "HTML" });
  if (!sa || !sa.ok) return gameMenu(env, chatId, mid);
  st.amid = sa.result && sa.result.message_id || 0;
  if (prac && old.amid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: old.amid }); } catch (_) {} }
  await putJSON(env, GAME_SONG_KEY + chatId, st);
  await gameIdleReg(env, chatId);
  return editView(env, chatId, mid, songView(st, L));
}

export async function gameSongPick(env, chatId, mid, k) {
  const L = await uiLang(env);
  const st = await getJSON(env, GAME_SONG_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done || !st.opts || !st.opts[k]) return gameMenu(env, chatId, mid);
  if (st.paused && !st.amid) return gameSongStart(env, chatId, mid);
  st.win = k === st.a ? 1 : 0;
  st.done = 1;
  delete st.paused;
  const sr = st.p ? null : await songStreak(env, chatId, GAME_SONG_STAT_KEY, st.win, SONG_PTS);
  st.pts = sr ? sr.pts : 0;
  st.stk = sr ? sr.s : 0; st.stb = sr ? sr.b : 0; st.stw = sr ? (sr.was || 0) : 0;
  await putJSON(env, GAME_SONG_KEY + chatId, st);
  if (st.win && !st.p) await addPts(env, st.pts);
  return editView(env, chatId, mid, songView(st, L));
}

async function songStreak(env, chatId, key, win, base) {
  const st = (await getJSON(env, key + chatId, null)) || {};
  if (!win) { if (st.s) await putJSON(env, key + chatId, { s: 0, b: st.b || 0 }); return { pts: 0, s: 0, b: st.b || 0, was: st.s || 0 }; }
  const ns = (st.s || 0) + 1;
  const b = Math.max(st.b || 0, ns);
  await putJSON(env, key + chatId, { s: ns, b });
  return { pts: base + Math.min(ns - 1, SONG_STREAK_CAP), s: ns, b, was: 0 };
}

async function fanTracks(env) {
  const user = (await env.KV.get(LFM_USER_KEY)) || env.LASTFM_USER || LFM_USER_DEFAULT;
  const get = async (period) => {
    const r = await fetch("https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&format=json&limit=200&period=" + period + "&user=" + encodeURIComponent(user) + "&api_key=" + env.LASTFM_KEY, { headers: { "user-agent": UA } });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = j && j.toptracks && Array.isArray(j.toptracks.track) ? j.toptracks.track : [];
    return arr.map(t => ({ t: String(t.name || "").slice(0, 80), a: String((t.artist && (t.artist["#text"] || t.artist.name)) || "").slice(0, 80), pc: parseInt(t.playcount, 10) || 0 })).filter(x => x.t && x.a);
  };
  let pool = (await get("1month")).filter(x => x.pc >= 1);
  if (!fanGroups(pool).length) {
    const p2 = (await get("6month")).filter(x => x.pc >= 1);
    if (fanGroups(p2).length) pool = p2;
  }
  return pool;
}

function fanGroups(pool) {
  const g = new Map();
  for (const x of pool) {
    if (!g.has(x.a)) g.set(x.a, { a: x.a, pc: 0, tr: [], seen: new Set() });
    const e = g.get(x.a); const b = baseTitle(x.t);
    if (e.seen.has(b)) continue;
    e.seen.add(b); e.pc += x.pc; e.tr.push({ t: x.t, a: x.a });
  }
  return [...g.values()].filter(e => e.tr.length >= FAN_MIN_SONGS).sort((x, y) => y.pc - x.pc);
}

export async function gameFanMenu(env, chatId, mid, sel) {
  const L = await uiLang(env);
  const old = await getJSON(env, GAME_FAN_KEY + chatId, null);
  if (old && old.d === todayDay() && !old.done) {
    if (old.amid || !old.paused) return editView(env, chatId, mid || old.mid, songView(old, L));
    if (!(await snippetRedeliver(env, chatId, old, GAME_FAN_KEY, L))) { await notify(env, chatId, L.songReDel); return gameMenu(env, chatId, mid); }
    return editView(env, chatId, mid || old.mid, songView(old, L));
  }
  if (!sel && old && old.d === todayDay() && old.done) return editView(env, chatId, mid || old.mid, songView(old, L));
  if (!env.LASTFM_KEY) { await notify(env, chatId, L.songOff); return gameMenu(env, chatId, mid); }
  let groups = null;
  try { groups = fanGroups(await fanTracks(env)).slice(0, FAN_MENU_MAX); } catch (_) {}
  if (!groups || !groups.length) { await notify(env, chatId, L.fanFail); return gameMenu(env, chatId, mid); }
  const list = groups.map((e, i) => (i + 1) + ". <b>" + esc(e.a) + "</b> — " + e.tr.length + " " + L.fanSongs).join("\n");
  const markup = { inline_keyboard: [groups.map((e, i) => ({ text: String(i + 1), callback_data: "g:sfa:" + i }))].concat([[{ text: L.sfType, callback_data: "g:sfask" }], [{ text: L.back, callback_data: "g:back" }, { text: L.home, callback_data: "g:home" }]]) };
  return editView(env, chatId, mid, { text: L.fanHead + UI_SEP + list, markup });
}

export async function gameFanStart(env, chatId, mid, ai, name) {
  const L = await uiLang(env);
  const day = todayDay();
  const old = await getJSON(env, GAME_FAN_KEY + chatId, null);
  const art = name || (ai >= 0 ? "" : (old && old.artist) || "");
  if (art && old && old.d === day && !old.done) {
    if (old.amid || !old.paused) return editView(env, chatId, mid || old.mid, songView(old, L));
    if (!(await snippetRedeliver(env, chatId, old, GAME_FAN_KEY, L))) { await notify(env, chatId, L.songReDel); return gameMenu(env, chatId, mid); }
    return editView(env, chatId, mid || old.mid, songView(old, L));
  }
  const prac = !!(old && old.d === day && old.done);
  if (!env.LASTFM_KEY) { await notify(env, chatId, L.songOff); return gameMenu(env, chatId, mid); }
  let groups = null;
  try { groups = fanGroups(await fanTracks(env)); } catch (_) {}
  const g = groups ? (name ? (groups.find(e => e.a.toLowerCase() === String(name).toLowerCase()) || groups.find(e => e.a.toLowerCase().startsWith(String(name).toLowerCase()))) : (ai >= 0 ? groups[ai] : groups.find(e => e.a === art))) : null;
  if (!g) { await notify(env, chatId, L.fanFail); return gameMenu(env, chatId, mid); }
  let pick = null, preview = "", tried = 0;
  for (const c of shuf(g.tr).slice(0, SONG_TRY_MAX)) {
    tried++;
    const pv = await dzPreview(c.t, c.a);
    if (pv) { pick = c; preview = pv; break; }
  }
  if (!pick) { await notify(env, chatId, L.songFail(tried)); return gameFanMenu(env, chatId, mid); }
  const others = shuf(g.tr.filter(x => baseTitle(x.t) !== baseTitle(pick.t))).slice(0, 3);
  const opts = shuf([{ t: pick.t, a: pick.a }].concat(others.map(o => ({ t: o.t, a: o.a }))));
  const st = { d: day, song: pick.t, artist: pick.a, opts: opts, a: opts.findIndex(o => o.t === pick.t), done: 0, win: 0, p: prac ? 1 : 0, f: 1, ts: Date.now(), mid: mid || 0 };
  const sa = await tg(env, "sendAudio", { chat_id: chatId, audio: preview, caption: L.songCap, parse_mode: "HTML" });
  if (!sa || !sa.ok) return gameMenu(env, chatId, mid);
  st.amid = sa.result && sa.result.message_id || 0;
  if (prac && old.amid) { try { await tg(env, "deleteMessage", { chat_id: chatId, message_id: old.amid }); } catch (_) {} }
  await putJSON(env, GAME_FAN_KEY + chatId, st);
  await gameIdleReg(env, chatId);
  return editView(env, chatId, mid, songView(st, L));
}

export async function gameFanPick(env, chatId, mid, k) {
  const L = await uiLang(env);
  const st = await getJSON(env, GAME_FAN_KEY + chatId, null);
  if (!st || st.d !== todayDay() || st.done || !st.opts || !st.opts[k]) return gameMenu(env, chatId, mid);
  if (st.paused && !st.amid) return gameFanStart(env, chatId, mid, -1);
  st.win = k === st.a ? 1 : 0;
  st.done = 1;
  delete st.paused;
  const sr = st.p ? null : await songStreak(env, chatId, GAME_FAN_STAT_KEY, st.win, SONG_FAN_PTS);
  st.pts = sr ? sr.pts : 0;
  st.stk = sr ? sr.s : 0; st.stb = sr ? sr.b : 0; st.stw = sr ? (sr.was || 0) : 0;
  await putJSON(env, GAME_FAN_KEY + chatId, st);
  if (st.win && !st.p) await addPts(env, st.pts);
  return editView(env, chatId, mid, songView(st, L));
}

export async function gameIdleReg(env, chatId) {
  try {
    const l = (await getJSON(env, GAME_IDLE_REG, [])) || [];
    if (!l.includes(chatId)) { l.push(chatId); await putJSON(env, GAME_IDLE_REG, l.slice(-50)); }
  } catch (_) {}
}

export async function gameIdleTick(env) {
  let l = null;
  try { l = (await getJSON(env, GAME_IDLE_REG, [])) || []; } catch (_) { return; }
  if (!l.length) return;
  const now = Date.now();
  const L = await uiLang(env);
  const keep = [];
  for (const cid of l) {
    let live = false;
    for (const k of [GAME_SONG_KEY, GAME_FAN_KEY, DIVE_STATE_KEY, DIVE_PRAC_KEY]) {
      let st = null;
      try { st = await getJSON(env, k + cid, null); } catch (_) {}
      if (!st || st.done) continue;
      live = true;
      if (st.paused || !st.ts || now - st.ts <= GAME_IDLE_MS) continue;
      st.paused = 1;
      await putJSON(env, k + cid, st);
      await reply(env, cid, L.sfPause);
    }
    if (live) keep.push(cid);
  }
  if (keep.length !== l.length) await putJSON(env, GAME_IDLE_REG, keep);
}

const sfAskView = L => ({ text: L.sfAsk, markup: { inline_keyboard: [[{ text: L.askCancel, callback_data: "g:sfcx" }], [{ text: L.back, callback_data: "g:back" }, { text: L.home, callback_data: "g:home" }]] } });

export async function gameFanAskOpen(env, chatId, mid) {
  const L = await uiLang(env);
  await askSet(env, "sfan", { mid: mid || 0 });
  return editView(env, chatId, mid, sfAskView(L));
}

export async function gameFanAskCancel(env, chatId, mid) {
  await askClear(env);
  return gameFanMenu(env, chatId, mid);
}

export async function gameFanAsk(env, chatId, data, text, L) {
  const q = String(text || "").trim().slice(0, 60);
  let groups = null;
  try { groups = fanGroups(await fanTracks(env)); } catch (_) {}
  const g = groups ? groups.find(e => e.a.toLowerCase() === q.toLowerCase()) : null;
  const mid = data && data.mid || 0;
  if (g) {
    await askSet(env, "sfax", g.a);
    return editView(env, chatId, mid, { text: L.sfReady(esc(g.a), g.tr.length), markup: { inline_keyboard: [[{ text: L.sfGo, callback_data: "g:sfax" }], [{ text: L.back, callback_data: "g:back" }, { text: L.home, callback_data: "g:home" }]] } });
  }
  const sug = (groups || []).slice(0, 5).map(e => "• <b>" + esc(e.a) + "</b> — " + e.tr.length + " " + L.fanSongs).join("\n");
  const rn = await reply(env, chatId, L.sfNope(esc(q)) + (sug ? "\n" + sug : ""));
  if (rn && rn.ok && rn.result && rn.result.message_id) scheduleDelete(env, chatId, rn.result.message_id, parseInt(env.SFNOPE_MS || "", 10) || 30000);
  await askSet(env, "sfan", { mid: mid });
  return editView(env, chatId, mid, sfAskView(L));
}
