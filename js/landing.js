// Tarih Vakfı · Sayım Defteri — public aggregate renderer.
//
// Architecture:
//   Google Sheet → Apps Script (?public=1) → publicSummary + latestActivity
//   → js/snapshot.js → this script.
//
// publicSummary is the only source for totals, days, materials, volunteers,
// and boxes. latestActivity is intentionally capped and is used only for the
// small "Şu an" line.

(function () {
  const params = new URLSearchParams(location.search);
  const liveOnly = params.get('live') === '1';
  const debug = params.get('debug') === '1' || isLocalPreview();
  let renderedAggregate = false;

  const snapshot = window.__SNAPSHOT__;
  if (!liveOnly && snapshot && snapshot.ok && snapshot.data) {
    try { hydrateAll(snapshot.data, { allowLegacy: true, debug }); } catch (e) { /* keep empty state */ }
  }

  const url = window.__SHEETSYNC_URL__;
  const configured = typeof url === 'string'
    && url.indexOf('script.google.com') >= 0
    && url.indexOf('REPLACE_ME') === -1;
  if (configured) {
    const sep = url.indexOf('?') >= 0 ? '&' : '?';
    fetch(`${url}${sep}public=1&t=${Date.now()}`, {
      method: 'GET', mode: 'cors', cache: 'no-store', redirect: 'follow'
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then((body) => {
        if (!body || body.ok !== true || !body.data) return;
        if (body.data.publicSummary || !renderedAggregate) {
          hydrateAll(body.data, { allowLegacy: !renderedAggregate, debug });
        }
      })
      .catch(() => { /* snapshot remains authoritative */ });
  }

  function hydrateAll(payload, opts) {
    const content = (payload && payload.content) || {};
    const summary = payload && payload.publicSummary
      ? payload.publicSummary
      : (opts && opts.allowLegacy ? legacySummary(payload) : null);
    if (!summary) return;

    renderedAggregate = !!payload.publicSummary;
    if (content.accentColor && /^#[0-9a-f]{3,8}$/i.test(content.accentColor)) {
      document.documentElement.style.setProperty('--accent', content.accentColor);
    }

    applyContent(content);
    hydrateMasthead(summary);
    hydrateNow(summary, Array.isArray(payload.latestActivity) ? payload.latestActivity : []);
    hydrateTruth(summary);
    hydrateGlance(summary);
    hydrateSignals(summary);
    hydrateMaterialBreakdown(summary);
    hydrateDays(summary);
    hydrateVolunteers(summary);
    hydrateActiveBoxes(summary);
    hydrateFirsts(summary);
    hydratePullCite(summary);
    hydrateDiagnostics(summary, opts && opts.debug);
  }

  function applyContent(content) {
    Object.keys(content || {}).forEach((key) => {
      const v = content[key];
      if (v == null || String(v).trim() === '') return;
      document.querySelectorAll(`[data-edit="${key}"]`).forEach((el) => {
        el.innerHTML = String(v);
      });
    });
  }

  function hydrateMasthead(summary) {
    setText('lpWeekLabel', summary.period && summary.period.label ? summary.period.label : 'Bu hafta');
    const sync = document.getElementById('lpSyncLabel');
    if (sync) sync.textContent = summary.generatedAt ? `son güncelleme ${relativeDate(summary.generatedAt)}` : 'senkron bekleniyor';
    const lede = document.getElementById('lpHeroLede');
    if (lede && summary.totals) {
      lede.innerHTML = `${escapeHtml(summary.period.label || 'Bu hafta')}: <b>${formatNum(summary.totals.records)} kayıt</b>, ${formatNum(summary.totals.pageRows)} sayfa/detay satırı ve ${formatNum(summary.totals.activityRows)} faaliyet kaydı.`;
    }
  }

  function hydrateNow(summary, latestActivity) {
    const block = document.getElementById('lpNow');
    if (!block) return;
    const latest = latestActivity[0];
    if (!latest) {
      block.setAttribute('hidden', '');
      return;
    }
    const label = safeVolunteerLabel(latest.volunteerLabel);
    setText('lpNowAvatar', initialOf(label));
    setText('lpNowName', label);
    setText('lpNowBox', latest.boxLabel ? `${latest.boxLabel} üzerinde` : '');
    const what = document.getElementById('lpNowWhat');
    if (what) {
      const kind = latest.kind === 'activity' ? 'faaliyet kaydı' : 'sayfa/detay satırı';
      const material = latest.material ? ` · ${latest.material}` : '';
      what.innerHTML = `${escapeHtml(kind)}${escapeHtml(material)}<span class="cursor"></span>`;
    }
    setText('lpNowPages', latest.kind === 'activity' ? '+1' : `+${formatNum(latest.pagesDone || 1)}`);
    const clock = document.getElementById('lpNowClock');
    if (clock) clock.textContent = latest.when ? formatTime(latest.when) : '';
    block.removeAttribute('hidden');
  }

  function hydrateTruth(summary) {
    const totals = summary.totals || {};
    setText('lpTruthLabel', summary.period && summary.period.mode === 'rolling_7_days' ? 'Son 7 gün' : 'Bu hafta');
    setText('lpTruthRecords', formatNum(totals.records));
    setText('lpTruthPages', formatNum(totals.pageRows));
    setText('lpTruthActivities', formatNum(totals.activityRows));
    setText('lpTruthMaterials', formatNum(totals.materials));
    setText('lpTruthVolunteers', formatNum(totals.volunteers));
    setText('lpTruthBoxes', formatNum(totals.boxesActive));
  }

  function hydrateGlance(summary) {
    const totals = summary.totals || {};
    setText('lpWeekTotal', totals.records > 0 ? formatNum(totals.records) : '—');
    setText('lpPct', totals.pagesTarget > 0 ? `%${formatPct(totals.progressPercent)}` : '—');
    setText('lpProgressTotals', totals.pagesTarget > 0
      ? `${formatNum(totals.pagesDone)} / ${formatNum(totals.pagesTarget)} sayfa`
      : `${formatNum(totals.pagesDone || 0)} sayfa · hedef eksik`);
    setText('lpBoxes', totals.boxesCatalogued ? formatNum(totals.boxesCatalogued) : '—');
    setText('lpBoxesOf', '');
    setText('lpBoxesFoot', totals.boxesActive
      ? `${formatNum(totals.boxesActive)} kutuda bu dönem hareket var`
      : 'bu dönem hareket yok');
    setText('lpDone', formatNum(totals.boxesCompleted || 0));
    setText('lpDoneFoot', 'tamamlanan kutu');

    const spark = document.getElementById('lpSpark');
    if (!spark) return;
    const days = Array.isArray(summary.byDay) ? summary.byDay : [];
    const max = Math.max(1, ...days.map((day) => Number(day.records || 0)));
    spark.innerHTML = days.map((day) => {
      const height = Math.max(2, Math.round(((day.records || 0) / max) * 100));
      const today = sameIsoDate(day.dateISO, new Date());
      const cls = today ? 'b today' : (day.records ? 'b' : 'b quiet');
      const short = (day.weekdayTR || '').slice(0, 2);
      return `<span class="${cls}" style="height:${height}%" title="${escapeHtml(day.weekdayTR)} · ${formatNum(day.records)} kayıt"><small>${escapeHtml(short)}</small></span>`;
    }).join('');
  }

  function hydrateSignals(summary) {
    const block = document.getElementById('lpSignals');
    if (!block) return;
    const totals = summary.totals || {};
    const busiest = summary.highlights && summary.highlights.busiestDay;
    const topMaterial = summary.highlights && summary.highlights.topMaterial;

    const one = document.getElementById('lpSignal1Body');
    if (one) one.innerHTML = `<em>${formatNum(totals.records)} kayıt</em>: ${formatNum(totals.pageRows)} sayfa/detay + ${formatNum(totals.activityRows)} faaliyet.`;
    setText('lpSignal1Meta', `${formatNum(totals.periodPagesDone || 0)} sayfa birimi bu dönem işlendi`);

    const two = document.getElementById('lpSignal2Body');
    if (two && busiest && busiest.records > 0) {
      two.innerHTML = `<em>${escapeHtml(busiest.weekdayTR)}</em> en yoğun gün — ${formatNum(busiest.records)} kayıt.`;
      setText('lpSignal2Meta', `${formatDayMonth(busiest.dateISO)} · ${formatNum(busiest.pageRows)} sayfa/detay + ${formatNum(busiest.activityRows)} faaliyet`);
    } else if (two) {
      two.textContent = 'Bu dönem henüz kayıt görünmüyor.';
      setText('lpSignal2Meta', '');
    }

    const three = document.getElementById('lpSignal3Body');
    if (three && topMaterial) {
      three.innerHTML = `<em>${escapeHtml(topMaterial.label)}</em> ağırlıkta — ${formatNum(topMaterial.count)} kayıt.`;
      setText('lpSignal3Meta', `${formatNum(totals.volunteers || 0)} gönüllü katkısı · ${formatNum(totals.boxesActive || 0)} aktif kutu`);
    } else if (three) {
      three.textContent = 'Malzeme dağılımı için veri bekleniyor.';
      setText('lpSignal3Meta', '');
    }

    block.removeAttribute('hidden');
  }

  function hydrateMaterialBreakdown(summary) {
    const block = document.getElementById('lpMat');
    if (!block) return;
    const rows = Array.isArray(summary.byMaterial) ? summary.byMaterial : [];
    const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    if (!total) {
      block.setAttribute('hidden', '');
      return;
    }
    const palette = ['var(--accent)', 'var(--accent-deep)', '#6b4a2a', '#b8985a', 'rgba(10,10,10,0.4)', '#3b6463'];
    const bar = document.getElementById('lpMatBar');
    if (bar) {
      bar.innerHTML = rows.map((row, idx) => {
        const width = total ? (Number(row.count || 0) / total) * 100 : 0;
        return `<div class="seg" style="width:${width}%; background:${palette[idx] || palette[5]};"></div>`;
      }).join('');
    }
    const legend = document.getElementById('lpMatLegend');
    if (legend) {
      legend.innerHTML = rows.map((row, idx) => (
        `<div class="row"><span class="dot" style="background:${palette[idx] || palette[5]};"></span><span>${escapeHtml(row.label || row.material)}</span><span class="pct">%${formatPct(row.percent)} · ${formatNum(row.count)}</span></div>`
      )).join('');
    }
    setText('lpMatMeta', `${summary.period.label} · ${formatNum(total)} kayıt`);
    block.removeAttribute('hidden');
  }

  function hydrateDays(summary) {
    const wrap = document.getElementById('lpDays');
    if (!wrap) return;
    const days = Array.isArray(summary.byDay) ? summary.byDay : [];
    wrap.innerHTML = days.map(renderDay).join('');
    const tag = document.getElementById('lpDaysTag');
    if (tag) tag.textContent = `${summary.period.label} · ${days.length} gün`;
  }

  function renderDay(day) {
    const quiet = !day.records;
    const today = sameIsoDate(day.dateISO, new Date());
    const cls = `day${today ? ' today' : ''}${quiet ? ' quiet' : ''}`;
    if (quiet) {
      return `<article class="${cls}">
        <div class="date"><div class="dn">${escapeHtml(day.weekdayTR)}</div><div class="dom">${String(day.dayNumber).padStart(2, '0')}</div><div class="opens">—</div></div>
        <div class="body"><p>Bu gün için kayıt görünmüyor.</p></div>
        <aside class="marg"><span class="stamp sessiz">sessiz</span></aside>
      </article>`;
    }
    const materialText = (day.materials || []).slice(0, 2).map((item) => `${item.label}: ${formatNum(item.count)}`).join(' · ');
    const insight = `Bugün <b>${formatNum(day.pageRows)} sayfa/detay</b> ve <b>${formatNum(day.activityRows)} faaliyet</b> kaydı var.`;
    return `<article class="${cls}">
      <div class="date">
        <div class="dn">${escapeHtml(day.weekdayTR)}</div>
        <div class="dom">${String(day.dayNumber).padStart(2, '0')}</div>
        <div class="opens">ilk · ${formatHM(day.firstTime)}<br>son · ${formatHM(day.lastTime)}</div>
      </div>
      <div class="body">
        <div class="head">
          <div class="avs">${avatarDots(day.volunteersCount)}</div>
          <span class="ana">${formatNum(day.records)} kayıt · ${formatNum(day.volunteersCount)} gönüllü katkısı</span>
        </div>
        <p>${escapeHtml(day.summarySentence)}</p>
        ${materialText ? `<p class="ledger-meta">${escapeHtml(materialText)}</p>` : ''}
        <div class="insight"><span class="k">özet</span>${insight}</div>
      </div>
      <aside class="marg">
        <div class="stat-block">
          <span><b>${formatNum(day.records)}</b> kayıt</span>
          <span>${formatNum(day.pageRows)} sayfa/detay</span>
          <span>${formatNum(day.activityRows)} faaliyet</span>
          <span>${formatNum(day.boxesCount)} kutu</span>
        </div>
        <span class="stamp sururyor">${today ? 'bugün' : 'işlendi'}</span>
      </aside>
    </article>`;
  }

  function hydrateVolunteers(summary) {
    const block = document.getElementById('lpVolunteers');
    const list = document.getElementById('lpVolunteerRows');
    if (!block || !list) return;
    const rows = Array.isArray(summary.byVolunteer) ? summary.byVolunteer.slice(0, 6) : [];
    if (!rows.length) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpVolunteersMeta', `${summary.period.label} · ${formatNum(rows.length)} katkı satırı`);
    list.innerHTML = rows.map((row) => {
      const box = row.topBox ? `<span class="tag">${escapeHtml(row.topBox)}</span>` : '';
      const unit = row.pageRows ? `${formatNum(row.pageRows)} sayfa/detay` : `${formatNum(row.activityRows)} faaliyet`;
      return `<article class="vol-row">
        <div class="vol-avatar">${escapeHtml(initialOf(row.label))}</div>
        <div>
          <p class="vol-name">${escapeHtml(safeVolunteerLabel(row.label))}</p>
          <p class="vol-meta">${box} ${escapeHtml(unit)} · ${formatNum(row.records)} kayıt</p>
        </div>
        <span class="vol-pages">${formatNum(row.pagesDone || row.records)}</span>
      </article>`;
    }).join('');
    block.removeAttribute('hidden');
  }

  function hydrateActiveBoxes(summary) {
    const block = document.getElementById('lpBoxesWeek');
    const rows = document.getElementById('lpBoxesWeekRows');
    if (!block || !rows) return;
    const boxes = Array.isArray(summary.byBox) ? summary.byBox.slice(0, 8) : [];
    if (!boxes.length) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpBoxesWeekMeta', `${summary.period.label} · ${formatNum(boxes.length)} kutu`);
    rows.innerHTML = boxes.map((box) => {
      const pct = box.percent == null ? null : Number(box.percent);
      const progressWidth = pct == null ? 100 : Math.max(2, Math.min(100, pct));
      const progressLabel = box.target
        ? `${formatNum(box.done)} / ${formatNum(box.target)} sayfa · %${formatPct(pct)}`
        : `${formatNum(box.done)} sayfa · hedef eksik`;
      const remaining = box.target ? `Kalan: ${formatNum(box.remaining)} sayfa` : 'Hedef eksik';
      const people = box.contributorsCount
        ? `${formatNum(box.contributorsCount)} gönüllü katkı verdi`
        : 'Gönüllü katkısı var';
      const contributors = (box.topContributors || []).map((item, idx) => rankedVolunteerLabel(safeVolunteerLabel(item.label), idx)).join(' · ');
      const material = (box.materials || []).slice(0, 2).map((item) => `${item.label}: ${formatNum(item.count)}`).join(' · ');
      return `<article class="box-card">
        <div class="box-card-head">
          <div>
            <p class="box-label">${escapeHtml(box.label || ('Kutu ' + box.box))}</p>
            <p class="box-progress-text">${escapeHtml(progressLabel)}</p>
          </div>
          <span class="box-period">+${formatNum(box.periodPageRows || box.periodRecords || 0)} kayıt</span>
        </div>
        <div class="box-progress" aria-hidden="true"><span style="width:${progressWidth}%"></span></div>
        <div class="box-card-meta">
          <span>${escapeHtml(people)}</span>
          <span>Son hareket: ${escapeHtml(formatDayMonth(box.lastActivityDate))}</span>
          <span>${escapeHtml(remaining)}</span>
          ${contributors ? `<span>${escapeHtml(contributors)}</span>` : ''}
          ${material ? `<span>${escapeHtml(material)}</span>` : ''}
        </div>
      </article>`;
    }).join('');
    block.removeAttribute('hidden');
  }

  function hydrateFirsts(summary) {
    const block = document.getElementById('lpFirsts');
    const list = document.getElementById('lpFirstsList');
    if (!block || !list) return;
    const notes = [];
    (summary.warnings || []).forEach((warning) => {
      if (warning.code === 'missing_box_targets') {
        notes.push('Bazı aktif kutularda hedef sayfa toplamı eksik; görünen ilerleme kayıt sayısına göre veriliyor.');
      } else if (warning.code === 'unknown_dates') {
        notes.push('Tarih alanı boş olan eski satırlar dönem grafiğine alınmadı, toplam ilerlemede korundu.');
      } else if (warning.code === 'unsafe_public_identifiers_redacted') {
        notes.push('Kamuya uygun olmayan katkı kimlikleri isim yerine anonim katkı etiketiyle gösterildi.');
      }
    });
    if (!notes.length) {
      block.setAttribute('hidden', '');
      return;
    }
    list.innerHTML = notes.slice(0, 4).map((note) => `<li><span class="mark">·</span><span>${escapeHtml(note)}</span></li>`).join('');
    block.removeAttribute('hidden');
  }

  function hydratePullCite(summary) {
    setText('lpPullCite', `— ${summary.period.label}`);
  }

  function hydrateDiagnostics(summary, enabled) {
    const block = document.getElementById('lpDiagnostics');
    const list = document.getElementById('lpDiagnosticsList');
    if (!block || !list) return;
    if (!enabled) {
      block.setAttribute('hidden', '');
      return;
    }
    const diagnostics = [];
    const dayTotal = (summary.byDay || []).reduce((sum, day) => sum + Number(day.records || 0), 0);
    diagnostics.push(`byDay toplamı: ${formatNum(dayTotal)} / totals.records: ${formatNum(summary.totals.records)}`);
    diagnostics.push(`Kırpılmış özet kullanılmıyor: ${summary.source && summary.source.recordsAreFullAggregate ? 'evet' : 'hayır'}`);
    (summary.warnings || []).forEach((warning) => diagnostics.push(`${warning.code}: ${warning.message}`));
    list.innerHTML = diagnostics.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    block.removeAttribute('hidden');
  }

  function legacySummary(payload) {
    const stats = payload && payload.stats && payload.stats.projects && payload.stats.projects.pnb;
    const ticker = Array.isArray(payload && payload.ticker) ? payload.ticker : [];
    if (!stats && !ticker.length) return null;
    const today = startOfDay(new Date());
    const start = new Date(today); start.setDate(start.getDate() - today.getDay() + 1);
    const period = {
      mode: 'calendar_week',
      startDate: toISODate(start),
      endDate: toISODate(today),
      label: `${formatDayMonth(toISODate(start))} haftası · eski özet`,
      isPartial: true
    };
    const byDate = new Map();
    ticker.forEach((row) => {
      const iso = toISODate(row.when || row.createdAt);
      if (!iso || iso < period.startDate || iso > period.endDate) return;
      if (!byDate.has(iso)) byDate.set(iso, []);
      byDate.get(iso).push(row);
    });
    const days = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      const rows = byDate.get(iso) || [];
      const volunteers = new Set(rows.map((r) => r.volunteerToken || r.firstName).filter(Boolean));
      const materials = countBy(rows, (r) => r.materialCategory || 'belgeler');
      days.push({
        dateISO: iso,
        weekdayTR: weekdayTR(iso),
        dayNumber: Number(iso.slice(8, 10)),
        records: rows.length,
        pageRows: rows.length,
        activityRows: 0,
        pagesDone: rows.length,
        volunteersCount: volunteers.size,
        boxesCount: 0,
        materials: counterToRows(materials),
        firstTime: rows[0] && (rows[0].when || rows[0].createdAt),
        lastTime: rows[rows.length - 1] && (rows[rows.length - 1].when || rows[rows.length - 1].createdAt),
        summarySentence: rows.length ? `${rows.length} eski kayıt görünüyor.` : 'Bu gün için kayıt görünmüyor.'
      });
    }
    const records = days.reduce((sum, day) => sum + day.records, 0);
    return {
      generatedAt: new Date().toISOString(),
      period,
      totals: {
        records,
        pageRows: records,
        activityRows: 0,
        periodPagesDone: records,
        pagesDone: Number(stats && stats.donePages) || records,
        pagesTarget: Number(stats && stats.totalPages) || 0,
        progressPercent: stats && stats.totalPages ? Math.round((Number(stats.donePages || 0) / Number(stats.totalPages)) * 1000) / 10 : 0,
        boxesTotal: Number(stats && stats.cataloguedBoxes) || null,
        boxesCatalogued: Number(stats && stats.cataloguedBoxes) || 0,
        boxesActive: 0,
        boxesCompleted: 0,
        boxesRemaining: null,
        volunteers: 0,
        materials: 0
      },
      byDay: days,
      byMaterial: counterToRows(countBy(ticker, (r) => r.materialCategory || 'belgeler')),
      byBox: [],
      byVolunteer: [],
      highlights: { busiestDay: days.slice().sort((a, b) => b.records - a.records)[0] || null },
      warnings: [{ code: 'legacy_payload', message: 'Live endpoint has not deployed publicSummary yet.' }],
      source: { recordsAreFullAggregate: false, latestActivityCap: ticker.length }
    };
  }

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt == null ? '' : String(txt);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isUnsafePublicIdentifier(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) return true;
    if (/^[0-9a-fA-F]{12,}$/.test(text)) return true;
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(text)) return true;
    const compact = text.replace(/[^A-Za-z0-9]/g, '');
    return compact.length >= 18 && /[0-9]/.test(compact);
  }

  function safeVolunteerLabel(label) {
    return isUnsafePublicIdentifier(label) ? 'Gönüllü katkısı' : (label || 'Gönüllü katkısı');
  }

  function rankedVolunteerLabel(label, idx) {
    if (label !== 'Bir gönüllü') return label;
    if (idx === 0) return 'Bir gönüllü';
    if (idx === 1) return 'Bir gönüllü daha';
    return 'Başka bir gönüllü';
  }

  function formatNum(n) {
    return new Intl.NumberFormat('tr-TR').format(Number(n) || 0);
  }

  function formatPct(n) {
    const value = Number(n) || 0;
    return value < 10 ? value.toFixed(1).replace('.', ',') : Math.round(value).toString();
  }

  function formatHM(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatTime(value) {
    const hm = formatHM(value);
    return hm === '—' ? '—' : `${hm} TRT`;
  }

  function relativeDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'az önce';
    const diff = Date.now() - d.getTime();
    const mins = Math.max(0, Math.round(diff / 60000));
    if (mins < 2) return 'az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    return formatDayMonth(toISODate(d));
  }

  function initialOf(name) {
    const s = String(name || '').trim();
    return s ? s.charAt(0).toLocaleUpperCase('tr') : '·';
  }

  function avatarDots(count) {
    const n = Math.max(1, Math.min(5, Number(count) || 1));
    return Array.from({ length: n }, (_, idx) => `<span class="av">${idx + 1}</span>`).join('');
  }

  function toISODate(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function startOfDay(value) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function sameIsoDate(a, b) {
    return toISODate(a) === toISODate(b);
  }

  function weekdayTR(iso) {
    const names = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    const d = new Date(`${iso}T12:00:00`);
    return names[d.getDay()];
  }

  function formatDayMonth(value) {
    const iso = toISODate(value);
    if (!iso) return '—';
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const d = new Date(`${iso}T12:00:00`);
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  function countBy(rows, fn) {
    const out = {};
    rows.forEach((row) => {
      const key = fn(row);
      out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  function counterToRows(obj) {
    const total = Object.values(obj).reduce((sum, n) => sum + Number(n || 0), 0);
    return Object.keys(obj).sort((a, b) => obj[b] - obj[a]).map((key) => ({
      material: key,
      label: key.charAt(0).toLocaleUpperCase('tr') + key.slice(1),
      count: obj[key],
      percent: total ? Math.round((obj[key] / total) * 1000) / 10 : 0
    }));
  }

  function isLocalPreview() {
    return ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  }
})();
