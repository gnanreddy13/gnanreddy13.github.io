function $(id) { return document.getElementById(id); }
var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- activity grids (past year, scrollable; 15 weeks visible on phones, 25 on desktop) ----------
var LABEL = { gh: ["contribution", "contributions"], lc: ["submission", "submissions"] };
var data = {}, shown = {}, offs = {}, drawn = {}, sig = {}, stale = {};
var atEnd = { gh: true, lc: true };

// hover result line under "past year": GitHub day on the left, LeetCode day on the right.
// It is the only thing that line ever shows, so it can't clash with the permanent facts.
var elGh = $("rd-gh"), elLc = $("rd-lc");
var owner = null;

function showRow(mode, text) {
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
function niceDate(s) {
  return new Date(s + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
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

// total at rest, window range while sliding; arrows show which directions have more
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
  setStat(which, atEnd[which]
    ? year + " " + lab(which, year) + (stale[which] || "")
    : total + " · " + days[lo].date.slice(5) + "–" + days[Math.max(lo, hi - 1)].date.slice(5));
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
  stale[which] = (Date.now() - Date.parse(last)) / 864e5 > 3 ? " · as of " + last.slice(5) : "";
  update(which);
}

// interactions: hover/tap reads a day, swipe/drag scrolls
["gh", "lc"].forEach(function (which) {
  var bars = $("b-" + which);
  var down = false, moved = false, sx = 0, sl = 0, ticking = false;

  bars.addEventListener("pointerover", function (e) {
    if (e.pointerType === "mouse" && !down && e.target.tagName === "I" && e.target.dataset.d) pick(which, e.target);
  });
  bars.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse" && !down && owner === which) clearAll();
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

  // keep the window total in sync while scrolling (one update per frame)
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
// LeetCode: solved total in the header, easy/medium/hard under the graph
var lcStats = null;
function renderSolved() {
  $("solved-n").textContent = Number(lcStats.solved) + " solved";
  $("solved-d").innerHTML =
    '<span class="e">' + Number(lcStats.easy) + 'e</span> ' +
    '<span class="m">' + Number(lcStats.medium) + 'm</span> ' +
    '<span class="h">' + Number(lcStats.hard) + 'h</span>';
}
fetch("leetcode-stats.json", { cache: "no-cache" })
  .then(function (r) { if (!r.ok) throw 0; return r.json(); })
  .then(function (s) { lcStats = s; renderSolved(); })
  .catch(function () {});                                  // file missing: those spots stay empty

// GitHub: public repo count in the header, last push date under the graph.
// Cached copy shows instantly; if the API is rate-limited or offline, the last known values stay.
var gh = {};
try { gh = JSON.parse(localStorage.getItem("gh-facts")) || {}; } catch (e) {}
function renderGh() {
  if (typeof gh.repos === "number") $("gh-repos").textContent = gh.repos + (gh.repos === 1 ? " repo" : " repos");
  if (gh.pushed) {
    var d = new Date(gh.pushed);
    if (!isNaN(d)) {
      $("gh-push").textContent = "last push " +
        d.toLocaleDateString("en", { month: "short", day: "numeric" }).toLowerCase();
    }
  }
}
function saveGh() { try { localStorage.setItem("gh-facts", JSON.stringify(gh)); } catch (e) {} }
renderGh();
fetch("https://api.github.com/users/gnanreddy13")
  .then(function (r) { if (!r.ok) throw 0; return r.json(); })
  .then(function (u) {
    if (typeof u.public_repos !== "number") throw 0;
    gh.repos = u.public_repos; saveGh(); renderGh();
  })
  .catch(function () {});
fetch("https://api.github.com/users/gnanreddy13/repos?sort=pushed&per_page=1")
  .then(function (r) { if (!r.ok) throw 0; return r.json(); })
  .then(function (list) {
    if (!Array.isArray(list) || !list[0] || !list[0].pushed_at) throw 0;
    gh.pushed = list[0].pushed_at; saveGh(); renderGh();
  })
  .catch(function () {});

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

// ---------- skill chips highlight matching project hashtags ----------
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

// tab badges: totals normally, matches while a skill chip is selected
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