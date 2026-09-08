(function () {
  const ROWS_KEY = 'tvf-baserow-demo-v4';
  const VOLUNTEERS_KEY = 'tvf-baserow-volunteers-v2';

  const defaultVolunteers = [
    'Berfin Yazıcı',
    'Anıl Olcan',
    'Özden Özütemiz',
    'Sibel Dağ',
    'Arif Solmaz'
  ];

  const workTypes = {
    'Sayısallaştırma': ['Tarama', 'Kodlama', 'Kontrol', 'Kataloglama', 'PDF/JPEG', 'Diğer'],
    'Kütüphane taşınması': ['Raf sayımı', 'Kitap envanteri', 'Kutu hazırlama', 'Künye kontrolü', 'Taşıma kararı', 'Diğer'],
    'Proje geliştirme': ['Proje fikri', 'Başvuru metni', 'Bütçe', 'Ortak görüşmesi', 'Raporlama', 'Diğer'],
    'Web sitesi': ['İçerik', 'Veri kontrolü', 'Tasarım', 'Yayın', 'Hata düzeltme', 'Diğer'],
    'Kronoloji': ['Olay girişi', 'Kaynak kontrolü', 'Düzeltme', 'Görsel kontrol', 'Diğer'],
    'Koordinasyon': ['Haftalık plan', 'Gönüllü iletişimi', 'İş bölümü', 'Toplantı', 'Diğer'],
    'Eğitim / toplantı': ['Oryantasyon', 'Eğitim', 'Değerlendirme', 'Toplantı', 'Diğer'],
    'Diğer': ['Diğer']
  };

  const deviceOptions = {
    'Sayısallaştırma': ['Bookeye', 'Viisan S21', 'Viisan A3', 'Canon', 'Bilgisayar', 'Diğer'],
    'Kütüphane taşınması': ['Raf', 'Telefon', 'Bilgisayar', 'Toplantı', 'Diğer'],
    'Proje geliştirme': ['Bilgisayar', 'Toplantı', 'Telefon', 'Diğer'],
    'Web sitesi': ['Bilgisayar', 'Web sitesi', 'Telefon', 'Diğer'],
    'Kronoloji': ['Bilgisayar', 'Web sitesi', 'Kaynak', 'Diğer'],
    'Koordinasyon': ['Toplantı', 'Telefon', 'Bilgisayar', 'Diğer'],
    'Eğitim / toplantı': ['Toplantı', 'Bilgisayar', 'Diğer'],
    'Diğer': ['Bilgisayar', 'Toplantı', 'Diğer']
  };

  const fonds = ['PNB', 'NSS Harita', 'Kütüphane', 'Genel arşiv', 'Diğer'];
  const statuses = ['Kaydedildi', 'Sürüyor', 'Kontrol bekliyor', 'Takip gerekiyor', 'Tamamlandı'];
  const multipleChoiceNames = new Set(['isTuru', 'fon', 'cihaz', 'durum']);

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
      isTuru: ['Tarama', 'Kontrol'],
      yapilanIs: '',
      fon: 'PNB',
      kutu: '34',
      dosya: '12',
      belge: '1',
      miktar: 48,
      cihaz: ['Viisan A3', 'Bilgisayar'],
      durum: ['Kaydedildi', 'Kontrol bekliyor'],
      not: 'Dosya sonu kontrol edilecek'
    },
    {
      id: 2,
      gonullu: 'Anıl Olcan',
      tarih: '2026-09-08',
      calismaAlani: 'Sayısallaştırma',
      isTuru: ['Kodlama', 'Kataloglama'],
      yapilanIs: '',
      fon: 'PNB',
      kutu: '40',
      dosya: '3',
      belge: '2',
      miktar: 36,
      cihaz: ['Bookeye', 'Bilgisayar'],
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
      cihaz: 'Raf',
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
    query: '',
    editingId: null
  };

  const form = document.getElementById('calismaForm');
  const clearButton = document.getElementById('formuTemizle');
  const resetButton = document.getElementById('ornekleriYenile');
  const saveButton = document.getElementById('kayitButonu');
  const formTitle = document.getElementById('formBaslik');
  const searchInput = document.getElementById('arama');
  const viewButtons = Array.from(document.querySelectorAll('[data-view]'));
  const volunteerSelect = form.elements.gonullu;
  const areaSelect = form.elements.calismaAlani;
  const newVolunteerRow = document.getElementById('yeniGonulluSatiri');
  const otherWorkRow = document.getElementById('digerIsSatiri');
  const archiveFields = document.getElementById('arsivAlanlari');
  const generalAmountRow = document.getElementById('genelMiktarSatiri');
  const areaNote = document.getElementById('alanNotu');
  const amountLabel = document.getElementById('miktarEtiketi');
  const generalAmountLabel = document.getElementById('genelMiktarEtiketi');

  const choiceTargets = {
    isTuru: document.getElementById('isTuruSecenekleri'),
    fon: document.getElementById('fonSecenekleri'),
    cihaz: document.getElementById('cihazSecenekleri'),
    durum: document.getElementById('durumSecenekleri')
  };

  form.elements.tarih.value = new Date().toISOString().slice(0, 10);
  renderVolunteerOptions();
  renderAllChoices();
  setChoice('fon', 'PNB');
  setChoice('durum', 'Kaydedildi');
  renderDependentChoices();
  updateConditionalFields();
  renderAll();

  volunteerSelect.addEventListener('change', updateConditionalFields);
  areaSelect.addEventListener('change', renderDependentChoices);
  clearButton.addEventListener('click', clearForm);
  if (resetButton) resetButton.addEventListener('click', resetDemo);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const row = collectFormRow();
    if (!row) return;

    if (state.editingId) {
      const index = state.rows.findIndex(function (item) { return item.id === state.editingId; });
      if (index >= 0) state.rows[index] = Object.assign({}, row, { id: state.editingId });
      showMessage('Değişiklikler kaydedildi.');
    } else {
      state.rows.unshift(Object.assign({}, row, { id: Date.now() }));
      showMessage('Kayıt gönderildi.');
    }

    rememberVolunteer(row.gonullu);
    saveRows();
    clearForm({ keepMessage: true });
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

  document.getElementById('kaydedilenKayitlar').addEventListener('click', function (event) {
    const action = event.target.dataset.action;
    const id = Number(event.target.dataset.id);
    if (!action || !id) return;
    if (action === 'edit') editRow(id);
    if (action === 'delete') deleteRow(id);
  });

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

  function renderAllChoices() {
    renderChoiceGroup('fon', fonds, 'PNB');
    renderChoiceGroup('durum', statuses, 'Kaydedildi');
  }

  function renderDependentChoices() {
    const area = areaSelect.value || 'Sayısallaştırma';
    renderChoiceGroup('isTuru', workTypes[area] || workTypes['Diğer'], getChoices('isTuru'));
    renderChoiceGroup('cihaz', deviceOptions[area] || deviceOptions['Diğer'], getChoices('cihaz'));
    updateConditionalFields();
  }

  function renderChoiceGroup(name, options, preferred) {
    const isMultiple = multipleChoiceNames.has(name);
    const selectedValues = toList(preferred).filter(function (value) {
      return options.includes(value);
    });
    if (!selectedValues.length && options[0]) selectedValues.push(options[0]);

    choiceTargets[name].innerHTML = options.map(function (option, index) {
      const id = `${name}-${index}-${slug(option)}`;
      const checked = selectedValues.includes(option);
      return `
        <label class="choice-tile${checked ? ' selected' : ''}" for="${id}">
          <input id="${id}" type="${isMultiple ? 'checkbox' : 'radio'}" name="${name}" value="${escapeHtml(option)}"${checked ? ' checked' : ''} />
          <span>${escapeHtml(option)}</span>
        </label>
      `;
    }).join('');

    Array.from(choiceTargets[name].querySelectorAll('input')).forEach(function (input) {
      input.addEventListener('change', function () {
        refreshChoiceGroup(name);
        updateConditionalFields();
      });
    });
  }

  function setChoice(name, value) {
    const values = toList(value);
    const isMultiple = multipleChoiceNames.has(name);
    Array.from(document.querySelectorAll(`input[name="${name}"]`)).forEach(function (input) {
      input.checked = isMultiple ? values.includes(input.value) : input.value === values[0];
    });
    refreshChoiceGroup(name);
  }

  function refreshChoiceGroup(name) {
    Array.from(document.querySelectorAll(`input[name="${name}"]`)).forEach(function (input) {
      const tile = input.closest('.choice-tile');
      if (tile) tile.classList.toggle('selected', input.checked);
    });
  }

  function getChoices(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(function (input) {
      return input.value;
    });
  }

  function getChoice(name) {
    const selected = getChoices(name);
    return selected[0] || '';
  }

  function renderVolunteerOptions(selected) {
    const current = selected || volunteerSelect.value || defaultVolunteers[0];
    volunteerSelect.innerHTML = state.volunteers.map(function (name) {
      return `<option${name === current ? ' selected' : ''}>${escapeHtml(name)}</option>`;
    }).join('') + '<option value="__new__">Listede yokum / adımı ekle</option>';
  }

  function updateConditionalFields() {
    const area = areaSelect.value || 'Sayısallaştırma';
    const workTypesSelected = getChoices('isTuru');
    const needsVolunteer = volunteerSelect.value === '__new__';
    const needsWorkDescription = area === 'Diğer' || workTypesSelected.includes('Diğer');
    const usesArchive = usesArchiveFields(area);

    newVolunteerRow.hidden = !needsVolunteer;
    form.elements.yeniGonullu.required = needsVolunteer;
    otherWorkRow.hidden = !needsWorkDescription;
    form.elements.yapilanIs.required = needsWorkDescription;
    archiveFields.hidden = !usesArchive;
    generalAmountRow.hidden = usesArchive;
    form.elements.miktar.disabled = !usesArchive;
    form.elements.genelMiktar.disabled = usesArchive;
    amountLabel.textContent = amountLabelFor(area);
    generalAmountLabel.textContent = amountLabelFor(area);
    areaNote.textContent = areaNotes[area] || '';
  }

  function collectFormRow() {
    const data = Object.fromEntries(new FormData(form).entries());
    const volunteerName = data.gonullu === '__new__' ? String(data.yeniGonullu || '').trim() : String(data.gonullu || '').trim();
    const area = areaSelect.value;
    const workType = getChoices('isTuru');
    const fundChoices = getChoices('fon');
    const deviceChoices = getChoices('cihaz');
    const statusChoices = getChoices('durum');
    const workDescription = String(data.yapilanIs || '').trim();
    const usesArchive = usesArchiveFields(area);

    if (!volunteerName) {
      showMessage('Ad soyad alanını doldurun.');
      form.elements.yeniGonullu.focus();
      return null;
    }

    if (!workType.length) {
      showMessage('En az bir iş türü seçin.');
      return null;
    }

    if (usesArchive && !fundChoices.length) {
      showMessage('En az bir fon seçin.');
      return null;
    }

    if (!deviceChoices.length) {
      showMessage('En az bir tarayıcı veya araç seçin.');
      return null;
    }

    if (!statusChoices.length) {
      showMessage('En az bir durum seçin.');
      return null;
    }

    if ((area === 'Diğer' || workType.includes('Diğer')) && !workDescription) {
      showMessage('Diğer seçildiğinde yapılan işi açıkça yazın.');
      form.elements.yapilanIs.focus();
      return null;
    }

    return {
      gonullu: volunteerName,
      tarih: data.tarih,
      calismaAlani: area,
      isTuru: workType,
      yapilanIs: workDescription,
      fon: usesArchive ? fundChoices : '',
      kutu: usesArchive ? String(data.kutu || '').trim() : '',
      dosya: usesArchive ? String(data.dosya || '').trim() : '',
      belge: usesArchive ? String(data.belge || '').trim() : '',
      miktar: Number(usesArchive ? data.miktar || 0 : data.genelMiktar || 0),
      cihaz: deviceChoices,
      durum: statusChoices,
      not: String(data.not || '').trim()
    };
  }

  function clearForm(options) {
    state.editingId = null;
    formTitle.textContent = 'Yeni çalışma kaydı';
    saveButton.textContent = 'Kaydı gönder';
    form.elements.tarih.value = new Date().toISOString().slice(0, 10);
    form.elements.gonullu.value = state.volunteers[0] || defaultVolunteers[0];
    form.elements.yeniGonullu.value = '';
    form.elements.yapilanIs.value = '';
    form.elements.kutu.value = '34';
    form.elements.dosya.value = '12';
    form.elements.belge.value = '1';
    form.elements.miktar.value = '48';
    form.elements.genelMiktar.value = '1';
    form.elements.not.value = '';
    areaSelect.value = 'Sayısallaştırma';
    renderDependentChoices();
    setChoice('fon', 'PNB');
    setChoice('durum', 'Kaydedildi');
    if (!options || !options.keepMessage) showMessage('Form temizlendi.');
  }

  function resetDemo() {
    state.rows = seedRows.slice();
    state.volunteers = defaultVolunteers.slice();
    state.editingId = null;
    saveRows();
    saveVolunteers();
    renderVolunteerOptions();
    clearForm({ keepMessage: true });
    showMessage('Örnek kayıtlar yenilendi.');
    renderAll();
  }

  function editRow(id) {
    const row = state.rows.find(function (item) { return item.id === id; });
    if (!row) return;
    state.editingId = id;
    formTitle.textContent = 'Çalışma kaydını düzenle';
    saveButton.textContent = 'Değişiklikleri kaydet';
    rememberVolunteer(row.gonullu);
    volunteerSelect.value = row.gonullu;
    form.elements.tarih.value = row.tarih;
    form.elements.yeniGonullu.value = '';
    form.elements.yapilanIs.value = row.yapilanIs || '';
    form.elements.kutu.value = row.kutu || '';
    form.elements.dosya.value = row.dosya || '';
    form.elements.belge.value = row.belge || '';
    form.elements.miktar.value = row.miktar || 0;
    form.elements.genelMiktar.value = row.miktar || 0;
    form.elements.not.value = row.not || '';
    areaSelect.value = row.calismaAlani || 'Sayısallaştırma';
    renderDependentChoices();
    setChoice('isTuru', row.isTuru);
    setChoice('fon', row.fon || 'PNB');
    setChoice('cihaz', row.cihaz);
    setChoice('durum', row.durum);
    updateConditionalFields();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showMessage('Kayıt düzenleme için açıldı.');
  }

  function deleteRow(id) {
    state.rows = state.rows.filter(function (row) { return row.id !== id; });
    if (state.editingId === id) clearForm({ keepMessage: true });
    saveRows();
    showMessage('Kayıt silindi.');
    renderAll();
  }

  function rememberVolunteer(name) {
    if (!state.volunteers.some(function (item) {
      return item.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr');
    })) {
      state.volunteers.push(name);
      state.volunteers.sort(function (a, b) { return a.localeCompare(b, 'tr'); });
      saveVolunteers();
      renderVolunteerOptions(name);
    }
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
    renderSavedRecords();
    renderTable();
  }

  function renderSummary() {
    const totalAmount = state.rows.reduce(function (sum, row) {
      return sum + Number(row.miktar || 0);
    }, 0);
    const activeAreas = new Set(state.rows.map(function (row) { return row.calismaAlani; }));
    const waiting = state.rows.filter(function (row) {
      const statuses = toList(row.durum);
      return statuses.includes('Kontrol bekliyor') || statuses.includes('Takip gerekiyor');
    }).length;
    const volunteers = new Set(state.rows.map(function (row) { return row.gonullu; }));

    document.getElementById('toplamSayfa').textContent = formatNumber(totalAmount);
    document.getElementById('alanSayisi').textContent = formatNumber(activeAreas.size);
    document.getElementById('kontrolBekleyen').textContent = formatNumber(waiting);
    document.getElementById('gonulluSayisi').textContent = formatNumber(volunteers.size);
  }

  function renderSavedRecords() {
    const target = document.getElementById('kaydedilenKayitlar');
    const rows = state.rows.slice(0, 6);

    if (!rows.length) {
      target.innerHTML = '<p class="form-note">Henüz kayıt yok.</p>';
      return;
    }

    target.innerHTML = rows.map(function (row) {
      return `
        <article class="saved-record">
          <div>
            <b>${escapeHtml(row.gonullu)} · ${escapeHtml(row.tarih)}</b>
            <span>${escapeHtml(row.calismaAlani)} · ${escapeHtml(displayWork(row))}${escapeHtml(displayPlace(row, ' · '))}</span>
          </div>
          <div class="record-actions">
            <button type="button" data-action="edit" data-id="${row.id}">Düzenle</button>
            <button type="button" class="danger" data-action="delete" data-id="${row.id}">Sil</button>
          </div>
        </article>
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
          { label: 'Durum', render: function (row) { return statusPills(row.durum); } }
        ]
      };
    }

    if (view === 'takip') {
      return {
        kicker: 'Takip görünümü',
        title: 'Takip bekleyenler',
        rows: function () {
          return state.rows.filter(function (row) {
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
      { label: 'Durum', render: function (row) { return statusPills(row.durum); } }
    ];
  }

  function areaRows() {
    const grouped = new Map();
    state.rows.forEach(function (row) {
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
    state.rows.filter(function (row) {
      return row.fon || row.kutu || row.dosya || row.belge;
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

  function slug(value) {
    return String(value).toLocaleLowerCase('tr').replace(/[^a-z0-9ığüşöç-]+/g, '-');
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
