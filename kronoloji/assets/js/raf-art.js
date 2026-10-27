/* Tarih Vakfı Dijital Kronolojisi: shared record drawings and data cleanup.
   Used by every page; exposes window.TVKArt. */
(function(){
'use strict';
const KINDS = ['event','publication','project','organizational','other'];
const KL = {event:'Etkinlik',publication:'Yayın',project:'Proje',organizational:'Kurumsal',other:'Diğer'};
const ST = ['verified','uncertain_date','needs_review','uncertain_category','other'];
const STL = {verified:'Kaynaklarla doğrulandı',uncertain_date:'Tarihi henüz kesinleşmedi',needs_review:'Editör incelemesi bekliyor',uncertain_category:'Türü henüz kesinleşmedi',other:'Durum bilgisi yok'};
const ASK = {uncertain_date:'Bu etkinliğin ya da yayının tam tarihini biliyor musunuz?',needs_review:'Bu kayıtla ilgili bildiğiniz bir ayrıntı var mı?',uncertain_category:'Bu kaydın ne tür bir çalışma olduğunu biliyor musunuz?',other:'Bu kayıtla ilgili bildiğiniz bir ayrıntı var mı?'};
const CONTRIB = 'contribute.html';
const itemUrl = r => new URL('item.html?id=' + encodeURIComponent(r.id), location.href).href;
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const SERIES = {'Toplumsal Tarih':'Toplumsal Tarih','İstanbul dergisi':'İstanbul Dergisi','New Perspectives on Turkey':'NPT','Toplumsal Tarih Akademi':'Toplumsal Tarih Akademi','Dergiler':'Dergi','Dergi (Toplumsal Tarih)':'Toplumsal Tarih','İstanbul Dergisi':'İstanbul Dergisi','Dergi (NPT)':'NPT','Dergi (Yerel Tarih)':'Yerel Tarih'};
const FAMS = [
  {id:'konusma', name:'Konferanslar, paneller, seminerler', cats:['Konferans/Söyleşi','Panel','Seminer','Kurs/Seminer','Sempozyum','Kongre','Atölye']},
  {id:'yayin', name:'Kitaplar ve yayınlar', cats:['Yayın (Vakıf)','Yayın (Yurt Yayınları)','Bülten','Broşür','Katalog/Broşür','CD/Dijital Yayın','Ansiklopedi','Çağdaşkart'], kind:'publication'},
  {id:'dergi', name:'Dergiler', cats:Object.keys(SERIES), series:true},
  {id:'kultur', name:'Sergiler, geziler ve gösteriler', cats:['Sergi','Gezi','Konser','Dans','Gösteri','Belgesel','Sinema','Tiyatro/Performans','Festival/Şenlik','Fuar','Anma','Diğer Etkinlik'], kind:'event'},
  {id:'proje', name:'Projeler ve araştırmalar', cats:['Proje','Proje (Diğer)','Proje (Kurum Tarihi)','Proje (Kurum Arşivi)','Proje (Sözlü Tarih)','Yarışma','Web/Dijital','Anket/Araştırma','Ödül/Ödül Töreni'], kind:'project'},
  {id:'kurum', name:'Vakfın içinden', cats:['İç Toplantı','Resmi Toplantı','Basın Açıklaması','Basın Toplantısı'], kind:'organizational'},
  {id:'bbm', name:'Arşive ve kütüphaneye bağışlar', cats:['Arşiv Bağışı','Kitap bağışı','Arşiv bağışı']},
  {id:'diger', name:'Diğer kayıtlar', cats:[]}
];
const ERAS = [[1,'1. Dönem',1990,1995],[2,'2. Dönem',1996,2000],[3,'3. Dönem',2001,2005],[4,'4. Dönem',2006,2010],[5,'5. Dönem',2011,2015],[6,'6. Dönem',2016,2020],[7,'7. Dönem',2021,2026]];
const eraOf = y => ERAS.find(e => y >= e[2] && y <= e[3]) || ERAS[ERAS.length-1];
const catFam = {}; FAMS.forEach(f => f.cats.forEach(c => catFam[c] = f.id));
const kindFam = {}; FAMS.forEach(f => { if (f.kind) kindFam[f.kind] = f.id; });

const foldChar = c => { let l = c.toLocaleLowerCase('tr'); if (l.length !== 1) l = l[0]; if (l === 'ı') return 'i'; return l.normalize('NFD')[0]; };
const fold = s => s.split('').map(foldChar).join('');
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n.toLocaleString('tr-TR');
const STOP = new Set(fold('ve ile için bir olarak tarih vakfı vakfının vakfı’nın konferansı konferans paneli panel söyleşi söyleşisi semineri seminer toplantısı toplantı sergisi sergi yayını kitap kitabı sayısı sayı dergisi dergi projesi proje istanbul türkiye üzerine hakkında yılı ilk olan gibi atölyesi atölye sempozyumu moderatör konuşması').split(' '));

const fixLabel = l => { const m = l.match(/^(\d{4})[-–](\d\d)[-–](\d\d)(\s+\d\d:\d\d(:\d\d)?)?$/); return m ? `${+m[3]} ${MONTHS[+m[2]-1]} ${m[1]}` : l; };
const CODE_FAM = {KON:'konusma',PAN:'konusma',ATL:'konusma',ATL_YTT:'konusma',ATL_STT:'konusma',SMN:'konusma',SEM:'konusma',SEM_STK:'konusma','İKO':'konusma',YTT:'konusma',STT:'konusma','ÖTT':'konusma','İÇ':'kurum',
  TT:'dergi','İST':'dergi',NPT:'dergi',TTA:'dergi',DER:'dergi',
  YYA:'yayin',TVY:'yayin',ANS:'yayin','BÜL':'yayin',TVH:'yayin',TVHB:'yayin',THV:'yayin','DŞE':'yayin',YTB:'yayin','TÇE':'yayin',BRO:'yayin','ÖTY':'yayin',RAP:'yayin',
  BEL:'kultur',SER:'kultur',GEZ:'kultur',KNS:'kultur','SİN':'kultur','ÖTG':'kultur',FES:'kultur',ANM:'kultur','ÖTF':'kultur',
  YAR:'proje',YER:'proje',KUT:'proje',KNT:'proje',TEP:'proje',MZP:'proje','ÖTP':'proje',
  ARB:'bbm','KİB':'bbm','ÖTB':'bbm'};
const IMG_DIR = 'assets/img/kayitlar/';
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
/* editors' internal notes and short codes are not public categories */
const publicCategory = c => { c = clean(c).replace(/^D_\s*/, ''); return (!c || c.length > 40 || /[?*]/.test(c) || !/^[A-ZÇĞİÖŞÜ]/.test(c)) ? '' : c; };
const isSecret = t => /^\[?\s*gizli bilgi/i.test(t);
function splitNote(t){
  if (t.length < 100 || !t.endsWith(')')) return [t, ''];
  let depth = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ')') depth++;
    else if (t[i] === '(' && --depth === 0) {
      const head = t.slice(0, i).trim().replace(/[\s\-–]+$/, ''), tail = t.slice(i + 1, -1).trim();
      const q = (head.match(/"/g) || []).length;
      return (head.length >= 15 && tail.length >= 40 && q % 2 === 0 && (head.match(/“/g)||[]).length === (head.match(/”/g)||[]).length) ? [head, tail] : [t, ''];
    }
  }
  return [t, ''];
}
function dateLabel(row, year){
  let l = fixLabel(clean(row.date_display));
  if (/\d\s*-\s*\d/.test(l)) l = l.replace(/\s*-\s*/g, '–');
  if (!l) l = String(year);
  else if (!/\b(19|20)\d\d\b/.test(l)) l += ' ' + year;
  return l;
}
function imagePath(v){ v = clean(v); if (!v) return ''; return /^(https?:)?\/\//.test(v) || v.startsWith('/') || v.startsWith('assets/') ? v : IMG_DIR + v; }
function normalizeRow(row){
  const year = parseInt(row.year, 10);
  let title = clean(row.description || row.title || row.raw_text);
  if (!year || !title || isSecret(title)) return null;
  const [t, note] = splitNote(title);
  const code = clean(row.activity_code_base || String(row.activity_code || '').split('_')[0]).toLocaleUpperCase('tr-TR');
  const full = clean(row.activity_code).toLocaleUpperCase('tr-TR');
  const cat = publicCategory(row.activity_label || row.category);
  const kind = KINDS.includes(row.item_kind) ? row.item_kind : 'other';
  const status = ST.includes(row.verification_status) ? row.verification_status : 'other';
  const iso = /^\d{4}-\d\d-\d\d$/.test(clean(row.start_date)) ? clean(row.start_date) : '';
  return {id: clean(row.id), year, label: dateLabel(row, year), iso, title: t, cats: cat ? [cat] : [], kind, status, note,
    code: CODE_FAM[full] ? full : code, group: clean(row.activity_group), img: imagePath(row.gorsel || row.image), credit: clean(row.gorsel_kaynak || row.image_credit)};
}
/* what a record is drawn as: the activity code, checked against its activity
   group (the group wins when they disagree, e.g. a meeting filed under ÖTY) */
const GROUP_FAM = {'Toplantılar':'konusma','Yayınlar':'yayin','Toplantı ve yayın dışı etkinlikler':'kultur','Projeler':'proje','BBM':'bbm','Bilgi-Belge Merkezi':'bbm'};
const FAM_GROUP = {konusma:'konusma',kurum:'konusma',dergi:'yayin',yayin:'yayin',kultur:'kultur',proje:'proje',bbm:'bbm'};
function familyOf(r){
  const gf = GROUP_FAM[r.group];
  let fam = CODE_FAM[r.code];
  if (fam && gf && FAM_GROUP[fam] !== gf && !(fam === 'kultur' && gf === 'yayin')) fam = gf;
  fam = fam || r.cats.map(c => catFam[c]).find(Boolean) || gf || kindFam[r.kind] || 'diger';
  if (r.kind === 'organizational' && fam === 'konusma' && (!r.code || /^ÖT[TY]$/.test(r.code))) fam = 'kurum';
  return fam;
}
function finishRecord(r){
  r.cat = r.cats[0] || '';
  r.ft = fold(r.title);
  r.fam = familyOf(r);
  r.hay = r.ft + ' ' + fold(r.note) + ' ' + fold(r.cats.join(' ')) + ' ' + fold(r.label);
  r.toks = new Set(r.ft.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w)));
  return r;
}
/* one event entered once per type in the sheet becomes one record carrying all its types */
function prepareRecords(rows){
  const merged = new Map();
  rows.map(normalizeRow).filter(Boolean).forEach(r => {
    const key = r.year + '|' + r.label + '|' + fold(r.title);
    const prev = merged.get(key);
    if (prev) { r.cats.forEach(c => { if (!prev.cats.includes(c)) prev.cats.push(c); }); if (!prev.img && r.img) { prev.img = r.img; prev.credit = r.credit; } }
    else merged.set(key, r);
  });
  return [...merged.values()].map(finishRecord);
}
const FAMW = {kultur:4, proje:4, konusma:2, yayin:2, kurum:1, bbm:1, dergi:0, diger:0};
function signature(list){
  if (!list.length) return null;
  return list.map(r => [FAMW[r.fam] + (r.status==='verified'?2:0) + (r.iso?1:0) + (r.title.length>28 && r.title.length<120?2:0) + (/sempozyum|sergi|proje|kongre|açılış|kuruluş/i.test(r.title)?2:0) - (/^(yurt|toplumsal tarih sayı)/i.test(r.title)?3:0) - (/toplantı/i.test(r.title)?4:0), r])
    .sort((a,b) => b[0]-a[0] || a[1].id.localeCompare(b[1].id))[0][1];
}
/* ---------- artefacts: every record drawn as the object it was ---------- */
const hsh = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const unq = s => { s = s.trim().replace(/[\s.]+$/, ''); const q = /^["“”‘'’]/.test(s), e = /["“”’'‘]$/.test(s), n = (s.match(/["“”]/g) || []).length; return (q && e && n === 2) ? s.slice(1, -1).trim() : s; };
const NOUNY = /(ları|leri|ğı|ği|sı|si|nın|nin|ası|esi)$/;
const isName = a => { const w = a.split(' '); return w.length >= 2 && w.length <= 5 && w.every(x => /^[A-ZÇĞİÖŞÜ][^\s]*$/.test(x) || /^(ve|de|von|van|el)$/.test(x)) && !w.some(x => NOUNY.test(x)) && !/[:“"]/.test(a); };
const MON = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const COVERS = [['#631041','#F3E9DA'],['#1F3A5F','#F1E6CF'],['#2E4A3A','#EFE4C8'],['#7A4E1D','#F6EEDC'],['#E7DFCC','#2A2522'],['#8A2B22','#F4E8D3'],['#D8C28E','#2B2420'],['#33363F','#E9DFC6']];
const POSTERS = [['#631041','#F2E8D5'],['#D9B44A','#1E1B18'],['#1F3A5F','#F2E8D5'],['#B3261E','#F7EEDF'],['#E9E2D2','#631041'],['#2E4A3A','#E9D9A8']];
function artType(r){
  if (r.fam === 'dergi') return 'mag';
  if (r.fam === 'yayin' || (r.fam === 'diger' && r.kind === 'publication')) return 'book';
  if (r.fam === 'konusma' || (r.fam === 'diger' && r.kind === 'event')) return 'ticket';
  if (/toplantı|kurulu\b|sunumu|değerlendirme/i.test(r.title) && r.fam !== 'yayin') return 'doc';
  if (r.fam === 'kultur') return 'poster';
  if (r.fam === 'proje' || r.kind === 'project') return 'folder';
  return 'doc';
}
function parseBook(r){
  let t = r.title.replace(/^(Yurt|Tarih Vakfı)\s+/, ''), author = '';
  const dash = t.match(/^(.{3,60}?)\s[–-]\s(.+)$/);
  if (dash && isName(dash[1])) { author = dash[1]; t = dash[2]; }
  else { const segs = t.split(', '); const a = [];
    while (a.length < 2 && segs.length > 1 && isName(segs[0])) a.push(segs.shift());
    if (a.length) { author = a.join(', '); t = segs.join(', '); } }
  const pub = r.code === 'YYA' || /Yurt/.test(r.cat) || /^Yurt\s/.test(r.title) ? 'Yurt Yayınları' : 'Tarih Vakfı Yayınları';
  return {title: unq(t), author, pub};
}
function parseMag(r){
  const m = r.title.match(/(\d+)\.\s*Sayı|Sayı\s*(\d+)/);
  const no = m ? (m[1] || m[2]) : '';
  let dos = m ? r.title.slice(m.index + m[0].length) : r.title;
  dos = unq(dos.replace(/^[\s:,–-]+/, '').replace(/^Özel Dosya:\s*/i, '').replace(/Dosya Konusu:?\s*/i, ''));
  const name = SERIES[r.cat] || r.cat || 'Dergi';
  return {no, dos, name};
}
function parseTalk(r){
  let t = r.title, series = '', speaker = '';
  const c = t.indexOf(':');
  if (c > 2 && c < 48) { series = unq(t.slice(0, c)); t = t.slice(c + 1).trim(); }
  const parts = t.split(/\s[–-]\s/);
  if (parts.length > 1) {
    const a = parts[0], b = parts[parts.length - 1];
    if (isName(a)) { speaker = a; t = parts.slice(1).join(' – '); }
    else if (b.split(' ').length <= 6) { speaker = b; t = parts.slice(0, -1).join(' – '); }
  }
  return {series: series || (r.cat || 'Buluşma').split('/')[0], title: unq(t), speaker};
}
function dayMon(r){
  if (r.iso) return [String(+r.iso.slice(8,10)), MON[+r.iso.slice(5,7)-1]];
  const m = r.label.match(/^(\d{1,2})/); const mo = MONTHS.findIndex(x => r.label.includes(x));
  return [m ? m[1] : '', mo >= 0 ? MON[mo] : String(r.year)];
}
/* archivist's slip: an open question about the record, pencilled on a note */
const SLIP = {uncertain_date:'tarihi?', needs_review:'kontrol edilecek', uncertain_category:'türü?'};
const slip = r => SLIP[r.status] ? `<span class="slip">${SLIP[r.status]}</span>` : '';
function artHTML(r){
  const h = hsh(r.id), rot = ((h % 7) - 3) * .55, type = artType(r), era = eraOf(r.year)[0];
  /* a real image, when the sheet provides one, takes the drawing's place */
  if (r.img) return `<span class="art a-photo a-${type}" style="--r:${rot}deg" aria-hidden="true"><img src="${esc(r.img)}" alt="" loading="lazy">${slip(r)}</span>`;
  let inner = '', st = `--r:${rot}deg;`;
  if (type === 'book') {
    const b = parseBook(r), [bg, fg] = COVERS[h % COVERS.length], orn = (h >> 3) % 4;
    st += `--bg:${bg};--fg:${fg};`;
    inner = `<span class="orn o${orn}"></span><span class="bk-a">${esc(b.author)}</span><span class="bk-t">${esc(b.title)}</span><span class="bk-p">${esc(b.pub)}<br>${r.year}</span>`;
  } else if (type === 'mag') {
    const m = parseMag(r), tt = /Toplumsal/.test(m.name);
    st += `--mh:${tt ? '#B3261E' : /İstanbul/.test(m.name) ? '#1F4E8C' : '#2E4A3A'};--ph:${COVERS[h % COVERS.length][0]};`;
    inner = `<span class="mg-h">${esc(m.name)}</span><span class="mg-n">${m.no ? 'Sayı ' + m.no : ''}<i>${esc(r.label.replace(/^\d{1,2}[–-]?\d*\s*/, ''))}</i></span><span class="mg-ph"></span><span class="mg-d">${esc(m.dos)}</span>`;
  } else if (type === 'ticket') {
    const t = parseTalk(r), [d, mo] = dayMon(r);
    inner = `<span class="tk-stub"><b>${d}</b>${mo}</span><span class="tk-body"><span class="tk-s">${esc(t.series)}</span><span class="tk-t">${esc(t.title)}</span>${t.speaker ? `<span class="tk-p">${esc(t.speaker)}</span>` : ''}</span>`;
  } else if (type === 'poster') {
    const [bg, fg] = POSTERS[h % POSTERS.length];
    st += `--bg:${bg};--fg:${fg};`;
    inner = `<span class="ps-g g${era <= 2 ? 1 : era <= 4 ? 2 : 3}"></span><span class="ps-t">${esc(unq(r.title.replace(/\s*\((.*)\)\s*$/, '')))}</span><span class="ps-f">${esc(r.label)}<br>Tarih Vakfı</span>`;
  } else if (type === 'folder') {
    inner = `<span class="fd-tab">${r.year}</span><span class="fd-t">${esc(unq(r.title))}</span><span class="stamp">Proje</span>`;
  } else {
    inner = `<span class="dc-h">Tarih Vakfı</span><span class="dc-d">${esc(r.label)}</span><span class="dc-t">${esc(unq(r.title))}</span><span class="dc-l"></span><span class="seal"><b>${r.year}</b></span>`;
  }
  return `<span class="art a-${type}" style="${st}" aria-hidden="true">${inner}${slip(r)}</span>`;
}
function objHTML(r){
  return `<figure class="obj"><button type="button" data-id="${r.id}" aria-label="${esc(r.title)}">${artHTML(r)}</button><figcaption><span class="${r.status==='uncertain_date'?'u':''}">${esc(r.label)}</span></figcaption></figure>`;
}

/* a shelf of bound years, for pages other than the timeline */
function shelfHTML(list, opts = {}){
  const by = {}; list.forEach(r => by[r.year] = (by[r.year] || 0) + 1);
  const ys = Object.keys(by).map(Number); if (!ys.length) return '';
  const lo = Math.min(...ys), hi = Math.max(...ys), max = Math.max(...Object.values(by));
  const href = opts.href || (y => 'index.html#y' + y);
  let i = 0;
  return ERAS.map(e => {
    const span = []; for (let y = Math.max(lo, e[2]); y <= Math.min(hi, e[3]); y++) span.push(y);
    if (!span.length) return '';
    const w = span.reduce((a, y) => a + Math.sqrt(by[y] || 0) + 2, 0);
    return `<div class="era" style="--w:${w}"><div class="books">${span.map(y =>
      `<a class="spine" href="${href(y)}" data-y="${y}" style="--bind:var(--b${e[0]});--i:${i++};--g:${(Math.sqrt(by[y] || 0) + 2).toFixed(2)};height:${80 + ((y * 37) % 21)}%"><span>${y}</span></a>`).join('')}</div><div class="era-name" title="${span[0]}–${span[span.length-1]}">${e[1]}</div></div>`;
  }).join('');
}

window.TVKArt = {KINDS, KL, ST, STL, ASK, CONTRIB, itemUrl, MONTHS, SERIES, FAMS, ERAS, eraOf, catFam, kindFam, foldChar, fold, esc, fmt, STOP, fixLabel, CODE_FAM, IMG_DIR, clean, publicCategory, isSecret, splitNote, dateLabel, imagePath, normalizeRow, finishRecord, prepareRecords, FAMW, signature, hsh, unq, NOUNY, isName, MON, COVERS, POSTERS, artType, parseBook, parseMag, parseTalk, dayMon, SLIP, slip, artHTML, objHTML, shelfHTML};
})();
