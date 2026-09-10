/* Shared transport for the library pages.
   Reads use GET with a one-way password digest. This avoids the unreliable
   ContentService POST redirect without putting the actual password in a URL.
   Writes keep the password in a POST body and are sent exactly once. */
(function () {
  'use strict';
  var reads = ['config','sayac','rafDurum','sonKayitlar','kayitBul','siraOzeti','sayimBilgisi','rafFotograflari','istenenler','onayBekleyen','onayGruplari','kararBekleyen','katalog','kutular','durum','siraHaritasi','siraHaritasiKisa','koordinatorBaslangic'];
  var configRequests = new Map();
  var digestCache = new Map();
  var jsonpSequence=0;

  function appsScriptUrl(url) { return /^https:\/\/script\.google\.com\/macros\/s\//.test(String(url||'')); }
  function resultOrError(data) {
    if(!data||!data.ok){var err=new Error((data&&data.error)||'İşlem tamamlanamadı.');err.sifreHatasi=!!(data&&data.sifreHatasi);throw err;}
    return data;
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
  function jsonpRaw(url,params,timeout) {
    return new Promise(function(resolve,reject){
      var callback='__tvEnvanter_'+Date.now().toString(36)+'_'+(++jsonpSequence);
      var endpoint=new URL(url,location.href), script=document.createElement('script'), done=false;
      Object.keys(params||{}).forEach(function(key){endpoint.searchParams.set(key,String(params[key]));});
      endpoint.searchParams.set('callback',callback);
      endpoint.searchParams.set('tv_req',Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
      function cleanup(){if(done)return;done=true;clearTimeout(timer);script.remove();try{delete window[callback];}catch(e){window[callback]=function(){};}}
      window[callback]=function(data){cleanup();resolve(data);};
      script.onerror=function(){cleanup();var e=new Error('AĞ');e.code='NETWORK';reject(e);};
      var timer=setTimeout(function(){cleanup();var e=new Error('AĞ');e.code='NETWORK';reject(e);},timeout||25000);
      script.src=endpoint.href;script.async=true;document.head.appendChild(script);
    });
  }
  function jsonpOnce(url,body,timeout) {
    return passwordDigest(body.sifre).then(function(digest){
      var safeBody={};Object.keys(body).forEach(function(key){if(key!=='sifre')safeBody[key]=body[key];});
      return jsonpRaw(url,{tv_json:JSON.stringify(safeBody),sifreOzeti:digest||''},timeout).then(resultOrError);
    });
  }
  function requestId() {
    if(window.crypto&&window.crypto.getRandomValues){var a=new Uint32Array(4);window.crypto.getRandomValues(a);return Array.from(a).map(function(x){return x.toString(36);}).join('_');}
    return Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2);
  }
  function formPostOnce(url,body,timeout) {
    var id=requestId(), payload=Object.assign({},body,{_requestId:id}), started=Date.now();
    var name='tv_envanter_post_'+id.replace(/[^A-Za-z0-9_]/g,''), frame=document.createElement('iframe'), form=document.createElement('form'), input=document.createElement('input');
    frame.name=name;frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.title='';
    form.hidden=true;form.method='POST';form.action=url;form.target=name;form.acceptCharset='utf-8';
    input.type='hidden';input.name='tv_json';input.value=JSON.stringify(payload);form.appendChild(input);
    document.body.appendChild(frame);document.body.appendChild(form);form.submit();form.remove();
    function cleanup(){setTimeout(function(){frame.remove();},1000);}
    function poll(){
      var remaining=(timeout||30000)-(Date.now()-started);
      if(remaining<=0){cleanup();var e=new Error('AĞ');e.code='NETWORK';return Promise.reject(e);}
      return jsonpRaw(url,{sonuc:id},Math.min(6000,remaining)).then(function(data){
        if(data&&data.bekliyor)return new Promise(function(r){setTimeout(r,350);}).then(poll);
        cleanup();return resultOrError(data);
      });
    }
    return new Promise(function(r){setTimeout(r,250);}).then(poll).catch(function(e){cleanup();throw e;});
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
      var istek=appsScriptUrl(url)
        ? (read ? jsonpOnce(url,body,options.timeout) : formPostOnce(url,body,options.timeout))
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
})();
