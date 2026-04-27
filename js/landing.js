// Tarih Vakfı public landing — small, framework-less.
// Responsibilities:
//   - sticky-nav scroll-aware backdrop
//   - mobile nav toggle
//   - smooth-scroll for in-page anchors (CSS handles the bulk; we just close
//     the mobile sheet on click)
//   - fetch publicProjectStats/pnb (3 stat tiles + project card progress bar)
//   - fetch publicTicker (last 8, anonymized) + render
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
      const since24h = Date.now() - 24 * 3600000;
      const tickerSnap = await fs.getDocs(fs.query(
        fs.collection(db, "publicTicker"),
        fs.orderBy("createdAt", "desc"),
        fs.limit(500)
      ));
      const tokens30d = new Set();
      let count24h = 0;
      tickerSnap.docs.forEach((d) => {
        const r = d.data() || {};
        const t = tsMillis(r.createdAt);
        if (!t) return;
        if (t >= since30d && r.volunteerToken) tokens30d.add(r.volunteerToken);
        if (t >= since24h) count24h += 1;
      });

      setStat("month", {
        num: formatNum(tokens30d.size),
        foot: "gönüllü, son 30 günde rapor verdi"
      });
      setStat("day", {
        num: formatNum(count24h),
        foot: count24h === 1 ? "yeni rapor" : "yeni rapor"
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
        fs.limit(8)
      ));
      const items = snap.docs.map((d) => d.data() || {})
        .filter((r) => r.createdAt);
      if (!items.length) { hideTicker(); return; }
      const list = document.getElementById("lpTicker");
      if (!list) return;
      list.innerHTML = items.map(renderTickerRow).join("");
      const section = list.closest(".lp-section");
      if (section) section.removeAttribute("hidden");
    } catch (err) {
      hideTicker();
    }
  }
  function renderTickerRow(r) {
    const when = tsMillis(r.createdAt);
    const ago = relativeTime(when);
    const effort = effortDescription(r.effort);
    const cat = String(r.materialCategory || "belgeler");
    const project = (r.projectId || "pnb") === "pnb" ? "PNB arşivinde" : "arşivde";
    return `<li>
      <span class="lp-ticker-when">${esc(ago)}</span>
      <span class="lp-ticker-rest">— ${esc(effort)}, ${esc(project)}, ${esc(cat)}</span>
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
  function relativeTime(when) {
    if (!when) return "—";
    const diffMs = Date.now() - when;
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return "az önce";
    if (m < 60) return `${m} dakika önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} saat önce`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Dün";
    if (d < 7) return `${d} gün önce`;
    if (d < 30) return `${Math.floor(d / 7)} hafta önce`;
    return `${Math.floor(d / 30)} ay önce`;
  }
  function effortDescription(eff) {
    if (eff === "small") return "kısa bir çalışma";
    if (eff === "large") return "uzunca bir çalışma";
    return "orta uzunlukta bir çalışma";
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
