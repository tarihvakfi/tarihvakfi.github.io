(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = {ad:'', sifre:'', cfg:null, raflar:[], kitaplar:[], secili:'', bas:0, toplam:0, panel:'envanter', zaman:0, islem:0, oturum:0};
  var cache = new Map(), bekleyen = new Map(), yukleniyor = false, yenileSaat, cacheSurum = 0;
  var etiketler = {'Gidecek':'Gitsin','Gitse de olur':'Gitse de olur','Gitmeyecek':'Gitmesin','Belirsiz':'Belirsiz'};
  var renkler = {'Gidecek':'g','Gitse de olur':'s','Gitmeyecek':'k','Belirsiz':'m'};
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function sayi(x) { return Number(x || 0).toLocaleString('tr-TR'); }
  function hata(el,e) { el.className='hata'; el.textContent=e.message || 'Bilgiler alınamadı. Yeniden deneyin.'; }
  function giriseDon(e) {
    if(!e || !e.sifreHatasi)return false;
    D.sifre='';localStorage.removeItem('tv_env_koord_sifre');$('sifre').value='';$('uygulama').classList.add('gizli');$('giris').classList.remove('gizli');hata($('msgGiris'),e);$('sifre').focus();return true;
  }
  function kopya(x) { return JSON.parse(JSON.stringify(x)); }
  function api(action, yuk, zorla) {
    var anahtar = action + ':' + JSON.stringify(yuk || {}), sakla = ['config','durum','siraHaritasi','katalog','rafFotograflari'].indexOf(action)>=0;
    var eski=cache.get(anahtar), sure=action==='config'?300000:60000, oturum=D.oturum, surum=cacheSurum;
    if(sakla && !zorla && eski && Date.now()-eski.t < sure) return Promise.resolve(kopya(eski.v));
    if(sakla && bekleyen.has(anahtar)) return bekleyen.get(anahtar).then(kopya);
    var istek=window.TVEnvanterAg.request(window.TV_ENVANTER_URL,Object.assign({action:action,sifre:D.sifre},yuk||{}),{timeout:25000})
      .then(function(r){
        if(oturum!==D.oturum) throw new Error('Oturum değişti.');
        if(!r.ok) throw new Error(r.error || 'İşlem tamamlanamadı.');
        if(sakla && surum===cacheSurum) cache.set(anahtar,{t:Date.now(),v:kopya(r)}); return r;
      }).catch(function(e){if(e.name==='AbortError'||e.message==='Failed to fetch'||e.message==='AĞ') throw new Error('Sunucuya ulaşılamadı. Yeniden deneyin.');throw e;})
      .finally(function(){if(oturum===D.oturum && surum===cacheSurum) bekleyen.delete(anahtar);});
    if(sakla) bekleyen.set(anahtar,istek);
    return istek.then(kopya);
  }
  // Aynı oturumdaki karar ekranı ayarları ve sayaçları tekrar indirmez.
  window.TVPanel = {api:api, invalidate:function(){cacheSurum++;cache.clear();bekleyen.clear();}};
  function parcala(kod) {var m=/^([^-]+)-([A-ZÇĞİÖŞÜ]+)(\d+)$/.exec(kod);return m?{kat:m[1],kitaplik:m[2],sira:Number(m[3])}:{kat:'',kitaplik:kod,sira:0};}
  function katAdi(kod) {var m=((D.cfg||{}).mekanlar||[]).find(function(x){return x.kod===kod;});return m?m.ad:kod;}
  function yerAdi(kod) {var p=parcala(kod);return katAdi(p.kat)+' · '+p.kitaplik+' kitaplığı · '+p.sira+'. sıra';}
  function sayim(r) {var s=r.sayim||{}; if(s.durum==='sayilamadi') return null; var n=s.toplam!=null?s.toplam:r.onSayim;return n==null||n===''?null:Number(n);}
  function sayimDurumu(r) {var s=r.sayim||{};return s.uyusmazlik?'Sayımlar uyuşmuyor':s.eksik?'Sayım eksik':s.durum==='onaylandi'?'Sayım onaylandı':s.durum==='sayilamadi'?'Raf sayılamadı':sayim(r)!=null?'Sayım onay bekliyor':'Sayım yapılmadı';}
  function rozet(k) {return '<span class="rozet '+(renkler[k.kategori]||'')+'">'+esc(etiketler[k.kategori] || (k.onay?'Karar bekliyor':'Bilgi kontrolü bekliyor'))+'</span>';}
  function ozetCiz() {
    var sayilan=0, kayitli=0, kayit=0, sayimli=0, onayli=0;
    D.raflar.forEach(function(r){var n=sayim(r);if(n!==null){sayilan+=n;sayimli++;}kayitli+=Number(r.kayitli||0);kayit+=Number(r.kayitSayisi||0);if((r.sayim||{}).durum==='onaylandi')onayli++;});
    $('sayilar').innerHTML='<div class="sayi"><b>'+sayi(sayilan)+'</b><span>Sayımda görülen kitap</span><small>'+sayi(sayimli)+' raf sırası sayıldı</small></div><div class="sayi"><b>'+sayi(kayitli)+'</b><span>Kaydedilen kitap / nüsha</span><small>'+sayi(kayit)+' ayrı kitap kaydı</small></div><div class="sayi"><b>'+sayi(onayli)+' / '+sayi(D.raflar.length)+'</b><span>Sayımı onaylanan raf sırası</span><small>Tüm kütüphane</small></div>';
    $('sayimAciklama').textContent='Sayılmamış veya eksik sayılmış raflar varsa kütüphanenin toplam kitap sayısı henüz kesin değildir. Bir kitap kaydı birden fazla nüsha içerebilir.';
  }
  function secicileriCiz() {
    var kat=$('kat').value, kitaplik=$('kitaplik').value;
    var katlar=Array.from(new Set(D.raflar.map(function(r){return parcala(r.sira).kat;})));
    $('kat').innerHTML=katlar.map(function(k){return '<option value="'+esc(k)+'">'+esc(katAdi(k))+'</option>';}).join('');
    if(katlar.indexOf(kat)>=0)$('kat').value=kat;
    kitapliklariCiz(kitaplik);
  }
  function kitapliklariCiz(onceki) {
    var harfler=Array.from(new Set(D.raflar.filter(function(r){return parcala(r.sira).kat===$('kat').value;}).map(function(r){return parcala(r.sira).kitaplik;})));
    $('kitaplik').innerHTML=harfler.map(function(k){return '<option value="'+esc(k)+'">'+esc(k)+' kitaplığı</option>';}).join('');
    if(harfler.indexOf(onceki)>=0)$('kitaplik').value=onceki;
    raflariCiz();
  }
  function raflariCiz() {
    var raflar=D.raflar.filter(function(r){var p=parcala(r.sira);return p.kat===$('kat').value&&p.kitaplik===$('kitaplik').value;});
    if(!raflar.some(function(r){return r.sira===D.secili;})){D.secili=raflar.length?raflar[0].sira:'';D.bas=0;}
    $('raflar').innerHTML=raflar.map(function(r){var n=sayim(r);return '<button class="rafSec '+(r.sira===D.secili?'sec':'')+'" data-raf="'+esc(r.sira)+'" aria-pressed="'+(r.sira===D.secili)+'"><b>'+parcala(r.sira).sira+'. sıra</b><small>'+(n===null?'Henüz sayılmadı':sayi(n)+' kitap sayıldı')+'</small><small>'+sayi(r.kayitli)+' kitap kaydedildi</small></button>';}).join('');
    if(D.secili) rafAc(); else {$('rafBaslik').textContent='Henüz raf tanımlanmamış';$('kitaplar').innerHTML='';}
  }
  function rafAc() {
    var r=D.raflar.find(function(x){return x.sira===D.secili;});if(!r)return;
    $('rafBaslik').textContent=yerAdi(r.sira);
    var n=sayim(r), fark=n===null?null:n-Number(r.kayitli||0);
    $('rafOzet').innerHTML='<div class="rafOzet"><span>'+esc(sayimDurumu(r))+'</span><span>'+sayi(r.kayitli)+' kitap / '+sayi(r.kayitSayisi)+' kayıt</span><span>'+sayi(r.kararVerilen)+' kayda karar verildi</span></div>'+
      (fark===null?'':fark>0?'<p class="uyari">Sayıma göre '+sayi(fark)+' kitabın kaydı henüz yok.</p>':fark<0?'<p class="uyari">Kayıtlı kitap sayısı sayımdan '+sayi(-fark)+' fazla. Sayımı ve kayıtları kontrol edin.</p>':'<p>Sayım ile kayıtlı kitap sayısı eşleşiyor.</p>');
    $('btnRafFoto').classList.remove('gizli');$('btnRafFoto').textContent='Raf fotoğrafını gör';$('btnRafFoto').disabled=false;
    $('rafFotolar').classList.add('gizli');$('rafFotolar').innerHTML='';kitaplariYukle();
  }
  function kitaplariYukle(zorla) {
    var token=++D.islem, kod=D.secili, bas=D.bas;
    $('kitapMsg').className='';$('kitapMsg').textContent='Kitaplar yükleniyor…';$('kitapSayfalama').classList.add('gizli');$('kitaplar').innerHTML='';
    return api('katalog',{sira:kod,yalnizOnayli:false,sirala:'yer',adet:30,bas:bas},zorla).then(function(r){
      if(token!==D.islem)return;D.kitaplar=r.kayitlar||[];D.toplam=Number(r.toplam||0);$('kitapMsg').textContent='';
      $('kitaplar').innerHTML=D.kitaplar.length?D.kitaplar.map(function(k){return '<button class="kitapSatir" data-kitap="'+Number(k.no)+'"><span><strong>'+esc(k.baslik||'Kitap bilgisi henüz girilmedi')+'</strong><small>'+esc([k.yazar,k.yil,k.yer].filter(Boolean).join(' · '))+'</small></span>'+rozet(k)+'</button>';}).join(''):'<p class="bos">Bu rafta henüz kitap kaydı yok.</p>';
      $('kitapSayfalama').classList.toggle('gizli',D.toplam<=30);$('kitapOnceki').disabled=bas===0;$('kitapSonraki').disabled=bas+D.kitaplar.length>=D.toplam;$('kitapAralik').textContent=(bas+1)+'–'+(bas+D.kitaplar.length)+' / '+sayi(D.toplam);
    }).catch(function(e){if(token===D.islem)hata($('kitapMsg'),e);});
  }
  function foto(id,url) {var k=id||(String(url||'').match(/[-\w]{25,}/)||[])[0];return k?'https://drive.google.com/thumbnail?id='+encodeURIComponent(k)+'&sz=w1000':'';}
  function kitapAc(no) {
    var k=D.kitaplar.find(function(x){return Number(x.no)===no;});if(!k)return;
    $('detayIcerik').innerHTML='<h2>'+esc(k.baslik||'Kitap bilgisi henüz girilmedi')+'</h2><p>'+esc([k.yazar,k.yil].filter(Boolean).join(' · '))+'</p><p>'+esc(k.yer)+' · '+sayi(k.nusha||1)+' nüsha</p>'+rozet(k)+'<p style="margin-top:14px">'+(etiketler[k.kategori]?'Kararı veren: '+esc(k.kararVeren||'Eski kayıtta belirtilmemiş')+(k.kararTarihi?' · '+esc(k.kararTarihi):''):'')+'</p>'+(k.not?'<p>'+esc(k.not)+'</p>':'')+'<div class="kitapFotolar">'+[['Kapak',k.kapakId,k.kapak],['Künye',k.fotoId,k.foto]].map(function(f){var src=foto(f[1],f[2]);return '<figure>'+(src?'<a href="'+esc(src)+'" target="_blank" rel="noopener"><img src="'+esc(src)+'" alt="'+f[0]+' fotoğrafı"></a>':'<p>'+f[0]+' fotoğrafı henüz yok.</p>')+'<figcaption>'+f[0]+'</figcaption></figure>';}).join('')+'</div>'+(k.kararGecmisi?'<details><summary>Karar geçmişi</summary><pre>'+esc(k.kararGecmisi)+'</pre></details>':'');
    $('kitapDetay').showModal();
  }
  function envanterYukle(zorla) {
    if(yukleniyor||!D.sifre)return Promise.resolve();yukleniyor=true;$('btnYenile').disabled=true;$('envanterMsg').textContent='Raf bilgileri yükleniyor…';$('envanterMsg').className='';
    return Promise.all([api('siraHaritasi',{},zorla),api('config')]).then(function(r){D.raflar=r[0].siralar||[];D.cfg=r[1];D.zaman=Date.now();ozetCiz();secicileriCiz();$('envanterMsg').textContent='';}).catch(function(e){if(!giriseDon(e))hata($('envanterMsg'),e);}).finally(function(){yukleniyor=false;$('btnYenile').disabled=false;});
  }
  function panelSec(ad) {
    D.panel=ad;document.querySelectorAll('main > .panel').forEach(function(p){p.classList.toggle('gizli',p.dataset.ad!==ad);});
    document.querySelectorAll('[data-hedef]').forEach(function(b){b.classList.toggle('sec',b.dataset.hedef===ad);if(b.dataset.hedef===ad)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if(ad==='karar'){var f=$('kararCerceve');if(!f.getAttribute('src'))f.src=f.dataset.src;else f.contentWindow.postMessage({tv:'sekme'},location.origin);}
    if(ad==='envanter'&&Date.now()-D.zaman>60000)envanterYukle();
  }
  $('girisForm').addEventListener('submit',function(e){e.preventDefault();D.ad=$('ad').value.trim();D.sifre=$('sifre').value.trim();if(D.ad.length<2)return;D.oturum++;cacheSurum++;cache.clear();bekleyen.clear();$('btnGiris').disabled=true;$('btnGiris').textContent='Giriş yapılıyor…';$('msgGiris').textContent='';
    localStorage.setItem('tv_env_ad',D.ad);localStorage.setItem('tv_env_koord_sifre',D.sifre);$('kimAd').textContent=D.ad;$('giris').classList.add('gizli');$('uygulama').classList.remove('gizli');panelSec('envanter');$('btnGiris').disabled=false;$('btnGiris').textContent='Giriş yap';
  });
  $('btnCikis').addEventListener('click',function(){D.oturum++;D.islem++;clearTimeout(yenileSaat);D.sifre='';D.zaman=0;cacheSurum++;cache.clear();bekleyen.clear();localStorage.removeItem('tv_env_koord_sifre');$('kararCerceve').removeAttribute('src');$('sifre').value='';$('giris').classList.remove('gizli');$('uygulama').classList.add('gizli');$('kitapDetay').close();});
  document.querySelectorAll('[data-hedef]').forEach(function(b){b.addEventListener('click',function(){panelSec(b.dataset.hedef);});});
  $('btnYenile').addEventListener('click',function(){cacheSurum++;cache.clear();bekleyen.clear();envanterYukle(true);});
  $('kat').addEventListener('change',function(){D.bas=0;kitapliklariCiz();});$('kitaplik').addEventListener('change',function(){D.bas=0;raflariCiz();});
  $('raflar').addEventListener('click',function(e){var b=e.target.closest('[data-raf]');if(!b||b.dataset.raf===D.secili)return;D.secili=b.dataset.raf;D.bas=0;raflariCiz();});
  $('kitaplar').addEventListener('click',function(e){var b=e.target.closest('[data-kitap]');if(b)kitapAc(Number(b.dataset.kitap));});
  $('kitapOnceki').addEventListener('click',function(){D.bas=Math.max(0,D.bas-30);kitaplariYukle();});$('kitapSonraki').addEventListener('click',function(){D.bas+=30;kitaplariYukle();});
  $('detayKapat').addEventListener('click',function(){$('kitapDetay').close();});
  $('btnRafFoto').addEventListener('click',function(){var kod=D.secili,p=parcala(kod),r=D.raflar.find(function(x){return x.sira===kod;});if(!$('rafFotolar').classList.contains('gizli')){$('rafFotolar').classList.add('gizli');return;}$('btnRafFoto').disabled=true;
    api('rafFotograflari',{mekan:p.kat,raf:p.kitaplik,sira:p.sira}).then(function(v){if(kod!==D.secili)return;var src=(v.fotograflar||[]).map(function(f){return foto(f.id||f.fotoId,f.url||f.foto);}).filter(Boolean);if(!src.length&&r.sayimFoto)src.push(foto('',r.sayimFoto));$('rafFotolar').innerHTML=src.length?src.map(function(s){return '<a href="'+esc(s)+'" target="_blank" rel="noopener"><img src="'+esc(s)+'" alt="Raf fotoğrafı"></a>';}).join(''):'<p>Bu rafın fotoğrafı henüz eklenmemiş.</p>';$('rafFotolar').classList.remove('gizli');}).catch(function(e){if(kod===D.secili)hata($('kitapMsg'),e);}).finally(function(){if(kod===D.secili)$('btnRafFoto').disabled=false;});
  });
  window.addEventListener('message',function(e){
    if(e.origin!==location.origin||e.source!==$('kararCerceve').contentWindow||!e.data)return;
    if(e.data.tv==='cerceveYukseklik'){
      var h=Math.max(560,Math.min(30000,Number(e.data.yukseklik)||0));
      if(h)$('kararCerceve').style.height=h+'px';
      return;
    }
    if(e.data.tv!=='kararDegisti')return;
    cacheSurum++;cache.clear();bekleyen.clear();D.zaman=0;clearTimeout(yenileSaat);if(D.panel==='envanter')yenileSaat=setTimeout(function(){envanterYukle(true);},1200);
  });
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&D.panel==='envanter'&&Date.now()-D.zaman>60000)envanterYukle();});
  $('btnKoordIletisim').addEventListener('click',function(){var m=$('koordIletisimMsg'),metin=$('koordIletisimMesaj').value.trim();if(metin.length<5){m.textContent='Lütfen mesajınızı yazın.';return;}var b=$('btnKoordIletisim');b.disabled=true;b.textContent='Gönderiliyor…';api('iletisimGonder',{sayfa:'koordinator',tur:$('koordIletisimTur').value,ad:D.ad,iletisim:$('koordIletisimBilgi').value.trim(),konu:$('koordIletisimKonu').value.trim(),mesaj:metin,baglam:D.secili}).then(function(r){m.className='msg iyi';m.textContent=r.mesaj||'Mesajınız alındı. Teşekkür ederiz.';$('koordIletisimMesaj').value='';}).catch(function(e){hata(m,e);}).finally(function(){b.disabled=false;b.textContent='Mesajı gönder';});});
  $('ad').value=localStorage.getItem('tv_env_ad')||'';
  $('sifre').value=localStorage.getItem('tv_env_koord_sifre')||'';
  if (/[?&]geri=1/.test(location.search) && $('ad').value && $('sifre').value) $('girisForm').requestSubmit();
})();
