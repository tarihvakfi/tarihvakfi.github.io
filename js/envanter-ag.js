/* Shared transport for the library pages.
   Reads use GET with a one-way password digest. This avoids the unreliable
   ContentService POST redirect without putting the actual password in a URL.
   Writes keep the password in a POST body and are sent exactly once. */
(function () {
  'use strict';
  var reads = ['config','sayac','rafDurum','sonKayitlar','kayitBul','siraOzeti','sayimBilgisi','rafFotograflari','istenenler','onayBekleyen','onayGruplari','kararBekleyen','katalog','kutular','durum','siraHaritasi','siraHaritasiKisa','koordinatorBaslangic'];
  var configRequests = new Map();
  var digestCache = new Map();
  function cachedConfig(url) {
    try { var c=JSON.parse(sessionStorage.getItem('tv_env_config_v1')||'null');return c&&c.url===url&&Date.now()-c.time<300000?c.data:null; } catch(e){return null;}
  }
  function passwordDigest(password) {
    password=String(password||'').trim();
    if(digestCache.has(password))return Promise.resolve(digestCache.get(password));
    if(!(window.crypto&&window.crypto.subtle&&window.TextEncoder))return Promise.resolve(null);
    return window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(password)).then(function(buffer){
      var digest=Array.from(new Uint8Array(buffer)).map(function(byte){return byte.toString(16).padStart(2,'0');}).join('');
      digestCache.set(password,digest);return digest;
    }).catch(function(){return null;});
  }
  function once(url, body, timeout, read) {
    var controller = new AbortController();
    var timer = setTimeout(function(){controller.abort();},timeout || 25000);
    var endpoint=new URL(url,location.href);
    endpoint.searchParams.set('tv_req',Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
    var configOku = body.action === 'config';
    function gonder(digest) {
      var getOku = configOku || (read && digest);
      if(configOku) endpoint.searchParams.set('action','config');
      else if(getOku){
        var safeBody={};Object.keys(body).forEach(function(key){if(key!=='sifre')safeBody[key]=body[key];});
        endpoint.searchParams.set('tv_json',JSON.stringify(safeBody));
        endpoint.searchParams.set('sifreOzeti',digest);
      }
      return fetch(endpoint.href,{
        method:getOku?'GET':'POST',
        cache:'no-store',
        headers:getOku?undefined:{'Content-Type':'text/plain;charset=utf-8'},
        body:getOku?undefined:JSON.stringify(body),
        redirect:'follow',signal:controller.signal
      });
    }
    return (configOku?Promise.resolve(null):passwordDigest(body.sifre).then(function(digest){return read?digest:null;})).then(gonder)
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
    var kalan=read?(options.retries==null?1:Math.max(0,Number(options.retries)||0)):0;
    function dene() {
      return once(url,body,options.timeout,read).catch(function(e){
        // Reads are side-effect free. A cold Apps Script redirect may fail once;
        // retry it with a fresh URL. Writes still run exactly once here.
        if(read&&kalan>0&&(e.code==='SERVER_RESPONSE'||e.code==='NETWORK')){
          kalan--;
          return new Promise(function(t){setTimeout(t,700);}).then(dene);
        }
        throw e;
      });
    }
    var result=dene().then(function(data){
      if(body.action==='config')try{sessionStorage.setItem('tv_env_config_v1',JSON.stringify({url:url,time:Date.now(),data:data}));}catch(e){}
      return data;
    }).finally(function(){if(body.action==='config')configRequests.delete(url);});
    if(body.action==='config')configRequests.set(url,result);
    return result;
  }
  window.TVEnvanterAg={request:request};
})();
