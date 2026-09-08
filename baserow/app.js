(function () {
  const BASEROW_PUBLIC_ROWS_URL = 'https://smtp-pollution-lopez-constitutional.trycloudflare.com/api/database/views/grid/HQHoxHqRTd2PAPnssxeGkOVPjDyZjmA7y53qoxHSciE/public/rows/';
  let rows = [];

  const state = {
    view: 'kayitlar',
    query: '',
    loading: true,
    loadError: '',
    publicCount: 0
  };

  const searchInput = document.getElementById('arama');
  const viewButtons = Array.from(document.querySelectorAll('[data-view]'));
  const dataStatus = document.getElementById('veriDurumu');
  const syncStatus = document.getElementById('syncStatus');

  renderAll();
  loadRows();

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

  function renderAll() {
    renderSummary();
    renderTable();
  }

  async function loadRows() {
    state.loading = true;
    state.loadError = '';
    state.publicCount = 0;
    updateConnectionStatus('Baserow kontrol ediliyor', 'loading');
    renderAll();

    try {
      const response = await fetch(publicRowsUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`Baserow ${response.status}`);
      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];
      rows = results.map(mapBaserowRow);
      state.publicCount = Number(payload.count || rows.length);
      state.loading = false;
      updateConnectionStatus('Canlı veri', 'live');
      renderAll();
    } catch (error) {
      rows = [];
      state.loading = false;
      state.loadError = 'Baserow verisi okunamadı. Bu bilgisayarda yerel Baserow açık olmalı; gerçek kullanımda bu adres kurumun herkese açık Baserow adresiyle değiştirilecek.';
      updateConnectionStatus('Bağlantı yok', 'error');
      renderAll();
    }
  }

  function publicRowsUrl() {
    const url = new URL(BASEROW_PUBLIC_ROWS_URL);
    url.searchParams.set('size', '200');
    url.searchParams.set('_', String(Date.now()));
    return url.toString();
  }

  function updateConnectionStatus(label, mode) {
    if (dataStatus && mode !== 'error') {
      dataStatus.textContent = mode === 'live'
        ? 'Baserow’daki “GitHub’da göster” kayıtları canlı olarak okunuyor.'
        : 'Baserow bağlantısı kontrol ediliyor.';
    }
    if (!syncStatus) return;
    syncStatus.dataset.state = mode;
    const text = syncStatus.querySelector('span:last-child');
    if (text) text.textContent = label;
  }

  function mapBaserowRow(row) {
    return {
      gonullu: '',
      tarih: row.field_20 || '',
      calismaAlani: optionLabel(row.field_21) || 'Belirtilmedi',
      isTuru: optionLabels(row.field_22),
      yapilanIs: row.field_5 || '',
      fon: linkLabels(row.field_34),
      kutu: '',
      dosya: '',
      belge: '',
      miktar: Number(row.field_27 || 0),
      birim: optionLabel(row.field_28) || 'adet',
      cihaz: [],
      durum: optionLabels(row.field_30),
      not: row.field_5 || ''
    };
  }

  function renderSummary() {
    const totalAmount = rows.reduce(function (sum, row) {
      return sum + Number(row.miktar || 0);
    }, 0);
    const activeAreas = new Set(rows.map(function (row) { return row.calismaAlani; }));
    const waiting = rows.filter(function (row) {
      const statuses = toList(row.durum);
      return statuses.includes('Kontrol bekliyor') || statuses.includes('Takip gerekiyor');
    }).length;

    document.getElementById('toplamSayfa').textContent = formatNumber(totalAmount);
    document.getElementById('alanSayisi').textContent = formatNumber(activeAreas.size);
    document.getElementById('kontrolBekleyen').textContent = formatNumber(waiting);
    document.getElementById('gonulluSayisi').textContent = formatNumber(state.publicCount || rows.length);
  }

  function renderTable() {
    const config = tableConfig(state.view);
    document.getElementById('viewKicker').textContent = config.kicker;
    document.getElementById('viewTitle').textContent = config.title;
    document.getElementById('tabloBaslik').innerHTML = `<tr>${config.columns.map(function (column) {
      return `<th>${escapeHtml(column.label)}</th>`;
    }).join('')}</tr>`;

    if (state.loading) {
      document.getElementById('tabloGövde').innerHTML = `<tr><td colspan="${config.columns.length}">Baserow bağlantısı kontrol ediliyor.</td></tr>`;
      return;
    }

    if (state.loadError) {
      if (dataStatus) dataStatus.textContent = state.loadError;
      document.getElementById('tabloGövde').innerHTML = `<tr><td colspan="${config.columns.length}">Baserow verisi okunamadı.</td></tr>`;
      return;
    }

    const filteredRows = config.rows().filter(matchesQuery);
    document.getElementById('tabloGövde').innerHTML = filteredRows.map(function (row) {
      return `<tr>${config.columns.map(function (column) {
        return `<td>${column.render(row)}</td>`;
      }).join('')}</tr>`;
    }).join('') || `<tr><td colspan="${config.columns.length}">GitHub’da göster işaretli kayıt yok.</td></tr>`;
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
          { label: 'Durum', render: function (row) { return statusPills(row.durum); } }
        ]
      };
    }

    if (view === 'takip') {
      return {
        kicker: 'Takip görünümü',
        title: 'Takip bekleyenler',
        rows: function () {
          return rows.filter(function (row) {
            const statuses = toList(row.durum);
            return statuses.includes('Kontrol bekliyor') || statuses.includes('Takip gerekiyor') || row.not;
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
          { label: 'Durum', render: function (row) { return statusPills(row.durum); } }
        ]
      };
    }

    return {
      kicker: 'Baserow’dan okunacak görünüm',
      title: 'Çalışma kayıtları',
      rows: function () { return rows; },
      columns: baseColumns()
    };
  }

  function baseColumns() {
    return [
      { label: 'Tarih', render: function (row) { return escapeHtml(row.tarih); } },
      { label: 'Alan', render: function (row) { return escapeHtml(row.calismaAlani); } },
      { label: 'İş türü', render: function (row) { return escapeHtml(displayWork(row)); } },
      { label: 'Bağlantı', render: function (row) { return escapeHtml(displayPlace(row) || 'Genel çalışma'); } },
      { label: 'Miktar', render: function (row) { return `${formatNumber(row.miktar)} ${escapeHtml(unitFor(row))}`; } },
      { label: 'Durum', render: function (row) { return statusPills(row.durum); } }
    ];
  }

  function areaRows() {
    const grouped = new Map();
    rows.forEach(function (row) {
      if (!grouped.has(row.calismaAlani)) {
        grouped.set(row.calismaAlani, {
          alan: row.calismaAlani,
          kayit: 0,
          miktar: 0,
          birim: unitFor(row),
          sonTarih: row.tarih,
          gonulluSet: new Set()
        });
      }
      const group = grouped.get(row.calismaAlani);
      group.kayit += 1;
      group.miktar += Number(row.miktar || 0);
      group.sonTarih = row.tarih > group.sonTarih ? row.tarih : group.sonTarih;
      group.gonulluSet.add(row.gonullu);
    });

    return Array.from(grouped.values()).map(function (group) {
      return {
        alan: group.alan,
        kayit: group.kayit,
        miktar: group.miktar,
        birim: group.birim,
        sonTarih: group.sonTarih,
        gonulluler: Array.from(group.gonulluSet).join(', ')
      };
    });
  }

  function placeRows() {
    const grouped = new Map();
    rows.filter(function (row) {
      return row.fon.length || row.kutu || row.dosya || row.belge;
    }).forEach(function (row) {
      const key = displayPlace(row) || row.calismaAlani;
      if (!grouped.has(key)) {
        grouped.set(key, {
          yer: key,
          alanSet: new Set(),
          miktar: 0,
          birim: unitFor(row),
          sonTarih: row.tarih,
          gonulluSet: new Set(),
          durumSet: new Set()
        });
      }
      const group = grouped.get(key);
      group.alanSet.add(row.calismaAlani);
      group.miktar += Number(row.miktar || 0);
      group.sonTarih = row.tarih > group.sonTarih ? row.tarih : group.sonTarih;
      group.gonulluSet.add(row.gonullu);
      toList(row.durum).forEach(function (status) {
        group.durumSet.add(status);
      });
    });

    return Array.from(grouped.values()).map(function (group) {
      return {
        yer: group.yer,
        alan: Array.from(group.alanSet).join(', '),
        miktar: group.miktar,
        birim: group.birim,
        sonTarih: group.sonTarih,
        gonulluler: Array.from(group.gonulluSet).join(', '),
        durum: combinedStatus(group.durumSet)
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
        durum: toList(row.durum).includes('Takip gerekiyor') ? 'Kontrol bekliyor' : 'Aktarıma hazırlanıyor'
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
    const labels = toList(row.isTuru).filter(function (item) {
      return item !== 'Diğer';
    });
    if (toList(row.isTuru).includes('Diğer') && row.yapilanIs) labels.push(row.yapilanIs);
    return labels.join(', ') || row.yapilanIs || '';
  }

  function displayPlace(row, prefix) {
    const parts = [];
    toList(row.fon).forEach(function (fund) {
      if (fund) parts.push(fund);
    });
    if (row.kutu) parts.push(`Kutu ${row.kutu}`);
    if (row.dosya) parts.push(row.calismaAlani === 'Kütüphane taşınması' ? row.dosya : `Dosya ${row.dosya}`);
    if (row.belge) parts.push(row.calismaAlani === 'Kütüphane taşınması' ? row.belge : `Belge ${row.belge}`);
    const place = parts.join(' · ');
    return place && prefix ? `${prefix}${place}` : place;
  }

  function unitFor(row) {
    if (row.birim) return row.birim;
    if (row.calismaAlani === 'Sayısallaştırma') return 'sayfa/adet';
    if (row.calismaAlani === 'Kütüphane taşınması') return 'kitap/raf/adet';
    if (row.calismaAlani === 'Eğitim / toplantı') return 'saat/oturum';
    if (row.calismaAlani === 'Proje geliştirme') return 'saat/çıktı/adet';
    return 'adet';
  }

  function statusPills(status) {
    return toList(status).map(statusPill).join(' ');
  }

  function statusPill(status) {
    const cls = status === 'Tamamlandı' ? 'done' : status === 'Takip gerekiyor' || status === 'Kontrol bekliyor' ? 'warn' : '';
    return `<span class="status-pill ${cls}">${escapeHtml(status)}</span>`;
  }

  function toList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value == null || value === '') return [];
    return [String(value)];
  }

  function optionLabel(value) {
    if (!value) return '';
    if (typeof value === 'object' && value.value) return value.value;
    return String(value);
  }

  function optionLabels(value) {
    return toList(value).map(optionLabel).filter(Boolean);
  }

  function linkLabels(value) {
    return toList(value).map(function (item) {
      if (!item) return '';
      if (item.value) return item.value;
      if (item.name) return item.name;
      if (item.primary_value) return item.primary_value;
      return String(item);
    }).filter(Boolean);
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
