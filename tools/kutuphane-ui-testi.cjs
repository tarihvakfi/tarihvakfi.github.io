/* Yerel kabul testi. Canlı kayıtlara ve e-postaya dokunmaz. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.TV_TEST_URL || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const calls = [];
  page.on('pageerror', error => errors.push(error.message));

  const categories = {
    gidecek: { ad: 'Gidecek' }, belki: { ad: 'Gitse de olur' },
    gitmeyecek: { ad: 'Gitmeyecek' }, belirsiz: { ad: 'Belirsiz' }
  };
  const books = Array.from({ length: 35 }, (_, index) => ({
    no: index + 1, yer: 'G-A01-' + String(index + 1).padStart(3, '0'),
    baslik: 'Kitap ' + (index + 1), yazar: 'Yazar', yil: '1980',
    nusha: 1, onay: 'evet', kategori: ''
  }));

  const configSource = fs.readFileSync('js/gonullu-config.js', 'utf8').replace(
    /window\.TV_ENVANTER_URL\s*=\s*"[^"]+";/,
    'window.TV_ENVANTER_URL="https://mock.invalid/api";'
  );
  await context.route('**/js/gonullu-config.js*', route => route.fulfill({
    contentType: 'application/javascript', body: configSource
  }));
  await context.route('**://mock.invalid/api**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === 'GET'
      ? { action: url.searchParams.get('action') }
      : (request.postDataJSON() || {});
    calls.push({ action: body.action, method: request.method(), fresh: url.searchParams.has('tv_req') });
    let result;
    if (body.action !== 'config' && body.sifre !== 'test-only') {
      result = { ok: false, sifreHatasi: true, error: 'Şifre hatalı.' };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
      return;
    }
    switch (body.action) {
      case 'config':
        result = { ok: true, kategoriler: categories, kurallar: [], durumlar: ['Sağlam'], mekanlar: [{ kod: 'G', ad: 'Giriş katı' }], rafHarfleri: ['A'], siraSayisi: 1 };
        break;
      case 'sayac': result = { ok: true, benim: 0 }; break;
      case 'siraHaritasi':
        result = { ok: true, siralar: [{ sira: 'G-A01', kayitSayisi: 35, kayitli: 35, kararVerilen: books.filter(book => book.kategori).length, onSayim: 35, sayim: { toplam: 35, durum: 'onaylandi' } }] };
        break;
      case 'katalog': {
        let list = books.filter(book =>
          (!body.yalnizKararli || book.kategori) &&
          (!body.yalnizKararsiz || !book.kategori) &&
          (!body.sira || book.yer.startsWith(body.sira + '-'))
        );
        result = { ok: true, toplam: list.length, kayitlar: list.slice(body.bas || 0, (body.bas || 0) + (body.adet || 30)) };
        break;
      }
      case 'durum':
        result = { ok: true, toplam: 35, kararBekleyen: books.filter(book => !book.kategori).length, kategori: books.reduce((all, book) => { if (book.kategori) all[book.kategori] = (all[book.kategori] || 0) + 1; return all; }, {}) };
        break;
      case 'kararVer': {
        const book = books.find(item => item.no === body.numaralar[0]);
        book.kategori = categories[body.kategori].ad;
        result = { ok: true, yazilan: [book.no], kategori: book.kategori };
        break;
      }
      case 'kararGeriAl': {
        const book = books.find(item => item.no === body.numaralar[0]);
        book.kategori = '';
        result = { ok: true, yazilan: [book.no] };
        break;
      }
      case 'kutular': result = { ok: true, siralar: [], kutular: [] }; break;
      case 'onayBekleyen': result = { ok: true, kayitlar: [], kalan: 0 }; break;
      case 'rafFotograflari': result = { ok: true, fotograflar: [] }; break;
      default: result = { ok: true, kayitlar: [], siralar: [] };
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });

  await page.goto(base + '/koordinator.html');
  await page.locator('#ad').fill('Deneme Yetkilisi');
  await page.locator('#sifre').fill('wrong');
  await page.locator('#btnGiris').click();
  await page.getByText('Şifre hatalı.', { exact: true }).waitFor();
  assert.ok(await page.locator('#giris').isVisible());
  await page.locator('#sifre').fill('test-only');
  await page.locator('#btnGiris').click();
  await page.getByText('Kitap 1', { exact: true }).waitFor();
  assert.ok(calls.some(call => call.action === 'siraHaritasi'));
  assert.ok(calls.every(call => call.fresh));
  assert.equal(calls.some(call => call.action === 'config'), false);

  await page.getByRole('button', { name: 'Kitap Seçimi' }).click();
  const frame = page.frameLocator('#kararCerceve');
  await frame.getByText('Kitap 1', { exact: true }).waitFor();
  await page.waitForTimeout(100);
  assert.equal(await frame.locator('html').evaluate(element => getComputedStyle(element).overflow), 'hidden');
  assert.equal(await page.locator('#kararCerceve').getAttribute('scrolling'), 'no');
  assert.ok(await page.locator('#kararCerceve').evaluate(element => element.offsetHeight > 700));
  await frame.locator('.uye').first().getByRole('button', { name: 'Gitsin' }).click();
  await frame.getByText('Gitsin ✓', { exact: true }).waitFor();
  assert.equal(calls.findLast(call => call.action === 'kararVer').method, 'POST');
  await frame.getByRole('button', { name: 'Verilmiş kararlar' }).click();
  await frame.getByRole('button', { name: 'Karar bekleyenlere geri al' }).waitFor();
  page.on('dialog', dialog => dialog.accept());
  await frame.getByRole('button', { name: 'Karar bekleyenlere geri al' }).click();
  await frame.getByText('Karar kaldırıldı; kitap karar bekleyenlere döndü.', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Raflar ve Kitaplar' }).click();
  await page.locator('.ekip summary').click();
  for (const label of [
    'Fotoğraftan kitap bilgisini kontrol et',
    'Kaydı bul ve düzelt',
    'Sayım uyuşmazlıklarını incele'
  ]) {
    const [toolPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: label }).click()
    ]);
    await toolPage.locator('.paneleDon').waitFor();
    await toolPage.locator('#oturumAciliyor').waitFor({ state: 'hidden' });
    await toolPage.close();
  }

  await page.goto(base + '/kitap-envanteri.html');
  await page.locator('#ad').fill('Deneme Gönüllüsü');
  await page.locator('#sifre').fill('test-only');
  await page.locator('#btnGiris').click();
  await page.locator('#adim-raf:not(.gizli)').waitFor();
  assert.ok(calls.some(call => call.action === 'sayac'));
  assert.deepEqual(errors, []);

  console.log('PASS: hızlı giriş, taze sunucu isteği, araç bağlantıları ve tek kaydırma.');
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
