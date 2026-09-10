/* Karar görüşü kurallarını Google E-Tabloya dokunmadan sınar. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = {
  console,
  Utilities: { formatDate: () => '10.08.2026 10:00' },
  Session: { getScriptTimeZone: () => 'Europe/Istanbul' }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/KitapEnvanteri.gs', 'utf8'), context);

function row(opinions, category = 'Sınıflandırılmadı') {
  const result = Array(33).fill('');
  result[10] = category;
  result[24] = 'Künye onaylı';
  result[32] = JSON.stringify(opinions);
  return result;
}

const now = new Date('2026-09-10T12:00:00Z');
let status = context.kararDurumuSatirdan_(row([
  { k:'gidecek', v:'A Kişisi', t:'2026-08-10T10:00:00Z' }
]), now);
assert.equal(status.kesin, true);
assert.equal(status.durum, 'tek_gorusle_gecerli');
assert.equal(status.kategori, 'Gidecek');

status = context.kararDurumuSatirdan_(row([
  { k:'gidecek', v:'A Kişisi', t:'2026-09-01T10:00:00Z' }
]), now);
assert.equal(status.kesin, false);
assert.equal(status.durum, 'ikinci_gorus_bekliyor');

status = context.kararDurumuSatirdan_(row([
  { k:'gidecek', v:'A Kişisi', t:'2026-09-01T10:00:00Z' },
  { k:'gitmeyecek', v:'B Kişisi', t:'2026-09-02T10:00:00Z' }
]), now);
assert.equal(status.kesin, false);
assert.equal(status.durum, 'gorus_ayriligi');

status = context.kararDurumuSatirdan_(row([
  { k:'gidecek', v:'A Kişisi', t:'2026-09-01T10:00:00Z' },
  { k:'gidecek', v:'B Kişisi', t:'2026-09-02T10:00:00Z' }
]), now);
assert.equal(status.kesin, true);
assert.equal(status.kategori, 'Gidecek');

const deduplicated = context.kararGorusleriOku_(JSON.stringify([
  { k:'gidecek', v:'A Kişisi', t:'1' },
  { k:'gitmeyecek', v:' a  kişisi ', t:'2' }
]));
assert.equal(deduplicated.length, 1);
assert.equal(deduplicated[0].kategori, 'gitmeyecek');

const removed = context.kararGorusuKaldir_([
  { kategori:'gidecek', veren:'A Kişisi' },
  { kategori:'gitmeyecek', veren:'B Kişisi' }
], ' a  kişisi ');
assert.equal(removed.kaldirilan.kategori, 'gidecek');
assert.equal(removed.kalan.length, 1);
assert.equal(removed.kalan[0].veren, 'B Kişisi');

console.log('PASS: 30 gün, ikinci görüş, görüş ayrılığı, uzlaşma, aynı kişi ve görüş geri alma denetimi.');
