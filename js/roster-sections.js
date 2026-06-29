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
    proje_basvuru:   { label: "Proje çalışmaları",               color: "#185fa5", bg: "#e6f1fb", border: "#b5d4f4", lane: "#e6f1fb" },
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

  const NAME_ALIASES = {
    "betul ayse iseri": "betul iseri",
    "neslihan erken": "neslihan erkan",
  };

  const CANONICAL_DISPLAY_NAMES = {
    "betul iseri": "Betül İşeri",
    "neslihan erkan": "Neslihan Erkan",
  };
  const SUPPRESSED_LEGACY_CREDIT_KEYS = new Set([
    "betul iseri",
  ]);

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

  function periodRangeLabel(period) {
    if (window.TVFUtils && window.TVFUtils.cleanPeriodLabel) {
      return window.TVFUtils.cleanPeriodLabel(period, "");
    }
    return String((period && period.label) || "")
      .replace(/^(Son\s+7\s+gün|Güncel\s+dönem)\s*[·:–-]\s*/i, "")
      .replace(/^(Son\s+7\s+gün|Güncel\s+dönem)$/i, "")
      .trim();
  }

  function periodContextLabel(period) {
    const range = periodRangeLabel(period);
    return range ? `Güncel dönem · ${range}` : "Güncel dönem";
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

  function getLiveTrackSummary() {
    const payload = window.TVF_PUBLIC_DATA || {};
    const summary = payload.trackSummary;
    return summary && Array.isArray(summary.tracks) && summary.tracks.length
      ? summary
      : null;
  }

  function trackSessions(summary) {
    return normalizeTrackRows(Array.isArray(summary?.tracks) ? summary.tracks : [])
      .reduce((sum, track) => sum + Number(track.sessions || 0), 0);
  }

  function normalizeTrackKey(track) {
    const key = String((track && track.key) || "diger");
    const label = asciiFold((track && track.label) || "");
    if (key === "egitim" && label.indexOf("is bankasi") >= 0) return "tarama";
    return key;
  }

  function normalizeTrackRows(rows) {
    const merged = {};
    (Array.isArray(rows) ? rows : []).forEach((track) => {
      const key = normalizeTrackKey(track);
      if (!merged[key]) {
        const meta = TRACK_META[key] || TRACK_META.diger;
        merged[key] = {
          key,
          label: meta.label,
          sessions: 0,
          records: 0,
          pageRows: 0,
          activityRows: 0,
          pagesDone: 0,
          byMonth: {},
          people: [],
          peopleCount: 0,
          contributors: []
        };
      }
      const row = merged[key];
      row.sessions += Number(track.sessions || track.records || 0);
      row.records += Number(track.records || track.sessions || 0);
      row.pageRows += Number(track.pageRows || 0);
      row.activityRows += Number(track.activityRows || 0);
      row.pagesDone += Number(track.pagesDone || 0);
      Object.entries(track.byMonth || {}).forEach(([month, count]) => {
        row.byMonth[month] = Number(row.byMonth[month] || 0) + Number(count || 0);
      });
      (Array.isArray(track.people) ? track.people : []).forEach((name) => addUniqueLabel(row.people, name));
      (Array.isArray(track.contributors) ? track.contributors : []).forEach((contributor) => mergeContributor(row.contributors, contributor));
    });
    Object.values(merged).forEach((track) => {
      track.people.sort((a, b) => a.localeCompare(b, "tr"));
      track.peopleCount = track.people.length || track.contributors.length || Number(track.peopleCount || 0);
      track.contributors.sort((a, b) => Number(b.records || 0) - Number(a.records || 0) || String(a.label || "").localeCompare(String(b.label || ""), "tr"));
    });
    return Object.values(merged);
  }

  function addUniqueLabel(rows, label) {
    const clean = String(label || "").trim();
    if (!clean) return;
    const key = canonicalNameKey(clean);
    if (isSuppressedCreditKey(key)) return;
    if (!key || rows.some((item) => canonicalNameKey(item) === key)) return;
    rows.push(clean);
  }

  function mergeContributor(rows, contributor) {
    const label = String((contributor && contributor.label) || "").trim();
    const key = canonicalNameKey(label);
    if (isSuppressedCreditKey(key)) return;
    if (!key) return;
    let row = rows.find((item) => canonicalNameKey(item.label) === key);
    if (!row) {
      row = { label, publicRole: contributor.publicRole || "", records: 0, pageRows: 0, activityRows: 0, pagesDone: 0 };
      rows.push(row);
    }
    row.records += Number(contributor.records || 0);
    row.pageRows += Number(contributor.pageRows || 0);
    row.activityRows += Number(contributor.activityRows || 0);
    row.pagesDone += Number(contributor.pagesDone || 0);
    if (!row.publicRole && contributor.publicRole) row.publicRole = contributor.publicRole;
  }

  function trackSummaryPeopleCount(summary) {
    const seen = {};
    (Array.isArray(summary?.people) ? summary.people : []).forEach((name) => {
      publicPeopleFromLabel(name).forEach((person) => {
        seen[person.key] = true;
      });
    });
    const count = Object.keys(seen).length;
    return count || Number(summary?.peopleCount || 0);
  }

  function trackMonths(summary, fallback) {
    if (Array.isArray(summary?.monthsActive) && summary.monthsActive.length) return summary.monthsActive;
    if (Array.isArray(fallback?.monthsActive) && fallback.monthsActive.length) return fallback.monthsActive;
    return ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
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

  function canonicalNameKey(value) {
    const key = asciiFold(value);
    return NAME_ALIASES[key] || key;
  }

  function isSuppressedCreditKey(key) {
    return SUPPRESSED_LEGACY_CREDIT_KEYS.has(key);
  }

  function canonicalDisplayName(key, fallback) {
    return CANONICAL_DISPLAY_NAMES[key] || fallback;
  }

  function rosterByName(data) {
    const index = {};
    canonicalRosterVolunteers(data).forEach((v) => {
      index[canonicalNameKey(v.name)] = v;
    });
    return index;
  }

  function liveVolunteerRows() {
    const summary = getLiveSummary();
    return summary && Array.isArray(summary.byVolunteer) ? summary.byVolunteer : [];
  }

  function liveTrackRows() {
    const summary = getLiveSummary();
    return summary && Array.isArray(summary.byTrack) ? summary.byTrack : [];
  }

  function liveVolunteerMap() {
    const summary = getLiveSummary();
    const rows = summary && Array.isArray(summary.byVolunteer) ? summary.byVolunteer : [];
    const map = {};
    rows.forEach((row) => {
      const name = String(row.label || "").trim();
      const key = canonicalNameKey(name);
      if (isSuppressedCreditKey(key)) return;
      if (!key) return;
      map[key] = Object.assign({}, row, { label: name });
    });
    return map;
  }

  function displayNameScore(name) {
    const value = String(name || "");
    return (value.match(/[^\x00-\x7F]/g) || []).length * 10 + value.length;
  }

  function mergeVolunteer(base, incoming) {
    const out = Object.assign({}, base || {});
    const next = incoming || {};
    if (!out.name || displayNameScore(next.name) > displayNameScore(out.name)) out.name = next.name || out.name;
    if (next.active && next.name) out.name = next.name;
    if (!out.slug && next.slug) out.slug = next.slug;
    ["city", "role", "tv_role", "uni", "dept", "firstSeen", "lastSeen"].forEach((key) => {
      if (!out[key] && next[key]) out[key] = next[key];
    });
    ["currentRecords", "currentPageRows", "currentActivityRows"].forEach((key) => {
      if (next[key] != null) out[key] = Number(next[key] || 0);
    });
    ["topics", "slots", "tracks", "scanners", "boxes", "log"].forEach((key) => {
      const merged = [];
      (Array.isArray(out[key]) ? out[key] : []).concat(Array.isArray(next[key]) ? next[key] : []).forEach((item) => {
        const sig = typeof item === "object" ? JSON.stringify(item) : String(item);
        if (!merged.some((existing) => (typeof existing === "object" ? JSON.stringify(existing) : String(existing)) === sig)) merged.push(item);
      });
      out[key] = merged;
    });
    out.byMonth = Object.assign({}, out.byMonth || {});
    Object.entries(next.byMonth || {}).forEach(([month, count]) => {
      out.byMonth[month] = Number(out.byMonth[month] || 0) + Number(count || 0);
    });
    out.sessions = Math.max(Number(out.sessions || 0), Number(next.sessions || 0));
    out.active = Boolean(out.active || next.active);
    out.bio = Object.assign({}, next.bio || {}, out.bio || {});
    return out;
  }

  function canonicalRosterVolunteers(data, liveMap) {
    const merged = {};
    (data.volunteers || []).forEach((volunteer) => {
      const key = canonicalNameKey(volunteer.name);
      if (isSuppressedCreditKey(key)) return;
      if (!key) return;
      merged[key] = mergeVolunteer(merged[key], volunteer);
    });
    Object.values(liveMap || {}).forEach((row) => {
      const key = canonicalNameKey(row.label);
      if (isSuppressedCreditKey(key)) return;
      if (!key) return;
      merged[key] = mergeVolunteer(merged[key], {
        name: row.label,
        slug: slugifyName(row.label),
        sessions: Number(row.records || 0),
        tracks: [],
        active: true,
        log: []
      });
    });
    return Object.entries(merged).map(([key, volunteer]) => {
      const display = canonicalDisplayName(key, volunteer.name);
      if (display) {
        volunteer.name = display;
        volunteer.slug = slugifyName(display);
      }
      return volunteer;
    });
  }

  function contributionRosterVolunteers(data, liveMap) {
    const rosterIndex = {};
    canonicalRosterVolunteers(data, liveMap).forEach((volunteer) => {
      rosterIndex[canonicalNameKey(volunteer.name)] = volunteer;
    });

    const merged = {};
    Object.values(liveMap || {}).forEach((row) => {
      const key = canonicalNameKey(row.label);
      if (isSuppressedCreditKey(key)) return;
      if (!key) return;
      merged[key] = mergeVolunteer(merged[key], rosterIndex[key]);
      merged[key] = mergeVolunteer(merged[key], {
        name: row.label,
        slug: slugifyName(row.label),
        sessions: Number(row.records || 0),
        currentRecords: Number(row.records || 0),
        currentPageRows: Number(row.pageRows || 0),
        currentActivityRows: Number(row.activityRows || 0),
        active: true,
        tracks: [],
        log: []
      });
    });

    const trackSummary = getLiveTrackSummary();
    (Array.isArray(trackSummary?.people) ? trackSummary.people : []).forEach((name) => {
      publicPeopleFromLabel(name).forEach((person) => {
        const key = person.key;
        if (isSuppressedCreditKey(key)) return;
        if (!key) return;
        merged[key] = mergeVolunteer(merged[key], rosterIndex[key]);
        merged[key] = mergeVolunteer(merged[key], {
          name: person.label,
          slug: slugifyName(person.label),
          sessions: 0,
          active: Boolean(merged[key] && merged[key].active),
          tracks: [],
          log: []
        });
      });
    });

    normalizeTrackRows(Array.isArray(trackSummary?.tracks) ? trackSummary.tracks : []).forEach((track) => {
      (Array.isArray(track.people) ? track.people : []).forEach((name) => {
        publicPeopleFromLabel(name).forEach((person) => {
          const key = person.key;
          if (isSuppressedCreditKey(key)) return;
          if (!key || !merged[key]) return;
          merged[key] = mergeVolunteer(merged[key], {
            name: person.label,
            slug: slugifyName(person.label),
            sessions: 1,
            tracks: [track.key || "diger"],
            active: Boolean(merged[key].active),
            log: []
          });
        });
      });
    });

    const values = Object.entries(merged).map(([key, volunteer]) => {
      const display = canonicalDisplayName(key, volunteer.name);
      if (display) {
        volunteer.name = display;
        volunteer.slug = slugifyName(display);
      }
      volunteer.currentRecords = Number(volunteer.currentRecords || 0);
      volunteer.currentPageRows = Number(volunteer.currentPageRows || 0);
      volunteer.currentActivityRows = Number(volunteer.currentActivityRows || 0);
      volunteer.isCurrent = volunteer.currentRecords > 0;
      return volunteer;
    });

    if (values.length) return values;
    return canonicalRosterVolunteers(data, liveMap);
  }

  function publicPeopleFromLabel(label) {
    const seen = {};
    String(label || "")
      .split(/\s*(?:,|;|\n|\s+-\s+)\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((name) => {
        if (isNonPersonLabel(name)) return;
        const key = canonicalNameKey(name);
        if (isSuppressedCreditKey(key)) return;
        if (!key) return;
        seen[key] = canonicalDisplayName(key, name);
      });
    return Object.keys(seen).map((key) => ({ key, label: seen[key] }));
  }

  function isNonPersonLabel(label) {
    const key = canonicalNameKey(label);
    return key === "gonullu toplantisi" || key === "toplanti" || key === "gonullu toplanti";
  }

  // -------------------------------------------------------------------
  // 1. Cumulative ribbon
  // -------------------------------------------------------------------
  function renderRibbon(data) {
    const mount = safeMount("lpCumulativeRibbon");
    if (!mount || !data) return;

    const c = data.cumulative || {};
    const summary = getLiveSummary();
    const liveTrackSummary = getLiveTrackSummary();
    const months = trackMonths(liveTrackSummary, data);
    const firstMonth = months[0] || (c.firstActivityDate ? c.firstActivityDate.slice(0, 7) : "");
    const lastMonth = months[months.length - 1] || (summary?.period?.endDate || c.latestActivityDate || "").slice(0, 7);
    const periodLabel =
      firstMonth && lastMonth
        ? `${firstMonth.replace("-", "/")} — ${lastMonth.replace("-", "/")}`
        : "Ocak — Mayıs 2026";
    const cumulativeSessions = liveTrackSummary ? trackSessions(liveTrackSummary) : c.sessions;
    const normalizedCumulativeTracks = normalizeTrackRows(liveTrackSummary ? liveTrackSummary.tracks : data.tracks);
    const cumulativeTracks = normalizedCumulativeTracks.length || c.tracks;
    const cumulativeActiveVolunteers = liveTrackSummary && trackSummaryPeopleCount(liveTrackSummary)
      ? trackSummaryPeopleCount(liveTrackSummary)
      : c.activeVolunteers;
    const cumulativePeopleLabel = liveTrackSummary ? "katkı veren" : "aktif gönüllü";

    // For "recent period" stats we read whatever the existing dashboard
    // has already computed on window.TVF_PUBLIC_DATA. If it's not
    // there we hide the right half.
    const thisWeek = (summary && summary.totals) || null;
    const periodDetailRows = thisWeek ? Number(thisWeek.pageRows || thisWeek.periodPagesDone || 0) : 0;
    const tw = thisWeek
      ? `<div class="rb this-week">
           <p class="k">Güncel dönem <em>${esc(periodRangeLabel(summary.period || {}))}</em></p>
           <div class="stat-row">
             <div class="stat"><span class="v">+${fmt(periodDetailRows)}</span><span class="l">arşiv detayı</span></div>
             <div class="stat"><span class="v">${fmt(thisWeek.volunteersActive || 0)}</span><span class="l">aktif gönüllü</span></div>
             <div class="stat"><span class="v">${fmt(thisWeek.boxesActive || 0)}</span><span class="l">aktif kutu</span></div>
           </div>
         </div>`
      : "";

    mount.innerHTML = `
      <div class="rb cumulative">
        <p class="k">Kümülatif <em>${esc(periodLabel)}</em></p>
        <div class="stat-row">
          <div class="stat"><span class="v">${fmt(cumulativeActiveVolunteers)}</span><span class="l">${esc(cumulativePeopleLabel)}</span></div>
          <div class="stat"><span class="v">${fmt(cumulativeSessions)}</span><span class="l">çalışma oturumu</span></div>
          <div class="stat"><span class="v">${fmt(cumulativeTracks)}</span><span class="l">paralel iş alanı</span></div>
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
    const liveTrackSummary = getLiveTrackSummary();
    const trackData = liveTrackSummary || data;
    const trackRows = normalizeTrackRows(Array.isArray(trackData?.tracks) ? trackData.tracks : []);
    if (!mount || !data) return;
    if (trackRows.length === 0) {
      mount.setAttribute("hidden", "");
      return;
    }

    const months = trackMonths(trackData, data);

    const monthCols = months
      .map((ym) => `<span>${MONTHS_TR[Number(ym.slice(5, 7))]}</span>`)
      .join("");

    // For each track, place a dot per month present in track.byMonth.
    // Dot diameter scales with sessions (4..16 px).
    function dotSize(sessions) {
      const s = Number(sessions) || 1;
      return Math.max(4, Math.min(16, 4 + Math.round(s * 1.5)));
    }

    const orderIndex = Object.fromEntries(TRACK_ORDER.map((key, idx) => [key, idx]));
    const tracksSorted = [...trackRows].sort((a, b) => {
      return Number(b.sessions || 0) - Number(a.sessions || 0)
        || (orderIndex[a.key] ?? 999) - (orderIndex[b.key] ?? 999)
        || String(a.label || "").localeCompare(String(b.label || ""), "tr");
    });

    const laneRows = tracksSorted.map((t) => {
      const meta = TRACK_META[t.key] || TRACK_META.diger;
      const monthsHas = Object.assign({}, t.byMonth || {});
      const dots = months.map((ym, i) => {
        const n = monthsHas[ym];
        if (!n) return "";
        // place the dot in the middle of its month column (5 columns, so 10%, 30%, 50%, 70%, 90%)
        const x = (i + 0.5) * (100 / months.length);
        const sz = dotSize(n);
        return `<span class="pt" style="left:${x.toFixed(1)}%; width:${sz}px; height:${sz}px; background:${meta.color}" title="${MONTHS_TR[Number(ym.slice(5, 7))]}: ${n} oturum"></span>`;
      }).join("");

      return `
        <div class="lane-label"><span class="dot" style="background:${meta.color}"></span>${esc(meta.label || t.label || TRACK_META.diger.label)}</div>
        <div class="lane" style="background:${meta.lane}">${dots}</div>
        <div class="total" style="color:${meta.color}">${Number(t.sessions || 0)}</div>`;
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
    const liveTracks = normalizeTrackRows(liveTrackRows());
    const useLiveTracks = liveTracks.length > 0;
    const vols = useLiveTracks ? [] : (data.volunteers || []).filter((v) => v.active);
    const hasVisibleRows = useLiveTracks
      ? liveTracks.some((track) => Array.isArray(track.contributors) && track.contributors.length)
      : vols.length > 0;
    if (!hasVisibleRows) {
      mount.innerHTML = "";
      mount.setAttribute("hidden", "");
      const metaEl = document.getElementById("lpActiveWallMeta");
      const summary = getLiveSummary();
      if (metaEl && useLiveTracks && summary?.period?.label) {
        metaEl.textContent = `0 kişi · ${periodContextLabel(summary.period)} · canlı`;
      }
      return;
    }
    mount.removeAttribute("hidden");
    const groups = useLiveTracks ? liveTracksToGroups(liveTracks, byName) : {};
    if (!useLiveTracks) {
      vols.forEach((v) => {
        const tk = (v.tracks && v.tracks[0]) || "diger";
        (groups[tk] ||= []).push(v);
      });
    }

    const html = TRACK_ORDER
      .filter((tk) => groups[tk])
      .map((tk) => {
        const meta = TRACK_META[tk] || TRACK_META.diger;
        const grp = groups[tk];
        const sessions = grp.reduce((s, v) => s + (v.sessions || 0), 0);
        const unit = useLiveTracks ? "kayıt" : "oturum";
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
      const label = useLiveTracks && summary?.period ? `${periodContextLabel(summary.period)} · canlı` : "aktif gönüllü";
      const count = useLiveTracks
        ? uniqueLiveTrackPeople(liveTracks)
        : vols.length;
      metaEl.textContent = useLiveTracks ? `${count} kişi · ${label}` : `${vols.length} aktif gönüllü`;
    }
  }

  function liveTracksToGroups(liveTracks, byName) {
    const groups = {};
    liveTracks.forEach((track) => {
      const key = track.key || "diger";
      const contributors = Array.isArray(track.contributors) ? track.contributors : [];
      groups[key] = contributors.map((row) => {
        const name = String(row.label || "").trim();
        const rosterVol = byName[canonicalNameKey(name)];
        return {
          name,
          slug: (rosterVol && rosterVol.slug) || slugifyName(name),
          tracks: [key],
          sessions: Number(row.records || row.pageRows || row.activityRows || 0)
        };
      }).filter((v) => v.name);
    });
    return groups;
  }

  function uniqueLiveTrackPeople(liveTracks) {
    const names = new Set();
    liveTracks.forEach((track) => {
      (track.contributors || []).forEach((row) => {
        const key = canonicalNameKey(row.label);
        if (key) names.add(key);
      });
    });
    return names.size;
  }

  // -------------------------------------------------------------------
  // 4. Full kadro / census (Design B) — every name, alphabetical
  // -------------------------------------------------------------------
  function renderKadro(data) {
    const mount = safeMount("lpKadro");
    if (!mount || !data) return;
    const liveMap = liveVolunteerMap();
    const vols = contributionRosterVolunteers(data, liveMap);
    if (vols.length === 0) {
      mount.setAttribute("hidden", "");
      return;
    }

    const current = vols
      .filter((v) => v.isCurrent)
      .sort((a, b) => Number(b.currentRecords || 0) - Number(a.currentRecords || 0) || a.name.localeCompare(b.name, "tr"));
    const previous = vols
      .filter((v) => !v.isCurrent)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    function rowHtml(v, muted) {
      const meta = kadroMeta(v);
      return `<span class="row${muted}" data-slug="${esc(v.slug || "")}" data-volunteer-label="${esc(v.name)}" role="button" tabindex="0" aria-label="${esc(v.name)} profilini aç">
        <span class="marker"></span><span class="nm">${esc(v.name)}</span>${
          meta ? `<span class="meta">${meta}</span>` : ""
        }
      </span>`;
    }

    const currentRows = current.map((v) => rowHtml(v, "")).join("");
    const previousRows = previous.map((v) => rowHtml(v, " muted")).join("");

    mount.classList.add("tv-kadro");
    mount.innerHTML = `
      <p class="roll-intro">
        Liste canlı katkı kayıtlarından derlenir: güncel dönem çalışanları
        önce, daha önce görünür katkı vermiş kişiler sonra gelir.
      </p>
      ${currentRows ? `<div class="roll-group"><p class="roll-group-title">Güncel dönem katkı verenleri</p><div class="roll current-roll">${currentRows}</div></div>` : ""}
      ${previousRows ? `<div class="roll-group previous"><p class="roll-group-title">Önceki katkı verenler</p><div class="roll previous-roll">${previousRows}</div></div>` : ""}
      <div class="roll-legend">
        <span class="lg"><span class="mk"></span>Güncel dönemde görünür katkı veren</span>
        <span class="lg"><span class="mk muted"></span>Önceki katkı kaydı var</span>
      </div>`;

    const metaEl = document.getElementById("lpKadroMeta");
    if (metaEl) {
      metaEl.textContent = `${current.length} güncel · ${vols.length} katkı veren`;
    }
  }

  function kadroMeta(v) {
    if (v.isCurrent) {
      const bits = [`${fmt(v.currentRecords)} güncel kayıt`];
      if (v.currentPageRows) bits.push(`${fmt(v.currentPageRows)} sayfa/detay`);
      if (v.currentActivityRows) bits.push(`${fmt(v.currentActivityRows)} çalışma`);
      return bits.join(" · ");
    }
    const tracks = (v.tracks || [])
      .slice(0, 2)
      .map((track) => (TRACK_META[track] && TRACK_META[track].label) || TRACK_META.diger.label);
    if (tracks.length) return tracks.join(" · ");
    return [v.city, v.role].filter(Boolean).join(" · ");
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
