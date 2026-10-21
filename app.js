// the home page: the clock, the email tile, picking a tool in the stack, and the activity graph
// the time in india, kept current
function tick() {
  document.getElementById("now").textContent = new Date().toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
tick(); setInterval(tick, 10000);

// the email tile: on phones it opens the mail app (the plain mailto link); elsewhere it copies the address,
// and the name over the tile says so for a moment
var mail = document.getElementById("mail"), timer;
mail.addEventListener("click", function (e) {
  if (matchMedia("(pointer: coarse)").matches || !navigator.clipboard) return;
  e.preventDefault();
  navigator.clipboard.writeText("gnanreddy13@gmail.com").then(function () {
    mail.dataset.n = "Copied gnanreddy13@gmail.com";
    document.getElementById("mail-live").textContent = "Email address copied";
    clearTimeout(timer);
    timer = setTimeout(function () { mail.dataset.n = "Email"; }, 2000);
  }, function () { location.href = mail.href; });
});


// stack: pick one or more build tools to light up the projects that use all of them; tap a picked tool again to drop it,
// press esc or click anywhere else to clear
var picks = document.querySelectorAll(".tool.pick"), projs = document.querySelectorAll(".proj"), used = document.getElementById("used");
var chosen = [];
var firstLit = null;   // the first project the picked tools light up

function name(t) { return document.querySelector('.tools .pick[data-t="' + t + '"] .nm').textContent; }
function list(xs) { return xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : xs[0]; }
function pick(ts) {
  chosen = ts;
  var hits = [], first = null, on = ts.length > 0;
  picks.forEach(function (b) { b.setAttribute("aria-pressed", ts.indexOf(b.dataset.t) >= 0); });
  projs.forEach(function (p) {
    var us = ts.map(function (t) { return p.querySelector('.u[data-t="' + t + '"]'); });
    var all = on && us.every(Boolean);
    p.classList.toggle("dim", on && !all);
    p.querySelectorAll(".u").forEach(function (x) { x.classList.toggle("on", all && us.indexOf(x) >= 0); });
    if (all) { hits.push(p.querySelector(".name").textContent); if (!first) first = p; }
  });
  // the projects heading names the picked tools, so after the scroll on phones you still know why some are dimmed
  document.getElementById("pfor").textContent = ts.map(name).join(", ");
  var together = ts.length > 1 ? "Used together in " : "Used in ";
  if (!on) used.textContent = "Pick tools to see where they're used";
  else if (!hits.length) used.textContent = "No project uses " + (ts.length > 1 ? "all of these together" : "it") + " yet";
  else if (oneCol.matches) {
    // one column: the projects are further down, so the line counts them and takes you there when you're done picking
    used.innerHTML = '<button class="usedgo" type="button">' + together + hits.length + (hits.length === 1 ? " project" : " projects") + " ↓</button>";
  } else used.textContent = hits.length === projs.length ? together + "every project" : together + list(hits);
  firstLit = first;
  return first;
}
// one column (phones, narrow windows): the projects sit below the stack; the line under it ("Used in 2 projects ↓")
// brings the projects heading and the first lit project into view
var oneCol = matchMedia("(max-width: 1099px)"), calm = matchMedia("(prefers-reduced-motion: reduce)");
function reveal(p) {
  if (!p || !oneCol.matches) return;
  // land on the projects heading (which now names the tool) with the lit projects below it;
  // if the heading and the first lit project are both already on screen, nothing moves
  var h = document.getElementById("plabel").getBoundingClientRect(), r = p.getBoundingClientRect();
  if (h.top >= 0 && r.bottom <= innerHeight) return;
  scrollTo({ top: scrollY + h.top - 24, behavior: calm.matches ? "auto" : "smooth" });
}
picks.forEach(function (b) {
  b.addEventListener("click", function (e) {
    e.stopPropagation();
    var t = b.dataset.t, i = chosen.indexOf(t);
    var next = i >= 0 ? chosen.filter(function (x) { return x !== t; }) : chosen.concat(t);
    pick(next);   // nothing scrolls: you can keep picking; in one column the line under the stack takes you to the projects
  });
});
used.addEventListener("click", function (e) {
  if (!e.target.closest(".usedgo")) return;
  e.stopPropagation();   // going to the projects keeps the picks
  reveal(firstLit);
});
oneCol.addEventListener("change", function () { pick(chosen); });   // the line's wording follows the layout
document.addEventListener("click", function (e) {
  pick([]);
  if (!e.target.closest(".hand")) hand.classList.remove("open");   // a tap anywhere else closes the contact hand
});

// phones: the contact hand starts closed. the first tap on it only fans it out (no link opens);
// once it's open, a tap on a tile opens that link as usual
var hand = document.querySelector(".hand"), touch = matchMedia("(hover: none)");
hand.addEventListener("click", function (e) {
  if (!touch.matches) return;
  if (!hand.classList.contains("open")) {
    e.preventDefault(); e.stopPropagation();
    hand.classList.add("open");
    return;
  }
  // a tile was tapped and its link is opening: fold the hand and let go of the tile now, so coming back to the page
  // doesn't flash the tile (lifted, its name, a focus outline) before it settles
  var a = e.target.closest("a");
  if (a) setTimeout(function () { a.blur(); hand.classList.remove("open"); }, 0);
}, true);
// back to the page from another tab, the mail app or the back button: start from the closed, unfocused hand
function settle() { if (!touch.matches) return; hand.classList.remove("open"); if (hand.contains(document.activeElement)) document.activeElement.blur(); }
addEventListener("pageshow", settle);
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") settle(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") pick([]); });

// the graph: one year from data/, github or leetcode
function get(u) { return fetch(u).then(function (r) { return r.json(); }); }
var data = {}, cur = "lc", sel = -1, unit = { gh: "contribution", lc: "submission" };
var g = document.getElementById("graph"), capL = document.getElementById("cap-l"), capR = document.getElementById("cap-r");
var phone = matchMedia("(max-width: 560px)");
function day(d, y) { return new Date(d + "T00:00:00Z").toLocaleDateString("en", y ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }); }
function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
function days() { return data[cur].days.slice(-364); }
function lead() { return new Date(days()[0].date + "T00:00:00Z").getUTCDay(); }
function first() { return phone.matches ? Math.max(0, 91 - lead()) : 0; }   // first day actually on screen
function range() { var d = days(); return day(d[first()].date, 1) + " → " + day(d[d.length - 1].date, 1); }

function show(i) {   // a day's count in the caption, or the range when no day is picked
  var d = days(), on = g.querySelector(".on");
  if (on) on.classList.remove("on");
  if (i < 0) { capR.textContent = range(); return; }
  g.children[i + lead()].classList.add("on");
  // days from last year carry their year, so "oct 12" can't be mistaken for this october
  var when = day(d[i].date) + (d[i].date.slice(0, 4) !== d[d.length - 1].date.slice(0, 4) ? ", " + d[i].date.slice(0, 4) : "");
  capR.textContent = (d[i].count ? plural(d[i].count, unit[cur]) : "No " + unit[cur] + "s") + " · " + when;
}

function draw() {
  var d = days(), max = Math.max.apply(null, d.map(function (x) { return x.count; })) || 1, total = 0, cells = "";
  for (var i = 0; i < lead(); i++) cells += '<i class="out"></i>';
  d.forEach(function (x, j) { total += x.count; cells += '<i data-i="' + j + '" data-l="' + (x.count ? Math.ceil(x.count / max * 4) : 0) + '"></i>'; });
  g.innerHTML = cells;
  capL.innerHTML = "<b>" + total + "</b> " + unit[cur] + (total === 1 ? "" : "s") + " · " + data[cur].note;
  sel = -1; show(-1);
}

g.onmouseover = g.onclick = function (e) { if (e.target.dataset.i) show(+e.target.dataset.i); };
g.onmouseleave = function () { show(sel); };
g.onkeydown = function (e) {   // arrows: ←/→ a week, ↑/↓ a day; esc lets go
  var step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
  if (e.key === "Escape") { sel = -1; show(-1); return; }
  if (!step) return;
  e.preventDefault();
  var n = days().length;
  sel = sel < 0 ? n - 1 : Math.min(n - 1, Math.max(first(), sel + step));
  show(sel);
};
g.onblur = function () { sel = -1; show(-1); };

Promise.all([get("data/github.json"), get("data/leetcode.json"), get("data/github-stats.json"), get("data/leetcode-stats.json")]).then(function (r) {
  data.gh = { days: r[0], note: "last push " + day(r[2].pushed.slice(0, 10)) };
  data.lc = { days: r[1], note: '<span class="easy">' + r[3].easy + ' Easy</span> · <span class="med">' + r[3].medium + ' Medium</span> · <span class="hard">' + r[3].hard + " Hard</span>" };
  draw();
});
phone.addEventListener("change", function () { if (data.gh) show(sel); });
document.querySelectorAll(".tab").forEach(function (b) {
  b.onclick = function () {
    document.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    cur = b.dataset.g; draw();
  };
});

// the top button (phones and tablets): shows once you're most of a screen down; scrolls up without adding a step to the
// history, so the phone's back button leaves the page instead of retracing the scroll
(function () {
  var b = document.getElementById("totop"), queued = false;
  function check() { queued = false; b.classList.toggle("show", scrollY > innerHeight * 0.8); }
  addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
  b.addEventListener("click", function (e) { e.preventDefault(); scrollTo({ top: 0, behavior: calm.matches ? "auto" : "smooth" }); b.blur(); });
  check();
})();
