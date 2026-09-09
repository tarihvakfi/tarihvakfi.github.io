/* Yerel kabul testi. Canlı kayıtlara ve e-postaya dokunmaz. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.TV_TEST_URL || 'http://127.0.0.1:8766';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const calls = [];
  let shelfSuggestionAttempts = 0;
  let shelfReleaseAttempts = 0;
  let shelfSummaryAttempts = 0;
  page.on('pageerror', error => errors.push(error.message));

  const categories = {
    gidecek: { ad: 'Gidecek' }, belki: { ad: 'Gitse de olur' },
    gitmeyecek: { ad: 'Gitmeyecek' }, belirsiz: { ad: 'Belirsiz' }
  };
  const photoId = '1abcdefghijklmnopqrstuvwxyz123456';
  const books = Array.from({ length: 35 }, (_, index) => ({
    no: index + 1, yer: 'G-A01-' + String(index + 1).padStart(3, '0'),
    baslik: 'Kitap ' + (index + 1), yazar: 'Yazar ' + (index + 1), yil: '1980',
    nusha: 1, onay: 'evet', kategori: '', kapakId: index === 0 ? photoId : '',
    fotoId: index === 0 ? photoId : '', kararVeren: '', kararTarihi: ''
  }));

  const configSource = fs.readFileSync('js/gonullu-config.js', 'utf8').replace(
    /window\.TV_ENVANTER_URL\s*=\s*"[^"]+";/,
    'window.TV_ENVANTER_URL="https://mock.invalid/api";'
  );
  await context.route('**/js/gonullu-config.js*', route => route.fulfill({ contentType: 'application/javascript', body: configSource }));
  await context.route('https://drive.google.com/thumbnail**', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="100%" height="100%" fill="#ded6d8"/><text x="50%" y="50%" text-anchor="middle" font-size="34">Kitap</text></svg>'
  }));
  await context.route('**://mock.invalid/api**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === 'GET' ? Object.fromEntries(url.searchParams) : (request.postDataJSON() || {});
    calls.push({ action: body.action, method: request.method(), fresh: url.searchParams.has('tv_req') });
    if (body.action === 'siraOner' && ++shelfSuggestionAttempts === 1) {
      await route.abort('failed');
      return;
    }
    if (body.action === 'siraBirak' && ++shelfReleaseAttempts === 1) {
      await route.abort('failed');
      return;
    }
    let result;
    if (body.action !== 'config' && body.sifre !== 'test-only') {
      result = { ok: false, sifreHatasi: true, error: 'Şifre hatalı.' };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
      return;
    }
    switch (body.action) {
      case 'config':
        result = { ok:true, kategoriler:categories, kurallar:[], durumlar:['Sağlam'], mekanlar:[{kod:'G',ad:'Giriş Kat'}], rafHarfleri:['A'], siraSayisi:1 };
        break;
      case 'sayac': await new Promise(resolve => setTimeout(resolve, 1500)); result = { ok:true, benim:0 }; break;
      case 'siraOzeti':
        if (!request.frame().url().includes('kitap-envanteri.html') && ++shelfSummaryAttempts === 1) {
          await route.abort('failed');
          return;
        }
        result = request.frame().url().includes('kitap-envanteri.html')
          ? { ok:false, error:'Raf servisi geçici olarak yanıt vermedi.' }
          : { ok:true, siralar:[{sira:'G-A01',durum:'devam',kayitli:35,onSayim:35,sayim:{toplam:35,durum:'onaylandi'}}] };
        break;
      case 'siraOner': result = { ok:true, anahtar:'G-A01', tur:'sizin', zatenSizde:true, kalanBos:0, yarimKalan:0 }; break;
      case 'siraBirak': result = { ok:true, birakilan:['G-A01'] }; break;
      case 'siraHaritasi':
        result = { ok:false, error:'Raf servisi geçici olarak yanıt vermedi.' };
        break;
      case 'katalog': {
        const list = books.filter(book =>
          (!body.yalnizKararli || book.kategori) &&
          (!body.yalnizKararsiz || !book.kategori) &&
          (!body.sira || book.yer.startsWith(body.sira + '-')) &&
          (!body.kategori || book.kategori === body.kategori)
        );
        const start = Number(body.bas || 0), amount = Number(body.adet || 30);
        result = { ok:true, toplam:list.length, kayitlar:list.slice(start,start + amount) };
        break;
      }
      case 'durum':
        result = { ok:true, toplam:287, onayBekleyen:70, kunyeEksik:24, tamam:0,
          kararBekleyen:193, kategori:books.reduce((all,book) => { if (book.kategori) all[book.kategori]=(all[book.kategori]||0)+1; return all; },{}),
          siralar:[{sira:'G-A01',sayi:35}] };
        break;
      case 'kararVer': {
        const book = books.find(item => item.no === body.numaralar[0]);
        book.kategori = categories[body.kategori].ad; book.kararVeren = body.veren; book.kararTarihi = '9.09.2026 20:00';
        result = { ok:true, yazilan:[book.no], kategori:book.kategori };
        break;
      }
      case 'kararGeriAl': {
        const book = books.find(item => item.no === body.numaralar[0]); book.kategori = '';
        result = { ok:true, yazilan:[book.no] };
        break;
      }
      case 'rafFotograflari': result = { ok:true, fotograflar:[{id:photoId,kim:'Deneme',tarih:'9.09.2026'}] }; break;
      case 'sayimBilgisi': result = { ok:true, sayim:null }; break;
      default: result = { ok:true, kayitlar:[], siralar:[] };
    }
    await route.fulfill({ contentType:'application/json', body:JSON.stringify(result) });
  });

  await page.goto(base + '/koordinator.html');
  await page.locator('#ad').fill('Deneme Yetkilisi');
  await page.locator('#sifre').fill('wrong');
  await page.locator('#btnGiris').click();
  await page.getByText('Şifre hatalı.', { exact:true }).waitFor();
  assert.ok(await page.locator('#giris').isVisible());

  await page.locator('#sifre').fill('test-only');
  await page.locator('#btnGiris').click();
  await page.locator('#kararListe').getByText('Kitap 1', { exact:true }).waitFor();
  if (process.env.TV_TEST_SCREENSHOTS) await page.screenshot({ path:'/tmp/tv-koordinator-yeni.png', fullPage:true });
  assert.ok(await page.getByRole('button', { name:/Kitap Seçimi/ }).getAttribute('aria-current'));
  assert.equal(await page.locator('iframe').count(), 0);
  assert.ok(calls.every(call => call.fresh));
  assert.equal(calls.some(call => call.action === 'config'), false);

  await page.locator('.kitap-foto').first().click();
  await page.locator('.tv-foto-goruntuleyici.acik').waitFor();
  const before = await page.locator('.tv-foto-alan img').getAttribute('style');
  await page.getByRole('button', { name:'Büyüt', exact:true }).click();
  await page.getByRole('button', { name:'Sağa döndür', exact:true }).click();
  const after = await page.locator('.tv-foto-alan img').getAttribute('style');
  assert.notEqual(after, before);
  assert.match(after, /rotate\(90deg\)/);
  await page.getByRole('button', { name:'Kapat', exact:true }).click();

  await page.locator('.kitap-karti').first().getByRole('button', { name:'Gitsin' }).click();
  await page.waitForTimeout(900);
  assert.equal(books[0].kategori, 'Gidecek');
  const pendingIds = await page.locator('.kitap-karti').evaluateAll(nodes => nodes.map(node => node.dataset.no));
  const decisionMessage = await page.locator('.kart-mesaj').first().textContent();
  assert.ok(!pendingIds.includes('1'), 'Karar verilen kitap listede kaldı: ' + JSON.stringify(pendingIds.slice(0,5)) + ' · mesaj: ' + decisionMessage + ' · hatalar: ' + errors.join(' | '));
  assert.equal(calls.findLast(call => call.action === 'kararVer').method, 'POST');
  await page.getByRole('button', { name:'Verilmiş kararlar' }).click();
  await page.getByRole('button', { name:'Karar bekleyenlere geri al' }).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name:'Karar bekleyenlere geri al' }).click();
  await page.getByText('Kitap karar bekleyenlere geri alındı.', { exact:true }).waitFor();

  await page.getByRole('button', { name:/Raflar ve Kitaplar/ }).click();
  await page.getByText('Giriş Kat · A kitaplığı · 1. sıra', { exact:true }).waitFor();
  await page.getByText('Raf sayımları ve kitap kayıtları gösteriliyor.', { exact:false }).waitFor();
  assert.ok(await page.locator('#rafSayaclari').getByText('35', { exact:true }).count() >= 1);
  assert.equal(shelfSummaryAttempts, 2, 'Raf özeti ilk ağ hatasından sonra güvenli biçimde tekrarlanmadı');
  await page.getByRole('button', { name:'Raf fotoğrafları' }).click();
  await page.locator('#rafFotolar img').waitFor();
  const shelfPhoto = await page.locator('#rafFotolar img').evaluate(img => ({
    objectFit:getComputedStyle(img).objectFit,
    imageWidth:img.getBoundingClientRect().width,
    galleryWidth:img.closest('#rafFotolar').getBoundingClientRect().width
  }));
  assert.equal(shelfPhoto.objectFit, 'contain');
  assert.ok(shelfPhoto.imageWidth >= shelfPhoto.galleryWidth - 3, 'Raf fotoğrafı panel genişliğinde değil: ' + JSON.stringify(shelfPhoto));
  if (process.env.TV_TEST_SCREENSHOTS) {
    await page.locator('#rafFotolar').scrollIntoViewIfNeeded();
    await page.locator('.raf-detay').screenshot({ path:'/tmp/tv-raf-fotografi-tam.png' });
  }
  await page.locator('#rafFotolar button').click();
  await page.locator('.tv-foto-goruntuleyici.acik').waitFor();
  await page.getByRole('button', { name:'Kapat', exact:true }).click();

  await page.locator('#rafKitaplar .raf-kitap').first().click();
  await page.locator('#kitapDetay[open]').waitFor();
  await page.locator('#kitapDetay [data-tv-foto]').first().click();
  await page.locator('.tv-foto-goruntuleyici.acik').waitFor();
  assert.equal(await page.locator('#kitapDetay').evaluate(d => d.open), false, 'Kitap penceresi fotoğraf görüntüleyicinin altında açık kaldı');
  const viewerIsTopLayer = await page.evaluate(() => {
    const top=document.elementFromPoint(innerWidth/2,innerHeight/2);
    return !!(top && top.closest('.tv-foto-goruntuleyici.acik'));
  });
  assert.equal(viewerIsTopLayer, true, 'Fotoğraf görüntüleyici ekranın üst katmanında değil');
  if (process.env.TV_TEST_SCREENSHOTS) await page.screenshot({ path:'/tmp/tv-foto-ust-katman.png' });
  await page.getByRole('button', { name:'Kapat', exact:true }).click();
  await page.locator('#kitapDetay[open]').waitFor();
  await page.locator('#detayKapat').click();

  await page.getByRole('button', { name:/Genel Durum/ }).click();
  await page.locator('#genelSayaclar').getByText('Raflarda sayılan kitap', { exact:true }).waitFor();
  await page.locator('[data-yenile="durum"]').click();
  await page.getByText('287 toplam kayıt', { exact:false }).waitFor();
  await page.getByText('94 kitap bilgisi/kontrol aşamasında', { exact:false }).waitFor();
  await page.locator('#btnIletisimUst').click();
  await page.locator('#iletisimMesaj').fill('Deneme mesajıdır.');
  await page.locator('#btnIletisim').click();
  await page.getByText('Mesajınız gönderildi. Teşekkür ederiz.', { exact:true }).waitFor();
  assert.equal(calls.findLast(call => call.action === 'iletisimGonder').method, 'POST');
  assert.equal(errors.length, 0, errors.join('\n'));

  await page.setViewportSize({ width:2728, height:1200 });
  await page.getByRole('button', { name:/Kitap Seçimi/ }).click();
  await page.getByRole('button', { name:'Karar bekleyenler' }).click();
  await page.locator('#kararListe').getByText('Kitap 1', { exact:true }).waitFor();
  const desktopPhoto = await page.locator('.kitap-foto img').first().evaluate(img => ({
    objectFit:getComputedStyle(img).objectFit,
    width:img.getBoundingClientRect().width,
    height:img.getBoundingClientRect().height
  }));
  assert.equal(desktopPhoto.objectFit, 'contain');
  assert.ok(desktopPhoto.width > 150 && desktopPhoto.height > 280, 'Geniş ekran fotoğraf alanı çok küçük: ' + JSON.stringify(desktopPhoto));
  const nestedDesktopScrollers = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
    const s=getComputedStyle(el), r=el.getBoundingClientRect();
    return r.height > 300 && el.scrollHeight > el.clientHeight + 3 && /auto|scroll/.test(s.overflowY) && !el.matches('dialog,textarea');
  }).map(el => el.id || el.className));
  assert.deepEqual(nestedDesktopScrollers, [], 'İç içe dikey kaydırma alanı var: ' + JSON.stringify(nestedDesktopScrollers));

  await page.setViewportSize({ width:390, height:844 });
  await page.getByRole('button', { name:/Kitap Seçimi/ }).click();
  await page.getByRole('button', { name:'Karar bekleyenler' }).click();
  await page.locator('#kararListe').getByText('Kitap 1', { exact:true }).waitFor();
  await page.waitForTimeout(100);
  if (process.env.TV_TEST_SCREENSHOTS) await page.screenshot({ path:'/tmp/tv-koordinator-yeni-mobil.png', fullPage:true });
  const width = await page.evaluate(() => ({ scroll:document.documentElement.scrollWidth, inner:window.innerWidth }));
  assert.ok(width.scroll <= width.inner + 1, 'Koordinatör sayfasında yatay taşma var: ' + JSON.stringify(width));
  await page.getByRole('button', { name:/Raflar ve Kitaplar/ }).click();
  const shelfWidth = await page.evaluate(() => ({ scroll:document.documentElement.scrollWidth, inner:window.innerWidth }));
  assert.ok(shelfWidth.scroll <= shelfWidth.inner + 1, 'Mobil raf sayfasında yatay taşma var: ' + JSON.stringify(shelfWidth));

  await page.goto(base + '/kitap-envanteri.html');
  await page.locator('#ad').fill('Deneme Gönüllüsü');
  await page.locator('#sifre').fill('test-only');
  await page.locator('#btnGiris').click();
  await page.locator('#adim-raf:not(.gizli)').waitFor({ timeout:800 });
  if (process.env.TV_TEST_SCREENSHOTS) await page.screenshot({ path:'/tmp/tv-gonullu-yeni-mobil.png', fullPage:true });
  assert.ok(await page.getByRole('button', { name:/1 · Rafı say/ }).isVisible());
  assert.ok(await page.getByRole('button', { name:/2 · Kitapları kaydet/ }).isVisible());
  await page.getByText('Raf bulma ve çalışma durumu', { exact:true }).click();
  await page.getByRole('button', { name:'Çalışacağım rafı sistem seçsin' }).click();
  await page.getByText('zaten sizin üzerinizde.', { exact:false }).waitFor();
  assert.equal(shelfSuggestionAttempts, 2, 'Raf önerisi ilk ağ hatasından sonra güvenli biçimde tekrarlanmadı');
  await page.getByRole('button', { name:'Üzerimdeki sıraları bırak' }).click();
  await page.getByText('G-A01 bırakıldı.', { exact:false }).waitFor();
  assert.equal(shelfReleaseAttempts, 2, 'Raf bırakma ilk ağ hatasından sonra güvenli biçimde tekrarlanmadı');
  await page.getByRole('button', { name:'Rafların durumunu gör' }).click();
  await page.locator('#haritaPanel:not(.gizli)').waitFor();
  await page.getByText('Raf servisi geçici olarak yanıt vermedi.', { exact:true }).waitFor();
  await page.getByText('Soru / düzeltme / öneri gönder', { exact:true }).click();
  await page.locator('#iletisimMesaj').fill('Gönüllü deneme mesajıdır.');
  await page.locator('#btnIletisimGonder').click();
  await page.getByText(/Mesajınız (alındı|gönderildi)/).waitFor();
  const volunteerWidth = await page.evaluate(() => ({ scroll:document.documentElement.scrollWidth, inner:window.innerWidth }));
  assert.ok(volunteerWidth.scroll <= volunteerWidth.inner + 1, 'Gönüllü sayfasında yatay taşma var: ' + JSON.stringify(volunteerWidth));
  assert.equal(errors.length, 0, errors.join('\n'));

  /* Eski bakım araçları ana akışta görünmese de eldeki bağlantılar 404 vermemeli
     ve koordinatör oturumuyla doğrudan açılabilmeli. */
  for (const legacyPage of ['kunye-onay.html?oto=1','envanter-katalog.html?oto=1','envanter-durum.html?oto=1','karar.html?oto=1']) {
    const beforeErrors = errors.length;
    const response = await page.goto(base + '/' + legacyPage);
    assert.equal(response.status(), 200, legacyPage + ' açılmadı');
    await page.waitForTimeout(700);
    assert.equal(errors.length, beforeErrors, legacyPage + ' JavaScript hatası: ' + errors.slice(beforeErrors).join('\n'));
    assert.ok(!(await page.locator('body').innerText()).includes('Aradığınız sayfa bulunamadı'), legacyPage + ' 404 sayfasına düştü');
  }

  console.log('PASS: koordinatör, gönüllü, bakım sayfaları, karar akışı, raflar, fotoğraf üst katmanı ve mobil/geniş ekran görünümü.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
