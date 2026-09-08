(function () {
  const STORAGE_KEY = 'tvf-baserow-demo-v1';

  const seedRows = [
    {
      id: 1,
      gonullu: 'Berfin Yazıcı',
      tarih: '2026-09-08',
      isTuru: 'Tarama',
      fon: 'PNB',
      kutu: '34',
      dosya: '12',
      belge: '1',
      sayfa: 48,
      tarayici: 'Viisan A3 Flat',
      durum: 'Kontrol bekliyor',
      not: 'Dosya sonu kontrol edilecek'
    },
    {
      id: 2,
      gonullu: 'Anıl Olcan',
      tarih: '2026-09-08',
      isTuru: 'Kodlama',
      fon: 'PNB',
      kutu: '40',
      dosya: '3',
      belge: '2',
      sayfa: 36,
      tarayici: 'Bookeye',
      durum: 'Sürüyor',
      not: 'Belge tarihi netleştirilecek'
    },
    {
      id: 3,
      gonullu: 'Özden Özütemiz',
      tarih: '2026-09-07',
      isTuru: 'Kontrol',
      fon: 'PNB',
      kutu: '44',
      dosya: '8',
      belge: '4',
      sayfa: 22,
      tarayici: 'Viisan S21',
      durum: 'Sorun var',
      not: 'İki sayfada tekrar tarama gerekli'
    },
    {
      id: 4,
      gonullu: 'Sibel Dağ',
      tarih: '2026-09-06',
      isTuru: 'Tarama',
      fon: 'PNB',
      kutu: '68',
      dosya: '3',
      belge: '6',
      sayfa: 64,
      tarayici: 'Viisan S21',
      durum: 'Kontrol bekliyor',
      not: 'Kod çakışması kontrol edilecek'
    }
  ];

  const state = {
    rows: loadRows(),
    view: 'taramalar',
    query: ''
  };

  const form = document.getElementById('taramaForm');
  const resetButton = document.getElementById('demoSifirla');
  const searchInput = document.getElementById('arama');
  const viewButtons = Array.from(document.querySelectorAll('[data-view]'));

  const today = new Date().toISOString().slice(0, 10);
  form.elements.tarih.value = today;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const row = {
      id: Date.now(),
      gonullu: data.gonullu,
      tarih: data.tarih,
      isTuru: data.isTuru,
      fon: data.fon,
      kutu: String(data.kutu || '').trim(),
      dosya: String(data.dosya || '').trim(),
      belge: String(data.belge || '').trim(),
      sayfa: Number(data.sayfa || 0),
      tarayici: data.tarayici,
      durum: data.durum,
      not: String(data.not || '').trim()
    };
    state.rows.unshift(row);
    saveRows();
    form.elements.not.value = '';
    showMessage('Demo kaydı eklendi. Bu kayıt yalnızca bu tarayıcıda tutulur.');
    renderAll();
  });

  resetButton.addEventListener('click', function () {
    state.rows = seedRows.slice();
    saveRows();
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
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return Array.isArray(stored) ? stored : seedRows.slice();
    } catch (error) {
      return seedRows.slice();
    }
  }

  function saveRows() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rows));
  }

  function showMessage(message) {
    const target = document.getElementById('formMesaj');
    target.textContent = message;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(function () {
      target.textContent = '';
    }, 3200);
  }

  function renderAll() {
    renderSummary();
    renderToday();
    renderTable();
  }

  function renderSummary() {
    const totalPages = state.rows.reduce(function (sum, row) {
      return sum + Number(row.sayfa || 0);
    }, 0);
    const boxes = new Set(state.rows.map(function (row) {
      return `${row.fon}-${row.kutu}`;
    }));
    const waiting = state.rows.filter(function (row) {
      return row.durum === 'Kontrol bekliyor' || row.durum === 'Sorun var';
    }).length;
    const volunteers = new Set(state.rows.map(function (row) {
      return row.gonullu;
    }));

    document.getElementById('toplamSayfa').textContent = formatNumber(totalPages);
    document.getElementById('aktifKutu').textContent = formatNumber(boxes.size);
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
            <span>${escapeHtml(row.isTuru)} · ${escapeHtml(row.fon)} ${escapeHtml(row.kutu)} / Dosya ${escapeHtml(row.dosya)}</span>
          </div>
          <em>${formatNumber(row.sayfa)} sayfa</em>
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
    if (view === 'kutular') {
      return {
        kicker: 'Koordinatör görünümü',
        title: 'Kutular',
        rows: boxRows,
        columns: [
          { label: 'Kutu', render: function (row) { return `<strong>${escapeHtml(row.kutu)}</strong>`; } },
          { label: 'Toplam', render: function (row) { return `${formatNumber(row.sayfa)} sayfa/adet`; } },
          { label: 'Son işlem', render: function (row) { return escapeHtml(row.sonTarih); } },
          { label: 'Gönüllüler', render: function (row) { return escapeHtml(row.gonulluler); } },
          { label: 'Durum', render: function (row) { return statusPill(row.durum); } }
        ]
      };
    }

    if (view === 'kontrol') {
      return {
        kicker: 'Kalite kontrol görünümü',
        title: 'Kontrol bekleyenler',
        rows: function () {
          return state.rows.filter(function (row) {
            return row.durum === 'Kontrol bekliyor' || row.durum === 'Sorun var';
          });
        },
        columns: baseColumns().concat([
          { label: 'Sorun / not', render: function (row) { return escapeHtml(row.not || 'Kontrol notu bekleniyor'); } }
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
      title: 'Taramalar',
      rows: function () { return state.rows; },
      columns: baseColumns()
    };
  }

  function baseColumns() {
    return [
      { label: 'Tarih', render: function (row) { return escapeHtml(row.tarih); } },
      { label: 'Gönüllü', render: function (row) { return `<strong>${escapeHtml(row.gonullu)}</strong>`; } },
      { label: 'İş türü', render: function (row) { return escapeHtml(row.isTuru); } },
      { label: 'Yer', render: function (row) { return `${escapeHtml(row.fon)} ${escapeHtml(row.kutu)} · Dosya ${escapeHtml(row.dosya)}`; } },
      { label: 'Sayfa', render: function (row) { return formatNumber(row.sayfa); } },
      { label: 'Durum', render: function (row) { return statusPill(row.durum); } }
    ];
  }

  function boxRows() {
    const boxes = new Map();
    state.rows.forEach(function (row) {
      const key = `${row.fon} ${row.kutu}`;
      if (!boxes.has(key)) {
        boxes.set(key, {
          kutu: key,
          sayfa: 0,
          sonTarih: row.tarih,
          gonulluSet: new Set(),
          durumSet: new Set()
        });
      }
      const box = boxes.get(key);
      box.sayfa += Number(row.sayfa || 0);
      box.sonTarih = row.tarih > box.sonTarih ? row.tarih : box.sonTarih;
      box.gonulluSet.add(row.gonullu);
      box.durumSet.add(row.durum);
    });

    return Array.from(boxes.values()).map(function (box) {
      return {
        kutu: box.kutu,
        sayfa: box.sayfa,
        sonTarih: box.sonTarih,
        gonulluler: Array.from(box.gonulluSet).join(', '),
        durum: box.durumSet.has('Sorun var') ? 'Sorun var' : box.durumSet.has('Kontrol bekliyor') ? 'Kontrol bekliyor' : 'Sürüyor'
      };
    });
  }

  function atomRows() {
    return boxRows().map(function (box) {
      const code = box.kutu.replace(/\s+/g, '-');
      return {
        referans: code,
        ust: 'Pertev Naili Boratav Arşivi',
        baslik: `${box.kutu} sayısallaştırma grubu`,
        tarih: 'Tarih aralığı koordinatör tarafından doldurulacak',
        nesne: `${code}.pdf`,
        durum: box.durum === 'Sorun var' ? 'Kontrol bekliyor' : 'Aktarıma hazırlanıyor'
      };
    });
  }

  function matchesQuery(row) {
    if (!state.query) return true;
    return Object.values(row).join(' ').toLocaleLowerCase('tr').includes(state.query);
  }

  function statusPill(status) {
    const cls = status === 'Tamamlandı' ? 'done' : status === 'Sorun var' ? 'issue' : 'warn';
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
