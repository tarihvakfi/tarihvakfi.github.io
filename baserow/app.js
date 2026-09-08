(function () {
  const rows = [
    {
      gonullu: 'Berfin Yazıcı',
      tarih: '2026-09-08',
      calismaAlani: 'Sayısallaştırma',
      isTuru: ['Tarama', 'Kontrol'],
      yapilanIs: '',
      fon: ['PNB'],
      kutu: '34',
      dosya: '12',
      belge: '1',
      miktar: 48,
      cihaz: ['Viisan A3', 'Bilgisayar'],
      durum: ['Kaydedildi', 'Kontrol bekliyor'],
      not: 'Dosya sonu kontrol edilecek'
    },
    {
      gonullu: 'Anıl Olcan',
      tarih: '2026-09-08',
      calismaAlani: 'Sayısallaştırma',
      isTuru: ['Kodlama', 'Kataloglama'],
      yapilanIs: '',
      fon: ['PNB'],
      kutu: '40',
      dosya: '3',
      belge: '2',
      miktar: 36,
      cihaz: ['Bookeye', 'Bilgisayar'],
      durum: ['Sürüyor'],
      not: 'Belge tarihi netleştirilecek'
    },
    {
      gonullu: 'Özden Özütemiz',
      tarih: '2026-09-07',
      calismaAlani: 'Kütüphane taşınması',
      isTuru: ['Raf sayımı', 'Kutu hazırlama'],
      yapilanIs: '',
      fon: ['Kütüphane'],
      kutu: '',
      dosya: 'Raf B-12',
      belge: 'Sıra 3',
      miktar: 84,
      cihaz: ['Raf'],
      durum: ['Takip gerekiyor'],
      not: 'Sayım onayı bekliyor'
    },
    {
      gonullu: 'Sibel Dağ',
      tarih: '2026-09-06',
      calismaAlani: 'Sayısallaştırma',
      isTuru: ['Kontrol'],
      yapilanIs: '',
      fon: ['PNB'],
      kutu: '68',
      dosya: '3',
      belge: '6',
      miktar: 64,
      cihaz: ['Viisan S21'],
      durum: ['Kontrol bekliyor'],
      not: 'Kod çakışması kontrol edilecek'
    },
    {
      gonullu: 'Arif Solmaz',
      tarih: '2026-09-05',
      calismaAlani: 'Web sitesi',
      isTuru: ['Veri kontrolü', 'Yayın'],
      yapilanIs: '',
      fon: [],
      kutu: '',
      dosya: '',
      belge: '',
      miktar: 1,
      cihaz: ['Web sitesi', 'Bilgisayar'],
      durum: ['Tamamlandı'],
      not: 'Kamuya açık dashboard verileri kontrol edildi'
    },
    {
      gonullu: 'Berfin Yazıcı',
      tarih: '2026-09-04',
      calismaAlani: 'Proje geliştirme',
      isTuru: ['Diğer'],
      yapilanIs: 'Arşiv projesi için örnek çıktı ve ihtiyaç listesi hazırlandı',
      fon: [],
      kutu: '',
      dosya: '',
      belge: '',
      miktar: 2,
      cihaz: ['Bilgisayar'],
      durum: ['Kaydedildi'],
      not: 'Diğer seçeneğiyle gerçek iş açıklaması tutuldu'
    }
  ];

  const state = {
    view: 'kayitlar',
    query: ''
  };

  const searchInput = document.getElementById('arama');
  const viewButtons = Array.from(document.querySelectorAll('[data-view]'));

  renderAll();

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

  function renderSummary() {
    const totalAmount = rows.reduce(function (sum, row) {
      return sum + Number(row.miktar || 0);
    }, 0);
    const activeAreas = new Set(rows.map(function (row) { return row.calismaAlani; }));
    const waiting = rows.filter(function (row) {
      const statuses = toList(row.durum);
      return statuses.includes('Kontrol bekliyor') || statuses.includes('Takip gerekiyor');
    }).length;
    const volunteers = new Set(rows.map(function (row) { return row.gonullu; }));

    document.getElementById('toplamSayfa').textContent = formatNumber(totalAmount);
    document.getElementById('alanSayisi').textContent = formatNumber(activeAreas.size);
    document.getElementById('kontrolBekleyen').textContent = formatNumber(waiting);
    document.getElementById('gonulluSayisi').textContent = formatNumber(volunteers.size);
  }

  function renderTable() {
    const config = tableConfig(state.view);
    document.getElementById('viewKicker').textContent = config.kicker;
    document.getElementById('viewTitle').textContent = config.title;
    document.getElementById('tabloBaslik').innerHTML = `<tr>${config.columns.map(function (column) {
      return `<th>${escapeHtml(column.label)}</th>`;
    }).join('')}</tr>`;

    const filteredRows = config.rows().filter(matchesQuery);
    document.getElementById('tabloGövde').innerHTML = filteredRows.map(function (row) {
      return `<tr>${config.columns.map(function (column) {
        return `<td>${column.render(row)}</td>`;
      }).join('')}</tr>`;
    }).join('') || `<tr><td colspan="${config.columns.length}">Bu aramayla eşleşen örnek kayıt yok.</td></tr>`;
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
      { label: 'Gönüllü', render: function (row) { return `<strong>${escapeHtml(row.gonullu)}</strong>`; } },
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
