
export const TG_CMD_LIMIT = 100;
export const TG_CMD_RE = /^[a-z0-9_]{1,32}$/;
export const MENU_CAP = 26;

export const CATS = ["daily", "money", "ai", "story", "media", "fun", "system"];

export const COMMANDS = [
  { c: "help", cat: "system", d: "help by category (or the full searchable list)", ex: "/help" },
  { c: "menu", cat: "system", d: "button panel (char/remind/rss/memory)", ex: "/menu" },
  { c: "audit", cat: "system", d: "see or undo the last AI changes to your data", ex: "/audit" },
  { c: "brief", cat: "daily", d: "one morning message: weather, reminders, quest, headlines, money, sleep", ex: "/brief at 6:30" },
  { c: "now", cat: "daily", d: "status board that updates itself (focus, quest, habits, money)", ex: "/now" },
  { c: "report", cat: "daily", d: "this week's report card: sleep, quest, habits, spending, focus", ex: "/report" },
  { c: "todo", cat: "daily", d: "task list: /todo add <task> [due], /todo done <id>, /todo snooze <id>", ex: "/todo buy soap tomorrow" },
  { c: "s", cat: "daily", d: "search everything: memories, notes, journal, reminders, todos, list", ex: "/s coffee" },
  { c: "c", cat: "daily", d: "capture: send anything and the bot routes it (expense/reminder/todo/note)", ex: "/c 25k coffee #food" },
  { c: "remind", cat: "daily", d: "set a reminder (2h | 21:30 | tomorrow 09:00)", ex: "/remind 2h take medicine" },
  { c: "reminds", cat: "daily", d: "list active reminders", ex: "/reminds" },
  { c: "del", cat: "daily", d: "delete a reminder by id", ex: "/del 3" },
  { c: "quest", cat: "daily", d: "daily quest + streak & points", ex: "/quest reroll" },
  { c: "focus", cat: "daily", d: "focus timer: /focus 25, claim /focus done (+5 pts, 10-min window)", ex: "/focus 25" },
  { c: "habit", cat: "daily", d: "daily habits + streak: /habit add <name>, check in via button", ex: "/habit add gym 3" },
  { c: "sleep", cat: "daily", d: "sleep log: /sleep gn before bed, /sleep gm when you wake", ex: "/sleep gn" },
  { c: "beli", cat: "money", d: "log an expense: /beli 25k <note>, or /beli recap for the month", ex: "/beli 25k coffee #food" },
  { c: "exp", cat: "money", d: "money v2: /exp 25k coffee #food, /exp budget 2jt, /exp recap", ex: "/exp budget food 500rb" },
  { c: "j", cat: "daily", d: "write a journal entry", ex: "/j rough day today #mood" },
  { c: "countdown", cat: "daily", d: "count down to a date: /countdown <name> <YYYY-MM-DD> (fires on the day)", ex: "/countdown vacation 2026-01-10" },
  { c: "weather", cat: "daily", d: "current weather (first time: set city)", ex: "/weather jakarta" },
  { c: "hn", cat: "daily", d: "Hacker News front page (top 10, 30-minute cache)", ex: "/hn" },
  { c: "digest", cat: "daily", d: "journal digest for today", ex: "/digest" },
  { c: "rss", cat: "daily", d: "manage RSS feeds (add/list/del)", ex: "/rss add https://blog.example/feed" },
  { c: "otp", cat: "daily", d: "emails from the last 10 minutes", ex: "/otp" },
  { c: "capsule", cat: "daily", d: "letter to future you: /capsule <time> <message> (same time format as /remind)", ex: "/capsule tomorrow 09:00 you got this" },
  { c: "alarm", cat: "daily", d: "morning alarm: your char says good morning every day at the time you pick: /alarm on [HH:MM] (default 08:00)", ex: "/alarm on 07:30" },
  { c: "chain", cat: "daily", d: "5-day quest arc: clear your daily quest to light each step (+5 pts); full clear = +50 pts bonus: /chain", ex: "/chain" },
  { c: "rl", cat: "daily", d: "reading list: view/list, /rl add <title>, tap to mark done or delete", ex: "/rl add https://example.com/article" },
  { c: "otd", cat: "daily", d: "on-this-day: daily facts from Wikipedia (0 AI)", ex: "/otd" },
  { c: "ics", cat: "daily", d: "export reminders + todos + countdowns as a calendar file", ex: "/ics" },
  { c: "aistats", cat: "ai", d: "the AI stats: bonds, memory, game record, wrapped", ex: "/aistats" },
  { c: "reset", cat: "ai", d: "new chat: wipe AI history", ex: "/reset" },
  { c: "rewind", cat: "ai", d: "reply to a char msg to rewind the chat to that point", ex: "/rewind" },
  { c: "delete", cat: "ai", d: "reply to a message to remove it from chat + AI context", ex: "/delete" },
  { c: "regenerate", cat: "ai", d: "regen: drop the last AI reply, answer from scratch (emoji react on a bot msg also triggers)", ex: "/regenerate" },
  { c: "continue", cat: "ai", d: "resume a reply cut by the runtime limit (\u23f1) from where it stopped", ex: "/continue" },
  { c: "abort", cat: "ai", d: "stop the AI process that is still running (thinking too long)", ex: "/abort" },
  { c: "remember", cat: "ai", d: "save a permanent fact about you", ex: "/remember hates spicy food" },
  { c: "mems", cat: "ai", d: "view & delete memories", ex: "/mems" },
  { c: "forget", cat: "ai", d: "delete a memory by id", ex: "/forget 4" },
  { c: "tts", cat: "ai", d: "toggle AI voice-note replies", ex: "/tts" },
  { c: "cmems", cat: "story", d: "active char memory (list/add/del)", ex: "/cmems add likes coffee" },
  { c: "char", cat: "story", d: "AI personas (add/list/off/import)", ex: "/char add Aya | grumpy, loves coffee" },
  { c: "presets", cat: "story", d: "SillyTavern style presets: enable/disable + import .json", ex: "/presets" },
  { c: "me", cat: "story", d: "your persona: name + personality for the AI", ex: "/me Zun | codes at night" },
  { c: "vibe", cat: "story", d: "char energy dial: serious/balanced/playful/custom", ex: "/vibe playful" },
  { c: "outfit", cat: "story", d: "set the active char outfit (injected into the story)", ex: "/outfit black tee" },
  { c: "plot", cat: "story", d: "story tone direction (e.g. 60% romance 30% comedy)", ex: "/plot 60% romance 40% comedy" },
  { c: "dice", cat: "story", d: "story dice: 3 random elements to kickstart RP", ex: "/dice" },
  { c: "ooc", cat: "story", d: "out of character: discuss the story (toggle)", ex: "/ooc" },
  { c: "rpreset", cat: "story", d: "reset all RP knobs at once (vibe+outfit+plot)", ex: "/rpreset" },
  { c: "rp", cat: "story", d: "save/load the story state: slots & chapters", ex: "/rp" },
  { c: "scene", cat: "story", d: "two-char scene: reply to their message = they answer", ex: "/scene" },
  { c: "ama", cat: "story", d: "ask the character meta questions about itself/your story: /ama <question> (5-min cooldown)", ex: "/ama what do you like most" },
  { c: "anime", cat: "media", d: "look up anime info (Kitsu)", ex: "/anime frieren" },
  { c: "manga", cat: "media", d: "look up manga info (Kitsu)", ex: "/manga berserk" },
  { c: "np", cat: "media", d: "the song playing right now", ex: "/np" },
  { c: "dl", cat: "media", d: "direct download links: TikTok / X / Instagram / YouTube (720p & MP3)", ex: "/dl https://x.com/u/status/1" },
  { c: "song", cat: "media", d: "find a song by title: instant MP3 + video links", ex: "/song happy upbeat" },
  { c: "spotify", cat: "media", d: "spotify track link \u2192 MP3", ex: "/spotify https://open.spotify.com/track/..." },
  { c: "yts", cat: "media", d: "search YouTube: numbered results \u2192 download menu", ex: "/yts lofi 1 hour" },
  { c: "nh", cat: "media", d: "nhentai gallery \u2192 photo album (one photo per page, auto-deleted; /nh <id> zip|pdf|scroll for a file)", ex: "/nh 123456 zip" },
  { c: "nhs", cat: "media", d: "saved nhentai galleries (opened from the \ud83d\udcbe album button)", ex: "/nhs" },
  { c: "host", cat: "media", d: "upload a photo/file to a file host (kappa, femboy, qu.ax, gofile\u2026) \u2192 get a link", ex: "/host (reply a photo)" },
  { c: "sauce", cat: "media", d: "reverse image search: find the source of a photo (SauceNAO + Google Lens)", ex: "/sauce (reply a photo)" },
  { c: "wrap", cat: "media", d: "music wrap: recap your Last.fm listening (1 AI, throttled)", ex: "/wrap" },
  { c: "profile", cat: "fun", d: "your profile: level, streak, points, shields, crate", ex: "/profile" },
  { c: "shop", cat: "fun", d: "point shop: buy gifts & items for your char (inventory)", ex: "/shop" },
  { c: "gacha", cat: "fun", d: "point gacha: roll items + collectible charms (pity at 10)", ex: "/gacha" },
  { c: "ach", cat: "fun", d: "achievements: badges from streaks, wins & milestones", ex: "/ach" },
  { c: "inv", cat: "fun", d: "your inventory: items bought in /shop, use them here", ex: "/inv" },
  { c: "game", cat: "fun", d: "point mini-games: Wordle + Quiz + Lyric + Song Guess", ex: "/game" },
  { c: "dive", cat: "fun", d: "Daily Dive: 7 daily prompts, rare answers score more", ex: "/dive" },
  { c: "bet", cat: "fun", d: "coinflip points vs char (5\u201350)", ex: "/bet 10" },
  { c: "shield", cat: "fun", d: "protect the quest streak (15 points)", ex: "/shield" },
  { c: "settings", cat: "system", d: "settings hub: AI model, reply length, language", ex: "/settings" },
  { c: "model", cat: "system", d: "switch the AI model (bridge/custom)", ex: "/model" },
  { c: "len", cat: "system", d: "reply length: short/medium/long", ex: "/len long" },
  { c: "lang", cat: "system", d: "AI output language", ex: "/lang id" },
  { c: "stats", cat: "system", d: "AI usage stats (tokens)", ex: "/stats" },
  { c: "sys", cat: "system", d: "system info: D1/KV, POP, quota, webhook, secrets", ex: "/sys" },
  { c: "vault", cat: "system", d: "vault: file manager + backup (private channel)", ex: "/vault" },
  { c: "save", cat: "system", d: "save a file: reply to a file/photo with /save", ex: "/save (reply a file)" },
  { c: "files", cat: "system", d: "vault files (fetch/rename/delete)", ex: "/files" },
  { c: "bm", cat: "system", d: "reply to a message to save it to your vault with a note", ex: "/bm (reply a message)" },
  { c: "ping", cat: "system", d: "check the bot is alive", ex: "/ping" },
  { c: "start", cat: "system", d: "start & pair the bot", ex: "/start" },
  { c: "totp", cat: "system", d: "live 2FA codes (RFC 6238)", ex: "/totp" },
  { c: "shorten", cat: "system", d: "shorten: turn a long URL into /s/<code> (302 redirect)", ex: "/shorten https://example.com/very-long-link" },
  { c: "paste", cat: "system", d: "paste: save text & share a /p/<id> link (0 AI)", ex: "/paste <long text>" },
  { c: "qr", cat: "system", d: "QR code from text or a link", ex: "/qr https://example.com" },
];

export const MENU = [
  "help", "brief", "now", "report", "todo", "s", "c",
  "remind", "reminds", "quest", "focus", "habit", "sleep",
  "exp", "j", "countdown", "weather", "hn", "rl",
  "game", "nh", "dl", "song",
  "settings", "ping",
];

export function menuCommands() {
  const by = new Map(COMMANDS.map(x => [x.c, x]));
  return MENU.map(c => by.get(c)).filter(Boolean);
}

export function commandPayload(languageCode) {
  const commands = menuCommands().map(x => ({ command: x.c, description: x.d }));
  return languageCode ? { commands, language_code: languageCode } : { commands };
}

export function validateCommands(list) {
  const bad = [];
  const seen = new Set();
  for (const x of list || []) {
    if (!x || !x.c) { bad.push("empty entry"); continue; }
    if (!TG_CMD_RE.test(x.c)) bad.push("bad name: " + x.c);
    if (seen.has(x.c)) bad.push("duplicate: " + x.c);
    seen.add(x.c);
    const d = String(x.d || "");
    if (d.length < 3 || d.length > 256) bad.push("bad description length for " + x.c + " (" + d.length + ")");
  }
  if ((list || []).length > TG_CMD_LIMIT) bad.push("too many commands: " + list.length + " > " + TG_CMD_LIMIT);
  return bad;
}
