'use client';

import { useState, useEffect, useCallback } from 'react';
import * as db from '../../lib/supabase';
import BackupView from './backup';
import { CertificateModal, MyCertificates } from './certificates';
import ReportBuilder, { ReportArchive, quickReport } from './reports';

/* ═══════════════════════════════════════════════════════
   CONSTANTS & UTILITIES
   ═══════════════════════════════════════════════════════ */

const DEPTS = [
  { id:'arsiv', l:'Arşiv ve Dokümantasyon' },{ id:'egitim', l:'Eğitim ve Atölye' },
  { id:'etkinlik', l:'Etkinlik ve Organizasyon' },{ id:'dijital', l:'Dijital ve Sosyal Medya' },
  { id:'rehber', l:'Rehberlik ve Gezi' },{ id:'baski', l:'Yayın ve Baskı' },
  { id:'bagis', l:'Bağış ve Sponsorluk' },{ id:'idari', l:'İdari İşler' },
];
const DM = Object.fromEntries(DEPTS.map(d => [d.id, d]));
const ROLES = { admin:'Yönetici', coord:'Koordinatör', vol:'Gönüllü' };
const DAYS = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const WDAYS = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]}`; };
const fdf = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const today = () => new Date().toISOString().slice(0, 10);
const fmtH = h => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return mins > 0 ? `${hrs}s ${mins}dk` : `${hrs}s`; };
const todayLabel = () => { const d = new Date(); return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}, ${WDAYS[d.getDay()]}`; };
const timeAgo = ts => {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
};

/* ═══════════════════════════════════════════════════════
   DASHBOARD SHELL
   ═══════════════════════════════════════════════════════ */

export default function Dashboard({ session }) {
  const uid = session.user.id;
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.getProfile(uid);
      if (data) setMe(data);
      setUnread(await db.getUnreadCount(uid));
      setLoading(false);
    })();
  }, [uid]);

  useEffect(() => {
    const sub = db.subscribeNotifications(uid, () => setUnread(n => n + 1));
    return () => sub.unsubscribe();
  }, [uid]);

  useEffect(() => {
    if (!me) return;
    if (me.role === 'admin') setTab('genel');
    else if (me.role === 'coord') setTab('calisma');
  }, [me?.role]);

  if (loading || !me) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="space-y-3 w-48"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-3/4" /><div className="skeleton h-3 w-1/2" /></div>
    </div>
  );

  const restricted = ['paused','inactive','resigned','pending','rejected','blocked'].includes(me.status);
  if (restricted) return <RestrictedShell me={me} uid={uid} />;

  const isVol = me.role === 'vol';
  const isCoord = me.role === 'coord';
  const isAdmin = me.role === 'admin';

  const navItems = isAdmin
    ? [{ id:'genel', l:'Genel Bakış' },{ id:'rapor', l:'Raporlar' },{ id:'ayar', l:'Ayarlar', sep:true }]
    : isCoord
    ? [{ id:'calisma', l:'Çalışmam' },{ id:'takim', l:'Takım' }]
    : [];
  const hasNav = navItems.length > 0;

  const openModal = v => { setModal(v); setShowProfile(false); };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 h-14 bg-white/80 backdrop-blur-md border-b border-[#F3F4F6]">
        <div className="h-full max-w-[1200px] mx-auto px-4 md:px-6 flex items-center justify-between">
          <a href="/" className="text-[15px] font-semibold text-[#111827] tracking-tight">Tarih Vakfı</a>
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }} className="relative w-8 h-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#111827] transition-colors duration-150">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[#059669] rounded-full" />}
            </button>
            <button onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-[#059669] flex items-center justify-center text-white text-[13px] font-semibold">{(me.display_name||'?')[0]}</div>
              <svg className="text-[#9CA3AF] group-hover:text-[#6B7280] transition-colors" width="10" height="10" fill="none" viewBox="0 0 10 10"><path d="M2 4l3 2.5L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </header>

      {showNotifs && <NotificationPanel uid={uid} onClose={() => { setShowNotifs(false); setUnread(0); }} />}
      {showProfile && <ProfilePanel me={me} uid={uid} onUpdate={setMe} onModal={openModal} onClose={() => setShowProfile(false)} />}
      {modal === 'certs' && <Modal title="Belgelerim" onClose={() => setModal(null)}><MyCertificates uid={uid} me={me} /></Modal>}
      {modal === 'summary' && <Modal title="Çalışma Özeti" onClose={() => setModal(null)}><WorkSummary uid={uid} /></Modal>}
      {modal === 'help' && <Modal title="Yardım" onClose={() => setModal(null)}><HelpContent me={me} /></Modal>}

      <div className="flex">
        {/* ── Sidebar (desktop) ── */}
        {hasNav && (
          <aside className="hidden md:flex flex-col w-[220px] min-h-[calc(100vh-56px)] border-r border-[#F3F4F6] bg-white px-3 py-6 flex-shrink-0">
            <nav className="space-y-0.5">
              {navItems.map(item => (
                <div key={item.id}>
                  {item.sep && <div className="h-px bg-[#F3F4F6] my-4" />}
                  <button onClick={() => setTab(item.id)} className={`w-full text-left px-3 py-2 rounded-lg text-[14px] transition-all duration-150 ${tab === item.id ? 'text-[#111827] font-semibold bg-[#F3F4F6]' : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#FAFAFA]'}`}>{item.l}</button>
                </div>
              ))}
            </nav>
          </aside>
        )}

        {/* ── Content ── */}
        <main className={`flex-1 min-h-[calc(100vh-56px)] ${hasNav ? 'pb-14 md:pb-0' : ''}`}>
          <div className={`mx-auto px-4 md:px-8 py-6 md:py-8 ${isVol ? 'max-w-[640px]' : 'max-w-[1200px]'}`}>
            {isVol && <VolunteerView uid={uid} me={me} />}
            {isCoord && tab === 'calisma' && <VolunteerView uid={uid} me={me} />}
            {isCoord && tab === 'takim' && <TeamView uid={uid} me={me} />}
            {isAdmin && tab === 'genel' && <OverviewView uid={uid} me={me} onNav={setTab} />}
            {isAdmin && tab === 'rapor' && <ReportsView uid={uid} />}
            {isAdmin && tab === 'ayar' && <SettingsView uid={uid} me={me} />}
          </div>
        </main>
      </div>

      {/* ── Bottom tabs (mobile) ── */}
      {hasNav && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-12 bg-white/90 backdrop-blur-md border-t border-[#F3F4F6] z-50 flex">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`flex-1 flex items-center justify-center text-[13px] font-medium transition-colors duration-150 ${tab === item.id ? 'text-[#059669]' : 'text-[#9CA3AF]'}`}>{item.l}</button>
          ))}
        </nav>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SHARED UI
   ═══════════════════════════════════════════════════════ */

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#F3F4F6] px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-[17px] font-semibold text-[#111827]">{title}</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827] transition-colors text-lg leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function NotificationPanel({ uid, onClose }) {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    (async () => { const { data } = await db.getNotifications(uid, 15); setItems(data || []); await db.markAllRead(uid); })();
  }, [uid]);

  return (
    <div className="fixed top-14 right-4 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#F3F4F6] w-80 max-h-[420px] overflow-y-auto z-[55]">
      {!sel ? (<>
        <div className="px-4 py-3 border-b border-[#F3F4F6]"><span className="text-[14px] font-semibold">Bildirimler</span></div>
        {items.map(n => (
          <div key={n.id} onClick={() => setSel(n)} className={`px-4 py-3 border-b border-[#F3F4F6] cursor-pointer hover:bg-[#FAFAFA] transition-colors ${!n.is_read ? 'bg-[#ECFDF5]/30' : ''}`}>
            <div className="text-[14px] font-medium text-[#111827]">{n.title}</div>
            {n.body && <div className="text-[13px] text-[#6B7280] truncate mt-0.5">{n.body}</div>}
            <div className="text-[12px] text-[#9CA3AF] mt-1">{timeAgo(n.created_at)}</div>
          </div>
        ))}
        {items.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[#9CA3AF]">Bildirim yok</div>}
        <button onClick={onClose} className="w-full py-2.5 text-[13px] text-[#9CA3AF] hover:text-[#6B7280] border-t border-[#F3F4F6] transition-colors">Kapat</button>
      </>) : (
        <div className="p-4">
          <button onClick={() => setSel(null)} className="text-[13px] text-[#9CA3AF] hover:text-[#6B7280] mb-3 transition-colors">&larr; Geri</button>
          <div className="text-[15px] font-semibold mb-2">{sel.title}</div>
          {sel.body && <p className="text-[14px] text-[#6B7280] leading-relaxed">{sel.body}</p>}
          <div className="text-[12px] text-[#9CA3AF] mt-3">{fdf(sel.created_at)}</div>
        </div>
      )}
    </div>
  );
}

function ProfilePanel({ me, uid, onUpdate, onModal, onClose }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ display_name: me.display_name, city: me.city || '', bio: me.bio || '' });
  const [tgCode, setTgCode] = useState(null);
  const save = async () => { const { data } = await db.updateProfile(uid, f); if (data) onUpdate(data); setEditing(false); };
  const linkTg = async () => { const code = String(Math.floor(100000 + Math.random() * 900000)); await db.updateProfile(uid, { telegram_link_code: code }); setTgCode(code); };

  return (
    <div className="fixed top-14 right-4 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#F3F4F6] w-72 z-[55]">
      <div className="p-5 border-b border-[#F3F4F6]">
        <div className="text-[15px] font-semibold text-[#111827]">{me.display_name}</div>
        <div className="text-[13px] text-[#9CA3AF] mt-0.5">{ROLES[me.role]} · {DM[me.department]?.l || '—'}</div>
      </div>
      {!editing ? (
        <div className="py-1.5">
          <PanelLink label="Profili Düzenle" onClick={() => setEditing(true)} />
          {me.telegram_id ? (
            <div className="px-4 py-2 text-[13px] text-[#059669] font-medium">Telegram bağlı</div>
          ) : tgCode ? (
            <div className="px-4 py-2 space-y-2">
              <div className="text-[12px] text-[#6B7280]">@tarihvakfi_bot&apos;a bu kodu gönderin:</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono font-bold text-center bg-[#FAFAFA] rounded-lg py-2 text-lg tracking-widest text-[#111827]">{tgCode}</div>
                <button onClick={() => navigator.clipboard.writeText(`/start ${tgCode}`)} className="text-[12px] text-[#6B7280] hover:text-[#111827] px-2 py-1.5 bg-[#F3F4F6] rounded-lg transition-colors">Kopyala</button>
              </div>
              <a href={`https://t.me/tarihvakfi_bot?start=${tgCode}`} target="_blank" rel="noopener noreferrer" className="block text-center text-[12px] text-[#059669] font-medium hover:underline">veya doğrudan aç &rarr;</a>
            </div>
          ) : (
            <PanelLink label="Telegram Bağla" onClick={linkTg} />
          )}
          <PanelLink label="Çalışma Özeti" onClick={() => onModal('summary')} />
          <PanelLink label="Belgelerim" onClick={() => onModal('certs')} />
          <PanelLink label="Yardım" onClick={() => onModal('help')} />
          <div className="h-px bg-[#F3F4F6] my-1" />
          <PanelLink label="Çıkış" onClick={db.signOut} danger />
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <input className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="İsim" value={f.display_name} onChange={e => setF({...f, display_name: e.target.value})} />
          <input className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="Şehir" value={f.city} onChange={e => setF({...f, city: e.target.value})} />
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 bg-[#059669] text-white text-[14px] font-semibold py-2 rounded-lg hover:bg-[#047857] transition-colors">Kaydet</button>
            <button onClick={() => setEditing(false)} className="text-[13px] text-[#9CA3AF] px-3">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelLink({ label, onClick, danger }) {
  return <button onClick={onClick} className={`w-full text-left px-4 py-2 text-[14px] hover:bg-[#FAFAFA] transition-colors ${danger ? 'text-[#EF4444]' : 'text-[#6B7280] hover:text-[#111827]'}`}>{label}</button>;
}

function WorkSummary({ uid }) {
  const [s, setS] = useState(null);
  useEffect(() => { db.getWorkSummary(uid).then(({ data }) => setS(data)); }, [uid]);
  if (!s) return <div className="skeleton h-20 w-full" />;
  const rows = [
    ['Bu Hafta', `${s.week_days} rapor, ${fmtH(Number(s.week_hours))}`],
    ['Bu Ay', `${s.month_days} rapor, ${fmtH(Number(s.month_hours))}`],
    ['Toplam', `${s.total_days} rapor, ${fmtH(Number(s.total_hours))}`],
  ];
  return (
    <div className="space-y-3">
      {rows.map(([l, v], i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-[#F3F4F6] last:border-0">
          <span className="text-[14px] text-[#6B7280]">{l}</span>
          <span className={`text-[14px] font-semibold ${i === 2 ? 'text-[#059669]' : 'text-[#111827]'}`}>{v}</span>
        </div>
      ))}
      {(Number(s.onsite_hours) > 0 || Number(s.remote_hours) > 0) && (
        <div className="flex gap-6 text-[13px] text-[#9CA3AF] pt-1">
          <span>Vakıfta: {fmtH(Number(s.onsite_hours))}</span>
          <span>Uzaktan: {fmtH(Number(s.remote_hours))}</span>
        </div>
      )}
    </div>
  );
}

function useToast() {
  const [msg, setMsg] = useState('');
  const show = m => { setMsg(m); setTimeout(() => setMsg(''), 2500); };
  const Toast = () => msg ? <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-[#111827] text-white text-[14px] font-medium px-5 py-2.5 rounded-lg shadow-lg z-[70]">{msg}</div> : null;
  return { show, Toast };
}

/* ═══════════════════════════════════════════════════════
   VOLUNTEER VIEW
   ═══════════════════════════════════════════════════════ */

function VolunteerView({ uid, me }) {
  const [showForm, setShowForm] = useState(false);
  const [editR, setEditR] = useState(null);
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expandTask, setExpandTask] = useState(null);
  const [progVal, setProgVal] = useState(0);
  const [progNote, setProgNote] = useState('');
  const [summary, setSummary] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showGuide, setShowGuide] = useState(me.first_login);
  const toast = useToast();

  const load = useCallback(async () => {
    const [r, t, s] = await Promise.all([db.getWeekReports(uid), db.getTasks({ assigned_to: uid }), db.getWorkSummary(uid)]);
    setReports(r.data || []);
    setTasks((t.data || []).filter(t => ['active','pending','review'].includes(t.status)));
    setSummary(s.data);
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const weekDays = summary ? Number(summary.week_days) : 0;
  const weekHours = summary ? Number(summary.week_hours) : 0;

  const dismissGuide = async () => { setShowGuide(false); await db.updateProfile(uid, { first_login: false }); };
  const openEdit = r => { setEditR(r); setShowForm(true); };
  const openNew = () => { setEditR(null); setShowForm(true); };

  const handleSave = async (data) => {
    if (editR) {
      await db.updateWorkReport(editR.id, data);
      toast.show('Rapor güncellendi');
    } else {
      await db.createWorkReport({ ...data, user_id: uid, source: 'web' });
      toast.show('Rapor kaydedildi');
    }
    setShowForm(false); setEditR(null); load();
  };

  const handleDelete = async id => {
    await db.deleteWorkReport(id);
    setConfirmDelete(null); toast.show('Rapor silindi'); load();
  };

  const updateProgress = async (taskId) => {
    await db.updateTaskProgress(taskId, progVal);
    if (progNote) await db.addProgressLog({ task_id: taskId, user_id: uid, progress: progVal, note: progNote });
    if (progVal >= 100) await db.updateTask(taskId, { status: 'review' });
    setExpandTask(null); setProgVal(0); setProgNote(''); load();
    toast.show('İlerleme güncellendi');
  };

  return (
    <div className="space-y-10">
      <toast.Toast />

      {/* Guide */}
      {showGuide && (
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[15px] font-semibold text-[#111827] mb-1">Hoş geldin!</div>
              <div className="text-[14px] text-[#6B7280] leading-relaxed">Çalışma raporlarını buradan girebilirsin. Her rapor koordinatör onayına gider.</div>
            </div>
            <button onClick={dismissGuide} className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors ml-4">&times;</button>
          </div>
        </div>
      )}

      {/* Greeting + Stats */}
      <div>
        <h1 className="text-[28px] font-light text-[#111827] mb-6">Merhaba, {(me.display_name || '').split(' ')[0]}</h1>
        <div className="flex gap-4">
          <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex-1">
            <div className="text-[42px] font-bold text-[#111827] tracking-tight leading-none">{weekDays}</div>
            <div className="text-[13px] text-[#9CA3AF] mt-1.5">gün bu hafta</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex-1">
            <div className="text-[42px] font-bold text-[#111827] tracking-tight leading-none">{fmtH(weekHours)}</div>
            <div className="text-[13px] text-[#9CA3AF] mt-1.5">saat bu hafta</div>
          </div>
        </div>
      </div>

      {/* Report Button */}
      <button onClick={openNew} className="w-full bg-[#059669] hover:bg-[#047857] text-white text-[15px] font-semibold py-4 rounded-xl transition-colors duration-150 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        Çalışma Raporu
      </button>

      {/* Tasks */}
      <div>
        <div className="section-label mb-4">Atanan İşler</div>
        {tasks.length === 0 ? (
          <div className="text-[14px] text-[#9CA3AF] leading-relaxed">
            Henüz atanmış iş yok.<br />Çalışmanı yukarıdan raporlayabilirsin.
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id}>
                <div onClick={() => { setExpandTask(expandTask === t.id ? null : t.id); setProgVal(t.progress || 0); setProgNote(''); }} className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] cursor-pointer hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] font-medium text-[#111827]">{t.title}</span>
                    <span className="text-[13px] text-[#9CA3AF]">{Math.round(t.progress || 0)}%</span>
                  </div>
                  <div className="h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div className="h-full bg-[#059669] rounded-full transition-all duration-300" style={{ width: `${t.progress || 0}%` }} />
                  </div>
                  {t.deadline && <div className="text-[12px] text-[#9CA3AF] mt-2">{fd(t.deadline)}{t.deadline < today() ? ' · gecikmiş' : ''}</div>}
                </div>
                {expandTask === t.id && (
                  <div className="bg-white rounded-xl p-4 mt-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-3">
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="100" step="5" value={progVal} onChange={e => setProgVal(Number(e.target.value))} className="flex-1 accent-[#059669]" />
                      <span className="text-[14px] font-semibold text-[#111827] w-12 text-right">{progVal}%</span>
                    </div>
                    <input className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="Not (opsiyonel)" value={progNote} onChange={e => setProgNote(e.target.value)} />
                    <button onClick={() => updateProgress(t.id)} className="bg-[#059669] text-white text-[14px] font-semibold py-2 px-4 rounded-lg hover:bg-[#047857] transition-colors">Güncelle</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* This Week */}
      <div>
        <div className="section-label mb-4">Bu Hafta</div>
        {reports.length === 0 ? (
          <div className="text-[14px] text-[#9CA3AF]">Henüz rapor yok.</div>
        ) : (
          <div className="space-y-1">
            {reports.map(r => (
              <div key={r.id}>
                <div onClick={() => openEdit(r)} className="flex items-start gap-4 py-3 border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-white/50 transition-colors rounded-lg px-2 -mx-2">
                  <div className="text-[14px] text-[#9CA3AF] w-16 flex-shrink-0 pt-0.5">{fd(r.date)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#111827]">{fmtH(r.hours)}</span>
                      <span className="text-[13px] text-[#9CA3AF]">{r.work_mode === 'remote' ? 'Uzaktan' : 'Vakıfta'}</span>
                    </div>
                    {r.description && <div className="text-[13px] text-[#6B7280] mt-0.5 truncate">{r.description}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {r.edited_at && <span className="text-[12px] text-[#9CA3AF]">düzenlendi</span>}
                    {r.is_approved ? (
                      <span className="w-2 h-2 rounded-full bg-[#059669] inline-block flex-shrink-0" title="Onaylandı" />
                    ) : (
                      <span className="text-[12px] text-[#F59E0B] flex-shrink-0">Bekliyor</span>
                    )}
                  </div>
                </div>
                {confirmDelete === r.id && (
                  <div className="flex items-center gap-2 py-2 px-2">
                    <span className="text-[13px] text-[#EF4444]">Silinsin mi?</span>
                    <button onClick={() => handleDelete(r.id)} className="text-[13px] font-semibold text-[#EF4444] hover:underline">Evet</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[13px] text-[#9CA3AF]">Hayır</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-[#F3F4F6]">
        <div className="text-[13px] text-[#9CA3AF]">
          Bir sorunun mu var?{' '}
          <button onClick={async () => {
            const { data: admins } = await db.getProfilesByRole('admin');
            for (const a of (admins || [])) await db.sendNotification(a.id, 'system', `${me.display_name} yardım istiyor`, '');
            toast.show('Mesajın iletildi');
          }} className="text-[#059669] hover:underline font-medium">İletişim</button>
        </div>
      </div>

      {/* Report Modal */}
      {showForm && <ReportModal uid={uid} me={me} editReport={editR} tasks={tasks} onSave={handleSave} onClose={() => { setShowForm(false); setEditR(null); }} onDelete={id => setConfirmDelete(id)} />}
    </div>
  );
}

function ReportModal({ uid, me, editReport, tasks, onSave, onClose, onDelete }) {
  const [f, setF] = useState({
    h: editReport ? String(editReport.hours) : '',
    desc: editReport ? editReport.description || '' : '',
    mode: editReport ? editReport.work_mode || 'onsite' : 'onsite',
    date: editReport ? editReport.date : today(),
    plan: editReport ? editReport.next_plan || '' : '',
    taskId: editReport ? editReport.task_id || '' : '',
  });
  const [showExtra, setShowExtra] = useState(!!editReport);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    const h = parseFloat(f.h);
    if (!f.h || isNaN(h) || h <= 0 || h > 24) e.h = true;
    if (!f.desc.trim() && h > 1) e.desc = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    const data = {
      hours: parseFloat(f.h), description: f.desc.trim(), work_mode: f.mode, date: f.date,
      next_plan: f.plan.trim() || null, task_id: f.taskId || null,
    };
    await onSave(data);
    setSaving(false);
  };

  return (
    <Modal title={editReport ? 'Raporu Düzenle' : 'Çalışma Raporu'} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="text-[13px] text-[#6B7280] font-medium mb-1.5 block">Süre</label>
          <div className={`flex items-center border rounded-lg overflow-hidden transition-colors ${errors.h ? 'border-[#EF4444]' : 'border-[#E5E7EB] focus-within:border-[#059669]'}`}>
            <input type="number" step="0.5" min="0.5" max="24" value={f.h} onChange={e => setF({...f, h: e.target.value})} className="flex-1 px-4 py-3 text-[16px] outline-none bg-transparent" placeholder="3" />
            <span className="text-[14px] text-[#9CA3AF] pr-4">saat</span>
          </div>
        </div>

        <div>
          <label className="text-[13px] text-[#6B7280] font-medium mb-1.5 block">Ne yaptın?</label>
          <input value={f.desc} onChange={e => setF({...f, desc: e.target.value})} className={`w-full border rounded-lg px-4 py-3 text-[14px] outline-none transition-colors ${errors.desc ? 'border-[#EF4444]' : 'border-[#E5E7EB] focus:border-[#059669]'}`} placeholder="Belgeleri taradım" />
        </div>

        <div>
          <label className="text-[13px] text-[#6B7280] font-medium mb-2 block">Konum</label>
          <div className="flex gap-6">
            {[['onsite', 'Vakıfta'], ['remote', 'Uzaktan']].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${f.mode === v ? 'border-[#059669]' : 'border-[#D1D5DB]'}`}>
                  {f.mode === v && <div className="w-2 h-2 rounded-full bg-[#059669]" />}
                </div>
                <span className="text-[14px] text-[#111827]">{l}</span>
              </label>
            ))}
          </div>
        </div>

        <button onClick={submit} disabled={saving} className="w-full bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-[15px] font-semibold py-3 rounded-lg transition-colors">
          {saving ? 'Kaydediliyor...' : editReport ? 'Güncelle' : 'Kaydet'}
        </button>

        {/* Extra options */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button onClick={() => setShowExtra(!showExtra)} className="text-[13px] text-[#059669] hover:underline font-medium">
            {showExtra ? 'Gizle' : 'Tarih değiştir · Plan ekle · İşe bağla'}
          </button>
          {editReport && <button onClick={() => { onClose(); onDelete(editReport.id); }} className="text-[13px] text-[#EF4444] hover:underline font-medium">Raporu sil</button>}
        </div>

        {showExtra && (
          <div className="space-y-4 pt-2 border-t border-[#F3F4F6]">
            <div>
              <label className="text-[13px] text-[#6B7280] font-medium mb-1.5 block">Tarih</label>
              <input type="date" value={f.date} onChange={e => setF({...f, date: e.target.value})} className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" />
            </div>
            <div>
              <label className="text-[13px] text-[#6B7280] font-medium mb-1.5 block">Sonraki plan (opsiyonel)</label>
              <input value={f.plan} onChange={e => setF({...f, plan: e.target.value})} className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="Yarın devam edeceğim..." />
            </div>
            {tasks.length > 0 && (
              <div>
                <label className="text-[13px] text-[#6B7280] font-medium mb-1.5 block">İlgili iş (opsiyonel)</label>
                <select value={f.taskId} onChange={e => setF({...f, taskId: e.target.value})} className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors bg-white">
                  <option value="">Bağımsız çalışma</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════
   COORDINATOR — TEAM VIEW
   ═══════════════════════════════════════════════════════ */

function TeamView({ uid, me }) {
  const [pending, setPending] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [vols, setVols] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [certVol, setCertVol] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [tf, setTf] = useState({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'', materials:'', recurring:false });
  const [showAnn, setShowAnn] = useState(false);
  const [annF, setAnnF] = useState({ title:'', body:'' });
  const [search, setSearch] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    const [p, t, v, ws] = await Promise.all([db.getPendingReports(), db.getTasks(), db.getAllProfiles(), db.getAllWorkSummaries()]);
    setPending(p.data || []); setTasks(t.data || []);
    setVols((v.data || []).filter(v => v.status === 'active'));
    setSummaries(ws.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async id => { await db.approveReport(id, uid); load(); toast.show('Onaylandı'); };
  const approveAll = async () => { const ids = pending.filter(r => r.user_id !== uid).map(r => r.id); await db.approveAllReports(ids, uid); load(); toast.show('Tümü onaylandı'); };
  const approveTask = async id => { await db.updateTask(id, { status:'done', completed_at: new Date().toISOString() }); load(); };
  const createTask = async () => { if (!tf.title) return; await db.createTask({ title:tf.title, description:tf.description, department:tf.department, deadline:tf.deadline, materials:tf.materials||'', is_recurring:tf.recurring||false, priority:'medium', assigned_to:tf.assigned_to ? [tf.assigned_to] : [], created_by:uid }); setShowNewTask(false); setTf({ title:'', description:'', department:me.department||'arsiv', assigned_to:'', deadline:'', materials:'', recurring:false }); load(); toast.show('İş oluşturuldu'); };
  const createAnn = async () => { if (!annF.title || !annF.body) return; await db.createAnnouncement({ ...annF, department:null, is_pinned:false, is_public:false, author_id:uid }); setShowAnn(false); setAnnF({ title:'', body:'' }); toast.show('Duyuru yayınlandı'); };

  const sumMap = Object.fromEntries(summaries.map(s => [s.id, s]));
  const weekH = summaries.reduce((a, s) => a + Number(s.week_hours || 0), 0);
  const activeTasks = tasks.filter(t => ['active','pending','review'].includes(t.status));
  const filteredVols = vols.filter(v => !search || v.display_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-10">
      <toast.Toast />

      {/* Header */}
      <div>
        <h1 className="text-[24px] font-semibold text-[#111827]">Departmanım</h1>
        <div className="text-[14px] text-[#9CA3AF] mt-1">{DM[me.department]?.l || '—'}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { n: pending.length, l: 'Bekleyen' },
          { n: vols.length, l: 'Gönüllü' },
          { n: activeTasks.length, l: 'Açık iş' },
          { n: fmtH(weekH), l: 'Haftalık' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[32px] font-bold text-[#111827] tracking-tight leading-none">{s.n}</div>
            <div className="text-[12px] text-[#9CA3AF] mt-1.5">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Pending Approvals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-label">Onay Bekliyor</div>
          {pending.filter(r => r.user_id !== uid).length > 1 && (
            <button onClick={approveAll} className="text-[13px] text-[#059669] font-medium hover:underline">Tümünü Onayla &rarr;</button>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="text-[14px] text-[#9CA3AF]">Bekleyen rapor yok.</div>
        ) : (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            {pending.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-medium text-[#111827]">{r.profiles?.display_name}</span>
                  <span className="text-[13px] text-[#9CA3AF] ml-3">{fmtH(r.hours)}</span>
                  <span className="text-[13px] text-[#9CA3AF] ml-2">{r.description?.slice(0, 40)}</span>
                </div>
                {r.user_id !== uid ? (
                  <button onClick={() => approve(r.id)} className="text-[13px] text-[#059669] font-semibold hover:underline flex-shrink-0">Onayla</button>
                ) : (
                  <span className="text-[12px] text-[#D1D5DB]">Kendi</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Volunteers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-label">Gönüllüler</div>
        </div>
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#F3F4F6]">
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full text-[14px] outline-none placeholder:text-[#D1D5DB]" placeholder="Ara..." />
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            <div className="grid grid-cols-[1fr_80px_80px_60px] px-5 py-2 text-[12px] text-[#9CA3AF] font-medium">
              <span>Ad</span><span>Bu Ay</span><span>Toplam</span><span>Durum</span>
            </div>
            {filteredVols.map(v => {
              const s = sumMap[v.id];
              const status = v.activity_status || 'active';
              const dotColor = status === 'active' ? 'bg-[#059669]' : status === 'slowing' ? 'bg-[#F59E0B]' : status === 'inactive' ? 'bg-[#F97316]' : 'bg-[#EF4444]';
              return (
                <div key={v.id} className="grid grid-cols-[1fr_80px_80px_60px] items-center px-5 py-3 hover:bg-[#FAFAFA] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[14px] font-medium text-[#111827] truncate">{v.display_name}</span>
                    <button onClick={() => setCertVol(v)} className="text-[12px] text-[#9CA3AF] hover:text-[#F59E0B] flex-shrink-0 transition-colors">belge</button>
                  </div>
                  <span className="text-[13px] text-[#6B7280]">{s ? fmtH(Number(s.month_hours)) : '—'}</span>
                  <span className="text-[13px] text-[#6B7280]">{s ? fmtH(Number(s.total_hours)) : '—'}</span>
                  <div className="flex items-center"><span className={`w-2 h-2 rounded-full ${dotColor} inline-block`} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-label">İşler</div>
          <button onClick={() => setShowNewTask(!showNewTask)} className="text-[13px] text-[#059669] font-medium hover:underline">{showNewTask ? 'Kapat' : '+ Yeni İş'}</button>
        </div>
        {showNewTask && (
          <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-4 space-y-3">
            <input className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="İş başlığı" value={tf.title} onChange={e => setTf({...tf, title: e.target.value})} />
            <textarea className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" rows={2} placeholder="Açıklama" value={tf.description} onChange={e => setTf({...tf, description: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              <select className="border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] bg-white" value={tf.assigned_to} onChange={e => setTf({...tf, assigned_to: e.target.value})}><option value="">Atanacak</option>{vols.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
              <input type="date" className="border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669]" value={tf.deadline} onChange={e => setTf({...tf, deadline: e.target.value})} />
            </div>
            <button onClick={createTask} className="bg-[#059669] text-white text-[14px] font-semibold py-2.5 px-5 rounded-lg hover:bg-[#047857] transition-colors">Oluştur</button>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          {tasks.filter(t => t.status !== 'cancelled').slice(0, 12).map((t, i) => {
            const od = t.deadline && t.deadline < today();
            return (
              <div key={t.id} className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-medium text-[#111827]">{t.title}</span>
                  {od && <span className="text-[12px] text-[#EF4444] ml-2">gecikmiş</span>}
                </div>
                <div className="w-24 flex items-center gap-2 flex-shrink-0">
                  <div className="flex-1 h-1 bg-[#F3F4F6] rounded-full overflow-hidden"><div className="h-full bg-[#059669] rounded-full" style={{width:`${t.progress||0}%`}} /></div>
                  <span className="text-[12px] text-[#9CA3AF] w-8 text-right">{Math.round(t.progress||0)}%</span>
                </div>
                {t.deadline && <span className="text-[12px] text-[#9CA3AF] flex-shrink-0 w-14">{fd(t.deadline)}</span>}
                {t.status === 'review' && <button onClick={() => approveTask(t.id)} className="text-[13px] text-[#059669] font-semibold hover:underline flex-shrink-0">Tamamla</button>}
              </div>
            );
          })}
          {tasks.filter(t => t.status !== 'cancelled').length === 0 && <div className="px-5 py-6 text-[14px] text-[#9CA3AF] text-center">Henüz iş yok</div>}
        </div>
      </div>

      {/* Announcement */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-label">Duyuru ve Sohbet</div>
          <button onClick={() => setShowAnn(!showAnn)} className="text-[13px] text-[#059669] font-medium hover:underline">{showAnn ? 'Kapat' : 'Duyuru Yaz'}</button>
        </div>
        {showAnn && (
          <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-4 space-y-3">
            <input className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="Başlık" value={annF.title} onChange={e => setAnnF({...annF, title: e.target.value})} />
            <textarea className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" rows={2} placeholder="İçerik" value={annF.body} onChange={e => setAnnF({...annF, body: e.target.value})} />
            <button onClick={createAnn} className="bg-[#059669] text-white text-[14px] font-semibold py-2.5 px-5 rounded-lg hover:bg-[#047857] transition-colors">Yayınla</button>
          </div>
        )}
        <ChatSection uid={uid} me={me} />
      </div>

      {certVol && <CertificateModal vol={certVol} summary={sumMap[certVol.id]} issuerId={uid} onClose={() => setCertVol(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ADMIN — OVERVIEW
   ═══════════════════════════════════════════════════════ */

function OverviewView({ uid, me, onNav }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [vols, setVols] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [summaries, setSummaries] = useState({});
  const toast = useToast();

  const load = useCallback(async () => {
    const [p, pr, ws, t] = await Promise.all([db.getAllProfiles(), db.getPendingReports(), db.getAllWorkSummaries(), db.getTasks()]);
    const all = p.data || [];
    setPendingUsers(all.filter(u => u.status === 'pending'));
    setVols(all.filter(u => u.status !== 'pending'));
    setPendingReports(pr.data || []);
    setTasks(t.data || []);
    setSummaries(Object.fromEntries((ws.data || []).map(s => [s.id, s])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const approveUser = async id => { await db.setUserStatus(id, 'active'); await db.sendNotification(id, 'welcome', 'Hesabınız onaylandı!', ''); load(); toast.show('Onaylandı'); };
  const rejectUser = async id => { await db.setUserStatus(id, 'rejected'); load(); };
  const approveReport = async id => { await db.approveReport(id, uid); load(); toast.show('Onaylandı'); };
  const approveAllReports = async () => { const ids = pendingReports.filter(r => r.user_id !== uid).map(r => r.id); await db.approveAllReports(ids, uid); load(); toast.show('Tümü onaylandı'); };

  const activeVols = vols.filter(v => v.status === 'active');
  const activeTasks = tasks.filter(t => ['active','pending','review'].includes(t.status));
  const doneTasks = tasks.filter(t => t.status === 'done');
  const overdueTasks = activeTasks.filter(t => t.deadline && t.deadline < today());
  const needsAttention = vols.filter(v => v.status === 'active' && v.role === 'vol' && ['slowing','inactive','dormant'].includes(v.activity_status));

  const weekH = Object.values(summaries).reduce((a, s) => a + Number(s.week_hours || 0), 0);

  // Department hours
  const deptHours = {};
  activeVols.forEach(v => {
    if (v.department && summaries[v.id]) {
      deptHours[v.department] = (deptHours[v.department] || 0) + Number(summaries[v.id].week_hours || 0);
    }
  });
  const maxDeptH = Math.max(...Object.values(deptHours), 1);
  const deptSorted = Object.entries(deptHours).filter(([,h]) => h > 0).sort((a, b) => b[1] - a[1]);

  // Recent activity: pending reports + pending users combined
  const recentItems = [
    ...pendingReports.slice(0, 5).map(r => ({ type:'report', name: r.profiles?.display_name, detail: `${fmtH(r.hours)} · ${r.description?.slice(0,30) || ''}`, time: r.created_at, id: r.id })),
    ...pendingUsers.slice(0, 3).map(u => ({ type:'user', name: u.display_name, detail: 'Yeni kayıt', time: u.created_at, id: u.id })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);

  const hasPending = pendingUsers.length > 0 || pendingReports.length > 0;

  return (
    <div className="space-y-10">
      <toast.Toast />

      {/* Header */}
      <div>
        <h1 className="text-[24px] font-semibold text-[#111827]">Genel Bakış</h1>
        <div className="text-[14px] text-[#9CA3AF] mt-1">{todayLabel()}</div>
      </div>

      {/* Big Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { n: activeVols.length, l: 'aktif gönüllü' },
          { n: fmtH(weekH), l: 'bu hafta' },
          { n: doneTasks.length, l: 'tamamlandı' },
          { n: overdueTasks.length, l: 'gecikmiş', warn: overdueTasks.length > 0 },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className={`text-[42px] font-bold tracking-tight leading-none ${s.warn ? 'text-[#EF4444]' : 'text-[#111827]'}`}>{s.n}</div>
            <div className="text-[13px] text-[#9CA3AF] mt-2">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-8">

        {/* Left column */}
        <div className="space-y-10">

          {/* Weekly Activity */}
          {deptSorted.length > 0 && (
            <div>
              <div className="section-label mb-4">Haftalık Aktivite</div>
              <div className="space-y-3">
                {deptSorted.map(([dept, hours]) => (
                  <div key={dept} className="flex items-center gap-4">
                    <span className="text-[14px] text-[#6B7280] w-32 truncate flex-shrink-0">{DM[dept]?.l || dept}</span>
                    <div className="flex-1 h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#059669] rounded-full transition-all duration-500" style={{ width: `${(hours / maxDeptH) * 100}%` }} />
                    </div>
                    <span className="text-[14px] font-semibold text-[#111827] w-12 text-right">{fmtH(hours)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Actions */}
          <div>
            <div className="section-label mb-4">Bekleyen İşlemler</div>
            {!hasPending ? (
              <div className="text-[14px] text-[#9CA3AF]">Her şey yolunda.</div>
            ) : (
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                {pendingUsers.map((u, i) => (
                  <div key={u.id} className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-medium text-[#111827]">{u.display_name}</span>
                      <span className="text-[13px] text-[#9CA3AF] ml-2">{u.email}</span>
                    </div>
                    <button onClick={() => approveUser(u.id)} className="text-[13px] text-[#059669] font-semibold hover:underline">Onayla</button>
                    <button onClick={() => rejectUser(u.id)} className="text-[13px] text-[#EF4444] hover:underline">Reddet</button>
                  </div>
                ))}
                {pendingReports.map((r, i) => (
                  <div key={r.id} className={`flex items-center gap-4 px-5 py-3 border-t border-[#F3F4F6]`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-medium text-[#111827]">{r.profiles?.display_name}</span>
                      <span className="text-[13px] text-[#9CA3AF] ml-2">{fmtH(r.hours)} · {r.description?.slice(0, 30)}</span>
                    </div>
                    {r.user_id !== uid ? (
                      <button onClick={() => approveReport(r.id)} className="text-[13px] text-[#059669] font-semibold hover:underline">Onayla</button>
                    ) : <span className="text-[12px] text-[#D1D5DB]">Kendi</span>}
                  </div>
                ))}
                {pendingReports.filter(r => r.user_id !== uid).length > 1 && (
                  <div className="px-5 py-3 border-t border-[#F3F4F6]">
                    <button onClick={approveAllReports} className="text-[13px] text-[#059669] font-medium hover:underline">Tümünü Onayla &rarr;</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-10">

          {/* Recent Activity */}
          {recentItems.length > 0 && (
            <div>
              <div className="section-label mb-4">Son Gelişmeler</div>
              <div className="space-y-4">
                {recentItems.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#D1D5DB] mt-2 flex-shrink-0" />
                    <div>
                      <div className="text-[14px] text-[#111827]"><span className="font-medium">{item.name}</span> {item.type === 'report' ? 'rapor girdi' : ''}</div>
                      <div className="text-[13px] text-[#9CA3AF]">{item.detail}</div>
                      <div className="text-[12px] text-[#D1D5DB] mt-0.5">{timeAgo(item.time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attention */}
          {needsAttention.length > 0 && (
            <div>
              <div className="section-label mb-4">Dikkat</div>
              <div className="space-y-3">
                {needsAttention.sort((a,b) => (a.activity_score||0) - (b.activity_score||0)).slice(0, 5).map(v => {
                  const days = v.last_activity_at ? Math.floor((Date.now() - new Date(v.last_activity_at).getTime()) / 86400000) : 999;
                  return (
                    <div key={v.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-[14px] font-medium text-[#111827]">{v.display_name}</span>
                        <span className="text-[13px] text-[#9CA3AF] ml-2">{days < 999 ? `${days} gündür yok` : 'hiç rapor yok'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {overdueTasks.length > 0 && (
            <div>
              <div className="text-[13px] text-[#EF4444] font-medium">Gecikmiş: {overdueTasks.length} iş</div>
              <button onClick={() => onNav('ayar')} className="text-[13px] text-[#059669] hover:underline mt-1">görüntüle &rarr;</button>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 pt-4 border-t border-[#F3F4F6]">
        <button onClick={() => onNav('ayar')} className="text-[14px] text-[#111827] font-medium hover:text-[#059669] transition-colors">Gönüllüler <span className="text-[#9CA3AF] font-normal">{activeVols.length} kişi &rarr;</span></button>
        <button onClick={() => onNav('ayar')} className="text-[14px] text-[#111827] font-medium hover:text-[#059669] transition-colors">İşler <span className="text-[#9CA3AF] font-normal">{activeTasks.length} açık &rarr;</span></button>
        <button onClick={() => onNav('rapor')} className="text-[14px] text-[#111827] font-medium hover:text-[#059669] transition-colors">Raporlar &rarr;</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ADMIN — REPORTS
   ═══════════════════════════════════════════════════════ */

function ReportsView({ uid }) {
  const [quickResult, setQuickResult] = useState('');
  const [quickLoading, setQuickLoading] = useState('');

  const runQuick = async period => {
    setQuickLoading(period); setQuickResult('');
    const result = await quickReport(period);
    setQuickResult(result); setQuickLoading('');
  };

  return (
    <div className="space-y-10">
      <h1 className="text-[24px] font-semibold text-[#111827]">Raporlar</h1>

      {/* Quick reports */}
      <div className="grid grid-cols-3 gap-4">
        {[['today','Bugün'],['week','Hafta'],['month','Ay']].map(([k,l]) => (
          <button key={k} onClick={() => runQuick(k)} disabled={!!quickLoading} className={`bg-white rounded-xl p-5 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all cursor-pointer ${quickLoading===k ? 'opacity-50' : ''}`}>
            <div className="text-[15px] font-semibold text-[#111827]">{l}</div>
          </button>
        ))}
      </div>

      {/* Preview */}
      {quickResult && (
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div className="section-label">Rapor Önizleme</div>
            <button onClick={() => navigator.clipboard.writeText(quickResult)} className="text-[13px] text-[#059669] font-medium hover:underline">Kopyala</button>
          </div>
          <pre className="text-[13px] whitespace-pre-wrap font-mono text-[#6B7280] leading-relaxed max-h-[50vh] overflow-y-auto">{quickResult}</pre>
        </div>
      )}

      {/* Custom report */}
      <div>
        <div className="section-label mb-4">Detaylı Rapor</div>
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <ReportBuilder uid={uid} />
        </div>
      </div>

      {/* Archive */}
      <div>
        <div className="section-label mb-4">Arşiv</div>
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <ReportArchive />
        </div>
      </div>

      {/* Backup */}
      <div>
        <div className="section-label mb-4">Yedekleme</div>
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <BackupView uid={uid} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ADMIN — SETTINGS (People Management)
   ═══════════════════════════════════════════════════════ */

function SettingsView({ uid, me }) {
  const [vols, setVols] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [expand, setExpand] = useState(null);
  const [certVol, setCertVol] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [tf, setTf] = useState({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'' });
  const [showAnn, setShowAnn] = useState(false);
  const [annF, setAnnF] = useState({ title:'', body:'' });
  const [commTab, setCommTab] = useState('people');
  const toast = useToast();

  const load = useCallback(async () => {
    const [p, ws, t] = await Promise.all([db.getAllProfiles(), db.getAllWorkSummaries(), db.getTasks()]);
    setVols((p.data || []).filter(u => u.status !== 'pending'));
    setSummaries(Object.fromEntries((ws.data || []).map(s => [s.id, s])));
    setTasks(t.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (id, role) => { await db.setUserRole(id, role); setVols(vols.map(v => v.id === id ? {...v, role} : v)); toast.show('Rol güncellendi'); };
  const changeDept = async (id, dept) => { await db.setUserDept(id, dept); setVols(vols.map(v => v.id === id ? {...v, department: dept} : v)); toast.show('Departman güncellendi'); };
  const changeStatus = async (id, status) => { await db.setUserStatus(id, status); load(); toast.show('Durum güncellendi'); };
  const createTask = async () => { if (!tf.title) return; await db.createTask({ ...tf, priority:'medium', assigned_to: tf.assigned_to ? [tf.assigned_to] : [], created_by: uid }); setShowNewTask(false); setTf({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'' }); load(); toast.show('İş oluşturuldu'); };
  const createAnn = async () => { if (!annF.title || !annF.body) return; await db.createAnnouncement({ ...annF, department:null, is_pinned:false, is_public:false, author_id:uid }); setShowAnn(false); setAnnF({ title:'', body:'' }); toast.show('Duyuru yayınlandı'); };

  const filtered = vols.filter(v => !search || v.display_name?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase()));
  const activeTasks = tasks.filter(t => ['active','pending','review'].includes(t.status));

  const TABS = [['people','Gönüllüler'],['tasks','İşler'],['comm','İletişim']];

  return (
    <div className="space-y-8">
      <toast.Toast />
      <h1 className="text-[24px] font-semibold text-[#111827]">Ayarlar</h1>

      <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-1 w-fit">
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setCommTab(k)} className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ${commTab === k ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}>{l}</button>
        ))}
      </div>

      {/* People tab */}
      {commTab === 'people' && (
        <div>
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#F3F4F6]">
              <input value={search} onChange={e => setSearch(e.target.value)} className="w-full text-[14px] outline-none placeholder:text-[#D1D5DB]" placeholder="Ara..." />
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              <div className="grid grid-cols-[1fr_120px_80px_60px] px-5 py-2 text-[12px] text-[#9CA3AF] font-medium">
                <span>Ad</span><span>Departman</span><span>Bu Ay</span><span>Durum</span>
              </div>
              {filtered.slice(0, 30).map(v => {
                const s = summaries[v.id];
                const status = v.activity_status || 'active';
                const dotColor = v.status !== 'active' ? 'bg-[#D1D5DB]' : status === 'active' ? 'bg-[#059669]' : status === 'slowing' ? 'bg-[#F59E0B]' : status === 'inactive' ? 'bg-[#F97316]' : 'bg-[#EF4444]';
                return (
                  <div key={v.id}>
                    <div onClick={() => setExpand(expand === v.id ? null : v.id)} className={`grid grid-cols-[1fr_120px_80px_60px] items-center px-5 py-3 cursor-pointer hover:bg-[#FAFAFA] transition-colors ${v.status !== 'active' ? 'opacity-50' : ''}`}>
                      <span className="text-[14px] font-medium text-[#111827] truncate">{v.display_name}</span>
                      <span className="text-[13px] text-[#6B7280] truncate">{DM[v.department]?.l?.split(' ')[0] || '—'}</span>
                      <span className="text-[13px] text-[#6B7280]">{s ? fmtH(Number(s.month_hours)) : '—'}</span>
                      <span className={`w-2 h-2 rounded-full ${dotColor} inline-block`} />
                    </div>
                    {expand === v.id && v.id !== uid && (
                      <div className="px-5 py-4 bg-[#FAFAFA] space-y-3 text-[13px]">
                        <div className="text-[#6B7280]">
                          {s && <span>Toplam: {s.total_days} gün, {fmtH(Number(s.total_hours))}</span>}
                          {v.last_activity_at && <span className="ml-3">Son: {fd(v.last_activity_at)}</span>}
                          {!v.last_activity_at && <span className="ml-3">Son: —</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 items-center">
                          <label className="text-[#9CA3AF]">Rol:</label>
                          <select value={v.role} onChange={e => changeRole(v.id, e.target.value)} className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-[13px] bg-white outline-none focus:border-[#059669]">
                            <option value="vol">Gönüllü</option><option value="coord">Koordinatör</option><option value="admin">Yönetici</option>
                          </select>
                          <label className="text-[#9CA3AF] ml-2">Departman:</label>
                          <select value={v.department || ''} onChange={e => changeDept(v.id, e.target.value)} className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-[13px] bg-white outline-none focus:border-[#059669]">
                            <option value="">—</option>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-3 items-center">
                          <label className="text-[#9CA3AF]">Durum:</label>
                          {v.status === 'active' ? (
                            <button onClick={() => changeStatus(v.id, 'blocked')} className="text-[#EF4444] hover:underline">Engelle</button>
                          ) : (
                            <button onClick={() => changeStatus(v.id, 'active')} className="text-[#059669] hover:underline">Aktifleştir</button>
                          )}
                          <button onClick={() => setCertVol(v)} className="text-[#6B7280] hover:text-[#F59E0B] ml-2 transition-colors">Belge oluştur</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tasks tab */}
      {commTab === 'tasks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] text-[#6B7280]">{activeTasks.length} açık iş</div>
            <button onClick={() => setShowNewTask(!showNewTask)} className="text-[13px] text-[#059669] font-medium hover:underline">{showNewTask ? 'Kapat' : '+ Yeni İş'}</button>
          </div>
          {showNewTask && (
            <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-4 space-y-3">
              <input className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="İş başlığı" value={tf.title} onChange={e => setTf({...tf, title: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <select className="border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] bg-white" value={tf.department} onChange={e => setTf({...tf, department: e.target.value})}>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>
                <select className="border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] bg-white" value={tf.assigned_to} onChange={e => setTf({...tf, assigned_to: e.target.value})}><option value="">Atanacak</option>{vols.filter(v=>v.status==='active').map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
              </div>
              <input type="date" className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669]" value={tf.deadline} onChange={e => setTf({...tf, deadline: e.target.value})} />
              <button onClick={createTask} className="bg-[#059669] text-white text-[14px] font-semibold py-2.5 px-5 rounded-lg hover:bg-[#047857] transition-colors">Oluştur</button>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden divide-y divide-[#F3F4F6]">
            {tasks.filter(t => t.status !== 'cancelled').slice(0, 20).map(t => {
              const od = t.deadline && t.deadline < today();
              return (
                <div key={t.id} className={`flex items-center gap-4 px-5 py-3 ${t.status === 'done' ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0"><span className="text-[14px] font-medium text-[#111827]">{t.title}</span>{od && <span className="text-[12px] text-[#EF4444] ml-2">gecikmiş</span>}</div>
                  <div className="w-24 flex items-center gap-2 flex-shrink-0">
                    <div className="flex-1 h-1 bg-[#F3F4F6] rounded-full overflow-hidden"><div className="h-full bg-[#059669] rounded-full" style={{width:`${t.progress||0}%`}} /></div>
                    <span className="text-[12px] text-[#9CA3AF] w-8 text-right">{Math.round(t.progress||0)}%</span>
                  </div>
                  {t.status === 'review' && <button onClick={async () => { await db.updateTask(t.id, { status:'done', completed_at: new Date().toISOString() }); load(); }} className="text-[13px] text-[#059669] font-semibold hover:underline flex-shrink-0">Tamamla</button>}
                  {!['done','cancelled'].includes(t.status) && <button onClick={async () => { await db.updateTask(t.id, { status:'cancelled' }); load(); }} className="text-[12px] text-[#9CA3AF] hover:text-[#EF4444] flex-shrink-0 transition-colors">iptal</button>}
                </div>
              );
            })}
            {tasks.filter(t => t.status !== 'cancelled').length === 0 && <div className="px-5 py-6 text-[14px] text-[#9CA3AF] text-center">Henüz iş yok</div>}
          </div>
        </div>
      )}

      {/* Communication tab */}
      {commTab === 'comm' && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="section-label">Duyuru</div>
              <button onClick={() => setShowAnn(!showAnn)} className="text-[13px] text-[#059669] font-medium hover:underline">{showAnn ? 'Kapat' : 'Duyuru Yaz'}</button>
            </div>
            {showAnn && (
              <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-4 space-y-3">
                <input className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="Başlık" value={annF.title} onChange={e => setAnnF({...annF, title: e.target.value})} />
                <textarea className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#059669] transition-colors" rows={2} placeholder="İçerik" value={annF.body} onChange={e => setAnnF({...annF, body: e.target.value})} />
                <button onClick={createAnn} className="bg-[#059669] text-white text-[14px] font-semibold py-2.5 px-5 rounded-lg hover:bg-[#047857] transition-colors">Yayınla</button>
              </div>
            )}
          </div>
          <div>
            <div className="section-label mb-4">Sohbet</div>
            <ChatSection uid={uid} me={me} />
          </div>
          <div>
            <div className="section-label mb-4">Vardiya Planı</div>
            <ShiftPlanView uid={uid} me={me} />
          </div>
        </div>
      )}

      {certVol && <CertificateModal vol={certVol} summary={summaries[certVol.id]} issuerId={uid} onClose={() => setCertVol(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CHAT
   ═══════════════════════════════════════════════════════ */

function ChatSection({ uid, me }) {
  const isCoordOrAdmin = me.role === 'admin' || me.role === 'coord';
  const [dept, setDept] = useState(me.department || 'arsiv');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    const { data } = await db.getMessages(dept);
    setMessages((data || []).reverse());
  }, [dept]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const sub = db.subscribeMessages(dept, () => load());
    return () => sub.unsubscribe();
  }, [dept, load]);

  const send = async () => { if (!text.trim()) return; await db.sendMessage(uid, dept, text.trim()); setText(''); load(); };

  return (
    <div className="space-y-3">
      {isCoordOrAdmin && (
        <div className="flex gap-1 flex-wrap">
          {DEPTS.map(d => (
            <button key={d.id} onClick={() => setDept(d.id)} className={`text-[12px] px-2.5 py-1 rounded-md transition-colors ${dept === d.id ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#6B7280]'}`}>{d.l.split(' ')[0]}</button>
          ))}
        </div>
      )}
      <div className="bg-white rounded-xl p-4 space-y-2 max-h-64 overflow-y-auto shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {messages.length === 0 && <p className="text-[13px] text-[#D1D5DB] text-center py-6">Henüz mesaj yok</p>}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`flex ${m.user_id === uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.user_id === uid ? 'bg-[#059669] text-white' : 'bg-[#F3F4F6]'}`}>
              {m.user_id !== uid && <div className="text-[12px] font-semibold text-[#059669] mb-0.5">{m.profiles?.display_name}</div>}
              <div className="text-[14px]">{m.content}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669] transition-colors" placeholder="Mesaj..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={!text.trim()} className="bg-[#059669] text-white text-[14px] font-medium px-4 py-2 rounded-lg hover:bg-[#047857] disabled:opacity-30 transition-colors">Gönder</button>
      </div>
    </div>
  );
}

function ShiftPlanView({ uid, me }) {
  const [shifts, setShifts] = useState([]);
  const [vols, setVols] = useState([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ volunteer_id:'', day_of_week:'Pzt', start_time:'10:00', end_time:'14:00', department: me.department||'arsiv' });
  const load = useCallback(async () => {
    const [s, v] = await Promise.all([db.getShifts({}), db.getAllProfiles()]);
    setShifts(s.data || []); setVols((v.data || []).filter(v => v.status === 'active'));
  }, []);
  useEffect(() => { load(); }, [load]);
  const create = async () => { if (!f.volunteer_id) return; await db.createShift({...f, created_by: uid}); setShow(false); load(); };
  const del = async id => { await db.deleteShift(id); load(); };

  return (
    <div className="space-y-3">
      <button onClick={() => setShow(!show)} className="text-[13px] text-[#059669] font-medium hover:underline">{show ? 'Kapat' : '+ Vardiya Ekle'}</button>
      {show && (
        <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-3">
          <select className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669] bg-white" value={f.volunteer_id} onChange={e => setF({...f, volunteer_id: e.target.value})}>
            <option value="">Gönüllü seç</option>{vols.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <select className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669] bg-white" value={f.day_of_week} onChange={e => setF({...f, day_of_week: e.target.value})}>{DAYS.map(d => <option key={d}>{d}</option>)}</select>
            <input type="time" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669]" value={f.start_time} onChange={e => setF({...f, start_time: e.target.value})} />
            <input type="time" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#059669]" value={f.end_time} onChange={e => setF({...f, end_time: e.target.value})} />
          </div>
          <button onClick={create} className="bg-[#059669] text-white text-[14px] font-semibold py-2 rounded-lg w-full hover:bg-[#047857] transition-colors">Ekle</button>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden divide-y divide-[#F3F4F6]">
        {DAYS.filter(d => shifts.some(s => s.day_of_week === d)).map(day => (
          <div key={day} className="px-4 py-2.5">
            <div className="text-[12px] font-semibold text-[#9CA3AF] mb-1">{day}</div>
            {shifts.filter(s => s.day_of_week === day).map(sh => (
              <div key={sh.id} className="flex items-center justify-between py-1">
                <span className="text-[14px] text-[#111827]">{sh.profiles?.display_name} · {sh.start_time?.slice(0,5)}–{sh.end_time?.slice(0,5)}</span>
                <button onClick={() => del(sh.id)} className="text-[#D1D5DB] hover:text-[#EF4444] text-[12px] transition-colors">&times;</button>
              </div>
            ))}
          </div>
        ))}
        {shifts.length === 0 && <div className="px-4 py-6 text-[14px] text-[#9CA3AF] text-center">Vardiya yok</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HELP
   ═══════════════════════════════════════════════════════ */

function HelpContent({ me }) {
  const items = [
    { q:'Nasıl çalışma raporu girerim?', a:'Çalışma Raporu butonuna tıkla, saat yaz, ne yaptığını yaz, konum seç, kaydet.' },
    { q:'Raporumu nasıl düzenlerim?', a:'Bu Hafta listesinde rapora tıkla, düzenle, güncelle. Onaylanmış rapor düzenlenirse tekrar onay gerekir.' },
    { q:'Raporumu nasıl silerim?', a:'Rapora tıkla, "Raporu sil" seçeneğini kullan. 30 günden eski raporlar silinemez.' },
    { q:'İşe bağlı rapor nedir?', a:'Çalışma raporunda opsiyonel olarak ilgili işi seçebilirsin. Seçmesen de rapor kaydedilir.' },
    { q:'Telegram nasıl bağlanır?', a:'Profil menüsünden Telegram Bağla seçeneğini kullan. Verilen kodu @tarihvakfi_bot\'a gönder.' },
    { q:'Telegram\'dan nasıl rapor girerim?', a:'"bugün 3 saat belge taradım" yaz, bot kaydeder. /ozet ile çalışma özetini gör.' },
  ];
  if (me.role !== 'vol') items.push(
    { q:'Raporları nasıl onaylarım?', a:'Takım ekranında Onay Bekleyenler listesinden onayla veya reddet.' },
    { q:'Nasıl iş oluştururum?', a:'İşler bölümünden + Yeni İş butonuna tıkla.' },
  );
  if (me.role === 'admin') items.push(
    { q:'Rapor nasıl oluştururum?', a:'Raporlar sekmesinden tip ve dönem seç, oluştur.' },
    { q:'Yedekleme nasıl yapılır?', a:'Raporlar sekmesinin altında Yedekleme bölümünden Google Sheets veya CSV olarak yedekle.' },
  );
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} onClick={() => setOpen(open === i ? null : i)} className="cursor-pointer py-3 border-b border-[#F3F4F6] last:border-0">
          <div className="flex justify-between items-center">
            <span className="text-[14px] font-medium text-[#111827]">{item.q}</span>
            <span className="text-[#D1D5DB] text-[12px]">{open === i ? '−' : '+'}</span>
          </div>
          {open === i && <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">{item.a}</p>}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   RESTRICTED SHELL
   ═══════════════════════════════════════════════════════ */

function RestrictedShell({ me, uid }) {
  const [sent, setSent] = useState(false);
  const msgs = {
    pending: { t:'Kaydınız alındı', d:'Yönetici onayı bekleniyor.' },
    rejected: { t:'Başvuru reddedildi', d:'Yöneticiyle iletişime geçin.' },
    blocked: { t:'Hesap engellendi', d:'Yöneticiyle iletişime geçin.' },
    paused: { t:'Hesap duraklatıldı', d:'Tekrar aktif olmak için talep gönderin.' },
    inactive: { t:'Hesap pasif', d:'30 gündür raporlama yapılmadığı için pasife alındı.' },
    resigned: { t:'Ayrıldınız', d:'Eski verileriniz korunuyor.' },
  };
  const m = msgs[me.status] || msgs.blocked;
  const canReactivate = ['paused','inactive','resigned'].includes(me.status);

  const requestReactivation = async () => {
    const { data: admins } = await db.getProfilesByRole('admin');
    for (const a of (admins || [])) await db.sendNotification(a.id, 'system', `${me.display_name} tekrar aktif olmak istiyor`, me.status === 'resigned' ? 'Eski gönüllü geri dönüş talebi' : 'Pasif hesap aktivasyon talebi');
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="text-center space-y-5 max-w-sm">
        <h2 className="text-[22px] font-semibold text-[#111827]">{m.t}</h2>
        <p className="text-[15px] text-[#6B7280]">{m.d}</p>
        {canReactivate && !sent && (
          <button onClick={requestReactivation} className="bg-[#059669] text-white font-semibold text-[14px] py-2.5 px-6 rounded-lg hover:bg-[#047857] transition-colors">
            {me.status === 'resigned' ? 'Tekrar Katıl' : 'Tekrar Aktif Ol'}
          </button>
        )}
        {sent && <p className="text-[14px] text-[#059669]">Talebiniz yöneticiye iletildi.</p>}
        <div><button onClick={db.signOut} className="text-[14px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors">Çıkış</button></div>
      </div>
    </div>
  );
}
