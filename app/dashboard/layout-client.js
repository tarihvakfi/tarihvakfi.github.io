'use client';

import { useState, useEffect, useCallback } from 'react';
import * as db from '../../lib/supabase';
import BackupView from './backup';
import { CertificateModal, MyCertificates } from './certificates';
import ReportBuilder, { ReportArchive } from './reports';

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

  if (loading || !me) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Yükleniyor...</p></div>;

  // Restricted
  const restricted = ['paused','inactive','resigned','pending','rejected','blocked'].includes(me.status);
  if (restricted) return <RestrictedShell me={me} uid={uid} />;

  const isCoord = me.role === 'coord' || me.role === 'admin';
  const isAdmin = me.role === 'admin';

  // Gönüllü: 0 sekme, Koordinatör: 2, Admin: 3
  const tabs = isAdmin
    ? [['islerim','📋','İşlerim'],['yonetim','👥','Yönetim'],['raporlar','📊','Raporlar']]
    : isCoord
    ? [['islerim','📋','İşlerim'],['takimim','👥','Takımım']]
    : [];

  return (
    <div className={`min-h-screen bg-white ${tabs.length ? 'pb-16' : ''}`}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold" style={{fontFamily:"'Playfair Display',serif"}}>🏛️ Tarih Vakfı</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-sm">
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
      {modal === 'chat' && <ModalWrap title="💬 Sohbet" onClose={() => setModal(null)}><ChatSection uid={uid} me={me} /></ModalWrap>}
      {modal === 'certs' && <ModalWrap title="🏆 Belgelerim" onClose={() => setModal(null)}><MyCertificates uid={uid} me={me} /></ModalWrap>}
      {modal === 'summary' && <ModalWrap title="📊 Çalışma Özeti" onClose={() => setModal(null)}><WorkSummaryModal uid={uid} /></ModalWrap>}
      {modal === 'help' && <ModalWrap title="❓ Yardım" onClose={() => setModal(null)}><HelpContent me={me} /></ModalWrap>}

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {tab === 'islerim' && <MyScreen uid={uid} me={me} onModal={setModal} />}
        {tab === 'takimim' && isCoord && <TeamScreen uid={uid} me={me} />}
        {tab === 'yonetim' && isAdmin && <AdminScreen uid={uid} me={me} />}
        {tab === 'raporlar' && isAdmin && <ReportsScreen uid={uid} />}
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
  useEffect(() => { db.getNotifications(uid, 10).then(({ data }) => setNotifs(data || [])); db.markAllRead(uid); }, [uid]);
  return (
    <div className="fixed top-14 right-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-80 max-h-80 overflow-y-auto z-[55]">
      <div className="p-3 border-b border-gray-50 font-bold text-sm">🔔 Bildirimler</div>
      {notifs.map(n => (
        <div key={n.id} className={`px-3 py-2 border-b border-gray-50 ${!n.is_read ? 'bg-emerald-50/50' : ''}`}>
          <div className="text-sm font-semibold">{n.title}</div>
          {n.body && <div className="text-xs text-gray-400">{n.body}</div>}
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
            <div className="px-3 py-2"><div className="text-xs text-gray-500 mb-1">Bot'a gönderin:</div><div className="font-mono font-bold text-center bg-gray-50 rounded-lg py-2">/start {tgCode}</div><a href={`https://t.me/tarihvakfi_bot?start=${tgCode}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 block text-center mt-1">veya tıklayın →</a></div>
          ) : (
            <button onClick={linkTg} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">✈️ Telegram Bağla</button>
          )}
          <button onClick={() => { onModal('summary'); onClose(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">📊 Çalışma Özeti</button>
          <button onClick={() => { onModal('certs'); onClose(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">🏆 Belgelerim</button>
          <button onClick={() => { onModal('help'); onClose(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">❓ Yardım</button>
          <div className="border-t border-gray-50 mt-1 pt-1">
            <button onClick={db.signOut} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50 rounded-lg">Çıkış</button>
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
  const [showGuide, setShowGuide] = useState(me.first_login);
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expandTask, setExpandTask] = useState(null);
  const [progVal, setProgVal] = useState(0);
  const [progNote, setProgNote] = useState('');
  const [summary, setSummary] = useState(null);
  const [anns, setAnns] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const [r, t, ws, a, sh] = await Promise.all([
      db.getWeekReports(uid), db.getTasks({ assignedTo: uid }),
      db.getWorkSummary(uid), db.getAnnouncements(), db.getShifts({ volunteerId: uid }),
    ]);
    setReports(r.data || []);
    setTasks((t.data || []).filter(t => !['done','cancelled'].includes(t.status)));
    setSummary(ws.data);
    const threeDaysAgo = new Date(Date.now() - 3*86400000).toISOString().slice(0,10);
    setAnns((a.data || []).filter(a => a.is_pinned || ((!a.department || a.department === me.department) && a.created_at?.slice(0,10) >= threeDaysAgo)).slice(0, 5));
    setShifts(sh.data || []);
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
    else if (hours < 0.5) e.h = 'En az 0.5 saat olmalı';
    else if (hours > 16) e.h = 'Bir günde 16 saatten fazla olamaz';
    if (!f.desc.trim()) e.desc = 'Ne yaptığını kısaca yaz';
    if (f.date > today()) e.date = 'İleri tarih seçilemez';
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
  const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay()-1];

  return (
    <div className="space-y-6">
      <toast.Toast />

      {/* İlk kullanım rehberi */}
      {showGuide && (
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
          <h3 className="font-bold text-emerald-800 mb-2">Hoş geldin! 🎉</h3>
          <p className="text-sm text-emerald-700 leading-relaxed">Sistem çok basit:</p>
          <div className="mt-2 space-y-1 text-sm text-emerald-600">
            <p>1️⃣ <b>Çalışmanı raporla</b> → saat ve ne yaptığını yaz</p>
            <p>2️⃣ <b>İşlerini takip et</b> → sana atanan işleri gör</p>
            <p>3️⃣ <b>Hepsi bu kadar</b> 😊</p>
          </div>
          <button onClick={dismissGuide} className="bg-emerald-600 text-white font-semibold text-sm py-2 px-4 rounded-xl mt-3">Anladım, başlayalım!</button>
        </div>
      )}

      {/* Selamlama + Özet */}
      <div>
        <h1 className="text-xl font-bold">Merhaba {me.display_name?.split(' ')[0]} 👋</h1>
        {summary && <p className="text-sm text-gray-500 mt-1">Bu ay: <b>{summary.month_days} gün</b>, <b>{fmtH(Number(summary.month_hours))}</b> çalıştın</p>}
      </div>

      {/* Raporla Butonu / Form */}
      {!showForm ? (
        <button onClick={() => { resetForm(); setEditR(null); setShowForm(true); setShowExtra(false); setErrors({}); }} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg py-4 rounded-2xl w-full transition-all active:scale-[0.97]" aria-label="Çalışma raporla">
          📝 Çalışmamı Raporla
        </button>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-bold">{editR ? '✏️ Düzenle' : '📝 Çalışmamı Raporla'}</span>
            <button onClick={() => { setShowForm(false); setEditR(null); setErrors({}); }} className="text-gray-400" aria-label="Kapat">✕</button>
          </div>
          {/* Saat */}
          <div>
            <label htmlFor="hours-input" className="text-sm text-gray-500">⏱️ Kaç saat?</label>
            <input id="hours-input" type="number" inputMode="decimal" step="0.5" min="0.5" max="16" className={`w-full border rounded-xl px-4 py-3 text-lg font-bold mt-1 outline-none focus:border-emerald-500 ${errors.h ? 'border-red-300' : 'border-gray-200'}`} placeholder={lastReport ? String(lastReport.hours) : '3'} value={f.h} onChange={e => { setF({...f, h: e.target.value}); setErrors({...errors, h: ''}); }} />
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
            <button onClick={() => setF({...f, mode:'onsite'})} className={`flex-1 py-3 rounded-xl text-sm font-semibold ${f.mode==='onsite' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-400'}`} aria-label="Vakıfta">🏛️ Vakıfta</button>
            <button onClick={() => setF({...f, mode:'remote'})} className={`flex-1 py-3 rounded-xl text-sm font-semibold ${f.mode==='remote' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-400'}`} aria-label="Uzaktan">🏠 Uzaktan</button>
          </div>
          {/* Kaydet */}
          <button onClick={submit} disabled={saving} className="bg-emerald-600 text-white font-bold py-3 rounded-xl w-full disabled:opacity-50" aria-label="Kaydet">{saving ? '...' : '✓ Kaydet'}</button>
          {editR?.status === 'approved' && <p className="text-xs text-amber-500 text-center">⚠️ Onaylanmış rapor — tekrar onay gerekecek</p>}
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
              <div key={t.id} className="bg-gray-50 rounded-xl p-3 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1"><span className="font-semibold text-sm">{t.title}</span><span className="text-xs text-gray-400 ml-2">{Math.round(t.progress||0)}%</span></div>
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
          <div key={r.id} className="bg-gray-50 rounded-xl p-3 mb-1.5 flex items-center gap-2 cursor-pointer" onClick={() => startEdit(r)}>
            <span className="text-sm">{r.task_id ? '📋' : '📝'}</span>
            <div className="flex-1">
              <span className="text-sm font-semibold">{fd(r.date)}</span> <span className="text-sm">{fmtH(r.hours)}</span> <span className="text-xs">{r.work_mode==='remote'?'🏠':'🏛️'}</span>
              <div className="text-xs text-gray-400 truncate">{r.description}</div>
            </div>
            <span className={`text-xs ${r.status==='approved'?'text-emerald-600':r.status==='rejected'?'text-red-500':'text-amber-500'}`}>{r.status==='approved'?'✅':r.status==='rejected'?'❌':'⏳'}</span>
          </div>
        ))}
        {reports.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Henüz çalışma raporun yok. İlk raporunu oluşturmak için yukarıdaki butona tıkla 👆</p>}
        {lastReport && !showForm && (
          <button onClick={quickRepeat} disabled={saving} className="w-full text-center text-sm text-emerald-600 font-semibold py-2 bg-emerald-50 rounded-xl disabled:opacity-50" aria-label="Aynısını tekrarla">🔄 Aynısını tekrarla ({fmtH(lastReport.hours)}, {lastReport.description?.slice(0,25)}...)</button>
        )}
      </div>

      {/* Duyurular */}
      {anns.length > 0 && (
        <div>
          <h2 className="font-bold mb-2">📢 Duyurular</h2>
          {anns.map(a => (
            <div key={a.id} className={`bg-gray-50 rounded-xl p-3 mb-1.5 ${a.is_pinned ? 'border-l-4 border-amber-400' : ''}`}>
              <div className="font-semibold text-sm">{a.is_pinned && '📌 '}{a.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{a.body?.slice(0,100)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Vardiyam */}
      {shifts.length > 0 && (
        <div>
          <h2 className="font-bold mb-2">📅 Vardiyam</h2>
          <div className="bg-gray-50 rounded-xl p-3">
            {DAYS.filter(d => shifts.some(s => s.day_of_week === d)).map(day => {
              const sh = shifts.find(s => s.day_of_week === day);
              return <div key={day} className={`flex items-center py-1 text-sm ${day===todayDay?'font-bold text-emerald-600':''}`}><span className="w-10">{day}</span><span>{sh?.start_time?.slice(0,5)}–{sh?.end_time?.slice(0,5)}</span></div>;
            })}
          </div>
        </div>
      )}

      {/* Alt linkler (gönüllü için) */}
      {me.role === 'vol' && (
        <div className="flex justify-center gap-6 text-sm text-gray-400 pt-4 border-t border-gray-100">
          <button onClick={() => onModal('chat')}>💬 Sohbet</button>
          <button onClick={() => onModal('summary')}>📊 Özet</button>
          <button onClick={() => onModal('help')}>❓ Yardım</button>
        </div>
      )}

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
  const createTask = async () => { if (!tf.title) return; await db.createTask({ ...tf, priority:'medium', assigned_to: tf.assigned_to ? [tf.assigned_to] : [], created_by: uid }); setShowNewTask(false); setTf({ title:'', description:'', department: me.department||'arsiv', assigned_to:'', deadline:'' }); load(); };
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
            {r.user_id !== uid ? <button onClick={() => approve(r.id)} className="text-xs bg-emerald-50 text-emerald-600 font-semibold px-3 py-1.5 rounded-lg">✓</button> : <span className="text-xs text-gray-300">Kendi</span>}
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Bekleyen yok ✓</p>}
      </div>
      </Section>

      {/* İşler */}
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
            <button onClick={createTask} className="bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl w-full">Oluştur</button>
          </div>
        )}
        {tasks.filter(t => t.status !== 'cancelled').slice(0, 10).map(t => (
          <div key={t.id} className="bg-gray-50 rounded-xl p-3 mb-1.5">
            <div className="flex items-center justify-between">
              <div className="flex-1"><span className="font-semibold text-sm">{t.title}</span> <span className="text-xs text-gray-400">{Math.round(t.progress||0)}%</span></div>
              {t.status === 'review' && <button onClick={() => approveTask(t.id)} className="text-xs bg-emerald-50 text-emerald-600 font-semibold px-2 py-1 rounded-lg">✓ Tamamla</button>}
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
function AdminScreen({ uid, me }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [vols, setVols] = useState([]);
  const [sel, setSel] = useState(null);
  const [certVol, setCertVol] = useState(null);
  const [summaries, setSummaries] = useState({});

  const load = useCallback(async () => {
    const [p, ws] = await Promise.all([db.getAllProfiles(), db.getAllWorkSummaries()]);
    const all = p.data || [];
    setPendingUsers(all.filter(u => u.status === 'pending'));
    setVols(all.filter(u => u.status !== 'pending'));
    setSummaries(Object.fromEntries((ws.data || []).map(s => [s.id, s])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const approveUser = async (id) => { await db.setUserStatus(id, 'active'); await db.sendNotification(id, 'welcome', 'Hesabınız onaylandı!', ''); load(); };
  const rejectUser = async (id) => { await db.setUserStatus(id, 'rejected'); load(); };
  const changeRole = async (id, role) => { await db.setUserRole(id, role); setVols(vols.map(v => v.id === id ? {...v, role} : v)); };
  const changeDept = async (id, dept) => { await db.setUserDept(id, dept); setVols(vols.map(v => v.id === id ? {...v, department: dept} : v)); };

  return (
    <div className="space-y-6">
      {/* Pending */}
      {pendingUsers.length > 0 && (
        <div>
          <h2 className="font-bold mb-2">🕐 Onay Bekleyen ({pendingUsers.length})</h2>
          {pendingUsers.map(u => (
            <div key={u.id} className="bg-gray-50 rounded-xl p-3 mb-1.5 flex items-center gap-3">
              <div className="flex-1"><div className="font-semibold text-sm">{u.display_name}</div><div className="text-xs text-gray-400">{u.email}</div></div>
              <button onClick={() => approveUser(u.id)} className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg font-semibold">✓</button>
              <button onClick={() => rejectUser(u.id)} className="text-xs bg-red-50 text-red-500 px-3 py-1 rounded-lg font-semibold">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* TeamScreen (includes approvals, tasks, chat, shifts etc) */}
      <TeamScreen uid={uid} me={me} />

      {/* Gönüllü Yönetimi */}
      <div>
        <h2 className="font-bold mb-2">👥 Gönüllü Yönetimi ({vols.length})</h2>
        {vols.map(v => (
          <div key={v.id} className={`bg-gray-50 rounded-xl p-3 mb-1.5 ${v.status !== 'active' ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSel(sel === v.id ? null : v.id)}>
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">{(v.display_name||'?')[0]}</div>
              <div className="flex-1"><div className="text-sm font-semibold">{v.display_name} {ROLES[v.role]?.i}</div><div className="text-xs text-gray-400">{DM[v.department]?.l || '—'}</div></div>
              <button onClick={e => { e.stopPropagation(); setCertVol(v); }} className="text-xs text-amber-600">🏆</button>
            </div>
            {sel === v.id && v.id !== uid && (
              <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                <select className="w-full border rounded-xl px-3 py-2 text-sm" value={v.role} onChange={e => changeRole(v.id, e.target.value)}><option value="vol">Gönüllü</option><option value="coord">Koordinatör</option><option value="admin">Yönetici</option></select>
                <select className="w-full border rounded-xl px-3 py-2 text-sm" value={v.department||''} onChange={e => changeDept(v.id, e.target.value)}><option value="">Departman</option>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>
              </div>
            )}
          </div>
        ))}
      </div>
      {certVol && <CertificateModal vol={certVol} summary={summaries[certVol.id]} issuerId={uid} onClose={() => setCertVol(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// 📊 RAPORLAR (admin)
// ═══════════════════════════════════════════
function ReportsScreen({ uid }) {
  return (
    <div className="space-y-6">
      <ReportBuilder uid={uid} />
      <ReportArchive />
      <BackupView uid={uid} />
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
    { q: 'Çalışma nasıl raporlanır?', a: '"Çalışmamı Raporla" butonuna bas, saati ve ne yaptığını yaz, kaydet. 10 saniye.' },
    { q: 'Raporu düzenleyebilir miyim?', a: 'Evet, rapora tıkla ve düzenle. Onaylanmış raporlar düzenlenince tekrar onay gerekir.' },
    { q: 'İş ilerlemesi nasıl güncellenir?', a: 'İşlerim bölümünde ilgili işte "Güncelle" tıkla, yüzdeyi ayarla, not yaz, kaydet.' },
    { q: 'Telegram ile nasıl raporlarım?', a: 'Profil menüsünden Telegram\'ı bağlayın. Sonra bota "bugün 3 saat belge taradım" yazın.' },
    { q: 'Destek nasıl alırım?', a: 'Sayfanın altında "Mesaj gönder" linkine tıklayın. Koordinatörünüze mesaj gider.' },
  ];
  if (me.role !== 'vol') items.push(
    { q: 'Raporları nasıl onaylarım?', a: 'Takımım bölümünde bekleyen raporları onaylayın. "Hepsini Onayla" ile toplu onay yapabilirsiniz.' },
    { q: 'Yeni iş nasıl oluştururum?', a: 'Takımım → "+ Yeni" butonuna basın. Başlık, açıklama, atanan kişi ve son tarih girin.' },
  );
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-1">{items.map((item, i) => (
      <div key={i} className="bg-gray-50 rounded-xl p-3 cursor-pointer" onClick={() => setOpen(open===i?null:i)}>
        <div className="flex justify-between"><span className="text-sm font-semibold">{item.q}</span><span className="text-gray-400">{open===i?'▲':'▼'}</span></div>
        {open === i && <p className="text-sm text-gray-500 mt-2">{item.a}</p>}
      </div>
    ))}</div>
  );
}

// ═══════════════════════════════════════════
// RESTRICTED (pending/blocked/etc)
// ═══════════════════════════════════════════
function RestrictedShell({ me, uid }) {
  const msgs = { pending:{i:'⏳',t:'Kaydınız alındı!',d:'Yönetici onayı bekleniyor.'}, rejected:{i:'❌',t:'Başvuru reddedildi',d:'Yöneticiyle iletişime geçin.'}, blocked:{i:'🚫',t:'Hesap engellendi',d:'Yöneticiyle iletişime geçin.'}, paused:{i:'⏸️',t:'Hesap duraklatıldı',d:'Tekrar aktif olmak için talep gönderin.'}, inactive:{i:'🔒',t:'Hesap pasif',d:''}, resigned:{i:'👋',t:'Ayrıldınız',d:''} };
  const m = msgs[me.status] || msgs.blocked;
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">{m.i}</div>
        <h2 className="text-xl font-bold">{m.t}</h2>
        <p className="text-sm text-gray-500">{m.d}</p>
        <button onClick={db.signOut} className="text-sm text-gray-400 border border-gray-200 px-6 py-2 rounded-xl">Çıkış</button>
      </div>
    </div>
  );
}
