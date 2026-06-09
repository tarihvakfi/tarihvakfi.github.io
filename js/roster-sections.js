// roster-sections.js
// ---------------------------------------------------------------------
// Renders the four new sections introduced by the A+B hybrid redesign:
//
//   1. Cumulative ribbon              → #lpCumulativeRibbon
//   2. Track timeline (çalışma izleri)→ #lpTracks
//   3. Active volunteer wall (A)      → #lpActiveWall
//   4. Full kadro / census (B)        → #lpKadro
//
// Data source: window.TVF_ROSTER (produced by build_richer_snapshot.py).
// The existing dashboard (window.TVF_PUBLIC_DATA) is untouched; if it
// happens to ship a `totals` field with rolling-seven-day numbers, the ribbon
// will use it. Otherwise the ribbon just shows kümülatif.
//
// Load order in index.html (script tags omitted from this comment to
// avoid breaking HTML parsing if this file is ever inlined inside a
// script block during preview):
//
//   1. config.public.js  (existing)
//   2. snapshot.js       (existing)
//   3. roster.js         (NEW — supplemental data)
//   4. utils.js          (existing)
//   5. volunteer-credit.js, aggregate.js, render-dashboard.js (existing)
//   6. roster-sections.js (THIS file)
//   7. volunteer-card.js  (NEW — profile drawer)
//   8. data-loader.js     (existing)
//
// roster-sections.js attaches `window.TVF.renderRosterSections()` and
// runs it once on DOMContentLoaded.
// ---------------------------------------------------------------------

(function () {
  "use strict";

  // --- Track metadata: colour ramps that read against burgundy/cream --
  const TRACK_META = {
    tarama:          { label: "Tarama (belge & kartpostal)",     color: "#601040", bg: "#fbf2f7", border: "#ead5e2", lane: "#fbf2f7" },
    envanter:        { label: "Envanter (afiş, görsel-işitsel)", color: "#8a2a62", bg: "#fbf2f7", border: "#ead5e2", lane: "#fbf2f7" },
    kurumsal_bellek: { label: "Kurum belleği (Karar Def., G.K.)", color: "#3b6d11", bg: "#eaf3de", border: "#c0dd97", lane: "#eaf3de" },
    osmanlica:       { label: "Osmanlıca çeviri",                color: "#BA7517", bg: "#FAEEDA", border: "#FAC775", lane: "#FAEEDA" },
    proje_basvuru:   { label: "Proje başvurusu (Gerda Henkel)",  color: "#185fa5", bg: "#e6f1fb", border: "#b5d4f4", lane: "#e6f1fb" },
    egitim:          { label: "Eğitim (İş Bankası Müzesi)",      color: "#534AB7", bg: "#EEEDFE", border: "#CECBF6", lane: "#EEEDFE" },
    ars_web:         { label: "Arşiv-web & IT",                  color: "#444441", bg: "#f1efe8", border: "#d3d1c7", lane: "#f1efe8" },
    koordinasyon:    { label: "Koordinasyon & planlama",         color: "#888780", bg: "#f1efe8", border: "#d3d1c7", lane: "#f1efe8" },
    kodlama_kontrol: { label: "Kodlama & kontrol",               color: "#185fa5", bg: "#e6f1fb", border: "#b5d4f4", lane: "#e6f1fb" },
    diger:           { label: "Diğer çalışma",                   color: "#74686e", bg: "#f1efe8", border: "#d3d1c7", lane: "#f1efe8" },
  };

  const TRACK_ORDER = [
    "tarama", "envanter", "kurumsal_bellek", "proje_basvuru",
    "osmanlica", "egitim", "koordinasyon", "ars_web",
    "kodlama_kontrol", "diger",
  ];

  // Tr month abbreviations indexed 1..12
  const MONTHS_TR = ["", "OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ",
                     "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"];

  // --- helpers ---------------------------------------------------------
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(n) {
    if (n == null) return "—";
    return Number(n).toLocaleString("tr-TR");
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  function safeMount(id) {
    return document.getElementById(id);
  }

  function getLiveSummary() {
    const summary = window.TVF_PUBLIC_DATA && window.TVF_PUBLIC_DATA.publicSummary
      ? window.TVF_PUBLIC_DATA.publicSummary
      : null;
    if (!summary) return null;
    if (window.TVF_LIVE_DATA_READY === true) return summary;
    return summary.period && summary.period.mode === "rolling_7_days" ? summary : null;
  }

  function asciiFold(value) {
    return String(value || "")
      .replace(/[çÇ]/g, "c")
      .replace(/[ğĞ]/g, "g")
      .replace(/[ıİI]/g, "i")
      .replace(/[öÖ]/g, "o")
      .replace(/[şŞ]/g, "s")
      .replace(/[üÜ]/g, "u")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function slugifyName(value) {
    return asciiFold(value).replace(/\s+/g, "-") || "g";
  }

  function rosterByName(data) {
    const index = {};
    (data.volunteers || []).forEach((v) => {
      index[asciiFold(v.name)] = v;
    });
    return index;
  }

  function liveVolunteerRows() {
    const summary = getLiveSummary();
    return summary && Array.isArray(summary.byVolunteer) ? summary.byVolunteer : [];
  }

  function liveMonth(summary) {
    const endDate = summary && summary.period && summary.period.endDate;
    return endDate ? String(endDate).slice(0, 7) : null;
  }

  function liveTrackCounts(data) {
    const summary = getLiveSummary();
    const month = liveMonth(summary);
    if (!summary || !month) return null;

    const byName = rosterByName(data);
    const counts = {};
    liveVolunteerRows().forEach((row) => {
      const label = String(row.label || "").trim();
      if (!label) return;
      const rosterVol = byName[asciiFold(label)];
      const track = (rosterVol && rosterVol.tracks && rosterVol.tracks[0])
        || (row.publicRole ? "koordinasyon" : "diger");
      counts[track] = (counts[track] || 0) + Number(row.records || row.pageRows || row.activityRows || 0);
    });

    return { month, counts };
  }

  // -------------------------------------------------------------------
  // 1. Cumulative ribbon
  // -------------------------------------------------------------------
  function renderRibbon(data) {
    const mount = safeMount("lpCumulativeRibbon");
    if (!mount || !data) return;

    const c = data.cumulative || {};
    const summary = getLiveSummary();
    const periodLabel =
      c.firstActivityDate && (summary?.period?.endDate || c.latestActivityDate)
        ? `${c.firstActivityDate.slice(0, 7).replace("-", "/")} — ${(summary?.period?.endDate || c.latestActivityDate).slice(0, 7).replace("-", "/")}`
        : "Ocak — Mayıs 2026";

    // For "recent period" stats we read whatever the existing dashboard
    // has already computed on window.TVF_PUBLIC_DATA. If it's not
    // there we hide the right half.
    const thisWeek = (summary && summary.totals) || null;
    const tw = thisWeek
      ? `<div class="rb this-week">
           <p class="k">Son 7 gün <em>${esc((summary.period || {}).label || "")}</em></p>
           <div class="stat-row">
             <div class="stat"><span class="v">+${fmt(thisWeek.periodPagesDone || thisWeek.pageRows || 0)}</span><span class="l">yeni sayfa</span></div>
             <div class="stat"><span class="v">${fmt(thisWeek.volunteersActive || 0)}</span><span class="l">aktif gönüllü</span></div>
             <div class="stat"><span class="v">${fmt(thisWeek.boxesActive || 0)}</span><span class="l">aktif kutu</span></div>
           </div>
         </div>`
      : "";

    mount.innerHTML = `
      <div class="rb cumulative">
        <p class="k">Kümülatif <em>${esc(periodLabel)}</em></p>
        <div class="stat-row">
          <div class="stat"><span class="v">${fmt(c.activeVolunteers)}</span><span class="l">aktif gönüllü</span></div>
          <div class="stat"><span class="v">${fmt(c.sessions)}</span><span class="l">çalışma oturumu</span></div>
          <div class="stat"><span class="v">${fmt(c.tracks)}</span><span class="l">paralel iş alanı</span></div>
        </div>
      </div>
      ${tw}`;
    mount.classList.add("tv-ribbon");
  }

  // -------------------------------------------------------------------
  // 2. Track timeline (çalışma izleri)
  // -------------------------------------------------------------------
  function renderTracks(data) {
    const mount = safeMount("lpTracks");
    if (!mount || !data || !Array.isArray(data.tracks)) return;
    if (data.tracks.length === 0) {
      mount.setAttribute("hidden", "");
      return;
    }

    // Build the month scale from data.monthsActive (e.g. ["2026-01", ... "2026-05"])
    const baseMonths = Array.isArray(data.monthsActive) && data.monthsActive.length
      ? data.monthsActive
      : ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
    const liveTracks = liveTrackCounts(data);
    const overlayLiveMonth = liveTracks && liveTracks.month && !baseMonths.includes(liveTracks.month);
    const months = overlayLiveMonth ? baseMonths.concat(liveTracks.month) : baseMonths;

    const monthCols = months
      .map((ym) => `<span>${MONTHS_TR[Number(ym.slice(5, 7))]}</span>`)
      .join("");

    // For each track, place a dot per month present in track.byMonth.
    // Dot diameter scales with sessions (4..16 px).
    function dotSize(sessions) {
      const s = Number(sessions) || 1;
      return Math.max(4, Math.min(16, 4 + Math.round(s * 1.5)));
    }

    const seenTracks = new Set(data.tracks.map((track) => track.key));
    const extraLiveTracks = overlayLiveMonth
      ? Object.keys(liveTracks.counts)
          .filter((key) => !seenTracks.has(key))
          .map((key) => ({ key, label: (TRACK_META[key] || TRACK_META.diger).label, sessions: 0, byMonth: {} }))
      : [];
    const tracksSorted = [...data.tracks, ...extraLiveTracks].sort((a, b) => {
      const aLive = overlayLiveMonth ? Number(liveTracks.counts[a.key] || 0) : 0;
      const bLive = overlayLiveMonth ? Number(liveTracks.counts[b.key] || 0) : 0;
      return (Number(b.sessions || 0) + bLive) - (Number(a.sessions || 0) + aLive);
    });

    const laneRows = tracksSorted.map((t) => {
      const meta = TRACK_META[t.key] || TRACK_META.diger;
      const monthsHas = Object.assign({}, t.byMonth || {});
      const liveCount = overlayLiveMonth ? Number(liveTracks.counts[t.key] || 0) : 0;
      if (liveCount) monthsHas[liveTracks.month] = (monthsHas[liveTracks.month] || 0) + liveCount;
      const dots = months.map((ym, i) => {
        const n = monthsHas[ym];
        if (!n) return "";
        // place the dot in the middle of its month column (5 columns, so 10%, 30%, 50%, 70%, 90%)
        const x = (i + 0.5) * (100 / months.length);
        const sz = dotSize(n);
        return `<span class="pt" style="left:${x.toFixed(1)}%; width:${sz}px; height:${sz}px; background:${meta.color}" title="${MONTHS_TR[Number(ym.slice(5, 7))]}: ${n} oturum"></span>`;
      }).join("");

      return `
        <div class="lane-label"><span class="dot" style="background:${meta.color}"></span>${esc(meta.label)}</div>
        <div class="lane" style="background:${meta.lane}">${dots}</div>
        <div class="total" style="color:${meta.color}">${Number(t.sessions || 0) + liveCount}</div>`;
    }).join("");

    mount.classList.add("tv-tracks");
    mount.innerHTML = `
      <div class="lanes">
        <div></div>
        <div class="scale" style="grid-template-columns: repeat(${months.length}, 1fr);">${monthCols}</div>
        <div style="text-align:right; font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute);">top.</div>
        ${laneRows}
      </div>
      <p class="caption">Nokta büyüklüğü = o ay içinde o iş için kaç oturum görünür oldu.</p>`;
  }

  // -------------------------------------------------------------------
  // 3. Active volunteer wall (Design A) — track-grouped rozet
  // -------------------------------------------------------------------
  function renderActiveWall(data) {
    const mount = safeMount("lpActiveWall");
    if (!mount || !data) return;
    const byName = rosterByName(data);
    const liveRows = liveVolunteerRows();
    const useLiveRows = Boolean(getLiveSummary());
    const vols = useLiveRows
      ? liveRows.map((row) => {
          const rosterVol = byName[asciiFold(row.label)];
          const name = String(row.label || "").trim();
          return {
            name,
            slug: (rosterVol && rosterVol.slug) || slugifyName(name),
            tracks: (rosterVol && rosterVol.tracks && rosterVol.tracks.length)
              ? rosterVol.tracks
              : [row.publicRole ? "koordinasyon" : "diger"],
            sessions: Number(row.records || row.pageRows || row.activityRows || 0)
          };
        }).filter((v) => v.name)
      : (data.volunteers || []).filter((v) => v.active);
    if (vols.length === 0) {
      mount.innerHTML = "";
      mount.setAttribute("hidden", "");
      const metaEl = document.getElementById("lpActiveWallMeta");
      const summary = getLiveSummary();
      if (metaEl && useLiveRows && summary?.period?.label) {
        metaEl.textContent = `0 kişi · ${summary.period.label} · canlı`;
      }
      return;
    }
    mount.removeAttribute("hidden");
    const groups = {};
    vols.forEach((v) => {
      const tk = (v.tracks && v.tracks[0]) || "diger";
      (groups[tk] ||= []).push(v);
    });

    const html = TRACK_ORDER
      .filter((tk) => groups[tk])
      .map((tk) => {
        const meta = TRACK_META[tk] || TRACK_META.diger;
        const grp = groups[tk];
        const sessions = grp.reduce((s, v) => s + (v.sessions || 0), 0);
        const unit = useLiveRows ? "kayıt" : "oturum";
        const badges = grp.map((v) => `
          <span class="badge" data-slug="${esc(v.slug || "")}" data-volunteer-label="${esc(v.name)}" role="button" tabindex="0" aria-label="${esc(v.name)} profilini aç" style="background:${meta.bg}; border:0.5px solid ${meta.border};">
            <span class="av" style="background:${meta.color}">${esc(initials(v.name))}</span>
            ${esc(v.name)} <span class="ct">·${v.sessions}</span>
          </span>`
        ).join("");
        return `
          <div class="track-group">
            <div class="track-head">
              <span class="dot" style="background:${meta.color}"></span>
              <span class="lbl" style="color:${meta.color}">${esc(meta.label)}</span>
              <span class="meta">${grp.length} kişi · ${sessions} ${unit}</span>
            </div>
            <div class="badges">${badges}</div>
          </div>`;
      }).join("");

    mount.classList.add("tv-active");
    mount.innerHTML = html;

    // Update the section meta count if present
    const metaEl = document.getElementById("lpActiveWallMeta");
    if (metaEl) {
      const summary = getLiveSummary();
      const label = useLiveRows && summary?.period?.label ? `${summary.period.label} · canlı` : "aktif gönüllü";
      metaEl.textContent = useLiveRows ? `${vols.length} kişi · ${label}` : `${vols.length} aktif gönüllü`;
    }
  }

  // -------------------------------------------------------------------
  // 4. Full kadro / census (Design B) — every name, alphabetical
  // -------------------------------------------------------------------
  function renderKadro(data) {
    const mount = safeMount("lpKadro");
    if (!mount || !data) return;
    const liveNames = new Set(liveVolunteerRows().map((row) => asciiFold(row.label)).filter(Boolean));
    const vols = [...(data.volunteers || [])]
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
    if (vols.length === 0) {
      mount.setAttribute("hidden", "");
      return;
    }

    const rows = vols.map((v) => {
      const muted = (v.active || liveNames.has(asciiFold(v.name))) ? "" : " muted";
      const meta = [v.city, v.role].filter(Boolean).map(esc).join(" · ");
      return `<span class="row${muted}" data-slug="${esc(v.slug || "")}" data-volunteer-label="${esc(v.name)}" role="button" tabindex="0" aria-label="${esc(v.name)} profilini aç">
        <span class="marker"></span><span class="nm">${esc(v.name)}</span>${
          meta ? `<span class="meta">${meta}</span>` : ""
        }
      </span>`;
    }).join("");

    mount.classList.add("tv-kadro");
    mount.innerHTML = `
      <p class="roll-intro">
        Aşağıda Boratav Arşivi için zaman çizelgesine kaydolan herkes
        alfabetik sırayla yer alır. Dolu nokta, son 7 günde aktif olarak
        görünür kayıt üreten gönüllüleri işaret eder.
      </p>
      <div class="roll">${rows}</div>
      <div class="roll-legend">
        <span class="lg"><span class="mk"></span>Son 7 günde görünür katkı veren</span>
        <span class="lg"><span class="mk muted"></span>Kadroda; son 7 günde görünür kayıt yok</span>
      </div>`;

    const metaEl = document.getElementById("lpKadroMeta");
    if (metaEl) metaEl.textContent = `${vols.length} paydaş`;
  }

  // -------------------------------------------------------------------
  // Entry point
  // -------------------------------------------------------------------
  function renderRosterSections() {
    const data = window.TVF_ROSTER;
    if (!data) {
      console.warn("roster-sections: window.TVF_ROSTER missing");
      return;
    }
    try { renderRibbon(data); }     catch (e) { console.error("ribbon", e); }
    try { renderTracks(data); }     catch (e) { console.error("tracks", e); }
    try { renderActiveWall(data); } catch (e) { console.error("active wall", e); }
    try { renderKadro(data); }      catch (e) { console.error("kadro", e); }
  }

  window.TVF = window.TVF || {};
  window.TVF.renderRosterSections = renderRosterSections;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderRosterSections);
  } else {
    renderRosterSections();
  }
})();
