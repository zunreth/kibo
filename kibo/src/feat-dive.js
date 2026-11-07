import { tg, notify, delCmd, getJSON, putJSON, esc, reply, scheduleDelete } from "./base.js";
import { uiLang, UI_SEP } from "./ui.js";
import { WIB, DIVE_DAY_KEY, DIVE_STATE_KEY, DIVE_PRAC_KEY, DIVE_STAT_KEY, DIVE_TIERS, DIVE_GEM_PTS, DIVE_TOPICS, DIVE_DAY_MAX_ANS, DIVE_STALE_MS, DIVE_DAY_TTL_MS, DIVE_JOB_KEY, DIVE_GEN_ATTEMPTS, DIVE_ATTEMPT_GAP_MS, DIVE_JOB_TTL_MS, DIVE_MODES, DIVE_DEF_KEY, OWNER_FALLBACK } from "./consts.js";
import { gameIdleReg } from "./feat-game.js";
import { questDay, addPts } from "./feat-remind.js";
import { chatFast, chatStream } from "./feat-personal.js";
import { stripThink } from "./ai.js";

const homeRow = L => [[{ text: L.back, callback_data: "g:back" }, { text: L.home, callback_data: "menu" }]];
const todayDay = () => questDay(Math.floor(Date.now() / 1000));

const SYS_DIVE = "DAILY DIVE GENERATOR. You build one round of a rare-answer naming game (spirit of krillion.io). Reply with STRICT JSON only - no markdown fence, no commentary. Shape: {\"prompts\":[{\"q\":\"...\",\"hint\":\"...\",\"answers\":[\"...\"],\"gem\":\"...\"}]}. Rules: 'q' = short prompt asking to name ONE thing (e.g. \"Name a fruit people actually put on pizza\"). 'hint' = one nudge of max 8 words that never names a specific answer. 'answers' = 25-35 accepted answers RANKED from the most common (what an average person says first) to the rarest; put well-known aliases as separate entries right next to their canonical name; every entry max 5 words. 'gem' = the daily gem called the Krillion: ONE exact entry from the rare third of 'answers', chosen for fun factor (rare but satisfying to land on, not the most obscure). Vary topics and difficulty across prompts; nothing violent or adult.";
const SYS_DIVE_CHECK = "DIVE CHECK. You fact-check one answer for a naming game. You get the prompt, a sample of already-accepted answers, and the player's answer. Reply with STRICT JSON only - no markdown fence, no commentary. Shape: {\"valid\":true|false,\"band\":\"obvious|mid|deep\"}. valid = the answer genuinely fits the prompt (aliases and alternate spellings count - be generous with real answers). band = how common the answer is among average people: obvious = one of the first things most people would say; mid = reasonably common; deep = a deep cut most people would never think of. Reject jokes, nonsense, or off-topic answers with valid=false.";

async function editView(env, chatId, mid, view) {
  if (mid) {
    const j = await tg(env, "editMessageText", { chat_id: chatId, message_id: mid, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
    if (j && j.ok) return j;
    if (j && String(j.description || "").includes("message is not modified")) return j;
  }
  return tg(env, "sendMessage", { chat_id: chatId, text: view.text, parse_mode: "HTML", reply_markup: view.markup });
}

export function normAns(s) {
  return String(s || "").toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^(the|a|an) /, "");
}

function lev1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return true;
}

export function matchAns(set, raw) {
  const u = normAns(raw);
  if (!u) return null;
  const ans = (set && set.answers) || [];
  for (let i = 0; i < ans.length; i++) if (normAns(ans[i]) === u) return { i };
  for (let i = 0; i < ans.length; i++) { const a = normAns(ans[i]); if (a.length >= 6 && u.length >= 6 && lev1(a, u)) return { i }; }
  return null;
}

function tierOf(pos) {
  for (const t of DIVE_TIERS) if (pos <= t.max) return t;
  return DIVE_TIERS[DIVE_TIERS.length - 1];
}

function ansLuck(seed, a) {
  let h = 2166136261;
  const s = seed + ":" + a.toLowerCase();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function scoreDive(k, a, day, pos) {
  const j = ansLuck(day, a);
  if (k === "G") return DIVE_GEM_PTS + (j % 3);
  if (k === "X") return 9 + (pos === undefined ? (j % 3) : Math.min(2, Math.floor((pos - 25) / 4)));
  if (k === "D") return pos === undefined ? (6 - (j % 2)) : (pos <= 19 ? 6 : 5);
  if (k === "M") return pos === undefined ? (3 - (j % 2)) : (pos <= 9 ? 3 : 2);
  return 1;
}

function validDiveSet(j, n) {
  if (!j || !Array.isArray(j.prompts) || j.prompts.length !== n) return null;
  const out = [];
  for (const x of j.prompts) {
    const q = String((x && x.q) || "").slice(0, 220);
    const hint = String((x && x.hint) || "").slice(0, 120);
    let ans = ((x && Array.isArray(x.answers)) ? x.answers : []).map(v => String(v || "").slice(0, 60)).filter(v => v);
    const seen = new Set(); const ded = [];
    for (const a of ans) { const nn = normAns(a); if (nn && !seen.has(nn)) { seen.add(nn); ded.push(a); } }
    ans = ded.slice(0, DIVE_DAY_MAX_ANS);
    if (!q || ans.length < 12) return null;
    let gem = String((x && x.gem) || "");
    if (!ans.some(a => normAns(a) === normAns(gem))) gem = ans[ans.length - 1];
    out.push({ q, hint, answers: ans, gem });
  }
  return out;
}

async function diveGen(env, n, seedLine) {
  let err = "empty response";
  for (let attempt = 0; attempt < 2; attempt++) {
    let out = "";
    try {
      const msgs = [{ role: "system", content: SYS_DIVE }, { role: "user", content: seedLine }];
      const tmo = parseInt(String(env.DIVE_GEN_TIMEOUT_MS || "")) || 420000;
      for await (const d of chatStream(env, msgs, 3600, tmo)) out += d;
      if (!out.trim()) err = "model returned empty response";
      else {
        const m = stripThink(out).match(/\{[\s\S]*\}/);
        if (!m) err = "no JSON in model response";
        else {
          let j = null;
          try { j = JSON.parse(m[0]); } catch (e) { err = "JSON parse: " + String((e && e.message) || e).slice(0, 80); }
          if (j) { const set = validDiveSet(j, n); if (set) return { set, err: null }; err = "set rejected (wrong count / too few answers)"; }
        }
      }
    } catch (e) { err = String((e && e.message) || e).slice(0, 160); }
    if (!attempt && /quota|exceed|usage limit|402|403|unauthor|timeout|abort/i.test(err)) break;
  }
  return { set: null, err };
}

function diveSeedPrompt(n, practice, mode) {
  const day = new Date(Date.now() + WIB * 1000).toISOString().slice(0, 10);
  const shuf = [...DIVE_TOPICS].sort(() => Math.random() - 0.5).slice(0, 3).join(", ");
  const md = DIVE_MODES.find(x => x.k === mode);
  return "Make " + (practice ? "a PRACTICE round of exactly 7 prompts" : "today's daily round of exactly 7 prompts") + ". Date: " + day + ". Topic mix this round: " + shuf + ". Reward specific, slightly-offbeat knowledge - avoid the most generic trivia." + (md && md.bias ? " " + md.bias : "");
}

function divePromptView(st, L, set) {
  const x = set.prompts[st.i]; const md = DIVE_MODES.find(y => y.k === st.m);
  const last = st.res.length ? st.res[st.res.length - 1] : null;
  let res = "";
  if (last) res = "\n" + (last.k === "skip" ? "⏭ <i>" + L.diveSkipped + "</i>" : (last.k === "G" ? L.diveTierG : L["diveTier" + last.k]) + " <b>" + esc(last.a) + "</b> +" + last.p);
  return {
    text: (st.p ? L.gmPracNote + "\n" : "") + L.diveHead + " · " + L.diveQ(st.i + 1, st.n) + (md ? " · " + L.diveModeB(md) : "") + res + UI_SEP + "💡 <i>" + esc(x.hint) + "</i>\n<b>" + esc(x.q) + "</b>",
    markup: { inline_keyboard: [[{ text: L.diveSkipB, callback_data: "g:diveskip" }, { text: L.diveStopB, callback_data: "g:divestop" }]].concat(homeRow(L)) }
  };
}

function diveDoneView(st, L, stat, set) {
  const tot = st.res.reduce((s, e) => s + (e.p || 0), 0);
  const tried = st.tried || [];
  const lines = st.res.map((e, ix) => {
    let ln;
    if (e.k === "skip") ln = String(ix + 1) + ". ⏭ <i>" + L.diveSkipped + "</i>";
    else ln = String(ix + 1) + ". " + (e.k === "G" ? L.diveTierG : L["diveTier" + e.k]) + " <b>" + esc(e.a) + "</b> +" + e.p;
    const tr = tried[ix] || [];
    if (tr.length) ln += "\n   <i>" + L.diveTried(tr.map(v => esc(v)).join(", ")) + "</i>";
    const px = set && set.prompts && set.prompts[ix];
    if (px && px.gem && e.k !== "G") ln += "\n   " + L.diveWas(esc(px.gem));
    return ln;
  });
  const md = DIVE_MODES.find(x => x.k === st.m);
  const mtag = (!st.p && md) ? (md.emo + " " + md.name + " ×" + md.mult) : "";
  let body = L.diveDone + UI_SEP + lines.join("\n") + "\n\n" + L.diveScore(tot, st.p, st.p ? 0 : Math.round(tot * (md ? md.mult : 1)), mtag);
  if (!st.p && stat) {
    body += "\n" + L.diveStreak(stat.streak || 1);
    if (stat.best && stat.best.a) body += "\n" + L.diveBest(stat.best.k === "G" ? L.diveTierG : L["diveTier" + stat.best.k], esc(stat.best.a), stat.best.p);
  }
  return { text: (st.p ? L.gmPracNote + "\n" : "") + body, markup: { inline_keyboard: [[{ text: L.gmPrac, callback_data: "g:diveprac" }]].concat(homeRow(L)) } };
}

export async function diveStart(env, chatId, mid) {
  const L = await uiLang(env);
  const day = todayDay();
  const st = await getJSON(env, DIVE_STATE_KEY + chatId, null);
  if (st && st.d === day && !st.done) {
    if (st.paused) { delete st.paused; }
    st.ts = Date.now(); // v2.69.3: resume = aktivitas baru → panjangin jendela jawaban; fix jawaban AFK kebuang ke AI asli
    await putJSON(env, DIVE_STATE_KEY + chatId, st);
    await gameIdleReg(env, chatId);
    const set = (await getJSON(env, DIVE_DAY_KEY + day, null)) || null;
    if (!set || !set.prompts || !set.prompts[st.i]) {
      st.done = 1; st.ts = Date.now();
      await putJSON(env, DIVE_STATE_KEY + chatId, st);
      return editView(env, chatId, mid || st.mid, diveDoneView(st, L, await getJSON(env, DIVE_STAT_KEY + chatId, null), st.p ? st.set : (await getJSON(env, DIVE_DAY_KEY + st.d, null))));
    }
    const j = await editView(env, chatId, mid, divePromptView(st, L, set));
    if (!mid && j && j.ok && j.result && j.result.message_id && j.result.message_id !== st.mid) { st.mid = j.result.message_id; await putJSON(env, DIVE_STATE_KEY + chatId, st); }
    return j;
  }
  if (st && st.d === day && st.done) {
    return editView(env, chatId, mid, diveDoneView(st, L, await getJSON(env, DIVE_STAT_KEY + chatId, null), st.p ? st.set : (await getJSON(env, DIVE_DAY_KEY + st.d, null))));
  }

  const job = await getJSON(env, DIVE_JOB_KEY, null);
  const pend = job && job.daily && job.daily.day === day && job.daily.waiters && job.daily.waiters[chatId];
  if (pend && (job.daily.attempts || 0) < DIVE_GEN_ATTEMPTS && pend.mid) return editView(env, chatId, mid || pend.mid, { text: L.diveWait, markup: { inline_keyboard: [] } });
  const def = (await env.KV.get(DIVE_DEF_KEY)) || null;
  if (def && DIVE_MODES.some(m => m.k === def)) return diveModePick(env, chatId, mid, def);
  return editView(env, chatId, mid, diveModeView(L));
}

function diveModeView(L) {
  return {
    text: L.diveModeAsk + UI_SEP + "<i>" + L.diveModeHint + "</i>",
    markup: { inline_keyboard: [DIVE_MODES.map(m => ({ text: L.diveModeB(m), callback_data: "g:divemode:" + m.k }))].concat(homeRow(L)) }
  };
}

export async function diveModePick(env, chatId, mid, k) {
  const L = await uiLang(env);
  await gameIdleReg(env, chatId);
  const mode = DIVE_MODES.find(m => m.k === k) ? k : "normal";
  const day = todayDay();
  const st = await getJSON(env, DIVE_STATE_KEY + chatId, null);
  if (st && st.d === day) return diveStart(env, chatId, mid);
  let set = await getJSON(env, DIVE_DAY_KEY + day, null);
  if (set && set.prompts && set.prompts.length) {
    await diveJobDropWaiter(env, chatId, 0);
    const nst = { d: day, n: 7, i: 0, res: [], tried: [], done: 0, p: 0, m: mode, mid: mid || 0, ts: Date.now() };
    const j = await editView(env, chatId, mid, divePromptView(nst, L, set));
    if (!mid && j && j.ok && j.result && j.result.message_id) nst.mid = j.result.message_id;
    await putJSON(env, DIVE_STATE_KEY + chatId, nst);
    return j;
  }
  const j0 = await editView(env, chatId, mid, { text: L.diveWait, markup: { inline_keyboard: [] } });
  const phMid = mid || ((j0 && j0.ok && j0.result && j0.result.message_id) || 0);
  await diveJobAdd(env, chatId, phMid, 0, mode);
  return j0;
}

export async function divePreGen(env) {
  const now = new Date(Date.now() + WIB * 1000);
  if (now.getUTCHours() !== 0) return;
  const day = todayDay();
  const mkKey = "divepregen:" + day;
  if (await env.KV.get(mkKey)) return;
  const dk = await getJSON(env, DIVE_DAY_KEY + day, null);
  if (dk && dk.prompts) return;
  const dv = (await env.KV.get(DIVE_DEF_KEY)) || null;
  const m = DIVE_MODES.some(x => x.k === dv) ? dv : "normal"; // gak ada default mode = pregen tetep jalan (normal); dulu diam-diam skip = set harian bolong sampai ada yang /dive
  await putJSON(env, mkKey, 1, { ttlMs: DIVE_DAY_TTL_MS });
  try {
    const g = await diveGen(env, 7, diveSeedPrompt(7, false, m));
    if (g && g.set && g.set.length === 7) await putJSON(env, DIVE_DAY_KEY + day, { d: day, prompts: g.set }, { ttlMs: DIVE_DAY_TTL_MS });
  } catch (_) {}
}

async function diveJobAdd(env, chatId, mid, prac, mode) {
  const day = todayDay();
  const job = (await getJSON(env, DIVE_JOB_KEY, null)) || {};
  if (prac) {
    job.prac = job.prac || {};
    job.prac[chatId] = { mid: mid || (job.prac[chatId] && job.prac[chatId].mid) || 0, ts: Date.now(), attempts: 0, lastAttempt: 0 };
  } else {
    if (!job.daily || job.daily.day !== day) job.daily = { day, waiters: {}, attempts: 0, lastAttempt: 0, m: mode || "normal" };
    if (!job.daily.m && mode) job.daily.m = mode;
    job.daily.waiters[chatId] = { mid: mid || (job.daily.waiters[chatId] && job.daily.waiters[chatId].mid) || 0, ts: Date.now(), m: mode || "normal" };
  }
  await putJSON(env, DIVE_JOB_KEY, job, { ttlMs: DIVE_JOB_TTL_MS });
}

async function diveJobDropWaiter(env, chatId, prac) {
  const job = await getJSON(env, DIVE_JOB_KEY, null);
  if (!job) return;
  let dirty = false;
  if (prac && job.prac && job.prac[chatId]) { delete job.prac[chatId]; dirty = true; }
  if (!prac && job.daily && job.daily.waiters && job.daily.waiters[chatId]) { delete job.daily.waiters[chatId]; dirty = true; }
  if (!dirty) return;
  if (job.daily && !Object.keys(job.daily.waiters).length) delete job.daily;
  if (job.prac && !Object.keys(job.prac).length) delete job.prac;
  if (job.daily || job.prac) await putJSON(env, DIVE_JOB_KEY, job, { ttlMs: DIVE_JOB_TTL_MS });
  else await env.KV.delete(DIVE_JOB_KEY);
}

async function diveDeliver(env, waiters, day) {
  if (!waiters) return;
  const L = await uiLang(env);
  const dk = await getJSON(env, DIVE_DAY_KEY + day, null);
  if (!dk || !dk.prompts) return;
  for (const cid of Object.keys(waiters)) {
    const w = waiters[cid] || {};
    const ex = await getJSON(env, DIVE_STATE_KEY + cid, null);
    if (ex && ex.d === day && !ex.done && (ex.i > 0 || (ex.res && ex.res.length))) continue;
    const st = { d: day, n: 7, i: 0, res: [], tried: [], done: 0, p: 0, m: w.m || "normal", mid: w.mid || 0, ts: Date.now() };
    await putJSON(env, DIVE_STATE_KEY + cid, st);
    await editView(env, cid, w.mid, divePromptView(st, L, dk));
    const rn = await reply(env, cid, L.diveReady);
    const rm = rn && rn.result && rn.result.message_id;
    if (rm) scheduleDelete(env, cid, rm, 120000);
  }
}

const diveFailView = (L, err, cb) => ({ text: L.diveHead + UI_SEP + L.diveGenFail + (err ? "\n" + L.diveFailWhy(esc(String(err).slice(0, 140))) : ""), markup: { inline_keyboard: [[{ text: L.diveRetryB, callback_data: cb }]].concat(homeRow(L)) } });

async function diveFailWaiters(env, waiters, err) {
  if (!waiters) return true;
  const L = await uiLang(env);
  let all = true;
  for (const cid of Object.keys(waiters)) {
    const w = waiters[cid] || {};
    const j = await editView(env, cid, w.mid, diveFailView(L, err, "g:dive"));
    if (!(j && (j.ok || String(j.description || "").includes("message is not modified")))) all = false;
  }
  return all;
}

async function diveHeartbeat(env, waiters, attempts, min) {
  if (!waiters) return;
  const L = await uiLang(env);
  const now = Date.now();
  for (const cid of Object.keys(waiters)) {
    const w = waiters[cid] || {};
    const el = min >= 0 ? min : Math.max(0, Math.floor((now - (w.ts || now)) / 60000));
    await editView(env, cid, w.mid, { text: L.diveHb(attempts || 1, DIVE_GEN_ATTEMPTS, el), markup: { inline_keyboard: [] } });
  }
}

export async function diveCronTick(env) {
  const job = await getJSON(env, DIVE_JOB_KEY, null);
  if (!job) return;
  const day = todayDay();
  const now = Date.now();
  let dirty = false;
  const donePrac = [];
  if (job.daily) {
    if (job.daily.day !== day) { delete job.daily; dirty = true; }
    else {
      const dk = await getJSON(env, DIVE_DAY_KEY + day, null);
      if (dk && dk.prompts) { await diveDeliver(env, job.daily.waiters, day); delete job.daily; dirty = true; }
      else if ((job.daily.attempts || 0) >= DIVE_GEN_ATTEMPTS) {
        job.daily.failTries = (job.daily.failTries || 0) + 1;
        const deliv = await diveFailWaiters(env, job.daily.waiters, job.daily.err);
        if (deliv || job.daily.failTries >= 3) { delete job.daily; }
        dirty = true;
      }
      else if (now - (job.daily.lastAttempt || 0) >= DIVE_ATTEMPT_GAP_MS) {
        job.daily.lastAttempt = now;
        job.daily.attempts = (job.daily.attempts || 0) + 1;
        await putJSON(env, DIVE_JOB_KEY, job, { ttlMs: DIVE_JOB_TTL_MS });
        await diveHeartbeat(env, job.daily.waiters, job.daily.attempts, 0);
        let g = null;
        try { g = await diveGen(env, 7, diveSeedPrompt(7, false, job.daily.m)); } catch (e) { g = { set: null, err: String((e && e.message) || e).slice(0, 160) }; }
        const set = g && g.set;
        const j2 = (await getJSON(env, DIVE_JOB_KEY, null)) || job;
        const wts = (j2.daily && j2.daily.day === day && j2.daily.waiters) ? j2.daily.waiters : job.daily.waiters;
        if (set) {
          await putJSON(env, DIVE_DAY_KEY + day, { d: day, prompts: set }, { ttlMs: DIVE_DAY_TTL_MS });
          await diveDeliver(env, wts, day);
          delete job.daily;
        } else {
          job.daily.err = String((g && g.err) || "diveGen failed").slice(0, 160);
          if ((job.daily.attempts || 0) >= DIVE_GEN_ATTEMPTS) {
            await putJSON(env, DIVE_JOB_KEY, job, { ttlMs: DIVE_JOB_TTL_MS });
            if (await diveFailWaiters(env, wts, job.daily.err)) delete job.daily;
          }
        }
        dirty = true;
      } else {
        await diveHeartbeat(env, job.daily.waiters, job.daily.attempts || 0, -1);
      }
    }
  }
  if (job.prac) {
    for (const cid of Object.keys(job.prac)) {
      const w = job.prac[cid];
      const pst = await getJSON(env, DIVE_PRAC_KEY + cid, null);
      if (pst && !pst.done && pst.d === day && pst.i === 0 && !(pst.res && pst.res.length) && pst.set && pst.set.prompts && pst.set.prompts.length) {
        const j = await editView(env, cid, w.mid, divePromptView(pst, await uiLang(env), pst.set));
        if (j && (j.ok || String(j.description || "").includes("message is not modified"))) { delete job.prac[cid]; donePrac.push(cid); dirty = true; }
        continue;
      }
      if ((w.attempts || 0) >= DIVE_GEN_ATTEMPTS) {
        w.failTries = (w.failTries || 0) + 1;
        const j = await editView(env, cid, w.mid, diveFailView(await uiLang(env), w.err, "g:diveprac"));
        if ((j && (j.ok || String(j.description || "").includes("message is not modified"))) || w.failTries >= 3) {
          delete job.prac[cid];
          donePrac.push(cid);
        }
        dirty = true;
        continue;
      }
      if (now - (w.lastAttempt || 0) < DIVE_ATTEMPT_GAP_MS) {
        await editView(env, cid, w.mid, { text: (await uiLang(env)).diveHb(w.attempts || 1, DIVE_GEN_ATTEMPTS, Math.max(0, Math.floor((now - (w.ts || now)) / 60000))), markup: { inline_keyboard: [] } });
        continue;
      }
      w.lastAttempt = now;
      w.attempts = (w.attempts || 0) + 1;
      await putJSON(env, DIVE_JOB_KEY, job, { ttlMs: DIVE_JOB_TTL_MS });
      await editView(env, cid, w.mid, { text: (await uiLang(env)).diveHb(w.attempts, DIVE_GEN_ATTEMPTS, 0), markup: { inline_keyboard: [] } });
      let g = null;
      try { g = await diveGen(env, 7, diveSeedPrompt(7, true)); } catch (e) { g = { set: null, err: String((e && e.message) || e).slice(0, 160) }; }
      const L = await uiLang(env);
      if (g && g.set) {
        const set = g.set;
        const st = { d: day, n: set.length, i: 0, res: [], done: 0, p: 1, mid: w.mid || 0, ts: Date.now(), set: { prompts: set } };
        const ex = await getJSON(env, DIVE_PRAC_KEY + cid, null);
        if (!(ex && !ex.done && (ex.i > 0 || (ex.res && ex.res.length)))) {
          await putJSON(env, DIVE_PRAC_KEY + cid, st);
          const j = await editView(env, cid, w.mid, divePromptView(st, L, st.set));
          if (!(j && (j.ok || String(j.description || "").includes("message is not modified")))) continue;
        }
        delete job.prac[cid];
        donePrac.push(cid);
      } else {
        w.err = String((g && g.err) || "diveGen failed").slice(0, 160);
        if ((w.attempts || 0) >= DIVE_GEN_ATTEMPTS) {
          await putJSON(env, DIVE_JOB_KEY, job, { ttlMs: DIVE_JOB_TTL_MS });
          const j = await editView(env, cid, w.mid, diveFailView(L, w.err, "g:diveprac"));
          if (j && (j.ok || String(j.description || "").includes("message is not modified"))) { delete job.prac[cid]; donePrac.push(cid); }
        }
      }
      dirty = true;
    }
  }
  if (!dirty) return;

  const jf = (await getJSON(env, DIVE_JOB_KEY, null)) || job;
  if (job.daily && jf.daily) {
    jf.daily.attempts = job.daily.attempts;
    jf.daily.lastAttempt = job.daily.lastAttempt;
    if (job.daily.err !== undefined) jf.daily.err = job.daily.err;
    if (job.daily.failTries !== undefined) jf.daily.failTries = job.daily.failTries;
  }
  if (!job.daily && jf.daily) delete jf.daily;
  if (jf.daily && jf.daily.waiters && !Object.keys(jf.daily.waiters).length) delete jf.daily;
  if (jf.prac && job.prac) {
    for (const cid of Object.keys(job.prac)) {
      if (jf.prac[cid]) {
        jf.prac[cid].attempts = job.prac[cid].attempts;
        jf.prac[cid].lastAttempt = job.prac[cid].lastAttempt;
        if (job.prac[cid].err !== undefined) jf.prac[cid].err = job.prac[cid].err;
        if (job.prac[cid].failTries !== undefined) jf.prac[cid].failTries = job.prac[cid].failTries;
      }
    }
  }
  if (jf.prac) {
    for (const cid of donePrac) delete jf.prac[cid];
    if (!Object.keys(jf.prac).length) delete jf.prac;
  }
  if (jf.daily || jf.prac) await putJSON(env, DIVE_JOB_KEY, jf, { ttlMs: DIVE_JOB_TTL_MS });
  else await env.KV.delete(DIVE_JOB_KEY);
}

async function diveAdvance(env, chatId, st, key, L) {
  st.i++;
  if (st.i >= st.n) return diveFinalize(env, chatId, st, key, L, 0);
  let set = st.p ? st.set : null;
  if (!st.p) { const dk = await getJSON(env, DIVE_DAY_KEY + st.d, null); set = dk && dk.prompts ? dk : null; }
  if (!set || !set.prompts[st.i]) return diveFinalize(env, chatId, st, key, L, 0);
  await putJSON(env, key, st);
  return editView(env, chatId, st.mid, divePromptView(st, L, set));
}

async function diveCheck(env, x, u) {
  try {
    const sample = (x.answers || []).slice(0, 10).join(", ");
    const msgs = [{ role: "system", content: SYS_DIVE_CHECK }, { role: "user", content: "Prompt: " + x.q + "\nAccepted answers (sample): " + sample + "\nPlayer answer: " + u }];
    let out = "";
    for await (const d of chatFast(env, msgs, 600)) out += d;
    const m = stripThink(out).match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!j || !j.valid) return null;
    const b = String((j && j.band) || "").toLowerCase();
    return { k: b === "obvious" ? "O" : b === "deep" ? "X" : "M" };
  } catch (_) { return null; }
}

async function diveWrongNow(env, chatId, st, key, a, msgMid, L) {
  if (msgMid) await delCmd(env, chatId, msgMid);
  if (a) {
    st.tried = st.tried || [];
    const tr = st.tried[st.i] = st.tried[st.i] || [];
    if (tr.length < 6) tr.push(a);
    st.ts = Date.now();
    await putJSON(env, key, st);
    await notify(env, chatId, L.diveWrong(esc(a)));
  } else {
    await notify(env, chatId, L.diveBad);
  }
}

async function diveJudge(env, chatId, st, key, set, raw, L, msgMid) {
  const x = set.prompts[st.i];
  const u = normAns(raw);
  const a = raw.trim().slice(0, 60);
  if (!u || u.length > 60) { await diveWrongNow(env, chatId, st, key, u ? a : "", msgMid, L); return; }
  let k, pos;
  if (normAns(x.gem) === u) k = "G";
  else {
    const m = matchAns(x, u);
    if (m) { k = tierOf(m.i).k; pos = m.i; }
    else {
      const fb = await diveCheck(env, x, u);
      if (!fb) { await diveWrongNow(env, chatId, st, key, a, msgMid, L); return; }
      k = fb.k;
      if (!st.p) {
        try {
          const dk = await getJSON(env, DIVE_DAY_KEY + st.d, null);
          const px = dk && dk.prompts && dk.prompts[st.i];
          if (px && !px.answers.some(w => normAns(w) === u)) {
            if (k === "O") px.answers.splice(8, 0, a);
            else if (k === "M") px.answers.splice(20, 0, a);
            else px.answers.push(a);
            await putJSON(env, DIVE_DAY_KEY + st.d, dk, { ttlMs: DIVE_DAY_TTL_MS });
          }
        } catch (_) {}
      }
    }
  }
  const p = scoreDive(k, a, st.d, pos);
  st.res.push({ k, a, p });
  st.ts = Date.now();
  if (msgMid) await delCmd(env, chatId, msgMid);
  await notify(env, chatId, L.diveCaught(k === "G" ? L.diveTierG : L["diveTier" + k], esc(a), p));
  return diveAdvance(env, chatId, st, key, L);
}

async function diveFinalize(env, chatId, st, key, L, mid) {
  st.done = 1;
  st.ts = Date.now();
  await putJSON(env, key, st);
  let stat = null;
  if (!st.p) {
    const tot = st.res.reduce((s, e) => s + (e.p || 0), 0);
    const md = DIVE_MODES.find(x => x.k === st.m);
    const wpts = Math.round(tot * (md ? md.mult : 1));
    if (wpts > 0) await addPts(env, wpts);
    stat = (await getJSON(env, DIVE_STAT_KEY + chatId, null)) || {};
    if (stat.last !== st.d) {
      stat.streak = (stat.last === questDay(Math.floor(Date.now() / 1000) - 86400)) ? (stat.streak || 0) + 1 : 1;
      stat.last = st.d;
    }
    stat.plays = (stat.plays || 0) + 1;
    for (const e of st.res) if (e.k !== "skip" && (!stat.best || e.p > stat.best.p)) stat.best = { k: e.k, a: e.a, p: e.p };
    await putJSON(env, DIVE_STAT_KEY + chatId, stat);
  }
  const dk = st.p ? st.set : (await getJSON(env, DIVE_DAY_KEY + st.d, null));
  return editView(env, chatId, mid || st.mid, diveDoneView(st, L, stat, dk));
}

async function diveFindActive(env, chatId) {
  const day = todayDay();
  for (const prac of [0, 1]) {
    const key = (prac ? DIVE_PRAC_KEY : DIVE_STATE_KEY) + chatId;
    const st = await getJSON(env, key, null);
    if (st && st.d === day && !st.done) return { st, key, prac };
  }
  return null;
}

export async function diveSkip(env, chatId, mid) {
  const L = await uiLang(env);
  const f = await diveFindActive(env, chatId);
  if (!f) return diveStart(env, chatId, mid);
  f.st.res.push({ k: "skip", a: "", p: 0 });
  f.st.ts = Date.now();
  return diveAdvance(env, chatId, f.st, f.key, L);
}

export async function diveStop(env, chatId, mid) {
  const L = await uiLang(env);
  const f = await diveFindActive(env, chatId);
  if (!f) return diveStart(env, chatId, mid);
  return diveFinalize(env, chatId, f.st, f.key, L, mid);
}

export async function divePrac(env, chatId, mid) {
  const L = await uiLang(env);
  await gameIdleReg(env, chatId);
  const dst = await getJSON(env, DIVE_STATE_KEY + chatId, null);
  if (dst && dst.d === todayDay() && !dst.done) return diveStart(env, chatId, mid);
  const pst = await getJSON(env, DIVE_PRAC_KEY + chatId, null);
  if (pst && pst.d === todayDay() && pst.set && pst.set.prompts && pst.set.prompts.length && (!pst.done || (pst.i === 0 && !(pst.res && pst.res.length)))) {
    pst.done = 0;
    pst.ts = Date.now(); // v2.69.3: resume practice = aktivitas baru → panjangin jendela jawaban (fix AFK jawab kebuang ke AI)
    pst.mid = mid || pst.mid || 0;
    const j = await editView(env, chatId, mid || pst.mid, divePromptView(pst, L, pst.set));
    if (j && j.ok && j.result && j.result.message_id && j.result.message_id !== pst.mid) pst.mid = j.result.message_id;
    await putJSON(env, DIVE_PRAC_KEY + chatId, pst);
    return j;
  }
  const job = await getJSON(env, DIVE_JOB_KEY, null);
  const pend = job && job.prac && job.prac[chatId];
  if (pend && (pend.attempts || 0) < DIVE_GEN_ATTEMPTS && pend.mid) return editView(env, chatId, mid || pend.mid, { text: L.diveWait, markup: { inline_keyboard: [] } });
  const j0 = await editView(env, chatId, mid, { text: L.diveWait, markup: { inline_keyboard: [] } });
  const phMid = mid || ((j0 && j0.ok && j0.result && j0.result.message_id) || 0);
  await diveJobAdd(env, chatId, phMid, 1);
  return j0;
}

export async function diveIntercept(env, chatId, text, msg) {
  const t = String(text || "").trim();
  if (!t || t.startsWith("/")) return null;
  const day = todayDay();
  for (const prac of [0, 1]) {
    const key = (prac ? DIVE_PRAC_KEY : DIVE_STATE_KEY) + chatId;
    const st = await getJSON(env, key, null);
    if (!st || st.d !== day || st.done) continue;
    if (st.paused) return null;
    const L = await uiLang(env);
    if (Date.now() - (st.ts || 0) > DIVE_STALE_MS) {
      if (st.i === 0 && !(st.res && st.res.length)) {
        const set2 = prac ? st.set : ((await getJSON(env, DIVE_DAY_KEY + st.d, null)) || null);
        if (set2 && set2.prompts && set2.prompts[st.i]) {
          st.ts = Date.now();
          await putJSON(env, key, st);
          await editView(env, chatId, st.mid, divePromptView(st, L, set2));
          return null;
        }
      }
      await reply(env, chatId, L.diveWinClosed);
      await diveFinalize(env, chatId, st, key, L, 0);
      return null;
    }
    const set = prac ? st.set : ((await getJSON(env, DIVE_DAY_KEY + st.d, null)) || null);
    if (!set || !set.prompts || !set.prompts[st.i]) {
      await diveFinalize(env, chatId, st, key, L, 0);
      return null;
    }
    await diveJudge(env, chatId, st, key, set, t, L, msg && msg.message_id);
    return true;
  }
  return null;
}
