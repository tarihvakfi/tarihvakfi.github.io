// Tarih Vakfı · Sayım Defteri — public aggregate renderer.
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
    const sync = document.getElementById('lpSyncLabel');
    if (sync) sync.textContent = summary.generatedAt ? `son güncelleme ${U.relativeDate(summary.generatedAt)}` : 'senkron bekleniyor';
    const lede = document.getElementById('lpHeroLede');
    if (lede && summary.totals) {
      lede.innerHTML = `${U.escapeHtml(summary.period.label || 'Bu hafta')}: <b>${U.formatNum(summary.totals.records)} kayıt</b>, ${U.formatNum(summary.totals.pageRows)} sayfa/detay satırı ve ${U.formatNum(summary.totals.activityRows)} faaliyet kaydı.`;
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
    const label = safeVolunteerLabel(latest.volunteerLabel);
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
    const periodLabel = summary.period && summary.period.mode === 'rolling_7_days' ? 'Son 7 gün' : 'Bu hafta';
    setText('lpTruthLabel', periodLabel);
    setText('lpTruthRecords', U.formatNum(totals.records));
    setText('lpTruthPages', U.formatNum(totals.pageRows));
    setText('lpTruthActivities', U.formatNum(totals.activityRows));
    setText('lpTruthMaterials', U.formatNum(totals.materials));
    setText('lpTruthVolunteers', U.formatNum(totals.volunteersActive || totals.volunteers || 0));
    setText('lpTruthBoxes', U.formatNum(totals.boxesActive));
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
    setText('lpDoneFoot', 'tamamlanan kutu');

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
        `<div class="row"><span class="dot" style="background:${palette[idx] || palette[5]};"></span><span>${U.escapeHtml(row.label || row.material)}</span><span class="pct">%${U.formatPct(row.percent)} · ${U.formatNum(row.count)}</span></div>`
      )).join('');
    }
    setText('lpMatMeta', `${summary.period.label} · ${U.formatNum(total)} kayıt`);
    block.removeAttribute('hidden');
  }

  function hydrateDays(summary) {
    const wrap = document.getElementById('lpDays');
    if (!wrap) return;
    const days = Array.isArray(summary.byDay) ? summary.byDay : [];
    wrap.innerHTML = days.map(renderDay).join('');
    setText('lpDaysTag', `${summary.period.label} · ${days.length} gün`);
  }

  function renderDay(day) {
    const quiet = !day.records;
    const today = U.sameIsoDate(day.dateISO, new Date());
    const cls = `day${today ? ' today' : ''}${quiet ? ' quiet' : ''}`;
    if (quiet) {
      return `<article class="${cls}">
        <div class="date"><div class="dn">${U.escapeHtml(day.weekdayTR)}</div><div class="dom">${String(day.dayNumber).padStart(2, '0')}</div><div class="opens">—</div></div>
        <div class="body"><p>Bu gün için kayıt görünmüyor.</p></div>
        <aside class="marg"><span class="stamp sessiz">sessiz</span></aside>
      </article>`;
    }
    const names = Array.isArray(day.volunteerNames) ? day.volunteerNames.map(safeVolunteerLabel).filter(Boolean) : [];
    const nameLine = names.length ? `${U.formatNum(day.volunteersCount)} gönüllü: ${names.slice(0, 5).map(U.escapeHtml).join(', ')}${names.length > 5 ? '…' : ''}` : `${U.formatNum(day.volunteersCount)} gönüllü`;
    const materialText = (day.materials || []).slice(0, 2).map((item) => `${item.label}: ${U.formatNum(item.count)}`).join(' · ');
    const boxText = (day.boxLabels || []).slice(0, 3).join(', ');
    return `<article class="${cls}">
      <div class="date">
        <div class="dn">${U.escapeHtml(day.weekdayTR)}</div>
        <div class="dom">${String(day.dayNumber).padStart(2, '0')}</div>
        <div class="opens">ilk · ${U.formatHM(day.firstTime)}<br>son · ${U.formatHM(day.lastTime)}</div>
      </div>
      <div class="body">
        <div class="head">
          <div class="avs">${avatarDots(day.volunteersCount, names)}</div>
          <span class="ana">${U.formatNum(day.records)} kayıt · ${U.escapeHtml(nameLine)}</span>
        </div>
        <p>${U.escapeHtml(day.summarySentence)}</p>
        ${boxText ? `<p class="ledger-meta">Kutular: ${U.escapeHtml(boxText)}</p>` : ''}
        ${materialText ? `<p class="ledger-meta">${U.escapeHtml(materialText)}</p>` : ''}
        <div class="insight"><span class="k">özet</span>Bugün <b>${U.formatNum(day.pageRows)} sayfa/detay</b> ve <b>${U.formatNum(day.activityRows)} faaliyet</b> kaydı var.</div>
      </div>
      <aside class="marg">
        <div class="stat-block">
          <span><b>${U.formatNum(day.records)}</b> kayıt</span>
          <span>${U.formatNum(day.pageRows)} sayfa/detay</span>
          <span>${U.formatNum(day.activityRows)} faaliyet</span>
          <span>${U.formatNum(day.boxesCount)} kutu</span>
        </div>
        <span class="stamp sururyor">${today ? 'bugün' : 'işlendi'}</span>
      </aside>
    </article>`;
  }

  function hydrateVolunteers(summary) {
    const block = document.getElementById('lpVolunteers');
    const list = document.getElementById('lpVolunteerRows');
    if (!block || !list) return;
    const rows = Array.isArray(summary.byVolunteer) ? summary.byVolunteer.slice(0, 12) : [];
    if (!rows.length) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpVolunteersMeta', `${summary.period.label} · ${U.formatNum(summary.totals.volunteersActive || rows.length)} gönüllü`);
    list.innerHTML = rows.map((row) => {
      const label = safeVolunteerLabel(row.label);
      const boxBreakdown = Array.isArray(row.boxBreakdown) && row.boxBreakdown.length
        ? row.boxBreakdown.slice(0, 3).map((item) => `${item.boxLabel} · ${U.formatNum(item.records)} sayfa/detay`).join(' · ')
        : (row.topBox || 'Genel faaliyet');
      const unitParts = [];
      if (row.activityRows) unitParts.push(`${U.formatNum(row.activityRows)} faaliyet`);
      unitParts.push(`${U.formatNum(row.records)} kayıt`);
      return `<article class="vol-row">
        <div class="vol-avatar">${U.escapeHtml(U.initialOf(label))}</div>
        <div>
          <p class="vol-name">${U.escapeHtml(label)}</p>
          <p class="vol-meta">${U.escapeHtml(boxBreakdown)} · ${U.escapeHtml(unitParts.join(' · '))}</p>
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
    setText('lpBoxesWeekMeta', `${summary.period.label} · ${U.formatNum(boxes.length)} kutu`);
    rows.innerHTML = boxes.map((box) => {
      const pct = box.percent == null ? null : Number(box.percent);
      const progressWidth = pct == null ? 100 : Math.max(2, Math.min(100, pct));
      const progressLabel = box.target
        ? `${U.formatNum(box.done)} / ${U.formatNum(box.target)} sayfa · %${U.formatPct(pct)}`
        : `${U.formatNum(box.done)} sayfa işlendi · hedef eksik`;
      const remaining = box.target ? `Kalan: ${U.formatNum(box.remaining)} sayfa` : 'Hedef eksik';
      const contributors = (box.contributors || box.topContributors || [])
        .slice(0, 4)
        .map((item) => `${safeVolunteerLabel(item.label)} +${U.formatNum(item.records || item.pageRows || 0)}`)
        .join(' · ');
      const material = (box.materialCounts || box.materials || []).slice(0, 2).map((item) => `${item.label}: ${U.formatNum(item.count)}`).join(' · ');
      return `<article class="box-card">
        <div class="box-card-head">
          <div>
            <p class="box-label">${U.escapeHtml(box.label || box.boxLabel || ('Kutu ' + box.box))}</p>
            <p class="box-progress-text">${U.escapeHtml(progressLabel)}</p>
          </div>
          <span class="box-period">+${U.formatNum(box.periodPageRows || box.pageRows || box.periodRecords || 0)} kayıt</span>
        </div>
        <div class="box-progress" aria-hidden="true"><span style="width:${progressWidth}%"></span></div>
        <div class="box-card-meta">
          <span>${U.formatNum(box.contributorsCount || (box.contributors || []).length || 0)} gönüllü katkı verdi</span>
          <span>Son hareket: ${U.escapeHtml(U.formatDayMonth(box.lastActivityDate))}</span>
          <span>${U.escapeHtml(remaining)}</span>
          ${contributors ? `<span>${U.escapeHtml(contributors)}</span>` : ''}
          ${material ? `<span>${U.escapeHtml(material)}</span>` : ''}
        </div>
      </article>`;
    }).join('');
    block.removeAttribute('hidden');
  }

  function hydrateLatestActivity(summary, latestActivity) {
    const block = document.getElementById('lpLatest');
    const list = document.getElementById('lpLatestRows');
    if (!block || !list) return;
    const rows = latestActivity.slice(0, 50);
    if (!rows.length) {
      block.setAttribute('hidden', '');
      return;
    }
    setText('lpLatestMeta', `Son ${U.formatNum(rows.length)} hareket`);
    list.innerHTML = rows.slice(0, 12).map((row) => {
      const label = safeVolunteerLabel(row.volunteerLabel);
      const kind = row.kind === 'activity' ? 'faaliyet' : 'sayfa/detay';
      const box = row.boxLabel ? ` · ${row.boxLabel}` : '';
      return `<article class="latest-row">
        <span class="latest-date">${U.escapeHtml(U.formatDayMonth(row.dateISO || row.when))}</span>
        <span class="latest-main">${U.escapeHtml(label)} — ${U.escapeHtml(kind)}${U.escapeHtml(box)}</span>
        <span class="latest-count">${row.kind === 'activity' ? '+1' : '+' + U.formatNum(row.pagesDone || 1)}</span>
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
      if (warning.code === 'missing_box_targets') notes.push('Bazı aktif kutularda hedef sayfa toplamı eksik; görünen ilerleme kayıt sayısına göre veriliyor.');
      if (warning.code === 'unknown_dates') notes.push('Tarih alanı boş olan eski satırlar dönem grafiğine alınmadı, toplam ilerlemede korundu.');
      if (warning.code === 'unsafe_public_identifiers_suppressed') notes.push('Kimlik gibi görünen teknik değerler isim olarak gösterilmedi.');
      if (warning.code === 'missing_volunteer_names') notes.push('Bazı katkı satırlarında kullanılabilir gönüllü adı yok; emek “Adı belirtilmeyen gönüllü” olarak korunuyor.');
    });
    if (!notes.length) {
      block.setAttribute('hidden', '');
      return;
    }
    list.innerHTML = notes.slice(0, 5).map((note) => `<li><span class="mark">·</span><span>${U.escapeHtml(note)}</span></li>`).join('');
    block.removeAttribute('hidden');
  }

  function hydratePullCite(summary) {
    setText('lpPullCite', `— ${summary.period.label}`);
  }

  function hydrateDiagnostics(summary, latestActivity, enabled) {
    const block = document.getElementById('lpDiagnostics');
    const list = document.getElementById('lpDiagnosticsList');
    if (!block || !list) return;
    if (!enabled) {
      block.setAttribute('hidden', '');
      return;
    }
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
    list.innerHTML = diagnostics.map((item) => `<li>${U.escapeHtml(item)}</li>`).join('');
    block.removeAttribute('hidden');
  }

  function safeVolunteerLabel(label) {
    return Credit.isUnsafePublicIdentifier(label) ? Credit.UNNAMED : (label || Credit.UNNAMED);
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
