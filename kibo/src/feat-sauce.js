import { esc, tg, reply, tgFileBytes } from "./base.js";
import { uiLang } from "./ui.js";
import { UA } from "./consts.js";

const sauceTmo = env => AbortSignal.timeout(parseInt((env && env.SAUCE_TIMEOUT_MS) || "", 10) || 25000);

async function litterUpload(env, bytes) {
  try {
    const fd = new FormData();
    fd.append("reqtype", "fileupload");
    fd.append("time", "1h");
    fd.append("fileToUpload", new Blob([bytes], { type: "image/jpeg" }), "img.jpg");
    const r = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", { method: "POST", body: fd, signal: sauceTmo(env) });
    const t = (await r.text()).trim();
    return /^https?:\/\/\S+$/.test(t) ? t : null;
  } catch (_) { return null; }
}

async function sauceQuery(env, key, bytes, hostedUrl) {
  const q = "db=999&output_type=2&numres=5&api_key=" + encodeURIComponent(key);
  let r;
  if (hostedUrl) r = await fetch("https://saucenao.com/search.php?" + q + "&url=" + encodeURIComponent(hostedUrl), { headers: { "user-agent": UA }, signal: sauceTmo(env) });
  else {
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: "image/jpeg" }), "img.jpg");
    r = await fetch("https://saucenao.com/search.php?" + q, { method: "POST", body: fd, headers: { "user-agent": UA }, signal: sauceTmo(env) });
  }
  return r.json().catch(() => null);
}

function sauceRows(j) {
  const rs = (j && Array.isArray(j.results) ? j.results : []).slice(0, 3).map(r => ({
    sim: Math.round(parseFloat((r.header && r.header.similarity) || "0") * 10) / 10,
    name: String((r.header && r.header.index_name) || "?").trim(),
    title: String((r.data && r.data.title) || "").slice(0, 70),
    member: String((r.data && r.data.member_name) || "").slice(0, 40),
    url: (r.data && r.data.ext_urls && r.data.ext_urls[0]) || ""
  }));
  const lines = [];
  const rows = [];
  rs.forEach((r, i) => {
    const bits = ["<b>" + r.sim.toFixed(1) + "%</b>", esc(r.name)];
    if (r.title) bits.push(esc(r.title));
    if (r.member) bits.push("(" + esc(r.member) + ")");
    lines.push((i + 1) + ". " + bits.join(" · "));
    if (r.url) rows.push([{ text: (i + 1) + " · " + r.name.slice(0, 24), url: r.url }]);
  });
  return { rs, lines, rows };
}

async function sauceSearch(env, chatId, fileId, L0) {
  const L = L0 || (await uiLang(env));
  if (!env.SAUCE_KEY) return reply(env, chatId, L.sauceNoKey);
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  let bytes = null;
  try { bytes = await tgFileBytes(env, fileId); } catch (_) { bytes = null; }
  if (!bytes) return reply(env, chatId, L.sauceFail);
  const pj = await reply(env, chatId, L.sauceWait);
  const phMid = pj && pj.ok && pj.result ? pj.result.message_id : 0;
  const fin = (text, kb) => tg(env, phMid ? "editMessageText" : "sendMessage", phMid
    ? { chat_id: chatId, message_id: phMid, text, parse_mode: "HTML", reply_markup: kb }
    : { chat_id: chatId, text, parse_mode: "HTML", reply_markup: kb });

  let j = await sauceQuery(env, env.SAUCE_KEY, bytes, null).catch(() => null);
  let hostUrl = null;
  if (!j || !j.results) {
    hostUrl = await litterUpload(env, bytes);
    if (hostUrl) j = await sauceQuery(env, env.SAUCE_KEY, bytes, hostUrl).catch(() => null);
  }

  if (j && j.header && typeof j.header.status === "number" && j.header.status < 0)
    return fin(L.sauceErr(esc(String(j.header.message || "limit")).slice(0, 140)), { inline_keyboard: [] });

  const { rs, lines, rows } = sauceRows(j);
  if (!rs.length) return fin(L.sauceNone, { inline_keyboard: [] });

  let lens = null;
  if (hostUrl) lens = "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(hostUrl);
  else {
    const u2 = await litterUpload(env, bytes);
    if (u2) lens = "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(u2);
  }
  if (lens) rows.push([{ text: L.sauceLensBtn, url: lens }]);
  return fin(L.sauceHead(rs.length) + "\n" + lines.join("\n"), { inline_keyboard: rows });
}

export async function handleSaucePhoto(env, msg, chatId) {
  const sizes = msg.photo || [];
  const best = sizes[sizes.length - 1];
  if (!best) return reply(env, chatId, (await uiLang(env)).sauceUsage);
  return sauceSearch(env, chatId, best.file_id);
}

export async function handleSauceCmd(env, msg, chatId) {
  const L = await uiLang(env);
  const rp = msg.reply_to_message;
  const fid = rp && rp.photo && rp.photo.length ? rp.photo[rp.photo.length - 1].file_id : null;
  if (!fid) return reply(env, chatId, L.sauceUsage);
  return sauceSearch(env, chatId, fid, L);
}
