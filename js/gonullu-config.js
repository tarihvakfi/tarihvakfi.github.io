/* Tarih Vakfı — Apps Script adresleri
 *
 * Bu dosya iki AYRI sistemin adresini tutar. İkisi birbirinden bağımsızdır:
 * ayrı betik, ayrı Google E-Tablo, ayrı dağıtım adresi.
 *
 * Sayfalar güncellenince bu dosyaya dokunulmaz; adresleri bir daha girmeniz gerekmez.
 * Adres değişirse (yeni bir dağıtım oluşturulduysa) yalnızca burayı güncelleyin.
 */

/* ── 1. Gönüllü Planlaması ──────────────────────────────────────────────
 * Okuyan sayfalar: gonullu-planlamasi.html · yonetim.html
 * (Bu adres zaten çalışıyor — dokunmayın.)
 */
window.TV_APP_URL = "https://script.google.com/macros/s/AKfycbxKD1hzj0Qh6Oqm8Olocn8FMozDd026uZngj0yy70mu7clOn2S0laKpij7INgT8Fg/exec";

/* ── 2. Kitap Envanteri (kütüphane taşınması) ───────────────────────────
 * Okuyan sayfalar: kitap-envanteri.html · kunye-onay.html
 *
 * BURAYI DOLDURUN: KitapEnvanteri.gs betiğini dağıttığınızda ("Dağıt → Yeni dağıtım
 * → Web uygulaması") verilen, /exec ile biten adresi tırnakların arasına yapıştırın.
 *
 * DİKKAT: Bu, yukarıdaki adresten FARKLI bir adrestir. Gönüllü sisteminin adresini
 * buraya kopyalarsanız envanter formu çalışmaz.
 *
 * Envanter formunu henüz kurmadıysanız bu satırı olduğu gibi bırakın; gönüllü
 * sistemi bundan etkilenmez.
 */
window.TV_ENVANTER_URL = "https://script.google.com/macros/s/AKfycbxizSokX0hZLTjiCaEyzpLa4PnauIPEuEqZC5JtzA-Vkuwrc6hav0ohxAJejBKsOo6_/exec";

/* Ekranların açılışta sunucudan beklemeden kullanacağı sabit kütüphane ayarları.
 * Raf düzeni değişirse Apps Script'teki AYAR bölümüyle birlikte güncellenmelidir.
 * Kitaplar, sayımlar ve kararlar burada tutulmaz; her zaman canlı tablodan gelir. */
(function () {
  var raflar = [];
  for (var i = 1; i <= 60; i++) {
    var n = i, ad = '';
    while (n > 0) {
      n--;
      ad = String.fromCharCode(65 + (n % 26)) + ad;
      n = Math.floor(n / 26);
    }
    raflar.push(ad);
  }
  window.TV_ENVANTER_CONFIG = {
    ok: true,
    org: 'Tarih Vakfı',
    kategoriler: {
      gidecek: { ad: 'Gidecek', renk: '#2e6440' },
      belki: { ad: 'Gitse de olur', renk: '#a06a12' },
      gitmeyecek: { ad: 'Gitmeyecek', renk: '#9c2233' },
      belirsiz: { ad: 'Belirsiz', renk: '#2a5b86' },
      diger: { ad: 'Diğer', renk: '#5a4a52', serbest: true }
    },
    durumlar: ['Sağlam', 'Yıpranmış', 'Küflü/böcekli'],
    kurallar: [],
    mekanlar: [
      { kod: 'G', ad: 'Giriş Kat', rafSayisi: 53 },
      { kod: 'U', ad: 'Üst Kat', rafBaslangic: 53, rafSayisi: 7 },
      { kod: 'X', ad: 'Diğer', rafSayisi: 6 }
    ],
    siniflandirilmadi: 'Sınıflandırılmadı',
    kutuKullan: false,
    rafHarfleri: raflar,
    siraSayisi: 6
  };
})();
