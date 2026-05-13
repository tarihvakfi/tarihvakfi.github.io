// Tarih Vakfı · Sayım Defteri — landing renderer.
//
// Architecture:
//   Sheet → Apps Script (?public=1) → js/snapshot.js → this script.
//   Snapshot renders instantly on first paint; live fetch overlays
//   newer data in the background.
//
//   URL flag ?live=1 bypasses the snapshot — used for previewing
//   sheet edits while authoring content.
//
// All text overrides live in the Apps Script payload's `content` map
// (filled from the "Anasayfa Metinleri" sheet tab). Each editable
// element on the page carries data-edit="<key>"; content[key] wins.

(function () {
  // ---------- URL flags ----------
  const params = new URLSearchParams(location.search);
  const liveOnly = params.get('live') === '1';

  // ---------- Snapshot bootstrap (instant paint) ----------
  const snapshot = window.__SNAPSHOT__;
  if (!liveOnly && snapshot && snapshot.ok && snapshot.data) {
    try { hydrateAll(snapshot.data); } catch (e) { /* ignore */ }
  }

  // ---------- Live fetch ----------
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
        if (body && body.ok === true && body.data) hydrateAll(body.data);
      })
      .catch(() => { /* keep snapshot or empty state */ });
  }

  // =========================================================================
  // HYDRATE ALL
  // =========================================================================
  function hydrateAll(payload) {
    const content = (payload && payload.content) || {};
    const stats = projectStats(payload);
    const ticker = Array.isArray(payload.ticker) ? payload.ticker : [];
    const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
    const volunteers = Array.isArray(payload.volunteers) ? payload.volunteers : [];
    const weekly = Array.isArray(payload.weeklyRhythm) ? payload.weeklyRhythm : [0,0,0,0,0,0,0];

    // Optional accent color override
    if (content.accentColor && /^#[0-9a-f]{3,8}$/i.test(content.accentColor)) {
      document.documentElement.style.setProperty('--accent', content.accentColor);
    }

    applyContent(content);
    hydrateMasthead(content);
    hydrateNow(ticker, volunteers, boxes);
    hydrateGlance(stats, ticker, boxes, weekly);
    hydrateSignals(content, boxes, ticker, weekly);
    hydrateMaterialBreakdown(ticker);
    hydrateDays(ticker, boxes, volunteers);
    hydrateActiveBoxes(boxes, ticker);
    hydrateFirsts(boxes, ticker, volunteers);
    hydratePullCite();
  }

  function projectStats(payload) {
    const s = payload && payload.stats;
    if (!s) return null;
    if (s.projects && s.projects.pnb) return s.projects.pnb;
    if (typeof s.totalPages !== 'undefined') return s;
    return null;
  }

  // Apply text overrides from content map to any [data-edit="<key>"] target.
  function applyContent(content) {
    Object.keys(content).forEach((key) => {
      const v = content[key];
      if (v == null || String(v).trim() === '') return;
      document.querySelectorAll(`[data-edit="${key}"]`).forEach((el) => {
        el.innerHTML = String(v);
      });
    });
  }

  // ---------- Masthead ----------
  function hydrateMasthead(content) {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const isoWeek = isoWeekNumber(now);
    const lbl = document.getElementById('lpWeekLabel');
    if (lbl) {
      const wkLabel = content.weekLabel || `Hafta ${toRoman(isoWeek)} · ${formatRange(weekStart, weekEnd)}`;
      lbl.innerHTML = wkLabel;
    }
  }

  // ---------- Şu an (live moment) ----------
  function hydrateNow(ticker, volunteers, boxes) {
    const block = document.getElementById('lpNow');
    if (!block) return;

    // Most recent ticker entry — use its firstName if present, else fall
    // back to the volunteer with the most recent lastActivity.
    const latest = recentTickerEntry(ticker);
    let name = '';
    let box = '';
    let pages = 0;

    if (latest) {
      name = (latest.firstName || '').trim();
      const t = tsMillis(latest.when || latest.createdAt);
      if (sameDay(t, Date.now())) {
        pages = sumPagesForDay(ticker, t, latest.volunteerToken || latest.firstName);
      }
    }
    if (!name) {
      const v = volunteers.slice().sort((a, b) => tsMillis(b.lastActivity) - tsMillis(a.lastActivity))[0];
      if (v) { name = v.firstName || ''; box = v.currentBox || ''; }
    }
    // Map name → currentBox via volunteers
    if (!box && name) {
      const v = volunteers.find((x) => (x.firstName || '').toLowerCase() === name.toLowerCase());
      if (v) box = v.currentBox || '';
    }
    if (!name) { block.setAttribute('hidden', ''); return; }

    document.getElementById('lpNowAvatar').textContent = initialOf(name);
    document.getElementById('lpNowName').textContent = name;
    const boxEl = document.getElementById('lpNowBox');
    if (boxEl) boxEl.textContent = box ? `Kutu ${box}'da` : '';
    const whatEl = document.getElementById('lpNowWhat');
    if (whatEl) {
      const what = boxDescription(boxes, box);
      whatEl.innerHTML = what
        ? `${escapeHtml(what)} · son hareket bugün<span class="cursor"></span>`
        : `son hareket bugün<span class="cursor"></span>`;
    }
    const pagesEl = document.getElementById('lpNowPages');
    if (pagesEl) pagesEl.textContent = pages > 0 ? `+${formatNum(pages)}` : '·';
    const clockEl = document.getElementById('lpNowClock');
    if (clockEl) {
      const t = latest ? tsMillis(latest.when || latest.createdAt) : Date.now();
      clockEl.textContent = formatTime(t);
    }
    block.removeAttribute('hidden');
  }

  // ---------- Glance band + sparkline ----------
  function hydrateGlance(stats, ticker, boxes, weekly) {
    const total = (stats && Number(stats.totalPages)) || 0;
    const done = (stats && Number(stats.donePages)) || 0;
    const pct = total > 0 ? (done / total) * 100 : 0;
    const cat = (stats && Number(stats.cataloguedBoxes)) || 0;

    setText('lpPct', pct > 0 ? `%${formatPct(pct)}` : '—');
    setText('lpProgressTotals', total > 0 ? `${formatNum(done)} / ${formatNum(total)} sayfa` : 'yükleniyor');
    setText('lpBoxes', cat > 0 ? String(cat) : '—');
    setText('lpBoxesOf', `/ 104`);
    setText('lpBoxesFoot', cat > 0 ? `${Math.max(0, 104 - cat)} kutu sırada` : '');

    // Tamamlanan bu hafta: boxes with status 'done' that received activity this week
    const weekStart = startOfWeek(new Date()).getTime();
    const doneThisWeek = boxes.filter((b) => b.status === 'done' && weeklyDelta(ticker, b, weekStart) > 0).length;
    setText('lpDone', String(doneThisWeek));
    setText('lpDoneFoot', doneThisWeek > 0 ? 'bu hafta · ilk %100' : 'henüz yok');

    // Sparkline
    const spark = document.getElementById('lpSpark');
    if (spark) {
      const totalWk = weekly.reduce((s, n) => s + n, 0);
      setText('lpWeekTotal', totalWk > 0 ? formatNum(totalWk) : '—');
      const max = Math.max(...weekly, 1);
      const labels = ['Pa','Sa','Ça','Pe','Cu','Ct','Pz'];
      const today = new Date().getDay();
      const isoToday = today === 0 ? 6 : today - 1;
      spark.innerHTML = weekly.map((n, i) => {
        const pctH = Math.max(2, Math.round((n / max) * 100));
        const cls = i === isoToday ? 'b today' : (n === 0 ? 'b quiet' : 'b');
        return `<span class="${cls}" style="height:${pctH}%" title="${labels[i]} · ${n} kayıt"><small>${labels[i]}</small></span>`;
      }).join('');
    }
  }

  // ---------- Bu haftanın işaretleri (3 signal cards) ----------
  function hydrateSignals(content, boxes, ticker, weekly) {
    const block = document.getElementById('lpSignals');
    if (!block) return;

    // signal 1: first %100 box this week (status=done with weekly delta > 0)
    const weekStart = startOfWeek(new Date()).getTime();
    const completedThisWeek = boxes.filter((b) =>
      b.status === 'done' && weeklyDelta(ticker, b, weekStart) > 0
    );
    if (completedThisWeek.length && !content.signal1Body) {
      const b = completedThisWeek[0];
      document.getElementById('lpSignal1Body').innerHTML = `<em>Kutu ${escapeHtml(b.kutu)} — ${escapeHtml(b.name)}</em> tamamlandı.`;
      const workers = (b.workers || []).slice(0, 2).join(' · ');
      document.getElementById('lpSignal1Meta').textContent = workers ? `${workers} · ${formatNum(b.totalPages)} sayfa` : `${formatNum(b.totalPages)} sayfa`;
    } else if (!content.signal1Body) {
      document.getElementById('lpSignal1Body').textContent = 'Henüz tamamlanan kutu yok.';
      document.getElementById('lpSignal1Meta').textContent = '';
    }

    // signal 2: busiest day of the week
    if (!content.signal2Body) {
      const max = Math.max(...weekly);
      if (max > 0) {
        const idx = weekly.indexOf(max);
        const dayNames = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
        document.getElementById('lpSignal2Body').innerHTML = `<em>${dayNames[idx]}</em> haftanın en yoğun günü — ${max} kayıt.`;
        document.getElementById('lpSignal2Meta').textContent = `7 günün toplamı ${weekly.reduce((s,n)=>s+n,0)} kayıt`;
      } else {
        document.getElementById('lpSignal2Body').textContent = 'Bu hafta henüz aktivite yok.';
        document.getElementById('lpSignal2Meta').textContent = '';
      }
    }

    // signal 3: newly active box this week (a box whose only ticker entries fall in this week)
    if (!content.signal3Body) {
      const fresh = boxes.find((b) => {
        if (b.status !== 'active') return false;
        const wd = weeklyDelta(ticker, b, weekStart);
        return wd > 0 && (b.donePages || 0) <= wd; // new = total done ~= this week's delta
      });
      if (fresh) {
        const worker = (fresh.workers || [])[0];
        document.getElementById('lpSignal3Body').innerHTML = `<em>Kutu ${escapeHtml(fresh.kutu)} — ${escapeHtml(fresh.name)}</em> ${worker ? `· ${escapeHtml(worker)} açtı` : 'açıldı'}.`;
        document.getElementById('lpSignal3Meta').textContent = fresh.totalPages > 0 ? `${formatNum(fresh.totalPages)} sayfa hedef` : '';
      } else {
        document.getElementById('lpSignal3Body').textContent = 'Yeni kutu açılmadı.';
        document.getElementById('lpSignal3Meta').textContent = '';
      }
    }

    block.removeAttribute('hidden');
  }

  // ---------- Çalışma alanı dağılımı ----------
  function hydrateMaterialBreakdown(ticker) {
    const block = document.getElementById('lpMat');
    if (!block) return;
    const weekStart = startOfWeek(new Date()).getTime();
    const counts = new Map();
    let total = 0;
    ticker.forEach((r) => {
      const t = tsMillis(r.when || r.createdAt);
      if (t < weekStart) return;
      const cat = r.materialCategory || 'belgeler';
      counts.set(cat, (counts.get(cat) || 0) + 1);
      total += 1;
    });
    if (total === 0) { block.setAttribute('hidden', ''); return; }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const palette = ['var(--accent)', 'var(--accent-deep)', '#6b4a2a', '#b8985a', 'rgba(10,10,10,0.4)', '#3b6463'];
    const bar = document.getElementById('lpMatBar');
    const legend = document.getElementById('lpMatLegend');
    if (bar) {
      bar.innerHTML = sorted.map(([_, n], i) => {
        const w = (n / total) * 100;
        return `<div class="seg" style="width:${w}%; background:${palette[i] || palette[5]};"></div>`;
      }).join('');
    }
    if (legend) {
      legend.innerHTML = sorted.map(([name, n], i) => {
        const pct = ((n / total) * 100).toFixed(0);
        return `<div class="row"><span class="dot" style="background:${palette[i] || palette[5]};"></span><span>${escapeHtml(capitalize(name))}</span><span class="pct">%${pct} · ${n}</span></div>`;
      }).join('');
    }
    setText('lpMatMeta', `son 7 gün · ${formatNum(total)} kayıt`);
    block.removeAttribute('hidden');
  }

  // ---------- Daily entries ----------
  function hydrateDays(ticker, boxes, volunteers) {
    const wrap = document.getElementById('lpDays');
    if (!wrap) return;
    const today = startOfDay(new Date());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      days.push(d);
    }
    wrap.innerHTML = days.map((d) => renderDayEntry(d, ticker, boxes)).join('');
    const tag = document.getElementById('lpDaysTag');
    if (tag) {
      const last = recentTickerEntry(ticker);
      const ts = last ? tsMillis(last.when || last.createdAt) : 0;
      tag.textContent = ts ? `7 gün · son giriş ${formatLongTime(ts)}` : '7 gün · sıralı';
    }
  }

  function renderDayEntry(date, ticker, boxes) {
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86400000;
    const todayStart = startOfDay(new Date()).getTime();
    const isToday = dayStart === todayStart;
    const dayNames = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    const dn = dayNames[date.getDay()];
    const dom = String(date.getDate()).padStart(2, '0');

    const dayEntries = ticker.filter((r) => {
      const t = tsMillis(r.when || r.createdAt);
      return t >= dayStart && t < dayEnd;
    });
    const isQuiet = dayEntries.length === 0;
    if (isQuiet) {
      return `<article class="day quiet">
        <div class="date"><div class="dn">${dn}</div><div class="dom">${dom}</div><div class="opens">—</div></div>
        <div class="body"><p>Arşiv kapalı.</p></div>
        <aside class="marg"><span class="stamp sessiz">kapalı</span></aside>
      </article>`;
    }

    // Aggregate
    const names = uniqueFirstNames(dayEntries);
    const boxesTouched = uniqueBoxesFromTicker(dayEntries, boxes);
    const totalPages = dayEntries.length; // each entry = 1 page in detail tabs
    const firstT = Math.min.apply(null, dayEntries.map((r) => tsMillis(r.when || r.createdAt)));
    const lastT = Math.max.apply(null, dayEntries.map((r) => tsMillis(r.when || r.createdAt)));

    const avs = names.slice(0, 5).map((n) => `<span class="av">${initialOf(n)}</span>`).join('');
    const ana = synthesizeAna(boxesTouched, names);
    const prose = synthesizeProse(dayEntries, names, boxesTouched, boxes);
    const insight = synthesizeInsight(date, dayEntries, names, boxesTouched);

    const stamp = `<span class="stamp ${isToday ? 'sururyor' : (isQuiet ? 'sessiz' : 'sururyor')}">${isToday ? 'sürüyor' : 'sürdü'}</span>`;
    const cls = 'day' + (isToday ? ' today' : '');

    return `<article class="${cls}">
      <div class="date">
        <div class="dn">${dn}</div>
        <div class="dom">${dom}</div>
        <div class="opens">açılış · ${formatHM(firstT)}<br>son · ${formatHM(lastT)}</div>
      </div>
      <div class="body">
        <div class="head">
          <div class="avs">${avs}</div>
          <span class="ana">${escapeHtml(ana)}</span>
        </div>
        ${prose}
        ${insight ? `<div class="insight"><span class="k">ne söylüyor</span>${insight}</div>` : ''}
      </div>
      <aside class="marg">
        <div class="stat-block">
          <span><b>+${formatNum(totalPages)}</b> sayfa</span>
          <span>${names.length} gönüllü</span>
          <span>${boxesTouched.length} kutu</span>
        </div>
        ${stamp}
      </aside>
    </article>`;
  }

  function synthesizeAna(boxesTouched, names) {
    if (!boxesTouched.length) return 'Arşivde sessizlik.';
    if (boxesTouched.length === 1) return `${boxesTouched[0].name || ('Kutu ' + boxesTouched[0].kutu)}.`;
    if (boxesTouched.length === 2) return `${boxesTouched.map((b) => b.name || 'Kutu ' + b.kutu).join(' ve ')}.`;
    return `${boxesTouched.length} farklı kutu.`;
  }

  function synthesizeProse(entries, names, boxesTouched, allBoxes) {
    // Group entries by (firstName, box) → count pages
    const pairs = new Map();
    entries.forEach((r) => {
      const name = (r.firstName || '').trim();
      const boxKey = bestBoxForEntry(r, allBoxes);
      const key = `${name}|${boxKey}`;
      pairs.set(key, (pairs.get(key) || 0) + 1);
    });
    const groups = Array.from(pairs.entries())
      .map(([k, n]) => {
        const [name, boxKey] = k.split('|');
        return { name, box: boxKey, pages: n };
      })
      .filter((g) => g.name)
      .sort((a, b) => b.pages - a.pages)
      .slice(0, 4);
    if (!groups.length) {
      return `<p>${escapeHtml(names.join(', '))} bugün arşive geldi.</p>`;
    }
    const parts = groups.map((g) => {
      const boxTag = g.box ? `<span class="tag">Kutu ${escapeHtml(g.box)}</span>` : '';
      return `<em class="name">${escapeHtml(g.name)}</em> ${boxTag} <span class="delta">(+${g.pages})</span>`;
    });
    return `<p>${parts.join('; ')}.</p>`;
  }

  function synthesizeInsight(date, entries, names, boxesTouched) {
    if (!entries.length) return '';
    const today = startOfDay(new Date()).getTime();
    const total = entries.length;
    if (date.getTime() === today) {
      return `Bugün <b>${total} sayfa</b> arşive girdi · ${names.length} kişi, ${boxesTouched.length} kutu.`;
    }
    // For other days: pick the largest single-volunteer contribution
    const byName = new Map();
    entries.forEach((r) => {
      const n = (r.firstName || '').trim();
      if (!n) return;
      byName.set(n, (byName.get(n) || 0) + 1);
    });
    const top = Array.from(byName.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top) return `<em class="name">${escapeHtml(top[0])}</em> bu gün <b>${top[1]} sayfa</b> taradı.`;
    return '';
  }

  // ---------- Active boxes this week ----------
  function hydrateActiveBoxes(boxes, ticker) {
    const block = document.getElementById('lpBoxesWeek');
    const rows = document.getElementById('lpBoxesWeekRows');
    if (!block || !rows) return;
    const weekStart = startOfWeek(new Date()).getTime();
    const enriched = boxes
      .map((b) => Object.assign({}, b, { _delta: weeklyDelta(ticker, b, weekStart) }))
      .filter((b) => b._delta > 0)
      .sort((a, b) => b._delta - a._delta)
      .slice(0, 8);
    if (!enriched.length) { block.setAttribute('hidden', ''); return; }
    setText('lpBoxesWeekMeta', `${enriched.length} kutu`);
    rows.innerHTML = enriched.map((b) => {
      const pct = b.totalPages > 0 ? Math.round((b.donePages / b.totalPages) * 100) : 0;
      const pctCls = b.status === 'done' ? 'pct done' : 'pct';
      const pctText = b.status === 'done' ? '%100 ✓' : (pct > 0 ? `%${pct}` : '—');
      const workers = (b.workers || []).slice(0, 2).join(' + ') || '—';
      return `<div class="box-row">
        <span class="n">${escapeHtml(b.kutu)}</span>
        <span class="desc">${escapeHtml(b.name || 'Kutu ' + b.kutu)}<small>${formatNum(b.dosya)} dosya · ${formatNum(b.belge)} belge</small></span>
        <span class="who">${escapeHtml(workers)}</span>
        <span class="delta">+${formatNum(b._delta)}</span>
        <span class="${pctCls}">${pctText}</span>
      </div>`;
    }).join('');
    block.removeAttribute('hidden');
  }

  // ---------- Bu hafta ilk kez ----------
  function hydrateFirsts(boxes, ticker, volunteers) {
    const block = document.getElementById('lpFirsts');
    const list = document.getElementById('lpFirstsList');
    if (!block || !list) return;
    const items = [];
    const weekStart = startOfWeek(new Date()).getTime();

    // First %100 boxes this week
    const completed = boxes.filter((b) => b.status === 'done' && weeklyDelta(ticker, b, weekStart) > 0);
    completed.forEach((b) => {
      const worker = (b.workers || [])[0];
      items.push(`Projedeki ilk %100 tamamlandı — <em class="name">${escapeHtml(worker || '—')}</em>, Kutu ${escapeHtml(b.kutu)}.`);
    });

    // Newly opened boxes this week
    const fresh = boxes.find((b) => b.status === 'active' && weeklyDelta(ticker, b, weekStart) > 0 && b.donePages > 0 && b.donePages <= weeklyDelta(ticker, b, weekStart) * 1.2);
    if (fresh) {
      const worker = (fresh.workers || [])[0];
      items.push(`<em class="name">Kutu ${escapeHtml(fresh.kutu)} — ${escapeHtml(fresh.name)}</em> ilk satırını ${escapeHtml(worker || 'bir gönüllü')} bu hafta yazdı.`);
    }

    // Single-day single-volunteer record
    const byDayVolunteer = new Map();
    ticker.forEach((r) => {
      const t = tsMillis(r.when || r.createdAt);
      if (t < weekStart) return;
      const k = `${dayKey(t)}|${r.firstName || r.volunteerToken || '?'}`;
      byDayVolunteer.set(k, (byDayVolunteer.get(k) || 0) + 1);
    });
    let topN = 0; let topKey = '';
    byDayVolunteer.forEach((v, k) => { if (v > topN) { topN = v; topKey = k; } });
    if (topN >= 30) {
      const [_, who] = topKey.split('|');
      items.push(`Tek bir günde tek bir gönüllüden <em class="name">+${formatNum(topN)} sayfa</em> rekoru — ${escapeHtml(who)}.`);
    }

    if (!items.length) { block.setAttribute('hidden', ''); return; }
    list.innerHTML = items.slice(0, 4).map((html) => `<li><span class="mark">·</span><span>${html}</span></li>`).join('');
    block.removeAttribute('hidden');
  }

  function hydratePullCite() {
    const cite = document.getElementById('lpPullCite');
    if (cite) cite.textContent = `— Hafta ${toRoman(isoWeekNumber(new Date()))}`;
  }

  // =========================================================================
  // Helpers
  // =========================================================================
  function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function tsMillis(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') { const t = Date.parse(ts); return isNaN(t) ? 0 : t; }
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (typeof ts._seconds === 'number') return ts._seconds * 1000;
    return 0;
  }
  function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  function sameDay(a, b) { return startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime(); }
  function startOfWeek(d) {
    // Monday-start week
    const x = startOfDay(d);
    const day = x.getDay(); // 0=Sun..6=Sat
    const diff = (day === 0 ? -6 : 1 - day);
    x.setDate(x.getDate() + diff);
    return x;
  }
  function endOfWeek(d) { const s = startOfWeek(d); const e = new Date(s); e.setDate(e.getDate() + 6); return e; }
  function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
  function isoWeekNumber(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  }
  function toRoman(n) {
    if (!n) return '';
    const rn = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
    let s = '';
    rn.forEach(([sym, val]) => { while (n >= val) { s += sym; n -= val; } });
    return s;
  }
  function formatRange(start, end) {
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const sM = months[start.getMonth()];
    const eM = months[end.getMonth()];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${sM}`;
    }
    return `${start.getDate()} ${sM} – ${end.getDate()} ${eM}`;
  }
  function formatNum(n) { return new Intl.NumberFormat('tr-TR').format(Number(n) || 0); }
  function formatPct(p) { if (p < 10) return p.toFixed(1).replace('.', ','); return Math.round(p).toString(); }
  function formatHM(t) { if (!t) return '—'; const d = new Date(t); return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
  function formatTime(t) { return formatHM(t) + ' TRT'; }
  function formatLongTime(t) {
    const d = new Date(t);
    const today = startOfDay(new Date()).getTime();
    const dayMid = startOfDay(d).getTime();
    const diff = Math.floor((today - dayMid) / 86400000);
    const hm = formatHM(t);
    if (diff === 0) return `bugün ${hm}`;
    if (diff === 1) return `dün ${hm}`;
    return `${diff} gün önce`;
  }
  function initialOf(name) { const s = String(name || '').trim(); return s ? s.charAt(0).toLocaleUpperCase('tr') : '·'; }
  function capitalize(s) { if (!s) return ''; return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1); }
  function recentTickerEntry(ticker) {
    let best = null; let bestT = 0;
    ticker.forEach((r) => {
      const t = tsMillis(r.when || r.createdAt);
      if (t > bestT) { bestT = t; best = r; }
    });
    return best;
  }
  function sumPagesForDay(ticker, dayMs, who) {
    const start = startOfDay(new Date(dayMs)).getTime();
    const end = start + 86400000;
    return ticker.filter((r) => {
      const t = tsMillis(r.when || r.createdAt);
      if (t < start || t >= end) return false;
      if (!who) return true;
      return (r.volunteerToken && r.volunteerToken === who)
          || (r.firstName && r.firstName === who);
    }).length;
  }
  function uniqueFirstNames(entries) {
    const seen = new Map();
    entries.forEach((r) => {
      const n = (r.firstName || '').trim();
      if (!n) return;
      seen.set(n.toLowerCase(), n);
    });
    return Array.from(seen.values()).sort();
  }
  function uniqueBoxesFromTicker(entries, allBoxes) {
    const seen = new Map();
    entries.forEach((r) => {
      const boxKey = bestBoxForEntry(r, allBoxes);
      if (!boxKey) return;
      if (!seen.has(boxKey)) {
        const found = allBoxes.find((b) => String(b.kutu) === String(boxKey));
        seen.set(boxKey, found || { kutu: boxKey, name: 'Kutu ' + boxKey });
      }
    });
    return Array.from(seen.values());
  }
  // Best-effort: extract box reference from the ticker entry id.
  // Apps Script ticker ids look like: "sheet_pnb_14_betul_row42" → box 14
  // For gunluk_akis entries, no box info; fall back to the volunteer's currentBox.
  function bestBoxForEntry(r, allBoxes) {
    const id = String(r.id || '');
    const m = id.match(/sheet_pnb_([a-z0-9]+)_/i);
    if (m) {
      const key = m[1].toUpperCase().replace(/^I/, 'I·');
      // try to find a matching box; if not found return the raw key
      const found = allBoxes.find((b) => normalizeBoxKey(b.kutu) === normalizeBoxKey(m[1]));
      return found ? found.kutu : m[1];
    }
    return '';
  }
  function normalizeBoxKey(k) {
    return String(k || '').toLowerCase().replace(/[·.\-_\s]/g, '');
  }
  function boxDescription(boxes, kutu) {
    if (!kutu) return '';
    const b = boxes.find((x) => String(x.kutu) === String(kutu));
    return b && b.name ? b.name : '';
  }
  function weeklyDelta(ticker, box, weekStart) {
    if (!box || !box.kutu) return 0;
    const key = normalizeBoxKey(box.kutu);
    let n = 0;
    ticker.forEach((r) => {
      const t = tsMillis(r.when || r.createdAt);
      if (t < weekStart) return;
      const id = String(r.id || '');
      const m = id.match(/sheet_pnb_([a-z0-9]+)_/i);
      if (m && normalizeBoxKey(m[1]) === key) n += 1;
    });
    return n;
  }
})();
