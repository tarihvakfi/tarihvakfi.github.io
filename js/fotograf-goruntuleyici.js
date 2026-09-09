(function () {
  'use strict';

  var kok, alan, resim, baslik;
  var durum = { olcek: 1, aci: 0, x: 0, y: 0 };
  var noktalar = new Map();
  var ilkUzaklik = 0, ilkOlcek = 1, sonDokunma = 0;

  function kur() {
    if (kok) return;
    kok = document.createElement('div');
    kok.className = 'tv-foto-goruntuleyici';
    kok.setAttribute('role', 'dialog');
    kok.setAttribute('aria-modal', 'true');
    kok.setAttribute('aria-label', 'Fotoğraf görüntüleyici');
    kok.innerHTML =
      '<div class="tv-foto-ust">' +
        '<div class="tv-foto-baslik"></div>' +
        '<button type="button" class="tv-foto-kapat" aria-label="Kapat">×</button>' +
      '</div>' +
      '<div class="tv-foto-alan"><img alt=""></div>' +
      '<div class="tv-foto-araclar" aria-label="Fotoğraf araçları">' +
        '<button type="button" data-foto-is="sol" aria-label="Sola döndür">↶ <span>Sola döndür</span></button>' +
        '<button type="button" data-foto-is="eksi" aria-label="Küçült">− <span>Küçült</span></button>' +
        '<button type="button" data-foto-is="sifir" aria-label="Görünümü sıfırla">↺ <span>Sıfırla</span></button>' +
        '<button type="button" data-foto-is="arti" aria-label="Büyüt">+ <span>Büyüt</span></button>' +
        '<button type="button" data-foto-is="sag" aria-label="Sağa döndür">↷ <span>Sağa döndür</span></button>' +
      '</div>';
    document.body.appendChild(kok);
    alan = kok.querySelector('.tv-foto-alan');
    resim = alan.querySelector('img');
    baslik = kok.querySelector('.tv-foto-baslik');

    kok.querySelector('.tv-foto-kapat').addEventListener('click', kapat);
    kok.querySelector('.tv-foto-araclar').addEventListener('click', function (e) {
      var b = e.target.closest('[data-foto-is]');
      if (!b) return;
      var is = b.dataset.fotoIs;
      if (is === 'sol') durum.aci -= 90;
      if (is === 'sag') durum.aci += 90;
      if (is === 'eksi') durum.olcek = sinirla(durum.olcek / 1.25);
      if (is === 'arti') durum.olcek = sinirla(durum.olcek * 1.25);
      if (is === 'sifir') sifirla();
      ciz();
    });

    alan.addEventListener('wheel', function (e) {
      e.preventDefault();
      durum.olcek = sinirla(durum.olcek * (e.deltaY < 0 ? 1.12 : .89));
      ciz();
    }, { passive: false });

    alan.addEventListener('dblclick', function () {
      durum.olcek = durum.olcek > 1.1 ? 1 : 2;
      if (durum.olcek === 1) { durum.x = 0; durum.y = 0; }
      ciz();
    });

    alan.addEventListener('pointerdown', basla);
    alan.addEventListener('pointermove', surukle);
    alan.addEventListener('pointerup', bitir);
    alan.addEventListener('pointercancel', bitir);
  }

  function sinirla(n) { return Math.max(.5, Math.min(6, n)); }

  function sifirla() {
    durum.olcek = 1;
    durum.aci = 0;
    durum.x = 0;
    durum.y = 0;
  }

  function ciz() {
    if (!resim) return;
    resim.style.transform = 'translate3d(calc(-50% + ' + durum.x + 'px),calc(-50% + ' + durum.y + 'px),0) rotate(' + durum.aci + 'deg) scale(' + durum.olcek + ')';
  }

  function uzaklik() {
    var p = Array.from(noktalar.values());
    if (p.length < 2) return 0;
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  function basla(e) {
    alan.setPointerCapture(e.pointerId);
    noktalar.set(e.pointerId, { x: e.clientX, y: e.clientY, onceX: e.clientX, onceY: e.clientY });
    if (noktalar.size === 2) { ilkUzaklik = uzaklik(); ilkOlcek = durum.olcek; }
    alan.classList.add('surukleniyor');
  }

  function surukle(e) {
    var p = noktalar.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (noktalar.size >= 2) {
      var u = uzaklik();
      if (ilkUzaklik) durum.olcek = sinirla(ilkOlcek * u / ilkUzaklik);
    } else {
      durum.x += p.x - p.onceX;
      durum.y += p.y - p.onceY;
    }
    p.onceX = p.x; p.onceY = p.y;
    ciz();
  }

  function bitir(e) {
    noktalar.delete(e.pointerId);
    if (noktalar.size < 2) { ilkUzaklik = 0; ilkOlcek = durum.olcek; }
    if (!noktalar.size) alan.classList.remove('surukleniyor');
    if (e.pointerType === 'touch' && Date.now() - sonDokunma < 280) {
      durum.olcek = durum.olcek > 1.1 ? 1 : 2;
      if (durum.olcek === 1) { durum.x = 0; durum.y = 0; }
      ciz();
    }
    if (e.pointerType === 'touch') sonDokunma = Date.now();
  }

  function ac(src, ad) {
    if (!src) return;
    kur();
    sifirla();
    resim.src = src;
    resim.alt = ad || 'Fotoğraf';
    baslik.textContent = ad || 'Fotoğraf';
    kok.classList.add('acik');
    document.documentElement.classList.add('tv-foto-acik');
    ciz();
    kok.querySelector('.tv-foto-kapat').focus();
  }

  function kapat() {
    if (!kok) return;
    kok.classList.remove('acik');
    document.documentElement.classList.remove('tv-foto-acik');
    noktalar.clear();
    setTimeout(function () { if (!kok.classList.contains('acik')) resim.removeAttribute('src'); }, 200);
  }

  document.addEventListener('keydown', function (e) {
    if (!kok || !kok.classList.contains('acik')) return;
    if (e.key === 'Escape') kapat();
    if (e.key === '+' || e.key === '=') { durum.olcek = sinirla(durum.olcek * 1.25); ciz(); }
    if (e.key === '-') { durum.olcek = sinirla(durum.olcek / 1.25); ciz(); }
    if (e.key === 'ArrowLeft') { durum.aci -= 90; ciz(); }
    if (e.key === 'ArrowRight') { durum.aci += 90; ciz(); }
  });

  document.addEventListener('click', function (e) {
    var hedef = e.target.closest('[data-tv-foto]');
    if (!hedef) return;
    e.preventDefault();
    e.stopPropagation();
    ac(hedef.dataset.tvFoto || (hedef.tagName === 'IMG' ? hedef.src : ''), hedef.dataset.tvFotoAd || hedef.alt || 'Fotoğraf');
  }, true);

  window.TVFoto = { ac: ac, kapat: kapat };
})();
