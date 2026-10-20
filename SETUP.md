# Self-hosting kibo

A personal companion bot for Telegram — AI chat with memory, RP/character bonds, daily quests, economy (points/gacha/badges), mini-games, daily dive quiz, media downloader, and a life suite (focus/sleep/habits/reminders/alarms). Runs **100% on Cloudflare Workers** (free tier is fine) — no VPS, no server to maintain.

## Requirements

| Thing | Notes |
|---|---|
| Node.js ≥ 20 | for the installer only; the bot itself lives on Cloudflare |
| Cloudflare account | free plan is enough (Workers + KV + D1 + Workers AI) |
| Cloudflare API token | permissions: **Workers Scripts Edit · Workers KV Storage Edit · D1 Edit · Account Settings Read** (create at dash.cloudflare.com → My Profile → API Tokens) |
| Telegram bot | talk to [@BotFather](https://t.me/BotFather) → `/newbot` → keep the token |
| AI endpoint | any **OpenAI-compatible** `chat/completions` API (OpenRouter, Gemini-OpenAI-compat, a self-hosted LLM, etc.) — base URL + key + model id |

## Quickstart

```bash
git clone https://github.com/ruqes/kibo && cd kibo
cd kibo && npm install
node setup.mjs            # interactive; or: node setup.mjs --config my.json
```

The installer asks for the tokens above, then provisions everything on your own Cloudflare account (KV namespace, D1 database + schema, the Worker, cron, secrets, Telegram webhook, command list) and verifies the result. When it prints ✅ — open your bot in Telegram and send `/start`.

Re-running `node setup.mjs` later = safe update: code is replaced, **your data (D1/KV) is never touched**.

## Optional keys — what you get / what degrades

Everything degrades **honestly**: without an optional key the related features answer with a clear "not configured" instead of pretending.

| Secret | Unlocks | Without it |
|---|---|---|
| `SEARCH_KEY` | the AI's `web_search` tool (live facts, news, prices, schedules) — accepts a **Tavily** key (`tvly-…`, tavily.com) **or** a **Serper** key (serper.dev) | free keyless fallbacks only (DuckDuckGo / Wikipedia / news feeds) — often flaky from Cloudflare's IPs |
| `LASTFM_KEY` (+ optional `LASTFM_USER`) | music: now-playing inject + `/np`, `/wrap`, song-games pools, lyric quiz | music features report missing key |
| `IG_COOKIE` | `/dl` for **restricted/age-gated** Instagram posts | public IG/TikTok/YouTube downloads still work |
| cron (on by default) | reminders, daily digest, quests, `/dive` auto-gen, memory resurface, `/alarm`, countdown alerts | cron-dependent features idle until you enable it |

**About `IG_COOKIE`:** it is *your own* Instagram session cookie and using it is **your choice and your risk**. Bot traffic can flag the account; if Instagram invalidates the session the bot tells you (`/dl` → auth-failed message) and you refresh the cookie. Never ship a cookie that isn't yours. **What to paste:** either the **full `Cookie` request header** (preferred — carries `sessionid` plus the device/csrf fields) or **just the `sessionid` value** (`sessionid=…` or the bare value — the bot wraps it either way). `sessionid` is httpOnly, so it only appears in DevTools → Network → the top `instagram.com` document request → Request Headers → `cookie:` — `document.cookie` in the console will NOT show it. Alternative: right-click that request → Copy → Copy as cURL, and keep the part after `-b`/`--cookie`.

## What the bot stores (privacy)

Everything lives in **your** Cloudflare account: one D1 table (`kv`) + one KV namespace. Chats, memories, game state, links — all yours, nothing shared with the author. Outbound calls: Telegram API, your AI endpoint, and the public upstreams for the features you use (Last.fm, Wikipedia, media resolvers).

## Configuration reference

Interactive prompts cover everything; non-interactive uses a JSON file:

```json
{
  "cfToken": "...",       // required — Cloudflare API token
  "tgToken": "...",       // required — from @BotFather
  "aiBase": "https://openrouter.ai/api/v1", // required — OpenAI-compatible base
  "aiKey": "...",         // required
  "aiModel": "...",       // required — model id your endpoint serves
  "accountId": "",        // optional — auto-picked when your token sees one account
  "workerName": "kibo", // optional
  "searchKey": "", "lastfmKey": "", "lastfmUser": "", "igCookie": "",  // optional
  "cron": true,           // optional — per-minute cron (reminders/digest/dive/…)
  "skipTg": false         // optional — skip Telegram steps (CF-only test)
}
```

**Credential reuse:** at the end of an interactive run the installer offers to save everything to `kibo/setup-saved.json` (chmod 600, local only — it is git-ignored and never uploaded). Future runs prefill from it: interactive prompts just need Enter, and `--config` files only need the fields that changed (the saved file fills the rest). Delete the file to forget; `--uninstall` offers to remove it too.

Env knobs the bot reads at runtime (all optional, sane defaults): `DL_SIZE_TIMEOUT_MS`, `RSS_TIMEOUT_MS`, `GEN_WATCHDOG_MAX_MS`, `WD_STALL_MS`, `DIVE_GEN_TIMEOUT_MS`, `REL_GAP_MS`, `SFNOPE_MS`, `PROBE_DEL_MS`.

## Troubleshooting

- **Bot totally silent** → `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` — 409 means another app holds the webhook; re-run the installer.
- **Installer health-check warning** — the CF deploy itself succeeded; verify with `curl https://<worker>.<subdomain>.workers.dev/` (some networks/Corporate proxies block Node's fetch).
- **AI replies fail** — check `AI_BASE` includes `/v1` and the model id matches what your provider serves.
- **Something feels off about a key** → `node setup.mjs --verify` live-checks every saved key (AI endpoint, Last.fm key + user, search key, IG cookie) and tells you exactly what will fail. The installer runs the same checks during setup — "secret ok" only ever meant *stored*, the `0/7` checks are what tell you it's *valid*.
- **Cron features quiet** — confirm the schedule exists (Dashboard → Workers → your worker → Triggers).

## Updating

```bash
node setup.mjs --update
```

Pulls the latest code from this repo (a `git fetch` + hard reset when you cloned; the repo tarball otherwise) and redeploys with your saved credentials — **your bot data in D1/KV is untouched**. Requires `kibo/setup-saved.json` (the installer offers to create it at the end of an interactive run) or pass `--update --config f.json` with the full config.

## Uninstalling

```bash
node setup.mjs --uninstall
```

It removes the worker, its KV namespace, its D1 database (all bot data) and — if you paste the bot token — the Telegram webhook. It asks you to type the worker name to confirm. For headless/automation use, pass a config file instead:

```bash
node setup.mjs --uninstall --config un.json   # {"cfToken": "...", "workerName": "kibo", "confirm": "kibo"}
```

The Telegram bot itself is not deleted — remove it in @BotFather if you want it gone too.

## Disclaimer

This software is provided **as is, without warranty of any kind**. You host it, on your own accounts, with your own keys — **you are responsible for how you use it**, including what `/dl` downloads (third-party platform terms and your local law apply to you). The authors are not liable for any misuse, account flags, or damages.
