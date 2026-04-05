'use client';

import { useState, useEffect } from 'react';
import * as db from '../../lib/supabase';

const MO = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const fdf = d => { if (!d) return ''; const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const fmtH = h => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return `${hrs}s ${mins}dk`; };
const DEPTS = [
  { id:'arsiv', l:'Arşiv' },{ id:'egitim', l:'Eğitim' },{ id:'etkinlik', l:'Etkinlik' },{ id:'dijital', l:'Dijital' },
  { id:'rehber', l:'Rehber' },{ id:'baski', l:'Yayın' },{ id:'bagis', l:'Bağış' },{ id:'idari', l:'İdari' },
];
const DM = Object.fromEntries(DEPTS.map(d => [d.id, d]));

function getPeriod(key) {
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  if (key === 'today') return { start: today, end: today, label: `Bugün (${fdf(today)})` };
  if (key === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7));
    return { start: mon.toISOString().slice(0,10), end: today, label: `Bu Hafta (${fdf(mon.toISOString())} — ${fdf(today)})` };
  }
  if (key === 'month') {
    const first = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    return { start: first, end: today, label: `Bu Ay (${MO[now.getMonth()]} ${now.getFullYear()})` };
  }
  return { start: '', end: '', label: 'Özel' };
}

async function fetchReportData(period) {
  const [profiles, reports, tasks, summaries] = await Promise.all([
    db.getAllProfiles(),
    db.supabase.from('work_reports').select('*, profiles!user_id(display_name, department)').gte('date', period.start).lte('date', period.end).order('date', { ascending: false }),
    db.supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    db.getAllWorkSummaries(),
  ]);
  return {
    profiles: profiles.data || [],
    reports: reports.data || [],
    tasks: tasks.data || [],
    summaries: summaries.data || [],
  };
}

function generateTextReport(type, data, period, scope) {
  const { profiles, reports, tasks, summaries } = data;
  const lines = [];
  const hr = '─'.repeat(40);

  lines.push(`TARİH VAKFI — ${type === 'general' ? 'GENEL ÖZET' : type === 'person' ? 'KİŞİ BAZLI' : type === 'dept' ? 'DEPARTMAN BAZLI' : type === 'tasks' ? 'İŞ RAPORU' : type === 'hours' ? 'SAAT RAPORU' : 'GÜNLÜK RAPOR'}`);
  lines.push(`${period.label}`);
  lines.push(`Oluşturulma: ${fdf(new Date())}`);
  lines.push(hr);

  const activeVols = profiles.filter(p => p.status === 'active');
  const totalHours = reports.reduce((a, r) => a + Number(r.hours || 0), 0);
  const totalDays = new Set(reports.map(r => r.date)).size;
  const onsite = reports.filter(r => r.work_mode === 'onsite');
  const remote = reports.filter(r => r.work_mode === 'remote');

  if (type === 'general' || type === 'daily') {
    lines.push(`\nAktif Gönüllü: ${activeVols.length}`);
    lines.push(`Toplam Çalışma: ${totalDays} gün, ${fmtH(totalHours)}`);
    lines.push(`  Vakıfta: ${fmtH(onsite.reduce((a,r) => a + Number(r.hours||0), 0))}`);
    lines.push(`  Uzaktan: ${fmtH(remote.reduce((a,r) => a + Number(r.hours||0), 0))}`);

    const done = tasks.filter(t => t.status === 'done');
    const active = tasks.filter(t => ['active','review','pending'].includes(t.status));
    lines.push(`\nTamamlanan İş: ${done.length}`);
    lines.push(`Devam Eden İş: ${active.length}`);

    lines.push(`\n${hr}`);
    lines.push('Departman Bazlı:');
    for (const d of DEPTS) {
      const deptReports = reports.filter(r => r.profiles?.department === d.id);
      const deptHours = deptReports.reduce((a,r) => a + Number(r.hours||0), 0);
      const deptPeople = new Set(deptReports.map(r => r.user_id)).size;
      if (deptHours > 0) lines.push(`  ${d.l}: ${fmtH(deptHours)} (${deptPeople} kişi)`);
    }
  }

  if (type === 'daily') {
    lines.push(`\n${hr}`);
    lines.push('Bugün Çalışanlar:');
    for (const r of reports) {
      const mode = r.work_mode === 'remote' ? 'Uzaktan' : 'Vakıfta';
      lines.push(`  ${r.profiles?.display_name} — ${fmtH(r.hours)} ${mode} — "${r.description || ''}"`);
    }
    if (reports.length === 0) lines.push('  Bugün rapor girilmemiş.');

    const todayTasks = tasks.filter(t => t.status === 'done' && t.completed_at?.startsWith(period.start));
    if (todayTasks.length) {
      lines.push(`\nBugün Tamamlanan İşler:`);
      for (const t of todayTasks) lines.push(`  ${t.title}`);
    }

    const plans = reports.filter(r => r.next_plan).map(r => `  ${r.profiles?.display_name}: "${r.next_plan}"`);
    if (plans.length) { lines.push(`\nYarın Planı:`); lines.push(...plans); }
  }

  if (type === 'person') {
    lines.push(`\n${hr}`);
    const sorted = [...summaries].sort((a,b) => Number(b.month_hours) - Number(a.month_hours));
    lines.push('Ad | Dept | Gün | Saat | Son Aktivite');
    lines.push('─'.repeat(50));
    for (const s of sorted) {
      if (Number(s.total_hours) > 0) {
        lines.push(`  ${s.display_name} | ${DM[s.department]?.l || '—'} | ${s.month_days}g | ${fmtH(Number(s.month_hours))} | ${s.last_visit || '—'}`);
      }
    }
  }

  if (type === 'dept') {
    lines.push(`\n${hr}`);
    for (const d of DEPTS) {
      const deptReports = reports.filter(r => r.profiles?.department === d.id);
      const deptVols = summaries.filter(s => s.department === d.id);
      const deptHours = deptReports.reduce((a,r) => a + Number(r.hours||0), 0);
      if (deptVols.length > 0 || deptHours > 0) {
        lines.push(`\n${d.l}`);
        lines.push(`  Aktif gönüllü: ${deptVols.filter(v => Number(v.total_hours) > 0).length}`);
        lines.push(`  Dönem: ${fmtH(deptHours)}`);
        for (const v of deptVols.filter(v => Number(v.month_hours) > 0)) {
          lines.push(`    ${v.display_name}: ${v.month_days}g / ${fmtH(Number(v.month_hours))}`);
        }
      }
    }
  }

  if (type === 'tasks') {
    lines.push(`\n${hr}`);
    lines.push('İş | Dept | İlerleme | Durum | Deadline');
    lines.push('─'.repeat(55));
    for (const t of tasks.filter(t => t.status !== 'cancelled')) {
      const deadline = t.deadline ? fdf(t.deadline) : '—';
      const overdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done' ? ' ' : '';
      lines.push(`  ${t.title} | ${DM[t.department]?.l||'—'} | %${Math.round(t.progress||0)} | ${t.status} | ${deadline}${overdue}`);
    }
  }

  if (type === 'hours') {
    lines.push(`\n${hr}`);
    lines.push('Tarih | Kişi | Saat | Nerede | Açıklama | Durum');
    lines.push('─'.repeat(60));
    for (const r of reports) {
      const mode = r.work_mode === 'remote' ? 'Uzaktan' : 'Vakıfta';
      const st = r.status === 'approved' ? '+' : r.status === 'rejected' ? 'X' : '~';
      lines.push(`  ${r.date} | ${r.profiles?.display_name} | ${r.hours}s | ${mode} | ${r.description?.slice(0,30)||'—'} | ${st}`);
    }
    lines.push(`\n  Toplam: ${fmtH(totalHours)} (${reports.length} kayıt)`);
  }

  lines.push(`\n${hr}`);
  lines.push('Tarih Vakfı Gönüllü Yönetim Sistemi');

  return lines.join('\n');
}

async function exportExcel(type, data, period) {
  const XLSX = (await import('xlsx')).default;
  const wb = XLSX.utils.book_new();
  const { profiles, reports, tasks, summaries } = data;

  if (type === 'general' || type === 'daily' || type === 'hours') {
    const rows = reports.map(r => ({
      Tarih: r.date, Kisi: r.profiles?.display_name, Saat: r.hours,
      Nerede: r.work_mode === 'remote' ? 'Uzaktan' : 'Vakıfta',
      Aciklama: r.description, Plan: r.next_plan, Durum: r.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Calisma Raporlari');
  }

  if (type === 'general' || type === 'person') {
    const rows = summaries.filter(s => Number(s.total_hours) > 0).map(s => ({
      Ad: s.display_name, Departman: DM[s.department]?.l || '', Hafta_Gun: s.week_days, Hafta_Saat: Number(s.week_hours).toFixed(1),
      Ay_Gun: s.month_days, Ay_Saat: Number(s.month_hours).toFixed(1), Toplam_Gun: s.total_days, Toplam_Saat: Number(s.total_hours).toFixed(1),
      Vakifta: Number(s.onsite_hours).toFixed(1), Uzaktan: Number(s.remote_hours).toFixed(1), Son_Aktivite: s.last_visit || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Gonullu Ozeti');
  }

  if (type === 'general' || type === 'dept') {
    const rows = DEPTS.map(d => {
      const deptReports = reports.filter(r => r.profiles?.department === d.id);
      return {
        Departman: d.l, Gonullu: summaries.filter(s => s.department === d.id && Number(s.total_hours) > 0).length,
        Donem_Saat: deptReports.reduce((a,r) => a + Number(r.hours||0), 0).toFixed(1),
        Donem_Gun: new Set(deptReports.map(r => r.date)).size,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Departman Ozeti');
  }

  if (type === 'general' || type === 'tasks') {
    const rows = tasks.filter(t => t.status !== 'cancelled').map(t => ({
      Baslik: t.title, Departman: DM[t.department]?.l || '', Ilerleme: `${Math.round(t.progress||0)}%`,
      Durum: t.status, Deadline: t.deadline || '', Atanan: (t.assigned_to||[]).length + ' kisi',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Isler');
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tarih-vakfi-rapor-${period.start}.xlsx`;
  a.click();
}

const TYPES = [
  { id: 'general', l: 'Genel Özet' },
  { id: 'person', l: 'Kişi Bazlı' },
  { id: 'dept', l: 'Departman' },
  { id: 'tasks', l: 'İş Raporu' },
  { id: 'hours', l: 'Saat Raporu' },
  { id: 'daily', l: 'Günlük' },
];

export default function ReportBuilder({ uid }) {
  const [type, setType] = useState('general');
  const [periodKey, setPeriodKey] = useState('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [preview, setPreview] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const period = periodKey === 'custom'
    ? { start: customStart, end: customEnd, label: `${fdf(customStart)} — ${fdf(customEnd)}` }
    : getPeriod(periodKey);

  const generate = async () => {
    if (!period.start) return;
    setLoading(true);
    const d = await fetchReportData(period);
    setData(d);
    setPreview(generateTextReport(type, d, period));
    setLoading(false);
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(preview); };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Rapor Oluştur</h2>

      {/* Tip */}
      <div className="grid grid-cols-3 gap-2">
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)} className={`card !p-3 text-center cursor-pointer transition-all ${type === t.id ? 'border-2 border-emerald-500 shadow-md' : ''}`}>
            <div className="text-xl">{t.i}</div>
            <div className="text-xs font-semibold mt-0.5">{t.l}</div>
          </button>
        ))}
      </div>

      {/* Dönem */}
      <div className="flex gap-1.5 flex-wrap">
        {[['today','Bugün'],['week','Bu Hafta'],['month','Bu Ay'],['custom','Özel']].map(([k,l]) => (
          <button key={k} onClick={() => setPeriodKey(k)} className={`text-sm font-semibold px-3 py-2 rounded-xl ${periodKey === k ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{l}</button>
        ))}
      </div>
      {periodKey === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="input-field" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          <input type="date" className="input-field" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
        </div>
      )}

      <button onClick={generate} disabled={loading} className="btn-primary w-full !py-3 disabled:opacity-50">{loading ? 'Oluşturuluyor...' : '👁️ Önizle'}</button>

      {/* Önizleme */}
      {preview && (
        <div className="space-y-3">
          <div className="card bg-gray-50 !p-4 max-h-[50vh] overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">{preview}</pre>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={copyToClipboard} className="btn-primary !text-sm">Kopyala</button>
            <button onClick={() => data && exportExcel(type, data, period)} className="btn-ghost !text-sm">Excel İndir</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Hızlı rapor (metin) — Telegram için de kullanılabilir
export async function quickReport(periodKey) {
  const period = getPeriod(periodKey);
  const data = await fetchReportData(period);
  return generateTextReport(periodKey === 'today' ? 'daily' : 'general', data, period);
}

// ── Rapor Arşivi ──
export function ReportArchive() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { db.getReportArchive(filter || null).then(({ data }) => setReports(data || [])); }, [filter]);

  const typeLabel = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Rapor Arşivi</h2>
      <div className="flex gap-1.5">
        {[['','Tümü'],['daily','Günlük'],['weekly','Haftalık'],['monthly','Aylık']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-sm font-semibold px-3 py-2 rounded-xl ${filter === k ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{l}</button>
        ))}
      </div>
      {reports.map(r => (
        <div key={r.id} className="card cursor-pointer hover:shadow-md" onClick={() => setSelected(selected?.id === r.id ? null : r)}>
          <div className="flex items-center gap-3">
            <span className="text-sm">{typeLabel[r.type] || r.type}</span>
            <div className="flex-1">
              <div className="font-semibold text-sm">{fdf(r.period_start)}{r.period_start !== r.period_end ? ' — ' + fdf(r.period_end) : ''}</div>
              <div className="text-xs text-gray-400">{r.data?.vol_count || 0} kişi, {fmtH(r.data?.total_hours || 0)}</div>
            </div>
          </div>
          {selected?.id === r.id && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <pre className="text-xs whitespace-pre-wrap font-mono text-gray-600 leading-relaxed max-h-60 overflow-y-auto">{r.content}</pre>
              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(r.content); }} className="btn-ghost !text-xs mt-2">Kopyala</button>
            </div>
          )}
        </div>
      ))}
      {reports.length === 0 && <div className="card text-center py-6"><p className="text-sm text-gray-400">Henüz rapor yok</p></div>}
    </div>
  );
}
