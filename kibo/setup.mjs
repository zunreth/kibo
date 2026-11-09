import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import readline from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const API = "https://api.cloudflare.com/client/v4";
const SAVED = join(HERE, "setup-saved.json");
const loadSaved = () => { try { return JSON.parse(readFileSync(SAVED, "utf8")); } catch { return null; } };
const warn = (m) => console.log("  ⚠ " + m);
const ALLOWED_UPDATES = ["message", "edited_message", "callback_query", "message_reaction"];
const SCHEMA_SQL = "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, val TEXT NOT NULL, exp INTEGER, updated INTEGER NOT NULL)";

const die = (m) => { console.error("\n✖ " + m); process.exit(1); };
const ok = (m) => console.log("  ✔ " + m);
const step = (m) => console.log("\n== " + m + " ==");

async function cf(token, method, path, body, isForm) {
  const headers = { Authorization: "Bearer " + token };
  let payload;
  if (body !== undefined) {
    if (isForm) { payload = body; }
    else { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  }
  const r = await fetch(API + path, { method, headers, body: payload });
  const j = await r.json().catch(() => ({}));
  if (!j.success) {
    const errs = (j.errors || []).map(e => e.code + " " + e.message).join("; ");
    throw new Error(`CF ${method} ${path} → ${r.status}: ${errs || r.statusText}`);
  }
  return j.result;
}
const tg = async (token, method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(`TG ${method} → ${j.description || r.status}`);
  return j.result;
};

async function ask(q, def) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = await new Promise(res => rl.question(q + (def ? ` [${def}] ` : " "), res));
  rl.close();
  return a.trim() || def || "";
}
const yn = async (q, def) => {
  for (;;) {
    const a = (await ask(q + " (y/n)", def)).toLowerCase();
    if (a === "y" || a === "yes" || a === "n" || a === "no") return a[0] === "y";
    console.log("  answer y or n");
  }
};

function printHelp() {
  console.log(`kibo installer — self-host on Cloudflare Workers

  node setup.mjs                    interactive prompts (offers to save credentials at the end;
                                    next runs prefill from setup-saved.json automatically)
  node setup.mjs --config f.json    non-interactive (fields: cfToken, tgToken, aiBase, aiKey, aiModel,
                                    accountId?, workerName?, searchKey?, lastfmKey?, lastfmUser?, sauceKey?,
                                    cron?, skipTg?)
  node setup.mjs --dry-run          print the plan, touch nothing
  node setup.mjs --update           pull the latest code from the repo and redeploy with the
                                    saved credentials (setup-saved.json; or --update --config f.json);
                                    skips when already up to date — add --force to redeploy anyway
  node setup.mjs --verify           live-check the saved keys (AI endpoint, Last.fm, search, SauceNAO, IG cookie)
  node setup.mjs --uninstall        remove the worker + its KV + its D1 (asks for confirmation;
                                    or --uninstall --config f.json with cfToken, workerName, confirm)
  node setup.mjs --help             this help

See SETUP.md for the full guide.`);
  process.exit(0);
}
async function uninstallFlow(cfgIn) {
  let cfToken, accountId = "", workerName = "", tgToken = "";
  if (cfgIn) {
    cfToken = cfgIn.cfToken; accountId = cfgIn.accountId || "";
    workerName = (cfgIn.workerName || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!cfToken || !workerName) die('--uninstall --config needs at least "cfToken" and "workerName"');
    if (cfgIn.confirm !== workerName) die(`confirm mismatch — add "confirm": "${workerName}" to the config to approve deletion`);
    tgToken = cfgIn.tgToken || "";
  } else {
    if (!process.stdin.isTTY) die("uninstall needs interactive confirmation — run it in a terminal (or use --uninstall --config f.json)");
    console.log("kibo uninstaller — removes the worker, its KV namespace and its D1 database (all bot data).\n");
    cfToken = await ask("Cloudflare API token (the one used to install):");
  }
  step("1/3 verify + find resources");
  const tok = await cf(cfToken, "GET", "/user/tokens/verify");
  ok(`token valid (${tok.status})`);
  if (!cfgIn) accountId = await ask("Account ID (empty = auto-pick if there's only one):", "");
  const acc = await pickAccount({ cfToken, accountId });
  if (!cfgIn) workerName = (await ask("Worker name to remove", "kibo")).replace(/[^a-zA-Z0-9_-]/g, "") || "kibo";
  let worker = false, kv = null, db = null;
  try { worker = (await cf(cfToken, "GET", `/accounts/${acc}/workers/scripts`)).some(s => s.id === workerName); } catch {}
  try { kv = (await cf(cfToken, "GET", `/accounts/${acc}/storage/kv/namespaces?per_page=100`)).find(n => n.title === workerName + "-kv") || null; } catch {}
  try { db = ((await cf(cfToken, "GET", `/accounts/${acc}/d1/database`)) || []).find(d => d.name === workerName + "-kv") || null; } catch {}
  if (!worker && !kv && !db) die(`nothing found for "${workerName}" — worker/KV/D1 all absent`);
  if (worker) ok(`worker found: ${workerName}`);
  if (kv) ok(`KV found: ${kv.title} (${kv.id})`);
  if (db) ok(`D1 found: ${db.name} (${db.uuid})`);
  step("2/3 confirm");
  if (!cfgIn) {
    const c = await ask(`type "${workerName}" to confirm deletion (anything else aborts):`);
    if (c !== workerName) die("aborted — nothing was deleted");
  }
  step("3/3 delete");
  if (worker) { await cf(cfToken, "DELETE", `/accounts/${acc}/workers/scripts/${workerName}`); ok(`worker ${workerName} deleted (its cron schedule goes with it)`); }
  if (db) { await cf(cfToken, "DELETE", `/accounts/${acc}/d1/database/${db.uuid}`); ok(`D1 ${db.name} deleted (all bot data gone)`); }
  if (kv) { await cf(cfToken, "DELETE", `/accounts/${acc}/storage/kv/namespaces/${kv.id}`); ok(`KV ${kv.title} deleted`); }
  if (!cfgIn) tgToken = await ask("Telegram bot token (optional — removes the webhook; empty = skip):", "");
  if (tgToken) {
    try { await tg(tgToken, "deleteWebhook"); ok("webhook removed"); }
    catch (e) { console.log("  ⚠ webhook cleanup skipped: " + e.message); }
  }
  console.log("\n✅ Uninstall complete. (The bot itself is NOT deleted — remove it in @BotFather if you want.)");
  if (existsSync(SAVED) && process.stdin.isTTY) {
    const del = await ask('Saved credentials file found (setup-saved.json). Type "y" to delete it too (empty = keep):');
    if (del.toLowerCase() === "y") { unlinkSync(SAVED); ok("setup-saved.json deleted"); }
  }
  process.exit(0);
}
async function loadConfig() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) printHelp();
  const dry = args.includes("--dry-run");
  const ci = args.includes("--config") ? args[args.indexOf("--config") + 1] : null;
  if (ci) {
    const base = loadSaved() || {};
    const c = Object.assign(base, JSON.parse(readFileSync(ci, "utf8")));
    for (const req of ["cfToken", "tgToken", "aiBase", "aiKey", "aiModel"])
      if (!c[req]) die(`config missing "${req}" (and no saved setup-saved.json to fall back on)`);
    c.dry = dry; c.cron ??= true; c.skipTg ??= false;
    c.accountId ??= ""; c.workerName ??= "kibo"; c.igCookie ??= ""; c.sauceKey ??= "";
    return c;
  }
  if (!process.stdin.isTTY) die("stdin is not interactive — use --config f.json or --help");
  const saved = loadSaved();
  if (saved) console.log("  ↩ saved credentials found (setup-saved.json) — press Enter on any prompt to reuse the saved value\n");
  console.log("kibo installer — you need: a Cloudflare account (free is enough), a bot from @BotFather, an OpenAI-compatible AI endpoint.\n");
  const c = {
    dry,
    cfToken: await ask("Cloudflare API token (perm: Workers Scripts/KV/D1 Edit):", (saved && saved.cfToken) || ""),
    accountId: await ask("Account ID (empty = auto-pick if there's only one):", (saved && saved.accountId) || ""),
    workerName: (await ask("Worker name", (saved && saved.workerName) || "kibo")).replace(/[^a-zA-Z0-9_-]/g, "") || "kibo",
    tgToken: await ask("Telegram bot token (from @BotFather, like 1234:AA...):", (saved && saved.tgToken) || ""),
    aiBase: await ask("AI_BASE — OpenAI-compatible endpoint (e.g. https://openrouter.ai/api/v1):", (saved && saved.aiBase) || ""),
    aiKey: await ask("AI_KEY — API key for the endpoint above:", (saved && saved.aiKey) || ""),
    aiModel: await ask("AI_MODEL — model id (e.g. anthropic/claude-... or your provider's):", (saved && saved.aiModel) || ""),
    searchKey: await ask("SEARCH_KEY (optional — web-search key for the AI's live web tool: a Tavily key (tavily.com, starts with tvly-) or a Serper key (serper.dev).\n  Without it the bot falls back to free sources (DuckDuckGo / Wikipedia / news feeds) that can be flaky from Cloudflare; empty = skip):", (saved && saved.searchKey) || ""),
    lastfmKey: await ask("LASTFM_KEY (optional, empty = skip music features):", (saved && saved.lastfmKey) || ""),
    lastfmUser: await ask("LASTFM_USER (optional, default last.fm username):", (saved && saved.lastfmUser) || ""),
    igCookie: await ask("IG_COOKIE (optional — Instagram login cookie so /dl can fetch restricted/age-gated posts. Paste EITHER the full 'Cookie' request header of the instagram.com page request (preferred) OR just your sessionid value.\n  How: desktop browser logged in → F12 DevTools → Network tab → reload instagram.com → click the top request (document) → Request Headers → copy the whole 'cookie:' value — sessionid is httpOnly, it only shows there, document.cookie won't. Your account = your risk; empty = skip):", (saved && saved.igCookie) || ""),
    sauceKey: await ask("SAUCE_KEY (optional — a free SauceNAO API key (saucenao.com, ~100 searches/day) so /sauce can reverse-search image sources; empty = /sauce answers 'not configured'):", (saved && saved.sauceKey) || ""),
    cron: true,
  };
  if (!c.cfToken || !c.tgToken || !c.aiBase || !c.aiKey || !c.aiModel) die("a required field is empty");
  c.cron = await yn("Enable cron (reminder/digest/dive/auto-resurface need this)?", saved && saved.cron === false ? "n" : "y");
  return c;
}

async function pickAccount(cfg) {
  if (cfg.accountId) return cfg.accountId;
  const accs = await cf(cfg.cfToken, "GET", "/accounts?per_page=50");
  if (accs.length === 1) { ok(`account: ${accs[0].name}`); return accs[0].id; }
  console.log("  multiple accounts found:");
  accs.forEach((a, i) => console.log(`   ${i + 1}. ${a.name} (${a.id})`));
  const i = parseInt(await ask("pick a number:", "1"), 10) - 1;
  if (!(i >= 0 && i < accs.length)) die("invalid number");
  return accs[i].id;
}
async function kvId(cfg, acc, name) {
  const list = await cf(cfg.cfToken, "GET", `/accounts/${acc}/storage/kv/namespaces?per_page=100`);
  const found = list.find(n => n.title === name);
  if (found) { ok(`KV reuse: ${name} (${found.id})`); return found.id; }
  const made = await cf(cfg.cfToken, "POST", `/accounts/${acc}/storage/kv/namespaces`, { title: name });
  ok(`KV created: ${name} (${made.id})`);
  return made.id;
}
async function d1Uuid(cfg, acc, name) {
  const list = await cf(cfg.cfToken, "GET", `/accounts/${acc}/d1/database`);
  const found = (list || []).find(d => d.name === name);
  if (found) { ok(`D1 reuse: ${name} (${found.uuid})`); return found.uuid; }
  const made = await cf(cfg.cfToken, "POST", `/accounts/${acc}/d1/database`, { name });
  ok(`D1 created: ${name} (${made.uuid})`);
  return made.uuid;
}
async function setSecret(cfg, acc, worker, name, text) {
  if (!text) return;
  await cf(cfg.cfToken, "PUT", `/accounts/${acc}/workers/scripts/${worker}/secrets`, { name, text: String(text), type: "secret_text" });
  ok(`secret ${name} ok`);
}
async function bundle() {
  let esbuild;
  try { esbuild = (await import("esbuild")).default; }
  catch { die("esbuild missing — run: cd kibo && npm install"); }
  await esbuild.build({
    entryPoints: [join(HERE, "worker.js")],
    bundle: true, format: "esm", target: "es2022",
    outfile: join(HERE, "dist", "worker.js"),
    logLevel: "warning", charset: "utf8",
  });
  ok(`bundle ok: ${existsSync(join(HERE, "dist", "worker.js")) ? "dist/worker.js" : "?"}`);
}
async function deployScript(cfg, acc, kvNs, dbUuid, hookPath) {
  const code = readFileSync(join(HERE, "dist", "worker.js"));
  const meta = {
    main_module: "worker.js",
    workers_dev: true,
    compatibility_date: "2025-12-01",
    bindings: [
      { type: "ai", name: "AI" },
      { type: "kv_namespace", name: "KV", namespace_id: kvNs },
      { type: "d1", name: "DB", id: dbUuid },
      { type: "secret_text", name: "HOOK_PATH", text: hookPath },
    ],
  };
  const b = "----kibosetup" + Date.now();
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("worker.js", new Blob([code], { type: "application/javascript+module" }), "worker.js");
  await cf(cfg.cfToken, "PUT", `/accounts/${acc}/workers/scripts/${cfg.workerName}`, form, true);
  ok(`worker ${cfg.workerName} deploy ok (${code.length} B)`);
}
async function verifyKeys(cfg, interactive) {
  step("0/7 live key checks (a secret can be SET but still wrong)");
  let base = (cfg.aiBase || "").trim().replace(/\/+$/, "");
  let tries = 0;
  const savedBase = () => { const s = loadSaved(); return (s && s.aiBase) || ""; };
  while (interactive && !/^https:\/\/\S+$/.test(base) && tries < 3) {
    warn("AI_BASE looks wrong — it must be a full https URL, e.g. https://openrouter.ai/api/v1");
    base = (await ask("AI_BASE — OpenAI-compatible endpoint:", savedBase())).trim().replace(/\/+$/, "");
    tries++;
  }
  if (base !== (cfg.aiBase || "").trim().replace(/\/+$/, "")) cfg.aiBase = base;
  if (!/^https:\/\/\S+$/.test(base)) warn(`AI_BASE "${base}" is not a valid https URL — chat & AI features WILL fail. Re-run the installer to fix it.`);
  else try {
    const r = await fetch(base + "/models", { headers: { authorization: "Bearer " + cfg.aiKey }, signal: AbortSignal.timeout(12000) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.data) {
      const n = j.data.length;
      ok(`AI endpoint verified (${base})${n ? " — " + n + " models listed" : ""}`);
      if (n && !j.data.some(m => String(m.id) === cfg.aiModel)) warn(`model "${cfg.aiModel}" is not in the endpoint's /models list — double-check the id (some endpoints don't list everything, so this is a hint, not a verdict)`);
    }
    else if (r.status === 401 || r.status === 403) warn(`AI key REJECTED (HTTP ${r.status}) — chat & AI features WILL fail`);
    else warn(`AI endpoint reachable but /models check inconclusive (HTTP ${r.status}) — some providers don't serve it`);
  } catch { warn("AI endpoint unreachable from this machine — can't verify (some endpoints block datacenter IPs; the deploy itself is unaffected)"); }
  if (cfg.lastfmKey) {
    try {
      const j = await (await fetch("https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=" + encodeURIComponent(cfg.lastfmKey) + "&format=json&limit=1", { signal: AbortSignal.timeout(12000) })).json().catch(() => null);
      if (j && j.tracks) ok("LASTFM_KEY verified");
      else warn("LASTFM_KEY invalid (Last.fm error " + (j && j.error) + ") — music features WILL fail");
    } catch { warn("Last.fm unreachable — can't verify LASTFM_KEY"); }
    const u = (cfg.lastfmUser || "").trim();
    if (!u) warn("LASTFM_USER not set — /np, /wrap and the song games NEED a username that has scrobbles");
    else try {
      const j = await (await fetch("https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=" + encodeURIComponent(u) + "&api_key=" + encodeURIComponent(cfg.lastfmKey) + "&format=json&limit=1", { signal: AbortSignal.timeout(12000) })).json().catch(() => null);
      if (j && j.error) warn(`LASTFM_USER "${u}" not found (Last.fm error ${j.error}) — /wrap etc. WILL fail`);
      else if (j && j.recenttracks) {
        const tot = j.recenttracks["@attr"] ? parseInt(j.recenttracks["@attr"].total, 10) || 0 : 0;
        if (tot) ok(`LASTFM_USER verified: ${u} (${tot} scrobbles)`);
        else warn(`LASTFM_USER "${u}" exists but has ZERO scrobbles — /wrap will refuse to build. Use the account that actually scrobbles.`);
      } else warn("LASTFM_USER check inconclusive");
    } catch { warn("Last.fm unreachable — can't verify LASTFM_USER"); }
  }
  if (cfg.searchKey) try {
    let r, j;
    if (String(cfg.searchKey).indexOf("tvly-") === 0) {
      r = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + cfg.searchKey }, body: JSON.stringify({ query: "hello", max_results: 1 }), signal: AbortSignal.timeout(15000) });
      j = await r.json().catch(() => null);
      if (r.ok && j && j.results) ok("SEARCH_KEY verified (Tavily)");
      else warn("SEARCH_KEY problem (Tavily HTTP " + r.status + ") — search falls back to free sources");
    } else {
      r = await fetch("https://google.serper.dev/search", { method: "POST", headers: { "content-type": "application/json", "X-API-KEY": cfg.searchKey }, body: JSON.stringify({ q: "hello", num: 1 }), signal: AbortSignal.timeout(15000) });
      j = await r.json().catch(() => null);
      if (r.ok && j && j.organic) ok("SEARCH_KEY verified (Serper)");
      else warn("SEARCH_KEY problem (Serper HTTP " + r.status + ") — search falls back to free sources");
    }
  } catch { warn("search provider unreachable — can't verify SEARCH_KEY"); }
  if (cfg.igCookie) try {
    const ck = String(cfg.igCookie).includes("=") ? String(cfg.igCookie) : "sessionid=" + String(cfg.igCookie).trim();
    const r = await fetch("https://i.instagram.com/api/v1/media/4008957891690944308/info/", { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", "x-ig-app-id": "936619743392459", "x-requested-with": "XMLHttpRequest", accept: "*/*", cookie: ck }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.items) ok("IG_COOKIE verified (media info returned items)");
    else if (j && (j.message === "login_required" || j.error_type === "auth")) warn("IG_COOKIE is DEAD/invalid (login_required) — /dl for restricted posts WILL fail; re-grab the cookie");
    else if (r.status === 404) warn("IG_COOKIE did not grant access (404) — invalid/malformed cookie. Paste the full Cookie request header (no 'cookie:' label, no quotes, one line) or just the sessionid value");
    else if (r.status === 429) warn("Instagram rate-limited the check (429) — cookie NOT verified either way; re-run --verify later");
    else warn("IG_COOKIE can't be confirmed (HTTP " + r.status + ")");
  } catch { warn("Instagram unreachable — can't verify IG_COOKIE"); }
  if (cfg.sauceKey) try {
    const r = await fetch("https://saucenao.com/search.php?output_type=2&numres=1&db=999&api_key=" + encodeURIComponent(cfg.sauceKey) + "&testmode=1&url=" + encodeURIComponent("https://i.imgur.com/Ad86rhT.jpg"), { signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => null);
    const st = j && j.header && j.header.status;
    if (st > 0) ok("SAUCE_KEY verified (SauceNAO account type " + (j.header.account_type) + ", " + (j.header.long_limit) + "/day)");
    else if (st !== undefined && st < 0) warn("SAUCE_KEY REJECTED by SauceNAO (status " + st + ": " + (j.header.message || "") + ") — /sauce will answer 'not configured key'");
    else warn("SauceNAO check inconclusive (HTTP " + r.status + ") — /sauce may still work");
  } catch { warn("SauceNAO unreachable — can't verify SAUCE_KEY"); }
  return cfg;
}
async function updateFlow(cfgIn, force) {
  const cfg = Object.assign({}, loadSaved() || {}, cfgIn || {});
  if (!cfg.cfToken || !cfg.tgToken || !cfg.aiBase || !cfg.aiKey || !cfg.aiModel)
    die("update needs full credentials — run the installer once and save them (setup-saved.json), or pass --update --config f.json");
  step("1/2 update code from the repo");
  let mode = "";
  let updated = false;
  if (existsSync(join(ROOT, ".git"))) {
    const g = (args) => spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });
    const remote = (g(["remote", "get-url", "origin"]).stdout || "").trim();
    if (remote.indexOf("kibo") !== -1) {
      const fetch = g(["fetch", "origin", "main"]);
      if (fetch.status === 0) {
        const head = (g(["rev-parse", "HEAD"]).stdout || "").trim();
        const target = (g(["rev-parse", "origin/main"]).stdout || "").trim();
        if (!force && head && target && head === target) {
          mode = "git";
          ok(`code already up to date @ ${head.slice(0, 7)} (origin/main)`);
        } else {
          const rst = g(["reset", "--hard", "origin/main"]);
          if (rst.status === 0) {
            mode = "git";
            updated = true;
            const sha = (g(["rev-parse", "--short", "HEAD"]).stdout || "").trim();
            ok(`code updated: git reset to origin/main @ ${sha}`);
          } else console.log("  ⚠ git reset failed (" + (rst.stderr || "unknown") + ") — trying tarball");
        }
      } else console.log("  ⚠ git fetch failed (" + (fetch.stderr || "unknown") + ") — trying tarball");
    } else console.log("  ⚠ origin remote is not the kibo repo (" + remote + ") — using tarball");
  }
  if (!mode && !force) {
    let remoteVer = "";
    try {
      const rv = await fetch("https://raw.githubusercontent.com/ruqes/kibo/main/kibo/src/consts.js");
      if (rv.ok) remoteVer = ((await rv.text()).match(/BOT_VER\s*=\s*"([^"]*)"/) || ["", ""])[1];
    } catch {}
    let localVer = "";
    try { localVer = (readFileSync(join(ROOT, "kibo", "src", "consts.js"), "utf8").match(/BOT_VER\s*=\s*"([^"]*)"/) || ["", ""])[1]; } catch {}
    if (remoteVer && localVer && remoteVer === localVer) {
      mode = "tar";
      ok(`code already up to date (version ${localVer})`);
    }
  }
  if (!mode) {
    const r = await fetch("https://codeload.github.com/ruqes/kibo/tar.gz/refs/heads/main");
    if (!r.ok) die(`failed to fetch the repo tarball (HTTP ${r.status})`);
    const tmp = mkdtempSync(join(tmpdir(), "kibo-up-"));
    const tgz = join(tmp, "kibo.tar.gz");
    writeFileSync(tgz, Buffer.from(await r.arrayBuffer()));
    const t = spawnSync("tar", ["-xzf", tgz, "-C", tmp], { encoding: "utf8" });
    if (t.status !== 0) die("tar extract failed — is 'tar' on PATH? (or clone the repo with git and re-run --update)");
    cpSync(join(tmp, "kibo-main"), ROOT, { recursive: true });
    rmSync(tmp, { recursive: true, force: true });
    updated = true;
    ok("code updated: tarball ruqes/kibo@main (setup-saved.json, node_modules, dist untouched)");
  }
  if (mode && !updated && !force) {
    ok("already up to date — nothing to redeploy (use --force to redeploy anyway)");
    return;
  }
  step("2/2 redeploy with the saved credentials");
  let cfgPath = SAVED;
  let tmpCfg = null;
  if (cfgIn) {
    tmpCfg = join(tmpdir(), "kibo-cfg-" + Date.now() + ".json");
    writeFileSync(tmpCfg, JSON.stringify(cfg));
    chmodSync(tmpCfg, 0o600);
    cfgPath = tmpCfg;
  }
  const child = spawnSync(process.execPath, [join(HERE, "setup.mjs"), "--config", cfgPath], { stdio: "inherit", cwd: HERE });
  if (tmpCfg) rmSync(tmpCfg, { force: true });
  process.exit(child.status || 0);
}
async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--update")) {
    if (argv.includes("--config")) {
      const ci = argv[argv.indexOf("--config") + 1];
      if (!ci) die("--config needs a file path");
      await updateFlow(JSON.parse(readFileSync(ci, "utf8")), argv.includes("--force"));
    } else await updateFlow(null, argv.includes("--force"));
    return;
  }
  if (argv.includes("--verify")) {
    let base = loadSaved() || {};
    if (argv.includes("--config")) {
      const ci = argv[argv.indexOf("--config") + 1];
      if (!ci) die("--config needs a file path");
      base = Object.assign(base, JSON.parse(readFileSync(ci, "utf8")));
    }
    if (!base.cfToken && !base.aiKey) die("nothing to verify — run the installer first (or --verify --config f.json)");
    await verifyKeys(base, false);
    return;
  }
  if (argv.includes("--uninstall")) {
    if (argv.includes("--config")) {
      const ci = argv[argv.indexOf("--config") + 1];
      if (!ci) die("--config needs a file path");
      await uninstallFlow(JSON.parse(readFileSync(ci, "utf8")));
    } else await uninstallFlow();
    return;
  }
  const cfg = await loadConfig();
  if (cfg.dry) { step("DRY-RUN — nothing will be written"); console.log(JSON.stringify({ ...cfg, cfToken: "***", tgToken: "***", aiKey: "***" }, null, 2)); return; }
  await verifyKeys(cfg, process.stdin.isTTY && !argv.includes("--config"));

  step("1/7 Cloudflare token");
  const tok = await cf(cfg.cfToken, "GET", "/user/tokens/verify");
  ok(`token valid (${tok.status})`);
  const acc = await pickAccount(cfg);

  step("2/7 KV + D1 + schema");
  const kvNs = await kvId(cfg, acc, cfg.workerName + "-kv");
  const dbUuid = await d1Uuid(cfg, acc, cfg.workerName + "-kv");
  await cf(cfg.cfToken, "POST", `/accounts/${acc}/d1/database/${dbUuid}/query`, { sql: SCHEMA_SQL });
  ok("kv schema ready");

  step("3/7 bundle + deploy worker");
  await bundle();
  const hookPath = randomBytes(12).toString("hex");
  await deployScript(cfg, acc, kvNs, dbUuid, hookPath);

  step("4/7 subdomain + cron");
  const sub = await cf(cfg.cfToken, "GET", `/accounts/${acc}/workers/subdomain`);
  await cf(cfg.cfToken, "POST", `/accounts/${acc}/workers/scripts/${cfg.workerName}/subdomain`, { enabled: true });
  const selfBase = `https://${cfg.workerName}.${sub.subdomain}.workers.dev`;
  ok(`subdomain: ${selfBase}`);
  if (cfg.cron) {
    await cf(cfg.cfToken, "PUT", `/accounts/${acc}/workers/scripts/${cfg.workerName}/schedules`, [{ cron: "* * * * *" }]);
    ok("cron * * * * * installed (reminder/digest/dive/auto-resurface alive)");
  } else ok("cron skip (config cron=false)");

  step("5/7 secrets");
  await setSecret(cfg, acc, cfg.workerName, "TG_TOKEN", cfg.tgToken);
  await setSecret(cfg, acc, cfg.workerName, "SELF_BASE", selfBase);
  await setSecret(cfg, acc, cfg.workerName, "AI_BASE", cfg.aiBase);
  await setSecret(cfg, acc, cfg.workerName, "AI_KEY", cfg.aiKey);
  await setSecret(cfg, acc, cfg.workerName, "AI_MODEL", cfg.aiModel);
  await setSecret(cfg, acc, cfg.workerName, "SEARCH_KEY", cfg.searchKey);
  await setSecret(cfg, acc, cfg.workerName, "LASTFM_KEY", cfg.lastfmKey);
  await setSecret(cfg, acc, cfg.workerName, "LASTFM_USER", cfg.lastfmUser);
  await setSecret(cfg, acc, cfg.workerName, "IG_COOKIE", cfg.igCookie);
  await setSecret(cfg, acc, cfg.workerName, "SAUCE_KEY", cfg.sauceKey);

  step("6/7 Telegram webhook + commands");
  let me = null;
  if (cfg.skipTg) { ok("skipTg — skipping all TG steps (CF-only test mode)"); }
  else {
    me = await tg(cfg.tgToken, "getMe");
    ok(`bot: @${me.username}`);
    await tg(cfg.tgToken, "setWebhook", { url: `${selfBase}/hook/${hookPath}`, allowed_updates: ALLOWED_UPDATES });
    ok("setWebhook ok (allowed_updates: " + ALLOWED_UPDATES.join(", ") + ")");
    const cmdsPath = join(ROOT, "commands.json");
    if (existsSync(cmdsPath)) {
      const commands = JSON.parse(readFileSync(cmdsPath, "utf8"));
      await tg(cfg.tgToken, "setMyCommands", { commands });
      ok(`setMyCommands ok (${commands.length} commands)`);
    } else ok("commands.json missing — skipping (bot still runs, just an empty TG menu)");
  }

  step("7/7 verify");
  const hb = await (async () => {
    for (let i = 0; i < 3; i++) {
      try { const t = await (await fetch(selfBase + "/", { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" } })).text(); if (t.includes("kibo alive")) return t; } catch {}
      await new Promise(r => setTimeout(r, 4000));
    }
    return "";
  })();
  if (hb.includes("kibo alive")) ok(`health: "kibo alive"`);
  else console.log(`  ⚠ health check got no reply from this machine (network/undici can block it — the CF deploy itself succeeded). Check manually: curl ${selfBase}/`);
  if (!cfg.skipTg) {
    const wh = await tg(cfg.tgToken, "getWebhookInfo");
    if (wh.last_error_message) console.log("  ⚠ webhook last_error: " + wh.last_error_message);
    ok(`webhook: ${wh.url || "?"} (pending ${wh.pending_update_count ?? 0})`);
  }
  console.log(`
✅ DONE.${cfg.skipTg ? " (skipTg mode — rerun with a real tgToken to finish the TG steps)" : " Now DM your bot (@" + me.username + ") — /start to begin."}
   Notes:
   • Optional-key features fail honestly when the key is missing (see SETUP.md).
   • /dl for restricted IG content: optional, needs your own session cookie = your own risk & responsibility.
   • Re-run this installer anytime to update the code (your D1/KV data is untouched).
`);
  if (process.stdin.isTTY) {
    const want = await yn("Save these credentials to setup-saved.json next to setup.mjs? (next run prefills automatically; local file only, chmod 600, never uploaded)", "n");
    if (want) {
      writeFileSync(SAVED, JSON.stringify(cfg, null, 2));
      chmodSync(SAVED, 0o600);
      ok("credentials saved: setup-saved.json (delete the file to forget)");
    }
  }
}
main().catch(e => die(e.message));
