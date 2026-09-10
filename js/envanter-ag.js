/* Tarih Vakfı kütüphane sayfalarının Supabase bağlantısı.
   Bütün envanter okumaları ve yazmaları aynı Edge Function'a JSON olarak gider.
   Apps Script taşıma/yönlendirme katmanı bu dosyada özellikle yoktur. */
(function () {
  'use strict';

  var configRequests = new Map();

  function resultOrError(data) {
    if (!data || !data.ok) {
      var err = new Error((data && data.error) || 'İşlem tamamlanamadı.');
      err.sifreHatasi = !!(data && data.sifreHatasi);
      throw err;
    }
    return data;
  }

  function cachedConfig(url) {
    try {
      var c = JSON.parse(sessionStorage.getItem('tv_env_config_v2_supabase') || 'null');
      return c && c.url === url && Date.now() - c.time < 300000 ? c.data : null;
    } catch (e) { return null; }
  }

  function once(url, body, timeout) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeout || 20000);
    var endpoint = new URL(url, location.href);
    endpoint.searchParams.set('tv_req', Date.now().toString(36) + '_' + Math.random().toString(36).slice(2));
    return fetch(endpoint.href, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal
    }).catch(function () {
      var e = new Error('AĞ'); e.code = 'NETWORK'; throw e;
    }).then(function (response) {
      return response.text().then(function (raw) {
        var data;
        try { data = JSON.parse(raw); }
        catch (e) {
          var invalid = new Error('Kitap sunucusundan geçerli yanıt alınamadı. Biraz sonra yeniden deneyin.');
          invalid.code = 'SERVER_RESPONSE'; throw invalid;
        }
        if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
        return resultOrError(data);
      });
    }).finally(function () { clearTimeout(timer); });
  }

  function request(url, body, options) {
    options = options || {};
    if (!url || !/^https:\/\/[^/]+\.supabase\.co\/functions\/v1\//.test(url)) {
      return Promise.reject(new Error('Kitap sistemi Supabase adresi tanımlanmamış.'));
    }
    if (body.action === 'config') {
      if (window.TV_ENVANTER_CONFIG) return Promise.resolve(JSON.parse(JSON.stringify(window.TV_ENVANTER_CONFIG)));
      var saved = cachedConfig(url); if (saved) return Promise.resolve(saved);
      if (configRequests.has(url)) return configRequests.get(url);
    }
    var readActions = ['config','sayac','rafDurum','sonKayitlar','kayitBul','siraOzeti','sayimBilgisi','rafFotograflari','istenenler','onayBekleyen','onayGruplari','kararBekleyen','katalog','kutular','durum','siraHaritasi','siraHaritasiKisa','koordinatorBaslangic'];
    var retries = readActions.indexOf(body.action) >= 0 ? (options.retries == null ? 1 : Math.max(0, Number(options.retries) || 0)) : 0;
    function run() {
      return once(url, body, options.timeout || 20000).catch(function (e) {
        if (retries > 0 && (e.code === 'NETWORK' || e.code === 'SERVER_RESPONSE')) {
          retries--; return new Promise(function (done) { setTimeout(done, 500); }).then(run);
        }
        throw e;
      });
    }
    var promise = run().then(function (data) {
      if (body.action === 'config') try {
        sessionStorage.setItem('tv_env_config_v2_supabase', JSON.stringify({ url:url, time:Date.now(), data:data }));
      } catch (e) {}
      return data;
    }).finally(function () { if (body.action === 'config') configRequests.delete(url); });
    if (body.action === 'config') configRequests.set(url, promise);
    return promise;
  }

  function photoUrl(url, width) {
    var value = String(url || '');
    if (!value || !/\/storage\/v1\/object\/public\/library-photos\//.test(value)) return value;
    var rendered = value.replace('/storage/v1/object/public/library-photos/', '/storage/v1/render/image/public/library-photos/');
    var targetWidth = Math.max(160, Number(width) || 900);
    /* Supabase Image Transformation yalnız genişlik verilince bu projedeki
       1200×1600 fotoğrafları 500×1600 üretip görüntüyü inceltiyor. 3:4 hedef
       kutusunu ve contain kipini birlikte vererek oranı koru. */
    try {
      var parsed = new URL(rendered);
      parsed.searchParams.set('width', String(targetWidth));
      parsed.searchParams.set('height', String(Math.round(targetWidth * 4 / 3)));
      parsed.searchParams.set('resize', 'contain');
      parsed.searchParams.set('quality', '82');
      return parsed.href;
    } catch (e) {
      var join = rendered.indexOf('?') >= 0 ? '&' : '?';
      return rendered + join + 'width=' + targetWidth + '&height=' +
        Math.round(targetWidth * 4 / 3) + '&resize=contain&quality=82';
    }
  }

  /* Supabase Storage nadiren bir resmi ilk paralel istekte atlayabiliyor.
     Görseli bir kez önbelleksiz yeniden istemek boş kartı engeller. */
  document.addEventListener('error', function (event) {
    var img = event.target;
    if (!(img instanceof HTMLImageElement) || !/\.supabase\.co\/storage\/v1\//.test(img.src) || img.dataset.tvRetry) return;
    img.dataset.tvRetry = '1';
    var src = img.src, join = src.indexOf('?') >= 0 ? '&' : '?';
    setTimeout(function () { img.src = src + join + 'retry=' + Date.now(); }, 250);
  }, true);

  window.TVEnvanterAg = { request:request, photoUrl:photoUrl };
})();
