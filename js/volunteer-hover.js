/**
 * volunteer-hover.js
 * ------------------
 * Shows a lightweight hover card over any element with [data-slug].
 * Reads from window.TVF_ROSTER (same data as volunteer-card.js).
 *
 * The card shows:
 *   • Name, role, city
 *   • Track badges (coloured dots)
 *   • Most recent 3 log entries with date + what they did
 *   • Session count + "last seen" date
 *
 * On click, delegates to TVF.openVolunteerDrawer() (volunteer-card.js)
 * for the full slide-in profile. This file adds no new click handlers —
 * volunteer-card.js already handles that.
 */
(function () {
  'use strict';

  const TRACK_META = {
    tarama:          { label: 'Tarama',          color: '#601040' },
    envanter:        { label: 'Envanter',         color: '#8a2a62' },
    kurumsal_bellek: { label: 'Kurum belleği',    color: '#3b6d11' },
    osmanlica:       { label: 'Osmanlıca çeviri', color: '#BA7517' },
    proje_basvuru:   { label: 'Proje başvurusu',  color: '#185fa5' },
    egitim:          { label: 'Eğitim',           color: '#534AB7' },
    ars_web:         { label: 'Arşiv-web & IT',   color: '#444441' },
    koordinasyon:    { label: 'Koordinasyon',      color: '#888780' },
    diger:           { label: 'Diğer',            color: '#74686e' },
  };

  const MONTHS_TR = ['','Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return parseInt(d, 10) + ' ' + (MONTHS_TR[parseInt(m, 10)] || '') + ' ' + y;
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Create tooltip DOM ──────────────────────────────────────────────
  const tip = document.createElement('div');
  tip.className = 'tv-hover-card';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);

  let hideTimer = null;
  let currentSlug = null;

  function showTip(el, v) {
    clearTimeout(hideTimer);

    const sub = [v.role, v.uni, v.city].filter(Boolean).map(esc).join(' · ');
    const trackDots = (v.tracks || []).slice(0, 5).map(t => {
      const m = TRACK_META[t] || TRACK_META.diger;
      return `<span class="hc-dot" style="background:${m.color}" title="${esc(m.label)}"></span>`;
    }).join('');

    // Most recent 3 log entries with actual content
    const recentLogs = (v.log || [])
      .filter(s => s.devam || s.calisma || s.notes)
      .slice(0, 3);

    const logRows = recentLogs.map(s => {
      const what = s.devam || s.calisma || '';
      const trMeta = TRACK_META[s.track] || TRACK_META.diger;
      return `<div class="hc-log-row">
        <span class="hc-log-dot" style="background:${trMeta.color}"></span>
        <div>
          <div class="hc-log-date">${esc(fmtDate(s.date))}</div>
          <div class="hc-log-what">${esc(what.length > 72 ? what.slice(0,70)+'…' : what)}</div>
          ${s.notes && s.notes.length < 100 ? `<div class="hc-log-note">${esc(s.notes)}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    const noLog = !recentLogs.length
      ? `<p class="hc-inactive">Bu dönem görünür kayıt yok${v.slots && v.slots.length ? ' · Slotlar: ' + esc(v.slots.join(', ')) : ''}.</p>`
      : '';

    tip.innerHTML = `
      <div class="hc-head">
        <div class="hc-name">${esc(v.name)}</div>
        ${sub ? `<div class="hc-sub">${sub}</div>` : ''}
        <div class="hc-tracks">${trackDots}</div>
      </div>
      <div class="hc-stats">
        <span>${v.sessions || 0} oturum</span>
        ${v.lastSeen ? `<span>son: ${esc(fmtDate(v.lastSeen))}</span>` : ''}
        ${v.boxes && v.boxes.length ? `<span>${v.boxes.length} kutu</span>` : ''}
      </div>
      ${logRows ? `<div class="hc-log">${logRows}</div>` : ''}
      ${noLog}
      <div class="hc-foot">Tam profil için tıklayın</div>
    `;

    positionTip(el);
    tip.classList.add('visible');
    tip.setAttribute('aria-hidden', 'false');
  }

  function hideTip() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      tip.classList.remove('visible');
      tip.setAttribute('aria-hidden', 'true');
      currentSlug = null;
    }, 180);
  }

  function positionTip(el) {
    const rect = el.getBoundingClientRect();
    const tipW = 300;
    const gutter = 8;
    let left = rect.left + window.scrollX;
    let top  = rect.bottom + window.scrollY + gutter;

    // Clamp to viewport
    if (left + tipW > window.innerWidth - gutter) {
      left = window.innerWidth - tipW - gutter;
    }
    if (left < gutter) left = gutter;

    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
    tip.style.width = tipW + 'px';
  }

  // ── Event delegation ────────────────────────────────────────────────
  function getSlug(el) {
    const node = el.closest('[data-slug]');
    return node ? node.dataset.slug : null;
  }

  function findVol(slug) {
    const data = window.TVF_ROSTER;
    if (!data) return null;
    return (data.volunteers || []).find(v => v.slug === slug) || null;
  }

  document.addEventListener('mouseover', e => {
    const slug = getSlug(e.target);
    if (!slug || slug === currentSlug) return;
    const v = findVol(slug);
    if (!v) return;
    currentSlug = slug;
    showTip(e.target.closest('[data-slug]'), v);
  });

  document.addEventListener('mouseout', e => {
    const slug = getSlug(e.target);
    if (!slug) return;
    // Don't hide if moving into the tooltip itself
    if (tip.contains(e.relatedTarget)) return;
    hideTip();
  });

  tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  tip.addEventListener('mouseleave', hideTip);

  // ── Inject styles ───────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
.tv-hover-card {
  position: absolute;
  z-index: 999;
  background: #1a1410;
  color: #f7f3ec;
  border-radius: 10px;
  padding: 14px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  box-shadow: 0 16px 48px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.08);
  pointer-events: auto;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity .16s, transform .16s;
  max-width: 300px;
}
.tv-hover-card.visible {
  opacity: 1;
  transform: translateY(0);
}
.hc-head { margin-bottom: 10px; }
.hc-name { font-family: Georgia, serif; font-size: 16px; font-weight: 700; color: #f7f3ec; }
.hc-sub  { font-size: 12px; color: #9d8e7e; margin-top: 3px; }
.hc-tracks { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
.hc-dot {
  width: 10px; height: 10px; border-radius: 50%;
  display: inline-block; flex-shrink: 0;
}
.hc-stats {
  display: flex; gap: 10px; flex-wrap: wrap;
  font-size: 11px; color: #9d8e7e;
  border-top: 1px solid rgba(255,255,255,.1);
  padding-top: 8px; margin-bottom: 10px;
}
.hc-log { display: flex; flex-direction: column; gap: 8px; }
.hc-log-row { display: flex; gap: 8px; align-items: flex-start; }
.hc-log-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
}
.hc-log-date { font-size: 11px; color: #9d8e7e; }
.hc-log-what { font-size: 12px; color: #e8d8c0; }
.hc-log-note { font-size: 11px; color: #9d8e7e; font-style: italic; margin-top: 2px; }
.hc-inactive { font-size: 12px; color: #6d625a; font-style: italic; margin: 6px 0 0; }
.hc-foot {
  font-size: 11px; color: #6d625a; border-top: 1px solid rgba(255,255,255,.08);
  margin-top: 10px; padding-top: 8px; text-align: center;
}
  `;
  document.head.appendChild(style);

})();
