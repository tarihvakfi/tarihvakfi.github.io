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
window.TV_ENVANTER_URL = "https://script.google.com/macros/s/AKfycbxCd0rKSe__Lp9ISe8A3Gh9Kq5ZShrzQIXVBayD5x2lUjQ0Cb36qghf74Fwk3W2u-t-/exec";