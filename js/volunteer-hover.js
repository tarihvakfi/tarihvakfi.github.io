/**
 * volunteer-hover.js — Tarih Vakfı Gönüllü Emek Günlüğü
 *
 * Shows a dark hover tooltip over any element with [data-volunteer-label].
 * Reads live data from window.TVF_PUBLIC_DATA (populated by snapshot.js
 * and optionally refreshed by data-loader.js).
 *
 * The tooltip shows:
 *   • Name + public role
 *   • Stats: record count, pages done, boxes worked
 *   • Last 3 activity entries from latestActivity feed
 *   • "Click to see full log" hint (future drawer hook)
 */
(function () {
  'use strict';

  var tip = null;
  var hideTimer = null;
  var currentLabel = null;

  // ── Build tooltip DOM once ─────────────────────────────────────────
  function ensureTip() {
    if (tip) return;
    tip = document.createElement('div');
    tip.className = 'tv-vol-tip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);

    var style = document.createElement('style');
    style.textContent = [
      '.tv-vol-tip{',
        'position:fixed;z-index:9999;',
        'background:#1c1712;color:#f0ebe3;',
        'border-radius:10px;padding:14px 16px;',
        'font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;',
        'font-size:13px;line-height:1.5;',
        'box-shadow:0 16px 48px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.07);',
        'max-width:340px;pointer-events:none;',
        'opacity:0;transform:translateY(6px);',
        'transition:opacity .15s ease,transform .15s ease;',
      '}',
      '.tv-vol-tip.show{opacity:1;transform:translateY(0);}',
      '.tv-vol-tip-name{font-size:15px;font-weight:700;color:#f0ebe3;margin:0 0 3px;}',
      '.tv-vol-tip-role{font-size:12px;color:#a09080;margin:0 0 10px;}',
      '.tv-vol-tip-profile{font-size:12px;color:#d4c4a8;margin:0 0 10px;}',
      '.tv-vol-tip-stats{',
        'display:flex;flex-wrap:wrap;gap:6px 14px;',
        'border-top:1px solid rgba(255,255,255,.09);',
        'padding-top:9px;margin-bottom:10px;',
        'font-size:12px;color:#a09080;',
      '}',
      '.tv-vol-tip-stat strong{color:#e8d4b0;font-size:15px;display:block;line-height:1.1;}',
      '.tv-vol-tip-log{display:flex;flex-direction:column;gap:7px;}',
      '.tv-vol-tip-section-title{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8d7c68;margin:2px 0 -1px;}',
      '.tv-vol-tip-log-row{display:flex;gap:8px;align-items:flex-start;}',
      '.tv-vol-tip-log-dot{',
        'width:7px;height:7px;border-radius:50%;',
        'flex-shrink:0;margin-top:5px;background:#8a2f2f;',
      '}',
      '.tv-vol-tip-log-meta{font-size:11px;color:#6d5f50;margin-bottom:1px;}',
      '.tv-vol-tip-log-text{font-size:12px;color:#d4c4a8;}',
      '.tv-vol-tip-boxes{font-size:11px;color:#7a6d5d;margin-top:9px;}',
      '.tv-vol-tip-foot{',
        'font-size:11px;color:#5a4d3d;',
        'border-top:1px solid rgba(255,255,255,.07);',
        'margin-top:10px;padding-top:8px;text-align:center;',
      '}',
    ].join('');
    document.head.appendChild(style);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function foldName(value) {
    return String(value || '')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[ıİI]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[şŞ]/g, 's')
      .replace(/[üÜ]/g, 'u')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  var TR_MONTHS = ['','Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  function fmtDate(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    return parseInt(parts[2],10) + ' ' + (TR_MONTHS[parseInt(parts[1],10)] || '') + ' ' + parts[0];
  }
  function fmtDateShort(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    return parseInt(parts[2],10) + ' ' + (TR_MONTHS[parseInt(parts[1],10)] || '');
  }

  var TRACK_LABELS = {
    tarama: 'Tarama',
    envanter: 'Envanter',
    kurumsal_bellek: 'Kurum belleği',
    osmanlica: 'Osmanlıca çeviri',
    proje_basvuru: 'Proje başvurusu',
    egitim: 'Eğitim',
    ars_web: 'Arşiv-web & IT',
    koordinasyon: 'Koordinasyon',
    kodlama_kontrol: 'Kodlama & kontrol',
    diger: 'Diğer'
  };

  function findRosterVolunteer(labelOrSlug) {
    var roster = window.TVF_ROSTER;
    var vols = roster && Array.isArray(roster.volunteers) ? roster.volunteers : [];
    var folded = foldName(labelOrSlug);
    for (var i = 0; i < vols.length; i++) {
      if (vols[i].slug === labelOrSlug || foldName(vols[i].name) === folded) return vols[i];
    }
    return null;
  }

  function profileText(rosterVol) {
    if (!rosterVol) return '';
    var bio = rosterVol.bio || {};
    return bio.shortRole || bio.tvNarrative || bio.narrative || (rosterVol.topics || []).slice(0, 3).join(' · ') || '';
  }

  function rosterWorkRows(rosterVol) {
    if (!rosterVol || !Array.isArray(rosterVol.log)) return [];
    return rosterVol.log.filter(function (entry) {
      return entry && (entry.devam || entry.calisma || entry.notes);
    }).slice(0, 4).map(function (entry) {
      var trackLabel = TRACK_LABELS[entry.track] || TRACK_LABELS.diger;
      return {
        dateISO: entry.date,
        meta: [fmtDateShort(entry.date), trackLabel].filter(Boolean).join(' · '),
        title: entry.calisma || trackLabel,
        detail: entry.devam || (entry.notes && entry.notes.length < 180 ? entry.notes : '')
      };
    });
  }

  function liveWorkRows(activity) {
    return (activity || []).filter(function (entry) {
      return entry.workTitle || entry.workDetail || entry.boxLabel;
    }).slice(0, 4).map(function (entry) {
      return {
        dateISO: entry.dateISO,
        meta: [fmtDateShort(entry.dateISO), entry.boxLabel || entry.material].filter(Boolean).join(' · '),
        title: entry.workTitle || (entry.kind === 'activity' ? 'Faaliyet kaydı' : 'Sayfa/detay satırı'),
        detail: entry.workDetail || entry.boxLabel || ''
      };
    });
  }

  // ── Get data for a volunteer label ─────────────────────────────────
  function getVolData(label) {
    var data = window.TVF_PUBLIC_DATA;
    var rosterVol = findRosterVolunteer(label);
    if (!data || !data.publicSummary) {
      return rosterVol ? { volRow: null, rosterVol: rosterVol, activity: [], recentDays: [], workRows: rosterWorkRows(rosterVol) } : null;
    }

    var summary = data.publicSummary;
    var vRows = summary.byVolunteer || [];
    var volRow = null;
    var foldedLabel = foldName(label);
    for (var i = 0; i < vRows.length; i++) {
      if (foldName(vRows[i].label) === foldedLabel) { volRow = vRows[i]; break; }
    }
    if (!volRow && !rosterVol) return null;

    // Collect their activity entries from latestActivity feed
    var latestActivity = data.latestActivity || [];
    var myActivity = latestActivity.filter(function(a) {
      return foldName(a.volunteerLabel) === foldedLabel;
    });

    // Also collect from byDay contributors
    var recentDays = [];
    var byDay = summary.byDay || [];
    for (var d = byDay.length - 1; d >= 0 && recentDays.length < 5; d--) {
      var day = byDay[d];
      var contribs = (day.contributors || []).concat(day.coordination || []);
      for (var c = 0; c < contribs.length; c++) {
        if (foldName(contribs[c].label) === foldedLabel) {
          recentDays.push({
            dateISO: day.dateISO,
            weekdayTR: day.weekdayTR,
            records: contribs[c].records || 0,
            pagesDone: contribs[c].pagesDone || 0,
            activityRows: contribs[c].activityRows || 0,
            boxes: day.boxLabels || [],
            summarySentence: day.summarySentence || ''
          });
          break;
        }
      }
    }

    var workRows = liveWorkRows(myActivity);
    if (!workRows.length) workRows = rosterWorkRows(rosterVol);

    return { volRow: volRow, rosterVol: rosterVol, activity: myActivity, recentDays: recentDays, workRows: workRows };
  }

  // ── Render tooltip HTML ────────────────────────────────────────────
  function renderTip(label) {
    var d = getVolData(label);
    if (!d) return false;

    var v = d.volRow || {};
    var rosterVol = d.rosterVol;
    var displayLabel = (rosterVol && rosterVol.name) || v.label || label;
    var days = d.recentDays.slice(0, 3);
    var workRows = (d.workRows || []).slice(0, 3);
    var profile = profileText(rosterVol);
    var role = v.publicRole || (rosterVol && (rosterVol.role || rosterVol.tv_role)) || '';

    var statsHtml = [
      '<div class="tv-vol-tip-stat"><strong>' + esc(String(v.records || 0)) + '</strong>katkı</div>',
      v.pagesDone ? '<div class="tv-vol-tip-stat"><strong>' + esc(String(v.pagesDone)) + '</strong>sayfa</div>' : '',
      v.boxes && v.boxes.length ? '<div class="tv-vol-tip-stat"><strong>' + v.boxes.length + '</strong>kutu</div>' : '',
    ].join('');

    var daysHtml = days.map(function(day) {
      var what = [];
      if (day.pagesDone) what.push(day.pagesDone + ' sayfa');
      if (day.activityRows) what.push(day.activityRows + ' faaliyet');
      if (day.boxes && day.boxes.length) what.push(day.boxes.join(', '));
      return [
        '<div class="tv-vol-tip-log-row">',
          '<div class="tv-vol-tip-log-dot"></div>',
          '<div>',
            '<div class="tv-vol-tip-log-meta">' + esc(fmtDateShort(day.dateISO)) + ' · ' + esc(day.weekdayTR) + '</div>',
            '<div class="tv-vol-tip-log-text">' + esc(what.join(' · ') || 'Koordinasyon') + '</div>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');

    var workHtml = workRows.map(function(row) {
      var text = [row.title, row.detail].filter(Boolean).join(' — ');
      return [
        '<div class="tv-vol-tip-log-row">',
          '<div class="tv-vol-tip-log-dot"></div>',
          '<div>',
            '<div class="tv-vol-tip-log-meta">' + esc(row.meta || fmtDateShort(row.dateISO)) + '</div>',
            '<div class="tv-vol-tip-log-text">' + esc(text || 'Form detayı') + '</div>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');

    var boxesHtml = v.topBox
      ? '<div class="tv-vol-tip-boxes">Aktif kutu: <strong style="color:#c9a87e">' + esc(v.topBox) + '</strong></div>'
      : '';

    tip.innerHTML = [
      '<div class="tv-vol-tip-name">' + esc(displayLabel) + '</div>',
      role ? '<div class="tv-vol-tip-role">' + esc(role) + '</div>' : '',
      profile ? '<div class="tv-vol-tip-profile">' + esc(profile) + '</div>' : '',
      '<div class="tv-vol-tip-stats">' + statsHtml + '</div>',
      workRows.length ? '<div class="tv-vol-tip-log"><div class="tv-vol-tip-section-title">Formdan iş detayı</div>' + workHtml + '</div>' : '',
      !workRows.length && days.length ? '<div class="tv-vol-tip-log">' + daysHtml + '</div>' : '',
      boxesHtml,
      '<div class="tv-vol-tip-foot">Son 7 gün katkısı</div>',
    ].join('');

    return true;
  }

  // ── Position tooltip ───────────────────────────────────────────────
  function positionTip(e) {
    var x = e.clientX + 14;
    var y = e.clientY + 14;
    var tipW = 340;
    var tipH = tip.offsetHeight || 200;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (x + tipW > vw - 8) x = e.clientX - tipW - 14;
    if (y + tipH > vh - 8) y = e.clientY - tipH - 14;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  // ── Show / hide ────────────────────────────────────────────────────
  function show(label, e) {
    clearTimeout(hideTimer);
    ensureTip();
    if (label === currentLabel) { positionTip(e); return; }
    currentLabel = label;
    if (!renderTip(label)) return;
    tip.classList.remove('show');
    positionTip(e);
    requestAnimationFrame(function() { tip.classList.add('show'); });
    tip.setAttribute('aria-hidden', 'false');
  }

  function hide() {
    hideTimer = setTimeout(function() {
      if (tip) { tip.classList.remove('show'); tip.setAttribute('aria-hidden','true'); }
      currentLabel = null;
    }, 200);
  }

  // ── Event delegation ───────────────────────────────────────────────
  // Attach to volunteer name elements. render-dashboard.js puts names
  // in elements with class vol-name, vol-avatar, or inside .vol-row.
  // We target any element with a data-volunteer-label attribute,
  // AND any .vol-row children (by reading text content of .vol-name).
  document.addEventListener('mouseover', function(e) {
    var el = e.target;

    // Check for explicit attribute first
    var node = el.closest('[data-volunteer-label]');
    if (node) { show(node.dataset.volunteerLabel, e); return; }

    var slugNode = el.closest('[data-slug]');
    if (slugNode) {
      var rosterVol = findRosterVolunteer(slugNode.dataset.slug);
      if (rosterVol) { show(rosterVol.name, e); return; }
    }

    // Fallback: .vol-row has a name in first text node or .vol-name
    var row = el.closest('.vol-row, .vol-credit-row, .credit-row');
    if (!row) return;
    var nameEl = row.querySelector('.vol-name, .credit-name, .vol-label, b');
    if (!nameEl) return;
    var label = nameEl.textContent.trim();
    if (label && label !== currentLabel) show(label, e);
  }, { passive: true });

  document.addEventListener('mousemove', function(e) {
    if (!currentLabel) return;
    positionTip(e);
  }, { passive: true });

  document.addEventListener('mouseout', function(e) {
    if (!currentLabel) return;
    var node = e.target.closest('[data-volunteer-label], [data-slug], .vol-row, .vol-credit-row, .credit-row');
    if (node && !node.contains(e.relatedTarget)) hide();
    else if (!node) hide();
  }, { passive: true });

})();
