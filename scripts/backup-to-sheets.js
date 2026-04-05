#!/usr/bin/env node
/**
 * Tarih Vakfi — Nightly Backup to Google Sheets
 *
 * Supabase'den tum tablolari ceker, Google Sheets'e yazar.
 * Sheets ID'yi Supabase backups tablosundan alir (tek dosya mantigi).
 * Yoksa yeni olusturur ve ID'yi kaydeder.
 *
 * Gerekli env:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY,
 *   GOOGLE_SERVICE_ACCOUNT (JSON string)
 *   GOOGLE_SHEETS_ID (opsiyonel — override)
 */

const { google } = require('googleapis');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SA_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
const OVERRIDE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || '';

if (!SUPABASE_URL || !SUPABASE_KEY || !SA_KEY.client_email) {
  console.error('Eksik: SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_SERVICE_ACCOUNT');
  process.exit(1);
}

// ── Supabase REST ──
async function sbGet(table, select = '*', extra = '') {
  const params = new URLSearchParams({ select });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}${extra ? '&' + extra : ''}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status}`);
  return res.json();
}

async function sbInsert(table, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
}

// ── Helpers ──
const fdate = d => { if (!d) return ''; const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}.${String(x.getMonth()+1).padStart(2,'0')}.${x.getFullYear()}`; };
const fdatetime = d => { if (!d) return ''; const x = new Date(d); return `${fdate(d)} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; };

// ── Main ──
async function main() {
  console.log('Tarih Vakfi Backup basliyor...');
  const startTime = Date.now();

  // Veri cek
  console.log('Supabase verileri cekiliyor...');
  const [profiles, tasks, hours, shifts, anns, apps, reqs, msgs, comments, progress, shiftNotes, notifs, workReports] = await Promise.all([
    sbGet('profiles', 'id,display_name,email,phone,role,department,status,total_hours,city,joined_at', 'order=display_name.asc'),
    sbGet('tasks', '*', 'order=created_at.desc'),
    sbGet('hour_logs', '*', 'order=date.desc'),
    sbGet('shifts', '*', 'order=day_of_week.asc'),
    sbGet('announcements', '*', 'order=created_at.desc'),
    sbGet('applications', '*', 'order=applied_at.desc'),
    sbGet('requests', '*', 'order=created_at.desc'),
    sbGet('messages', '*', 'order=created_at.desc'),
    sbGet('task_comments', '*', 'order=created_at.desc'),
    sbGet('task_progress_logs', '*', 'order=created_at.desc'),
    sbGet('shift_notes', '*', 'order=created_at.desc'),
    sbGet('notifications', '*', 'order=created_at.desc'),
    sbGet('work_reports', '*', 'order=date.desc'),
  ]);

  const name = id => profiles.find(p => p.id === id)?.display_name || '';
  const taskName = id => tasks.find(t => t.id === id)?.title || '';

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
    { name: 'Calisma Raporlari', headers: ['Gonullu','Tarih','Saat','Nerede','Aciklama','Plan','Durum','Kaynak'], rows: (workReports||[]).map(r => [name(r.user_id), fdate(r.date), r.hours, r.work_mode==='remote'?'Uzaktan':'Vakifta', r.description||'', r.next_plan||'', r.status, r.source||'web']) },
  ];

  // Ozet
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const totalRecords = sheets.reduce((a, s) => a + s.rows.length, 0);
  const depts = ['arsiv','egitim','etkinlik','dijital','rehber','baski','bagis','idari'];
  sheets.unshift({
    name: 'Ozet',
    headers: ['Metrik', 'Deger'],
    rows: [
      ['Son Guncelleme', fdatetime(now)],
      ['Toplam Kayit', totalRecords],
      ['Aktif Gonullu', profiles.filter(p => p.status === 'active').length],
      ['Aktif Gorev', tasks.filter(t => ['active','pending','review'].includes(t.status)).length],
      ['Bu Ay Saat', hours.filter(h => h.status === 'approved' && h.date >= monthStart).reduce((a, h) => a + Number(h.hours), 0)],
      [''],
      ['Departman', 'Gonullu', 'Bu Ay Saat', 'Aktif Gorev'],
      ...depts.map(d => [d, profiles.filter(p => p.department === d && p.status === 'active').length, hours.filter(h => h.department === d && h.status === 'approved' && h.date >= monthStart).reduce((a, h) => a + Number(h.hours), 0), tasks.filter(t => t.department === d && ['active','pending','review'].includes(t.status)).length]),
    ],
  });

  // Sheets ID: override > Supabase > yeni olustur
  console.log('Sheets ID belirleniyor...');
  let sheetsId = OVERRIDE_SHEETS_ID;
  if (!sheetsId) {
    const backups = await sbGet('backups', 'sheets_id', 'sheets_id=not.is.null&order=created_at.desc&limit=1');
    sheetsId = backups[0]?.sheets_id || '';
  }

  // Google auth
  const auth = new google.auth.GoogleAuth({ credentials: SA_KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'] });
  const sheetsApi = google.sheets({ version: 'v4', auth });
  const driveApi = google.drive({ version: 'v3', auth });
  let isNew = false;

  if (!sheetsId) {
    console.log('Yeni spreadsheet olusturuluyor...');
    const ss = await sheetsApi.spreadsheets.create({
      requestBody: {
        properties: { title: `Tarih Vakfi Yedek` },
        sheets: sheets.map(s => ({ properties: { title: s.name } })),
      },
    });
    sheetsId = ss.data.spreadsheetId;
    isNew = true;
    console.log(`Yeni sheets ID: ${sheetsId}`);
  } else {
    console.log(`Mevcut sheets: ${sheetsId}`);
    // Eksik sheet'leri ekle
    const ss = await sheetsApi.spreadsheets.get({ spreadsheetId: sheetsId });
    const existing = ss.data.sheets.map(s => s.properties.title);
    const missing = sheets.filter(s => !existing.includes(s.name));
    if (missing.length) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetsId,
        requestBody: { requests: missing.map(s => ({ addSheet: { properties: { title: s.name } } })) },
      });
    }
  }

  // Temizle + yaz
  console.log('Veriler yaziliyor...');
  for (const s of sheets) {
    try { await sheetsApi.spreadsheets.values.clear({ spreadsheetId: sheetsId, range: `'${s.name}'!A:Z` }); } catch {}
  }
  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsId,
    requestBody: { valueInputOption: 'RAW', data: sheets.map(s => ({ range: `'${s.name}'!A1`, values: [s.headers, ...s.rows] })) },
  });

  // Formatlama
  console.log('Formatlama...');
  const ssAfter = await sheetsApi.spreadsheets.get({ spreadsheetId: sheetsId });
  const fmtReqs = [];
  for (const sheet of ssAfter.data.sheets) {
    const sid = sheet.properties.sheetId;
    fmtReqs.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } });
    fmtReqs.push({ autoResizeDimensions: { dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: 20 } } });
  }
  await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId: sheetsId, requestBody: { requests: fmtReqs } });

  // Admin'lerle paylas
  const admins = profiles.filter(p => p.role === 'admin' && p.email);
  console.log(`Admin'lerle paylasiliyor (${admins.length})...`);
  for (const admin of admins) {
    try {
      await driveApi.permissions.create({
        fileId: sheetsId,
        requestBody: { type: 'user', role: 'writer', emailAddress: admin.email },
        sendNotificationEmail: false,
      });
    } catch (e) {
      // Zaten paylasilmis olabilir
      if (!e.message?.includes('already has access')) console.warn(`  Paylasim hatasi (${admin.email}): ${e.message}`);
    }
  }

  // Supabase kayit
  const adminId = admins[0]?.id;
  if (adminId) {
    await sbInsert('backups', { created_by: adminId, type: 'sheets', sheets_url: `https://docs.google.com/spreadsheets/d/${sheetsId}`, sheets_id: sheetsId, record_count: totalRecords });
    await sbInsert('notifications', { user_id: adminId, type: 'system', title: 'Otomatik yedekleme tamamlandi', body: `${totalRecords} kayit Google Sheets'e aktarildi. (${fdatetime(now)})` });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nBasarili! ${totalRecords} kayit ${sheets.length} sheet. (${elapsed}s)`);
  console.log(`Sheets: https://docs.google.com/spreadsheets/d/${sheetsId}`);
}

main().catch(err => { console.error('HATA:', err.message); process.exit(1); });
