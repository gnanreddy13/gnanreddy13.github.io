// everything is scoped to this function, so nothing leaks into the page's globals
(function () {

function $(id) { return document.getElementById(id); }
function icon(id) { return '<svg class="i" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
function getJSON(url, opts) {
  return fetch(url, opts).then(function (r) {
    if (!r.ok) throw new Error(url + ": " + r.status);
    return r.json();
  });
}
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
  $("clock").innerHTML = icon("clock") + t + " ist · " + icon("cal") + d + '<span class="rel">' + rel + "</span>";
}
renderClock();
setInterval(renderClock, 15000);

// ---------- activity grids (past year, stacked; the whole year on desktop, 26 or 39 weeks, scrollable, on narrow screens) ----------
var LABEL = { gh: ["contribution", "contributions"], lc: ["submission", "submissions"] };
var data = {}, shown = {}, offs = {}, drawn = {}, sig = {}, stale = {};
var atEnd = { gh: true, lc: true };
var hov = { gh: false, lc: false };          // mouse is over that graph

// each panel header keeps its permanent fact on the left; the hovered day appears on the right while hovering
var elGh = $("rd-gh"), elLc = $("rd-lc");
var owner = null;

// the hint under "past year" matches the device: touch screens have no hover
$("rd-hint").textContent = window.matchMedia("(hover: none)").matches
  ? "// tap a day, swipe to scroll back"
  : "// hover a day to see it";

function showRow(mode, text) {
  elGh.hidden = mode !== "gh";
  elLc.hidden = mode !== "lc";
  if (mode === "gh") elGh.innerHTML = icon("cal") + text;   // text is built from dates and numbers only
  if (mode === "lc") elLc.innerHTML = icon("cal") + text;
}
function showDefault() { showRow("rest"); }

function vis() { var w = window.innerWidth; return w <= 480 ? 26 : w <= 600 ? 39 : 53; }   // keep in sync with --w in style.css
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
// single day
function niceDate(s) {
  var y = yr(s);
  return y === new Date().getFullYear() ? md(s) : md(s) + " " + y;
}
// range: year only on an end that isn't this year, written once if both ends share a past year
function niceRange(a, b) {
  var cur = new Date().getFullYear(), ya = yr(a), yb = yr(b);
  if (ya === yb) return md(a) + "–" + md(b) + (ya === cur ? "" : " " + ya);
  return md(a) + (ya === cur ? "" : " " + ya) + "–" + md(b) + (yb === cur ? "" : " " + yb);
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
  var track = bars.firstChild, first = track && track.firstChild;
  if (!first) return;
  var gap = parseFloat(getComputedStyle(track).columnGap) || 0;   // --gap in style.css
  var st = first.getBoundingClientRect().width + gap;
  if (st <= gap) return;
  var off = offs[which];
  var w0 = Math.round(bars.scrollLeft / st);
  var cols = Math.round((bars.clientWidth + gap) / st);
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
  refreshFolds();
}

// interactions: hover/tap reads a day, swipe/drag scrolls, arrow keys walk the days
["gh", "lc"].forEach(function (which) {
  var bars = $("b-" + which);
  var down = false, moved = false, sx = 0, sl = 0, ticking = false, keying = false, keyTimer = null;

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
      if (owner === which && !keying) clearAll();
      update(which);
    });
  }, { passive: true });

  // keyboard: up/down = a day, left/right = a week, home/end = ends, esc = clear
  bars.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { clearAll(); return; }
    var cells = bars.querySelectorAll("i[data-d]");
    if (!cells.length) return;
    var step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
    var cur = bars.querySelector(".on");
    var i = cur ? Array.prototype.indexOf.call(cells, cur) : cells.length - 1;   // first press lands on today
    if (e.key === "Home") i = 0;
    else if (e.key === "End") i = cells.length - 1;
    else if (step !== undefined) { if (cur) i = Math.max(0, Math.min(cells.length - 1, i + step)); }
    else return;
    e.preventDefault();

    var el = cells[i];
    keying = true;                                  // the scroll below must not clear the selection
    clearTimeout(keyTimer);
    var br = bars.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = 30;   // clear of the edge arrows
    if (r.left < br.left + pad) bars.scrollLeft -= br.left + pad - r.left;
    else if (r.right > br.right - pad) bars.scrollLeft += r.right - (br.right - pad);
    pick(which, el);
    keyTimer = setTimeout(function () { keying = false; }, 150);
  });
  bars.addEventListener("blur", function () {
    if (owner === which && !down) clearAll();       // tabbing away clears the selected day
  });

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
    getJSON(sources[i][0], { cache: "no-cache" })
      .then(function (d) {
        var arr = sources[i][1](d);
        if (!valid(arr)) throw new Error(sources[i][0] + ": invalid data");
        data[which] = arr;
        try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
        draw(which);
      })
      .catch(function () { next(i + 1); });
  })(0);
}

var same = function (d) { return d; };
loadActivity("gh", [
  ["data/github.json", same],                              // written by the nightly Action
  ["https://github-contributions-api.jogruber.de/v4/gnanreddy13?y=last",
    function (d) { return d.contributions; }]              // fallback
]);
loadActivity("lc", [["data/leetcode.json", same]]);
showDefault();

// ---------- permanent facts (never touched by hover) ----------
// LeetCode: solved total in the header; easy · medium · hard counts under the graph
// A cached copy shows instantly, and if the fetch fails the last known values stay.
var lcStats = null;
try { lcStats = JSON.parse(localStorage.getItem("lc-facts")); } catch (e) {}
function renderSolved() {
  if (!lcStats || typeof lcStats.solved !== "number") return;
  $("solved-n").textContent = Number(lcStats.solved) + " solved";
  $("solved-d").textContent =
    Number(lcStats.easy) + " easy · " + Number(lcStats.medium) + " medium · " + Number(lcStats.hard) + " hard";
  refreshFolds();
}
renderSolved();
getJSON("data/leetcode-stats.json", { cache: "no-cache" })
  .then(function (s) {
    if (!s || typeof s.solved !== "number") throw new Error("leetcode stats: invalid data");
    lcStats = s;
    try { localStorage.setItem("lc-facts", JSON.stringify(s)); } catch (e) {}
    renderSolved();
  })
  .catch(function () {});                                  // fetch failed: the cached values (if any) stay

// GitHub: public repo count in the header, last push date under the graph.
// Source order: data/github-stats.json (written nightly by the Action), then the live API as a fallback.
// A cached copy shows instantly, and if everything fails the last known values stay.
var gh = {};
try { gh = JSON.parse(localStorage.getItem("gh-facts")) || {}; } catch (e) {}
function renderGh() {
  if (typeof gh.repos === "number") $("gh-repos").textContent = gh.repos + (gh.repos === 1 ? " repo" : " repos");
  if (gh.pushed) {
    var d = new Date(gh.pushed);
    if (!isNaN(d)) {
      var o = { month: "short", day: "numeric", timeZone: "UTC" };   // UTC, like the graph days, so the two always agree
      if (d.getUTCFullYear() !== new Date().getUTCFullYear()) o.year = "numeric";   // year only when not this year
      $("gh-push").textContent = "last push " + d.toLocaleDateString("en", o).replace(",", "").toLowerCase();
    }
  }
}
function saveGh() { try { localStorage.setItem("gh-facts", JSON.stringify(gh)); } catch (e) {} }
function takeGh(s) {
  if (!s || typeof s.repos !== "number" || !s.pushed) throw new Error("github stats: invalid data");
  gh.repos = s.repos; gh.pushed = s.pushed; saveGh(); renderGh();
}
renderGh();
getJSON("data/github-stats.json", { cache: "no-cache" })
  .then(takeGh)
  .catch(function () {
    // file missing: fall back to the live API
    Promise.all([
      getJSON("https://api.github.com/users/gnanreddy13"),
      getJSON("https://api.github.com/users/gnanreddy13/repos?sort=pushed&per_page=1")
    ]).then(function (res) {
      takeGh({ repos: res[0].public_repos, pushed: res[1][0] && res[1][0].pushed_at });
    }).catch(function () {});
  });

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
var pbar = document.createElement("span");
pbar.className = "pbar";
pbar.setAttribute("aria-hidden", "true");
ptabs[0].parentNode.appendChild(pbar);
function placeBar() {                               // the underline sits under the selected tab, as wide as it (sub-pixel exact)
  var row = pbar.parentNode.getBoundingClientRect();
  ptabs.forEach(function (t) {
    if (t.getAttribute("aria-pressed") !== "true") return;
    var r = t.getBoundingClientRect();
    pbar.style.transform = "translateX(" + (r.left - row.left) + "px) scaleX(" + r.width + ")";
  });
}
new ResizeObserver(placeBar).observe(ptabs[0].parentNode);   // fonts loading or counts changing resize the tabs
var MORE = {
  active: "https://github.com/gnanreddy13?tab=repositories&sort=updated",
  done:   "https://github.com/gnanreddy13?tab=repositories"
};
var plist = document.querySelector(".plist"), pgrow = null;
function showStatus(s, animate) {
  var from = plist.getBoundingClientRect().height;   // mid-glide too, so a quick second click carries on from there
  if (pgrow) pgrow.cancel();
  var n = 0, shown = [];
  Array.prototype.forEach.call(document.querySelectorAll(".project"), function (p) {
    var on = p.dataset.status === s;
    p.hidden = !on;
    if (on) { n++; shown.push(p); }
  });
  pempty.hidden = n > 0;
  ptabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t.dataset.s === s)); });
  placeBar();
  pmore.href = MORE[s];
  if (!animate || reduce) return;
  // the list glides to its new height (so everything below slides instead of jumping) while the projects fade in
  var to = plist.getBoundingClientRect().height, ease = "cubic-bezier(0.2, 0.7, 0.2, 1)";   // same curve as --ease
  if (from !== to) {   // overflow is part of the animation, so it clips only while gliding and needs no cleanup
    pgrow = plist.animate([{ height: from + "px", overflow: "hidden" }, { height: to + "px", overflow: "hidden" }],
      { duration: 320, easing: ease });
  }
  shown.concat(pempty.hidden ? [] : [pempty]).forEach(function (p) {
    p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: ease });
  });
}
ptabs.forEach(function (t) {
  t.addEventListener("click", function () {
    pbar.classList.add("slide");                    // only clicks slide it; the first placement doesn't
    if (t.getAttribute("aria-pressed") !== "true") showStatus(t.dataset.s, true);
  });
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

// ---------- graph arrow buttons: scroll their graph by about 80% of its width ----------
Array.prototype.forEach.call(document.querySelectorAll(".arr"), function (btn) {
  btn.addEventListener("click", function () {
    var t = $(btn.dataset.for);
    t.scrollBy({ left: Number(btn.dataset.dir) * t.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  });
});

// ---------- email: a click copies the address (the mail app still opens with ⌘/ctrl-click, or if copying fails) ----------
var mail = $("mail"), mailT = $("mail-t"), mailTimer = null;
mail.addEventListener("click", function (e) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !navigator.clipboard) return;
  e.preventDefault();
  var addr = mail.href.replace("mailto:", "");
  navigator.clipboard.writeText(addr).then(function () {
    mailT.textContent = "copied";
    $("mail-live").textContent = "email address copied";
    clearTimeout(mailTimer);
    mailTimer = setTimeout(function () { mailT.textContent = "email"; $("mail-live").textContent = ""; }, 1600);
  }, function () { location.href = mail.href; });
});

// ---------- mini player: press to play (never on its own); the record slides out and spins, the ring fills, volume fades in and out ----------
var audio = $("audio"), player = $("player"), pbtn = $("pbtn"), ring = $("ring");
var VOL = 0.6, want = false, fadeId = 0;

// ramp the volume (iOS ignores volume, so there it just plays and pauses)
function fade(to, done) {
  var id = ++fadeId, from = audio.volume, t0 = performance.now(), dur = reduce ? 0 : 450;
  (function step(now) {
    if (id !== fadeId) return;                      // a newer fade took over
    var k = dur ? Math.min(1, (now - t0) / dur) : 1;
    audio.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step); else if (done) done();
  })(t0);
}
function setPlaying(on) {
  player.classList.toggle("playing", on);
  pbtn.setAttribute("aria-pressed", String(on));
  pbtn.setAttribute("aria-label", (on ? "pause" : "play") + " cipher by lemmino");
  $("picon").setAttribute("href", on ? "#i-pause" : "#i-play");
}
function toggle() {
  want = !want;
  setPlaying(want);
  if (want) {
    if (audio.paused) audio.volume = 0;
    audio.play().then(function () { fade(VOL); })
      .catch(function () { want = false; setPlaying(false); });   // file missing or blocked
  } else {
    fade(0, function () { audio.pause(); });
  }
}
// the ring: how far into the song (redrawn every frame while playing)
function tick() {
  if (audio.duration) ring.style.strokeDashoffset = 100 - (audio.currentTime / audio.duration) * 100;
  if (!audio.paused) requestAnimationFrame(tick);
}
pbtn.addEventListener("click", toggle);
$("album").addEventListener("click", toggle);           // the album works too (mouse and touch; the button is the keyboard control)

// repeat switch: loops by default; the visitor's choice is remembered on their device
var rpt = $("rpt");
function setLoop(on, save) {
  audio.loop = on;
  rpt.setAttribute("aria-pressed", String(on));
  $("rpt-t").textContent = on ? "on repeat" : "play once";
  if (save) try { localStorage.setItem("loop", on ? "1" : "0"); } catch (e) {}
}
var savedLoop = null;
try { savedLoop = localStorage.getItem("loop"); } catch (e) {}
setLoop(savedLoop !== "0", false);
rpt.addEventListener("click", function () { setLoop(!audio.loop, true); });
audio.addEventListener("ended", function () { audio.currentTime = 0; tick(); });   // played once: back to the start, ring empty
audio.addEventListener("play", function () { want = true; setPlaying(true); requestAnimationFrame(tick); });
audio.addEventListener("pause", function () { want = false; setPlaying(false); tick(); });

// ---------- folds: on phones, "now", the music player and "past year" start collapsed behind their label ----------
var phone = window.matchMedia("(max-width: 600px)");
var folds;                                          // filled below; refreshFolds() may be called before that
function refreshFolds() { if (folds) folds.forEach(function (f) { f.render(); }); }

function makeFold(label, body, name, summary, phoneOnlyLabel) {
  var btn = document.createElement("button"), open = false, anim = null;
  btn.type = "button";
  btn.className = "fold";
  btn.setAttribute("aria-controls", body.id);
  // built once, so the chevron is the same element every time and its turn can animate
  btn.innerHTML = icon("right");
  btn.appendChild(document.createTextNode(name));
  var sum = document.createElement("span");
  sum.className = "fold-sum";
  btn.appendChild(sum);
  function renderButton() {
    btn.setAttribute("aria-expanded", String(open));
    var s = open ? "" : summary();
    sum.textContent = s ? " // " + s : "";
  }
  function renderBody() {
    body.hidden = !open;
    label.classList.toggle("folded", !open);
  }
  function render() {
    if (!phone.matches) return;
    renderButton();
    if (!anim) renderBody();                        // mid-close, the body folds when the glide ends
  }
  // the body glides open or shut, matching the folded layout exactly so nothing below ticks at the end:
  // - shut, its top margin cancels the label's gap and the button's negative (tap area) margin, as the folded label does
  // - grow: how much the label itself grew or shrank as the summary came or went, taken out of the body's height
  function glide(opening, grow) {
    var h = body.getBoundingClientRect().height,
        gap = parseFloat(getComputedStyle(label).marginBottom),
        tap = parseFloat(getComputedStyle(btn).marginBottom),
        top = parseFloat(getComputedStyle(body).marginTop),
        shut = { height: Math.max(0, opening ? -grow : 0) + "px", marginTop: (tap - gap) + "px", opacity: 0, overflow: "hidden" },
        full = { height: Math.max(0, opening ? h : h - grow) + "px", marginTop: top + "px", opacity: 1, overflow: "hidden" };
    var a = anim = body.animate(opening ? [shut, full] : [full, shut], { duration: 300, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
    a.finished.then(function () { if (anim === a) { anim = null; renderBody(); } }, function () {});   // cancelled: the next tap handles it
  }
  function apply() {                                // switch between phone (fold) and wider screens (plain label, always open)
    if (anim) { anim.cancel(); anim = null; }
    if (phone.matches) {
      label.hidden = false;
      label.textContent = "";
      label.appendChild(btn);
      render();
    } else {
      label.textContent = name;
      label.hidden = !!phoneOnlyLabel;
      label.classList.remove("folded");
      body.hidden = false;
    }
  }
  btn.addEventListener("click", function () {
    if (anim) { anim.cancel(); anim = null; }     // tapped mid-glide: start over from the current state
    var before = label.getBoundingClientRect().height;
    open = !open;
    renderButton();                                 // the summary comes or goes, which can change the label's height
    var grow = label.getBoundingClientRect().height - before;
    if (open || reduce) renderBody();               // opening: show it first, so its full height can be measured
    if (!reduce) glide(open, grow);
  });
  phone.addEventListener("change", apply);
  apply();
  return { render: render };
}

folds = [
  makeFold($("now-label"), $("now-body"), "now i'm...", function () { return document.querySelector(".now").dataset.sum; }),
  makeFold($("music-label"), $("music-body"), "music...", function () { return "cipher by lemmino"; }, true),
  makeFold($("act-label"), $("act-body"), "past year...", function () {
    var parts = [];
    if (shown.gh) {
      var t = 0;
      shown.gh.forEach(function (d) { t += d.count; });
      parts.push("github " + t + " " + lab("gh", t));
    }
    if (lcStats && typeof lcStats.solved === "number") parts.push("leetcode " + Number(lcStats.solved) + " solved");
    return parts.join(" · ");
  })
];

})();
