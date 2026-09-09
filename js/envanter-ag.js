/* Shared transport for the library pages. Passwords stay in POST bodies.
   A fresh URL prevents an obsolete Google ContentService redirect being reused.
   Only reads may be retried; writes are sent exactly once. */
(function () {
  'use strict';
  var reads = ['config','sayac','rafDurum','sonKayitlar','kayitBul','siraOzeti','sayimBilgisi','rafFotograflari','istenenler','onayBekleyen','onayGruplari','kararBekleyen','katalog','kutular','durum','siraHaritasi'];
  var configRequests = new Map();
  function cachedConfig(url) {
    try { var c=JSON.parse(sessionStorage.getItem('tv_env_config_v1')||'null');return c&&c.url===url&&Date.now()-c.time<300000?c.data:null; } catch(e){return null;}
  }
  function once(url, body, timeout) {
    var controller = new AbortController();
    var timer = setTimeout(function(){controller.abort();},timeout || 25000);
    var endpoint=new URL(url,location.href);
    endpoint.searchParams.set('tv_req',Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
    var configOku = body.action === 'config';
    if (configOku) endpoint.searchParams.set('action', 'config');
    return fetch(endpoint.href,{
      method:configOku?'GET':'POST',
      cache:'no-store',
      headers:configOku?undefined:{'Content-Type':'text/plain;charset=utf-8'},
      body:configOku?undefined:JSON.stringify(body),
      redirect:'follow',signal:controller.signal
    })
      .catch(function(){var e=new Error('AĞ');e.code='NETWORK';throw e;})
      .then(function(response){return response.text().then(function(text){
        var data;
        try {data=JSON.parse(text);}catch(e){
          var error=new Error('Kitap sunucusundan geçerli yanıt alınamadı. Biraz sonra yeniden deneyin.');
          error.code='SERVER_RESPONSE';throw error;
        }
        if(!response.ok || !data.ok){var err=new Error(data.error||'İşlem tamamlanamadı.');err.sifreHatasi=!!data.sifreHatasi;throw err;}
        return data;
      });}).finally(function(){clearTimeout(timer);});
  }
  function request(url, body, options) {
    options=options||{};
    if(!url||!/https?:\/\//.test(url))return Promise.reject(new Error('Kitap sunucusunun adresi tanımlanmamış.'));
    if(body.action==='config') {
      if (window.TV_ENVANTER_CONFIG) {
        return Promise.resolve(JSON.parse(JSON.stringify(window.TV_ENVANTER_CONFIG)));
      }
      var saved=cachedConfig(url);if(saved)return Promise.resolve(saved);
      if(configRequests.has(url))return configRequests.get(url);
    }
    var read=reads.indexOf(body.action)>=0;
    var result=once(url,body,options.timeout).catch(function(e){
      // Retry only a bad read response, never a write whose outcome is unknown.
      if(read&&e.code==='SERVER_RESPONSE')return once(url,body,options.timeout);
      throw e;
    }).then(function(data){
      if(body.action==='config')try{sessionStorage.setItem('tv_env_config_v1',JSON.stringify({url:url,time:Date.now(),data:data}));}catch(e){}
      return data;
    }).finally(function(){if(body.action==='config')configRequests.delete(url);});
    if(body.action==='config')configRequests.set(url,result);
    return result;
  }
  window.TVEnvanterAg={request:request};
})();
