
export const MAIN_CUR_KEY = "cur_main";
export const MAIN_CUR_DEFAULT = "IDR";

export const CURS = {
  IDR: { sym: "Rp", grp: ".", dec: ",", dp: 0, aliases: ["rp", "idr"] },
  USD: { sym: "$", grp: ",", dec: ".", dp: 2, aliases: ["usd", "us$", "usd$"] },
  SGD: { sym: "S$", grp: ",", dec: ".", dp: 2, aliases: ["sgd", "s$", "sgd$"] },
  MYR: { sym: "RM", grp: ",", dec: ".", dp: 2, aliases: ["myr", "rm"] },
  EUR: { sym: "\u20AC", grp: ".", dec: ",", dp: 2, aliases: ["eur"] },
  GBP: { sym: "\u00A3", grp: ",", dec: ".", dp: 2, aliases: ["gbp"] },
  THB: { sym: "\u0E3F", grp: ",", dec: ".", dp: 2, aliases: ["thb", "baht"] },
  JPY: { sym: "\u00A5", grp: ",", dec: ".", dp: 0, aliases: ["jpy", "yen"] },
  INR: { sym: "\u20B9", grp: ",", dec: ".", dp: 2, aliases: ["inr"] },
  AUD: { sym: "A$", grp: ",", dec: ".", dp: 2, aliases: ["aud", "a$"] },
  PHP: { sym: "\u20B1", grp: ",", dec: ".", dp: 2, aliases: ["php"] },
  CNY: { sym: "CN\u00A5", grp: ",", dec: ".", dp: 2, aliases: ["cny", "rmb"] },
};

export const CUR_CODES = Object.keys(CURS);

export function isCur(c) { return typeof c === "string" && Object.prototype.hasOwnProperty.call(CURS, c.toUpperCase()); }
export function normCur(c, fallback) {
  const u = String(c == null ? "" : c).trim().toUpperCase();
  return isCur(u) ? u : (fallback || MAIN_CUR_DEFAULT);
}

let MAIN = MAIN_CUR_DEFAULT, LOADED_AT = 0;
export function mainCur() { return MAIN; }
export function setMainCur(c) {
  MAIN = normCur(c, MAIN_CUR_DEFAULT);
  return MAIN;
}
export function resetMainCurCache() { LOADED_AT = 0; }
export async function loadMainCur(env) {
  if (LOADED_AT && Date.now() - LOADED_AT < 60000) return MAIN;
  try {
    const v = await env.KV.get(MAIN_CUR_KEY);
    setMainCur(v || MAIN_CUR_DEFAULT);
  } catch (_) { setMainCur(MAIN); }
  LOADED_AT = Date.now();
  return MAIN;
}

const ALIASES = [];
for (const [code, d] of Object.entries(CURS)) {
  for (const a of [code.toLowerCase(), ...d.aliases]) ALIASES.push([a, code]);
  if (d.sym) ALIASES.push([d.sym.toLowerCase(), code]);
}
ALIASES.sort((a, b) => b[0].length - a[0].length);
const SYM_RE = new RegExp("^(" + ALIASES.map(x => x[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\s*", "i");
const SUF_RE = new RegExp("\\s*(" + ALIASES.map(x => x[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")$", "i");
const UNIT_RE = /^(k|rb|ribu|jt|juta|mio|miliar|m|b)$/;

function roundTo(n, dp) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
export function roundMoney(n, cur) { return roundTo(Number(n) || 0, CURS[normCur(cur)].dp); }

export function parseDigits(s, cur) {
  const d = CURS[normCur(cur)];
  const g = d.grp, x = d.dec;
  const t = String(s == null ? "" : s);
  if (!/^\d[\d.,]*$/.test(t)) return null;
  if (t.includes(".") && t.includes(",")) {
    const last = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
    return Number(t.slice(0, last).replace(/[.,]/g, "") + "." + t.slice(last + 1).replace(/[.,]/g, ""));
  }
  const sep = t.includes(g) ? g : t.includes(x) ? x : "";
  if (!sep) return Number(t);
  const parts = t.split(sep);
  if (parts.length > 2) return Number(parts.join(""));
  if (sep === g && parts[1].length === 3) return Number(parts.join(""));
  if (sep === x && d.dp === 0 && parts[1].length === 3) return Number(parts.join(""));
  if (sep === x) return Number(parts.join("."));
  return Number(parts[0] + "." + parts[1]);
}

export function parseAmount(tok, main) {
  const fallback = normCur(main, mainCur());
  let s = String(tok == null ? "" : tok).trim().replace(/^(about|around)~?\s+/i, "");
  if (!s) return null;
  let cur = null;
  const pre = SYM_RE.exec(s);
  if (pre) {
    const hit = ALIASES.find(a => a[0] === pre[1].toLowerCase());
    if (hit) { cur = hit[1]; s = s.slice(pre[0].length); }
  }
  if (!cur) {
    const suf = SUF_RE.exec(s);
    if (suf) {
      const hit = ALIASES.find(a => a[0] === suf[1].toLowerCase());
      if (hit) { cur = hit[1]; s = s.slice(0, suf.index); }
    }
  }
  cur = cur || fallback;
  s = s.replace(/[\s,.]?(rp|idr)$/i, "").trim();
  const m = /^(\d[\d.,]*)\s*(k|rb|ribu|jt|juta|mio|miliar|m|b)?$/i.exec(s);
  if (!m) return null;
  const num = parseDigits(m[1], cur);
  if (num === null || !isFinite(num)) return null;
  const unit = String(m[2] || "").toLowerCase();
  const mult = UNIT_RE.test(unit) ? (/^(k|rb|ribu)$/.test(unit) ? 1e3 : /^(jt|juta|mio|m)$/.test(unit) ? 1e6 : 1e9) : 1;
  const dp = CURS[cur].dp;
  const amt = dp === 0 ? Math.floor(num * mult + 1e-9) : roundTo(num * mult, dp);
  if (!isFinite(amt) || amt <= 0 || amt > 1e13) return null;
  return { amt, cur };
}

export function curToken(t) {
  const s = String(t == null ? "" : t).toLowerCase();
  const hit = ALIASES.find(a => a[0] === s);
  return hit ? hit[1] : null;
}

export function fmtMoney(n, cur) {
  const code = normCur(cur);
  const d = CURS[code];
  const dp = d ? d.dp : 2;
  const v = roundTo(Number(n) || 0, dp);
  const neg = v < 0;
  const abs = Math.abs(v);
  const fixed = abs.toFixed(dp);
  const [ip, fp] = fixed.split(".");
  const grp = d ? d.grp : ",";
  const decSep = d ? d.dec : ".";
  const grouped = ip.replace(/\B(?=(\d{3})+(?!\d))/g, grp);
  return (neg ? "-" : "") + (d ? d.sym : code + " ") + grouped + (dp ? decSep + fp : "");
}

export function curOf(row, main) { return normCur(row && row.cur, normCur(main, mainCur())); }

export function sumByCur(rows, main) {
  const out = new Map();
  for (const e of rows || []) {
    if (!e || typeof e.amt !== "number") continue;
    const c = curOf(e, main);
    const b = out.get(c) || { cur: c, total: 0, n: 0 };
    b.total = roundTo(b.total + e.amt, CURS[c] ? CURS[c].dp : 2);
    b.n += 1;
    out.set(c, b);
  }
  return Array.from(out.values()).sort((a, b) => b.total - a.total);
}

export function multiLine(rows, main) {
  const sums = sumByCur(rows, main);
  if (!sums.length) return "";
  const m = normCur(main, mainCur());
  sums.sort((a, b) => (a.cur === m ? -1 : b.cur === m ? 1 : a.cur < b.cur ? -1 : a.cur > b.cur ? 1 : 0));
  return sums.map(s => fmtMoney(s.total, s.cur)).join(" + ");
}
