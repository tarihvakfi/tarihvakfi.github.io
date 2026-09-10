/* Shared transport for the library pages.
   Reads use GET with a one-way password digest. Writes first obtain a short,
   single-use ticket, then send the payload without putting the password in
   the URL. Both paths use JSONP to avoid Apps Script's slow fetch redirect. */
(function () {
  'use strict';
  var reads = ['config','yazmaBileti','istekSonucu','sayac','rafDurum','sonKayitlar','kayitBul','siraOzeti','sayimBilgisi','rafFotograflari','istenenler','onayBekleyen','onayGruplari','kararBekleyen','katalog','kutular','durum','siraHaritasi','siraHaritasiKisa','koordinatorBaslangic'];
  var configRequests = new Map();
  var digestCache = new Map();

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
  function jsonpOku(url,parametreler,timeout) {
    return new Promise(function(resolve,reject) {
      var bitti=false, script=document.createElement('script');
      var callback='tvEnvCb_'+requestId().replace(/[^A-Za-z0-9_$]/g,'');
      var endpoint=new URL(url,location.href);
      Object.keys(parametreler||{}).forEach(function(k){endpoint.searchParams.set(k,parametreler[k]);});
      endpoint.searchParams.set('callback',callback);
      endpoint.searchParams.set('tv_req',Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
      function temizle(){
        if(bitti)return;bitti=true;clearTimeout(timer);script.remove();
        try{delete window[callback];}catch(e){window[callback]=undefined;}
      }
      function hata(){temizle();var e=new Error('AĞ');e.code='NETWORK';reject(e);}
      window[callback]=function(data){temizle();try{resolve(resultOrError(data));}catch(e){reject(e);}};
      script.async=true;script.src=endpoint.href;script.onerror=hata;
      var timer=setTimeout(hata,Math.max(1000,Number(timeout)||20000));
      document.head.appendChild(script);
    });
  }
  function appsScriptOku(url,body,timeout) {
    var configOku=body.action==='config';
    return (configOku?Promise.resolve(null):passwordDigest(body.sifre)).then(function(digest){
      var parametreler={};
      if(configOku)parametreler.action='config';
      else {
        var safeBody={};Object.keys(body).forEach(function(key){if(key!=='sifre')safeBody[key]=body[key];});
        parametreler.tv_json=JSON.stringify(safeBody);parametreler.sifreOzeti=digest||'';
      }
      return jsonpOku(url,parametreler,Math.min(Number(timeout)||25000,20000));
    });
  }
  function appsScriptYaz(url,body,timeout) {
    var toplam=Math.max(30000,Number(timeout)||0), baslangic=Date.now(), id=requestId();
    return appsScriptOku(url,{action:'yazmaBileti',sifre:body.sifre,yazmaEylemi:body.action},Math.min(12000,toplam))
      .then(function(bilet){
        if(!bilet||!bilet.bilet)throw new Error('İşlem bileti alınamadı.');
        var yuk={};Object.keys(body).forEach(function(k){if(k!=='sifre')yuk[k]=body[k];});yuk._requestId=id;
        var parametreler={tv_yaz:JSON.stringify(yuk),bilet:bilet.bilet};
        function gonder(){
          var kalan=toplam-(Date.now()-baslangic);
          if(kalan<=0){var e=new Error('AĞ');e.code='NETWORK';return Promise.reject(e);}
          return jsonpOku(url,parametreler,Math.min(15000,kalan));
        }
        function sonucuBekle(){
          var kalan=toplam-(Date.now()-baslangic);
          if(kalan<=0){var e=new Error('AĞ');e.code='NETWORK';return Promise.reject(e);}
          return appsScriptOku(url,{action:'istekSonucu',sifre:body.sifre,_requestId:id},Math.min(10000,kalan))
            .then(function(data){
              if(!data||!data.bekliyor)return data;
              return new Promise(function(r){setTimeout(r,700);}).then(sonucuBekle);
            })
            .catch(function(e){
              if(e.code!=='NETWORK')throw e;
              return new Promise(function(r){setTimeout(r,700);}).then(sonucuBekle);
            });
        }
        /* Yazma isteği yalnızca bir kez gider. Yanıt ağı aşarsa aynı işlemi
           yeniden göndermek yerine sunucudaki sonuç kaydı okunur. */
        return gonder().catch(function(e){if(e.code!=='NETWORK')throw e;return sonucuBekle();});
      });
  }
  function requestId() {
    if(window.crypto&&window.crypto.getRandomValues){var a=new Uint32Array(4);window.crypto.getRandomValues(a);return Array.from(a).map(function(x){return x.toString(36);}).join('_');}
    return Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2);
  }
  function formPostOnce(url,body,timeout) {
    var id=requestId(), payload=Object.assign({},body,{_requestId:id}), started=Date.now();
    var name='tv_envanter_post_'+id.replace(/[^A-Za-z0-9_]/g,''), frame=document.createElement('iframe'), form=document.createElement('form'), input=document.createElement('input');
    var tamamlandi=false, toplam=Math.max(45000,Number(timeout)||0), sonrakiYoklama;
    frame.name=name;frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.title='';
    form.hidden=true;form.method='POST';form.action=url;form.target=name;form.acceptCharset='utf-8';
    input.type='hidden';input.name='tv_json';input.value=JSON.stringify(payload);form.appendChild(input);
    function cleanup(){
      clearTimeout(sonrakiYoklama);window.removeEventListener('message',mesajAl);
      setTimeout(function(){frame.remove();},1000);
    }
    function bitir(resolve,reject,data,hata){
      if(tamamlandi)return;tamamlandi=true;cleanup();
      if(hata){reject(hata);return;}
      try{resolve(resultOrError(data));}catch(e){reject(e);}
    }
    var disResolve,disReject;
    function mesajAl(e){
      var d=e&&e.data;
      if(!d||d.kaynak!=='tv-envanter'||d.id!==id)return;
      bitir(disResolve,disReject,d.yanit);
    }
    function poll(){
      if(tamamlandi)return;
      var kalan=toplam-(Date.now()-started);
      if(kalan<=0){var e=new Error('AĞ');e.code='NETWORK';bitir(disResolve,disReject,null,e);return;}
      appsScriptOku(url,{action:'istekSonucu',sifre:body.sifre,_requestId:id},Math.min(10000,kalan))
        .then(function(data){
          if(data&&data.bekliyor){sonrakiYoklama=setTimeout(poll,900);return;}
          bitir(disResolve,disReject,data);
        })
        .catch(function(){sonrakiYoklama=setTimeout(poll,900);});
    }
    return new Promise(function(resolve,reject){
      disResolve=resolve;disReject=reject;window.addEventListener('message',mesajAl);
      document.body.appendChild(frame);document.body.appendChild(form);form.submit();form.remove();
      sonrakiYoklama=setTimeout(poll,4000);
    });
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
        ? (read ? appsScriptOku(url,body,options.timeout) : appsScriptYaz(url,body,options.timeout))
        : once(url,body,options.timeout,read);
      return istek.catch(function(e){
        // Reads are side-effect free, so a geçici ağ hatasında yeniden denenebilir.
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
