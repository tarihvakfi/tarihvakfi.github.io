#!/usr/bin/env python3
"""Gerçek sayfalardan 'deneme' sürümlerini üretir.

Deneme sayfası, Google kurulumu olmadan sistemin tamamını denemeye yarar:
arka uç telefonun kendi içinde taklit edilir, kayıtlar yalnızca o telefonda durur.
Gönüllü eğitiminde de kullanılır — yanlış kayıt gerçek tabloyu kirletmez.

Gerçek sayfalar değiştiğinde bu betiği yeniden çalıştırın.
"""
import re, pathlib

DEMO_JS = r"""
<script>
/* ══════════════ DENEME ARKA UCU ══════════════
   Bu sayfa Google'a hiç bağlanmaz. İstekler burada karşılanır, kayıtlar
   yalnızca bu telefonun hafızasında durur. Gerçek sayfa: kitap-envanteri.html */
(function () {
  'use strict';
  window.TV_ENVANTER_URL = 'https://deneme.yerel/exec';
  var DEPO = 'tv_demo_veri';
  var SIFRE = 'deneme';
  var KOORD_SIFRE = 'koordinator';
  var KOORDINATOR_EYLEMLERI = ['onayBekleyen', 'onayGruplari', 'onayla', 'topluOnayla',
                               'katalog', 'durum', 'siraHaritasi', 'kutula', 'kutular'];
  var SINIFLANDIRILMADI = 'Sınıflandırılmadı';

  /* Karar önerisi — canlı sunucudakinin sadeleştirilmiş kopyası. */
  var sadeMetin = function (b) {
    return String(b == null ? '' : b)
      .replace(/[İIıi]/g, 'i').replace(/[Ğğ]/g, 'g').replace(/[Şş]/g, 's')
      .replace(/[Öö]/g, 'o').replace(/[Üü]/g, 'u').replace(/[Çç]/g, 'c').toLowerCase();
  };
  var ONERILER = [
    { kural:'Y1', guven:'yuksek', sebep:'Tarih Vakfı yayını', kalip:/(tarih vakfi)/ },
    { kural:'Y5', guven:'yuksek', sebep:'Rapor / tez / bülten',
      kalip:/(\brapor\b|raporu\b|\btez\b|tezi\b|bulten)/ },
    { kural:'K1', guven:'yuksek', sebep:'Ders / sınav kitabı',
      kalip:/(ders kitabi|soru bankasi|konu anlatimli|\boss\b|\byks\b|\bkpss\b)/ },
    { kural:'K2', guven:'orta', sebep:'Mevzuat / yıllık',
      kalip:/(mevzuat|yillik\b|yilligi\b|almanak)/ },
    { kural:'Y2', guven:'orta', sebep:'Alan içi: toplumsal / kent tarihi',
      kalip:/(osmanli|cumhuriyet|kent tarihi|sozlu tarih|bellek|arsiv)/ },
    { kural:'S2', guven:'orta', sebep:'Genel başvuru kaynağı',
      kalip:/(ansiklopedi|sozluk|sozlugu|el kitabi|rehber\b)/ },
  ];
  var kuralKategorisi = function (kod) {
    for (var i = 0; i < KURALLAR.length; i++) if (KURALLAR[i][0] === kod) return KURALLAR[i][1];
    return '';
  };
  var kuralAciklamasi = function (kod) {
    for (var i = 0; i < KURALLAR.length; i++) if (KURALLAR[i][0] === kod) return KURALLAR[i][2];
    return '';
  };
  var kararOner = function (k) {
    var yil = Number(k.yil) || 0, nusha = Number(k.nusha) || 1;
    if (nusha > 3) return { kural:'K3', kategori:'gitmeyecek', guven:'yuksek',
      sebep: nusha + ' nüsha — üçten fazlasının fazlası' };
    if (nusha === 2 || nusha === 3) return { kural:'S1', kategori:'belki', guven:'yuksek',
      sebep: nusha + ' nüsha — ikinci/üçüncü kopya' };
    if (yil && yil < 1950) return { kural:'Y4', kategori:'gidecek', guven:'yuksek',
      sebep: yil + ' baskısı — 1950 öncesi' };
    var havuz = sadeMetin([k.baslik, k.yazar, k.oneriBaslik, k.not].join(' | '));
    for (var i = 0; i < ONERILER.length; i++) {
      if (ONERILER[i].kalip.test(havuz)) {
        return { kural:ONERILER[i].kural, kategori:kuralKategorisi(ONERILER[i].kural),
                 guven:ONERILER[i].guven, sebep:ONERILER[i].sebep };
      }
    }
    if (k.durum === 'Küflü/böcekli') return { kural:'K4', kategori:'gitmeyecek',
      guven:'dusuk', sebep:'Küflü/böcekli işaretlenmiş' };
    return { kural:'', kategori:'', guven:'', sebep:'' };
  };
  var oneriEkle = function (k) {
    var o = kararOner(k);
    var y = {}; for (var a in k) y[a] = k[a];
    y.oneriKural = o.kural; y.oneriKategori = o.kategori;
    y.oneriGuven = o.guven; y.oneriSebep = o.sebep;
    return y;
  };
  var agKapali = false;

  var KATEGORILER = {
    gidecek:   { ad: 'Gidecek' },      belki:     { ad: 'Gitse de olur' },
    gitmeyecek:{ ad: 'Gitmeyecek' },   belirsiz:  { ad: 'Belirsiz' }
  };
  var DURUMLAR = ['Sağlam', 'Yıpranmış', 'Küflü/böcekli'];
  var KURALLAR = [
    ['Y1','gidecek','Tarih Vakfı yayınları ve vakıf tarihine ait her şey'],
    ['Y2','gidecek','Türkiye ekonomik/toplumsal tarihi, kent tarihi, sözlü tarih'],
    ['Y3','gidecek','İmzalı, ithaflı veya ex-libris’li nüsha'],
    ['Y4','gidecek','1950 öncesi baskı; Osmanlıca / eski harfli eser'],
    ['Y5','gidecek','Rapor, tez, bülten, katalog, broşür'],
    ['Y6','gidecek','Süreli yayının tam serisi'],
    ['Y7','gidecek','Şartlı bağış koleksiyonunun parçası'],
    ['S1','belki','İkinci veya üçüncü kopya'],
    ['S2','belki','Genel başvuru kaynağı'],
    ['S3','belki','Dolaylı ilgili, yabancı dilde'],
    ['S4','belki','Güncelliğini kısmen yitirmiş'],
    ['S5','belki','Sağlam ama önceliği düşük'],
    ['K1','gitmeyecek','Alan dışı: ders/sınav kitabı, popüler kurgu'],
    ['K2','gitmeyecek','Güncelliğini yitirmiş mevzuat, yıllık/katalog fazlası'],
    ['K3','gitmeyecek','Üçten fazla mükerrer nüshanın fazlası'],
    ['K4','gitmeyecek','Ağır hasarlı ve kolay bulunabilir'],
    ['K5','gitmeyecek','Süreli yayının dağınık tek sayısı'],
    ['K6','gitmeyecek','Tanıtım/promosyon malzemesi'],
    ['M1','belirsiz','On saniyede karar veremedim'],
    ['M2','belirsiz','Değerli olabilir şüphesi'],
    ['M3','belirsiz','Yabancı dilde, içeriği anlamadım'],
    ['M4','belirsiz','Kurallar çelişiyor']
  ];
  var MEKANLAR = [{ kod:'G', ad:'Giriş Kat' }, { kod:'U', ad:'Üst Kat' }, { kod:'D', ad:'Depo' }];
  var RAF_HARFLERI = 'ABCDEFGH'.split('');
  var SIRA_SAYISI = 8;

  function oku() {
    try { return JSON.parse(localStorage.getItem(DEPO) || '{}'); } catch (h) { return {}; }
  }
  function yaz(v) { try { localStorage.setItem(DEPO, JSON.stringify(v)); } catch (h) {} }
  function veri() {
    var v = oku();
    if (!v.kayitlar) v.kayitlar = [];
    if (!v.sonraki) v.sonraki = 1;
    if (!v.fotolar) v.fotolar = {};
    return v;
  }
  function pad(n, h) { var m = String(n); while (m.length < h) m = '0' + m; return m; }
  function anahtar(m, r, s) { return (m ? m + '-' : '') + String(r || '').toUpperCase() + pad(Number(s) || 0, 2); }

  function islet(g) {
    var v = veri(), i;
    if (g.action === 'config') {
      return { ok:true, org:'Tarih Vakfı (DENEME)', kategoriler:KATEGORILER, durumlar:DURUMLAR,
        siniflandirilmadi: SINIFLANDIRILMADI,
        kurallar: KURALLAR.map(function (k) { return { kod:k[0], kategori:k[1], aciklama:k[2] }; }),
        mekanlar: MEKANLAR, rafHarfleri: RAF_HARFLERI, siraSayisi: SIRA_SAYISI };
    }
    if (KOORDINATOR_EYLEMLERI.indexOf(g.action) >= 0) {
      if (String(g.sifre || '') !== KOORD_SIFRE) {
        return { ok:false, sifreHatasi:true,
          error:'Bu ekran koordinatör şifresi ister. (Denemede: koordinator)' };
      }
    } else if (String(g.sifre || '') !== SIFRE) {
      return { ok:false, error:'Çalışma şifresi hatalı. (Denemede şifre: deneme)', sifreHatasi:true };
    }
    if (g.action === 'sayac') {
      var ad = String(g.kaydeden || '').toLowerCase();
      return { ok:true, toplam: v.kayitlar.length, bugun: v.kayitlar.length,
        benim: v.kayitlar.filter(function (k) { return String(k.kaydeden).toLowerCase() === ad; }).length };
    }
    if (g.action === 'rafDurum') {
      var a = anahtar(g.mekan, g.raf, g.sira);
      var ayni = v.kayitlar.filter(function (k) { return k.anahtar === a; });
      var son = ayni.reduce(function (e, k) { return Math.max(e, Number(k.siraNo) || 0); }, 0);
      var bit = (v.siralar || {})[a];
      var sonK = ayni[ayni.length - 1];
      return { ok:true, anahtar:a, sonNo:son, adet:ayni.length,
        durum: bit ? 'bitti' : (ayni.length ? 'devam' : 'bos'),
        bitiren: bit ? bit.bitiren : '', bitisTarihi: bit ? bit.tarih : '',
        raftaki: bit ? bit.raftaki : '',
        sonCalisan: sonK ? sonK.kaydeden : '',
        sonTarih: sonK ? String(sonK.tarih || '').slice(0, 10) : '' };
    }
    if (g.action === 'siraOner') {
      var baslanan = {};
      v.kayitlar.forEach(function (k) { baslanan[k.anahtar] = true; });
      var bitmis = v.siralar || {};
      var bos = [], yarim = [];
      MEKANLAR.forEach(function (m) {
        RAF_HARFLERI.split('').forEach(function (h) {
          for (var i = 1; i <= SIRA_SAYISI; i++) {
            var key = anahtar(m.kod, h, i);
            if (bitmis[key]) continue;
            if (baslanan[key]) yarim.push(key); else bos.push(key);
          }
        });
      });
      if (bos.length) return { ok:true, anahtar:bos[0], tur:'bos',
        kalanBos:bos.length, yarimKalan:yarim.length };
      if (yarim.length) return { ok:true, anahtar:yarim[0], tur:'yarim',
        kalanBos:0, yarimKalan:yarim.length };
      return { ok:true, anahtar:'', tur:'bitti', kalanBos:0, yarimKalan:0 };
    }
    if (g.action === 'siraBitir') {
      var ab = anahtar(g.mekan, g.raf, g.sira);
      if (!ab) return { ok:false, error:'Sıra belirsiz.' };
      var raftaki = parseInt(g.raftaki, 10);
      if (isNaN(raftaki) || raftaki < 0) return { ok:false, error:'Raftaki kitap sayısını yazın.' };
      var kayitli = v.kayitlar.filter(function (k) { return k.anahtar === ab; }).length;
      v.siralar = v.siralar || {};
      v.siralar[ab] = { raftaki:raftaki, kayitli:kayitli, bitiren:(g.kaydeden || ''),
        tarih: new Date().toISOString().slice(0, 10) };
      yaz(v);
      return { ok:true, anahtar:ab, kayitli:kayitli, raftaki:raftaki, fark:raftaki - kayitli };
    }
    if (g.action === 'ekle' || g.action === 'guncelle') {
      var k = g.kayit || {};
      var baslik = String(k.baslik || '').trim();
      if (!baslik && !k.fotoVar) return { ok:false, error:'Başlık boş olamaz (ya da künye fotoğrafı çekin).' };
      if (!baslik) baslik = '(künye fotoğraftan gelecek)';
      if (!k.raf) return { ok:false, error:'Raf seçilmeli.' };
      // Sınıflandırma koordinatörde; gönüllüden boş gelebilir.
      if (k.kategori || k.kural) {
        if (!KATEGORILER[k.kategori]) return { ok:false, error:'Kategori seçilmeli.' };
        var uygun = KURALLAR.some(function (r) { return r[0] === k.kural && r[1] === k.kategori; });
        if (!uygun) return { ok:false, error:'Kural kodu bu kategoriye uymuyor.' };
      }

      if (g.action === 'guncelle') {
        for (i = 0; i < v.kayitlar.length; i++) if (v.kayitlar[i].no === Number(g.no)) {
          v.kayitlar[i].yazar = k.yazar || ''; v.kayitlar[i].baslik = baslik;
          v.kayitlar[i].yil = k.yil || ''; v.kayitlar[i].not = k.not || '';
          if (k.kategori) { v.kayitlar[i].kategori = KATEGORILER[k.kategori].ad;
                            v.kayitlar[i].kural = k.kural; }
          v.kayitlar[i].durum = k.durum || 'Sağlam';
          yaz(v); return { ok:true, no:Number(g.no) };
        }
        return { ok:false, error:'Kayıt bulunamadı.' };
      }

      var a2 = anahtar(k.mekan, k.raf, k.sira);
      var ayni2 = v.kayitlar.filter(function (x) { return x.anahtar === a2; });
      var dolu = {}; ayni2.forEach(function (x) { dolu[Number(x.siraNo)] = true; });
      var onerilen = Number(g.siraNo) || 0;
      var siraNo = (onerilen > 0 && !dolu[onerilen]) ? onerilen
        : ayni2.reduce(function (e, x) { return Math.max(e, Number(x.siraNo) || 0); }, 0) + 1;

      var kayit = {
        no: v.sonraki++, anahtar: a2, siraNo: siraNo,
        yer: a2 + '-' + pad(siraNo, 3),
        mekan: k.mekan || '', raf: k.raf, sira: pad(Number(k.sira) || 0, 2),
        yazar: k.yazar || '', baslik: baslik, yil: k.yil || '', nusha: k.nusha || 1,
        kategori: k.kategori ? KATEGORILER[k.kategori].ad : SINIFLANDIRILMADI,
        kural: k.kural || '',
        durum: DURUMLAR.indexOf(k.durum) >= 0 ? k.durum : 'Sağlam',
        not: k.not || '', kaydeden: k.kaydeden || '', tarih: new Date().toISOString()
      };
      v.kayitlar.push(kayit); yaz(v);
      return { ok:true, no:kayit.no, yerKodu:kayit.yer, siraNo:siraNo,
        duzeltildi: onerilen > 0 && onerilen !== siraNo, rafAdet: ayni2.length + 1,
        sayac: { toplam: v.kayitlar.length } };
    }
    if (g.action === 'sil') {
      for (i = 0; i < v.kayitlar.length; i++) if (v.kayitlar[i].no === Number(g.no)) {
        delete v.fotolar[g.no]; v.kayitlar.splice(i, 1); yaz(v);
        return { ok:true, no:Number(g.no) };
      }
      return { ok:false, error:'Kayıt bulunamadı.' };
    }
    if (g.action === 'sonKayitlar') {
      var ad2 = String(g.kaydeden || '').trim().toLowerCase();
      return { ok:true, kayitlar: v.kayitlar.filter(function (k) {
        return !ad2 || String(k.kaydeden).toLowerCase() === ad2; }).slice(-8).reverse() };
    }
    if (g.action === 'fotoEkle') {
      for (i = 0; i < v.kayitlar.length; i++) if (v.kayitlar[i].no === Number(g.no)) {
        // Depo dolmasın diye yalnızca son birkaç fotoğraf tutulur.
        var anahtarlar = Object.keys(v.fotolar);
        while (anahtarlar.length > 3) delete v.fotolar[anahtarlar.shift()];
        if (String(g.hangi || 'kunye') === 'kapak') {
          v.fotolar['kapak-' + g.no] = g.veri;
          v.kayitlar[i].kapak = 'deneme';
          v.kayitlar[i].kapakGoruntu = g.veri;
          try { yaz(v); } catch (h) {}
          return { ok: true, no: Number(g.no), hangi: 'kapak' };
        }
        v.fotolar[g.no] = g.veri;
        v.kayitlar[i].foto = 'deneme';
        v.kayitlar[i].fotoGoruntu = g.veri;
        v.kayitlar[i].ocrDurum = 'bitti (deneme)';
        v.kayitlar[i].ocrMetin = 'DENEME — gerçek sistemde bu alanda fotoğraftan okunan metin olur.';
        v.kayitlar[i].oneriBaslik = 'ÖRNEK BAŞLIK (deneme)';
        v.kayitlar[i].oneriYazar = 'Örnek Yazar';
        v.kayitlar[i].oneriYil = '1946';
        try { yaz(v); } catch (h) {}
        return { ok:true, no:Number(g.no) };
      }
      return { ok:false, error:'Kayıt bulunamadı.' };
    }
    if (g.action === 'onayBekleyen') {
      var bek = v.kayitlar.filter(function (k) { return !k.onay; });
      return { ok:true, kayitlar: bek.slice(0, Number(g.adet) || 25).map(oneriEkle),
               kalan: bek.length };
    }
    if (g.action === 'onayGruplari') {
      var bk = v.kayitlar.filter(function (k) { return !k.onay; }).map(oneriEkle);
      var hrt = {}, onerisiz = 0;
      bk.forEach(function (k) {
        if (!k.oneriKural) { onerisiz++; return; }
        if (!hrt[k.oneriKural]) hrt[k.oneriKural] = { kural:k.oneriKural,
          kategori:k.oneriKategori, guven:k.oneriGuven, sebep:k.oneriSebep,
          aciklama: kuralAciklamasi(k.oneriKural), adet:0, numaralar:[], ornekler:[] };
        var gr = hrt[k.oneriKural];
        gr.adet++; gr.numaralar.push(k.no);
        if (gr.ornekler.length < 6) gr.ornekler.push({ no:k.no, yer:k.yer,
          baslik: k.baslik || '(künye yok)', yazar: k.yazar || '' });
      });
      var gruplar = Object.keys(hrt).map(function (a) { return hrt[a]; })
        .sort(function (a, b) {
          var za = a.guven === 'dusuk' ? 1 : 0, zb = b.guven === 'dusuk' ? 1 : 0;
          return za !== zb ? za - zb : b.adet - a.adet;
        });
      return { ok:true, gruplar:gruplar, kalan:bk.length, onerisiz:onerisiz };
    }
    if (g.action === 'topluOnayla') {
      var nolar = (g.numaralar || []).map(Number);
      if (!KATEGORILER[g.kategori]) return { ok:false, error:'Karar seçilmeli.' };
      var onaylanan = 0, atlanan = 0, basliksiz = 0;
      v.kayitlar.forEach(function (k) {
        if (nolar.indexOf(k.no) < 0) return;
        if (k.onay) { atlanan++; return; }
        if (!String(k.baslik || '').trim() || /künye fotoğraftan/i.test(k.baslik)) {
          basliksiz++; return;
        }
        k.kategori = KATEGORILER[g.kategori].ad; k.kural = g.kural;
        k.onay = 'Onaylandı — ' + (g.onaylayan || '') + ' · toplu';
        onaylanan++;
      });
      yaz(v);
      return { ok:true, onaylanan:onaylanan, atlanan:atlanan, basliksiz:basliksiz };
    }
    if (g.action === 'durum') {
      var bugun = new Date().toISOString().slice(0, 10);
      var d2 = { ok:true, toplam:0, onayli:0, onayBekleyen:0, kunyeEksik:0, tamam:0,
        fotoli:0, kapakli:0, kategori:{}, fiziksel:{}, ocr:{}, gunluk:[], kisiler:[],
        siralar:[], hedef:0, hesaplandi:'deneme' };
      var kis = {}, sir = {}, gun2 = {};
      v.kayitlar.forEach(function (k) {
        d2.toplam++;
        if (k.foto) d2.fotoli++;
        if (k.kapak) d2.kapakli++;
        if (k.onay) d2.onayli++;
        else if (k.foto || k.kapak) d2.onayBekleyen++;
        else if (/künye fotoğraftan/i.test(k.baslik || '')) d2.kunyeEksik++;
        else d2.tamam++;
        d2.kategori[k.kategori] = (d2.kategori[k.kategori] || 0) + 1;
        d2.fiziksel[k.durum] = (d2.fiziksel[k.durum] || 0) + 1;
        if (k.foto || k.kapak) { var o = k.ocrDurum || 'yok'; d2.ocr[o] = (d2.ocr[o] || 0) + 1; }
        var g3 = String(k.tarih || '').slice(0, 10);
        if (g3) gun2[g3] = (gun2[g3] || 0) + 1;
        var ad2 = k.kaydeden || '—';
        if (!kis[ad2]) kis[ad2] = { ad: ad2, bugun: 0, toplam: 0 };
        kis[ad2].toplam++;
        if (g3 === bugun) kis[ad2].bugun++;
        if (k.anahtar) {
          if (!sir[k.anahtar]) sir[k.anahtar] = { sira: k.anahtar, sayi: 0, sonNo: 0, son: g3 };
          sir[k.anahtar].sayi++;
          sir[k.anahtar].sonNo = Math.max(sir[k.anahtar].sonNo, Number(k.siraNo) || 0);
        }
      });
      for (var j = 13; j >= 0; j--) {
        var g4 = new Date(new Date().getTime() - j * 86400000).toISOString().slice(0, 10);
        d2.gunluk.push({ gun: g4, sayi: gun2[g4] || 0 });
      }
      d2.kisiler = Object.keys(kis).map(function (a3) { return kis[a3]; });
      d2.siralar = Object.keys(sir).map(function (a3) { return sir[a3]; });
      return d2;
    }

    if (g.action === 'katalog') {
      var yalniz = g.yalnizOnayli !== false;
      var ara = String(g.ara || '').trim().toLowerCase();
      var liste = v.kayitlar.filter(function (k) {
        if (yalniz && !k.onay) return false;
        if (g.kategori && k.kategori !== g.kategori) return false;
        if (g.sira && String(k.yer || '').replace(/-\d+$/, '') !== g.sira) return false;
        if (g.kutu && String(k.kutu || '') !== g.kutu) return false;
        if (ara) {
          var havuz = [k.baslik, k.yazar, k.yer, k.not, k.kutu].join(' ').toLowerCase();
          if (havuz.indexOf(ara) < 0) return false;
        }
        return true;
      }).slice();
      liste.sort(function (a, b) {
        return String(g.sirala) === 'yer'
          ? String(a.yer).localeCompare(String(b.yer)) : Number(b.no) - Number(a.no);
      });
      var bas = Math.max(0, Number(g.bas) || 0);
      var adet = Math.min(Math.max(Number(g.adet) || 60, 1), 300);
      return { ok: true, toplam: liste.length, bas: bas, kayitlar: liste.slice(bas, bas + adet) };
    }

    if (g.action === 'kutular') {
      var sr = {}, kt = {};
      v.kayitlar.forEach(function (k) {
        if (k.yer) sr[String(k.yer).replace(/-\d+$/, '')] = 1;
        if (k.kutu) kt[k.kutu] = 1;
      });
      return { ok: true, siralar: Object.keys(sr).sort(), kutular: Object.keys(kt).sort() };
    }

    if (g.action === 'kutula') {
      var istenen = (g.numaralar || []).map(Number).filter(Boolean);
      if (!istenen.length) return { ok:false, error:'Kutulanacak kayıt seçilmedi.' };
      var depoMu = String(g.hedef || '') === 'depo';
      var ham = String(g.kutu || '').trim().replace(/^[YyDd]-/, '');
      if (!/^\d{1,4}$/.test(ham)) return { ok:false, error:'Kutu numarası 1–4 haneli olmalı.' };
      var etiket = (depoMu ? 'D-' : 'Y-') +
                   ('00' + Number(ham)).slice(-Math.max(3, String(Number(ham)).length));
      var yazilan = 0, cilt = 0, yerler = [];
      v.kayitlar.forEach(function (k) {
        if (istenen.indexOf(Number(k.no)) < 0) return;
        var eski = String(k.kutu || '').trim();
        if (eski && eski !== etiket) return;
        k.kutu = etiket; yazilan++;
        cilt += Math.max(1, Number(k.nusha) || 1);
        if (k.yer) yerler.push(String(k.yer));
      });
      if (!yazilan) return { ok:false, error:'Bu kayıtlar zaten başka kutuda.' };
      yerler.sort();
      var aralik = yerler.length
        ? (yerler[0] === yerler[yerler.length - 1]
            ? yerler[0] : yerler[0] + ' → ' + yerler[yerler.length - 1]) : '';
      yaz(v);
      return { ok:true, kutu: etiket, hedef: depoMu ? 'DEPO' : 'YENİ BİNA',
               yazilan: yazilan, cilt: cilt, atlanan: 0, aralik: aralik };
    }

    if (g.action === 'onayla') {
      for (i = 0; i < v.kayitlar.length; i++) if (v.kayitlar[i].no === Number(g.no)) {
        var y = g.kayit || {};
        if (!String(y.baslik || '').trim()) return { ok:false, error:'Başlık boş olamaz.' };
        if (!KATEGORILER[y.kategori]) return { ok:false, error:'Karar seçilmeli.' };
        if (!KURALLAR.some(function (r) { return r[0] === y.kural && r[1] === y.kategori; })) {
          return { ok:false, error:'Kural kodu bu karara uymuyor.' };
        }
        v.kayitlar[i].baslik = y.baslik; v.kayitlar[i].yazar = y.yazar || '';
        v.kayitlar[i].yil = y.yil || ''; v.kayitlar[i].not = y.not || '';
        v.kayitlar[i].kategori = KATEGORILER[y.kategori].ad; v.kayitlar[i].kural = y.kural;
        v.kayitlar[i].onay = 'Onaylandı — ' + (y.onaylayan || '');
        yaz(v); return { ok:true, no:Number(g.no) };
      }
      return { ok:false, error:'Kayıt bulunamadı.' };
    }
    return { ok:false, error:'Bilinmeyen istek.' };
  }

  var gercekFetch = window.fetch.bind(window);
  window.fetch = function (adres, ayar) {
    if (String(adres).indexOf('deneme.yerel') < 0) return gercekFetch(adres, ayar);
    return new Promise(function (tamam, hata) {
      setTimeout(function () {
        if (agKapali) return hata(new TypeError('deneme: ağ kapalı'));
        var g = {};
        try { g = JSON.parse((ayar && ayar.body) || '{}'); } catch (h) {}
        var sonuc;
        try { sonuc = islet(g); } catch (h) { sonuc = { ok:false, error:'deneme hatası: ' + h.message }; }
        tamam({ ok:true, text: function () { return Promise.resolve(JSON.stringify(sonuc)); } });
      }, 250);
    });
  };

  /* ── deneme şeridi ── */
  document.addEventListener('DOMContentLoaded', function () {
    var s = document.createElement('div');
    s.id = 'demoSerit';
    s.innerHTML =
      '<div class="demo-ust"><b>DENEME MODU</b> — kayıtlar yalnızca bu telefonda, ' +
      'Google\'a hiçbir şey gitmiyor. Şifreler: gönüllü <b>deneme</b>, koordinatör ' +
      '<b>koordinator</b></div>' +
      '<div class="demo-dugmeler">' +
        '<button type="button" id="demoAg">İnterneti kes</button>' +
        '<button type="button" id="demoSil">Deneme kayıtlarını sil</button>' +
      '</div>';
    document.body.insertBefore(s, document.body.firstChild);

    var d = document.getElementById('demoAg');
    d.addEventListener('click', function () {
      agKapali = !agKapali;
      d.textContent = agKapali ? 'İnterneti aç' : 'İnterneti kes';
      d.className = agKapali ? 'kapali' : '';
      s.className = agKapali ? 'kesik' : '';
    });
    document.getElementById('demoSil').addEventListener('click', function () {
      if (!confirm('Deneme kayıtlarının hepsi silinsin mi?')) return;
      localStorage.removeItem(DEPO);
      localStorage.removeItem('tv_env_kuyruk');
      localStorage.removeItem('tv_env_foto_kuyruk');
      localStorage.removeItem('tv_env_sira');
      location.reload();
    });
  });
})();
</script>
<style>
  #demoSerit{background:#1f2937;color:#fff;padding:8px 12px;font:14px/1.4 system-ui,sans-serif;
    display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  #demoSerit.kesik{background:#92400e}
  #demoSerit .demo-ust{flex:1;min-width:200px;font-size:12.5px;opacity:.95}
  #demoSerit .demo-dugmeler{display:flex;gap:8px;margin-left:auto}
  #demoSerit button{background:#ffffff26;border:1px solid #ffffff59;color:#fff;border-radius:7px;
    padding:7px 11px;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
  #demoSerit button.kapali{background:#fbbf24;border-color:#fbbf24;color:#3b2600;font-weight:700}
  /* denemede Drive bağlantısı anlamsız */
  #fotoBag{display:none!important}
</style>
"""

kok = pathlib.Path(__file__).parent

for kaynak, hedef, baslik in [
    ("kitap-envanteri.html", "envanter-deneme.html", "Kitap Envanteri · DENEME"),
    ("kunye-onay.html", "kunye-onay-deneme.html", "Künye Onayı · DENEME"),
    ("envanter-katalog.html", "envanter-katalog-deneme.html", "Envanter Kataloğu · DENEME"),
    ("envanter-durum.html", "envanter-durum-deneme.html", "Envanter Durumu · DENEME"),
]:
    s = (kok / kaynak).read_text(encoding="utf-8")

    # başlık ve arama motoru
    s = re.sub(r"<title>.*?</title>", f"<title>{baslik}</title>", s, count=1)

    # servis çalışanı ve manifest deneme sayfasında olmasın (gerçek uygulamayı ezmesin)
    s = s.replace('<link rel="manifest" href="./envanter-manifest.json" />', "")
    s = s.replace("navigator.serviceWorker.register('./sw.js')",
                  "Promise.resolve()  /* denemede servis çalışanı kurulmaz */")

    # deneme arka ucunu config'ten SONRA yerleştir ki adresi o ezsin
    etiket = '<script src="./js/gonullu-config.js?v=20260818"></script>'
    assert etiket in s, kaynak
    s = s.replace(etiket, etiket + "\n" + DEMO_JS, 1)

    # onay ekranında gerçek sayfaya dönüş bağlantısı
    (kok / hedef).write_text(s, encoding="utf-8")
    print(f"yazıldı: {hedef}")
