/* =====================================================================
   עולם גירית הדבש — לוגיקת האתר
   ===================================================================== */
const SITE_URL = (document.querySelector('link[rel="canonical"]') || {}).href || location.href.split("#")[0];
const SITE_NAME = "עולם גירית הדבש";

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initFacts();
  initTrivia();
  initMemoryGame();
  initDodgeGame();
  initPosts();
  initLeaderboard();
  initShareButtons();
  registerServiceWorker();
});

/* ===================== עזרים ===================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* מצב גלישה פרטית — ממשיכים בלי שמירה */ }
  },
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function timeAgo(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "ממש עכשיו";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "לפני דקה" : `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "אתמול" : `לפני ${d} ימים`;
  return new Date(ms).toLocaleDateString("he-IL");
}

/** מחכה עד ש-firebase.js נטען (או מוותר אחרי זמן קצוב ועובד מקומית). */
function whenDB(timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (window.GeritDB) return resolve(window.GeritDB);
    const timer = setTimeout(() => resolve(null), timeoutMs);
    window.addEventListener("geritdb-ready", () => { clearTimeout(timer); resolve(window.GeritDB); }, { once: true });
  });
}

function getPlayerId() {
  let id = store.get("gerit_player_id", null);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
    store.set("gerit_player_id", id);
  }
  return id;
}

/* ===================== ניווט ===================== */
function initNav() {
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("a", links).forEach((a) => a.addEventListener("click", () => {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));
}

/* ===================== עובדת גירית שבועית ===================== */
// עוגן: חמישי 22.10.2026 09:00 = עובדה מס' 0. כל חמישי 09:00 ושבת 20:00 מתקדמים בעובדה אחת.
const FACTS_EPOCH = new Date(2026, 9, 22, 9, 0, 0);

function getFactSlot(now = new Date()) {
  // יום חמישי האחרון בשעה 09:00 שכבר עבר
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
  const n = FACTS.length;
  const index = (((weeks * 2 + slot) % n) + n) % n;
  return { index, fact: FACTS[index], next: slot ? nextThu : satEvening, slot };
}

function initFacts() {
  const textEl = $("#factText");
  const countdownEl = $("#factCountdown");
  const numberEl = $("#factNumber");
  let current = null;

  function render() {
    current = getFactSlot();
    textEl.textContent = current.fact;
    numberEl.textContent = `עובדה ${current.index + 1} מתוך ${FACTS.length}`;
    tick();
  }
  function tick() {
    const diff = current.next - new Date();
    if (diff <= 0) return render();
    const totalMin = Math.floor(diff / 60000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    const parts = [];
    if (d) parts.push(d === 1 ? "יום" : `${d} ימים`);
    if (h) parts.push(h === 1 ? "שעה" : `${h} שעות`);
    if (!d) parts.push(m === 1 ? "דקה" : `${m} דקות`);
    countdownEl.textContent = "העובדה הבאה בעוד " + parts.join(" ו-");
  }
  render();
  setInterval(tick, 30000);

  // שיתוף העובדה עצמה
  $("#factShareWa").addEventListener("click", () => {
    shareWhatsApp(`🦡 עובדת גירית לסופ״ש טוב יותר:\n\n${current.fact}\n\nעוד עובדות, טריוויה ומשחקים:`);
  });
  $("#factShareIg").addEventListener("click", () => shareNative(`🦡 ${current.fact}`, null));

  // תזכורות ביומן
  const menu = $("#calMenu");
  $("#factCalBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    $("#factCalBtn").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; $("#factCalBtn").setAttribute("aria-expanded", "false"); }
  });
  $("#calGoogleThu").href = googleCalLink(4, 9, "TH");
  $("#calGoogleSat").href = googleCalLink(6, 20, "SA");
  $("#calIcs").addEventListener("click", downloadICS);
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
function calDescription() { return `עובדת הגירית לסופ״ש טוב יותר התחלפה. כנסו לקרוא: ${SITE_URL}`; }

function googleCalLink(dow, hour, byday) {
  const start = nextWeekday(dow, hour);
  const end = new Date(start.getTime() + 15 * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: CAL_TITLE,
    details: calDescription(),
    dates: `${fmtLocal(start)}/${fmtLocal(end)}`,
    ctz: "Asia/Jerusalem",
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

function downloadICS() {
  const stamp = fmtLocal(new Date()).replace(/T.*/, "T000000Z");
  const ev = (dow, hour, byday, id) => {
    const s = nextWeekday(dow, hour);
    return [
      "BEGIN:VEVENT",
      `UID:${id}-${Date.now()}@gerit-hadvash`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Jerusalem:${fmtLocal(s)}`,
      `DTEND;TZID=Asia/Jerusalem:${fmtLocal(new Date(s.getTime() + 15 * 60000))}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
      `SUMMARY:${CAL_TITLE}`,
      `DESCRIPTION:${calDescription()}`,
      `URL:${SITE_URL}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${CAL_TITLE}`, "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT",
    ];
  };
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gerit HaDvash//Facts//HE", "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE", "TZID:Asia/Jerusalem",
    "BEGIN:STANDARD", "DTSTART:19701025T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "TZOFFSETFROM:+0300", "TZOFFSETTO:+0200", "END:STANDARD",
    "BEGIN:DAYLIGHT", "DTSTART:19700327T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1FR", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0300", "END:DAYLIGHT",
    "END:VTIMEZONE",
    ...ev(4, 9, "TH", "thu"),
    ...ev(6, 20, "SA", "sat"),
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "gerit-fact-reminders.ics" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  $("#calMenu").hidden = true;
  toast("הקובץ ירד — פתחו אותו כדי להוסיף את התזכורות ליומן");
}

/* ===================== טריוויה ===================== */
const ROUND_SIZE = 7;
const WIN_POINTS = 50;
const LOSE_POINTS = 10;

const Trivia = {
  round: [],
  index: 0,
  score: store.get("gerit_trivia_score", 0),
  streak: store.get("gerit_trivia_rounds_won", 0),
};

function pickRound() {
  // לא חוזרים על שאלות עד שכל הבנק נגמר
  let seen = new Set(store.get("gerit_trivia_seen", []));
  let pool = TRIVIA.map((_, i) => i).filter((i) => !seen.has(i));
  if (pool.length < ROUND_SIZE) { seen = new Set(); pool = TRIVIA.map((_, i) => i); }
  const chosen = shuffle(pool).slice(0, ROUND_SIZE);
  chosen.forEach((i) => seen.add(i));
  store.set("gerit_trivia_seen", [...seen]);
  return chosen.map((i) => {
    const t = TRIVIA[i];
    const options = shuffle(t.a.map((text, k) => ({ text, correct: k === 0 })));
    return { q: t.q, options, e: t.e };
  });
}

function initTrivia() {
  updateTriviaStats();
  $("#triviaArea").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "start") startRound();
    if (action === "next") { Trivia.index++; renderQuestion(); }
    if (action === "share-card") openScoreCard();
  });
}

function updateTriviaStats() {
  $("#triviaScore").textContent = Trivia.score;
  $("#triviaRounds").textContent = Trivia.streak;
}

function startRound() {
  Trivia.round = pickRound();
  Trivia.index = 0;
  renderQuestion();
}

function renderProgress() {
  $("#triviaProgress").innerHTML = Array.from({ length: ROUND_SIZE }, (_, i) =>
    `<span class="${i < Trivia.index ? "done" : i === Trivia.index ? "current" : ""}"></span>`).join("");
}

function renderQuestion() {
  const q = Trivia.round[Trivia.index];
  renderProgress();
  const area = $("#triviaArea");
  area.innerHTML = `
    <p class="trivia-count">שאלה ${Trivia.index + 1} מתוך ${ROUND_SIZE}</p>
    <h3 class="trivia-q">${escapeHtml(q.q)}</h3>
    <div class="trivia-options" role="group" aria-label="תשובות">
      ${q.options.map((o, i) => `<button class="trivia-opt" data-i="${i}">${escapeHtml(o.text)}</button>`).join("")}
    </div>
    <div class="trivia-feedback" aria-live="polite"></div>`;
  $$(".trivia-opt", area).forEach((b) => b.addEventListener("click", () => answer(Number(b.dataset.i))));
  $(".trivia-opt", area).focus({ preventScroll: true });
}

function answer(i) {
  const area = $("#triviaArea");
  const q = Trivia.round[Trivia.index];
  const buttons = $$(".trivia-opt", area);
  buttons.forEach((b) => (b.disabled = true));
  const correctIdx = q.options.findIndex((o) => o.correct);
  buttons[correctIdx].classList.add("correct");
  const fb = $(".trivia-feedback", area);

  if (q.options[i].correct) {
    const last = Trivia.index === ROUND_SIZE - 1;
    if (last) return winRound();
    fb.innerHTML = `<p class="fb-title good">נכון! 🦡</p><p class="fb-exp">${escapeHtml(q.e)}</p>
      <button class="btn btn-primary btn-small" data-action="next">לשאלה הבאה ←</button>`;
  } else {
    buttons[i].classList.add("wrong");
    const before = Trivia.score;
    Trivia.score = Math.max(0, Trivia.score - LOSE_POINTS);
    store.set("gerit_trivia_score", Trivia.score);
    updateTriviaStats();
    syncScore(Trivia.score - before);
    fb.innerHTML = `<p class="fb-title bad">לא הפעם. −${LOSE_POINTS} נקודות, והסבב מתחיל מחדש.</p>
      <p class="fb-exp">${escapeHtml(q.e)}</p>
      <button class="btn btn-primary btn-small" data-action="start">סבב חדש</button>`;
  }
  fb.querySelector("button")?.focus({ preventScroll: true });
}

function winRound() {
  Trivia.score += WIN_POINTS;
  Trivia.streak += 1;
  store.set("gerit_trivia_score", Trivia.score);
  store.set("gerit_trivia_rounds_won", Trivia.streak);
  updateTriviaStats();
  renderProgress();
  $$("#triviaProgress span").forEach((s) => (s.className = "done"));
  syncScore(WIN_POINTS);

  $("#triviaArea").innerHTML = `
    <div class="trivia-win">
      <div class="win-badge" aria-hidden="true">🏆</div>
      <h3>סבב מושלם! +${WIN_POINTS} נקודות</h3>
      <p>7 מתוך 7. גירית הדבש הייתה גאה בך. הניקוד שלך עכשיו: <b>${Trivia.score}</b></p>
      <div class="win-actions">
        <button class="btn btn-primary" data-action="start">עוד סבב</button>
        <button class="btn btn-outline" data-action="share-card">📸 כרטיס ניקוד לשיתוף</button>
      </div>
    </div>`;

  if (!store.get("gerit_player_name", null)) openNameModal();
}

/* ===================== לוח מובילים ===================== */
let leaderboardRows = [];

async function syncScore(delta) {
  const name = store.get("gerit_player_name", null);
  if (!name || !delta) return;
  const db = await whenDB();
  if (!db) return;
  try { await db.addScore(getPlayerId(), delta); }
  catch (err) { console.warn("[gerit] score sync skipped:", err.code || err.message); }
}

function openNameModal() {
  const modal = $("#nameModal");
  const input = $("#nameInput");
  input.value = store.get("gerit_player_name", "") || "";
  modal.hidden = false;
  setTimeout(() => input.focus(), 50);
}

function initLeaderboard() {
  const modal = $("#nameModal");
  $("#nameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#nameInput").value.trim().slice(0, 24);
    if (!name) return $("#nameInput").focus();
    store.set("gerit_player_name", name);
    modal.hidden = true;
    const db = await whenDB();
    if (!db) return toast("אין חיבור ללוח המשותף כרגע — הניקוד נשמר אצלך");
    try {
      await db.registerPlayer(getPlayerId(), name, Math.min(Trivia.score, 500));
      toast(`נרשמת ללוח המובילים בתור ${name} 🦡`);
    } catch (err) {
      console.warn("[gerit] register failed:", err.code || err.message);
      toast("לא הצלחנו להירשם ללוח כרגע. ננסה שוב בניצחון הבא.");
      store.set("gerit_player_name", null);
    }
  });
  $("#nameSkip").addEventListener("click", () => (modal.hidden = true));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { modal.hidden = true; $("#cardModal").hidden = true; } });
  $("#leaderboardJoin").addEventListener("click", openNameModal);

  renderLeaderboard(null);
  whenDB().then((db) => {
    if (!db) return renderLeaderboard([], "offline");
    db.subscribeLeaderboard(
      (rows) => { leaderboardRows = rows; renderLeaderboard(rows); },
      (err) => { console.warn("[gerit] leaderboard:", err.code || err.message); renderLeaderboard([], "offline"); },
    );
  });
}

function renderLeaderboard(rows, state) {
  const wrap = $("#leaderboardBody");
  const me = getPlayerId();
  if (rows === null) { wrap.innerHTML = `<div class="empty-state">טוען את לוח המובילים…</div>`; return; }
  if (state === "offline") {
    wrap.innerHTML = `<div class="empty-state">לוח המובילים המשותף לא זמין כרגע. הניקוד שלך (${Trivia.score}) נשמר במכשיר.</div>`;
    return;
  }
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty-state">הלוח עדיין ריק. נצחו סבב שלם ותהיו הגירית הראשונה כאן 🦡</div>`;
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  wrap.innerHTML = rows.map((r, i) => `
    <div class="leaderboard-row${r.id === me ? " you" : ""}">
      <div class="leaderboard-rank">${medals[i] || i + 1}</div>
      <div class="leaderboard-name">${escapeHtml(r.name)}${r.id === me ? ' <span class="you-tag">את/ה</span>' : ""}</div>
      <div class="leaderboard-score">${Number(r.score) || 0}</div>
    </div>`).join("");
}

/* ===================== כרטיס ניקוד לשיתוף ===================== */
function rankLabel(score) {
  if (score >= 1000) return "אגדת הסוואנה";
  if (score >= 500) return "גירית אלפא";
  if (score >= 250) return "ציידת קוברות";
  if (score >= 100) return "פורצת כוורות";
  return "גור סקרן";
}

async function drawScoreCard() {
  const c = $("#scoreCanvas");
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;
  await document.fonts.ready;

  // רקע
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#201e1b"); bg.addColorStop(1, "#141311");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // הילה ענברית
  const glow = ctx.createRadialGradient(W / 2, 330, 40, W / 2, 330, 520);
  glow.addColorStop(0, "rgba(226,137,28,.28)"); glow.addColorStop(1, "rgba(226,137,28,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // הגירית — אותו ציור כמו בראש האתר
  const img = await loadImage("assets/badger.svg");
  const bw = 620, bh = bw * 220 / 400;
  ctx.drawImage(img, (W - bw) / 2, 150, bw, bh);

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#E2891C";
  ctx.font = "56px 'Suez One', serif";
  ctx.fillText(rankLabel(Trivia.score), W / 2, 590);

  ctx.fillStyle = "#E7DDC3";
  ctx.font = "800 190px 'Heebo', sans-serif";
  ctx.fillText(String(Trivia.score), W / 2, 790);
  ctx.font = "500 44px 'Heebo', sans-serif";
  ctx.fillStyle = "#C7C3B8";
  ctx.fillText(`נקודות בטריוויית גירית הדבש · ${Trivia.streak} סבבים מושלמים`, W / 2, 860);

  // פס קרוע
  ctx.fillStyle = "#E2891C";
  ctx.beginPath(); ctx.moveTo(0, 940);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 940 + (x / 40 % 2 ? -14 : 14));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#171614";
  ctx.font = "44px 'Suez One', serif";
  ctx.fillText("אתם חושבים שתעברו אותי? 🦡", W / 2, 1030);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function openScoreCard() {
  $("#cardModal").hidden = false;
  try { await drawScoreCard(); } catch (err) { console.warn("[gerit] card:", err); }
}

function canvasBlob() {
  return new Promise((resolve) => $("#scoreCanvas").toBlob(resolve, "image/png"));
}

function initScoreCardButtons() {
  $("#cardClose").addEventListener("click", () => ($("#cardModal").hidden = true));
  $("#cardModal").addEventListener("click", (e) => { if (e.target.id === "cardModal") e.target.hidden = true; });
  $("#cardDownload").addEventListener("click", async () => {
    const blob = await canvasBlob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "gerit-score.png" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("התמונה נשמרה — העלו אותה לסטורי ותייגו חברים");
  });
  $("#cardShare").addEventListener("click", async () => {
    const blob = await canvasBlob();
    const file = new File([blob], "gerit-score.png", { type: "image/png" });
    const text = `השגתי ${Trivia.score} נקודות בטריוויית גירית הדבש 🦡 נראה אתכם:`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `${text} ${SITE_URL}` }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    $("#cardDownload").click();
  });
  $("#cardWa").addEventListener("click", () =>
    shareWhatsApp(`השגתי ${Trivia.score} נקודות בטריוויית גירית הדבש 🦡 נראה אתכם עוברים אותי:`));
}

/* ===================== שיתוף ===================== */
function shareWhatsApp(text) {
  const url = "https://wa.me/?text=" + encodeURIComponent(`${text}\n${SITE_URL}`);
  window.open(url, "_blank", "noopener");
}

async function shareNative(text) {
  // באינסטגרם אין קישור שיתוף ישיר מהדפדפן: בנייד פותחים את חלון השיתוף של המכשיר (שם בוחרים אינסטגרם),
  // ובמחשב מעתיקים את הקישור.
  if (navigator.share) {
    try { await navigator.share({ title: SITE_NAME, text, url: SITE_URL }); return; }
    catch (err) { if (err.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${SITE_URL}`);
    toast("הקישור הועתק — הדביקו אותו בסטורי או בביו באינסטגרם");
  } catch {
    toast("העתיקו את הכתובת מהדפדפן ושתפו באינסטגרם");
  }
}

function initShareButtons() {
  $$("[data-share]").forEach((btn) => {
    const kind = btn.dataset.share;
    const text = btn.dataset.text || "תראו את האתר הזה על גירית הדבש — עובדות, טריוויה ומשחקים 🦡";
    btn.addEventListener("click", () => (kind === "whatsapp" ? shareWhatsApp(text) : shareNative(text)));
  });
  initScoreCardButtons();
}

/* ===================== משחק זיכרון ===================== */
const MEMORY_ICONS = ["🦡", "🐝", "🍯", "🐍", "🦂", "🦎", "🐢", "🪲"];

function initMemoryGame() {
  const grid = $("#memoryGrid");
  const movesEl = $("#memoryMoves");
  const bestEl = $("#memoryBest");
  let cards = [], open = [], matched = new Set(), moves = 0, lock = false;

  const showBest = () => {
    const b = store.get("gerit_memory_best", null);
    bestEl.textContent = b ? `שיא: ${b} מהלכים` : "אין שיא עדיין";
  };

  function setup() {
    cards = shuffle([...MEMORY_ICONS, ...MEMORY_ICONS]);
    open = []; matched = new Set(); moves = 0; lock = false;
    movesEl.textContent = "מהלכים: 0";
    grid.innerHTML = cards.map((icon, i) =>
      `<button class="memory-card" data-i="${i}" aria-label="קלף ${i + 1}, סגור"><span class="face">${icon}</span></button>`).join("");
    showBest();
  }

  function paint(i) {
    const el = grid.children[i];
    const isOpen = open.includes(i) || matched.has(i);
    el.classList.toggle("open", isOpen);
    el.classList.toggle("matched", matched.has(i));
    el.setAttribute("aria-label", isOpen ? `קלף ${i + 1}: ${cards[i]}` : `קלף ${i + 1}, סגור`);
  }

  grid.addEventListener("click", (e) => {
    const el = e.target.closest(".memory-card");
    if (!el) return;
    const i = Number(el.dataset.i);
    if (lock || open.includes(i) || matched.has(i)) return;
    open.push(i); paint(i);
    if (open.length < 2) return;
    moves++; movesEl.textContent = "מהלכים: " + moves;
    const [a, b] = open;
    if (cards[a] === cards[b]) {
      matched.add(a); matched.add(b); open = []; paint(a); paint(b);
      if (matched.size === cards.length) {
        const best = store.get("gerit_memory_best", null);
        if (!best || moves < best) { store.set("gerit_memory_best", moves); bestEl.textContent = `שיא חדש: ${moves} מהלכים! 🏆`; }
        toast(`סיימת ב-${moves} מהלכים 🦡`);
      }
    } else {
      lock = true;
      setTimeout(() => { open = []; paint(a); paint(b); lock = false; }, 800);
    }
  });

  $("#memoryReset").addEventListener("click", setup);
  setup();
}

/* ===================== משחק "בריחה בסוואנה" ===================== */
function initDodgeGame() {
  const canvas = $("#dodgeCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = $("#dodgeOverlay");
  const scoreEl = $("#dodgeScore");
  const bestEl = $("#dodgeBest");
  let W = 0, H = 0;
  let running = false, x = 0, score = 0, speed = 2.6, objects = [], keys = {}, frame = 0, raf, lives = 3, hitFlash = 0, pointerX = null;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = Math.round(W * 0.62);
    canvas.style.height = H + "px";
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) drawScene();
  }
  window.addEventListener("resize", resize);

  const best = () => store.get("gerit_dodge_best", 0);
  bestEl.textContent = "שיא: " + best();

  function spawn() {
    const r = Math.random();
    const type = r < 0.3 ? "honey" : r < 0.36 ? "heart" : "danger";
    const emoji = type === "honey" ? "🍯" : type === "heart" ? "🐝" : ["🐍", "🦂", "🪨"][Math.floor(Math.random() * 3)];
    objects.push({ x: 20 + Math.random() * (W - 40), y: -20, type, emoji, vy: speed * (0.8 + Math.random() * 0.5) });
  }

  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(231,221,195,0.05)";
    for (let i = 1; i < 6; i++) ctx.fillRect(0, (i * H) / 6 + ((frame * speed * 0.5) % (H / 6)), W, 1);
    ctx.fillStyle = "rgba(226,137,28,0.12)";
    ctx.fillRect(0, H - 8, W, 8);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "24px sans-serif";
    objects.forEach((o) => ctx.fillText(o.emoji, o.x, o.y));
    if (hitFlash > 0) { ctx.globalAlpha = 0.4 + 0.6 * ((hitFlash >> 2) % 2); }
    ctx.font = "34px sans-serif";
    ctx.fillText("🦡", x || W / 2, H - 28);
    ctx.globalAlpha = 1;
    ctx.font = "16px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("❤️".repeat(lives), W - 10, 18);
  }

  function loop() {
    if (!running) return;
    frame++;
    if (pointerX !== null) x += Math.max(-7, Math.min(7, pointerX - x));
    if (keys.left) x -= 6;
    if (keys.right) x += 6;
    x = Math.max(18, Math.min(W - 18, x));

    if (frame % Math.max(14, 42 - Math.floor(speed * 4)) === 0) spawn();
    objects.forEach((o) => (o.y += o.vy));
    objects = objects.filter((o) => {
      if (o.y > H + 20) return false;
      if (Math.hypot(o.x - x, o.y - (H - 28)) < 26) {
        if (o.type === "honey") score += 10;
        else if (o.type === "heart") { lives = Math.min(3, lives + 1); score += 5; }
        else if (hitFlash <= 0) { lives--; hitFlash = 60; if (navigator.vibrate) navigator.vibrate(60); }
        return false;
      }
      return true;
    });
    if (hitFlash > 0) hitFlash--;
    score += 0.04;
    speed += 0.0012;
    scoreEl.textContent = "ניקוד: " + Math.floor(score);
    drawScene();
    if (lives <= 0) return endGame();
    raf = requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(raf);
    const final = Math.floor(score);
    let msg = `ניקוד סופי: <b>${final}</b>`;
    if (final > best()) { store.set("gerit_dodge_best", final); bestEl.textContent = "שיא: " + final + " 🏆"; msg += "<br>שיא חדש!"; }
    overlay.innerHTML = `<p>הגירית נלכדה. ${msg}</p><button class="btn btn-primary btn-small" id="dodgeRetry">שחק שוב</button>`;
    overlay.hidden = false;
    $("#dodgeRetry").addEventListener("click", start);
  }

  function start() {
    x = W / 2; score = 0; speed = 2.6; objects = []; lives = 3; hitFlash = 0; frame = 0; pointerX = null;
    overlay.hidden = true;
    running = true;
    loop();
  }
  $("#dodgeStart").addEventListener("click", start);

  document.addEventListener("keydown", (e) => {
    if (!running) return;
    if (e.key === "ArrowLeft") { keys.left = true; e.preventDefault(); }
    if (e.key === "ArrowRight") { keys.right = true; e.preventDefault(); }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });
  // מגע ועכבר: הגירית עוקבת אחרי האצבע
  const toX = (e) => e.clientX - canvas.getBoundingClientRect().left;
  canvas.addEventListener("pointerdown", (e) => { pointerX = toX(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (pointerX !== null || e.pointerType === "mouse") pointerX = toX(e); });
  canvas.addEventListener("pointerup", () => { pointerX = null; });
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") pointerX = null; });

  resize();
}

/* ===================== קיר הסיפורים ===================== */
const POST_MOODS = [
  { emoji: "😱", label: "הלם" },
  { emoji: "😂", label: "מצחיק" },
  { emoji: "🥹", label: "מרגש" },
  { emoji: "😨", label: "מפחיד" },
  { emoji: "🥳", label: "חגיגי" },
  { emoji: "🤔", label: "מסקרן" },
];
const SCALE_LABELS = ["", "גירית רגועה", "קצת עקשנית", "גירית מול כוורת", "גירית מול קוברה", "גירית מול שישה אריות"];
const POST_COOLDOWN_MS = 60 * 1000;

function initPosts() {
  const form = $("#postForm");
  const wall = $("#postsWall");
  let mood = POST_MOODS[0].emoji;
  let rating = 3;
  let usingDB = false;

  const moodWrap = $("#moodPicker");
  moodWrap.innerHTML = POST_MOODS.map((m, i) =>
    `<button type="button" role="radio" aria-checked="${i === 0}" class="${i === 0 ? "active" : ""}" data-v="${m.emoji}" title="${m.label}">${m.emoji}<small>${m.label}</small></button>`).join("");
  moodWrap.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", moodWrap).forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-checked", "false"); });
    b.classList.add("active"); b.setAttribute("aria-checked", "true"); mood = b.dataset.v;
  });

  const scaleWrap = $("#badgerScale");
  const scaleLabel = $("#scaleLabel");
  scaleWrap.innerHTML = [1, 2, 3, 4, 5].map((n) =>
    `<button type="button" role="radio" aria-checked="${n === 3}" class="${n === 3 ? "active" : ""}" data-v="${n}" aria-label="${n} — ${SCALE_LABELS[n]}">${"🦡".repeat(n)}</button>`).join("");
  scaleLabel.textContent = SCALE_LABELS[3];
  scaleWrap.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", scaleWrap).forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-checked", "false"); });
    b.classList.add("active"); b.setAttribute("aria-checked", "true"); rating = Number(b.dataset.v);
    scaleLabel.textContent = SCALE_LABELS[rating];
  });

  const whatEl = $("#postWhat");
  const counter = $("#whatCounter");
  whatEl.addEventListener("input", () => (counter.textContent = `${whatEl.value.length}/500`));

  const nameEl = $("#postName");
  nameEl.value = store.get("gerit_player_name", "") || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim() || "גירית אנונימית";
    const where = $("#postWhere").value.trim();
    const kind = form.querySelector('input[name="postKind"]:checked')?.value || "";
    const what = whatEl.value.trim();
    if (what.length < 10) { toast("ספרו קצת יותר — לפחות 10 תווים"); return whatEl.focus(); }
    const last = store.get("gerit_last_post", 0);
    if (Date.now() - last < POST_COOLDOWN_MS) { toast("רגע, גירית — אפשר לפרסם סיפור פעם בדקה"); return; }

    const fullWhere = [kind, where].filter(Boolean).join(" · ").slice(0, 60);
    const post = { name: name.slice(0, 40), where: fullWhere, what: what.slice(0, 500), mood, rating };
    const submit = $("button[type=submit]", form);
    submit.disabled = true;
    try {
      if (usingDB) await window.GeritDB.addPost(post);
      else {
        const posts = store.get("gerit_posts", []);
        posts.unshift({ ...post, id: "local-" + Date.now(), date: Date.now() });
        store.set("gerit_posts", posts.slice(0, 100));
        renderPosts(store.get("gerit_posts", []));
      }
      store.set("gerit_last_post", Date.now());
      form.reset(); counter.textContent = "0/500"; nameEl.value = name === "גירית אנונימית" ? "" : name;
      toast("הסיפור פורסם על הקיר 🦡");
      wall.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.warn("[gerit] post failed:", err.code || err.message);
      toast("הפרסום לא הצליח. בדקו את החיבור ונסו שוב.");
    } finally {
      submit.disabled = false;
    }
  });

  wall.innerHTML = `<div class="empty-state">טוען סיפורים…</div>`;
  whenDB().then((db) => {
    if (!db) { $("#wallMode").hidden = false; return renderPosts(store.get("gerit_posts", [])); }
    db.subscribePosts(
      (posts) => { usingDB = true; $("#wallMode").hidden = true; renderPosts(posts); },
      (err) => {
        console.warn("[gerit] posts:", err.code || err.message);
        usingDB = false; $("#wallMode").hidden = false; renderPosts(store.get("gerit_posts", []));
      },
    );
    usingDB = true;
  });

  function renderPosts(posts) {
    if (!posts.length) {
      wall.innerHTML = `<div class="empty-state">עדיין אין כאן סיפורים. היו הראשונים לספר על מפגש עם גירית 🦡</div>`;
      return;
    }
    wall.innerHTML = posts.map((p) => {
      const r = Math.max(1, Math.min(5, Number(p.rating) || 1));
      const shareText = `"${(p.what || "").slice(0, 120)}${(p.what || "").length > 120 ? "…" : ""}" — ${p.name} בקיר הסיפורים של גירית הדבש 🦡`;
      return `
      <article class="post-card">
        <header class="post-head">
          <span class="post-mood" aria-hidden="true">${escapeHtml(p.mood)}</span>
          <div>
            <div class="post-name">${escapeHtml(p.name)}</div>
            ${p.where ? `<div class="post-where">📍 ${escapeHtml(p.where)}</div>` : ""}
          </div>
          <time class="post-date">${timeAgo(p.date || Date.now())}</time>
        </header>
        <p class="post-text">${escapeHtml(p.what)}</p>
        <footer class="post-foot">
          <span class="post-rating" title="${SCALE_LABELS[r]}">${"🦡".repeat(r)}<span class="sr">${r} מתוך 5</span> <small>${SCALE_LABELS[r]}</small></span>
          <button class="link-btn" data-wa="${escapeHtml(shareText)}">שתף בוואטסאפ</button>
        </footer>
      </article>`;
    }).join("");
  }

  wall.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wa]");
    if (b) shareWhatsApp(b.dataset.wa);
  });
}

/* ===================== PWA ===================== */
function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
