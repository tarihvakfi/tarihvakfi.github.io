/* Tarih Vakfı Dijital Kronolojisi: adds record drawings to pages rendered by
   site.js (archive cards, record page, correction form). It only adds markup
   next to what site.js renders, so site.js stays the source of truth. */
(function(){
'use strict';
const A = window.TVKArt;
if (!A) return;
const page = document.body.dataset.page;
const find = id => (id && typeof findRecordById === 'function') ? findRecordById(id) : null;
const prep = row => { try { return A.prepareRecords([row])[0] || null; } catch (e) { return null; } };
const idFrom = href => { try { return new URL(href, location.href).searchParams.get('id'); } catch (e) { return null; } };
const caption = r => (r.img ? (r.credit ? 'Görsel: ' + A.esc(r.credit) : 'Özgün görsel') : 'Bu çizim yalnızca kayıttaki bilgilerle hazırlandı; özgün görsel eklendiğinde yerini alacak.')
  + (A.SLIP[r.status] ? ' Sarı not, kayıtta henüz kesinleşmemiş bir bilgiye işaret ediyor.' : '');

function decorateCards(root){
  root.querySelectorAll('.item-card:not(.with-art)').forEach(card => {
    const link = card.matches('a') ? card : card.querySelector('a[href*="item.html?id="]');
    const r = link && prep(find(idFrom(link.getAttribute('href'))));
    if (!r) return;
    card.classList.add('with-art');
    card.insertAdjacentHTML('afterbegin', `<span class="card-art" aria-hidden="true">${A.artHTML(r)}</span>`);
  });
}
function decorateItem(main){
  const detail = main.querySelector('.record-detail');
  if (!detail) { main.classList.remove('has-art'); return; }
  if (main.querySelector('.item-art')) return;
  const r = prep(find(new URLSearchParams(location.search).get('id')));
  if (!r) return;
  main.classList.add('has-art');
  detail.insertAdjacentHTML('beforebegin', `<figure class="item-art">${A.artHTML(r)}<figcaption>${caption(r)}</figcaption><a class="item-year" href="index.html#y${r.year}">${r.year} yılını rafta açın</a></figure>`);
}
function decorateContribute(){
  const id = new URLSearchParams(location.search).get('id');
  const intro = document.querySelector('.contribute-intro');
  if (!id || !intro) return;
  let tries = 0;
  const t = setInterval(() => {
    const row = find(id);
    if (!row && ++tries < 90) return;
    clearInterval(t);
    const r = row && prep(row);
    if (!r || intro.querySelector('.item-art')) return;
    const url = 'item.html?id=' + encodeURIComponent(r.id);
    intro.insertAdjacentHTML('afterbegin', `<figure class="item-art"><a href="${url}">${A.artHTML(r)}</a><figcaption>Düzeltme önerdiğiniz kayıt: <a href="${url}">${A.esc(r.title)}</a></figcaption></figure>`);
  }, 400);
}
function watch(el, fn){ if (!el) return; fn(el); new MutationObserver(() => fn(el)).observe(el, {childList: true}); }

document.addEventListener('DOMContentLoaded', () => {
  if (page === 'archive') watch(document.getElementById('archiveResults'), decorateCards);
  if (page === 'item') watch(document.getElementById('itemDetail'), decorateItem);
  if (page === 'contribute') decorateContribute();
});
})();
