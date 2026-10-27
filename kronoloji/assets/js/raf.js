/* Kronoloji, the site's front page (index.html). Shared pieces come from raf-art.js. */
const {KINDS, KL, ST, STL, ASK, CONTRIB, itemUrl, MONTHS, SERIES, FAMS, ERAS, eraOf, catFam, kindFam, foldChar, fold, esc, fmt, STOP, fixLabel, CODE_FAM, IMG_DIR, clean, publicCategory, isSecret, splitNote, dateLabel, imagePath, normalizeRow, finishRecord, prepareRecords, FAMW, signature, hsh, unq, NOUNY, isName, MON, COVERS, POSTERS, artType, parseBook, parseMag, parseTalk, dayMon, SLIP, slip, artHTML, objHTML} = window.TVKArt;
/* ---------- data: the same sources the rest of the site uses ---------- */
let recs = [], byId = new Map(), years = [], totalBy = {}, MAX = 1, sigCache = {};
function setRecords(list){
  recs = list; byId = new Map(recs.map(r => [r.id, r])); sigCache = {};
  const lo = Math.min(...recs.map(r => r.year)), hi = Math.max(...recs.map(r => r.year));
  years = []; for (let y = lo; y <= hi; y++) years.push(y);
  document.documentElement.style.setProperty('--n', years.length);
  totalBy = {}; recs.forEach(r => totalBy[r.year] = (totalBy[r.year] || 0) + 1);
  MAX = Math.max(...Object.values(totalBy));
  if (!totalBy[state.year]) state.year = years[years.length - 1];
}

const state = {q:'', kinds:new Set(), year: 0};
let view = recs, cur = {};
const filtered = () => !!(state.q || state.kinds.size);

/* chips */
const chips = document.getElementById('chips');
function buildChips(){ chips.innerHTML = '';
KINDS.forEach(k => {
  if (!recs.some(r => r.kind === k)) return;
  const b = document.createElement('button'); b.type='button'; b.className='chip'; b.setAttribute('aria-pressed', String(state.kinds.has(k)));
  b.innerHTML = `<i class="k-${k}"></i>${KL[k]}`;
  b.onclick = () => { state.kinds.has(k) ? state.kinds.delete(k) : state.kinds.add(k); b.setAttribute('aria-pressed', state.kinds.has(k)); apply(); };
  chips.appendChild(b);
});
}

/* shelf + mini */
const cols = document.getElementById('cols'), mini = document.getElementById('mini'), tip = document.getElementById('tip');
function buildShelf(){ cols.innerHTML = ''; mini.innerHTML = '';
let idx = 0;
ERAS.forEach(e => {
  const ys = years.filter(y => y >= e[2] && y <= e[3]); if (!ys.length) return;
  const era = document.createElement('div'); era.className = 'era'; era.style.setProperty('--w', ys.reduce((a,y)=>a+Math.sqrt(totalBy[y]||0)+2,0));
  const books = document.createElement('div'); books.className = 'books';
  ys.forEach(y => {
    const c = document.createElement('button'); c.type='button'; c.className='spine'; c.dataset.y=y;
    c.style.setProperty('--bind', `var(--b${e[0]})`); c.style.setProperty('--i', idx++);
    c.style.setProperty('--g', (Math.sqrt(totalBy[y]||0)+2).toFixed(2)); c.style.height = (80 + ((y*37)%21)) + '%';
    c.innerHTML = `<span>${y}</span>`;
    c.onmouseenter = c.onfocus = () => showTip(y);
    c.onclick = () => selectYear(y, true);
    books.appendChild(c);
    const m = document.createElement('b'); m.dataset.y=y; m.title=y; m.style.setProperty('--bind', `var(--b${e[0]})`);
    m.style.height = (5 + 15 * Math.sqrt((totalBy[y]||0)/MAX)) + 'px'; m.onclick=()=>selectYear(y, true); mini.appendChild(m);
  });
  era.appendChild(books);
  const n = document.createElement('div'); n.className='era-name'; n.textContent = e[1]; n.title = `${ys[0]}–${ys[ys.length-1]}`; era.appendChild(n);
  cols.appendChild(era);
});
}
document.getElementById('cols').addEventListener('mouseleave', () => showTip(null));

function counts(list){ const c = {}; list.forEach(r => { (c[r.year] ||= {all:0}); c[r.year].all++; c[r.year][r.kind]=(c[r.year][r.kind]||0)+1; }); return c; }
function paintRiver(){
  cur = counts(view);
  cols.querySelectorAll('.spine').forEach(c => {
    const y = +c.dataset.y, has = !!cur[y];
    c.disabled = !has; c.classList.toggle('on', y === state.year);
    c.classList.toggle('dim', !has); c.classList.toggle('hit', filtered() && has);
    c.setAttribute('aria-label', `${y}${filtered() && has ? ', aramanızla eşleşen kayıtlar var' : ''}`); c.setAttribute('aria-pressed', y === state.year);
  });
  [...mini.children].forEach(m => { const y = +m.dataset.y; m.classList.toggle('dim', !cur[y]); m.classList.toggle('cur', y === state.year); });
  const sc = cols.parentElement, on = cols.querySelector('.spine.on');
  if (on && sc.scrollWidth > sc.clientWidth) { const l = on.offsetLeft - sc.clientWidth/2 + on.offsetWidth/2; sc.scrollTo({left: Math.max(0,l)}); }
  paintDock();
}
/* the one record that best stands for a year */
const sigOf = y => (filtered() ? signature(view.filter(r => r.year === y)) : (sigCache[y] ||= signature(recs.filter(r => r.year === y))));
function showTip(y){
  if (y == null) y = state.year;
  const s = sigOf(y);
  tip.innerHTML = s ? `${y}, ${eraOf(y)[1]}: <b>${esc(s.title)}</b>` : `${y}: ${filtered() ? 'bu aramayla eşleşen bir iz yok.' : 'bu yıldan kayıt yok.'}`;
}

/* year view */
const yv = document.getElementById('yv');
function hl(r){
  const t = r.title; if (!state.q) return esc(t);
  const q = fold(state.q); let out = '', i = 0, j;
  while ((j = r.ft.indexOf(q, i)) !== -1) { out += esc(t.slice(i, j)) + '<mark>' + esc(t.slice(j, j + q.length)) + '</mark>'; i = j + q.length; }
  return out + esc(t.slice(i));
}
const byDate = (a, b) => (a.iso || '9').localeCompare(b.iso || '9');
function recHTML(r, showCat){
  return `<li><button type="button" class="rec" data-id="${r.id}"><span class="d${r.status==='uncertain_date'?' u':''}">${esc(r.label)}${showCat && r.cat ? `<span class="c">${esc(r.cat)}</span>` : ''}</span><span class="t">${hl(r)}</span></button></li>`;
}
const SHOW = 12;
function renderYear(){
  const y = state.year, all = view.filter(r => r.year === y);
  const prevY = [...years].reverse().find(v => v < y && cur[v]), nextY = years.find(v => v > y && cur[v]);
  const e = eraOf(y), sig = sigOf(y);
  yv.style.setProperty('--bind', `var(--b${e[0]})`);
  let hits = '';
  if (filtered()) {
    const ys = Object.keys(cur).map(Number).sort((a,b)=>a-b);
    hits = ys.length ? `<div class="hits" role="group" aria-label="Aramanızın geçtiği yıllar">${ys.map(v => `<button type="button" data-goyear="${v}" aria-current="${v===y}">${v}</button>`).join('')}</div>` : '';
  }
  let body;
  if (!view.length) body = `<div class="empty"><p>Bu aramayla eşleşen bir iz bulunamadı.</p><button type="button" id="clr">Aramayı temizle</button></div>`;
  else body = FAMS.map(f => {
    const rs = all.filter(r => r.fam === f.id && r !== sig).sort(byDate); if (!rs.length) return '';
    return `<section class="table" aria-labelledby="f-${f.id}"><h3 id="f-${f.id}">${f.name}</h3><div class="strip" data-strip="${f.id}">${rs.slice(0, SHOW).map(objHTML).join('')}${rs.length > SHOW ? `<button class="more-obj" type="button" data-fam="${f.id}">Devamını<br>göster</button>` : ''}</div></section>`;
  }).join('');
  yv.innerHTML = `<div class="plate"><div class="pl-l"><h2 id="yvH">${y}<span class="era-line">${e[1]}</span></h2>
    <div class="steps"><button type="button" class="step" data-goyear="${prevY||''}" ${prevY?'':'disabled'} aria-label="Önceki yıl">‹ ${prevY||''}</button><button type="button" class="step" data-goyear="${nextY||''}" ${nextY?'':'disabled'} aria-label="Sonraki yıl">${nextY||''} ›</button></div></div>
    <p class="sig">${sig ? `<small>Bu yılın izlerinden</small><button type="button" data-id="${sig.id}">${hl(sig)}</button>` : ''}</p>
    ${sig ? `<button type="button" class="pl-art" data-id="${sig.id}" tabindex="-1">${artHTML(sig)}</button>` : ''}</div>${hits}${body}`;
  const clr = document.getElementById('clr'); if (clr) clr.onclick = clearAll;
  showTip(null);
}
yv.addEventListener('click', e => {
  const g = e.target.closest('[data-goyear]'); if (g && g.dataset.goyear) return selectYear(+g.dataset.goyear, false);
  const m = e.target.closest('[data-fam]');
  if (m) { const sg = sigOf(state.year); const rs = view.filter(r => r.year === state.year && r.fam === m.dataset.fam && r !== sg).sort(byDate);
    const have = m.parentElement.querySelectorAll('.obj').length, next = rs.slice(have, have + SHOW);
    m.insertAdjacentHTML('beforebegin', next.map(objHTML).join('')); if (have + SHOW >= rs.length) m.remove(); }
});
function selectYear(y, scroll){
  state.year = y; paintRiver(); renderYear();
  if (!dlg.open) try { history.replaceState(null, '', '#y' + y); } catch(e) {}
  if (scroll) yv.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
  else { const top = yv.getBoundingClientRect().top; if (top < 0) yv.scrollIntoView({block:'start'}); }
}
addEventListener('keydown', e => {
  if (dlg.open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const ys = years.filter(v => cur[v]); const i = ys.indexOf(state.year);
  const n = e.key === 'ArrowLeft' ? ys[i-1] : ys[i+1]; if (n) selectYear(n, false);
});

/* apply filters */
function apply(){
  const q = fold(state.q.trim());
  view = recs.filter(r => (!state.kinds.size || state.kinds.has(r.kind)) && (!q || r.hay.includes(q)));
  cur = counts(view);
  if (view.length && !cur[state.year]) { const best = Object.entries(cur).sort((a,b)=>b[1].all-a[1].all)[0][0]; state.year = +best; }
  paintRiver(); renderYear(); showTip(null);
}
let tmr; document.getElementById('q').addEventListener('input', e => { clearTimeout(tmr); tmr = setTimeout(() => { state.q = e.target.value.trim(); apply(); }, 160); });
function clearAll(){ state.q=''; state.kinds.clear(); document.getElementById('q').value=''; chips.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed','false')); apply(); }


/* on this day */
function renderToday(){
  const now = new Date(), m = now.getMonth(), d = now.getDate();
  const dated = recs.filter(r => r.iso);
  const dist = r => { const a = new Date(2001, +r.iso.slice(5,7)-1, +r.iso.slice(8,10)), b = new Date(2001, m, d); const x = Math.abs(a-b)/864e5; return Math.min(x, 365-x); };
  let pick = dated.filter(r => dist(r) === 0), label = 'Bugün';
  if (!pick.length) { pick = dated.filter(r => dist(r) <= 4); label = 'Bu hafta'; }
  if (!pick.length) return;
  pick = pick.sort((a,b) => a.year - b.year).slice(0, 5);
  const el = document.getElementById('today'); el.hidden = false;
  el.innerHTML = `<h2 id="todayH">${label}, geçmiş yıllarda<small>${d} ${MONTHS[m]} ${label === 'Bu hafta' ? 'civarında' : 'tarihinde'} Tarih Vakfı’nda olanlar</small></h2>
    <ul>${pick.map(r => `<li><button type="button" data-id="${r.id}"><span class="yy">${r.year}</span><span class="tt">${esc(r.title)}</span></button></li>`).join('')}</ul>`;
}

/* record dialog */
const dlg = document.getElementById('dlg'), body = document.getElementById('dlBody');
function related(r){
  return recs.filter(x => x !== r && (r.cat ? x.cats.includes(r.cat) : x.kind === r.kind)).map(x => {
    let sh = 0; x.toks.forEach(w => { if (r.toks.has(w)) sh++; });
    return [sh * 3 - Math.abs(x.year - r.year) * .25, x];
  }).sort((a,b) => b[0]-a[0]).slice(0, 5).map(p => p[1]).sort((a,b)=>a.year-b.year);
}
function openRec(id, push = true){
  const r = byId.get(id); if (!r) return;
  const rel = related(r);
  body.innerHTML = `<div class="dl-top"><span class="kind"><i class="dot k-${r.kind}"></i>${KL[r.kind]}${r.cats.length ? ', ' + esc(r.cats.join(', ')) : ''}</span><button class="x" type="button" aria-label="Kapat" data-close>×</button></div>
    <figure class="dl-art">${artHTML(r)}<figcaption>${r.img ? (r.credit ? 'Görsel: ' + esc(r.credit) : 'Özgün görsel') : 'Bu çizim yalnızca kayıttaki bilgilerle hazırlandı; özgün görsel eklendiğinde yerini alacak.'}${SLIP[r.status] ? ' Sarı not, kayıtta henüz kesinleşmemiş bir bilgiye işaret ediyor.' : ''}</figcaption></figure>
    <p class="when">${r.status === 'uncertain_date' ? 'Yaklaşık ' : ''}${esc(r.label)}</p>
    <h3 id="dlgT">${esc(r.title)}</h3>
    ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
    <dl class="facts"><dt>Yıl</dt><dd>${r.year}</dd><dt>Kaynak durumu</dt><dd>${STL[r.status]}</dd><dt>Kayıt no</dt><dd>${r.id}</dd></dl>
    ${r.status !== 'verified' ? `<div class="ask">${ASK[r.status] || ASK.other} <a href="${CONTRIB}?id=${encodeURIComponent(r.id)}&title=${encodeURIComponent(r.title)}">Düzeltme önerin</a>. Kronoloji, hatırlayanlarla birlikte tamamlanıyor.</div>` : ''}
    <div class="acts"><a class="primary" href="${itemUrl(r)}">Kayıt sayfası</a><button type="button" data-copy>Bağlantıyı kopyala</button><button type="button" data-year="${r.year}">${r.year} yılına git</button></div>
    ${rel.length ? `<div class="rel"><h4>Bununla bağlantılı kayıtlar</h4><ul>${rel.map(x => `<li><button type="button" data-id="${x.id}"><span class="yy">${x.year}</span><span class="tt">${esc(x.title)}</span></button></li>`).join('')}</ul></div>` : ''}`;
  if (!dlg.open) dlg.showModal();
  body.scrollTop = 0; body.querySelector('[data-close]').focus();
  if (push) try { history.replaceState(null, '', '#' + r.id); } catch(e) {}
}
function closeRec(){ if (dlg.open) dlg.close(); }
dlg.addEventListener('close', () => { try { history.replaceState(null, '', '#y' + state.year); } catch(e) {} });
dlg.addEventListener('click', e => { if (e.target === dlg) closeRec(); });
body.addEventListener('click', async e => {
  if (e.target.closest('[data-close]')) return closeRec();
  const y = e.target.closest('[data-year]'); if (y) { closeRec(); if (filtered()) clearAll(); return selectYear(+y.dataset.year, true); }
  const c = e.target.closest('[data-copy]');
  if (c) { const r = byId.get(location.hash.slice(1)); const url = r ? itemUrl(r) : location.href;
    try { await navigator.clipboard.writeText(url); c.textContent = 'Bağlantı kopyalandı'; } catch(err) { c.textContent = url; } }
});
document.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) openRec(b.dataset.id); });
document.getElementById('rand').onclick = () => { const pool = view.length ? view : recs; openRec(pool[Math.floor(Math.random()*pool.length)].id); };
function fromHash(){
  const h = location.hash.slice(1);
  if (byId.has(h)) { const r = byId.get(h); if (state.year !== r.year) { state.year = r.year; paintRiver(); renderYear(); } openRec(h, false); }
  else if (/^y\d{4}$/.test(h) && totalBy[+h.slice(1)]) { closeRec(); selectYear(+h.slice(1), false); }
}
addEventListener('hashchange', fromHash);

/* mobile dock */
const dockM = document.getElementById('dockM'), dockY = document.getElementById('dockY'), dockYr = document.getElementById('dockYr');
function buildDockMini(){ dockM.innerHTML = '';
years.forEach(y => { const i = document.createElement('i'); i.dataset.y = y; i.style.setProperty('--bind', `var(--b${eraOf(y)[0]})`); i.style.height = (4 + 12 * Math.sqrt((totalBy[y]||0)/MAX)) + 'px'; dockM.appendChild(i); });
}
function paintDock(){
  dockY.innerHTML = `${state.year}<small>${eraOf(state.year)[1]}</small>`;
  [...dockM.children].forEach(i => { const y = +i.dataset.y; i.classList.toggle('dim', !cur[y]); i.classList.toggle('cur', y === state.year); });
  const ys = years.filter(v => cur[v]), k = ys.indexOf(state.year);
  document.querySelector('[data-dock=prev]').disabled = k <= 0;
  document.querySelector('[data-dock=next]').disabled = k < 0 || k >= ys.length - 1;
}
function stepYear(d){ const ys = years.filter(v => cur[v]), k = ys.indexOf(state.year), n = ys[k + d]; if (n) selectYear(n, true); }
document.querySelector('.dock').addEventListener('click', e => {
  const b = e.target.closest('[data-dock]'); if (!b) return;
  if (b.dataset.dock === 'prev') stepYear(-1);
  else if (b.dataset.dock === 'next') stepYear(1);
  else { const q = document.getElementById('q'); q.scrollIntoView({block:'center'}); q.focus({preventScroll:true}); }
});
/* slide a finger along the miniature shelf to scrub through the years */
let scrub = null, raf = 0;
const yearAt = x => { const r = dockM.getBoundingClientRect(); const i = Math.max(0, Math.min(years.length - 1, Math.floor((x - r.left) / r.width * years.length))); return years[i]; };
function scrubTo(x){ const y = yearAt(x); if (!cur[y] || y === state.year) return; scrub = y; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { state.year = y; paintRiver(); renderYear(); }); }
dockYr.addEventListener('pointerdown', e => { dockYr.setPointerCapture(e.pointerId); scrub = state.year; scrubTo(e.clientX); });
dockYr.addEventListener('pointermove', e => { if (scrub !== null) scrubTo(e.clientX); });
const endScrub = () => { if (scrub === null) return; const y = state.year; scrub = null; selectYear(y, true); };
dockYr.addEventListener('pointerup', endScrub); dockYr.addEventListener('pointercancel', endScrub);

/* boot */
const CONFIG = window.TVK_CHRONOLOGY_CONFIG || {};
const STATIC_URL = 'assets/data/chronology_public.json';
const extractRows = p => Array.isArray(p) ? p : (p && (p.records || p.data || p.chronology_public)) || null;
async function fetchJSON(url, opts = {}, timeout = 0){
  const ctl = timeout ? new AbortController() : null, tm = ctl ? setTimeout(() => ctl.abort(), timeout) : 0;
  try { const res = await fetch(url, {...opts, signal: ctl ? ctl.signal : undefined}); if (!res.ok) throw new Error(res.status + ' ' + res.statusText); return await res.json(); }
  finally { if (tm) clearTimeout(tm); }
}
async function fetchRows(url, opts = {}, timeout = 0){
  const payload = await fetchJSON(url, opts, timeout), rows = extractRows(payload);
  if (!Array.isArray(rows)) throw new Error('kayıt listesi yok');
  applyContent(payload && !Array.isArray(payload) ? payload.content : null);
  return rows;
}
/* editable texts from the editors' "Site Metinleri" tab (data-content keys) */
function applyContent(content){
  if (!content || typeof content !== 'object') return;
  document.querySelectorAll('[data-content]').forEach(el => { const v = content[el.dataset.content]; if (v) el.textContent = String(v); });
  document.querySelectorAll('[data-content-placeholder]').forEach(el => { const v = content[el.dataset.contentPlaceholder]; if (v) el.setAttribute('placeholder', String(v)); });
}
function readParams(){
  const p = new URLSearchParams(location.search);
  if (p.get('q')) { state.q = p.get('q'); document.getElementById('q').value = state.q; }
  const k = p.get('kind'); if (k && KINDS.includes(k)) state.kinds.add(k);
  const y = parseInt(p.get('year') || p.get('yil'), 10); if (y) state.year = y;
  const per = (p.get('period') || '').match(/^([1-7])/); if (per && !y) state.year = ERAS[+per[1] - 1][2];
}
/* one object from each of the seven terms */
function renderEras(){
  const el = document.getElementById('eras'); if (!el) return;
  el.innerHTML = ERAS.map(e => {
    const s = signature(recs.filter(r => r.year >= e[2] && r.year <= e[3]));
    return s ? `<figure class="obj"><button type="button" data-id="${s.id}" aria-label="${esc(s.title)}">${artHTML(s)}</button><figcaption><b>${e[1]}</b>${esc(s.label)}</figcaption></figure>` : '';
  }).join('');
}
function render(list, first){
  const open = dlg.open ? location.hash.slice(1) : '';
  setRecords(list); buildChips(); buildShelf(); buildDockMini(); renderToday(); renderEras(); apply();
  if (first) fromHash(); else if (open && byId.has(open)) openRec(open, false);
}
async function boot(){
  readParams();
  fetchJSON('assets/data/site_content.json').then(c => applyContent(c && (c.content || c))).catch(() => {});
  let shown = false;
  try { render(prepareRecords(await fetchRows(STATIC_URL)), true); shown = true; }
  catch (e) { console.warn('Statik kronoloji verisi yüklenemedi', e); }
  if (CONFIG.liveDataUrl && CONFIG.preferLiveData !== false) {
    try {
      const url = CONFIG.liveDataUrl + (CONFIG.liveDataUrl.includes('?') ? '&' : '?') + '_=' + Date.now();
      const live = prepareRecords(await fetchRows(url, {cache:'no-store'}, 35000));
      if (live.length) { render(live, !shown); shown = true; }
    } catch (e) { console.warn('Canlı kronoloji verisi yüklenemedi', e); }
  }
  if (!shown) document.getElementById('yv').innerHTML = '<div class="empty"><p>Kronoloji şu anda yüklenemedi.</p><button type="button" onclick="location.reload()">Yeniden dene</button></div>';
}
boot();
