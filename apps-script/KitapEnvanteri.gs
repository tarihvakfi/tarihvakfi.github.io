/**
 * Tarih Vakfı Kütüphanesi — Kitap Envanteri
 * Google Apps Script arka ucu. Kayıtlar bağlı olduğu Google E-Tablo'ya yazılır.
 *
 * Gönüllü sistemiyle aynı mantık: web uygulaması olarak dağıtılır, telefondaki
 * form buraya kayıt gönderir.
 */

/* ═══════════════ AYARLAR ═══════════════ */

var AYAR = {
  KURUM: 'Tarih Vakfı',

  // Bağımsız Apps Script projesi kullanıyorsanız E-Tablo kimliğini yazın.
  // Betiği tablonun "Uzantılar → Apps Script" menüsünden açtıysanız boş bırakın.
  TABLO_ID: '',

  // Gönüllülerin forma girerken bir kez yazacağı ortak çalışma şifresi.
  // Kısa ve söylemesi kolay olsun; her çalışma gününde değiştirmeye gerek yok.
  CALISMA_SIFRESI: 'kitap2026',

  // Koordinatör şifresi: künye onay ekranı ve katalog bunu ister.
  // Çalışma şifresini bilen gönüllü bu iki ekranı açamaz.
  // Boş bırakırsanız ayrım kalkar, ikisi de çalışma şifresiyle açılır.
  KOORDINATOR_SIFRESI: 'koordinator2026',

  // Formda kaç son kayıt görünsün (düzeltme/silme için)
  SON_KAYIT: 8,

  // Durum panosundaki hedef çubuğu için: yeni binaya kaç kitap sığacak?
  // Bilmiyorsanız 0 bırakın, çubuk gizlenir. (Raf metresi × 30–35 kitap)
  HEDEF_KITAP: 0,

  // ── Yer kodu ────────────────────────────────────────────────────
  // Kitabın nereden geldiğini gösteren kod:  K1-A01-007
  //   K1  → mekân (oda/kat)      A → raf (kitaplık)
  //   01  → sıra (rafın gözü)  007 → o sıradaki kaçıncı kitap
  //
  // Kütüphane tek mekândaysa listeyi tek satır bırakın, kod A01-007 olur.
  // Kodları kısa tutun; gönüllü menüden seçecek, yazmayacak.
  MEKANLAR: [
    { kod: 'K1', ad: '1. kat' },
    { kod: 'K2', ad: '2. kat' },
    { kod: 'D',  ad: 'Depo' },
  ],

  // Her mekânda kullanılan raf (kitaplık) harfleri
  RAF_HARFLERI: 'ABCDEFGHIJKL',

  // Bir rafta en fazla kaç sıra (göz) var
  SIRA_SAYISI: 8,

  // ── Fotoğraf ve OCR ──────────────────────────────────────────────
  // Künye sayfası fotoğraflarının kaydedileceği Drive klasörü.
  // Boş bırakırsanız betik "Kitap Künye Fotoğrafları" adlı klasörü kendisi açar.
  FOTO_KLASOR_ID: '',

  // OCR (fotoğraftan yazı çıkarma) açık mı? Drive'ın kendi OCR'ı kullanılır, ücretsizdir.
  // Çalışması için Apps Script'te "Hizmetler → Drive API" eklenmiş olmalı.
  OCR_ACIK: true,

  // Zamanlayıcı her çalıştığında en fazla kaç fotoğraf işlensin
  // (Apps Script'in 6 dakikalık çalışma sınırına takılmamak için)
  OCR_TOPLU: 12,
};

/* ═══════════════ SÖZLÜKLER ═══════════════ */

var KATEGORILER = {
  gidecek:   { ad: 'Gidecek',       renk: '#2e6440' },
  belki:     { ad: 'Gitse de olur', renk: '#a06a12' },
  gitmeyecek:{ ad: 'Gitmeyecek',    renk: '#9c2233' },
  belirsiz:  { ad: 'Belirsiz',      renk: '#2a5b86' },
};

var DURUMLAR = ['Sağlam', 'Yıpranmış', 'Küflü/böcekli'];

// Kural kartıyla birebir aynı olmalı
var KURALLAR = [
  ['Y1', 'gidecek', 'Tarih Vakfı yayınları ve vakıf tarihine ait her şey'],
  ['Y2', 'gidecek', 'Türkiye ekonomik/toplumsal tarihi, kent tarihi, sözlü tarih, bellek'],
  ['Y3', 'gidecek', 'İmzalı, ithaflı veya ex-libris’li nüsha'],
  ['Y4', 'gidecek', '1950 öncesi baskı; Osmanlıca / eski harfli eser'],
  ['Y5', 'gidecek', 'Rapor, tez, bülten, katalog, broşür'],
  ['Y6', 'gidecek', 'Süreli yayının tam serisi'],
  ['Y7', 'gidecek', 'Şartlı bağış koleksiyonunun parçası'],
  ['S1', 'belki', 'İkinci veya üçüncü kopya'],
  ['S2', 'belki', 'Genel başvuru kaynağı'],
  ['S3', 'belki', 'Dolaylı ilgili, yabancı dilde'],
  ['S4', 'belki', 'Güncelliğini kısmen yitirmiş'],
  ['S5', 'belki', 'Sağlam ama önceliği düşük'],
  ['K1', 'gitmeyecek', 'Alan dışı: ders/sınav kitabı, popüler kurgu'],
  ['K2', 'gitmeyecek', 'Güncelliğini yitirmiş mevzuat, yıllık/katalog fazlası'],
  ['K3', 'gitmeyecek', 'Üçten fazla mükerrer nüshanın fazlası'],
  ['K4', 'gitmeyecek', 'Ağır hasarlı ve kolay bulunabilir'],
  ['K5', 'gitmeyecek', 'Süreli yayının dağınık tek sayısı'],
  ['K6', 'gitmeyecek', 'Tanıtım/promosyon malzemesi'],
  ['M1', 'belirsiz', 'On saniyede karar veremedim'],
  ['M2', 'belirsiz', 'Değerli olabilir şüphesi'],
  ['M3', 'belirsiz', 'Yabancı dilde, içeriği anlamadım'],
  ['M4', 'belirsiz', 'Kurallar çelişiyor'],
];

/* Yer bilgisi hem tek parça kod (insan için, kutu etiketi için) hem de ayrı
   sütunlar (süzme ve sayma için) olarak tutulur. */
var SUTUNLAR = ['Kayıt no', 'Yer kodu', 'Mekân', 'Raf', 'Sıra', 'Sıra no',
                'Yazar', 'Başlık', 'Yıl', 'Nüsha',
                'Kategori', 'Kural', 'Durum', 'Not', 'Kaydeden', 'Kutu no', 'Tarih',
                'Fotoğraf', 'OCR durumu', 'Öneri başlık', 'Öneri yazar', 'Öneri yıl',
                'Öneri yayınevi', 'OCR metni', 'Onay', 'Kapak'];

// Sık kullanılan sütun numaraları (1'den başlar)
var S = {
  no: 1, yer: 2, mekan: 3, raf: 4, sira: 5, siraNo: 6,
  yazar: 7, baslik: 8, yil: 9, nusha: 10, kategori: 11, kural: 12,
  durum: 13, not: 14, kaydeden: 15, kutu: 16, tarih: 17,
  foto: 18, ocrDurum: 19, oneriBaslik: 20, oneriYazar: 21, oneriYil: 22,
  oneriYayinevi: 23, ocrMetin: 24, onay: 25, kapak: 26
};

/* ═══════════════ YER KODU ═══════════════ */

function pad_(sayi, hane) {
  var m = String(sayi);
  while (m.length < hane) m = '0' + m;
  return m;
}

/** 'K1-A01' — bir sıranın (rafın gözünün) anahtarı. Mekân tek ise 'A01'. */
function rafAnahtari_(mekan, raf, sira) {
  var m = String(mekan || '').trim().toUpperCase();
  var kod = String(raf || '').trim().toUpperCase() + pad_(Number(sira) || 0, 2);
  return m ? m + '-' + kod : kod;
}

/** 'K1-A01-007' — tek bir kitabın yer kodu. */
function yerKodu_(mekan, raf, sira, siraNo) {
  return rafAnahtari_(mekan, raf, sira) + '-' + pad_(Number(siraNo) || 0, 3);
}

/**
 * Bir sırada kullanılmış numaraları döner.
 * Telefon çevrimdışıyken numarayı kendi verir; sunucu burada doğrular.
 */
function siraKullanimi_(sayfa, anahtar) {
  var son = sayfa.getLastRow();
  var sonuc = { sonNo: 0, adet: 0, kullanilan: {} };
  if (son < 2) return sonuc;

  var veri = sayfa.getRange(2, S.mekan, son - 1, 4).getValues();   // Mekân, Raf, Sıra, Sıra no
  veri.forEach(function (r) {
    if (rafAnahtari_(r[0], r[1], r[2]) !== anahtar) return;
    var n = Number(r[3]) || 0;
    sonuc.adet++;
    sonuc.kullanilan[n] = true;
    if (n > sonuc.sonNo) sonuc.sonNo = n;
  });
  return sonuc;
}

/** Sıradaki boş numarayı verir; telefonun önerdiği numara boştaysa onu korur. */
function siraNoAyarla_(sayfa, anahtar, onerilen) {
  var k = siraKullanimi_(sayfa, anahtar);
  var n = Number(onerilen) || 0;
  if (n > 0 && !k.kullanilan[n]) return { siraNo: n, duzeltildi: false, adet: k.adet };
  return { siraNo: k.sonNo + 1, duzeltildi: n > 0, adet: k.adet };
}

/** Form raf seçtiğinde çağırır: o sırada en son hangi numarada kalınmış? */
function rafDurum_(mekan, raf, sira) {
  var anahtar = rafAnahtari_(mekan, raf, sira);
  var k = siraKullanimi_(sayfaAl_('Envanter'), anahtar);
  return { ok: true, anahtar: anahtar, sonNo: k.sonNo, adet: k.adet };
}

/* ═══════════════ GİRİŞ NOKTALARI ═══════════════ */

function doGet(e) {
  if (e && e.parameter && e.parameter.action) return islet_(e.parameter);
  return cikti_({ ok: true, mesaj: AYAR.KURUM + ' kitap envanteri çalışıyor.' });
}

function doPost(e) {
  var istek = {};
  try { istek = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (h) { return cikti_({ ok: false, error: 'İstek okunamadı.' }); }
  return islet_(istek);
}

// Yalnızca koordinatörün açabileceği işlemler
var KOORDINATOR_EYLEMLERI = ['onayBekleyen', 'onayla', 'katalog', 'durum'];

function islet_(istek) {
  try {
    if (istek.action === 'config') return cikti_(ayarlar_());

    var sifre = String(istek.sifre || '');
    var koordinatorSifresi = String(AYAR.KOORDINATOR_SIFRESI || '').trim();

    if (KOORDINATOR_EYLEMLERI.indexOf(istek.action) >= 0 && koordinatorSifresi) {
      // Onay ekranı ve katalog ayrı şifre ister; çalışma şifresi buraya yetmez.
      if (sifre !== koordinatorSifresi) {
        return cikti_({ ok: false, sifreHatasi: true,
          error: 'Bu ekran koordinatör şifresi ister.' });
      }
    } else if (sifre !== String(AYAR.CALISMA_SIFRESI)) {
      return cikti_({ ok: false, error: 'Çalışma şifresi hatalı.', sifreHatasi: true });
    }

    switch (istek.action) {
      case 'ekle':        return cikti_(ekle_(istek.kayit || {}));
      case 'sonKayitlar': return cikti_(sonKayitlar_(istek.kaydeden));
      case 'guncelle':    return cikti_(guncelle_(istek.no, istek.kayit || {}));
      case 'sil':         return cikti_(sil_(istek.no));
      case 'sayac':       return cikti_(sayac_(istek.kaydeden));
      case 'rafDurum':    return cikti_(rafDurum_(istek.mekan, istek.raf, istek.sira));
      case 'fotoEkle':    return cikti_(fotoEkle_(istek.no, istek.veri, istek.tur, istek.hangi));
      case 'onayBekleyen':return cikti_(onayBekleyen_(istek.adet));
      case 'onayla':      return cikti_(onayla_(istek.no, istek.kayit || {}));
      case 'katalog':     return cikti_(katalog_(istek));
      case 'durum':       return cikti_(durum_());
      default:            return cikti_({ ok: false, error: 'Bilinmeyen istek.' });
    }
  } catch (hata) {
    Logger.log(hata);
    return cikti_({ ok: false, error: 'Sunucu hatası: ' + hata.message });
  }
}

function cikti_(nesne) {
  // Hatalar 'ok: false' ile açıkça dönüyor; alan hiç yoksa istek başarılıdır.
  // (Bir yanıtta 'ok' unutulursa form onu hata sanar — bu satır onu engeller.)
  if (nesne && nesne.ok === undefined) nesne.ok = true;
  return ContentService.createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

function ayarlar_() {
  return {
    ok: true,
    org: AYAR.KURUM,
    kategoriler: KATEGORILER,
    durumlar: DURUMLAR,
    kurallar: KURALLAR.map(function (k) { return { kod: k[0], kategori: k[1], aciklama: k[2] }; }),
    mekanlar: AYAR.MEKANLAR || [],
    rafHarfleri: String(AYAR.RAF_HARFLERI || 'ABCDEFGH').toUpperCase().split(''),
    siraSayisi: Number(AYAR.SIRA_SAYISI || 8),
  };
}

/* ═══════════════ KAYIT İŞLEMLERİ ═══════════════ */

function ekle_(g) {
  var d = dogrula_(g);
  if (d.hata) return { ok: false, error: d.hata };

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var sayfa = sayfaAl_('Envanter');
    var no = sonrakiNo_(sayfa);
    var simdi = new Date();

    // Sıra numarasını telefon önerir (çevrimdışı da çalışsın diye); burada doğrulanır.
    var anahtar = rafAnahtari_(d.k.mekan, d.k.raf, d.k.sira);
    var s = siraNoAyarla_(sayfa, anahtar, g.siraNo);
    var yer = yerKodu_(d.k.mekan, d.k.raf, d.k.sira, s.siraNo);

    sayfa.appendRow([no, yer, d.k.mekan, d.k.raf, pad_(d.k.sira, 2), s.siraNo,
                     d.k.yazar, d.k.baslik, d.k.yil, d.k.nusha,
                     d.k.kategori, d.k.kural, d.k.durum, d.k.not, d.k.kaydeden, '', simdi,
                     '', '', '', '', '', '', '', '', '']);
    return { ok: true, no: no, yerKodu: yer, siraNo: s.siraNo, duzeltildi: s.duzeltildi,
             rafAdet: s.adet + 1, sayac: sayac_(d.k.kaydeden) };
  } finally {
    kilit.releaseLock();
  }
}

function guncelle_(no, g) {
  var d = dogrula_(g);
  if (d.hata) return { ok: false, error: d.hata };

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var bulunan = satirBul_(no);
    if (!bulunan) return { ok: false, error: 'Kayıt bulunamadı.' };
    var sayfa = sayfaAl_('Envanter');
    // Yer kodu, kutu no ve kayıt tarihi korunur — düzeltme yalnızca künyeyi değiştirir.
    sayfa.getRange(bulunan.satir, S.yazar, 1, 8).setValues([[d.k.yazar, d.k.baslik, d.k.yil,
      d.k.nusha, d.k.kategori, d.k.kural, d.k.durum, d.k.not]]);
    return { ok: true, no: no };
  } finally {
    kilit.releaseLock();
  }
}

function sil_(no) {
  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var bulunan = satirBul_(no);
    if (!bulunan) return { ok: false, error: 'Kayıt bulunamadı.' };
    sayfaAl_('Envanter').deleteRow(bulunan.satir);
    return { ok: true, no: no };
  } finally {
    kilit.releaseLock();
  }
}

function sonKayitlar_(kaydeden) {
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return { ok: true, kayitlar: [] };

  var bas = Math.max(2, son - 200);        // son 200 satıra bak, yeterli
  var satirlar = sayfa.getRange(bas, 1, son - bas + 1, SUTUNLAR.length).getValues();
  var ad = String(kaydeden || '').trim().toLowerCase();

  var liste = satirlar.filter(function (s) {
    return s[0] && (!ad || String(s[S.kaydeden - 1]).trim().toLowerCase() === ad);
  }).slice(-AYAR.SON_KAYIT).reverse().map(function (s) {
    return { no: s[S.no - 1], yer: s[S.yer - 1], yazar: s[S.yazar - 1], baslik: s[S.baslik - 1],
             yil: s[S.yil - 1], nusha: s[S.nusha - 1], kategori: s[S.kategori - 1],
             kural: s[S.kural - 1], durum: s[S.durum - 1], not: s[S.not - 1],
             kaydeden: s[S.kaydeden - 1] };
  });
  return { ok: true, kayitlar: liste };
}

function sayac_(kaydeden) {
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return { ok: true, toplam: 0, bugun: 0, benim: 0 };

  var satirlar = sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues();
  var bugunKey = gunAnahtari_(new Date());
  var ad = String(kaydeden || '').trim().toLowerCase();
  var toplam = 0, bugun = 0, benim = 0;

  satirlar.forEach(function (s) {
    if (!s[S.no - 1]) return;
    toplam++;
    var t = s[S.tarih - 1];
    var ayniGun = t instanceof Date && gunAnahtari_(t) === bugunKey;
    if (ayniGun) bugun++;
    if (ayniGun && ad && String(s[S.kaydeden - 1]).trim().toLowerCase() === ad) benim++;
  });
  return { ok: true, toplam: toplam, bugun: bugun, benim: benim };
}

/* ═══════════════ YARDIMCILAR ═══════════════ */

function dogrula_(g) {
  var baslik = String(g.baslik || '').trim();
  // Fotoğraf çekilecekse başlık boş olabilir; künye fotoğraftan tamamlanır.
  if (!baslik && !g.fotoVar) return { hata: 'Başlık boş olamaz (ya da künye fotoğrafı çekin).' };
  if (!baslik) baslik = '(künye fotoğraftan gelecek)';

  // ── yer bilgisi ──
  var mekanlar = (AYAR.MEKANLAR || []).map(function (m) { return String(m.kod).toUpperCase(); });
  var mekan = String(g.mekan || '').trim().toUpperCase();
  if (mekanlar.length > 1 && mekanlar.indexOf(mekan) < 0) return { hata: 'Mekân seçilmeli.' };
  if (mekanlar.length === 1) mekan = mekanlar[0];
  if (!mekanlar.length) mekan = '';

  var raf = String(g.raf || '').trim().toUpperCase();
  if (!raf) return { hata: 'Raf seçilmeli.' };
  if (String(AYAR.RAF_HARFLERI || '').toUpperCase().indexOf(raf) < 0) {
    return { hata: 'Raf harfi tanımlı değil: ' + raf };
  }

  var sira = parseInt(g.sira, 10);
  if (!sira || sira < 1 || sira > Number(AYAR.SIRA_SAYISI || 8)) {
    return { hata: 'Sıra 1 ile ' + (AYAR.SIRA_SAYISI || 8) + ' arasında olmalı.' };
  }

  var kategori = String(g.kategori || '');
  if (!KATEGORILER[kategori]) return { hata: 'Kategori seçilmeli.' };

  var kural = String(g.kural || '').trim().toUpperCase();
  var gecerli = KURALLAR.filter(function (k) { return k[0] === kural && k[1] === kategori; });
  if (!gecerli.length) return { hata: 'Kural kodu bu kategoriye uymuyor.' };

  var durum = String(g.durum || 'Sağlam');
  if (DURUMLAR.indexOf(durum) < 0) durum = 'Sağlam';

  var yil = String(g.yil || '').trim();
  if (yil && !/^\d{3,4}$/.test(yil)) return { hata: 'Yıl 3–4 haneli olmalı (ya da boş).' };

  var nusha = parseInt(g.nusha, 10);
  if (!nusha || nusha < 1) nusha = 1;

  return {
    k: {
      mekan: mekan,
      raf: raf,
      sira: sira,
      yazar: String(g.yazar || '').trim(),
      baslik: baslik,
      yil: yil ? Number(yil) : '',
      nusha: nusha,
      kategori: KATEGORILER[kategori].ad,
      kural: kural,
      durum: durum,
      not: String(g.not || '').trim().slice(0, 500),
      kaydeden: String(g.kaydeden || '').trim(),
    }
  };
}

function satirBul_(no) {
  no = Number(no);
  if (!no) return null;
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return null;
  var numaralar = sayfa.getRange(2, 1, son - 1, 1).getValues();
  for (var i = numaralar.length - 1; i >= 0; i--) {     // sondan ara: son kayıtlar düzeltilir
    if (Number(numaralar[i][0]) === no) return { satir: i + 2 };
  }
  return null;
}

function sonrakiNo_(sayfa) {
  var son = sayfa.getLastRow();
  if (son < 2) return 1;
  var numaralar = sayfa.getRange(2, 1, son - 1, 1).getValues();
  var enBuyuk = 0;
  numaralar.forEach(function (s) { var n = Number(s[0]); if (n > enBuyuk) enBuyuk = n; });
  return enBuyuk + 1;
}

function gunAnahtari_(t) {
  return Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

var _dosya = null;
function dosya_() {
  if (_dosya) return _dosya;
  var kimlik = String(AYAR.TABLO_ID || '').trim();
  if (kimlik) {
    var e = kimlik.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (e) kimlik = e[1];
    _dosya = SpreadsheetApp.openById(kimlik);
  } else {
    _dosya = SpreadsheetApp.getActiveSpreadsheet();
    if (!_dosya) throw new Error('E-Tablo bulunamadı. AYAR.TABLO_ID alanına tablonun kimliğini yazın.');
  }
  return _dosya;
}

function sayfaAl_(ad) {
  var dosya = dosya_();
  var sayfa = dosya.getSheetByName(ad);
  if (sayfa) return sayfa;

  sayfa = dosya.insertSheet(ad);
  if (ad === 'Envanter') {
    sayfa.appendRow(SUTUNLAR);
    sayfa.setFrozenRows(1);
    sayfa.setFrozenColumns(2);
    sayfa.getRange(1, 1, 1, SUTUNLAR.length)
      .setFontWeight('bold').setBackground('#601040').setFontColor('#ffffff');
    // Kayıt no · Yer kodu · Mekân · Raf · Sıra · Sıra no · Yazar · Başlık · …
    [9, 14, 8, 6, 6, 8, 26, 42, 7, 8, 15, 8, 14, 30, 14, 10, 16]
      .forEach(function (g, i) { sayfa.setColumnWidth(i + 1, g * 7); });
    sayfa.getRange(1, 1, sayfa.getMaxRows(), SUTUNLAR.length).createFilter();
  } else if (ad === 'Kurallar') {
    sayfa.appendRow(['Kod', 'Kategori', 'Açıklama']);
    KURALLAR.forEach(function (k) {
      sayfa.appendRow([k[0], KATEGORILER[k[1]].ad, k[2]]);
    });
    sayfa.setFrozenRows(1);
    sayfa.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#601040').setFontColor('#ffffff');
    sayfa.setColumnWidth(1, 60); sayfa.setColumnWidth(2, 120); sayfa.setColumnWidth(3, 460);
  } else if (ad === 'Kutular') {
    sayfa.appendRow(['Kutu no', 'Kaynak sıra (K1-A01)', 'Yer kodu aralığı', 'Hedef bölüm',
                     'Paketleyen', 'Tarih', 'İçindeki kitap']);
    sayfa.setFrozenRows(1);
    sayfa.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#601040').setFontColor('#ffffff');
    sayfa.setColumnWidth(2, 130); sayfa.setColumnWidth(3, 170);
  }
  return sayfa;
}


/* ═══════════════ FOTOĞRAF ve OCR ═══════════════
   Akış: gönüllü künye sayfasının fotoğrafını çeker → Drive'a yüklenir →
   zamanlayıcı OCR yapar → künye ÖNERİSİ üretilir → koordinatör onay ekranında
   fotoğrafa bakarak onaylar. OCR tek başına künye üretmez; öneri üretir. */

function fotoKlasoru_() {
  var kimlik = String(AYAR.FOTO_KLASOR_ID || '').trim();
  if (kimlik) return DriveApp.getFolderById(kimlik);

  var ad = 'Kitap Künye Fotoğrafları';
  var bulunan = DriveApp.getFoldersByName(ad);
  if (bulunan.hasNext()) return bulunan.next();
  return DriveApp.createFolder(ad);
}

/**
 * Telefondan gelen base64 fotoğrafı Drive'a yazar, satıra bağlar.
 * hangi: 'kunye' (künye sayfası, OCR bundan yapılır) ya da 'kapak' (kitabın kapağı).
 */
function fotoEkle_(no, veri, tur, hangi) {
  no = Number(no);
  if (!no) return { ok: false, error: 'Kayıt numarası yok.' };
  if (!veri) return { ok: false, error: 'Fotoğraf boş geldi.' };

  var bulunan = satirBul_(no);
  if (!bulunan) return { ok: false, error: 'Kayıt bulunamadı.' };

  var kapakMi = String(hangi || 'kunye') === 'kapak';

  // "data:image/jpeg;base64,..." önekini at
  var temiz = String(veri).replace(/^data:[^,]+,/, '');
  var mime = tur || 'image/jpeg';
  var ad = (kapakMi ? 'kapak-' : 'kunye-') + no + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(temiz), mime, ad);

  var dosya = fotoKlasoru_().createFile(blob);
  try { dosya.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (h) { /* alan ilkeleri izin vermiyorsa kayıt yine de sürer */ }

  var sayfa = sayfaAl_('Envanter');
  sayfa.getRange(bulunan.satir, kapakMi ? S.kapak : S.foto).setValue(dosya.getUrl());

  // OCR yalnızca bir kez sıraya girsin: künye varsa ondan, yoksa kapaktan okunur.
  var durum = sayfa.getRange(bulunan.satir, S.ocrDurum).getValue();
  if (!durum) sayfa.getRange(bulunan.satir, S.ocrDurum).setValue(AYAR.OCR_ACIK ? 'bekliyor' : '—');

  return { ok: true, no: no, hangi: kapakMi ? 'kapak' : 'kunye', url: dosya.getUrl() };
}

/**
 * Zamanlayıcıdan çalışır: "bekliyor" durumundaki fotoğrafları OCR'dan geçirir.
 * Kurulumda zamanlayiciKur() ile 5 dakikada bir çalışacak biçimde bağlanır.
 */
function ocrKuyruguIsle() {
  if (!AYAR.OCR_ACIK) return;

  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return;

  var durumlar = sayfa.getRange(2, S.ocrDurum, son - 1, 1).getValues();
  var islenen = 0;

  for (var i = 0; i < durumlar.length && islenen < AYAR.OCR_TOPLU; i++) {
    if (String(durumlar[i][0]) !== 'bekliyor') continue;
    var satir = i + 2;
    // Künye sayfası varsa ondan okunur; yoksa kapaktan (eski kitaplarda künye sayfası olmaz).
    var url = String(sayfa.getRange(satir, S.foto).getValue() || '');
    if (!url) url = String(sayfa.getRange(satir, S.kapak).getValue() || '');
    if (!url) { sayfa.getRange(satir, S.ocrDurum).setValue('fotoğraf yok'); continue; }

    try {
      var kimlik = (url.match(/[-\w]{25,}/) || [])[0];
      var metin = ocrYap_(DriveApp.getFileById(kimlik));
      var oneri = kunyeCikar_(metin);

      sayfa.getRange(satir, S.oneriBaslik, 1, 4).setValues([[
        oneri.baslik, oneri.yazar, oneri.yil, oneri.yayinevi]]);
      sayfa.getRange(satir, S.ocrMetin).setValue(metin.slice(0, 4000));
      sayfa.getRange(satir, S.ocrDurum).setValue('öneri hazır');
      islenen++;
    } catch (h) {
      sayfa.getRange(satir, S.ocrDurum).setValue('OCR hatası: ' + String(h.message).slice(0, 90));
      Logger.log('OCR hatası (satır ' + satir + '): ' + h.message);
      islenen++;
    }
  }
}

/** Drive'ın kendi OCR'ı ile görselden metin çıkarır. Geçici Doküman silinir. */
function ocrYap_(dosya) {
  var blob = dosya.getBlob();
  var gecici = null, kimlik = null;

  try {                                   // Drive API v2
    gecici = Drive.Files.insert({ title: 'ocr-gecici' }, blob, { ocr: true, ocrLanguage: 'tr' });
    kimlik = gecici.id;
  } catch (h1) {                          // Drive API v3
    gecici = Drive.Files.create(
      { name: 'ocr-gecici', mimeType: 'application/vnd.google-apps.document' },
      blob, { ocrLanguage: 'tr' });
    kimlik = gecici.id;
  }
  if (!kimlik) throw new Error('OCR sonucu alınamadı. Drive API hizmeti ekli mi?');

  var metin = '';
  try { metin = DocumentApp.openById(kimlik).getBody().getText(); }
  finally { try { DriveApp.getFileById(kimlik).setTrashed(true); } catch (h2) {} }
  return metin;
}

/**
 * OCR metninden künye ÖNERİSİ çıkarır. Kesin sonuç değildir; koordinatör onaylar.
 * Sezgiler: yayınevi anahtar kelimeleri, 4 haneli yıl, satır sırası.
 */
function kunyeCikar_(metin) {
  var ham = String(metin || '').replace(/\r/g, '');
  var sonuc = { baslik: '', yazar: '', yil: '', yayinevi: '' };

  var duzelt = function (b) { return b.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim(); };
  var dolu = function (b) { return b.length > 1; };

  /* Tarama çıktısı iki biçimde gelebilir:
     - paragraflar boş satırla ayrılmış  → başlık iki satıra bölünmüşse birleşik kalsın diye
       parçalar kullanılır
     - her şey alt alta, boş satır yok   → o zaman satır satır çalışılır
     İkisini de desteklemek şart; gerçek künye sayfalarında ikisi de görülüyor. */
  var parcalar = ham.split(/\n\s*\n/).map(duzelt).filter(dolu);
  var satirlar = ham.split(/\n/).map(duzelt).filter(dolu);
  var adaylar = (parcalar.length >= 2) ? parcalar : satirlar;
  if (!adaylar.length) return sonuc;

  // Yıl: 1800–2099; birden fazlaysa en büyüğü genelde basım yılıdır
  var yillar = ham.match(/\b(1[89]\d{2}|20\d{2})\b/g);
  if (yillar) sonuc.yil = yillar.map(Number).sort(function (a, b) { return b - a; })[0];

  /* Türkçe büyük harf tuzağı: "KİTAP" ile "kitap", "BASIMEVİ" ile "basımevi"
     normal küçültmeyle eşleşmez (noktalı İ / noktasız ı). Künye sayfalarında
     yayınevi çoğunlukla büyük harfle yazılı olduğu için bu tuzağa düşülüyor.
     Bu yüzden karşılaştırmadan önce metni sadeleştiriyoruz. */
  var sade = function (b) {
    return String(b)
      .replace(/[İIıi]/g, 'i').replace(/[Ğğ]/g, 'g').replace(/[Şş]/g, 's')
      .replace(/[Öö]/g, 'o').replace(/[Üü]/g, 'u').replace(/[Çç]/g, 'c')
      .toLowerCase();
  };
  var yayinci = function (b) {
    return /(yayin|yayinev|yayincilik|nesriyat|kitabevi|kitapevi|kitap\b|basimevi|matbaa|press|verlag|editions|university)/.test(sade(b));
  };
  // Künyede işe yaramayan satırlar
  var eleme = function (b) {
    return /^(isbn|issn|copyright|©|all rights|tum haklari|sertifika|birinci|ikinci|ucuncu|dorduncu|\d+\.?\s*bas(ki|im))/.test(sade(b));
  };
  // Rol satırları: yazar sanılmamalı
  var rol = function (b) {
    return /^(ceviren|cev\.|hazirlayan|haz\.|derleyen|editor|yayina hazirlayan|yayima hazirlayan|son okuma|redaksiyon|kapak|tasarim|sayfa duzeni|dizgi|baski|basim ve cilt|baski ve cilt|cilt|sertifika)\b/.test(sade(b));
  };

  /* Çoğu yeni Türkçe kitapta künye sayfası etiketlidir:
       ESER ADI ... / YAZAR ADI ... / ÇEVİREN ... / BASKI Nisan 2023
     Etiket varsa tahmine gerek yok, doğrudan okunur. sade() harf sayısını
     değiştirmediği için eşleşmenin uzunluğu özgün satırda da aynı yere düşer. */
  var etiketOku = function (satir, kalip) {
    var m = kalip.exec(sade(satir));
    if (!m) return '';
    return satir.slice(m[0].length).replace(/^[\s:\-–—]+/, '').trim();
  };

  satirlar.forEach(function (satir) {
    var d;
    if (!sonuc.baslik) {
      d = etiketOku(satir, /^(eser adi|eserin adi|kitabin adi|kitap adi|kitabin ismi)\s*[:\-–—]?\s*/);
      if (d) sonuc.baslik = d.slice(0, 200);
    }
    if (!sonuc.yazar) {
      d = etiketOku(satir, /^(yazar adi|yazarin adi|yazari|yazar)\s*[:\-–—]?\s*/);
      if (d && d.split(/\s+/).length <= 5) sonuc.yazar = d;
    }
    if (!sonuc.yayinevi) {
      d = etiketOku(satir, /^(yayinevi|yayin evi|yayina hazirlayan kurum)\s*[:\-–—]?\s*/);
      if (d) sonuc.yayinevi = d;
    }
  });

  var temiz = adaylar.filter(function (b) {
    if (eleme(b) || rol(b)) return false;
    if (/^[\d\s.,;:\-–—()\/]+$/.test(b)) return false;             // salt sayı/işaret
    // Sayfa kenarından sızmış kırık kelimeler: hiç büyük harf içermeyen kısa parçalar
    if (b.length < 15 && !/[A-ZÇĞİÖŞÜ]/.test(b)) return false;
    return true;
  });
  if (!temiz.length) return sonuc;

  /* Başlık: büyük harfle yazılmış olan öne çıkar (Türkçe künyelerde yaygın),
     eşitlikte uzun olan seçilir. */
  var buyukMu = function (b) {
    var harf = b.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
    return harf.length > 2 && !/[a-zçğıöşü]/.test(harf);
  };
  var puan = function (b) {
    return (buyukMu(b) ? 1000 : 0) + Math.min(b.length, 120) - (yayinci(b) ? 500 : 0);
  };
  var baslik = temiz[0];
  temiz.forEach(function (b) { if (puan(b) > puan(baslik)) baslik = b; });
  if (sonuc.baslik) baslik = sonuc.baslik;          // etiketten okunduysa o geçerli

  /* Parçalar kullanıldıysa ve seçilen parça aşırı uzunsa, muhtemelen başlıkla
     birlikte başka satırlar da birleşmiştir; o parçayı satırlarına bölüp en iyisini al. */
  if (baslik.length > 70) {
    var altlar = baslik.split(/\s{2,}/);
    if (altlar.length < 2) {
      altlar = satirlar.filter(function (s) { return baslik.indexOf(s) >= 0; });
    }
    if (altlar.length > 1) {
      var en = altlar[0];
      altlar.forEach(function (b) { if (puan(b) > puan(en)) en = b; });
      if (en.length >= 3) baslik = en;
    }
  }
  if (baslik.length >= 3) sonuc.baslik = baslik.slice(0, 200);

  var kalan = temiz.filter(function (b) { return b.indexOf(baslik) < 0; });

  // Yayınevi: anahtar kelime geçen en son aday (künyede genelde en altta durur)
  for (var i = kalan.length - 1; i >= 0 && !sonuc.yayinevi; i--) {
    if (yayinci(kalan[i]) && kalan[i].length < 90) {
      sonuc.yayinevi = kalan[i]
        .replace(/[\s,;.\-–—]*\b(1[89]\d{2}|20\d{2})\b\s*$/, '')   // sondaki yılı at
        .replace(/[\s,;.\-–—]+$/, '').trim();
      kalan.splice(i, 1);
      break;
    }
  }

  /* Yazar: 2–4 kelime, rakamsız, her kelime en az iki harf.
     Unvanlı ("Prof. Dr.") olan öne alınır. */
  var unvan = /(^|\s)(prof|doç|doc|dr|yrd|öğr|ord)\.?(?=\s|$)/gi;
  var enIyi = sonuc.yazar || '', unvanliBulundu = !!sonuc.yazar;

  kalan.forEach(function (b) {
    if (yayinci(b)) return;
    var unvanli = unvan.test(b);
    unvan.lastIndex = 0;
    var t = b.replace(unvan, '').replace(/\s+/g, ' ').trim();
    var kelimeler = t.split(' ').filter(Boolean);
    if (kelimeler.length < 2 || kelimeler.length > 4) return;
    if (/\d/.test(t) || t.length > 45) return;
    // "İ STANBUL" gibi OCR kırılmalarını ele: her kelime en az iki harf olmalı
    var saglam = kelimeler.every(function (k) { return k.replace(/[^\wçğıöşüÇĞİÖŞÜ]/g, '').length >= 2; });
    if (!saglam) return;
    if (unvanli && !unvanliBulundu) { enIyi = t; unvanliBulundu = true; return; }
    if (!unvanliBulundu && !enIyi) enIyi = t;
  });
  sonuc.yazar = enIyi;

  return sonuc;
}

/* ═══════════════ ONAY EKRANI ═══════════════ */

/** Fotoğrafı olup henüz onaylanmamış kayıtları döner. */
function onayBekleyen_(adet) {
  adet = Math.min(Number(adet) || 25, 60);
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return { ok: true, kayitlar: [], kalan: 0 };

  var satirlar = sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues();
  var bekleyen = satirlar.filter(function (s) {
    return (s[S.foto - 1] || s[S.kapak - 1]) && !s[S.onay - 1];
  });

  var liste = bekleyen.slice(0, adet).map(function (s) {
    return {
      no: s[S.no - 1], yer: s[S.yer - 1],
      yazar: s[S.yazar - 1], baslik: s[S.baslik - 1], yil: s[S.yil - 1],
      kategori: s[S.kategori - 1], kural: s[S.kural - 1], durum: s[S.durum - 1],
      not: s[S.not - 1], kaydeden: s[S.kaydeden - 1],
      foto: s[S.foto - 1], fotoId: (String(s[S.foto - 1]).match(/[-\w]{25,}/) || [''])[0],
      kapak: s[S.kapak - 1], kapakId: (String(s[S.kapak - 1]).match(/[-\w]{25,}/) || [''])[0],
      ocrDurum: s[S.ocrDurum - 1], ocrMetin: s[S.ocrMetin - 1],
      oneriBaslik: s[S.oneriBaslik - 1], oneriYazar: s[S.oneriYazar - 1],
      oneriYil: s[S.oneriYil - 1], oneriYayinevi: s[S.oneriYayinevi - 1]
    };
  });
  return { ok: true, kayitlar: liste, kalan: bekleyen.length };
}

/**
 * Katalog: kaydedilmiş kitapları listeler. Varsayılan olarak yalnızca onaylanmışları.
 * Zayıf bağlantı için sayfa sayfa döner; arama ve süzme sunucuda yapılır ki
 * telefona binlerce satır inmesin.
 *
 * secenek: { yalnizOnayli, ara, kategori, mekan, sirala:'yeni'|'yer', bas, adet }
 */
function katalog_(g) {
  g = g || {};
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return { ok: true, kayitlar: [], toplam: 0, bas: 0 };

  var satirlar = sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues();
  var yalnizOnayli = g.yalnizOnayli !== false;          // varsayılan: onaylananlar
  var ara = String(g.ara || '').trim().toLocaleLowerCase('tr');
  var kategori = String(g.kategori || '');
  var mekan = String(g.mekan || '');

  var liste = [];
  satirlar.forEach(function (s) {
    if (!s[S.no - 1]) return;
    if (yalnizOnayli && !s[S.onay - 1]) return;
    if (kategori && String(s[S.kategori - 1]) !== kategori) return;
    if (mekan && String(s[S.mekan - 1]) !== mekan) return;
    if (ara) {
      var havuz = [s[S.baslik - 1], s[S.yazar - 1], s[S.yer - 1], s[S.not - 1], s[S.kutu - 1]]
        .join(' ').toLocaleLowerCase('tr');
      if (havuz.indexOf(ara) < 0) return;
    }
    liste.push({
      no: s[S.no - 1], yer: s[S.yer - 1], mekan: s[S.mekan - 1],
      yazar: s[S.yazar - 1], baslik: s[S.baslik - 1], yil: s[S.yil - 1],
      nusha: s[S.nusha - 1], kategori: s[S.kategori - 1], kural: s[S.kural - 1],
      durum: s[S.durum - 1], not: s[S.not - 1], kaydeden: s[S.kaydeden - 1],
      kutu: s[S.kutu - 1], onay: s[S.onay - 1],
      foto: s[S.foto - 1], fotoId: (String(s[S.foto - 1]).match(/[-\w]{25,}/) || [''])[0],
      kapak: s[S.kapak - 1], kapakId: (String(s[S.kapak - 1]).match(/[-\w]{25,}/) || [''])[0]
    });
  });

  if (String(g.sirala || 'yeni') === 'yer') {
    liste.sort(function (a, b) { return String(a.yer).localeCompare(String(b.yer)); });
  } else {
    liste.sort(function (a, b) { return Number(b.no) - Number(a.no); });   // en yeni önce
  }

  var bas = Math.max(0, Number(g.bas) || 0);
  var adet = Math.min(Math.max(Number(g.adet) || 60, 1), 300);
  return { ok: true, toplam: liste.length, bas: bas,
           kayitlar: liste.slice(bas, bas + adet) };
}

/**
 * Durum panosu için bütün sayılar tek geçişte hesaplanır.
 * Binlerce satırda bile tek okuma yaptığı için hızlıdır.
 */
function durum_() {
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  var bos = {
    ok: true, toplam: 0, onayli: 0, onayBekleyen: 0, kunyeEksik: 0, tamam: 0,
    fotoli: 0, kapakli: 0, kategori: {}, fiziksel: {}, ocr: {},
    gunluk: [], kisiler: [], siralar: [], hedef: Number(AYAR.HEDEF_KITAP || 0),
    hesaplandi: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMMM yyyy HH:mm')
  };
  if (son < 2) return bos;

  var satirlar = sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues();
  var d = bos;
  var gunler = {}, kisiler = {}, siralar = {};
  var bugunKey = gunAnahtari_(new Date());

  satirlar.forEach(function (s) {
    if (!s[S.no - 1]) return;
    d.toplam++;

    var onay = String(s[S.onay - 1] || '');
    var foto = String(s[S.foto - 1] || ''), kapak = String(s[S.kapak - 1] || '');
    var baslik = String(s[S.baslik - 1] || '');
    var bekleyenKunye = /künye fotoğraftan/i.test(baslik);

    if (foto) d.fotoli++;
    if (kapak) d.kapakli++;

    if (onay) d.onayli++;
    else if (foto || kapak) d.onayBekleyen++;
    else if (bekleyenKunye) d.kunyeEksik++;        // ne künye var ne fotoğraf
    else d.tamam++;                                 // rafta elle yazılmış, onaya gerek yok

    var kat = String(s[S.kategori - 1] || '—');
    d.kategori[kat] = (d.kategori[kat] || 0) + 1;

    var fiz = String(s[S.durum - 1] || '—');
    d.fiziksel[fiz] = (d.fiziksel[fiz] || 0) + 1;

    var od = String(s[S.ocrDurum - 1] || '');
    if (foto || kapak) {
      var anahtar = /hata/i.test(od) ? 'hata' : (od || 'yok');
      d.ocr[anahtar] = (d.ocr[anahtar] || 0) + 1;
    }

    var t = s[S.tarih - 1];
    var gun = (t instanceof Date) ? gunAnahtari_(t) : '';
    if (gun) gunler[gun] = (gunler[gun] || 0) + 1;

    var ad = String(s[S.kaydeden - 1] || '—').trim() || '—';
    if (!kisiler[ad]) kisiler[ad] = { ad: ad, bugun: 0, toplam: 0 };
    kisiler[ad].toplam++;
    if (gun === bugunKey) kisiler[ad].bugun++;

    var sira = rafAnahtari_(s[S.mekan - 1], s[S.raf - 1], s[S.sira - 1]);
    if (sira) {
      if (!siralar[sira]) siralar[sira] = { sira: sira, sayi: 0, sonNo: 0, son: '' };
      siralar[sira].sayi++;
      var n = Number(s[S.siraNo - 1]) || 0;
      if (n > siralar[sira].sonNo) siralar[sira].sonNo = n;
      if (gun > siralar[sira].son) siralar[sira].son = gun;
    }
  });

  // Son 14 gün — kayıt olmayan günler de 0 olarak görünsün ki grafik yalan söylemesin
  var bugun = new Date();
  for (var i = 13; i >= 0; i--) {
    var g = new Date(bugun.getTime() - i * 86400000);
    var k = gunAnahtari_(g);
    d.gunluk.push({ gun: k, sayi: gunler[k] || 0 });
  }

  d.kisiler = Object.keys(kisiler).map(function (a) { return kisiler[a]; })
    .sort(function (a, b) { return b.toplam - a.toplam; });
  d.siralar = Object.keys(siralar).map(function (a) { return siralar[a]; })
    .sort(function (a, b) { return String(a.sira).localeCompare(String(b.sira)); });

  return d;
}

/** Onay ekranından gelen künyeyi ana alanlara yazar. */
function onayla_(no, k) {
  no = Number(no);
  var bulunan = satirBul_(no);
  if (!bulunan) return { ok: false, error: 'Kayıt bulunamadı.' };

  var baslik = String(k.baslik || '').trim();
  if (!baslik) return { ok: false, error: 'Başlık boş olamaz.' };

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var sayfa = sayfaAl_('Envanter');
    sayfa.getRange(bulunan.satir, S.yazar).setValue(String(k.yazar || '').trim());
    sayfa.getRange(bulunan.satir, S.baslik).setValue(baslik);
    var yil = String(k.yil || '').trim();
    sayfa.getRange(bulunan.satir, S.yil).setValue(/^\d{3,4}$/.test(yil) ? Number(yil) : '');
    if (k.not != null) sayfa.getRange(bulunan.satir, S.not).setValue(String(k.not).trim());
    sayfa.getRange(bulunan.satir, S.onay).setValue(
      'Onaylandı — ' + String(k.onaylayan || '').trim() + ' · ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd.MM.yyyy HH:mm'));
    return { ok: true, no: no };
  } finally {
    kilit.releaseLock();
  }
}

/** OCR zamanlayıcısını kurar (5 dakikada bir). Kurulumda bir kez çalışır. */
function zamanlayiciKur() {
  var varOlan = ScriptApp.getProjectTriggers();
  for (var i = 0; i < varOlan.length; i++) {
    if (varOlan[i].getHandlerFunction() === 'ocrKuyruguIsle') return;
  }
  ScriptApp.newTrigger('ocrKuyruguIsle').timeBased().everyMinutes(5).create();
  Logger.log('OCR zamanlayıcısı kuruldu (5 dakikada bir).');
}

/* ═══════════════ ÖZET ═══════════════ */

/** "Özet" sayfasını yeniden hesaplar. Menüden ya da elle çalıştırılır. */
function ozetiGuncelle() {
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  var satirlar = son < 2 ? [] : sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues()
    .filter(function (s) { return s[0]; });

  var say = function (sutun, deger) {
    return satirlar.filter(function (s) { return s[sutun - 1] === deger; }).length;
  };
  var kayitli = satirlar.length;
  var belirsiz = say(S.kategori, KATEGORILER.belirsiz.ad);

  // Hangi sırada kaç kitap kaydedildi (rafın ne kadarı bitti sorusu)
  var siralar = {};
  satirlar.forEach(function (s) {
    var a = rafAnahtari_(s[S.mekan - 1], s[S.raf - 1], s[S.sira - 1]);
    if (a) siralar[a] = (siralar[a] || 0) + 1;
  });

  var veri = [
    [AYAR.KURUM + ' — Envanter Özeti', ''],
    ['Son hesaplama: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMMM yyyy HH:mm'), ''],
    ['', ''],
    ['İLERLEME', ''],
    ['Kaydedilen kitap', kayitli],
    ['Bugün kaydedilen', satirlar.filter(function (s) {
      var t = s[S.tarih - 1];
      return t instanceof Date && gunAnahtari_(t) === gunAnahtari_(new Date());
    }).length],
    ['Bitirilen sıra sayısı', Object.keys(siralar).length],
    ['', ''],
    ['KARAR DAĞILIMI', ''],
    ['Gidecek', say(S.kategori, KATEGORILER.gidecek.ad)],
    ['Gitse de olur', say(S.kategori, KATEGORILER.belki.ad)],
    ['Gitmeyecek', say(S.kategori, KATEGORILER.gitmeyecek.ad)],
    ['Belirsiz', belirsiz],
    ['Belirsiz oranı', kayitli ? Math.round(belirsiz / kayitli * 100) + '%' : '—'],
    ['', ''],
    ['FİZİKSEL DURUM', ''],
    ['Sağlam', say(S.durum, 'Sağlam')],
    ['Yıpranmış', say(S.durum, 'Yıpranmış')],
    ['Küflü/böcekli — ayrı alanda mı?', say(S.durum, 'Küflü/böcekli')],
    ['', ''],
    ['SIRALAR (kaç kitap kaydedildi)', ''],
  ];

  Object.keys(siralar).sort().forEach(function (a) { veri.push([a, siralar[a]]); });
  veri.push(['', '']);
  veri.push(['KAYDEDENLER (bugün)', '']);

  // Bugün kim kaç kayıt girmiş
  var bugun = {};
  satirlar.forEach(function (s) {
    var t = s[S.tarih - 1];
    if (!(t instanceof Date) || gunAnahtari_(t) !== gunAnahtari_(new Date())) return;
    var ad = String(s[S.kaydeden - 1] || '—').trim();
    bugun[ad] = (bugun[ad] || 0) + 1;
  });
  Object.keys(bugun).sort().forEach(function (ad) { veri.push([ad, bugun[ad]]); });

  var ozet = dosya_().getSheetByName('Özet') || dosya_().insertSheet('Özet', 0);
  ozet.clear();
  ozet.getRange(1, 1, veri.length, 2).setValues(veri);
  ozet.getRange(1, 1).setFontSize(15).setFontWeight('bold').setFontColor('#601040');
  ozet.getRange(2, 1).setFontSize(9).setFontColor('#74686e');
  ozet.getRange(1, 2, veri.length, 1).setHorizontalAlignment('right').setFontWeight('bold');
  veri.forEach(function (s, i) {
    if (s[0] && s[1] === '' && s[0] === s[0].toUpperCase()) {
      ozet.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#f3eff1');
    }
  });
  ozet.setColumnWidth(1, 300); ozet.setColumnWidth(2, 90);
  try { dosya_().toast('Özet güncellendi.', 'Kitap Envanteri', 5); } catch (h) {}
}

/**
 * Başlık satırını güncel sütun listesiyle eşitler.
 * Yeni sütun eklendiğinde (örn. "Kapak") mevcut tabloya da başlığını yazar.
 * Yalnızca 1. satırı değiştirir; veriye dokunmaz.
 */
function basliklariOnar_() {
  var sayfa = sayfaAl_('Envanter');
  var mevcut = sayfa.getRange(1, 1, 1, sayfa.getLastColumn() || 1).getValues()[0];
  var ayni = mevcut.length === SUTUNLAR.length &&
    SUTUNLAR.every(function (b, i) { return String(mevcut[i]) === b; });
  if (ayni) return;

  sayfa.getRange(1, 1, 1, SUTUNLAR.length).setValues([SUTUNLAR])
    .setFontWeight('bold').setBackground('#601040').setFontColor('#ffffff');
  Logger.log('Başlık satırı güncellendi.');
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Kitap Envanteri')
      .addItem('Özeti yenile', 'ozetiGuncelle')
      .addToUi();
  } catch (h) {}
}

/** Kurulumda bir kez çalıştırın. */
function kurulum() {
  var tablo = dosya_();
  sayfaAl_('Envanter');
  basliklariOnar_();
  sayfaAl_('Kurallar');
  sayfaAl_('Kutular');
  ozetiGuncelle();
  if (AYAR.OCR_ACIK) {
    try { zamanlayiciKur(); } catch (h) { Logger.log('Zamanlayıcı kurulamadı: ' + h.message); }
    try { Logger.log('Fotoğraf klasörü: ' + fotoKlasoru_().getUrl()); }
    catch (h) { Logger.log('Fotoğraf klasörü açılamadı: ' + h.message); }
  }
  try {
    var v = ScriptApp.getProjectTriggers();
    var varMi = false;
    for (var i = 0; i < v.length; i++) if (v[i].getHandlerFunction() === 'onOpen') varMi = true;
    if (!varMi) ScriptApp.newTrigger('onOpen').forSpreadsheet(tablo).onOpen().create();
  } catch (h) { Logger.log('Menü tetikleyicisi eklenemedi: ' + h.message); }
  Logger.log('Kurulum tamam: ' + tablo.getUrl());
}
