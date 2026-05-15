// Boratav Arşivi Gönüllü Emek Günlüğü — public aggregate renderer.
(function () {
  const U = window.TVFUtils;
  const Credit = window.TVFVolunteerCredit;

  function renderDashboard(payload, opts) {
    const summary = payload.publicSummary;
    const content = payload.content || {};
    const latestActivity = Array.isArray(payload.latestActivity) ? payload.latestActivity : [];
    if (!summary) return;

    if (content.accentColor && /^#[0-9a-f]{3,8}$/i.test(content.accentColor)) {
      document.documentElement.style.setProperty('--accent', content.accentColor);
    }

    applyContent(content);
    hydrateMasthead(summary);
    hydrateNow(latestActivity);
    hydrateTruth(summary);
    hydrateGlance(summary);
    hydrateSignals(summary);
    hydrateMaterialBreakdown(summary);
    hydrateDays(summary);
    hydrateVolunteers(summary);
    hydrateActiveBoxes(summary);
    hydrateLatestActivity(summary, latestActivity);
    hydrateFirsts(summary);
    hydratePullCite(summary);
    hydrateDiagnostics(summary, latestActivity, opts && opts.debug);
  }

  function renderError() {
    setText('lpHeroLede', 'Veri yüklenemedi. Güvenli snapshot veya canlı Sheet bağlantısı bekleniyor.');
  }

  function applyContent(content) {
    Object.keys(content || {}).forEach((key) => {
      const value = content[key];
      if (value == null || String(value).trim() === '') return;
      document.querySelectorAll(`[data-edit="${key}"]`).forEach((el) => {
        el.innerHTML = String(value);
      });
    });
  }

  function hydrateMasthead(summary) {
    setText('lpWeekLabel', summary.period && summary.period.label ? summary.period.label : 'Bu hafta');
    setText('lpHeroPeriod', summary.period && summary.period.label ? summary.period.label : 'Bu hafta');
    const sync = document.getElementById('lpSyncLabel');
    if (sync) sync.textContent = summary.generatedAt ? `son güncelleme ${U.relativeDate(summary.generatedAt)}` : 'senkron bekleniyor';
    const lede = document.getElementById('lpHeroLede');
    if (lede && summary.totals) {
      lede.innerHTML = `Bu hafta gönüllüler ve koordinasyon ekibi Boratav Arşivi için <b>${U.formatNum(summary.totals.records)} katkı kaydı</b> oluşturdu: ${U.formatNum(summary.totals.pageRows)} sayfa/detay satırı ve ${U.formatNum(summary.totals.activityRows)} faaliyet kaydı.`;
    }
  }

  function hydrateNow(latestActivity) {
    const block = document.getElementById('lpNow');
    if (!block) return;
    const latest = latestActivity[0];
    if (!latest) {
      block.setAttribute('hidden', '');
      return;
    }
    const label = publicVolunteerLabel(latest.volunteerLabel);
    if (!label) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpNowAvatar', U.initialOf(label));
    setText('lpNowName', label);
    setText('lpNowBox', latest.boxLabel ? `${latest.boxLabel} üzerinde` : '');
    const what = document.getElementById('lpNowWhat');
    if (what) {
      const kind = latest.kind === 'activity' ? 'faaliyet kaydı' : 'sayfa/detay satırı';
      const material = latest.material ? ` · ${latest.material}` : '';
      what.innerHTML = `${U.escapeHtml(kind)}${U.escapeHtml(material)}<span class="cursor"></span>`;
    }
    setText('lpNowPages', latest.kind === 'activity' ? '+1' : `+${U.formatNum(latest.pagesDone || 1)}`);
    setText('lpNowClock', latest.when ? `${U.formatHM(latest.when)} TRT` : '');
    block.removeAttribute('hidden');
  }

  function hydrateTruth(summary) {
    const totals = summary.totals || {};
    const publicVolunteerCount = publicVolunteerRows(summary).length || totals.volunteersActive || totals.volunteers || 0;
    setText('lpTruthRecords', U.formatNum(totals.records));
    setText('lpTruthPages', U.formatNum(totals.pageRows));
    setText('lpTruthActivities', U.formatNum(totals.activityRows));
    setText('lpTruthVolunteers', U.formatNum(publicVolunteerCount));
    setText('lpTruthBoxes', U.formatNum(totals.boxesActive));
    setText('lpTruthProgress', totals.pagesTarget > 0 ? `%${U.formatPct(totals.progressPercent)}` : '—');
  }

  function hydrateGlance(summary) {
    const totals = summary.totals || {};
    setText('lpWeekTotal', totals.records > 0 ? U.formatNum(totals.records) : '—');
    setText('lpPct', totals.pagesTarget > 0 ? `%${U.formatPct(totals.progressPercent)}` : '—');
    setText('lpProgressTotals', totals.pagesTarget > 0
      ? `${U.formatNum(totals.pagesDone)} / ${U.formatNum(totals.pagesTarget)} sayfa`
      : `${U.formatNum(totals.pagesDone || 0)} sayfa · hedef eksik`);
    setText('lpBoxes', totals.boxesCatalogued ? U.formatNum(totals.boxesCatalogued) : '—');
    setText('lpBoxesOf', '');
    setText('lpBoxesFoot', totals.boxesActive
      ? `${U.formatNum(totals.boxesActive)} kutuda bu dönem hareket var`
      : 'bu dönem hareket yok');
    setText('lpDone', U.formatNum(totals.boxesCompleted || 0));
    setText('lpDoneFoot', totals.boxesCompleted ? 'tamamlanan kutu' : 'Henüz tamamlanan kutu yok');

    const spark = document.getElementById('lpSpark');
    if (!spark) return;
    const days = Array.isArray(summary.byDay) ? summary.byDay : [];
    const max = Math.max(1, ...days.map((day) => Number(day.records || 0)));
    spark.innerHTML = days.map((day) => {
      const height = Math.max(2, Math.round(((day.records || 0) / max) * 100));
      const today = U.sameIsoDate(day.dateISO, new Date());
      const cls = today ? 'b today' : (day.records ? 'b' : 'b quiet');
      const short = (day.weekdayTR || '').slice(0, 2);
      return `<span class="${cls}" style="height:${height}%" title="${U.escapeHtml(day.weekdayTR)} · ${U.formatNum(day.records)} kayıt"><small>${U.escapeHtml(short)}</small></span>`;
    }).join('');
  }

  function hydrateSignals(summary) {
    const block = document.getElementById('lpSignals');
    if (!block) return;
    const totals = summary.totals || {};
    const busiest = summary.highlights && summary.highlights.busiestDay;
    const topMaterial = summary.highlights && summary.highlights.topMaterial;

    const one = document.getElementById('lpSignal1Body');
    if (one) one.innerHTML = `<em>${U.formatNum(totals.records)} kayıt</em>: ${U.formatNum(totals.pageRows)} sayfa/detay + ${U.formatNum(totals.activityRows)} faaliyet.`;
    setText('lpSignal1Meta', `${U.formatNum(totals.periodPagesDone || 0)} sayfa birimi bu dönem işlendi`);

    const two = document.getElementById('lpSignal2Body');
    if (two && busiest && busiest.records > 0) {
      two.innerHTML = `<em>${U.escapeHtml(busiest.weekdayTR)}</em> haftanın en yoğun günü — ${U.formatNum(busiest.records)} kayıt.`;
      setText('lpSignal2Meta', `${U.formatDayMonth(busiest.dateISO)} · ${U.formatNum(busiest.pageRows)} sayfa/detay + ${U.formatNum(busiest.activityRows)} faaliyet`);
    } else if (two) {
      two.textContent = 'Bu dönem henüz kayıt görünmüyor.';
      setText('lpSignal2Meta', '');
    }

    const three = document.getElementById('lpSignal3Body');
    if (three && topMaterial) {
      three.innerHTML = `<em>${U.escapeHtml(topMaterial.label)}</em> ağırlıkta — ${U.formatNum(topMaterial.count)} kayıt.`;
      setText('lpSignal3Meta', `${U.formatNum(totals.volunteersActive || totals.volunteers || 0)} gönüllü · ${U.formatNum(totals.boxesActive || 0)} aktif kutu`);
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
    const palette = ['var(--accent)', 'var(--accent-deep)', 'var(--tv-burgundy-soft)', 'var(--tv-muted)', '#9b7d8d', '#5f6f64'];
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
        `<div class="row"><span class="dot" style="background:${palette[idx] || palette[5]};"></span><span>${U.escapeHtml(row.label || row.material)}</span><span class="pct">%${U.formatPct(row.percent)} · ${U.formatNum(row.count)}</span></div>`
      )).join('');
    }
    setText('lpMatMeta', 'bu dönem');
    block.removeAttribute('hidden');
  }

  function hydrateDays(summary) {
    const wrap = document.getElementById('lpDays');
    if (!wrap) return;
    const days = Array.isArray(summary.byDay) ? summary.byDay : [];
    wrap.innerHTML = days.map(renderDay).join('');
    setText('lpDaysTag', `${days.length} gün`);
  }

  function renderDay(day) {
    const quiet = !day.records;
    const today = U.sameIsoDate(day.dateISO, new Date());
    const cls = `day${today ? ' today' : ''}${quiet ? ' quiet' : ''}`;
    if (quiet) {
      return `<article class="${cls}">
        <div class="date"><div class="dn">${U.escapeHtml(day.weekdayTR)}</div><div class="dom">${String(day.dayNumber).padStart(2, '0')}</div><div class="opens">—</div></div>
        <div class="body"><p>Bu gün için görünür katkı yok.</p></div>
      </article>`;
    }
    const contributors = publicContributorRows(day.contributors || []);
    const coordination = publicContributorRows(day.coordination || contributors.filter((item) => item.publicRole));
    const names = contributors.length
      ? contributors.filter((item) => !item.publicRole).map((item) => item.label)
      : uniquePublicNames(day.volunteerNames || []);
    const nameLine = names.length ? `Gönüllüler: ${names.map(U.escapeHtml).join(', ')}` : '';
    const coordinationLine = coordination.length
      ? `Koordinasyon: ${coordination.map(formatRoleContributor).join(', ')}`
      : '';
    const materialText = (day.materials || []).slice(0, 3).map(materialPhrase).join(' · ');
    const boxText = (day.boxLabels || []).slice(0, 3).join(', ');
    const boxCount = Number(day.boxesCount || (day.boxLabels || []).length || 0);
    const dailyBits = [
      `${U.formatNum(day.pageRows)} sayfa/detay`,
      `${U.formatNum(day.activityRows)} faaliyet`
    ];
    if (boxCount) dailyBits.push(`${U.formatNum(boxCount)} kutu`);
    return `<article class="${cls}">
      <div class="date">
        <div class="dn">${U.escapeHtml(day.weekdayTR)}</div>
        <div class="dom">${String(day.dayNumber).padStart(2, '0')}</div>
        <div class="opens">ilk · ${U.formatHM(day.firstTime)}<br>son · ${U.formatHM(day.lastTime)}</div>
      </div>
      <div class="body">
        <div class="head">
          ${contributors.length || names.length ? `<div class="avs">${avatarDots(contributors.length || names.length, (contributors.length ? contributors.map((item) => item.label) : names))}</div>` : ''}
          <span class="ana">${U.escapeHtml(day.weekdayTR)} günü ${U.formatNum(day.records)} katkı kaydı görünür oldu.</span>
        </div>
        <p class="day-metrics">${U.escapeHtml(dailyBits.join(' · '))}</p>
        ${nameLine ? `<p class="ledger-meta">${nameLine}</p>` : ''}
        ${coordinationLine ? `<p class="ledger-meta coord-line">${coordinationLine}</p>` : ''}
        ${boxText ? `<p class="ledger-meta">Kutu: ${U.escapeHtml(boxText)}</p>` : ''}
        ${materialText ? `<p class="ledger-meta">Malzeme: ${U.escapeHtml(materialText)}</p>` : ''}
      </div>
    </article>`;
  }

  function hydrateVolunteers(summary) {
    const block = document.getElementById('lpVolunteers');
    const list = document.getElementById('lpVolunteerRows');
    if (!block || !list) return;
    const rows = publicVolunteerRows(summary).slice(0, 12);
    if (!rows.length) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpVolunteersMeta', `${U.formatNum(rows.length)} katkı veren`);
    list.innerHTML = rows.map((row) => {
      const label = publicVolunteerLabel(row.label);
      const boxBreakdown = Array.isArray(row.boxBreakdown) && row.boxBreakdown.length
        ? row.boxBreakdown.slice(0, 3).map((item) => `${item.boxLabel}`).join(' · ')
        : (row.topBox || 'Genel faaliyet');
      const unitParts = [];
      if (row.pageRows) unitParts.push(`${U.formatNum(row.pageRows)} sayfa/detay`);
      if (row.activityRows) unitParts.push(`${U.formatNum(row.activityRows)} faaliyet kaydı`);
      if (!unitParts.length) unitParts.push(`${U.formatNum(row.records)} katkı kaydı`);
      const meta = row.publicRole
        ? `${row.publicRole} · ${unitParts.join(' · ')}`
        : `${boxBreakdown} · ${unitParts.join(' · ')}`;
      return `<article class="vol-row">
        <div class="vol-avatar">${U.escapeHtml(U.initialOf(label))}</div>
        <div>
          <p class="vol-name">${U.escapeHtml(label)}</p>
          <p class="vol-meta">${U.escapeHtml(meta)}</p>
        </div>
        <span class="vol-pages">${U.formatNum(row.pagesDone || row.records)}</span>
      </article>`;
    }).join('');
    block.removeAttribute('hidden');
  }

  function hydrateActiveBoxes(summary) {
    const block = document.getElementById('lpBoxesWeek');
    const rows = document.getElementById('lpBoxesWeekRows');
    if (!block || !rows) return;
    const boxes = Array.isArray(summary.byBox) ? summary.byBox.slice(0, 10) : [];
    if (!boxes.length) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpBoxesWeekMeta', `${U.formatNum(boxes.length)} kutu`);
    rows.innerHTML = boxes.map((box) => {
      const pct = box.percent == null ? null : Number(box.percent);
      const progressWidth = pct == null ? 100 : Math.max(2, Math.min(100, pct));
      const progressLabel = box.target
        ? `Toplam arşiv ilerlemesi: ${U.formatNum(box.done)} / ${U.formatNum(box.target)} sayfa · %${U.formatPct(pct)}`
        : `Toplam arşiv ilerlemesi: ${U.formatNum(box.done)} sayfa işlendi · hedef eksik`;
      const periodPageRows = box.periodPageRows || box.pageRows || box.periodRecords || 0;
      const remaining = box.target ? `Kalan çalışma: ${U.formatNum(box.remaining)} sayfa` : 'Hedef eksik';
      const contributors = (box.contributors || box.topContributors || [])
        .filter((item) => isPublicVolunteerName(item.label))
        .slice(0, 4)
        .map((item) => `<span>${U.escapeHtml(publicVolunteerLabel(item.label))} <b>+${U.formatNum(item.pageRows || item.records || 0)}</b></span>`)
        .join('');
      const material = (box.materialCounts || box.materials || []).slice(0, 2).map(materialPhrase).join(' · ');
      return `<article class="box-card">
        <div class="box-card-head">
          <div>
            <p class="box-label">${U.escapeHtml(box.label || box.boxLabel || ('Kutu ' + box.box))}</p>
            <p class="box-progress-text">${U.escapeHtml(progressLabel)}</p>
          </div>
          <span class="box-period">Bu hafta görünür olan emek: +${U.formatNum(periodPageRows)} sayfa/detay</span>
        </div>
        <div class="box-progress" aria-hidden="true"><span style="width:${progressWidth}%"></span></div>
        <div class="box-card-body">
          <p>${U.escapeHtml(remaining)}</p>
          ${contributors ? `<div class="box-contributors"><span class="box-minihead">Katkı verenler</span>${contributors}</div>` : ''}
          <p>Son hareket: ${U.escapeHtml(U.formatDayMonth(box.lastActivityDate))}</p>
          ${material ? `<p>Malzeme: ${U.escapeHtml(material)}</p>` : ''}
        </div>
      </article>`;
    }).join('');
    block.removeAttribute('hidden');
  }

  function hydrateLatestActivity(summary, latestActivity) {
    const block = document.getElementById('lpLatest');
    const list = document.getElementById('lpLatestRows');
    if (!block || !list) return;
    const rows = groupLatestActivity(latestActivity.filter((row) => isPublicVolunteerName(row.volunteerLabel)));
    if (!rows.length) {
      block.setAttribute('hidden', '');
      return;
    }
    const visible = rows.slice(0, 12);
    setText('lpLatestMeta', `Son ${U.formatNum(visible.length)} özet`);
    list.innerHTML = visible.map((row) => {
      const label = publicVolunteerLabel(row.volunteerLabel);
      const role = row.publicRole ? ` · ${row.publicRole}` : '';
      const box = row.boxLabel ? ` · ${row.boxLabel}` : '';
      const countText = row.kind === 'activity'
        ? `${U.formatNum(row.records)} faaliyet`
        : `${U.formatNum(row.pagesDone || row.records)} sayfa/detay`;
      return `<article class="latest-row">
        <span class="latest-main"><span class="latest-date-inline">${U.escapeHtml(U.formatDayMonth(row.dateISO || row.when))}</span> — <strong>${U.escapeHtml(label)}</strong>${U.escapeHtml(role)}${U.escapeHtml(box)} · ${U.escapeHtml(countText)}</span>
      </article>`;
    }).join('');
    block.removeAttribute('hidden');
  }

  function hydrateFirsts(summary) {
    const block = document.getElementById('lpFirsts');
    const list = document.getElementById('lpFirstsList');
    if (!block || !list) return;
    block.setAttribute('hidden', '');
  }

  function hydratePullCite(summary) {
    setText('lpPullCite', '— Tarih Vakfı');
  }

  function hydrateDiagnostics(summary, latestActivity, enabled) {
    const block = document.getElementById('lpDiagnostics');
    const list = document.getElementById('lpDiagnosticsList');
    if (!block || !list) return;
    if (!enabled) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpDiagnosticsTitle', 'Yerel tanı');
    const byDayTotal = (summary.byDay || []).reduce((sum, day) => sum + Number(day.records || 0), 0);
    const materialTotal = (summary.byMaterial || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
    const diagnostics = [
      `generatedAt: ${summary.generatedAt}`,
      `period: ${summary.period.mode} ${summary.period.startDate}..${summary.period.endDate}`,
      `records: ${U.formatNum(summary.totals.records)} (${U.formatNum(summary.totals.pageRows)} sayfa/detay + ${U.formatNum(summary.totals.activityRows)} faaliyet)`,
      `byDay toplamı: ${U.formatNum(byDayTotal)} / totals.records: ${U.formatNum(summary.totals.records)}`,
      `malzeme toplamı: ${U.formatNum(materialTotal)} / totals.records: ${U.formatNum(summary.totals.records)}`,
      `feed cap: ${U.formatNum(summary.source && summary.source.latestActivityCap || latestActivity.length)}`,
      `tam özetten hesaplandı: ${summary.source && summary.source.recordsAreFullAggregate ? 'evet' : 'hayır'}`
    ];
    (summary.warnings || []).forEach((warning) => diagnostics.push(`${warning.code}: ${warning.message}`));
    if ((summary.warnings || []).some((warning) => warning.code === 'missing_volunteer_names')) {
      diagnostics.push('normal görünümden gizlenen etiket: Adı belirtilmeyen gönüllü');
    }
    list.innerHTML = diagnostics.map((item) => `<li>${U.escapeHtml(item)}</li>`).join('');
    block.removeAttribute('hidden');
  }

  function publicVolunteerLabel(label) {
    const value = String(label || '').trim();
    if (!value || value === Credit.UNNAMED || value === Credit.HIDDEN) return '';
    if (Credit.isUnsafePublicIdentifier(value)) return '';
    return value;
  }

  function isPublicVolunteerName(label) {
    return Boolean(publicVolunteerLabel(label));
  }

  function uniquePublicNames(labels) {
    const seen = new Set();
    const names = [];
    (labels || []).forEach((label) => {
      const safe = publicVolunteerLabel(label);
      const key = U.asciiFold ? U.asciiFold(safe).toLowerCase() : safe.toLowerCase();
      if (safe && !seen.has(key)) {
        seen.add(key);
        names.push(safe);
      }
    });
    return names;
  }

  function publicVolunteerRows(summary) {
    return Array.isArray(summary.byVolunteer)
      ? summary.byVolunteer.filter((row) => isPublicVolunteerName(row.label))
      : [];
  }

  function publicContributorRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        label: publicVolunteerLabel(row.label),
        publicRole: String(row.publicRole || '').trim(),
        records: Number(row.records || 0),
        pageRows: Number(row.pageRows || 0),
        activityRows: Number(row.activityRows || 0)
      }))
      .filter((row) => row.label);
  }

  function formatRoleContributor(row) {
    const parts = [];
    if (row.publicRole) parts.push(row.publicRole);
    if (row.activityRows) parts.push(`${U.formatNum(row.activityRows)} faaliyet`);
    if (row.pageRows) parts.push(`${U.formatNum(row.pageRows)} sayfa/detay`);
    return `${U.escapeHtml(row.label)} — ${U.escapeHtml(parts.join(' · '))}`;
  }

  function groupLatestActivity(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const key = [
        row.dateISO || '',
        publicVolunteerLabel(row.volunteerLabel),
        row.boxLabel || '',
        row.kind || '',
        row.material || '',
        row.publicRole || ''
      ].join('|');
      if (!groups.has(key)) {
        groups.set(key, {
          dateISO: row.dateISO,
          when: row.when,
          volunteerLabel: publicVolunteerLabel(row.volunteerLabel),
          publicRole: row.publicRole || '',
          boxLabel: row.boxLabel,
          kind: row.kind,
          material: row.material,
          records: 0,
          pagesDone: 0
        });
      }
      const group = groups.get(key);
      group.records += 1;
      group.pagesDone += Number(row.pagesDone || (row.kind === 'page' ? 1 : 0));
      if (row.when && (!group.when || String(row.when) > String(group.when))) group.when = row.when;
    });
    return Array.from(groups.values()).sort((a, b) => String(b.when || b.dateISO || '').localeCompare(String(a.when || a.dateISO || '')));
  }

  function materialPhrase(item) {
    const label = String(item.label || item.material || '').toLocaleLowerCase('tr');
    const singular = {
      'belgeler': 'belge',
      'fotoğraflar': 'fotoğraf',
      'mektuplar': 'mektup',
      'ders notları': 'ders notu',
      'kitap metinleri': 'kitap metni'
    }[label] || label;
    return `${U.formatNum(item.count)} ${singular}`;
  }

  function avatarDots(count, names) {
    const safeNames = Array.isArray(names) ? names : [];
    const n = Math.max(1, Math.min(5, Number(count) || safeNames.length || 1));
    return Array.from({ length: n }, (_, idx) => {
      const label = safeNames[idx] || String(idx + 1);
      return `<span class="av" title="${U.escapeHtml(label)}">${U.escapeHtml(U.initialOf(label))}</span>`;
    }).join('');
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  window.TVFRenderDashboard = { renderDashboard, renderError };
})();
