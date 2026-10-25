/* =====================================================================
   עמוד המשחקים: טריוויה, לוח מובילים, "מנהרות" ו"בריחה בסוואנה"
   ===================================================================== */

/* ===================== טריוויה ===================== */
const ROUND_SIZE = 7, WIN_POINTS = 50, LOSE_POINTS = 10;
const Trivia = {
  round: [], index: 0,
  score: store.get("gerit_trivia_score", 0),
  streak: store.get("gerit_trivia_rounds_won", 0),
};

function pickRound() {
  let seen = new Set(store.get("gerit_trivia_seen", []));
  let pool = TRIVIA.map((_, i) => i).filter((i) => !seen.has(i));
  if (pool.length < ROUND_SIZE) { seen = new Set(); pool = TRIVIA.map((_, i) => i); }
  const chosen = shuffle(pool).slice(0, ROUND_SIZE);
  chosen.forEach((i) => seen.add(i));
  store.set("gerit_trivia_seen", [...seen]);
  return chosen.map((i) => {
    const t = TRIVIA[i];
    return { q: t.q, e: t.e, options: shuffle(t.a.map((text, k) => ({ text, correct: k === 0 }))) };
  });
}

function initTrivia() {
  $("#triviaBank").textContent = TRIVIA.length;
  updateTriviaStats();
  $("#triviaArea").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "start") startRound();
    if (btn.dataset.action === "next") { Trivia.index++; renderQuestion(); }
    if (btn.dataset.action === "share-card") openScoreCard();
  });
}
function updateTriviaStats() {
  $("#triviaScore").textContent = Trivia.score;
  $("#triviaRounds").textContent = Trivia.streak;
}
function startRound() { Trivia.round = pickRound(); Trivia.index = 0; renderQuestion(); }
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
}
function answer(i) {
  const area = $("#triviaArea");
  const q = Trivia.round[Trivia.index];
  const buttons = $$(".trivia-opt", area);
  buttons.forEach((b) => (b.disabled = true));
  buttons[q.options.findIndex((o) => o.correct)].classList.add("correct");
  const fb = $(".trivia-feedback", area);
  if (q.options[i].correct) {
    if (Trivia.index === ROUND_SIZE - 1) return winRound();
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
  Trivia.score += WIN_POINTS; Trivia.streak += 1;
  store.set("gerit_trivia_score", Trivia.score);
  store.set("gerit_trivia_rounds_won", Trivia.streak);
  updateTriviaStats();
  $("#triviaProgress").innerHTML = Array.from({ length: ROUND_SIZE }, () => `<span class="done"></span>`).join("");
  syncScore(WIN_POINTS);
  confetti();
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
  if (!store.get("gerit_player_name", null)) setTimeout(openNameModal, 900);
}

/* ===================== לוח מובילים ===================== */
async function syncScore(delta) {
  if (!store.get("gerit_player_name", null) || !delta) return;
  const db = await whenDB();
  if (!db) return;
  try { await db.addScore(getPlayerId(), delta); }
  catch (err) { console.warn("[gerit] score sync skipped:", err.code || err.message); }
}
function openNameModal() {
  $("#nameInput").value = store.get("gerit_player_name", "") || "";
  $("#nameModal").hidden = false;
  setTimeout(() => $("#nameInput").focus(), 50);
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
      toast("לא הצלחנו להירשם ללוח כרגע. נסו שוב בעוד רגע.");
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
    db.subscribeLeaderboard((rows) => renderLeaderboard(rows),
      (err) => { console.warn("[gerit] leaderboard:", err.code || err.message); renderLeaderboard([], "offline"); });
  });
}
function renderLeaderboard(rows, state) {
  const wrap = $("#leaderboardBody");
  const me = getPlayerId();
  if (rows === null) { wrap.innerHTML = `<div class="empty-state">טוען…</div>`; return; }
  if (state === "offline") { wrap.innerHTML = `<div class="empty-state">הלוח המשותף לא זמין כרגע. הניקוד שלך (${Trivia.score}) נשמר במכשיר.</div>`; return; }
  if (!rows.length) { wrap.innerHTML = `<div class="empty-state">הלוח עדיין ריק. נצחו סבב שלם ותהיו הגירית הראשונה כאן 🦡</div>`; return; }
  const medals = ["🥇", "🥈", "🥉"];
  wrap.innerHTML = rows.map((r, i) => `
    <div class="leaderboard-row${r.id === me ? " you" : ""}" style="animation-delay:${i * 40}ms">
      <div class="leaderboard-rank">${medals[i] || i + 1}</div>
      <div class="leaderboard-name">${escapeHtml(r.name)}${r.id === me ? ' <span class="you-tag">את/ה</span>' : ""}</div>
      <div class="leaderboard-score">${Number(r.score) || 0}</div>
    </div>`).join("");
}

/* ===================== כרטיס ניקוד ===================== */
function rankLabel(score) {
  if (score >= 1000) return "אגדת הסוואנה";
  if (score >= 500) return "גירית אלפא";
  if (score >= 250) return "ציידת קוברות";
  if (score >= 100) return "פורצת כוורות";
  return "גור סקרן";
}
function loadImage(src) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
}
async function drawScoreCard() {
  const c = $("#scoreCanvas"), ctx = c.getContext("2d"), W = c.width, H = c.height;
  await document.fonts.ready;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#201e1b"); bg.addColorStop(1, "#141311");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 330, 40, W / 2, 330, 520);
  glow.addColorStop(0, "rgba(226,137,28,.3)"); glow.addColorStop(1, "rgba(226,137,28,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const img = await loadImage("assets/badger.svg");
  const bw = 620; ctx.drawImage(img, (W - bw) / 2, 150, bw, bw * 220 / 400);
  ctx.direction = "rtl"; ctx.textAlign = "center";
  ctx.fillStyle = "#E2891C"; ctx.font = "56px 'Suez One', serif"; ctx.fillText(rankLabel(Trivia.score), W / 2, 590);
  ctx.fillStyle = "#E7DDC3"; ctx.font = "800 190px 'Heebo', sans-serif"; ctx.fillText(String(Trivia.score), W / 2, 790);
  ctx.font = "500 44px 'Heebo', sans-serif"; ctx.fillStyle = "#C7C3B8";
  ctx.fillText(`נקודות בטריוויית גירית הדבש · ${Trivia.streak} סבבים מושלמים`, W / 2, 860);
  ctx.fillStyle = "#E2891C"; ctx.beginPath(); ctx.moveTo(0, 940);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 940 + ((x / 40) % 2 ? -14 : 14));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#171614"; ctx.font = "44px 'Suez One', serif"; ctx.fillText("אתם חושבים שתעברו אותי? 🦡", W / 2, 1030);
}
async function openScoreCard() {
  $("#cardModal").hidden = false;
  try { await drawScoreCard(); } catch (err) { console.warn("[gerit] card:", err); }
}
const canvasBlob = () => new Promise((resolve) => $("#scoreCanvas").toBlob(resolve, "image/png"));
function initScoreCard() {
  $("#cardClose").addEventListener("click", () => ($("#cardModal").hidden = true));
  $("#cardModal").addEventListener("click", (e) => { if (e.target.id === "cardModal") e.target.hidden = true; });
  $("#cardDownload").addEventListener("click", async () => {
    const url = URL.createObjectURL(await canvasBlob());
    const a = Object.assign(document.createElement("a"), { href: url, download: "gerit-score.png" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("התמונה נשמרה — העלו אותה לסטורי ותייגו חברים");
  });
  $("#cardShare").addEventListener("click", async () => {
    const file = new File([await canvasBlob()], "gerit-score.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `השגתי ${Trivia.score} נקודות בטריוויית גירית הדבש 🦡 ${SITE_URL}games.html` }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    $("#cardDownload").click();
  });
  $("#cardWa").addEventListener("click", () =>
    shareWhatsApp(`השגתי ${Trivia.score} נקודות בטריוויית גירית הדבש 🦡 נראה אתכם עוברים אותי:`, SITE_URL + "games.html"));
}

/* ===================== עזר למשחקי קנבס ===================== */
function setupCanvas(canvas, ratio) {
  const ctx = canvas.getContext("2d");
  const size = { W: 0, H: 0 };
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    size.W = canvas.clientWidth; size.H = Math.round(size.W * ratio);
    canvas.style.height = size.H + "px";
    canvas.width = size.W * dpr; canvas.height = size.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  return { ctx, size, resize };
}
/** מצייר אימוג'י באטימות מלאה (צבע מילוי שקוף גורם לאימוג'י להיראות "מעורפלים"). */
function emoji(ctx, ch, x, y, px, flip = false) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

/* ===================== משחק: מנהרות ===================== */
function initDigGame() {
  const canvas = $("#digCanvas");
  const COLS = 11, ROWS = 13;
  const { ctx, size, resize } = setupCanvas(canvas, ROWS / COLS);
  const overlay = $("#digOverlay");
  const hud = { score: $("#digScore"), level: $("#digLevel"), lives: $("#digLives"), best: $("#digBest") };
  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const DIRT = 0, TUNNEL = 1, ROCK = 2;

  let grid, speckles, items, snakes, badger, state = "idle", level, score, lives, power, invuln, last, dir = null, held = false, sticky = false, combo, raf;
  hud.best.textContent = store.get("gerit_dig_best", 0);

  const cell = () => size.W / COLS;
  const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const walkable = (r, c) => inside(r, c) && grid[r][c] === TUNNEL;

  function makeEntity(r, c, dur) { return { r, c, pr: r, pc: c, t: 1, dur, face: -1 }; }

  function buildLevel() {
    grid = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, () => (r === 0 ? TUNNEL : DIRT)));
    speckles = Array.from({ length: ROWS * COLS }, () => Array.from({ length: 5 }, () => [Math.random(), Math.random(), Math.random()]));
    // מנהרות פתוחות שבהן הנחשים מתחילים
    const spawns = [];
    const tunnelRows = shuffle([4, 6, 8, 10, 11]).slice(0, 2 + Math.min(2, Math.floor(level / 2)));
    tunnelRows.forEach((r) => {
      const start = 1 + Math.floor(Math.random() * (COLS - 6));
      for (let c = start; c < start + 5; c++) grid[r][c] = TUNNEL;
      spawns.push([r, start + 2]);
    });
    // סלעים
    for (let k = 0; k < 3 + level; k++) {
      const r = 2 + Math.floor(Math.random() * (ROWS - 2)), c = Math.floor(Math.random() * COLS);
      if (grid[r][c] === DIRT) grid[r][c] = ROCK;
    }
    // פריטים באדמה
    items = [];
    const free = [];
    for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === DIRT) free.push([r, c]);
    const spots = shuffle(free);
    const grubs = 9 + level * 2;
    spots.slice(0, grubs).forEach(([r, c]) => items.push({ r, c, kind: "grub" }));
    spots.slice(grubs, grubs + 2).forEach(([r, c]) => items.push({ r, c, kind: "scorpion" }));
    const nSnakes = Math.min(5, 2 + Math.floor(level / 2));
    snakes = Array.from({ length: nSnakes }, (_, i) => {
      const [r, c] = spawns[i % spawns.length];
      const s = makeEntity(r, c, Math.max(170, 330 - level * 20));
      s.home = [r, c]; s.dead = 0; s.wait = 0;
      return s;
    });
    badger = makeEntity(0, Math.floor(COLS / 2), 120);
    power = 0; invuln = 1500; combo = 1;
  }

  function newGame() { level = 1; score = 0; lives = 3; buildLevel(); state = "play"; overlay.hidden = true; updateHud(); last = performance.now(); loop(last); }
  function updateHud() {
    hud.score.textContent = score; hud.level.textContent = level; hud.lives.textContent = "❤️".repeat(Math.max(0, lives)) || "—";
  }

  // BFS מהגירית — מרחק לכל משבצת פתוחה
  function distanceMap() {
    const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(Infinity));
    const q = [[badger.r, badger.c]];
    dist[badger.r][badger.c] = 0;
    while (q.length) {
      const [r, c] = q.shift();
      for (const [dr, dc] of Object.values(DIRS)) {
        const nr = r + dr, nc = c + dc;
        if (walkable(nr, nc) && dist[nr][nc] === Infinity) { dist[nr][nc] = dist[r][c] + 1; q.push([nr, nc]); }
      }
    }
    return dist;
  }

  function tryMoveBadger() {
    if (!dir) return;
    const [dr, dc] = DIRS[dir];
    const nr = badger.r + dr, nc = badger.c + dc;
    if (!inside(nr, nc) || grid[nr][nc] === ROCK) { if (sticky) dir = null; return; }
    const digging = grid[nr][nc] === DIRT;
    grid[nr][nc] = TUNNEL;
    if (dc) badger.face = dc;
    Object.assign(badger, { pr: badger.r, pc: badger.c, r: nr, c: nc, t: 0, dur: digging ? 200 : 120 });
    // איסוף
    const idx = items.findIndex((it) => it.r === nr && it.c === nc);
    if (idx >= 0) {
      const it = items.splice(idx, 1)[0];
      if (it.kind === "grub") { score += 10; pop(nr, nc, "+10"); }
      if (it.kind === "scorpion") { score += 25; power = 6500; combo = 1; pop(nr, nc, "חסינות!"); }
      if (it.kind === "honey") { score += 100; pop(nr, nc, "+100"); }
      updateHud();
      if (it.kind === "grub" && items.filter((x) => x.kind === "grub").length === Math.floor((9 + level * 2) / 2)) spawnHoney();
      if (!items.some((x) => x.kind === "grub")) levelClear();
    }
    if (!held && !sticky) dir = null;
  }

  function spawnHoney() {
    const free = [];
    for (let r = 2; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      if (grid[r][c] === DIRT && !items.some((it) => it.r === r && it.c === c)) free.push([r, c]);
    if (!free.length) return;
    const [r, c] = free[Math.floor(Math.random() * free.length)];
    items.push({ r, c, kind: "honey" });
    toast("🍯 כוורת הופיעה באדמה! 100 נקודות");
  }

  function moveSnake(s, dist) {
    const reverse = [s.pr - s.r, s.pc - s.c];
    let options = Object.values(DIRS).filter(([dr, dc]) => walkable(s.r + dr, s.c + dc));
    if (options.length > 1) options = options.filter(([dr, dc]) => !(dr === reverse[0] && dc === reverse[1]));
    if (!options.length) return;
    let pick;
    const d = ([dr, dc]) => dist[s.r + dr][s.c + dc];
    const chase = Math.min(0.92, 0.62 + level * 0.05);
    if (power > 0) pick = options.reduce((a, b) => (d(b) > d(a) ? b : a));
    else if (Number.isFinite(d(options[0])) && Math.random() < chase) pick = options.reduce((a, b) => (d(b) < d(a) ? b : a));
    else pick = options[Math.floor(Math.random() * options.length)];
    if (pick[1]) s.face = pick[1];
    Object.assign(s, { pr: s.r, pc: s.c, r: s.r + pick[0], c: s.c + pick[1], t: 0, dur: power > 0 ? s.dur : Math.max(170, 330 - level * 20) });
  }

  function collide(s) {
    const same = s.r === badger.r && s.c === badger.c;
    const swapped = s.r === badger.pr && s.c === badger.pc && s.pr === badger.r && s.pc === badger.c && (s.t < 1 || badger.t < 1);
    return same || swapped;
  }

  function handleCollisions() {
    snakes.forEach((s) => {
      if (s.dead > 0 || !collide(s)) return;
      if (power > 0) {
        const pts = 50 * combo; score += pts; combo++;
        pop(s.r, s.c, `+${pts}`);
        s.dead = 4000; updateHud();
      } else if (invuln <= 0) {
        lives--; updateHud();
        if (navigator.vibrate) navigator.vibrate(120);
        if (lives <= 0) return gameOver();
        badger = makeEntity(0, Math.floor(COLS / 2), 120);
        snakes.forEach((x) => Object.assign(x, { r: x.home[0], c: x.home[1], pr: x.home[0], pc: x.home[1], t: 1 }));
        invuln = 1800; dir = null;
        toast("אאוץ׳! הנחש תפס אותך");
      }
    });
  }

  let pops = [];
  function pop(r, c, text) { pops.push({ r, c, text, t: 0 }); }

  function levelClear() {
    state = "between";
    const bonus = 100 + level * 20;
    score += bonus; updateHud();
    confetti(50);
    overlay.innerHTML = `<h4>שלב ${level} הושלם!</h4><p>בונוס ${bonus} נקודות. הנחשים בשלב הבא מהירים יותר.</p><button class="btn btn-primary btn-small" id="digNext">לשלב ${level + 1}</button>`;
    overlay.hidden = false;
    $("#digNext").addEventListener("click", () => { level++; buildLevel(); state = "play"; overlay.hidden = true; last = performance.now(); loop(last); });
  }

  function gameOver() {
    state = "over";
    const best = store.get("gerit_dig_best", 0);
    const record = score > best;
    if (record) { store.set("gerit_dig_best", score); hud.best.textContent = score; confetti(); }
    overlay.innerHTML = `<h4>${record ? "שיא חדש! 🏆" : "הנחשים ניצחו הפעם"}</h4><p>הגעת לשלב ${level} עם <b>${score}</b> נקודות.</p>
      <div class="modal-actions"><button class="btn btn-primary btn-small" id="digAgain">שחק שוב</button>
      <button class="btn share-whatsapp btn-small" id="digShare">שתף</button></div>`;
    overlay.hidden = false;
    $("#digAgain").addEventListener("click", newGame);
    $("#digShare").addEventListener("click", () => shareWhatsApp(`חפרתי ${score} נקודות במשחק המנהרות של גירית הדבש 🦡🐍 נראה אתכם:`, SITE_URL + "games.html"));
  }

  let badgerClock = 0, snakeClock = 0;
  function loop(now) {
    if (state !== "play") return;
    const dt = Math.min(50, now - last); last = now;
    if (power > 0) power -= dt;
    if (invuln > 0) invuln -= dt;
    badger.t = Math.min(1, badger.t + dt / badger.dur);
    badgerClock += dt;
    if (badger.t >= 1 && badgerClock >= 20) { badgerClock = 0; tryMoveBadger(); }
    let dist = null;
    snakes.forEach((s) => {
      if (s.dead > 0) {
        s.dead -= dt;
        if (s.dead <= 0) Object.assign(s, { r: s.home[0], c: s.home[1], pr: s.home[0], pc: s.home[1], t: 1 });
        return;
      }
      s.t = Math.min(1, s.t + dt / s.dur);
      if (s.t >= 1) { dist = dist || distanceMap(); moveSnake(s, dist); }
    });
    handleCollisions();
    pops.forEach((p) => (p.t += dt)); pops = pops.filter((p) => p.t < 900);
    draw(now);
    if (state === "play") raf = requestAnimationFrame(loop);
  }

  function lerp(e) {
    const k = e.t < 1 ? e.t : 1;
    return [e.pr + (e.r - e.pr) * k, e.pc + (e.c - e.pc) * k];
  }

  function draw(now = performance.now()) {
    const s = cell(), W = size.W, H = size.H;
    ctx.clearRect(0, 0, W, H);
    // שמיים ודשא
    const sky = ctx.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, "#2c4a63"); sky.addColorStop(1, "#c98a4b");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, s);
    // אדמה
    for (let r = 1; r < ROWS; r++) {
      const depth = r / ROWS;
      for (let c = 0; c < COLS; c++) {
        const x = c * s, y = r * s;
        if (grid[r][c] === TUNNEL) continue;
        ctx.fillStyle = `rgb(${120 - depth * 60},${82 - depth * 40},${46 - depth * 22})`;
        ctx.fillRect(x, y, s + 0.5, s + 0.5);
        ctx.fillStyle = `rgba(0,0,0,${0.12 + depth * 0.1})`;
        speckles[r * COLS + c].forEach(([a, b, z]) => { ctx.beginPath(); ctx.arc(x + a * s, y + b * s, 1 + z * 1.6, 0, 6.28); ctx.fill(); });
        if (grid[r][c] === ROCK) {
          ctx.fillStyle = "#8a857a"; ctx.beginPath(); ctx.ellipse(x + s / 2, y + s / 2, s * 0.42, s * 0.34, 0.3, 0, 6.28); ctx.fill();
          ctx.fillStyle = "#a9a497"; ctx.beginPath(); ctx.ellipse(x + s * 0.42, y + s * 0.4, s * 0.18, s * 0.12, 0.3, 0, 6.28); ctx.fill();
        }
      }
    }
    // מנהרות
    ctx.fillStyle = "#1a120b";
    for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== TUNNEL) continue;
      const x = c * s, y = r * s, p = s * 0.12;
      roundRect(x + p, y + p, s - 2 * p, s - 2 * p, s * 0.3);
      if (c + 1 < COLS && grid[r][c + 1] === TUNNEL) ctx.fillRect(x + s / 2, y + p, s, s - 2 * p);
      if (r + 1 < ROWS && grid[r + 1][c] === TUNNEL) ctx.fillRect(x + p, y + s / 2, s - 2 * p, s);
      if (r === 1) ctx.fillRect(x + p, y - s / 2, s - 2 * p, s);
    }
    // קו דשא
    ctx.fillStyle = "#5b7a2e"; ctx.fillRect(0, s - 4, W, 4);
    // פריטים
    items.forEach((it) => {
      const bob = Math.sin(now / 300 + it.r + it.c) * s * 0.04;
      emoji(ctx, it.kind === "grub" ? "🐛" : it.kind === "scorpion" ? "🦂" : "🍯", it.c * s + s / 2, it.r * s + s / 2 + bob, s * 0.62);
    });
    // נחשים
    snakes.forEach((sn) => {
      if (sn.dead > 0) return;
      const [rr, cc] = lerp(sn);
      if (power > 0) { ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 90); }
      emoji(ctx, "🐍", cc * s + s / 2, rr * s + s / 2, s * 0.78, sn.face > 0);
      if (power > 0) ctx.restore();
    });
    // גירית
    const [br, bc] = lerp(badger);
    const bx = bc * s + s / 2, by = br * s + s / 2;
    if (power > 0) {
      const g = ctx.createRadialGradient(bx, by, 2, bx, by, s * 0.9);
      g.addColorStop(0, "rgba(242,177,52,.85)"); g.addColorStop(1, "rgba(242,177,52,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, s * 0.9, 0, 6.28); ctx.fill();
    }
    if (!(invuln > 0 && Math.floor(now / 100) % 2)) emoji(ctx, "🦡", bx, by, s * 0.86, badger.face > 0);
    // פס חסינות
    if (power > 0) {
      ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(8, 8, W - 16, 8);
      ctx.fillStyle = "#f2b134"; ctx.fillRect(8, 8, (W - 16) * Math.max(0, power / 6500), 8);
    }
    // נקודות קופצות
    pops.forEach((p) => {
      ctx.save(); ctx.globalAlpha = 1 - p.t / 900;
      ctx.fillStyle = "#fff4d6"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
      ctx.font = `800 ${Math.round(s * 0.42)}px Heebo, sans-serif`; ctx.textAlign = "center";
      const y = p.r * s + s / 2 - (p.t / 900) * s;
      ctx.strokeText(p.text, p.c * s + s / 2, y); ctx.fillText(p.text, p.c * s + s / 2, y);
      ctx.restore();
    });
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }

  // שליטה: מקלדת
  const keyMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    const d = keyMap[e.key] || keyMap[e.key.toLowerCase?.()];
    if (!d || state !== "play") return;
    e.preventDefault(); dir = d; held = true; sticky = false;
  });
  document.addEventListener("keyup", (e) => { if (keyMap[e.key] === dir || keyMap[e.key?.toLowerCase?.()] === dir) held = false; });
  // החלקה במגע
  let sx = 0, sy = 0;
  canvas.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
  canvas.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    sticky = true; held = false;
  });
  // כפתורי חיצים
  $$("#digPad button").forEach((b) => {
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); dir = b.dataset.dir; held = true; sticky = false; });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => { if (dir === b.dataset.dir) held = false; }));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") { state = "paused"; cancelAnimationFrame(raf); }
    else if (!document.hidden && state === "paused") { state = "play"; last = performance.now(); loop(last); }
  });
  window.addEventListener("resize", () => { resize(); if (grid) draw(); });

  $("#digStart").addEventListener("click", newGame);
  level = 1; buildLevel(); draw();
}

/* ===================== משחק: בריחה בסוואנה ===================== */
function initDodgeGame() {
  const canvas = $("#dodgeCanvas");
  const { ctx, size, resize } = setupCanvas(canvas, 0.68);
  const overlay = $("#dodgeOverlay");
  const scoreEl = $("#dodgeScore"), bestEl = $("#dodgeBest");
  let running = false, x = 0, score = 0, speed = 2.6, objects = [], keys = {}, frame = 0, raf, lives = 3, hitFlash = 0, pointerX = null;
  const grass = Array.from({ length: 40 }, () => [Math.random(), Math.random(), 4 + Math.random() * 8]);
  bestEl.textContent = store.get("gerit_dodge_best", 0);

  function spawn() {
    const r = Math.random();
    const type = r < 0.3 ? "honey" : r < 0.36 ? "heart" : "danger";
    const ch = type === "honey" ? "🍯" : type === "heart" ? "🐝" : ["🐍", "🦂", "🪨"][Math.floor(Math.random() * 3)];
    objects.push({ x: 20 + Math.random() * (size.W - 40), y: -20, type, ch, vy: speed * (0.8 + Math.random() * 0.5), spin: (Math.random() - 0.5) * 0.04 });
  }
  function drawScene() {
    const { W, H } = size;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3a2c1c"); g.addColorStop(1, "#6b4b2a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // עשב שזורם למטה ליצירת תחושת תנועה
    ctx.strokeStyle = "rgba(160,170,90,.35)"; ctx.lineWidth = 2;
    grass.forEach(([gx, gy, len]) => {
      const y = ((gy * H + frame * speed * 0.6) % (H + 20)) - 10;
      ctx.beginPath(); ctx.moveTo(gx * W, y); ctx.lineTo(gx * W + 3, y - len); ctx.stroke();
    });
    ctx.fillStyle = "rgba(226,137,28,.35)"; ctx.fillRect(0, H - 6, W, 6);
    objects.forEach((o) => emoji(ctx, o.ch, o.x, o.y, 26));
    const visible = !(hitFlash > 0 && (hitFlash >> 2) % 2);
    if (visible) emoji(ctx, "🦡", x || W / 2, H - 30, 38, pointerX !== null ? pointerX > x : false);
    ctx.save(); ctx.font = "16px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillStyle = "#000";
    ctx.fillText("❤️".repeat(Math.max(0, lives)), W - 10, 8); ctx.restore();
  }
  function loop() {
    if (!running) return;
    frame++;
    if (pointerX !== null) x += Math.max(-7, Math.min(7, pointerX - x));
    if (keys.left) x -= 6;
    if (keys.right) x += 6;
    x = Math.max(18, Math.min(size.W - 18, x));
    if (frame % Math.max(14, 42 - Math.floor(speed * 4)) === 0) spawn();
    objects.forEach((o) => (o.y += o.vy));
    objects = objects.filter((o) => {
      if (o.y > size.H + 20) return false;
      if (Math.hypot(o.x - x, o.y - (size.H - 30)) < 26) {
        if (o.type === "honey") score += 10;
        else if (o.type === "heart") { lives = Math.min(3, lives + 1); score += 5; }
        else if (hitFlash <= 0) { lives--; hitFlash = 60; if (navigator.vibrate) navigator.vibrate(60); }
        return false;
      }
      return true;
    });
    if (hitFlash > 0) hitFlash--;
    score += 0.04; speed += 0.0012;
    scoreEl.textContent = Math.floor(score);
    drawScene();
    if (lives <= 0) return endGame();
    raf = requestAnimationFrame(loop);
  }
  function endGame() {
    running = false; cancelAnimationFrame(raf);
    const final = Math.floor(score), best = store.get("gerit_dodge_best", 0);
    const record = final > best;
    if (record) { store.set("gerit_dodge_best", final); bestEl.textContent = final; confetti(); }
    overlay.innerHTML = `<h4>${record ? "שיא חדש! 🏆" : "הגירית נלכדה"}</h4><p>ניקוד סופי: <b>${final}</b></p>
      <div class="modal-actions"><button class="btn btn-primary btn-small" id="dodgeRetry">שחק שוב</button>
      <button class="btn share-whatsapp btn-small" id="dodgeShare">שתף</button></div>`;
    overlay.hidden = false;
    $("#dodgeRetry").addEventListener("click", start);
    $("#dodgeShare").addEventListener("click", () => shareWhatsApp(`אספתי ${final} נקודות דבש בבריחה בסוואנה 🦡🍯 נראה אתכם:`, SITE_URL + "games.html"));
  }
  function start() {
    x = size.W / 2; score = 0; speed = 2.6; objects = []; lives = 3; hitFlash = 0; frame = 0; pointerX = null;
    overlay.hidden = true; running = true; loop();
  }
  $("#dodgeStart").addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (!running || e.target.closest("input, textarea")) return;
    if (e.key === "ArrowLeft") { keys.left = true; e.preventDefault(); }
    if (e.key === "ArrowRight") { keys.right = true; e.preventDefault(); }
  });
  document.addEventListener("keyup", (e) => { if (e.key === "ArrowLeft") keys.left = false; if (e.key === "ArrowRight") keys.right = false; });
  const toX = (e) => e.clientX - canvas.getBoundingClientRect().left;
  canvas.addEventListener("pointerdown", (e) => { pointerX = toX(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (pointerX !== null || e.pointerType === "mouse") pointerX = toX(e); });
  canvas.addEventListener("pointerup", () => (pointerX = null));
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") pointerX = null; });
  window.addEventListener("resize", () => { resize(); if (!running) drawScene(); });
  drawScene();
}

document.addEventListener("DOMContentLoaded", () => {
  initTrivia();
  initLeaderboard();
  initScoreCard();
  initDigGame();
  initDodgeGame();
});
