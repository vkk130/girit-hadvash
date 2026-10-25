/* =====================================================================
   עמוד הבית: פתיח, עובדת השבוע, ארכיון וטיזר סיפורים
   ===================================================================== */

/* ===================== פתיח ===================== */
function initIntro() {
  const lines = $$(".intro-questions li");
  const reveal = $(".intro-reveal");
  const skip = $("#introSkip");
  const cue = $(".scroll-cue");
  let timers = [];
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    lines.forEach((li) => li.classList.add("on", "past"));
    reveal.classList.add("on");
    skip.hidden = true;
    setTimeout(() => cue.classList.add("on"), 900);
  }

  // מי שכבר ראה את הפתיח בביקור הזה — מקבל אותו מיד
  if (REDUCED_MOTION || sessionStorage.getItem("gerit_intro_seen")) { finish(); return; }
  sessionStorage.setItem("gerit_intro_seen", "1");

  const STEP = 1700;
  lines.forEach((li, i) => {
    timers.push(setTimeout(() => {
      lines.forEach((l, k) => { if (k < i) l.classList.add("past"); });
      li.classList.add("on");
    }, 400 + i * STEP));
  });
  timers.push(setTimeout(finish, 400 + lines.length * STEP + 300));
  skip.addEventListener("click", finish);
  $(".intro").addEventListener("click", (e) => { if (!e.target.closest("a,button")) finish(); });
}

/* דבורות קטנות שמרחפות ברקע הפתיח */
function initBees() {
  const c = $("#beeCanvas");
  if (!c || REDUCED_MOTION) return;
  const ctx = c.getContext("2d");
  let W, H, mx = 0, my = 0, running = true;
  const bees = Array.from({ length: 7 }, (_, i) => ({
    cx: Math.random(), cy: 0.15 + Math.random() * 0.7,
    rx: 40 + Math.random() * 90, ry: 20 + Math.random() * 50,
    speed: 0.25 + Math.random() * 0.45, phase: Math.random() * 6.28, size: 14 + Math.random() * 10, depth: 0.3 + (i % 3) * 0.35,
  }));
  function resize() {
    const dpr = devicePixelRatio || 1;
    W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  new IntersectionObserver(([en]) => { running = en.isIntersecting; if (running) requestAnimationFrame(tick); }).observe(c);
  resize();
  function tick(t) {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#000"; // צבע אטום: אחרת אימוג'י מצוירים שקופים למחצה
    bees.forEach((b) => {
      const a = (t / 1000) * b.speed + b.phase;
      const x = b.cx * W + Math.sin(a) * b.rx - mx * 40 * b.depth;
      const y = b.cy * H + Math.sin(a * 2) * b.ry - my * 30 * b.depth;
      ctx.globalAlpha = 0.35 + b.depth * 0.5;
      ctx.save();
      ctx.translate(x, y);
      if (Math.cos(a) > 0) ctx.scale(-1, 1);
      ctx.font = `${b.size}px sans-serif`;
      ctx.fillText("🐝", 0, 0);
      ctx.restore();
      // שובל מקווקו קטן
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#f2b134";
      for (let k = 1; k < 5; k++) {
        const aa = a - k * 0.09;
        ctx.beginPath();
        ctx.arc(b.cx * W + Math.sin(aa) * b.rx - mx * 40 * b.depth, b.cy * H + Math.sin(aa * 2) * b.ry - my * 30 * b.depth, 1.6, 0, 6.28);
        ctx.fill();
      }
      ctx.fillStyle = "#000";
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ===================== עובדת השבוע ===================== */
// עוגן: חמישי 22.10.2026 09:00 = עובדה מס' 1. כל חמישי 09:00 ושבת 20:00 מתקדמים בעובדה אחת.
const FACTS_EPOCH = new Date(2026, 9, 22, 9, 0, 0);

function getFactSlot(now = new Date()) {
  const lastThu = new Date(now);
  lastThu.setHours(9, 0, 0, 0);
  lastThu.setDate(lastThu.getDate() - ((lastThu.getDay() - 4 + 7) % 7));
  if (lastThu > now) lastThu.setDate(lastThu.getDate() - 7);
  const satEvening = new Date(lastThu);
  satEvening.setDate(satEvening.getDate() + 2);
  satEvening.setHours(20, 0, 0, 0);
  const nextThu = new Date(lastThu);
  nextThu.setDate(nextThu.getDate() + 7);
  const slot = now >= satEvening ? 1 : 0;
  const weeks = Math.round((lastThu - FACTS_EPOCH) / (7 * 24 * 3600 * 1000));
  const absolute = weeks * 2 + slot; // כמה עובדות נחשפו מאז ההשקה
  const n = FACTS.length;
  const index = ((absolute % n) + n) % n;
  return { index, absolute, fact: FACTS[index], next: slot ? nextThu : satEvening, slot };
}

function renderFactText(el, text) {
  // מחלקים למילים כדי לחשוף אותן אחת-אחת ("פענוח")
  el.innerHTML = text.split(" ").map((w, i) =>
    `<span class="w" style="transition-delay:${Math.min(i * 28, 1400)}ms">${escapeHtml(w)}</span>`).join(" ");
  el.setAttribute("aria-label", text);
  if (REDUCED_MOTION) { el.classList.add("decoded"); return; }
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { el.classList.add("decoded"); io.disconnect(); }
  }, { threshold: 0.4 });
  io.observe(el);
}

function initFacts() {
  const textEl = $("#factText");
  let current = getFactSlot();

  function render() {
    current = getFactSlot();
    textEl.classList.remove("decoded");
    renderFactText(textEl, current.fact);
    $("#factNumber").textContent = `עובדה #${current.index + 1} מתוך ${FACTS.length}`;
    $("#factBadge").textContent = current.slot ? "עובדת מוצאי שבת" : "עובדת סופ״ש";
    renderArchive(current);
    tick();
  }
  function tick() {
    const diff = current.next - new Date();
    if (diff <= 0) return render();
    const total = Math.floor(diff / 1000);
    const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    $("#cdD").textContent = d; $("#cdH").textContent = h; $("#cdM").textContent = String(m).padStart(2, "0"); $("#cdS").textContent = String(s).padStart(2, "0");
  }
  render();
  setInterval(tick, 1000);

  $("#factShareWa").addEventListener("click", () =>
    shareWhatsApp(`🦡 עובדת גירית לסופ״ש טוב יותר:\n\n${current.fact}\n\nעובדה חדשה כל חמישי ומוצאי שבת:`));
  $("#factShareIg").addEventListener("click", () => shareNative(`🦡 ${current.fact}`));
  $("#factCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(`${current.fact}\n— ${SITE_URL}`); toast("העובדה הועתקה 🦡"); }
    catch { toast("לא הצלחנו להעתיק"); }
  });

  // תזכורות ביומן
  const menu = $("#calMenu"), btn = $("#factCalBtn");
  btn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); });
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
  $("#calGoogleThu").href = googleCalLink(4, 9, "TH");
  $("#calGoogleSat").href = googleCalLink(6, 20, "SA");
  $("#calIcs").addEventListener("click", downloadICS);
}

function renderArchive(cur) {
  // העובדות שכבר נחשפו (מהאחרונה לראשונה), בלי העובדה הנוכחית
  const count = Math.min(cur.absolute, FACTS.length - 1);
  const wrap = $("#archive");
  if (count <= 0) { wrap.hidden = true; return; }
  wrap.hidden = false;
  $("#archiveCount").textContent = count;
  const n = FACTS.length;
  const items = [];
  for (let k = 1; k <= count; k++) {
    const idx = (((cur.absolute - k) % n) + n) % n;
    items.push(`<li><b>עובדה #${idx + 1}</b>${escapeHtml(FACTS[idx])}</li>`);
  }
  $("#archiveList").innerHTML = items.join("");
}

function nextWeekday(dow, hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  if (d <= new Date()) d.setDate(d.getDate() + 7);
  return d;
}
function fmtLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}
const CAL_TITLE = "🦡 עובדת גירית חדשה!";
const CAL_DESC = `עובדת הגירית לסופ״ש טוב יותר התחלפה. כנסו לקרוא: ${SITE_URL}`;

function googleCalLink(dow, hour, byday) {
  const start = nextWeekday(dow, hour);
  const end = new Date(start.getTime() + 15 * 60000);
  return "https://calendar.google.com/calendar/render?" + new URLSearchParams({
    action: "TEMPLATE", text: CAL_TITLE, details: CAL_DESC,
    dates: `${fmtLocal(start)}/${fmtLocal(end)}`, ctz: "Asia/Jerusalem", recur: `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
  });
}

function downloadICS() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = (dow, hour, byday, id) => {
    const s = nextWeekday(dow, hour);
    return ["BEGIN:VEVENT", `UID:${id}-${Date.now()}@gerit-hadvash`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Jerusalem:${fmtLocal(s)}`, `DTEND;TZID=Asia/Jerusalem:${fmtLocal(new Date(s.getTime() + 15 * 60000))}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday}`, `SUMMARY:${CAL_TITLE}`, `DESCRIPTION:${CAL_DESC}`, `URL:${SITE_URL}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${CAL_TITLE}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"];
  };
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gerit HaDvash//Facts//HE", "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE", "TZID:Asia/Jerusalem",
    "BEGIN:STANDARD", "DTSTART:19701025T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "TZOFFSETFROM:+0300", "TZOFFSETTO:+0200", "END:STANDARD",
    "BEGIN:DAYLIGHT", "DTSTART:19700327T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1FR", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0300", "END:DAYLIGHT",
    "END:VTIMEZONE", ...ev(4, 9, "TH", "thu"), ...ev(6, 20, "SA", "sat"), "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "gerit-fact-reminders.ics" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  $("#calMenu").hidden = true;
  toast("הקובץ ירד — פתחו אותו כדי להוסיף את התזכורות ליומן");
}

/* ===================== טיזר: סיפורים אחרונים ===================== */
function initLatestStories() {
  const wrap = $("#latestStories");
  wrap.innerHTML = `<div class="empty-state" style="grid-column:1/-1">טוען סיפורים…</div>`;
  const render = (posts) => {
    if (!posts.length) {
      wrap.innerHTML = `<div class="empty-state" style="grid-column:1/-1">עדיין אין סיפורים. היו הראשונים לספר על מפגש עם גירית 🦡</div>`;
      return;
    }
    wrap.innerHTML = posts.slice(0, 3).map((p) => postCardHtml(p, { compact: true })).join("");
  };
  whenDB().then((db) => {
    if (!db) return render(store.get("gerit_posts", []));
    db.subscribePosts(render, () => render(store.get("gerit_posts", [])), 3);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initIntro();
  initBees();
  initFacts();
  initLatestStories();
});
