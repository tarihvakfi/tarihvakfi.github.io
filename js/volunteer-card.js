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
    envanter:        { label: "Envanter",                color: "#8a2a62" },
    kurumsal_bellek: { label: "Kurum belleği",           color: "#3b6d11" },
    osmanlica:       { label: "Osmanlıca çeviri",        color: "#BA7517" },
    proje_basvuru:   { label: "Proje başvurusu",         color: "#185fa5" },
    egitim:          { label: "Eğitim",                  color: "#534AB7" },
    ars_web:         { label: "Arşiv-web & IT",          color: "#444441" },
    koordinasyon:    { label: "Koordinasyon",            color: "#888780" },
    kodlama_kontrol: { label: "Kodlama & kontrol",       color: "#185fa5" },
    diger:           { label: "Diğer",                   color: "#74686e" },
  };

  const MONTHS_TR = ["", "OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ",
                     "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"];

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

  function findVolBySlug(slug) {
    const data = window.TVF_ROSTER;
    if (!data) return null;
    return (data.volunteers || []).find((v) => v.slug === slug) || null;
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
      (v.log || []).forEach((s) => { counts[s.track] = (counts[s.track] || 0) + 1; });
      // Backfill tracks that exist in v.tracks but not in counts (rare)
      v.tracks.forEach((t) => { if (!(t in counts)) counts[t] = 0; });
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
      const months = (window.TVF_ROSTER.monthsActive || [])
        .slice();
      if (months.length === 0) months.push(...Object.keys(v.byMonth).sort());
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
      const rows = v.log.slice(0, 12).map((s) => {
        const trMeta = TRACK_META[s.track] || TRACK_META.diger;
        const what = s.devam || s.calisma || trMeta.label;
        const extras = [
          s.scanner ? `tarayıcı: ${s.scanner}` : "",
          s.notes && s.notes.length < 140 ? s.notes : "",
        ].filter(Boolean);
        return `<div class="log-row">
          <p class="when">${esc(fmtDate(s.date))} · ${esc(trMeta.label)}</p>
          <p class="what">${esc(what)}</p>
          ${extras.length ? `<p class="extra">${esc(extras.join(" · "))}</p>` : ""}
        </div>`;
      }).join("");
      logHtml = `
        <div class="dr-block">
          <p class="dr-block-head">Son etkinlikler ${v.log.length > 12 ? `(son 12)` : ""}</p>
          <div class="dr-log">${rows}</div>
        </div>`;
    } else if (v.active === false) {
      logHtml = `
        <div class="dr-block">
          <p class="dr-empty">Kadroda; bu dönem henüz görünür kayıt yok. Zaman çizelgesinde ayrılmış slotlar: ${
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
      fpParts.push(`Kutular: ${v.boxes.map((b) => `Kutu ${esc(b)}`).join(", ")}`);
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
        <p class="dr-eyebrow">Boratav Arşivi · Gönüllü</p>
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
    // Find the data-slug on the closest .badge or .row
    const node = el.closest("[data-slug]");
    return node ? node.dataset.slug : null;
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
  }

  window.TVF = window.TVF || {};
  window.TVF.openVolunteerDrawer = openDrawer;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
