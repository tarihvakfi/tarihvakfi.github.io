'use client';

import { useState, useEffect } from 'react';
import * as db from '../../lib/supabase';

const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fdt = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; };
const fdate = d => { if (!d) return ''; const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}.${String(x.getMonth()+1).padStart(2,'0')}.${x.getFullYear()}`; };

const SHEETS_CONFIG = [
  { key: 'profiles', name: 'Gonulluler', headers: ['Ad','E-posta','Telefon','Rol','Departman','Durum','Toplam Saat','Sehir','Kayit Tarihi'], fmt: r => [r.display_name,r.email||'',r.phone||'',r.role,r.department||'',r.status,r.total_hours||0,r.city||'',fdate(r.joined_at)] },
  { key: 'tasks', name: 'Gorevler', headers: ['Baslik','Departman','Oncelik','Durum','Ilerleme','Deadline','Atanan','Olusturulma'], fmt: r => [r.title,r.department,r.priority,r.status,`${r.progress||0}%`,fdate(r.deadline),Array.isArray(r.assigned_to) ? r.assigned_to.join(', ') : '',fdate(r.created_at)] },
  { key: 'hours', name: 'Saat Kayitlari', headers: ['Gonullu','Tarih','Saat','Departman','Aciklama','Durum','Onaylayan'], fmt: r => [r.profiles?.display_name||'',fdate(r.date),r.hours,r.department,r.description||'',r.status,r.reviewer?.display_name||''] },
  { key: 'shifts', name: 'Vardiyalar', headers: ['Gonullu','Gun','Baslangic','Bitis','Departman'], fmt: r => [r.profiles?.display_name||'',r.day_of_week,r.start_time?.slice(0,5)||'',r.end_time?.slice(0,5)||'',r.department] },
  { key: 'announcements', name: 'Duyurular', headers: ['Baslik','Icerik','Yazar','Departman','Sabitlenmis','Tarih'], fmt: r => [r.title,r.body||'',r.profiles?.display_name||'',r.department||'Herkese',r.is_pinned?'Evet':'Hayir',fdate(r.created_at)] },
  { key: 'applications', name: 'Basvurular', headers: ['Ad','E-posta','Telefon','Departman','Motivasyon','Durum','Tarih'], fmt: r => [r.name,r.email,r.phone||'',r.department,r.motivation||'',r.status,fdate(r.applied_at)] },
  { key: 'requests', name: 'Talepler', headers: ['Talep Eden','Tip','Baslik','Aciklama','Durum','Hedef Dept','Onaylayan','Tarih'], fmt: r => [r.profiles?.display_name||'',r.type,r.title,r.description||'',r.status,r.target_dept||'',r.reviewer?.display_name||'',fdate(r.created_at)] },
  { key: 'messages', name: 'Sohbet Mesajlari', headers: ['Gonderen','Departman','Mesaj','Tarih'], fmt: r => [r.profiles?.display_name||'',r.department,r.content,fdate(r.created_at)] },
  { key: 'comments', name: 'Gorev Yorumlari', headers: ['Gorev','Yazan','Yorum','Tarih'], fmt: r => [r.tasks?.title||'',r.profiles?.display_name||'',r.content,fdate(r.created_at)] },
  { key: 'progress', name: 'Gorev Ilerleme', headers: ['Gorev','Guncelleyen','Onceki','Yeni','Not','Tarih'], fmt: r => [r.tasks?.title||'',r.profiles?.display_name||'',`${r.previous_value}%`,`${r.new_value}%`,r.note||'',fdate(r.created_at)] },
  { key: 'shiftNotes', name: 'Vardiya Notlari', headers: ['Yazan','Departman','Tarih','Icerik'], fmt: r => [r.profiles?.display_name||'',r.department,fdate(r.date),r.content] },
  { key: 'notifications', name: 'Bildirimler', headers: ['Kullanici','Tip','Baslik','Icerik','Okundu','Tarih'], fmt: r => [r.profiles?.display_name||'',r.type,r.title,r.body||'',r.is_read?'Evet':'Hayir',fdate(r.created_at)] },
  { key: 'workReports', name: 'Calisma Raporlari', headers: ['Gonullu','Tarih','Saat','Nerede','Aciklama','Plan','Durum','Kaynak','Is','Duzenlendi'], fmt: r => [r.profiles?.display_name||'',fdate(r.date),r.hours,r.work_mode==='remote'?'Uzaktan':'Vakifta',r.description||'',r.next_plan||'',r.status,r.source||'web',r.task_id?'Evet':'',r.edited_at?'Evet':''] },
];

function toCsv(headers, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}

async function downloadZip(data, uid) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  let totalRecords = 0;
  for (const cfg of SHEETS_CONFIG) {
    const rows = (data[cfg.key] || []).map(cfg.fmt);
    totalRecords += rows.length;
    zip.file(`${cfg.name}.csv`, '\uFEFF' + toCsv(cfg.headers, rows));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tarih-vakfi-yedek-${new Date().toISOString().slice(0,10)}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  await db.createBackupRecord({ created_by: uid, type: 'csv', record_count: totalRecords });
  return totalRecords;
}

async function exportToSheets(data, uid, sheetsId) {
  let token = await db.getGoogleToken();
  if (!token) {
    token = await db.reauthorizeGoogleSheets();
    if (!token) throw new Error('Google Sheets izni alinamadi. Popup engelleniyorsa izin verin, sonra tekrar deneyin.');
  }

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  let spreadsheetId = sheetsId;
  const now = new Date();
  const title = `Tarih Vakfi Yedek — ${now.toISOString().slice(0,10)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  let isNew = false;

  if (!spreadsheetId) {
    // Yeni olustur
    const sheetDefs = SHEETS_CONFIG.map(cfg => ({ properties: { title: cfg.name } }));
    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST', headers,
      body: JSON.stringify({ properties: { title }, sheets: sheetDefs }),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        localStorage.removeItem('tarihvakfi_google_token');
        throw new Error('Google Sheets izni yok veya token gecersiz. Cikis yapip Google ile tekrar giris yapin.');
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Sheets olusturulamadi');
    }
    const ss = await res.json();
    spreadsheetId = ss.spreadsheetId;
    isNew = true;
  }

  // Temizle (guncelleme ise)
  if (!isNew) {
    for (const cfg of SHEETS_CONFIG) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(cfg.name)}'!A:Z:clear`, {
        method: 'POST', headers,
      }).catch(() => {});
    }
  }

  // Veri yaz
  const batchData = [];
  let totalRecords = 0;
  for (const cfg of SHEETS_CONFIG) {
    const rows = (data[cfg.key] || []).map(cfg.fmt);
    totalRecords += rows.length;
    batchData.push({ range: `'${cfg.name}'!A1`, values: [cfg.headers, ...rows] });
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST', headers,
    body: JSON.stringify({ valueInputOption: 'RAW', data: batchData }),
  });

  // Formatlama
  const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, { headers });
  const ssData = await sheetRes.json();
  const fmtReqs = [];
  for (const sheet of (ssData.sheets || [])) {
    const sid = sheet.properties.sheetId;
    fmtReqs.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } });
    fmtReqs.push({ autoResizeDimensions: { dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: 20 } } });
  }
  if (fmtReqs.length) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST', headers, body: JSON.stringify({ requests: fmtReqs }),
    });
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Supabase'e kaydet (sheets_id dahil)
  await db.createBackupRecord({ created_by: uid, type: 'sheets', sheets_url: url, sheets_id: spreadsheetId, record_count: totalRecords });

  return { url, totalRecords, spreadsheetId };
}

export default function BackupView({ uid }) {
  const [backups, setBackups] = useState([]);
  const [sheetsId, setSheetsId] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState(null);
  const [loading, setLoading] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [lastBackup, setLastBackup] = useState(null);
  const [lastBackupDays, setLastBackupDays] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.getBackups();
      setBackups(data || []);
      if (data && data.length > 0) {
        setLastBackupDays(Math.floor((Date.now() - new Date(data[0].created_at).getTime()) / 86400000));
        setLastBackup(data[0]);
      } else {
        setLastBackupDays(999);
      }
      // Kayitli sheets ID'yi bul
      const savedId = await db.getSavedSheetsId();
      if (savedId) {
        setSheetsId(savedId);
        setSheetsUrl(`https://docs.google.com/spreadsheets/d/${savedId}`);
      }
    })();
  }, []);

  const handleCsv = async () => {
    setLoading('csv'); setError(''); setResult(null);
    try {
      const data = await db.getAllDataForBackup();
      const count = await downloadZip(data, uid);
      setResult({ type: 'csv', count });
      const { data: b } = await db.getBackups(); setBackups(b || []);
    } catch (e) { setError(e.message); }
    setLoading('');
  };

  const handleSheets = async () => {
    setLoading('sheets'); setError(''); setResult(null);
    try {
      const data = await db.getAllDataForBackup();
      const res = await exportToSheets(data, uid, sheetsId);
      setSheetsId(res.spreadsheetId);
      setSheetsUrl(res.url);
      setResult({ type: 'sheets', ...res });
      const { data: b } = await db.getBackups(); setBackups(b || []);
      setLastBackup(b?.[0] || null);
      setLastBackupDays(0);
    } catch (e) { setError(e.message); }
    setLoading('');
  };

  return (
    <div className="fade-up space-y-4">
      <h2 className="text-lg font-bold">📋 Yedekleme</h2>

      {/* Son yedek bilgisi */}
      {lastBackup && (
        <div className="card !p-3">
          <div className="text-xs text-gray-400">Son yedek:</div>
          <div className="text-[15px] font-semibold">{fdt(lastBackup.created_at)}</div>
          <div className="text-xs text-gray-400">{lastBackup.type === 'sheets' ? '📊 Google Sheets' : '📥 CSV'} — {lastBackup.record_count} kayit</div>
        </div>
      )}

      {lastBackupDays !== null && lastBackupDays >= 7 && (
        <div className="card border-l-4 border-amber-400 !p-3">
          <p className="text-xs text-amber-700 font-semibold">⚠️ {lastBackupDays > 100 ? 'Hic yedek alinmamis' : `Son yedek ${lastBackupDays} gun once`}. Yedekleme onerilir.</p>
        </div>
      )}

      {/* Google Sheets */}
      <div className="space-y-3">
        {sheetsUrl && (
          <a href={sheetsUrl} target="_blank" rel="noopener noreferrer" className="card hover:shadow-md transition-shadow block text-left border-l-4 border-emerald-400">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="font-semibold text-[15px]">Google Sheets Yedegini Ac</div>
                <div className="text-xs text-gray-400">Yeni sekmede acilir</div>
              </div>
              <span className="ml-auto text-xs text-emerald-600">↗</span>
            </div>
          </a>
        )}
        {!sheetsUrl && !sheetsId && (
          <div className="card !p-3 text-center">
            <p className="text-xs text-gray-400">Henuz Google Sheets yedegi olusturulmamis. Ilk yedegi olusturun.</p>
          </div>
        )}

        <button onClick={handleSheets} disabled={!!loading} className="card hover:shadow-md transition-shadow cursor-pointer text-left border-l-4 border-blue-300 w-full">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <div className="font-semibold text-[15px]">{sheetsId ? 'Simdi Guncelle' : 'Ilk Yedegi Olustur'}</div>
              <div className="text-xs text-gray-400">{sheetsId ? 'Mevcut spreadsheet uzerine yaz' : 'Yeni spreadsheet olustur, 12 sheet'}</div>
            </div>
          </div>
          {loading === 'sheets' && <div className="mt-2 text-xs text-blue-600 animate-pulse">{sheetsId ? 'Guncelleniyor...' : 'Olusturuluyor...'}</div>}
        </button>

        <button onClick={handleCsv} disabled={!!loading} className="card hover:shadow-md transition-shadow cursor-pointer text-left w-full">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📥</span>
            <div>
              <div className="font-semibold text-[15px]">CSV Indir (ZIP)</div>
              <div className="text-xs text-gray-400">Tum tablolar ayri CSV, ZIP arsivi</div>
            </div>
          </div>
          {loading === 'csv' && <div className="mt-2 text-xs text-emerald-600 animate-pulse">Hazirlaniyor...</div>}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs rounded-xl px-4 py-3">{error}</div>}

      {result && (
        <div className="card border-l-4 border-emerald-400">
          <div className="text-xs text-emerald-700 font-semibold">✅ {result.type === 'sheets' ? 'Google Sheets guncellendi' : 'CSV indirildi'}! ({result.count} kayit)</div>
          {result.url && (
            <div className="mt-2 flex gap-2">
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-primary !text-[13px] inline-block">Sheets'te Ac</a>
              <button onClick={() => navigator.clipboard.writeText(result.url)} className="btn-ghost !text-[13px]">Link Kopyala</button>
            </div>
          )}
        </div>
      )}

      {/* Yedek Gecmisi */}
      {backups.length > 0 && (
        <div>
          <h3 className="text-[15px] font-bold mb-2">Son Yedekler</h3>
          <div className="space-y-1.5">
            {backups.map(b => (
              <div key={b.id} className="card !p-3 flex items-center gap-3">
                <span className="text-sm">{b.type === 'sheets' ? '📊' : '📥'}</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold">{fdt(b.created_at)}</div>
                  <div className="text-xs text-gray-400">{b.type === 'sheets' ? 'Google Sheets' : 'CSV'} — {b.record_count} kayit</div>
                </div>
                {b.sheets_url && <a href={b.sheets_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-semibold">Ac</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card bg-amber-50 border-amber-200">
        <h3 className="text-xs font-bold text-amber-800 mb-1">⚙️ Google Sheets Kurulumu</h3>
        <div className="text-xs text-amber-700 space-y-1 leading-relaxed">
          <p>1. Google Cloud Console → APIs → "Google Sheets API" aktif et</p>
          <p>2. Cikis yap, Google ile tekrar giris yap (Sheets izni otomatik istenir)</p>
          <p>3. Token bulunamazsa butona tikladiginda popup ile izin istenir</p>
          <p className="text-xs text-amber-600 mt-1">Gece otomatik yedekleme (GitHub Actions) ve manuel buton ayni dosyayi gunceller.</p>
        </div>
      </div>
    </div>
  );
}
