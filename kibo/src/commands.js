
export const TG_CMD_LIMIT = 100;
export const TG_CMD_RE = /^[a-z0-9_]{1,32}$/;

export const COMMANDS = [
  { c: "help", d: "help by category (or full list)" },
  { c: "menu", d: "button panel (char/remind/rss/memory)" },
  { c: "brief", d: "one morning message: weather, reminders, quest, headlines, money, sleep" },
  { c: "now", d: "status board that updates itself (focus, quest, habits, money)" },
  { c: "report", d: "this week's report card: sleep, quest, habits, spending, focus" },
  { c: "todo", d: "task list: /todo add <task> [due], /todo done <id>, /todo snooze <id>" },
  { c: "s", d: "search everything: memories, notes, journal, reminders, todos, list" },
  { c: "c", d: "capture: send anything and the bot routes it (expense/reminder/todo/note)" },
  { c: "remind", d: "set a reminder (2h | 21:30 | besok 09:00)" },
  { c: "reminds", d: "list active reminders" },
  { c: "del", d: "delete a reminder by id" },
  { c: "quest", d: "daily quest + streak & points" },
  { c: "focus", d: "focus timer: /focus 25, claim /focus done (+5 pts, 10-min window)" },
  { c: "habit", d: "daily habits + streak: /habit add <name>, check in via button" },
  { c: "sleep", d: "sleep log: /sleep gn before bed, /sleep gm when you wake" },
  { c: "beli", d: "log an expense: /beli 25k <note> \u2014 /beli recap for the month" },
  { c: "exp", d: "money v2: /exp 25k coffee #food, /exp budget 2jt, /exp recap" },
  { c: "j", d: "write a journal entry" },
  { c: "countdown", d: "count down to a date: /countdown <name> <YYYY-MM-DD> (fires on the day)" },
  { c: "weather", d: "current weather (first time: set city)" },
  { c: "hn", d: "Hacker News front page (top 10, cache 30 menit)" },
  { c: "settings", d: "settings hub: AI model, reply length, language" },
  { c: "aistats", d: "the AI stats: bonds, memory, game record, wrapped" },
  { c: "reset", d: "new chat \u2014 wipe AI history" },
  { c: "profile", d: "your profile: level, streak, points, shields, crate" },
  { c: "shop", d: "point shop: buy gifts & items for your char (inventory)" },
  { c: "gacha", d: "point gacha: roll items + collectible charms (pity at 10)" },
  { c: "ach", d: "achievements: badges from streaks, wins & milestones" },
  { c: "bm", d: "reply to a message \u2014 save it to your vault with a note" },
  { c: "inv", d: "your inventory: items bought in /shop \u2014 use them here" },
  { c: "rewind", d: "reply to a char msg \u2014 rewind the chat to that point" },
  { c: "delete", d: "reply to a message \u2014 remove it from chat + AI context" },
  { c: "regenerate", d: "regen: drop the last AI reply, answer from scratch (emoji react on a bot msg also triggers)" },
  { c: "continue", d: "resume a reply cut by the runtime limit (\u23f1) from where it stopped" },
  { c: "abort", d: "stop the AI process that is still running (thinking too long)" },
  { c: "remember", d: "save a permanent fact about you" },
  { c: "mems", d: "view & delete memories" },
  { c: "forget", d: "delete a memory by id" },
  { c: "cmems", d: "active char memory (list/add/del)" },
  { c: "digest", d: "journal digest for today" },
  { c: "rss", d: "manage RSS feeds (add/list/del)" },
  { c: "char", d: "AI personas (add/list/off/import)" },
  { c: "presets", d: "SillyTavern style presets: enable/disable + import .json" },
  { c: "me", d: "your persona: name + personality for the AI" },
  { c: "otp", d: "emails from the last 10 minutes" },
  { c: "model", d: "switch the AI model (bridge/custom)" },
  { c: "len", d: "reply length: short/medium/long" },
  { c: "lang", d: "AI output language" },
  { c: "stats", d: "AI usage stats (tokens)" },
  { c: "sys", d: "system info: D1/KV, POP, quota, webhook, secrets" },
  { c: "vault", d: "vault: file manager + backup (private channel)" },
  { c: "save", d: "save a file \u2014 reply to a file/photo with /save" },
  { c: "files", d: "vault files (fetch/rename/delete)" },
  { c: "ping", d: "check the bot is alive" },
  { c: "start", d: "start & pair the bot" },
  { c: "tts", d: "toggle AI voice-note replies" },
  { c: "totp", d: "live 2FA codes (RFC 6238)" },
  { c: "game", d: "point mini-games: Wordle + Quiz + Lyric + Song Guess" },
  { c: "dive", d: "Daily Dive: 7 daily prompts, rare answers score more" },
  { c: "anime", d: "look up anime info (Kitsu)" },
  { c: "manga", d: "look up manga info (Kitsu)" },
  { c: "np", d: "the song playing right now" },
  { c: "dl", d: "direct download links: TikTok / X / Instagram / YouTube (720p & MP3)" },
  { c: "song", d: "find a song by title: instant MP3 + video links" },
  { c: "spotify", d: "spotify track link \u2192 MP3" },
  { c: "yts", d: "search YouTube: numbered results \u2192 download menu" },
  { c: "nh", d: "nhentai gallery \u2192 photo album (foto tiap halaman, auto-hapus; /nh <id> zip|pdf|scroll untuk file)" },
  { c: "nhs", d: "list & open gallery nhentai yang disimpan (dari tombol \ud83d\udcbe album)" },
  { c: "host", d: "upload a photo/file to a file host (kappa, femboy, qu.ax, gofile\u2026) \u2192 get a link" },
  { c: "sauce", d: "reverse image search: find the source of a photo (SauceNAO + Google Lens)" },
  { c: "bet", d: "coinflip points vs char (5\u201350)" },
  { c: "shield", d: "protect the quest streak (15 points)" },
  { c: "vibe", d: "char energy dial: serious/balanced/playful/custom" },
  { c: "outfit", d: "set the active char outfit (injected into the story)" },
  { c: "plot", d: "story tone direction (e.g. 60% romance 30% comedy)" },
  { c: "dice", d: "story dice: 3 random elements to kickstart RP" },
  { c: "ooc", d: "out of character: discuss the story (toggle)" },
  { c: "rpreset", d: "reset all RP knobs at once (vibe+outfit+plot)" },
  { c: "rp", d: "save/load the story state: slots & chapters" },
  { c: "scene", d: "two-char scene: reply to their message = they answer" },
  { c: "capsule", d: "letter to future you: /capsule <time> <message> (same time format as /remind)" },
  { c: "ama", d: "ask the character meta questions about itself/your story: /ama <question> (5-min cooldown)" },
  { c: "alarm", d: "morning alarm: your char says good morning every day at the time you pick: /alarm on [HH:MM] (default 08:00)" },
  { c: "chain", d: "5-day quest arc: clear your daily quest to light each step (+5 pts); full clear = +50 pts bonus: /chain" },
  { c: "rl", d: "reading list: view/list, /rl add <title>, tap to mark done or delete" },
  { c: "otd", d: "on-this-day: daily facts from Wikipedia (0 AI)" },
  { c: "shorten", d: "shorten: turn a long URL into /s/<code> (302 redirect)" },
  { c: "wrap", d: "music wrap: recap your Last.fm listening (1 AI, throttled)" },
  { c: "paste", d: "paste: save text & share a /p/<id> link (0 AI)" },
  { c: "qr", d: "QR code from text or a link" },
  { c: "ics", d: "export reminders + todos + countdowns as a calendar file" },
];

export function commandPayload(languageCode) {
  const commands = COMMANDS.map(x => ({ command: x.c, description: x.d }));
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
