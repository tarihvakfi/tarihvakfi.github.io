/**
 * Tarih Vakfı digitization transition bridge.
 *
 * During the transition, volunteers can continue using the original workbook.
 * This script rebuilds the normalized reporting tabs in the new workbook from
 * the original workbook once per day, so the GitHub report page and the
 * transferable archive tables stay current without double data entry.
 */

const TVF_DIGITIZATION_BRIDGE = {
  timeZone: 'Europe/Istanbul',
  syncHour: 7,
  sourceSpreadsheetId: '1qJ49Iv4UL0kPC0dd9MmfilTwQAMKgelujWPqZH134RE',
  targetSpreadsheetId: '1DiUCoI9f7xrnBil2-H7EPqb9Scj37QKSOpnwdrFZghw',
  sourceDailySheet: 'Günlük Akış',
  sourceInventorySheet: 'PNB Sayısallaştırma',
  sourcePlanSheet: 'Haftalık Plan',
  targetDailySheet: '01 Gönüllü Günlüğü',
  targetScanSheet: '02 Tarama Satır Girişi',
  targetControlSheet: '03 Kontrol ve Onay',
  targetWebSheet: '04 Web Özeti',
  targetAtomSheet: '05 AtoM Aktarım',
  logSheet: '98 Senkron Günlüğü',
  detailSheets: [
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
  ]
};

const TVF_BRIDGE_DAILY_HEADERS = [
  'Tarih',
  'Gönüllü adı',
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
  'Diğer',
  'Diğer açıklaması',
  'Fon',
  'Kutu / raf',
  'Miktar',
  'Birim',
  'Tarayıcı / araç',
  'Yapılan iş / not',
  "Web'de göster",
  'Kayıt ID'
];

const TVF_BRIDGE_SCAN_HEADERS = [
  'Tarih',
  'Gönüllü adı',
  'Fon',
  'Kutu',
  'Dosya',
  'Belge',
  'Sayfa',
  'Dijital kod',
  'Belge tarihi',
  'Tarayıcı',
  'Tarama',
  'Kodlama',
  'Kontrol',
  'Kataloglama',
  'PDF/JPEG',
  'Kaydedildi',
  'Sürüyor',
  'Kontrol bekliyor',
  'Takip gerekiyor',
  'Tamamlandı',
  'Takip notu',
  'Not',
  "Web'de göster",
  "AtoM'a hazır",
  'Kayıt ID'
];

const TVF_BRIDGE_WEB_HEADERS = [
  'kaynak',
  'tarih',
  'gonullu',
  'is_turleri',
  'fon',
  'kutu',
  'dosya',
  'belge',
  'miktar',
  'birim',
  'durum',
  'not',
  'webde_goster',
  'kayit_id'
];

const TVF_BRIDGE_ATOM_HEADERS = [
  'referans_kodu',
  'ust_referans_kodu',
  'baslik',
  'tarih_baslangic',
  'tarih_bitis',
  'duzey',
  'kapsam_icerik',
  'fon',
  'kutu',
  'dosya',
  'belge',
  'dijital_nesne',
  'durum',
  'not',
  'kaynak_kayit_id'
];

const TVF_BRIDGE_CONTROL_HEADERS = [
  'Kontrol tarihi',
  'Kontrol eden',
  'İşi yapan',
  'Kaynak kayıt ID / aralık',
  'Fon',
  'Kutu',
  'Dosya',
  'Belge / sayfa aralığı',
  'Tarama kalitesi',
  'Dosya adı / dijital kod',
  'Sayfa sırası',
  'Kodlama',
  'Kataloglama',
  'Sonuç',
  'Sorun türü',
  'Düzeltme notu',
  'Düzeltmeyi yapan',
  'Son onay tarihi',
  'Durum',
  "Web'de göster",
  "AtoM'a hazır",
  'Kayıt ID'
];

const TVF_BRIDGE_NAME_ALIASES = {
  'anıl': 'Anıl Olcan',
  'anıl olcan': 'Anıl Olcan',
  'berf': 'Berfin Yazıcı',
  'berfin': 'Berfin Yazıcı',
  'berfin yazıcı': 'Berfin Yazıcı',
  'özden': 'Özden Özütemiz',
  'özden özütemiz': 'Özden Özütemiz',
  'sibel': 'Sibel Dağ',
  'sibel dağ': 'Sibel Dağ',
  'sude-aras': 'Sude-Aras',
  'sude aras': 'Sude-Aras',
  'öykü': 'Öykü Demirbaş',
  'öykü demirbaş': 'Öykü Demirbaş',
  'zelal': 'Zelal Yıldız',
  'zelal yıldız': 'Zelal Yıldız'
};

function installDigitizationBridgeDailyTrigger() {
  removeDigitizationBridgeDailyTrigger();
  ScriptApp.newTrigger('runDigitizationBridgeSync')
    .timeBased()
    .everyDays(1)
    .atHour(TVF_DIGITIZATION_BRIDGE.syncHour)
    .inTimezone(TVF_DIGITIZATION_BRIDGE.timeZone)
    .create();
  return 'Günlük senkron kuruldu. İlk deneme için runDigitizationBridgeSync fonksiyonunu çalıştırın.';
}

function removeDigitizationBridgeDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'runDigitizationBridgeSync') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  return 'Günlük senkron tetikleyicisi kaldırıldı.';
}

function runDigitizationBridgeSync() {
  const lock = LockService.getScriptLock();
  let target = null;
  let summary = null;
  let locked = false;

  try {
    lock.waitLock(30000);
    locked = true;
    const startedAt = new Date();
    const source = SpreadsheetApp.openById(TVF_DIGITIZATION_BRIDGE.sourceSpreadsheetId);
    target = SpreadsheetApp.openById(TVF_DIGITIZATION_BRIDGE.targetSpreadsheetId);

    const dailyRows = buildBridgeDailyRows_(source);
    const scanRows = buildBridgeScanRows_(source);
    const controlRows = readBridgeControlRows_(target);
    const webRows = buildBridgeWebRows_(dailyRows, scanRows, controlRows);
    const atomRows = buildBridgeAtomRows_(scanRows, controlRows);

    replaceBridgeSheet_(target, TVF_DIGITIZATION_BRIDGE.targetDailySheet, TVF_BRIDGE_DAILY_HEADERS, dailyRows);
    replaceBridgeSheet_(target, TVF_DIGITIZATION_BRIDGE.targetScanSheet, TVF_BRIDGE_SCAN_HEADERS, scanRows);
    replaceBridgeSheet_(target, TVF_DIGITIZATION_BRIDGE.targetWebSheet, TVF_BRIDGE_WEB_HEADERS, webRows);
    replaceBridgeSheet_(target, TVF_DIGITIZATION_BRIDGE.targetAtomSheet, TVF_BRIDGE_ATOM_HEADERS, atomRows);

    mirrorBridgeSheet_(source, target, TVF_DIGITIZATION_BRIDGE.sourceDailySheet);
    mirrorBridgeSheet_(source, target, TVF_DIGITIZATION_BRIDGE.sourceInventorySheet);
    mirrorBridgeSheet_(source, target, TVF_DIGITIZATION_BRIDGE.sourcePlanSheet);

    summary = {
      ok: true,
      startedAt: startedAt,
      finishedAt: new Date(),
      dailyRows: dailyRows.length,
      scanRows: scanRows.length,
      controlRows: controlRows.length,
      webRows: webRows.length,
      atomRows: atomRows.length
    };
    appendBridgeLog_(target, summary);
    return summary;
  } catch (err) {
    summary = {
      ok: false,
      finishedAt: new Date(),
      error: String((err && err.message) || err)
    };
    if (target) appendBridgeLog_(target, summary);
    throw err;
  } finally {
    if (locked) lock.releaseLock();
  }
}

function buildBridgeDailyRows_(source) {
  const sheet = requireBridgeSheet_(source, TVF_DIGITIZATION_BRIDGE.sourceDailySheet);
  const table = readBridgeTable_(sheet);
  if (table.length < 2) return [];

  const headerIndex = bridgeHeaderIndex_(table[0]);
  return table.slice(1).map(function (row, offset) {
    const sourceRowNumber = offset + 2;
    const date = bridgePick_(row, headerIndex, ['Tarih']);
    const people = normalizeBridgePeople_(bridgePick_(row, headerIndex, ['Paydaş']));
    const area = bridgePick_(row, headerIndex, ['Çalışma Alanı']);
    const work = bridgePick_(row, headerIndex, ['Devam Eden Çalışma']);
    const amount = bridgePick_(row, headerIndex, ['Yapılan Çalışmaya İlişkin Sayısal Bilgi']);
    const computer = bridgePick_(row, headerIndex, ['Bilgisayar']);
    const scanner = bridgePick_(row, headerIndex, ['Tarayıcı']);
    const notes = bridgePick_(row, headerIndex, ['Notlar']);
    const text = bridgeJoin_([area, work, notes]);
    const flags = classifyBridgeWork_(text);
    const otherText = flags['Diğer'] ? bridgeJoin_([area, work]) : '';

    return [
      date,
      people,
      flags['Tarama'],
      flags['Kodlama'],
      flags['Kontrol'],
      flags['Kataloglama'],
      flags['PDF/JPEG'],
      flags['Kütüphane taşıma'],
      flags['Kütüphane envanteri'],
      flags['Proje geliştirme'],
      flags['Web sitesi'],
      flags['Kronoloji / araştırma'],
      flags['Toplantı / eğitim'],
      flags['Koordinasyon'],
      flags['Diğer'],
      otherText,
      inferBridgeFund_(text),
      inferBridgeBox_(text),
      amount,
      inferBridgeUnit_(text, amount),
      scanner || computer,
      text,
      true,
      'GA-' + sourceRowNumber
    ];
  }).filter(function (row) {
    return bridgeHasAny_(row[0], row[1], row[21]);
  });
}

function buildBridgeScanRows_(source) {
  const rows = [];
  TVF_DIGITIZATION_BRIDGE.detailSheets.forEach(function (sheetName) {
    const sheet = source.getSheetByName(sheetName);
    if (!sheet) return;

    const table = readBridgeTable_(sheet);
    if (table.length < 2) return;

    const headerIndex = bridgeHeaderIndex_(table[0]);
    table.slice(1).forEach(function (row, offset) {
      const sourceRowNumber = offset + 2;
      const fund = bridgePick_(row, headerIndex, ['Fon Adı', 'Fon']) || (sheetName.indexOf('NSS') >= 0 ? 'NSS' : 'PNB');
      const box = bridgePick_(row, headerIndex, ['Kutu No', 'Kutu']);
      const file = bridgePick_(row, headerIndex, ['Dosya No', 'Dosya']);
      const documentNo = bridgePick_(row, headerIndex, ['Belge No', 'Belge']);
      const page = bridgePick_(row, headerIndex, ['Sayfa']);
      const digitalCode = bridgePick_(row, headerIndex, ['Dijital Belge Kodu', 'Dijital kod']);
      const documentDate = bridgePick_(row, headerIndex, ['Belge Tarihi', 'Belge tarihi']);
      const notes = bridgePick_(row, headerIndex, ['Notlar', 'Not']);
      const creator = normalizeBridgePeople_(bridgePick_(row, headerIndex, ['Kaydı Oluşturan', 'Kaydı Oluşuran']));
      const scanner = bridgePick_(row, headerIndex, ['Tarayıcı']);
      const date = bridgePick_(row, headerIndex, ['Tarama Tarihi', 'Tarih']);

      if (!bridgeHasAny_(fund, box, file, documentNo, page, digitalCode, creator, date, notes)) return;

      rows.push([
        date,
        creator,
        fund,
        box,
        file,
        documentNo,
        page,
        digitalCode,
        documentDate,
        scanner,
        true,
        true,
        false,
        false,
        false,
        true,
        false,
        false,
        Boolean(notes),
        false,
        notes,
        '',
        true,
        false,
        'TS-' + sanitizeBridgeId_(digitalCode || sheetName + '-' + sourceRowNumber)
      ]);
    });
  });

  return rows.sort(function (a, b) {
    return bridgeDateKey_(b[0]).localeCompare(bridgeDateKey_(a[0]), 'tr')
      || String(a[24]).localeCompare(String(b[24]), 'tr');
  });
}

function readBridgeControlRows_(target) {
  const sheet = target.getSheetByName(TVF_DIGITIZATION_BRIDGE.targetControlSheet);
  if (!sheet) return [];
  const table = readBridgeTable_(sheet);
  if (table.length < 2) return [];

  const headerIndex = bridgeHeaderIndex_(table[0]);
  return table.slice(1).map(function (row, offset) {
    const recordId = bridgePick_(row, headerIndex, ['Kayıt ID']) || 'KO-' + (offset + 2);
    return {
      source: TVF_DIGITIZATION_BRIDGE.targetControlSheet,
      date: bridgePick_(row, headerIndex, ['Kontrol tarihi']),
      people: normalizeBridgePeople_(bridgePick_(row, headerIndex, ['Kontrol eden'])),
      checkedPeople: normalizeBridgePeople_(bridgePick_(row, headerIndex, ['İşi yapan'])),
      recordRef: bridgePick_(row, headerIndex, ['Kaynak kayıt ID / aralık']),
      fund: bridgePick_(row, headerIndex, ['Fon']),
      box: bridgePick_(row, headerIndex, ['Kutu']),
      file: bridgePick_(row, headerIndex, ['Dosya']),
      documentNo: bridgePick_(row, headerIndex, ['Belge / sayfa aralığı']),
      workTypes: bridgeSelectedFromHeaders_(row, headerIndex, [
        'Tarama kalitesi',
        'Dosya adı / dijital kod',
        'Sayfa sırası',
        'Kodlama',
        'Kataloglama'
      ]),
      result: bridgeJoin_([
        bridgePick_(row, headerIndex, ['Sonuç']),
        bridgePick_(row, headerIndex, ['Sorun türü']),
        bridgePick_(row, headerIndex, ['Durum'])
      ]),
      notes: bridgeJoin_([
        bridgePick_(row, headerIndex, ['Düzeltme notu']),
        bridgePick_(row, headerIndex, ['Düzeltmeyi yapan'])
      ]),
      webVisible: bridgeTruthy_(bridgePick_(row, headerIndex, ["Web'de göster"])),
      atomReady: bridgeTruthy_(bridgePick_(row, headerIndex, ["AtoM'a hazır"])),
      recordId: recordId
    };
  }).filter(function (row) {
    return bridgeHasAny_(
      row.date,
      row.people,
      row.checkedPeople,
      row.recordRef,
      row.fund,
      row.box,
      row.file,
      row.documentNo,
      row.result,
      row.notes
    );
  });
}

function buildBridgeWebRows_(dailyRows, scanRows, controlRows) {
  const webRows = [];
  dailyRows.forEach(function (row) {
    webRows.push([
      TVF_DIGITIZATION_BRIDGE.targetDailySheet,
      row[0],
      row[1],
      bridgeSelectedFromRow_(row, TVF_BRIDGE_DAILY_HEADERS, [
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
      ]).join(', '),
      row[16],
      row[17],
      '',
      '',
      row[18],
      row[19],
      row[22] ? 'Webde göster' : 'Kayıt',
      row[21],
      row[22],
      row[23]
    ]);
  });

  scanRows.forEach(function (row) {
    webRows.push([
      TVF_DIGITIZATION_BRIDGE.targetScanSheet,
      row[0],
      row[1],
      bridgeSelectedFromRow_(row, TVF_BRIDGE_SCAN_HEADERS, ['Tarama', 'Kodlama', 'Kontrol', 'Kataloglama', 'PDF/JPEG']).join(', '),
      row[2],
      row[3],
      row[4],
      row[5],
      1,
      'satır',
      bridgeSelectedFromRow_(row, TVF_BRIDGE_SCAN_HEADERS, ['Kaydedildi', 'Sürüyor', 'Kontrol bekliyor', 'Takip gerekiyor', 'Tamamlandı']).join(', '),
      bridgeJoin_([row[20], row[21]]),
      row[22],
      row[24]
    ]);
  });

  controlRows.forEach(function (row) {
    webRows.push([
      row.source,
      row.date,
      row.people,
      row.workTypes.join(', '),
      row.fund,
      row.box,
      row.file,
      row.documentNo,
      1,
      'kontrol',
      row.result,
      row.notes,
      row.webVisible,
      row.recordId
    ]);
  });

  return webRows;
}

function buildBridgeAtomRows_(scanRows, controlRows) {
  const atomRows = scanRows.map(function (row) {
    const fund = row[2];
    const box = row[3];
    const file = row[4];
    const documentNo = row[5];
    const page = row[6];
    const code = row[7] || row[24];
    const title = bridgeJoin_([
      fund,
      box ? 'Kutu ' + box : '',
      file ? 'Dosya ' + file : '',
      documentNo ? 'Belge ' + documentNo : '',
      page ? 'Sayfa ' + page : ''
    ], ' / ');

    return [
      code,
      bridgeJoin_([fund, box, file], '-'),
      title,
      row[8],
      '',
      'item',
      row[21] || row[20],
      fund,
      box,
      file,
      documentNo,
      code,
      row[23] ? 'hazır' : 'taslak',
      bridgeJoin_([row[20], row[21]]),
      row[24]
    ];
  });

  controlRows.forEach(function (row) {
    if (!row.atomReady) return;
    atomRows.push([
      row.recordRef || row.recordId,
      bridgeJoin_([row.fund, row.box, row.file], '-'),
      bridgeJoin_([row.fund, row.box ? 'Kutu ' + row.box : '', row.documentNo], ' / '),
      row.date,
      '',
      'item',
      row.notes,
      row.fund,
      row.box,
      row.file,
      row.documentNo,
      row.recordRef,
      row.result || 'kontrol edildi',
      row.notes,
      row.recordId
    ]);
  });

  return atomRows;
}

function mirrorBridgeSheet_(source, target, sheetName) {
  const sourceSheet = source.getSheetByName(sheetName);
  const targetSheet = target.getSheetByName(sheetName);
  if (!sourceSheet || !targetSheet) return;

  const table = readBridgeTable_(sourceSheet);
  const width = Math.max(1, table.reduce(function (max, row) { return Math.max(max, row.length); }, 0));
  const height = Math.max(1, table.length);
  ensureBridgeGrid_(targetSheet, height, width);
  targetSheet.getRange(1, 1, Math.max(targetSheet.getLastRow(), height), width).clearContent();
  if (table.length) {
    writeBridgeValues_(targetSheet, 1, 1, normalizeBridgeRows_(table, width));
  }
}

function replaceBridgeSheet_(spreadsheet, sheetName, headers, rows) {
  const sheet = requireBridgeSheet_(spreadsheet, sheetName);
  const width = headers.length;
  const height = rows.length + 1;
  ensureBridgeGrid_(sheet, height, width);
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), height), width).clearContent();
  writeBridgeValues_(sheet, 1, 1, [headers]);
  if (rows.length) {
    writeBridgeValues_(sheet, 2, 1, normalizeBridgeRows_(rows, width));
  }
}

function appendBridgeLog_(spreadsheet, summary) {
  let sheet = spreadsheet.getSheetByName(TVF_DIGITIZATION_BRIDGE.logSheet);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(TVF_DIGITIZATION_BRIDGE.logSheet);
    sheet.getRange(1, 1, 1, 8).setValues([[
      'Zaman',
      'Durum',
      'Günlük satır',
      'Tarama satırı',
      'Kontrol satırı',
      'Web özeti',
      'AtoM satırı',
      'Not'
    ]]);
  }
  const row = [
    Utilities.formatDate(summary.finishedAt || new Date(), TVF_DIGITIZATION_BRIDGE.timeZone, 'yyyy-MM-dd HH:mm:ss'),
    summary.ok ? 'Tamamlandı' : 'Hata',
    summary.dailyRows || '',
    summary.scanRows || '',
    summary.controlRows || '',
    summary.webRows || '',
    summary.atomRows || '',
    summary.error || ''
  ];
  sheet.appendRow(row);
}

function readBridgeTable_(sheet) {
  const range = sheet.getDataRange();
  if (!range) return [];
  return range.getDisplayValues().filter(function (row) {
    return row.some(function (cell) { return bridgeClean_(cell); });
  });
}

function requireBridgeSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('sheet_missing: ' + sheetName);
  return sheet;
}

function ensureBridgeGrid_(sheet, minRows, minCols) {
  if (sheet.getMaxRows() < minRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minRows - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < minCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), minCols - sheet.getMaxColumns());
  }
}

function writeBridgeValues_(sheet, startRow, startCol, rows) {
  const chunkSize = 2000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    sheet.getRange(startRow + i, startCol, chunk.length, chunk[0].length).setValues(chunk);
  }
}

function normalizeBridgeRows_(rows, width) {
  return rows.map(function (row) {
    const normalized = row.slice(0, width);
    while (normalized.length < width) normalized.push('');
    return normalized;
  });
}

function bridgeHeaderIndex_(headers) {
  const index = {};
  headers.forEach(function (header, i) {
    const key = bridgeHeaderKey_(header);
    if (key) index[key] = i;
  });
  return index;
}

function bridgePick_(row, headerIndex, names) {
  for (let i = 0; i < names.length; i++) {
    const key = bridgeHeaderKey_(names[i]);
    if (Object.prototype.hasOwnProperty.call(headerIndex, key)) {
      return bridgeClean_(row[headerIndex[key]]);
    }
  }
  return '';
}

function bridgeHeaderKey_(value) {
  return bridgeClean_(value).toLocaleLowerCase('tr').replace(/\s+/g, ' ');
}

function classifyBridgeWork_(text) {
  const normalized = bridgeText_(text);
  const flags = {
    'Tarama': /tarama|taran|dijitalleştir|sayısallaştır/.test(normalized),
    'Kodlama': /kodlama|kodlan|dijital kod|excel/.test(normalized),
    'Kontrol': /kontrol|onay|denetim/.test(normalized),
    'Kataloglama': /katalog|tasnif|tanımlama/.test(normalized),
    'PDF/JPEG': /pdf|jpeg|jpg|görüntü/.test(normalized),
    'Kütüphane taşıma': /taşın|taşıma|nakil/.test(normalized),
    'Kütüphane envanteri': /kütüphane|kitap|raf|envanter|sayım/.test(normalized),
    'Proje geliştirme': /proje|başvuru|fon başvurusu/.test(normalized),
    'Web sitesi': /web|site|github/.test(normalized),
    'Kronoloji / araştırma': /kronoloji|araştırma|karar defteri|faaliyet raporu/.test(normalized),
    'Toplantı / eğitim': /toplantı|eğitim|atölye|plan toplantısı/.test(normalized),
    'Koordinasyon': /koordinasyon|planlama|gönüllü organizasyonu/.test(normalized),
    'Diğer': false
  };
  flags['Diğer'] = !Object.keys(flags).some(function (key) {
    return key !== 'Diğer' && flags[key];
  });
  return flags;
}

function inferBridgeFund_(text) {
  const normalized = bridgeText_(text);
  if (/pnb|boratav|pertev/.test(normalized)) return 'PNB';
  if (/kütüphane|kitap|raf|envanter|sayım|taşın/.test(normalized)) return 'Kütüphane';
  if (/vakıf|karar defteri|kronoloji|faaliyet raporu/.test(normalized)) return 'Vakıf';
  return '';
}

function inferBridgeBox_(text) {
  const match = bridgeClean_(text).match(/\b(?:kutu|box)\s*[:#]?\s*([0-9]+(?:[.,][0-9]+)?)/i);
  return match ? 'Kutu ' + match[1] : '';
}

function inferBridgeUnit_(text, amount) {
  if (!amount) return '';
  const normalized = bridgeText_(text);
  if (/sayfa/.test(normalized)) return 'sayfa';
  if (/kitap/.test(normalized)) return 'kitap';
  if (/kayıt|satır/.test(normalized)) return 'kayıt';
  return 'adet';
}

function normalizeBridgePeople_(value) {
  return bridgeClean_(value)
    .split(/\s*(?:,|;|\n|\|)\s*/)
    .map(function (name) {
      const cleanName = bridgeClean_(name);
      const alias = TVF_BRIDGE_NAME_ALIASES[bridgeHeaderKey_(cleanName)];
      return alias || cleanName;
    })
    .filter(Boolean)
    .join(', ');
}

function bridgeSelectedFromHeaders_(row, headerIndex, labels) {
  return labels.filter(function (label) {
    return bridgeTruthy_(bridgePick_(row, headerIndex, [label]));
  });
}

function bridgeSelectedFromRow_(row, headers, labels) {
  return labels.filter(function (label) {
    const index = headers.indexOf(label);
    return index >= 0 && bridgeTruthy_(row[index]);
  });
}

function bridgeTruthy_(value) {
  const normalized = bridgeText_(value);
  return value === true
    || normalized === 'true'
    || normalized === '1'
    || normalized === 'evet'
    || normalized === 'yes'
    || normalized === 'x'
    || normalized === '✓';
}

function bridgeHasAny_() {
  return Array.prototype.slice.call(arguments).some(function (value) {
    if (Array.isArray(value)) return value.length > 0;
    return bridgeClean_(value);
  });
}

function bridgeJoin_(parts, separator) {
  const glue = separator || ' · ';
  return parts.map(bridgeClean_).filter(Boolean).join(glue);
}

function bridgeClean_(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function bridgeText_(value) {
  return bridgeClean_(value).toLocaleLowerCase('tr');
}

function sanitizeBridgeId_(value) {
  return bridgeClean_(value)
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_.-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function bridgeDateKey_(value) {
  const clean = bridgeClean_(value);
  if (!clean) return '';

  let match = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    return [match[3], padBridge2_(match[2]), padBridge2_(match[1])].join('-');
  }

  const months = {
    'ocak': '01',
    'şubat': '02',
    'mart': '03',
    'nisan': '04',
    'mayıs': '05',
    'haziran': '06',
    'temmuz': '07',
    'ağustos': '08',
    'eylül': '09',
    'ekim': '10',
    'kasım': '11',
    'aralık': '12'
  };
  match = bridgeText_(clean).match(/^(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})$/);
  if (match && months[match[2]]) {
    return [match[3], months[match[2]], padBridge2_(match[1])].join('-');
  }

  return clean;
}

function padBridge2_(value) {
  return String(value).padStart(2, '0');
}
