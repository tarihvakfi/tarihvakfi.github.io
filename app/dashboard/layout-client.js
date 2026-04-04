'use client';

import { useState, useEffect, useCallback } from 'react';
import * as db from '../../lib/supabase';
import BackupView from './backup';

const DEPTS = [
  { id:'arsiv', l:'Arşiv & Dokümantasyon', i:'📜' },
  { id:'egitim', l:'Eğitim & Atölye', i:'📚' },
  { id:'etkinlik', l:'Etkinlik & Organizasyon', i:'🎪' },
  { id:'dijital', l:'Dijital & Sosyal Medya', i:'💻' },
  { id:'rehber', l:'Rehberlik & Gezi', i:'🏛️' },
  { id:'baski', l:'Yayın & Baskı', i:'📰' },
  { id:'bagis', l:'Bağış & Sponsorluk', i:'💰' },
  { id:'idari', l:'İdari İşler', i:'🏢' },
];
const DM = Object.fromEntries(DEPTS.map(d=>[d.id,d]));
const ROLES = { admin:{l:'Yönetici',i:'👑',c:'text-orange-500'}, coord:{l:'Koordinatör',i:'📋',c:'text-purple-500'}, vol:{l:'Gönüllü',i:'🤝',c:'text-emerald-500'} };
const STATUSES = { pending:'Bekliyor', active:'Devam Ediyor', done:'Tamamlandı', review:'Kontrol Bekliyor' };
const HOUR_S = { pending:'Bekliyor', approved:'Onaylandı', rejected:'Reddedildi' };
const DAYS = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]}`; };
const fdf = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const today = () => new Date().toISOString().slice(0,10);

// ─── MAIN SHELL ──────────────────────────
export default function Dashboard({ session }) {
  const uid = session.user.id;
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('islerim');
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await db.getProfile(uid);
      if (data) setMe(data);
      const cnt = await db.getUnreadCount(uid);
      setUnread(cnt);
      setLoading(false);
    })();
  }, [uid]);

  useEffect(() => {
    const sub = db.subscribeNotifications(uid, () => setUnread(n => n + 1));
    return () => sub.unsubscribe();
  }, [uid]);

  const can = useCallback((perm) => {
    if (!me) return false;
    if (me.role === 'admin') return true;
    if (me.role === 'coord') return ['manage_vols','assign_tasks','approve_hours','announcements','view_reports'].includes(perm);
    return false;
  }, [me]);

  if (loading || !me) return (
    <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Yükleniyor...</p></div>
  );

  // Restricted states
  const restricted = ['paused','inactive','resigned','pending','rejected','blocked'].includes(me.status);

  if (restricted) return (
    <div className="min-h-screen bg-stone-50">
      <Header me={me} />
      <div className="max-w-lg mx-auto px-4 pt-12">
        <RestrictedView me={me} uid={uid} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-[68px]">
      <Header me={me} unread={unread} onBell={() => setTab('ben')} />
      <div className="max-w-2xl mx-auto px-4 pt-3">
        {tab === 'islerim' && <IslerimView uid={uid} me={me} can={can} />}
        {tab === 'durum' && <DurumView uid={uid} me={me} can={can} />}
        {tab === 'mesajlar' && <MesajlarView uid={uid} me={me} can={can} />}
        {tab === 'ben' && <BenView me={me} uid={uid} unread={unread} setUnread={setUnread} onUpdate={m => setMe(m)} />}
      </div>
      {/* Bottom Nav — 4 tabs */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50" style={{height:60}}>
        <div className="max-w-2xl mx-auto flex h-full">
          {[['islerim','📋','İşlerim'],['durum','📊','Durum'],['mesajlar','💬','Mesajlar'],['ben','👤','Ben']].map(([id,ic,lb]) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} className="flex-1 flex flex-col items-center justify-center gap-0.5 relative">
                {active && <div className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-emerald-500 rounded-b" />}
                <span className={`text-xl ${active ? '' : 'grayscale opacity-40'}`}>{ic}</span>
                <span className={`text-[11px] ${active ? 'font-bold text-emerald-600' : 'text-gray-400'}`}>{lb}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ─── HEADER ──────────────────────────────
function Header({ me, unread, onBell }) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 px-5 pt-5 pb-4 rounded-b-3xl">
      <div className="max-w-2xl mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-white text-xl font-bold" style={{fontFamily:"'Playfair Display',serif"}}>🏛️ Tarih Vakfı</h1>
          <p className="text-white/40 text-[13px] mt-1">
            {ROLES[me.role]?.i} {me.display_name} · <span className={ROLES[me.role]?.c}>{ROLES[me.role]?.l}</span>
            {me.department && ` · ${DM[me.department]?.l}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onBell && (
            <button onClick={onBell} className="relative w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm hover:bg-white/20">
              🔔{unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{unread}</span>}
            </button>
          )}
          <button onClick={db.signOut} className="text-white/30 hover:text-white/60 text-xs">Çıkış</button>
        </div>
      </div>
    </div>
  );
}

// ─── RESTRICTED (pending/blocked/etc) ────
function RestrictedView({ me, uid }) {
  const [sent, setSent] = useState(false);
  const status = me.status;
  const msgs = {
    pending: { icon: '⏳', title: 'Kaydınız alındı!', desc: 'Hesabınız yönetici onayı bekliyor. Onaylandığında sisteme erişebileceksiniz.' },
    rejected: { icon: '❌', title: 'Başvurunuz reddedildi', desc: 'Detay için yöneticiyle iletişime geçin.' },
    blocked: { icon: '🚫', title: 'Hesabınız engellenmiştir', desc: 'Detay için yöneticiyle iletişime geçin.' },
    paused: { icon: '⏸️', title: 'Hesabınız duraklatıldı', desc: 'Tekrar aktif olmak için talep gönderin.' },
    inactive: { icon: '🔒', title: 'Hesabınız pasif', desc: 'Tekrar aktif olmak için talep gönderin.' },
    resigned: { icon: '👋', title: 'Vakıftan ayrıldınız', desc: 'Profil ve kayıtlarınız arşivde saklanır.' },
  };
  const m = msgs[status] || msgs.blocked;
  const canReactivate = ['paused','inactive'].includes(status);

  const reactivate = async () => {
    const { data: admins } = await db.getProfilesByRole('admin');
    for (const a of (admins || [])) {
      await db.sendNotification(a.id, 'system', `Tekrar aktif olma talebi`, `${me.display_name} tekrar aktif olmak istiyor.`);
    }
    setSent(true);
  };

  return (
    <div className="text-center space-y-4">
      <div className="text-5xl">{m.icon}</div>
      <h2 className="text-xl font-bold text-gray-700">{m.title}</h2>
      <p className="text-sm text-gray-500">{m.desc}</p>
      {canReactivate && !sent && <button onClick={reactivate} className="btn-primary">Tekrar Aktif Ol</button>}
      {sent && <p className="text-sm text-emerald-600">Talebiniz gönderildi!</p>}
      <button onClick={db.signOut} className="btn-ghost">Çıkış Yap</button>
    </div>
  );
}

// ─── TAB BAR (sayfa içi) ─────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${active === id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════
// 📋 İŞLERİM
// ═════════════════════════════════════════════
function IslerimView({ uid, me, can }) {
  const isCoord = can('assign_tasks');
  const isAdmin = me.role === 'admin';

  const tabs = isAdmin
    ? [['mine','Bana Atanan'],['all','Tüm İşler'],['hours','Saat Onayları'],['vols','Gönüllüler'],['shifts','Vardiya']]
    : isCoord
    ? [['mine','Bana Atanan'],['all','Tüm İşler'],['hours','Saat Onayları']]
    : [];

  const [subTab, setSubTab] = useState('mine');

  // Gönüllü: tek görünüm (tab yok)
  if (!isCoord) return <VolunteerWorkView uid={uid} me={me} />;

  return (
    <div>
      <TabBar tabs={tabs} active={subTab} onChange={setSubTab} />
      {subTab === 'mine' && <VolunteerWorkView uid={uid} me={me} />}
      {subTab === 'all' && <AllTasksView uid={uid} me={me} can={can} />}
      {subTab === 'hours' && <HourApprovalsView uid={uid} me={me} />}
      {subTab === 'vols' && isAdmin && <VolunteersView uid={uid} me={me} />}
      {subTab === 'shifts' && isAdmin && <ShiftPlanView uid={uid} me={me} />}
    </div>
  );
}

// ── Gönüllü İş Görünümü ──
function VolunteerWorkView({ uid, me }) {
  const [tasks, setTasks] = useState([]);
  const [expandTask, setExpandTask] = useState(null);
  const [progVal, setProgVal] = useState(0);
  const [progNote, setProgNote] = useState('');
  const [comment, setComment] = useState('');
  const [hours, setHours] = useState([]);
  const [showHourForm, setShowHourForm] = useState(false);
  const [hf, setHf] = useState({ date: today(), hours: '', description: '' });
  const [shifts, setShifts] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [t, h, s] = await Promise.all([
      db.getTasks({ assignedTo: uid }),
      db.getHourLogs({ volunteerId: uid, limit: 5 }),
      db.getShifts({ volunteerId: uid }),
    ]);
    setTasks((t.data || []).filter(t => t.status !== 'done' && t.status !== 'cancelled'));
    setHours(h.data || []);
    setShifts(s.data || []);
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const updateProgress = async (task) => {
    if (!progNote.trim()) return;
    setSaving(true);
    await db.addProgressLog({ task_id: task.id, user_id: uid, previous_value: task.progress || 0, new_value: progVal, note: progNote });
    await db.updateTaskProgress(task.id, progVal);
    // Notify others
    if (task.assigned_to) {
      for (const vid of task.assigned_to) {
        if (vid !== uid) await db.sendNotification(vid, 'task', `📊 ${task.title}: %${progVal}`, `${me.display_name}: ${progNote}`);
      }
    }
    setProgNote(''); setExpandTask(null); setSaving(false); load();
  };

  const addComment = async (task) => {
    if (!comment.trim()) return;
    setSaving(true);
    await db.addTaskComment({ task_id: task.id, user_id: uid, content: comment });
    if (task.assigned_to) {
      for (const vid of task.assigned_to) {
        if (vid !== uid) await db.sendNotification(vid, 'task', `💬 ${task.title}`, `${me.display_name}: ${comment.slice(0,60)}`);
      }
    }
    setComment(''); setSaving(false);
  };

  const submitHours = async () => {
    if (!hf.hours) return;
    setSaving(true);
    await db.logHours({ volunteer_id: uid, date: hf.date, hours: parseFloat(hf.hours), department: me.department || 'arsiv', description: hf.description });
    setShowHourForm(false); setHf({ date: today(), hours: '', description: '' }); setSaving(false); load();
  };

  const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const myShifts = shifts.filter(s => s.day_of_week);

  return (
    <div className="space-y-5">
      {/* Aktif İşlerim */}
      <div>
        <h2 className="text-lg font-bold mb-3">📋 Aktif İşlerim</h2>
        {tasks.length === 0 && <div className="card text-center py-8"><p className="text-sm text-gray-400">Atanmış işiniz yok</p></div>}
        {tasks.map(t => {
          const overdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done';
          const expanded = expandTask === t.id;
          return (
            <div key={t.id} className={`card mb-3 ${overdue ? 'border-l-4 border-red-400' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-bold text-base">{t.title}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{DM[t.department]?.i} {DM[t.department]?.l}{t.deadline && ` · Son: ${fd(t.deadline)}`}{overdue && ' ⚠️'}</div>
                </div>
                <span className={`text-sm font-bold ${(t.progress||0) >= 80 ? 'text-emerald-600' : (t.progress||0) >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{Math.round(t.progress || 0)}%</span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${(t.progress||0) >= 80 ? 'bg-emerald-500' : (t.progress||0) >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{width:`${t.progress||0}%`}} />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setExpandTask(expanded ? null : t.id); setProgVal(t.progress || 0); }} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                  {expanded ? '✕ Kapat' : '📊 Güncelle'}
                </button>
              </div>
              {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="100" step="5" value={progVal} onChange={e => setProgVal(Number(e.target.value))} className="flex-1 accent-emerald-600" />
                    <span className="text-sm font-bold w-12 text-right">{progVal}%</span>
                  </div>
                  <input className="input-field" placeholder="Ne yaptım?" value={progNote} onChange={e => setProgNote(e.target.value)} />
                  <button onClick={() => updateProgress(t)} disabled={saving} className="btn-primary w-full disabled:opacity-50">{saving ? '...' : 'Kaydet'}</button>
                  <div className="pt-2 border-t border-gray-50">
                    <div className="flex gap-2">
                      <input className="input-field flex-1" placeholder="Yorum yaz..." value={comment} onChange={e => setComment(e.target.value)} />
                      <button onClick={() => addComment(t)} disabled={saving || !comment.trim()} className="btn-primary !px-4 disabled:opacity-50">💬</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Saat Kaydı */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">⏱️ Saat Kaydı</h2>
          <button onClick={() => setShowHourForm(!showHourForm)} className="btn-primary !py-2 !px-4 !text-sm">{showHourForm ? '✕' : '+ Kaydet'}</button>
        </div>
        {showHourForm && (
          <div className="card mb-3 border-l-4 border-emerald-400 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" type="date" value={hf.date} onChange={e => setHf({...hf, date: e.target.value})} />
              <input className="input-field" type="number" step="0.5" min="0.5" placeholder="Saat" value={hf.hours} onChange={e => setHf({...hf, hours: e.target.value})} />
            </div>
            <input className="input-field" placeholder="Ne yaptım?" value={hf.description} onChange={e => setHf({...hf, description: e.target.value})} />
            <button onClick={submitHours} disabled={saving} className="btn-primary w-full disabled:opacity-50">Kaydet</button>
          </div>
        )}
        {hours.map(h => (
          <div key={h.id} className="card mb-2 !py-3 flex items-center gap-3">
            <span className="text-sm font-bold">{h.hours}s</span>
            <div className="flex-1">
              <div className="text-sm">{h.description || '—'}</div>
              <div className="text-xs text-gray-400">{fd(h.date)}</div>
            </div>
            <span className={`text-xs font-semibold ${h.status === 'approved' ? 'text-emerald-600' : h.status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>{HOUR_S[h.status]}</span>
          </div>
        ))}
      </div>

      {/* Vardiyam */}
      {myShifts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">📅 Bu Haftaki Vardiyam</h2>
          <div className="card">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100"><th className="text-left py-2 text-gray-500">Gün</th><th className="text-left py-2 text-gray-500">Saat</th><th className="text-left py-2 text-gray-500">Departman</th></tr></thead>
              <tbody>
                {DAYS.filter(d => myShifts.some(s => s.day_of_week === d)).map(day => {
                  const sh = myShifts.find(s => s.day_of_week === day);
                  return (
                    <tr key={day} className={`border-b border-gray-50 ${day === todayDay ? 'bg-emerald-50' : ''}`}>
                      <td className="py-2 font-semibold">{day === todayDay ? `📍 ${day}` : day}</td>
                      <td className="py-2">{sh?.start_time?.slice(0,5)}–{sh?.end_time?.slice(0,5)}</td>
                      <td className="py-2 text-gray-500">{DM[sh?.department]?.i} {DM[sh?.department]?.l?.split(' ')[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tüm İşler (Koordinatör/Admin) ──
function AllTasksView({ uid, me, can }) {
  const [tasks, setTasks] = useState([]);
  const [vols, setVols] = useState([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title:'', description:'', department: me.department || 'arsiv', assigned_to:'', deadline:'' });

  const load = useCallback(async () => {
    const [t, v] = await Promise.all([db.getTasks(), db.getAllProfiles()]);
    setTasks(t.data || []); setVols((v.data || []).filter(v => v.status === 'active'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!f.title) return;
    await db.createTask({ ...f, priority: 'medium', assigned_to: f.assigned_to ? [f.assigned_to] : [], created_by: uid });
    setShow(false); setF({ title:'', description:'', department: me.department || 'arsiv', assigned_to:'', deadline:'' }); load();
  };

  const approve = async (id) => {
    await db.updateTask(id, { status: 'done', completed_at: new Date().toISOString() });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Tüm İşler ({tasks.length})</h2>
        <button onClick={() => setShow(!show)} className="btn-primary !py-2 !px-4 !text-sm">{show ? '✕' : '+ Yeni İş'}</button>
      </div>
      {show && (
        <div className="card border-l-4 border-purple-400 space-y-2">
          <input className="input-field" placeholder="İş başlığı" value={f.title} onChange={e => setF({...f, title: e.target.value})} />
          <textarea className="input-field" rows={2} placeholder="Açıklama" value={f.description} onChange={e => setF({...f, description: e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input-field" value={f.department} onChange={e => setF({...f, department: e.target.value})}>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>
            <input className="input-field" type="date" placeholder="Son tarih" value={f.deadline} onChange={e => setF({...f, deadline: e.target.value})} />
          </div>
          <select className="input-field" value={f.assigned_to} onChange={e => setF({...f, assigned_to: e.target.value})}><option value="">Atanacak kişi</option>{vols.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
          <button onClick={create} className="btn-primary w-full">Oluştur</button>
        </div>
      )}
      {tasks.map(t => (
        <div key={t.id} className="card">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold">{t.title}</div>
              <div className="text-sm text-gray-400">{DM[t.department]?.i} {DM[t.department]?.l}{t.deadline && ` · ${fd(t.deadline)}`}</div>
            </div>
            <span className={`text-sm font-bold ${(t.progress||0) >= 80 ? 'text-emerald-600' : 'text-gray-400'}`}>{Math.round(t.progress||0)}%</span>
          </div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${t.status === 'done' ? 'bg-emerald-500' : t.status === 'review' ? 'bg-blue-500' : 'bg-amber-400'}`} style={{width:`${t.progress||0}%`}} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${t.status === 'done' ? 'bg-emerald-50 text-emerald-600' : t.status === 'review' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{STATUSES[t.status]}</span>
            {t.status === 'review' && can('assign_tasks') && (
              <button onClick={() => approve(t.id)} className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">✓ Tamamla</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Saat Onayları ──
function HourApprovalsView({ uid, me }) {
  const [hours, setHours] = useState([]);
  const load = useCallback(async () => {
    const { data } = await db.getHourLogs({ status: 'pending' });
    setHours(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, status) => { await db.reviewHours(id, status, uid); load(); };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Bekleyen Saat Onayları ({hours.length})</h2>
      {hours.map(h => (
        <div key={h.id} className="card flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-600">{(h.profiles?.display_name || '?')[0]}</div>
          <div className="flex-1">
            <div className="font-semibold text-sm">{h.profiles?.display_name}</div>
            <div className="text-xs text-gray-400">{fd(h.date)} · {h.hours}s · {h.description || '—'}</div>
          </div>
          {h.volunteer_id !== uid ? (
            <div className="flex gap-1.5">
              <button onClick={() => review(h.id, 'approved')} className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg">✓</button>
              <button onClick={() => review(h.id, 'rejected')} className="text-xs font-semibold bg-red-50 text-red-500 px-2.5 py-1 rounded-lg">✕</button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Kendi kaydınız</span>
          )}
        </div>
      ))}
      {hours.length === 0 && <div className="card text-center py-6"><p className="text-sm text-gray-400">Bekleyen onay yok</p></div>}
    </div>
  );
}

// ── Gönüllüler (Admin) ──
function VolunteersView({ uid, me }) {
  const [vols, setVols] = useState([]);
  const [sel, setSel] = useState(null);
  const [pending, setPending] = useState([]);
  useEffect(() => {
    db.getAllProfiles().then(({ data }) => {
      setVols((data || []).filter(v => v.status !== 'pending'));
      setPending((data || []).filter(v => v.status === 'pending'));
    });
  }, []);

  const changeRole = async (id, role) => { await db.setUserRole(id, role); setVols(vols.map(v => v.id === id ? {...v, role} : v)); };
  const changeDept = async (id, dept) => { await db.setUserDept(id, dept); setVols(vols.map(v => v.id === id ? {...v, department: dept} : v)); };
  const approveUser = async (id) => {
    await db.setUserStatus(id, 'active');
    await db.sendNotification(id, 'welcome', 'Hesabınız onaylandı!', 'Sisteme erişebilirsiniz.');
    setPending(pending.filter(p => p.id !== id));
  };
  const rejectUser = async (id) => { await db.setUserStatus(id, 'rejected'); setPending(pending.filter(p => p.id !== id)); };

  return (
    <div className="space-y-3">
      {pending.length > 0 && (<>
        <h2 className="text-lg font-bold">🕐 Onay Bekleyenler ({pending.length})</h2>
        {pending.map(u => (
          <div key={u.id} className="card border-l-4 border-blue-300 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">{u.display_name}</div>
              <div className="text-xs text-gray-400">{u.email}</div>
            </div>
            <button onClick={() => approveUser(u.id)} className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg">✓ Onayla</button>
            <button onClick={() => rejectUser(u.id)} className="text-xs font-semibold bg-red-50 text-red-500 px-3 py-1 rounded-lg">✕ Reddet</button>
          </div>
        ))}
      </>)}
      <h2 className="text-lg font-bold">👥 Gönüllüler ({vols.length})</h2>
      {vols.map(v => (
        <div key={v.id} className={`card ${v.status !== 'active' ? 'opacity-50' : ''}`} onClick={() => setSel(sel === v.id ? null : v.id)}>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">{(v.display_name||'?')[0]}</div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{v.display_name} <span className="text-xs">{ROLES[v.role]?.i}</span></div>
              <div className="text-xs text-gray-400">{DM[v.department]?.i || '—'} {DM[v.department]?.l || 'Atanmamış'} · {Number(v.total_hours||0).toFixed(0)}s</div>
            </div>
          </div>
          {sel === v.id && v.id !== uid && (
            <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 w-12">Rol:</span>
                <select className="input-field !py-1.5 !text-xs" value={v.role} onChange={e => changeRole(v.id, e.target.value)}>
                  <option value="vol">Gönüllü</option><option value="coord">Koordinatör</option><option value="admin">Yönetici</option>
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 w-12">Dept:</span>
                <select className="input-field !py-1.5 !text-xs" value={v.department||''} onChange={e => changeDept(v.id, e.target.value)}>
                  <option value="">Seçiniz</option>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Vardiya Planlama (Admin) ──
function ShiftPlanView({ uid, me }) {
  const [shifts, setShifts] = useState([]);
  const [vols, setVols] = useState([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ volunteer_id:'', day_of_week:'Pzt', start_time:'10:00', end_time:'14:00', department:'arsiv' });

  const load = useCallback(async () => {
    const [s, v] = await Promise.all([db.getShifts({}), db.getAllProfiles()]);
    setShifts(s.data || []); setVols((v.data || []).filter(v => v.status === 'active'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => { if (!f.volunteer_id) return; await db.createShift({...f, created_by: uid}); setShow(false); load(); };
  const del = async (id) => { await db.deleteShift(id); load(); };

  const byDay = {}; shifts.forEach(s => { (byDay[s.day_of_week] = byDay[s.day_of_week] || []).push(s); });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">📅 Vardiya Planı</h2>
        <button onClick={() => setShow(!show)} className="btn-primary !py-2 !px-4 !text-sm">{show ? '✕' : '+ Ekle'}</button>
      </div>
      {show && (
        <div className="card border-l-4 border-purple-400 space-y-2">
          <select className="input-field" value={f.volunteer_id} onChange={e => setF({...f, volunteer_id: e.target.value})}><option value="">Gönüllü seç</option>{vols.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
          <div className="grid grid-cols-3 gap-2">
            <select className="input-field" value={f.day_of_week} onChange={e => setF({...f, day_of_week: e.target.value})}>{DAYS.map(d => <option key={d}>{d}</option>)}</select>
            <input className="input-field" type="time" value={f.start_time} onChange={e => setF({...f, start_time: e.target.value})} />
            <input className="input-field" type="time" value={f.end_time} onChange={e => setF({...f, end_time: e.target.value})} />
          </div>
          <select className="input-field" value={f.department} onChange={e => setF({...f, department: e.target.value})}>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.i} {d.l}</option>)}</select>
          <button onClick={create} className="btn-primary w-full">Ekle</button>
        </div>
      )}
      {DAYS.filter(d => byDay[d]).map(day => (
        <div key={day}>
          <div className="text-sm font-bold mb-1">{day}</div>
          {byDay[day].map(sh => (
            <div key={sh.id} className="card mb-1.5 !py-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600">{(sh.profiles?.display_name||'?')[0]}</div>
              <span className="text-sm flex-1">{sh.profiles?.display_name}</span>
              <span className="text-xs text-gray-500">{DM[sh.department]?.i}</span>
              <span className="text-sm font-semibold">{sh.start_time?.slice(0,5)}–{sh.end_time?.slice(0,5)}</span>
              <button onClick={() => del(sh.id)} className="text-xs text-gray-300 hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════
// 📊 DURUM
// ═════════════════════════════════════════════
function DurumView({ uid, me, can }) {
  const [stats, setStats] = useState(null);
  const [deptComp, setDeptComp] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, dc, t] = await Promise.all([
        db.getOverviewStats(),
        db.getDeptComparison(),
        db.getTasksForOverview(),
      ]);
      setStats(s); setDeptComp(dc.data || []); setTasks(t.data || []); setLoaded(true);
    })();
  }, []);

  const maxH = Math.max(...deptComp.map(d => Number(d.this_month)), 1);

  if (!loaded) return <div className="text-center py-12 text-gray-400">Yükleniyor...</div>;

  return (
    <div className="space-y-5">
      {/* Özet */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: stats?.totalVols, l: 'Aktif Gönüllü', c: 'text-emerald-600' },
          { v: Math.round(stats?.monthlyHours || 0), l: 'Bu Ay Saat', c: 'text-amber-500' },
          { v: stats?.activeTasks, l: 'Aktif İş', c: 'text-purple-600' },
          { v: stats?.doneTasks, l: 'Tamamlanan', c: 'text-blue-600' },
        ].map((s, i) => (
          <div key={i} className="card text-center">
            <div className={`text-2xl font-bold ${s.c}`}>{s.v ?? '—'}</div>
            <div className="text-xs text-gray-400">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Departman Çubuk Grafik */}
      <div className="card">
        <h3 className="font-bold mb-3">Departman Aktivitesi (Bu Ay)</h3>
        {DEPTS.map(d => {
          const data = deptComp.find(c => c.department === d.id);
          const val = Number(data?.this_month || 0);
          return (
            <div key={d.id} className="mb-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm">{d.i}</span>
                <span className="text-xs font-semibold flex-1">{d.l.split(' ')[0]}</span>
                <span className="text-xs font-bold">{val}s</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:`${(val/maxH)*100}%`}} />
              </div>
            </div>
          );
        })}
      </div>

      {/* İş İlerleme Listesi */}
      <div className="card">
        <h3 className="font-bold mb-3">Aktif İşler — İlerleme</h3>
        {tasks.slice(0, 10).map(t => (
          <div key={t.id} className="mb-2.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold truncate mr-2">{t.title}</span>
              <span className={`font-bold ${(t.progress||0) >= 80 ? 'text-emerald-600' : 'text-gray-400'}`}>{Math.round(t.progress||0)}%</span>
            </div>
            <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${(t.progress||0) >= 80 ? 'bg-emerald-500' : (t.progress||0) >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{width:`${t.progress||0}%`}} />
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aktif iş yok</p>}
      </div>

      {/* Admin: Yedekleme */}
      {me.role === 'admin' && (
        <div className="space-y-3">
          <BackupView uid={uid} />
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════
// 💬 MESAJLAR
// ═════════════════════════════════════════════
function MesajlarView({ uid, me, can }) {
  const [subTab, setSubTab] = useState('sohbet');
  return (
    <div>
      <TabBar tabs={[['sohbet','Sohbet'],['duyurular','Duyurular']]} active={subTab} onChange={setSubTab} />
      {subTab === 'sohbet' && <ChatSection uid={uid} me={me} />}
      {subTab === 'duyurular' && <AnnouncementsSection uid={uid} me={me} can={can} />}
      {/* İstek Gönder */}
      {me.role !== 'admin' && <RequestSection uid={uid} me={me} />}
    </div>
  );
}

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

  const send = async () => {
    if (!text.trim()) return;
    await db.sendMessage(uid, dept, text.trim());
    setText(''); load();
  };

  return (
    <div className="space-y-3">
      {isCoordOrAdmin && (
        <div className="flex gap-1.5 flex-wrap">
          {DEPTS.map(d => (
            <button key={d.id} onClick={() => setDept(d.id)} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${dept === d.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{d.i}</button>
          ))}
        </div>
      )}
      <div className="card !p-3 space-y-2 max-h-[45vh] overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-gray-300 text-center py-6">Henüz mesaj yok</p>}
        {messages.map((m, i) => {
          const isMine = m.user_id === uid;
          return (
            <div key={m.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
                {!isMine && <div className="text-xs font-bold text-emerald-600 mb-0.5">{m.profiles?.display_name}</div>}
                <div className="text-sm">{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input className="input-field flex-1" placeholder="Mesaj yazın..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={!text.trim()} className="btn-primary !px-5 disabled:opacity-50">Gönder</button>
      </div>
    </div>
  );
}

function AnnouncementsSection({ uid, me, can }) {
  const [anns, setAnns] = useState([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title:'', body:'', is_public: false });

  useEffect(() => { db.getAnnouncements().then(({ data }) => setAnns(data || [])); }, []);

  const create = async () => {
    if (!f.title || !f.body) return;
    await db.createAnnouncement({ ...f, department: null, is_pinned: false, author_id: uid });
    setShow(false); setF({ title:'', body:'', is_public: false });
    db.getAnnouncements().then(({ data }) => setAnns(data || []));
  };

  const visible = me.role === 'vol' ? anns.filter(a => !a.department || a.department === me.department) : anns;

  return (
    <div className="space-y-3">
      {can('announcements') && (
        <div className="flex justify-end">
          <button onClick={() => setShow(!show)} className="btn-primary !py-2 !px-4 !text-sm">{show ? '✕' : '+ Duyuru'}</button>
        </div>
      )}
      {show && (
        <div className="card border-l-4 border-amber-400 space-y-2">
          <input className="input-field" placeholder="Başlık" value={f.title} onChange={e => setF({...f, title: e.target.value})} />
          <textarea className="input-field" rows={3} placeholder="İçerik" value={f.body} onChange={e => setF({...f, body: e.target.value})} />
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={f.is_public} onChange={e => setF({...f, is_public: e.target.checked})} /> 🌐 Halka açık
          </label>
          <button onClick={create} className="btn-primary w-full">Yayınla</button>
        </div>
      )}
      {visible.map(a => (
        <div key={a.id} className={`card ${a.is_pinned ? 'border-l-4 border-amber-400' : ''}`}>
          <div className="font-bold">{a.is_pinned && '📌 '}{a.title}</div>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{a.body}</p>
          <p className="text-xs text-gray-300 mt-2">{a.profiles?.display_name} · {fdf(a.created_at)}</p>
        </div>
      ))}
      {visible.length === 0 && <div className="card text-center py-6"><p className="text-sm text-gray-400">Duyuru yok</p></div>}
    </div>
  );
}

function RequestSection({ uid, me }) {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    // Gönüllü → koordinatör, koordinatör → admin
    let targetIds = [];
    if (me.role === 'vol' && me.department) {
      const { data } = await db.getCoordsByDept(me.department);
      targetIds = (data || []).map(c => c.id);
    }
    if (targetIds.length === 0) {
      const { data } = await db.getProfilesByRole('admin');
      targetIds = (data || []).map(a => a.id);
    }
    for (const tid of targetIds) {
      await db.sendNotification(tid, 'system', `💬 İstek: ${me.display_name}`, msg.slice(0, 200));
    }
    setSent(true); setMsg('');
    setTimeout(() => { setSent(false); setShow(false); }, 2000);
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      {!show && !sent && (
        <button onClick={() => setShow(true)} className="btn-ghost w-full">💬 İstek Gönder</button>
      )}
      {show && (
        <div className="space-y-2">
          <textarea className="input-field" rows={3} placeholder="İsteğinizi yazın..." value={msg} onChange={e => setMsg(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={send} disabled={!msg.trim()} className="btn-primary flex-1 disabled:opacity-50">Gönder</button>
            <button onClick={() => setShow(false)} className="btn-ghost">İptal</button>
          </div>
        </div>
      )}
      {sent && <p className="text-sm text-emerald-600 text-center">✓ İsteğiniz gönderildi!</p>}
    </div>
  );
}

// ═════════════════════════════════════════════
// 👤 BEN
// ═════════════════════════════════════════════
function BenView({ me, uid, unread, setUnread, onUpdate }) {
  return (
    <div className="space-y-5">
      <ProfileSection me={me} uid={uid} onUpdate={onUpdate} />
      <NotificationsSection uid={uid} unread={unread} setUnread={setUnread} />
      <HelpSection me={me} />
      <div className="text-center pt-4">
        <button onClick={db.signOut} className="btn-ghost">Çıkış Yap</button>
      </div>
    </div>
  );
}

function ProfileSection({ me, uid, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ display_name: me.display_name, city: me.city || '', bio: me.bio || '' });
  const save = async () => {
    const { data } = await db.updateProfile(uid, f);
    if (data) onUpdate(data); setEditing(false);
  };
  return (
    <div>
      <div className="card text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-600 mx-auto mb-2">{(me.display_name||'?')[0]}</div>
        <div className="font-bold text-xl">{me.display_name}</div>
        <div className="text-sm text-emerald-600 font-semibold">{ROLES[me.role]?.i} {ROLES[me.role]?.l}</div>
        {me.department && <div className="text-sm text-gray-400">{DM[me.department]?.i} {DM[me.department]?.l}</div>}
        {me.city && <div className="text-sm text-gray-400">📍 {me.city}</div>}
        <div className="flex justify-center gap-8 mt-4 pt-3 border-t border-gray-50">
          <div className="text-center"><div className="font-bold text-emerald-600 text-lg">{Number(me.total_hours||0).toFixed(0)}</div><div className="text-xs text-gray-400">Saat</div></div>
          <div className="text-center"><div className="font-bold text-lg">{fdf(me.joined_at)}</div><div className="text-xs text-gray-400">Üyelik</div></div>
        </div>
      </div>
      <button className="btn-ghost w-full mt-3" onClick={() => setEditing(!editing)}>{editing ? '✕ İptal' : '✏️ Düzenle'}</button>
      {editing && (
        <div className="card mt-3 space-y-2">
          <input className="input-field" placeholder="İsim" value={f.display_name} onChange={e => setF({...f, display_name: e.target.value})} />
          <input className="input-field" placeholder="Şehir" value={f.city} onChange={e => setF({...f, city: e.target.value})} />
          <textarea className="input-field" rows={2} placeholder="Hakkımda" value={f.bio} onChange={e => setF({...f, bio: e.target.value})} />
          <button className="btn-primary w-full" onClick={save}>Kaydet</button>
        </div>
      )}
    </div>
  );
}

function NotificationsSection({ uid, unread, setUnread }) {
  const [notifs, setNotifs] = useState([]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    db.getNotifications(uid).then(({ data }) => setNotifs(data || []));
  }, [uid]);

  const markAllRead = async () => {
    await db.markAllRead(uid);
    setNotifs(notifs.map(n => ({...n, is_read: true})));
    setUnread(0);
  };

  const visible = showAll ? notifs : notifs.slice(0, 5);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold">🔔 Bildirimler {unread > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">{unread}</span>}</h2>
        {unread > 0 && <button onClick={markAllRead} className="text-xs text-emerald-600 font-semibold">Tümünü okundu yap</button>}
      </div>
      {visible.map(n => (
        <div key={n.id} className={`card mb-2 !py-3 ${!n.is_read ? 'border-l-4 border-emerald-400' : ''}`}>
          <div className="font-semibold text-sm">{n.title}</div>
          {n.body && <div className="text-xs text-gray-400 mt-0.5">{n.body}</div>}
          <div className="text-xs text-gray-300 mt-1">{fd(n.created_at)}</div>
        </div>
      ))}
      {notifs.length > 5 && !showAll && <button onClick={() => setShowAll(true)} className="text-sm text-emerald-600 font-semibold">Tümünü göster ({notifs.length})</button>}
      {notifs.length === 0 && <div className="card text-center py-6"><p className="text-sm text-gray-400">Bildirim yok</p></div>}
    </div>
  );
}

function HelpSection({ me }) {
  const [open, setOpen] = useState(null);
  const items = [
    { q: 'İlerleme nasıl güncellenir?', a: 'İşlerim sayfasında ilgili işe tıklayın → Güncelle → Yüzdeyi ayarlayın → Ne yaptığınızı yazın → Kaydet.' },
    { q: 'Saat kaydı nasıl girilir?', a: 'İşlerim → "+ Kaydet" butonuna basın → Tarih, saat ve açıklamayı girin → Kaydet. Koordinatör onaylayacaktır.' },
    { q: 'Vardiyamı nerede görürüm?', a: 'İşlerim sayfasının alt kısmında "Bu Haftaki Vardiyam" tablosu var.' },
    { q: 'Mesaj nasıl yazarım?', a: 'Mesajlar → Sohbet sekmesinden departman sohbetine mesaj yazabilirsiniz.' },
    { q: 'İstek nasıl gönderirim?', a: 'Mesajlar sayfasının altında "İstek Gönder" butonu var. Serbest metin yazın, koordinatörünüze/yöneticiye gider.' },
    { q: 'Profilimi nasıl düzenlerim?', a: 'Ben → Profil kartında "Düzenle" butonuna basın.' },
  ];
  if (me.role !== 'vol') {
    items.push(
      { q: 'Saat kaydını nasıl onaylarım?', a: 'İşlerim → "Saat Onayları" sekmesinde bekleyen kayıtları onaylayın veya reddedin. Kendi kaydınızı onaylayamazsınız.' },
      { q: 'Yeni iş nasıl oluştururum?', a: 'İşlerim → "Tüm İşler" → "+ Yeni İş" butonuna basın. Başlık, açıklama, departman, atanan kişi ve son tarih girin.' },
      { q: 'İş %100 olunca ne olur?', a: 'İş "Kontrol Bekliyor" durumuna geçer. "✓ Tamamla" butonuyla final onayı verin.' },
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">❓ Yardım</h2>
      {items.map((item, i) => (
        <div key={i} className="card mb-2 cursor-pointer" onClick={() => setOpen(open === i ? null : i)}>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">{item.q}</span>
            <span className="text-gray-400">{open === i ? '▲' : '▼'}</span>
          </div>
          {open === i && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{item.a}</p>}
        </div>
      ))}
    </div>
  );
}
