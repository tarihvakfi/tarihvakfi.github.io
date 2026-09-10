#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const sourceUrl = process.env.SOURCE_APPS_SCRIPT_URL || '';
const sourcePassword = process.env.SOURCE_COORDINATOR_PASSWORD || '';
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const apply = process.env.APPLY === '1';

function required(value, name) {
  if (!value) throw new Error(`${name} tanımlı değil.`);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function sha256(value) {
  return createHash('sha256').update(String(value).trim(), 'utf8').digest('hex');
}

async function sourceRequest(action, payload = {}) {
  const safe = { action, ...payload };
  const endpoint = new URL(sourceUrl);
  endpoint.searchParams.set('tv_json', JSON.stringify(safe));
  endpoint.searchParams.set('sifreOzeti', sha256(sourcePassword));
  endpoint.searchParams.set('tv_req', `${Date.now()}_${Math.random().toString(36).slice(2)}`);

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(endpoint, { redirect: 'follow', signal: controller.signal });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error('Kaynak sunucu JSON yerine web sayfası döndürdü.'); }
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 1500);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${action} alınamadı: ${lastError?.message || 'bilinmeyen hata'}`);
}

async function readSource() {
  const books = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await sourceRequest('katalog', {
      yalnizOnayli: false, sirala: 'yer', bas: offset, adet: 300
    });
    total = Number(page.toplam || 0);
    books.push(...(page.kayitlar || []));
    offset += (page.kayitlar || []).length;
    if (!(page.kayitlar || []).length) break;
  }
  const shelfMap = await sourceRequest('siraHaritasi');
  return { exportedAt: new Date().toISOString(), books, shelves: shelfMap.siralar || [] };
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function publicationYear(value) {
  const year = numberOrNull(value);
  return year != null && year >= 1000 && year <= 2200 ? Math.trunc(year) : null;
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(text);
  if (tr) {
    const [, day, month, year, hour = '12', minute = '00'] = tr;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00+03:00`).toISOString();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function decisionChoice(value) {
  const key = String(value || '').trim().toLocaleLowerCase('tr');
  return ({
    'gidecek': 'go', 'gitsin': 'go',
    'gitse de olur': 'may_go', 'belki': 'may_go',
    'gitmeyecek': 'stay', 'gitmesin': 'stay',
    'belirsiz': 'uncertain'
  })[key] || null;
}

function bookCondition(value) {
  const key = String(value || '').trim().toLocaleLowerCase('tr');
  if (key.includes('küf') || key.includes('böcek')) return 'mold_or_pest';
  if (key.includes('yıpran')) return 'worn';
  return 'good';
}

function shelfCountStatus(value) {
  return ({ sayildi: 'counted', onaylandi: 'approved', sayilamadi: 'could_not_count' })[String(value || '')] || 'counted';
}

function placement(book) {
  const placeCode = cleanText(book.yer) || `ESKI-${book.no}`;
  const match = /^([^-]+-[A-ZÇĞİÖŞÜ]+\d{2})-(\d+)$/.exec(placeCode.toLocaleUpperCase('tr'));
  return match ? { placeCode, shelfCode: match[1], position: Number(match[2]) } : null;
}

function normalize(source) {
  const warnings = [];
  const books = [];
  const opinions = [];
  const resolutions = [];
  const boxes = new Set();
  const seenPlaces = new Set();

  for (const old of source.books) {
    const place = placement(old);
    if (!place) { warnings.push(`Yer kodu çözülemedi: kayıt ${old.no} (${old.yer || 'boş'})`); continue; }
    if (seenPlaces.has(place.placeCode)) { warnings.push(`Yinelenen yer kodu: ${place.placeCode}`); continue; }
    seenPlaces.add(place.placeCode);
    const boxCode = cleanText(old.kutu);
    if (boxCode) boxes.add(boxCode);
    const approved = Boolean(cleanText(old.onay));
    books.push({
      legacy_no: Number(old.no), shelf_code: place.shelfCode,
      position_number: place.position, place_code: place.placeCode,
      author: cleanText(old.yazar), title: cleanText(old.baslik),
      publication_year: publicationYear(old.yil),
      copies: Math.min(100, Math.max(1, Math.trunc(numberOrNull(old.nusha) || 1))),
      condition: bookCondition(old.durum), note: cleanText(old.not),
      recorded_by_name: cleanText(old.kaydeden), legacy_imprint_url: cleanText(old.foto),
      legacy_cover_url: cleanText(old.kapak), bibliography_approved_at: approved ? source.exportedAt : null,
      bibliography_approved_by_name: approved ? 'Eski sistem' : null,
      requested_reason: cleanText(old.istenen), box_code: boxCode
    });

    for (const opinion of Array.isArray(old.kararGorusleri) ? old.kararGorusleri : []) {
      const choice = decisionChoice(opinion.kategori || opinion.k || opinion.kategoriAdi);
      const voterName = cleanText(opinion.veren || opinion.v);
      if (!choice || !voterName) continue;
      const date = parseDate(opinion.tarih || opinion.t) || source.exportedAt;
      opinions.push({ legacy_no: Number(old.no), voter_name: voterName, choice, created_at: date, updated_at: date });
    }

    const finalChoice = decisionChoice(old.kategori);
    if (finalChoice && !['ikinci_gorus_bekliyor', 'gorus_ayriligi', 'gorus_bekliyor'].includes(old.kararDurumu)) {
      const names = cleanText(old.kararVeren)?.split('+').map(name => name.trim()).filter(Boolean) || ['Eski sistem'];
      const kind = old.kararDurumu === 'tek_gorusle_gecerli'
        ? 'single_after_30_days'
        : (opinions.filter(item => item.legacy_no === Number(old.no)).length >= 2 ? 'consensus' : 'legacy');
      resolutions.push({ legacy_no: Number(old.no), choice: finalChoice, kind,
        decided_at: parseDate(old.kararTarihi) || source.exportedAt,
        decided_by_names: names, legacy_rule: [old.kural, old.kararGecmisi].filter(Boolean).join('\n') || null });
    }
  }

  const shelfCounts = source.shelves.filter(row => row.sayim && (row.sayim.toplam != null || row.sayim.durum)).map(row => ({
    shelf_code: row.sira,
    kind: row.sayim.ikinciSayim != null ? 'control' : 'initial',
    status: shelfCountStatus(row.sayim.durum),
    layout: row.sayim.duzen === 'iki' ? 'double' : 'single',
    front_count: numberOrNull(row.sayim.onSira) ?? numberOrNull(row.sayim.toplam),
    back_count: numberOrNull(row.sayim.arkaSira),
    back_unavailable: row.sayim.arkaDurum === 'sayilamadi',
    note: cleanText(row.sayim.not), legacy_photo_url: cleanText(row.sayim.foto || row.sayimFoto),
    counted_by_name: cleanText(row.sayim.sayan || row.sayan),
    counted_at: parseDate(row.sayim.sayimTarihi) || source.exportedAt,
    approved_by_name: cleanText(row.sayim.onaylayan),
    approved_at: parseDate(row.sayim.onayTarihi), legacy_source_key: `apps-script:${row.sira}:current`
  }));

  return { ...source, books, opinions, resolutions, boxes: [...boxes].map(code => ({ code, destination: 'storage' })), shelfCounts, warnings };
}

async function rest(path, { method = 'GET', body, prefer, range } = {}) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  if (range) headers.Range = range;
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function chunks(items, size, action) {
  for (let offset = 0; offset < items.length; offset += size) {
    await action(items.slice(offset, offset + size));
  }
}

async function upsert(table, rows, conflict) {
  if (!rows.length) return;
  await chunks(rows, 100, chunk => rest(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST', body: chunk, prefer: 'resolution=merge-duplicates,return=minimal'
  }));
}

async function applyToSupabase(data) {
  required(supabaseUrl, 'SUPABASE_URL');
  required(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY');
  const shelves = await rest('library_shelf_positions?select=id,code&limit=1000');
  const shelfIds = new Map(shelves.map(row => [row.code, row.id]));
  const missingShelves = [...new Set(data.books.map(row => row.shelf_code).filter(code => !shelfIds.has(code)))];
  if (missingShelves.length) throw new Error(`Supabase rafları eksik: ${missingShelves.join(', ')}`);

  await upsert('library_boxes', data.boxes, 'code');
  const boxRows = await rest('library_boxes?select=id,code&limit=1000');
  const boxIds = new Map(boxRows.map(row => [row.code, row.id]));

  await upsert('library_books', data.books.map(({ shelf_code, box_code, ...row }) => ({
    ...row, shelf_position_id: shelfIds.get(shelf_code), box_id: box_code ? boxIds.get(box_code) : null
  })), 'legacy_no');
  const bookRows = await rest('library_books?select=id,legacy_no&limit=1000');
  const bookIds = new Map(bookRows.map(row => [Number(row.legacy_no), row.id]));

  // Kesim anına kadar eski sistem yetkilidir. İlk kopyadan sonra orada silinen
  // bir kayıt Supabase'te canlı görünmesin; Supabase'te doğmuş kayıtlara ise
  // (legacy_no boş) dokunulmaz.
  const sourceBookNos = new Set(data.books.map(row => Number(row.legacy_no)));
  const removedLegacyIds = bookRows
    .filter(row => row.legacy_no != null && !sourceBookNos.has(Number(row.legacy_no)))
    .map(row => row.id);
  if (removedLegacyIds.length) {
    await chunks(removedLegacyIds, 100, ids => rest(
      `library_books?id=in.(${ids.join(',')})`,
      { method: 'PATCH', body: { deleted_at: new Date().toISOString() }, prefer: 'return=minimal' }
    ));
  }

  // Görüş/sayım geri alma işlemleri de aynen yansısın. Upsert tek başına
  // kaynaktan silinmiş satırı hedefte bıraktığı için eski sistemden gelmiş
  // satırlar son kopyada temizlenip yeniden kurulur.
  await rest('library_decision_opinions?id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await rest('library_decision_resolutions?book_id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await rest('library_shelf_counts?legacy_source_key=like.apps-script:*', { method: 'DELETE', prefer: 'return=minimal' });

  await upsert('library_shelf_counts', data.shelfCounts.map(({ shelf_code, ...row }) => ({
    ...row, shelf_position_id: shelfIds.get(shelf_code)
  })), 'legacy_source_key');
  await upsert('library_decision_opinions', data.opinions.map(({ legacy_no, ...row }) => ({
    ...row, book_id: bookIds.get(legacy_no)
  })), 'book_id,voter_key');
  await upsert('library_decision_resolutions', data.resolutions.map(({ legacy_no, ...row }) => ({
    ...row, book_id: bookIds.get(legacy_no)
  })), 'book_id');

  const checks = await Promise.all([
    rest('library_books?select=id', { range: '0-0', prefer: 'count=exact' }),
    rest('library_shelf_counts?select=id', { range: '0-0', prefer: 'count=exact' }),
    rest('library_decision_opinions?select=id', { range: '0-0', prefer: 'count=exact' }),
    rest('library_decision_resolutions?select=book_id', { range: '0-0', prefer: 'count=exact' })
  ]);
  return checks;
}

async function main() {
  required(sourceUrl, 'SOURCE_APPS_SCRIPT_URL');
  required(sourcePassword, 'SOURCE_COORDINATOR_PASSWORD');
  const source = await readSource();
  const data = normalize(source);
  await mkdir('.migration', { recursive: true });
  await writeFile('.migration/library-export.json', JSON.stringify(data, null, 2));
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run', sourceBooks: source.books.length,
    importableBooks: data.books.length, physicalCopies: data.books.reduce((sum, row) => sum + row.copies, 0),
    countedShelves: data.shelfCounts.length, opinions: data.opinions.length,
    finalDecisions: data.resolutions.length, boxes: data.boxes.length, warnings: data.warnings
  }, null, 2));
  if (!apply) return;
  await applyToSupabase(data);
  console.log('Supabase aktarımı tamamlandı.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
