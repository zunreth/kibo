
import { COMMANDS, CATS, MENU, menuCommands } from "./commands.js";

export function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const PAGE = {
  title: "kibo commands",
  mark: "kibo",
  h1: "Commands",
  cats: { daily: "Daily", money: "Money", ai: "AI and memory", story: "Story and characters", media: "Media", fun: "Points and games", system: "System" },
  search: "Search commands (coffee, reminder, quote)",
  all: "All",
  menu: "menu",
  eg: "e.g. ",
  tap: "Tap to open in Telegram. It is copied too.",
  tapOff: "Open the bot chat and type any command.",
  empty: "No command matches",
  clear: "Clear the search",
  hits: (n, total) => (n === total ? total + " commands" : n + " of " + total + " commands"),
  foot: "Built from the same source the bot routes, so a command shown here always works. Commands that are not in the Telegram menu still run when you type them.",
};

export function tgLink(user, cmd) {
  return "https://t.me/" + encodeURIComponent(user) + "?text=" + encodeURIComponent("/" + cmd + " ");
}

const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

function css() {
  return `
*,*::before,*::after{box-sizing:border-box}
html{color-scheme:light}
html[data-theme=dark]{color-scheme:dark}
:root{--paper:#fff;--ink:#111214;--muted:#5b6068;--line:#e5e7eb;--edge:#8a9099;--acc:#1155cc;--wash:rgba(17,85,204,.05);--mark:rgba(17,85,204,.14);--shadow:rgba(17,18,20,.14)}
html[data-theme=dark]{--paper:#0f1012;--ink:#edeef0;--muted:#9aa0a8;--line:#24272b;--edge:#6c727a;--acc:#74a9ff;--wash:rgba(116,169,255,.08);--mark:rgba(116,169,255,.2);--shadow:rgba(0,0,0,.6)}
body{margin:0;background:var(--paper);color:var(--ink);font:400 15px/1.45 ${SANS};-webkit-text-size-adjust:100%;transition:background .15s,color .15s}
[hidden]{display:none!important}
.in{max-width:1040px;margin:0 auto;padding:0 16px}
@media(min-width:900px){.in{padding:0 24px}}
.skip{position:absolute;left:-9999px}
.skip:focus{left:8px;top:8px;z-index:40;background:var(--ink);color:var(--paper);padding:9px 12px;font:600 13px/1 ${SANS};text-decoration:none;border-radius:3px}
/* App bar, not a masthead: the bot name on the left, the live result count on the right, one
   hairline. The count is the thing that changes while you type, so it belongs here and doubles as
   the screen-reader status line. */
header.top{border-bottom:1px solid var(--line)}
header.top .in{display:flex;align-items:center;justify-content:space-between;gap:12px;height:52px}
.mark{margin:0;font:600 16px/1.2 ${SANS};letter-spacing:-.01em}
.count{font:500 12px/1 ${SANS};color:var(--muted);font-variant-numeric:tabular-nums}
/* Opaque and layered: a translucent bar let rows scroll through it and became unreadable on the
   owner's phone (v2.85.0 bug 3). Only the search row is sticky; the category tabs scroll away,
   because search is the tool people come here for and the bar should not hold a sixth of a phone. */
.bar{position:sticky;top:0;z-index:10;background:var(--paper);border-bottom:1px solid var(--line);padding:8px 0}
.bar .in{display:flex;gap:8px}
#q{flex:1 1 auto;min-width:0;height:44px;padding:0 12px;border:1px solid var(--edge);border-radius:3px;background:transparent;color:var(--ink);font:400 15px/1 ${SANS};appearance:none}
#q::placeholder{color:var(--muted)}
#th{flex:0 0 auto;min-width:62px;height:44px;padding:0 10px;border:1px solid var(--edge);border-radius:3px;background:transparent;color:var(--ink);font:600 12px/1 ${SANS};cursor:pointer}
#q:focus-visible,#th:focus-visible,.chip:focus-visible,.r:focus-visible,#clr:focus-visible,.skip:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.tabs{border-bottom:1px solid var(--line)}
.tabs .in{display:flex;overflow-x:auto;scrollbar-width:none}
.tabs .in::-webkit-scrollbar{display:none}
.chip{flex:0 0 auto;min-height:44px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:none;color:var(--muted);font:500 13px/1 ${SANS};cursor:pointer;white-space:nowrap}
.chip span{margin-left:5px;font-variant-numeric:tabular-nums;opacity:.65}
.chip.on{color:var(--ink);border-bottom-color:var(--acc)}
main{padding:0 0 8px}
.hint{margin:8px 0 0;font:400 12px/1.3 ${SANS};color:var(--muted)}
/* Section rhythm: one hairline, 12px of air, the label band (numeral, name, count), a hairline, then
   the rows. The gap above is the largest step on the page so a new category is unmistakably a new
   block and not a continuation of the meta line above it.
   This applies to EVERY section, with no first-child exception: the earlier version special-cased the
   first section in DOM order, so filtering to a category gave that section a different rhythm than the
   same section in All (owner caught this, 22 Nov). Same rule everywhere, every view.
   Kept at the smallest value that still reads as a block break: 28 + 1 + 12 = 41px, against 0px between
   rows and 10px under a label, so it is still unmistakably the biggest gap on the page. */
section{margin-top:28px;border-top:1px solid var(--line);padding-top:12px}
.head{display:flex;align-items:baseline;gap:10px;padding:0 0 10px}
.num{min-width:22px;font:500 12px/1 ${MONO};color:var(--muted);font-variant-numeric:tabular-nums}
.head h2{flex:1;margin:0;font:600 16px/1.25 ${SANS};letter-spacing:-.005em}
.head .n{font:500 12px/1 ${SANS};color:var(--muted);font-variant-numeric:tabular-nums}
.rows{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.rows li{border-bottom:1px solid var(--line)}
@media(min-width:780px){section.wide .rows{display:grid;grid-template-columns:1fr 1fr;column-gap:36px}}
.r{position:relative;display:block;padding:9px 20px 9px 0;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent;transition:background .1s}
.r:hover{background:var(--wash)}
.r:active{background:var(--mark)}
.r::after{content:"\\2197";position:absolute;right:2px;top:9px;font:400 12px/1 ${SANS};color:var(--acc);opacity:0;transition:opacity .1s}
.r:hover::after,.r:focus-visible::after{opacity:1}
.cmd{margin-right:7px;font:600 14px/1.3 ${MONO};color:var(--acc)}
.flag{margin-right:7px;font:500 10px/1 ${MONO};color:var(--muted);letter-spacing:.05em}
.d{font:400 15px/1.35 ${SANS}}
.ex{display:block;margin-top:3px;font:400 12px/1.35 ${MONO};color:var(--muted);overflow-wrap:anywhere}
mark{background:var(--mark);color:inherit;border-radius:2px}
.empty{padding:34px 0 6px;text-align:center}
.empty p{margin:0 0 14px;color:var(--muted);font-size:14px}
.empty b{color:var(--ink)}
#clr{min-height:44px;padding:0 16px;border:1px solid var(--edge);border-radius:3px;background:transparent;color:var(--ink);font:600 13px/1 ${SANS};cursor:pointer}
footer{border-top:1px solid var(--line);margin-top:22px;padding:14px 0 36px;color:var(--muted);font:400 12px/1.5 ${SANS}}
footer .in{max-width:62ch}
/* No scroll-reveal here on purpose. It used to hide every section and let an intersection observer
   take the hiding class off, which meant a section revealed by FILTERING could stay at opacity 0, since
   it was never scrolled into view. A list that can render itself invisible is not worth a fade.
   Motion on this page is what the person does: hover, focus and press on a row. */
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
}

function js() {
  return `
(function(){
  var root=document.documentElement,th=document.getElementById('th'),
      q=document.getElementById('q'),clr=document.getElementById('clr'),
      rows=[].slice.call(document.querySelectorAll('.r')),
      chips=[].slice.call(document.querySelectorAll('.chip')),
      secs=[].slice.call(document.querySelectorAll('section')),
      none=document.getElementById('none'),nq=document.getElementById('nq'),
      hits=document.getElementById('hits'),cat='all',total=rows.length;
  function theme(t,keep){
    root.setAttribute('data-theme',t);
    th.textContent=t==='dark'?'Light':'Dark';
    th.setAttribute('aria-label',t==='dark'?'Switch to the light theme':'Switch to the dark theme');
    if(keep){try{localStorage.setItem('kb_theme',t)}catch(e){}}
  }
  theme(root.getAttribute('data-theme')==='dark'?'dark':'light',false);
  th.addEventListener('click',function(){
    theme(root.getAttribute('data-theme')==='dark'?'light':'dark',true);
  });
  function esc(s){return s.replace(/[&<>]/g,function(c){return c==='&'?'&amp;':c==='<'?'&lt;':'&gt;'})}
  function paint(el,re){
    if(el.getAttribute('data-raw')===null)el.setAttribute('data-raw',el.textContent);
    var raw=el.getAttribute('data-raw');
    if(!re){el.textContent=raw;return}
    var out='',last=0,m;
    re.lastIndex=0;
    while((m=re.exec(raw))!==null){
      out+=esc(raw.slice(last,m.index))+'<mark>'+esc(m[0])+'</mark>';
      last=m.index+m[0].length;
      if(m.index===re.lastIndex)re.lastIndex++;
    }
    if(!last){el.textContent=raw;return}
    el.innerHTML=out+esc(raw.slice(last));
  }
  function apply(){
    var t=(q.value||'').trim().toLowerCase(),re=null,shown=0;
    if(t.length>=2)re=new RegExp(t.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&'),'gi');
    rows.forEach(function(r){
      var hit=(cat==='all'||r.getAttribute('data-cat')===cat)&&(!t||r.getAttribute('data-s').indexOf(t)>=0);
      r.parentNode.hidden=!hit;
      if(hit)shown++;
      [].slice.call(r.querySelectorAll('.cmd,.d,.ex')).forEach(function(e){paint(e,re)});
    });
    secs.forEach(function(s){
      var any=[].slice.call(s.querySelectorAll('.r')).some(function(r){return !r.parentNode.hidden});
      s.hidden=!any;
    });
    none.hidden=shown>0;
    nq.textContent='"'+(q.value||'').trim()+'"';
    hits.textContent=shown===total?total+' commands':shown+' of '+total+' commands';
    chips.forEach(function(x){
      var on=x.getAttribute('data-cat')===cat;
      x.classList[on?'add':'remove']('on');
      x.setAttribute('aria-pressed',on?'true':'false');
    });
  }
  function legacyCopy(text){
    try{
      var ta=document.createElement('textarea');
      ta.value=text;ta.setAttribute('readonly','');
      ta.style.cssText='position:fixed;top:-1000px;left:0';
      document.body.appendChild(ta);ta.select();
      var ok=document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }catch(e){return false}
  }
  function copy(text){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text).then(function(){return true},function(){return legacyCopy(text)});
    }
    return Promise.resolve(legacyCopy(text));
  }
  // Tap a row: copy the command, then follow the t.me link. Telegram only fills the input when the
  // link OPENS the chat; if that chat is already on screen the client just focuses it and the text is
  // dropped (owner hit this on 22 Nov). The copy is what makes the tap worth something in that case,
  // and it costs nothing when the prefill does work.
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a.r'):null;
    if(!a||e.button||e.metaKey||e.ctrlKey||e.shiftKey)return;
    var cmd=a.getAttribute('data-cmd'),url=a.getAttribute('href');
    if(!cmd||!url)return;
    e.preventDefault();
    Promise.race([copy(cmd),new Promise(function(r){setTimeout(r,180)})]).then(function(){
      location.href=url;
    });
  });
  q.addEventListener('input',apply);
  q.addEventListener('keydown',function(e){if(e.key==='Escape'){q.value='';apply()}});
  document.addEventListener('keydown',function(e){
    if(e.key==='/'&&document.activeElement!==q){e.preventDefault();q.focus()}
  });
  clr.addEventListener('click',function(){q.value='';cat='all';apply();q.focus()});
  chips.forEach(function(c){
    c.addEventListener('click',function(){cat=c.getAttribute('data-cat');apply()});
  });
  apply();
})();`;
}

export function renderHelpPage(env) {
  const P = PAGE;
  const user = String((env && env.BOT_USERNAME) || "").replace(/^@+/, "").trim();
  const menuSet = new Set(MENU);
  const total = COMMANDS.length;

  let n = 0;
  const body = CATS.map(cat => {
    const rows = COMMANDS.filter(x => x.cat === cat);
    if (!rows.length) return "";
    n += 1;
    const num = String(n).padStart(2, "0");
    const items = rows.map(x => {
      const attrs = ' data-cat="' + escHtml(cat) + '" data-s="' +
        escHtml((x.c + " " + x.d + " " + x.ex).toLowerCase()) + '" data-cmd="' +
        escHtml("/" + x.c + " ") + '"';
      const inner = '<span class="cmd">/' + escHtml(x.c) + "</span>" +
        (menuSet.has(x.c) ? '<span class="flag">' + escHtml(P.menu) + "</span>" : "") +
        '<span class="d">' + escHtml(x.d) + "</span>" +
        '<span class="ex">' + escHtml(P.eg) + escHtml(x.ex) + "</span>";
      const tag = user
        ? '<a class="r" href="' + escHtml(tgLink(user, x.c)) + '"' + attrs + ">"
        : '<div class="r"' + attrs + ">";
      return "<li>" + tag + inner + (user ? "</a>" : "</div>") + "</li>";
    }).join("");
    return '<section' + (rows.length >= 12 ? ' class="wide"' : "") + ">" +
      '<div class="head"><span class="num" aria-hidden="true">' + num + "</span>" +
      "<h2>" + escHtml(P.cats[cat] || cat) + "</h2>" +
      '<span class="n">' + rows.length + "</span></div>" +
      '<ul class="rows">' + items + "</ul></section>";
  }).join("");

  const chips = [{ k: "all", t: P.all, n: total }]
    .concat(CATS.map(c => ({ k: c, t: P.cats[c] || c, n: COMMANDS.filter(x => x.cat === c).length })))
    .map((c, i) => '<button type="button" class="chip' + (i === 0 ? " on" : "") + '" data-cat="' +
      escHtml(c.k) + '"' + (i === 0 ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" +
      escHtml(c.t) + "<span>" + c.n + "</span></button>").join("");

  const boot = "try{var t=localStorage.getItem('kb_theme');" +
    "if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';" +
    "document.documentElement.setAttribute('data-theme',t)}catch(e){" +
    "document.documentElement.setAttribute('data-theme','light')}";

  return "<!doctype html><html lang=\"en\" data-theme=\"light\"><head><meta charset=\"utf-8\">" +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    "<title>" + escHtml(P.title) + "</title><style>" + css() + "</style>" +
    "<script>" + boot + "</script></head><body>" +
    '<a class="skip" href="#list">Skip to the commands</a>' +
    '<header class="top"><div class="in">' +
    '<h1 class="mark">' + escHtml(P.mark) + "</h1>" +
    '<span class="count" id="hits" role="status" aria-live="polite">' + P.hits(total, total) + "</span></div></header>" +
    '<div class="bar"><div class="in">' +
    '<input id="q" type="search" inputmode="search" autocomplete="off" spellcheck="false" aria-label="' +
    escHtml(P.search) + '" placeholder="' + escHtml(P.search) + '">' +
    '<button id="th" type="button" aria-label="Switch to the dark theme">Dark</button></div></div>' +
    '<div class="tabs"><div class="in" role="group" aria-label="Filter by category">' + chips + "</div></div>" +
    '<main id="list"><div class="in">' +
    '<p class="hint">' + escHtml(user ? P.tap : P.tapOff) + "</p>" +
    body +
    '<div id="none" class="empty" hidden><p>' + escHtml(P.empty) + ' <b id="nq"></b></p>' +
    '<button id="clr" type="button">' + escHtml(P.clear) + "</button></div></div></main>" +
    "<footer><div class=\"in\">" + escHtml(P.foot) + "</div></footer>" +
    "<script>" + js() + "</script></body></html>";
}

export function helpPageUrl(env, fallbackBase) {
  const base = String((env && env.SELF_BASE) || fallbackBase || "").replace(/\/+$/, "");
  return (base || "https://bot.example.workers.dev") + "/help";
}
