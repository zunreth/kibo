
import { COMMANDS, CATS, MENU } from "./commands.js";
import { helpPageUrl } from "./help-page.js";

export const CMD_SEARCH_MAX = 8;
export const CMD_LINE_MAX = 220;

export const CAT_LABEL = {
  daily: "Daily", money: "Money", ai: "AI and memory", story: "Story and characters",
  media: "Media", fun: "Points and games", system: "System",
};

const norm = s => String(s == null ? "" : s).toLowerCase().normalize("NFKD")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export const SYN = {
  pengeluaran: "expense money", belanja: "expense", uang: "money expense budget", duit: "money",
  hemat: "budget", anggaran: "budget", rekap: "recap", rekapan: "recap",
  catat: "log record", nyatet: "log record", catatan: "note save",
  ingatkan: "remind reminder", ingetin: "remind reminder", pengingat: "reminder",
  tugas: "todo task", kerjaan: "todo", agenda: "todo reminder",
  jadwal: "countdown remind", tanggal: "date countdown", hitung: "countdown",
  cuaca: "weather", hujan: "weather", tidur: "sleep", bobo: "sleep",
  kebiasaan: "habit", jurnal: "journal", diari: "journal", diary: "journal",
  cari: "search", simpan: "save paste note",
  pendek: "shorten short link", tautan: "link url shorten",
  lagu: "song music", musik: "song music", berita: "news headlines",
  cerita: "story", karakter: "character char", poin: "points", hadiah: "points quest",
  tebak: "game quiz", laporan: "report", ringkas: "brief report", ringkasan: "brief report",
  bantuan: "help", bantu: "help", semua: "all list", hapus: "delete del", matikan: "off disable",
};

export const STOP = new Set([
  "besok", "tomorrow", "lusa", "nanti", "yang", "buat", "untuk", "dengan", "saya", "gw", "aku",
  "apa", "apaan", "gimana", "bagaimana", "cara", "dong", "sih", "itu", "ini", "ada",
  "the", "a", "an", "to", "how", "do", "does", "i", "my", "me", "for", "of", "is", "in", "on", "what", "which",
]);

function terms(q) {
  const out = new Set();
  for (const w of norm(q).split(" ").filter(Boolean)) {
    if (STOP.has(w)) continue;
    out.add(w);
    if (SYN[w]) for (const x of SYN[w].split(" ")) out.add(x);
    if (w.length > 4 && w.endsWith("s")) out.add(w.slice(0, -1));
    if (w.length > 5 && w.endsWith("ing")) out.add(w.slice(0, -3));
  }
  return [...out];
}

const CAT_TERM = new Set(CATS.concat(CATS.map(c => norm(CAT_LABEL[c] || c)).join(" ").split(" ").filter(Boolean)));

function score(x, ws, qn) {
  const name = x.c, d = norm(x.d), ex = norm(x.ex);
  let s = name === qn ? 100 : 0;
  for (const w of ws) {
    if (w.length < 2) continue;
    if (name === w) s += 60;
    else if (name.startsWith(w)) s += 24;
    else if (name.includes(w)) s += 12;
    if (d.includes(w)) s += 7;
    if (ex.includes(w)) s += 4;
    if (CAT_TERM.has(w) && x.cat === w) s += 10;
  }
  return s;
}

export function searchCommands(q, limit) {
  const qn = norm(q);
  if (!qn) return [];
  const ws = terms(q);
  const hits = [];
  for (const x of COMMANDS) {
    const s = score(x, ws, qn);
    if (s > 0) hits.push({ x, s });
  }
  const inMenu = new Set(MENU);
  hits.sort((a, b) => b.s - a.s || (inMenu.has(b.x.c) ? 1 : 0) - (inMenu.has(a.x.c) ? 1 : 0) || String(a.x.c).localeCompare(String(b.x.c)));
  return hits.slice(0, limit || CMD_SEARCH_MAX).map(h => h.x);
}

export function cmdLine(x, withEx) {
  let s = "/" + x.c + " [" + (x.cat || "?") + "] " + x.d;
  if (withEx && x.ex) s += "  (e.g. " + x.ex + ")";
  return s.length > CMD_LINE_MAX ? s.slice(0, CMD_LINE_MAX - 1) + "\u2026" : s;
}

export function commandsIndex(env) {
  const count = {};
  for (const x of COMMANDS) count[x.cat] = (count[x.cat] || 0) + 1;
  const groups = CATS.map(c => (CAT_LABEL[c] || c).toLowerCase() + " (" + (count[c] || 0) + ")").join(", ");
  return "kibo has " + COMMANDS.length + " slash commands in " + CATS.length + " groups: " + groups +
    ". Search with q (English or Indonesian), or list one group with cat. Full searchable page: " + helpPageUrl(env) +
    ". Without a working catalog, say you are not sure and point at the page \u2014 never invent a command.";
}

export function commandsCategory(cat, env) {
  const c = norm(cat);
  const rows = COMMANDS.filter(x => x.cat === c);
  if (!rows.length) {
    const near = CATS.filter(k => k.startsWith(c) || c.startsWith(k));
    if (near.length === 1) return commandsCategory(near[0], env);
    return "no group called \"" + String(cat) + "\" \u2014 groups: " + CATS.join(", ") + ". Full page: " + helpPageUrl(env);
  }
  return "[" + c + "] " + rows.length + " commands:\n" + rows.map(x => cmdLine(x, false)).join("\n") +
    "\nfull page: " + helpPageUrl(env);
}

export function agentCommands(env, a) {
  a = a || {};
  const action = String(a.action || "").toLowerCase();
  const q = a.q || a.query || a.keywords || "";
  const cat = a.cat || a.category || a.group || "";
  try {
    if (q) {
      const hits = searchCommands(q);
      if (!hits.length) {
        return "no command matches \"" + String(q).replace(/\s+/g, " ").trim() + "\" \u2014 do NOT invent one. " + commandsIndex(env);
      }
      return hits.length + " command(s) matching \"" + String(q).replace(/\s+/g, " ").trim() + "\":\n" +
        hits.map(x => cmdLine(x, true)).join("\n") + "\nfull page: " + helpPageUrl(env);
    }
    if (cat) return commandsCategory(cat, env);
    if (action === "list" || action === "all") {
      return "all " + COMMANDS.length + " commands:\n" + COMMANDS.map(x => cmdLine(x, false)).join("\n") +
        "\nfull page: " + helpPageUrl(env);
    }
    return commandsIndex(env);
  } catch (_) {
    return "command catalog unavailable \u2014 tell the user the /help page has the full list, and do not invent a command";
  }
}
