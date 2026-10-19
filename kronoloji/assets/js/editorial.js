/* Uses the existing data loader and its live refresh; no duplicate data source. */
(() => {
  const filterKeys = { q:'Search', kind:'Kind', period:'Period', status:'Status', code:'Code', from:'YearFrom', to:'YearTo' };
  let yearSections = [];
  let scrollPending = false;
  let filterTimer;
  const $ = (id) => document.getElementById(id);
  const safe = escapeHtml;
  const kindLabel = (row) => row.item_kind === 'organizational' ? 'Kurum tarihi' : KIND_LABELS[row.item_kind] || 'Kayıt';
  const recordHref = (row) => `item.html?id=${encodeURIComponent(row.id)}`;
  const dateLabel = (row) => {
    const value = row.date_display || String(row.year || 'Tarih belirtilmemiş');
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]00:00:00)?$/);
    if (iso) return new Intl.DateTimeFormat('tr-TR', { day:'numeric',month:'long',year:'numeric',timeZone:'UTC' }).format(new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`));
    return row.year && !value.includes(String(row.year)) ? `${value} ${row.year}` : value;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.nav-toggle');
    toggle?.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      $('primaryNav').classList.toggle('open', open);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded', 'false');
        $('primaryNav').classList.remove('open');
        toggle.focus();
      }
    });
  });

  window.renderEditorialHome = () => {
    const periods = unique(allRecords.map(row => row.period)).sort((a,b) => a.localeCompare(b,'tr'));
    $('editionPeriods').innerHTML = periods.map(period => `<a href="timeline.html?period=${encodeURIComponent(period)}">
      <strong>${safe(periodRangeLabel(period) || period)}</strong><span>${allRecords.filter(row => row.period === period).length.toLocaleString('tr-TR')} kayıt →</span></a>`).join('');
    const counts = countBy(allRecords,row => row.item_kind);
    $('editionMetrics').innerHTML = [[allRecords.length,'kayıt'],[counts.publication || 0,'yayın kaydı'],[counts.event || 0,'etkinlik kaydı'],[periods.length,'dönem']].map(([value,label]) => `<div><strong>${value.toLocaleString('tr-TR')}</strong><span>${label}</span></div>`).join('');
  };

  function readUrl() {
    const params = new URLSearchParams(location.search);
    Object.entries(filterKeys).forEach(([key,suffix]) => {
      const el = $('timeline'+suffix);
      el.value = params.get(key) || '';
      // Empty year limits mean all records, including undated entries.
      if (suffix.startsWith('Year')) el.dataset.readyDefaultApplied = 'true';
    });
    if (['status','code','from','to'].some(key => params.get(key))) $('advancedFilters').open = true;
  }

  function writeUrl() {
    const url = new URL(location.href);
    Object.entries(filterKeys).forEach(([key,suffix]) => {
      const value = $('timeline'+suffix).value;
      if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
    });
    url.hash = '';
    history.replaceState(null,'',url);
  }

  window.initEditorialTimeline = () => {
    setupFilterOptions('timeline',allRecords);
    readUrl();
    Object.values(filterKeys).forEach(suffix => {
      $('timeline'+suffix).addEventListener('input', () => {
        clearTimeout(filterTimer);
        const update = () => { writeUrl(); window.renderEditorialTimeline(); };
        if (suffix === 'Search') filterTimer = setTimeout(update,160); else update();
      });
    });
    $('resetFilters').addEventListener('click', () => {
      clearTimeout(filterTimer);
      Object.values(filterKeys).forEach(suffix => $('timeline'+suffix).value = '');
      writeUrl();
      window.renderEditorialTimeline();
    });
    $('yearJump').addEventListener('change', event => jumpToYear(event.target.value));
    $('yearNav').addEventListener('click', event => {
      const anchor = event.target.closest('a');
      if (!anchor) return;
      event.preventDefault();
      jumpToYear(anchor.dataset.year);
    });
    window.addEventListener('scroll', () => {
      if (scrollPending) return;
      scrollPending = true;
      requestAnimationFrame(() => { updateYearPosition(); scrollPending = false; });
    }, { passive:true });
    window.addEventListener('popstate', () => { readUrl(); window.renderEditorialTimeline(); jumpToHash(); });
    window.renderEditorialTimeline();
    jumpToHash();
  };

  function jumpToHash() {
    if (location.hash.startsWith('#year-')) jumpToYear(location.hash.slice(6),false);
  }

  function jumpToYear(year,writeHash = true) {
    const section = $('year-'+year);
    if (!section) return;
    if (writeHash) history.replaceState(null,'','#year-'+year);
    section.scrollIntoView({ behavior:'instant',block:'start' });
    section.focus({ preventScroll:true });
    setActiveYear(year);
  }

  function setActiveYear(year) {
    document.querySelectorAll('#yearNav a').forEach(link => {
      if (link.dataset.year === year) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    });
    if ($('yearJump')) $('yearJump').value = year;
  }

  function updateYearPosition() {
    if (!yearSections.length) return;
    const cutoff = matchMedia('(max-width:768px)').matches ? 175 : 140;
    let active = yearSections[0];
    for (const section of yearSections) {
      if (section.getBoundingClientRect().top <= cutoff) active = section;
      else break;
    }
    setActiveYear(active.dataset.year);
  }

  window.renderEditorialTimeline = () => {
    const from = Number($('timelineYearFrom').value);
    const to = Number($('timelineYearTo').value);
    const invalidRange = from && to && from > to;
    const records = invalidRange ? [] : sortRecords(filterRecords('timeline',allRecords));
    const groups = groupBy(records,row => row._year || 'undated');
    const years = Object.keys(groups).sort((a,b) => (a === 'undated' ? Infinity : Number(a)) - (b === 'undated' ? Infinity : Number(b)));
    const yearLabel = year => year === 'undated' ? 'Tarihsiz' : year;
    const activeFilters = Object.values(filterKeys).filter(suffix => $('timeline'+suffix).value).length;
    const advanced = ['Status','Code','YearFrom','YearTo'].filter(suffix => $('timeline'+suffix).value).length;
    $('advancedCount').textContent = advanced ? `(${advanced})` : '';
    $('resetFilters').hidden = !activeFilters;
    $('timelineCount').textContent = invalidRange ? 'Başlangıç yılı bitiş yılından büyük olamaz.' : `${records.length.toLocaleString('tr-TR')} kayıt · ${years.length} yıl grubu${activeFilters ? ' · Filtrelenmiş görünüm' : ''}`;
    $('yearNav').innerHTML = years.map(year => `<a href="#year-${year}" data-year="${year}"><span>${yearLabel(year)}</span><small>${groups[year].length}</small></a>`).join('');
    $('yearJump').innerHTML = years.length ? years.map(year => `<option value="${year}">${yearLabel(year)} · ${groups[year].length} kayıt</option>`).join('') : '<option value="">Kayıt yok</option>';
    $('yearJump').disabled = !years.length;
    $('timelineList').innerHTML = years.length ? years.map(year => `<section class="chronicle-year" id="year-${year}" data-year="${year}" tabindex="-1" aria-labelledby="heading-${year}">
      <h3 id="heading-${year}">${yearLabel(year)}<small>${groups[year].length} kayıt</small></h3><div class="chronicle-year-records">${groups[year].map(row => {
        const description = row.description && row.description !== row.title ? `<p>${safe(trimText(row.description,200))}</p>` : '';
        const status = row.verification_status !== 'verified' ? `<span class="record-status">${safe(STATUS_LABELS[row.verification_status] || 'Doğrulama bilgisi kayıtta')}</span>` : '';
        return `<a class="chronicle-card" href="${recordHref(row)}"><span class="record-date">${safe(dateLabel(row))}</span><h4>${safe(row.title || row.id)}</h4>${description}<div class="record-meta"><span class="record-kind">${safe(kindLabel(row))}</span>${row.activity_label ? `<span>${safe(row.activity_label)}</span>` : ''}${status}<span>Kaydı incele ↗</span></div></a>`;
      }).join('')}</div></section>`).join('') : `<div class="timeline-empty"><h3>${invalidRange ? 'Yıl aralığını kontrol edin.' : 'Bu aramada kayıt bulunamadı.'}</h3><p>${invalidRange ? 'Başlangıç yılını bitiş yılından önce veya aynı yıl olarak seçin.' : 'Başka bir sözcük deneyin veya filtreleri temizleyin.'}</p></div>`;
    yearSections = [...document.querySelectorAll('.chronicle-year')];
    updateYearPosition();
  };
})();
