export const AI_TEXT = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const AI_VISION = "@cf/meta/llama-3.2-11b-vision-instruct";
export const AI_STT = "@cf/openai/whisper-large-v3-turbo";
export const AI_STT_FB = "@cf/openai/whisper";
export const AI_TTS = "@cf/myshell-ai/melotts";
export const TTS_KEY = "tts_out";
export const TTS_MAX = 600;
export const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const UA_BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
export const WIB = 7 * 3600;
export const DAYS = { senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6, minggu: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
export const SYS_CHAT = "You are kibo, the user's personal assistant on Telegram. Reply in casual English, short and punchy, emoji in moderation. Stay accurate on technical topics. When you need fresh info (news, prices, schedules, facts that may be stale), use the web_search tool. If you need to read a specific web page, use open_url. Never fabricate real-time data.";
export const SYS_SUMMARIZE = "You summarize articles for the user. Reply in casual English, 3-5 tight bullets.";
export const SYS_HIST_SUM = "You maintain a running memory summary of a long ongoing personal chat/roleplay. You get the current summary (optional) plus the dialogue that just fell out of the recent context window. Merge everything into ONE compact running summary (max ~150 words). Preserve: names, relationships, promises, plans, emotional beats, unresolved threads, key facts. Output ONLY the summary text - no preamble, no commentary.";
export const CHAT_HIST_KEY = "chat_hist";
export const NUKE_KEY = "nuke_ids";
export const LAST_AI_KEY = "last_ai_msg";
export const REGEN_LOCK_KEY = "regen_lock";
export const CONT_CHAIN_KEY = "cont_chain";
export const SELF_BASE = "https://bot.example.workers.dev";
export const NUKE_CAP = 2000;
export const CHAT_HIST_MAX = 24;
export const HIST_SUM_KEY = "hist_sum";
export const HIST_SUM_CAP = 1200;
export const HIST_KEEP = 16;
export const REL_PREFIX = "char_rel_";
export const REL_GAP_MS = 30 * 60 * 1000;
export const SYS_REL = "You track the evolving relationship between the user and their roleplay character. Given the current relationship state and recent dialogue, output ONLY a JSON object: {\"d\": <integer, change in closeness from -10 to 10>, \"mood\": \"<current mood of the character, 1-2 words>\", \"note\": \"<one short sentence describing the current dynamic>\"}. No other text, no markdown.";
export const MEM_KEY = "memories";
export const MEM_MAX = 50;
export const OWNER_FALLBACK = "";
export const CHAR_KEY = "chars";
export const CHAR_ACTIVE_KEY = "char_active";
export const CHAR_MAX = 20;
export const CHAR_IMPORT_KEY = "char_import";
export const CMEM_PREFIX = "char_mem_";
export const PERSONA_KEY = "user_persona";
export const AI_CFG_KEY = "ai_cfg";
export const LEN_KEY = "reply_len";
export const ASK_KEY = "ask_pending";
export const AIST_FIRST_PREFIX = "aist_seen_";
export const AIST_MSG_PREFIX = "aist_msg_";
export const AIST_REC_PREFIX = "aist_rec_";
export const AIST_WRAP_PREFIX = "aist_wrap_";
export const AIST_WRAP_GAP_MS = 300000;
export const SYS_AISTATS_WRAP = "You are generating a character's \"Wrapped\" - a short, warm, in-character recap of the relationship between you (the character) and the user, shown on a stats view. You receive VERIFIED DATA below. Hard rules: use ONLY the numbers given - never invent, estimate, or add any other stats; 1-2 short paragraphs, no lists, no headers, no markdown emphasis; stay fully in character; genuine and a little playful; close with one forward-looking line. Output ONLY the recap text.";
export const LANG_KEY = "out_lang";
export const UI_LANG_KEY = "ui_lang";
export const STATS_KEY = "stats";
export const GAME_WORD_KEY = "gword:";
export const GAME_QUIZ_KEY = "gquiz:";
export const WORD_REWARDS = [15, 12, 9, 7, 5, 3];
export const QUIZ_PTS = 2;
export const QUIZ_HIST_KEY = "gquiz_hist:";
export const QUIZ_HIST_MAX = 12;

export const GAME_PVP_KEY = "gpvp:";
export const BET_MIN = 5;
export const BET_MAX = 50;
export const BET_RAKE = 0.10;
export const PVP_STAKE = 10;
export const SHIELD_PRICE = 15;
export const SHIELD_MAX = 2;
export const LOOT_ODDS = { none: 0.60, x2: 0.90 };
export const LOOT_AMT = { x2: 10, jack: 40 };
export const NOTE_TTL_MS = 10 * 60 * 1000;

export const FOCUS_KEY = "focus_state";
export const FOCUS_MIN = 5, FOCUS_MAX = 120, FOCUS_PTS = 5;
export const FOCUS_GRACE = 600;
export const SLEEP_GN_KEY = "sleep_gn";
export const SLEEP_LOG_KEY = "sleep_log";
export const SLEEP_CAP_H = 12;
export const SLEEP_LOG_MAX = 60;
export const SLEEP_WEEK_KEY = "sleep_recap_week";
export const HABITS_KEY = "habits";
export const HABIT_MAX = 7, HABIT_PTS = 1;
export const EXP_KEY = "exp_log";
export const EXP_MAX = 400, EXP_NOTE_CAP = 80;
export const EXP_MONTH_KEY = "exp_recap_month";
export const CAPSULE_KEY = "capsules";
export const CAPSULE_PEND_MAX = 10, CAPSULE_ARCH_MAX = 20, CAPSULE_TEXT_CAP = 500, CAPSULE_MIN_GAP = 600;

export const COUNTDOWN_KEY = "countdowns";
export const COUNTDOWN_MAX = 10, COUNTDOWN_NAME_CAP = 60;

export const RESURFACE_KEY = "resurface_day";
export const RESURFACE_MIN_AGE_DAYS = 7, RESURFACE_EVERY = 2;

export const AMA_KEY = "ama_throttle:", AMA_GAP_MS = 300000, AMA_Q_CAP = 300;
export const ALARM_KEY = "alarm_cfg:", ALARM_DEF_H = 8;
export const REACTD_KEY = "reactd", REACT_PROB = 5, REACT_DAILY_CAP = 2;

export const LIFE_NOTE_KEY = "life_notes";
export const LIFE_NOTE_MAX = 5;
export const HABIT_WEEK_PTS = 3;
export const HABIT_MS = [7, 14, 30, 50, 100];
export const HABIT_WK_MS = [4, 8, 12];

export const HABIT_PLAN_KEY = "habit_plan";
export const HABIT_PLAN_HABITS_MAX = 4;

export const LFM_USER_KEY = "lfm_user";
export const LFM_USER_DEFAULT = "";
export const NP_KEY = "np_ctx";
export const NP_TTL_MS = 3 * 60 * 1000;
export const NP_FRESH_MS = 30 * 60 * 1000;
export const MAL_TTL_MS = 6 * 60 * 60 * 1000;
export const WX_LOC_KEY = "wx_loc";
export const WX_CTX_KEY = "wx_ctx";
export const WX_TTL_MS = 30 * 60 * 1000;

export const KNOB_PREFIX = "char_knobs_";
export const PLOT_DIR_KEY = "plot_dir";
export const OOC_KEY = "ooc_mode";
export const VIBE_PRESETS = ["serious", "balanced", "playful"];
export const OOC_DIRECTIVE = "\n\nOOC MODE ACTIVE: you are the AUTHOR/DIRECTOR discussing the story with the user, out of character. Do NOT roleplay as the character. Reply as plain conversational prose - NO *asterisk actions*, NO \"quoted in-character dialogue\", no RP formatting. Talk about the story honestly: the plot, the characters, what is working, where it could go. When the user goes back in character or OOC mode is turned off, resume the roleplay normally.";
export const OOC_REMINDER = "\n\nREMINDER: OOC MODE is still active - stay out of character as the author/director: plain conversational prose, no RP formatting, no in-character dialogue.";
export const RP_SAVES_PREFIX = "rp_saves_";
export const RP_SAVES_MAX = 5;
export const RP_CKPT_PREFIX = "rp_ckpt_";
export const RP_CKPT_MAX = 3;
export const RP_CKPT_EVERY = 20;
export const CHAPTERS_PREFIX = "rp_chapters_";
export const CHAPTERS_MAX = 20;
export const CHAPTER_GAP_MS = 12 * 3600 * 1000;
export const SCENE_KEY = "rp_scene";
export const JEAL_COOLDOWN_MS = 20 * 3600 * 1000;
export const JEAL_AFF_MIN = 45;
export const SYS_CHAPTER = "Title the roleplay session that just ended. Reply with ONLY a short evocative chapter title (2-6 words) - no quotes, no numbering, no explanation, no thinking out loud.";

export const DL_CACHE_PREFIX = "dl_cache5:";
export const FGSI_IG_URL = "https://fgsi.dpdns.org/api/downloader/instagram";
export const FGSI_KEY = "fgsiapi-223c0a6d-6d";
export const KYIO_BASE = "https://api.kyio.web.id";
export const DL_CACHE_TTL_MS = 60 * 60 * 1000;
export const DL_POLL_MS = 4500;
export const DL_POLL_MAX = 8;
export const DL_YT_FORMATS = ["1080", "720", "360", "mp3"];
export const DL_MAX_LINKS = 20;
export const DL_SEND_MAX = 15 * 1024 * 1024;
export const DL_SEND_PHOTO_MAX = 5 * 1024 * 1024;
export const AUTO_DL_KEY = "autodl";
export const DL_DEL_MS = 5 * 60 * 1000;
export const DELQ_KEY = "delq";
export const DL_MENU_TTL_MS = 5 * 60 * 1000;
export const DL_PICK_PREFIX = "dlpick:";
export const DL_SAV_PREFIX = "dlsav:";
export const DL_SAV_TTL_MS = 60 * 60 * 1000;
export const GAME_LYRIC_KEY = "glyric:";
export const LYRIC_PTS = 8;
export const LYRIC_POOL_MAX = 30;
export const GAME_SONG_KEY = "gsong:";
export const SONG_PTS = 8;
export const SONG_TRY_MAX = 12;
export const GAME_FAN_KEY = "gsfan:";
export const SONG_FAN_PTS = 12;
export const GAME_SONG_STAT_KEY = "gsstat:";
export const GAME_FAN_STAT_KEY = "gsfstat:";
export const SONG_STREAK_CAP = 5;
export const FAN_MIN_SONGS = 4;
export const FAN_MENU_MAX = 6;
export const GAME_IDLE_REG = "gact";
export const GAME_IDLE_MS = 5 * 60 * 1000;
export const PHOTOQ_KEY = "photoq:";
export const PHOTOQ_PTS = 8;

export const DIVE_DAY_KEY = "diveday:";
export const DIVE_STATE_KEY = "dive:";
export const DIVE_PRAC_KEY = "divep:";
export const DIVE_STAT_KEY = "divestat:";
export const DIVE_TIERS = [{ max: 4, pts: 1, k: "O" }, { max: 14, pts: 3, k: "M" }, { max: 24, pts: 6, k: "D" }, { max: 9999, pts: 10, k: "X" }];
export const DIVE_GEM_PTS = 15;
export const DIVE_MODES = [
  { k: "chill", emo: "🌊", name: "Chill", mult: 0.5, bias: "Difficulty: CHILL - bias toward mainstream, widely-known prompts an average person can answer; keep the accepted answers common and familiar." },
  { k: "normal", emo: "🐠", name: "Normal", mult: 1, bias: "" },
  { k: "deep", emo: "🦈", name: "Deep", mult: 2, bias: "Difficulty: DEEP - bias toward niche, obscure deep-cut prompts; avoid mainstream trivia and reward specialist knowledge." }
];
export const DIVE_DEF_KEY = "divemode";
export const DIVE_TOPICS = ["geography", "food", "movies & TV", "music", "animals", "history", "sports", "games", "science", "internet culture", "everyday objects", "jobs & work", "travel", "school", "nature", "the human body"];
export const DIVE_DAY_MAX_ANS = 35;
export const DIVE_STALE_MS = 30 * 60 * 1000;
export const DIVE_DAY_TTL_MS = 36 * 3600 * 1000;
export const DIVE_JOB_KEY = "divejob";
export const DIVE_GEN_ATTEMPTS = 3;
export const DIVE_GEN_TIMEOUT_MS = 420000;
export const DIVE_ATTEMPT_GAP_MS = 6 * 60 * 1000;
export const DIVE_JOB_TTL_MS = 2 * 3600 * 1000;
export const PHOTOQ_TASKS_EN = ["photograph the sky right now", "photograph something red", "photograph your drink or snack today", "catch a reflection (window, mirror, or screen)", "photograph whatever is in front of you right now", "photograph something circular", "photograph a plant or a leaf", "photograph your keyboard or screen up close", "photograph something that made you smile today", "take a photo from a low angle", "photograph your shoes", "capture movement (blur is fine)"];
export const PHOTOQ_TASKS_ID = ["foto langit yang lagi ada sekarang", "foto sesuatu yang merah", "foto minuman/jajanan lo hari ini", "potret pantulan (jendela, cermin, atau layar)", "foto apa pun yang lagi ada di depan lo", "foto benda yang bulat", "foto tanaman atau daun", "foto keyboard/layar lo dari deket", "foto sesuatu yang bikin lo senyum hari ini", "foto dari sudut rendah", "foto sepatu lo", "potret gerakan (blur boleh)"];

export const EC_INV_KEY = "inv:";
export const EC_GACHA_KEY = "gacha:";
export const EC_CHARM_KEY = "charm:";
export const EC_BADGE_KEY = "badge:";
export const SHOP_ITEMS = [
  { k: "snack", e: "\u{1F36B}", p: 10, a: 2, nid: "Snack", nen: "Snack", fx_id: "bond +2 buat char", fx_en: "bond +2 for your char" },
  { k: "coffee", e: "\u2615", p: 15, a: 3, nid: "Kopi", nen: "Coffee", fx_id: "bond +3 buat char", fx_en: "bond +3 for your char" },
  { k: "bouquet", e: "\u{1F490}", p: 30, a: 6, nid: "Buket Bunga", nen: "Bouquet", fx_id: "bond +6 buat char", fx_en: "bond +6 for your char" },
  { k: "plushie", e: "\u{1F9F8}", p: 50, a: 10, nid: "Boneka", nen: "Plushie", fx_id: "bond +10 buat char", fx_en: "bond +10 for your char" },
  { k: "ring", e: "\u{1F48D}", p: 100, a: 20, nid: "Cincin", nen: "Ring", fx_id: "bond +20 buat char", fx_en: "bond +20 for your char" },
  { k: "shield", e: "\u{1F6E1}\uFE0F", p: 15, a: 0, nid: "Shield", nen: "Shield", fx_id: "asuransi streak quest", fx_en: "quest streak insurance" },
  { k: "crate", e: "\u{1F381}", p: 40, a: 0, nid: "Crate", nen: "Crate", fx_id: "roll poin acak", fx_en: "random points roll" }
];
export const CHARM_EPIC = ["ce1", "ce2", "ce3", "ce4", "ce5", "ce6"];
export const CHARM_LEG = ["cl1", "cl2", "cl3"];
export const CHARM_EMOJI = { ce1: "\u{1F338}", ce2: "\u{1F30A}", ce3: "\u{1F525}", ce4: "\u26A1", ce5: "\u{1F319}", ce6: "\u{1F340}", cl1: "\u{1F451}", cl2: "\u{1F984}", cl3: "\u{1F4AB}" };
export const GACHA_ODDS = { l: 0.03, e: 0.12, r: 0.30 };
export const GACHA_COST = 25, GACHA_COST5 = 100, GACHA_PITY = 10, GACHA_JACKPOT = 100, GACHA_REFUND = 5;
export const BOT_VER = "2.62.1";
export const WIZ_KEY = "model_wizard";
export const PRESET_KEY = "presets";
export const PRESET_MAX = 15;
export const PRESET_IMPORT_KEY = "preset_import";
export const PRESET_COMPILED_CAP = 6000;
export const RP_FORMAT = '\nRP FORMAT: when there is DIALOG/speech, ALWAYS wrap it in "double quotes" (example: "What is it, my love?"). ACTIONS/movements/descriptions/narration are ALWAYS wrapped in one pair of *asterisks* (example: *gazing at you slowly*). Apply this consistently in EVERY reply, never sometimes.';

export const VAULT_CHAT_KEY = "vault_chat";
export const FILE_INDEX_KEY = "file_index";
export const VAULT_SNAPS_KEY = "vault_snaps";
export const VAULT_CFG_KEY = "vault_cfg";
export const VAULT_BIND_KEY = "vault_bind";
export const VAULT_REN_KEY = "vault_ren";
export const VAULT_OP_KEY = "vault_op";
export const FILE_MAX = 200;
export const SNAP_MAX = 10;
export const ABORT_KEY = "abort_flag";
export const READLIST_KEY = "readlist:";
export const READLIST_MAX = 20;
export const OTD_KEY = "otd:";
export const SHORT_KEY = "short:";
export const SHORT_COUNT_KEY = "short_n";
export const SHORT_URL_MAX = 2048;
export const WRAP_KEY = "wrap:";
export const WRAP_GAP_MS = 5 * 60 * 1000;
export const WRAP_TOP = 10;
export const WRAP_SHOW = 5;
export const LFM_TRACKS_MAX = 50;
export const PASTE_KEY = "paste:";
export const PASTE_MAX = 4000;
export const PASTE_TTL_MS = 30 * 24 * 3600 * 1000;
export const SYS_WRAP = "You are writing a short personal music \"wrap\" recap for the user based on THEIR Last.fm listening data. You receive VERIFIED TRACKS, ARTISTS, and PERIOD STATS below. Hard rules: use ONLY the data given — never invent artists, counts, or periods; 1-2 short paragraphs, no lists or headers; genuine, warm, a little playful like a year-in-review; close with one forward-looking line. Output ONLY the recap text.";

export const ABORT_TOK = "\u0000__ABORT__";
export const NOTE_ABORT = "\n\n\u{1F6D1} stopped (/abort)";
export const WD_CUT_NOTE = "\n\n\u23F1 cut off \u2014 CF runtime limit, /continue to resume";
export const LIVE_GEN = new Map();
export let INCEPTION = Date.now(); export let LAST_CF = null;
export let LIVE_CTX = null;
export function setLiveCtx(ctx) { LIVE_CTX = ctx; }
export function setLastCf(cf) { LAST_CF = cf; }
