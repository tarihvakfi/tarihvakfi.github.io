(function () {
  const SPREADSHEET_ID = '1DiUCoI9f7xrnBil2-H7EPqb9Scj37QKSOpnwdrFZghw';
  const SOURCE_TITLE = 'Tarih Vakfı Dijitalleştirme Yönetimi';
  const PILOT_DAILY_SHEET = '01 Gönüllü Günlüğü';
  const PILOT_SCAN_SHEET = '02 Tarama Satır Girişi';
  const PILOT_CODE_SHEET = '03 Kontrol ve Onay';
  const WEB_SUMMARY_SHEET = '04 Web Özeti';
  const ATOM_EXPORT_SHEET = '05 AtoM Aktarım';
  const ACTIVITY_SHEET = 'Günlük Akış';
  const INVENTORY_SHEET = 'PNB Sayısallaştırma';
  const PLAN_SHEET = 'Haftalık Plan';
  const DETAIL_SHEETS = [
    'PNB 27 Anıl',
    'PNB 28 Anıl',
    'PNB 29 Anıl',
    'PNB 30 Anıl',
    'PNB 39 Anıl - Berf',
    'PNB 40 Anıl - Berf',
    'Copy of PNB 29 SUDE-ARAS',
    'PNB 34 Berfin',
    'PNB 33 Berfin',
    'PNB 33 Sude',
    'PNB 34 Sude - Aras',
    'PNB 44 ÖZDEN',
    'PNB 37 Öykü Zelal Berfin',
    'PNB 1',
    'PNB 2',
    'PNB 68 Sibel',
    'NSS Harita'
  ];

  const state = {
    loading: true,
    loadError: '',
    sourceNote: '',
    view: 'pilot',
    query: '',
    pilotDailyRows: [],
    pilotScanRows: [],
    pilotCodeRows: [],
    webSummaryRows: [],
    atomExportRows: [],
    activityRows: [],
    detailRows: [],
    inventoryRows: [],
    planRows: [],
    progressPercent: null
  };

  const el = {
    status: document.getElementById('pilotStatus'),
    sourceName: document.getElementById('sourceName'),
    sourceDetail: document.getElementById('sourceDetail'),
    heroPeriod: document.getElementById('pilotHeroPeriod'),
    heroLede: document.getElementById('pilotHeroLede'),
    dataNote: document.getElementById('dataNote'),
    viewKicker: document.getElementById('viewKicker'),
    viewTitle: document.getElementById('viewTitle'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    searchInput: document.getElementById('searchInput'),
    buttons: Array.from(document.querySelectorAll('[data-view]')),
    report: {
      progressPercent: document.getElementById('reportProgressPercent'),
      progressFill: document.getElementById('reportProgressFill'),
      progressText: document.getElementById('reportProgressText'),
      recentDetail: document.getElementById('reportRecentDetail'),
      recentNote: document.getElementById('reportRecentNote'),
      pace: document.getElementById('reportPace'),
      remaining: document.getElementById('reportRemaining'),
      remainingNote: document.getElementById('reportRemainingNote'),
      forecastDate: document.getElementById('forecastDate'),
      forecastNote: document.getElementById('forecastNote'),
      forecastMeta: document.getElementById('forecastMeta'),
      indicators: document.getElementById('reportIndicators'),
      workflow: document.getElementById('reportWorkflow'),
      latest: document.getElementById('reportLatest'),
      latestMeta: document.getElementById('reportLatestMeta'),
      latestRows: document.getElementById('reportLatestRows'),
      volunteersMeta: document.getElementById('reportVolunteersMeta'),
      volunteers: document.getElementById('reportVolunteers'),
      tracksMeta: document.getElementById('reportTracksMeta'),
      tracks: document.getElementById('reportTracks'),
      boxesMeta: document.getElementById('reportBoxesMeta'),
      boxes: document.getElementById('reportBoxes'),
      controlMeta: document.getElementById('reportControlMeta'),
      control: document.getElementById('reportControl')
    },
    metrics: {
      progress: document.getElementById('metricProgress'),
      records: document.getElementById('metricRecords'),
      pages: document.getElementById('metricPages'),
      volunteers: document.getElementById('metricVolunteers'),
      boxes: document.getElementById('metricBoxes')
    }
  };

  bindControls();
  render();
  loadPilotSheet();

  function bindControls() {
    el.searchInput.addEventListener('input', function () {
      state.query = el.searchInput.value.trim().toLocaleLowerCase('tr');
      renderTable();
    });

    el.buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        state.view = button.dataset.view;
        state.query = '';
        el.searchInput.value = '';
        el.buttons.forEach(function (item) {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
        renderTable();
      });
    });
  }

  async function loadPilotSheet() {
    setStatus('loading', 'çalışma dosyası okunuyor');
    render();

    try {
      const core = await Promise.all([
        fetchTable(PILOT_DAILY_SHEET, 'A1:X1000'),
        fetchTable(PILOT_SCAN_SHEET, 'A1:Y12000'),
        fetchTable(PILOT_CODE_SHEET, 'A1:V1500'),
        fetchTable(WEB_SUMMARY_SHEET, 'A1:N1000'),
        fetchTable(ATOM_EXPORT_SHEET, 'A1:O1000'),
        fetchTable(ACTIVITY_SHEET, 'A1:H1200'),
        fetchTable(INVENTORY_SHEET, 'A1:L1100'),
        fetchTable(PLAN_SHEET, 'A1:I80'),
        fetchCell(INVENTORY_SHEET, 'L105:L105')
      ]);
      state.pilotDailyRows = mapPilotDailyRows(core[0]);
      state.pilotScanRows = mapPilotScanRows(core[1]);
      state.pilotCodeRows = mapPilotCodeRows(core[2]);
      state.webSummaryRows = mapWebSummaryRows(core[3]);
      state.atomExportRows = mapAtomExportRows(core[4]);
      state.activityRows = mapActivityRows(core[5]);
      state.inventoryRows = mapInventoryRows(core[6]);
      state.planRows = mapPlanRows(core[7]);
      state.progressPercent = progressPercentFrom(core[8]);

      state.loading = false;
      state.loadError = '';
      state.sourceNote = 'Çalışma dosyası canlı okunuyor. Genel ilerleme PNB Sayısallaştırma L105 hücresinden alınıyor.';
      setStatus('live', 'canlı veri');
      render();
    } catch (error) {
      state.loading = false;
      state.loadError = 'Çalışma dosyası okunamadı. Dosyanın bağlantıyla görüntülenebilir olması gerekiyor.';
      setStatus('error', 'bağlantı yok');
      render();
    }
  }

  function fetchTable(sheetName, range) {
    const url = new URL(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`);
    url.searchParams.set('tqx', 'out:json');
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('range', range);
    url.searchParams.set('headers', '1');
    url.searchParams.set('_', String(Date.now()));

    return fetch(url.toString(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(parseGvizResponse);
  }

  function fetchCell(sheetName, range) {
    const url = new URL(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`);
    url.searchParams.set('tqx', 'out:json');
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('range', range);
    url.searchParams.set('headers', '0');
    url.searchParams.set('_', String(Date.now()));

    return fetch(url.toString(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(function (text) {
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
        if (!match) throw new Error('bad_gviz_response');
        const table = JSON.parse(match[1]).table || {};
        const row = Array.isArray(table.rows) ? table.rows[0] : null;
        const cell = row && Array.isArray(row.c) ? row.c[0] : null;
        if (!cell) return '';
        if (cell.f != null) return String(cell.f);
        if (cell.v == null) return '';
        return String(cell.v);
      });
  }

  function parseGvizResponse(text) {
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    if (!match) throw new Error('bad_gviz_response');
    const table = JSON.parse(match[1]).table || {};
    const rows = Array.isArray(table.rows) ? table.rows : [];
    const body = rows.map(function (row) {
      return (row.c || []).map(function (cell) {
        if (!cell) return '';
        if (cell.f != null) return String(cell.f);
        if (cell.v == null) return '';
        return String(cell.v);
      });
    });
    const labels = Array.isArray(table.cols) ? table.cols.map(function (column) {
      return clean(column && column.label);
    }) : [];
    return labels.some(Boolean) ? [labels].concat(body) : body;
  }

  function mapPilotDailyRows(table) {
    const rows = rowsWithHeaders(table, ['Tarih', 'Gönüllü adı', 'Tarama', 'Diğer açıklaması']);
    return rows.map(function (row) {
      const workTypes = selectedLabels(row, [
        'Tarama',
        'Kodlama',
        'Kontrol',
        'Kataloglama',
        'PDF/JPEG',
        'Kütüphane taşıma',
        'Kütüphane envanteri',
        'Proje geliştirme',
        'Web sitesi',
        'Kronoloji / araştırma',
        'Toplantı / eğitim',
        'Koordinasyon',
        'Diğer'
      ]);
      const other = clean(pick(row, ['Diğer açıklaması']));
      const note = clean(pick(row, ['Yapılan iş / not']));
      return {
        source: PILOT_DAILY_SHEET,
        kind: 'daily',
        date: clean(pick(row, ['Tarih'])),
        dateKey: dateKey(pick(row, ['Tarih'])),
        people: splitPeople(pick(row, ['Gönüllü adı'])),
        workTypes: workTypes.map(function (label) {
          return label === 'Diğer' && other ? `Diğer: ${other}` : label;
        }),
        area: workTypes.length ? workTypes.join(', ') : inferArea(note || other),
        work: note || other || workTypes.join(', ') || 'Genel çalışma',
        amount: numberFrom(pick(row, ['Miktar'])),
        unit: clean(pick(row, ['Birim'])),
        fund: clean(pick(row, ['Fon'])),
        box: clean(pick(row, ['Kutu / raf'])),
        scanner: clean(pick(row, ['Tarayıcı / araç'])),
        notes: note || other,
        statuses: truthy(pick(row, ["Web'de göster"])) ? ['Webde göster'] : ['Kayıt'],
        webVisible: truthy(pick(row, ["Web'de göster"])),
        recordId: clean(pick(row, ['Kayıt ID']))
      };
    }).filter(hasPilotContent).sort(descByDate);
  }

  function mapPilotScanRows(table) {
    const rows = rowsWithHeaders(table, ['Tarih', 'Gönüllü adı', 'Fon', 'Dijital kod']);
    return rows.map(function (row) {
      const workTypes = selectedLabels(row, ['Tarama', 'Kodlama', 'Kontrol', 'Kataloglama', 'PDF/JPEG']);
      const statuses = selectedLabels(row, ['Kaydedildi', 'Sürüyor', 'Kontrol bekliyor', 'Takip gerekiyor', 'Tamamlandı']);
      return {
        source: PILOT_SCAN_SHEET,
        kind: 'detail',
        date: clean(pick(row, ['Tarih'])),
        dateKey: dateKey(pick(row, ['Tarih'])),
        people: splitPeople(pick(row, ['Gönüllü adı'])),
        fund: clean(pick(row, ['Fon'])),
        box: clean(pick(row, ['Kutu'])),
        file: clean(pick(row, ['Dosya'])),
        document: clean(pick(row, ['Belge'])),
        page: clean(pick(row, ['Sayfa'])),
        code: clean(pick(row, ['Dijital kod'])),
        documentDate: clean(pick(row, ['Belge tarihi'])),
        scanner: clean(pick(row, ['Tarayıcı'])),
        workTypes,
        statuses: statuses.length ? statuses : ['Kayıt'],
        amount: 1,
        unit: 'satır',
        notes: [clean(pick(row, ['Takip notu'])), clean(pick(row, ['Not']))].filter(Boolean).join(' · '),
        webVisible: truthy(pick(row, ["Web'de göster"])),
        atomReady: truthy(pick(row, ["AtoM'a hazır"])),
        recordId: clean(pick(row, ['Kayıt ID']))
      };
    }).filter(hasPilotContent).sort(descByDate);
  }

  function mapPilotCodeRows(table) {
    const rows = rowsWithHeaders(table, ['Kontrol tarihi', 'Kontrol eden', 'İşi yapan', 'Kaynak kayıt ID / aralık']);
    return rows.map(function (row) {
      const workTypes = selectedLabels(row, [
        'Tarama kalitesi',
        'Dosya adı / dijital kod',
        'Sayfa sırası',
        'Kodlama',
        'Kataloglama'
      ]);
      const result = clean(pick(row, ['Sonuç']));
      const issue = clean(pick(row, ['Sorun türü']));
      const status = clean(pick(row, ['Durum']));
      const statuses = [result, issue && issue !== 'Yok' ? issue : '', status].filter(Boolean);
      const checkedPeople = splitPeople(pick(row, ['İşi yapan']));
      return {
        source: PILOT_CODE_SHEET,
        kind: 'detail',
        date: clean(pick(row, ['Kontrol tarihi'])),
        dateKey: dateKey(pick(row, ['Kontrol tarihi'])),
        people: splitPeople(pick(row, ['Kontrol eden'])),
        checkedPeople,
        fund: clean(pick(row, ['Fon'])),
        box: clean(pick(row, ['Kutu'])),
        file: clean(pick(row, ['Dosya'])),
        document: clean(pick(row, ['Belge / sayfa aralığı'])),
        page: '',
        code: clean(pick(row, ['Kaynak kayıt ID / aralık'])),
        documentDate: '',
        scanner: '',
        workTypes,
        statuses: statuses.length ? statuses : ['Kayıt'],
        amount: 1,
        unit: 'kontrol',
        notes: [
          checkedPeople.length ? `İşi yapan: ${checkedPeople.join(', ')}` : '',
          clean(pick(row, ['Düzeltme notu'])),
          clean(pick(row, ['Düzeltmeyi yapan'])) ? `Düzeltme: ${clean(pick(row, ['Düzeltmeyi yapan']))}` : ''
        ].filter(Boolean).join(' · '),
        webVisible: truthy(pick(row, ["Web'de göster"])),
        atomReady: truthy(pick(row, ["AtoM'a hazır"])),
        recordId: clean(pick(row, ['Kayıt ID']))
      };
    }).filter(hasPilotContent).sort(descByDate);
  }

  function mapWebSummaryRows(table) {
    const rows = rowsWithHeaders(table, ['kaynak', 'tarih', 'gonullu', 'is_turleri']);
    return rows.map(function (row) {
      return {
        source: clean(pick(row, ['kaynak'])) || WEB_SUMMARY_SHEET,
        kind: 'summary',
        date: clean(pick(row, ['tarih'])),
        dateKey: dateKey(pick(row, ['tarih'])),
        people: splitPeople(pick(row, ['gonullu'])),
        workTypes: splitList(pick(row, ['is_turleri'])),
        fund: clean(pick(row, ['fon'])),
        box: clean(pick(row, ['kutu'])),
        file: clean(pick(row, ['dosya'])),
        document: clean(pick(row, ['belge'])),
        amount: numberFrom(pick(row, ['miktar'])),
        unit: clean(pick(row, ['birim'])),
        statuses: splitList(pick(row, ['durum'])),
        notes: clean(pick(row, ['not'])),
        webVisible: truthy(pick(row, ['webde_goster'])),
        recordId: clean(pick(row, ['kayit_id']))
      };
    }).filter(hasPilotContent).sort(descByDate);
  }

  function mapAtomExportRows(table) {
    const rows = rowsWithHeaders(table, ['referans_kodu', 'ust_referans_kodu', 'baslik']);
    return rows.map(function (row) {
      return {
        referenceCode: clean(pick(row, ['referans_kodu'])),
        parent: clean(pick(row, ['ust_referans_kodu'])),
        title: clean(pick(row, ['baslik'])),
        dateStart: clean(pick(row, ['tarih_baslangic'])),
        dateEnd: clean(pick(row, ['tarih_bitis'])),
        level: clean(pick(row, ['duzey'])),
        extent: clean(pick(row, ['kapsam_icerik'])),
        fund: clean(pick(row, ['fon'])),
        box: clean(pick(row, ['kutu'])),
        file: clean(pick(row, ['dosya'])),
        document: clean(pick(row, ['belge'])),
        digitalObject: clean(pick(row, ['dijital_nesne'])),
        statuses: splitList(pick(row, ['durum'])),
        notes: clean(pick(row, ['not'])),
        recordId: clean(pick(row, ['kaynak_kayit_id']))
      };
    }).filter(function (row) {
      return row.referenceCode || row.title || row.digitalObject;
    });
  }

  function mapActivityRows(table) {
    const rows = rowsWithHeaders(table);
    return rows.map(function (row) {
      const people = splitPeople(pick(row, ['Paydaş']));
      const title = clean(pick(row, ['Devam Eden Çalışma']));
      const area = clean(pick(row, ['Çalışma Alanı']));
      return {
        date: clean(pick(row, ['Tarih'])),
        dateKey: dateKey(pick(row, ['Tarih'])),
        people,
        area: area || inferArea(title),
        work: title || area || 'Genel çalışma',
        amount: numberFrom(pick(row, ['Yapılan Çalışmaya İlişkin Sayısal Bilgi'])),
        computer: clean(pick(row, ['Bilgisayar'])),
        scanner: clean(pick(row, ['Tarayıcı'])),
        notes: clean(pick(row, ['Notlar']))
      };
    }).filter(function (row) {
      return row.date || row.people.length || row.area || row.work || row.notes;
    }).sort(descByDate);
  }

  function mapInventoryRows(table) {
    const rows = rowsWithHeaders(table);
    return rows.map(function (row) {
      return {
        fund: clean(pick(row, ['Fon'])),
        box: clean(pick(row, ['Kutu'])),
        fileCount: numberFrom(pick(row, ['Dosya Sayısı'])),
        documentCount: numberFrom(pick(row, ['Belge Sayısı'])),
        targetPages: numberFrom(pick(row, ['Sayfa Sayısı'])),
        scanDone: truthy(pick(row, ['Tarama'])),
        codeDone: truthy(pick(row, ['Kodlama'])),
        controlDone: truthy(pick(row, ['Kontrol'])),
        catalogDone: truthy(pick(row, ['Kataloglama'])),
        jpegDone: truthy(pick(row, ["Jpeg'e Dönüştürme"])),
        pdfDone: truthy(pick(row, ["Birleştirerek pdf'te dönüştürme"])),
        scanner: clean(pick(row, ['Tarayıcı']))
      };
    }).filter(function (row) {
      return row.fund === 'PNB' && row.box && row.targetPages > 0 && row.targetPages < 5000;
    });
  }

  function mapPlanRows(table) {
    const rows = rowsWithHeaders(table);
    return rows.map(function (row) {
      return {
        station: clean(row.__first || pick(row, ['İstasyon'])) || 'Ek gönüllüler',
        Pazartesi: clean(pick(row, ['Pazartesi'])),
        Salı: clean(pick(row, ['Salı'])),
        Çarşamba: clean(pick(row, ['Çarşamba', 'Çarşama'])),
        Perşembe: clean(pick(row, ['Perşembe'])),
        Cuma: clean(pick(row, ['Cuma'])),
        updated: clean(pick(row, ['Güncellenme'])),
        device: clean(pick(row, ['Tercih Edilen Cihaz']))
      };
    }).filter(function (row) {
      return row.station !== 'Ek gönüllüler'
        || row.Pazartesi
        || row.Salı
        || row.Çarşamba
        || row.Perşembe
        || row.Cuma;
    });
  }

  function mapDetailRows(sheetName, table) {
    const rows = rowsWithHeaders(table);
    return rows.map(function (row) {
      const creator = clean(pick(row, ['Kaydı Oluşturan', 'Kaydı Oluşuran']));
      const fund = clean(pick(row, ['Fon Adı'])) || (sheetName.indexOf('NSS') >= 0 ? 'NSS' : 'PNB');
      const box = clean(pick(row, ['Kutu No']));
      return {
        sheetName,
        fund,
        box,
        file: clean(pick(row, ['Dosya No'])),
        document: clean(pick(row, ['Belge No'])),
        page: clean(pick(row, ['Sayfa'])),
        code: clean(pick(row, ['Dijital Belge Kodu'])),
        documentDate: clean(pick(row, ['Belge Tarihi'])),
        notes: clean(pick(row, ['Notlar'])),
        date: clean(pick(row, ['Tarih'])),
        dateKey: dateKey(pick(row, ['Tarih'])),
        people: splitPeople(creator),
        scanner: clean(pick(row, ['Tarayıcı']))
      };
    }).filter(function (row) {
      return row.fund || row.box || row.file || row.document || row.page || row.code || row.people.length;
    });
  }

  function selectedLabels(row, labels) {
    return labels.filter(function (label) {
      return truthy(pick(row, [label]));
    });
  }

  function splitList(value) {
    return clean(value)
      .split(/\s*(?:,|;|\||·)\s*/)
      .map(clean)
      .filter(Boolean);
  }

  function hasPilotContent(row) {
    return row.date
      || row.people.length
      || row.work
      || row.workTypes.length
      || row.fund
      || row.box
      || row.file
      || row.document
      || row.page
      || row.code
      || row.notes
      || row.recordId;
  }

  function rowsWithHeaders(table, expectedHeaders) {
    const sentinels = expectedHeaders || ['Tarih', 'Paydaş', 'Fon Adı', 'Fon', 'Kutu No', 'Kutu'];
    const headerRowIndex = table.findIndex(function (row) {
      return row.some(function (value) {
        return sentinels.includes(clean(value));
      });
    });
    const resolvedHeaderRowIndex = headerRowIndex >= 0
      ? headerRowIndex
      : table.findIndex(function (row) {
        return row.filter(function (value) { return clean(value); }).length >= 2;
      });
    if (resolvedHeaderRowIndex < 0) return [];
    const headers = table[resolvedHeaderRowIndex].map(clean);
    return table.slice(resolvedHeaderRowIndex + 1).map(function (cells) {
      const row = { __first: clean(cells[0]) };
      headers.forEach(function (header, index) {
        if (!header) return;
        row[header] = clean(cells[index]);
      });
      return row;
    });
  }

  function render() {
    renderChrome();
    renderMetrics();
    renderReport();
    renderTable();
  }

  function renderChrome() {
    if (el.sourceName) el.sourceName.textContent = SOURCE_TITLE;
    if (el.sourceDetail) {
      el.sourceDetail.textContent = state.loading
        ? 'Çalışma dosyasındaki mevcut sekmeler okunuyor.'
        : (state.loadError || state.sourceNote);
    }
  }

  function setStatus(mode, label) {
    if (!el.status) return;
    el.status.dataset.state = mode;
    const statusText = el.status.querySelector('span:last-child');
    if (statusText) statusText.textContent = label;
  }

  function renderMetrics() {
    const metrics = buildMetrics();
    if (el.metrics.progress) el.metrics.progress.textContent = metrics.progress == null ? '—' : `${formatNumber(metrics.progress)}%`;
    if (el.metrics.records) el.metrics.records.textContent = formatNumber(metrics.records);
    if (el.metrics.pages) el.metrics.pages.textContent = formatNumber(metrics.details);
    if (el.metrics.volunteers) el.metrics.volunteers.textContent = formatNumber(metrics.volunteers);
    if (el.metrics.boxes) el.metrics.boxes.textContent = formatNumber(metrics.boxes);
  }

  function buildMetrics() {
    const targetPages = state.inventoryRows.reduce(function (sum, row) {
      return sum + Number(row.targetPages || 0);
    }, 0);
    const detailRows = state.pilotScanRows.length;
    const sheetProgress = state.progressPercent == null ? null : state.progressPercent;
    return {
      progress: sheetProgress == null && targetPages ? (detailRows / targetPages) * 100 : sheetProgress,
      records: state.pilotDailyRows.length + detailRows + state.pilotCodeRows.length,
      details: detailRows,
      volunteers: volunteerStats().length,
      boxes: boxStats().filter(function (row) { return row.done > 0; }).length
    };
  }

  function renderReport() {
    const progress = progressModel();
    const window = recentWindow();
    const latestKey = latestDateKey(state.pilotDailyRows.concat(state.pilotScanRows, state.pilotCodeRows));

    setElementText(el.heroPeriod, state.loading
      ? 'Canlı rapor · veri bekleniyor'
      : latestKey ? `Canlı rapor · ${formatDateKey(todayKey())} itibarıyla · son görünür kayıt ${formatDateKey(latestKey)}` : `Canlı rapor · ${formatDateKey(todayKey())} itibarıyla · kayıt bekleniyor`);
    if (el.heroLede) {
      el.heroLede.innerHTML = state.loading
        ? 'Çalışma dosyasındaki gönüllü emeği, sayısallaştırma ayrıntıları ve kontrol/onay kayıtları birlikte okunuyor.'
        : `Bu raporda <b>${formatNumber(state.pilotDailyRows.length + pilotDetailRows().length)} katkı kaydı</b> görünür durumda: ${formatNumber(state.pilotScanRows.length)} sayfa/detay satırı, ${formatNumber(state.pilotDailyRows.length)} gönüllü günlüğü kaydı ve ${formatNumber(state.pilotCodeRows.length)} kontrol/onay kaydı.`;
    }

    setElementText(el.report.progressPercent, progress.percent == null ? '—' : `%${formatNumber(progress.percent)}`);
    if (el.report.progressFill) {
      el.report.progressFill.style.width = progress.percent == null ? '0%' : `${clamp(progress.percent, 0, 100)}%`;
    }
    setElementText(el.report.progressText, progress.targetPages
      ? `${formatNumber(progress.donePages)} / ${formatNumber(progress.targetPages)} sayfa · ${formatNumber(progress.remainingPages)} sayfa hedefte kaldı.`
      : 'Hedef sayfa bilgisi bekleniyor.');
    setElementText(el.report.recentDetail, state.loading ? '—' : `${formatNumber(window.detailRows)} detay`);
    setElementText(el.report.recentNote, state.loading
      ? 'detay ve günlük kayıt'
      : `${formatNumber(window.dailyRows)} günlük kayıt · ${formatNumber(window.people.length)} kişi · ${formatNumber(window.boxes.length)} kutu`);
    setElementText(el.report.pace, window.activeDays ? `${formatNumber(window.detailRows / window.activeDays)}/gün` : '—');
    setElementText(el.report.remaining, progress.targetPages ? formatNumber(progress.remainingPages) : '—');
    setElementText(el.report.remainingNote, progress.targetPages && window.detailRows
      ? `son aktif gün ortalamasıyla yaklaşık ${formatNumber(Math.ceil(progress.remainingPages / Math.max(1, window.detailRows / Math.max(1, window.activeDays))))} aktif gün`
      : 'yaklaşık hedef');

    renderIndicatorReport(progress);
    renderWorkflowReport();
    renderLatestReport();
    renderVolunteerReport();
    renderTrackReport();
    renderBoxReport();
    renderControlReport();
  }

  function progressModel() {
    const targetPages = state.inventoryRows.reduce(function (sum, row) {
      return sum + Number(row.targetPages || 0);
    }, 0);
    const percent = state.progressPercent == null && targetPages
      ? (state.pilotScanRows.length / targetPages) * 100
      : state.progressPercent;
    const donePages = targetPages && percent != null
      ? Math.round(targetPages * (percent / 100))
      : state.pilotScanRows.length;
    return {
      percent,
      targetPages,
      donePages,
      remainingPages: Math.max(0, targetPages - donePages)
    };
  }

  function recentWindow() {
    const rows = state.pilotDailyRows.concat(state.pilotScanRows, state.pilotCodeRows);
    const latestKey = latestDateKey(rows);
    const startKey = latestKey ? shiftDateKey(latestKey, -6) : '';
    const filtered = rows.filter(function (row) {
      return row.dateKey && (!startKey || row.dateKey >= startKey) && (!latestKey || row.dateKey <= latestKey);
    });
    const peopleSet = new Set();
    const boxSet = new Set();
    const daySet = new Set();
    filtered.forEach(function (row) {
      row.people.forEach(function (person) { peopleSet.add(person); });
      if (row.box) boxSet.add(`${row.fund || ''} ${row.box}`.trim());
      if (row.dateKey) daySet.add(row.dateKey);
    });
    return {
      rows: filtered,
      detailRows: filtered.filter(function (row) { return row.source === PILOT_SCAN_SHEET; }).length,
      dailyRows: filtered.filter(function (row) { return row.kind === 'daily'; }).length,
      controlRows: filtered.filter(function (row) { return row.source === PILOT_CODE_SHEET; }).length,
      people: Array.from(peopleSet).sort(localeSort),
      boxes: Array.from(boxSet).sort(localeSort),
      activeDays: daySet.size
    };
  }

  function renderIndicatorReport(progress) {
    const forecast = forecastModel(progress);
    setElementText(el.report.forecastDate, forecast.dateLabel);
    setElementText(el.report.forecastNote, forecast.note);
    setElementText(el.report.forecastMeta, forecast.meta);

    if (!el.report.indicators) return;
    const rows = reportMetricRows(progress).slice(0, 4);
    el.report.indicators.innerHTML = rows.map(function (row) {
      return `<article class="indicator-card">
        <span>${escapeHtml(row.label)}</span>
        <b>${escapeHtml(row.value)}</b>
        <small>${escapeHtml(row.period)}</small>
        <p>${escapeHtml(row.note)}</p>
      </article>`;
    }).join('') || '<article class="report-empty">Gösterge için kayıt bekleniyor.</article>';
  }

  function renderWorkflowReport() {
    if (!el.report.workflow) return;
    const rows = workflowStageStats();
    const totalDetail = Math.max(1, state.pilotScanRows.length);
    el.report.workflow.innerHTML = rows.map(function (row) {
      const width = clamp(row.detailCount / totalDetail * 100, 0, 100);
      return `<article class="stage-card">
        <div>
          <span>${escapeHtml(row.label)}</span>
          <b>${formatNumber(row.detailCount)}</b>
          <small>${escapeHtml(row.unit)}</small>
        </div>
        <p>${formatNumber(row.dailyCount)} günlük iz · ${formatNumber(row.people.length)} kişi · ${formatNumber(row.boxes.length)} kutu · son ${escapeHtml(row.lastDate || '—')}</p>
        <div class="stage-track" aria-hidden="true"><span style="width:${width}%"></span></div>
      </article>`;
    }).join('');
  }

  function reportMetricRows(progress) {
    const rows = allReportRows();
    const latestKey = latestDateKey(rows);
    const all = summarizeRows(rows);
    const scan7 = summarizeWindow(state.pilotScanRows, 7, latestKey);
    const scan30 = summarizeWindow(state.pilotScanRows, 30, latestKey);
    const forecast = forecastModel(progress);
    const stages = workflowStageStats();
    const scanStage = stages.find(function (row) { return row.label === 'Tarama'; }) || emptyStage('Tarama');
    const codeStage = stages.find(function (row) { return row.label === 'Kodlama'; }) || emptyStage('Kodlama');
    const controlStage = stages.find(function (row) { return row.label === 'Kontrol'; }) || emptyStage('Kontrol');

    return [
      {
        label: 'Günlük katkı',
        value: `${formatNumber(safeDivide(all.totalRecords, all.activeDays))}/gün`,
        period: `${formatNumber(all.activeDays)} aktif gün`,
        note: `${formatNumber(all.totalRecords)} toplam kayıt; tarama, kodlama, kontrol ve günlük izler birlikte.`
      },
      {
        label: 'Haftalık katkı',
        value: `${formatNumber(safeDivide(all.totalRecords, all.activeWeeks))}/hafta`,
        period: `${formatNumber(all.activeWeeks)} aktif hafta`,
        note: 'Hafta içinde en az bir kayıt olan haftaların ortalaması.'
      },
      {
        label: 'Aylık katkı',
        value: `${formatNumber(safeDivide(all.totalRecords, all.activeMonths))}/ay`,
        period: `${formatNumber(all.activeMonths)} aktif ay`,
        note: 'Ay içinde en az bir kayıt olan ayların ortalaması.'
      },
      {
        label: 'Son 30 gün tarama',
        value: `${formatNumber(safeDivide(scan30.detailRows, scan30.calendarDays))}/gün`,
        period: `${formatNumber(scan30.detailRows)} detay`,
        note: `${formatNumber(scan30.activeDays)} aktif gün · ${formatNumber(scan30.people.length)} kişi · son 30 takvim günü.`
      },
      {
        label: 'Son 7 gün tarama',
        value: `${formatNumber(safeDivide(scan7.detailRows, scan7.calendarDays))}/gün`,
        period: `${formatNumber(scan7.detailRows)} detay`,
        note: `${formatNumber(scan7.activeDays)} aktif gün · ${formatNumber(scan7.people.length)} kişi · son 7 takvim günü.`
      },
      {
        label: 'Tarama aşaması',
        value: `${formatNumber(scanStage.detailCount)} detay`,
        period: `${formatNumber(scanStage.dailyCount)} günlük iz`,
        note: `${formatNumber(scanStage.people.length)} kişi · ${formatNumber(scanStage.boxes.length)} kutu · son ${scanStage.lastDate || '—'}.`
      },
      {
        label: 'Kodlama aşaması',
        value: `${formatNumber(codeStage.detailCount)} detay`,
        period: `${formatNumber(codeStage.dailyCount)} günlük iz`,
        note: `${formatNumber(codeStage.people.length)} kişi · ${formatNumber(codeStage.boxes.length)} kutu · son ${codeStage.lastDate || '—'}.`
      },
      {
        label: 'Kontrol aşaması',
        value: `${formatNumber(controlStage.detailCount)} kontrol satırı`,
        period: `${formatNumber(controlStage.dailyCount)} günlük iz`,
        note: `${formatNumber(controlStage.people.length)} kişi · ${formatNumber(controlStage.boxes.length)} kutu · son ${controlStage.lastDate || '—'}.`
      },
      {
        label: 'Tahmini tarama bitişi',
        value: forecast.dateLabel,
        period: forecast.pace ? `${formatNumber(forecast.pace)} sayfa/gün` : 'hız bekleniyor',
        note: forecast.meta
      },
      {
        label: 'Kontrol defteri',
        value: formatNumber(state.pilotCodeRows.length),
        period: 'satır bazlı kontrol',
        note: 'Günlükte kontrol izleri olabilir; yayın/açık arşiv için satır bazlı kontrol ayrıca tutulmalı.'
      }
    ];
  }

  function forecastModel(progress) {
    if (state.loading) {
      return {
        dateLabel: 'Veri bekleniyor',
        note: 'Tarama hızı hesaplanıyor.',
        meta: 'Son 30 gün takvim hızına göre.',
        pace: 0
      };
    }

    const latestKey = latestDateKey(allReportRows());
    const scan30 = summarizeWindow(state.pilotScanRows, 30, latestKey);
    const allScan = summarizeWindow(state.pilotScanRows, null, latestDateKey(state.pilotScanRows));
    const pace = safeDivide(scan30.detailRows, scan30.calendarDays) || safeDivide(allScan.detailRows, allScan.calendarDays);
    if (!progress.remainingPages || !pace) {
      return {
        dateLabel: 'Öngörü için veri bekleniyor',
        note: 'Kalan sayfa ya da hız bilgisi yeterli değil.',
        meta: 'Tarama bitişi için kalan sayfa ve son dönem hızı gerekir.',
        pace: 0
      };
    }

    const remainingDays = Math.ceil(progress.remainingPages / pace);
    const targetDateKey = shiftDateKey(todayKey(), remainingDays);
    return {
      dateLabel: formatDateKey(targetDateKey),
      note: `${formatNumber(progress.remainingPages)} sayfa kaldı; son 30 günün takvim hızına göre tarama bitiş tarihi.`,
      meta: `Son 30 gün: ${formatNumber(scan30.detailRows)} detay · ${formatNumber(scan30.activeDays)} aktif gün. Kontrol, kataloglama ve yayın hazırlığı ayrıca izlenir.`,
      pace
    };
  }

  function emptyStage(label) {
    return {
      label,
      detailCount: 0,
      dailyCount: 0,
      people: [],
      boxes: [],
      lastDate: '',
      lastDateKey: '',
      unit: label === 'Kontrol' ? 'kontrol satırı' : 'detay satırı'
    };
  }

  function workflowStageStats() {
    return ['Tarama', 'Kodlama', 'Kontrol'].map(function (label) {
      const structuredRows = label === 'Kontrol'
        ? state.pilotCodeRows.concat(state.pilotScanRows.filter(function (row) { return hasWorkType(row, label); }))
        : state.pilotScanRows.filter(function (row) { return hasWorkType(row, label); });
      const dailyRows = state.pilotDailyRows.filter(function (row) {
        return hasWorkType(row, label);
      });
      const peopleSet = new Set();
      const boxSet = new Set();
      let lastDate = '';
      let lastDateKey = '';

      structuredRows.concat(dailyRows).forEach(function (row) {
        row.people.forEach(function (person) { peopleSet.add(person); });
        (row.checkedPeople || []).forEach(function (person) { peopleSet.add(person); });
        if (row.box) boxSet.add(`${row.fund || ''} ${row.box}`.trim());
        if (row.dateKey && (!lastDateKey || row.dateKey > lastDateKey)) {
          lastDateKey = row.dateKey;
          lastDate = row.date;
        }
      });

      return {
        label,
        detailCount: structuredRows.length,
        dailyCount: dailyRows.length,
        people: Array.from(peopleSet).sort(localeSort),
        boxes: Array.from(boxSet).sort(localeSort),
        lastDate,
        lastDateKey,
        unit: label === 'Kontrol' ? 'kontrol satırı' : 'detay satırı'
      };
    });
  }

  function allReportRows() {
    return state.pilotDailyRows.concat(state.pilotScanRows, state.pilotCodeRows);
  }

  function summarizeWindow(rows, days, fallbackLatestKey) {
    const sourceRows = Array.isArray(rows) ? rows.filter(function (row) { return row.dateKey; }) : [];
    const endKey = fallbackLatestKey || latestDateKey(sourceRows);
    const firstKey = firstDateKey(sourceRows);
    const startKey = days && endKey ? shiftDateKey(endKey, -(days - 1)) : firstKey;
    const filtered = sourceRows.filter(function (row) {
      return row.dateKey && (!startKey || row.dateKey >= startKey) && (!endKey || row.dateKey <= endKey);
    });
    const summary = summarizeRows(filtered);
    summary.startKey = startKey;
    summary.endKey = endKey;
    summary.calendarDays = days || diffDaysInclusive(startKey, endKey) || summary.activeDays;
    return summary;
  }

  function summarizeRows(rows) {
    const daySet = new Set();
    const weekSet = new Set();
    const monthSet = new Set();
    const peopleSet = new Set();
    const boxSet = new Set();
    let detailRows = 0;
    let dailyRows = 0;
    let controlRows = 0;

    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (row.source === PILOT_SCAN_SHEET) detailRows += 1;
      if (row.kind === 'daily') dailyRows += 1;
      if (row.source === PILOT_CODE_SHEET) controlRows += 1;
      if (row.dateKey) {
        daySet.add(row.dateKey);
        weekSet.add(weekKey(row.dateKey));
        monthSet.add(monthKey(row.dateKey));
      }
      row.people.forEach(function (person) { peopleSet.add(person); });
      if (row.box) boxSet.add(`${row.fund || ''} ${row.box}`.trim());
    });

    return {
      totalRecords: (Array.isArray(rows) ? rows.length : 0),
      detailRows,
      dailyRows,
      controlRows,
      activeDays: daySet.size,
      activeWeeks: weekSet.size,
      activeMonths: monthSet.size,
      people: Array.from(peopleSet).sort(localeSort),
      boxes: Array.from(boxSet).sort(localeSort)
    };
  }

  function renderLatestReport() {
    if (!el.report.latestRows) return;
    const groups = dayGroups();
    setElementText(el.report.latestMeta, groups.length
      ? `son 3 çalışma günü · son kayıt ${formatDateKey(groups[0].dateKey)}`
      : 'kayıt bekleniyor');
    el.report.latestRows.innerHTML = groups.slice(0, 3).map(function (group) {
      const people = Array.from(group.people.values()).slice(0, 3).map(function (person) {
        const works = Array.from(person.works).slice(0, 3).join(', ');
        const parts = [];
        if (person.detailCount) parts.push(`${formatNumber(person.detailCount)} detay`);
        if (person.dailyCount) parts.push(`${formatNumber(person.dailyCount)} günlük kayıt`);
        if (person.controlCount) parts.push(`${formatNumber(person.controlCount)} kontrol`);
        return `<div class="report-person-line">
          <b>${escapeHtml(person.name)}</b>
          <span>${escapeHtml(parts.join(' · ') || 'kayıt')} ${works ? `· ${escapeHtml(works)}` : ''}</span>
        </div>`;
      }).join('');
      return `<article class="report-day-card">
        <div class="report-day-top">
          <span>${escapeHtml(weekdayFromKey(group.dateKey))}</span>
          <span>${formatNumber(group.records)} kayıt</span>
        </div>
        <div class="report-day-date">
          <b>${escapeHtml(dayNumberFromKey(group.dateKey))}</b>
          <span>${escapeHtml(monthNameFromKey(group.dateKey))}</span>
        </div>
        <p class="report-day-summary">${formatNumber(group.detailCount)} detay · ${formatNumber(group.dailyCount)} günlük kayıt · ${formatNumber(group.people.size)} kişi${group.boxes.size ? ` · ${formatNumber(group.boxes.size)} kutu` : ''}</p>
        <div class="report-day-people">${people || '<p class="empty-line">Bu gün için kişi bilgisi yok.</p>'}</div>
      </article>`;
    }).join('') || '<article class="report-empty">Kayıt bekleniyor.</article>';
  }

  function dayGroups() {
    const groups = new Map();
    state.pilotDailyRows.concat(state.pilotScanRows, state.pilotCodeRows).forEach(function (row) {
      if (!row.dateKey) return;
      if (!groups.has(row.dateKey)) {
        groups.set(row.dateKey, {
          dateKey: row.dateKey,
          records: 0,
          detailCount: 0,
          dailyCount: 0,
          controlCount: 0,
          people: new Map(),
          boxes: new Set()
        });
      }
      const group = groups.get(row.dateKey);
      group.records += 1;
      if (row.source === PILOT_SCAN_SHEET) group.detailCount += 1;
      if (row.kind === 'daily') group.dailyCount += 1;
      if (row.source === PILOT_CODE_SHEET) group.controlCount += 1;
      if (row.box) group.boxes.add(`${row.fund || ''} ${row.box}`.trim());
      row.people.forEach(function (person) {
        if (!group.people.has(person)) {
          group.people.set(person, { name: person, detailCount: 0, dailyCount: 0, controlCount: 0, works: new Set() });
        }
        const stats = group.people.get(person);
        if (row.source === PILOT_SCAN_SHEET) stats.detailCount += 1;
        if (row.kind === 'daily') stats.dailyCount += 1;
        if (row.source === PILOT_CODE_SHEET) stats.controlCount += 1;
        row.workTypes.forEach(function (work) { stats.works.add(work); });
      });
    });
    return Array.from(groups.values()).sort(function (a, b) {
      return String(b.dateKey).localeCompare(String(a.dateKey), 'tr');
    });
  }

  function renderVolunteerReport() {
    if (!el.report.volunteers) return;
    const rows = volunteerStats().slice().sort(function (a, b) {
      return String(b.lastDateKey || '').localeCompare(String(a.lastDateKey || ''), 'tr')
        || (b.detailCount + b.activityCount) - (a.detailCount + a.activityCount);
    });
    const shown = rows.slice(0, 8);
    setElementText(el.report.volunteersMeta, rows.length ? `${formatNumber(rows.length)} kişi · öne çıkan ${formatNumber(shown.length)} katkı` : 'kayıt bekleniyor');
    el.report.volunteers.innerHTML = shown.map(function (row) {
      const total = row.totalCount || row.detailCount + row.activityCount;
      return `<article class="report-vol-card">
        <span class="report-avatar">${escapeHtml(initials(row.name))}</span>
        <div>
          <h3>${escapeHtml(row.name)}</h3>
          <p>${formatNumber(row.detailCount)} detay · ${formatNumber(row.activityCount)} günlük kayıt · son ${escapeHtml(row.lastDate || '—')}</p>
          <div class="report-chipline">${row.works.slice(0, 4).map(function (work) { return `<span>${escapeHtml(work)}</span>`; }).join('')}</div>
        </div>
        <strong>${formatNumber(total)}</strong>
      </article>`;
    }).join('') || '<article class="report-empty">Gönüllü kaydı bekleniyor.</article>';
  }

  function renderTrackReport() {
    if (!el.report.tracks) return;
    const rows = workStats();
    const shown = rows.slice(0, 6);
    const max = Math.max(1, ...rows.map(function (row) { return row.activityCount + row.detailCount; }));
    setElementText(el.report.tracksMeta, rows.length ? `${formatNumber(rows.length)} iş alanı` : 'iş alanı bekleniyor');
    el.report.tracks.innerHTML = shown.map(function (row) {
      const total = row.activityCount + row.detailCount;
      const width = Math.max(4, Math.round((total / max) * 100));
      return `<div class="report-track-row">
        <div class="report-track-label">
          <b>${escapeHtml(row.label)}</b>
          <span>${formatNumber(row.people.length)} kişi · ${formatNumber(row.activityCount)} günlük · ${formatNumber(row.detailCount)} detay</span>
        </div>
        <div class="report-track-bar" aria-hidden="true"><span style="width:${width}%"></span></div>
        <strong>${formatNumber(total)}</strong>
      </div>`;
    }).join('') || '<article class="report-empty">İş alanı kaydı bekleniyor.</article>';
  }

  function renderBoxReport() {
    if (!el.report.boxes) return;
    const rows = boxStats().filter(function (row) { return row.done > 0; });
    const shown = rows.slice(0, 4);
    setElementText(el.report.boxesMeta, rows.length ? `${formatNumber(rows.length)} aktif kutu · ilk ${formatNumber(shown.length)}` : 'kutu bekleniyor');
    el.report.boxes.innerHTML = shown.map(function (row) {
      const percent = clamp(Number(row.percent || 0), 0, 100);
      return `<article class="report-box-card">
        <div>
          <span>${escapeHtml(row.fund || 'Fon')}</span>
          <h3>Kutu ${escapeHtml(row.box || '—')}</h3>
        </div>
        <p>${formatNumber(row.done)} / ${formatNumber(row.target)} sayfa · %${formatNumber(percent)}</p>
        <div class="report-mini-track" aria-hidden="true"><span style="width:${percent}%"></span></div>
        <small>${escapeHtml(row.people.slice(0, 4).join(', ') || 'gönüllü bilgisi yok')} · son ${escapeHtml(row.lastDate || '—')}</small>
      </article>`;
    }).join('') || '<article class="report-empty">Aktif kutu kaydı bekleniyor.</article>';
  }

  function renderControlReport() {
    if (!el.report.control) return;
    const rows = state.pilotCodeRows.slice(0, 5);
    setElementText(el.report.controlMeta, state.pilotCodeRows.length ? `${formatNumber(state.pilotCodeRows.length)} kontrol kaydı` : 'denetim defteri boş');
    if (!rows.length) {
      el.report.control.innerHTML = `<article class="report-empty">
        <b>Kontrol/onay defteri henüz boş.</b>
        <span>İlk kontrol kaydı girilince burada kim neyi kontrol etti, sorun var mı ve yayın/AtoM için hazır mı görünecek.</span>
      </article>`;
      return;
    }
    el.report.control.innerHTML = rows.map(function (row) {
      return `<article class="report-control-card">
        <b>${escapeHtml(row.date || '—')} · ${escapeHtml(row.people.join(', ') || 'Kontrol eden yok')}</b>
        <span>${escapeHtml(recordSummary(row))}</span>
        <p>${escapeHtml(row.statuses.join(' · ') || 'Sonuç bekleniyor')}</p>
      </article>`;
    }).join('');
  }

  function renderTable() {
    const config = tableConfig(state.view);
    el.viewKicker.textContent = config.kicker;
    el.viewTitle.textContent = config.title;
    el.tableHead.innerHTML = `<tr>${config.columns.map(function (column) {
      return `<th>${escapeHtml(column.label)}</th>`;
    }).join('')}</tr>`;

    if (state.loading && !config.rows().length) {
      el.tableBody.innerHTML = `<tr><td colspan="${config.columns.length}">Çalışma dosyası okunuyor.</td></tr>`;
    } else if (state.loadError) {
      el.tableBody.innerHTML = `<tr><td colspan="${config.columns.length}">${escapeHtml(state.loadError)}</td></tr>`;
    } else {
      const rows = config.rows().filter(matchesQuery);
      const limit = config.limit || 80;
      const visibleRows = rows.slice(0, limit);
      el.tableBody.innerHTML = visibleRows.map(function (row) {
        return `<tr>${config.columns.map(function (column) {
          return `<td>${column.render(row)}</td>`;
        }).join('')}</tr>`;
      }).join('') || `<tr><td colspan="${config.columns.length}">Bu görünüm için kayıt yok.</td></tr>`;
    }

    const configRows = state.loading ? [] : config.rows().filter(matchesQuery);
    const limitNote = configRows.length > (config.limit || 80)
      ? ` · tabloda ilk ${formatNumber(config.limit || 80)} kayıt gösteriliyor`
      : '';
    el.dataNote.textContent = state.loading
      ? 'Veri yükleniyor; çalışma sekmeleri birkaç saniye sürebilir.'
      : `${state.sourceNote || 'Çalışma dosyasındaki sekmeler doğrudan okunuyor.'} · ${formatNumber(state.pilotScanRows.length)} sayfa/detay satırı · ${formatNumber(state.pilotDailyRows.length)} gönüllü günlüğü · ${formatNumber(state.pilotCodeRows.length)} kontrol/onay${limitNote}`;
  }

  function tableConfig(view) {
    if (view === 'pilot') {
      return {
        kicker: 'Rapor görünümü',
        title: 'Tüm kayıtlar',
        rows: pilotRows,
        columns: [
          { label: 'Tarih', render: function (row) { return `<strong>${escapeHtml(row.date || '—')}</strong>`; } },
          { label: 'Gönüllü', render: function (row) { return escapeHtml(row.people.join(', ') || '—'); } },
          { label: 'İşler', render: function (row) { return workPills(row.workTypes); } },
          { label: 'Fon / kutu', render: function (row) { return escapeHtml([row.fund, row.box ? `Kutu ${row.box}` : ''].filter(Boolean).join(' · ') || '—'); } },
          { label: 'Kayıt', render: function (row) { return escapeHtml(recordSummary(row)); } },
          { label: 'Durum', render: function (row) { return statusPills(row.statuses); } },
          { label: 'Not', render: function (row) { return escapeHtml(row.notes || '—'); } }
        ]
      };
    }

    if (view === 'hiz') {
      return {
        kicker: 'Rapor göstergeleri',
        title: 'Hız ve öngörü',
        limit: 40,
        rows: function () { return reportMetricRows(progressModel()); },
        columns: [
          { label: 'Gösterge', render: function (row) { return `<strong>${escapeHtml(row.label)}</strong>`; } },
          { label: 'Değer', render: function (row) { return escapeHtml(row.value); } },
          { label: 'Dönem', render: function (row) { return escapeHtml(row.period); } },
          { label: 'Not', render: function (row) { return escapeHtml(row.note); } }
        ]
      };
    }

    if (view === 'kutular') {
      return {
        kicker: 'Sayısallaştırma görünümü',
        title: 'Kutular',
        limit: 200,
        rows: boxStats,
        columns: [
          { label: 'Fon / kutu', render: function (row) { return `<strong>${escapeHtml(row.label)}</strong>`; } },
          { label: 'İlerleme', render: progressCell },
          { label: 'Aşamalar', render: function (row) { return `${formatNumber(row.scanCount)} tarama · ${formatNumber(row.codeCount)} kodlama · ${formatNumber(row.controlCount)} kontrol`; } },
          { label: 'Kalan', render: function (row) { return `${formatNumber(row.remaining)} sayfa`; } },
          { label: 'Hız / tahmin', render: boxPaceCell },
          { label: 'Gönüllüler', render: function (row) { return escapeHtml(row.people.join(', ') || '—'); } },
          { label: 'Son tarih', render: function (row) { return escapeHtml(row.lastDate || '—'); } },
          { label: 'Durum', render: function (row) { return statusPills(row.statuses); } }
        ]
      };
    }

    if (view === 'isler') {
      return {
        kicker: 'Çalışma alanı görünümü',
        title: 'İş türleri',
        limit: 200,
        rows: workStats,
        columns: [
          { label: 'İş / alan', render: function (row) { return `<strong>${escapeHtml(row.label)}</strong>`; } },
          { label: 'Günlük kayıt', render: function (row) { return formatNumber(row.activityCount); } },
          { label: 'Detay satırı', render: function (row) { return formatNumber(row.detailCount); } },
          { label: 'Miktar', render: function (row) { return formatNumber(row.amount); } },
          { label: 'Gönüllüler', render: function (row) { return escapeHtml(row.people.join(', ') || '—'); } }
        ]
      };
    }

    if (view === 'gonulluler') {
      return {
        kicker: 'Gönüllü görünümü',
        title: 'Gönüllüler',
        limit: 500,
        rows: volunteerStats,
        columns: [
          { label: 'Gönüllü', render: function (row) { return `<strong>${escapeHtml(row.name)}</strong>`; } },
          { label: 'Tüm çalışma izleri', render: function (row) { return `${formatNumber(row.totalCount)} toplam · ${formatNumber(row.detailCount)} detay · ${formatNumber(row.activityCount)} günlük`; } },
          { label: 'Ortalamalar', render: volunteerPaceCell },
          { label: 'Kontrol', render: function (row) { return `${formatNumber(row.controlCount)} satır/iz`; } },
          { label: 'Kutular', render: function (row) { return escapeHtml(row.boxes.join(', ') || '—'); } },
          { label: 'Son tarih', render: function (row) { return escapeHtml(row.lastDate || '—'); } },
          { label: 'İşler', render: function (row) { return escapeHtml(row.works.join(', ') || '—'); } }
        ]
      };
    }

    if (view === 'kontrol') {
      return {
        kicker: 'Denetim görünümü',
        title: 'Kontrol ve onay',
        limit: 500,
        rows: function () { return state.pilotCodeRows; },
        columns: [
          { label: 'Tarih', render: function (row) { return `<strong>${escapeHtml(row.date || '—')}</strong>`; } },
          { label: 'Kontrol eden', render: function (row) { return escapeHtml(row.people.join(', ') || '—'); } },
          { label: 'İşi yapan', render: function (row) { return escapeHtml(row.checkedPeople.join(', ') || '—'); } },
          { label: 'Kayıt', render: function (row) { return escapeHtml(recordSummary(row)); } },
          { label: 'Kontrol alanı', render: function (row) { return workPills(row.workTypes); } },
          { label: 'Sonuç', render: function (row) { return statusPills(row.statuses); } },
          { label: 'Not', render: function (row) { return escapeHtml(row.notes || '—'); } }
        ]
      };
    }

    if (view === 'plan') {
      return {
        kicker: 'Koordinasyon görünümü',
        title: 'Haftalık plan',
        limit: 200,
        rows: function () { return state.planRows; },
        columns: [
          { label: 'İstasyon', render: function (row) { return `<strong>${escapeHtml(row.station)}</strong>`; } },
          { label: 'Pazartesi', render: function (row) { return escapeHtml(row.Pazartesi || '—'); } },
          { label: 'Salı', render: function (row) { return escapeHtml(row.Salı || '—'); } },
          { label: 'Çarşamba', render: function (row) { return escapeHtml(row.Çarşamba || '—'); } },
          { label: 'Perşembe', render: function (row) { return escapeHtml(row.Perşembe || '—'); } },
          { label: 'Cuma', render: function (row) { return escapeHtml(row.Cuma || '—'); } }
        ]
      };
    }

    if (view === 'atom') {
      return {
        kicker: 'Aktarım önizlemesi',
        title: 'AtoM aktarımı',
        limit: 500,
        rows: atomRows,
        columns: [
          { label: 'Referans kodu', render: function (row) { return `<strong>${escapeHtml(row.referenceCode)}</strong>`; } },
          { label: 'Üst kayıt', render: function (row) { return escapeHtml(row.parent); } },
          { label: 'Başlık', render: function (row) { return escapeHtml(row.title); } },
          { label: 'Kapsam', render: function (row) { return escapeHtml(row.extent); } },
          { label: 'Dijital nesne', render: function (row) { return escapeHtml(row.digitalObject); } },
          { label: 'Durum', render: function (row) { return statusPills(row.statuses); } }
        ]
      };
    }

    return {
      kicker: 'Günlük görünüm',
      title: 'Gönüllü günlüğü',
      limit: 500,
      rows: function () { return state.pilotDailyRows.length ? state.pilotDailyRows : state.activityRows; },
      columns: [
        { label: 'Tarih', render: function (row) { return `<strong>${escapeHtml(row.date || '—')}</strong>`; } },
        { label: 'Gönüllü', render: function (row) { return escapeHtml(row.people.join(', ') || '—'); } },
        { label: 'Çalışma alanı', render: function (row) { return workPills(row.workTypes || [row.area].filter(Boolean)); } },
        { label: 'Yapılan iş', render: function (row) { return escapeHtml(row.work || row.notes || '—'); } },
        { label: 'Sayı', render: function (row) { return row.amount ? `${formatNumber(row.amount)} ${escapeHtml(row.unit || '')}` : '—'; } },
        { label: 'Araç', render: function (row) { return escapeHtml([row.computer, row.scanner].filter(Boolean).join(' · ') || row.scanner || '—'); } }
      ]
    };
  }

  function pilotRows() {
    const sourceRows = state.webSummaryRows.length
      ? state.webSummaryRows
      : state.pilotDailyRows.concat(state.pilotScanRows, state.pilotCodeRows);
    return sourceRows.sort(descByDate);
  }

  function pilotDetailRows() {
    return state.pilotScanRows.concat(state.pilotCodeRows);
  }

  function recordSummary(row) {
    const parts = [];
    if (row.code) parts.push(row.code);
    if (row.file) parts.push(`Dosya ${row.file}`);
    if (row.document) parts.push(`Belge ${row.document}`);
    if (row.page) parts.push(`Sayfa ${row.page}`);
    if (!parts.length && row.amount) parts.push(`${formatNumber(row.amount)} ${row.unit || ''}`.trim());
    return parts.join(' · ') || row.recordId || '—';
  }

  function workPills(values) {
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    return list.length ? statusPills(list) : '—';
  }

  function boxStats() {
    const groups = new Map();
    state.inventoryRows.forEach(function (row) {
      const key = boxKey(row.fund, row.box);
      if (!groups.has(key)) {
        groups.set(key, emptyBox(row.fund, row.box));
      }
      const group = groups.get(key);
      group.target += row.targetPages;
      group.fileCount += row.fileCount;
      group.documentCount += row.documentCount;
      if (row.scanDone) group.statuses.add('Tarama işaretli');
      if (row.codeDone) group.statuses.add('Kodlama işaretli');
      if (row.controlDone) group.statuses.add('Kontrol işaretli');
      if (row.catalogDone) group.statuses.add('Kataloglama işaretli');
    });

    state.pilotScanRows.forEach(function (row) {
      const key = boxKey(row.fund, row.box);
      if (!groups.has(key)) {
        groups.set(key, emptyBox(row.fund, row.box));
      }
      const group = groups.get(key);
      group.done += 1;
      if (hasWorkType(row, 'Tarama')) group.scanCount += 1;
      if (hasWorkType(row, 'Kodlama')) group.codeCount += 1;
      if (hasWorkType(row, 'Kontrol')) group.controlCount += 1;
      row.people.forEach(function (person) { group.peopleSet.add(person); });
      row.statuses.forEach(function (status) { group.statuses.add(status); });
      if (row.dateKey) group.daySet.add(row.dateKey);
      if (row.dateKey && (!group.lastDateKey || row.dateKey > group.lastDateKey)) {
        group.lastDateKey = row.dateKey;
        group.lastDate = row.date;
      }
    });

    state.pilotCodeRows.forEach(function (row) {
      const key = boxKey(row.fund, row.box);
      if (!groups.has(key)) {
        groups.set(key, emptyBox(row.fund, row.box));
      }
      const group = groups.get(key);
      group.controlCount += 1;
      row.people.forEach(function (person) { group.peopleSet.add(person); });
      row.checkedPeople.forEach(function (person) { group.peopleSet.add(person); });
      row.statuses.forEach(function (status) { group.statuses.add(status); });
      if (row.dateKey) group.daySet.add(row.dateKey);
      if (row.dateKey && (!group.lastDateKey || row.dateKey > group.lastDateKey)) {
        group.lastDateKey = row.dateKey;
        group.lastDate = row.date;
      }
    });

    return Array.from(groups.values()).map(function (group) {
      const percent = group.target ? (group.done / group.target) * 100 : 0;
      const remaining = Math.max(0, group.target - group.done);
      const activeDays = group.daySet.size;
      if (percent >= 100) group.statuses.add('Tamamlandı');
      if (group.done && percent < 100) group.statuses.add('Sürüyor');
      return {
        label: `${group.fund || 'Fon'} · Kutu ${group.box || '—'}`,
        fund: group.fund,
        box: group.box,
        done: group.done,
        target: group.target,
        remaining,
        percent,
        fileCount: group.fileCount,
        documentCount: group.documentCount,
        scanCount: group.scanCount,
        codeCount: group.codeCount,
        controlCount: group.controlCount,
        activeDays,
        paceActiveDay: safeDivide(group.done, activeDays),
        people: Array.from(group.peopleSet).sort(localeSort),
        lastDate: group.lastDate,
        statuses: Array.from(group.statuses)
      };
    }).sort(function (a, b) {
      return Number(b.done || 0) - Number(a.done || 0);
    });
  }

  function emptyBox(fund, box) {
    return {
      fund,
      box,
      done: 0,
      target: 0,
      fileCount: 0,
      documentCount: 0,
      scanCount: 0,
      codeCount: 0,
      controlCount: 0,
      peopleSet: new Set(),
      daySet: new Set(),
      statuses: new Set(),
      lastDate: '',
      lastDateKey: ''
    };
  }

  function workStats() {
    const groups = new Map();
    state.pilotDailyRows.forEach(function (row) {
      const labels = row.workTypes.length ? row.workTypes : [row.area || inferArea(row.work) || 'Diğer çalışma'];
      labels.forEach(function (label) {
        if (!groups.has(label)) {
          groups.set(label, { label, activityCount: 0, detailCount: 0, amount: 0, peopleSet: new Set() });
        }
        const group = groups.get(label);
        group.activityCount += 1;
        group.amount += row.amount || 0;
        row.people.forEach(function (person) { group.peopleSet.add(person); });
      });
    });

    pilotDetailRows().forEach(function (row) {
      const labels = row.workTypes.length ? row.workTypes : [`${row.fund || 'Arşiv'} sayısallaştırma`];
      labels.forEach(function (label) {
        if (!groups.has(label)) {
          groups.set(label, { label, activityCount: 0, detailCount: 0, amount: 0, peopleSet: new Set() });
        }
        const group = groups.get(label);
        group.detailCount += 1;
        group.amount += row.amount || 1;
        row.people.forEach(function (person) { group.peopleSet.add(person); });
      });
    });

    if (!groups.size) {
      state.activityRows.forEach(function (row) {
        const label = row.area || inferArea(row.work) || 'Diğer çalışma';
        if (!groups.has(label)) {
          groups.set(label, { label, activityCount: 0, detailCount: 0, amount: 0, peopleSet: new Set() });
        }
        const group = groups.get(label);
        group.activityCount += 1;
        group.amount += row.amount || 0;
        row.people.forEach(function (person) { group.peopleSet.add(person); });
      });
    }

    return Array.from(groups.values()).map(function (group) {
      return Object.assign({}, group, {
        people: Array.from(group.peopleSet).sort(localeSort)
      });
    }).sort(function (a, b) {
      return (b.activityCount + b.detailCount) - (a.activityCount + a.detailCount);
    });
  }

  function legacyWorkStats() {
    const groups = new Map();
    state.activityRows.forEach(function (row) {
      const label = row.area || inferArea(row.work) || 'Diğer çalışma';
      if (!groups.has(label)) {
        groups.set(label, { label, activityCount: 0, detailCount: 0, amount: 0, peopleSet: new Set() });
      }
      const group = groups.get(label);
      group.activityCount += 1;
      group.amount += row.amount || 0;
      row.people.forEach(function (person) { group.peopleSet.add(person); });
    });

    state.detailRows.forEach(function (row) {
      const label = `${row.fund || 'Arşiv'} sayısallaştırma detayları`;
      if (!groups.has(label)) {
        groups.set(label, { label, activityCount: 0, detailCount: 0, amount: 0, peopleSet: new Set() });
      }
      const group = groups.get(label);
      group.detailCount += 1;
      group.amount += 1;
      row.people.forEach(function (person) { group.peopleSet.add(person); });
    });

    return Array.from(groups.values()).map(function (group) {
      return Object.assign({}, group, {
        people: Array.from(group.peopleSet).sort(localeSort)
      });
    }).sort(function (a, b) {
      return (b.activityCount + b.detailCount) - (a.activityCount + a.detailCount);
    });
  }

  function volunteerStats() {
    const groups = new Map();
    state.pilotDailyRows.forEach(function (row) {
      row.people.forEach(function (person) {
        const group = volunteerGroup(groups, person);
        group.activityCount += 1;
        (row.workTypes.length ? row.workTypes : [row.area || row.work]).filter(Boolean).forEach(function (work) {
          group.works.add(work);
        });
        if (hasWorkType(row, 'Kontrol')) group.controlTraceCount += 1;
        addVolunteerPeriod(group, row.dateKey);
        updateLastDate(group, row.date, row.dateKey);
      });
    });

    pilotDetailRows().forEach(function (row) {
      row.people.forEach(function (person) {
        const group = volunteerGroup(groups, person);
        if (row.source === PILOT_CODE_SHEET) {
          group.structuredControlCount += 1;
        } else {
          group.detailCount += 1;
        }
        if (row.box) group.boxes.add(`${row.fund} ${row.box}`.trim());
        (row.workTypes.length ? row.workTypes : [`${row.fund || 'Arşiv'} sayısallaştırma`]).forEach(function (work) {
          group.works.add(work);
        });
        addVolunteerPeriod(group, row.dateKey);
        updateLastDate(group, row.date, row.dateKey);
      });
    });

    if (!groups.size) {
      state.activityRows.forEach(function (row) {
        row.people.forEach(function (person) {
          const group = volunteerGroup(groups, person);
          group.activityCount += 1;
          if (row.area || row.work) group.works.add(row.area || row.work);
          addVolunteerPeriod(group, row.dateKey);
          updateLastDate(group, row.date, row.dateKey);
        });
      });
    }

    return Array.from(groups.values()).map(function (group) {
      const totalCount = group.activityCount + group.detailCount + group.structuredControlCount;
      return {
        name: group.name,
        totalCount,
        activityCount: group.activityCount,
        detailCount: group.detailCount,
        controlCount: group.structuredControlCount + group.controlTraceCount,
        activeDays: group.daySet.size,
        activeWeeks: group.weekSet.size,
        activeMonths: group.monthSet.size,
        avgDay: safeDivide(totalCount, group.daySet.size),
        avgWeek: safeDivide(totalCount, group.weekSet.size),
        avgMonth: safeDivide(totalCount, group.monthSet.size),
        boxes: Array.from(group.boxes).sort(localeSort).slice(0, 8),
        works: Array.from(group.works).sort(localeSort).slice(0, 5),
        lastDate: group.lastDate,
        lastDateKey: group.lastDateKey
      };
    }).sort(function (a, b) {
      return (b.detailCount + b.activityCount) - (a.detailCount + a.activityCount);
    });
  }

  function volunteerGroup(groups, name) {
    if (!groups.has(name)) {
      groups.set(name, {
        name,
        activityCount: 0,
        detailCount: 0,
        structuredControlCount: 0,
        controlTraceCount: 0,
        boxes: new Set(),
        works: new Set(),
        daySet: new Set(),
        weekSet: new Set(),
        monthSet: new Set(),
        lastDate: '',
        lastDateKey: ''
      });
    }
    return groups.get(name);
  }

  function addVolunteerPeriod(group, key) {
    if (!key) return;
    group.daySet.add(key);
    group.weekSet.add(weekKey(key));
    group.monthSet.add(monthKey(key));
  }

  function atomRows() {
    if (state.atomExportRows.length) {
      return state.atomExportRows.map(function (row) {
        return {
          referenceCode: row.referenceCode || row.recordId || '—',
          parent: row.parent || '—',
          title: row.title || row.referenceCode || '—',
          extent: row.extent || [row.level, row.fund, row.box ? `Kutu ${row.box}` : ''].filter(Boolean).join(' · '),
          digitalObject: row.digitalObject || '—',
          statuses: row.statuses.length ? row.statuses : ['Aktarım satırı']
        };
      });
    }

    return boxStats().filter(function (row) {
      return row.done || row.target;
    }).map(function (row) {
      const reference = `${row.fund || 'FON'}-${row.box || 'KUTU'}`.replace(/\s+/g, '-');
      return {
        referenceCode: reference,
        parent: row.fund === 'NSS' ? 'NSS Harita Koleksiyonu' : 'Pertev Naili Boratav Arşivi',
        title: `${row.fund || 'Fon'} Kutu ${row.box || '—'}`,
        extent: `${formatNumber(row.done)} / ${formatNumber(row.target)} sayfa`,
        digitalObject: `${reference}.pdf`,
        statuses: row.statuses
      };
    });
  }

  function progressCell(row) {
    const percent = clamp(Number(row.percent || 0), 0, 100);
    return `<div class="progress-line">
      <span>${formatNumber(row.done)} / ${formatNumber(row.target)} sayfa · ${formatNumber(percent)}%</span>
      <span class="progress-track" aria-hidden="true"><span class="progress-fill" style="width:${percent}%"></span></span>
    </div>`;
  }

  function boxPaceCell(row) {
    const pace = row.paceActiveDay || 0;
    const estimate = pace && row.remaining
      ? `${formatNumber(Math.ceil(row.remaining / pace))} aktif gün`
      : '—';
    return `<div class="progress-line">
      <span>${pace ? `${formatNumber(pace)} sayfa/aktif gün` : 'hız bekleniyor'}</span>
      <small>${escapeHtml(row.remaining ? estimate : 'tamamlandı ya da hedef yok')}</small>
    </div>`;
  }

  function volunteerPaceCell(row) {
    return `<div class="progress-line">
      <span>${formatNumber(row.avgDay)} / gün</span>
      <small>${formatNumber(row.avgWeek)} / hafta · ${formatNumber(row.avgMonth)} / ay</small>
    </div>`;
  }

  function statusPills(statuses) {
    const values = Array.isArray(statuses) && statuses.length ? statuses : ['Bekliyor'];
    return values.map(function (status) {
      const cls = status === 'Tamamlandı' || status.indexOf('işaretli') >= 0 ? 'done' : 'warn';
      return `<span class="status-pill ${cls}">${escapeHtml(status)}</span>`;
    }).join(' ');
  }

  function matchesQuery(row) {
    if (!state.query) return true;
    return Object.values(row).map(flattenValue).join(' ').toLocaleLowerCase('tr').includes(state.query);
  }

  function flattenValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(flattenValue).join(' ');
    if (value instanceof Set) return Array.from(value).map(flattenValue).join(' ');
    if (typeof value === 'object') return Object.values(value).map(flattenValue).join(' ');
    return String(value);
  }

  function pick(row, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const value = row[keys[i]];
      if (value != null && value !== '') return value;
    }
    return '';
  }

  function splitPeople(value) {
    const seen = new Set();
    return clean(value)
      .split(/\s*(?:,|&|\+|\s+-\s+| ve )\s*/i)
      .map(canonicalPersonName)
      .filter(function (person) {
        const key = personKey(person);
        if (!person || person === '-' || person.length <= 1 || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function canonicalPersonName(value) {
    const name = clean(value);
    const aliases = {
      'ilknur arslan': 'İlknur Arslan',
      'kubra baspinar': 'Kübra Başpınar',
      'ozden': 'Özden Özütemiz',
      'ozden ozutemiz': 'Özden Özütemiz',
      'sibel dag': 'Sibel Dağ'
    };
    return aliases[personKey(name)] || name;
  }

  function personKey(value) {
    return clean(value)
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/İ/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function inferArea(value) {
    const text = clean(value).toLocaleLowerCase('tr');
    if (!text) return '';
    if (text.includes('tarama') || text.includes('kodlama') || text.includes('kontrol')) return 'Sayısallaştırma';
    if (text.includes('kronoloji')) return 'Kronoloji';
    if (text.includes('proje') || text.includes('başvuru')) return 'Proje çalışmaları';
    if (text.includes('web')) return 'Web sitesi';
    if (text.includes('toplantı') || text.includes('eğitim')) return 'Toplantı / eğitim';
    if (text.includes('taşıma') || text.includes('raf') || text.includes('kütüphane')) return 'Kütüphane';
    return 'Diğer çalışma';
  }

  function boxKey(fund, box) {
    return `${clean(fund) || 'Fon'}::${clean(box) || 'Kutu'}`;
  }

  function updateLastDate(group, label, key) {
    if (key && (!group.lastDateKey || key > group.lastDateKey)) {
      group.lastDateKey = key;
      group.lastDate = label;
    }
  }

  function hasWorkType(row, label) {
    const needle = clean(label).toLocaleLowerCase('tr');
    return (row.workTypes || []).some(function (work) {
      return clean(work).toLocaleLowerCase('tr').includes(needle);
    });
  }

  function safeDivide(numerator, denominator) {
    const top = Number(numerator || 0);
    const bottom = Number(denominator || 0);
    return bottom ? top / bottom : 0;
  }

  function dateKey(value) {
    const text = clean(value)
      .replace(/[/-]/g, '.')
      .replace(/\.{2,}/g, '.');
    if (!text) return '';
    const splitYear = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})\.(\d{2})$/);
    if (splitYear) return `${splitYear[3]}${splitYear[4]}-${pad(splitYear[2])}-${pad(splitYear[1])}`;
    const dot = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (dot) return `${dot[3]}-${pad(dot[2])}-${pad(dot[1])}`;
    const tr = text.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
    if (tr) {
      const month = [
        'ocak',
        'şubat',
        'mart',
        'nisan',
        'mayıs',
        'haziran',
        'temmuz',
        'ağustos',
        'eylül',
        'ekim',
        'kasım',
        'aralık'
      ].indexOf(tr[2].toLocaleLowerCase('tr')) + 1;
      if (month > 0) return `${tr[3]}-${pad(month)}-${pad(tr[1])}`;
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return '';
  }

  function latestDateKey(rows) {
    return (Array.isArray(rows) ? rows : []).reduce(function (latest, row) {
      return row.dateKey && (!latest || row.dateKey > latest) ? row.dateKey : latest;
    }, '');
  }

  function firstDateKey(rows) {
    return (Array.isArray(rows) ? rows : []).reduce(function (first, row) {
      return row.dateKey && (!first || row.dateKey < first) ? row.dateKey : first;
    }, '');
  }

  function shiftDateKey(key, days) {
    const date = new Date(`${key}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function diffDaysInclusive(startKey, endKey) {
    const start = new Date(`${startKey}T12:00:00`);
    const end = new Date(`${endKey}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }

  function weekKey(key) {
    const date = new Date(`${key}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    return date.toISOString().slice(0, 10);
  }

  function monthKey(key) {
    return String(key || '').slice(0, 7);
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function formatDateKey(key) {
    if (!key) return '—';
    const parts = key.split('-');
    return `${Number(parts[2])} ${monthNameFromKey(key)} ${parts[0]}`;
  }

  function weekdayFromKey(key) {
    const date = new Date(`${key}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', { weekday: 'long' });
  }

  function dayNumberFromKey(key) {
    const parts = String(key || '').split('-');
    return parts[2] || '—';
  }

  function monthNameFromKey(key) {
    const date = new Date(`${key}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', { month: 'long' });
  }

  function descByDate(a, b) {
    return String(b.dateKey || '').localeCompare(String(a.dateKey || ''), 'tr') || String(b.date || '').localeCompare(String(a.date || ''), 'tr');
  }

  function truthy(value) {
    const text = clean(value).toLocaleLowerCase('tr');
    return text === '1' || text === 'true' || text === 'evet' || text === 'tamam' || text === 'x';
  }

  function numberFrom(value) {
    const text = clean(value).replace(/\./g, '').replace(',', '.');
    const match = text.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function progressPercentFrom(value) {
    const text = clean(value);
    if (!text) return null;
    let normalized = text.replace('%', '').trim();
    if (normalized.includes(',') && normalized.includes('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (normalized.includes(',')) {
      normalized = normalized.replace(',', '.');
    }
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    let percent = Number(match[0]);
    if (!Number.isFinite(percent)) return null;
    if (percent > 0 && percent <= 1 && !text.includes('%')) percent *= 100;
    return clamp(percent, 0, 100);
  }

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function localeSort(a, b) {
    return String(a).localeCompare(String(b), 'tr');
  }

  function initials(name) {
    return clean(name).split(/\s+/).filter(Boolean).map(function (part) {
      return part[0];
    }).slice(0, 2).join('').toLocaleUpperCase('tr') || '—';
  }

  function setElementText(element, value) {
    if (element) element.textContent = value == null ? '' : String(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatNumber(value) {
    if (value == null || value === '' || Number.isNaN(Number(value))) return '0';
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(Number(value));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
