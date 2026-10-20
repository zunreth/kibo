# kibo — a personal companion bot for Telegram

AI chat with real memory, character bonds, daily quests, an economy, mini-games, a daily quiz, a media downloader and a life suite — self-hosted **entirely on Cloudflare Workers** (free tier is enough). No VPS, no database server, no process to babysit.

**Single-owner by design:** one instance = one owner. The first person who DMs the bot claims it (or pin it with `OWNER_FALLBACK`). Want your friends to have one? Point them here — each person hosts their own instance with their own keys.

## Features

| Area | Highlights |
|---|---|
| 💬 Chat & bonds | streaming AI chat with rolling memory + summaries, character cards (`/char`), persona (`/me`), roleplay knobs (`/vibe /outfit /plot /dice /ooc`), story snapshots (`/rp save/load`), jealousy, chapter titles |
| 🔁 Daily loop | daily quest + streaks + shields, **Daily Dive** (`/dive` — ranked rare-answer quiz), morning digest, good-morning alarm (`/alarm`), memory resurface, countdowns |
| 🎮 Games | word game (solo + PvP), quick quiz, song quiz with real audio previews, real-fan artist mode, lyric quiz with **real lyrics** |
| 🛍️ Economy | points wallet, loot crates, bets, shop + inventory, gacha with pity + charms, 22 achievements, vault bookmarking (`/bm`) |
| 📥 Media | `/dl` — TikTok / Instagram / YouTube (+ resolver chain, restricted-IG via your own session cookie), `/song`, `/spotify` |
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

Full guide (requirements, optional keys, troubleshooting): **[SETUP.md](SETUP.md)**.

## Disclaimer

You host it, you own it. Everything runs on **your** Cloudflare account with **your** keys, and `/dl` interacts with third-party platforms — their terms and your local law apply to you. Provided as-is, no liability. See [SETUP.md § Disclaimer](SETUP.md#disclaimer).

## License

[MIT](LICENSE)
