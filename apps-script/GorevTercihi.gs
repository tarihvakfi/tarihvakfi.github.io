/**
 * Tarih Vakfı — Gönüllü Görev Paylaşımı
 * Google Apps Script arka ucu. Veriler bu betiğin bağlı olduğu Google E-Tablo'da tutulur.
 *
 * Kurulum için KURULUM.md dosyasına bakın.
 */

/* ═══════════════ AYARLAR ═══════════════ */

var AYAR = {
  // ── Verilerin yazılacağı Google E-Tablo ──────────────────────────────
  // Gerçek değer koda DEĞİL, Apps Script'in Komut Dosyası Özellikleri'ne
  // yazılır: Proje Ayarları (⚙) → Komut Dosyası Özellikleri → özellik ekle:
  //   TABLO_ID = 1AbCdEf...XyZ   (adres çubuğunda /d/ ile /edit arası)
  //
  // Betiği tablonun "Uzantılar → Apps Script" menüsünden açtıysanız özelliğe
  // de gerek yok; betik bağlı olduğu tabloyu kendisi bulur. Buradaki alan
  // yalnızca eski kurulumlar için yedek olarak okunur — boş bırakın.
  TABLO_ID: '',

  // Yönetici/bildirim adresleri de Komut Dosyası Özellikleri'nde tutulur:
  //   ADMIN_EPOSTA = ad@ornek.com, koordinator@tarihvakfi.org.tr
  //
  // ⚠️ Bu dosya herkese açık depoda duruyor. Gerçek adresleri asla buraya
  //    yazmayın — dosya depodaki haliyle yapıştırılıp yayımlanabilsin diye
  //    değerler Özellikler'den okunur; buradaki alan yalnızca yedektir.
  ADMIN_EPOSTA: 'BURAYA_YONETICI_EPOSTALARI',

  KURUM: 'Tarih Vakfı',

  // Formun yayınlandığı adres. Gönüllüye giden e-postalarda "tercihimi güncelle"
  // bağlantısı bu adrese verilir.
  FORM_ADRESI: 'https://tarihvakfi.github.io/gonullu-planlamasi.html',

  // Formun yayınlandığı adres(ler). Boş bırakılırsa her yerden istek kabul edilir.
  // Örn: 'https://tarihvakfi.github.io'
  IZINLI_SITE: '',

  KOD_DAKIKA: 10,             // giriş kodunun geçerlilik süresi
  OTURUM_GUN_GONULLU: 7,      // gönüllü girişi kaç gün açık kalsın
  OTURUM_GUN_YONETICI: 30,    // koordinatör girişi kaç gün açık kalsın
  KOD_BEKLEME_SN: 60,         // yeni kod istemek için bekleme
  MAX_DENEME: 5,              // hatalı kod denemesi sınırı
};

/* ═══════════════ SÖZLÜKLER ═══════════════ */

var ALAN = {
  kutuphane: 'Kütüphane taşınma / kataloglama',
  arsiv: 'Arşiv çalışmaları',
  ikisi: 'Her ikisi birden'
};
var BASLANGIC = {
  hemen: 'Hemen başlayabilirim',
  tarihten_sonra: 'Belirli bir tarihten sonra'
};

/* Hafta içi günler tek tek sorulur; hafta sonu normal koşullarda çalışma günü değildir,
   yalnızca yıldızlı seçenekle "olursa gelirim" bilgisi toplanır. */
var GUNLER = {
  pazartesi: 'Pazartesi',
  sali: 'Salı',
  carsamba: 'Çarşamba',
  persembe: 'Perşembe',
  cuma: 'Cuma',
  hafta_sonu_olursa: '★ Hafta sonu çalışma olursa katılabilirim'
};
var HAFTA_ICI = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma'];

/* Kaldırılan seçenekler. Eski kayıtlar tabloda duruyor; etiketsiz kalmasınlar diye
   yalnızca GÖSTERİM için tutuluyor — forma bir daha çıkmazlar. */
var ESKI_SECENEK = {
  karar_verilmedi: 'Henüz karar vermedim (kaldırıldı)',
  hafta_ici: 'Hafta içi (eski kayıt)',
  hafta_sonu: 'Hafta sonu (eski kayıt)',
  farketmez: 'Fark etmez (eski kayıt)'
};
var SAATLER = {
  sabah: 'Sabah (09.00–13.00)',
  ogleden_sonra: 'Öğleden sonra (13.00–18.00)',
  tam_gun: 'Tam gün'
};
var SURE = { '1-2': 'Ayda 1–2 gün', '3-4': 'Ayda 3–4 gün', '5-8': 'Ayda 5–8 gün', '8+': 'Ayda 8 günden fazla' };
// "Bu plan sizin için" sorusu kaldırıldı. Sütun, eski tabloların düzeni bozulmasın diye
// yerinde bırakıldı; yeni kayıtlarda boş geçilir.
var DURUM = { aktif: 'Aktif', beklemede: 'Beklemede', ayrildi: 'Ayrıldı' };

var AY_ADI = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

// E-Tablo sütun düzeni
var SUTUNLAR = [
  ['email',      'E-posta'],
  ['full_name',  'Ad Soyad'],
  ['phone',      'Telefon'],
  ['area',       'Katkı alanı'],
  ['start_pref', 'Ne zaman'],
  ['start_date', 'Başlangıç tarihi'],
  ['days',       'Günler'],
  ['times',      'Saat aralığı'],
  ['months',     'Uygun aylar'],
  ['frequency',  'Ayda süre'],
  ['certainty',  'Plan (kullanılmıyor)'],
  ['status',     'Durum'],
  ['notes',      'Notlar'],
  ['created_at', 'Kayıt tarihi'],
  ['updated_at', 'Son güncelleme']
];

// Değişiklik karşılaştırmasında gösterilecek alanlar
var IZLENEN = ['full_name','phone','area','start_pref','start_date','days','times','months','frequency','status','notes'];

// Artık sorulmayan, yalnızca sütun düzeni için duran alanlar
var KULLANILMAYAN = ['certainty'];

/* ═══════════════ HAZIR LİSTELER ═══════════════
   "Listeler" sayfasında her kayıttan sonra otomatik oluşturulur.
   Yeni bir liste eklemek için aşağıya bir satır yazmanız yeterli:
     ['Listenin adı', function (k) { return <koşul>; }]
   Kullanabileceğiniz kısayollar:
     alan_(k,'kutuphane'|'arsiv')   → o alana gelebilir ("her ikisi" de sayılır)
     gun_(k,'pazartesi'|…|'cuma')   → o gün gelebilir
     haftaIci_(k)                   → hafta içi en az bir gün gelebilir
     haftaSonu_(k)                  → hafta sonu çalışma açılırsa gelebilir (★)
     saat_(k,'sabah'|'ogleden_sonra'|'tam_gun')
     k.start_pref / k.frequency / k.status alanları
   Üçüncü değer 'hepsi' yazılmazsa liste yalnızca aktif gönüllüleri gösterir. */

function alan_(k, a) { return k.area === a || k.area === 'ikisi'; }

/* Eski kayıtlarda gün olarak 'hafta_ici' / 'farketmez' yazıyor olabilir;
   bunlar hafta içi her güne sayılır ki eski gönüllüler listelerden düşmesin. */
function gun_(k, g) {
  var d = k.days || [];
  if (d.indexOf(g) >= 0) return true;
  if (HAFTA_ICI.indexOf(g) >= 0) return d.indexOf('hafta_ici') >= 0 || d.indexOf('farketmez') >= 0;
  return false;
}
function haftaIci_(k) {
  return HAFTA_ICI.some(function (g) { return gun_(k, g); });
}
function haftaSonu_(k) {
  var d = k.days || [];
  return d.indexOf('hafta_sonu_olursa') >= 0 || d.indexOf('hafta_sonu') >= 0 || d.indexOf('farketmez') >= 0;
}
function saat_(k, s) { return k.times.indexOf(s) >= 0 || k.times.indexOf('tam_gun') >= 0; }

var LISTELER = [
  ['Hemen gelebilecekler',        function (k) { return k.start_pref === 'hemen'; }],
  ['Kütüphane — hemen',           function (k) { return alan_(k, 'kutuphane') && k.start_pref === 'hemen'; }],
  ['Arşiv — hemen',               function (k) { return alan_(k, 'arsiv') && k.start_pref === 'hemen'; }],
  ['Pazartesi gelebilecekler',    function (k) { return gun_(k, 'pazartesi'); }],
  ['Salı gelebilecekler',         function (k) { return gun_(k, 'sali'); }],
  ['Çarşamba gelebilecekler',     function (k) { return gun_(k, 'carsamba'); }],
  ['Perşembe gelebilecekler',     function (k) { return gun_(k, 'persembe'); }],
  ['Cuma gelebilecekler',         function (k) { return gun_(k, 'cuma'); }],
  ['★ Hafta sonu çalışma olursa gelebilecekler', function (k) { return haftaSonu_(k); }],
  ['★ Hafta sonu — kütüphane',    function (k) { return alan_(k, 'kutuphane') && haftaSonu_(k); }],
  ['Tam gün kalabilecekler',      function (k) { return k.times.indexOf('tam_gun') >= 0; }],
  ['Tarih verenler (tarihe göre)', function (k) { return k.start_pref === 'tarihten_sonra'; }, 'aktif', 'tarih'],
  ['Ara verenler (beklemede)',    function (k) { return k.status === 'beklemede'; }, 'hepsi'],
];

/* ═══════════════ GİRİŞ NOKTALARI ═══════════════ */

function doGet(e) {
  if (e && e.parameter && e.parameter.action) return islet_(e.parameter);
  return cikti_({ ok: true, mesaj: AYAR.KURUM + ' gönüllü sistemi çalışıyor.' });
}

function doPost(e) {
  var istek = {};
  try {
    istek = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (hata) {
    return cikti_({ ok: false, error: 'İstek okunamadı.' });
  }
  return islet_(istek);
}

function islet_(istek) {
  try {
    switch (istek.action) {
      case 'config':      return cikti_(ayarlar_());
      case 'requestCode': return cikti_(kodGonder_(istek.email));
      case 'verify':      return cikti_(kodDogrula_(istek.email, istek.code));
      case 'get':         return cikti_(kaydiGetir_(istek.token));
      case 'save':        return cikti_(kaydet_(istek.token, istek.data || {}));
      case 'logout':      return cikti_(oturumKapat_(istek.token));
      case 'adminData':   return cikti_(yonetimVerisi_(istek.token));
      case 'adminDelete': return cikti_(yonetimSil_(istek.token, istek.email));
      case 'adminStatus': return cikti_(yonetimDurum_(istek.token, istek.email, istek.status));
      default:            return cikti_({ ok: false, error: 'Bilinmeyen istek.' });
    }
  } catch (hata) {
    Logger.log(hata);
    return cikti_({ ok: false, error: 'Sunucu hatası: ' + hata.message });
  }
}

function cikti_(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════ İŞLEMLER ═══════════════ */

function ayarlar_() {
  return {
    ok: true,
    org: AYAR.KURUM,
    area: ALAN, start_pref: BASLANGIC, days: GUNLER, times: SAATLER,
    frequency: SURE, status: DURUM,
    months: gelecekAylar_(12)
  };
}

/* Giriş kodları da oturumlar gibi PropertiesService'te tutulur.
   (Eskiden CacheService'teydi; önbellek yer sıkışınca kaydı süresinden çok
   önce silebiliyor — kod e-postası gelir gelmez "süresi dolmuş" hatası tam
   bu yüzden görülüyordu. Oturumlar aynı sebeple zaten taşınmıştı.) */
function kodKaydiOku_(anahtar) {
  var ozellikler = PropertiesService.getScriptProperties();
  var ham = ozellikler.getProperty(anahtar);
  if (!ham) return null;
  var kayit;
  try { kayit = JSON.parse(ham); } catch (h) { return null; }
  if (!kayit || !kayit.bitis || kayit.bitis < Date.now()) {
    ozellikler.deleteProperty(anahtar);
    return null;
  }
  return kayit;
}

function kodGonder_(eposta) {
  eposta = String(eposta || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) return { ok: false, error: 'Geçerli bir e-posta adresi girin.' };

  var ozellikler = PropertiesService.getScriptProperties();
  var anahtar = 'kod_' + ozet_(eposta);
  var onceki = kodKaydiOku_(anahtar);
  if (onceki) {
    var gecen = (Date.now() - onceki.gonderim) / 1000;
    if (gecen < AYAR.KOD_BEKLEME_SN) {
      return { ok: false, error: 'Yeni kod istemek için ' + Math.ceil(AYAR.KOD_BEKLEME_SN - gecen) + ' saniye bekleyin.' };
    }
  }

  var kod = String(Math.floor(Math.random() * 900000) + 100000);
  ozellikler.setProperty(anahtar, JSON.stringify({
    ozet: ozet_(kod),
    deneme: 0,
    gonderim: Date.now(),
    bitis: Date.now() + AYAR.KOD_DAKIKA * 60000
  }));

  MailApp.sendEmail({
    to: eposta,
    subject: AYAR.KURUM + ' gönüllü giriş kodunuz: ' + kod,
    htmlBody: sarmala_('Giriş kodunuz',
      '<p>Gönüllü tercihinizi görüntülemek veya güncellemek için aşağıdaki kodu sayfaya girin:</p>' +
      '<p style="font-size:32px;letter-spacing:8px;font-weight:700;background:#fafaf9;border:1px solid #e7e5e4;' +
      'border-radius:10px;padding:16px;text-align:center">' + kod + '</p>' +
      '<p style="color:#78716c;font-size:13px">Kod ' + AYAR.KOD_DAKIKA + ' dakika geçerlidir. ' +
      'Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>')
  });

  return { ok: true };
}

function kodDogrula_(eposta, kod) {
  eposta = String(eposta || '').trim().toLowerCase();
  kod = String(kod || '').replace(/\D/g, '');

  var ozellikler = PropertiesService.getScriptProperties();
  var anahtar = 'kod_' + ozet_(eposta);
  var kayit = kodKaydiOku_(anahtar);
  if (!kayit) return { ok: false, error: 'Kodun süresi dolmuş. Yeni kod isteyin.' };

  if (kayit.deneme >= AYAR.MAX_DENEME) return { ok: false, error: 'Çok fazla hatalı deneme. Yeni kod isteyin.' };

  if (ozet_(kod) !== kayit.ozet) {
    kayit.deneme++;
    ozellikler.setProperty(anahtar, JSON.stringify(kayit));
    return { ok: false, error: 'Kod hatalı.' };
  }

  ozellikler.deleteProperty(anahtar);
  var token = oturumAc_(eposta);
  return { ok: true, token: token, email: eposta, volunteer: satirBul_(eposta).kayit };
}

/* ── Oturumlar ──────────────────────────────────────────────────────────
   Oturumlar PropertiesService'te tutulur. (Önbellek/CacheService en fazla
   6 saat saklıyor ve yer sıkışınca erken siliyordu; koordinatörler günde
   birkaç kez yeniden kod istemek zorunda kalıyordu.) */

function oturumAc_(eposta) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var gun = yoneticiMi_(eposta) ? AYAR.OTURUM_GUN_YONETICI : AYAR.OTURUM_GUN_GONULLU;
  var bitis = Date.now() + Math.max(1, Number(gun) || 1) * 86400000;

  PropertiesService.getScriptProperties()
    .setProperty('otr_' + token, JSON.stringify({ e: eposta, b: bitis }));
  eskiOturumlariSil_();
  return token;
}

function oturumEpostasi_(token) {
  if (!token) return null;
  var ozellikler = PropertiesService.getScriptProperties();
  var ham = ozellikler.getProperty('otr_' + String(token));
  if (!ham) return null;

  var kayit;
  try { kayit = JSON.parse(ham); } catch (h) { return null; }
  if (!kayit || !kayit.b || kayit.b < Date.now()) {
    ozellikler.deleteProperty('otr_' + String(token));
    return null;
  }
  return kayit.e;
}

function oturumKapat_(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('otr_' + String(token));
  return { ok: true };
}

/** Süresi dolmuş oturumları ve giriş kodlarını temizler; her girişte bir kez çalışır. */
function eskiOturumlariSil_() {
  var ozellikler = PropertiesService.getScriptProperties();
  var hepsi = ozellikler.getProperties();
  var simdi = Date.now();
  for (var anahtar in hepsi) {
    var oturum = anahtar.indexOf('otr_') === 0;
    var kod = anahtar.indexOf('kod_') === 0;
    if (!oturum && !kod) continue;
    var gecerli = false;
    try {
      var k = JSON.parse(hepsi[anahtar]);
      gecerli = oturum ? (k && k.b && k.b >= simdi) : (k && k.bitis && k.bitis >= simdi);
    } catch (h) { gecerli = false; }
    if (!gecerli) ozellikler.deleteProperty(anahtar);
  }
}

function kaydiGetir_(token) {
  var eposta = oturumEpostasi_(token);
  if (!eposta) return { ok: false, error: 'Oturumunuz sona erdi, tekrar giriş yapın.' };
  return { ok: true, volunteer: satirBul_(eposta).kayit, history: gecmis_(eposta) };
}

function kaydet_(token, veri) {
  var eposta = oturumEpostasi_(token);
  if (!eposta) return { ok: false, error: 'Oturumunuz sona erdi, tekrar giriş yapın.' };

  var dogrulama = dogrula_(veri);
  if (dogrulama.hatalar.length) return { ok: false, error: dogrulama.hatalar.join(' ') };
  var yeni = dogrulama.deger;
  yeni.email = eposta;

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var sayfa = sayfaAl_('Gönüllüler');
    var bulunan = satirBul_(eposta);
    var oncekiKayit = bulunan.kayit;
    var ilkKez = !oncekiKayit;
    var simdi = new Date();

    yeni.created_at = ilkKez ? simdi : oncekiKayit.created_at;
    yeni.updated_at = simdi;

    var satir = SUTUNLAR.map(function (s) { return hucre_(s[0], yeni[s[0]]); });

    if (ilkKez) {
      sayfa.appendRow(satir);
    } else {
      sayfa.getRange(bulunan.satirNo, 1, 1, SUTUNLAR.length).setValues([satir]);
    }

    var fark = ilkKez ? [] : farkBul_(oncekiKayit, yeni);
    gunlugeYaz_(eposta, yeni.full_name, ilkKez, fark, simdi);
    ozetiGuncelle_();
    listeleriGuncelle_();

    bildirimGonder_(yeni, fark, ilkKez);

    return { ok: true, isNew: ilkKez, changed: fark.length, volunteer: yeni };
  } finally {
    kilit.releaseLock();
  }
}

/* ═══════════════ YÖNETİM (web paneli) ═══════════════ */

/* Gizli ayarlar Komut Dosyası Özellikleri'nden okunur; koddaki AYAR alanı
   yalnızca yedektir (BURAYA_ ile başlayan doldurulmamış kalıp yok sayılır).
   Böylece depodaki dosya birebir yapıştırılır, her dağıtımda yeniden
   doldurmak gerekmez ve gerçek adresler herkese açık depoya hiç girmez. */
function ayarDegeri_(anahtar, koddaki) {
  var deger = '';
  try { deger = PropertiesService.getScriptProperties().getProperty(anahtar) || ''; } catch (h) {}
  deger = String(deger).trim();
  if (deger) return deger;
  var yedek = String(koddaki || '').trim();
  return /^BURAYA/.test(yedek) ? '' : yedek;
}
function adminEposta_() { return ayarDegeri_('ADMIN_EPOSTA', AYAR.ADMIN_EPOSTA); }
function tabloKimligi_() { return ayarDegeri_('TABLO_ID', AYAR.TABLO_ID); }

/** ADMIN_EPOSTA listesindeki adresler yöneticidir; ayrı şifre yoktur. */
function yoneticiMi_(eposta) {
  var liste = adminEposta_().split(',').map(function (a) {
    return a.trim().toLowerCase();
  }).filter(function (a) { return a; });
  return liste.indexOf(String(eposta || '').toLowerCase()) >= 0;
}

/** Web panelinin ihtiyaç duyduğu her şeyi tek istekte döner. */
function yonetimVerisi_(token) {
  var eposta = oturumEpostasi_(token);
  if (!eposta) return { ok: false, error: 'Oturumunuz sona erdi, tekrar giriş yapın.' };
  if (!yoneticiMi_(eposta)) {
    return { ok: false, error: 'Bu sayfayı görme yetkiniz yok. Yönetici e-postanızla giriş yapın.' };
  }

  var kayitlar = tumKayitlar_();
  var gunluk = sonDegisiklikler_(40);

  return {
    ok: true,
    email: eposta,
    hesaplama: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMMM yyyy HH:mm'),
    tabloAdresi: dosya_().getUrl(),
    ozet: ozetVerisi_(kayitlar),
    listeler: listeVerisi_(kayitlar).map(function (l) {
      return { ad: l.ad, epostalar: l.uyeler.map(function (k) { return k.email; }), uyeler: l.uyeler };
    }),
    kayitlar: kayitlar,
    gunluk: gunluk,
    etiketler: { area: ALAN, start_pref: BASLANGIC, days: GUNLER, times: SAATLER,
                 frequency: SURE, status: DURUM }
  };
}

/** Oturumun bir yöneticiye ait olduğunu doğrular. */
function yoneticiOturumu_(token) {
  var eposta = oturumEpostasi_(token);
  if (!eposta) return { hata: 'Oturumunuz sona erdi, tekrar giriş yapın.' };
  if (!yoneticiMi_(eposta)) return { hata: 'Bu işlem için yetkiniz yok.' };
  return { eposta: eposta };
}

/** SUTUNLAR içindeki alanın kaçıncı sütun olduğunu döner (1'den başlar). */
function sutunNo_(alan) {
  for (var i = 0; i < SUTUNLAR.length; i++) if (SUTUNLAR[i][0] === alan) return i + 1;
  return 0;
}

/** Panelden kayıt silme. Değişiklik günlüğüne iz bırakır. */
function yonetimSil_(token, hedef) {
  var o = yoneticiOturumu_(token);
  if (o.hata) return { ok: false, error: o.hata };

  hedef = String(hedef || '').trim().toLowerCase();
  if (!hedef) return { ok: false, error: 'Silinecek kayıt belirtilmedi.' };

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var bulunan = satirBul_(hedef);
    if (!bulunan.kayit) return { ok: false, error: 'Kayıt bulunamadı; sayfayı yenileyin.' };
    var ad = bulunan.kayit.full_name || hedef;

    sayfaAl_('Gönüllüler').deleteRow(bulunan.satirNo);
    satirlariSil_(sayfaAl_('Değişiklikler'), 2, [hedef]);
    sayfaAl_('Değişiklikler').appendRow([new Date(), hedef, ad, 'Silindi',
      'Kayıt panelden silindi — işlemi yapan: ' + o.eposta]);

    ozetiGuncelle_();
    listeleriGuncelle_();
    return { ok: true, ad: ad };
  } finally {
    kilit.releaseLock();
  }
}

/** Panelden durum değiştirme (aktif / beklemede / ayrildi). */
function yonetimDurum_(token, hedef, durum) {
  var o = yoneticiOturumu_(token);
  if (o.hata) return { ok: false, error: o.hata };

  hedef = String(hedef || '').trim().toLowerCase();
  durum = String(durum || '');
  if (!DURUM[durum]) return { ok: false, error: 'Geçersiz durum.' };

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    var bulunan = satirBul_(hedef);
    if (!bulunan.kayit) return { ok: false, error: 'Kayıt bulunamadı; sayfayı yenileyin.' };

    var onceki = bulunan.kayit.status;
    if (onceki === durum) return { ok: true, degisti: false, ad: bulunan.kayit.full_name };

    var sayfa = sayfaAl_('Gönüllüler');
    sayfa.getRange(bulunan.satirNo, sutunNo_('status')).setValue(DURUM[durum]);
    sayfa.getRange(bulunan.satirNo, sutunNo_('updated_at')).setValue(new Date());

    sayfaAl_('Değişiklikler').appendRow([new Date(), hedef, bulunan.kayit.full_name, 'Güncelleme',
      'Durum: ' + (DURUM[onceki] || '—') + ' → ' + DURUM[durum] +
      '  (panelden, ' + o.eposta + ')']);

    ozetiGuncelle_();
    listeleriGuncelle_();
    return { ok: true, degisti: true, ad: bulunan.kayit.full_name, durum: durum };
  } finally {
    kilit.releaseLock();
  }
}

function sonDegisiklikler_(adet) {
  var sayfa = sayfaAl_('Değişiklikler');
  var son = sayfa.getLastRow();
  if (son < 2) return [];
  var bas = Math.max(2, son - adet + 1);
  return sayfa.getRange(bas, 1, son - bas + 1, 5).getValues().reverse().map(function (s) {
    return {
      tarih: s[0] instanceof Date ? s[0].toISOString() : String(s[0]),
      email: String(s[1]), ad: String(s[2]),
      tur: String(s[3]), metin: String(s[4] || '')
    };
  });
}

/* ═══════════════ DOĞRULAMA ═══════════════ */

function dogrula_(g) {
  var hatalar = [];
  var dizi = function (d, sozluk) {
    return (Array.isArray(d) ? d : []).filter(function (x) { return sozluk[x]; });
  };

  var ad = String(g.full_name || '').trim();
  if (ad.length < 3) hatalar.push('Ad soyad en az 3 karakter olmalı.');

  var telefon = String(g.phone || '').trim();
  if (telefon && !/^[0-9 ()+\-]{7,20}$/.test(telefon)) hatalar.push('Telefon numarası geçersiz.');

  var alan = String(g.area || '');
  if (!ALAN[alan]) hatalar.push('Katkı alanı seçilmeli.');

  var baslangic = String(g.start_pref || '');
  if (!BASLANGIC[baslangic]) hatalar.push('Başlangıç tercihi seçilmeli.');

  var tarih = String(g.start_date || '').trim();
  if (baslangic !== 'tarihten_sonra' || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) tarih = '';

  var gunler = dizi(g.days, GUNLER);
  if (!gunler.length) hatalar.push('En az bir gün tercihi seçilmeli.');

  var aylar = (Array.isArray(g.months) ? g.months : []).filter(function (a) { return /^\d{4}-\d{2}$/.test(a); });
  var sure = SURE[g.frequency] ? g.frequency : '';
  var durum = DURUM[g.status] ? g.status : 'aktif';

  return {
    hatalar: hatalar,
    deger: {
      full_name: ad, phone: telefon, area: alan, start_pref: baslangic, start_date: tarih,
      days: gunler, times: dizi(g.times, SAATLER), months: aylar,
      frequency: sure, certainty: '', status: durum,
      notes: String(g.notes || '').trim().slice(0, 2000)
    }
  };
}

/* ═══════════════ E-TABLO ═══════════════ */

var _dosya = null;

/**
 * Verilerin yazılacağı E-Tablo.
 * AYAR.TABLO_ID doluysa o tabloyu açar (bağımsız Apps Script projesi),
 * boşsa betiğin bağlı olduğu tabloyu kullanır (Uzantılar → Apps Script).
 */
function dosya_() {
  if (_dosya) return _dosya;
  var kimlik = tabloKimligi_();
  if (kimlik) {
    // Yanlışlıkla tam adres yapıştırıldıysa kimliği ayıkla
    var e = kimlik.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (e) kimlik = e[1];
    _dosya = SpreadsheetApp.openById(kimlik);
  } else {
    _dosya = SpreadsheetApp.getActiveSpreadsheet();
    if (!_dosya) {
      throw new Error('E-Tablo bulunamadı. Bağımsız bir Apps Script projesi kullanıyorsanız ' +
        'AYAR.TABLO_ID alanına tablonun kimliğini yazın.');
    }
  }
  return _dosya;
}

function sayfaAl_(ad) {
  var dosya = dosya_();
  var sayfa = dosya.getSheetByName(ad);
  if (sayfa) return sayfa;

  sayfa = dosya.insertSheet(ad);
  if (ad === 'Gönüllüler') {
    sayfa.appendRow(SUTUNLAR.map(function (s) { return s[1]; }));
    sayfa.setFrozenRows(1);
    sayfa.setFrozenColumns(2);
    sayfa.getRange(1, 1, 1, SUTUNLAR.length)
      .setFontWeight('bold').setBackground('#7c2d12').setFontColor('#ffffff');
    [220, 150, 130, 200, 190, 130, 150, 180, 190, 120, 110, 100, 280, 150, 150]
      .forEach(function (g, i) { sayfa.setColumnWidth(i + 1, g); });
    sayfa.getRange(1, 1, sayfa.getMaxRows(), SUTUNLAR.length).createFilter();  // başlıklara filtre okları
  } else if (ad === 'Değişiklikler') {
    sayfa.appendRow(['Tarih', 'E-posta', 'Ad Soyad', 'Tür', 'Değişiklik']);
    sayfa.setFrozenRows(1);
    sayfa.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f5f5f4');
    sayfa.setColumnWidth(5, 520);
  }
  return sayfa;
}

function satirBul_(eposta) {
  var sayfa = sayfaAl_('Gönüllüler');
  var sonSatir = sayfa.getLastRow();
  if (sonSatir < 2) return { satirNo: 0, kayit: null };

  var epostalar = sayfa.getRange(2, 1, sonSatir - 1, 1).getValues();
  for (var i = 0; i < epostalar.length; i++) {
    if (String(epostalar[i][0]).trim().toLowerCase() === eposta) {
      var satir = sayfa.getRange(i + 2, 1, 1, SUTUNLAR.length).getValues()[0];
      return { satirNo: i + 2, kayit: satirdanNesne_(satir) };
    }
  }
  return { satirNo: 0, kayit: null };
}

// E-Tablo hücresi ← değer  (diziler etikete çevrilerek yazılır, insan okusun diye)
function hucre_(alan, deger) {
  if (alan === 'days')   return (deger || []).map(function (d) { return GUNLER[d] || ESKI_SECENEK[d] || d; }).join(', ');
  if (alan === 'times')  return (deger || []).map(function (d) { return SAATLER[d] || d; }).join(', ');
  if (alan === 'months') return (deger || []).map(ayEtiketi_).join(', ');
  if (alan === 'area')       return ALAN[deger] || '';
  if (alan === 'start_pref') return BASLANGIC[deger] || ESKI_SECENEK[deger] || '';
  if (alan === 'frequency')  return SURE[deger] || '';
  if (alan === 'certainty')  return '';                       // kaldırılan alan
  if (alan === 'status')     return DURUM[deger] || '';
  if (alan === 'start_date')  return tarihEtiketi_(deger);
  return deger === null || deger === undefined ? '' : deger;
}

// E-Tablo satırı → nesne (etiketler tekrar anahtara çevrilir)
function satirdanNesne_(satir) {
  var nesne = {};
  SUTUNLAR.forEach(function (s, i) { nesne[s[0]] = satir[i]; });
  return {
    email: String(nesne.email || '').trim().toLowerCase(),
    full_name: String(nesne.full_name || ''),
    phone: String(nesne.phone || ''),
    area: anahtarBul_(ALAN, nesne.area),
    start_pref: anahtarBul_(BASLANGIC, nesne.start_pref),
    start_date: tarihMetni_(nesne.start_date),
    days: coklu_(GUNLER, nesne.days),
    times: coklu_(SAATLER, nesne.times),
    months: aylariCoz_(nesne.months),
    frequency: anahtarBul_(SURE, nesne.frequency),
    certainty: '',
    status: anahtarBul_(DURUM, nesne.status) || 'aktif',
    notes: String(nesne.notes || ''),
    created_at: nesne.created_at,
    updated_at: nesne.updated_at
  };
}

function anahtarBul_(sozluk, etiket) {
  etiket = String(etiket || '').trim();
  for (var a in sozluk) if (sozluk[a] === etiket) return a;
  return '';
}
function coklu_(sozluk, metin) {
  return String(metin || '').split(',').map(function (p) { return anahtarBul_(sozluk, p.trim()); })
    .filter(function (x) { return x; });
}

/* ═══════════════ GÜNLÜK VE ÖZET ═══════════════ */

function gunlugeYaz_(eposta, ad, ilkKez, fark, simdi) {
  var metin = ilkKez ? '' : fark.map(function (f) {
    return f.etiket + ': ' + f.once + ' → ' + f.sonra;
  }).join('\n');
  sayfaAl_('Değişiklikler').appendRow([simdi, eposta, ad, ilkKez ? 'Yeni kayıt' : 'Güncelleme', metin]);
}

function gecmis_(eposta) {
  var sayfa = sayfaAl_('Değişiklikler');
  var son = sayfa.getLastRow();
  if (son < 2) return [];
  var satirlar = sayfa.getRange(2, 1, son - 1, 5).getValues();
  return satirlar.filter(function (s) { return String(s[1]).toLowerCase() === eposta; })
    .slice(-20).reverse()
    .map(function (s) {
      return { created_at: s[0], kind: s[3] === 'Yeni kayıt' ? 'yeni' : 'guncelleme', text: String(s[4] || '') };
    });
}

function farkBul_(once, sonra) {
  var liste = [];
  IZLENEN.forEach(function (alan) {
    var a = String(hucre_(alan, once[alan]) || '—');
    var b = String(hucre_(alan, sonra[alan]) || '—');
    if (a !== b) {
      var etiket = '';
      SUTUNLAR.forEach(function (s) { if (s[0] === alan) etiket = s[1]; });
      liste.push({ alan: alan, etiket: etiket, once: a, sonra: b });
    }
  });
  return liste;
}

/**
 * Özet sayılarını hesaplar. Hem "Özet" sayfası hem web paneli bunu kullanır.
 * Dönen dizi: [{tur:'baslik'|'satir', ad:..., sayi:...}]
 */
function ozetVerisi_(kayitlar) {
  var say = function (kosul) { return kayitlar.filter(kosul).length; };
  var aktif = function (k) { return k.status === 'aktif'; };
  var b = function (ad) { return { tur: 'baslik', ad: ad }; };
  var s = function (ad, sayi) { return { tur: 'satir', ad: ad, sayi: sayi }; };

  return [
    b('GENEL'),
    s('Toplam gönüllü', kayitlar.length),
    s('Aktif', say(aktif)),
    s('Beklemede (ara vermiş)', say(function (k) { return k.status === 'beklemede'; })),
    s('Ayrıldı', say(function (k) { return k.status === 'ayrildi'; })),
    b('ÇALIŞMA ALANI  (aktif gönüllüler)'),
    s('Kütüphaneye gelebilecek', say(function (k) { return aktif(k) && alan_(k, 'kutuphane'); })),
    s('Arşive gelebilecek', say(function (k) { return aktif(k) && alan_(k, 'arsiv'); })),
    s('— yalnızca kütüphane', say(function (k) { return aktif(k) && k.area === 'kutuphane'; })),
    s('— yalnızca arşiv', say(function (k) { return aktif(k) && k.area === 'arsiv'; })),
    s('— her ikisi birden', say(function (k) { return aktif(k) && k.area === 'ikisi'; })),
    b('NE ZAMAN BAŞLAYABİLİR'),
    s('Hemen', say(function (k) { return aktif(k) && k.start_pref === 'hemen'; })),
    s('Belirli bir tarihten sonra', say(function (k) { return aktif(k) && k.start_pref === 'tarihten_sonra'; })),
    b('GÜNLER  (hafta içi)'),
    s('Pazartesi', say(function (k) { return aktif(k) && gun_(k, 'pazartesi'); })),
    s('Salı', say(function (k) { return aktif(k) && gun_(k, 'sali'); })),
    s('Çarşamba', say(function (k) { return aktif(k) && gun_(k, 'carsamba'); })),
    s('Perşembe', say(function (k) { return aktif(k) && gun_(k, 'persembe'); })),
    s('Cuma', say(function (k) { return aktif(k) && gun_(k, 'cuma'); })),
    b('HAFTA SONU  (yalnızca çalışma açılırsa)'),
    s('★ Hafta sonu gelebilecek', say(function (k) { return aktif(k) && haftaSonu_(k); }))
  ];
}

/** Hazır listeleri hesaplar: [{ad, uyeler:[kayıt]}] */
function listeVerisi_(kayitlar) {
  return LISTELER.map(function (tanim) {
    var kosul = tanim[1], durum = tanim[2] || 'aktif', sirala = tanim[3];
    var uyeler = kayitlar.filter(function (k) {
      return (durum === 'hepsi' || k.status === durum) && kosul(k);
    });
    if (sirala === 'tarih') {
      uyeler.sort(function (a, b) { return String(a.start_date).localeCompare(String(b.start_date)); });
    } else {
      uyeler.sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'tr'); });
    }
    return { ad: tanim[0], uyeler: uyeler };
  });
}

/**
 * "Özet" sayfasını her kayıttan sonra yeniden hesaplar.
 * Formül yerine doğrudan sayı yazılır; tablo dili/ayarı ne olursa olsun doğru çalışır.
 */
function ozetiGuncelle_() {
  var dosya = dosya_();
  var veri = ozetVerisi_(tumKayitlar_());

  var satirlar = [
    [AYAR.KURUM + ' — Gönüllü Özeti', ''],
    ['Son hesaplama: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMMM yyyy HH:mm'), ''],
    ['', '']
  ];
  veri.forEach(function (v) {
    if (v.tur === 'baslik') { satirlar.push(['', '']); satirlar.push([v.ad, '']); }
    else satirlar.push([v.ad, v.sayi]);
  });

  var ozet = dosya.getSheetByName('Özet');
  if (!ozet) ozet = dosya.insertSheet('Özet', 0);
  ozet.clear();
  ozet.getRange(1, 1, satirlar.length, 2).setValues(satirlar);
  ozet.getRange(1, 1).setFontSize(15).setFontWeight('bold').setFontColor('#7c2d12');
  ozet.getRange(2, 1).setFontColor('#78716c').setFontSize(10);
  ozet.getRange(1, 1, satirlar.length, 1).setWrap(false);
  ozet.setColumnWidth(1, 280);
  ozet.setColumnWidth(2, 90);

  // Başlık satırlarını (B sütunu boş olanları) vurgula
  satirlar.forEach(function (s, i) {
    if (s[0] && s[1] === '' && s[0] === s[0].toUpperCase().replace('İ', 'İ')) {
      ozet.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#f5f5f4');
    }
  });
  ozet.getRange(4, 1, satirlar.length - 3, 2).setFontSize(11);
  ozet.getRange(1, 2, satirlar.length, 1).setHorizontalAlignment('right').setFontWeight('bold');
}

/**
 * "Listeler" sayfasını baştan kurar: her hazır liste bir bölüm, altında kişiler.
 * Her bölümün başında kopyalanmaya hazır e-posta satırı bulunur.
 */
function listeleriGuncelle_() {
  var dosya = dosya_();
  var kayitlar = tumKayitlar_();
  var sayfa = dosya.getSheetByName('Listeler');
  if (!sayfa) sayfa = dosya.insertSheet('Listeler', 1);
  sayfa.clear();

  var basliklar = ['Ad Soyad', 'Telefon', 'E-posta', 'Alan', 'Günler', 'Saat', 'Başlangıç', 'Ayda süre'];
  var satirlar = [];
  var bicim = [];   // {satir, tur}

  satirlar.push([AYAR.KURUM + ' — Hazır Listeler', '', '', '', '', '', '', '']);
  bicim.push({ satir: 1, tur: 'ana' });
  satirlar.push(['Son hesaplama: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMMM yyyy HH:mm') +
    ' — her yeni kayıt ve güncellemede kendini yeniler.', '', '', '', '', '', '', '']);
  bicim.push({ satir: 2, tur: 'not' });
  satirlar.push(['', '', '', '', '', '', '', '']);

  listeVerisi_(kayitlar).forEach(function (liste) {
    var ad = liste.ad, uyeler = liste.uyeler;

    satirlar.push([ad + '  (' + uyeler.length + ' kişi)', '', '', '', '', '', '', '']);
    bicim.push({ satir: satirlar.length, tur: 'baslik' });

    if (uyeler.length === 0) {
      satirlar.push(['— bu koşula uyan gönüllü yok —', '', '', '', '', '', '', '']);
      bicim.push({ satir: satirlar.length, tur: 'bos' });
    } else {
      satirlar.push(['Toplu e-posta:', uyeler.map(function (k) { return k.email; }).join(', '),
        '', '', '', '', '', '']);
      bicim.push({ satir: satirlar.length, tur: 'eposta' });

      satirlar.push(basliklar.slice());
      bicim.push({ satir: satirlar.length, tur: 'sutun' });

      uyeler.forEach(function (k) {
        satirlar.push([
          k.full_name, k.phone, k.email,
          ALAN[k.area] || '', hucre_('days', k.days), hucre_('times', k.times),
          k.start_pref === 'tarihten_sonra' ? tarihEtiketi_(k.start_date) : (BASLANGIC[k.start_pref] || ''),
          SURE[k.frequency] || ''
        ]);
      });
    }
    satirlar.push(['', '', '', '', '', '', '', '']);
  });

  sayfa.getRange(1, 1, satirlar.length, basliklar.length).setValues(satirlar);
  sayfa.getRange(1, 1, satirlar.length, basliklar.length).setFontSize(10).setFontFamily('Arial');

  bicim.forEach(function (b) {
    var aralik = sayfa.getRange(b.satir, 1, 1, basliklar.length);
    if (b.tur === 'ana')     aralik.setFontSize(15).setFontWeight('bold').setFontColor('#7c2d12');
    if (b.tur === 'not')     aralik.setFontSize(9).setFontColor('#78716c');
    if (b.tur === 'baslik')  aralik.setFontSize(12).setFontWeight('bold').setFontColor('#ffffff').setBackground('#7c2d12');
    if (b.tur === 'sutun')   aralik.setFontWeight('bold').setBackground('#f5f5f4').setFontColor('#57534e');
    if (b.tur === 'eposta')  aralik.setBackground('#fdf5ef').setFontColor('#7c2d12').setFontSize(9);
    if (b.tur === 'bos')     aralik.setFontColor('#a8a29e').setFontStyle('italic');
  });

  [170, 130, 210, 210, 175, 170, 180, 130]
    .forEach(function (g, i) { sayfa.setColumnWidth(i + 1, g); });
  sayfa.setFrozenRows(3);
}

/** Gönüllüler sayfasındaki bütün kayıtları nesne olarak döner. */
function tumKayitlar_() {
  var sayfa = sayfaAl_('Gönüllüler');
  var son = sayfa.getLastRow();
  if (son < 2) return [];
  return sayfa.getRange(2, 1, son - 1, SUTUNLAR.length).getValues()
    .filter(function (s) { return String(s[0]).trim(); })
    .map(satirdanNesne_);
}

/** Tabloyu açanlar için menü: üst menüden yenileme. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Gönüllü Sistemi')
      .addItem('Listeleri ve özeti yenile', 'hepsiniYenile')
      .addItem('Bugünün durumunu e-posta gönder', 'gunlukOzetGonder')
      .addSeparator()
      .addItem('Kayıt sil (e-posta ile)…', 'kayitSil')
      .addItem('Bütün kayıtları sil…', 'tumKayitlariSil')
      .addToUi();
  } catch (h) { /* betik tablo dışından çalışıyorsa menü eklenmez */ }
}

/** Menüden çağrılır: Özet ve Listeler sayfalarını yeniden hesaplar. */
function hepsiniYenile() {
  ozetiGuncelle_();
  listeleriGuncelle_();
  try { dosya_().toast('Özet ve listeler güncellendi.', 'Gönüllü Sistemi', 5); } catch (h) {}
}

/** İstenirse zamanlayıcıya bağlanabilir: güncel tabloyu e-postayla özetler. */
function gunlukOzetGonder() {
  var kayitlar = tumKayitlar_();
  var aktifler = kayitlar.filter(function (k) { return k.status === 'aktif'; });
  var liste = aktifler.map(function (k) {
    return '<tr><td style="padding:5px 14px 5px 0">' + kacir_(k.full_name) + '</td>' +
      '<td style="padding:5px 14px 5px 0">' + kacir_(ALAN[k.area] || '') + '</td>' +
      '<td style="padding:5px 14px 5px 0">' + kacir_(BASLANGIC[k.start_pref] || '') + '</td>' +
      '<td style="padding:5px 0">' + kacir_(hucre_('days', k.days)) + '</td></tr>';
  }).join('');

  var ozetAlici = adminEposta_().split(',')[0].trim();
  if (!ozetAlici) return; // yönetici adresi tanımlı değilse özet gönderilmez

  MailApp.sendEmail({
    to: ozetAlici,
    subject: AYAR.KURUM + ' — gönüllü durumu (' + aktifler.length + ' aktif)',
    htmlBody: sarmala_('Gönüllü durumu',
      '<p>Toplam <b>' + kayitlar.length + '</b> kayıt, <b>' + aktifler.length + '</b> aktif gönüllü.</p>' +
      '<table style="border-collapse:collapse;font-size:14px">' +
      '<tr><th align="left" style="padding:5px 14px 5px 0;color:#78716c">Ad Soyad</th>' +
      '<th align="left" style="padding:5px 14px 5px 0;color:#78716c">Alan</th>' +
      '<th align="left" style="padding:5px 14px 5px 0;color:#78716c">Başlangıç</th>' +
      '<th align="left" style="padding:5px 0;color:#78716c">Günler</th></tr>' + liste + '</table>' +
      '<p style="margin-top:18px"><a href="' + dosya_().getUrl() + '">Tabloyu aç →</a></p>')
  });
}

/* ═══════════════ E-POSTA ═══════════════ */

function bildirimGonder_(kayit, fark, ilkKez) {
  var adminler = adminEposta_().split(',').map(function (a) { return a.trim(); })
    .filter(function (a) { return a; }).join(',');

  // Gönüllüye özet
  try {
    MailApp.sendEmail({
      to: kayit.email,
      subject: ilkKez ? 'Gönüllü kaydınız alındı — ' + AYAR.KURUM : 'Gönüllü tercihiniz güncellendi — ' + AYAR.KURUM,
      htmlBody: sarmala_(ilkKez ? 'Kaydınız alındı, teşekkürler!' : 'Tercihiniz güncellendi',
        '<p>Merhaba ' + kacir_(kayit.full_name) + ',</p>' +
        '<p>' + (ilkKez ? 'Gönüllü kaydınız aşağıdaki şekilde alınmıştır.' : 'Tercihleriniz aşağıdaki şekilde güncellenmiştir.') + '</p>' +
        tablo_(kayit) +
        '<p style="margin:24px 0 6px"><a href="' + AYAR.FORM_ADRESI + '" style="display:inline-block;' +
        'background:#7c2d12;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;' +
        'border-radius:9px">Tercihimi görüntüle / değiştir</a></p>' +
        '<p style="color:#78716c;font-size:13px">Planlarınız değişirse bu bağlantıya tıklayıp aynı ' +
        'e-posta adresinizle girmeniz yeterli: mevcut tercihiniz karşınıza gelir, dilediğiniz zaman ' +
        'değiştirebilir ya da bir süre ara verebilirsiniz.</p>')
    });
  } catch (h) { Logger.log('Gönüllü maili gönderilemedi: ' + h.message); }

  if (!adminler) return;

  var farkHtml = ilkKez ? '' : (fark.length === 0 ? '<p><i>İçerikte değişiklik yok.</i></p>' :
    '<h3 style="font-size:15px;margin:20px 0 8px">Değişenler</h3><table style="border-collapse:collapse;font-size:14px">' +
    '<tr><th align="left" style="padding:4px 12px 4px 0;color:#78716c;font-weight:500">Alan</th>' +
    '<th align="left" style="padding:4px 12px 4px 0;color:#78716c;font-weight:500">Önce</th>' +
    '<th align="left" style="padding:4px 0;color:#78716c;font-weight:500">Sonra</th></tr>' +
    fark.map(function (f) {
      return '<tr><td style="padding:4px 12px 4px 0"><b>' + kacir_(f.etiket) + '</b></td>' +
        '<td style="padding:4px 12px 4px 0;color:#b91c1c;text-decoration:line-through">' + kacir_(f.once) + '</td>' +
        '<td style="padding:4px 0;color:#15803d">' + kacir_(f.sonra) + '</td></tr>';
    }).join('') + '</table>');

  try {
    MailApp.sendEmail({
      to: adminler,
      subject: (ilkKez ? '[Yeni gönüllü] ' : '[Tercih güncellemesi] ') + kayit.full_name + ' — ' + (ALAN[kayit.area] || ''),
      htmlBody: sarmala_(ilkKez ? 'Yeni gönüllü kaydı' : 'Gönüllü tercihini güncelledi',
        farkHtml + '<h3 style="font-size:15px;margin:20px 0 8px">Güncel kayıt</h3>' + tablo_(kayit) +
        '<p style="margin-top:18px"><a href="' + dosya_().getUrl() + '">Tüm gönüllü listesini aç →</a></p>')
    });
  } catch (h) { Logger.log('Admin maili gönderilemedi: ' + h.message); }
}

function tablo_(kayit) {
  var satirlar = SUTUNLAR.filter(function (s) {
      return s[0] !== 'created_at' && s[0] !== 'updated_at' && KULLANILMAYAN.indexOf(s[0]) < 0;
    })
    .map(function (s) {
      return '<tr><td style="padding:6px 12px 6px 0;color:#78716c;vertical-align:top;white-space:nowrap">' + s[1] + '</td>' +
        '<td style="padding:6px 0"><b>' + kacir_(hucre_(s[0], kayit[s[0]]) || '—') + '</b></td></tr>';
    }).join('');
  return '<table style="border-collapse:collapse;font-size:14px">' + satirlar + '</table>';
}

function sarmala_(baslik, govde) {
  return '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917;max-width:640px">' +
    '<h2 style="color:#7c2d12;margin:0 0 4px">' + kacir_(baslik) + '</h2>' +
    '<hr style="border:none;border-top:2px solid #f5f5f4;margin:12px 0 16px">' + govde +
    '<p style="color:#78716c;font-size:12px;margin-top:24px">Bu e-posta ' + AYAR.KURUM +
    ' Gönüllü Görev Paylaşımı sisteminden otomatik gönderilmiştir.</p></div>';
}

/* ═══════════════ YARDIMCILAR ═══════════════ */

function ozet_(metin) {
  var bayt = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(metin), Utilities.Charset.UTF_8);
  return bayt.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function kacir_(metin) {
  return String(metin === null || metin === undefined ? '' : metin)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gelecekAylar_(adet) {
  var bugun = new Date(), liste = [];
  for (var i = 0; i < adet; i++) {
    var t = new Date(bugun.getFullYear(), bugun.getMonth() + i, 1);
    var anahtar = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2);
    liste.push({ key: anahtar, label: AY_ADI[t.getMonth()] + ' ' + t.getFullYear() });
  }
  return liste;
}

function ayEtiketi_(anahtar) {
  var p = String(anahtar).split('-');
  var i = parseInt(p[1], 10) - 1;
  return AY_ADI[i] ? AY_ADI[i] + ' ' + p[0] : anahtar;
}

function aylariCoz_(metin) {
  return String(metin || '').split(',').map(function (p) {
    p = p.trim();
    for (var i = 0; i < AY_ADI.length; i++) {
      var kalip = new RegExp('^' + AY_ADI[i] + '\\s+(\\d{4})$');
      var e = p.match(kalip);
      if (e) return e[1] + '-' + ('0' + (i + 1)).slice(-2);
    }
    return '';
  }).filter(function (x) { return x; });
}

/** '2026-09-15' → '15 Eylül 2026'  (e-postalarda ve tabloda okunur görünsün diye) */
function tarihEtiketi_(deger) {
  if (!deger) return '';
  var m = String(deger).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(deger);
  return parseInt(m[3], 10) + ' ' + AY_ADI[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

/** Tabloda ne yazıyorsa ('15 Eylül 2026', tarih hücresi veya düz metin) → '2026-09-15' */
function tarihMetni_(deger) {
  if (!deger) return '';
  if (Object.prototype.toString.call(deger) === '[object Date]') {
    return Utilities.formatDate(deger, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var metin = String(deger).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(metin)) return metin;
  var m = metin.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (m) {
    var ay = AY_ADI.indexOf(m[2]);
    if (ay >= 0) return m[3] + '-' + ('0' + (ay + 1)).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return metin;
}

/* ═══════════════ TEMİZLİK ═══════════════ */

/**
 * Belirli gönüllü kayıtlarını siler (deneme kayıtlarını temizlemek için).
 *
 * Tablodaki "Gönüllü Sistemi" menüsünden çalıştırırsanız e-posta sorar.
 * Betik editöründen çalıştırırsanız aşağıdaki listeyi kullanır — silmek
 * istediğiniz adresleri buraya yazın:
 */
var SILINECEK_EPOSTALAR = [
  // 'deneme@ornek.com',
  // 'test@ornek.com',
];

function kayitSil() {
  var hedefler = SILINECEK_EPOSTALAR.slice();
  var ui = arayuz_();

  if (ui) {
    var cevap = ui.prompt('Kayıt sil',
      'Silinecek gönüllünün e-posta adresi:\n(birden fazlaysa virgülle ayırın)',
      ui.ButtonSet.OK_CANCEL);
    if (cevap.getSelectedButton() !== ui.Button.OK) return;
    hedefler = String(cevap.getResponseText() || '').split(',');
  }

  hedefler = hedefler.map(function (e) { return String(e).trim().toLowerCase(); })
    .filter(function (e) { return e; });

  if (!hedefler.length) {
    bilgi_(ui, 'Silinecek adres belirtilmedi.');
    return;
  }

  var silinen = epostalariSil_(hedefler);
  bilgi_(ui, silinen === 0
    ? 'Bu adreslerle eşleşen kayıt bulunamadı.'
    : silinen + ' kayıt silindi. Özet ve listeler güncellendi.');
}

/**
 * BÜTÜN gönüllü kayıtlarını ve değişiklik günlüğünü siler; başlık satırları kalır.
 * Denemeler bittikten sonra temiz bir başlangıç için kullanın. Geri alınamaz.
 */
function tumKayitlariSil() {
  var ui = arayuz_();
  if (ui) {
    var cevap = ui.prompt('Bütün kayıtları sil',
      'Bu işlem TÜM gönüllü kayıtlarını ve değişiklik günlüğünü siler, geri alınamaz.\n\n' +
      'Onaylamak için büyük harfle SIL yazın:', ui.ButtonSet.OK_CANCEL);
    if (cevap.getSelectedButton() !== ui.Button.OK) return;
    if (String(cevap.getResponseText() || '').trim() !== 'SIL') {
      bilgi_(ui, 'İşlem iptal edildi.');
      return;
    }
  }

  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  try {
    [['Gönüllüler', SUTUNLAR.length], ['Değişiklikler', 5]].forEach(function (t) {
      var sayfa = sayfaAl_(t[0]);
      var son = sayfa.getLastRow();
      if (son > 1) sayfa.deleteRows(2, son - 1);
    });
    ozetiGuncelle_();
    listeleriGuncelle_();
  } finally {
    kilit.releaseLock();
  }
  bilgi_(ui, 'Bütün kayıtlar silindi. Tablo yeni gönüllüler için hazır.');
}

/** Verilen e-postalara ait satırları hem Gönüllüler hem Değişiklikler sayfasından siler. */
function epostalariSil_(epostalar) {
  var kilit = LockService.getScriptLock();
  kilit.waitLock(20000);
  var silinen = 0;
  try {
    // Gönüllüler: A sütunu e-posta
    silinen = satirlariSil_(sayfaAl_('Gönüllüler'), 1, epostalar);
    // Değişiklikler: B sütunu e-posta
    satirlariSil_(sayfaAl_('Değişiklikler'), 2, epostalar);
    ozetiGuncelle_();
    listeleriGuncelle_();
  } finally {
    kilit.releaseLock();
  }
  return silinen;
}

/** Belirtilen sütunda eşleşen satırları aşağıdan yukarıya siler (kayma olmasın diye). */
function satirlariSil_(sayfa, sutunNo, degerler) {
  var son = sayfa.getLastRow();
  if (son < 2) return 0;
  var hucreler = sayfa.getRange(2, sutunNo, son - 1, 1).getValues();
  var silinen = 0;
  for (var i = hucreler.length - 1; i >= 0; i--) {
    var deger = String(hucreler[i][0]).trim().toLowerCase();
    if (degerler.indexOf(deger) >= 0) {
      sayfa.deleteRow(i + 2);
      silinen++;
    }
  }
  return silinen;
}

/** Tablo arayüzü varsa döner; betik editöründen çalışıyorsa null. */
function arayuz_() {
  try { return SpreadsheetApp.getUi(); } catch (h) { return null; }
}

function bilgi_(ui, mesaj) {
  if (ui) ui.alert('Gönüllü Sistemi', mesaj, ui.ButtonSet.OK);
  else Logger.log(mesaj);
}

/* ═══════════════ KURULUM ═══════════════ */

/** Betiği ilk kez kurarken bir kez elle çalıştırın: sayfaları ve izinleri hazırlar. */
function kurulum() {
  var tablo = dosya_();          // bağlantıyı en başta dener, hata varsa burada görürsünüz
  sayfaAl_('Gönüllüler');
  sayfaAl_('Değişiklikler');
  ozetiGuncelle_();
  listeleriGuncelle_();
  menuTetikleyicisiKur_(tablo);
  MailApp.sendEmail({
    to: String(AYAR.ADMIN_EPOSTA).split(',')[0].trim(),
    subject: AYAR.KURUM + ' — gönüllü sistemi kuruldu',
    htmlBody: sarmala_('Kurulum tamam',
      '<p>Gönüllü görev paylaşımı sistemi bu E-Tablo üzerinde çalışmaya hazır.</p>' +
      '<p><a href="' + tablo.getUrl() + '">E-Tabloyu aç →</a></p>')
  });
}

/**
 * "Gönüllü Sistemi" menüsünün tabloda görünmesini sağlar.
 * Betik tabloya bağlıysa gerekmez; bağımsız projede onOpen kendiliğinden
 * çalışmadığı için kurulabilir tetikleyici eklenir. İki kez eklenmez.
 */
function menuTetikleyicisiKur_(tablo) {
  try {
    var varOlanlar = ScriptApp.getProjectTriggers();
    for (var i = 0; i < varOlanlar.length; i++) {
      if (varOlanlar[i].getHandlerFunction() === 'onOpen') return;
    }
    ScriptApp.newTrigger('onOpen').forSpreadsheet(tablo).onOpen().create();
  } catch (h) {
    Logger.log('Menü tetikleyicisi eklenemedi: ' + h.message);
  }
}
