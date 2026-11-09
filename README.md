# kibo — a personal companion bot for Telegram

AI chat with real memory, character bonds, daily quests, an economy, mini-games, a daily quiz, a media downloader and a life suite — self-hosted **entirely on Cloudflare Workers** (free tier is enough). No VPS, no database server, no process to babysit.

**Single-owner by design:** one instance = one owner. The first person who DMs the bot claims it (or pin it with `OWNER_FALLBACK`). Want your friends to have one? Point them here — each person hosts their own instance with their own keys.

**Install/update in one script:** `kibo/setup.mjs` provisions everything on your Cloudflare account — KV + D1 + schema, the Worker with cron, all secrets, the Telegram webhook, and the live command menu. Re-running it later is a **safe update**: your data (D1/KV) is never touched.

## Features

| Area | Highlights |
|---|---|
| 💬 Chat & bonds | streaming AI chat with rolling memory + summaries, character cards (`/char`), persona (`/me`), roleplay knobs (`/vibe /outfit /plot /dice /ooc`), story snapshots (`/rp save/load`), jealousy, chapter titles |
| 🔁 Daily loop | daily quest + streaks + shields, **Daily Dive** (`/dive` — ranked rare-answer quiz), morning digest, good-morning alarm (`/alarm`), weekly memory recap, countdowns |
| 🧠 Memory | `/remember` facts (manual + a daily auto-extract pass), `/mems` with age & provenance, `/export` conversation as md/json, `/undo` rewinds context, `/brief` planned |
| 🎮 Games | word game (solo + PvP), quick quiz, song quiz with real audio previews, real-fan artist mode, lyric quiz with **real lyrics** |
| 🛍️ Economy | points wallet, loot crates, bets, shop + inventory, gacha with pity + charms, 22 achievements, vault bookmarking (`/bm`) |
| 📥 Media | `/dl` — TikTok / Instagram / YouTube (+ resolver chain, restricted-IG via your own session cookie), `/song`, `/spotify`, reverse image search (`/sauce`, needs a free SauceNAO key) |
| 🌱 Life suite | focus timer, sleep log, habits, expense log, future capsules, reminders with nag chains |
| 🧰 Tools | web search, Wikipedia on-this-day, RSS feeds, weather, anime/manga lookup, Last.fm now-playing + Wrapped, reading list, link shortener, pastebin, OTP email companion* |

\* the email-OTP companion worker is not part of the public release yet.

Default language: English (`/lang` switches the UI to Indonesian). AI cost discipline: deterministic features use **0 AI calls**; the rest are capped per day.

## Quickstart

```bash
git clone https://github.com/ruqes/kibo && cd kibo
cd kibo && npm install
node setup.mjs
```

The installer covers the whole lifecycle (details in **[SETUP.md](SETUP.md)**):

| Command | What it does |
|---|---|
| `node setup.mjs` | interactive install — prompts for every key (AI endpoint, Last.fm, SauceNAO, IG cookie…), provisions KV/D1/cron/secrets/webhook/command menu, verifies the result |
| `node setup.mjs --config f.json` | same, non-interactive — fields: `cfToken tgToken aiBase aiKey aiModel accountId? workerName? searchKey? lastfmKey? lastfmUser? sauceKey? igCookie? cron? skipTg?` |
| `node setup.mjs --update` | pull the latest code from the repo and redeploy with saved credentials (no-op when already current; `--force` to redeploy anyway) |
| `node setup.mjs --verify` | live-check your saved keys (AI endpoint, Last.fm, search, SauceNAO, IG cookie) without redeploying |
| `node setup.mjs --dry-run` | print the plan, touch nothing |
| `node setup.mjs --uninstall` | remove the worker + its KV + its D1 (asks for confirmation) |

**Optional keys** (features degrade honestly when a key is missing): `SEARCH_KEY` for the AI's live web search, `LASTFM_KEY`/`LASTFM_USER` for music, `SAUCE_KEY` for `/sauce`, `IG_COOKIE` for restricted Instagram posts. Full table: [SETUP.md § Optional keys](SETUP.md#optional-keys--what-you-get--what-degrades).

## Disclaimer

You host it, you own it. Everything runs on **your** Cloudflare account with **your** keys, and `/dl` interacts with third-party platforms — their terms and your local law apply to you. Provided as-is, no liability. See [SETUP.md § Disclaimer](SETUP.md#disclaimer).

## License

[MIT](LICENSE)
