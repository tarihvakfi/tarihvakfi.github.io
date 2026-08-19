/* Kitap Envanteri — çevrimdışı kabuk.
 *
 * Sayfayı, simgeleri ve AYAR DOSYASINI saklar. Kayıtlar POST ile gider;
 * onlar buradan geçmez, sayfa içindeki kuyruk hallediyor.
 *
 * js/gonullu-config.js burada olmazsa çevrimdışı açılışta sayfa "Sistem adresi
 * tanımlanmamış" der ve gönüllü hiç giriş yapamaz — kuyruktaki kayıtlar da
 * gönderilemez. Bu yüzden kabuğun bir parçası.
 *
 * Sayfayı güncellediğinizde SURUM numarasını artırın — eski kabuk temizlenir.
 */
var SURUM = 'tv-envanter-v2';
var KABUK = [
  './kitap-envanteri.html',
  './js/gonullu-config.js',
  './envanter-manifest.json',
  './assets/envanter-192.png',
  './assets/envanter-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SURUM).then(function (c) {
      // Tek tek eklenir: biri eksikse (ör. simge yüklenmediyse) diğerleri yine
      // saklansın. cache.addAll hepsini birden iptal ediyordu — bir dosya 404
      // verince çevrimdışı kabuk sessizce hiç oluşmuyordu.
      return Promise.all(KABUK.map(function (y) {
        return c.add(y)['catch'](function () { /* bu dosya olmadan da devam */ });
      }));
    })['catch'](function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (adlar) {
      return Promise.all(adlar.map(function (a) {
        return a === SURUM ? null : caches.delete(a);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var istek = e.request;
  if (istek.method !== 'GET') return;                       // kayıt gönderimine karışma
  var adres = new URL(istek.url);
  if (adres.origin !== self.location.origin) return;        // Apps Script'e / Drive'a karışma

  // Yalnızca envanter formunun kabuğu saklanır; sitenin geri kalanına karışılmaz.
  var kabukta = KABUK.some(function (y) {
    return adres.pathname === new URL(y, self.location.href).pathname;
  });
  if (!kabukta) return;

  // Önce ağ, ama sınırlı süre: vakıf wifi'si "bağlı ama akmıyor" durumundayken
  // fetch dakikalarca asılı kalabiliyor. 4 saniyede yanıt yoksa kabuktan aç.
  e.respondWith(
    yarist(istek).then(function (yanit) {
      if (yanit) return yanit;
      return kabuktanVer(istek);
    })['catch'](function () { return kabuktanVer(istek); })
  );
});

function yarist(istek) {
  return new Promise(function (coz) {
    var bitti = false;
    var sayac = setTimeout(function () { if (!bitti) { bitti = true; coz(null); } }, 4000);
    fetch(istek).then(function (yanit) {
      var kopya = yanit.clone();
      caches.open(SURUM).then(function (c) { c.put(istek, kopya); })['catch'](function () {});
      if (!bitti) { bitti = true; clearTimeout(sayac); coz(yanit); }
    })['catch'](function () {
      if (!bitti) { bitti = true; clearTimeout(sayac); coz(null); }
    });
  });
}

function kabuktanVer(istek) {
  // ignoreSearch: sayfa ayar dosyasını "?v=20260818" ile ister, kabukta ise
  // sorgusuz duruyor. Bu olmadan çevrimdışı açılışta ayar dosyası bulunamıyordu.
  return caches.match(istek, { ignoreSearch: true }).then(function (bulunan) {
    return bulunan || caches.match('./kitap-envanteri.html');
  });
}