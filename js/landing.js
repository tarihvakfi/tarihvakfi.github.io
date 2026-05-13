// Tarih Vakfı public landing — small, framework-less.
//
// Architecture (May 2026, post-Firebase migration):
//   The site no longer talks to Firestore. All live data comes from a
//   single Google Apps Script web app endpoint that reads the shared
//   Google Sheet and returns a sanitised JSON projection.
//
//   Endpoint: window.__SHEETSYNC_URL__ + "?public=1"
//   Response shape (see apps-script/SheetSync.gs#_buildPublicSitePayload_):
//     {
//       ok: true,
//       generatedAt: "ISO timestamp",
//       data: {
//         stats: { projects: { pnb: { totalPages, donePages, totalUnits,
//                                     totalFiles, cataloguedBoxes, boxes:[], ... } } },
//         ticker: [{ slug, name, donePages, totalPages, percent, when, materialCategory }],
//         content: { heroEyebrow, heroHeadline, heroSub, dailyNote, ... },
//         activeVolunteers: ["Ali","Ayşe", ...],
//         schedule: { monday: [...], tuesday: [...] }
//       }
//     }
//
// The page is fully usable without the network (static markup + sensible
// fallbacks). When the fetch succeeds, hydrators overwrite the static
// content with live numbers.

(() => {
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
  markRosterToday();
  renderBoxesGridStatic();

  // ---------- Instant render from snapshot ----------
  // js/snapshot.js drops a snapshot of the Apps Script payload into
  // window.__SNAPSHOT__. We render that immediately on first paint (no
  // network round-trip, no "—" placeholders), then quietly fetch the live
  // endpoint and overlay any newer numbers.
  const snapshot = window.__SNAPSHOT__;
  if (snapshot && snapshot.ok && snapshot.data) {
    try { hydrateAll(snapshot.data); } catch (e) { /* fall through */ }
  } else {
    // No snapshot? Show "yükleniyor" briefly until the fetch completes.
    setLedgerFallback();
    setCollectiveFallback();
  }

  // ---------- Background live refresh ----------
  const url = window.__SHEETSYNC_URL__;
  const looksConfigured = typeof url === "string"
    && url.indexOf("script.google.com") >= 0
    && url.indexOf("REPLACE_ME") === -1;
  if (!looksConfigured) {
    if (!snapshot) hideTicker();
    return;
  }

  fetchPayload(url)
    .then((data) => hydrateAll(data))
    .catch(() => {
      if (!snapshot) {
        setLedgerFallback();
        setCollectiveFallback();
        hideTicker();
      }
      // Else: snapshot is already on screen; silent failure is fine.
    });

  async function fetchPayload(base) {
    const sep = base.indexOf("?") >= 0 ? "&" : "?";
    const resp = await fetch(`${base}${sep}public=1&t=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      redirect: "follow"
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const body = await resp.json();
    if (!body || body.ok !== true || !body.data) {
      throw new Error("Bad payload");
    }
    return body.data;
  }

  // ---------- Combined hydrate ----------
  // Receives the JSON payload from Apps Script and routes each piece to
  // the section that consumes it.
  function hydrateAll(payload) {
    const stats = projectStats(payload);
    const ticker = Array.isArray(payload.ticker) ? payload.ticker : [];

    hydrateLedger(stats, ticker);
    hydrateCollective(ticker);
    hydrateProjectCard(stats, ticker);
    hydrateAreaBar(ticker);
    hydrateBoxesGrid(stats);
    hydrateTickerSection(ticker);

    hydrateWall(payload.activeVolunteers);
    hydrateRoster(payload.schedule);
    hydrateSiteContent(payload.content);

    // v4 — sheet-faithful additions
    hydrateStream(payload.stream, ticker);
    hydrateWeeklyRhythm(payload.weeklyRhythm);
    hydrateTouchedBoxes(payload.boxes, ticker);
    hydrateBoxTable(payload.boxes);
    hydrateVolunteers(payload.volunteers);
  }

  // The payload supports two shapes for stats:
  //   stats: { projects: { pnb: {...} } }     ← new direct-from-sheet shape
  //   stats: { totalPages, donePages, ... }   ← legacy Firestore shape
  function projectStats(payload) {
    const s = payload && payload.stats;
    if (!s) return null;
    if (s.projects && s.projects.pnb) return s.projects.pnb;
    if (typeof s.totalPages !== "undefined") return s;
    return null;
  }

  // ---------- Editorial copy overlay ----------
  // The "Anasayfa Metinleri" sheet tab lets the foundation edit
  // headlines, paragraphs, FAQ rows, etc. without touching code.
  // Each row is { key | value }; we map the key to any
  // [data-edit="<key>"] element on the page.
  function hydrateSiteContent(content) {
    if (!content || typeof content !== "object") return;

    const TEXT_KEYS = ["heroEyebrow", "heroHeadline", "heroSub",
                       "projectHeading", "projectPeople", "projectBlurb"];
    TEXT_KEYS.forEach((key) => {
      const value = content[key];
      if (value == null || String(value).trim() === "") return;
      document.querySelectorAll(`[data-edit="${key}"]`).forEach((el) => {
        el.innerHTML = String(value);
      });
    });
    // Generic pass — any other key with a [data-edit] target.
    Object.keys(content).forEach((key) => {
      if (TEXT_KEYS.indexOf(key) >= 0 || key === "dailyNote" || key === "dailyNoteVisible") return;
      const value = content[key];
      if (value == null || String(value).trim() === "") return;
      document.querySelectorAll(`[data-edit="${key}"]`).forEach((el) => {
        el.innerHTML = String(value);
      });
    });

    const note = document.getElementById("lpDailyNote");
    const noteText = document.querySelector('[data-edit="dailyNote"]');
    const text = content.dailyNote ? String(content.dailyNote).trim() : "";
    const visibleFlag = content.dailyNoteVisible;
    const visible = (visibleFlag === undefined || visibleFlag === true
                     || String(visibleFlag).toLowerCase() === "true"
                     || String(visibleFlag) === "1")
                    && text.length > 0;
    if (note && noteText) {
      if (visible) {
        noteText.innerHTML = text;
        note.removeAttribute("hidden");
      } else {
        note.setAttribute("hidden", "");
      }
    }
  }

  // ---------- Ledger strip (4 cells in hero) ----------
  function hydrateLedger(stats, tickerItems) {
    const total = (stats && Number(stats.totalPages)) || 0;
    const done = (stats && Number(stats.donePages)) || 0;
    const pct = total > 0 ? (done / total) * 100 : 0;

    setLedger("progress", {
      val: pct > 0 ? `%${formatPct(pct)}` : "—",
      foot: total > 0
        ? `${formatNum(done)} / ${formatNum(total)} sayfa`
        : "sayfa hedefi yükleniyor",
    });

    const progSpan = document.getElementById("lpHeroProgress");
    if (progSpan && pct > 0) {
      progSpan.textContent = `Şu an %${formatPct(pct)}'ündeyiz.`;
    }

    const boxTargetEl = document.getElementById("lpLedgerBoxTarget");
    if (boxTargetEl) boxTargetEl.textContent = String(PNB_TARGET_BOXES);
    const catalogued = (stats && Number(stats.cataloguedBoxes)) || 0;
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

    const now = Date.now();
    const since30d = now - 30 * 86400000;
    const since7d = now - 7 * 86400000;
    const tokens30d = new Set();
    let count7d = 0;
    tickerItems.forEach((r) => {
      const t = tsMillis(r.when || r.createdAt);
      if (!t) return;
      const id = r.volunteerToken || r.slug || r.name;
      if (t >= since30d && id) tokens30d.add(id);
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
    const week = tickerItems.filter((r) => tsMillis(r.when || r.createdAt) >= since7d);
    if (!week.length) {
      setCollectiveFallback();
      return;
    }

    const days = new Set();
    const tokens = new Set();
    const areas = new Map();
    week.forEach((r) => {
      const t = tsMillis(r.when || r.createdAt);
      if (!t) return;
      days.add(dayKey(t));
      const id = r.volunteerToken || r.slug || r.name;
      if (id) tokens.add(id);
      const cat = cleanCategory(r.materialCategory);
      areas.set(cat, (areas.get(cat) || 0) + 1);
    });

    setCollect("days", { val: String(days.size), foot: "arşive girildi" });
    setCollect("people", { val: String(tokens.size), foot: "paralel çalıştı" });
    setCollect("contribs", { val: String(week.length), foot: "rapor yazıldı" });
    setCollect("areas", { val: String(areas.size), foot: "alanda emek" });

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

  // ---------- Project card progress ----------
  function hydrateProjectCard(stats, tickerItems) {
    const total = (stats && Number(stats.totalPages)) || 0;
    const done = (stats && Number(stats.donePages)) || 0;
    const totalUnits = (stats && Number(stats.totalUnits)) || 0;
    const totalFiles = (stats && Number(stats.totalFiles)) || 0;
    const catalogued = (stats && Number(stats.cataloguedBoxes)) || 0;
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

    setFact("lpFactBoxes",
      catalogued > 0 ? `${catalogued} / ${PNB_TARGET_BOXES}` : "—");
    setFact("lpFactFiles",
      totalFiles > 0 ? formatNum(totalFiles) : "—");
    setFact("lpFactUnits",
      totalUnits > 0 ? formatNum(totalUnits) : "—");

    const monthEl = document.getElementById("lpProjectMonthly");
    if (monthEl) {
      const since30d = Date.now() - 30 * 86400000;
      const monthCount = tickerItems.filter((r) => tsMillis(r.when || r.createdAt) >= since30d).length;
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
  function renderBoxesGridStatic() {
    const grid = document.getElementById("lpBoxesGrid");
    if (!grid) return;
    paintBoxGrid(grid, defaultBoxStates());
  }
  function hydrateBoxesGrid(stats) {
    const grid = document.getElementById("lpBoxesGrid");
    if (!grid) return;
    const boxes = stats && Array.isArray(stats.boxes) ? stats.boxes : null;
    if (!boxes || !boxes.length) return;
    const states = boxes.map((b) => (b && typeof b.state === "number")
      ? clampInt(b.state, 0, 4) : "future");
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
  function defaultBoxStates() {
    const states = [];
    for (let i = 1; i <= 13; i++) states.push(i === 1 ? 2 : 1);
    states.push(1);
    states.push(3);
    for (let i = 16; i <= 67; i++) states.push(0);
    states.push(1);
    for (let i = 69; i <= 76; i++) states.push(0);
    states.push(0, 1, 0, 0);
    for (let i = 0; i < 6; i++) states.push(0);
    while (states.length < PNB_TARGET_BOXES) states.push("future");
    return states.slice(0, PNB_TARGET_BOXES);
  }

  // ---------- Wall of contributors ----------
  // Names are first-name-only and already sorted by Apps Script. When the
  // sheet provides them we overwrite the static fallback; on miss we keep
  // the static markup.
  function hydrateWall(activeVolunteers) {
    const wall = document.getElementById("lpWall");
    const countEl = document.getElementById("lpWallCount");
    if (!wall) return;
    const names = Array.isArray(activeVolunteers) ? activeVolunteers.filter(Boolean) : [];
    if (!names.length) return;
    wall.innerHTML = names.map((n, i) => {
      const sep = i < names.length - 1
        ? `<span class="lp-wall-dot" aria-hidden="true">·</span>`
        : "";
      return `<span class="lp-wall-name">${esc(n)}</span>${sep}`;
    }).join("");
    if (countEl) countEl.textContent = `${names.length} isim`;
  }

  // ---------- Weekly roster ----------
  // Schedule shape: { monday: [..first names..], tuesday: [...], ... }
  function hydrateRoster(schedule) {
    const section = document.getElementById("lpRosterSection");
    if (!section) return;
    if (!schedule || typeof schedule !== "object") return;
    const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    const hasAny = dayKeys.some((k) => Array.isArray(schedule[k]) && schedule[k].length);
    if (!hasAny) return;

    const grid = section.querySelector(".lp-roster-grid");
    if (!grid) return;
    const dayHeaders = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
    const html = ['<div class="lp-roster-head"></div>'];
    dayHeaders.forEach((d, i) => {
      html.push(`<div class="lp-roster-head" data-roster-day="${i + 1}">${esc(d)}</div>`);
    });
    // Single "Arşiv" row showing day-by-day participants.
    html.push(`<div class="lp-roster-loc">Arşiv<small>PNB</small></div>`);
    for (let i = 0; i < 5; i++) {
      const list = Array.isArray(schedule[dayKeys[i]]) ? schedule[dayKeys[i]] : [];
      const text = list.length ? list.join(" · ") : "";
      const cls = text ? "lp-roster-cell" : "lp-roster-cell lp-roster-empty";
      html.push(`<div class="${cls}" data-roster-day="${i + 1}">${text ? esc(text) : "—"}</div>`);
    }
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
      const t = tsMillis(r.when || r.createdAt);
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

  // ---------- Activity ticker (bottom) ----------
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
      const when = tsMillis(r.when || r.createdAt);
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
  // Apps Script returns ISO strings or { _seconds, _nanoseconds } depending
  // on the source. tsMillis handles both, plus raw numbers and Date objects.
  function tsMillis(ts) {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") {
      const t = Date.parse(ts);
      return isNaN(t) ? 0 : t;
    }
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    if (typeof ts._seconds === "number") return ts._seconds * 1000;
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
  function initials(name) {
    const s = String(name || "").trim();
    return s ? s.charAt(0).toLocaleUpperCase("tr") : "·";
  }

  // ============================================================
  // v4 — Stream slice + weekly rhythm + touched-boxes pills
  // ============================================================

  function hydrateStream(streamData, tickerItems) {
    const wrap = document.getElementById("lpStream");
    const section = document.getElementById("bugun");
    if (!wrap) return;
    let days = Array.isArray(streamData) ? streamData.slice(0, 4) : [];
    // Fallback: derive from ticker if Apps Script didn't ship stream yet.
    if (!days.length && tickerItems && tickerItems.length) {
      const byDay = new Map();
      tickerItems.forEach((r) => {
        const t = tsMillis(r.when || r.createdAt);
        if (!t) return;
        const key = dayKey(t);
        if (!byDay.has(key)) byDay.set(key, { date: new Date(t).toISOString(), items: [] });
        byDay.get(key).items.push(r);
      });
      days = Array.from(byDay.values()).sort((a, b) => tsMillis(b.date) - tsMillis(a.date)).slice(0, 4);
    }
    if (!days.length) {
      if (section) section.setAttribute("hidden", "");
      return;
    }
    wrap.innerHTML = days.map((d) => {
      const ts = tsMillis(d.date);
      const lbl = dayLabel(ts);
      const items = (d.items || []).slice(0, 4);
      return `
        <div class="lp-stream-day">
          <div class="lp-stream-day-head">
            <h3>${esc(lbl)}</h3>
            <small>${esc(formatLongDate(ts))} · ${items.length} kayıt</small>
          </div>
          ${items.map((it) => renderStreamItem(it)).join("")}
        </div>`;
    }).join("");
    if (section) section.removeAttribute("hidden");
  }

  function renderStreamItem(it) {
    const token = it.volunteerToken || "";
    const initial = initials(token);
    const cat = cleanCategory(it.materialCategory);
    const t = tsMillis(it.when || it.createdAt);
    const hm = t ? new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—";
    return `
      <div class="lp-stream-item">
        <div class="lp-stream-avatar" aria-hidden="true">${esc(initial)}</div>
        <div class="lp-stream-body">
          <p class="who">Bir gönüllü</p>
          <p class="what">${esc(capitalize(cat))} · kayıt düşüldü</p>
        </div>
        <div class="lp-stream-meta"><b>+1</b>${esc(hm)}</div>
      </div>`;
  }

  function hydrateWeeklyRhythm(buckets) {
    const wrap = document.getElementById("lpWeekBars");
    const foot = document.getElementById("lpWeekFoot");
    if (!wrap) return;
    const arr = Array.isArray(buckets) && buckets.length === 7 ? buckets : [0,0,0,0,0,0,0];
    const max = Math.max(...arr, 1);
    const labels = ["Pa","Sa","Ça","Pe","Cu","Ct","Pz"];
    const today = new Date().getDay(); // 0=Pz..6=Ct (JS) — adjust to ISO Pa=0
    const isoToday = today === 0 ? 6 : today - 1; // 0=Pa..6=Pz
    wrap.innerHTML = arr.map((n, i) => {
      const pct = Math.max(2, Math.round((n / max) * 100));
      const cls = i === isoToday ? "lp-week-bar today" : "lp-week-bar";
      return `<div class="${cls}" style="height:${pct}%" title="${labels[i]} · ${n} kayıt"><small>${labels[i]}</small></div>`;
    }).join("");
    if (foot) {
      const total = arr.reduce((s, n) => s + n, 0);
      foot.innerHTML = total > 0
        ? `Bu hafta toplam <b style="color:var(--lp-terra,#94462a);">${formatNum(total)} kayıt</b>`
        : `Bu hafta henüz kayıt yok`;
    }
  }

  function hydrateTouchedBoxes(boxes, tickerItems) {
    const wrap = document.getElementById("lpTouchedBoxes");
    if (!wrap) return;
    // Prefer boxes flagged as 'active'. Otherwise derive from recent ticker.
    let touched = [];
    if (Array.isArray(boxes) && boxes.length) {
      touched = boxes.filter((b) => b.status === "active").map((b) => `Kutu ${b.kutu}`);
    }
    if (!touched.length) {
      wrap.textContent = "—";
      return;
    }
    wrap.innerHTML = touched.slice(0, 12)
      .map((name) => `<span class="lp-pill lp-pill-touch">${esc(name)}</span>`)
      .join("");
  }

  // ============================================================
  // v4 — Box table (sortable mirror of pnb_sayisallastirma)
  // ============================================================
  let _boxTableData = [];

  function hydrateBoxTable(boxes) {
    const tbody = document.getElementById("lpBoxTableBody");
    const section = document.getElementById("kutular");
    if (!tbody) return;
    _boxTableData = Array.isArray(boxes) ? boxes.slice() : [];
    if (!_boxTableData.length) {
      if (section) section.setAttribute("hidden", "");
      return;
    }
    if (section) section.removeAttribute("hidden");
    renderBoxTable();
    // Wire filter inputs (idempotent — replaceWith clones to drop previous listeners)
    const search = document.getElementById("lpBoxSearch");
    const status = document.getElementById("lpBoxStatus");
    if (search) {
      const fresh = search.cloneNode(true);
      search.parentNode.replaceChild(fresh, search);
      fresh.addEventListener("input", renderBoxTable);
    }
    if (status) {
      const fresh = status.cloneNode(true);
      status.parentNode.replaceChild(fresh, status);
      fresh.addEventListener("change", renderBoxTable);
    }
  }

  function renderBoxTable() {
    const tbody = document.getElementById("lpBoxTableBody");
    if (!tbody) return;
    const searchEl = document.getElementById("lpBoxSearch");
    const statusEl = document.getElementById("lpBoxStatus");
    const q = (searchEl && searchEl.value || "").trim().toLocaleLowerCase("tr");
    const filterStatus = (statusEl && statusEl.value) || "all";
    const filtered = _boxTableData.filter((b) => {
      if (filterStatus !== "all" && b.status !== filterStatus) return false;
      if (!q) return true;
      const hay = [
        String(b.kutu || ""),
        String(b.name || ""),
        (b.workers || []).join(" "),
      ].join(" ").toLocaleLowerCase("tr");
      return hay.indexOf(q) >= 0;
    });
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="lp-bt-empty">Eşleşen kutu yok.</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map((b, i) => {
      const pct = b.totalPages > 0 ? Math.round((b.donePages / b.totalPages) * 100) : 0;
      const workers = (b.workers || []).slice(0, 3).map((w) => `<span class="lp-bt-chip">${esc(w)}</span>`).join("");
      const more = (b.workers || []).length > 3 ? `<span class="lp-bt-chip">+${b.workers.length - 3}</span>` : "";
      const stateLabel = b.status === "done" ? "tamamlandı" : b.status === "active" ? "devam" : "başlamadı";
      return `<tr>
        <td class="lp-bt-num">${esc(b.kutu)}</td>
        <td class="lp-bt-name">${esc(b.name || `Kutu ${b.kutu}`)}</td>
        <td class="lp-bt-num-r">${formatNum(b.dosya || 0)}</td>
        <td class="lp-bt-num-r">${formatNum(b.belge || 0)}</td>
        <td class="lp-bt-num-r">${formatNum(b.totalPages || 0)}</td>
        <td class="lp-bt-progcell">
          <div class="lp-bt-proglabel">%${pct} (${formatNum(b.donePages || 0)}/${formatNum(b.totalPages || 0)})</div>
          <div class="lp-bt-bar"><span style="width:${pct}%"></span></div>
        </td>
        <td>${workers || `<span style="color:var(--lp-muted,#6b5d50); font-size:13px;">—</span>`}${more}</td>
        <td><span class="lp-bt-state ${esc(b.status || "future")}">${esc(stateLabel)}</span></td>
      </tr>`;
    }).join("");
  }

  // ============================================================
  // v4 — Volunteer atlas (one card per gönüllü)
  // ============================================================
  let _volData = [];

  function hydrateVolunteers(volunteers) {
    const grid = document.getElementById("lpVolGrid");
    const section = document.getElementById("gonulluler");
    if (!grid) return;
    _volData = Array.isArray(volunteers) ? volunteers.slice() : [];
    if (!_volData.length) {
      if (section) section.setAttribute("hidden", "");
      return;
    }
    if (section) section.removeAttribute("hidden");
    renderVolGrid("all");
    const filter = document.getElementById("lpVolFilter");
    if (filter) {
      filter.querySelectorAll(".lp-vol-fchip").forEach((btn) => {
        const fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);
        fresh.addEventListener("click", () => {
          filter.querySelectorAll(".lp-vol-fchip").forEach((b) => b.classList.remove("on"));
          fresh.classList.add("on");
          renderVolGrid(fresh.dataset.vf || "all");
        });
      });
    }
  }

  function renderVolGrid(mode) {
    const grid = document.getElementById("lpVolGrid");
    if (!grid) return;
    let list = _volData.slice();
    if (mode === "active") list = list.filter((v) => v.status === "active");
    else if (mode === "quiet") list = list.filter((v) => v.status !== "active");
    else if (mode === "top") list.sort((a, b) => (b.monthPages || 0) - (a.monthPages || 0));
    if (!list.length) {
      grid.innerHTML = `<p style="color: var(--lp-muted,#6b5d50); font-style:italic;">Bu kategoride gönüllü yok.</p>`;
      return;
    }
    grid.innerHTML = list.map((v) => renderVolCard(v)).join("");
  }

  function renderVolCard(v) {
    const last = v.lastActivity ? tsMillis(v.lastActivity) : 0;
    const lastLbl = last > 0 ? dayLabel(last) : "—";
    const spark = Array.isArray(v.spark) ? v.spark : [0,0,0,0];
    const maxS = Math.max(...spark, 1);
    const statusCls = v.status === "active" ? "active" : "quiet";
    const statusLbl = v.status === "active" ? "aktif" : "sessiz";
    return `
      <article class="lp-vol-card">
        <div class="lp-vol-head">
          <div class="lp-vol-avatar">${esc(initials(v.firstName))}</div>
          <div>
            <h4 class="lp-vol-name">${esc(v.firstName || "—")}<span class="lp-vol-status ${statusCls}">${statusLbl}</span></h4>
            ${v.currentBox ? `<small class="lp-vol-since">şu an Kutu ${esc(v.currentBox)}</small>` : ""}
          </div>
        </div>
        <div class="lp-vol-stat"><span>Bu ay sayfa</span><span>${formatNum(v.monthPages || 0)}</span></div>
        <div class="lp-vol-stat"><span>Toplam sayfa</span><span>${formatNum(v.totalPages || 0)}</span></div>
        <div class="lp-vol-stat"><span>Son kayıt</span><span>${esc(lastLbl)}</span></div>
        <div class="lp-vol-spark">${spark.map((n) => {
          const h = Math.max(4, Math.round((n / maxS) * 100));
          const hi = n > 0 && n >= (maxS * 0.5) ? "hi" : "";
          return `<span class="${hi}" style="height:${h}%"></span>`;
        }).join("")}</div>
      </article>`;
  }

  function formatLongDate(ms) {
    if (!ms) return "";
    return new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  }
})();
n><span>${formatNum(v.monthPages || 0)}</span></div>
        <div class="lp-vol-stat"><span>Toplam sayfa</span><span>${formatNum(v.totalPages || 0)}</span></div>
        <div class="lp-vol-stat"><span>Son kayıt</span><span>${esc(lastLbl)}</span></div>
        <div class="lp-vol-spark">${spark.map((n) => {
          const h = Math.max(4, Math.round((n / maxS) * 100));
          const hi = n > 0 && n >= (maxS * 0.5) ? "hi" : "";
          return `<span class="${hi}" style="height:${h}%"></span>`;
        }).join("")}</div>
      </article>`;
  }

  function formatLongDate(ms) {
    if (!ms) return "";
    return new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  }
})();
