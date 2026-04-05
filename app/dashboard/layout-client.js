'use client';

import { useState, useEffect, useCallback } from 'react';
import * as db from '../../lib/supabase';
import BackupView from './backup';
import { CertificateModal, MyCertificates } from './certificates';
import ReportBuilder, { ReportArchive, quickReport } from './reports';

const DEPTS = [
  { id:'arsiv', l:'Arşiv & Dokümantasyon', i:'📜' },{ id:'egitim', l:'Eğitim & Atölye', i:'📚' },
  { id:'etkinlik', l:'Etkinlik & Organizasyon', i:'🎪' },{ id:'dijital', l:'Dijital & Sosyal Medya', i:'💻' },
  { id:'rehber', l:'Rehberlik & Gezi', i:'🏛️' },{ id:'baski', l:'Yayın & Baskı', i:'📰' },
  { id:'bagis', l:'Bağış & Sponsorluk', i:'💰' },{ id:'idari', l:'İdari İşler', i:'🏢' },
];
const DM = Object.fromEntries(DEPTS.map(d=>[d.id,d]));
const ROLES = { admin:{l:'Yönetici',i:'👑'}, coord:{l:'Koordinatör',i:'📋'}, vol:{l:'Gönüllü',i:'🤝'} };
const STATUSES = { pending:'Bekliyor', active:'Devam Ediyor', done:'Tamamlandı', review:'Kontrol Bekliyor' };
const DAYS = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]}`; };
const fdf = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const today = () => new Date().toISOString().slice(0,10);
const fmtH = h => { const hrs = Math.floor(h); const mins = Math.round((h-hrs)*60); return `${hrs}s ${String(mins).padStart(2,'0')}dk`; };

// ═══════════════════════════════════════════
// ANA SHELL
// ═══════════════════════════════════════════
export default function Dashboard({ session }) {
  const uid = session.user.id;
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('islerim');
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [modal, setModal] = useState(null); // 'chat','help','certs','summary'

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

  // Set default tab based on role (once)
  useEffect(() => {
    if (!me) return;
    if (me.role === 'admin') setTab('yonetim');
  }, [me?.role]);

  if (loading || !me) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Yükleniyor...</p></div>;

  // Restricted
  const restricted = ['paused','inactive','resigned','pending','rejected','blocked'].includes(me.status);
  if (restricted) return <RestrictedShell me={me} uid={uid} />;

  const isCoord = me.role === 'coord' || me.role === 'admin';
  const isAdmin = me.role === 'admin';

  // Gönüllü: 0 sekme, Koordinatör: 2, Admin: 2
  const tabs = isAdmin
    ? [['yonetim','👥','Yönetim'],['raporlar','📊','Raporlar']]
    : isCoord
    ? [['islerim','📋','İşlerim'],['takimim','👥','Takımım']]
    : [];

  return (
    <div className={`min-h-screen bg-white ${tabs.length ? 'pb-16' : ''}`}>
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-bold" style={{fontFamily:"'Playfair Display',serif"}}>🏛️ Tarih Vakfı</a>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) setUnread(0); }} className="relative w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-sm">
              🔔{unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{unread}</span>}
            </button>
            <button onClick={() => setShowProfile(!showProfile)} className="text-sm font-semibold text-gray-600">{me.display_name?.split(' ')[0]} ▾</button>
          </div>
        </div>
      </header>

      {/* Notification dropdown */}
      {showNotifs && <NotifDropdown uid={uid} onClose={() => { setShowNotifs(false); setUnread(0); }} />}

      {/* Profile dropdown */}
      {showProfile && <ProfileDropdown me={me} uid={uid} onUpdate={m => setMe(m)} onModal={setModal} onClose={() => setShowProfile(false)} />}

      {/* Modals */}
      {/* Sohbet modal kaldırıldı — koordinatör/admin Takımım/Yönetim içinde kullanır */}
      {modal === 'certs' && <ModalWrap title="🏆 Belgelerim" onClose={() => setModal(null)}><MyCertificates uid={uid} me={me} /></ModalWrap>}
      {modal === 'summary' && <ModalWrap title="📊 Çalışma Özeti" onClose={() => setModal(null)}><WorkSummaryModal uid={uid} /></ModalWrap>}
      {modal === 'help' && <ModalWrap title="❓ Yardım" onClose={() => setModal(null)}><HelpContent me={me} /></ModalWrap>}

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Gönüllü: tek ekran (sekme yok) */}
        {me.role === 'vol' && <MyScreen uid={uid} me={me} onModal={setModal} />}
        {/* Koordinatör */}
        {me.role === 'coord' && tab === 'islerim' && <MyScreen uid={uid} me={me} onModal={setModal} />}
        {me.role === 'coord' && tab === 'takimim' && <TeamScreen uid={uid} me={me} />}
        {/* Yönetici */}
        {isAdmin && tab === 'yonetim' && <AdminScreen uid={uid} me={me} />}
        {isAdmin && tab === 'raporlar' && <ReportsScreen uid={uid} />}
      </main>

      {/* Bottom nav — only coord/admin */}
      {tabs.length > 0 && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50" style={{height:56}}>
          <div className="max-w-2xl mx-auto flex h-full">
            {tabs.map(([id,ic,lb]) => (
              <button key={id} onClick={() => setTab(id)} className="flex-1 flex flex-col items-center justify-center gap-0.5">
                {tab === id && <div className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-emerald-500 rounded-b" style={{position:'relative',width:'50%',margin:'0 auto'}} />}
                <span className={`text-lg ${tab === id ? '' : 'grayscale opacity-40'}`}>{ic}</span>
                <span className={`text-[11px] ${tab === id ? 'font-bold text-emerald-600' : 'text-gray-400'}`}>{lb}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
function ModalWrap({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <span className="font-bold">{title}</span>
          <button onClick={onClose} className="text-gray-400 text-lg">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function NotifDropdown({ uid, onClose }) {
  const [notifs, setNotifs] = useState([]);
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await db.getNotifications(uid, 15);
      setNotifs(data || []);
      await db.markAllRead(uid);
    })();
  }, [uid]);

  if (detail) return (
    <div className="fixed top-14 right-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-80 max-h-96 overflow-y-auto z-[55]">
      <div className="p-3 border-b border-gray-50 flex items-center justify-between">
        <button onClick={() => setDetail(null)} className="text-xs text-gray-400">← Geri</button>
        <button onClick={onClose} className="text-gray-400">✕</button>
      </div>
      <div className="p-4">
        <div className="text-lg mb-1">{detail.type === 'announcement' ? '📢' : detail.type === 'task' ? '📋' : '🔔'}</div>
        <div className="font-bold text-sm mb-2">{detail.title}</div>
        {detail.body && <p className="text-sm text-gray-600 leading-relaxed">{detail.body}</p>}
        <div className="text-xs text-gray-300 mt-3">{fdf(detail.created_at)}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed top-14 right-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-80 max-h-80 overflow-y-auto z-[55]">
      <div className="p-3 border-b border-gray-50 font-bold text-sm">🔔 Bildirimler</div>
      {notifs.map(n => (
        <div key={n.id} onClick={() => setDetail(n)} className={`px-3 py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-emerald-50/50' : ''}`}>
          <div className="text-sm font-semibold">{n.title}</div>
          {n.body && <div className="text-xs text-gray-400 truncate">{n.body}</div>}
          <div className="text-[10px] text-gray-300 mt-0.5">{fd(n.created_at)}</div>
        </div>
      ))}
      {notifs.length === 0 && <div className="p-4 text-center text-sm text-gray-400">Bildirim yok</div>}
      <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 border-t border-gray-50">Kapat</button>
    </div>
  );
}

function ProfileDropdown({ me, uid, onUpdate, onModal, onClose }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ display_name: me.display_name, city: me.city||'', bio: me.bio||'' });
  const [tgCode, setTgCode] = useState(null);
  const save = async () => { const { data } = await db.updateProfile(uid, f); if (data) onUpdate(data); setEditing(false); };
  const linkTg = async () => { const code = String(Math.floor(100000 + Math.random() * 900000)); await db.updateProfile(uid, { telegram_link_code: code }); setTgCode(code); };

  return (
    <div className="fixed top-14 right-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-72 z-[55]">
      <div className="p-4 text-center border-b border-gray-50">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-xl font-bold text-emerald-600 mx-auto mb-1">{(me.display_name||'?')[0]}</div>
        <div className="font-bold">{me.display_name}</div>
        <div className="text-xs text-gray-400">{ROLES[me.role]?.i} {ROLES[me.role]?.l} · {DM[me.department]?.l || '—'}</div>
      </div>
      {!editing ? (
        <div className="p-2">
          <button onClick={() => setEditing(true)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">✏️ Profili Düzenle</button>
          {me.telegram_id ? (
            <div className="px-3 py-2 text-sm text-emerald-600">✈️ Telegram bağlı ✓</div>
          ) : tgCode ? (
            <div className="px-3 py-2 space-y-2">
              <div className="text-xs text-gray-500">1. Telegram'da <b>@tarihvakfi_bot</b>'u aç</div>
              <div className="text-xs text-gray-500">2. Bu kodu gönder:</div>
              <div className="flex items-center gap-2"><div className="flex-1 font-mono font-bold text-center bg-gray-50 rounded-lg py-2 text-lg tracking-widest">{tgCode}</div><button onClick={() => navigator.clipboard.writeText(`/start ${tgCode}`)} className="text-xs bg-gray-100 px-2 py-1.5 rounded-lg">Kopyala</button></div>
              <a href={`https://t.me/tarihvakfi_bot?start=${tgCode}`} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-blue-600 font-semibold">veya buraya tıkla →</a>
              <div className="text-[10px] text-gray-400">Kod 10 dakika geçerlidir.</div>
              <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">Bağlandıktan sonra:<br/>• "bugün 3 saat belge taradım"<br/>• /ozet → çalışma özetin<br/>• /yardim → tüm komutlar</div>
            </div>
          ) : (
            <button onClick={linkTg} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">✈️ Telegram Bağla</button>
          )}
          <button onClick={() => { onModal('summary'); onClose(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">📊 Çalışma Özeti</button>
          <button onClick={() => { onModal('certs'); onClose(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">🏆 Belgelerim</button>
          <button onClick={() => { onModal('help'); onClose(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">❓ Yardım</button>
          <div className="border-t border-gray-50 mt-1 pt-1">
            <button onClick={db.signOut} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50 rounded-lg">Çıkış</button>
            <button onClick={async () => { if (!confirm('Tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misiniz?')) return; await db.updateProfile(uid, { display_name: 'Silinmiş Kullanıcı', email: null, phone: null, bio: '', city: '', status: 'resigned' }); db.signOut(); }} className="w-full text-left px-3 py-2 text-[11px] text-gray-300 hover:text-red-400 hover:bg-gray-50 rounded-lg">Verilerimi Sil</button>
          </div>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="İsim" value={f.display_name} onChange={e => setF({...f, display_name: e.target.value})} />
          <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Şehir" value={f.city} onChange={e => setF({...f, city: e.target.value})} />
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl">Kaydet</button>
            <button onClick={() => setEditing(false)} className="text-sm text-gray-400 px-3">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkSummaryModal({ uid }) {
  const [s, setS] = useState(null);
  useEffect(() => { db.getWorkSummary(uid).then(({ data }) => setS(data)); }, [uid]);
  if (!s) return <p className="text-sm text-gray-400">Yükleniyor...</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr className="border-b"><td className="py-2 text-gray-500">Bu Hafta</td><td className="py-2 font-semibold text-right">{s.week_days} rapor · {fmtH(Number(s.week_hours))}</td></tr>
        <tr className="border-b"><td className="py-2 text-gray-500">Bu Ay</td><td className="py-2 font-semibold text-right">{s.month_days} rapor · {fmtH(Number(s.month_hours))}</td></tr>
        <tr className="border-b"><td className="py-2 text-gray-500">Toplam</td><td className="py-2 font-bold text-emerald-600 text-right">{s.total_days} rapor · {fmtH(Number(s.total_hours))}</td></tr>
        {(Number(s.onsite_hours)>0 || Number(s.remote_hours)>0) && <>
          <tr className="border-b"><td className="py-2 text-gray-400 text-xs">🏛️ Vakıfta</td><td className="py-2 text-xs text-right">{fmtH(Number(s.onsite_hours))}</td></tr>
          <tr><td className="py-2 text-gray-400 text-xs">🏠 Uzaktan</td><td className="py-2 text-xs text-right">{fmtH(Number(s.remote_hours))}</td></tr>
        </>}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function useToast() {
  const [msg, setMsg] = useState('');
  const show = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const Toast = () => msg ? <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg z-[70] animate-pulse">{msg}</div> : null;
  return { show, Toast };
}

// ═══════════════════════════════════════════
// 📋 İŞLERİM (herkes — tek ekran)
// ═══════════════════════════════════════════
function MyScreen({ uid, me, onModal }) {
  const [showForm, setShowForm] = useState(false);
  const [editR, setEditR] = useState(null);
  const [f, setF] = useState({ h: '', desc: '', mode: 'onsite', date: today(), plan: '', taskId: '' });
  const [errors, setErrors] = useState({});
  const [showExtra, setShowExtra] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showGuide, setShowGuide] = useState(me.first_login);
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expandTask, setExpandTask] = useState(null);
  const [progVal, setProgVal] = useState(0);
  const [progNote, setProgNote] = useState('');
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const [r, t, ws] = await Promise.all([
      db.getWeekReports(uid), db.getTasks({ assignedTo: uid }), db.getWorkSummary(uid),
    ]);
    setReports(r.data || []);
    setTasks((t.data || []).filter(t => !['done','cancelled'].includes(t.status)));
    setSummary(ws.data);
  }, [uid, me.department]);
  useEffect(() => { load(); }, [load]);

  // Smart defaults from last report
  const lastReport = reports[0];
  const resetForm = () => setF({
    h: '', desc: '', mode: lastReport?.work_mode || 'onsite', date: today(), plan: '', taskId: ''
  });

  const validate = () => {
    const e = {};
    const hours = parseFloat(f.h);
    if (!f.h) e.h = 'Kaç saat çalıştığını yaz';
    else if (hours < 0.5) e.h = 'En az yarım saat olmalı';
    else if (hours > 16) e.h = 'Bir günde 16 saatten fazla olamaz';
    if (!f.desc.trim()) e.desc = 'Ne yaptığını kısaca yaz';
    if (f.date > today()) e.date = 'İleri tarih seçilemez';
    // Günlük max 5 rapor
    if (!editR && reports.filter(r => r.date === f.date).length >= 5) e.date = 'Bugün için max 5 rapor girilebilir';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    if (editR) {
      const upd = { hours: parseFloat(f.h), work_mode: f.mode, description: f.desc, next_plan: f.plan, date: f.date };
      if (editR.status === 'approved') upd.status = 'pending';
      await db.updateWorkReport(editR.id, upd);
      toast.show(editR.status === 'approved' ? '✅ Güncellendi. Tekrar onay gerekiyor.' : '✅ Güncellendi!');
    } else {
      await db.createWorkReport({ user_id: uid, date: f.date, hours: parseFloat(f.h), work_mode: f.mode, description: f.desc, next_plan: f.plan, source: 'web', task_id: f.taskId || null });
      toast.show('✅ Kaydedildi! Koordinatörün onaylayacak.');
    }
    setShowForm(false); setEditR(null); resetForm(); setErrors({}); setSaving(false); load();
  };

  const quickRepeat = async () => {
    if (!lastReport) return;
    setSaving(true);
    await db.createWorkReport({ user_id: uid, date: today(), hours: lastReport.hours, work_mode: lastReport.work_mode, description: lastReport.description, source: 'web' });
    toast.show('✅ Kaydedildi!');
    setSaving(false); load();
  };

  const handleDelete = async (r) => {
    if (!r) return;
    const daysDiff = Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000);
    if (daysDiff > 30) { toast.show('❌ 30 günden eski raporlar silinemez'); return; }
    if (r.status === 'approved') { setConfirmDelete(r); return; }
    await db.deleteWorkReport(r.id);
    toast.show('🗑️ Rapor silindi');
    setShowForm(false); setEditR(null); load();
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    await db.deleteWorkReport(confirmDelete.id);
    toast.show('🗑️ Rapor silindi');
    setConfirmDelete(null); setShowForm(false); setEditR(null); load();
  };

  const startEdit = (r) => {
    setF({ h: String(r.hours), desc: r.description||'', mode: r.work_mode||'onsite', date: r.date, plan: r.next_plan||'', taskId: r.task_id||'' });
    setEditR(r); setShowForm(true); setShowExtra(!!r.next_plan); setErrors({});
  };

  const dismissGuide = async () => {
    setShowGuide(false);
    await db.updateProfile(uid, { first_login: false });
  };

  const updateProgress = async (task) => {
    if (!progNote.trim()) return;
    setSaving(true);
    await db.addProgressLog({ task_id: task.id, user_id: uid, previous_value: task.progress||0, new_value: progVal, note: progNote });
    await db.updateTaskProgress(task.id, progVal);
    toast.show('✅ İlerleme güncellendi!');
    setProgNote(''); setExpandTask(null); setSaving(false); load();
  };

  const weekTotal = reports.reduce((a, r) => a + Number(r.hours||0), 0);

  return (
    <div className="space-y-6">
      <toast.Toast />

      {/* Silme onay modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full text-center space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-3xl">⚠️</div>
            <p className="font-bold">Onaylanmış raporu sil?</p>
            <p className="text-sm text-gray-500">Bu rapor onaylanmış. Silersen <b>{fmtH(confirmDelete.hours)}</b> toplam saatinden düşülecek.</p>
            <div className="flex gap-2">
              <button onClick={confirmDeleteAction} className="flex-1 bg-red-500 text-white font-semibold py-2.5 rounded-xl">Evet, Sil</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-gray-200 font-semibold py-2.5 rounded-xl text-gray-500">Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {/* İlk kullanım rehberi */}
      {showGuide && (
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
          <h3 className="font-bold text-emerald-800 mb-2">Hoş geldin! 🎉</h3>
          <p className="text-sm text-emerald-700 leading-relaxed">Sistem çok basit:</p>
          <div className="mt-2 space-y-1 text-sm text-emerald-600">
            <p>1️⃣ <b>Çalışmanı raporla</b> → saat ve ne yaptığını yaz</p>
            <p>2️⃣ <b>İşlerini takip et</b> → sana atanan işleri gör</p>
            <p>3️⃣ <b>Hepsi bu kadar</b> 😊</p>
            <p>4️⃣ <b>Telegram bağla</b> → telefonundan rapor gir (opsiyonel)</p>
          </div>
          <button onClick={dismissGuide} className="bg-emerald-600 text-white font-semibold text-sm py-2 px-4 rounded-xl mt-3">Anladım, başlayalım!</button>
        </div>
      )}

      {/* Selamlama + Özet */}
      <div className="card" style={{background:'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)'}}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Merhaba {me.display_name?.split(' ')[0]} 👋</h1>
            {summary && <p className="text-sm text-gray-500 mt-1">Bu ay: <b className="text-emerald-600">{summary.month_days} gün</b>, <b className="text-emerald-600">{fmtH(Number(summary.month_hours))}</b> çalıştın</p>}
          </div>
          <button onClick={() => onModal('summary')} className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-sm hover:bg-emerald-100 transition-colors" aria-label="Detaylı özet">📊</button>
        </div>
      </div>

      {/* Raporla Butonu / Form */}
      {!showForm ? (
        <button onClick={() => { resetForm(); setEditR(null); setShowForm(true); setShowExtra(false); setErrors({}); }} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg w-full transition-all active:scale-[0.98]" style={{height:56,borderRadius:12}} aria-label="Çalışma raporla">
          📝 Çalışma Raporu
        </button>
      ) : (
        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-800">{editR ? 'Düzenle' : 'Çalışma Raporu'}</span>
            <button onClick={() => { setShowForm(false); setEditR(null); setErrors({}); }} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors" aria-label="Kapat">✕</button>
          </div>
          {/* Saat */}
          <div>
            <label htmlFor="hours-input" className="text-sm text-gray-500">⏱️ Kaç saat?</label>
            <input id="hours-input" type="number" inputMode="decimal" step="0.5" min="0.5" max="16" className={`w-full border rounded-xl px-4 text-2xl font-bold mt-1 outline-none focus:border-emerald-500 text-center ${errors.h ? 'border-red-300' : 'border-gray-200'}`} style={{height:56}} placeholder={lastReport ? String(lastReport.hours) : '3'} value={f.h} onChange={e => { setF({...f, h: e.target.value}); setErrors({...errors, h: ''}); }} />
            {errors.h && <p className="text-xs text-red-500 mt-1">{errors.h}</p>}
          </div>
          {/* Açıklama */}
          <div>
            <label htmlFor="desc-input" className="text-sm text-gray-500">📝 Ne yaptım?</label>
            <input id="desc-input" className={`w-full border rounded-xl px-4 py-3 text-sm mt-1 outline-none focus:border-emerald-500 ${errors.desc ? 'border-red-300' : 'border-gray-200'}`} placeholder={lastReport?.description || '3. kutudaki belgeleri taradım'} value={f.desc} onChange={e => { setF({...f, desc: e.target.value}); setErrors({...errors, desc: ''}); }} />
            {errors.desc && <p className="text-xs text-red-500 mt-1">{errors.desc}</p>}
          </div>
          {/* Nerede */}
          <div className="flex gap-2">
            <button onClick={() => setF({...f, mode:'onsite'})} className={`flex-1 rounded-xl text-sm font-semibold transition-all ${f.mode==='onsite' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500'}`} style={{height:44}} aria-label="Vakıfta">🏛️ Vakıfta</button>
            <button onClick={() => setF({...f, mode:'remote'})} className={`flex-1 rounded-xl text-sm font-semibold transition-all ${f.mode==='remote' ? 'bg-blue-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500'}`} style={{height:44}} aria-label="Uzaktan">🏠 Uzaktan</button>
          </div>
          {/* Kaydet */}
          <button onClick={submit} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold w-full rounded-xl disabled:opacity-50 transition-all" style={{height:52}} aria-label="Kaydet">{saving ? '...' : 'Kaydet'}</button>
          {editR?.status === 'approved' && <p className="text-xs text-amber-500 text-center">⚠️ Onaylanmış rapor — tekrar onay gerekecek</p>}
          {editR && <button onClick={() => handleDelete(editR)} className="w-full text-center text-sm text-red-400 py-2 hover:text-red-500 transition-colors">Raporu Sil</button>}
          {/* Ekstra */}
          {/* İlgili iş (opsiyonel) */}
          {tasks.length > 0 && (
            <div>
              <label className="text-xs text-gray-400">📋 İlgili iş (opsiyonel)</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1" value={f.taskId} onChange={e => setF({...f, taskId: e.target.value})}>
                <option value="">Bağımsız çalışma</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title} ({Math.round(t.progress||0)}%)</option>)}
              </select>
            </div>
          )}
          {!showExtra && (
            <div className="flex gap-4 text-xs text-gray-400 justify-center">
              <button onClick={() => setShowExtra(true)}>📅 Tarih değiştir</button>
              <button onClick={() => setShowExtra(true)}>📌 Plan ekle</button>
            </div>
          )}
          {showExtra && (
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <div className="flex gap-2 items-center"><span className="text-xs text-gray-400 w-8">📅</span><input type="date" className={`flex-1 border rounded-xl px-3 py-2 text-sm ${errors.date ? 'border-red-300' : ''}`} max={today()} value={f.date} onChange={e => setF({...f, date: e.target.value})} />{errors.date && <span className="text-xs text-red-500">{errors.date}</span>}</div>
              <div className="flex gap-2 items-center"><span className="text-xs text-gray-400 w-8">📌</span><input className="flex-1 border rounded-xl px-3 py-2 text-sm" placeholder="Sonraki planım" value={f.plan} onChange={e => setF({...f, plan: e.target.value})} /></div>
            </div>
          )}
        </div>
      )}

      {/* Atanan İşlerim */}
      <div>
        <h2 className="font-bold mb-2">📋 Atanan İşlerim</h2>
        {tasks.length === 0 && <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3 text-center">Sana atanmış iş yok. Ama çalışmanı yukarıdan raporlayabilirsin.</p>}
        {tasks.length > 0 && (
          <div>
          {tasks.map(t => {
            const expanded = expandTask === t.id;
            return (
              <div key={t.id} className="card mb-2 !p-3" style={{borderLeft: '4px solid #10B981'}}>
                <div className="flex items-center justify-between">
                  <div className="flex-1"><span className="font-semibold text-sm text-gray-800">{t.title}</span><span className="text-xs text-gray-400 ml-2">{Math.round(t.progress||0)}%</span></div>
                  <button onClick={() => { setExpandTask(expanded ? null : t.id); setProgVal(t.progress||0); }} className="text-xs text-emerald-600 font-semibold">{expanded ? '✕' : 'Güncelle'}</button>
                </div>
                <div className="mt-1.5 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${(t.progress||0)>=80?'bg-emerald-500':(t.progress||0)>=40?'bg-amber-400':'bg-red-400'}`} style={{width:`${t.progress||0}%`}} /></div>
                {expanded && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                    <div className="flex items-center gap-2"><input type="range" min="0" max="100" step="5" value={progVal} onChange={e => setProgVal(Number(e.target.value))} className="flex-1 accent-emerald-600" /><span className="text-sm font-bold w-10 text-right">{progVal}%</span></div>
                    <div className="flex gap-1.5">{[25,50,75,100].map(v => <button key={v} onClick={() => setProgVal(v)} className={`text-xs px-2.5 py-1 rounded-lg ${progVal===v?'bg-emerald-600 text-white':'bg-gray-100 text-gray-400'}`}>%{v}</button>)}</div>
                    <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Ne yaptım?" value={progNote} onChange={e => setProgNote(e.target.value)} />
                    <button onClick={() => updateProgress(t)} disabled={saving} className="bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl w-full disabled:opacity-50">Kaydet</button>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Bu Hafta */}
      <div>
        <h2 className="font-bold mb-2">📅 Bu Hafta <span className="text-sm text-gray-400 font-normal">{reports.length} rapor, {fmtH(weekTotal)}</span></h2>
        {reports.map(r => (
          <div key={r.id} className="card mb-2 !p-3 flex items-center gap-2 cursor-pointer hover:shadow-md transition-shadow" onClick={() => startEdit(r)}>
            <span className="text-sm">{r.task_id ? '📋' : '📝'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><span className="text-sm font-semibold">{fd(r.date)}</span><span className="text-sm text-gray-500">{fmtH(r.hours)}</span><span className="text-xs">{r.work_mode==='remote'?'🏠':'🏛️'}</span></div>
              <div className="text-xs text-gray-400 truncate">{r.description}</div>
            </div>
            <span className={`text-xs flex-shrink-0 ${r.status==='approved'?'text-emerald-500':r.status==='rejected'?'text-red-400':'text-amber-400'}`}>{r.status==='approved'?'✅':r.status==='rejected'?'❌':'⏳'}</span>
          </div>
        ))}
        {reports.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Henüz çalışma raporun yok. İlk raporunu oluşturmak için yukarıdaki butona tıkla 👆</p>}
        {lastReport && !showForm && (
          <button onClick={quickRepeat} disabled={saving} className="w-full text-center text-sm text-emerald-600 font-semibold py-2.5 bg-emerald-50 rounded-xl disabled:opacity-50 hover:bg-emerald-100 transition-colors" aria-label="Aynısını tekrarla">🔄 Aynısını tekrarla — {fmtH(lastReport.hours)}</button>
        )}
      </div>

      {/* Destek */}
      {me.role !== 'admin' && (
        <SupportLink uid={uid} me={me} />
      )}
    </div>
  );
}

function SupportLink({ uid, me }) {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const send = async () => {
    if (!msg.trim()) return;
    let targets = [];
    if (me.department) { const { data } = await db.getCoordsByDept(me.department); targets = (data||[]).map(c => c.id); }
    if (!targets.length) { const { data } = await db.getProfilesByRole('admin'); targets = (data||[]).map(a => a.id); }
    for (const t of targets) await db.sendNotification(t, 'system', `💬 ${me.display_name}`, msg.slice(0,200));
    setSent(true); setMsg(''); setTimeout(() => { setSent(false); setShow(false); }, 2000);
  };
  return (
    <div className="text-center text-xs text-gray-400 pt-2">
      {!show && !sent && <button onClick={() => setShow(true)}>Bir sorunun mu var? <span className="text-emerald-600 font-semibold">Mesaj gönder</span></button>}
      {show && <div className="flex gap-2 mt-2"><input className="flex-1 border rounded-xl px-3 py-2 text-sm" placeholder="Mesajınız..." value={msg} onChange={e => setMsg(e.target.value)} /><button onClick={send} disabled={!msg.trim()} className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50">Gönder</button></div>}
      {sent && <span className="text-emerald-600">✓ Gönderildi!</span>}
    </div>
  );
}

// ═══════════════════════════════════════════
// 👥 TAKIMIM (koordinatör)
// ═══════════════════════════════════════════
function Section({ title, count, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-2">
        <h2 className="font-bold">{title} {count > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{count}</span>}</h2>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  );
}

function TeamScreen({ uid, me }) {
  const [pending, setPending] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [vols, setVols] = useState([]);
  const [showNewTask, setShowNewTask] = useState(false);
  const [tf, setTf] = useState({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'' });
  const [showAnn, setShowAnn] = useState(false);
  const [annF, setAnnF] = useState({ title:'', body:'' });
  const [summaries, setSummaries] = useState([]);
  const [certVol, setCertVol] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [showShift, setShowShift] = useState(false);
  const [sf, setSf] = useState({ volunteer_id:'', day_of_week:'Pzt', start_time:'10:00', end_time:'14:00', department: me.department||'arsiv' });

  const load = useCallback(async () => {
    const [p, t, v, ws, sh] = await Promise.all([
      db.getPendingReports(), db.getTasks(), db.getAllProfiles(), db.getAllWorkSummaries(), db.getShifts({}),
    ]);
    setPending(p.data || []);
    setTasks(t.data || []);
    setVols((v.data || []).filter(v => v.status === 'active'));
    setSummaries(ws.data || []);
    setShifts(sh.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (id) => { await db.approveReport(id, uid); load(); };
  const approveAll = async () => { const ids = pending.filter(r => r.user_id !== uid).map(r => r.id); await db.approveAllReports(ids, uid); load(); };
  const createTask = async () => { if (!tf.title) return; await db.createTask({ title: tf.title, description: tf.description, department: tf.department, deadline: tf.deadline, materials: tf.materials||'', is_recurring: tf.recurring||false, priority:'medium', assigned_to: tf.assigned_to ? [tf.assigned_to] : [], created_by: uid }); setShowNewTask(false); setTf({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'', materials:'', recurring:false }); load(); };
  const createAnn = async () => { if (!annF.title || !annF.body) return; await db.createAnnouncement({ ...annF, department: null, is_pinned: false, is_public: false, author_id: uid }); setShowAnn(false); setAnnF({ title:'', body:'' }); };
  const approveTask = async (id) => { await db.updateTask(id, { status: 'done', completed_at: new Date().toISOString() }); load(); };
  const createShift = async () => { if (!sf.volunteer_id) return; await db.createShift({ ...sf, created_by: uid }); setShowShift(false); load(); };
  const delShift = async (id) => { await db.deleteShift(id); load(); };

  const sumMap = Object.fromEntries(summaries.map(s => [s.id, s]));

  return (
    <div className="space-y-6">
      {/* Onaylar */}
      <Section title="⏳ Onay Bekleyen" count={pending.length} defaultOpen={true}>
        <div>
        <div className="flex justify-end mb-2">
          {pending.filter(r => r.user_id !== uid).length > 1 && <button onClick={approveAll} className="text-xs bg-emerald-50 text-emerald-600 font-semibold px-3 py-1 rounded-lg">✓ Hepsini Onayla</button>}
        </div>
        {pending.map(r => (
          <div key={r.id} className="bg-gray-50 rounded-xl p-3 mb-1.5 flex items-center gap-2">
            <span className="text-sm">{r.task_id ? '📋' : '📝'}</span>
            <div className="flex-1"><div className="text-sm font-semibold">{r.profiles?.display_name} <span className="text-xs">{r.work_mode==='remote'?'🏠':'🏛️'}</span></div><div className="text-xs text-gray-400">{fd(r.date)} · {fmtH(r.hours)} · {r.description?.slice(0,40)}{r.edited_at ? ' ✏️' : ''}{r.task_id ? ' · İşe bağlı' : ''}</div></div>
            {r.user_id !== uid ? (<div className="flex gap-1"><button onClick={() => approve(r.id)} className="text-xs bg-emerald-50 text-emerald-600 font-semibold px-2.5 py-1.5 rounded-lg">✓</button><button onClick={async () => { await db.deleteWorkReport(r.id); load(); }} className="text-xs bg-red-50 text-red-400 px-2 py-1.5 rounded-lg">🗑️</button></div>) : <span className="text-xs text-gray-300">Kendi</span>}
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Bekleyen yok ✓</p>}
      </div>
      </Section>

      {/* İşler */}
      {/* Aktivite dikkat */}
      <ActivityOverview vols={vols} />

      <Section title={`📋 İşler (${tasks.filter(t=>t.status!=='cancelled').length})`} count={0} defaultOpen={false}><div>
        <div className="flex justify-end mb-2">
          <button onClick={() => setShowNewTask(!showNewTask)} className="text-xs bg-emerald-600 text-white font-semibold px-3 py-1.5 rounded-lg">{showNewTask ? '✕' : '+ Yeni'}</button>
        </div>
        {showNewTask && (
          <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="İş başlığı" value={tf.title} onChange={e => setTf({...tf, title: e.target.value})} />
            <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} placeholder="Açıklama" value={tf.description} onChange={e => setTf({...tf, description: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <select className="border rounded-xl px-3 py-2 text-sm" value={tf.department} onChange={e => setTf({...tf, department: e.target.value})}>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>
              <select className="border rounded-xl px-3 py-2 text-sm" value={tf.assigned_to} onChange={e => setTf({...tf, assigned_to: e.target.value})}><option value="">Atanacak</option>{vols.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
            </div>
            <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm" value={tf.deadline} onChange={e => setTf({...tf, deadline: e.target.value})} />
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Gerekli malzeme (opsiyonel)" value={tf.materials||''} onChange={e => setTf({...tf, materials: e.target.value})} />
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer"><input type="checkbox" checked={tf.recurring||false} onChange={e => setTf({...tf, recurring: e.target.checked})} /> 🔄 Tamamlanınca tekrarla</label>
            <button onClick={createTask} className="bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl w-full">Oluştur</button>
          </div>
        )}
        {tasks.filter(t => t.status !== 'cancelled').slice(0, 10).map(t => (
          <div key={t.id} className="bg-gray-50 rounded-xl p-3 mb-1.5">
            <div className="flex items-center justify-between">
              <div className="flex-1"><span className="font-semibold text-sm">{t.title}</span> <span className="text-xs text-gray-400">{Math.round(t.progress||0)}%</span></div>
              {t.status === 'review' && <button onClick={() => approveTask(t.id)} className="text-xs bg-emerald-50 text-emerald-600 font-semibold px-2 py-1 rounded-lg">✓ Tamamla</button>}
              {t.status !== 'done' && t.status !== 'cancelled' && <button onClick={async () => { await db.updateTask(t.id, { status: 'cancelled' }); if (t.assigned_to) { for (const vid of t.assigned_to) await db.sendNotification(vid, 'task', `📋 ${t.title} iptal edildi`, ''); } load(); }} className="text-xs text-red-400 px-2 py-1">İptal</button>}
            </div>
            <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${t.status==='done'?'bg-emerald-500':t.status==='review'?'bg-blue-500':'bg-amber-400'}`} style={{width:`${t.progress||0}%`}} /></div>
          </div>
        ))}
      </div></Section>

      {/* Gönüllü Özeti */}
      <div>
        <h2 className="font-bold mb-2">👥 Gönüllüler</h2>
        {summaries.filter(s => Number(s.total_hours) > 0).map(v => (
          <div key={v.id} className="bg-gray-50 rounded-xl p-3 mb-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">{(v.display_name||'?')[0]}</div>
            <div className="flex-1"><div className="text-sm font-semibold">{v.display_name}</div><div className="text-xs text-gray-400">Bu ay: {v.month_days}r / {fmtH(Number(v.month_hours))}</div></div>
            <button onClick={() => setCertVol(vols.find(x => x.id === v.id))} className="text-xs text-amber-600">🏆</button>
          </div>
        ))}
      </div>

      {/* Sohbet */}
      <div>
        <h2 className="font-bold mb-2">💬 Sohbet</h2>
        <ChatSection uid={uid} me={me} />
      </div>

      {/* Duyuru */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">📢 Duyuru Yaz</h2>
          <button onClick={() => setShowAnn(!showAnn)} className="text-xs text-emerald-600 font-semibold">{showAnn ? '✕' : '+'}</button>
        </div>
        {showAnn && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Başlık" value={annF.title} onChange={e => setAnnF({...annF, title: e.target.value})} />
            <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} placeholder="İçerik" value={annF.body} onChange={e => setAnnF({...annF, body: e.target.value})} />
            <button onClick={createAnn} className="bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl w-full">Yayınla</button>
          </div>
        )}
      </div>

      {/* Vardiya */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">📅 Vardiya Planı</h2>
          <button onClick={() => setShowShift(!showShift)} className="text-xs text-emerald-600 font-semibold">{showShift ? '✕' : '+ Ekle'}</button>
        </div>
        {showShift && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-2">
            <select className="w-full border rounded-xl px-3 py-2 text-sm" value={sf.volunteer_id} onChange={e => setSf({...sf, volunteer_id: e.target.value})}><option value="">Gönüllü</option>{vols.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
            <div className="grid grid-cols-3 gap-2">
              <select className="border rounded-xl px-3 py-2 text-sm" value={sf.day_of_week} onChange={e => setSf({...sf, day_of_week: e.target.value})}>{DAYS.map(d => <option key={d}>{d}</option>)}</select>
              <input type="time" className="border rounded-xl px-3 py-2 text-sm" value={sf.start_time} onChange={e => setSf({...sf, start_time: e.target.value})} />
              <input type="time" className="border rounded-xl px-3 py-2 text-sm" value={sf.end_time} onChange={e => setSf({...sf, end_time: e.target.value})} />
            </div>
            <button onClick={createShift} className="bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl w-full">Ekle</button>
          </div>
        )}
        {DAYS.filter(d => shifts.some(s => s.day_of_week === d)).map(day => (
          <div key={day} className="mb-1"><span className="text-xs font-bold text-gray-500">{day}</span>
            {shifts.filter(s => s.day_of_week === day).map(sh => (
              <div key={sh.id} className="bg-gray-50 rounded-xl p-2 mt-0.5 flex items-center gap-2 text-sm">
                <span className="flex-1">{sh.profiles?.display_name} · {sh.start_time?.slice(0,5)}–{sh.end_time?.slice(0,5)}</span>
                <button onClick={() => delShift(sh.id)} className="text-xs text-gray-300">✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {certVol && <CertificateModal vol={certVol} summary={sumMap[certVol.id]} issuerId={uid} onClose={() => setCertVol(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// 👥 YÖNETİM (admin)
// ═══════════════════════════════════════════
function ActivityOverview({ vols }) {
  const [showDetail, setShowDetail] = useState(false);
  const activeVols = vols.filter(v => v.status === 'active' && v.role === 'vol');
  const counts = { active: 0, slowing: 0, inactive: 0, dormant: 0 };
  activeVols.forEach(v => { counts[v.activity_status || 'active']++; });
  const needsAttention = activeVols.filter(v => ['slowing','inactive','dormant'].includes(v.activity_status));

  if (activeVols.length === 0) return null;

  return (
    <div>
      <button onClick={() => setShowDetail(!showDetail)} className="w-full bg-gray-50 rounded-xl p-3 text-left">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">👥 Gönüllü Aktivite</h2>
          <span className="text-gray-400 text-xs">{showDetail ? '▲' : '▼'}</span>
        </div>
        <div className="flex gap-3 mt-1.5 text-xs">
          <span>🟢 {counts.active}</span>
          {counts.slowing > 0 && <span className="text-amber-600">🟡 {counts.slowing}</span>}
          {counts.inactive > 0 && <span className="text-orange-600">🟠 {counts.inactive}</span>}
          {counts.dormant > 0 && <span className="text-red-600">🔴 {counts.dormant}</span>}
        </div>
      </button>
      {showDetail && needsAttention.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {needsAttention.sort((a,b) => (a.activity_score||0) - (b.activity_score||0)).map(v => {
            const lastAct = v.last_activity_at ? Math.floor((Date.now() - new Date(v.last_activity_at).getTime()) / 86400000) : 999;
            const icon = (v.activity_status === 'slowing') ? '🟡' : (v.activity_status === 'inactive') ? '🟠' : '🔴';
            return (
              <div key={v.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                <span>{icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{v.display_name}</div>
                  <div className="text-xs text-gray-400">{lastAct < 999 ? `${lastAct} gündür rapor yok` : 'Hiç rapor yok'} · Skor: {v.activity_score||0}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showDetail && needsAttention.length === 0 && <p className="text-xs text-gray-400 mt-2 text-center">Herkes aktif 🎉</p>}
    </div>
  );
}

function AdminScreen({ uid, me }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [vols, setVols] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sel, setSel] = useState(null);
  const [certVol, setCertVol] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [search, setSearch] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [tf, setTf] = useState({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'', materials:'' });
  const [showAnn, setShowAnn] = useState(false);
  const [annF, setAnnF] = useState({ title:'', body:'' });

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

  const approveUser = async (id) => { await db.setUserStatus(id, 'active'); await db.sendNotification(id, 'welcome', 'Hesabınız onaylandı!', ''); load(); };
  const rejectUser = async (id) => { await db.setUserStatus(id, 'rejected'); load(); };
  const blockUser = async (id) => { await db.setUserStatus(id, 'blocked'); load(); };
  const approveReport = async (id) => { await db.approveReport(id, uid); load(); };
  const approveAllReports = async () => { const ids = pendingReports.filter(r => r.user_id !== uid).map(r => r.id); await db.approveAllReports(ids, uid); load(); };
  const changeRole = async (id, role) => { await db.setUserRole(id, role); setVols(vols.map(v => v.id === id ? {...v, role} : v)); };
  const changeDept = async (id, dept) => { await db.setUserDept(id, dept); setVols(vols.map(v => v.id === id ? {...v, department: dept} : v)); };
  const createTask = async () => { if (!tf.title) return; await db.createTask({ ...tf, priority:'medium', assigned_to: tf.assigned_to ? [tf.assigned_to] : [], created_by: uid }); setShowNewTask(false); setTf({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'', materials:'' }); load(); };
  const createAnn = async () => { if (!annF.title || !annF.body) return; await db.createAnnouncement({ ...annF, department: null, is_pinned: false, is_public: false, author_id: uid }); setShowAnn(false); setAnnF({ title:'', body:'' }); };

  const activeTasks = tasks.filter(t => ['active','pending','review'].includes(t.status));
  const overdueTasks = activeTasks.filter(t => t.deadline && t.deadline < today());
  const needsAttention = vols.filter(v => v.status === 'active' && v.role === 'vol' && ['slowing','inactive','dormant'].includes(v.activity_status));
  const filteredVols = vols.filter(v => !search || v.display_name?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase()));
  const allGood = pendingUsers.length === 0 && pendingReports.length === 0 && overdueTasks.length === 0 && needsAttention.length === 0;

  return (
    <div className="space-y-4">
      {/* Özet kartlar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { n: pendingUsers.length, l: 'Yeni Kayıt', i: '🆕', c: pendingUsers.length ? 'bg-blue-50 border-blue-200' : '' },
          { n: pendingReports.length, l: 'Onay Bekl.', i: '⏳', c: pendingReports.length ? 'bg-amber-50 border-amber-200' : '' },
          { n: vols.filter(v => v.status === 'active').length, l: 'Aktif Gön.', i: '👥' },
          { n: activeTasks.length, l: 'Açık İş', i: '📋', c: overdueTasks.length ? 'bg-red-50 border-red-200' : '' },
        ].map((s, i) => (
          <div key={i} className={`card !p-2.5 text-center ${s.c || ''}`}>
            <div className="text-lg font-bold">{s.n}</div>
            <div className="text-[10px] text-gray-500">{s.i} {s.l}</div>
          </div>
        ))}
      </div>

      {allGood && <div className="card !p-3 text-center text-sm text-emerald-600 font-semibold">✅ Her şey yolunda!</div>}

      {/* Kayıt Onaylama */}
      {pendingUsers.length > 0 && (
        <Section title="🆕 Kayıt Onaylama" count={pendingUsers.length} defaultOpen={true}>
          {pendingUsers.map(u => (
            <div key={u.id} className="card mb-2 !p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1"><div className="font-semibold text-sm">{u.display_name}</div><div className="text-xs text-gray-400">{u.email} · {fd(u.joined_at)}</div></div>
                <button onClick={() => approveUser(u.id)} className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-lg font-semibold">✓ Onayla</button>
                <button onClick={() => rejectUser(u.id)} className="text-xs bg-red-50 text-red-400 px-2 py-1.5 rounded-lg">✕</button>
                <button onClick={() => blockUser(u.id)} className="text-xs text-gray-300 px-2 py-1.5">🚫</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Rapor Onaylama */}
      {pendingReports.length > 0 && (
        <Section title="⏳ Rapor Onaylama" count={pendingReports.length} defaultOpen={true}>
          {pendingReports.map(r => (
            <div key={r.id} className="card mb-1.5 !p-3 flex items-center gap-2">
              <span className="text-xs">{r.task_id ? '📋' : '📝'} {r.work_mode==='remote'?'🏠':'🏛️'}</span>
              <div className="flex-1"><div className="text-sm font-semibold">{r.profiles?.display_name}</div><div className="text-xs text-gray-400">{fd(r.date)} · {fmtH(r.hours)} · {r.description?.slice(0,30)}{r.edited_at?' ✏️':''}</div></div>
              {r.user_id !== uid ? <button onClick={() => approveReport(r.id)} className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-lg font-semibold">✓</button> : <span className="text-xs text-gray-300">Kendi</span>}
            </div>
          ))}
          {pendingReports.filter(r => r.user_id !== uid).length > 1 && <button onClick={approveAllReports} className="w-full text-center text-sm text-emerald-600 font-semibold py-2 bg-emerald-50 rounded-xl mt-1">✓ Hepsini Onayla</button>}
        </Section>
      )}

      {/* Gönüllüler */}
      <Section title="👥 Gönüllüler" count={vols.filter(v=>v.status==='active').length} defaultOpen={false}>
        <input className="input-field !py-2 mb-2" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)} />
        {filteredVols.map(v => (
          <div key={v.id} className={`card mb-1.5 !p-3 ${v.status !== 'active' ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSel(sel === v.id ? null : v.id)}>
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600">{(v.display_name||'?')[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{v.display_name}</div>
                <div className="text-xs text-gray-400">{DM[v.department]?.l || '—'} · {ROLES[v.role]?.i}</div>
              </div>
              {v.id !== uid && (
                <select className="text-xs border rounded-lg px-1.5 py-1 bg-white" value={v.role} onClick={e=>e.stopPropagation()} onChange={e => changeRole(v.id, e.target.value)}>
                  <option value="vol">Gön</option><option value="coord">Krd</option><option value="admin">Yön</option>
                </select>
              )}
              <button onClick={e => { e.stopPropagation(); setCertVol(v); }} className="text-xs text-amber-500">🏆</button>
            </div>
            {sel === v.id && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                {v.id !== uid && <select className="w-full border rounded-lg px-2 py-1.5 text-sm" value={v.department||''} onChange={e => changeDept(v.id, e.target.value)}><option value="">Departman seç</option>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>}
                {summaries[v.id] && <div>Bu ay: {summaries[v.id].month_days}g / {fmtH(Number(summaries[v.id].month_hours))} · Toplam: {summaries[v.id].total_days}g / {fmtH(Number(summaries[v.id].total_hours))}</div>}
                <div>Son aktivite: {v.last_activity_at ? fd(v.last_activity_at) : '—'} · Skor: {v.activity_score||0}</div>
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* İşler */}
      <Section title={`📋 İşler (${activeTasks.length} açık${overdueTasks.length ? `, ${overdueTasks.length} gecikmiş` : ''})`} count={overdueTasks.length} defaultOpen={false}>
        <button onClick={() => setShowNewTask(!showNewTask)} className="text-xs bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg mb-2">{showNewTask ? '✕' : '+ Yeni İş'}</button>
        {showNewTask && (
          <div className="card mb-2 space-y-2 !p-3">
            <input className="input-field !py-2" placeholder="İş başlığı" value={tf.title} onChange={e => setTf({...tf, title: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input-field !py-2" value={tf.department} onChange={e => setTf({...tf, department: e.target.value})}>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>
              <select className="input-field !py-2" value={tf.assigned_to} onChange={e => setTf({...tf, assigned_to: e.target.value})}><option value="">Atanacak</option>{vols.filter(v=>v.status==='active').map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
            </div>
            <input type="date" className="input-field !py-2" value={tf.deadline} onChange={e => setTf({...tf, deadline: e.target.value})} />
            <button onClick={createTask} className="bg-emerald-500 text-white text-sm font-semibold py-2 rounded-xl w-full">Oluştur</button>
          </div>
        )}
        {tasks.filter(t => t.status !== 'cancelled').slice(0, 15).map(t => {
          const overdue = t.deadline && t.deadline < today() && !['done','cancelled'].includes(t.status);
          return (
            <div key={t.id} className={`card mb-1.5 !p-3 ${overdue ? 'border-l-4 border-red-400' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0"><span className="text-sm font-semibold truncate">{t.title}</span> <span className="text-xs text-gray-400">{Math.round(t.progress||0)}%</span></div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${t.status==='done'?'bg-emerald-50 text-emerald-600':t.status==='review'?'bg-blue-50 text-blue-600':'bg-gray-100 text-gray-500'}`}>{STATUSES[t.status]}</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${t.status==='done'?'bg-emerald-500':'bg-emerald-400'}`} style={{width:`${t.progress||0}%`}} /></div>
              {t.status === 'review' && <button onClick={async () => { await db.updateTask(t.id, { status:'done', completed_at: new Date().toISOString() }); load(); }} className="text-xs text-emerald-600 font-semibold mt-1">✓ Tamamla</button>}
            </div>
          );
        })}
      </Section>

      {/* İletişim: Sohbet + Duyuru + Vardiya */}
      <Section title="💬 İletişim" count={0} defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold mb-2">💬 Departman Sohbeti</h3>
            <ChatSection uid={uid} me={me} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold">📢 Duyuru</h3>
              <button onClick={() => setShowAnn(!showAnn)} className="text-xs text-emerald-600 font-semibold">{showAnn ? '✕' : '+ Yeni'}</button>
            </div>
            {showAnn && (
              <div className="card mb-2 space-y-2 !p-3">
                <input className="input-field !py-2" placeholder="Başlık" value={annF.title} onChange={e => setAnnF({...annF, title: e.target.value})} />
                <textarea className="input-field !py-2" rows={2} placeholder="İçerik" value={annF.body} onChange={e => setAnnF({...annF, body: e.target.value})} />
                <button onClick={createAnn} className="bg-emerald-500 text-white text-sm font-semibold py-2 rounded-xl w-full">Yayınla</button>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold mb-2">📅 Vardiya Planı</h3>
            <ShiftPlanView uid={uid} me={me} />
          </div>
        </div>
      </Section>

      {/* Dikkat Gerektiren */}
      {needsAttention.length > 0 && (
        <Section title="⚠️ Dikkat Gerektiren" count={needsAttention.length} defaultOpen={needsAttention.length > 0}>
          {needsAttention.sort((a,b) => (a.activity_score||0)-(b.activity_score||0)).map(v => {
            const days = v.last_activity_at ? Math.floor((Date.now()-new Date(v.last_activity_at).getTime())/86400000) : 999;
            const icon = (v.activity_status==='slowing')?'🟡':(v.activity_status==='inactive')?'🟠':'🔴';
            return (
              <div key={v.id} className="card mb-1.5 !p-3 flex items-center gap-2">
                <span>{icon}</span>
                <div className="flex-1"><div className="text-sm font-semibold">{v.display_name}</div><div className="text-xs text-gray-400">{days < 999 ? `${days} gündür rapor yok` : 'Hiç rapor yok'}</div></div>
              </div>
            );
          })}
        </Section>
      )}

      {certVol && <CertificateModal vol={certVol} summary={summaries[certVol.id]} issuerId={uid} onClose={() => setCertVol(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// 📊 RAPORLAR (admin)
// ═══════════════════════════════════════════
function ReportsScreen({ uid }) {
  const [quickResult, setQuickResult] = useState('');
  const [quickLoading, setQuickLoading] = useState('');

  const runQuick = async (period) => {
    setQuickLoading(period); setQuickResult('');
    const result = await quickReport(period);
    setQuickResult(result); setQuickLoading('');
  };

  return (
    <div className="space-y-4">
      {/* Hızlı raporlar */}
      <div className="grid grid-cols-3 gap-2">
        {[['today','📅 Bugün'],['week','📊 Bu Hafta'],['month','📈 Bu Ay']].map(([k,l]) => (
          <button key={k} onClick={() => runQuick(k)} disabled={!!quickLoading} className={`card !p-3 text-center cursor-pointer hover:shadow-md transition-shadow ${quickLoading===k?'opacity-50':''}`}>
            <div className="text-sm font-semibold">{l}</div>
          </button>
        ))}
      </div>

      {quickResult && (
        <div className="card">
          <pre className="text-xs whitespace-pre-wrap font-mono text-gray-600 leading-relaxed max-h-[50vh] overflow-y-auto">{quickResult}</pre>
          <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
            <button onClick={() => navigator.clipboard.writeText(quickResult)} className="text-xs bg-emerald-50 text-emerald-600 font-semibold px-3 py-1.5 rounded-lg">📋 Kopyala</button>
          </div>
        </div>
      )}

      {/* Detaylı rapor */}
      <Section title="📄 Detaylı Rapor Oluştur" count={0} defaultOpen={false}>
        <ReportBuilder uid={uid} />
      </Section>

      {/* Arşiv */}
      <Section title="📂 Rapor Arşivi" count={0} defaultOpen={false}>
        <ReportArchive />
      </Section>

      {/* Yedekleme */}
      <Section title="💾 Yedekleme" count={0} defaultOpen={false}>
        <BackupView uid={uid} />
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════
// SOHBET
// ═══════════════════════════════════════════
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
    <div className="space-y-2">
      {isCoordOrAdmin && <div className="flex gap-1 flex-wrap">{DEPTS.map(d => <button key={d.id} onClick={() => setDept(d.id)} className={`text-xs px-2 py-1 rounded-lg ${dept===d.id?'bg-gray-800 text-white':'bg-gray-100 text-gray-400'}`}>{d.i}</button>)}</div>}
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 max-h-60 overflow-y-auto">
        {messages.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Henüz mesaj yok</p>}
        {messages.map((m, i) => (
          <div key={m.id||i} className={`flex ${m.user_id===uid?'justify-end':'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 ${m.user_id===uid?'bg-emerald-600 text-white':'bg-white'}`}>
              {m.user_id !== uid && <div className="text-xs font-bold text-emerald-600 mb-0.5">{m.profiles?.display_name}</div>}
              <div className="text-sm">{m.content}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 border rounded-xl px-3 py-2 text-sm" placeholder="Mesaj..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} />
        <button onClick={send} disabled={!text.trim()} className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50">Gönder</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// YARDIM
// ═══════════════════════════════════════════
function HelpContent({ me }) {
  const items = [
    { q: 'Nasıl çalışma raporu girerim?', a: 'Çalışma Raporu butonuna tıkla → saat yaz → ne yaptığını yaz → Vakıfta/Uzaktan seç → Kaydet. Hepsi bu.' },
    { q: 'Raporumu nasıl düzenlerim?', a: 'Bu Hafta listesinde rapora tıkla → düzenle → Güncelle. Onaylanmış rapor düzenlenirse tekrar onay gerekir.' },
    { q: 'Raporumu nasıl silerim?', a: 'Rapora tıkla → Raporu Sil. Onaylanmış rapor silinirken onay istenir. 30 günden eski raporlar silinemez.' },
    { q: 'İşe bağlı rapor nedir?', a: 'Çalışma raporunda opsiyonel olarak ilgili işi seçebilirsin. Seçmesen de rapor kaydedilir — bağımsız çalışma olur.' },
    { q: 'Bildirimlerimi nasıl görebilirim?', a: 'Sağ üstteki 🔔 ikonuna tıkla. Duyurular ve görev atamaları da popup ile açılır.' },
    { q: 'Profilimi nasıl düzenlerim?', a: 'Sağ üstteki adına tıkla → Profili Düzenle.' },
    { q: 'Telegram nasıl bağlanır?', a: 'Sağ üstte adınıza tıklayın → Telegram Bağla → Ekrandaki 6 haneli kodu Telegram\'da @tarihvakfi_bot\'a gönderin → "Hesabın bağlandı!" mesajı gelince hazırsınız.' },
    { q: 'Telegram\'dan nasıl rapor girerim?', a: '"bugün 3 saat belge taradım" yazın, bot kaydeder. "dün 4 saat katalog girişi" ile geçmiş kayıt. /ozet ile çalışma özetinizi, /yardim ile tüm komutları görün.' },
    { q: 'Belgelerimi nerede görebilirim?', a: 'Adına tıkla → Belgelerim.' },
    { q: 'Sorun bildirmek istiyorum', a: 'Sayfanın altındaki "Sorunun mu var? Mesaj gönder" linkini kullan. Koordinatörüne gider.' },
  ];
  if (me.role !== 'vol') items.push(
    { q: 'Raporları nasıl onaylarım?', a: 'Takımım → Onay Bekleyenler → Onayla veya Reddet. Hepsini Onayla ile toplu onay. Kendi raporunu onaylayamazsın.' },
    { q: 'Nasıl iş oluştururum?', a: 'Takımım → İşler → + Yeni İş. Başlık, açıklama, atanan kişi ve son tarih gir.' },
    { q: 'İş tamamlama onayı nedir?', a: 'İş %100 olunca Kontrol Bekliyor durumuna geçer. ✓ Tamamla ile bitirirsin.' },
  );
  if (me.role === 'admin') items.push(
    { q: 'Yeni kullanıcıları nasıl onaylarım?', a: 'Yönetim → Onay Bekleyenler → Onayla/Reddet.' },
    { q: 'Rapor nasıl oluştururum?', a: 'Raporlar sekmesi → tip ve dönem seç → Önizle → Excel veya metin olarak indir.' },
    { q: 'Yedekleme nasıl yapılır?', a: 'Raporlar → aşağı kaydır → Yedekle → Google Sheets veya CSV.' },
  );
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-1.5">{items.map((item, i) => (
      <div key={i} className="card !p-3 cursor-pointer" onClick={() => setOpen(open===i?null:i)}>
        <div className="flex justify-between items-center"><span className="text-sm font-semibold">{item.q}</span><span className="text-gray-300 text-xs">{open===i?'▲':'▼'}</span></div>
        {open === i && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{item.a}</p>}
      </div>
    ))}</div>
  );
}

// ═══════════════════════════════════════════
// RESTRICTED (pending/blocked/etc)
// ═══════════════════════════════════════════
function RestrictedShell({ me, uid }) {
  const [sent, setSent] = useState(false);
  const msgs = { pending:{i:'⏳',t:'Kaydınız alındı!',d:'Yönetici onayı bekleniyor.'}, rejected:{i:'❌',t:'Başvuru reddedildi',d:'Yöneticiyle iletişime geçin.'}, blocked:{i:'🚫',t:'Hesap engellendi',d:'Yöneticiyle iletişime geçin.'}, paused:{i:'⏸️',t:'Hesap duraklatıldı',d:'Tekrar aktif olmak için talep gönderin.'}, inactive:{i:'🔒',t:'Hesap pasif',d:'30 gündür raporlama yapılmadığı için pasife alındı.'}, resigned:{i:'👋',t:'Ayrıldınız',d:'Eski verileriniz korunuyor.'} };
  const m = msgs[me.status] || msgs.blocked;
  const canReactivate = ['paused','inactive','resigned'].includes(me.status);

  const requestReactivation = async () => {
    const { data: admins } = await db.getProfilesByRole('admin');
    for (const a of (admins || [])) await db.sendNotification(a.id, 'system', `${me.display_name} tekrar aktif olmak istiyor`, me.status === 'resigned' ? 'Eski gönüllü geri dönüş talebi' : 'Pasif hesap aktivasyon talebi');
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">{m.i}</div>
        <h2 className="text-xl font-bold">{m.t}</h2>
        <p className="text-sm text-gray-500">{m.d}</p>
        {canReactivate && !sent && (
          <button onClick={requestReactivation} className="bg-emerald-600 text-white font-semibold text-sm py-2.5 px-6 rounded-xl">
            {me.status === 'resigned' ? 'Tekrar Katıl' : 'Tekrar Aktif Ol'}
          </button>
        )}
        {sent && <p className="text-sm text-emerald-600">✓ Talebiniz yöneticiye iletildi!</p>}
        <button onClick={db.signOut} className="text-sm text-gray-400 border border-gray-200 px-6 py-2 rounded-xl">Çıkış</button>
      </div>
    </div>
  );
}
