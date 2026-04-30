// Tarih Vakfı public landing — small, framework-less.
// Responsibilities:
//   - sticky-nav scroll-aware backdrop
//   - mobile nav toggle
//   - smooth-scroll for in-page anchors (CSS handles the bulk; we just close
//     the mobile sheet on click)
//   - fetch publicProjectStats/pnb (3 stat tiles + project card progress bar)
//   - fetch publicTicker (last 8, anonymized report/sheet activity) + render
// All Firestore reads are unauthenticated; rules permit public read on those
// two collections only.
//
// Privacy guarantee: this file never reads /reports, /users, /archiveUnits, or
// any other authenticated collection. The only data it touches is the public
// denormalized surface defined in firestore.rules.

(() => {
  const PROJECT_ID = "pnb";

  // ---------- Nav ----------
  const navWrap = document.getElementById("lpNavWrap");
  if (navWrap) {
    const onScroll = () => {
      navWrap.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const navToggle = document.getElementById("lpNavToggle");
  const mobileNav = document.getElementById("lpMobileNav");
  const mobileClose = document.getElementById("lpMobileClose");
  function setMobileOpen(open) {
    if (!mobileNav || !navToggle) return;
    if (open) {
      mobileNav.removeAttribute("hidden");
      navToggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    } else {
      mobileNav.setAttribute("hidden", "");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  }
  navToggle?.addEventListener("click", () => setMobileOpen(true));
  mobileClose?.addEventListener("click", () => setMobileOpen(false));
  document.querySelectorAll("[data-mn-link]").forEach((a) => {
    a.addEventListener("click", () => setMobileOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileNav && !mobileNav.hasAttribute("hidden")) {
      setMobileOpen(false);
    }
  });

  // ---------- Firestore (optional — page is fully usable without it) ----------
  if (!window.__FIREBASE_CONFIG__) return;

  const FB = "https://www.gstatic.com/firebasejs/10.12.5";
  Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-firestore.js`)
  ])
    .then(([{ initializeApp }, fs]) => {
      const app = initializeApp(window.__FIREBASE_CONFIG__);
      const db = fs.getFirestore(app);
      hydrateStats(db, fs);
      hydrateTicker(db, fs);
    })
    .catch(() => {
      hideStats();
      hideTicker();
    });

  // ---------- Stats ----------
  async function hydrateStats(db, fs) {
    try {
      const ref = fs.doc(db, "publicProjectStats", PROJECT_ID);
      const snap = await fs.getDoc(ref);
      if (!snap.exists()) {
        // No stats doc yet — skeletons would dangle. Hide the section.
        hideStats();
        return;
      }
      const data = snap.data() || {};
      const total = Number(data.totalPages) || 0;
      const done = Number(data.donePages) || 0;
      const pct = total > 0 ? (done / total) * 100 : 0;

      // Tile 1: PNB progress
      setStat("progress", {
        num: pct.toFixed(1) + "%",
        bar: pct,
        foot: `${formatNum(done)} / ${formatNum(total)} sayfa korundu`
      });

      // Mirror the bar onto the project card.
      const projBar = document.querySelector("#lpProjectProgress .lp-progress-bar > span");
      const projText = document.querySelector("#lpProjectProgress .lp-project-progress-text");
      if (projBar) projBar.style.width = clampPct(pct) + "%";
      if (projText) {
        projText.textContent = `${pct.toFixed(1)}% tamamlandı · ${formatNum(done)} / ${formatNum(total)} sayfa`;
      }

      // Tiles 2 + 3 come from the ticker (cheap, public).
      const since30d = Date.now() - 30 * 86400000;
      const since7d = Date.now() - 7 * 86400000;
      const tickerSnap = await fs.getDocs(fs.query(
        fs.collection(db, "publicTicker"),
        fs.orderBy("createdAt", "desc"),
        fs.limit(500)
      ));
      const tokens30d = new Set();
      let count7d = 0;
      tickerSnap.docs.forEach((d) => {
        const r = d.data() || {};
        const t = tsMillis(r.createdAt);
        if (!t) return;
        if (t >= since30d && r.volunteerToken) tokens30d.add(r.volunteerToken);
        if (t >= since7d) count7d += 1;
      });

      setStat("month", {
        num: formatNum(tokens30d.size),
        foot: "gönüllü, son 30 günde katkı verdi"
      });
      setStat("day", {
        num: formatNum(count7d),
        foot: "son 7 günde katkı"
      });
    } catch (err) {
      hideStats();
    }
  }

  function setStat(key, { num, bar, foot }) {
    const tile = document.querySelector(`#lpStats .lp-stat[data-stat="${key}"]`);
    if (!tile) return;
    tile.classList.remove("lp-stat-skeleton");
    const numEl = tile.querySelector(".lp-stat-num");
    const footEl = tile.querySelector(".lp-stat-foot");
    if (numEl) numEl.textContent = num;
    if (footEl) footEl.textContent = foot;
    if (typeof bar === "number") {
      const fill = tile.querySelector(".lp-progress-bar > span");
      if (fill) fill.style.width = clampPct(bar) + "%";
    }
  }
  function hideStats() {
    const stats = document.getElementById("lpStats");
    if (!stats) return;
    const section = stats.closest(".lp-section");
    if (section) section.setAttribute("hidden", "");
  }

  // ---------- Ticker ----------
  async function hydrateTicker(db, fs) {
    try {
      const snap = await fs.getDocs(fs.query(
        fs.collection(db, "publicTicker"),
        fs.orderBy("createdAt", "desc"),
        fs.limit(40)
      ));
      const items = snap.docs.map((d) => d.data() || {})
        .filter((r) => r.createdAt);
      if (!items.length) { hideTicker(); return; }
      const list = document.getElementById("lpTicker");
      if (!list) return;
      const groups = summarizeTickerItems(items).slice(0, 6);
      if (!groups.length) { hideTicker(); return; }
      list.innerHTML = groups.map(renderTickerGroup).join("");
      const section = list.closest(".lp-section");
      if (section) section.removeAttribute("hidden");
    } catch (err) {
      hideTicker();
    }
  }

  function summarizeTickerItems(items) {
    const byDay = new Map();
    items.forEach((r) => {
      const when = tsMillis(r.createdAt);
      if (!when) return;
      const key = dayKey(when);
      if (!byDay.has(key)) {
        byDay.set(key, {
          when,
          label: dayLabel(when),
          count: 0,
          categories: new Map()
        });
      }
      const group = byDay.get(key);
      group.when = Math.max(group.when, when);
      group.count += 1;
      const category = cleanCategory(r.materialCategory);
      group.categories.set(category, (group.categories.get(category) || 0) + 1);
    });

    return Array.from(byDay.values())
      .sort((a, b) => b.when - a.when)
      .map((group) => {
        const categories = Array.from(group.categories.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
          .map(([name]) => name);
        return { ...group, categories };
      });
  }

  function renderTickerGroup(group) {
    const shownCategories = group.categories.slice(0, 4);
    const hiddenCount = Math.max(0, group.categories.length - shownCategories.length);
    const categoryText = joinTurkish(shownCategories);
    const extraText = hiddenCount ? ` + ${hiddenCount} alan` : "";
    return `<li>
      <span class="lp-ticker-when">${esc(group.label)}</span>
      <span class="lp-ticker-rest">— ${esc(formatNum(group.count))} katkı${categoryText ? ` · ${esc(categoryText)}${esc(extraText)}` : ""}</span>
    </li>`;
  }
  function hideTicker() {
    const section = document.getElementById("aktivite");
    if (section) section.setAttribute("hidden", "");
  }

  // ---------- Helpers ----------
  function tsMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    if (ts instanceof Date) return ts.getTime();
    return 0;
  }
  function clampPct(p) { return Math.max(0, Math.min(100, p)); }
  function formatNum(n) {
    return new Intl.NumberFormat("tr-TR").format(Number(n) || 0);
  }
  function dayKey(when) {
    const d = new Date(when);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  function dayLabel(when) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(when);
    d.setHours(0, 0, 0, 0);
    const days = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (days <= 0) return "Bugün";
    if (days === 1) return "Dün";
    if (days < 7) return `${days} gün önce`;
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  }
  function cleanCategory(category) {
    const value = String(category || "belgeler").trim();
    if (!value) return "belgeler";
    if (value === "genel") return "genel proje çalışması";
    return value;
  }
  function joinTurkish(items) {
    const clean = items.filter(Boolean);
    if (clean.length <= 1) return clean[0] || "";
    if (clean.length === 2) return `${clean[0]} ve ${clean[1]}`;
    return `${clean.slice(0, -1).join(", ")} ve ${clean[clean.length - 1]}`;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
