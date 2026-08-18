/* Kitap Envanteri — çevrimdışı kabuk.
 *
 * Yalnızca sayfanın kendisini ve simgeleri saklar. Kayıtlar POST ile gider;
 * onlar buradan geçmez, sayfa içindeki kuyruk hallediyor.
 *
 * Sayfayı güncellediğinizde SURUM numarasını artırın — eski kabuk temizlenir.
 */
var SURUM = 'tv-envanter-v1';
var KABUK = [
  './kitap-envanteri.html',
  './envanter-manifest.json',
  './assets/envanter-192.png',
  './assets/envanter-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SURUM)
      .then(function (c) { return c.addAll(KABUK); })
      .catch(function () { /* biri eksikse kurulum yine de sürsün */ })
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

  // Önce ağ: sayfa güncellenirse gönüllü eski sürümde kalmasın.
  e.respondWith(
    fetch(istek).then(function (yanit) {
      var kopya = yanit.clone();
      caches.open(SURUM).then(function (c) { c.put(istek, kopya); }).catch(function () {});
      return yanit;
    }).catch(function () {
      return caches.match(istek).then(function (bulunan) {
        return bulunan || caches.match('./kitap-envanteri.html');
      });
    })
  );
});
