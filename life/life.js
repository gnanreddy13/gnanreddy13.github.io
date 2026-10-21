// slice of life: the clock, then everything else drawn from data.json (places, the photo, the lifting week, favourites).
// scoped to this function, so nothing leaks into the page's globals
(function () {

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// touch screens have no hover. there a tap switches a thing's hover look on, a second tap on it (or a tap anywhere else)
// switches it back off; one thing at a time. each thing is { el, on, off }
var TOUCH = matchMedia("(hover: none)"), tapped = null;
function tapOn(t) { if (tapped === t) return; if (tapped) tapped.off(); tapped = t; t.on(); }
function tapOff() { if (tapped) { tapped.off(); tapped = null; } }
function tapToggle(t) { if (tapped === t) tapOff(); else tapOn(t); }
document.addEventListener("click", function (e) {
  if (TOUCH.matches && tapped && !tapped.el.contains(e.target) && !e.target.closest(".mention")) tapOff();
});
// the sticky note is one of those things: a tap picks it up (straightens it), a second puts it back
var pinned = document.querySelector(".pinned");
var NOTE = { el: pinned, on: function () { pinned.classList.add("lift"); }, off: function () { pinned.classList.remove("lift"); } };
pinned.addEventListener("click", function () { if (TOUCH.matches) tapToggle(NOTE); });

// the time in india, kept current (as on the home page)
function tick() {
  $("now").textContent = new Date().toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
tick(); setInterval(tick, 10000);

// data.json was already requested by the preload in the page's head, so this picks up that download instead of starting another
function reveal() { document.documentElement.classList.remove("loading"); }   // the page fades in, drawn
fetch("data.json")
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(draw)
  .catch(function () { $("lately").textContent = "Couldn't load the rest of this page, try a refresh. "; })
  .then(reveal);

function draw(D) {
  drawRoutine(D);
  drawWeek(D);
  var place = drawPlaces(D);
  var favs = drawFavs(D);
  if (D.lately && D.lately.text) drawLately(D, favs, place);
  wireIntro();
}

// the intro's links: on a phone they scroll down to their sections. on a wide screen everything's already in view, so
// pointing at one shows its section instead (the fan opens, the note is picked up, the piles lift), and a click stays put
function wireIntro() {
  var SHOW = {
    "#places": function (on) { var f = $("fan").querySelector(".fan"); if (f) f.classList.toggle("on", on); },
    "#routine": function (on) { document.querySelector(".pinned").classList.toggle("lift", on); $("wk").classList.toggle("on", on); },
    "#favourites": function (on) { $("desk").classList.toggle("hint", on); }
  };
  Array.prototype.forEach.call(document.querySelectorAll('.intro a[href^="#"]'), function (a) {
    var show = SHOW[a.getAttribute("href")];
    if (!show) return;
    a.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") show(true); });
    a.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") show(false); });
    a.addEventListener("focus", function () { show(true); });
    a.addEventListener("blur", function () { show(false); });
    a.addEventListener("click", function (e) { if (document.documentElement.scrollHeight <= innerHeight) e.preventDefault(); });   // nowhere to scroll to
  });
}

// the "lately" line. "the gym" is tied to the sticky note; and
// every title (or place) in it that's also further down gets its poster (or photo) in miniature beside it, and is tied to that
// poster: hovering the title pulls it out of its pile; on a touch screen a tap scrolls there and pulls it out. a title in two
// piles (an anime and its manga) goes by the verb before it: "reading" means the manga, "watching" the screen version
function drawLately(D, favs, place) {
  var text = D.lately.text, low = text.toLowerCase(), all = [], hits = [];
  Object.keys(D.favs || {}).forEach(function (k) {
    (D.favs[k] || []).forEach(function (f) { if (f.name && f.cover) all.push({ f: f, k: k }); });
  });
  (D.places || []).forEach(function (p) { if (p.name && p.photo) all.push({ f: { name: p.name, cover: p.photo }, k: "place" }); });
  all.sort(function (a, b) { return b.f.name.length - a.f.name.length; });   // longest first, so a long title wins over one inside it
  all.forEach(function (c) {
    var name = c.f.name.toLowerCase(), from = 0, at;
    while ((at = low.indexOf(name, from)) > -1) {
      var end = at + name.length, same = hits.filter(function (h) { return h.at === at && h.end === end; })[0];
      if (same) same.cands.push(c);
      else if (!hits.some(function (h) { return at < h.end && end > h.at; })) hits.push({ at: at, end: end, cands: [c] });
      from = end;
    }
  });
  // "the gym" (or just "gym") is tied to the sticky note (no picture: the note is right below it)
  var g = low.indexOf("the gym") > -1 ? { at: low.indexOf("the gym"), len: 7 } : low.indexOf("gym") > -1 ? { at: low.indexOf("gym"), len: 3 } : null;
  if (g && !hits.some(function (h) { return g.at < h.end && g.at + g.len > h.at; })) hits.push({ at: g.at, end: g.at + g.len, note: true });
  hits.sort(function (a, b) { return a.at - b.at; });
  var html = "", pos = 0;
  hits.forEach(function (h) {
    var mini = "";
    if (!h.note) {
      var before = low.slice(0, h.at), reading = before.lastIndexOf("read") > before.lastIndexOf("watch");
      h.pick = h.cands.filter(function (c) { return (c.k === "manga") === reading; })[0] || h.cands[0];
      mini = '<img src="' + esc(h.pick.f.cover) + '" alt="" class="mini' + (h.pick.k === "place" ? " mini-photo" : "") + '">';
    }
    html += esc(text.slice(pos, h.at)) + '<span class="mention">' + mini + esc(text.slice(h.at, h.end)) + "</span>";
    pos = h.end;
  });
  $("lately").innerHTML = "Lately I'm " + html + esc(text.slice(pos)) + ". ";
  Array.prototype.forEach.call($("lately").querySelectorAll(".mention"), function (m, i) {
    if (hits[i].note) {   // the gym: hovering picks up the sticky note as if you'd hovered it; a tap scrolls to it and does the same
      var note = document.querySelector(".pinned"), lift = function (on) { note.classList.toggle("lift", on); };
      m.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") lift(true); });
      m.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") lift(false); });
      m.addEventListener("click", function () {
        if (!TOUCH.matches) return;
        $("routine").scrollIntoView({ behavior: "smooth", block: "center" }); tapOn(NOTE);
      });
      return;
    }
    if (hits[i].pick.k === "place") {   // a place: hovering opens the fan on its photo; a tap scrolls there and does the same
      var name = hits[i].pick.f.name;
      m.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") place.point(name); });
      m.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") place.point(null); });
      m.addEventListener("click", function () {
        if (!TOUCH.matches) return;
        $("places").scrollIntoView({ behavior: "smooth", block: "center" }); place.tap(name);
      });
      return;
    }
    var pick = hits[i].pick, pile = $("desk").querySelector('.pile[data-k="' + pick.k + '"]');
    var card = pile && Array.prototype.filter.call(pile.children, function (c) { return c.dataset.n === pick.f.name; })[0];
    if (!card) return;
    m.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") favs.pull(card); });
    m.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") favs.putBack(card.parentNode); });
    m.addEventListener("click", function () { if (TOUCH.matches) favs.view(card); });   // a tap opens the poster big
  });
}

// a fanned hand of pictures (posters, photos), like the contact tiles on the home page: each tilted a little,
// spreading out on hover; each opens its page. items: { name, url, img }; wireFans says which one you're on
var TILT = [-6, 4, -3, 5, -4, 3];
function fan(items) {
  return '<span class="fan">' + items.map(function (f, i) {
    var img = f.img ? '<img src="' + esc(f.img) + '" alt="" loading="lazy" decoding="async">' : "";
    var attrs = ' style="--r: ' + TILT[i % TILT.length] + 'deg" data-n="' + esc(f.name) + '" aria-label="' + esc(f.name) + '"';
    return f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noreferrer"' + attrs + ">" + img + "</a>" : "<span" + attrs + ">" + img + "</span>";
  }).join("") + "</span>";
}
// the picture you're on (or tabbed to) is handed to show(name); leaving the fan hands it null
function wireFans(root, show) {
  Array.prototype.forEach.call(root.querySelectorAll(".fan"), function (fanEl) {
    Array.prototype.forEach.call(fanEl.children, function (p) {
      p.addEventListener("pointerenter", function () { show(p.dataset.n); });
      p.addEventListener("focus", function () { show(p.dataset.n); });
    });
    fanEl.addEventListener("pointerleave", function () { show(null); });
    fanEl.addEventListener("focusout", function (e) { if (!fanEl.contains(e.relatedTarget)) show(null); });
  });
}

// links within the page (the intro's, the top button) scroll there without leaving a step in the history, so the phone's
// back button leaves the page rather than retracing the scrolling
document.addEventListener("click", function (e) {
  var a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  var id = a.getAttribute("href").slice(1), to = id && id !== "top" ? $(id) : null;
  e.preventDefault();
  if (to) to.scrollIntoView({ block: "start" }); else scrollTo({ top: 0 });   // smooth unless the reader asked for less motion (css)
});

// ---------- the top button (phones and tablets): it shows once you're a screen down the page ----------
(function () {
  var b = $("totop"), queued = false;
  if (!b) return;
  function check() { queued = false; b.classList.toggle("show", scrollY > innerHeight * 0.8); }
  addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
  check();
})();

// ---------- routine: the workout, then the rest-day routine, on the sticky note ----------
function drawRoutine(D) {
  // handwritten lines on the sticky note: what, then how much
  function rows(xs) {
    return (Array.isArray(xs) ? xs : []).map(function (x) {
      return "<li><span>" + esc(x.name) + "</span><span>" + esc(x.sets || "") + "</span></li>";
    }).join("");
  }
  // which days are which, beside each heading ("Lift days · Tue, Thu, Sat", "Rest days · Mon, Wed, Fri, Sun")
  var week = Array.isArray(D.week) ? D.week : [], DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function on(lifting) {
    var xs = DAYS.filter(function (d, i) { return (week[i] && week[i] !== "rest") === lifting; });
    return xs.length ? " · " + xs.join(", ") : "";
  }
  $("lift-days").textContent = on(true);
  $("rest-days").textContent = on(false);
  $("plan").innerHTML = rows(D.plan);
  $("rest").innerHTML = rows(D.rest);
}

// ---------- this week: monday to sunday on the strip under the note. a day with a session ("gym" in data.json) gets a tick,
// a lift day gone by without one gets a dash, rest days are in pencil, and today is circled. weeks and today are in IST ----------
var TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function wd(iso) { return (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; }   // 0 = monday … 6 = sunday, the order of "week"
function addDays(iso, n) { return new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
function drawWeek(D) {
  var plan = Array.isArray(D.week) ? D.week : [], went = {};
  (Array.isArray(D.gym) ? D.gym : []).forEach(function (d) { went[d] = 1; });
  var mon = addDays(TODAY, -wd(TODAY)), LETTER = "MTWTFSS", NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  $("week").innerHTML = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
    var day = addDays(mon, i), n = +day.slice(8), lift = !!plan[i] && plan[i] !== "rest", today = day === TODAY;
    var mark = went[day] ? "went" : lift && day < TODAY ? "missed" : "";
    var said = NAME[i] + " " + n + ", " + (lift ? "lift day" : "rest day") + (mark === "went" ? ", went" : mark === "missed" ? ", missed" : "") + (today ? ", today" : "");
    return '<li class="' + [lift ? "lift" : "rest", mark, today ? "today" : ""].join(" ").trim() + '" aria-label="' + said + '">' +
      '<span class="d" aria-hidden="true">' + LETTER[i] + '</span><span class="n" aria-hidden="true">' + n + "</span></li>";
  }).join("");
  // the tally: sessions so far this week against the lift days planned
  var planned = plan.filter(function (p) { return p && p !== "rest"; }).length, done = 0;
  for (var i = 0; i < 7; i++) if (went[addDays(mon, i)]) done++;
  $("wk-tally").textContent = !done ? "No sessions yet this week" : done < planned ? done + " of " + planned + " sessions done"
    : done === planned ? "All " + planned + " done this week" : done + " sessions this week, " + (done - planned) + " extra";
  // on a touch screen a tap picks the strip up and shows the tally; a second tap puts it back
  var wk = $("wk"), WK = { el: wk, on: function () { wk.classList.add("on"); }, off: function () { wk.classList.remove("on"); } };
  wk.addEventListener("click", function () { if (TOUCH.matches) tapToggle(WK); });
}

// ---------- places: a fan of photos, one per place, each opening its google photos album; then where the backdrop photo was taken ----------
function drawPlaces(D) {
  var places = Array.isArray(D.places) ? D.places : [], c = D.cover;
  // a photo per place, fanned like the posters; each opens that place's album
  $("fan").innerHTML = fan(places.map(function (p) {
    return { name: p.name + (p.note ? " (" + p.note + ")" : ""), url: p.album, img: p.photo };
  }));
  // the line under the fan: where and when the backdrop photo was taken; while you're on a place's photo,
  // that place's name takes the line over (like the favourites' captions), and leaving the fan puts the line back
  var pl = c ? places.filter(function (x) { return x.id === c.place; })[0] || {} : null;
  var rest = c ? esc("Backdrop: " + (pl.name || cap(c.place)) + (c.when ? ", " + c.when : "")) : "";
  $("cover-cap").innerHTML = rest;
  function say(name) { $("cover-cap").innerHTML = name ? "<b>" + esc(name) + "</b>" : rest; }
  wireFans($("fan"), say);
  // point at one place from elsewhere (the "lately" line): the fan opens as if hovered, that photo lifts, its name shows
  function point(name) {
    var f = $("fan").querySelector(".fan");
    if (!f) return;
    f.classList.toggle("on", !!name);
    Array.prototype.forEach.call(f.children, function (p) { p.classList.toggle("up", p.dataset.n === name); });
    say(name);
  }
  // touch: a tap on a photo lifts it and names it, with a link to its album; a second tap puts it back
  var TAPS = {};
  Array.prototype.forEach.call($("fan").querySelectorAll(".fan > *"), function (p) {
    var name = p.dataset.n, url = p.getAttribute("href");
    TAPS[name] = { el: p, off: function () { point(null); }, on: function () {
      point(name);
      if (url) $("cover-cap").innerHTML += ' · <a href="' + esc(url) + '" target="_blank" rel="noreferrer">Open album ↗</a>';
    } };
    p.addEventListener("click", function (e) { if (TOUCH.matches) { e.preventDefault(); tapToggle(TAPS[name]); } });
  });
  return { point: point, tap: function (name) { if (TAPS[name]) tapOn(TAPS[name]); } };
}

// ---------- favourites: one messy pile of posters per kind, all on the "desk" at once. the poster you're on (or tabbed to, or tapped)
// slides out: it lifts to the top, straightens and grows a little, and its pile's caption says what it is. the scatter comes from
// each title, so the piles look the same on every visit ----------
function drawFavs(D) {
  var favs = D.favs || {};
  var NAMES = { anime: "Anime", manga: "Manga", tv: "TV", cinema: "Cinema" };
  var kinds = Object.keys(favs).filter(function (k) { return Array.isArray(favs[k]) && favs[k].length; });
  var desk = $("desk"), touch = matchMedia("(hover: none)");
  // ongoing first, then finished; each group a to z (numbers in order: 5, 86, 100); the first ones end up on top of the pile
  function order(a, b) {
    return (a.progress ? 1 : 0) - (b.progress ? 1 : 0) || b.name.localeCompare(a.name, "en", { numeric: true });
  }
  // a steady "random" number from a title, so its tilt and nudge never change
  function rand(str, salt) {
    var h = 2166136261 ^ salt;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }
  // each pile's name is handwritten above it like the section labels, arrow pointing down at it
  function label(k) { return '<p class="pile-k"><span>' + esc(NAMES[k] || cap(k)) + " · " + favs[k].length + "</span></p>"; }
  desk.innerHTML = kinds.map(function (k) {
    var xs = favs[k].slice().sort(order);
    return '<div class="pile-box">' + label(k) + '<div class="pile" data-k="' + esc(k) + '">' + xs.map(function (f) {
      var what = f.progress || "Finished";
      var img = f.cover ? '<img src="' + esc(f.cover) + '" alt="" loading="lazy" decoding="async">' : "";
      var attrs = ' class="pc" data-n="' + esc(f.name) + '" data-w="' + esc(what) + '"' + (f.progress ? ' data-live="1"' : "") + ' aria-label="' + esc(f.name + ", " + what.toLowerCase()) + '"';
      return f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noreferrer"' + attrs + ">" + img + "</a>" : "<span" + attrs + ">" + img + "</span>";
    }).join("") + '</div><p class="sm pile-cap" aria-live="polite"></p></div>';
  }).join("");

  // lay each pile out: a loose grid, every other row nudged over, each card shifted and tilted a little; later cards land on top,
  // and enough of every card still peeks out to point at
  function layout() {
    Array.prototype.forEach.call(desk.querySelectorAll(".pile"), function (pile) {
      var cards = Array.prototype.slice.call(pile.children), n = cards.length;
      if (!n) return;
      var cw = cards[0].offsetWidth, ch = cards[0].offsetHeight;
      var cols = n <= 2 ? n : n <= 6 ? 3 : Math.ceil(Math.sqrt(n * 1.4));
      var sx = cw * 0.56, sy = ch * 0.4, pad = cw * 0.25, maxX = 0, maxY = 0, edge = Infinity;
      cards.forEach(function (c, i) {
        var col = i % cols, row = Math.floor(i / cols), name = c.dataset.n;
        var x = pad + col * sx + (row % 2 ? sx / 2 : 0) + (rand(name, 1) - 0.5) * cw * 0.3;
        var y = pad * 0.6 + row * sy + (rand(name, 2) - 0.5) * ch * 0.18;
        var r = (rand(name, 3) - 0.5) * 22;                    // up to 11° either way
        c.style.setProperty("--x", x.toFixed(1) + "px");
        c.style.setProperty("--y", y.toFixed(1) + "px");
        c.style.setProperty("--r", r.toFixed(1) + "deg");
        c.style.zIndex = i + 1;
        maxX = Math.max(maxX, x + cw); maxY = Math.max(maxY, y + ch);
        var a = Math.abs(r) * Math.PI / 180;                   // a tilted card reaches this far left of its centre
        edge = Math.min(edge, x + cw / 2 - (cw / 2 * Math.cos(a) + ch / 2 * Math.sin(a)));
      });
      pile.style.width = (maxX + pad) + "px";
      pile.style.height = (maxY + pad * 0.6) + "px";
      // the caption starts exactly where the pile's leftmost poster does, tilt included
      // (worked out from each poster's place and angle: measuring would catch them mid-slide)
      pile.nextElementSibling.style.paddingLeft = pile.previousElementSibling.style.paddingLeft = Math.max(0, edge).toFixed(1) + "px";
    });
  }
  layout();
  new ResizeObserver(layout).observe(desk);
  addEventListener("resize", layout);   // on wide screens the posters follow the screen's height, which the desk's own size doesn't show

  // pulling one out: it lifts, the caption under its pile names it; leaving the pile puts it back and clears the caption
  // a poster pulled out is shown bigger than its small image: fetch its big copy (covers/large/) and swap it in once it's
  // loaded, so it never blanks; only the ones you actually pull out are fetched
  function sharpen(card) {
    var img = card.querySelector("img");
    if (!img || card.dataset.sharp) return;
    card.dataset.sharp = "1";
    var big = new Image(), src = img.getAttribute("src").replace(/^covers\/(large\/)?/, "covers/large/");
    big.onload = function () { img.src = src; };
    big.src = src;
  }
  function pull(card) {
    var pile = card.parentNode, capEl = pile.nextElementSibling;
    // another pile's poster still out (a tap there, then here): put that pile back first, caption and all
    Array.prototype.forEach.call(desk.querySelectorAll(".pile"), function (p) { if (p !== pile && p.querySelector(".out")) putBack(p); });
    Array.prototype.forEach.call(pile.children, function (c) { c.classList.toggle("out", c === card); });
    desk.classList.add("pulling");
    capEl.innerHTML = "<b>" + esc(card.dataset.n) + "</b> · " + '<span class="' + (card.dataset.live ? "live" : "muted") + '">' + esc(card.dataset.w) + "</span>" +
      (card.getAttribute("href") && !TOUCH.matches ? " ↗" : "");   // the ↗, like every other link that leaves the site: a click opens its page (a tap on a phone opens the viewer instead)
    sharpen(card);
    // a long title under a pile near the right edge would run off the page: slide it back just enough to end at the edge
    capEl.style.transform = "";
    var over = capEl.getBoundingClientRect().right - desk.getBoundingClientRect().right;
    if (over > 0) capEl.style.transform = "translateX(" + -Math.ceil(over) + "px)";
  }
  function putBack(pile) {
    Array.prototype.forEach.call(pile.children, function (c) { c.classList.remove("out"); });
    pile.nextElementSibling.innerHTML = ""; pile.nextElementSibling.style.transform = "";
    desk.classList.toggle("pulling", !!desk.querySelector(".pc.out"));
  }
  Array.prototype.forEach.call(desk.querySelectorAll(".pile"), function (pile) {
    Array.prototype.forEach.call(pile.children, function (card) {
      card.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pull(card); });
      card.addEventListener("focus", function () { pull(card); });
      // touch: a tap opens the poster big, in the viewer
      card.addEventListener("click", function (e) { if (touch.matches) { e.preventDefault(); view(card); } });
    });
    pile.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") putBack(pile); });
    pile.addEventListener("focusout", function (e) { if (!pile.contains(e.relatedTarget)) putBack(pile); });
  });
  // a tap anywhere else puts every pile back
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".pile, .mention")) Array.prototype.forEach.call(desk.querySelectorAll(".pile"), putBack);
  });

  // the viewer (touch screens): one poster at a time, big, with its name, status and page; swipe for the rest of its pile
  // (top of the pile first), tap anywhere to close
  // it loops: the pile is laid out several times over (enough for at least ~30 posters either side, so even a hard fling
  // glides on as far as it was thrown and settles where it lands), you start in the middle copy, and once a swipe has come
  // to rest the track jumps (invisibly) to the same poster in the middle copy, so there's always more either way
  var viewer = $("viewer"), track = $("v-track"), counter = $("v-count"), from = null, shut = 0, n = 0, rest = 0, mid = 0, list = [], shown = -1;
  function view(card) {
    var cards = Array.prototype.slice.call(card.parentNode.children).reverse(), at = cards.indexOf(card);
    var slides = cards.map(function (c) {
      var img = c.querySelector("img"), href = c.getAttribute("href"), site = href && /anilist/.test(href) ? "AniList" : "TMDB";
      // the big copy (covers/large/, fetched only when it comes into view), over the small one already on the page until it arrives
      var small = img ? img.getAttribute("src").replace(/^covers\/large\//, "covers/") : "", big = small.replace(/^covers\//, "covers/large/");
      return '<img src="' + esc(big) + '" alt=""%LAZY% decoding="async" style="background-image: url(\'' + esc(small) + '\')"' +
        " onerror=\"this.onerror=null; this.src='" + esc(small) + "'\"><figcaption><b>" + esc(c.dataset.n) + "</b> · " +
        '<span class="' + (c.dataset.live ? "live" : "muted") + '">' + esc(c.dataset.w) + "</span>" +
        (href ? '<br><a href="' + esc(href) + '" target="_blank" rel="noreferrer">' + site + " ↗</a>" : "") + "</figcaption>";
    });
    n = slides.length; list = cards;
    var each = n > 1 ? Math.ceil(30 / n) : 0, copies = [];
    for (var k = -each; k <= each; k++) copies.push(k !== 0);   // the outer copies are only there to loop into: hidden from screen readers
    mid = each;
    // the middle copy (where every swipe ends up) loads its big posters straight away, so they're ready whenever you land;
    // the spare copies load theirs only as they come into view
    track.innerHTML = copies.map(function (spare) {
      return slides.map(function (sl) {
        return '<figure class="v-slide"' + (spare ? ' aria-hidden="true"' : "") + ">" + sl.replace("%LAZY%", spare ? ' loading="lazy"' : "") + "</figure>";
      }).join("");
    }).join("");
    shown = -1;
    clearTimeout(shut); from = card;
    viewer.hidden = false; document.documentElement.classList.add("viewing");
    history.pushState({ viewer: true }, "");   // its own step in the history, so the phone's back closes it
    track.scrollLeft = (mid * n + at) * step();
    count(); viewer.focus();
    requestAnimationFrame(function () { viewer.classList.add("open"); });
  }
  function step() { return track.firstElementChild ? track.firstElementChild.offsetWidth : track.clientWidth; }   // one poster's width
  function slot() { return Math.round(track.scrollLeft / step()); }
  // which poster is in the middle: only touched when that changes, not on every frame of a swipe
  function count() {
    var i = slot();
    if (i === shown) return;
    if (track.children[shown]) track.children[shown].classList.remove("cur");
    if (track.children[i]) track.children[i].classList.add("cur");
    shown = i;
    counter.textContent = (i % n) + 1 + " / " + n;
  }
  // once a swipe has come to rest, step back into the middle copy: the same poster, already loaded, swapped in with its
  // transitions switched off for that instant, so nothing on screen moves or reloads
  function wrap() {
    if (n < 2) return;
    var i = slot(), j = mid * n + (i % n);
    if (i === j) return;
    track.classList.add("jump");
    track.scrollLeft = j * step();
    count();
    void track.offsetWidth;   // let the swap land before the transitions come back
    requestAnimationFrame(function () { track.classList.remove("jump"); });
  }
  // closing by a tap (or esc) takes that step back off the history; the phone's back button lands in popstate, below
  function close() { if (history.state && history.state.viewer) history.back(); else hide(); }
  addEventListener("popstate", function () { if (!viewer.hidden) hide(); });
  if (history.state && history.state.viewer) history.replaceState(null, "");   // reloaded with the viewer's step still current
  // on the way out, the poster you ended on (not the one you opened) is the one pulled out of its pile, named underneath
  function hide() {
    var last = n ? list[slot() % n] : from;
    viewer.classList.remove("open"); document.documentElement.classList.remove("viewing");
    shut = setTimeout(function () { viewer.hidden = true; track.innerHTML = ""; }, 200);
    if (last) {
      last.focus({ preventScroll: true });
      setTimeout(function () { pull(last); }, 0);   // after the closing tap has finished bubbling (a tap elsewhere puts piles back)
    }
  }
  var ends = "onscrollend" in window;   // the browser says when a swipe (and its snap) has finished; elsewhere, a short quiet spell
  track.addEventListener("scroll", function () {
    count();
    if (!ends) { clearTimeout(rest); rest = setTimeout(wrap, 160); }
  }, { passive: true });
  if (ends) track.addEventListener("scrollend", wrap);
  viewer.addEventListener("click", function (e) {
    if (e.target.closest("a")) return;
    var f = e.target.closest(".v-slide");
    if (f && !f.classList.contains("cur")) track.scrollTo({ left: Array.prototype.indexOf.call(track.children, f) * step(), behavior: "smooth" });   // a peeking poster: bring it in
    else close();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !viewer.hidden) close(); });

  return { pull: pull, putBack: putBack, view: view };
}

})();
