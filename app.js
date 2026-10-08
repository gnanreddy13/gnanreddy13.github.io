function $(id) { return document.getElementById(id); }
var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- clock: my time (IST) on one line, how far the visitor is from it on the next ----------
function renderClock() {
  var now = new Date();
  var t = now.toLocaleTimeString("en", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).toLowerCase();
  var d = now.toLocaleDateString("en", { timeZone: "Asia/Kolkata", weekday: "short", month: "short", day: "numeric" }).toLowerCase();
  var diff = -now.getTimezoneOffset() - 330;           // visitor minus IST, in minutes
  var a = Math.abs(diff), h = Math.floor(a / 60), m = a % 60;
  var span = (h ? h + "h" : "") + (h && m ? " " : "") + (m ? m + "m" : "");
  var rel = diff === 0 ? "same time as me" : "you're " + span + (diff < 0 ? " behind" : " ahead");
  $("clock").innerHTML = t + " ist · " + d + '<span class="rel">' + rel + "</span>";
}
renderClock();
setInterval(renderClock, 15000);

// ---------- activity grids (past year, scrollable; 15 weeks visible on phones, 25 on desktop) ----------
var LABEL = { gh: ["contribution", "contributions"], lc: ["submission", "submissions"] };
var data = {}, shown = {}, offs = {}, drawn = {}, sig = {}, stale = {};
var atEnd = { gh: true, lc: true };
var hov = { gh: false, lc: false };          // mouse is over that graph

// the line under "past year": a hint at rest, the hovered day otherwise
// (GitHub day on the left, LeetCode day on the right)
var elGh = $("rd-gh"), elLc = $("rd-lc"), elHint = $("rd-hint");
var owner = null;

// the hint matches the device: touch screens have no hover
elHint.textContent = window.matchMedia("(hover: none)").matches
  ? "tap a day, swipe to scroll back"
  : "hover a day for details, drag to scroll back";

function showRow(mode, text) {
  elHint.hidden = mode !== "rest";
  elGh.hidden = mode !== "gh";
  elLc.hidden = mode !== "lc";
  if (mode === "gh") elGh.textContent = text;
  if (mode === "lc") elLc.textContent = text;
}
function showDefault() { showRow("rest"); }

function vis() { return window.innerWidth <= 480 ? 15 : 25; }   // keep in sync with --w in style.css
function lab(which, n) { return LABEL[which][n === 1 ? 0 : 1]; }
function valid(a) {
  return Array.isArray(a) && a.length > 0 &&
         typeof a[0].date === "string" && typeof a[0].count === "number";
}
function dow(s) { return new Date(s + "T00:00:00Z").getUTCDay(); }   // 0 = Sunday
function setStat(which, text) { $("s-" + which).textContent = text; }
function skeleton(which) {
  var h = "", n = vis() * 7;
  for (var i = 0; i < n; i++) h += '<i class="sk"></i>';
  $("b-" + which).innerHTML = '<div class="track">' + h + '</div>';
}

// ---------- dates: the year appears only where it is needed ----------
function yr(s) { return new Date(s + "T00:00:00Z").getUTCFullYear(); }
function md(s) {
  return new Date(s + "T00:00:00Z")
    .toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }).toLowerCase();
}
// phones get a short year ('25) so the line fits; wider screens get the full year
function ys(y, full) { return (full || window.innerWidth > 600) ? String(y) : "'" + String(y).slice(2); }

// single day (the hover line has room, so the full year)
function niceDate(s) {
  var y = yr(s);
  return y === new Date().getFullYear() ? md(s) : md(s) + " " + ys(y, true);
}
// range: year only on an end that isn't this year, written once if both ends share a past year
function niceRange(a, b) {
  var cur = new Date().getFullYear(), ya = yr(a), yb = yr(b);
  if (ya === yb) return md(a) + "–" + md(b) + (ya === cur ? "" : " " + ys(ya));
  return md(a) + (ya === cur ? "" : " " + ys(ya)) + "–" + md(b) + (yb === cur ? "" : " " + ys(yb));
}

function unmark() {
  ["gh", "lc"].forEach(function (w) {
    var p = $("b-" + w).querySelector(".on");
    if (p) p.classList.remove("on");
  });
}
function clearAll() {
  unmark();
  owner = null;
  showDefault();
}
function pick(which, el) {
  unmark();
  el.classList.add("on");
  var n = Number(el.dataset.c);
  showRow(which, niceDate(el.dataset.d) + " · " + n + " " + lab(which, n));
  owner = which;
}

// total + range under the graph:
//   at rest             -> past-year total, full span
//   hovering / sliding  -> total and range of the weeks currently in view
function update(which) {
  var days = shown[which];
  if (!days) return;
  var bars = $("b-" + which), sc = $("sc-" + which), n = days.length;
  var first = bars.firstChild.firstChild;
  var st = (first ? first.getBoundingClientRect().width : 0) + 2;
  if (st <= 2) return;
  var off = offs[which];
  var w0 = Math.round(bars.scrollLeft / st);
  var cols = Math.round((bars.clientWidth + 2) / st);
  var lo = Math.max(0, w0 * 7 - off), hi = Math.min(n, (w0 + cols) * 7 - off);
  var total = 0;
  for (var i = lo; i < hi; i++) total += days[i].count;
  var year = 0;
  for (var j = 0; j < n; j++) year += days[j].count;
  atEnd[which] = bars.scrollLeft + bars.clientWidth >= bars.scrollWidth - 2;
  sc.dataset.l = bars.scrollLeft > 2 ? "1" : "0";
  sc.dataset.r = atEnd[which] ? "0" : "1";

  var live = !atEnd[which] || hov[which];      // sliding away from today, or mouse over the graph
  var shownTotal = live ? total : year;
  setStat(which, shownTotal + " " + lab(which, shownTotal) + (live ? "" : (stale[which] || "")));
  $("r-" + which).textContent = live
    ? niceRange(days[lo].date, days[Math.max(lo, hi - 1)].date)
    : niceRange(days[0].date, days[n - 1].date);
}

function draw(which) {
  var arr = data[which];
  if (!arr) return;
  var days = arr.slice(-364), key = JSON.stringify(days);
  if (sig[which] === key) return;            // identical data: don't re-render (no flicker)
  sig[which] = key;
  shown[which] = days;

  var n = days.length, off = dow(days[0].date), v = vis(), bars = $("b-" + which);
  offs[which] = off;
  var weeks = Math.ceil((n + off) / 7);
  var max = Math.max.apply(null, days.map(function (d) { return d.count; })) || 1;
  var keep = drawn[which] && !atEnd[which] ? bars.scrollLeft : null;
  if (owner === which) clearAll();
  bars.classList.toggle("anim", !drawn[which] && !reduce);   // animate only the first real draw
  drawn[which] = true;
  bars.innerHTML = '<div class="track">' + days.map(function (d, i) {
    var l = d.count ? Math.ceil(d.count / max * 4) : 0;
    var wk = Math.floor((i + off) / 7);
    var style = "--i:" + Math.max(0, wk - (weeks - v)) + (i === 0 ? ";grid-row-start:" + (off + 1) : "");
    return '<i data-l="' + l + '" data-d="' + d.date + '" data-c="' + d.count + '" style="' + style + '"></i>';
  }).join("") + '</div>';
  bars.scrollLeft = keep !== null ? keep : bars.scrollWidth;   // open on today

  var last = days[n - 1].date;
  stale[which] = (Date.now() - Date.parse(last)) / 864e5 > 3 ? " · as of " + md(last) : "";
  update(which);
}

// interactions: hover/tap reads a day, swipe/drag scrolls
["gh", "lc"].forEach(function (which) {
  var bars = $("b-" + which);
  var down = false, moved = false, sx = 0, sl = 0, ticking = false;

  bars.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "mouse") { hov[which] = true; update(which); }
  });
  bars.addEventListener("pointerover", function (e) {
    if (e.pointerType === "mouse" && !down && e.target.tagName === "I" && e.target.dataset.d) pick(which, e.target);
  });
  bars.addEventListener("pointerleave", function (e) {
    if (e.pointerType !== "mouse") return;
    hov[which] = false;
    update(which);
    if (!down && owner === which) clearAll();
  });
  bars.addEventListener("click", function (e) {
    if (moved) return;
    if (e.target.tagName === "I" && e.target.dataset.d) pick(which, e.target); else clearAll();
  });

  // mouse drag to scroll (touch and trackpad scroll natively)
  bars.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button) return;
    down = true; moved = false; sx = e.clientX; sl = bars.scrollLeft;
  });
  window.addEventListener("pointermove", function (e) {
    if (!down) return;
    var dx = e.clientX - sx;
    if (Math.abs(dx) > 3) { moved = true; bars.classList.add("dragging"); if (owner === which) clearAll(); }
    bars.scrollLeft = sl - dx;
  });
  window.addEventListener("pointerup", function () {
    if (!down) return;
    down = false;
    bars.classList.remove("dragging");
    setTimeout(function () { moved = false; }, 0);
  });

  // keep the total and range in sync while scrolling (one update per frame)
  bars.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (owner === which) clearAll();
      update(which);
    });
  }, { passive: true });

  // on resize (or crossing the phone breakpoint), stay on today if we were on today
  new ResizeObserver(function () {
    if (atEnd[which]) bars.scrollLeft = bars.scrollWidth;
    update(which);
  }).observe(bars);
});
document.addEventListener("pointerdown", function (e) {
  if (owner !== null && !e.target.closest(".bars")) clearAll();
});

// cached copy shows instantly; each source is tried in order; failure is stated, never faked
function loadActivity(which, sources) {
  var key = "activity-" + which, cached = null;
  skeleton(which);
  setStat(which, "loading…");
  try { cached = JSON.parse(localStorage.getItem(key)); } catch (e) {}
  if (valid(cached)) { data[which] = cached; draw(which); }
  (function next(i) {
    if (i >= sources.length) {
      if (!data[which]) setStat(which, "unavailable");
      return;
    }
    fetch(sources[i][0], { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var arr = sources[i][1](d);
        if (!valid(arr)) throw 0;
        data[which] = arr;
        try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
        draw(which);
      })
      .catch(function () { next(i + 1); });
  })(0);
}

var same = function (d) { return d; };
loadActivity("gh", [
  ["github.json", same],                                   // written by the nightly Action
  ["https://github-contributions-api.jogruber.de/v4/gnanreddy13?y=last",
    function (d) { return d.contributions; }]              // fallback
]);
loadActivity("lc", [["leetcode.json", same]]);
showDefault();

// ---------- permanent facts (never touched by hover) ----------
// LeetCode: solved total in the header; easy · medium · hard counts under the graph
// (narrow screens show just the first letter of each word)
var lcStats = null;
function renderSolved() {
  $("solved-n").textContent = Number(lcStats.solved) + " solved";
  $("solved-d").innerHTML =
    Number(lcStats.easy)   + ' e<span class="w">asy</span> · ' +
    Number(lcStats.medium) + ' m<span class="w">edium</span> · ' +
    Number(lcStats.hard)   + ' h<span class="w">ard</span>';
}
fetch("leetcode-stats.json", { cache: "no-cache" })
  .then(function (r) { if (!r.ok) throw 0; return r.json(); })
  .then(function (s) { lcStats = s; renderSolved(); })
  .catch(function () {});                                  // file missing: those spots stay empty

// GitHub: public repo count in the header, last push date under the graph.
// Source order: github-stats.json (written nightly by the Action), then the live API as a fallback.
// A cached copy shows instantly, and if everything fails the last known values stay.
var gh = {};
try { gh = JSON.parse(localStorage.getItem("gh-facts")) || {}; } catch (e) {}
function renderGh() {
  if (typeof gh.repos === "number") $("gh-repos").textContent = gh.repos + (gh.repos === 1 ? " repo" : " repos");
  if (gh.pushed) {
    var d = new Date(gh.pushed);
    if (!isNaN(d)) {
      var o = { month: "short", day: "numeric" };
      if (d.getFullYear() !== new Date().getFullYear()) o.year = "numeric";   // year only when not this year
      $("gh-push").textContent = "last push " + d.toLocaleDateString("en", o).replace(",", "").toLowerCase();
    }
  }
}
function saveGh() { try { localStorage.setItem("gh-facts", JSON.stringify(gh)); } catch (e) {} }
function takeGh(s) {
  if (!s || typeof s.repos !== "number" || !s.pushed) throw 0;
  gh.repos = s.repos; gh.pushed = s.pushed; saveGh(); renderGh();
}
renderGh();
fetch("github-stats.json", { cache: "no-cache" })
  .then(function (r) { if (!r.ok) throw 0; return r.json(); })
  .then(takeGh)
  .catch(function () {
    // file missing: fall back to the live API
    Promise.all([
      fetch("https://api.github.com/users/gnanreddy13").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
      fetch("https://api.github.com/users/gnanreddy13/repos?sort=pushed&per_page=1").then(function (r) { if (!r.ok) throw 0; return r.json(); })
    ]).then(function (res) {
      takeGh({ repos: res[0].public_repos, pushed: res[1][0] && res[1][0].pushed_at });
    }).catch(function () {});
  });

// ---------- projects: scrollable list with edge fades + arrows ----------
var plist = $("plist"), pw = $("pw");
function plistFade() {
  var more = plist.scrollTop + plist.clientHeight < plist.scrollHeight - 2;
  var back = plist.scrollTop > 2;
  plist.classList.toggle("fade-t", back);
  plist.classList.toggle("fade-b", more);
  pw.dataset.t = back ? "1" : "0";
  pw.dataset.b = more ? "1" : "0";
}
plist.addEventListener("scroll", plistFade, { passive: true });
new ResizeObserver(plistFade).observe(plist);
plistFade();

// ---------- skills highlight matching project hashtags ----------
var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
var tags = Array.prototype.slice.call(document.querySelectorAll(".tag"));
var projectsEl = document.querySelector(".projects");
var activeChip = null;

function highlight(chip) {
  activeChip = chip;
  var keys = chip ? chip.dataset.skill.split(" ") : [];
  chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
  tags.forEach(function (t) { t.classList.toggle("on", keys.indexOf(t.dataset.tag) > -1); });
  projectsEl.classList.toggle("filtering", !!chip);
  updateCounts();
}
chips.forEach(function (c) {
  c.addEventListener("click", function () { highlight(activeChip === c ? null : c); });
});

// ---------- projects: active / completed tabs ----------
var ptabs = Array.prototype.slice.call(document.querySelectorAll(".ptab"));
var pmore = $("pmore"), pempty = $("pempty");
var MORE = {
  active: "https://github.com/gnanreddy13?tab=repositories&sort=updated",
  done:   "https://github.com/gnanreddy13?tab=repositories"
};
function showStatus(s) {
  var n = 0;
  Array.prototype.forEach.call(document.querySelectorAll(".project"), function (p) {
    var on = p.dataset.status === s;
    p.hidden = !on;
    if (on) n++;
  });
  pempty.hidden = n > 0;
  ptabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t.dataset.s === s)); });
  pmore.href = MORE[s];
  plist.scrollTop = 0;
  plistFade();
}
ptabs.forEach(function (t) {
  t.addEventListener("click", function () { showStatus(t.dataset.s); });
});

// tab badges: totals normally, matches while a skill is selected
function updateCounts() {
  var filtering = !!activeChip;
  ptabs.forEach(function (t) {
    var s = t.dataset.s, name = s === "done" ? "completed" : "active";
    var items = document.querySelectorAll('.project[data-status="' + s + '"]');
    var total = items.length, hits = 0;
    Array.prototype.forEach.call(items, function (p) {
      if (p.querySelector(".tag.on")) hits++;
    });
    var badge = t.querySelector("span");
    badge.textContent = filtering ? hits : total;
    badge.classList.toggle("hit", filtering && hits > 0);
    badge.classList.toggle("none", filtering && hits === 0);
    t.setAttribute("aria-label", filtering
      ? name + ", " + hits + " of " + total + " match"
      : name + ", " + total);
  });
}
updateCounts();
showStatus("active");

// ---------- arrow buttons: scroll their target by about 80% of its size ----------
Array.prototype.forEach.call(document.querySelectorAll(".arr"), function (btn) {
  btn.addEventListener("click", function () {
    var t = $(btn.dataset.for), dir = Number(btn.dataset.dir);
    var horizontal = t.id !== "plist";
    var d = dir * (horizontal ? t.clientWidth : t.clientHeight) * 0.8;
    t.scrollBy({
      left: horizontal ? d : 0,
      top: horizontal ? 0 : d,
      behavior: reduce ? "auto" : "smooth"
    });
  });
});

// ---------- page scroll: on only when content overflows by more than 6px ----------
var bodyEl = document.body, mainEl = document.querySelector("main");
function fit() {
  bodyEl.style.overflowY = "hidden";
  var over = bodyEl.scrollHeight - bodyEl.clientHeight;
  bodyEl.style.overflowY = over > 6 ? "auto" : "hidden";
  if (over <= 6) bodyEl.scrollTop = 0;
}
fit();
window.addEventListener("resize", fit);
window.addEventListener("load", fit);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
var fitRO = new ResizeObserver(fit);
Array.prototype.forEach.call(mainEl.children, function (c) { fitRO.observe(c); });