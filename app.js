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


// stack: pick a build tool to light up the projects that use it; pick it again, press esc or click elsewhere to clear
var picks = document.querySelectorAll(".tool.pick"), projs = document.querySelectorAll(".proj"), used = document.getElementById("used");
function pick(t) {
  var hits = [];
  picks.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.t === t); });
  document.querySelector(".tools").classList.toggle("picking", !!t);
  projs.forEach(function (p) {
    var u = t && p.querySelector('.u[data-t="' + t + '"]');
    p.classList.toggle("dim", !!t && !u);
    p.querySelectorAll(".u").forEach(function (x) { x.classList.toggle("on", x === u); });
    if (u) hits.push(p.querySelector(".name").textContent);
  });
  used.textContent = !t ? "Pick one to see where it's used" : hits.length === projs.length ? "Used in every project"
    : "Used in " + (hits.length > 1 ? hits.slice(0, -1).join(", ") + " and " + hits[hits.length - 1] : hits[0]);
}
picks.forEach(function (b) {
  b.addEventListener("click", function (e) { e.stopPropagation(); pick(b.getAttribute("aria-pressed") === "true" ? null : b.dataset.t); });
});
document.addEventListener("click", function () { pick(null); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") pick(null); });

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
