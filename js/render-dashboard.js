// Tarih Vakfı Gönüllü Emek Günlüğü — public aggregate renderer.
(function () {
  const U = window.TVFUtils;
  const Credit = window.TVFVolunteerCredit;

  function renderDashboard(payload, opts) {
    const summary = payload.publicSummary;
    const content = payload.content || {};
    if (!summary) return;
    const latestActivity = publicLatestActivity(payload.latestActivity, summary);

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
    hydrateArchiveLeaf(content);
    hydrateWeeklyPlan(content);
    hydrateEquipmentUsage(content);
    hydrateDiagnostics(summary, latestActivity, opts && opts.debug);
  }

  function namesForDay_(plan, day) {
    const seen = new Map();
    (plan.stations || []).forEach((s) => {
      const raw = s.byDay && s.byDay[day];
      const cleaned = raw && raw.trim();
      if (!cleaned || cleaned.toLowerCase() === 'gönüllü') return;
      seen.set(cleaned.toLowerCase(), cleaned);
    });
    ((plan.extras && plan.extras[day]) || []).forEach((n) => {
      if (n) seen.set(n.toLowerCase(), n);
    });
    return [...seen.values()];
  }

  function hydrateArchiveLeaf(content) {
    const el = document.getElementById('lpArchiveLeaf');
    if (!el) return;
    const leaves = Array.isArray(content.archiveLeaves) ? content.archiveLeaves : [];
    if (!leaves.length) { el.hidden = true; return; }
    const leaf = leaves[0];
    el.hidden = false;
    const titleEl = el.querySelector('.leaf-title');
    const metaEl = el.querySelector('.leaf-meta');
    if (titleEl) titleEl.textContent = leaf.title;
    if (metaEl) {
      const meta = [
        leaf.docDate ? `Belge tarihi ${leaf.docDate}` : null,
        leaf.code,
        leaf.contributor ? `tarayan: ${leaf.contributor}` : null
      ].filter(Boolean).join(' · ');
      metaEl.textContent = meta;
    }
  }

  function hydrateWeeklyPlan(content) {
    const el = document.getElementById('lpWeeklyPlan');
    const rows = document.getElementById('lpWeeklyPlanRows');
    if (!el || !rows) return;
    const plan = content.weeklyPlan;
    const head = document.getElementById('lpWeeklyPlanHead');
    const hasStations = plan && Array.isArray(plan.stations) && plan.stations.length;
    const hasExtras = plan && plan.extras && Object.values(plan.extras).some((names) => Array.isArray(names) && names.length);
    if (!plan || (!hasStations && !hasExtras)) {
      el.hidden = true;
      if (head) head.hidden = true;
      return;
    }
    el.hidden = false;
    if (head) head.hidden = false;
    const todayFull = U.weekdayTR ? U.weekdayTR(new Date()) : null;
    const todayKey = (todayFull || '').slice(0, 3).toLocaleLowerCase('tr');
    const isToday = (d) => (d || '').slice(0, 3).toLocaleLowerCase('tr') === todayKey;
    const headRow = `<div class="wp-row wp-head"><span class="wp-station"></span>${plan.days.map((d) => `<span class="wp-day${isToday(d) ? ' wp-today' : ''}">${U.escapeHtml(d.slice(0, 3))}</span>`).join('')}</div>`;
    const body = (plan.stations || []).map((s) => {
      const cells = plan.days.map((d) => {
        const name = s.byDay[d];
        const cls = 'wp-cell' + (isToday(d) ? ' wp-today' : '') + (name ? '' : ' wp-empty');
        return `<span class="${cls}">${U.escapeHtml(name || '—')}</span>`;
      }).join('');
      return `<div class="wp-row"><span class="wp-station">${U.escapeHtml(s.station)}</span>${cells}</div>`;
    }).join('');
    const extrasRow = hasExtras ? (() => {
      const cells = plan.days.map((d) => {
        const names = (plan.extras && plan.extras[d]) || [];
        const cls = 'wp-cell wp-extra' + (isToday(d) ? ' wp-today' : '') + (names.length ? '' : ' wp-empty');
        return `<span class="${cls}">${names.length ? names.map(U.escapeHtml).join(', ') : '—'}</span>`;
      }).join('');
      return `<div class="wp-row wp-extras"><span class="wp-station">Ek gönüllüler</span>${cells}</div>`;
    })() : '';
    const totalsRow = (() => {
      const cells = plan.days.map((d) => {
        const n = namesForDay_(plan, d).length;
        const cls = 'wp-cell wp-total-cell' + (isToday(d) ? ' wp-today' : '');
        return `<span class="${cls}">${n || '—'}</span>`;
      }).join('');
      return `<div class="wp-row wp-totals"><span class="wp-station">Toplam</span>${cells}</div>`;
    })();
    rows.innerHTML = headRow + body + extrasRow + totalsRow;
  }

  function hydrateEquipmentUsage(content) {
    const el = document.getElementById('lpEquipment');
    const bars = document.getElementById('lpEquipmentBars');
    if (!el || !bars) return;
    const usage = Array.isArray(content.equipmentUsage) ? content.equipmentUsage : [];
    const eqHead = document.getElementById('lpEquipmentHead');
    if (!usage.length) {
      el.hidden = true;
      if (eqHead) eqHead.hidden = true;
      return;
    }
    el.hidden = false;
    if (eqHead) eqHead.hidden = false;
    const max = Math.max(1, ...usage.map((u) => Number(u.sessions || 0)));
    bars.innerHTML = usage.map((u) => {
      const pct = Math.max(4, Math.round((Number(u.sessions || 0) / max) * 100));
      return `<div class="eq-row"><div class="eq-label"><span>${U.escapeHtml(u.device)}</span><span>${U.formatNum(u.sessions)}</span></div><div class="eq-track"><div class="eq-fill" style="width:${pct}%"></div></div></div>`;
    }).join('');
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
    const periodLabel = U.formatPeriodLabel(summary.period);
    setText('lpWeekLabel', periodLabel);
    setText('lpHeroPeriod', periodLabel);
    const sync = document.getElementById('lpSyncLabel');
    if (sync) sync.textContent = summary.generatedAt ? `son güncelleme ${U.relativeDate(summary.generatedAt)}` : 'senkron bekleniyor';
    const lede = document.getElementById('lpHeroLede');
    if (lede && summary.totals) {
      lede.innerHTML = `Bu aralıkta Tarih Vakfı gönüllü çalışmaları için <b>${U.formatNum(summary.totals.records)} katkı</b> görünür oldu: ${U.formatNum(summary.totals.pageRows)} sayfa/detay satırı ve ${U.formatNum(summary.totals.activityRows)} faaliyet kaydı. PNB arşivi sayısallaştırması, güncel dönemin öncelikli iş kalemi olarak izlenir.`;
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
    setText('lpNowPages', latest.kind === 'activity' ? '+1' : `+${U.formatNum(publicPageUnits(latest))}`);
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
    const truthProgress = progressStatus(summary);
    setText('lpTruthProgress', truthProgress.ok ? `%${U.formatPct(truthProgress.percent)}` : '—');
  }

  function hydrateGlance(summary) {
    const totals = summary.totals || {};
    setText('lpWeekTotal', totals.records > 0 ? U.formatNum(totals.records) : '—');
    const glanceProgress = progressStatus(summary);
    setText('lpPct', glanceProgress.ok ? `%${U.formatPct(glanceProgress.percent)}` : 'veri bekleniyor');
    setText('lpProgressTotals', glanceProgress.ok
      ? `${U.formatNum(totals.pagesDone)} / ${U.formatNum(totals.pagesTarget)} sayfa`
      : 'ilerleme yeniden hesaplanıyor');
    const fill = document.getElementById('lpPctFill');
    if (fill) fill.style.width = glanceProgress.ok ? `${Math.max(0, Math.min(100, glanceProgress.percent))}%` : '0%';
    setText('lpBoxes', totals.boxesTotal ? U.formatNum(totals.boxesTotal) : (totals.boxesCatalogued ? U.formatNum(totals.boxesCatalogued) : '—'));
    setText('lpBoxesOf', 'kutu · toplam PNB fonu');
    setText('lpBoxesFoot', totals.boxesActive
      ? `${U.formatNum(totals.boxesActive)} kutuda dönem çalışması var`
      : 'bu dönemde çalışma yok');
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
    setText('lpSignal1Meta', `${U.formatNum(periodDetailRows(totals))} arşiv detayı işlendi`);

    const two = document.getElementById('lpSignal2Body');
    if (two && busiest && busiest.records > 0) {
      two.innerHTML = `<em>${U.escapeHtml(busiest.weekdayTR)}</em> dönemin en yoğun günü — ${U.formatNum(busiest.records)} kayıt.`;
      setText('lpSignal2Meta', `${U.formatDayMonth(busiest.dateISO)} · ${U.formatNum(busiest.pageRows)} sayfa/detay + ${U.formatNum(busiest.activityRows)} faaliyet`);
    } else if (two) {
      two.textContent = 'Bu dönemde henüz kayıt görünmüyor.';
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
    setText('lpMatMeta', 'güncel dönem');
    block.removeAttribute('hidden');
  }

  function hydrateDays(summary) {
    const wrap = document.getElementById('lpDays');
    if (!wrap) return;
    const days = (Array.isArray(summary.byDay) ? summary.byDay : [])
      .slice()
      .filter((day) => isBusinessDayISO(U.toISODate(day.dateISO)))
      .sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')));
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
        <div class="body"><p>Bugün için görünür katkı yok.</p></div>
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
        : (row.topBox || 'Genel destek');
      const unitParts = [];
      if (row.pageRows) unitParts.push(`${U.formatNum(row.pageRows)} sayfa/detay`);
      if (row.activityRows) unitParts.push(`${U.formatNum(row.activityRows)} faaliyet kaydı`);
      if (!unitParts.length) unitParts.push(`${U.formatNum(row.records)} katkı kaydı`);
      const meta = row.publicRole
        ? `${row.publicRole} · ${unitParts.join(' · ')}`
        : `${boxBreakdown} · ${unitParts.join(' · ')}`;
      return `<article class="vol-row" data-volunteer-label="${U.escapeHtml(label)}">
        <div class="vol-avatar">${U.escapeHtml(U.initialOf(label))}</div>
        <div>
          <p class="vol-name">${U.escapeHtml(label)}</p>
          <p class="vol-meta">${U.escapeHtml(meta)}</p>
        </div>
        <span class="vol-pages">${U.formatNum(row.pageRows || row.pagesDone || row.records)}</span>
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
    const periodTotal = boxes.reduce((sum, box) => sum + Number(box.periodPageRows || box.pageRows || box.periodRecords || 0), 0);
    setText('lpBoxesWeekMeta', `${U.formatNum(boxes.length)} kutu · ${U.formatNum(periodTotal)} dönem kaydı`);
    rows.innerHTML = `<div class="box-grid">${boxes.map((box) => {
      const target = Number(box.target || 0);
      const rawDone = Number(box.done || 0);
      const boxRows = Number(box.pageRows || box.periodPageRows || 0);
      const boxPeriodUnits = Number(box.periodPagesDone || 0);
      const inflatedBox = boxRows > 0 && (
        boxPeriodUnits > boxRows * 1.5 ||
        (target > 0 && rawDone > target && boxRows <= target)
      );
      const done = inflatedBox ? boxRows : rawDone;
      const pct = target > 0 ? Math.round((Math.min(done, target) / target) * 1000) / 10 : (box.percent == null ? null : Number(box.percent));
      const progressWidth = pct == null ? 0 : Math.max(2, Math.min(100, pct));
      const pctText = pct == null ? '—' : `%${U.formatPct(pct)}`;
      const status = pct >= 100 ? 'tamamlandı' : (pct >= 50 ? 'ilerliyor' : (pct > 0 ? 'başladı' : 'bekliyor'));
      const periodPageRows = box.periodPageRows || box.pageRows || box.periodRecords || 0;
      const remaining = target ? Math.max(0, target - done) : null;
      const progressLabel = target
        ? `${U.formatNum(done)} / ${U.formatNum(target)} sayfa · ${pctText}`
        : `${U.formatNum(done)} sayfa işlendi · hedef eksik`;
      const contributors = (box.contributors || box.topContributors || [])
        .filter((item) => isPublicVolunteerName(item.label))
        .slice(0, 4)
        .map((item) => `<span class="box-chip">${U.escapeHtml(publicVolunteerLabel(item.label))} <b>+${U.formatNum(item.pageRows || item.records || 0)}</b></span>`)
        .join('');
      const material = (box.materialCounts || box.materials || []).slice(0, 2).map(materialPhrase).join(' · ');
      return `<article class="box-card${pct >= 100 ? ' complete' : ''}">
        <div class="box-card-head">
          <div>
            <p class="box-kicker">aktif kutu</p>
            <h4 class="box-label">${U.escapeHtml(box.label || box.boxLabel || ('Kutu ' + box.box))}</h4>
          </div>
          <span class="box-status">${U.escapeHtml(status)}</span>
        </div>
        <div class="box-card-main">
          <div class="box-percent">${U.escapeHtml(pctText)}</div>
          <div class="box-period"><b>+${U.formatNum(periodPageRows)}</b><span>sayfa/detay</span></div>
        </div>
        <div class="box-progress" aria-label="${U.escapeHtml(progressLabel)}"><span style="width:${progressWidth}%"></span></div>
        <div class="box-stats">
          <span><b>${U.formatNum(done)}</b><small>işlenen</small></span>
          <span><b>${target ? U.formatNum(target) : '—'}</b><small>hedef</small></span>
          <span><b>${remaining == null ? '—' : U.formatNum(remaining)}</b><small>kalan</small></span>
        </div>
        <div class="box-card-body">
          <p>Son çalışma · ${U.escapeHtml(U.formatDayMonth(box.lastActivityDate))}</p>
          ${material ? `<p>${U.escapeHtml(material)}</p>` : ''}
          ${contributors ? `<div class="box-contributors"><span class="box-minihead">Katkı verenler</span><div>${contributors}</div></div>` : ''}
        </div>
      </article>`;
    }).join('')}</div>`;
    block.removeAttribute('hidden');
  }

  function hydrateLatestActivity(summary, latestActivity) {
    const block = document.getElementById('lpLatest');
    const list = document.getElementById('lpLatestRows');
    if (!block || !list) return;
    const rows = groupLatestActivity(latestActivity.filter((row) => isPublicVolunteerName(row.volunteerLabel)))
      .filter((row) => isBusinessDayISO(U.toISODate(row.dateISO || row.when)));
    const days = latestCalendarDays(summary, rows);
    if (!days.length) {
      block.setAttribute('hidden', '');
      return;
    }
    const total = days.reduce((sum, day) => sum + Number(day.records || day.entries.length || 0), 0);
    setText('lpLatestMeta', total ? `${U.formatNum(total)} çalışma` : 'Çalışma kaydı yok');
    list.innerHTML = days.map(renderLatestDayCard).join('');
    block.removeAttribute('hidden');
  }

  function latestCalendarDays(summary, rows) {
    const byDate = new Map();
    rows.forEach((row) => {
      const iso = U.toISODate(row.dateISO || row.when);
      if (!iso || !isBusinessDayISO(iso)) return;
      if (!byDate.has(iso)) byDate.set(iso, []);
      byDate.get(iso).push(row);
    });

    const summaryDays = Array.isArray(summary.byDay) ? summary.byDay : [];
    const days = summaryDays.length
      ? summaryDays.slice()
          .filter((day) => isBusinessDayISO(U.toISODate(day.dateISO)))
          .sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')))
      : Array.from(byDate.keys()).sort((a, b) => String(b).localeCompare(String(a))).map((dateISO) => ({ dateISO }));

    byDate.forEach((entries, dateISO) => {
      if (!days.some((day) => U.toISODate(day.dateISO) === dateISO)) {
        days.push({ dateISO });
      }
    });

    return days
      .sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')))
      .map((day) => {
        const dateISO = U.toISODate(day.dateISO);
        return Object.assign({}, day, {
          dateISO,
          entries: latestEntriesForDay(day, byDate.get(dateISO) || [])
        });
      })
      .filter((day) => day.dateISO && isBusinessDayISO(day.dateISO));
  }

  function latestEntriesForDay(day, fallbackRows) {
    const contributors = publicContributorRows(day.contributors || []);
    if (contributors.length) {
      return contributors.map((item) => ({
        dateISO: U.toISODate(day.dateISO),
        when: day.lastTime || day.firstTime || day.dateISO,
        volunteerLabel: item.label,
        publicRole: item.publicRole || '',
        kind: 'summary',
        records: Number(item.records || 0),
        pageRows: Number(item.pageRows || 0),
        activityRows: Number(item.activityRows || 0),
        pagesDone: Number(item.pagesDone || 0),
        workRows: Array.isArray(item.workRows) ? item.workRows : []
      }));
    }
    return Array.isArray(fallbackRows) ? fallbackRows : [];
  }

  function isBusinessDayISO(iso) {
    if (!iso) return false;
    const date = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  function renderLatestDayCard(day) {
    const entries = Array.isArray(day.entries) ? day.entries : [];
    const parts = dateParts(day);
    const isToday = U.sameIsoDate(day.dateISO, new Date());
    const cls = `latest-day${entries.length ? '' : ' quiet'}${isToday ? ' today' : ''}`;
    const workCount = Number(day.records || entries.length || 0);
    const countText = workCount ? `${U.formatNum(workCount)} çalışma` : 'Çalışma kaydı yok';
    const summary = renderLatestDaySummary(day);
    const body = entries.length
      ? `${summary}${entries.map(renderLatestWork).join('')}`
      : '<p class="latest-empty">Çalışma kaydı yok</p>';
    return `<article class="${cls}">
      <div class="latest-day-top">
        <span>${U.escapeHtml(parts.weekday)}</span>
        <span>${U.escapeHtml(countText)}</span>
      </div>
      <div class="latest-day-date">
        <span class="latest-day-num">${U.escapeHtml(parts.day)}</span>
        <span class="latest-day-month">${U.escapeHtml(parts.month)}</span>
      </div>
      <div class="latest-day-body">${body}</div>
    </article>`;
  }

  function renderLatestDaySummary(day) {
    const bits = [];
    if (Number(day.pageRows || 0)) bits.push(`${U.formatNum(day.pageRows)} sayfa/detay`);
    if (Number(day.activityRows || 0)) bits.push(`${U.formatNum(day.activityRows)} faaliyet`);
    const boxCount = Number(day.boxesCount || (day.boxLabels || []).length || 0);
    if (boxCount) bits.push(`${U.formatNum(boxCount)} kutu`);
    const materials = (day.materials || []).slice(0, 2).map(materialPhrase).join(' · ');
    const boxText = (day.boxLabels || []).slice(0, 3).join(', ');
    const line = bits.join(' · ');
    const tail = [boxText ? `Kutu: ${boxText}` : '', materials ? `Malzeme: ${materials}` : ''].filter(Boolean).join(' · ');
    if (!line && !tail) return '';
    return `<p class="latest-day-summary">${U.escapeHtml([line, tail].filter(Boolean).join(' · '))}</p>`;
  }

  function renderLatestWork(row) {
    const label = publicVolunteerLabel(row.volunteerLabel);
    const detailParts = [];
    const context = latestWorkContext(row);
    if (row.publicRole) detailParts.push(row.publicRole);
    if (row.boxLabel) detailParts.push(row.boxLabel);
    if (row.kind === 'activity') {
      detailParts.push(`${U.formatNum(row.records)} faaliyet`);
    } else if (row.kind === 'summary') {
      const summaryBits = [];
      if (Number(row.pageRows || 0)) summaryBits.push(`${U.formatNum(row.pageRows)} sayfa/detay`);
      if (Number(row.activityRows || 0)) summaryBits.push(`${U.formatNum(row.activityRows)} faaliyet`);
      detailParts.push(summaryBits.length ? summaryBits.join(' · ') : `${U.formatNum(row.records)} çalışma`);
    } else {
      detailParts.push(`${U.formatNum(publicPageUnits(row))} sayfa/detay`);
    }
    return `<div class="latest-work">
      <span class="latest-work-dot" aria-hidden="true"></span>
      <p>
        <span class="latest-work-name" data-volunteer-label="${U.escapeHtml(label)}"${latestContextAttrs(context)} role="button" tabindex="0" aria-label="${U.escapeHtml(label)} ayrıntıları">${U.escapeHtml(label)}</span>
        <span class="latest-work-detail">${U.escapeHtml(detailParts.join(' · '))}</span>
      </p>
    </div>`;
  }

  function latestWorkContext(row) {
    const workRows = Array.isArray(row.workRows) ? row.workRows : [];
    const first = workRows[0] || {};
    return {
      dateISO: U.toISODate(row.dateISO || row.when || first.dateISO),
      title: first.workTitle || row.workTitle || '',
      detail: first.workDetail || row.workDetail || '',
      boxLabel: first.boxLabel || row.boxLabel || '',
      kind: first.kind || row.kind || '',
      material: first.material || row.material || '',
      records: Number(first.records || row.records || 0),
      pageRows: Number(first.pageRows || row.pageRows || 0),
      activityRows: Number(first.activityRows || row.activityRows || 0),
      pagesDone: Number(first.pagesDone || row.pagesDone || 0)
    };
  }

  function latestContextAttrs(context) {
    const attrs = {
      'data-context-date': context.dateISO || '',
      'data-context-title': context.title || '',
      'data-context-detail': context.detail || '',
      'data-context-box': context.boxLabel || '',
      'data-context-kind': context.kind || '',
      'data-context-material': context.material || '',
      'data-context-records': context.records || '',
      'data-context-page-rows': context.pageRows || '',
      'data-context-activity-rows': context.activityRows || '',
      'data-context-pages-done': context.pagesDone || ''
    };
    return Object.keys(attrs).map((key) => {
      const value = attrs[key];
      return value == null || value === '' ? '' : ` ${key}="${U.escapeHtml(value)}"`;
    }).join('');
  }

  function dateParts(day) {
    const iso = U.toISODate(day.dateISO);
    const date = iso ? new Date(`${iso}T12:00:00`) : null;
    const valid = date && !Number.isNaN(date.getTime());
    return {
      weekday: day.weekdayTR || (iso ? U.weekdayTR(iso) : ''),
      day: String(day.dayNumber || (valid ? date.getDate() : '') || '').padStart(2, '0'),
      month: valid ? U.TR_MONTHS[date.getMonth()] : ''
    };
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
      setText('lpDiagnosticsTitle', '');
      list.innerHTML = '';
      block.hidden = true;
      return;
    }
    block.hidden = false;
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
    const flaggedProgress = progressStatus(summary);
    if (flaggedProgress.flaggedCount > 0) {
      diagnostics.push(`progress_boxes_flagged: ${flaggedProgress.flaggedCount} kutuda ilerleme sinyali tutarsız (${flaggedProgress.flaggedBoxes.join(', ')}) — genel yüzdeye dahil, ayrı işaretlendi.`);
    }
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
        activityRows: Number(row.activityRows || 0),
        pagesDone: Number(row.pagesDone || 0),
        workRows: Array.isArray(row.workRows) ? row.workRows : []
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
          workTitle: row.workTitle || '',
          workDetail: row.workDetail || '',
          records: 0,
          pagesDone: 0
        });
      }
      const group = groups.get(key);
      group.records += Number(row.records || 1);
      group.pagesDone += publicPageUnits(row);
      if (!group.workTitle && row.workTitle) group.workTitle = row.workTitle;
      if (!group.workDetail && row.workDetail) group.workDetail = row.workDetail;
      if (row.when && (!group.when || String(row.when) > String(group.when))) group.when = row.when;
    });
    return Array.from(groups.values()).sort((a, b) => String(b.when || b.dateISO || '').localeCompare(String(a.when || a.dateISO || '')));
  }

  function publicLatestActivity(rows, summary) {
    const period = (summary && summary.period) || {};
    const startISO = period.startDate || '';
    const endISO = period.endDate || U.toISODate(new Date());
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => {
        const iso = U.toISODate(row.dateISO || row.when);
        if (!iso || !isPublicVolunteerName(row.volunteerLabel)) return false;
        if (startISO && iso < startISO) return false;
        return !endISO || iso <= endISO;
      })
      .slice()
      .sort((a, b) => String(b.when || b.dateISO || '').localeCompare(String(a.when || a.dateISO || '')));
  }

  function publicPageUnits(row) {
    if (!row || row.kind !== 'page') return 0;
    const records = Math.max(1, Number(row.records || 1));
    const units = Number(row.pagesDone || 0);
    if (row.recordType === 'page_detail' && units > records) return records;
    return units > 0 ? units : records;
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

  function periodDetailRows(totals) {
    return Number(totals && (totals.pageRows || totals.periodPagesDone) || 0);
  }

  function progressStatus(summary) {
    const totals = (summary && summary.totals) || {};
    const source = (summary && summary.source) || {};
    const reliableBasis = ['pnb_sayisallastirma_d103', 'workbook_progress_label_scan', 'pnb_inventory_done_total_scan'];
    const hasTarget = Number(totals.pagesTarget || 0) > 0;
    const hasBasis = reliableBasis.indexOf(source.progressBasis) >= 0;
    const flagged = (Array.isArray(summary && summary.byBox) ? summary.byBox : []).filter((box) => {
      const target = Number(box.target || 0);
      const done = Number(box.done || 0);
      const rows = Number(box.pageRows || box.periodPageRows || 0);
      const periodUnits = Number(box.periodPagesDone || 0);
      return rows > 0 && (
        periodUnits > rows * 1.5 ||
        (target > 0 && done > target && rows <= target)
      );
    });
    return {
      ok: hasTarget && hasBasis,
      percent: hasTarget && hasBasis ? totals.progressPercent : null,
      flaggedCount: flagged.length,
      flaggedBoxes: flagged.map((b) => b.box)
    };
  }

  // Back-compat boolean shim for any external callers.
  function progressIsReliable(summary) {
    return progressStatus(summary).ok;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  window.TVFRenderDashboard = { renderDashboard, renderError };
})();
