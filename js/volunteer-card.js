// volunteer-card.js
// ---------------------------------------------------------------------
// Slide-in profile drawer for any volunteer.
//
//   • Click any badge in #lpActiveWall or any row in #lpKadro
//   • Or load index.html#g/<slug>   (deep link)
//
// Renders from window.TVF_ROSTER, the same data the section renderers
// use. Adds no other dependency.
// ---------------------------------------------------------------------

(function () {
  "use strict";

  const TRACK_META = {
    tarama:          { label: "Tarama",                  color: "#601040" },
    tarama_is_bankasi: { label: "Tarama (İş Bankası Müzesi)", color: "#7a174d" },
    envanter:        { label: "Envanter",                color: "#8a2a62" },
    kurumsal_bellek: { label: "Kurum belleği",           color: "#3b6d11" },
    osmanlica:       { label: "Osmanlıca çeviri",        color: "#BA7517" },
    proje_basvuru:   { label: "Proje çalışmaları",       color: "#185fa5" },
    egitim:          { label: "Eğitim",                  color: "#534AB7" },
    ars_web:         { label: "Arşiv-web & IT",          color: "#444441" },
    koordinasyon:    { label: "Koordinasyon",            color: "#888780" },
    kodlama_kontrol: { label: "Kodlama & kontrol",       color: "#185fa5" },
    diger:           { label: "Diğer",                   color: "#74686e" },
  };

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

  const SOCIAL_ICONS = {
    website:  { label: "Web sitesi",  prefix: "" },
    twitter:  { label: "Twitter/X",   prefix: "https://x.com/" },
    linkedin: { label: "LinkedIn",    prefix: "https://www.linkedin.com/in/" },
    github:   { label: "GitHub",      prefix: "https://github.com/" },
    orcid:    { label: "ORCID",       prefix: "https://orcid.org/" },
    scholar:  { label: "Scholar",     prefix: "" },
    email:    { label: "E-posta",     prefix: "mailto:" },
  };

  // --- helpers ---------------------------------------------------------
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmt(n) {
    if (n == null) return "—";
    return Number(n).toLocaleString("tr-TR");
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${parseInt(d, 10)} ${MONTHS_TR[parseInt(m, 10)]?.toLowerCase() || ""} ${y}`;
  }
  function foldName(value) {
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
    return foldName(value).replace(/\s+/g, "-") || "gonullu";
  }
  function canonicalNameKey(value) {
    const key = foldName(value);
    return NAME_ALIASES[key] || key;
  }
  function isSuppressedCreditKey(key) {
    return SUPPRESSED_LEGACY_CREDIT_KEYS.has(key);
  }
  function isSuppressedName(value) {
    return isSuppressedCreditKey(canonicalNameKey(String(value || "").replace(/-/g, " ")));
  }
  function canonicalDisplayName(key, fallback) {
    return CANONICAL_DISPLAY_NAMES[key] || fallback;
  }
  function formatBoxLabel(box) {
    const text = String(box || "").trim();
    if (!text) return "";
    return /^kutu\b/i.test(text) ? text : `Kutu ${text}`;
  }

  function findVolBySlug(slug) {
    if (isSuppressedName(slug)) return null;
    const data = window.TVF_ROSTER;
    const slugName = String(slug || "").replace(/-/g, " ");
    const rosterVol = data && Array.isArray(data.volunteers)
      ? (data.volunteers || []).find((v) => {
          if (isSuppressedName(v && v.name)) return false;
          return v.slug === slug
            || slugifyName(v.name) === slug
            || canonicalNameKey(v.name) === canonicalNameKey(slugName);
        })
      : null;
    const liveVol = synthesizeLiveVolunteer(slug);
    if (!rosterVol) return liveVol;
    if (!liveVol) {
      const key = canonicalNameKey(rosterVol.name);
      const name = canonicalDisplayName(key, rosterVol.name);
      return Object.assign({}, rosterVol, {
        name,
        slug: slugifyName(name)
      });
    }
    const key = canonicalNameKey(liveVol.name || rosterVol.name);
    return Object.assign({}, rosterVol, {
      name: canonicalDisplayName(key, liveVol.name || rosterVol.name),
      slug: slugifyName(canonicalDisplayName(key, liveVol.name || rosterVol.name)),
      sessions: liveVol.sessions || rosterVol.sessions,
      tracks: liveVol.tracks && liveVol.tracks.length ? liveVol.tracks : rosterVol.tracks,
      boxes: liveVol.boxes && liveVol.boxes.length ? liveVol.boxes : rosterVol.boxes,
      log: liveVol.log && liveVol.log.length ? liveVol.log : rosterVol.log,
      byMonth: Object.assign({}, rosterVol.byMonth || {}, liveVol.byMonth || {}),
      active: true
    });
  }

  function synthesizeLiveVolunteer(slugOrName) {
    if (isSuppressedName(slugOrName)) return null;
    const payload = window.TVF_PUBLIC_DATA || {};
    const summary = payload.publicSummary || {};
    const rows = Array.isArray(summary.byVolunteer) ? summary.byVolunteer : [];
    const folded = foldName(String(slugOrName || "").replace(/-/g, " "));
    const volunteerLog = findVolunteerLog(slugOrName, payload);
    const row = rows.find((item) => {
      const label = String(item.label || "");
      if (isSuppressedName(label)) return false;
      return slugifyName(label) === slugOrName || canonicalNameKey(label) === (NAME_ALIASES[folded] || folded);
    });
    if (!row && !volunteerLog) return null;
    const sourceLabel = (volunteerLog && (volunteerLog.label || volunteerLog.name)) || (row && row.label) || slugOrName;
    const labelKey = canonicalNameKey(sourceLabel);
    if (isSuppressedCreditKey(labelKey)) return null;
    const label = canonicalDisplayName(labelKey, String(sourceLabel || "").trim());
    const log = buildLiveVolunteerLog(label, summary, payload, volunteerLog);
    const trackKeys = liveTrackKeys(label, summary, volunteerLog, log);
    const boxes = liveBoxes(row, volunteerLog, log);
    const byMonthDates = {};
    log.forEach((entry) => {
      const iso = entry.date;
      const month = iso && iso.slice(0, 7);
      if (!month) return;
      if (!byMonthDates[month]) byMonthDates[month] = {};
      byMonthDates[month][iso] = true;
    });
    const byMonth = {};
    Object.keys(byMonthDates).forEach((month) => {
      byMonth[month] = Object.keys(byMonthDates[month]).length;
    });
    const distinctDays = {};
    log.forEach((entry) => { if (entry.date) distinctDays[entry.date] = true; });
    const sessions = Number(
      (volunteerLog && volunteerLog.sessions)
      || Object.keys(distinctDays).length
      || (row && row.records)
      || 0
    );
    return {
      name: label,
      slug: slugifyName(label),
      city: "",
      role: (row && row.publicRole) || (volunteerLog && volunteerLog.publicRole) || "",
      tv_role: (row && row.publicRole) || (volunteerLog && volunteerLog.publicRole) || "Gönüllü",
      uni: "",
      dept: "",
      topics: [],
      slots: [],
      sessions,
      tracks: trackKeys.length ? trackKeys : ["diger"],
      byMonth,
      scanners: [],
      boxes,
      firstSeen: null,
      lastSeen: log[0] ? log[0].date : null,
      active: true,
      log,
      bio: {}
    };
  }

  function findVolunteerLog(slugOrName, payload) {
    const logs = payload
      && payload.content
      && Array.isArray(payload.content.volunteerLogs)
      ? payload.content.volunteerLogs
      : [];
    const slug = String(slugOrName || "");
    const folded = canonicalNameKey(slug.replace(/-/g, " "));
    return logs.find((item) => {
      const label = String((item && (item.label || item.name)) || "");
      if (!label || isSuppressedName(label)) return false;
      return item.slug === slug
        || slugifyName(label) === slug
        || canonicalNameKey(label) === folded;
    }) || null;
  }

  function liveTrackKeys(label, summary, volunteerLog, log) {
    const keys = [];
    (Array.isArray(volunteerLog && volunteerLog.tracks) ? volunteerLog.tracks : []).forEach((track) => {
      const key = normalizeTrackKey(track && track.key, track && track.label);
      if (key && keys.indexOf(key) < 0) keys.push(key);
    });
    (summary.byTrack || []).forEach((track) => {
      const contributors = Array.isArray(track.contributors) ? track.contributors : [];
      if (contributors.some((item) => canonicalNameKey(item.label) === canonicalNameKey(label))) {
        const key = normalizeTrackKey(track.key || "diger", track.label || "");
        if (keys.indexOf(key) < 0) keys.push(key);
      }
    });
    (log || []).forEach((entry) => {
      const key = normalizeTrackKey(entry.track, entry.calisma + " " + entry.devam);
      if (key && keys.indexOf(key) < 0) keys.push(key);
    });
    return keys;
  }

  function liveBoxes(row, volunteerLog, log) {
    const boxes = [];
    function add(box) {
      const label = formatBoxLabel(box);
      if (label && boxes.indexOf(label) < 0) boxes.push(label);
    }
    (row && Array.isArray(row.boxes) ? row.boxes : []).forEach(add);
    (volunteerLog && Array.isArray(volunteerLog.boxes) ? volunteerLog.boxes : []).forEach(add);
    (log || []).forEach((entry) => add(entry.boxLabel));
    return boxes;
  }

  function buildLiveVolunteerLog(label, summary, payload, volunteerLog) {
    if (volunteerLog && Array.isArray(volunteerLog.entries) && volunteerLog.entries.length) {
      return dedupeLogRows(volunteerLog.entries.map((entry) => logRowFromContentEntry(entry)));
    }
    const rows = [];
    (Array.isArray(summary.byDay) ? summary.byDay : []).forEach((day) => {
      const contributors = (Array.isArray(day.contributors) ? day.contributors : [])
        .concat(Array.isArray(day.coordination) ? day.coordination : []);
      contributors.forEach((item) => {
        if (canonicalNameKey(item.label) !== canonicalNameKey(label)) return;
        const workRows = Array.isArray(item.workRows) ? item.workRows : [];
        if (workRows.length) {
          workRows.forEach((work) => rows.push(logRowFromWorkRow(day, item, work, summary)));
        } else {
          rows.push(logRowFromDayContributor(day, item, summary));
        }
      });
    });
    (Array.isArray(payload.latestActivity) ? payload.latestActivity : []).forEach((entry) => {
      if (canonicalNameKey(entry.volunteerLabel) !== canonicalNameKey(label)) return;
      rows.push(logRowFromLatest(entry, summary));
    });
    return dedupeLogRows(rows);
  }

  function logRowFromContentEntry(entry) {
    const track = normalizeTrackKey(entry.track || "diger", [entry.trackLabel, entry.workTitle, entry.workDetail].join(" "));
    return {
      date: entry.dateISO || "",
      track,
      calisma: entry.workTitle || entry.trackLabel || ((entry.kind === "activity") ? "Faaliyet kaydı" : "Sayfa/detay satırı"),
      devam: entry.workDetail || entry.boxLabel || measureText(entry),
      notes: measureText(entry),
      scanner: "",
      computer: "",
      records: Number(entry.records || 0),
      pageRows: Number(entry.pageRows || 0),
      activityRows: Number(entry.activityRows || 0),
      pagesDone: Number(entry.pagesDone || 0),
      boxLabel: entry.boxLabel || ""
    };
  }

  function logRowFromWorkRow(day, contributor, work, summary) {
    return {
      date: day.dateISO || work.dateISO || "",
      track: trackKeyForWork(work, contributor, summary),
      calisma: work.workTitle || ((work.kind === "activity") ? "Faaliyet kaydı" : "Sayfa/detay satırı"),
      devam: work.workDetail || work.boxLabel || measureText(work),
      notes: measureText(work),
      scanner: "",
      computer: "",
      records: Number(work.records || contributor.records || 0),
      pageRows: Number(work.pageRows || 0),
      activityRows: Number(work.activityRows || 0),
      pagesDone: Number(work.pagesDone || 0),
      boxLabel: work.boxLabel || ""
    };
  }

  function logRowFromDayContributor(day, contributor, summary) {
    const track = trackKeyForContributor(contributor, summary);
    return {
      date: day.dateISO || "",
      track,
      calisma: TRACK_META[track]?.label || "Çalışma kaydı",
      devam: [measureText(contributor), (day.boxLabels || []).join(", ")].filter(Boolean).join(" · "),
      notes: "",
      scanner: "",
      computer: "",
      records: Number(contributor.records || 0),
      pageRows: Number(contributor.pageRows || 0),
      activityRows: Number(contributor.activityRows || 0),
      pagesDone: Number(contributor.pagesDone || 0),
      boxLabel: (day.boxLabels && day.boxLabels[0]) || ""
    };
  }

  function logRowFromLatest(entry, summary) {
    const track = trackKeyForLiveEntry(entry, summary);
    return {
      date: entry.dateISO || String(entry.when || "").slice(0, 10),
      track,
      calisma: entry.workTitle || (entry.kind === "activity" ? "Faaliyet kaydı" : "Sayfa/detay satırı"),
      devam: entry.workDetail || entry.boxLabel || measureText(entry),
      notes: measureText(entry),
      scanner: "",
      computer: "",
      records: Number(entry.records || 1),
      pageRows: entry.kind === "page" ? Number(entry.records || 1) : 0,
      activityRows: entry.kind === "activity" ? Number(entry.records || 1) : 0,
      pagesDone: Number(entry.pagesDone || 0),
      boxLabel: entry.boxLabel || ""
    };
  }

  function dedupeLogRows(rows) {
    const seen = {};
    // Drop rows whose date is a sheet typo in the far future (e.g. 2027/2028
    // autofill drift) so they cannot sit on top of the activity list.
    const maxDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const maxISO = maxDate.toISOString().slice(0, 10);
    return (rows || []).filter((row) => row && row.date && row.date <= maxISO).filter((row) => {
      const key = [
        row.date,
        row.track,
        row.calisma,
        row.devam,
        row.records,
        row.pageRows,
        row.activityRows,
        row.pagesDone,
        row.boxLabel
      ].join("|");
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort((a, b) => {
      return String(b.date || "").localeCompare(String(a.date || ""))
        || Number(b.records || 0) - Number(a.records || 0)
        || String(a.calisma || "").localeCompare(String(b.calisma || ""), "tr");
    });
  }

  function measureText(row) {
    const bits = [];
    if (Number(row.pagesDone || 0)) bits.push(`${fmt(row.pagesDone)} sayfa/detay`);
    else if (Number(row.pageRows || 0)) bits.push(`${fmt(row.pageRows)} sayfa/detay`);
    if (Number(row.activityRows || 0)) bits.push(`${fmt(row.activityRows)} faaliyet`);
    if (!bits.length && Number(row.records || 0)) bits.push(`${fmt(row.records)} kayıt`);
    return bits.join(" · ");
  }

  function normalizeTrackKey(key, haystack) {
    const raw = String(key || "diger");
    const text = foldName(haystack || "");
    if ((raw === "egitim" || raw === "tarama") && text.indexOf("is bankasi") >= 0) return "tarama_is_bankasi";
    return TRACK_META[raw] ? raw : "diger";
  }

  function trackKeyForWork(work, contributor, summary) {
    const text = [work.workTitle, work.workDetail, work.boxLabel].filter(Boolean).join(" ");
    if (foldName(text).indexOf("is bankasi") >= 0) return "tarama_is_bankasi";
    if (work.kind === "page" || Number(work.pageRows || work.pagesDone || 0) > 0) return "tarama";
    return trackKeyForContributor(contributor, summary);
  }

  function trackKeyForContributor(contributor, summary) {
    const label = canonicalNameKey(contributor && contributor.label);
    const candidates = Array.isArray(summary.byTrack) ? summary.byTrack : [];
    for (const track of candidates) {
      const contributors = Array.isArray(track.contributors) ? track.contributors : [];
      if (contributors.some((item) => canonicalNameKey(item.label) === label)) {
        return normalizeTrackKey(track.key || "diger", track.label || "");
      }
    }
    if (Number(contributor && (contributor.pageRows || contributor.pagesDone || 0)) > 0) return "tarama";
    return "diger";
  }

  function trackKeyForLiveEntry(entry, summary) {
    const text = [entry.workTitle, entry.workDetail, entry.boxLabel, entry.material].filter(Boolean).join(" ");
    if (foldName(text).indexOf("is bankasi") >= 0) return "tarama_is_bankasi";
    const label = canonicalNameKey(entry.volunteerLabel);
    const candidates = Array.isArray(summary.byTrack) ? summary.byTrack : [];
    for (const track of candidates) {
      const contributors = Array.isArray(track.contributors) ? track.contributors : [];
      if (contributors.some((item) => canonicalNameKey(item.label) === label)) return normalizeTrackKey(track.key || "diger", track.label || "");
    }
    if (entry.kind === "page") return "tarama";
    return "diger";
  }

  // --- DOM construction ------------------------------------------------
  let backdrop, drawer;

  function ensureScaffold() {
    if (drawer) return;
    backdrop = document.createElement("div");
    backdrop.className = "tv-drawer-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", closeDrawer);
    document.body.appendChild(backdrop);

    drawer = document.createElement("aside");
    drawer.className = "tv-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "tv-drawer-title");
    drawer.setAttribute("tabindex", "-1");
    document.body.appendChild(drawer);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("open")) {
        closeDrawer();
      }
    });
  }

  function renderDrawerBody(v) {
    const subParts = [v.role, v.uni, v.city].filter(Boolean);
    const sub = subParts.map(esc).join(" · ");
    const bio = v.bio || {};

    // Stats grid
    const stats = `
      <div class="dr-stats">
        <div class="st"><span class="v">${fmt(v.sessions)}</span><span class="l">oturum</span></div>
        <div class="st"><span class="v">${fmt((v.tracks || []).length)}</span><span class="l">iş alanı</span></div>
        <div class="st"><span class="v">${fmt((v.boxes || []).length)}</span><span class="l">kutu</span></div>
      </div>`;

    // Narrative blocks
    const narrative =
      bio.shortRole || bio.tvNarrative || bio.narrative
        ? `<div class="dr-block">
             <p class="dr-block-head">Hakkında</p>
             ${bio.shortRole    ? `<p class="dr-narrative"><em>${esc(bio.shortRole)}</em></p>`    : ""}
             ${bio.tvNarrative  ? `<p class="dr-narrative">${esc(bio.tvNarrative)}</p>`           : ""}
             ${bio.narrative    ? `<p class="dr-narrative">${esc(bio.narrative)}</p>`             : ""}
           </div>`
        : "";

    // Per-track breakdown
    let tracksHtml = "";
    if (Array.isArray(v.tracks) && v.tracks.length) {
      // Group log by track to count sessions per track
      const counts = {};
      (v.log || []).forEach((s) => {
        const key = normalizeTrackKey(s.track, [s.calisma, s.devam, s.notes].filter(Boolean).join(" "));
        counts[key] = (counts[key] || 0) + 1;
      });
      // Backfill tracks that exist in v.tracks but not in counts (rare)
      if (!Object.keys(counts).length) {
        v.tracks.forEach((t) => {
          const key = normalizeTrackKey(t, "");
          if (!(key in counts)) counts[key] = 0;
        });
      }
      const rows = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => {
          const meta = TRACK_META[t] || TRACK_META.diger;
          return `<div class="tr-row">
            <span class="dot" style="background:${meta.color}"></span>
            <span>${esc(meta.label)}</span>
            <span class="ct">${n}</span>
          </div>`;
        })
        .join("");
      tracksHtml = `
        <div class="dr-block">
          <p class="dr-block-head">İş alanlarına göre</p>
          <div class="dr-tracks">${rows}</div>
        </div>`;
    }

    // Monthly sparkline
    let sparkHtml = "";
    if (v.byMonth && Object.keys(v.byMonth).length) {
      // Axis = union of the roster snapshot's month window and the months the
      // volunteer actually has data for. The snapshot window alone goes stale
      // (e.g. frozen at OCA–MAY while live work is in TEM–AĞU), which used to
      // render an all-empty chart.
      const monthSet = {};
      (window.TVF_ROSTER.monthsActive || []).forEach((m) => { monthSet[m] = true; });
      Object.keys(v.byMonth).forEach((m) => { monthSet[m] = true; });
      const months = Object.keys(monthSet).sort().slice(-8);
      const counts = months.map((m) => v.byMonth[m] || 0);
      const max = Math.max(1, ...counts);
      const bars = counts
        .map(
          (c, i) =>
            `<div class="bar" data-empty="${c === 0 ? 1 : 0}" style="height:${Math.max(2, (c / max) * 100)}%" title="${months[i]}: ${c} oturum"></div>`
        )
        .join("");
      const labels = months
        .map((m) => `<span>${MONTHS_TR[parseInt(m.slice(5, 7), 10)]}</span>`)
        .join("");
      sparkHtml = `
        <div class="dr-block">
          <p class="dr-block-head">Aylık dağılım</p>
          <div class="dr-spark">${bars}</div>
          <div class="dr-spark-labels">${labels}</div>
        </div>`;
    }

    // Recent activity log
    let logHtml = "";
    if (Array.isArray(v.log) && v.log.length) {
      const rows = v.log.map((s) => {
        const trackKey = normalizeTrackKey(s.track, [s.calisma, s.devam, s.notes].filter(Boolean).join(" "));
        const trMeta = TRACK_META[trackKey] || TRACK_META.diger;
        const what = s.devam || s.calisma || trMeta.label;
        const extras = [
          measureText(s),
          s.scanner ? `tarayıcı: ${s.scanner}` : "",
          s.notes && s.notes.length < 140 ? s.notes : "",
        ].filter((item, idx, arr) => item && arr.indexOf(item) === idx);
        return `<div class="log-row">
          <p class="when">${esc(fmtDate(s.date))} · ${esc(trMeta.label)}</p>
          <p class="what">${esc(what)}</p>
          ${extras.length ? `<p class="extra">${esc(extras.join(" · "))}</p>` : ""}
        </div>`;
      }).join("");
      logHtml = `
        <div class="dr-block">
          <p class="dr-block-head">Tüm faaliyetler</p>
          <div class="dr-log">${rows}</div>
        </div>`;
    } else if (v.active === false) {
      logHtml = `
        <div class="dr-block">
          <p class="dr-empty">Kadroda; bu dönemde henüz görünür çalışma kaydı yok. Zaman çizelgesinde ayrılmış slotlar: ${
            v.slots && v.slots.length ? esc(v.slots.join(", ")) : "—"
          }${v.topics && v.topics.length ? `. Konu: ${esc(v.topics.join(", "))}` : ""}.</p>
        </div>`;
    }

    // Social / contact
    let linksHtml = "";
    const linkEntries = Object.entries(SOCIAL_ICONS)
      .map(([k, meta]) => {
        const val = (bio[k] || "").trim();
        if (!val) return null;
        let href;
        if (/^https?:\/\//i.test(val) || val.startsWith("mailto:")) {
          href = val;
        } else if (k === "email") {
          href = "mailto:" + val;
        } else {
          href = meta.prefix + val.replace(/^@/, "");
        }
        return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(meta.label)}</a>`;
      })
      .filter(Boolean);
    if (linkEntries.length) {
      linksHtml = `
        <div class="dr-block">
          <p class="dr-block-head">Bağlantılar</p>
          <div class="dr-links">${linkEntries.join("")}</div>
        </div>`;
    }

    // Footprint: scanners + boxes
    let extrasHtml = "";
    const fpParts = [];
    if (v.boxes && v.boxes.length) {
      fpParts.push(`Kutular: ${v.boxes.map((b) => esc(formatBoxLabel(b))).join(", ")}`);
    }
    if (v.scanners && v.scanners.length) {
      fpParts.push(`Tarayıcılar: ${v.scanners.map(esc).join(", ")}`);
    }
    if (v.firstSeen) {
      fpParts.push(`İlk görünür kayıt: ${esc(fmtDate(v.firstSeen))}`);
    }
    if (fpParts.length) {
      extrasHtml = `
        <div class="dr-block">
          <p class="dr-block-head">Detaylar</p>
          ${fpParts.map((p) => `<p class="dr-narrative" style="font-size:13px;">${p}</p>`).join("")}
        </div>`;
    }

    return `
      <header class="dr-head">
        <button class="dr-close" type="button" aria-label="Kapat">×</button>
        <p class="dr-eyebrow">Tarih Vakfı · Gönüllü</p>
        <h2 class="dr-name" id="tv-drawer-title">${esc(v.name)}</h2>
        ${sub ? `<p class="dr-sub">${sub}</p>` : ""}
      </header>
      <div class="dr-body">
        ${stats}
        ${narrative}
        ${linksHtml}
        ${tracksHtml}
        ${sparkHtml}
        ${extrasHtml}
        ${logHtml}
      </div>
      <footer class="dr-foot">
        <span>#g/${esc(v.slug)}</span>
        <button class="copy-link" type="button" data-slug="${esc(v.slug)}">Bağlantıyı kopyala</button>
      </footer>`;
  }

  // --- open / close ----------------------------------------------------
  let lastFocusedEl = null;

  function openDrawer(slug, opts = {}) {
    ensureScaffold();
    const v = findVolBySlug(slug);
    if (!v) {
      console.warn("volunteer-card: no volunteer with slug", slug);
      return;
    }
    drawer.innerHTML = renderDrawerBody(v);
    drawer.querySelector(".dr-close").addEventListener("click", closeDrawer);
    const copyBtn = drawer.querySelector(".copy-link");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const u = new URL(window.location.href);
        u.hash = "g/" + copyBtn.dataset.slug;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(u.toString()).then(() => {
            copyBtn.textContent = "Kopyalandı";
            setTimeout(() => (copyBtn.textContent = "Bağlantıyı kopyala"), 1400);
          });
        }
      });
    }
    lastFocusedEl = document.activeElement;
    requestAnimationFrame(() => {
      backdrop.classList.add("open");
      drawer.classList.add("open");
      document.body.classList.add("tv-drawer-open");
      drawer.focus();
    });
    if (opts.updateHash !== false) {
      const newHash = "#g/" + slug;
      if (location.hash !== newHash) {
        history.replaceState(null, "", location.pathname + location.search + newHash);
      }
    }
  }

  function closeDrawer() {
    if (!drawer) return;
    backdrop.classList.remove("open");
    drawer.classList.remove("open");
    document.body.classList.remove("tv-drawer-open");
    if (location.hash && location.hash.startsWith("#g/")) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  // --- click delegation ------------------------------------------------
  function nameFromElement(el) {
    if (!el || !el.closest) return null;
    if (el.closest(".copy-link, .dr-close")) return null;
    const node = el.closest("[data-slug], [data-volunteer-label]");
    if (!node || !node.dataset) return null;
    if (node.dataset.slug) return node.dataset.slug;
    if (node.dataset.volunteerLabel) return slugifyName(node.dataset.volunteerLabel);
    return null;
  }

  function bindClickDelegation() {
    document.addEventListener("click", (e) => {
      const slug = nameFromElement(e.target);
      if (slug) {
        e.preventDefault();
        openDrawer(slug);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const slug = nameFromElement(e.target);
      if (slug) {
        e.preventDefault();
        openDrawer(slug);
      }
    });
  }

  // --- hash routing ----------------------------------------------------
  function handleHash() {
    const m = (location.hash || "").match(/^#g\/(.+)$/);
    if (m) {
      openDrawer(decodeURIComponent(m[1]), { updateHash: false });
    }
  }

  // --- init ------------------------------------------------------------
  function init() {
    bindClickDelegation();
    handleHash();
    window.addEventListener("hashchange", handleHash);
    document.addEventListener("tvf:data", () => {
      if (location.hash && location.hash.startsWith("#g/") && (!drawer || !drawer.classList.contains("open"))) handleHash();
    });
  }

  window.TVF = window.TVF || {};
  window.TVF.openVolunteerDrawer = openDrawer;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
