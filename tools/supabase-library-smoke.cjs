/* Canlı Supabase kütüphane API kabul testi. Geçici verileri sonunda temizler. */
const assert = require('node:assert/strict');

const apiUrl = process.env.TV_ENVANTER_URL || 'https://ksikaryxaqulassdiwso.supabase.co/functions/v1/library-api';
const supabaseUrl = process.env.SUPABASE_URL || 'https://ksikaryxaqulassdiwso.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.LIBRARY_COORDINATOR_PASSWORD;
if (!serviceKey || !password) throw new Error('Test için SUPABASE_SERVICE_ROLE_KEY ve LIBRARY_COORDINATOR_PASSWORD gerekli.');
const runId = Date.now().toString(36);
const actor = `Codex Kabul ${runId}`;
const actor2 = `Codex İkinci ${runId}`;
const location = `T${runId.slice(-4).toUpperCase()}`;
const shelfCode = `${location}-ZZ01`;
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const timings = [];
let bookId = null, bookNo = null, boxId = null;

async function api(action, extra = {}) {
  process.stdout.write(`${action}… `);
  const started = performance.now();
  const response = await fetch(apiUrl, { method:'POST', headers:{'content-type':'text/plain;charset=utf-8'}, body:JSON.stringify({action,sifre:password,...extra}), signal:AbortSignal.timeout(20000) });
  const data = await response.json();
  timings.push([action, Math.round(performance.now() - started)]);
  process.stdout.write(`${timings.at(-1)[1]} ms\n`);
  assert.equal(response.ok, true, `${action} HTTP ${response.status}: ${data.error || 'yanıt yok'}`);
  assert.equal(data.ok, true, `${action}: ${data.error || 'başarısız'}`);
  return data;
}
async function must(query, label) {
  try { return await query; }
  catch (error) { throw new Error(`${label}: ${error.message}`); }
}
async function rest(table, method = 'GET', query = '', body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method,
    headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json',prefer:'return=representation'},
    body:body == null ? undefined : JSON.stringify(body)
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
  return data;
}
async function removePhoto(path) {
  if (!path) return;
  await fetch(`${supabaseUrl}/storage/v1/object/library-photos/${path}`, {method:'DELETE',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`}});
}

(async () => {
  try {
    await must(rest('library_locations','POST','',{code:location,name:'Geçici kabul testi',sort_order:99999}), 'konum oluşturma');
    const shelf = (await must(rest('library_shelf_positions','POST','',{code:shelfCode,location_code:location,bookcase_code:'ZZ',shelf_number:1,sort_order:99999,assigned_by_name:actor,assigned_at:new Date().toISOString()}), 'raf oluşturma'))[0];

    const config = await api('config'); assert.equal(config.org, 'Tarih Vakfı');
    const start = await api('koordinatorBaslangic', {adet:5}); assert.ok(start.durum && start.rafOzeti && start.kararlar);
    const selected = await api('siraOner', {kaydeden:actor}); assert.equal(selected.anahtar, shelfCode);
    await api('siraBirak', {kaydeden:actor,anahtar:shelfCode});
    await api('siraSec', {mekan:location,raf:'ZZ',sira:1,kaydeden:actor});

    await api('sayimKaydet', {mekan:location,raf:'ZZ',sira:1,sayan:actor,duzen:'tek',on:12,foto:photo});
    const count = await api('sayimBilgisi', {mekan:location,raf:'ZZ',sira:1}); assert.equal(count.sayim.toplam, 12);
    const shelfPhotos = await api('rafFotograflari', {mekan:location,raf:'ZZ',sira:1}); assert.equal(shelfPhotos.fotograflar.length, 1);
    await api('sayimOnayla', {mekan:location,raf:'ZZ',sira:1,onaylayan:actor});
    await api('sayimGeriAl', {mekan:location,raf:'ZZ',sira:1,sayan:actor});

    const added = await api('ekle', {istemciId:`codex-${runId}`,siraNo:1,kayit:{mekan:location,raf:'ZZ',sira:1,baslik:'Geçici kabul kitabı',yazar:'Test',yil:'2026',nusha:1,durum:'Sağlam',kaydeden:actor}});
    bookNo = added.no;
    const row = (await must(rest('library_books','GET',`?select=id&legacy_no=eq.${bookNo}`), 'kitap bulma'))[0]; bookId = row.id;
    await api('fotoEkle', {no:bookNo,hangi:'kapak',veri:photo,tur:'image/png'});
    await api('fotoBagla', {no:bookNo,hangi:'kunye',url:'https://example.invalid/test.jpg'});
    const found = await api('kayitBul', {yer:added.yerKodu}); assert.equal(found.kayit.no, bookNo);
    await api('guncelle', {no:bookNo,kayit:{baslik:'Geçici kabul kitabı düzeltildi',not:'Canlı kabul testi'}});
    await api('kitapIste', {no:bookNo,sebep:'Fotoğrafı yeniden kontrol edin',isteyen:actor});
    const requested = await api('istenenler'); assert.ok(requested.kayitlar.some(k => k.no === bookNo));
    const pending = await api('onayBekleyen', {adet:100}); assert.ok(pending.kayitlar.some(k => k.no === bookNo));
    await api('kunyeErtele', {no:bookNo});
    await api('onayla', {no:bookNo,kayit:{yalnizKunye:true,baslik:'Geçici kabul kitabı düzeltildi',yazar:'Test',yil:'2026',onaylayan:actor}});

    const first = await api('kararVer', {numaralar:[bookNo],kategori:'gidecek',veren:actor,kural:'Diğer: Canlı kabul testi'}); assert.equal(first.kararDurumu, 'ikinci_gorus_bekliyor');
    const withdrawn = await api('kararGorusGeriAl', {numaralar:[bookNo],veren:actor}); assert.equal(withdrawn.kararDurumu, 'gorus_bekliyor');
    await api('kararVer', {numaralar:[bookNo],kategori:'gidecek',veren:actor,kural:'Diğer: Canlı kabul testi'});
    const final = await api('kararVer', {numaralar:[bookNo],kategori:'gidecek',veren:actor2,kural:'Diğer: Canlı kabul testi'}); assert.equal(final.kesinlesti, true);
    await api('kararGeriAl', {numaralar:[bookNo],veren:actor});

    const packed = await api('kutula', {numaralar:[bookNo],kutu:'9999',hedef:'yeni',paketleyen:actor}); assert.equal(packed.yazilan, 1);
    const catalog = await api('katalog', {kutu:packed.kutu,yalnizOnayli:false,adet:10}); assert.ok(catalog.kayitlar.some(k => k.no === bookNo && k.kutu === packed.kutu));
    boxId = (await must(rest('library_boxes','GET',`?select=id&code=eq.${packed.kutu}`), 'kutu bulma'))[0].id;
    await api('kutular');
    await api('rafDurum', {mekan:location,raf:'ZZ',sira:1});
    await api('sayac', {kaydeden:actor});
    await api('sonKayitlar', {kaydeden:actor});
    await api('siraOzeti');
    await api('siraBitir', {mekan:location,raf:'ZZ',sira:1,bitiren:actor,raftaki:1,not:'Canlı kabul testi'});
    await api('sil', {no:bookNo});

    console.log(JSON.stringify({ok:true,actions:timings.length,maxMs:Math.max(...timings.map(x=>x[1])),timings}, null, 2));
  } finally {
    if (bookId) {
      const book = (await rest('library_books','GET',`?select=cover_photo_path,imprint_photo_path&id=eq.${bookId}`))[0];
      if (book) { await removePhoto(book.cover_photo_path); await removePhoto(book.imprint_photo_path); }
      await rest('library_books','DELETE',`?id=eq.${bookId}`);
    }
    const shelves = await rest('library_shelf_positions','GET',`?select=id&code=eq.${shelfCode}`);
    if (shelves[0]) {
      const counts = await rest('library_shelf_counts','GET',`?select=photo_path&shelf_position_id=eq.${shelves[0].id}`);
      for (const count of counts) await removePhoto(count.photo_path);
      await rest('library_shelf_positions','DELETE',`?id=eq.${shelves[0].id}`);
    }
    await rest('library_locations','DELETE',`?code=eq.${location}`);
    if (boxId) await rest('library_boxes','DELETE',`?id=eq.${boxId}`);
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
