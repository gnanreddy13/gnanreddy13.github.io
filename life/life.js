// slice of life: draws the page from data.json. everything is scoped to this function, so nothing leaks into the page's globals
(function () {

function $(id) { return document.getElementById(id); }
function icon(id) { return '<svg class="i" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";      // same curve as --ease

// ---------- clock: my time (IST), my date, and how far the visitor is from it (same as the home page) ----------
function renderClock() {
  var now = new Date();
  var t = now.toLocaleTimeString("en", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).toLowerCase();
  var d = now.toLocaleDateString("en", { timeZone: "Asia/Kolkata", weekday: "short", month: "short", day: "numeric" }).toLowerCase();
  var diff = -now.getTimezoneOffset() - 330;           // visitor minus IST, in minutes
  var a = Math.abs(diff), h = Math.floor(a / 60), m = a % 60;
  var span = (h ? h + "h" : "") + (h && m ? " " : "") + (m ? m + "m" : "");
  var rel = diff === 0 ? "same time as me" : "you're " + span + (diff < 0 ? " behind" : " ahead");
  $("clock").innerHTML = icon("clock") + t + " ist";
  $("date").innerHTML = icon("cal") + d;
  $("clock-rel").textContent = rel;
}
renderClock();
setInterval(renderClock, 15000);

// today in IST, as yyyy-mm-dd and as 0 = monday … 6 = sunday
function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function wd(iso) { return (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; }
function addDays(iso, n) { return new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
function fmtDay(iso, year) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en", Object.assign(
    { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }, year ? { year: "numeric" } : {})).toLowerCase();
}
var TODAY = istToday();

// one sliding green underline under the picked item of a row (as under building / built on the home page)
function underline(row, buttons, isOn) {
  isOn = isOn || function (b) { return b.getAttribute("aria-pressed") === "true"; };
  var bar = document.createElement("span");
  bar.className = "pbar";
  bar.setAttribute("aria-hidden", "true");
  row.appendChild(bar);
  function place() {
    var box = row.getBoundingClientRect();
    buttons.forEach(function (b) {
      if (!isOn(b)) return;
      var sp = b.querySelector(".sp"), r = b.getBoundingClientRect();
      var w = sp ? sp.getBoundingClientRect().width : r.width;   // days: as wide as the split's word
      bar.style.transform = "translateX(" + (r.left - box.left) + "px) scaleX(" + w + ")";
    });
  }
  new ResizeObserver(place).observe(row);
  return { place: place, slide: function () { bar.classList.add("slide"); place(); } };
}

fetch("data.json", { cache: "no-cache" })
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(draw)
  .catch(function () {
    $("lately-text").textContent = "couldn't load this part, try a refresh";
  });

function draw(D) {
  drawPlaces(D);
  drawLately(D);
  var lift = drawWeek(D);
  drawGym(D, lift);
  drawFavs(D);
  makeFold($("lately-label"), $("lately-body"), "lately i'm...", function () { return D.lately && D.lately.sum ? "lately i'm " + D.lately.sum : ""; });
  makeFold($("past-label"), $("past-body"), "past year...", function () { return "past year: " + $("gym-n").textContent.replace(" in the past year", ""); });
}

// ---------- lately: one sentence, then what i'm watching and reading with how far along ----------
function drawLately(D) {
  $("lately-text").textContent = (D.lately && D.lately.text) || "";
  var now = Array.isArray(D.now) ? D.now : [];
  $("nowlist").innerHTML = now.map(function (n) {
    var name = n.url
      ? '<a target="_blank" rel="noreferrer" href="' + esc(n.url) + '">' + esc(n.name) + '<svg class="i sm"><use href="#i-ext"/></svg></a>'
      : "<b>" + esc(n.name) + "</b>";
    var share = n.of ? Math.min(1, n.at / n.of) : 0;
    return '<li><p class="nl">' + esc(n.kind) + " " + name + " · " + esc(n.unit) + " " + Number(n.at) + " of " + Number(n.of) + "</p>" +
      '<span class="line"><span data-s="' + share + '"></span></span></li>';
  }).join("");
  $("nowlist").parentNode.hidden = !now.length;
  requestAnimationFrame(function () { requestAnimationFrame(function () {   // after the first paint, so the lines fill in
    Array.prototype.forEach.call(document.querySelectorAll(".nowlist .line > span"), function (s) {
      s.style.transform = "scaleX(" + s.dataset.s + ")";
    });
  }); });
}

// ---------- places + photos: each place opens its google photos album; one cover photo opens its place's album ----------
function drawPlaces(D) {
  var places = Array.isArray(D.places) ? D.places : [];
  function ext(href, inner, cls) {
    return '<a' + (cls ? ' class="' + cls + '"' : "") + ' target="_blank" rel="noreferrer" href="' + esc(href) + '">' + inner + '<svg class="i sm"><use href="#i-ext"/></svg></a>';
  }
  function name(id) { return (places.filter(function (x) { return x.id === id; })[0] || {}); }

  // the sentence: "hyderabad ↗ (home), mumbai ↗ and delhi ↗, so far." (a place's note sits after it, outside the link)
  var words = places.map(function (p) {
    return (p.album ? ext(p.album, esc(p.name), "place") : '<span class="place">' + esc(p.name) + "</span>") + (p.note ? " (" + esc(p.note) + ")" : "");
  });
  var sentence = words.length > 1 ? words.slice(0, -1).join(", ") + " and " + words[words.length - 1] : words.join("");
  $("places").innerHTML = sentence + (words.length ? ", so far." : "");

  // the cover: the whole photo, uncropped; place and month under it (the album is linked from the place names above)
  var c = D.cover, box = $("cover"), cap = $("cap");
  if (!c) { $("cover").parentNode.hidden = true; return; }
  var pl = name(c.place);
  box.innerHTML = '<img src="' + esc(c.src) + '" alt="' + esc(c.alt || "") + '" width="' + (c.w || 4) + '" height="' + (c.h || 3) + '" decoding="async">';
  var text = esc(pl.name || c.place) + (c.when ? ' <span class="when">· ' + esc(c.when) + "</span>" : "");
  cap.innerHTML = text;
}

// ---------- lift: the week (today in white); tap a day, or a square in the gym graph, to see its plan ----------
function drawWeek(D) {
  var week = Array.isArray(D.week) && D.week.length === 7 ? D.week : ["", "", "", "", "", "", ""];
  var SHORT = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], FULL = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  var row = $("week"), today = wd(TODAY);
  row.innerHTML = week.map(function (s, i) {
    return '<button class="day' + (i === today ? " today" : "") + '" type="button" aria-pressed="false" data-i="' + i + '"' +
      ' aria-label="' + FULL[i] + ", " + esc(s || "rest") + (i === today ? ", today" : "") + '">' +
      '<span class="dn">' + SHORT[i] + '</span><span class="sp">' + esc(s || "rest") + "</span></button>";
  }).join("");
  var days = Array.prototype.slice.call(row.querySelectorAll(".day"));
  var bar = underline(row, days);
  // what i do that day, one per line: the workout on lift days ("push-ups · 3 × failure"), the rest routine on rest days ("walk · 30 min")
  var plan = Array.isArray(D.plan) ? D.plan : [], restPlan = Array.isArray(D.rest) ? D.rest : [];
  var list = $("plan"), body = $("plan-body"), grow = null;
  function lines(xs) {
    return xs.map(function (x) {
      return "<li>" + esc(x.name) + (x.sets ? ' <span class="sets">· ' + esc(x.sets) + "</span>" : "") + "</li>";
    }).join("");
  }

  function pick(i, animate) {
    days.forEach(function (d) { d.setAttribute("aria-pressed", String(Number(d.dataset.i) === i)); });
    if (animate) bar.slide(); else bar.place();
    var rest = (week[i] || "rest") === "rest", whose = i === today ? "today" : FULL[i], xs = rest ? restPlan : plan;
    var from = body.getBoundingClientRect().height;
    if (grow) grow.cancel();
    $("plan-note").textContent = "// " + whose + (rest ? "'s a rest day" : "'s workout");
    list.innerHTML = lines(xs);
    list.hidden = !xs.length;
    if (!animate || reduce) return;
    // the plan glides to its new height (rest days are shorter) while it fades in, as the tabs' lists do
    var to = body.getBoundingClientRect().height;
    if (from !== to) grow = body.animate([{ height: from + "px", overflow: "hidden" }, { height: to + "px", overflow: "hidden" }], { duration: 320, easing: EASE });
    if (!list.hidden) list.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE });
  }
  days.forEach(function (d) {
    d.addEventListener("click", function () {
      if (d.getAttribute("aria-pressed") !== "true") pick(Number(d.dataset.i), true);
    });
  });
  pick(today, false);
  return { pick: function (i) { if (!days[i] || days[i].getAttribute("aria-pressed") !== "true") pick(i, true); } };
}

// ---------- gym days: the past year in the home page's graph style, one green square per session (a tap shows that weekday's plan) ----------
function drawGym(D, lift) {
  var set = {};
  (Array.isArray(D.gym) ? D.gym : []).forEach(function (d) { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set[d] = 1; });
  var week = Array.isArray(D.week) ? D.week : [];
  // columns are weeks, monday on top (like the week above); it ends with this week, so the last column may be part-empty
  var start = addDays(TODAY, -wd(TODAY) - 52 * 7), cells = [], n = 0, wk = 0;
  for (var d = start; d <= TODAY; d = addDays(d, 1)) {
    var on = set[d] ? 1 : 0;
    n += on;
    if (on && d > addDays(TODAY, -7)) wk++;
    cells.push('<i data-l="' + (on ? 3 : 0) + '" data-d="' + d + '" style="--i:' + Math.floor(cells.length / 7) + '"></i>');
  }
  var bars = $("b-gym"), sc = $("sc-gym");
  bars.innerHTML = '<div class="track">' + cells.join("") + "</div>";
  if (!reduce) bars.classList.add("anim");
  // nothing logged yet: say so, and the squares stay grey until the first session
  var first = Object.keys(set).sort()[0];
  var weeks = first ? Math.max(1, (Date.parse(TODAY) - Date.parse(first > start ? first : start)) / (7 * 864e5)) : 1;   // the average counts from the first session
  $("gym-n").textContent = n ? n + (n === 1 ? " session" : " sessions") + " in the past year" : "no sessions yet";
  $("gym-rng").textContent = n ? wk + " in the last 7 days · about " + (n / weeks).toFixed(1) + " a week" : "// the squares turn green as i go";
  $("gym-rng").classList.toggle("hint", !n);

  function edges() {
    sc.dataset.l = bars.scrollLeft > 2 ? "1" : "0";
    sc.dataset.r = bars.scrollLeft + bars.clientWidth < bars.scrollWidth - 2 ? "1" : "0";
  }
  // open on today, and stay there whenever it reappears or resizes (unfolding on phones), until someone scrolls it themselves
  var browsed = false;
  ["pointerdown", "wheel", "touchstart", "keydown"].forEach(function (t) {
    bars.addEventListener(t, function () { browsed = true; }, { passive: true });
  });
  function toToday() { if (!browsed) bars.scrollLeft = bars.scrollWidth; edges(); }
  toToday();
  bars.addEventListener("scroll", edges, { passive: true });
  new ResizeObserver(toToday).observe(bars);
  Array.prototype.forEach.call(sc.querySelectorAll(".arr"), function (b) {
    b.addEventListener("click", function () {
      browsed = true;
      bars.scrollBy({ left: Number(b.dataset.dir) * bars.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
    });
  });

  // hover (or tap) a day: it shows on the right of the header, with what that day's split was
  var rd = $("rd-gym"), cur = null;
  function showDay(cell) {
    if (cur) cur.classList.remove("on");
    cur = cell;
    if (!cell) { rd.hidden = true; return; }
    cell.classList.add("on");
    var day = cell.dataset.d, split = week[wd(day)] || "rest";
    // a session shows its split; a missed lift day says "skipped", but only once i've started (before that: just the date)
    var what = cell.dataset.l !== "0" ? split : !first || day < first ? "" : split === "rest" ? "rest" : "skipped";
    rd.innerHTML = icon("cal") + esc(fmtDay(day, day.slice(0, 4) !== TODAY.slice(0, 4)) + (what ? " · " + what : ""));
    rd.hidden = false;
  }
  bars.addEventListener("pointerover", function (e) { if (e.target.tagName === "I") showDay(e.target); });
  bars.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") showDay(null); });
  // a tap also picks that weekday in "i lift...", so its plan shows beside the graph
  bars.addEventListener("click", function (e) { if (e.target.tagName === "I") { showDay(e.target); lift.pick(wd(e.target.dataset.d)); } });
  document.addEventListener("click", function (e) { if (cur && !bars.contains(e.target)) showDay(null); });
  // mouse drag to scroll (touch and trackpads scroll natively)
  var down = false, sx = 0, sl = 0;
  bars.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") return;
    down = true; sx = e.clientX; sl = bars.scrollLeft;
  });
  window.addEventListener("pointermove", function (e) {
    if (!down) return;
    if (Math.abs(e.clientX - sx) > 3) bars.classList.add("dragging");
    bars.scrollLeft = sl - (e.clientX - sx);
  });
  window.addEventListener("pointerup", function () { down = false; bars.classList.remove("dragging"); });
}

// ---------- favourites: tabs (anime · manga · tv · cinema) with counts; rows like the projects ----------
function drawFavs(D) {
  var favs = D.favs || {};
  var kinds = Object.keys(favs).filter(function (k) { return Array.isArray(favs[k]) && favs[k].length; });   // empty categories get no tab
  var row = $("ftabs"), list = $("favlist"), grow = null;
  row.innerHTML = kinds.map(function (k, i) {
    var n = Array.isArray(favs[k]) ? favs[k].length : 0;
    return '<button class="ptab" type="button" aria-pressed="' + (i === 0) + '" data-k="' + esc(k) + '" aria-label="' + esc(k) + ", " + n + '">' +
      esc(k) + " <span>" + n + "</span></button>";
  }).join("");
  var tabs = Array.prototype.slice.call(row.querySelectorAll(".ptab"));
  var bar = underline(row, tabs);
  // the last word and the arrow after it never split, so a long name doesn't leave the arrow alone on a line
  function keepLast(name, after) {
    var cut = name.lastIndexOf(" ");
    return esc(name.slice(0, cut + 1)) + '<span class="nw">' + esc(name.slice(cut + 1)) + after + "</span>";
  }
  // each row: the cover (framed like the album sleeve), then name · finished / how far along (series only), then why, then hashtags
  // ongoing first, then finished; each group a to z (numbers in order: 5, 86, 100)
  function order(a, b) {
    return (a.progress ? 0 : 1) - (b.progress ? 0 : 1) || a.name.localeCompare(b.name, "en", { numeric: true });
  }
  list.innerHTML = kinds.map(function (k) {
    return favs[k].slice().sort(order).map(function (f) {
      var name = f.url
        ? '<a class="name" target="_blank" rel="noreferrer" href="' + esc(f.url) + '">' + keepLast(f.name, '<svg class="i sm"><use href="#i-ext"/></svg>') + "</a>"
        : '<span class="name">' + esc(f.name) + "</span>";
      // series say where i am ("ongoing", "season 2", or "finished"); films ("film": true) need nothing, they're seen in one go
      var when = f.film ? "" : f.progress || "finished";
      return '<div class="project fav" data-k="' + esc(k) + '">' +
        '<span class="cover" aria-hidden="true">' + (f.cover ? '<img src="' + esc(f.cover) + '" alt="" loading="lazy" decoding="async">' : "") + "</span>" +
        '<p class="ftext">' + name +
        (when ? ' <span class="when">· ' + esc(when) + "</span>" : "") +
        (f.why ? '<span class="desc">' + esc(f.why) + "</span>" : "") +
        (f.tags && f.tags.length ? '<span class="tags">' + f.tags.map(function (t) { return '<span class="tag">#' + esc(t) + "</span>"; }).join("") + "</span>" : "") +
        "</p></div>";
    }).join("");
  }).join("");

  function show(k, animate) {
    var from = list.getBoundingClientRect().height;
    if (grow) grow.cancel();
    var shown = [];
    Array.prototype.forEach.call(list.children, function (p) {
      p.hidden = p.dataset.k !== k;
      if (!p.hidden) shown.push(p);
    });
    tabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t.dataset.k === k)); });
    if (animate) bar.slide(); else bar.place();
    if (!animate || reduce) return;
    // the list glides to its new height while the rows fade in (as on the home page)
    var to = list.getBoundingClientRect().height;
    if (from !== to) grow = list.animate([{ height: from + "px", overflow: "hidden" }, { height: to + "px", overflow: "hidden" }], { duration: 320, easing: EASE });
    shown.forEach(function (p) { p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE }); });
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () { if (t.getAttribute("aria-pressed") !== "true") show(t.dataset.k, true); });
  });
  if (kinds.length) show(kinds[0], false);
}

// ---------- folds (phones only): "lately i'm..." and "past year..." collapse behind their labels, as on the home page ----------
var phone = window.matchMedia("(max-width: 600px)");
function makeFold(label, body, name, summary) {
  var btn = document.createElement("button"), open = false, anim = null;
  btn.type = "button";
  btn.className = "fold";
  btn.setAttribute("aria-controls", body.id);
  btn.innerHTML = icon("right");
  var title = btn.appendChild(document.createTextNode(name));
  function renderButton() {
    btn.setAttribute("aria-expanded", String(open));
    title.nodeValue = (!open && summary()) || name;
  }
  function renderBody() {
    body.hidden = !open;
    label.classList.toggle("folded", !open);
  }
  function glide(opening, grow) {
    var h = body.getBoundingClientRect().height,
        gap = parseFloat(getComputedStyle(label).marginBottom),
        tap = parseFloat(getComputedStyle(btn).marginBottom),
        top = parseFloat(getComputedStyle(body).marginTop),
        shut = { height: Math.max(0, opening ? -grow : 0) + "px", marginTop: (tap - gap) + "px", opacity: 0, overflow: "hidden" },
        full = { height: Math.max(0, opening ? h : h - grow) + "px", marginTop: top + "px", opacity: 1, overflow: "hidden" };
    var a = anim = body.animate(opening ? [shut, full] : [full, shut], { duration: 300, easing: EASE });
    a.finished.then(function () { if (anim === a) { anim = null; renderBody(); } }, function () {});
  }
  function apply() {
    if (anim) { anim.cancel(); anim = null; }
    if (phone.matches) {
      label.textContent = "";
      label.appendChild(btn);
      renderButton();
      renderBody();
    } else {
      label.textContent = name;
      label.classList.remove("folded");
      body.hidden = false;
    }
  }
  btn.addEventListener("click", function () {
    if (anim) { anim.cancel(); anim = null; }
    var before = label.getBoundingClientRect().height;
    open = !open;
    renderButton();
    var grow = label.getBoundingClientRect().height - before;
    if (open || reduce) renderBody();
    if (!reduce) glide(open, grow);
  });
  phone.addEventListener("change", apply);
  apply();
}

})();
