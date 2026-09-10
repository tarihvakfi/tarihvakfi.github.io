/* Shared transport for the library pages.
   Reads use GET with a one-way password digest. This avoids the unreliable
   ContentService POST redirect without putting the actual password in a URL.
   Writes keep the password in a POST body and are sent exactly once. */
(function () {
  'use strict';
  var reads = ['config','sayac','rafDurum','sonKayitlar','kayitBul','siraOzeti','sayimBilgisi','rafFotograflari','istenenler','onayBekleyen','onayGruplari','kararBekleyen','katalog','kutular','durum','siraHaritasi','siraHaritasiKisa','koordinatorBaslangic'];
  var configRequests = new Map();
  var digestCache = new Map();
  var bridgeFrame=null, bridgeUrl='', bridgeOrigin='', bridgeReady=null, bridgeResolve=null, bridgeReject=null, bridgeTimer=null;
  var bridgePending=new Map(), bridgeSequence=0;

  function bridgeEligible(url) { return /^https:\/\/script\.google\.com\/macros\/s\//.test(String(url||'')); }
  function trustedBridgeOrigin(origin) {
    try {
      var host=new URL(origin).hostname;
      return host==='script.google.com'||host==='script.googleusercontent.com'||/\.script\.googleusercontent\.com$/.test(host);
    } catch(e){return false;}
  }
  function resultOrError(data) {
    if(!data||!data.ok){var err=new Error((data&&data.error)||'İşlem tamamlanamadı.');err.sifreHatasi=!!(data&&data.sifreHatasi);throw err;}
    return data;
  }
  window.addEventListener('message',function(event){
    if(!bridgeFrame||event.source!==bridgeFrame.contentWindow||!trustedBridgeOrigin(event.origin)||!event.data)return;
    if(event.data.tvEnvanter==='hazir'){
      bridgeOrigin=event.origin;clearTimeout(bridgeTimer);
      if(bridgeResolve)bridgeResolve(true);bridgeResolve=null;bridgeReject=null;return;
    }
    if(event.data.tvEnvanter!=='yanit')return;
    var pending=bridgePending.get(String(event.data.id));if(!pending)return;
    bridgePending.delete(String(event.data.id));clearTimeout(pending.timer);
    try{pending.resolve(resultOrError(event.data.data));}catch(error){pending.reject(error);}
  });
  function ensureBridge(url) {
    if(bridgeFrame&&bridgeUrl===url&&bridgeOrigin)return Promise.resolve(true);
    if(bridgeReady&&bridgeUrl===url)return bridgeReady;
    if(bridgeFrame)bridgeFrame.remove();
    bridgeUrl=url;bridgeOrigin='';
    bridgeFrame=document.createElement('iframe');bridgeFrame.hidden=true;bridgeFrame.tabIndex=-1;
    bridgeFrame.setAttribute('aria-hidden','true');bridgeFrame.title='';
    var endpoint=new URL(url,location.href);endpoint.searchParams.set('bridge','1');endpoint.searchParams.set('tv_req',Date.now().toString(36));
    bridgeReady=new Promise(function(resolve,reject){bridgeResolve=resolve;bridgeReject=reject;
      bridgeTimer=setTimeout(function(){var e=new Error('Bağlantı köprüsü kurulamadı.');e.code='BRIDGE_START';
        bridgeReady=null;bridgeResolve=null;bridgeReject=null;reject(e);},6000);
    });
    bridgeFrame.src=endpoint.href;document.body.appendChild(bridgeFrame);
    return bridgeReady;
  }
  function bridgeOnce(url,body,timeout) {
    return ensureBridge(url).then(function(){return new Promise(function(resolve,reject){
      var id=String(++bridgeSequence), timer=setTimeout(function(){bridgePending.delete(id);var e=new Error('AĞ');e.code='NETWORK';reject(e);},timeout||25000);
      bridgePending.set(id,{resolve:resolve,reject:reject,timer:timer});
      bridgeFrame.contentWindow.postMessage({tvEnvanter:'istek',id:id,body:body},bridgeOrigin);
    });});
  }
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
        if(!response.ok)throw new Error(data.error||'İşlem tamamlanamadı.');
        return resultOrError(data);
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
      var istek=(body.action!=='config'&&bridgeEligible(url))
        ? bridgeOnce(url,body,options.timeout).catch(function(e){
            /* Köprü henüz açılamadıysa eski bağlantı bir kez yedek olsun.
               İstek köprüden gönderildikten sonra yazma işlemi tekrarlanmaz. */
            if(e.code==='BRIDGE_START')return once(url,body,options.timeout,read);
            throw e;
          })
        : once(url,body,options.timeout,read);
      return istek.catch(function(e){
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
  /* Giriş düğmesine basılmadan bağlantıyı hazırla; çoğu kullanıcı şifresini
     yazana kadar Google köprüsü kurulmuş olur. */
  setTimeout(function(){if(window.TV_ENVANTER_URL&&bridgeEligible(window.TV_ENVANTER_URL))ensureBridge(window.TV_ENVANTER_URL).catch(function(){});},0);
})();
