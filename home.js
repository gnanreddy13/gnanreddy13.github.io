// phones: tapping a stack logo shows its name in the bubble (the desktop gets it on hover); any other tap hides it
var stack = document.querySelector(".stack"), touch = matchMedia("(hover: none)");
document.addEventListener("click", function (e) {
  if (!touch.matches) return;   // a mouse click shouldn't pin a bubble open
  var item = e.target.closest(".stack > *");
  stack.querySelectorAll(".show").forEach(function (x) { if (x !== item) x.classList.remove("show"); });
  if (item) item.classList.toggle("show");
});

// the time in india
// seven segments per digit: top, top right, bottom right, bottom, bottom left, top left, middle
var SEG = [[1.5,1,7.5,1],[8,1.5,8,7.5],[8,8.5,8,14.5],[1.5,15,7.5,15],[1,8.5,1,14.5],[1,1.5,1,7.5],[1.5,8,7.5,8]];
var ON = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg", " ": "" };
function digit(d) {
  return '<svg viewBox="0 0 9 16" aria-hidden="true">' + SEG.map(function (l, i) {
    return '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"' + (ON[d].indexOf("abcdefg"[i]) >= 0 ? ' class="on"' : "") + "/>";
  }).join("") + "</svg>";
}
function tick() {
  var t = new Date().toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).toLowerCase(), m = t.match(/(\d+):(\d+) (\w+)/);
  var h = (m[1].length < 2 ? " " : "") + m[1], el = document.getElementById("now");
  el.innerHTML = digit(h[0]) + digit(h[1]) + '<span class="colon" aria-hidden="true"><i></i><i></i></span>' + digit(m[2][0]) + digit(m[2][1]) + '<span class="ap">' + m[3] + "</span>";
  el.setAttribute("aria-label", "local time in india: " + t);
}
// redraw right on each new minute
(function next() { tick(); setTimeout(next, 60000 - Date.now() % 60000 + 50); })();

// the past year on leetcode, in greys
Promise.all(["data/leetcode.json", "data/leetcode-stats.json"].map(function (u) { return fetch(u).then(function (r) { return r.json(); }); })).then(function (r) {
  var days = r[0].slice(-364), s = r[1], max = Math.max.apply(null, days.map(function (d) { return d.count; })) || 1;
  var cells = new Array(new Date(days[0].date + "T00:00:00Z").getUTCDay() + 1).join('<i class="out"></i>');
  days.forEach(function (d) { cells += '<i data-l="' + (d.count ? Math.ceil(d.count / max * 4) : 0) + '"></i>'; });
  document.getElementById("graph").innerHTML = cells;
  // phones: fade an edge only while there's more year past it
  var sl = document.getElementById("slide"), queued = false;
  // (the strip scrolls right-to-left, so its scroll position counts from the right edge: 0 there, growing as you go back)
  function edges() { queued = false; var back = Math.abs(sl.scrollLeft); sl.classList.toggle("more-l", back < sl.scrollWidth - sl.clientWidth - 1); sl.classList.toggle("more-r", back > 1); }
  edges();
  sl.addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(edges); } }, { passive: true });
  document.getElementById("solved").textContent = s.solved;
});
