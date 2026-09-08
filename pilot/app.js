(function () {
  const SPREADSHEET_ID = '1DiUCoI9f7xrnBil2-H7EPqb9Scj37QKSOpnwdrFZghw';
  const SOURCE_TITLE = 'Tarih Vakfı Dijitalleştirme Yönetimi - Pilot';
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
    dataNote: document.getElementById('dataNote'),
    viewKicker: document.getElementById('viewKicker'),
    viewTitle: document.getElementById('viewTitle'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    searchInput: document.getElementById('searchInput'),
    buttons: Array.from(document.querySelectorAll('[data-view]')),
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
    setStatus('loading', 'pilot sheet okunuyor');
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
      state.sourceNote = 'Yeni pilot sekmeleri doğrudan okunuyor. Genel ilerleme PNB Sayısallaştırma L105 hücresinden alınıyor.';
      setStatus('live', 'pilot sheet canlı');
      render();
    } catch (error) {
      state.loading = false;
      state.loadError = 'Pilot Sheet okunamadı. Dosyanın bağlantıyla görüntülenebilir olması gerekiyor.';
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
        statuses: truthy(pick(row, ["Web'de göster"])) ? ['Webde göster'] : ['Pilot kayıt'],
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
        statuses: statuses.length ? statuses : ['Pilot kayıt'],
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
        statuses: statuses.length ? statuses : ['Pilot kayıt'],
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
    renderTable();
  }

  function renderChrome() {
    if (el.sourceName) el.sourceName.textContent = SOURCE_TITLE;
    if (el.sourceDetail) {
      el.sourceDetail.textContent = state.loading
        ? 'Pilot dosyadaki mevcut sekmeler okunuyor.'
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
    el.metrics.progress.textContent = metrics.progress == null ? '—' : `${formatNumber(metrics.progress)}%`;
    el.metrics.records.textContent = formatNumber(metrics.records);
    el.metrics.pages.textContent = formatNumber(metrics.details);
    el.metrics.volunteers.textContent = formatNumber(metrics.volunteers);
    el.metrics.boxes.textContent = formatNumber(metrics.boxes);
  }

  function buildMetrics() {
    const targetPages = state.inventoryRows.reduce(function (sum, row) {
      return sum + Number(row.targetPages || 0);
    }, 0);
    const detailRows = pilotDetailRows().length;
    const sheetProgress = state.progressPercent == null ? null : state.progressPercent;
    return {
      progress: sheetProgress == null && targetPages ? (detailRows / targetPages) * 100 : sheetProgress,
      records: state.pilotDailyRows.length + detailRows,
      details: detailRows,
      volunteers: volunteerStats().length,
      boxes: boxStats().filter(function (row) { return row.done > 0; }).length
    };
  }

  function renderTable() {
    const config = tableConfig(state.view);
    el.viewKicker.textContent = config.kicker;
    el.viewTitle.textContent = config.title;
    el.tableHead.innerHTML = `<tr>${config.columns.map(function (column) {
      return `<th>${escapeHtml(column.label)}</th>`;
    }).join('')}</tr>`;

    if (state.loading && !config.rows().length) {
      el.tableBody.innerHTML = `<tr><td colspan="${config.columns.length}">Pilot Sheet okunuyor.</td></tr>`;
    } else if (state.loadError) {
      el.tableBody.innerHTML = `<tr><td colspan="${config.columns.length}">${escapeHtml(state.loadError)}</td></tr>`;
    } else {
      const rows = config.rows().filter(matchesQuery);
      el.tableBody.innerHTML = rows.slice(0, 120).map(function (row) {
        return `<tr>${config.columns.map(function (column) {
          return `<td>${column.render(row)}</td>`;
        }).join('')}</tr>`;
      }).join('') || `<tr><td colspan="${config.columns.length}">Bu görünüm için kayıt yok.</td></tr>`;
    }

    el.dataNote.textContent = state.loading
      ? 'Veri yükleniyor; pilot sekmeler birkaç saniye sürebilir.'
      : `${state.sourceNote || 'Yeni pilot sekmeleri doğrudan okunuyor.'} · ${formatNumber(pilotDetailRows().length)} detay satırı · ${formatNumber(state.pilotDailyRows.length)} gönüllü günlüğü satırı`;
  }

  function tableConfig(view) {
    if (view === 'pilot') {
      return {
        kicker: 'Yeni pilot görünüm',
        title: 'Pilot girişleri',
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

    if (view === 'kutular') {
      return {
        kicker: 'Sayısallaştırma görünümü',
        title: 'Kutular',
        rows: boxStats,
        columns: [
          { label: 'Fon / kutu', render: function (row) { return `<strong>${escapeHtml(row.label)}</strong>`; } },
          { label: 'İlerleme', render: progressCell },
          { label: 'Dosya / belge', render: function (row) { return `${formatNumber(row.fileCount)} dosya · ${formatNumber(row.documentCount)} belge`; } },
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
        rows: volunteerStats,
        columns: [
          { label: 'Gönüllü', render: function (row) { return `<strong>${escapeHtml(row.name)}</strong>`; } },
          { label: 'Günlük kayıt', render: function (row) { return formatNumber(row.activityCount); } },
          { label: 'Detay satırı', render: function (row) { return formatNumber(row.detailCount); } },
          { label: 'Kutular', render: function (row) { return escapeHtml(row.boxes.join(', ') || '—'); } },
          { label: 'Son tarih', render: function (row) { return escapeHtml(row.lastDate || '—'); } },
          { label: 'İşler', render: function (row) { return escapeHtml(row.works.join(', ') || '—'); } }
        ]
      };
    }

    if (view === 'plan') {
      return {
        kicker: 'Koordinasyon görünümü',
        title: 'Haftalık plan',
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
      row.people.forEach(function (person) { group.peopleSet.add(person); });
      row.statuses.forEach(function (status) { group.statuses.add(status); });
      if (row.dateKey && (!group.lastDateKey || row.dateKey > group.lastDateKey)) {
        group.lastDateKey = row.dateKey;
        group.lastDate = row.date;
      }
    });

    return Array.from(groups.values()).map(function (group) {
      const percent = group.target ? (group.done / group.target) * 100 : 0;
      if (percent >= 100) group.statuses.add('Tamamlandı');
      if (group.done && percent < 100) group.statuses.add('Sürüyor');
      return {
        label: `${group.fund || 'Fon'} · Kutu ${group.box || '—'}`,
        fund: group.fund,
        box: group.box,
        done: group.done,
        target: group.target,
        percent,
        fileCount: group.fileCount,
        documentCount: group.documentCount,
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
      peopleSet: new Set(),
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
        updateLastDate(group, row.date, row.dateKey);
      });
    });

    pilotDetailRows().forEach(function (row) {
      row.people.forEach(function (person) {
        const group = volunteerGroup(groups, person);
        group.detailCount += 1;
        if (row.box) group.boxes.add(`${row.fund} ${row.box}`.trim());
        (row.workTypes.length ? row.workTypes : [`${row.fund || 'Arşiv'} sayısallaştırma`]).forEach(function (work) {
          group.works.add(work);
        });
        updateLastDate(group, row.date, row.dateKey);
      });
    });

    if (!groups.size) {
      state.activityRows.forEach(function (row) {
        row.people.forEach(function (person) {
          const group = volunteerGroup(groups, person);
          group.activityCount += 1;
          if (row.area || row.work) group.works.add(row.area || row.work);
          updateLastDate(group, row.date, row.dateKey);
        });
      });
    }

    return Array.from(groups.values()).map(function (group) {
      return {
        name: group.name,
        activityCount: group.activityCount,
        detailCount: group.detailCount,
        boxes: Array.from(group.boxes).sort(localeSort).slice(0, 8),
        works: Array.from(group.works).sort(localeSort).slice(0, 5),
        lastDate: group.lastDate
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
        boxes: new Set(),
        works: new Set(),
        lastDate: '',
        lastDateKey: ''
      });
    }
    return groups.get(name);
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
    return clean(value)
      .split(/\s*(?:,|&|\+| ve )\s*/i)
      .map(clean)
      .filter(function (person) {
        return person && person !== '-' && person.length > 1;
      });
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
