/**
 * Tarih Vakfı Kütüphanesi — Kitap Envanteri
 *
 * ⚠️  BU DOSYA HERKESE AÇIK BİR DEPODA DURUYOR.
 *     Gerçek şifreleri buraya yazmayın. Şifreler yalnızca Apps Script'teki
 *     çalışan kopyada bulunur; buradaki değerler yer tutucudur.
 *
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
  CALISMA_SIFRESI: 'BURAYA_CALISMA_SIFRESI',

  // Koordinatör şifresi: künye onay ekranı ve katalog bunu ister.
  // Çalışma şifresini bilen gönüllü bu iki ekranı açamaz.
  // Boş bırakırsanız ayrım kalkar, ikisi de çalışma şifresiyle açılır.
  KOORDINATOR_SIFRESI: 'BURAYA_KOORDINATOR_SIFRESI',

  // Formda kaç son kayıt görünsün (düzeltme/silme için)
  SON_KAYIT: 8,

  // Durum panosundaki hedef çubuğu için: yeni binaya kaç kitap sığacak?
  // Bilmiyorsanız 0 bırakın, çubuk gizlenir. (Raf metresi × 30–35 kitap)
  HEDEF_KITAP: 0,

  // ── Yer kodu ────────────────────────────────────────────────────
  // Kitabın nereden geldiğini gösteren kod:  G-A01-007
  //   G   → mekân (kat/oda)      A → raf (kitaplık)
  //   01  → sıra (rafın gözü)  007 → o sıradaki kaçıncı kitap
  //
  // Kütüphane tek mekândaysa listeyi tek satır bırakın, kod A01-007 olur.
  // Kodları kısa tutun; gönüllü menüden seçecek, yazmayacak.
  MEKANLAR: [
    { kod: 'G', ad: 'Giriş Kat' },
    { kod: 'U', ad: 'Üst Kat' },
    { kod: 'D', ad: 'Depo' },
  ],

  // Her mekânda kullanılan raf (kitaplık) harfleri
  RAF_HARFLERI: 'ABCDEFGHIJKL',

  // Bir rafta en fazla kaç sıra (göz) var
  SIRA_SAYISI: 8,

  // Bir gönüllüye verilen sıra kaç saat onun adına ayrılı kalsın?
  // Süre dolunca sıra başkasına önerilebilir hâle gelir (yarım kalmışsa
  // "yarım" olarak). Yarım günlük vardiyalar için 8 saat uygundur.
  SIRA_TUTMA_SAAT: 8,

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

/* Sınıflandırması henüz yapılmamış kaydın kategori sütununda görünen değer. */
var SINIFLANDIRILMADI = 'Sınıflandırılmadı';

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
                'Öneri yayınevi', 'OCR metni', 'Onay', 'Kapak',
                'İstemci no', 'Silindi'];

// Sık kullanılan sütun numaraları (1'den başlar)
var S = {
  no: 1, yer: 2, mekan: 3, raf: 4, sira: 5, siraNo: 6,
  yazar: 7, baslik: 8, yil: 9, nusha: 10, kategori: 11, kural: 12,
  durum: 13, not: 14, kaydeden: 15, kutu: 16, tarih: 17,
  foto: 18, ocrDurum: 19, oneriBaslik: 20, oneriYazar: 21, oneriYil: 22,
  oneriYayinevi: 23, ocrMetin: 24, onay: 25, kapak: 26,
  istemci: 27, silindi: 28
};

/* 'Sıralar' sayfası: her sıranın tek satırlık hikâyesi — kime verildi, kim
   bitirdi, sayım tuttu mu. */
var SIRA_SUTUNLARI = ['Sıra', 'Raftaki kitap', 'Kayıtlı cilt', 'Bitiren', 'Bitiş tarihi',
                      'Not', 'Sonuç', 'Kayıt sayısı', 'Alan', 'Alma saati'];
var SR = { sira: 1, raftaki: 2, cilt: 3, bitiren: 4, tarih: 5, not: 6,
           sonuc: 7, kayitSayisi: 8, alan: 9, almaSaati: 10 };

/* Silinen kayıt satırdan atılmaz, işaretlenir: kayıt no ve sıra no yeniden
   kullanılmasın, geç gelen fotoğraf yanlış kitaba yapışmasın diye. */
function silinmis_(satir) { return !!satir[S.silindi - 1]; }

/**
 * Türkçe büyük harf tuzağı: /kitap/i kalıbı "KİTAP" ile eşleşmez (noktalı İ).
 * Karşılaştırmadan önce metin bununla sadeleştirilir.
 */
function sade_(b) {
  return String(b == null ? '' : b)
    .replace(/[İIıi]/g, 'i').replace(/[Ğğ]/g, 'g').replace(/[Şş]/g, 's')
    .replace(/[Öö]/g, 'o').replace(/[Üü]/g, 'u').replace(/[Çç]/g, 'c')
    .toLowerCase();
}

/* ═══════════════ KARAR ÖNERİSİ ═══════════════
   Koordinatör kararı yine kendi veriyor; sistem yalnızca hazır getiriyor.
   Amaç 3000 kararı 3000 düşünmeye değil, 3000 dokunuşa indirmek — ve
   aynı öneriyi taşıyan kayıtları tek dokunuşta onaylatabilmek. */

/* Anahtar kelimeler. Sırası önemli: yukarıdaki eşleşirse aşağıya bakılmaz. */
var ONERI_KURALLARI = [
  { kural: 'Y4', guven: 'yuksek', sebep: 'Eski harfli / Osmanlıca ibare',
    kalip: /(osmanlica|eski harf|matbaa-i|matbaai|dersaadet|hicri|rumi|mekteb-i|nezaret)/ },
  { kural: 'Y1', guven: 'yuksek', sebep: 'Tarih Vakfı yayını',
    kalip: /(tarih vakfi|tarih vakif|history foundation)/ },
  { kural: 'Y5', guven: 'yuksek', sebep: 'Rapor / tez / bülten / katalog',
    kalip: /(rapor|raporu|tez|tezi|doktora tezi|yuksek lisans|bulten|bulteni|sempozyum|kongre bildiri|bildiriler)/ },
  { kural: 'K6', guven: 'yuksek', sebep: 'Tanıtım / promosyon malzemesi',
    kalip: /(tanitim brosur|brosur|prospektus|reklam|promosyon|fiyat listesi|urun katalogu)/ },
  { kural: 'K1', guven: 'yuksek', sebep: 'Ders / sınav kitabı',
    kalip: /(ders kitabi|ders notlari|calisma kitabi|soru bankasi|konu anlatimli|cozumlu test|oss|ygs|lgs|yks|tyt|ayt|kpss|deneme sinavi|sinava hazirlik|ogrenci kilavuzu)/ },
  { kural: 'K2', guven: 'orta', sebep: 'Mevzuat / yıllık / katalog fazlası',
    kalip: /(mevzuat|kanun metni|resmi gazete|yillik|yilligi|almanak|istatistik yilligi|telefon rehberi)/ },
  { kural: 'Y2', guven: 'orta', sebep: 'Alan içi: toplumsal / kent tarihi, bellek',
    kalip: /(osmanli|cumhuriyet|toplumsal tarih|kent tarihi|sehir tarihi|sozlu tarih|bellek|arsiv|belgeler|iktisat tarihi|ekonomik tarih|sosyal tarih|istanbul tarihi|anadolu|tanzimat|mesrutiyet|milli mucadele)/ },
  { kural: 'S2', guven: 'orta', sebep: 'Genel başvuru kaynağı',
    kalip: /(ansiklopedi|sozluk|sozlugu|dictionary|encyclopedia|el kitabi|kilavuz|rehber|bibliyografya)/ },
];

/**
 * Bir kayda kategori + kural önerir.
 * Öneri yoksa boş döner; koordinatör kendisi seçer.
 */
function kararOner_(k) {
  var yil = Number(k.yil) || 0;
  var nusha = Number(k.nusha) || 1;
  var durum = String(k.durum || '');

  // 1) Sayıdan gelen kesin kurallar — metne bakmaya gerek yok.
  if (nusha > 3) {
    return { kural: 'K3', kategori: 'gitmeyecek', guven: 'yuksek',
             sebep: nusha + ' nüsha — üçten fazlasının fazlası' };
  }
  if (nusha === 2 || nusha === 3) {
    return { kural: 'S1', kategori: 'belki', guven: 'yuksek',
             sebep: nusha + ' nüsha — ikinci/üçüncü kopya' };
  }
  if (yil && yil < 1950) {
    return { kural: 'Y4', kategori: 'gidecek', guven: 'yuksek',
             sebep: yil + ' baskısı — 1950 öncesi' };
  }

  // 2) Metinden gelen kurallar.
  var havuz = sade_([k.baslik, k.yazar, k.oneriBaslik, k.oneriYazar,
                     k.oneriYayinevi, String(k.ocrMetin || '').slice(0, 600),
                     k.not].filter(Boolean).join(' | '));

  for (var i = 0; i < ONERI_KURALLARI.length; i++) {
    var o = ONERI_KURALLARI[i];
    if (o.kalip.test(havuz)) {
      var kat = kuralinKategorisi_(o.kural);
      if (kat) return { kural: o.kural, kategori: kat, guven: o.guven, sebep: o.sebep };
    }
  }

  // 3) Ağır hasarlı — "kolay bulunabilir" bilinemez, o yüzden yalnızca düşük güven.
  if (durum === 'Küflü/böcekli') {
    return { kural: 'K4', kategori: 'gitmeyecek', guven: 'dusuk',
             sebep: 'Küflü/böcekli işaretlenmiş — kolay bulunabilir mi, siz karar verin' };
  }

  return { kural: '', kategori: '', guven: '', sebep: '' };
}

function kuralinKategorisi_(kod) {
  for (var i = 0; i < KURALLAR.length; i++) {
    if (KURALLAR[i][0] === kod) return KURALLAR[i][1];
  }
  return '';
}

/* ═══════════════ YER KODU ═══════════════ */

function pad_(sayi, hane) {
  var m = String(sayi);
  while (m.length < hane) m = '0' + m;
  return m;
}

/** 'G-A01' — bir sıranın (rafın gözünün) anahtarı. Mekân tek ise 'A01'. */
function rafAnahtari_(mekan, raf, sira) {
  var m = String(mekan || '').trim().toUpperCase();
  var kod = String(raf || '').trim().toUpperCase() + pad_(Number(sira) || 0, 2);
  return m ? m + '-' + kod : kod;
}

/** 'G-A01-007' — tek bir kitabın yer kodu. */
function yerKodu_(mekan, raf, sira, siraNo) {
  return rafAnahtari_(mekan, raf, sira) + '-' + pad_(Number(siraNo) || 0, 3);
}

/**
 * Bir sırada kullanılmış numaraları döner.
 * Telefon çevrimdışıyken numarayı kendi verir; sunucu burada doğrular.
 */
function siraKullanimi_(sayfa, anahtar) {
  var son = sayfa.getLastRow();
  var sonuc = { sonNo: 0, adet: 0, cilt: 0, kullanilan: {}, sonCalisan: '', sonTarih: '' };
  if (son < 2) return sonuc;

  var veri = sayfa.getRange(2, S.mekan, son - 1, 4).getValues();   // Mekân, Raf, Sıra, Sıra no
  var silinenler = sayfa.getRange(2, S.silindi, son - 1, 1).getValues();
  var kimler = sayfa.getRange(2, S.kaydeden, son - 1, 3).getValues();  // Kaydeden, Kutu, Tarih
  var nushalar = sayfa.getRange(2, S.nusha, son - 1, 1).getValues();
  veri.forEach(function (r, i) {
    if (rafAnahtari_(r[0], r[1], r[2]) !== anahtar) return;
    if (!silinenler[i][0]) {
      sonuc.sonCalisan = String(kimler[i][0] || '');
      var t = kimler[i][2];
      sonuc.sonTarih = t instanceof Date
        ? Utilities.formatDate(t, Session.getScriptTimeZone(), 'd.MM.yyyy') : '';
    }
    var n = Number(r[3]) || 0;
    // Silinen kayıt sayılmaz, ama numarası yeniden dağıtılmaz: o numara
    // kitabın üstüne ya da kutuya yazılmış olabilir.
    sonuc.kullanilan[n] = true;
    if (n > sonuc.sonNo) sonuc.sonNo = n;
    if (!silinenler[i][0]) {
      sonuc.adet++;
      // Rafta duran FİZİKSEL kitap sayısı: 3 nüsha tek kayıttır ama rafta üç cilttir.
      // Sıra sayımı bununla karşılaştırılır, kayıt sayısıyla değil.
      sonuc.cilt += Math.max(1, Number(nushalar[i][0]) || 1);
    }
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
  var r = siraKayitlari_()[anahtar];
  var b = (r && r.bitti) ? r : null;
  var tutulu = tutmaGecerli_(r, new Date());
  return {
    ok: true, anahtar: anahtar, sonNo: k.sonNo, adet: k.adet, cilt: k.cilt,
    durum: b ? 'bitti' : (k.adet ? 'devam' : 'bos'),
    bitiren: b ? b.bitiren : '', bitisTarihi: b ? b.tarih : '',
    raftaki: b ? b.raftaki : '', sonCalisan: k.sonCalisan, sonTarih: k.sonTarih,
    tutulu: tutulu, tutan: tutulu ? r.alan : ''
  };
}

/* ═══════════════ SIRA YAŞAM DÖNGÜSÜ ═══════════════
   Rastgele gelen gönüllünün "hangi sırayı alayım" sorusunu sistem cevaplar,
   ve bir sıranın bittiğini kimse tahmin etmek zorunda kalmaz. */

/** Tanımlı bütün sıra anahtarlarını sırayla üretir: G-A01, G-A02, … */
function tumSiralar_() {
  var mekanlar = (AYAR.MEKANLAR || []).map(function (m) { return String(m.kod).toUpperCase(); });
  if (!mekanlar.length) mekanlar = [''];
  var harfler = String(AYAR.RAF_HARFLERI || 'ABCDEFGH').toUpperCase().split('');
  var kac = Number(AYAR.SIRA_SAYISI || 8);
  var liste = [];
  mekanlar.forEach(function (m) {
    harfler.forEach(function (h) {
      for (var i = 1; i <= kac; i++) liste.push(rafAnahtari_(m, h, i));
    });
  });
  return liste;
}

/**
 * 'Sıralar' sayfasını anahtar → kayıt olarak döner.
 * Her satırda hem rezervasyon (kime verildi) hem bitiş (kim kapattı) olabilir.
 */
function siraKayitlari_() {
  var sayfa = sayfaAl_('Sıralar');
  var son = sayfa.getLastRow();
  var harita = {};
  if (son < 2) return harita;
  var genislik = Math.max(sayfa.getLastColumn(), SIRA_SUTUNLARI.length);
  sayfa.getRange(2, 1, son - 1, genislik).getValues().forEach(function (r, i) {
    if (!r[0]) return;
    var bitiren = String(r[SR.bitiren - 1] || '').trim();
    var tarih = r[SR.tarih - 1];
    harita[String(r[0]).trim().toUpperCase()] = {
      satir: i + 2,
      raftaki: r[SR.raftaki - 1], kayitli: r[SR.cilt - 1],
      kayitSayisi: r[SR.kayitSayisi - 1],
      bitiren: bitiren,
      bitti: !!(bitiren || tarih),
      tarih: tarih instanceof Date
        ? Utilities.formatDate(tarih, Session.getScriptTimeZone(), 'd.MM.yyyy')
        : String(tarih || ''),
      not: r[SR.not - 1], sonuc: r[SR.sonuc - 1],
      alan: String(r[SR.alan - 1] || '').trim(),
      almaSaati: r[SR.almaSaati - 1] instanceof Date ? r[SR.almaSaati - 1] : null
    };
  });
  return harita;
}

/** Yalnızca bitmiş sıralar (eski çağrılar için). */
function bitmisSiralar_() {
  var hepsi = siraKayitlari_(), sonuc = {};
  for (var a in hepsi) if (hepsi[a].bitti) sonuc[a] = hepsi[a];
  return sonuc;
}

function siraBitisi_(anahtar) {
  return bitmisSiralar_()[String(anahtar).trim().toUpperCase()] || null;
}

/** Rezervasyon hâlâ geçerli mi? Süresi dolan sıra başkasına açılır. */
function tutmaGecerli_(kayit, simdi) {
  if (!kayit || kayit.bitti || !kayit.alan || !kayit.almaSaati) return false;
  var saat = Number(AYAR.SIRA_TUTMA_SAAT || 8);
  return (simdi.getTime() - kayit.almaSaati.getTime()) < saat * 3600 * 1000;
}

/** Sıra satırını açar ya da bulur; 'Sıralar' sayfasında tek satır garanti eder. */
function siraSatiri_(sayfa, anahtar) {
  var son = sayfa.getLastRow();
  if (son >= 2) {
    var anahtarlar = sayfa.getRange(2, 1, son - 1, 1).getValues();
    for (var i = 0; i < anahtarlar.length; i++) {
      if (String(anahtarlar[i][0]).trim().toUpperCase() === anahtar) return i + 2;
    }
  }
  sayfa.appendRow([anahtar]);
  return sayfa.getLastRow();
}

/** Sırayı bir gönüllünün adına ayırır. */
function siraTut_(anahtar, kim) {
  if (!anahtar || !kim) return;
  var sayfa = sayfaAl_('Sıralar');
  var satir = siraSatiri_(sayfa, anahtar);
  sayfa.getRange(satir, SR.alan, 1, 2).setValues([[kim, new Date()]]);
}

/**
 * Gönüllüye bir sıra verir ve o sırayı adına ayırır.
 *
 * Rezervasyon olmadan sabah aynı anda giriş yapan herkes aynı sırayı alıyordu:
 * bir sıra ancak ilk kaydı sunucuya ulaştığında "başlanmış" sayılıyordu, o da
 * dakikalar sonra oluyordu. Artık dağıtımın kendisi yazılıyor.
 */
function siraOner_(g) {
  var kim = String((g && g.kaydeden) || '').trim();
  var simdi = new Date();

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var sayfa = sayfaAl_('Envanter');
    var son = sayfa.getLastRow();
    var baslanan = {};
    if (son >= 2) {
      var veri = sayfa.getRange(2, S.mekan, son - 1, 3).getValues();
      var silinen = sayfa.getRange(2, S.silindi, son - 1, 1).getValues();
      veri.forEach(function (r, i) {
        if (silinen[i][0]) return;
        baslanan[rafAnahtari_(r[0], r[1], r[2])] = true;
      });
    }

    var kayitlar = siraKayitlari_();

    // Gönüllünün elinde zaten bitmemiş bir sıra varsa yenisini vermeyelim.
    if (kim) {
      for (var a in kayitlar) {
        var k = kayitlar[a];
        if (tutmaGecerli_(k, simdi) && k.alan.toLowerCase() === kim.toLowerCase()) {
          return { ok: true, anahtar: a, tur: baslanan[a] ? 'devam' : 'sizin',
                   kalanBos: 0, yarimKalan: 0, zatenSizde: true };
        }
      }
    }

    /* Hangi kitaplıkta kaç kişi çalışıyor? Aynı anda gelen sekiz kişiye aynı
       kitaplığın sekiz gözünü vermek fiziksel yığılma demek. Bu yüzden sıra
       seçerken en az kalabalık kitaplık tercih edilir. Tek başına çalışan
       gönüllü için bir şey değişmez — kalabalık yoksa sıra bozulmaz. */
    var kalabalik = {};
    for (var t in kayitlar) {
      if (tutmaGecerli_(kayitlar[t], simdi)) {
        var kt = t.replace(/\d+$/, '');                 // 'G-A03' → 'G-A'
        kalabalik[kt] = (kalabalik[kt] || 0) + 1;
      }
    }

    var bos = [], yarim = [], tutulan = 0;
    tumSiralar_().forEach(function (a, sira) {
      var k = kayitlar[a];
      if (k && k.bitti) return;
      if (tutmaGecerli_(k, simdi)) { tutulan++; return; }   // başkasının elinde
      var kayit = { anahtar: a, sira: sira,
                    yogunluk: kalabalik[a.replace(/\d+$/, '')] || 0 };
      if (baslanan[a]) yarim.push(kayit); else bos.push(kayit);
    });

    var enUygun = function (liste) {
      if (!liste.length) return '';
      return liste.slice().sort(function (x, y) {
        return x.yogunluk !== y.yogunluk ? x.yogunluk - y.yogunluk : x.sira - y.sira;
      })[0].anahtar;
    };

    var secilen = bos.length ? enUygun(bos) : enUygun(yarim);
    if (!secilen) {
      return { ok: true, anahtar: '', tur: tutulan ? 'hepsiTutulu' : 'bitti',
               kalanBos: 0, yarimKalan: 0, tutulan: tutulan };
    }

    if (kim) siraTut_(secilen, kim);
    return { ok: true, anahtar: secilen, tur: bos.length ? 'bos' : 'yarim',
             kalanBos: bos.length, yarimKalan: yarim.length, tutulan: tutulan };
  } finally {
    kilit.releaseLock();
  }
}

/** Gönüllü menüden kendi seçtiğinde de sırayı adına ayırır. */
function siraSec_(g) {
  var anahtar = rafAnahtari_(g.mekan, g.raf, g.sira);
  if (!anahtar) return { ok: false, error: 'Sıra belirsiz.' };
  var kim = String(g.kaydeden || '').trim();
  var simdi = new Date();
  var k = siraKayitlari_()[anahtar];

  if (tutmaGecerli_(k, simdi) && kim && k.alan.toLowerCase() !== kim.toLowerCase()) {
    // Engellemiyoruz — belki gerçekten devralıyordur — ama üstüne yazdığını bilsin.
    if (!g.yinede) {
      return { ok: false, tutulu: true, alan: k.alan,
               error: 'Bu sırayı bugün ' + k.alan + ' aldı.' };
    }
  }
  if (kim) siraTut_(anahtar, kim);
  return { ok: true, anahtar: anahtar };
}

/** Gönüllü "bu sırayı bitirdim" der; raftaki fiziksel sayıyı da yazar. */
function siraBitir_(g) {
  var anahtar = rafAnahtari_(g.mekan, g.raf, g.sira);
  if (!anahtar) return { ok: false, error: 'Sıra belirsiz.' };

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var k = siraKullanimi_(sayfaAl_('Envanter'), anahtar);
    var raftaki = parseInt(g.raftaki, 10);
    if (isNaN(raftaki) || raftaki < 0) return { ok: false, error: 'Raftaki kitap sayısını yazın.' };

    // Hiç kayıt yokken sıra kapatılmasın — yanlış sıra seçilmiş olabilir.
    // Gerçekten boş/olmayan raf içinse raftaki=0 yazılarak kapatılabilir.
    if (k.adet === 0 && raftaki > 0) {
      return { ok: false,
               error: 'Bu sırada hiç kayıt yok. Yanlış sıra seçmiş olabilirsiniz. ' +
                      'Raf gerçekten boşsa "0" yazın.' };
    }

    var sayfa = sayfaAl_('Sıralar');
    var satir = siraSatiri_(sayfa, anahtar);
    var fark = raftaki - k.cilt;
    // Sıra kapanınca rezervasyon da kalkar: satırdaki "Alan" boşaltılır.
    sayfa.getRange(satir, 1, 1, SIRA_SUTUNLARI.length).setValues([[
      anahtar, raftaki, k.cilt, String(g.kaydeden || '').trim(), new Date(),
      String(g.not || '').trim().slice(0, 300),
      fark === 0 ? 'tutuyor' : (fark > 0 ? 'eksik ' + fark : 'fazla ' + (-fark)),
      k.adet, '', ''
    ]]);

    return { ok: true, anahtar: anahtar, kayitli: k.cilt, kayitSayisi: k.adet,
             raftaki: raftaki, fark: fark };
  } finally {
    kilit.releaseLock();
  }
}

/** Koordinatör için sıra haritası: hangi sıra bitti, hangisi yarım, hangisi boş. */
function siraHaritasi_() {
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  var sayilar = {}, ciltler = {};
  if (son >= 2) {
    var veri = sayfa.getRange(2, S.mekan, son - 1, 3).getValues();
    var silinen = sayfa.getRange(2, S.silindi, son - 1, 1).getValues();
    var nusha = sayfa.getRange(2, S.nusha, son - 1, 1).getValues();
    veri.forEach(function (r, i) {
      if (silinen[i][0]) return;
      var a = rafAnahtari_(r[0], r[1], r[2]);
      sayilar[a] = (sayilar[a] || 0) + 1;
      ciltler[a] = (ciltler[a] || 0) + Math.max(1, Number(nusha[i][0]) || 1);
    });
  }
  var kayitlar = siraKayitlari_();
  var simdi = new Date();
  var liste = tumSiralar_().map(function (a) {
    var r = kayitlar[a];
    var b = (r && r.bitti) ? r : null;
    var tutulu = tutmaGecerli_(r, simdi);
    return {
      sira: a,
      durum: b ? 'bitti' : (sayilar[a] ? 'devam' : 'bos'),
      kayitli: ciltler[a] || 0,
      kayitSayisi: sayilar[a] || 0,
      raftaki: b ? b.raftaki : '',
      fark: b ? (Number(b.raftaki) - (ciltler[a] || 0)) : '',
      bitiren: b ? b.bitiren : '',
      tarih: b ? b.tarih : '',
      not: r ? r.not : '',
      tutulu: tutulu, tutan: tutulu ? r.alan : ''
    };
  });
  var say = function (d) { return liste.filter(function (x) { return x.durum === d; }).length; };
  return { ok: true, siralar: liste, toplam: liste.length,
           bitti: say('bitti'), devam: say('devam'), bos: say('bos'),
           tutulu: liste.filter(function (x) { return x.tutulu; }).length,
           tutmaSaat: Number(AYAR.SIRA_TUTMA_SAAT || 8),
           uyusmayan: liste.filter(function (x) {
             return x.durum === 'bitti' && Number(x.fark) !== 0;
           }).length };
}

/* ═══════════════ GİRİŞ NOKTALARI ═══════════════ */

// Bağlantıya (GET) tıklanarak çalıştırılamayacak işlemler: bir bağlantı
// önizlemesi ya da yanlışlıkla paylaşılan adres kayıt silmemeli.
var YAZAN_EYLEMLER = ['ekle', 'guncelle', 'sil', 'fotoEkle', 'onayla', 'topluOnayla',
                      'siraBitir', 'siraOner', 'siraSec'];

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    if (YAZAN_EYLEMLER.indexOf(e.parameter.action) >= 0) {
      return cikti_({ ok: false, error: 'Bu işlem bağlantı ile yapılamaz.' });
    }
    return islet_(e.parameter);
  }
  return cikti_({ ok: true, mesaj: AYAR.KURUM + ' kitap envanteri çalışıyor.' });
}

function doPost(e) {
  var istek = {};
  try { istek = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (h) { return cikti_({ ok: false, error: 'İstek okunamadı.' }); }
  return islet_(istek);
}

// Yalnızca koordinatörün açabileceği işlemler
var KOORDINATOR_EYLEMLERI = ['onayBekleyen', 'onayGruplari', 'onayla', 'topluOnayla',
                             'katalog', 'durum', 'siraHaritasi'];

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
      case 'siraOner':    return cikti_(siraOner_(istek));
      case 'siraSec':     return cikti_(siraSec_(istek));
      case 'siraBitir':   return cikti_(siraBitir_(istek));
      case 'siraHaritasi':return cikti_(siraHaritasi_());
      case 'fotoEkle':    return cikti_(fotoEkle_(istek.no, istek.veri, istek.tur, istek.hangi));
      case 'onayBekleyen':return cikti_(onayBekleyen_(istek.adet));
      case 'onayGruplari':return cikti_(onayGruplari_(istek.adet));
      case 'topluOnayla': return cikti_(topluOnayla_(istek));
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
    siniflandirilmadi: SINIFLANDIRILMADI,
    rafHarfleri: String(AYAR.RAF_HARFLERI || 'ABCDEFGH').toUpperCase().split(''),
    siraSayisi: Number(AYAR.SIRA_SAYISI || 8),
  };
}

/* ═══════════════ KAYIT İŞLEMLERİ ═══════════════ */

function ekle_(g) {
  var d = dogrula_(g);
  if (d.hata) return { ok: false, error: d.hata };

  var istemciId = String(g.istemciId || '').trim().slice(0, 40);
  var sonuc;

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var sayfa = sayfaAl_('Envanter');

    // Aynı kayıt ikinci kez gelirse (zaman aşımı sonrası tekrar gönderim,
    // çift sekme, üst üste binen kuyruk) yeni satır açma; eskisini geri ver.
    if (istemciId) {
      var eski = istemciIleBul_(sayfa, istemciId);
      if (eski) {
        return { ok: true, no: eski.no, yerKodu: eski.yer, siraNo: eski.siraNo,
                 duzeltildi: false, tekrar: true };
      }
    }

    var no = sonrakiNo_(sayfa);
    var simdi = new Date();

    // Sıra numarasını telefon önerir (çevrimdışı da çalışsın diye); burada doğrulanır.
    var anahtar = rafAnahtari_(d.k.mekan, d.k.raf, d.k.sira);
    var s = siraNoAyarla_(sayfa, anahtar, g.siraNo);
    var yer = yerKodu_(d.k.mekan, d.k.raf, d.k.sira, s.siraNo);

    sayfa.appendRow([no, yer, d.k.mekan, d.k.raf, pad_(d.k.sira, 2), s.siraNo,
                     d.k.yazar, d.k.baslik, d.k.yil, d.k.nusha,
                     d.k.kategori, d.k.kural, d.k.durum, d.k.not, d.k.kaydeden, '', simdi,
                     '', '', '', '', '', '', '', '', '', istemciId, '']);
    sonuc = { ok: true, no: no, yerKodu: yer, siraNo: s.siraNo, duzeltildi: s.duzeltildi,
              rafAdet: s.adet + 1 };
  } finally {
    kilit.releaseLock();
  }

  // Sayaç tüm sayfayı okur; kilidin dışında kalsın ki sıradaki gönüllü beklemesin.
  sonuc.sayac = sayac_(d.k.kaydeden);
  return sonuc;
}

/** Aynı istemci kimliğiyle kaydedilmiş satırı arar (tekrar gönderim koruması). */
function istemciIleBul_(sayfa, istemciId) {
  var son = sayfa.getLastRow();
  if (son < 2) return null;
  var kimlikler = sayfa.getRange(2, S.istemci, son - 1, 1).getValues();
  for (var i = kimlikler.length - 1; i >= 0; i--) {
    if (String(kimlikler[i][0]) === istemciId) {
      var satir = sayfa.getRange(i + 2, 1, 1, S.siraNo).getValues()[0];
      return { no: satir[S.no - 1], yer: satir[S.yer - 1], siraNo: satir[S.siraNo - 1] };
    }
  }
  return null;
}

function guncelle_(no, g) {
  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var bulunan = satirBul_(no);
    if (!bulunan) return { ok: false, error: 'Kayıt bulunamadı.' };
    if (bulunan.silindi) return { ok: false, error: 'Bu kayıt silinmiş.' };
    var sayfa = sayfaAl_('Envanter');
    var mevcut = sayfa.getRange(bulunan.satir, 1, 1, SUTUNLAR.length).getValues()[0];

    // Yalnızca gönderilen alanlar değişir. Boş bırakılan alan "sil" demek değildir —
    // telefonda görünmeyen bir alanın sessizce silinmesi eskiden veri kaybettiriyordu.
    var birlesik = {
      mekan: mevcut[S.mekan - 1], raf: mevcut[S.raf - 1],
      sira: parseInt(mevcut[S.sira - 1], 10),
      yazar:    g.yazar    != null ? g.yazar    : mevcut[S.yazar - 1],
      baslik:   g.baslik   != null ? g.baslik   : mevcut[S.baslik - 1],
      yil:      g.yil      != null ? g.yil      : mevcut[S.yil - 1],
      nusha:    g.nusha    != null ? g.nusha    : mevcut[S.nusha - 1],
      kategori: g.kategori != null ? g.kategori : kategoriKodu_(mevcut[S.kategori - 1]),
      kural:    g.kural    != null ? g.kural    : mevcut[S.kural - 1],
      durum:    g.durum    != null ? g.durum    : mevcut[S.durum - 1],
      not:      g.not      != null ? g.not      : mevcut[S.not - 1],
      kaydeden: mevcut[S.kaydeden - 1],
      fotoVar: true                    // kayıt zaten var; başlık boş kalabilir
    };

    var d = dogrula_(birlesik);
    if (d.hata) return { ok: false, error: d.hata };

    // Yer kodu, kutu no ve kayıt tarihi korunur — düzeltme yalnızca künyeyi değiştirir.
    sayfa.getRange(bulunan.satir, S.yazar, 1, 8).setValues([[d.k.yazar, d.k.baslik, d.k.yil,
      d.k.nusha, d.k.kategori, d.k.kural, d.k.durum, d.k.not]]);
    return { ok: true, no: no };
  } finally {
    kilit.releaseLock();
  }
}

/** Tabloda okunur kategori adı yazar; doğrulama kodu ister. Geriye çevirir. */
function kategoriKodu_(ad) {
  var metin = String(ad || '');
  for (var kod in KATEGORILER) {
    if (KATEGORILER[kod].ad === metin) return kod;
  }
  // Tanınmayan değer (özellikle 'Sınıflandırılmadı') boş sayılır; yoksa gönüllünün
  // "Düzelt"i "Kategori seçilmeli" hatasıyla çöker — o ekranda kategori seçici yok.
  return '';
}

function sil_(no) {
  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var bulunan = satirBul_(no);
    if (!bulunan) return { ok: false, error: 'Kayıt bulunamadı.' };
    if (bulunan.silindi) return { ok: true, no: no };
    // Satır silinmez, işaretlenir: kayıt no ve sıra no yeniden kullanılmasın,
    // yolda olan bir fotoğraf başka kitaba yapışmasın, geri alınabilsin diye.
    sayfaAl_('Envanter').getRange(bulunan.satir, S.silindi).setValue(
      'Silindi · ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
                                          'd.MM.yyyy HH:mm'));
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
    return s[0] && !silinmis_(s) &&
           (!ad || String(s[S.kaydeden - 1]).trim().toLowerCase() === ad);
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
  if (son < 2) return { ok: true, toplam: 0, bugun: 0, benim: 0, bekleyen: 0 };

  var satirlar = sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues();
  var bugunKey = gunAnahtari_(new Date());
  var ad = String(kaydeden || '').trim().toLowerCase();
  var toplam = 0, bugun = 0, benim = 0, bekleyen = 0;

  satirlar.forEach(function (s) {
    if (!s[S.no - 1] || silinmis_(s)) return;
    toplam++;
    if (!s[S.onay - 1]) bekleyen++;      // onay masasının kuyruğu
    var t = s[S.tarih - 1];
    var ayniGun = t instanceof Date && gunAnahtari_(t) === bugunKey;
    if (ayniGun) bugun++;
    if (ayniGun && ad && String(s[S.kaydeden - 1]).trim().toLowerCase() === ad) benim++;
  });
  return { ok: true, toplam: toplam, bugun: bugun, benim: benim, bekleyen: bekleyen };
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

  /* Sınıflandırma (gidecek/gitmeyecek + kural kodu) koordinatörün işidir;
     gönüllü yalnızca künye girer. Boş gelirse kayıt "sınıflandırılmadı" açılır.
     Dolu gelirse (koordinatör onay ekranından) tutarlılığı burada denetlenir. */
  var kategori = String(g.kategori || '');
  var kural = String(g.kural || '').trim().toUpperCase();

  if (kategori || kural) {
    if (!KATEGORILER[kategori]) return { hata: 'Kategori seçilmeli.' };
    var gecerli = KURALLAR.filter(function (k) { return k[0] === kural && k[1] === kategori; });
    if (!gecerli.length) return { hata: 'Kural kodu bu kategoriye uymuyor.' };
  }

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
      kategori: kategori ? KATEGORILER[kategori].ad : SINIFLANDIRILMADI,
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
    if (Number(numaralar[i][0]) === no) {
      return { satir: i + 2,
               silindi: !!sayfa.getRange(i + 2, S.silindi).getValue() };
    }
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
  } else if (ad === 'Sıralar') {
    sayfa.appendRow(SIRA_SUTUNLARI);
    sayfa.setFrozenRows(1);
    sayfa.getRange(1, 1, 1, SIRA_SUTUNLARI.length)
      .setFontWeight('bold').setBackground('#601040').setFontColor('#ffffff');
    sayfa.setColumnWidth(1, 90); sayfa.setColumnWidth(4, 140); sayfa.setColumnWidth(6, 300);
  } else if (ad === 'Kutular') {
    sayfa.appendRow(['Kutu no', 'Kaynak sıra (G-A01)', 'Yer kodu aralığı', 'Hedef bölüm',
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
  if (bulunan.silindi) return { ok: false, error: 'Bu kayıt silinmiş.' };

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
  var silinenler = sayfa.getRange(2, S.silindi, son - 1, 1).getValues();
  var islenen = 0;

  for (var i = 0; i < durumlar.length && islenen < AYAR.OCR_TOPLU; i++) {
    if (String(durumlar[i][0]) !== 'bekliyor') continue;
    if (silinenler[i][0]) continue;
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
    /* Kalıcı takılmasın: "OCR hatası" yazan satırları ocrYenidenDene() ile
       toplu olarak 'bekliyor'a çevirebilirsiniz (Drive API sonradan açıldıysa). */
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
  /* Koordinatörün eli değmesi gereken her kayıt: onaylanmamış olan hepsi.
     Eskiden yalnızca fotoğraflılar gelirdi; artık sınıflandırma da burada
     yapıldığı için fotoğrafsız kayıtların da bu kuyruktan geçmesi gerekiyor. */
  var bekleyen = satirlar.filter(function (s) {
    return !silinmis_(s) && !s[S.onay - 1];
  });

  var liste = bekleyen.slice(0, adet).map(function (s) {
    return kayitCikar_(s);
  });
  return { ok: true, kayitlar: liste, kalan: bekleyen.length };
}

/** Onay ekranının kullandığı satır → nesne dönüşümü (öneri dâhil). */
function kayitCikar_(s) {
  var k = {
      no: s[S.no - 1], yer: s[S.yer - 1],
      yazar: s[S.yazar - 1], baslik: s[S.baslik - 1], yil: s[S.yil - 1],
      kategori: s[S.kategori - 1], kural: s[S.kural - 1], durum: s[S.durum - 1],
      not: s[S.not - 1], kaydeden: s[S.kaydeden - 1],
      nusha: s[S.nusha - 1],          // K3/S1 kuralları buna bakıyor
      foto: s[S.foto - 1], fotoId: (String(s[S.foto - 1]).match(/[-\w]{25,}/) || [''])[0],
      kapak: s[S.kapak - 1], kapakId: (String(s[S.kapak - 1]).match(/[-\w]{25,}/) || [''])[0],
      ocrDurum: s[S.ocrDurum - 1], ocrMetin: s[S.ocrMetin - 1],
      oneriBaslik: s[S.oneriBaslik - 1], oneriYazar: s[S.oneriYazar - 1],
      oneriYil: s[S.oneriYil - 1], oneriYayinevi: s[S.oneriYayinevi - 1],
      ocrMetin: s[S.ocrMetin - 1]
  };
  // Karar önerisi: koordinatör onaylayacak, ama hazır gelsin.
  var o = kararOner_(k);
  k.oneriKural = o.kural; k.oneriKategori = o.kategori;
  k.oneriGuven = o.guven; k.oneriSebep = o.sebep;
  return k;
}

/**
 * Kuyruk şişince tek tek onay yetişmez. Aynı öneriyi taşıyan kayıtları
 * gruplar; koordinatör grubu tek dokunuşla onaylar ya da açıp tek tek bakar.
 */
function onayGruplari_(adet) {
  adet = Math.min(Number(adet) || 400, 800);
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return { ok: true, gruplar: [], kalan: 0, onerisiz: 0 };

  var satirlar = sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues();
  var bekleyen = satirlar.filter(function (s) {
    return !silinmis_(s) && !s[S.onay - 1];
  });

  var harita = {}, onerisiz = 0;
  bekleyen.slice(0, adet).forEach(function (s) {
    var k = kayitCikar_(s);
    if (!k.oneriKural) { onerisiz++; return; }
    var anahtar = k.oneriKural;
    if (!harita[anahtar]) {
      harita[anahtar] = { kural: k.oneriKural, kategori: k.oneriKategori,
                          guven: k.oneriGuven, sebep: k.oneriSebep,
                          aciklama: kuralAciklamasi_(k.oneriKural),
                          adet: 0, numaralar: [], ornekler: [] };
    }
    var gr = harita[anahtar];
    gr.adet++;
    gr.numaralar.push(k.no);
    if (gr.ornekler.length < 6) {
      gr.ornekler.push({ no: k.no, yer: k.yer,
                         baslik: k.baslik || k.oneriBaslik || '(künye yok)',
                         yazar: k.yazar || k.oneriYazar || '' });
    }
  });

  /* Sıralama darboğazı hedefliyor: en çok kaydı olan grup önce gelsin ki
     koordinatörün ilk dokunuşu en çok işi bitirsin. Yalnız "zayıf öneri"ler
     sona atılır — onlarda toplu onay riskli, tek tek bakılmalı. */
  var gruplar = Object.keys(harita).map(function (a) { return harita[a]; })
    .sort(function (a, b) {
      var zayifA = a.guven === 'dusuk' ? 1 : 0, zayifB = b.guven === 'dusuk' ? 1 : 0;
      return zayifA !== zayifB ? zayifA - zayifB : b.adet - a.adet;
    });

  return { ok: true, gruplar: gruplar, kalan: bekleyen.length, onerisiz: onerisiz };
}

function kuralAciklamasi_(kod) {
  for (var i = 0; i < KURALLAR.length; i++) {
    if (KURALLAR[i][0] === kod) return KURALLAR[i][2];
  }
  return '';
}

/**
 * Bir grubu tek seferde onaylar. Tek kilit, tek geçiş — 40 kaydı 40 istekle
 * onaylamak zayıf bağlantıda dakikalar sürüyordu.
 */
function topluOnayla_(g) {
  var numaralar = (g.numaralar || []).map(Number).filter(Boolean);
  if (!numaralar.length) return { ok: false, error: 'Kayıt seçilmedi.' };
  if (numaralar.length > 300) return { ok: false, error: 'Tek seferde en fazla 300 kayıt.' };

  var kategori = String(g.kategori || '');
  var kural = String(g.kural || '').trim().toUpperCase();
  if (!KATEGORILER[kategori]) return { ok: false, error: 'Karar seçilmeli.' };
  if (!KURALLAR.some(function (r) { return r[0] === kural && r[1] === kategori; })) {
    return { ok: false, error: 'Kural kodu bu karara uymuyor.' };
  }

  var kilit = LockService.getScriptLock();
  kilit.waitLock(30000);
  try {
    var sayfa = sayfaAl_('Envanter');
    var son = sayfa.getLastRow();
    if (son < 2) return { ok: false, error: 'Kayıt yok.' };

    var damga = 'Onaylandı — ' + String(g.onaylayan || '').trim() + ' · toplu · ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd.MM.yyyy HH:mm');

    var no = sayfa.getRange(2, S.no, son - 1, 1).getValues();
    var onay = sayfa.getRange(2, S.onay, son - 1, 1).getValues();
    var silindi = sayfa.getRange(2, S.silindi, son - 1, 1).getValues();
    var kat = sayfa.getRange(2, S.kategori, son - 1, 2).getValues();   // Kategori, Kural
    var baslik = sayfa.getRange(2, S.baslik, son - 1, 1).getValues();

    var istenen = {};
    numaralar.forEach(function (x) { istenen[x] = true; });

    var yazildi = 0, atlanan = 0, basliksiz = 0;
    for (var i = 0; i < no.length; i++) {
      if (!istenen[Number(no[i][0])]) continue;
      if (silindi[i][0]) { atlanan++; continue; }
      if (onay[i][0]) { atlanan++; continue; }        // başkası onaylamış
      // Başlıksız kayıt toplu onaydan geçmesin: künyesi hiç yoksa insan baksın.
      if (!String(baslik[i][0] || '').trim() ||
          /künye fotoğraftan/i.test(String(baslik[i][0]))) { basliksiz++; continue; }
      kat[i][0] = KATEGORILER[kategori].ad;
      kat[i][1] = kural;
      onay[i][0] = damga;
      yazildi++;
    }

    if (yazildi) {
      sayfa.getRange(2, S.kategori, son - 1, 2).setValues(kat);
      sayfa.getRange(2, S.onay, son - 1, 1).setValues(onay);
    }
    return { ok: true, onaylanan: yazildi, atlanan: atlanan, basliksiz: basliksiz };
  } finally {
    kilit.releaseLock();
  }
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
    if (!s[S.no - 1] || silinmis_(s)) return;
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
    if (!s[S.no - 1] || silinmis_(s)) return;
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
  var baslik = String(k.baslik || '').trim();
  if (!baslik) return { ok: false, error: 'Başlık boş olamaz.' };

  var kategori = String(k.kategori || '');
  var kural = String(k.kural || '').trim().toUpperCase();
  if (!KATEGORILER[kategori]) return { ok: false, error: 'Karar seçilmeli (gidecek/gitmeyecek…).' };
  if (!KURALLAR.some(function (r) { return r[0] === kural && r[1] === kategori; })) {
    return { ok: false, error: 'Kural kodu bu karara uymuyor.' };
  }

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    // Satır araması kilidin içinde: arada bir kayıt silinirse yanlış satıra yazmayalım.
    var bulunan = satirBul_(no);
    if (!bulunan) return { ok: false, error: 'Kayıt bulunamadı.' };
    if (bulunan.silindi) return { ok: false, error: 'Bu kayıt silinmiş.' };
    var sayfa = sayfaAl_('Envanter');

    // İki koordinatör aynı anda çalışıyorsa ikisi de aynı 25'liği görür.
    // İkincisi birincinin kararını sessizce ezmesin.
    var oncekiOnay = String(sayfa.getRange(bulunan.satir, S.onay).getValue() || '');
    if (oncekiOnay && !k.uzerineYaz) {
      return { ok: false, zatenOnayli: true,
               error: 'Bu kaydı başkası onaylamış: ' + oncekiOnay };
    }

    sayfa.getRange(bulunan.satir, S.yazar).setValue(String(k.yazar || '').trim());
    sayfa.getRange(bulunan.satir, S.baslik).setValue(baslik);
    var yil = String(k.yil || '').trim();
    sayfa.getRange(bulunan.satir, S.yil).setValue(/^\d{3,4}$/.test(yil) ? Number(yil) : '');
    if (k.not != null) sayfa.getRange(bulunan.satir, S.not).setValue(String(k.not).trim());
    if (k.nusha != null) {
      var nusha = parseInt(k.nusha, 10);
      sayfa.getRange(bulunan.satir, S.nusha).setValue(nusha > 0 ? nusha : 1);
    }
    // Sınıflandırma bu ekranda yapılır; onaylanan her kayıt kararlı olmalı.
    sayfa.getRange(bulunan.satir, S.kategori).setValue(KATEGORILER[kategori].ad);
    sayfa.getRange(bulunan.satir, S.kural).setValue(kural);
    sayfa.getRange(bulunan.satir, S.onay).setValue(
      'Onaylandı — ' + String(k.onaylayan || '').trim() + ' · ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd.MM.yyyy HH:mm'));
    return { ok: true, no: no };
  } finally {
    kilit.releaseLock();
  }
}

/** 'Sıralar' sayfasına sonradan eklenen sütunları açar. */
function siraBasliklariOnar_() {
  var sayfa = sayfaAl_('Sıralar');
  if (sayfa.getMaxColumns() < SIRA_SUTUNLARI.length) {
    sayfa.insertColumnsAfter(sayfa.getMaxColumns(),
                             SIRA_SUTUNLARI.length - sayfa.getMaxColumns());
  }
  var mevcut = sayfa.getRange(1, 1, 1, sayfa.getLastColumn() || 1).getValues()[0];
  var ayni = mevcut.length === SIRA_SUTUNLARI.length &&
    SIRA_SUTUNLARI.every(function (b, i) { return String(mevcut[i]) === b; });
  if (ayni) return;
  sayfa.getRange(1, 1, 1, SIRA_SUTUNLARI.length).setValues([SIRA_SUTUNLARI])
    .setFontWeight('bold').setBackground('#601040').setFontColor('#ffffff');
  Logger.log('Sıralar başlıkları güncellendi.');
}

/**
 * "OCR hatası" yazan satırları yeniden sıraya alır.
 * Drive API'yi sonradan açtıysanız ya da geçici bir kota/ağ sorunu olduysa
 * betik menüsünden bir kez çalıştırın; o kitaplar yeniden okunur.
 */
function ocrYenidenDene() {
  var sayfa = sayfaAl_('Envanter');
  var son = sayfa.getLastRow();
  if (son < 2) return 0;
  var durumlar = sayfa.getRange(2, S.ocrDurum, son - 1, 1).getValues();
  var sayi = 0;
  durumlar.forEach(function (d, i) {
    if (/^OCR hatası/i.test(String(d[0]))) {
      sayfa.getRange(i + 2, S.ocrDurum).setValue('bekliyor');
      sayi++;
    }
  });
  Logger.log(sayi + ' kayıt yeniden OCR sırasına alındı.');
  return sayi;
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
    .filter(function (s) { return s[0] && !silinmis_(s); });

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
  // Yeni sütun eklendiyse tabloyu genişlet (yoksa appendRow "sütun sayısı uymuyor" der).
  if (sayfa.getMaxColumns() < SUTUNLAR.length) {
    sayfa.insertColumnsAfter(sayfa.getMaxColumns(),
                             SUTUNLAR.length - sayfa.getMaxColumns());
  }
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
      .addItem('OCR hatalarını yeniden dene', 'ocrYenidenDene')
      .addToUi();
  } catch (h) {}
}

/** Kurulumda bir kez çalıştırın. */
function kurulum() {
  var tablo = dosya_();
  sayfaAl_('Envanter');
  basliklariOnar_();
  sayfaAl_('Kurallar');
  sayfaAl_('Sıralar');
  siraBasliklariOnar_();
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
