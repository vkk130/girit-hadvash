/* =====================================================================
   עולם גירית הדבש — קוד משותף לכל העמודים
   ===================================================================== */
const SITE_URL = "https://vkk130.github.io/girit-hadvash/";
const SITE_NAME = "עולם גירית הדבש";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* גלישה פרטית */ }
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
  if (!el) return;
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

/** מחכה ש-firebase.js ייטען, או מוותר אחרי זמן קצוב ועובד מקומית. */
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
    id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
    store.set("gerit_player_id", id);
  }
  return id;
}

/* ===================== שיתוף ===================== */
function shareWhatsApp(text, url = SITE_URL) {
  window.open("https://wa.me/?text=" + encodeURIComponent(`${text}\n${url}`), "_blank", "noopener");
}

async function shareNative(text, url = SITE_URL) {
  // לאינסטגרם אין קישור שיתוף מהדפדפן: בנייד נפתח חלון השיתוף של המכשיר, במחשב מעתיקים קישור.
  if (navigator.share) {
    try { await navigator.share({ title: SITE_NAME, text, url }); return; }
    catch (err) { if (err.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast("הקישור הועתק — הדביקו אותו בסטורי או בביו באינסטגרם");
  } catch {
    toast("העתיקו את הכתובת מהדפדפן ושתפו באינסטגרם");
  }
}

/* ===================== סיפורים — כרטיס משותף ===================== */
const SCALE_LABELS = ["", "גירית רגועה", "קצת עקשנית", "גירית מול כוורת", "גירית מול קוברה", "גירית מול שישה אריות"];

function postCardHtml(p, { compact = false } = {}) {
  const r = Math.max(1, Math.min(5, Number(p.rating) || 1));
  const what = p.what || "";
  const shareText = `"${what.slice(0, 120)}${what.length > 120 ? "…" : ""}" — ${p.name} בקיר הסיפורים של גירית הדבש 🦡`;
  return `
    <article class="post-card${compact ? " compact" : ""}">
      <header class="post-head">
        <span class="post-mood" aria-hidden="true">${escapeHtml(p.mood)}</span>
        <div>
          <div class="post-name">${escapeHtml(p.name)}</div>
          ${p.where ? `<div class="post-where">📍 ${escapeHtml(p.where)}</div>` : ""}
        </div>
        <time class="post-date">${timeAgo(p.date || Date.now())}</time>
      </header>
      <p class="post-text">${escapeHtml(what)}</p>
      <footer class="post-foot">
        <span class="post-rating" title="${SCALE_LABELS[r]}">${"🦡".repeat(r)}<span class="sr">${r} מתוך 5</span> <small>${SCALE_LABELS[r]}</small></span>
        <button class="link-btn" data-wa="${escapeHtml(shareText)}">שתף בוואטסאפ</button>
      </footer>
    </article>`;
}

document.addEventListener("click", (e) => {
  const wa = e.target.closest("[data-wa]");
  if (wa) shareWhatsApp(wa.dataset.wa, SITE_URL + "stories.html");
});

/* ===================== אפקטים ===================== */
function initReveal() {
  const els = $$(".reveal");
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((el) => io.observe(el));
}

function initTilt() {
  if (REDUCED_MOTION || window.matchMedia("(pointer: coarse)").matches) return;
  $$(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });
}

/** קונפטי של משושי דבש. */
function confetti(count = 90) {
  if (REDUCED_MOTION) return;
  let c = $("#confetti");
  if (!c) { c = document.createElement("canvas"); c.id = "confetti"; document.body.appendChild(c); }
  const ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ["#E2891C", "#f2b134", "#E7DDC3", "#7da352", "#f6a63c"];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
    r: 5 + Math.random() * 6, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const t = (Math.PI / 3) * i; ctx.lineTo(Math.cos(t) * p.r, Math.sin(t) * p.r); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    });
    if (++frame < 170) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

/* ===================== ניווט ושיתוף כללי ===================== */
function initNav() {
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("a", links).forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));
}

function initShareButtons() {
  $$("[data-share]").forEach((btn) => {
    const text = btn.dataset.text || "תראו את האתר הזה על גירית הדבש — עובדות, טריוויה ומשחקים 🦡";
    const url = btn.dataset.url ? SITE_URL + btn.dataset.url : SITE_URL;
    btn.addEventListener("click", () => (btn.dataset.share === "whatsapp" ? shareWhatsApp(text, url) : shareNative(text, url)));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initShareButtons();
  initReveal();
  initTilt();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
});
