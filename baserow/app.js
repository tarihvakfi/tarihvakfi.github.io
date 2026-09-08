(function () {
  const ROWS_KEY = 'tvf-baserow-demo-v2';
  const VOLUNTEERS_KEY = 'tvf-baserow-volunteers-v1';

  const defaultVolunteers = [
    'Berfin Yazıcı',
    'Anıl Olcan',
    'Özden Özütemiz',
    'Sibel Dağ',
    'Arif Solmaz'
  ];

  const workTypes = {
    'Sayısallaştırma': [
      'Tarama',
      'Kodlama',
      'Kontrol',
      'Kataloglama',
      'PDF/JPEG çıktısı',
      'Diğer'
    ],
    'Kütüphane taşınması': [
      'Raf sayımı',
      'Kitap envanteri',
      'Kutu hazırlama',
      'Künye kontrolü',
      'Taşıma kararı',
      'Diğer'
    ],
    'Proje geliştirme': [
      'Proje fikri',
      'Başvuru metni',
      'Bütçe çalışması',
      'Ortak görüşmesi',
      'Raporlama',
      'Diğer'
    ],
    'Web sitesi': [
      'İçerik güncelleme',
      'Veri kontrolü',
      'Tasarım düzeltmesi',
      'Yayın hazırlığı',
      'Hata düzeltme',
      'Diğer'
    ],
    'Kronoloji': [
      'Olay girişi',
      'Kaynak kontrolü',
      'Düzeltme önerisi',
      'Görsel/bağlantı kontrolü',
      'Diğer'
    ],
    'Koordinasyon': [
      'Haftalık plan',
      'Gönüllü iletişimi',
      'İş bölümü',
      'Toplantı',
      'Diğer'
    ],
    'Eğitim / toplantı': [
      'Oryantasyon',
      'Eğitim',
      'Değerlendirme',
      'Toplantı',
      'Diğer'
    ],
    'Diğer': [
      'Diğer'
    ]
  };

  const areaNotes = {
    'Sayısallaştırma': 'Kutu, dosya, belge ve sayfa bilgisi AtoM aktarımı için korunur.',
    'Kütüphane taşınması': 'Raf, sıra, sayım, kutulama ve karar işleri aynı çalışma kaydına bağlanır.',
    'Proje geliştirme': 'Başvuru, bütçe, görüşme ve rapor işleri emek günlüğünde görünür kalır.',
    'Web sitesi': 'İçerik, tasarım, veri ve yayın işleri ayrı bir teknik tabloya gömülmeden izlenir.',
    'Kronoloji': 'Olay, kaynak ve düzeltme çalışmaları ana gönüllü emeği içinde sayılır.',
    'Koordinasyon': 'Planlama, iletişim ve iş bölümü de çalışma kaydıdır.',
    'Eğitim / toplantı': 'Oryantasyon ve toplantılar üretim sürecinin parçası olarak tutulur.',
    'Diğer': 'Listede yoksa “Diğer” seçilir ve yapılan iş açıkça yazılır.'
  };

  const seedRows = [
    {
      id: 1,
      gonullu: 'Berfin Yazıcı',
      tarih: '2026-09-08',
      calismaAlani: 'Sayısallaştırma',
      isTuru: 'Tarama',
      yapilanIs: '',
      fon: 'PNB',
      kutu: '34',
      dosya: '12',
      belge: '1',
      miktar: 48,
      cihaz: 'Viisan A3 Flat',
      durum: 'Kontrol bekliyor',
      not: 'Dosya sonu kontrol edilecek'
    },
    {
      id: 2,
      gonullu: 'Anıl Olcan',
      tarih: '2026-09-08',
      calismaAlani: 'Sayısallaştırma',
      isTuru: 'Kodlama',
      yapilanIs: '',
      fon: 'PNB',
      kutu: '40',
      dosya: '3',
      belge: '2',
      miktar: 36,
      cihaz: 'Bookeye',
      durum: 'Sürüyor',
      not: 'Belge tarihi netleştirilecek'
    },
    {
      id: 3,
      gonullu: 'Özden Özütemiz',
      tarih: '2026-09-07',
      calismaAlani: 'Kütüphane taşınması',
      isTuru: 'Raf sayımı',
      yapilanIs: '',
      fon: 'Kütüphane',
      kutu: '',
      dosya: 'Raf B-12',
      belge: 'Sıra 3',
      miktar: 84,
      cihaz: 'Kütüphane rafı',
      durum: 'Takip gerekiyor',
      not: 'Sayım onayı bekliyor'
    },
    {
      id: 4,
      gonullu: 'Sibel Dağ',
      tarih: '2026-09-06',
      calismaAlani: 'Sayısallaştırma',
      isTuru: 'Kontrol',
      yapilanIs: '',
      fon: 'PNB',
      kutu: '68',
      dosya: '3',
      belge: '6',
      miktar: 64,
      cihaz: 'Viisan S21',
      durum: 'Kontrol bekliyor',
      not: 'Kod çakışması kontrol edilecek'
    },
    {
      id: 5,
      gonullu: 'Arif Solmaz',
      tarih: '2026-09-05',
      calismaAlani: 'Web sitesi',
      isTuru: 'Veri kontrolü',
      yapilanIs: '',
      fon: '',
      kutu: '',
      dosya: '',
      belge: '',
      miktar: 1,
      cihaz: 'Web sitesi',
      durum: 'Tamamlandı',
      not: 'Kamuya açık dashboard verileri kontrol edildi'
    },
    {
      id: 6,
      gonullu: 'Berfin Yazıcı',
      tarih: '2026-09-04',
      calismaAlani: 'Proje geliştirme',
      isTuru: 'Diğer',
      yapilanIs: 'Arşiv projesi için örnek çıktı ve ihtiyaç listesi hazırlandı',
      fon: '',
      kutu: '',
      dosya: '',
      belge: '',
      miktar: 2,
      cihaz: 'Bilgisayar',
      durum: 'Kaydedildi',
      not: 'Diğer seçeneğiyle gerçek iş açıklaması tutuldu'
    }
  ];

  const state = {
    rows: loadRows(),
    volunteers: loadVolunteers(),
    view: 'kayitlar',
    query: ''
  };

  const form = document.getElementById('calismaForm');
  const resetButton = document.getElementById('demoSifirla');
  const searchInput = document.getElementById('arama');
  const viewButtons = Array.from(document.querySelectorAll('[data-view]'));
  const areaSelect = document.getElementById('calismaAlani');
  const workSelect = document.getElementById('isTuru');
  const volunteerSelect = form.elements.gonullu;
  const newVolunteerRow = document.getElementById('yeniGonulluSatiri');
  const otherWorkRow = document.getElementById('digerIsSatiri');
  const archiveFields = document.getElementById('arsivAlanlari');
  const areaNote = document.getElementById('alanNotu');
  const amountLabel = document.getElementById('miktarEtiketi');

  form.elements.tarih.value = new Date().toISOString().slice(0, 10);
  renderVolunteerOptions();
  updateWorkOptions();
  updateConditionalFields();

  areaSelect.addEventListener('change', function () {
    updateWorkOptions();
    updateConditionalFields();
  });

  workSelect.addEventListener('change', updateConditionalFields);
  volunteerSelect.addEventListener('change', updateConditionalFields);

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());
    const volunteerName = resolveVolunteerName(data);
    const workDescription = String(data.yapilanIs || '').trim();

    if (!volunteerName) {
      showMessage('Ad soyad alanını doldurun.');
      form.elements.yeniGonullu.focus();
      return;
    }

    if (requiresWorkDescription(data.calismaAlani, data.isTuru) && !workDescription) {
      showMessage('Diğer seçildiğinde yapılan işi açıkça yazın.');
      form.elements.yapilanIs.focus();
      return;
    }

    rememberVolunteer(volunteerName);

    const row = {
      id: Date.now(),
      gonullu: volunteerName,
      tarih: data.tarih,
      calismaAlani: data.calismaAlani,
      isTuru: data.isTuru,
      yapilanIs: workDescription,
      fon: archiveFields.hidden ? '' : String(data.fon || '').trim(),
      kutu: archiveFields.hidden ? '' : String(data.kutu || '').trim(),
      dosya: archiveFields.hidden ? '' : String(data.dosya || '').trim(),
      belge: archiveFields.hidden ? '' : String(data.belge || '').trim(),
      miktar: Number(data.miktar || 0),
      cihaz: data.cihaz,
      durum: data.durum,
      not: String(data.not || '').trim()
    };

    state.rows.unshift(row);
    saveRows();
    form.elements.not.value = '';
    form.elements.yapilanIs.value = '';
    form.elements.yeniGonullu.value = '';
    if (volunteerSelect.value === '__new__') volunteerSelect.value = volunteerName;
    updateConditionalFields();
    showMessage('Demo çalışma kaydı eklendi. Bu kayıt yalnızca bu tarayıcıda tutulur.');
    renderAll();
  });

  resetButton.addEventListener('click', function () {
    state.rows = seedRows.slice();
    state.volunteers = defaultVolunteers.slice();
    saveRows();
    saveVolunteers();
    renderVolunteerOptions();
    updateConditionalFields();
    showMessage('Demo veri yenilendi.');
    renderAll();
  });

  searchInput.addEventListener('input', function () {
    state.query = searchInput.value.trim().toLocaleLowerCase('tr');
    renderTable();
  });

  viewButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      state.view = button.dataset.view;
      viewButtons.forEach(function (item) {
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
      searchInput.value = '';
      state.query = '';
      renderTable();
    });
  });

  renderAll();

  function loadRows() {
    try {
      const stored = JSON.parse(localStorage.getItem(ROWS_KEY) || 'null');
      return Array.isArray(stored) ? stored : seedRows.slice();
    } catch (error) {
      return seedRows.slice();
    }
  }

  function loadVolunteers() {
    try {
      const stored = JSON.parse(localStorage.getItem(VOLUNTEERS_KEY) || 'null');
      return Array.isArray(stored) && stored.length ? stored : defaultVolunteers.slice();
    } catch (error) {
      return defaultVolunteers.slice();
    }
  }

  function saveRows() {
    localStorage.setItem(ROWS_KEY, JSON.stringify(state.rows));
  }

  function saveVolunteers() {
    localStorage.setItem(VOLUNTEERS_KEY, JSON.stringify(state.volunteers));
  }

  function renderVolunteerOptions(selected) {
    const current = selected || volunteerSelect.value || defaultVolunteers[0];
    volunteerSelect.innerHTML = state.volunteers.map(function (name) {
      return `<option${name === current ? ' selected' : ''}>${escapeHtml(name)}</option>`;
    }).join('') + '<option value="__new__">Listede yokum / adımı ekle</option>';
  }

  function updateWorkOptions() {
    const options = workTypes[areaSelect.value] || workTypes['Diğer'];
    workSelect.innerHTML = options.map(function (name) {
      return `<option>${escapeHtml(name)}</option>`;
    }).join('');
  }

  function updateConditionalFields() {
    const needsVolunteer = volunteerSelect.value === '__new__';
    newVolunteerRow.hidden = !needsVolunteer;
    form.elements.yeniGonullu.required = needsVolunteer;

    const needsWorkDescription = requiresWorkDescription(areaSelect.value, workSelect.value);
    otherWorkRow.hidden = !needsWorkDescription;
    form.elements.yapilanIs.required = needsWorkDescription;

    archiveFields.hidden = !usesArchiveFields(areaSelect.value);
    areaNote.textContent = areaNotes[areaSelect.value] || '';
    amountLabel.textContent = amountLabelFor(areaSelect.value);
  }

  function resolveVolunteerName(data) {
    if (data.gonullu === '__new__') {
      return String(data.yeniGonullu || '').trim();
    }
    return String(data.gonullu || '').trim();
  }

  function rememberVolunteer(name) {
    if (!state.volunteers.some(function (item) {
      return item.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr');
    })) {
      state.volunteers.push(name);
      state.volunteers.sort(function (a, b) {
        return a.localeCompare(b, 'tr');
      });
      saveVolunteers();
      renderVolunteerOptions(name);
    }
  }

  function requiresWorkDescription(area, type) {
    return area === 'Diğer' || type === 'Diğer';
  }

  function usesArchiveFields(area) {
    return area === 'Sayısallaştırma' || area === 'Kütüphane taşınması' || area === 'Kronoloji';
  }

  function amountLabelFor(area) {
    if (area === 'Sayısallaştırma') return 'Sayfa / adet';
    if (area === 'Kütüphane taşınması') return 'Kitap / raf / adet';
    if (area === 'Proje geliştirme') return 'Saat / çıktı / adet';
    if (area === 'Eğitim / toplantı') return 'Saat / oturum';
    return 'Miktar / adet';
  }

  function showMessage(message) {
    const target = document.getElementById('formMesaj');
    target.textContent = message;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(function () {
      target.textContent = '';
    }, 3600);
  }

  function renderAll() {
    renderSummary();
    renderToday();
    renderTable();
  }

  function renderSummary() {
    const totalAmount = state.rows.reduce(function (sum, row) {
      return sum + Number(row.miktar || 0);
    }, 0);
    const areas = new Set(state.rows.map(function (row) {
      return row.calismaAlani;
    }));
    const waiting = state.rows.filter(function (row) {
      return row.durum === 'Kontrol bekliyor' || row.durum === 'Takip gerekiyor';
    }).length;
    const volunteers = new Set(state.rows.map(function (row) {
      return row.gonullu;
    }));

    document.getElementById('toplamSayfa').textContent = formatNumber(totalAmount);
    document.getElementById('alanSayisi').textContent = formatNumber(areas.size);
    document.getElementById('kontrolBekleyen').textContent = formatNumber(waiting);
    document.getElementById('gonulluSayisi').textContent = formatNumber(volunteers.size);
  }

  function renderToday() {
    const target = document.getElementById('bugunkuIsler');
    const recentRows = state.rows.slice(0, 5);

    if (!recentRows.length) {
      target.innerHTML = '<p class="form-note">Henüz demo kaydı yok.</p>';
      return;
    }

    target.innerHTML = recentRows.map(function (row) {
      return `
        <div class="today-item">
          <div>
            <b>${escapeHtml(row.gonullu)}</b>
            <span>${escapeHtml(row.calismaAlani)} · ${escapeHtml(displayWork(row))}${escapeHtml(displayPlace(row, ' · '))}</span>
          </div>
          <em>${formatNumber(row.miktar)} ${escapeHtml(unitFor(row))}</em>
        </div>
      `;
    }).join('');
  }

  function renderTable() {
    const config = tableConfig(state.view);
    document.getElementById('viewKicker').textContent = config.kicker;
    document.getElementById('viewTitle').textContent = config.title;
    document.getElementById('tabloBaslik').innerHTML = `<tr>${config.columns.map(function (column) {
      return `<th>${escapeHtml(column.label)}</th>`;
    }).join('')}</tr>`;

    const rows = config.rows().filter(matchesQuery);
    document.getElementById('tabloGövde').innerHTML = rows.map(function (row) {
      return `<tr>${config.columns.map(function (column) {
        return `<td>${column.render(row)}</td>`;
      }).join('')}</tr>`;
    }).join('') || `<tr><td colspan="${config.columns.length}">Bu aramayla eşleşen kayıt yok.</td></tr>`;
  }

  function tableConfig(view) {
    if (view === 'alanlar') {
      return {
        kicker: 'Koordinatör görünümü',
        title: 'İş alanları',
        rows: areaRows,
        columns: [
          { label: 'Çalışma alanı', render: function (row) { return `<strong>${escapeHtml(row.alan)}</strong>`; } },
          { label: 'Kayıt', render: function (row) { return formatNumber(row.kayit); } },
          { label: 'Miktar', render: function (row) { return `${formatNumber(row.miktar)} ${escapeHtml(row.birim)}`; } },
          { label: 'Gönüllüler', render: function (row) { return escapeHtml(row.gonulluler); } },
          { label: 'Son işlem', render: function (row) { return escapeHtml(row.sonTarih); } }
        ]
      };
    }

    if (view === 'kutular') {
      return {
        kicker: 'Sayısallaştırma ve kütüphane görünümü',
        title: 'Kutular / raflar',
        rows: placeRows,
        columns: [
          { label: 'Bağlantı', render: function (row) { return `<strong>${escapeHtml(row.yer)}</strong>`; } },
          { label: 'Alan', render: function (row) { return escapeHtml(row.alan); } },
          { label: 'Toplam', render: function (row) { return `${formatNumber(row.miktar)} ${escapeHtml(row.birim)}`; } },
          { label: 'Son işlem', render: function (row) { return escapeHtml(row.sonTarih); } },
          { label: 'Gönüllüler', render: function (row) { return escapeHtml(row.gonulluler); } },
          { label: 'Durum', render: function (row) { return statusPill(row.durum); } }
        ]
      };
    }

    if (view === 'takip') {
      return {
        kicker: 'Takip görünümü',
        title: 'Takip bekleyenler',
        rows: function () {
          return state.rows.filter(function (row) {
            return row.durum === 'Kontrol bekliyor' || row.durum === 'Takip gerekiyor' || row.not;
          });
        },
        columns: baseColumns().concat([
          { label: 'Yapılan iş / not', render: function (row) { return escapeHtml(row.yapilanIs || row.not || 'Takip notu bekleniyor'); } }
        ])
      };
    }

    if (view === 'atom') {
      return {
        kicker: 'Aktarım önizlemesi',
        title: 'AtoM aktarımı',
        rows: atomRows,
        columns: [
          { label: 'Referans kodu', render: function (row) { return `<strong>${escapeHtml(row.referans)}</strong>`; } },
          { label: 'Üst kayıt', render: function (row) { return escapeHtml(row.ust); } },
          { label: 'Başlık', render: function (row) { return escapeHtml(row.baslik); } },
          { label: 'Tarih', render: function (row) { return escapeHtml(row.tarih); } },
          { label: 'Dijital nesne', render: function (row) { return escapeHtml(row.nesne); } },
          { label: 'Durum', render: function (row) { return statusPill(row.durum); } }
        ]
      };
    }

    return {
      kicker: 'Baserow görünümü',
      title: 'Çalışma kayıtları',
      rows: function () { return state.rows; },
      columns: baseColumns()
    };
  }

  function baseColumns() {
    return [
      { label: 'Tarih', render: function (row) { return escapeHtml(row.tarih); } },
      { label: 'Gönüllü', render: function (row) { return `<strong>${escapeHtml(row.gonullu)}</strong>`; } },
      { label: 'Alan', render: function (row) { return escapeHtml(row.calismaAlani); } },
      { label: 'İş türü', render: function (row) { return escapeHtml(displayWork(row)); } },
      { label: 'Bağlantı', render: function (row) { return escapeHtml(displayPlace(row) || 'Genel çalışma'); } },
      { label: 'Miktar', render: function (row) { return `${formatNumber(row.miktar)} ${escapeHtml(unitFor(row))}`; } },
      { label: 'Durum', render: function (row) { return statusPill(row.durum); } }
    ];
  }

  function areaRows() {
    const areas = new Map();
    state.rows.forEach(function (row) {
      if (!areas.has(row.calismaAlani)) {
        areas.set(row.calismaAlani, {
          alan: row.calismaAlani,
          kayit: 0,
          miktar: 0,
          birim: unitFor(row),
          sonTarih: row.tarih,
          gonulluSet: new Set()
        });
      }
      const area = areas.get(row.calismaAlani);
      area.kayit += 1;
      area.miktar += Number(row.miktar || 0);
      area.sonTarih = row.tarih > area.sonTarih ? row.tarih : area.sonTarih;
      area.gonulluSet.add(row.gonullu);
    });

    return Array.from(areas.values()).map(function (area) {
      return {
        alan: area.alan,
        kayit: area.kayit,
        miktar: area.miktar,
        birim: area.birim,
        sonTarih: area.sonTarih,
        gonulluler: Array.from(area.gonulluSet).join(', ')
      };
    });
  }

  function placeRows() {
    const places = new Map();
    state.rows.filter(function (row) {
      return row.fon || row.kutu || row.dosya || row.belge;
    }).forEach(function (row) {
      const key = displayPlace(row) || row.calismaAlani;
      if (!places.has(key)) {
        places.set(key, {
          yer: key,
          alanSet: new Set(),
          miktar: 0,
          birim: unitFor(row),
          sonTarih: row.tarih,
          gonulluSet: new Set(),
          durumSet: new Set()
        });
      }
      const place = places.get(key);
      place.alanSet.add(row.calismaAlani);
      place.miktar += Number(row.miktar || 0);
      place.sonTarih = row.tarih > place.sonTarih ? row.tarih : place.sonTarih;
      place.gonulluSet.add(row.gonullu);
      place.durumSet.add(row.durum);
    });

    return Array.from(places.values()).map(function (place) {
      return {
        yer: place.yer,
        alan: Array.from(place.alanSet).join(', '),
        miktar: place.miktar,
        birim: place.birim,
        sonTarih: place.sonTarih,
        gonulluler: Array.from(place.gonulluSet).join(', '),
        durum: combinedStatus(place.durumSet)
      };
    });
  }

  function atomRows() {
    return placeRows().filter(function (row) {
      return row.alan.includes('Sayısallaştırma');
    }).map(function (row) {
      const code = row.yer.replace(/\s+/g, '-').replace(/[^\wÇĞİÖŞÜçğıöşü/-]/g, '');
      return {
        referans: code,
        ust: 'Pertev Naili Boratav Arşivi',
        baslik: `${row.yer} sayısallaştırma grubu`,
        tarih: 'Tarih aralığı koordinatör tarafından doldurulacak',
        nesne: `${code}.pdf`,
        durum: row.durum === 'Takip gerekiyor' ? 'Kontrol bekliyor' : 'Aktarıma hazırlanıyor'
      };
    });
  }

  function matchesQuery(row) {
    if (!state.query) return true;
    return Object.values(row).join(' ').toLocaleLowerCase('tr').includes(state.query);
  }

  function combinedStatus(statusSet) {
    if (statusSet.has('Takip gerekiyor')) return 'Takip gerekiyor';
    if (statusSet.has('Kontrol bekliyor')) return 'Kontrol bekliyor';
    if (statusSet.has('Sürüyor')) return 'Sürüyor';
    if (statusSet.has('Kaydedildi')) return 'Kaydedildi';
    return 'Tamamlandı';
  }

  function displayWork(row) {
    if (row.isTuru === 'Diğer' && row.yapilanIs) return row.yapilanIs;
    return row.isTuru;
  }

  function displayPlace(row, prefix) {
    const parts = [];
    if (row.fon) parts.push(row.fon);
    if (row.kutu) parts.push(`Kutu ${row.kutu}`);
    if (row.dosya) parts.push(row.calismaAlani === 'Kütüphane taşınması' ? row.dosya : `Dosya ${row.dosya}`);
    if (row.belge) parts.push(row.calismaAlani === 'Kütüphane taşınması' ? row.belge : `Belge ${row.belge}`);
    const place = parts.join(' · ');
    return place && prefix ? `${prefix}${place}` : place;
  }

  function unitFor(row) {
    if (row.calismaAlani === 'Sayısallaştırma') return 'sayfa/adet';
    if (row.calismaAlani === 'Kütüphane taşınması') return 'kitap/raf/adet';
    if (row.calismaAlani === 'Eğitim / toplantı') return 'saat/oturum';
    if (row.calismaAlani === 'Proje geliştirme') return 'saat/çıktı/adet';
    return 'adet';
  }

  function statusPill(status) {
    const cls = status === 'Tamamlandı' ? 'done' : status === 'Takip gerekiyor' || status === 'Kontrol bekliyor' ? 'warn' : '';
    return `<span class="status-pill ${cls}">${escapeHtml(status)}</span>`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('tr-TR').format(Number(value || 0));
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
