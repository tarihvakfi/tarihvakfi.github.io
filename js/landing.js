// Tarih Vakfı public landing — small, framework-less.
// Responsibilities (v2 editorial redesign, May 2026):
//   - sticky-nav scroll-aware backdrop
//   - mobile nav toggle
//   - smooth-scroll for in-page anchors (CSS handles the bulk; we just close
//     the mobile sheet on click)
//   - fetch publicProjectStats/pnb (ledger cells + project card progress)
//   - fetch publicTicker (last N) — feeds ledger people/week counts,
//     collective this-week summary, work-area stacked bar, and the activity
//     ticker at the bottom
//   - render box-by-box grid from a hardcoded state map until per-box state
//     is wired from /publicProjectStats/pnb.boxes[]
//   - mark today's column in the weekly roster (based on browser locale)
// All Firestore reads are unauthenticated; rules permit public read on those
// two collections only.
//
// Privacy guarantee: this file never reads /reports, /users, /archiveUnits, or
// any other authenticated collection. The only data it touches is the public
// denormalized surface defined in firestore.rules.

(() => {
  const PROJECT_ID = "pnb";

  // The website reads ONLY from /publicProjectStats/pnb and /publicTicker —
  // both of which are populated by apps-script/SheetSync.gs from the live
  // Google Sheet on an hourly trigger. Fields published there:
  //   totalPages, donePages           — pages aggregate from PNB Sayısallaştırma
  //   totalUnits, doneUnits           — belge count
  //   totalFiles                      — dosya count
  //   cataloguedBoxes                 — boxes with non-zero counts in the sheet
  //   updatedAt
  // PNB_TARGET_BOXES is the project ceiling (104) — not in the sheet.
  // Everything else (display copy) comes from the user.
  const PNB_TARGET_BOXES = 104;

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

  // ---------- Initial paint ----------
  // The mockup sections (wall, roster, box grid) ship with sensible static
  // content already in the HTML. We:
  //   - mark today's column in the roster immediately (no network needed)
  //   - render the box-by-box grid from a static state map
  // Firestore hydrators below will *overwrite* these with live data when the
  // collections are populated; otherwise the page still feels alive.
  markRosterToday();
  renderBoxesGridStatic();

  // ---------- Firestore (optional — page is fully usable without it) ----------
  if (!window.__FIREBASE_CONFIG__) {
    // No Firestore = use inventory fallbacks for ledger/collect so the strip
    // doesn't look empty.
    setLedgerFallback();
    setCollectiveFallback();
    return;
  }

  const FB = "https://www.gstatic.com/firebasejs/10.12.5";
  Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-firestore-lite.js`)
  ])
    .then(([{ initializeApp }, fs]) => {
      const app = initializeApp(window.__FIREBASE_CONFIG__);
      const db = fs.getFirestore(app);
      hydrate(db, fs);
    })
    .catch(() => {
      setLedgerFallback();
      setCollectiveFallback();
      hideTicker();
    });

  // ---------- Combined hydrate ----------
  // Fetches stats + ticker once and routes the data to all the sections that
  // need it. Doing both in one go avoids the two-roundtrip cost the v1 version
  // paid.
  async function hydrate(db, fs) {
    let stats = null;
    let tickerItems = [];
    try {
      const ref = fs.doc(db, "publicProjectStats", PROJECT_ID);
      const snap = await fs.getDoc(ref);
      stats = snap.exists() ? (snap.data() || null) : null;
    } catch (err) { stats = null; }
    try {
      const tickerSnap = await fs.getDocs(fs.query(
        fs.collection(db, "publicTicker"),
        fs.orderBy("createdAt", "desc"),
        fs.limit(500)
      ));
      tickerItems = tickerSnap.docs.map((d) => d.data() || {}).filter((r) => r.createdAt);
    } catch (err) { tickerItems = []; }

    hydrateLedger(stats, tickerItems);
    hydrateCollective(tickerItems);
    hydrateProjectCard(stats, tickerItems);
    hydrateAreaBar(tickerItems);
    hydrateBoxesGrid(stats);
    hydrateTickerSection(tickerItems);

    // Wall + roster live in separate public collections (don't exist yet).
    // Attempt to read them; on miss, they simply stay hidden.
    hydrateWall(db, fs).catch(() => {});
    hydrateRoster(db, fs).catch(() => {});
  }

  // ---------- Ledger strip (4 cells in hero) ----------
  // All numbers come from Firestore /publicProjectStats/pnb, which is fed
  // by apps-script/SheetSync.gs hourly from the live Sheet. We render "—"
  // anywhere the sync hasn't published yet (rather than hardcoded fallbacks)
  // so stale UI never tells a different story than the sheet.
  function hydrateLedger(stats, tickerItems) {
    const total = stats && Number(stats.totalPages) || 0;
    const done = stats && Number(stats.donePages) || 0;
    const pct = total > 0 ? (done / total) * 100 : 0;

    // Cell: progress
    setLedger("progress", {
      val: pct > 0 ? `%${formatPct(pct)}` : "—",
      foot: total > 0
        ? `${formatNum(done)} / ${formatNum(total)} sayfa`
        : "sayfa hedefi yükleniyor",
    });

    // Update hero sub-paragraph progress hint, if present.
    const progSpan = document.getElementById("lpHeroProgress");
    if (progSpan && pct > 0) {
      progSpan.textContent = `Şu an %${formatPct(pct)}'ündeyiz.`;
    }

    // Cell: açılmış kutu — straight from sheet's PNB Sayısallaştırma summary.
    const boxTargetEl = document.getElementById("lpLedgerBoxTarget");
    if (boxTargetEl) boxTargetEl.textContent = String(PNB_TARGET_BOXES);
    const catalogued = stats && Number(stats.cataloguedBoxes) || 0;
    if (catalogued > 0) {
      const remaining = Math.max(0, PNB_TARGET_BOXES - catalogued);
      setLedger("boxes", {
        val: String(catalogued),
        foot: remaining > 0
          ? `${remaining} kutu sırada bekliyor`
          : "tüm kutular katalogda",
      });
    } else {
      setLedger("boxes", { val: "—", foot: "kutu sayısı yükleniyor" });
    }

    // Cells: people 30d + week 7d — from ticker.
    const now = Date.now();
    const since30d = now - 30 * 86400000;
    const since7d = now - 7 * 86400000;
    const tokens30d = new Set();
    let count7d = 0;
    tickerItems.forEach((r) => {
      const t = tsMillis(r.createdAt);
      if (!t) return;
      if (t >= since30d && r.volunteerToken) tokens30d.add(r.volunteerToken);
      if (t >= since7d) count7d += 1;
    });
    setLedger("people", {
      val: tokens30d.size > 0 ? String(tokens30d.size) : "—",
      foot: tokens30d.size > 0 ? "son 30 gün içinde katkı" : "henüz veri yok",
    });
    setLedger("week", {
      val: count7d > 0 ? String(count7d) : "—",
      foot: count7d > 0 ? "rapor / hareket" : "henüz veri yok",
    });
  }

  function setLedger(key, { val, foot }) {
    const cell = document.querySelector(`#lpLedger .lp-ledger-cell[data-ledger="${key}"]`);
    if (!cell) return;
    const valEl = cell.querySelector(".lp-ledger-val");
    const footEl = cell.querySelector(".lp-ledger-foot");
    if (valEl) valEl.textContent = val;
    if (footEl) footEl.textContent = foot;
  }
  function setLedgerFallback() {
    setLedger("progress", { val: "—", foot: "sayfa hedefi yükleniyor" });
    setLedger("boxes",    { val: "—", foot: "kutu sayısı yükleniyor" });
    setLedger("people",   { val: "—", foot: "veri yükleniyor" });
    setLedger("week",     { val: "—", foot: "veri yükleniyor" });
  }

  // ---------- Collective "Bu hafta birlikte" ----------
  function hydrateCollective(tickerItems) {
    const since7d = Date.now() - 7 * 86400000;
    const week = tickerItems.filter((r) => tsMillis(r.createdAt) >= since7d);
    if (!week.length) {
      setCollectiveFallback();
      return;
    }

    // distinct days
    const days = new Set();
    const tokens = new Set();
    const areas = new Map();
    week.forEach((r) => {
      const t = tsMillis(r.createdAt);
      if (!t) return;
      days.add(dayKey(t));
      if (r.volunteerToken) tokens.add(r.volunteerToken);
      const cat = cleanCategory(r.materialCategory);
      areas.set(cat, (areas.get(cat) || 0) + 1);
    });

    setCollect("days", { val: String(days.size), foot: "arşive girildi" });
    setCollect("people", { val: String(tokens.size), foot: "paralel çalıştı" });
    setCollect("contribs", { val: String(week.length), foot: "rapor yazıldı" });
    setCollect("areas", { val: String(areas.size), foot: "alanda emek" });

    // Title + narrative — keep it warm, no individual names.
    const titleEl = document.getElementById("lpCollectTitle");
    if (titleEl) {
      titleEl.textContent = `Bu hafta birlikte ${week.length} kayıt düştü, ${areas.size} farklı alanda çalıştık.`;
    }
    const narrEl = document.getElementById("lpCollectNarr");
    if (narrEl) {
      const top = Array.from(areas.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);
      const topText = joinTurkish(top);
      narrEl.innerHTML = topText
        ? `En çok zaman <b>${esc(topText)}</b> alanlarına ayrıldı. ${tokens.size} kişi, ${days.size} farklı günde arşive geldi — kimsenin tek başına yapamayacağı kadar.`
        : `Bu hafta arşive ${tokens.size} kişi, ${days.size} farklı günde geldi.`;
    }
    const whenEl = document.getElementById("lpCollectWhen");
    if (whenEl) whenEl.textContent = `son 7 gün`;
  }
  function setCollect(key, { val, foot }) {
    const cell = document.querySelector(`#lpCollect .lp-collect-cell[data-collect="${key}"]`);
    if (!cell) return;
    const numEl = cell.querySelector(".lp-collect-num");
    const footEl = cell.querySelector(".lp-collect-foot");
    if (numEl) numEl.textContent = val;
    if (footEl) footEl.textContent = foot;
  }
  function setCollectiveFallback() {
    setCollect("days", { val: "—", foot: "veri bekleniyor" });
    setCollect("people", { val: "—", foot: "veri bekleniyor" });
    setCollect("contribs", { val: "—", foot: "veri bekleniyor" });
    setCollect("areas", { val: "—", foot: "veri bekleniyor" });
    const narrEl = document.getElementById("lpCollectNarr");
    if (narrEl) narrEl.textContent = "Bu hafta henüz rapor yazılmadı — gönüllüler yakında.";
  }

  // ---------- Project card progress (editorial milestone version) ----------
  // Hydrates the bar + four facts (kutu / dosya / belge / bu ay) from live
  // /publicProjectStats fields. No inventory fallbacks — show "—" until sync.
  function hydrateProjectCard(stats, tickerItems) {
    const total = stats && Number(stats.totalPages) || 0;
    const done = stats && Number(stats.donePages) || 0;
    const totalUnits = stats && Number(stats.totalUnits) || 0;
    const totalFiles = stats && Number(stats.totalFiles) || 0;
    const catalogued = stats && Number(stats.cataloguedBoxes) || 0;
    const pct = total > 0 ? (done / total) * 100 : 0;

    const bar = document.getElementById("lpPpBar");
    if (bar) bar.style.width = clampPct(pct) + "%";

    const doneEl = document.getElementById("lpPpDone");
    if (doneEl) doneEl.textContent = pct > 0 ? `%${formatPct(pct)} tamamlandı` : "Henüz başlangıçta";

    const targetEl = document.getElementById("lpPpTarget");
    if (targetEl) {
      targetEl.textContent = total > 0
        ? `~${formatNum(done)} / ${formatNum(total)} sayfa`
        : "hedef yükleniyor";
    }

    const msNow = document.getElementById("lpPpMsNow");
    if (msNow) {
      msNow.textContent = pct > 0 ? `Bugün · %${formatPct(pct)}` : "Bugün";
    }

    // Live project facts. Each one mirrors what's in publicProjectStats.
    setFact("lpFactBoxes",
      catalogued > 0 ? `${catalogued} / ${PNB_TARGET_BOXES}` : "—");
    setFact("lpFactFiles",
      totalFiles > 0 ? formatNum(totalFiles) : "—");
    setFact("lpFactUnits",
      totalUnits > 0 ? formatNum(totalUnits) : "—");

    // "Bu ay sayfa" — count of public ticker items in last 30d.
    const monthEl = document.getElementById("lpProjectMonthly");
    if (monthEl) {
      const since30d = Date.now() - 30 * 86400000;
      const monthCount = tickerItems.filter((r) => tsMillis(r.createdAt) >= since30d).length;
      monthEl.textContent = monthCount > 0 ? `+${formatNum(monthCount)} kayıt` : "—";
    }

    const footPct = document.getElementById("lpBoxesFootPct");
    if (footPct) footPct.textContent = pct > 0 ? `~%${formatPct(pct)} tamamlandı` : "veri bekleniyor";
  }

  function setFact(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // ---------- Box-by-box grid ----------
  // The 104-box visualization is rendered twice:
  //   1. renderBoxesGridStatic() on initial paint — uses a baked-in state
  //      map (mirror of current sheet snapshot) so the grid always paints.
  //   2. hydrateBoxesGrid() once Firestore lands — overlays per-box state
  //      from /publicProjectStats/pnb.boxes[] if SheetSync has published it.
  function renderBoxesGridStatic() {
    const grid = document.getElementById("lpBoxesGrid");
    if (!grid) return;
    paintBoxGrid(grid, defaultBoxStates());
  }
  function hydrateBoxesGrid(stats) {
    const grid = document.getElementById("lpBoxesGrid");
    if (!grid) return;
    const boxes = stats && Array.isArray(stats.boxes) ? stats.boxes : null;
    if (!boxes || !boxes.length) return; // keep the static render
    const states = boxes.map((b) => (b && typeof b.state === "number")
      ? clampInt(b.state, 0, 4) : "future");
    // Pad to 104 if the sheet returns fewer entries.
    while (states.length < PNB_TARGET_BOXES) states.push("future");
    paintBoxGrid(grid, states.slice(0, PNB_TARGET_BOXES));
  }
  function paintBoxGrid(grid, states) {
    grid.innerHTML = states.map((s, idx) => {
      const num = idx + 1;
      const cls = s === "future" ? "lp-box lp-box-future" : `lp-box lp-box-${s}`;
      const stateText = {
        0: "sıraya alındı, %0",
        1: "açıldı, %0–5",
        2: "%5–25",
        3: "%25–60",
        4: "%60+",
        future: "henüz katalogda değil",
      }[s];
      return `<span class="${cls}" title="Kutu ${num} — ${stateText}" role="img" aria-label="Kutu ${num} — ${stateText}"></span>`;
    }).join("");
  }
  // Static map approximating the current PNB Sayısallaştırma snapshot. When
  // SheetSync publishes a live boxes[] array it overrides this — until then
  // the grid reflects the sheet state at the last manual sync.
  function defaultBoxStates() {
    const states = [];
    for (let i = 1; i <= 13; i++) states.push(i === 1 ? 2 : 1);
    states.push(1);   // box 14
    states.push(3);   // box 15
    for (let i = 16; i <= 67; i++) states.push(0);
    states.push(1);   // box 68
    for (let i = 69; i <= 76; i++) states.push(0);
    states.push(0, 1, 0, 0); // I1, I2, F1, F2
    for (let i = 0; i < 6; i++) states.push(0);
    while (states.length < PNB_TARGET_BOXES) states.push("future");
    return states.slice(0, PNB_TARGET_BOXES);
  }

  // ---------- Wall of contributors ----------
  // Reads /publicVolunteers/* (each doc { firstName, optIn:true }) if the
  // collection exists. When live data is available we overwrite the static
  // alphabetical list rendered server-side; on miss we leave the static
  // markup in place so the section never goes blank.
  async function hydrateWall(db, fs) {
    const wall = document.getElementById("lpWall");
    const countEl = document.getElementById("lpWallCount");
    if (!wall) return;
    let names = [];
    try {
      const snap = await fs.getDocs(fs.query(
        fs.collection(db, "publicVolunteers"),
        fs.limit(500)
      ));
      names = snap.docs
        .map((d) => d.data() || {})
        .filter((d) => d.optIn !== false && d.firstName)
        .map((d) => String(d.firstName).trim())
        .filter(Boolean);
    } catch (err) { names = []; }
    if (!names.length) return; // keep the static markup
    names.sort((a, b) => a.localeCompare(b, "tr"));
    wall.innerHTML = names.map((n, i) => {
      const sep = i < names.length - 1
        ? `<span class="lp-wall-dot" aria-hidden="true">·</span>`
        : "";
      return `<span class="lp-wall-name">${esc(n)}</span>${sep}`;
    }).join("");
    if (countEl) countEl.textContent = `${names.length} isim`;
  }

  // ---------- Weekly roster ----------
  // Reads /publicSchedule/current — { rows: [{ loc, sublabel?, days:[..×5] }] }
  // when SheetSync publishes the "Günlük Gönüllü Akışı" tab. On miss the
  // section keeps the static grid from the HTML; on success the grid is
  // replaced with live names and today's column re-highlighted.
  async function hydrateRoster(db, fs) {
    const section = document.getElementById("lpRosterSection");
    if (!section) return;
    let doc = null;
    try {
      const ref = fs.doc(db, "publicSchedule", "current");
      const snap = await fs.getDoc(ref);
      doc = snap.exists() ? snap.data() : null;
    } catch (err) { doc = null; }
    if (!doc || !Array.isArray(doc.rows) || !doc.rows.length) return;
    const grid = section.querySelector(".lp-roster-grid");
    if (!grid) return;
    const dayHeaders = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
    const html = ['<div class="lp-roster-head"></div>'];
    dayHeaders.forEach((d, i) => {
      html.push(`<div class="lp-roster-head" data-roster-day="${i + 1}">${esc(d)}</div>`);
    });
    doc.rows.forEach((row) => {
      const loc = (row && row.loc) || "";
      const sub = (row && row.sublabel) || "";
      html.push(`<div class="lp-roster-loc">${esc(loc)}${sub ? `<small>${esc(sub)}</small>` : ""}</div>`);
      const days = (row && row.days) || [];
      for (let i = 0; i < 5; i++) {
        const name = days[i] ? String(days[i]).trim() : "";
        const cls = name ? "lp-roster-cell" : "lp-roster-cell lp-roster-empty";
        html.push(`<div class="${cls}" data-roster-day="${i + 1}">${name ? esc(name) : "—"}</div>`);
      }
    });
    grid.innerHTML = html.join("");
    markRosterToday();
  }

  // ---------- Work-area stacked bar ----------
  function hydrateAreaBar(tickerItems) {
    const bar = document.getElementById("lpAreaBar");
    const legend = document.getElementById("lpAreaLegend");
    if (!bar || !legend) return;

    const since30d = Date.now() - 30 * 86400000;
    const counts = new Map();
    let total = 0;
    tickerItems.forEach((r) => {
      const t = tsMillis(r.createdAt);
      if (!t || t < since30d) return;
      const cat = cleanCategory(r.materialCategory);
      counts.set(cat, (counts.get(cat) || 0) + 1);
      total += 1;
    });

    if (total === 0) {
      bar.innerHTML = `<div class="lp-area-seg lp-area-seg-empty">Henüz veri yok</div>`;
      legend.innerHTML = "";
      return;
    }

    const palette = ["#94462a", "#b85c3a", "#6b5d50", "#c89b3c", "#4a7c7e"];
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    bar.innerHTML = sorted.map(([name, n], i) => {
      const bg = palette[i] || palette[palette.length - 1];
      const color = i === 3 ? "var(--tv-ink)" : "white";
      return `<div class="lp-area-seg" style="background:${bg}; flex:${n}; color:${color};">${esc(capitalize(name))} · ${n}</div>`;
    }).join("");

    legend.innerHTML = sorted.map(([name, n], i) => {
      const bg = palette[i] || palette[palette.length - 1];
      const pct = ((n / total) * 100).toFixed(0);
      return `<li><span class="lp-aw" style="background:${bg};"></span><span><b>${esc(capitalize(name))}</b> — %${pct} (${n} kayıt)</span></li>`;
    }).join("");
  }

  // ---------- Weekly roster — mark today's column ----------
  function markRosterToday() {
    const dow = new Date().getDay();
    if (dow < 1 || dow > 5) return;
    document.querySelectorAll(`.lp-roster [data-roster-day="${dow}"]`).forEach((el) => {
      if (el.classList.contains("lp-roster-head")) {
        el.classList.add("lp-roster-today");
      } else if (el.classList.contains("lp-roster-cell")) {
        el.classList.add("lp-roster-today-col");
      }
    });
  }

  // ---------- Activity ticker (bottom) — de-personalized ----------
  function hydrateTickerSection(items) {
    if (!items.length) { hideTicker(); return; }
    const list = document.getElementById("lpTicker");
    if (!list) return;
    const groups = summarizeTickerItems(items).slice(0, 6);
    if (!groups.length) { hideTicker(); return; }
    list.innerHTML = groups.map(renderTickerGroup).join("");
    const section = list.closest(".lp-section");
    if (section) section.removeAttribute("hidden");
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
      <span class="lp-ticker-rest">${esc(formatNum(group.count))} katkı${categoryText ? ` · ${esc(categoryText)}${esc(extraText)}` : ""}</span>
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
  function clampInt(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0))); }
  function formatPct(p) {
    if (p < 10) return p.toFixed(1).replace(".", ",");
    return Math.round(p).toString();
  }
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
  function capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
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
