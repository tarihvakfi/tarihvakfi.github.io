(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var D = {
    ad: '', sifre: '', bolum: 'secim', gorunum: 'bekleyen',
    kararlar: [], kararToplam: 0, kararBas: 0, kararAdet: 20,
    kayitlar: [], kayitToplam: 0, kayitBas: 0, kayitAdet: 20,
    durum: null, raflar: [], raflarYuklendi: false, rafHaritasiTam: false,
    rafOzetiVar: false, rafOzetiHata: false, rafHaritaIstegi: null, rafBas: 0,
    seciliRaf: '', rafKitaplar: [], rafKitapToplam: 0,
    rafKitapIstegi: null, rafKitapIstekAnahtari: '', rafKitapYukluAnahtari: '', rafKitapIstekNo: 0,
    kararGuncellemeleri: {},
    cfg: window.TV_ENVANTER_CONFIG || null, islem: 0
  };
  var kararEtiket = { 'Gidecek':'Gitsin', 'Gitse de olur':'Gitse de olur', 'Gitmeyecek':'Gitmesin', 'Belirsiz':'Belirsiz' };
  var kararKod = { gidecek:'Gitsin', belki:'Gitse de olur', gitmeyecek:'Gitmesin', belirsiz:'Belirsiz' };
  var kararSinif = { 'Gidecek':'g', 'Gitse de olur':'s', 'Gitmeyecek':'k', 'Belirsiz':'m' };
  var bildirimZamani, sistemHazirlikNo = 0, sistemKapatmaZamani, sistemSerbestBirakmaZamani;
  var BASLANGIC_ONBELLEGI = 'tv_koord_baslangic_v6_cloudflare';
  var yazanEylemler = ['kararVer','kararGorusGeriAl','kararGeriAl','sayimKaydet','sayimOnayla','sayimGeriAl','siraSec','siraBirak','siraBitir','kitapIste','onayla','topluOnayla','kunyeErtele','kutula'];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function sayi(v) { return Number(v || 0).toLocaleString('tr-TR'); }

  function hataMetni(e, konu) {
    if (e && e.message === 'AĞ') {
      return navigator.onLine === false
        ? 'İnternet bağlantısı yok. Bağlantı gelince tekrar deneyin.'
        : (konu || 'Bilgi') + ' kitap sunucusundan alınamadı. Sunucu geç yanıt veriyor; biraz sonra tekrar deneyin.';
    }
    return (e && e.message) || ((konu || 'İşlem') + ' tamamlanamadı.');
  }

  function api(action, yuk, timeout) {
    return window.TVEnvanterAg.request(window.TV_ENVANTER_URL,
      Object.assign({ action: action, sifre: D.sifre }, yuk || {}), { timeout: timeout || 30000 })
      .then(function (r) {
        if (!r || !r.ok) {
          var e = new Error((r && r.error) || 'İşlem tamamlanamadı.');
          e.sifreHatasi = !!(r && r.sifreHatasi);
          throw e;
        }
        if (yazanEylemler.indexOf(action) >= 0) try { localStorage.removeItem(BASLANGIC_ONBELLEGI); } catch (h) {}
        return r;
      });
  }

  function mesaj(el, tur, metin) {
    if (!el) return;
    el.classList.add('mesaj');
    el.classList.remove('hata', 'iyi');
    if (tur) el.classList.add(tur);
    el.textContent = metin || '';
  }

  function mesgul(btn, acik, yazi) {
    if (!btn) return;
    if (acik) { btn.dataset.eski = btn.textContent; btn.textContent = yazi || 'Bekleyin…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.eski || btn.textContent; btn.disabled = false; }
  }

  function bildir(metin) {
    clearTimeout(bildirimZamani);
    $('bildirim').textContent = metin;
    $('bildirim').classList.add('goster');
    bildirimZamani = setTimeout(function () { $('bildirim').classList.remove('goster'); }, 3500);
  }

  function sistemEtkilesimi(acik) {
    var ana = document.querySelector('main'), menu = document.querySelector('.ana-menu');
    if (ana) { ana.inert = !acik; ana.setAttribute('aria-busy', acik ? 'false' : 'true'); }
    if (menu) menu.inert = !acik;
  }

  function sistemDurumu(tur, kisa, baslik, aciklama) {
    var durum = $('sistemDurum'), katman = $('sistemHazirlik');
    durum.classList.remove('bekliyor', 'hazir', 'hata');
    durum.classList.add(tur);
    durum.disabled = tur !== 'hata';
    $('sistemDurumMetin').textContent = kisa;
    katman.classList.remove('bekliyor', 'hazir', 'hata');
    katman.classList.add(tur);
    $('sistemHazirlikBaslik').textContent = baslik;
    $('sistemHazirlikMetin').textContent = aciklama;
    $('btnSistemTekrar').classList.toggle('gizli', tur !== 'hata');
  }

  function sistemYukleniyor() {
    clearTimeout(sistemKapatmaZamani);
    clearTimeout(sistemSerbestBirakmaZamani);
    var no = ++sistemHazirlikNo;
    $('sistemHazirlik').classList.remove('gizli');
    sistemEtkilesimi(false);
    sistemDurumu('bekliyor', 'Veriler hazırlanıyor — lütfen bekleyin',
      'Bilgiler hazırlanıyor…',
      'Güncel raf ve kitap kayıtları getiriliyor. Ekran hazır olduğunda çalışmaya başlayabilirsiniz.');
    var context = { no:no, baslangic:Date.now() };
    /* Kısa hazırlık uyarısından sonra veri gelene kadar durumu üst çubukta göster. */
    sistemSerbestBirakmaZamani = setTimeout(function () {
      if (context.no !== sistemHazirlikNo || !$('sistemHazirlik').classList.contains('bekliyor')) return;
      sistemEtkilesimi(true);
      $('sistemHazirlik').classList.add('gizli');
      $('sistemDurumMetin').textContent = 'Veriler getiriliyor…';
    }, 2200);
    return context;
  }

  function sistemHazir(context) {
    var kalan = Math.max(0, 1600 - (Date.now() - context.baslangic));
    return new Promise(function (tamam) { setTimeout(tamam, kalan); }).then(function () {
      if (context.no !== sistemHazirlikNo) return;
      clearTimeout(sistemSerbestBirakmaZamani);
      sistemEtkilesimi(true);
      sistemDurumu('hazir', 'Sistem hazır — çalışmaya başlayabilirsiniz',
        'Sistem hazır', 'Güncel bilgiler alındı. Çalışmaya başlayabilirsiniz.');
      sistemKapatmaZamani = setTimeout(function () {
        if (context.no === sistemHazirlikNo) $('sistemHazirlik').classList.add('gizli');
      }, 950);
    });
  }

  function sistemHatasiGoster(context, e) {
    if (context.no !== sistemHazirlikNo) return;
    clearTimeout(sistemSerbestBirakmaZamani);
    $('sistemHazirlik').classList.add('gizli');
    sistemEtkilesimi(true);
    if (e && e.sifreHatasi) {
      return;
    }
    sistemDurumu('hata', 'Bağlantı gecikti — yeniden deneyin',
      'Bilgiler alınamadı',
      hataMetni(e, 'Güncel bilgiler'));
    $('sistemHazirlik').classList.add('gizli');
  }

  function foto(id, url, boyut) {
    var adres = String(url || '');
    if (adres && !/drive\.google\.com|googleusercontent\.com/i.test(adres)) {
      return window.TVEnvanterAg.photoUrl ? window.TVEnvanterAg.photoUrl(adres, boyut || 900) : adres;
    }
    var kimlik = id || (adres.match(/[-\w]{25,}/) || [])[0];
    if (kimlik) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(kimlik) + '&sz=w' + (boyut || 900);
    return adres;
  }

  function parcala(kod) {
    var m = /^([^-]+)-([A-ZÇĞİÖŞÜ]+)(\d+)$/.exec(String(kod || ''));
    return m ? { kat:m[1], kitaplik:m[2], sira:Number(m[3]) } : { kat:'', kitaplik:'', sira:0 };
  }

  function katAdi(kod) {
    var m = ((D.cfg || {}).mekanlar || []).find(function (x) { return x.kod === kod; });
    return m ? m.ad : kod;
  }

  function yerAdi(kod) {
    var p = parcala(kod);
    return katAdi(p.kat) + ' · ' + p.kitaplik + ' kitaplığı · ' + p.sira + '. sıra';
  }

  function kararRozeti(kategori, yazi, durum) {
    var ad = kararEtiket[kategori] || yazi || 'Karar bekliyor';
    return '<span class="rozet ' + (kararSinif[kategori] || '') + '">' + esc(ad) + '</span>';
  }

  function sifreHatasi(e) {
    if (!e || !e.sifreHatasi) return false;
    D.sifre = '';
    localStorage.removeItem('tv_env_koord_sifre');
    $('sifre').value = '';
    $('uygulama').classList.add('gizli');
    $('giris').classList.remove('gizli');
    mesaj($('msgGiris'), 'hata', e.message);
    $('sifre').focus();
    return true;
  }

  function sayaclariCiz() {
    var v = D.durum || {}, k = v.kategori || {};
    var kartlar = [
      ['', 'Karar bekleyen', Number(v.kararBekleyen || 0)],
      ['g', 'Gitsin', Number(k.Gidecek || 0)],
      ['s', 'Gitse de olur', Number(k['Gitse de olur'] || 0)],
      ['k', 'Gitmesin', Number(k.Gitmeyecek || 0)],
      ['m', 'Belirsiz', Number(k.Belirsiz || 0)]
    ];
    $('kararSayaclari').innerHTML = kartlar.map(function (x) {
      return '<div class="karar-sayaci ' + x[0] + '"><b>' + sayi(x[2]) + '</b><span>' + esc(x[1]) + '</span></div>';
    }).join('');
  }

  function durumYukle(zorla) {
    if (D.durum && !zorla) { sayaclariCiz(); return Promise.resolve(D.durum); }
    return api('durum', {}, 45000).then(function (r) { D.durum = r; sayaclariCiz(); return r; });
  }

  function kitapFotografi(ad, id, url) {
    var kucuk = foto(id, url, 500), buyuk = foto(id, url, 1800);
    if (!kucuk) return '<div class="kitap-foto yok">' + esc(ad) + ' fotoğrafı yok</div>';
    return '<button type="button" class="kitap-foto" data-tv-foto="' + esc(buyuk) + '" data-tv-foto-ad="' + esc(ad) + '"><img loading="lazy" src="' + esc(kucuk) + '" alt="' + esc(ad) + ' fotoğrafı"><span>' + esc(ad) + ' · büyüt</span></button>';
  }

  function kararKarti(k) {
    var alt = [k.yazar, k.yil, Number(k.nusha) > 1 ? k.nusha + ' nüsha' : ''].filter(Boolean).join(' · ');
    var not = [k.durum && k.durum !== 'Sağlam' ? k.durum : '', k.not].filter(Boolean).join(' · ');
    var gecmis = k.kararGecmisi ? '<details class="karar-gecmisi"><summary>Karar geçmişi</summary><pre>' + esc(k.kararGecmisi) + '</pre></details>' : '';
    var kararAlan = '';
    if (D.gorunum === 'bekleyen') {
      kararAlan = '<div class="karar-alani"><label>Kararınız nedir?</label><div class="karar-dugmeleri">' +
        '<button type="button" class="g" data-karar="gidecek">Gitsin</button>' +
        '<button type="button" class="s" data-karar="belki">Gitse de olur</button>' +
        '<button type="button" class="k" data-karar="gitmeyecek">Gitmesin</button>' +
        '<button type="button" class="m" data-karar="belirsiz">Belirsiz</button></div>' +
        '<input class="karar-not" data-karar-not maxlength="100" placeholder="Görüş notu (isteğe bağlı)"></div>' + gecmis;
    } else {
      kararAlan = '<div class="karar-meta"><strong>' + esc(kararEtiket[k.kategori] || k.kategori || 'Karar') + '</strong><span>Kararı veren: ' + esc(k.kararVeren || 'Eski kayıtta yazılmamış') + (k.kararTarihi ? ' · ' + esc(k.kararTarihi) : '') + '</span></div><button type="button" class="geri-al" data-geri-al>Karar bekleyenlere geri al</button>' + gecmis;
    }
    return '<article class="kitap-karti" data-no="' + Number(k.no) + '"><div class="kitap-gorseller">' + kitapFotografi('Kapak', k.kapakId, k.kapak) + kitapFotografi('Künye', k.fotoId, k.foto) + '</div><div class="kitap-bilgi"><p class="yer-kodu">' + esc(k.yer || ('#' + k.no)) + '</p><h2>' + esc(k.baslik || 'Kitap bilgisi henüz tamamlanmamış') + '</h2><p class="kitap-alt">' + esc(alt || 'Yazar ve yıl bilgisi yok') + '</p>' + (not ? '<p class="kitap-not">' + esc(not) + '</p>' : '') + kararAlan + '<p class="mesaj kart-mesaj" role="status"></p></div></article>';
  }

  function kararListeCiz() {
    $('kararListe').innerHTML = D.kararlar.map(kararKarti).join('');
    $('kararBos').classList.toggle('gizli', D.kararlar.length > 0);
    if (!D.kararlar.length) {
      $('kararBos').querySelector('h2').textContent = D.gorunum === 'bekleyen' ? 'Karar bekleyen kitap yok' : 'Verilmiş karar bulunamadı';
      $('kararBos').querySelector('p').textContent = $('kararAra').value ? 'Arama sözünü değiştirip yeniden deneyin.' : (D.gorunum === 'bekleyen' ? 'Yeni kitap kayıtları geldikçe burada görünecek.' : 'Henüz karar verilmiş kitap bulunmuyor.');
    }
    $('kararSayfalama').classList.toggle('gizli', D.kararToplam <= D.kararAdet && D.kararBas === 0);
    $('kararOnceki').disabled = D.kararBas === 0;
    $('kararSonraki').disabled = D.kararBas + D.kararlar.length >= D.kararToplam;
    $('kararAralik').textContent = (D.kararlar.length ? D.kararBas + 1 : 0) + '–' + (D.kararBas + D.kararlar.length) + ' / ' + sayi(D.kararToplam);
  }

  function kararYukle(hataAktar) {
    var token = ++D.islem;
    mesaj($('kararMsg'), '', 'Kitaplar yükleniyor…');
    $('kararListe').innerHTML = '';
    return api('katalog', {
      yalnizOnayli: true,
      yalnizKararli: D.gorunum === 'verilmis',
      yalnizKararsiz: D.gorunum === 'bekleyen',
      kategori: D.gorunum === 'verilmis' ? $('kararKategori').value : '',
      ara: $('kararAra').value.trim(), sirala: 'yer', bas: D.kararBas, adet: D.kararAdet
    }, 45000).then(function (r) {
      if (token !== D.islem) return;
      D.kararlar = r.kayitlar || [];
      D.kararToplam = Number(r.toplam || 0);
      mesaj($('kararMsg'), '', '');
      kararListeCiz();
    }).catch(function (e) {
      if (token !== D.islem) return;
      if (sifreHatasi(e)) { if (hataAktar) throw e; return; }
      mesaj($('kararMsg'), 'hata', hataMetni(e, 'Kitaplar'));
      if (hataAktar) throw e;
    });
  }

  function sayacDegistir(kategori, fark) {
    if (!D.durum) return;
    D.durum.kategori = D.durum.kategori || {};
    D.durum.kategori[kategori] = Math.max(0, Number(D.durum.kategori[kategori] || 0) + fark);
    D.durum.kararBekleyen = Math.max(0, Number(D.durum.kararBekleyen || 0) - fark);
    sayaclariCiz();
  }

  function gorusSayaciniDegistir(eski, yeni) {
    if (!D.durum || eski === yeni) return;
    var alan = function (durum) {
      return durum === 'ikinci_gorus_bekliyor' ? 'ikinciGorusBekleyen' :
        (durum === 'gorus_ayriligi' ? 'gorusAyriligi' : '');
    };
    var eskiAlan = alan(eski), yeniAlan = alan(yeni);
    if (eskiAlan) D.durum[eskiAlan] = Math.max(0, Number(D.durum[eskiAlan] || 0) - 1);
    if (yeniAlan) D.durum[yeniAlan] = Number(D.durum[yeniAlan] || 0) + 1;
    sayaclariCiz();
  }

  /* Google Sheets, yazma yanıtını verdikten hemen sonra yapılan ilk okumada
     birkaç saniyeliğine eski hücreyi döndürebiliyor. Yeni kararı kısa süre
     bellekte tutup katalog yanıtının üzerine uygularız; sunucu aynı kararı
     döndürdüğünde bu geçici kayıt kendiliğinden kalkar. */
  function kararKaydiniYereldeTut(kayit, kategori, veren, tarih, ek) {
    if (!kayit || !kayit.no) return;
    var no = Number(kayit.no);
    var guncel = Object.assign({}, kayit, ek || {}, {
      kategori: kategori || '',
      kararVeren: kategori ? (veren || D.ad) : '',
      kararTarihi: kategori ? (tarih || 'Az önce') : ''
    });
    D.kararGuncellemeleri[no] = { kategori:guncel.kategori, kayit:guncel, zaman:Date.now() };
    D.rafKitaplar = D.rafKitaplar.map(function (k) { return Number(k.no) === no ? Object.assign({}, k, guncel) : k; });
    D.rafKitapIstegi = null; D.rafKitapIstekAnahtari = ''; D.rafKitapYukluAnahtari = ''; D.rafKitapIstekNo++;
    D.raflarYuklendi = false;
    try {
      localStorage.setItem('tv_env_karar_degisti', JSON.stringify({ no:no, kategori:guncel.kategori, kayit:guncel, zaman:Date.now() }));
    } catch (e) {}
  }

  function kararKaydiniEsitle(kayit) {
    var no = Number(kayit && kayit.no), yerel = D.kararGuncellemeleri[no];
    if (!yerel) return kayit;
    if (Date.now() - yerel.zaman > 120000) {
      delete D.kararGuncellemeleri[no];
      return kayit;
    }
    var sunucuKategori = kararEtiket[kayit.kategori] ? kayit.kategori : '';
    var sunucuImza = sunucuKategori + '|' + String(kayit.kararDurumu || '') + '|' + JSON.stringify(kayit.kararGorusleri || []);
    var yerelImza = yerel.kategori + '|' + String(yerel.kayit.kararDurumu || '') + '|' + JSON.stringify(yerel.kayit.kararGorusleri || []);
    if (sunucuImza === yerelImza) {
      delete D.kararGuncellemeleri[no];
      return kayit;
    }
    return Object.assign({}, kayit, yerel.kayit);
  }

  function kararVer(kart, kod, dugme) {
    var no = Number(kart.dataset.no), not = kart.querySelector('[data-karar-not]').value.trim();
    var kayit = D.kararlar.find(function (k) { return Number(k.no) === no; });
    kart.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    mesaj(kart.querySelector('.kart-mesaj'), '', 'Karar kaydediliyor…');
    api('kararVer', { numaralar:[no], kategori:kod, kural:'Diğer: ' + (not || 'Yetkili kararı'), veren:D.ad }).then(function (r) {
      if (!(r.yazilan || []).length) throw new Error((r.atlanan && r.atlanan[0] && r.atlanan[0].neden) || 'Karar kaydedilemedi.');
      if (r.kesinlesti) {
        gorusSayaciniDegistir(kayit && kayit.kararDurumu, 'kesin');
        sayacDegistir(r.kategori, 1);
        kart.classList.add('satir-basarili');
        mesaj(kart.querySelector('.kart-mesaj'), 'iyi', kararKod[kod] + ' kararı kaydedildi.');
        bildir('Karar kesinleşti: ' + kararKod[kod]);
        kararKaydiniYereldeTut(kayit || { no:no }, r.kategori, r.gorusler.map(function (g) { return g.veren; }).join(' + '), r.kararTarihi || 'Az önce', { kararDurumu:'kesin', kararGorusleri:r.gorusler });
        D.kararlar = D.kararlar.filter(function (k) { return Number(k.no) !== no; });
        D.kararToplam = Math.max(0, D.kararToplam - 1);
        /* Sayaçlar ve liste yukarıda yerel olarak güncellendi. Her karardan sonra
           bütün yönetim özetini yeniden istemek küçük veritabanında bile gereksiz
           disk okumaları ve gecikme oluşturuyordu. */
        setTimeout(kararListeCiz, 250);
      } else {
        gorusSayaciniDegistir(kayit && kayit.kararDurumu, r.kararDurumu);
        var guncel = Object.assign({}, kayit || { no:no }, { kategori:'', kararVeren:'', kararTarihi:'', kararDurumu:r.kararDurumu, kararGorusleri:r.gorusler || [] });
        kararKaydiniYereldeTut(guncel, '', '', '', { kararDurumu:r.kararDurumu, kararGorusleri:r.gorusler || [] });
        D.kararlar = D.kararlar.map(function (k) { return Number(k.no) === no ? guncel : k; });
        kararListeCiz();
        var yeniKart = $('kararListe').querySelector('[data-no="' + no + '"]');
        var metin = 'Karar kaydedildi ancak güncel durum alınamadı. Bilgileri yenileyin.';
        if (yeniKart) mesaj(yeniKart.querySelector('.kart-mesaj'), 'iyi', metin);
        bildir('Görüş kaydedildi');
      }
    }).catch(function (e) {
      if (sifreHatasi(e)) return;
      kart.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
      mesaj(kart.querySelector('.kart-mesaj'), 'hata', e.message === 'AĞ' ? 'Sunucu yanıt vermedi. Kararın kaydolup kaydolmadığını “Bilgileri yenile” ile kontrol edin.' : e.message);
    });
  }

  function kararGeriAl(kart, dugme) {
    if (!window.confirm('Bu kitap yeniden karar bekleyenler listesine alınacak. Devam edilsin mi?')) return;
    var no = Number(kart.dataset.no), kayit = D.kararlar.find(function (k) { return Number(k.no) === no; });
    mesgul(dugme, true, 'Geri alınıyor…');
    api('kararGeriAl', { numaralar:[no], veren:D.ad }).then(function (r) {
      if (!(r.yazilan || []).length) throw new Error((r.atlanan && r.atlanan[0] && r.atlanan[0].neden) || 'Karar geri alınamadı.');
      if (D.durum && kayit) {
        D.durum.kategori[kayit.kategori] = Math.max(0, Number(D.durum.kategori[kayit.kategori] || 0) - 1);
        D.durum.kararBekleyen = Number(D.durum.kararBekleyen || 0) + 1;
        sayaclariCiz();
      }
      bildir('Kitap karar bekleyenlere geri alındı.');
      kararKaydiniYereldeTut(kayit || { no:no }, '', '', '');
      kart.classList.add('satir-basarili');
      setTimeout(function () { kararYukle(); }, 500);
    }).catch(function (e) {
      if (!sifreHatasi(e)) { mesgul(dugme, false); mesaj(kart.querySelector('.kart-mesaj'), 'hata', e.message === 'AĞ' ? 'Sunucu yanıt vermedi. Kitabı yenileyip karar durumunu kontrol edin.' : e.message); }
    });
  }

  function kararGorusGeriAl(kart, dugme) {
    var no = Number(kart.dataset.no), kayit = D.kararlar.find(function (k) { return Number(k.no) === no; });
    mesgul(dugme, true, 'Geri alınıyor…');
    kart.querySelectorAll('button').forEach(function (b) { if (b !== dugme) b.disabled = true; });
    api('kararGorusGeriAl', { numaralar:[no], veren:D.ad }).then(function (r) {
      if (!(r.yazilan || []).length) throw new Error((r.atlanan && r.atlanan[0] && r.atlanan[0].neden) || 'Görüş geri alınamadı.');
      gorusSayaciniDegistir(kayit && kayit.kararDurumu, r.kararDurumu);
      var guncel = Object.assign({}, kayit || { no:no }, {
        kategori:'', kararVeren:'', kararTarihi:'', kararDurumu:r.kararDurumu,
        kararGorusleri:r.gorusler || []
      });
      kararKaydiniYereldeTut(guncel, '', '', '', { kararDurumu:r.kararDurumu, kararGorusleri:r.gorusler || [] });
      D.kararlar = D.kararlar.map(function (k) { return Number(k.no) === no ? guncel : k; });
      kararListeCiz();
      var yeniKart = $('kararListe').querySelector('[data-no="' + no + '"]');
      if (yeniKart) mesaj(yeniKart.querySelector('.kart-mesaj'), 'iyi', 'Görüşünüz geri alındı. Kitap yeniden görüş bekliyor.');
      bildir('Görüşünüz geri alındı');
      durumYukle(true).catch(function () {});
    }).catch(function (e) {
      if (!sifreHatasi(e)) {
        mesgul(dugme, false);
        kart.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
        mesaj(kart.querySelector('.kart-mesaj'), 'hata', e.message === 'AĞ' ? 'Sunucu yanıt vermedi. Bilgileri yenileyerek görüş durumunu kontrol edin.' : e.message);
      }
    });
  }

  $('kararListe').addEventListener('click', function (e) {
    var kart = e.target.closest('.kitap-karti');
    if (!kart) return;
    var k = e.target.closest('[data-karar]');
    if (k) { kararVer(kart, k.dataset.karar, k); return; }
    var gg = e.target.closest('[data-gorus-geri-al]');
    if (gg) { kararGorusGeriAl(kart, gg); return; }
    var g = e.target.closest('[data-geri-al]');
    if (g) kararGeriAl(kart, g);
  });

  function kayitKarti(k) {
    var alt = [k.yazar || 'Yazar yazılmamış', k.yil, Number(k.nusha) > 1 ? k.nusha + ' nüsha' : ''].filter(Boolean).join(' · ');
    var istek = k.istenen ? '<p class="duzeltme-notu"><b>Ortak düzeltme listesindeki not:</b> ' + esc(k.istenen) + '</p>' : '';
    return '<article class="kayit-karti" data-kayit-no="' + Number(k.no) + '"><div class="kayit-fotolar">' +
      kitapFotografi('Kapak', k.kapakId, k.kapak) + kitapFotografi('Künye', k.fotoId, k.foto) +
      '</div><div class="kayit-karti-icerik"><p class="yer-kodu">' + esc(k.yer || ('#' + k.no)) + '</p><h2>' +
      esc(k.baslik || 'Kitap bilgisi tamamlanmamış') + '</h2><p>' + esc(alt) + '</p><p>Kaydeden: ' +
      esc(k.kaydeden || 'Yazılmamış') + '</p>' + istek + '<div class="kayit-islemleri"><button type="button" data-kayit-duzenle>Künyeyi düzenle</button><button type="button" data-kayit-gorev>' +
      (k.istenen ? 'Düzeltme notunu değiştir' : 'Ortak listeye gönder') + '</button><button type="button" class="tehlike" data-kayit-sil>Kaydı sil</button></div><p class="mesaj kayit-kart-mesaj" role="status"></p></div></article>';
  }

  function kayitListeCiz() {
    $('kayitListe').innerHTML = D.kayitlar.map(kayitKarti).join('');
    $('kayitBos').classList.toggle('gizli', D.kayitlar.length > 0);
    $('kayitSayfalama').classList.toggle('gizli', D.kayitToplam <= D.kayitAdet && D.kayitBas === 0);
    $('kayitOnceki').disabled = D.kayitBas === 0;
    $('kayitSonraki').disabled = D.kayitBas + D.kayitlar.length >= D.kayitToplam;
    $('kayitAralik').textContent = (D.kayitlar.length ? D.kayitBas + 1 : 0) + '–' + (D.kayitBas + D.kayitlar.length) + ' / ' + sayi(D.kayitToplam);
  }

  function kayitlariYukle() {
    mesaj($('kayitMsg'), '', 'Kitap kayıtları getiriliyor…');
    return api('katalog', { yalnizOnayli:false, ara:$('kayitAra').value.trim(), sirala:'yer', bas:D.kayitBas, adet:D.kayitAdet }, 15000)
      .then(function (r) { D.kayitlar=r.kayitlar||[];D.kayitToplam=Number(r.toplam||0);kayitListeCiz();mesaj($('kayitMsg'),'',''); })
      .catch(function(e){if(!sifreHatasi(e))mesaj($('kayitMsg'),'hata',hataMetni(e,'Kitap kayıtları'));});
  }

  function kayitBul(no) { return D.kayitlar.find(function(k){return Number(k.no)===Number(no);}); }
  function duzenlemeAc(k) {
    $('duzenleNo').value=k.no;$('duzenleYer').textContent=k.yer||('#'+k.no);$('duzenleBaslik').value=k.baslik||'';$('duzenleYazar').value=k.yazar||'';$('duzenleYil').value=k.yil||'';$('duzenleNusha').value=k.nusha||1;$('duzenleDurum').value=k.durum||'Sağlam';$('duzenleNot').value=k.not||'';mesaj($('duzenleMsg'),'','');$('kayitDuzenleDialog').showModal();
  }
  function gorevAc(k) {
    $('gorevNo').value=k.no;$('gorevYer').textContent=(k.yer||('#'+k.no))+' · '+(k.baslik||'Künye eksik');$('gorevSebep').value=k.istenen||'';mesaj($('gorevMsg'),'','');$('gorevDialog').showModal();
  }

  $('kayitListe').addEventListener('click',function(e){
    var kart=e.target.closest('[data-kayit-no]');if(!kart)return;var k=kayitBul(kart.dataset.kayitNo);if(!k)return;
    if(e.target.closest('[data-kayit-duzenle]')){duzenlemeAc(k);return;}
    if(e.target.closest('[data-kayit-gorev]')){gorevAc(k);return;}
    if(e.target.closest('[data-kayit-sil]')){
      if(!window.confirm((k.yer||('#'+k.no))+' kaydı silinecek. Bu işlem kayıt listelerinden kaldırır. Devam edilsin mi?'))return;
      var btn=e.target.closest('button');mesgul(btn,true,'Siliniyor…');api('sil',{no:k.no},15000).then(function(){bildir('Kitap kaydı silindi');D.kayitlar=D.kayitlar.filter(function(x){return Number(x.no)!==Number(k.no);});D.kayitToplam=Math.max(0,D.kayitToplam-1);kayitListeCiz();D.durum=null;D.raflarYuklendi=false;}).catch(function(h){mesgul(btn,false);mesaj(kart.querySelector('.kayit-kart-mesaj'),'hata',hataMetni(h,'Silme'));});
    }
  });
  $('kayitDuzenleForm').addEventListener('submit',function(e){e.preventDefault();var btn=$('btnKayitKaydet');mesgul(btn,true,'Kaydediliyor…');api('guncelle',{no:Number($('duzenleNo').value),kayit:{baslik:$('duzenleBaslik').value.trim(),yazar:$('duzenleYazar').value.trim(),yil:$('duzenleYil').value.trim(),nusha:$('duzenleNusha').value,durum:$('duzenleDurum').value,not:$('duzenleNot').value.trim()}},15000).then(function(){bildir('Kitap kaydı düzeltildi');$('kayitDuzenleDialog').close();return kayitlariYukle();}).catch(function(h){mesaj($('duzenleMsg'),'hata',hataMetni(h,'Düzeltme'));}).finally(function(){mesgul(btn,false);});});
  $('gorevForm').addEventListener('submit',function(e){e.preventDefault();var sebep=$('gorevSebep').value.trim();if(sebep.length<5){mesaj($('gorevMsg'),'hata','Düzeltme notunu biraz daha açık yazın.');return;}var btn=$('btnGorevGonder');mesgul(btn,true,'Gönderiliyor…');api('kitapIste',{no:Number($('gorevNo').value),sebep:sebep,isteyen:D.ad},15000).then(function(){bildir('Düzeltme görevi bütün gönüllülerin ortak listesine gönderildi');$('gorevDialog').close();return kayitlariYukle();}).catch(function(h){mesaj($('gorevMsg'),'hata',hataMetni(h,'Görev'));}).finally(function(){mesgul(btn,false);});});
  document.querySelectorAll('[data-dialog-kapat]').forEach(function(b){b.addEventListener('click',function(){$(b.dataset.dialogKapat).close();});});
  document.querySelectorAll('[data-gorev-not]').forEach(function(b){b.addEventListener('click',function(){$('gorevSebep').value=b.dataset.gorevNot;$('gorevSebep').focus();});});
  $('btnKayitAra').addEventListener('click',function(){D.kayitBas=0;kayitlariYukle();});
  $('kayitAra').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();D.kayitBas=0;kayitlariYukle();}});
  $('kayitOnceki').addEventListener('click',function(){D.kayitBas=Math.max(0,D.kayitBas-D.kayitAdet);kayitlariYukle();window.scrollTo({top:0});});
  $('kayitSonraki').addEventListener('click',function(){D.kayitBas+=D.kayitAdet;kayitlariYukle();window.scrollTo({top:0});});

  function sayimSayisi(r) {
    var s = r.sayim || {};
    if (s.durum === 'sayilamadi') return null;
    var n = s.toplam != null ? s.toplam : r.onSayim;
    return n == null || n === '' ? null : Number(n);
  }

  function sayimMetni(r) {
    var s = r.sayim || {};
    if (s.uyusmazlik) return 'İki sayım uyuşmuyor';
    if (s.eksik) return 'Sayım eksik';
    if (s.durum === 'onaylandi') return 'Sayım onaylandı';
    if (s.durum === 'sayilamadi') return 'Raf sayılamadı';
    return sayimSayisi(r) == null ? 'Henüz sayılmadı' : 'Sayım onay bekliyor';
  }

  function mekanRaflari(kod) {
    var cfg = D.cfg || {}, hepsi = cfg.rafHarfleri || [];
    var mekan = (cfg.mekanlar || []).find(function (m) { return m.kod === kod; });
    if (!mekan) return hepsi;
    var bas = Math.max(0, Number(mekan.rafBaslangic) || 0);
    var adet = Number(mekan.rafSayisi) || 0;
    return adet ? hepsi.slice(bas, bas + adet) : hepsi.slice(bas);
  }

  /* Raf haritası yavaşlasa bile sayfa boş kalmaz. Hızlı "durum" yanıtındaki
     kayıt sayılarını sabit raf planının üzerine koyarız; ayrıntılı sayım
     geldiğinde aynı listeyi gerçek sayım bilgileriyle değiştiririz. */
  function raflariDurumdanKur() {
    var cfg = D.cfg || {}, siraAdedi = Math.max(1, Number(cfg.siraSayisi) || 6), hizli = {};
    ((D.durum || {}).siralar || []).forEach(function (r) { hizli[r.sira] = r; });
    var onceki = {};
    D.raflar.forEach(function (r) { onceki[r.sira] = r; });
    var liste = [];
    (cfg.mekanlar || []).forEach(function (mekan) {
      mekanRaflari(mekan.kod).forEach(function (raf) {
        for (var sira = 1; sira <= siraAdedi; sira++) {
          var kod = mekan.kod + '-' + raf + String(sira).padStart(2, '0');
          var h = hizli[kod] || {}, o = onceki[kod] || {};
          liste.push(Object.assign({
            sira:kod, durum:Number(h.sayi || 0) ? 'devam' : 'bos',
            kayitli:Number(h.sayi || 0), kayitSayisi:Number(h.sayi || 0), kararVerilen:0,
            onSayim:null, sayim:null, hizliOzet:true
          }, D.rafHaritasiTam ? o : {}));
        }
      });
    });
    D.raflar = liste;
  }

  function rafSayaclariCiz() {
    var sayilan = 0, kayitli = 0, sayimli = 0, onayli = 0;
    D.raflar.forEach(function (r) {
      var n = sayimSayisi(r);
      if (n != null) { sayilan += n; sayimli++; }
      kayitli += Number(r.kayitli || 0);
      if ((r.sayim || {}).durum === 'onaylandi') onayli++;
    });
    $('rafSayaclari').innerHTML = [
      [D.rafOzetiVar ? sayilan : null, 'Raflarda sayılan kitap'], [kayitli, 'Kaydedilen kitap / nüsha'],
      [D.rafOzetiVar ? sayimli : null, 'Sayımı yapılan raf sırası'],
      [D.rafOzetiVar ? onayli : null, 'Sayımı onaylanan raf sırası']
    ].map(function (x) { return '<div class="ozet-karti"><b>' + (x[0] == null ? '—' : sayi(x[0])) +
      '</b><span>' + esc(x[1]) + '</span></div>'; }).join('');
  }

  function rafOzetiniBirlestir(siralar) {
    var gelen = {};
    (siralar || []).forEach(function (r) { gelen[r.sira] = r; });
    D.raflar = D.raflar.map(function (r) {
      var o = gelen[r.sira];
      if (!o) return r;
      return Object.assign({}, r, {
        durum:o.durum || r.durum,
        kayitli:o.kayitli == null ? r.kayitli : Number(o.kayitli),
        onSayim:o.onSayim == null ? null : Number(o.onSayim),
        sayim:o.sayim || null,
        tutulu:!!o.tutulu, tutan:o.tutan || '', bitiren:o.bitiren || '',
        hizliOzet:false
      });
    });
    D.rafOzetiVar = true; D.rafOzetiHata = false;
    rafSayaclariCiz(); rafSecicileriCiz(true);
    if (D.bolum === 'durum') genelDurumCiz();
  }

  function ayrintiliRafHaritasiniYukle(zorla) {
    /* Kullanıcı yenilemeye ilk arka plan isteği sürerken basarsa süren isteği paylaş. */
    if (D.rafHaritaIstegi) return D.rafHaritaIstegi;
    D.rafOzetiHata = false;
    /* Bütün 396 sıra için çizimde gereken kısa özet alınır. Ayrıntılı
       geçmişler raf açıldığında ayrıca yüklenir; ilk yanıt küçük kalır. */
    D.rafHaritaIstegi = api('siraHaritasiKisa', {}, 30000).then(function (r) {
      D.raflar = r.siralar || [];
      D.raflarYuklendi = true; D.rafHaritasiTam = true; D.rafOzetiVar = true; D.rafOzetiHata = false;
      rafSayaclariCiz(); rafSecicileriCiz(true);
      mesaj($('rafMsg'), 'iyi', 'Kitap kayıtları ve raf sayımı eşleştirildi.');
      if (D.bolum === 'durum') genelDurumCiz();
      return D.raflar;
    }).catch(function (e) {
      if (sifreHatasi(e)) throw e;
      D.rafOzetiHata = true;
      mesaj($('rafMsg'), '', hataMetni(e, 'Raf sayımları'));
      if (D.bolum === 'durum') genelDurumCiz();
      return D.raflar;
    }).finally(function () { D.rafHaritaIstegi = null; });
    return D.rafHaritaIstegi;
  }

  function raflariYukle(zorla) {
    if (D.raflarYuklendi && !zorla) {
      rafSayaclariCiz(); rafSecicileriCiz(true);
      if (!D.rafHaritasiTam) ayrintiliRafHaritasiniYukle(false);
      return Promise.resolve(D.raflar);
    }
    mesaj($('rafMsg'), '', 'Kitap kayıtları hazırlanıyor…');
    return durumYukle(zorla).then(function () {
      raflariDurumdanKur(); D.raflarYuklendi = true;
      rafSayaclariCiz(); rafSecicileriCiz();
      mesaj($('rafMsg'), '', 'Kitap kayıtları hazır. Raf sayımı ayrıntıları yükleniyor…');
      ayrintiliRafHaritasiniYukle(zorla);
      return D.raflar;
    }).catch(function (e) {
      if (!sifreHatasi(e)) mesaj($('rafMsg'), 'hata', hataMetni(e, 'Raf bilgileri'));
      throw e;
    });
  }

  function rafSecicileriCiz(yalnizGorunum) {
    var eskiKat = $('rafKat').value, eskiKitaplik = $('rafKitaplik').value;
    var katlar = Array.from(new Set(D.raflar.map(function (r) { return parcala(r.sira).kat; }).filter(Boolean)));
    $('rafKat').innerHTML = katlar.map(function (k) { return '<option value="' + esc(k) + '">' + esc(katAdi(k)) + '</option>'; }).join('');
    if (katlar.indexOf(eskiKat) >= 0) $('rafKat').value = eskiKat;
    rafKitapliklariCiz(eskiKitaplik, yalnizGorunum);
  }

  function rafKitapliklariCiz(eski, yalnizGorunum) {
    var kat = $('rafKat').value;
    var liste = Array.from(new Set(D.raflar.filter(function (r) { return parcala(r.sira).kat === kat; }).map(function (r) { return parcala(r.sira).kitaplik; })));
    $('rafKitaplik').innerHTML = liste.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + ' kitaplığı</option>'; }).join('');
    if (liste.indexOf(eski) >= 0) $('rafKitaplik').value = eski;
    rafSiralarCiz(yalnizGorunum);
  }

  function rafSiralarCiz(yalnizGorunum) {
    var kat = $('rafKat').value, kitaplik = $('rafKitaplik').value;
    var liste = D.raflar.filter(function (r) { var p = parcala(r.sira); return p.kat === kat && p.kitaplik === kitaplik; });
    var oncekiRaf = D.seciliRaf;
    if (!liste.some(function (r) { return r.sira === D.seciliRaf; })) { D.seciliRaf = liste.length ? liste[0].sira : ''; D.rafBas = 0; }
    $('rafSiralar').innerHTML = liste.map(function (r) {
      var n = sayimSayisi(r), fark = n == null ? 0 : n - Number(r.kayitli || 0);
      return '<button type="button" class="raf-sira ' + (r.sira === D.seciliRaf ? 'sec ' : '') + (fark || (r.sayim || {}).uyusmazlik ? 'uyari' : '') + '" data-raf="' + esc(r.sira) + '"><b>' + parcala(r.sira).sira + '. sıra</b><small>' + (n == null ? 'Sayılmadı' : sayi(n) + ' sayıldı') + '</small><small>' + sayi(r.kayitli) + ' kaydedildi</small></button>';
    }).join('');
    if (D.seciliRaf) {
      var anahtar = D.seciliRaf + '|' + D.rafBas;
      var ayniRafHazir = oncekiRaf === D.seciliRaf &&
        (D.rafKitapYukluAnahtari === anahtar || D.rafKitapIstekAnahtari === anahtar);
      if (yalnizGorunum && ayniRafHazir) {
        var secili = D.raflar.find(function (r) { return r.sira === D.seciliRaf; });
        if (secili) rafOzetCiz(secili, true);
      } else {
        rafAc();
      }
    }
  }

  function rafOzetCiz(r, fotograflariKoru) {
    var n = sayimSayisi(r), kayitli = Number(r.kayitli || 0), fark = n == null ? null : n - kayitli;
    $('rafKod').textContent = r.sira;
    $('rafBaslik').textContent = yerAdi(r.sira);
    $('btnRafFoto').classList.remove('gizli');
    if (!fotograflariKoru) {
      $('rafFotolar').classList.add('gizli'); $('rafFotolar').innerHTML = '';
    }
    $('rafOzet').innerHTML = '<div class="raf-ozet-grid"><div><b>' + (n == null ? '—' : sayi(n)) + '</b><span>Sayım sonucu</span></div><div><b>' + sayi(kayitli) + '</b><span>Kaydedilen kitap / nüsha</span></div><div><b>' + sayi(r.kararVerilen) + ' / ' + sayi(r.kayitSayisi) + '</b><span>Kararı verilen kayıt</span></div></div><p class="uyusma ' + (fark === 0 ? '' : 'uyari') + '">' + esc(sayimMetni(r)) + ' · ' + (fark == null ? 'Sayım yapılınca kayıtlarla karşılaştırılacak.' : fark === 0 ? 'Sayım ile kayıtlar eşleşiyor.' : fark > 0 ? sayi(fark) + ' kitabın kaydı eksik görünüyor.' : 'Kayıt sayısı sayımdan ' + sayi(-fark) + ' fazla görünüyor.') + '</p>';
  }

  function rafAc() {
    var r = D.raflar.find(function (x) { return x.sira === D.seciliRaf; });
    if (!r) return;
    rafOzetCiz(r);
    rafKitapYukle();
  }

  function rafKitapYukle() {
    var kod = D.seciliRaf, bas = D.rafBas;
    var anahtar = kod + '|' + bas;
    if (D.rafKitapIstegi && D.rafKitapIstekAnahtari === anahtar) return D.rafKitapIstegi;
    var oncekiGosteriliyor = D.rafKitapYukluAnahtari === anahtar && !!$('rafKitaplar').children.length;
    var istekNo = ++D.rafKitapIstekNo;
    mesaj($('rafKitapMsg'), '', oncekiGosteriliyor
      ? 'Bu raftaki kitaplar güncelleniyor…'
      : 'Bu raftaki kitaplar yükleniyor…');
    if (!oncekiGosteriliyor) $('rafKitaplar').innerHTML = '';
    D.rafKitapIstekAnahtari = anahtar;
    D.rafKitapIstegi = api('katalog', { sira:kod, yalnizOnayli:false, sirala:'yer', adet:30, bas:bas }, 45000).then(function (r) {
      if (istekNo !== D.rafKitapIstekNo || kod !== D.seciliRaf || bas !== D.rafBas) return;
      D.rafKitaplar = (r.kayitlar || []).map(kararKaydiniEsitle); D.rafKitapToplam = Number(r.toplam || 0);
      D.rafKitapYukluAnahtari = anahtar;
      var raf = D.raflar.find(function (x) { return x.sira === kod; });
      if (raf && D.rafBas === 0 && D.rafKitapToplam <= D.rafKitaplar.length) {
        raf.kayitSayisi = D.rafKitapToplam;
        raf.kayitli = D.rafKitaplar.reduce(function (t, k) { return t + Math.max(1, Number(k.nusha) || 1); }, 0);
        raf.kararVerilen = D.rafKitaplar.filter(function (k) { return !!kararEtiket[k.kategori]; }).length;
        rafOzetCiz(raf, true); rafSayaclariCiz();
      }
      mesaj($('rafKitapMsg'), '', '');
      $('rafKitaplar').innerHTML = D.rafKitaplar.length ? D.rafKitaplar.map(function (k) { return '<button type="button" class="raf-kitap" data-kitap="' + Number(k.no) + '"><span><strong>' + esc(k.baslik || 'Kitap bilgisi henüz tamamlanmamış') + '</strong><small>' + esc([k.yazar, k.yil, k.yer].filter(Boolean).join(' · ')) + '</small></span>' + kararRozeti(k.kategori, k.onay ? 'Karar bekliyor' : 'Bilgi kontrolü bekliyor', k.kararDurumu) + '</button>'; }).join('') : '<div class="bos-durum"><h2>Bu rafta kitap kaydı yok</h2><p>Gönüllüler kitap kaydettikçe burada görünecek.</p></div>';
      $('rafSayfalama').classList.toggle('gizli', D.rafKitapToplam <= 30 && D.rafBas === 0);
      $('rafOnceki').disabled = D.rafBas === 0; $('rafSonraki').disabled = D.rafBas + D.rafKitaplar.length >= D.rafKitapToplam;
      $('rafAralik').textContent = (D.rafKitaplar.length ? D.rafBas + 1 : 0) + '–' + (D.rafBas + D.rafKitaplar.length) + ' / ' + sayi(D.rafKitapToplam);
    }).catch(function (e) {
      if (istekNo !== D.rafKitapIstekNo || kod !== D.seciliRaf || bas !== D.rafBas) return;
      if (!sifreHatasi(e)) mesaj($('rafKitapMsg'), oncekiGosteriliyor ? '' : 'hata',
        oncekiGosteriliyor
          ? 'Son alınan kitap listesi gösteriliyor. Güncelleme gecikti; “Bilgileri yenile” ile tekrar deneyebilirsiniz.'
          : hataMetni(e, 'Bu raftaki kitaplar'));
    }).finally(function () {
      if (istekNo !== D.rafKitapIstekNo) return;
      D.rafKitapIstegi = null; D.rafKitapIstekAnahtari = '';
    });
    return D.rafKitapIstegi;
  }

  function kitapDetayAc(no) {
    var k = D.rafKitaplar.find(function (x) { return Number(x.no) === no; });
    if (!k) return;
    var kapak = foto(k.kapakId, k.kapak, 1800), kunye = foto(k.fotoId, k.foto, 1800);
    $('detayIcerik').innerHTML = '<div class="detay-govde"><p class="yer-kodu">' + esc(k.yer || ('#' + k.no)) + '</p><h2>' + esc(k.baslik || 'Kitap bilgisi henüz tamamlanmamış') + '</h2><p class="kitap-alt">' + esc([k.yazar, k.yil, Number(k.nusha) > 1 ? k.nusha + ' nüsha' : ''].filter(Boolean).join(' · ') || 'Yazar ve yıl bilgisi yok') + '</p>' + kararRozeti(k.kategori, k.onay ? 'Karar bekliyor' : 'Bilgi kontrolü bekliyor', k.kararDurumu) + (kararEtiket[k.kategori] ? '<div class="karar-meta"><strong>' + esc(kararEtiket[k.kategori]) + '</strong><span>Kararı veren: ' + esc(k.kararVeren || 'Eski kayıtta yazılmamış') + (k.kararTarihi ? ' · ' + esc(k.kararTarihi) : '') + '</span></div>' : '') + (k.not ? '<p class="kitap-not">' + esc(k.not) + '</p>' : '') + '<div class="detay-fotolar">' + (kapak ? '<button type="button" data-tv-foto="' + esc(kapak) + '" data-tv-foto-ad="Kapak"><img src="' + esc(foto(k.kapakId, k.kapak, 700)) + '" alt="Kapak fotoğrafı"></button>' : '<div class="kitap-foto yok">Kapak fotoğrafı yok</div>') + (kunye ? '<button type="button" data-tv-foto="' + esc(kunye) + '" data-tv-foto-ad="Künye"><img src="' + esc(foto(k.fotoId, k.foto, 700)) + '" alt="Künye fotoğrafı"></button>' : '<div class="kitap-foto yok">Künye fotoğrafı yok</div>') + '</div>' + (k.kararGecmisi ? '<details class="karar-gecmisi"><summary>Karar geçmişi</summary><pre>' + esc(k.kararGecmisi) + '</pre></details>' : '') + '</div>';
    $('kitapDetay').showModal();
  }

  function rafFotolariAc() {
    if (!$('rafFotolar').classList.contains('gizli')) { $('rafFotolar').classList.add('gizli'); return; }
    var p = parcala(D.seciliRaf), r = D.raflar.find(function (x) { return x.sira === D.seciliRaf; });
    mesgul($('btnRafFoto'), true, 'Yükleniyor…');
    api('rafFotograflari', { mekan:p.kat, raf:p.kitaplik, sira:p.sira }, 35000).then(function (v) {
      var liste = (v.fotograflar || []).map(function (f) { return { kucuk:foto(f.id || f.fotoId, f.url || f.foto, 1400), buyuk:foto(f.id || f.fotoId, f.url || f.foto, 2200), ad:['Raf fotoğrafı', f.kim, f.tarih].filter(Boolean).join(' · ') }; }).filter(function (f) { return f.kucuk; });
      if (!liste.length && r && r.sayimFoto) liste.push({ kucuk:foto('', r.sayimFoto, 1400), buyuk:foto('', r.sayimFoto, 2200), ad:'Raf fotoğrafı' });
      $('rafFotolar').innerHTML = liste.length ? liste.map(function (f) { return '<button type="button" data-tv-foto="' + esc(f.buyuk) + '" data-tv-foto-ad="' + esc(f.ad) + '"><img loading="lazy" src="' + esc(f.kucuk) + '" alt="' + esc(f.ad) + '"></button>'; }).join('') : '<p>Bu rafın fotoğrafı henüz eklenmemiş.</p>';
      $('rafFotolar').classList.remove('gizli');
    }).catch(function (e) { if (!sifreHatasi(e)) mesaj($('rafKitapMsg'), 'hata', hataMetni(e, 'Raf fotoğrafları')); }).finally(function () { mesgul($('btnRafFoto'), false); });
  }

  function genelDurumCiz() {
    var v = D.durum || {}, k = v.kategori || {};
    var sayilan = 0, kayitli = 0, sayimli = 0;
    D.raflar.forEach(function (r) { var n = sayimSayisi(r); if (n != null) { sayilan += n; sayimli++; } kayitli += Number(r.kayitli || 0); });
    $('genelSayaclar').innerHTML = [
      [D.rafOzetiVar ? sayilan : null, 'Raflarda sayılan kitap', 'vurgu'], [kayitli, 'Kaydedilen kitap / nüsha', ''],
      [v.toplam || 0, 'Ayrı kitap kaydı', ''], [v.kararBekleyen || 0, 'Karar bekleyen kitap', '']
    ].map(function (x) { return '<div class="yonetim-sayi ' + x[2] + '"><b>' +
      (x[0] == null ? '—' : sayi(x[0])) + '</b><span>' + esc(x[1]) + '</span></div>'; }).join('');
    var kararli = Number(k.Gidecek || 0) + Number(k['Gitse de olur'] || 0) + Number(k.Gitmeyecek || 0) + Number(k.Belirsiz || 0);
    var kararBekleyen = Number(v.kararBekleyen || 0), toplam = Number(v.toplam || 0);
    var bilgiAsamasi = Math.max(0, toplam - kararBekleyen - kararli);
    var bilgiDetay = [];
    var kararDetay = [];
    if (Number(v.onayBekleyen || 0)) bilgiDetay.push(sayi(v.onayBekleyen) + ' bilgi onayı bekliyor');
    if (Number(v.kunyeEksik || 0)) bilgiDetay.push(sayi(v.kunyeEksik) + ' künye/fotoğraf eksiği var');
    if (Number(v.tamam || 0)) bilgiDetay.push(sayi(v.tamam) + ' elle girilmiş kayıt kontrol ediliyor');
    $('kayitAsamalari').innerHTML = '<p class="kayit-denklemi"><b>' + sayi(toplam) + ' toplam kayıt</b> = ' +
      sayi(kararBekleyen) + ' karar bekleyen + ' + sayi(kararli) + ' karar verilen + ' +
      sayi(bilgiAsamasi) + ' kitap bilgisi/kontrol aşamasında</p><div class="kayit-asama-grid">' +
      '<div class="kayit-asama"><b>' + sayi(kararBekleyen) + '</b><span>Karar bekliyor</span><small>' + esc(kararDetay.join(' · ') || 'Henüz görüş verilmemiş kitaplar') + '</small></div>' +
      '<div class="kayit-asama"><b>' + sayi(kararli) + '</b><span>Kararı verildi</span><small>Bir yetkilinin seçimiyle doğrudan kaydedilen kararlar</small></div>' +
      '<div class="kayit-asama"><b>' + sayi(bilgiAsamasi) + '</b><span>Bilgi/kontrol aşamasında</span><small>' + esc(bilgiDetay.join(' · ') || 'Kitap bilgileri karar öncesinde hazırlanıyor') + '</small></div></div>';
    var dagilim = [['g','Gitsin',k.Gidecek || 0],['s','Gitse de olur',k['Gitse de olur'] || 0],['k','Gitmesin',k.Gitmeyecek || 0],['m','Belirsiz',k.Belirsiz || 0]];
    var en = Math.max(1, Math.max.apply(null, dagilim.map(function (x) { return Number(x[2]); })));
    $('kararDagilim').innerHTML = dagilim.map(function (x) {
      return '<div class="dagilim-satir ' + x[0] + '"><span>' + esc(x[1]) +
        '</span><div class="dagilim-cubuk"><span style="width:' +
        Math.round(Number(x[2]) * 100 / en) + '%"></span></div><b>' +
        sayi(x[2]) + '</b></div>';
    }).join('');
    var uyarilar = D.raflar.filter(function (r) { var n = sayimSayisi(r); return (r.sayim || {}).uyusmazlik || (r.sayim || {}).eksik || (n != null && n !== Number(r.kayitli || 0)); });
    if (!D.rafOzetiVar) {
      $('rafUyarilari').innerHTML = '<div class="bos-durum"><div>' + (D.rafOzetiHata ? '!' : '…') +
        '</div><h2>' + (D.rafOzetiHata ? 'Raf sayımları alınamadı' : 'Raf sayımları yükleniyor') +
        '</h2><p>' + (D.rafOzetiHata ? 'Bilgileri yenile düğmesiyle yeniden deneyin.' :
          'Toplamlar ve uyuşmazlıklar birazdan burada görünecek.') + '</p></div>';
    } else {
      $('rafUyarilari').innerHTML = uyarilar.length ? '<div class="uyari-listesi">' + uyarilar.slice(0,8).map(function (r) { var n = sayimSayisi(r), fark = n == null ? 0 : n - Number(r.kayitli || 0); return '<div class="uyari-satir"><button type="button" data-uyari-raf="' + esc(r.sira) + '">' + esc(yerAdi(r.sira)) + '</button><span>' + ((r.sayim || {}).uyusmazlik ? 'Sayımlar tutmuyor' : (r.sayim || {}).eksik ? 'Sayım eksik' : 'Fark ' + (fark > 0 ? '+' : '') + sayi(fark)) + '</span></div>'; }).join('') + '</div>' + (uyarilar.length > 8 ? '<p class="kitap-alt">Ayrıca ' + sayi(uyarilar.length - 8) + ' raf daha kontrol bekliyor.</p>' : '') : '<div class="bos-durum"><div>✓</div><h2>Belirgin uyuşmazlık yok</h2><p>Sayımı yapılmış rafların kayıtları eşleşiyor.</p></div>';
    }
  }

  function genelDurumYukle(zorla) {
    mesaj($('durumMsg'), '', 'Güncel sayılar hazırlanıyor…');
    return durumYukle(zorla).then(function () {
      if (!D.raflarYuklendi || zorla) { raflariDurumdanKur(); D.raflarYuklendi = true; }
      genelDurumCiz(); mesaj($('durumMsg'), '', '');
      ayrintiliRafHaritasiniYukle(zorla);
    }).catch(function (e) { if (!e.sifreHatasi) mesaj($('durumMsg'), 'hata', hataMetni(e, 'Genel durum')); });
  }

  function bolumAc(ad, yukle) {
    D.bolum = ad;
    document.querySelectorAll('.bolum').forEach(function (b) { b.classList.toggle('gizli', b.id !== 'bolum-' + ad); });
    document.querySelectorAll('[data-bolum]').forEach(function (b) { b.classList.toggle('sec', b.dataset.bolum === ad); if (b.dataset.bolum === ad) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    if (history.replaceState) history.replaceState(null, '', '#' + ad);
    if (yukle === false) { window.scrollTo({ top:0, behavior:'auto' }); return; }
    if (ad === 'raflar') raflariYukle(false);
    if (ad === 'kayitlar' && !D.kayitlar.length) kayitlariYukle();
    if (ad === 'durum') genelDurumYukle(false);
    if (ad === 'secim' && !D.kararlar.length) kararYukle();
    window.scrollTo({ top:0, behavior:'auto' });
  }

  function girisYap(ad, sifre, otomatik) {
    D.ad = ad.trim(); D.sifre = sifre.trim();
    if (D.ad.length < 2 || !D.sifre) return;
    var btn = $('btnGiris'); mesgul(btn, true, otomatik ? 'Oturum açılıyor…' : 'Giriş yapılıyor…'); mesaj($('msgGiris'), '', '');
    localStorage.setItem('tv_env_ad', D.ad); localStorage.setItem('tv_env_koord_sifre', D.sifre);
    $('kimAd').textContent = D.ad;
    $('giris').classList.add('gizli'); $('uygulama').classList.remove('gizli');
    D.durum = null; D.raflarYuklendi = false; D.rafHaritasiTam = false;
    D.rafOzetiVar = false; D.rafOzetiHata = false; D.kararlar = []; D.kayitlar = []; D.kayitToplam = 0; D.kayitBas = 0; D.kararGuncellemeleri = {};
    D.rafKitapIstegi = null; D.rafKitapIstekAnahtari = ''; D.rafKitapYukluAnahtari = ''; D.rafKitapIstekNo++;
    bolumAc('secim', false);
    ilkVerileriYukle(false).finally(function () { mesgul(btn, false); });
  }

  function baslangicVerileriniYukle(zorla) {
    function uygula(r) {
      var k = r.kararlar || {};
      D.kararlar = k.kayitlar || [];
      D.kararToplam = Number(k.toplam || 0);
      D.durum = r.durum || null;
      if (r.rafOzeti && Array.isArray(r.rafOzeti.siralar)) {
        D.raflar = r.rafOzeti.siralar;
        D.raflarYuklendi = true; D.rafHaritasiTam = true;
        D.rafOzetiVar = true; D.rafOzetiHata = false;
      }
      mesaj($('kararMsg'), '', '');
      kararListeCiz(); sayaclariCiz();
    }
    function sakla(r) { try { localStorage.setItem(BASLANGIC_ONBELLEGI, JSON.stringify({ zaman:Date.now(), veri:r })); } catch (h) {} }
    function sunucudan() {
      return api('koordinatorBaslangic', { adet:D.kararAdet, zorla:!!zorla }, 30000).then(function (r) { uygula(r); sakla(r); });
    }
    mesaj($('kararMsg'), '', 'Kitaplar ve güncel sayılar birlikte yükleniyor…');
    if (!zorla) {
      try {
        var sakli = JSON.parse(localStorage.getItem(BASLANGIC_ONBELLEGI) || 'null');
        if (sakli && sakli.veri && Date.now() - Number(sakli.zaman || 0) < 1800000) {
          uygula(sakli.veri);
          /* Kullanıcı beklemeden çalışabilir; taze yanıt gelince aynı ekran
             sessizce güncellenir. Çakışan kararları sunucu zaten reddeder. */
          sunucudan().catch(function () { mesaj($('kararMsg'), '', 'Son alınan bilgiler gösteriliyor; güncelleme gecikti.'); });
          return Promise.resolve();
        }
      } catch (h2) {}
    }
    return sunucudan().catch(function (e) {
        if (sifreHatasi(e)) throw e;
        if (!e || !/Bilinmeyen istek/i.test(e.message || '')) throw e;
        return kararYukle(true).then(function () { return durumYukle(true); });
      });
  }

  function ilkVerileriYukle(zorla) {
    var context = sistemYukleniyor();
    return baslangicVerileriniYukle(zorla)
      .then(function () { return sistemHazir(context); })
      .catch(function (e) { sistemHatasiGoster(context, e); });
  }

  $('girisForm').addEventListener('submit', function (e) { e.preventDefault(); girisYap($('ad').value, $('sifre').value, false); });
  $('btnCikis').addEventListener('click', function () { D.sifre = ''; D.kararlar = []; D.raflar = []; D.durum = null; D.kararGuncellemeleri = {}; localStorage.removeItem('tv_env_koord_sifre'); $('sifre').value = ''; $('uygulama').classList.add('gizli'); $('giris').classList.remove('gizli'); $('sifre').focus(); });
  document.querySelectorAll('[data-bolum]').forEach(function (b) { b.addEventListener('click', function () { bolumAc(b.dataset.bolum); }); });
  document.querySelectorAll('[data-bolum-link]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); bolumAc(b.dataset.bolumLink); }); });
  $('btnIletisimUst').addEventListener('click', function () { bolumAc('iletisim'); });
  $('btnSistemTekrar').addEventListener('click', function () { ilkVerileriYukle(true); });
  $('sistemDurum').addEventListener('click', function () {
    if ($('sistemDurum').classList.contains('hata')) ilkVerileriYukle(true);
  });

  /* Aynı site başka bir sekmede açıksa verilen/geri alınan kararı oraya da
     bildir. Sekme açıldığında bir sonraki katalog okuması bu kararı esas alır. */
  window.addEventListener('storage', function (e) {
    if (e.key !== 'tv_env_karar_degisti' || !e.newValue) return;
    if (!D.sifre || $('uygulama').classList.contains('gizli')) return;
    try {
      var g = JSON.parse(e.newValue);
      if (!g.no || Date.now() - Number(g.zaman || 0) > 120000) return;
      var kayit = g.kayit || { no:Number(g.no) };
      D.kararGuncellemeleri[Number(g.no)] = { kategori:g.kategori || '', kayit:kayit, zaman:Number(g.zaman) };
      D.rafKitapIstegi = null; D.rafKitapIstekAnahtari = ''; D.rafKitapYukluAnahtari = ''; D.rafKitapIstekNo++;
      D.raflarYuklendi = false; D.durum = null;
      if (D.bolum === 'raflar') raflariYukle(true);
      if (D.bolum === 'secim') kararYukle();
      if (D.bolum === 'durum') genelDurumYukle(true);
    } catch (h) {}
  });

  $('kararGorunum').addEventListener('click', function (e) { var b = e.target.closest('[data-gorunum]'); if (!b || b.dataset.gorunum === D.gorunum) return; D.gorunum = b.dataset.gorunum; D.kararBas = 0; $('kararGorunum').querySelectorAll('button').forEach(function (x) { x.classList.toggle('sec', x === b); }); $('kararKategori').classList.toggle('gizli', D.gorunum !== 'verilmis'); kararYukle(); });
  $('btnKararAra').addEventListener('click', function () { D.kararBas = 0; kararYukle(); });
  $('kararAra').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); D.kararBas = 0; kararYukle(); } });
  $('kararKategori').addEventListener('change', function () { D.kararBas = 0; kararYukle(); });
  $('kararOnceki').addEventListener('click', function () { D.kararBas = Math.max(0, D.kararBas - D.kararAdet); kararYukle(); window.scrollTo(0,0); });
  $('kararSonraki').addEventListener('click', function () { D.kararBas += D.kararAdet; kararYukle(); window.scrollTo(0,0); });
  document.querySelectorAll('[data-yenile]').forEach(function (b) { b.addEventListener('click', function () { var ad = b.dataset.yenile; mesgul(b, true, 'Yenileniyor…'); var p = ad === 'secim' ? Promise.all([durumYukle(true), kararYukle()]) : ad === 'kayitlar' ? kayitlariYukle() : ad === 'raflar' ? raflariYukle(true) : genelDurumYukle(true); Promise.resolve(p).finally(function () { mesgul(b, false); }); }); });

  $('rafKat').addEventListener('change', function () { D.rafBas = 0; rafKitapliklariCiz(''); });
  $('rafKitaplik').addEventListener('change', function () { D.rafBas = 0; rafSiralarCiz(); });
  $('rafSiralar').addEventListener('click', function (e) { var b = e.target.closest('[data-raf]'); if (!b || b.dataset.raf === D.seciliRaf) return; D.seciliRaf = b.dataset.raf; D.rafBas = 0; rafSiralarCiz(); });
  $('rafKitaplar').addEventListener('click', function (e) { var b = e.target.closest('[data-kitap]'); if (b) kitapDetayAc(Number(b.dataset.kitap)); });
  $('btnRafFoto').addEventListener('click', rafFotolariAc);
  $('rafOnceki').addEventListener('click', function () { D.rafBas = Math.max(0,D.rafBas - 30); rafKitapYukle(); });
  $('rafSonraki').addEventListener('click', function () { D.rafBas += 30; rafKitapYukle(); });
  $('detayKapat').addEventListener('click', function () { $('kitapDetay').close(); });
  $('kitapDetay').addEventListener('click', function (e) { if (e.target === $('kitapDetay')) $('kitapDetay').close(); });
  $('rafUyarilari').addEventListener('click', function (e) { var b = e.target.closest('[data-uyari-raf]'); if (!b) return; var p = parcala(b.dataset.uyariRaf); D.seciliRaf = b.dataset.uyariRaf; bolumAc('raflar'); raflariYukle(false).then(function () { $('rafKat').value = p.kat; rafKitapliklariCiz(p.kitaplik); }); });

  $('iletisimForm').addEventListener('submit', function (e) { e.preventDefault(); var btn = $('btnIletisim'), metin = $('iletisimMesaj').value.trim(); if (metin.length < 5) { mesaj($('iletisimMsg'),'hata','Mesajınızı biraz daha açık yazın.'); return; } mesgul(btn,true,'Gönderiliyor…'); api('iletisimGonder',{ sayfa:'Koordinatör paneli', tur:$('iletisimTur').value, ad:D.ad, iletisim:$('iletisimBilgi').value.trim(), konu:$('iletisimKonu').value.trim(), mesaj:metin, baglam:'Açık bölüm: ' + D.bolum }).then(function (r) { mesaj($('iletisimMsg'),r.mailGonderildi === false ? 'hata' : 'iyi',r.mailGonderildi === false ? (r.mesaj || 'Mesaj tabloya kaydedildi ancak e-posta gönderilemedi.') : 'Mesajınız arif.solmaz@gmail.com adresine e-posta olarak iletildi. Teşekkür ederiz.'); if (r.mailGonderildi !== false) { $('iletisimMesaj').value=''; $('iletisimKonu').value=''; } }).catch(function (h) { if (!sifreHatasi(h)) mesaj($('iletisimMsg'),'hata',h.message === 'AĞ' ? 'Sunucu yanıt vermedi; mesaj gönderilmedi. Biraz sonra tekrar deneyin.' : h.message); }).finally(function(){mesgul(btn,false);}); });

  var ad = localStorage.getItem('tv_env_ad') || '', sifre = localStorage.getItem('tv_env_koord_sifre') || '';
  $('ad').value = ad; $('sifre').value = sifre;
  if (ad && sifre) setTimeout(function () { girisYap(ad, sifre, true); }, 30);
})();
