// life.js: the slice of life page, drawn from data.json in the home page's language
(function () {

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
}

// the time in india: the home page's seven-segment display (its look is in home.css)
var SEG = [[1.5, 1, 7.5, 1], [8, 1.5, 8, 7.5], [8, 8.5, 8, 14.5], [1.5, 15, 7.5, 15], [1, 8.5, 1, 14.5], [1, 1.5, 1, 7.5], [1.5, 8, 7.5, 8]];
var LIT = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg", " ": "" };
function digit(d) {
  return '<svg viewBox="0 0 9 16" aria-hidden="true">' + SEG.map(function (l, i) {
    return '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"' + (LIT[d].indexOf("abcdefg"[i]) >= 0 ? ' class="on"' : "") + "/>";
  }).join("") + "</svg>";
}
function tick() {
  var t = new Date().toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).toLowerCase(), m = t.match(/(\d+):(\d+) (\w+)/);
  if (!m) return;
  var h = (m[1].length < 2 ? " " : "") + m[1];
  $("now").innerHTML = digit(h[0]) + digit(h[1]) + '<span class="colon" aria-hidden="true"><i></i><i></i></span>' + digit(m[2][0]) + digit(m[2][1]) + '<span class="ap">' + m[3] + "</span>";
  $("now").setAttribute("aria-label", "local time in india: " + t);
}
(function next() { tick(); setTimeout(next, 60000 - Date.now() % 60000 + 50); })();

fetch("data.json").then(function (r) { return r.json(); }).then(function (D) {
  lifting(D); places(D); stories(D);
});

// lifting: the past year's gym days, then the workout
function lifting(D) {
  var went = {};
  (D.gym || []).forEach(function (d) { went[d] = 1; });
  var today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  // the past year: the home page's graph (its look is in home.css), a square a day, weeks running left to right from
  // sunday, green on every day i went
  var days = [];
  for (var k = 363; k >= 0; k--) days.push(new Date(Date.parse(today + "T00:00:00Z") - k * 864e5).toISOString().slice(0, 10));
  var n = days.filter(function (d) { return went[d]; }).length;
  $("graph").innerHTML = new Array(new Date(days[0] + "T00:00:00Z").getUTCDay() + 1).join('<i class="out"></i>') +
    days.map(function (d) { return '<i data-l="' + (went[d] ? 4 : 0) + '"></i>'; }).join("");
  $("graph").setAttribute("aria-label", "gym days in the past year: " + (n ? n + (n === 1 ? " session" : " sessions") : "none yet"));
  // phones: the year slides sideways (it starts on the latest weeks); an edge fades only while there's more past it
  var sl = $("gslide"), queued = false;
  function edges() {
    queued = false;
    var back = Math.abs(sl.scrollLeft);
    sl.classList.toggle("more-l", back < sl.scrollWidth - sl.clientWidth - 1);
    sl.classList.toggle("more-r", back > 1);
  }
  edges();
  sl.addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(edges); } }, { passive: true });
  addEventListener("resize", edges);

  // the workout, as rows like the home page's projects (what on the left, how much on the right, in two columns)
  $("plan").innerHTML = (D.plan || []).map(function (x) {
    return '<p class="top"><span>' + esc(x.name.toLowerCase()) + '</span><span class="lead" aria-hidden="true"></span><span>' + esc((x.sets || "").replace(", superset", " ss")) + "</span></p>";
  }).join("");
}

// places: a card each, the photo with the name beneath, opening the album (no ↗: like the posters, a photo plainly opens something)
function places(D) {
  var ps = D.places || [];
  $("places").innerHTML = ps.map(function (p) {
    var n = p.name.toLowerCase();
    return '<a class="pcard" href="' + esc(p.album) + '" target="_blank" rel="noreferrer" aria-label="' + esc(n) + ' album"><img src="' + esc(p.photo) + '" alt=""><span>' + esc(n) + "</span></a>";
  }).join("");
}

// the stories: a tab per kind (anime, manga, tv, cinema, games), and the picked kind's posters in one row with their
// titles beneath (lowercase, like everything else here), like the places; what's ongoing first. each poster opens its page. it opens on the kind picked last
// on this device, else the first
function stories(D) {
  var favs = D.favs || {}, kinds = Object.keys(favs), tabs = $("tabs"), shelf = $("shelf"), cur = kinds[0];
  try { var last = localStorage.getItem("life-kind"); if (kinds.indexOf(last) >= 0) cur = last; } catch (e) {}
  tabs.innerHTML = kinds.map(function (k) {
    return '<button type="button" role="tab" id="tab-' + esc(k) + '" aria-controls="shelf" data-k="' + esc(k) + '">' + esc(k) + "</button>";
  }).join("");
  function pick(k, focus) {
    cur = k;
    Array.prototype.forEach.call(tabs.children, function (b) {
      var on = b.dataset.k === k;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    shelf.setAttribute("aria-labelledby", "tab-" + k);
    var xs = favs[k].slice().sort(function (a, b) { return (b.progress ? 1 : 0) - (a.progress ? 1 : 0) || a.name.localeCompare(b.name, "en", { numeric: true }); });
    shelf.innerHTML = xs.map(function (f) {
      var st = (f.progress || "finished").toLowerCase();
      return '<a class="pcard mcard' + (f.progress ? " live" : "") + '" href="' + esc(f.url) + '" target="_blank" rel="noreferrer" aria-label="' + esc(f.name + ", " + st) + '">' +
        '<img src="' + esc(f.cover) + '" alt="" decoding="async"><span>' + esc(f.name.toLowerCase()) + "</span></a>";
    }).join("");
    // the new row starts at its beginning, and comes up with a short fade
    shelf.scrollLeft = 0;
    shelf.classList.remove("swap"); void shelf.offsetWidth; shelf.classList.add("swap");
    try { localStorage.setItem("life-kind", k); } catch (e) {}
  }
  // a mouse click picks a tab without focusing it, so the focus ring only ever shows for the keyboard (otherwise a key
  // pressed after a click, even to scroll the page, would ring the clicked tab)
  tabs.addEventListener("mousedown", function (e) { if (e.target.closest("button")) e.preventDefault(); });
  tabs.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b && b.dataset.k !== cur) pick(b.dataset.k); });
  // the keyboard: the arrows move between the tabs (wrapping round), home and end jump to the first and last
  tabs.addEventListener("keydown", function (e) {
    var i = kinds.indexOf(cur), n = kinds.length, to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); pick(kinds[(to + n) % n], true);
  });
  pick(cur);
}

})();
