/* =====================================================================
   קיר הסיפורים: טופס מודרך + קיר עם סינון
   ===================================================================== */
const POST_MOODS = [
  { emoji: "😱", label: "הלם" },
  { emoji: "😂", label: "מצחיק" },
  { emoji: "🥹", label: "מרגש" },
  { emoji: "😨", label: "מפחיד" },
  { emoji: "🥳", label: "חגיגי" },
  { emoji: "🤔", label: "מסקרן" },
];
const POST_KINDS = ["בטבע", "בגן חיות", "בסרטון", "עובדה שלמדתי", "בחלום"];
const POST_COOLDOWN_MS = 60 * 1000;

function initStories() {
  const form = $("#postForm");
  const wall = $("#postsWall");
  let mood = POST_MOODS[0].emoji;
  let rating = 3;
  let usingDB = false;
  let allPosts = [];
  let filter = "";

  // מצב רוח
  const moodWrap = $("#moodPicker");
  moodWrap.innerHTML = POST_MOODS.map((m, i) =>
    `<button type="button" role="radio" aria-checked="${i === 0}" class="${i === 0 ? "active" : ""}" data-v="${m.emoji}">${m.emoji}<small>${m.label}</small></button>`).join("");
  moodWrap.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", moodWrap).forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-checked", "false"); });
    b.classList.add("active"); b.setAttribute("aria-checked", "true"); mood = b.dataset.v;
  });

  // סולם הגיריות
  const scaleWrap = $("#badgerScale");
  scaleWrap.innerHTML = [1, 2, 3, 4, 5].map((n) =>
    `<button type="button" role="radio" aria-checked="${n === 3}" class="${n === 3 ? "active" : ""}" data-v="${n}" aria-label="${n} — ${SCALE_LABELS[n]}">${"🦡".repeat(n)}</button>`).join("");
  $("#scaleLabel").textContent = SCALE_LABELS[3];
  scaleWrap.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", scaleWrap).forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-checked", "false"); });
    b.classList.add("active"); b.setAttribute("aria-checked", "true"); rating = Number(b.dataset.v);
    $("#scaleLabel").textContent = SCALE_LABELS[rating];
  });

  const whatEl = $("#postWhat");
  whatEl.addEventListener("input", () => ($("#whatCounter").textContent = `${whatEl.value.length}/500`));
  const nameEl = $("#postName");
  nameEl.value = store.get("gerit_player_name", "") || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim() || "גירית אנונימית";
    const where = $("#postWhere").value.trim();
    const kind = form.querySelector('input[name="postKind"]:checked')?.value || "";
    const what = whatEl.value.trim();
    if (what.length < 10) { toast("ספרו קצת יותר — לפחות 10 תווים"); return whatEl.focus(); }
    if (Date.now() - store.get("gerit_last_post", 0) < POST_COOLDOWN_MS) { toast("רגע, גירית — אפשר לפרסם סיפור פעם בדקה"); return; }

    const post = { name: name.slice(0, 40), where: [kind, where].filter(Boolean).join(" · ").slice(0, 60), what: what.slice(0, 500), mood, rating };
    const submit = $("button[type=submit]", form);
    submit.disabled = true;
    try {
      if (usingDB) await window.GeritDB.addPost(post);
      else {
        const posts = store.get("gerit_posts", []);
        posts.unshift({ ...post, id: "local-" + Date.now(), date: Date.now() });
        store.set("gerit_posts", posts.slice(0, 100));
        allPosts = store.get("gerit_posts", []); render();
      }
      store.set("gerit_last_post", Date.now());
      form.reset(); $("#whatCounter").textContent = "0/500";
      nameEl.value = name === "גירית אנונימית" ? "" : name;
      toast("הסיפור פורסם על הקיר 🦡");
      confetti(60);
      filter = ""; syncFilterButtons();
      wall.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.warn("[gerit] post failed:", err.code || err.message);
      toast("הפרסום לא הצליח. בדקו את החיבור ונסו שוב.");
    } finally {
      submit.disabled = false;
    }
  });

  // סינון לפי סוג המפגש
  const filters = $("#wallFilters");
  filters.innerHTML = `<button class="active" data-f="">הכל</button>` + POST_KINDS.map((k) => `<button data-f="${k}">${k}</button>`).join("");
  filters.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    filter = b.dataset.f; syncFilterButtons(); render();
  });
  function syncFilterButtons() { $$("button", filters).forEach((x) => x.classList.toggle("active", x.dataset.f === filter)); }

  function render() {
    const posts = filter ? allPosts.filter((p) => (p.where || "").startsWith(filter)) : allPosts;
    $("#wallCount").textContent = allPosts.length ? `${allPosts.length} סיפורים` : "";
    if (!posts.length) {
      wall.innerHTML = `<div class="empty-state">${filter ? "אין עדיין סיפורים מהסוג הזה." : "עדיין אין כאן סיפורים. היו הראשונים לספר על מפגש עם גירית 🦡"}</div>`;
      return;
    }
    wall.innerHTML = posts.map((p) => postCardHtml(p)).join("");
  }

  wall.innerHTML = `<div class="empty-state">טוען סיפורים…</div>`;
  whenDB().then((db) => {
    if (!db) { $("#wallMode").hidden = false; allPosts = store.get("gerit_posts", []); return render(); }
    usingDB = true;
    db.subscribePosts(
      (posts) => { usingDB = true; $("#wallMode").hidden = true; allPosts = posts; render(); },
      (err) => {
        console.warn("[gerit] posts:", err.code || err.message);
        usingDB = false; $("#wallMode").hidden = false; allPosts = store.get("gerit_posts", []); render();
      },
    );
  });
}

document.addEventListener("DOMContentLoaded", initStories);
