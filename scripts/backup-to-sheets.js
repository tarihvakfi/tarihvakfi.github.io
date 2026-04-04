#!/usr/bin/env node
/**
 * Tarih Vakfi — Nightly Backup to Google Sheets
 *
 * Supabase'den tum tablolari ceker, Google Sheets'e yazar.
 * GitHub Actions ile her gece calisir.
 *
 * Gerekli env:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY,
 *   GOOGLE_SERVICE_ACCOUNT (JSON string), GOOGLE_SHEETS_ID
 */

const { google } = require('googleapis');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SHEETS_ID = process.env.SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const SA_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');

if (!SUPABASE_URL || !SUPABASE_KEY || !SHEETS_ID || !SA_KEY.client_email) {
  console.error('Eksik environment variable. Gerekli: SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_SERVICE_ACCOUNT, GOOGLE_SHEETS_ID');
  process.exit(1);
}

// ── Supabase REST helpers ──
async function supabaseGet(table, select = '*', order = '') {
  const params = new URLSearchParams({ select });
  if (order) params.set('order', order);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) console.warn(`Supabase insert ${table}: ${res.status}`);
}

// ── Helpers ──
const fdate = d => {
  if (!d) return '';
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`;
};
const fdatetime = d => {
  if (!d) return '';
  const x = new Date(d);
  return `${fdate(d)} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};

// ── Main ──
async function main() {
  console.log('Tarih Vakfi Backup basliyor...');
  const startTime = Date.now();

  // 1. Supabase'den veri cek
  console.log('Supabase verileri cekiliyor...');
  const [profiles, tasks, hours, shifts, anns, apps, reqs, msgs, comments, progress, shiftNotes, notifs] = await Promise.all([
    supabaseGet('profiles', 'id,display_name,email,phone,role,department,status,total_hours,city,joined_at', 'display_name.asc'),
    supabaseGet('tasks', '*', 'created_at.desc'),
    supabaseGet('hour_logs', '*', 'date.desc'),
    supabaseGet('shifts', '*', 'day_of_week.asc'),
    supabaseGet('announcements', '*', 'created_at.desc'),
    supabaseGet('applications', '*', 'applied_at.desc'),
    supabaseGet('requests', '*', 'created_at.desc'),
    supabaseGet('messages', '*', 'created_at.desc'),
    supabaseGet('task_comments', '*', 'created_at.desc'),
    supabaseGet('task_progress_logs', '*', 'created_at.desc'),
    supabaseGet('shift_notes', '*', 'created_at.desc'),
    supabaseGet('notifications', '*', 'created_at.desc'),
  ]);

  const profMap = Object.fromEntries(profiles.map(p => [p.id, p.display_name]));
  const taskMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));
  const name = id => profMap[id] || '';
  const taskName = id => taskMap[id] || '';

  // Sheet definitions
  const sheets = [
    { name: 'Gonulluler', headers: ['Ad','E-posta','Telefon','Rol','Departman','Durum','Toplam Saat','Sehir','Kayit'], rows: profiles.map(p => [p.display_name, p.email||'', p.phone||'', p.role, p.department||'', p.status, p.total_hours||0, p.city||'', fdate(p.joined_at)]) },
    { name: 'Gorevler', headers: ['Baslik','Departman','Oncelik','Durum','Ilerleme','Deadline','Atanan','Olusturan','Tarih'], rows: tasks.map(t => [t.title, t.department, t.priority, t.status, `${t.progress||0}%`, fdate(t.deadline), (t.assigned_to||[]).map(name).join(', '), name(t.created_by), fdate(t.created_at)]) },
    { name: 'Saat Kayitlari', headers: ['Gonullu','Tarih','Saat','Departman','Aciklama','Durum','Onaylayan'], rows: hours.map(h => [name(h.volunteer_id), fdate(h.date), h.hours, h.department, h.description||'', h.status, name(h.reviewed_by)]) },
    { name: 'Vardiyalar', headers: ['Gonullu','Gun','Baslangic','Bitis','Departman','Not'], rows: shifts.map(s => [name(s.volunteer_id), s.day_of_week, s.start_time?.slice(0,5)||'', s.end_time?.slice(0,5)||'', s.department, s.note||'']) },
    { name: 'Duyurular', headers: ['Baslik','Icerik','Yazar','Departman','Sabitlenen','Tarih'], rows: anns.map(a => [a.title, a.body||'', name(a.author_id), a.department||'Herkese', a.is_pinned?'Evet':'Hayir', fdate(a.created_at)]) },
    { name: 'Basvurular', headers: ['Ad','E-posta','Telefon','Departman','Motivasyon','Durum','Tarih'], rows: apps.map(a => [a.name, a.email, a.phone||'', a.department, a.motivation||'', a.status, fdate(a.applied_at)]) },
    { name: 'Talepler', headers: ['Talep Eden','Tip','Baslik','Aciklama','Durum','Hedef Dept','Onaylayan','Tarih'], rows: reqs.map(r => [name(r.user_id), r.type, r.title, r.description||'', r.status, r.target_dept||'', name(r.reviewed_by), fdate(r.created_at)]) },
    { name: 'Sohbet', headers: ['Gonderen','Departman','Mesaj','Tarih'], rows: msgs.map(m => [name(m.user_id), m.department, m.content, fdatetime(m.created_at)]) },
    { name: 'Gorev Yorumlari', headers: ['Gorev','Yazan','Yorum','Tarih'], rows: comments.map(c => [taskName(c.task_id), name(c.user_id), c.content, fdatetime(c.created_at)]) },
    { name: 'Gorev Ilerleme', headers: ['Gorev','Guncelleyen','Onceki','Yeni','Not','Tarih'], rows: progress.map(p => [taskName(p.task_id), name(p.user_id), `${p.previous_value}%`, `${p.new_value}%`, p.note||'', fdatetime(p.created_at)]) },
    { name: 'Vardiya Notlari', headers: ['Yazan','Departman','Tarih','Icerik'], rows: shiftNotes.map(n => [name(n.user_id), n.department, fdate(n.date), n.content]) },
    { name: 'Bildirimler', headers: ['Kullanici','Tip','Baslik','Icerik','Okundu','Tarih'], rows: notifs.map(n => [name(n.user_id), n.type, n.title, n.body||'', n.is_read?'Evet':'Hayir', fdatetime(n.created_at)]) },
  ];

  // Ozet
  const activeVols = profiles.filter(p => p.status === 'active').length;
  const activeTasks = tasks.filter(t => ['active','pending','review'].includes(t.status)).length;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthlyHours = hours.filter(h => h.status === 'approved' && h.date >= monthStart).reduce((a, h) => a + Number(h.hours), 0);
  const totalRecords = sheets.reduce((a, s) => a + s.rows.length, 0);

  const depts = ['arsiv','egitim','etkinlik','dijital','rehber','baski','bagis','idari'];
  const deptSummary = depts.map(d => [
    d,
    profiles.filter(p => p.department === d && p.status === 'active').length,
    hours.filter(h => h.department === d && h.status === 'approved' && h.date >= monthStart).reduce((a, h) => a + Number(h.hours), 0),
    tasks.filter(t => t.department === d && ['active','pending','review'].includes(t.status)).length,
  ]);

  sheets.unshift({
    name: 'Ozet',
    headers: ['Metrik', 'Deger'],
    rows: [
      ['Son Guncelleme', fdatetime(now)],
      ['Toplam Kayit', totalRecords],
      ['Aktif Gonullu', activeVols],
      ['Aktif Gorev', activeTasks],
      ['Bu Ay Saat', monthlyHours],
      [''],
      ['Departman', 'Gonullu', 'Bu Ay Saat', 'Aktif Gorev'],
      ...deptSummary,
    ],
  });

  // 2. Google Sheets auth
  console.log('Google Sheets baglantisi kuruluyor...');
  const auth = new google.auth.GoogleAuth({
    credentials: SA_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheetsApi = google.sheets({ version: 'v4', auth });

  // 3. Mevcut sheet'leri kontrol et / olustur
  console.log('Sheet\'ler hazirlaniyor...');
  const ss = await sheetsApi.spreadsheets.get({ spreadsheetId: SHEETS_ID });
  const existingSheets = ss.data.sheets.map(s => s.properties.title);

  const requests = [];
  for (const s of sheets) {
    if (!existingSheets.includes(s.name)) {
      requests.push({ addSheet: { properties: { title: s.name } } });
    }
  }
  if (requests.length) {
    await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId: SHEETS_ID, requestBody: { requests } });
  }

  // 4. Verileri yaz
  console.log('Veriler yaziliyor...');
  // Temizle
  for (const s of sheets) {
    try {
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: SHEETS_ID,
        range: `'${s.name}'!A:Z`,
      });
    } catch { /* sheet yeni olusturulduysa bos */ }
  }

  // Batch yaz
  const batchData = sheets.map(s => ({
    range: `'${s.name}'!A1`,
    values: [s.headers, ...s.rows],
  }));

  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEETS_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: batchData,
    },
  });

  // 5. Formatlama: kalin baslik + otomatik genislik
  console.log('Formatlama yapiliyor...');
  const ssAfter = await sheetsApi.spreadsheets.get({ spreadsheetId: SHEETS_ID });
  const fmtRequests = [];
  for (const sheet of ssAfter.data.sheets) {
    const sid = sheet.properties.sheetId;
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 } } },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    });
    fmtRequests.push({
      autoResizeDimensions: { dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: 20 } },
    });
  }
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: SHEETS_ID,
    requestBody: { requests: fmtRequests },
  });

  // 6. Supabase'e backup kaydi
  console.log('Backup kaydi olusturuluyor...');
  const adminProfiles = profiles.filter(p => p.role === 'admin');
  const adminId = adminProfiles[0]?.id;
  if (adminId) {
    await supabaseInsert('backups', {
      created_by: adminId,
      type: 'sheets',
      sheets_url: `https://docs.google.com/spreadsheets/d/${SHEETS_ID}`,
      record_count: totalRecords,
    });
    // Bildirim
    await supabaseInsert('notifications', {
      user_id: adminId,
      type: 'system',
      title: 'Otomatik yedekleme tamamlandi',
      body: `${totalRecords} kayit Google Sheets'e aktarildi. (${fdatetime(now)})`,
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nBasarili! ${totalRecords} kayit ${sheets.length} sheet'e yazildi. (${elapsed}s)`);
  console.log(`Sheets: https://docs.google.com/spreadsheets/d/${SHEETS_ID}`);
}

main().catch(err => {
  console.error('HATA:', err.message);
  process.exit(1);
});
