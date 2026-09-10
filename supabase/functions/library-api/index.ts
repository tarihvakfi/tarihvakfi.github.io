import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const choices: Record<string, string> = {
  gidecek: 'go', belki: 'may_go', gitmeyecek: 'stay', belirsiz: 'uncertain',
};
const choiceNames: Record<string, string> = {
  go: 'Gidecek', may_go: 'Gitse de olur', stay: 'Gitmeyecek', uncertain: 'Belirsiz',
};
const choiceCodes: Record<string, string> = {
  go: 'gidecek', may_go: 'belki', stay: 'gitmeyecek', uncertain: 'belirsiz',
};
const conditionNames: Record<string, string> = {
  good: 'Sağlam', worn: 'Yıpranmış', mold_or_pest: 'Küflü/böcekli',
};
const conditionCodes: Record<string, string> = {
  'Sağlam': 'good', 'Yıpranmış': 'worn', 'Küflü/böcekli': 'mold_or_pest',
};
const coordinatorActions = new Set([
  'koordinatorBaslangic', 'katalog', 'durum', 'siraHaritasiKisa', 'siraHaritasi',
  'kararVer', 'kararGorusGeriAl', 'kararGeriAl', 'kitapIste', 'onayBekleyen',
  'onayGruplari', 'onayla', 'topluOnayla', 'kunyeErtele', 'kutula', 'kutular',
]);

function result(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
}
function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : String(error || 'İşlem tamamlanamadı.');
  return result({ ok: false, error: message }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }
function html(value: unknown) {
  return clean(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character] || character));
}
function normalizeName(value: unknown) { return clean(value).replace(/\s+/g, ' ').toLocaleLowerCase('tr'); }
function trDate(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? clean(value) : new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}
function shelfCode(body: Record<string, unknown>) {
  if (body.sira && /^([^-]+)-([A-ZÇĞİÖŞÜ]+)\d+$/i.test(clean(body.sira))) return clean(body.sira).toUpperCase();
  return `${clean(body.mekan).toUpperCase()}-${clean(body.raf).toUpperCase()}${String(Number(body.sira) || 1).padStart(2, '0')}`;
}
function splitShelf(code: string) {
  const match = /^([^-]+)-([A-ZÇĞİÖŞÜ]+)(\d+)$/i.exec(code);
  return match ? { mekan: match[1], raf: match[2], sira: Number(match[3]) } : { mekan: '', raf: '', sira: 0 };
}

async function all(table: string, select = '*') {
  const { data, error } = await supabase.from(table).select(select).limit(1000);
  if (error) throw error;
  return data || [];
}

async function signed(path: string | null, legacy: string | null) {
  if (!path) return legacy || '';
  return supabase.storage.from('library-photos').getPublicUrl(path).data.publicUrl || legacy || '';
}

async function signedMap(paths: Array<string | null>) {
  const unique = [...new Set(paths.filter(Boolean) as string[])];
  const map = new Map<string, string>();
  unique.forEach(path => map.set(path, supabase.storage.from('library-photos').getPublicUrl(path).data.publicUrl));
  return map;
}

type Context = {
  books: any[];
  shelves: any[];
  boxes: Map<string, any>;
  decisions: Map<string, any>;
  opinions: Map<string, any[]>;
};

async function loadContext(): Promise<Context> {
  const [books, shelfStatus, shelfRows, statuses, boxRows] = await Promise.all([
    all('library_books'), all('library_current_shelf_status'), all('library_shelf_positions'),
    all('library_book_decision_status'), all('library_boxes'),
  ]);
  const shelfDetails = new Map(shelfRows.map((row: any) => [row.id, row]));
  const shelves = shelfStatus.map((row: any) => ({ ...row, ...(shelfDetails.get(row.id) || {}) }));
  const decisions = new Map<string, any>();
  const opinions = new Map<string, any[]>();
  statuses.forEach((row: any) => {
    decisions.set(row.book_id, row);
    opinions.set(row.book_id, Array.isArray(row.opinions) ? row.opinions : []);
  });
  return { books, shelves, boxes: new Map(boxRows.map((row: any) => [row.id, row])), decisions, opinions };
}

function decisionState(ctx: Context, book: any) {
  const d = ctx.decisions.get(book.id) || {};
  const opinions = ctx.opinions.get(book.id) || [];
  const final = !!d.final_choice;
  return {
    final,
    choice: d.final_choice || '',
    category: final ? choiceNames[d.final_choice] : 'Sınıflandırılmadı',
    status: final
      ? (d.resolution_kind === 'single_after_30_days' ? 'tek_gorusle_gecerli' : 'kesin')
      : (Number(d.distinct_choice_count) > 1 ? 'gorus_ayriligi' : (opinions.length ? 'ikinci_gorus_bekliyor' : 'gorus_bekliyor')),
    opinions,
    decidedAt: d.decided_at || '',
    decidedBy: Array.isArray(d.decided_by_names) ? d.decided_by_names.join(' + ') : '',
    rule: d.resolution_kind === 'manual' ? 'Yetkili kararı' : (d.resolution_kind === 'legacy' ? 'Eski karar' : ''),
  };
}

async function legacyBook(ctx: Context, book: any, withPhotos = true, photoUrls?: Map<string, string>) {
  const shelf = ctx.shelves.find((item: any) => item.id === book.shelf_position_id) || {};
  const parts = splitShelf(shelf.code || '');
  const d = decisionState(ctx, book);
  const opinionList = d.opinions.map((o: any) => ({
    kategori: choiceCodes[o.choice] || o.choice,
    kategoriAdi: choiceNames[o.choice] || o.choice,
    veren: o.voter_name,
    tarih: o.updated_at,
    not: o.note || '',
  }));
  const [imprint, cover] = withPhotos
    ? (photoUrls ? [photoUrls.get(book.imprint_photo_path) || book.legacy_imprint_url || '', photoUrls.get(book.cover_photo_path) || book.legacy_cover_url || '']
      : await Promise.all([signed(book.imprint_photo_path, book.legacy_imprint_url), signed(book.cover_photo_path, book.legacy_cover_url)]))
    : [publicPhoto(book.imprint_photo_path, book.legacy_imprint_url), publicPhoto(book.cover_photo_path, book.legacy_cover_url)];
  return {
    id: book.id, no: book.legacy_no, yer: book.place_code,
    mekan: parts.mekan, raf: parts.raf, sira: parts.sira, siraNo: book.position_number,
    yazar: book.author || '', baslik: book.title || '', yil: book.publication_year || '',
    nusha: book.copies || 1, kategori: d.category, kural: d.rule,
    durum: conditionNames[book.condition] || 'Sağlam', not: book.note || '',
    kaydeden: book.recorded_by_name || '', tarih: trDate(book.recorded_at),
    onay: book.bibliography_approved_at ? `Künye onaylı · ${book.bibliography_approved_by_name || ''}` : '',
    onayli: !!book.bibliography_approved_at,
    istenen: book.requested_reason || '',
    foto: imprint, fotoId: '', fotoGoruntu: imprint,
    kapak: cover, kapakId: '', kapakGoruntu: cover, fotoVar: !!(imprint || cover),
    kararVeren: d.decidedBy, kararTarihi: trDate(d.decidedAt), kararGecmisi: '',
    kararGorusleri: opinionList, kararDurumu: d.status,
    kutu: ctx.boxes.get(book.box_id)?.code || '',
  };
}

function publicPhoto(path: string | null, legacy = '') {
  if (!path) return legacy || '';
  return supabase.storage.from('library-photos').getPublicUrl(path).data.publicUrl || legacy || '';
}

function currentCount(counts: any[]) {
  if (!counts.length) return null;
  const c = counts.sort((a, b) => new Date(b.counted_at).valueOf() - new Date(a.counted_at).valueOf())[0];
  return {
    toplam: c.total_count, sayan: c.counted_by_name || '', sayimTarihi: trDate(c.counted_at),
    foto: publicPhoto(c.photo_path, c.photo_url || c.legacy_photo_url || ''), duzen: c.layout === 'double' ? 'iki' : 'tek',
    onSira: c.front_count, arkaSira: c.back_count, arkaDurum: c.back_unavailable ? 'sayilamadi' : '',
    durum: c.status === 'approved' ? 'onaylandi' : (c.status === 'could_not_count' ? 'sayilamadi' : 'sayildi'),
    not: c.note || '', ikinciSayim: null, ikinciSayan: '', ikinciTarih: '',
    onaylayan: c.approved_by_name || '', onayTarihi: trDate(c.approved_at),
    uyusmazlik: c.status === 'disputed', eksik: !!c.back_unavailable,
  };
}

async function shelfMap(ctx?: Context) {
  const context = ctx || await loadContext();
  const counts = await all('library_shelf_counts');
  const byShelf = new Map<string, any[]>();
  counts.forEach((c: any) => byShelf.set(c.shelf_position_id, [...(byShelf.get(c.shelf_position_id) || []), c]));
  const list = context.shelves.slice().sort((a: any, b: any) => a.sort_order - b.sort_order).map((s: any) => {
    const count = currentCount(byShelf.get(s.id) || []);
    const done = !!s.completed_at;
    return {
      id: s.id, sira: s.code, durum: done ? 'bitti' : (Number(s.book_records) ? 'devam' : 'bos'),
      kayitli: Number(s.physical_books || 0), kayitSayisi: Number(s.book_records || 0),
      kararVerilen: Number(s.final_decisions || 0), raftaki: done ? s.closing_count : '',
      fark: done && s.closing_count != null ? Number(s.closing_count) - Number(s.physical_books || 0) : '',
      bitiren: s.completed_by_name || '', tarih: trDate(s.completed_at), not: s.closing_note || '',
      tutulu: !!s.assigned_at && !done, tutan: s.assigned_by_name || '',
      onSayim: count?.toplam ?? null, sayan: count?.sayan || '', sayimFoto: count?.foto || '', sayim: count,
    };
  });
  return { ok: true, siralar: list, toplam: list.length,
    bitti: list.filter(x => x.durum === 'bitti').length,
    devam: list.filter(x => x.durum === 'devam').length,
    bos: list.filter(x => x.durum === 'bos').length,
    tutulu: list.filter(x => x.tutulu).length,
    sayimYapilan: list.filter(x => x.sayim && ['sayildi', 'onaylandi'].includes(x.sayim.durum)).length,
    sayimOnayli: list.filter(x => x.sayim?.durum === 'onaylandi').length,
    sayilamayan: list.filter(x => x.sayim?.durum === 'sayilamadi').length,
    sayimUyusmaz: list.filter(x => x.sayim?.uyusmazlik).length,
    sayimEksik: list.filter(x => x.sayim?.eksik).length,
    uyusmayan: list.filter(x => x.durum === 'bitti' && Number(x.fark) !== 0).length,
    kararBekleyenRaf: list.filter(x => x.kayitSayisi > x.kararVerilen).length,
  };
}

async function catalog(body: Record<string, any>, ctx?: Context) {
  const context = ctx || await loadContext();
  const query = clean(body.ara).toLocaleLowerCase('tr');
  let books = context.books.filter((book: any) => {
    const d = decisionState(context, book);
    if (body.yalnizOnayli && !book.bibliography_approved_at) return false;
    if (body.yalnizKararli && !d.final) return false;
    if (body.yalnizKararsiz && d.final) return false;
    if (body.kategori && d.category !== body.kategori) return false;
    if (body.mekan && !book.place_code.startsWith(`${body.mekan}-`)) return false;
    if (body.sira && !book.place_code.startsWith(`${body.sira}-`)) return false;
    if (body.kutu && context.boxes.get(book.box_id)?.code !== clean(body.kutu)) return false;
    if (query && ![book.title, book.author, book.place_code, book.note, book.requested_reason, book.recorded_by_name]
      .join(' ').toLocaleLowerCase('tr').includes(query)) return false;
    return !book.deleted_at;
  });
  books.sort((a: any, b: any) => body.sirala === 'yer'
    ? a.place_code.localeCompare(b.place_code, 'tr', { numeric: true })
    : Number(b.legacy_no || 0) - Number(a.legacy_no || 0));
  const total = books.length;
  const start = Math.max(0, Number(body.bas) || 0);
  const size = Math.min(300, Math.max(1, Number(body.adet) || 60));
  books = books.slice(start, start + size);
  const photos = await signedMap(books.flatMap((b: any) => [b.imprint_photo_path, b.cover_photo_path]));
  return { ok: true, toplam: total, bas: start, kayitlar: await Promise.all(books.map(b => legacyBook(context, b, true, photos))) };
}

async function dashboard(ctx?: Context) {
  const context = ctx || await loadContext();
  const active = context.books.filter((b: any) => !b.deleted_at);
  const category: Record<string, number> = {};
  const physical: Record<string, number> = {};
  let approved = 0, approvalPending = 0, decisionPending = 0, second = 0, disagreement = 0, oneFinal = 0;
  const people = new Map<string, { ad: string; bugun: number; toplam: number }>();
  const shelfStats = new Map<string, any>();
  for (const book of active) {
    const d = decisionState(context, book);
    category[d.category] = (category[d.category] || 0) + 1;
    const condition = conditionNames[book.condition] || '—'; physical[condition] = (physical[condition] || 0) + 1;
    if (book.bibliography_approved_at) {
      approved++;
      if (!d.final) decisionPending++;
      if (d.status === 'ikinci_gorus_bekliyor') second++;
      if (d.status === 'gorus_ayriligi') disagreement++;
      if (d.status === 'tek_gorusle_gecerli') oneFinal++;
    } else if (book.imprint_photo_path || book.cover_photo_path || book.legacy_imprint_url || book.legacy_cover_url) approvalPending++;
    const name = book.recorded_by_name || '—';
    const p = people.get(name) || { ad: name, bugun: 0, toplam: 0 }; p.toplam++;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    if (new Date(book.recorded_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) === today) p.bugun++;
    people.set(name, p);
    const code = book.place_code.replace(/-\d+$/, '');
    const s = shelfStats.get(code) || { sira: code, sayi: 0, sonNo: 0, son: '' };
    s.sayi++; s.sonNo = Math.max(s.sonNo, Number(book.position_number || 0)); s.son = trDate(book.recorded_at); shelfStats.set(code, s);
  }
  return { ok: true, toplam: active.length, onayli: approved, onayBekleyen: approvalPending,
    kararBekleyen: decisionPending, ikinciGorusBekleyen: second, gorusAyriligi: disagreement,
    tekGorusleGecerli: oneFinal, kunyeEksik: active.filter(b => !b.title && !b.imprint_photo_path && !b.legacy_imprint_url).length,
    tamam: active.filter(b => !b.bibliography_approved_at && b.title && !b.imprint_photo_path && !b.legacy_imprint_url).length,
    fotoli: active.filter(b => b.imprint_photo_path || b.legacy_imprint_url).length,
    kapakli: active.filter(b => b.cover_photo_path || b.legacy_cover_url).length,
    kategori: category, fiziksel: physical, ocr: {}, gunluk: [],
    kisiler: [...people.values()].sort((a, b) => b.toplam - a.toplam),
    siralar: [...shelfStats.values()].sort((a, b) => a.sira.localeCompare(b.sira, 'tr', { numeric: true })),
    hedef: 0, uyarilar: [], sessizler: [], yedekSaat: 0,
    hesaplandi: trDate(new Date().toISOString()) };
}

async function uploadDataUrl(dataUrl: string, path: string) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error('Fotoğraf verisi okunamadı.');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  const { error } = await supabase.storage.from('library-photos').upload(path, bytes, { contentType: match[1], upsert: true });
  if (error) throw error;
  return signed(path, null);
}

async function findBook(body: Record<string, any>, includeDeleted = false) {
  let query = supabase.from('library_books').select('*');
  if (body.no) query = query.eq('legacy_no', Number(body.no));
  else query = query.eq('place_code', clean(body.yer).toUpperCase());
  if (!includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function findShelf(code: string) {
  const { data, error } = await supabase.from('library_shelf_positions').select('*').eq('code', code).single();
  if (error) throw error;
  return data;
}

async function handle(body: Record<string, any>, role: 'volunteer' | 'coordinator') {
  const action = clean(body.action);
  if (action === 'config') return { ok: true, org: 'Tarih Vakfı',
    kategoriler: { gidecek:{ad:'Gidecek',renk:'#2e6440'}, belki:{ad:'Gitse de olur',renk:'#a06a12'}, gitmeyecek:{ad:'Gitmeyecek',renk:'#9c2233'}, belirsiz:{ad:'Belirsiz',renk:'#2a5b86'} },
    durumlar: ['Sağlam','Yıpranmış','Küflü/böcekli'], kurallar: [],
    mekanlar: [{kod:'G',ad:'Giriş Kat',rafSayisi:53},{kod:'U',ad:'Üst Kat',rafBaslangic:53,rafSayisi:7},{kod:'X',ad:'Diğer',rafSayisi:6}],
    siniflandirilmadi:'Sınıflandırılmadı', kutuKullan:false,
    rafHarfleri:Array.from({length:60},(_,i)=>{let n=i+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}), siraSayisi:6 };
  if (coordinatorActions.has(action) && role !== 'coordinator') return { ok:false, sifreHatasi:true, error:'Yetkili şifresi hatalı.' };

  if (action === 'katalog' || action === 'kararBekleyen') return catalog(action === 'kararBekleyen' ? { yalnizOnayli:true, yalnizKararsiz:true, sirala:'yer', adet:body.adet } : body);
  if (action === 'durum') return dashboard();
  if (action === 'siraHaritasi' || action === 'siraHaritasiKisa' || action === 'siraOzeti') return shelfMap();
  if (action === 'koordinatorBaslangic') {
    const ctx = await loadContext();
    const [kararlar, durum, rafOzeti] = await Promise.all([catalog({yalnizOnayli:true,yalnizKararsiz:true,sirala:'yer',bas:0,adet:body.adet||20},ctx), dashboard(ctx), shelfMap(ctx)]);
    return { ok:true, kararlar, durum, rafOzeti };
  }
  if (action === 'sayac') {
    const books = (await all('library_books')).filter((b:any)=>!b.deleted_at);
    const today = new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'}), who=normalizeName(body.kaydeden);
    return {ok:true,toplam:books.length,bugun:books.filter((b:any)=>new Date(b.recorded_at).toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'})===today).length,
      benim:books.filter((b:any)=>normalizeName(b.recorded_by_name)===who&&new Date(b.recorded_at).toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'})===today).length,
      bekleyen:books.filter((b:any)=>!b.bibliography_approved_at).length};
  }
  if (action === 'rafDurum') {
    const code=shelfCode(body), map=await shelfMap(), row=map.siralar.find((x:any)=>x.sira===code);
    if(!row) throw new Error('Raf bulunamadı.');
    const books=(await all('library_books')).filter((b:any)=>!b.deleted_at&&b.place_code.startsWith(`${code}-`));
    return {ok:true,anahtar:code,sonNo:Math.max(0,...books.map((b:any)=>Number(b.position_number))),adet:books.length,cilt:books.reduce((n:number,b:any)=>n+Number(b.copies||1),0),
      durum:row.durum,bitiren:row.bitiren,bitisTarihi:row.tarih,raftaki:row.raftaki,sonCalisan:books[0]?.recorded_by_name||'',sonTarih:trDate(books[0]?.recorded_at),tutulu:row.tutulu,tutan:row.tutan,onSayim:row.onSayim,sayim:row.sayim,devir:null};
  }
  if (action === 'sayimBilgisi') {
    const shelf=await findShelf(shelfCode(body));
    const {data,error}=await supabase.from('library_shelf_counts').select('*').eq('shelf_position_id',shelf.id).order('counted_at',{ascending:false}).limit(12); if(error)throw error;
    return {ok:true,anahtar:shelf.code,sayim:currentCount(data||[])||{toplam:null,durum:'',duzen:'tek'},gecmis:(data||[]).map((c:any)=>({...currentCount([c]),islem:c.kind,tarih:trDate(c.counted_at),kim:c.counted_by_name}))};
  }
  if (action === 'rafFotograflari') {
    const shelf=await findShelf(shelfCode(body));
    const {data,error}=await supabase.from('library_shelf_counts').select('*').eq('shelf_position_id',shelf.id).order('counted_at',{ascending:false}); if(error)throw error;
    const urls=[]; for(const c of data||[]){const u=await signed(c.photo_path,c.legacy_photo_url);if(u&&!urls.includes(u))urls.push(u);}
    return {ok:true,anahtar:shelf.code,fotograflar:urls.map((url,i)=>({url,ad:`Raf fotoğrafı ${i+1}`})),foto:urls[0]||''};
  }
  if (action === 'sonKayitlar') {
    let books=(await all('library_books')).filter((b:any)=>!b.deleted_at);
    const who=normalizeName(body.kaydeden); if(who)books=books.filter((b:any)=>normalizeName(b.recorded_by_name)===who);
    books.sort((a:any,b:any)=>new Date(b.recorded_at).valueOf()-new Date(a.recorded_at).valueOf());
    const ctx=await loadContext(); return {ok:true,kayitlar:await Promise.all(books.slice(0,20).map((b:any)=>legacyBook(ctx,b,false)))};
  }
  if (action === 'kayitBul') {
    const active=await findBook(body), anyBook=active||await findBook(body,true);
    if(!active)return {ok:true,bulundu:false,silinmis:!!anyBook,yer:clean(body.yer).toUpperCase()};
    const ctx=await loadContext();return {ok:true,bulundu:true,silinmis:false,yer:active.place_code,kayit:await legacyBook(ctx,active)};
  }
  if (action === 'istenenler') {
    const books=(await all('library_books')).filter((b:any)=>!b.deleted_at&&b.requested_reason);
    const ctx=await loadContext();return {ok:true,kayitlar:await Promise.all(books.slice(0,40).map(async(b:any)=>{const k=await legacyBook(ctx,b,false);return {no:k.no,yer:k.yer,baslik:k.baslik,yazar:k.yazar,sebep:b.requested_reason};}))};
  }
  if (action === 'siraSec' || action === 'siraOner') {
    const name=clean(body.kaydeden); let shelf:any, suggested:any=null;
    if(action==='siraOner'){
      const shelves=(await shelfMap()).siralar;
      suggested=shelves.find((s:any)=>normalizeName(s.tutan)===normalizeName(name)&&s.durum!=='bitti');
      if(!suggested)suggested=shelves.find((s:any)=>s.durum!=='bitti'&&!s.tutulu&&s.onSayim==null) || shelves.find((s:any)=>s.durum!=='bitti'&&!s.tutulu);
      if(!suggested)return {ok:true,tur:'bitti',anahtar:''};
      shelf=await findShelf(suggested.sira);
    }else shelf=await findShelf(shelfCode(body));
    const alreadyMine=normalizeName(shelf.assigned_by_name)===normalizeName(name);
    const {error}=await supabase.from('library_shelf_positions').update({assigned_at:new Date().toISOString(),assigned_by_name:name}).eq('id',shelf.id);if(error)throw error;
    return {ok:true,anahtar:shelf.code,tur:suggested?.durum==='devam'?'devam':'bos',zatenSizde:alreadyMine,kalanBos:0,tutulan:0};
  }
  if (action === 'siraBirak') {
    const name=normalizeName(body.kaydeden), shelves=await all('library_shelf_positions'); const ids=shelves.filter((s:any)=>normalizeName(s.assigned_by_name)===name&&!s.completed_at&&(!body.anahtar||s.code===clean(body.anahtar))).map((s:any)=>s.id);
    if(ids.length){const {error}=await supabase.from('library_shelf_positions').update({assigned_at:null,assigned_by_name:null}).in('id',ids);if(error)throw error;}
    return {ok:true,birakilan:shelves.filter((s:any)=>ids.includes(s.id)).map((s:any)=>s.code)};
  }
  if (action === 'siraBitir') {
    const shelf=await findShelf(shelfCode(body));const {error}=await supabase.from('library_shelf_positions').update({completed_at:new Date().toISOString(),completed_by_name:clean(body.bitiren||body.kaydeden),closing_count:Number(body.raftaki)||0,closing_note:clean(body.not)||null,assigned_at:null,assigned_by_name:null}).eq('id',shelf.id);if(error)throw error;
    return {ok:true,anahtar:shelf.code,raftaki:Number(body.raftaki)||0};
  }
  if (action === 'sayimKaydet') {
    const shelf=await findShelf(shelfCode(body)), unavailable=!!body.sayilamadi, layout=body.duzen==='iki'?'double':'single';
    const front=unavailable?null:Number(body.on??body.adet), back=layout==='double'&&!body.arkaSayilamadi?Number(body.arka):null;
    if(!unavailable&&(!Number.isFinite(front)||front<0))throw new Error('Sayılan kitap sayısını yazın.');
    let photoPath=null, uploadedPhotoUrl='';if(body.foto){photoPath=`shelves/${shelf.code}/${crypto.randomUUID()}.jpg`;uploadedPhotoUrl=await uploadDataUrl(clean(body.foto),photoPath);}
    const rows=await all('library_shelf_counts');const old=rows.filter((c:any)=>c.shelf_position_id===shelf.id).sort((a:any,b:any)=>new Date(b.counted_at).valueOf()-new Date(a.counted_at).valueOf())[0];
    const total=(front||0)+(back||0), second=!!body.ikinci&&old;
    const insert:any={shelf_position_id:shelf.id,kind:second?'control':(old?'correction':'initial'),status:unavailable?'could_not_count':(second&&Number(old.total_count)===total?'approved':(second?'disputed':'counted')),layout,front_count:front,back_count:back,back_unavailable:!!body.arkaSayilamadi,note:clean(body.not)||null,photo_path:photoPath,counted_by_name:clean(body.sayan),counted_at:new Date().toISOString()};
    if(insert.status==='approved'){insert.approved_by_name=clean(body.sayan);insert.approved_at=new Date().toISOString();}
    const {error}=await supabase.from('library_shelf_counts').insert(insert);if(error)throw error;
    return {ok:true,anahtar:shelf.code,ikinci:second,adet:total,ilkSayim:old?.total_count,uyustu:second?Number(old.total_count)===total:false,durum:insert.status==='approved'?'onaylandi':(unavailable?'sayilamadi':'sayildi'),onSira:front,arkaSira:back,duzen:layout==='double'?'iki':'tek',eksik:!!body.arkaSayilamadi,fotoUrl:uploadedPhotoUrl};
  }
  if (action === 'sayimOnayla') {
    const shelf=await findShelf(shelfCode(body));const {data,error}=await supabase.from('library_shelf_counts').select('*').eq('shelf_position_id',shelf.id).order('counted_at',{ascending:false}).limit(1).single();if(error)throw error;
    const update:any={status:'approved',approved_by_name:clean(body.onaylayan),approved_at:new Date().toISOString()};if(body.gecerli!=null&&body.gecerli!==''){update.front_count=Number(body.gecerli);update.back_count=null;update.layout='single';}
    const {error:e}=await supabase.from('library_shelf_counts').update(update).eq('id',data.id);if(e)throw e;return {ok:true,anahtar:shelf.code,adet:update.front_count??data.total_count,durum:'onaylandi'};
  }
  if (action === 'sayimGeriAl') {
    const shelf=await findShelf(shelfCode(body));const {data,error}=await supabase.from('library_shelf_counts').select('*').eq('shelf_position_id',shelf.id).order('counted_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;if(!data)throw new Error('Geri alınacak sayım bulunamadı.');
    const {error:e}=await supabase.from('library_shelf_counts').delete().eq('id',data.id);if(e)throw e;const {data:prev}=await supabase.from('library_shelf_counts').select('*').eq('shelf_position_id',shelf.id).order('counted_at',{ascending:false}).limit(1).maybeSingle();return {ok:true,anahtar:shelf.code,geriAlinanSayi:data.total_count,temizlendi:!prev,adet:prev?.total_count??null};
  }
  if (action === 'ekle') {
    const k=body.kayit||{}, code=`${clean(k.mekan).toUpperCase()}-${clean(k.raf).toUpperCase()}${String(Number(k.sira)||1).padStart(2,'0')}`, shelf=await findShelf(code);
    if(body.istemciId){const {data}=await supabase.from('library_books').select('*').eq('client_id',clean(body.istemciId)).maybeSingle();if(data)return {ok:true,no:data.legacy_no,yerKodu:data.place_code,siraNo:data.position_number,tekrar:true};}
    const books=await all('library_books');const no=Math.max(0,...books.map((b:any)=>Number(b.legacy_no)||0))+1;const used=books.filter((b:any)=>b.shelf_position_id===shelf.id).map((b:any)=>Number(b.position_number));let pos=Math.max(1,Number(body.siraNo)||1);while(used.includes(pos))pos++;const place=`${code}-${String(pos).padStart(3,'0')}`;
    const row={legacy_no:no,client_id:clean(body.istemciId)||null,shelf_position_id:shelf.id,position_number:pos,place_code:place,author:clean(k.yazar)||null,title:clean(k.baslik)||'Künye fotoğraftan tamamlanacak',publication_year:/^\d{4}$/.test(clean(k.yil))?Number(k.yil):null,copies:Math.max(1,Number(k.nusha)||1),condition:conditionCodes[clean(k.durum)]||'good',note:clean(k.not)||null,recorded_by_name:clean(k.kaydeden),recorded_at:new Date().toISOString()};
    const {error}=await supabase.from('library_books').insert(row);if(error)throw error;return {ok:true,no,yerKodu:place,siraNo:pos,duzeltildi:pos!==Number(body.siraNo),rafAdet:used.length+1};
  }
  if (action === 'guncelle') {
    const book=await findBook({no:body.no});if(!book)throw new Error('Kayıt bulunamadı.');const k=body.kayit||{};const update:any={requested_reason:null,requested_by_name:null,requested_at:null};
    if(k.yazar!=null)update.author=clean(k.yazar)||null;if(k.baslik!=null)update.title=clean(k.baslik)||null;if(k.yil!=null)update.publication_year=/^\d{4}$/.test(clean(k.yil))?Number(k.yil):null;if(k.nusha!=null)update.copies=Math.max(1,Number(k.nusha)||1);if(k.durum!=null)update.condition=conditionCodes[clean(k.durum)]||book.condition;if(k.not!=null)update.note=clean(k.not)||null;
    const {error}=await supabase.from('library_books').update(update).eq('id',book.id);if(error)throw error;return {ok:true,no:book.legacy_no};
  }
  if (action === 'sil') {const book=await findBook({no:body.no});if(!book)return {ok:true,no:Number(body.no)};const {error}=await supabase.from('library_books').update({deleted_at:new Date().toISOString()}).eq('id',book.id);if(error)throw error;return {ok:true,no:book.legacy_no};}
  if (action === 'fotoEkle' || action === 'fotoBagla') {
    const book=await findBook({no:body.no});if(!book)throw new Error('Kayıt bulunamadı.');const cover=body.hangi==='kapak', field=cover?'cover_photo_path':'imprint_photo_path', legacy=cover?'legacy_cover_url':'legacy_imprint_url';let update:any={};let url='';
    if(action==='fotoBagla'){url=clean(body.url);update[legacy]=url;}else{const path=`books/${book.id}/${cover?'cover':'imprint'}.jpg`;url=await uploadDataUrl(clean(body.veri),path);update[field]=path;update[legacy]=null;}const {error}=await supabase.from('library_books').update(update).eq('id',book.id);if(error)throw error;return {ok:true,no:book.legacy_no,url,fotoUrl:url};
  }
  if (action === 'kitapIste') {const book=await findBook({no:body.no});if(!book)throw new Error('Kayıt bulunamadı.');const reason=clean(body.sebep).slice(0,500)||'Koordinatör kitabı görmek istiyor';const {error}=await supabase.from('library_books').update({requested_reason:reason,requested_by_name:clean(body.isteyen),requested_at:new Date().toISOString()}).eq('id',book.id);if(error)throw error;return {ok:true,no:book.legacy_no};}
  if (action === 'kararVer') {
    const nums=(body.numaralar||(body.no?[body.no]:[])).map(Number), code=choices[clean(body.kategori)];if(!code)throw new Error('Karar seçilmeli.');const name=clean(body.veren||body.onaylayan);let first:any=null;const written=[];const skipped=[];
    for(const no of nums){const book=await findBook({no});if(!book){skipped.push({no,neden:'bulunamadı'});continue;}if(!book.bibliography_approved_at){skipped.push({no,neden:'künyesi onaylanmamış'});continue;}const {data:final}=await supabase.from('library_decision_resolutions').select('*').eq('book_id',book.id).maybeSingle();if(final&&!body.uzerineYaz){skipped.push({no,neden:`kararı kesinleşmiş: ${choiceNames[final.choice]}`});continue;}if(body.uzerineYaz){await supabase.from('library_decision_resolutions').delete().eq('book_id',book.id);await supabase.from('library_decision_opinions').delete().eq('book_id',book.id);}
      const voterKey=normalizeName(name), note=clean(body.kural).replace(/^Diğer:\s*/i,'')==='Yetkili kararı'?'':clean(body.kural).replace(/^Diğer:\s*/i,'');const {data:existing}=await supabase.from('library_decision_opinions').select('id').eq('book_id',book.id).eq('voter_key',voterKey).maybeSingle();let e;if(existing)({error:e}=await supabase.from('library_decision_opinions').update({voter_name:name,choice:code,note:note||null,updated_at:new Date().toISOString()}).eq('id',existing.id));else({error:e}=await supabase.from('library_decision_opinions').insert({book_id:book.id,voter_name:name,choice:code,note:note||null}));if(e)throw e;
      const {data:d,error:de}=await supabase.from('library_book_decision_status').select('*').eq('book_id',book.id).single();if(de)throw de;first=d;written.push(no);
    }
    const ops=(first?.opinions||[]).map((o:any)=>({kategori:choiceCodes[o.choice],kategoriAdi:choiceNames[o.choice],veren:o.voter_name,tarih:o.updated_at,not:o.note||''}));return {ok:true,yazilan:written,atlanan:skipped,kesinlesti:!!first?.final_choice,kararDurumu:first?.final_choice?'kesin':'gorus_bekliyor',gorusler:ops,kategori:first?.final_choice?choiceNames[first.final_choice]:'',kural:body.kural||'',kararVeren:name,kararTarihi:trDate(new Date())};
  }
  if (action === 'kararGorusGeriAl') {
    const nums=(body.numaralar||(body.no?[body.no]:[])).map(Number), name=clean(body.veren||body.onaylayan), written=[], skipped=[];let first:any=null;
    for(const no of nums){const book=await findBook({no});if(!book){skipped.push({no,neden:'bulunamadı'});continue;}const {data:final}=await supabase.from('library_decision_resolutions').select('book_id').eq('book_id',book.id).maybeSingle();if(final){skipped.push({no,neden:'karar kesinleşmiş; karar bekleyenlere geri alınmalı'});continue;}const {data:op}=await supabase.from('library_decision_opinions').select('*').eq('book_id',book.id).eq('voter_key',normalizeName(name)).maybeSingle();if(!op){skipped.push({no,neden:'bu kitapta size ait görüş bulunamadı'});continue;}const {error}=await supabase.from('library_decision_opinions').delete().eq('id',op.id);if(error)throw error;const {data:d}=await supabase.from('library_book_decision_status').select('*').eq('book_id',book.id).single();first=d;written.push(no);}
    const ops=(first?.opinions||[]).map((o:any)=>({kategori:choiceCodes[o.choice],kategoriAdi:choiceNames[o.choice],veren:o.voter_name,tarih:o.updated_at,not:o.note||''}));return {ok:true,yazilan:written,atlanan:skipped,gorusler:ops,kararDurumu:ops.length?(Number(first?.distinct_choice_count)>1?'gorus_ayriligi':'ikinci_gorus_bekliyor'):'gorus_bekliyor',kararVeren:name,kararTarihi:trDate(new Date())};
  }
  if (action === 'kararGeriAl') {const nums=(body.numaralar||(body.no?[body.no]:[])).map(Number),written=[],skipped=[];for(const no of nums){const book=await findBook({no});if(!book){skipped.push({no,neden:'bulunamadı'});continue;}const {data}=await supabase.from('library_decision_resolutions').delete().eq('book_id',book.id).select();if(!data?.length){skipped.push({no,neden:'zaten karar bekliyor'});continue;}await supabase.from('library_decision_opinions').delete().eq('book_id',book.id);written.push(no);}return {ok:true,yazilan:written,atlanan:skipped,kararVeren:clean(body.veren),kararTarihi:trDate(new Date())};}
  if (action === 'onayBekleyen') {const ctx=await loadContext();const pending=ctx.books.filter((b:any)=>!b.deleted_at&&!b.bibliography_approved_at);const books=pending.slice(0,Math.min(100,Number(body.adet)||25));return {ok:true,kayitlar:await Promise.all(books.map((b:any)=>legacyBook(ctx,b))),kalan:pending.length};}
  if (action === 'onayGruplari') {const ctx=await loadContext();const pending=ctx.books.filter((b:any)=>!b.deleted_at&&!b.bibliography_approved_at);return {ok:true,gruplar:[],kalan:pending.length,onerisiz:pending.length};}
  if (action === 'onayla') {const book=await findBook({no:body.no});if(!book)throw new Error('Kayıt bulunamadı.');const k=body.kayit||body;const update:any={author:clean(k.yazar)||null,title:clean(k.baslik)||null,publication_year:/^\d{4}$/.test(clean(k.yil))?Number(k.yil):null,copies:Math.max(1,Number(k.nusha)||1),note:clean(k.not)||null,bibliography_approved_at:new Date().toISOString(),bibliography_approved_by_name:clean(k.onaylayan),requested_reason:null,requested_by_name:null,requested_at:null};const {error}=await supabase.from('library_books').update(update).eq('id',book.id);if(error)throw error;return {ok:true,no:book.legacy_no,yalnizKunye:!!k.yalnizKunye};}
  if (action === 'kunyeErtele') return {ok:true,no:Number(body.no)};
  if (action === 'kutula') {
    const nums=(body.numaralar||[]).map(Number).filter(Boolean);if(!nums.length)throw new Error('Kutulanacak kayıt seçilmedi.');if(nums.length>400)throw new Error('Tek kutuda en fazla 400 kayıt.');
    const raw=clean(body.kutu).replace(/^[YyDd]-/,'');if(!/^\d{1,4}$/.test(raw))throw new Error('Kutu numarası 1–4 haneli olmalı.');
    const storage=clean(body.hedef)==='depo', code=`${storage?'D':'Y'}-${String(Number(raw)).padStart(3,'0')}`;
    let {data:box,error:boxError}=await supabase.from('library_boxes').select('*').eq('code',code).maybeSingle();if(boxError)throw boxError;
    if(!box){const created=await supabase.from('library_boxes').insert({code,destination:storage?'storage':'new_library',packed_by_name:clean(body.paketleyen),note:clean(body.not)||null}).select().single();if(created.error)throw created.error;box=created.data;}
    const {data:books,error}=await supabase.from('library_books').select('*').in('legacy_no',nums).is('deleted_at',null);if(error)throw error;
    const accepted=(books||[]).filter((b:any)=>!b.box_id||b.box_id===box.id), skipped=(books||[]).length-accepted.length;
    if(!accepted.length)throw new Error('Bu kayıtlar zaten başka kutuda.');
    const {error:updateError}=await supabase.from('library_books').update({box_id:box.id}).in('id',accepted.map((b:any)=>b.id));if(updateError)throw updateError;
    const places=accepted.map((b:any)=>b.place_code).filter(Boolean).sort((a:string,b:string)=>a.localeCompare(b,'tr',{numeric:true}));
    return {ok:true,kutu:code,hedef:storage?'DEPO':'YENİ BİNA',yazilan:accepted.length,cilt:accepted.reduce((n:number,b:any)=>n+Number(b.copies||1),0),atlanan:skipped+(nums.length-(books||[]).length),aralik:places.length?(places[0]===places.at(-1)?places[0]:`${places[0]} → ${places.at(-1)}`):''};
  }
  if (action === 'kutular') {const boxes=await all('library_boxes');const books=(await all('library_books')).filter((b:any)=>!b.deleted_at);return {ok:true,kutular:boxes.map((b:any)=>b.code).sort((a:string,b:string)=>a.localeCompare(b,'tr',{numeric:true})),siralar:[...new Set(books.map((b:any)=>b.place_code.replace(/-\d+$/,'')))].sort((a:string,b:string)=>a.localeCompare(b,'tr',{numeric:true}))};}
  if (action === 'iletisimGonder') {
    const row = {
      page: clean(body.sayfa) || 'Site', message_type: clean(body.tur) || 'mesaj',
      sender_name: clean(body.ad) || 'İsimsiz', sender_contact: clean(body.iletisim) || null,
      subject: clean(body.konu) || null, message: clean(body.mesaj),
      context: { baglam: clean(body.baglam) }, delivery_status: 'pending',
    };
    if (row.message.length < 5) throw new Error('Mesajınızı biraz daha açık yazın.');
    const inserted = await supabase.from('library_contact_messages').insert(row).select('id').single();
    if (inserted.error) throw inserted.error;

    const apiKey = clean(Deno.env.get('RESEND_API_KEY'));
    const recipient = clean(Deno.env.get('LIBRARY_CONTACT_EMAIL')) || 'arif.solmaz@gmail.com';
    const sender = clean(Deno.env.get('RESEND_FROM_EMAIL')) || 'Tarih Vakfı Kütüphanesi <onboarding@resend.dev>';
    if (!apiKey) {
      await supabase.from('library_contact_messages').update({ delivery_status: 'failed' }).eq('id', inserted.data.id);
      return { ok:true, mailGonderildi:false, mesaj:'Mesajınız kaydedildi ancak e-posta bağlantısı henüz etkin değil.' };
    }

    const typeLabels: Record<string, string> = {
      soru: 'Soru', duzeltme: 'Düzeltme', oneri: 'Öneri', iletisim: 'İletişim isteği',
    };
    const typeLabel = typeLabels[row.message_type] || row.message_type;
    const subject = `[Kütüphane] ${typeLabel}${row.subject ? `: ${row.subject}` : ''}`.slice(0, 180);
    const context = clean((row.context as Record<string, unknown>).baglam);
    const textBody = [
      `Gönderen: ${row.sender_name}`, `İletişim: ${row.sender_contact || 'Belirtilmedi'}`,
      `Sayfa: ${row.page}`, `Tür: ${typeLabel}`, context ? `Bağlam: ${context}` : '',
      '', row.message,
    ].filter(value => value !== '').join('\n');
    const replyTo = row.sender_contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.sender_contact)
      ? row.sender_contact : undefined;
    const mailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: sender, to: [recipient], subject, reply_to: replyTo,
        text: textBody,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#241b20;max-width:680px">
          <h2 style="color:#5b123b">Tarih Vakfı kütüphane mesajı</h2>
          <p><strong>Gönderen:</strong> ${html(row.sender_name)}<br>
          <strong>İletişim:</strong> ${html(row.sender_contact || 'Belirtilmedi')}<br>
          <strong>Sayfa:</strong> ${html(row.page)}<br>
          <strong>Tür:</strong> ${html(typeLabel)}${context ? `<br><strong>Bağlam:</strong> ${html(context)}` : ''}</p>
          <div style="padding:16px;border-left:4px solid #5b123b;background:#f8f1f5;white-space:pre-wrap">${html(row.message)}</div>
        </div>`,
      }),
    });
    if (!mailResponse.ok) {
      const detail = (await mailResponse.text()).slice(0, 500);
      console.error('Resend delivery failed', mailResponse.status, detail);
      await supabase.from('library_contact_messages').update({ delivery_status: 'failed' }).eq('id', inserted.data.id);
      return { ok:true, mailGonderildi:false, mesaj:'Mesajınız kaydedildi ancak e-posta gönderilemedi. Sistem yöneticisi kaydı görebilir.' };
    }
    await supabase.from('library_contact_messages').update({
      delivery_status: 'sent', delivered_at: new Date().toISOString(),
    }).eq('id', inserted.data.id);
    return { ok:true, mailGonderildi:true, mesaj:`Mesajınız ${recipient} adresine e-posta olarak iletildi.` };
  }
  throw new Error(`Bilinmeyen istek: ${action}`);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Yalnızca POST isteği kabul edilir.', 405);
  try {
    const body = await req.json();
    const action = clean(body.action);
    if (action === 'config') return result(await handle(body, 'volunteer'));
    const supplied = clean(body.sifre);
    const coordinatorPassword = clean(Deno.env.get('LIBRARY_COORDINATOR_PASSWORD'));
    const volunteerPassword = clean(Deno.env.get('LIBRARY_VOLUNTEER_PASSWORD'));
    const role = supplied && coordinatorPassword && supplied === coordinatorPassword ? 'coordinator'
      : (supplied && volunteerPassword && supplied === volunteerPassword ? 'volunteer' : null);
    if (!role) return result({ ok:false, sifreHatasi:true, error: coordinatorActions.has(action) ? 'Yetkili şifresi hatalı.' : 'Çalışma şifresi hatalı. Karttaki şifreyi baştan yazın.' });
    return result(await handle(body, role));
  } catch (error) {
    console.error(error);
    return fail(error, 500);
  }
});
