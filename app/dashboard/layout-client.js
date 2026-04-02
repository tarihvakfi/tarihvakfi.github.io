'use client';

import { useState, useEffect, useCallback } from 'react';
import * as db from '../../lib/supabase';

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
const PRIORITIES = { high:{l:'Yüksek',c:'bg-red-100 text-red-600'}, medium:{l:'Orta',c:'bg-amber-100 text-amber-600'}, low:{l:'Düşük',c:'bg-emerald-100 text-emerald-600'} };
const STATUSES = { pending:'Bekliyor', active:'Devam Ediyor', done:'Tamamlandı', review:'Kontrol Bekliyor' };
const HOUR_S = { pending:'Onay Bekliyor', approved:'Onaylandı', rejected:'Reddedildi' };
const DAYS = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]}`; };
const fdf = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const today = () => new Date().toISOString().slice(0,10);

export default function Dashboard({ session }) {
  const uid = session.user.id;
  const [me, setMe] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  // Load profile
  useEffect(() => {
    (async () => {
      const { data } = await db.getProfile(uid);
      if (data) setMe(data);
      const cnt = await db.getUnreadCount(uid);
      setUnread(cnt);
      setLoading(false);
    })();
  }, [uid]);

  // Realtime notifications
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

  // 4. Paused/inactive/resigned restricted view
  const suspended = ['paused','inactive','resigned'].includes(me.status);

  const nav = suspended
    ? []
    : me.role === 'admin'
    ? [['dashboard','🏠','Panel'],['volunteers','👥','Gönüllüler'],['tasks','📋','Görevler'],['hours','⏱️','Saatler'],['schedule','📅','Vardiya'],['chat','💬','Sohbet'],['announcements','📢','Duyuru'],['requests','📨','Talepler'],['applications','📩','Başvuru'],['help','❓','Yardım']]
    : me.role === 'coord'
    ? [['dashboard','🏠','Panel'],['volunteers','👥','Gönüllüler'],['tasks','📋','Görevler'],['hours','⏱️','Saatler'],['schedule','📅','Vardiya'],['chat','💬','Sohbet'],['announcements','📢','Duyuru'],['requests','📨','Talepler'],['help','❓','Yardım']]
    : [['dashboard','🏠','Panel'],['tasks','📋','Görevler'],['hours','⏱️','Saatler'],['schedule','📅','Vardiya'],['chat','💬','Sohbet'],['announcements','📢','Duyurular'],['requests','📨','Taleplerim'],['help','❓','Yardım']];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 px-5 pt-5 pb-4 rounded-b-3xl">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-white text-lg font-bold" style={{fontFamily:"'Playfair Display',serif"}}>🏛️ Tarih Vakfı</h1>
            <p className="text-white/40 text-xs mt-1">
              {ROLES[me.role]?.i} {me.display_name} · <span className={ROLES[me.role]?.c}>{ROLES[me.role]?.l}</span>
              {me.department && ` · ${DM[me.department]?.l}`}
              {suspended && <span className="text-red-400 ml-1">({me.status === 'paused' ? 'Duraklatildi' : me.status === 'resigned' ? 'Ayrildi' : 'Pasif'})</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!suspended && <button onClick={() => setPage('notifications')} className="relative w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm hover:bg-white/20">
              🔔
              {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{unread}</span>}
            </button>}
            <button onClick={db.signOut} className="text-white/30 hover:text-white/60 text-xs">Çıkış</button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-3">
        {suspended ? (
          <SuspendedView me={me} uid={uid} />
        ) : (<>
        {page === 'dashboard' && <DashboardView uid={uid} me={me} can={can} setPage={setPage} />}
        {page === 'volunteers' && can('manage_vols') && <VolunteersView uid={uid} me={me} />}
        {page === 'tasks' && <TasksView uid={uid} me={me} can={can} />}
        {page === 'hours' && <HoursView uid={uid} me={me} can={can} />}
        {page === 'schedule' && <ScheduleView uid={uid} me={me} can={can} />}
        {page === 'announcements' && <AnnouncementsView uid={uid} me={me} can={can} />}
        {page === 'applications' && can('manage_vols') && <ApplicationsView uid={uid} me={me} />}
        {page === 'chat' && <ChatView uid={uid} me={me} />}
        {page === 'requests' && <RequestsView uid={uid} me={me} can={can} />}
        {page === 'notifications' && <NotificationsView uid={uid} onRead={() => setUnread(0)} />}
        {page === 'profile' && <ProfileView me={me} uid={uid} onUpdate={m => setMe(m)} />}
        {page === 'help' && <HelpView me={me} />}
        </>)}
      </div>

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/97 backdrop-blur border-t border-gray-100 py-1.5 z-50">
        <div className="max-w-2xl mx-auto flex justify-around">
          {[...nav, ['profile','👤','Profil']].map(([id,ic,lb]) => (
            <button key={id} onClick={() => setPage(id)} className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-all ${page === id ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className="text-base">{ic}</span>
              <span className="text-[9px] font-semibold">{lb}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ─── ADMIN E-POSTA HOOK ──────────────────
function useAdminEmail() {
  const [adminEmail, setAdminEmail] = useState(null);
  const [adminId, setAdminId] = useState(null);
  useEffect(() => {
    db.getProfilesByRole('admin').then(({ data }) => {
      if (data && data.length > 0) { setAdminEmail(data[0].email); setAdminId(data[0].id); }
    });
  }, []);
  return { adminEmail, adminId };
}

// ─── SUSPENDED VIEW ──────────────────────
function SuspendedView({ me, uid }) {
  const [sent, setSent] = useState(false);
  const { adminId } = useAdminEmail();
  const reactivate = async () => {
    if (!adminId) return;
    await db.createRequest({ user_id: uid, type: 'other', title: 'Tekrar Aktif', description: `${me.display_name} tekrar aktif olmak istiyor. (Mevcut durum: ${me.status})` });
    await db.sendNotification(adminId, 'system', '📨 Tekrar aktif olma talebi', `${me.display_name} tekrar aktif olmak istiyor.`);
    setSent(true);
  };
  const statusText = me.status === 'paused' ? 'Hesabiniz duraklatildi' : me.status === 'resigned' ? 'Vakiftan ayrildiniz' : 'Hesabiniz pasife alindi';
  return (
    <div className="fade-up space-y-4 text-center pt-8">
      <div className="text-5xl">{me.status === 'paused' ? '⏸️' : me.status === 'resigned' ? '👋' : '🔒'}</div>
      <h2 className="text-lg font-bold text-gray-700">{statusText}</h2>
      <p className="text-xs text-gray-400">Sisteme erisim kisitlanmistir. Tekrar aktif olmak icin talep gonderebilirsiniz.</p>
      {me.status !== 'resigned' && (
        sent ? (
          <div className="bg-green-50 text-green-700 text-xs rounded-xl px-4 py-3">Talebiniz yoneticiye iletildi!</div>
        ) : (
          <button onClick={reactivate} className="btn-primary mx-auto">Tekrar Aktif Ol</button>
        )
      )}
      <div className="card !mt-8 text-left">
        <div className="text-xs font-bold mb-2">Profil Bilgileri</div>
        <div className="text-xs text-gray-500">{me.display_name}</div>
        <div className="text-xs text-gray-400">{me.email}</div>
        {me.department && <div className="text-xs text-gray-400">{DM[me.department]?.i} {DM[me.department]?.l}</div>}
        <div className="text-xs text-gray-400">Toplam: {Number(me.total_hours || 0).toFixed(0)} saat</div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────
function DashboardView({ uid, me, can, setPage }) {
  const [stats, setStats] = useState(null);
  const [anns, setAnns] = useState([]);
  const [showSupport, setShowSupport] = useState(false);
  const [supTopic, setSupTopic] = useState('Teknik Sorun');
  const [supMsg, setSupMsg] = useState('');
  const [supSent, setSupSent] = useState(false);
  const [supLoading, setSupLoading] = useState(false);
  const [weekSummary, setWeekSummary] = useState([]);
  const [pendingReqs, setPendingReqs] = useState(0);
  const { adminEmail, adminId } = useAdminEmail();

  useEffect(() => {
    (async () => {
      const [vs, an] = await Promise.all([db.getVolunteerStats(), db.getAnnouncements()]);
      setStats(vs.data); setAnns((an.data || []).slice(0, 3));
    })();
  }, []);

  useEffect(() => {
    if (can('view_reports')) {
      db.getWeeklyDeptSummary().then(setWeekSummary);
      db.getPendingRequestCount().then(setPendingReqs);
    }
  }, [can]);

  const sendSupport = async () => {
    if (!supMsg.trim()) return;
    setSupLoading(true);
    // Route: vol→coord (fallback admin), coord→admin
    let targetIds = [];
    if (me.role === 'vol' && me.department) {
      const { data: coords } = await db.getCoordsByDept(me.department);
      targetIds = (coords || []).map(c => c.id);
    }
    if (targetIds.length === 0 && adminId) targetIds = [adminId];
    for (const tid of targetIds) {
      await db.sendNotification(tid, 'system', `🆘 Destek: ${supTopic}`, `${me.display_name}: ${supMsg}`);
    }
    setSupLoading(false);
    setSupSent(true);
    setSupMsg('');
    setTimeout(() => { setSupSent(false); setShowSupport(false); }, 2000);
  };

  const myStats = stats?.find(s => s.id === uid);
  const totalVols = stats?.filter(s => s.status === 'active').length || 0;
  const totalHours = stats?.reduce((a, b) => a + Number(b.approved_hours), 0) || 0;

  return (
    <div className="fade-up space-y-4">
      {can('manage_vols') ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat v={totalVols} l="Aktif Gönüllü" c="text-emerald-600" />
          <Stat v={totalHours} l="Toplam Saat" c="text-amber-500" />
          <Stat v={stats?.filter(s => Number(s.pending_hours) > 0).length || 0} l="Onay Bekleyen" c="text-red-500" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Stat v={myStats?.approved_hours || 0} l="Onaylı Saat" c="text-emerald-600" />
          <Stat v={myStats?.pending_hours || 0} l="Bekleyen" c="text-amber-500" />
          <Stat v={myStats?.active_days || 0} l="Aktif Gün" c="text-purple-500" />
        </div>
      )}

      <div className="text-sm font-bold">⚡ Hızlı İşlemler</div>
      <div className="grid grid-cols-3 gap-2">
        {me.role === 'vol' && <>
          <QA ic="⏱️" lb="Saat Kaydet" onClick={() => setPage('hours')} />
          <QA ic="📋" lb="Görevlerim" onClick={() => setPage('tasks')} />
          <QA ic="📅" lb="Vardiyam" onClick={() => setPage('schedule')} />
        </>}
        {can('manage_vols') && <>
          <QA ic="👥" lb="Gönüllüler" onClick={() => setPage('volunteers')} />
          <QA ic="📋" lb="Görev Ata" onClick={() => setPage('tasks')} />
          <QA ic="⏱️" lb="Onayla" onClick={() => setPage('hours')} />
        </>}
        {can('manage_vols') && pendingReqs > 0 && (
          <div className="col-span-3">
            <button onClick={() => setPage('requests')} className="w-full card !p-2.5 flex items-center justify-center gap-2 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-amber-400">
              <span>📨</span>
              <span className="text-xs font-semibold text-gray-600">Bekleyen Talepler</span>
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingReqs}</span>
            </button>
          </div>
        )}
      </div>

      {anns.filter(a => a.is_pinned).map(a => (
        <div key={a.id} className="card border-l-4 border-amber-400">
          <div className="flex items-center gap-1.5 mb-1"><span className="text-xs">📌</span><span className="font-bold text-sm">{a.title}</span></div>
          <p className="text-xs text-gray-500 leading-relaxed">{a.body?.slice(0, 150)}</p>
          <p className="text-[10px] text-gray-300 mt-2">{a.profiles?.display_name} · {fd(a.created_at)}</p>
        </div>
      ))}

      {/* Haftalik Departman Ozeti */}
      {can('view_reports') && weekSummary.length > 0 && (
        <>
          <div className="text-sm font-bold">📊 Bu Hafta</div>
          <div className="grid grid-cols-2 gap-2">
            {weekSummary.map(d => (
              <div key={d.department} className="card !p-2.5">
                <div className="text-xs font-bold">{DM[d.department]?.i} {DM[d.department]?.l?.split(' ')[0]}</div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-emerald-600 font-semibold">{d.hours}s</span>
                  <span className="text-[10px] text-purple-500 font-semibold">{d.tasks} gorev</span>
                  <span className="text-[10px] text-gray-400">{d.vols} kisi</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Destek Talebi - admin görmez */}
      {me.role !== 'admin' && (<>
        <button onClick={() => setShowSupport(!showSupport)} className="w-full card !p-3 flex items-center justify-center gap-2 hover:shadow-md transition-shadow cursor-pointer">
          <span className="text-base">🆘</span>
          <span className="text-xs font-semibold text-gray-600">Destek Talebi Gönder</span>
        </button>
        {showSupport && (
          <div className="card space-y-2.5">
            <h3 className="text-sm font-bold text-center">🆘 Destek Talebi</h3>
            <select value={supTopic} onChange={e => setSupTopic(e.target.value)} className="input-field !text-xs">
              <option>Teknik Sorun</option>
              <option>Saat Kaydı</option>
              <option>Görev</option>
              <option>Vardiya</option>
              <option>Diğer</option>
            </select>
            <textarea className="input-field !text-xs" rows={3} placeholder="Mesajınızı yazın..." value={supMsg} onChange={e => setSupMsg(e.target.value)} />
            {supSent ? (
              <div className="bg-green-50 text-green-700 text-xs rounded-xl px-4 py-2.5 text-center">Talebiniz iletildi!</div>
            ) : (
              <button onClick={sendSupport} disabled={supLoading || !supMsg.trim()} className="btn-primary w-full !text-sm disabled:opacity-50">
                {supLoading ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            )}
            {adminEmail && <p className="text-[10px] text-gray-400 text-center">Sistem yöneticisi: {adminEmail}</p>}
          </div>
        )}
      </>)}
    </div>
  );
}

// ─── VOLUNTEERS ───────────────────────────
function VolunteersView({ uid, me }) {
  const [vols, setVols] = useState([]);
  const [sel, setSel] = useState(null);
  useEffect(() => { db.getAllProfiles().then(({ data }) => setVols(data || [])); }, []);

  const changeRole = async (id, role) => { await db.setUserRole(id, role); setVols(vols.map(v => v.id === id ? { ...v, role } : v)); };
  const changeDept = async (id, dept) => { await db.setUserDept(id, dept); setVols(vols.map(v => v.id === id ? { ...v, department: dept } : v)); };
  const toggleStatus = async (id, status) => { await db.setUserStatus(id, status); setVols(vols.map(v => v.id === id ? { ...v, status } : v)); };

  return (
    <div className="fade-up space-y-3">
      <h2 className="text-base font-bold">👥 Gönüllüler ({vols.length})</h2>
      {vols.map(v => (
        <div key={v.id} className={`card cursor-pointer ${v.status !== 'active' ? 'opacity-50' : ''}`} onClick={() => setSel(sel === v.id ? null : v.id)}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">{(v.display_name||'?')[0]}</div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{v.display_name} <span className="text-xs">{ROLES[v.role]?.i}</span></div>
              <div className="text-[11px] text-gray-400">{DM[v.department]?.i || '—'} {DM[v.department]?.l || 'Departman atanmamış'} · {Number(v.total_hours || 0).toFixed(0)}s</div>
            </div>
            <span className={`badge ${v.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{v.status === 'active' ? 'Aktif' : 'Pasif'}</span>
          </div>
          {sel === v.id && v.id !== uid && (
            <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 w-16">Rol:</span>
                <select className="input-field !py-1.5 !text-xs" value={v.role} onChange={e => changeRole(v.id, e.target.value)}>
                  <option value="vol">Gönüllü</option><option value="coord">Koordinatör</option>{me.role === 'admin' && <option value="admin">Yönetici</option>}
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 w-16">Dept:</span>
                <select className="input-field !py-1.5 !text-xs" value={v.department || ''} onChange={e => changeDept(v.id, e.target.value)}>
                  <option value="">Seçiniz</option>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}
                </select>
              </div>
              <button onClick={() => toggleStatus(v.id, v.status === 'active' ? 'inactive' : 'active')}
                className={`text-xs font-semibold px-3 py-1 rounded-lg ${v.status === 'active' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                {v.status === 'active' ? 'Pasife Al' : 'Aktif Et'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TASKS ────────────────────────────────
function ProgressBar({ value, small }) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  const color = v >= 80 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${small ? 'h-1.5' : 'h-3'}`}>
      <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${v}%` }} />
    </div>
  );
}

function TasksView({ uid, me, can }) {
  const [tasks, setTasks] = useState([]);
  const [vols, setVols] = useState([]);
  const [show, setShow] = useState(false);
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({ title:'', description:'', department:'arsiv', assigned_to:'', priority:'medium', deadline:'' });
  const load = useCallback(async () => {
    const [t, v] = await Promise.all([
      me.role === 'vol' ? db.getTasks({ assignedTo: uid }) : db.getTasks(),
      db.getAllProfiles()
    ]);
    setTasks(t.data || []); setVols((v.data || []).filter(v => v.status === 'active'));
  }, [uid, me.role]);
  useEffect(() => { load(); }, [load]);

  const volMap = Object.fromEntries(vols.map(v => [v.id, v]));

  const create = async () => {
    if (!f.title) return;
    await db.createTask({ ...f, assigned_to: f.assigned_to ? [f.assigned_to] : [], created_by: uid });
    setShow(false); setF({ title:'', description:'', department:'arsiv', assigned_to:'', priority:'medium', deadline:'' }); load();
  };

  if (sel) {
    const task = tasks.find(t => t.id === sel);
    if (task) return <TaskDetail task={task} uid={uid} me={me} can={can} vols={volMap} onBack={() => { setSel(null); load(); }} />;
  }

  return (
    <div className="fade-up space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold">{'\u{1F4CB}'} {me.role === 'vol' ? 'Görevlerim' : 'Görevler'}</h2>
        {can('assign_tasks') && <button className="btn-primary !py-1.5 !px-3 !text-xs" onClick={() => setShow(!show)}>{show ? '✕' : '+ Yeni'}</button>}
      </div>
      {show && (
        <div className="card border-l-4 border-purple-400 space-y-2">
          <input className="input-field" placeholder="Görev başlığı" value={f.title} onChange={e => setF({...f, title: e.target.value})} />
          <textarea className="input-field" rows={2} placeholder="Açıklama" value={f.description} onChange={e => setF({...f, description: e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input-field" value={f.department} onChange={e => setF({...f, department: e.target.value})}>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>
            <select className="input-field" value={f.priority} onChange={e => setF({...f, priority: e.target.value})}>{Object.entries(PRIORITIES).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input-field" value={f.assigned_to} onChange={e => setF({...f, assigned_to: e.target.value})}><option value="">Atanacak kişi</option>{vols.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
            <input className="input-field" type="date" value={f.deadline} onChange={e => setF({...f, deadline: e.target.value})} />
          </div>
          <button className="btn-primary w-full !text-sm" onClick={create}>Oluştur</button>
        </div>
      )}
      {tasks.map(t => (
        <div key={t.id} className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSel(t.id)}>
          <div className="flex items-start gap-2">
            <div className={`w-2 h-2 rounded-full mt-1.5 ${PRIORITIES[t.priority]?.c?.split(' ')[0]}`} />
            <div className="flex-1">
              <div className="font-semibold text-sm">{t.title}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{DM[t.department]?.i} {DM[t.department]?.l}{t.deadline && ` · ${fd(t.deadline)}`}</div>
              {/* Mini progress bar */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1"><ProgressBar value={t.progress} small /></div>
                <span className="text-[10px] font-semibold text-gray-500">{Math.round(t.progress || 0)}%</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`badge ${t.status === 'done' ? 'bg-emerald-50 text-emerald-600' : t.status === 'review' ? 'bg-blue-50 text-blue-600' : t.status === 'active' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>{STATUSES[t.status]}</span>
                {/* Assigned avatars */}
                {t.assigned_to?.length > 0 && (
                  <div className="flex -space-x-1.5">
                    {t.assigned_to.slice(0, 4).map(id => {
                      const v = volMap[id];
                      return <div key={id} className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600 border border-white" title={v?.display_name}>{(v?.display_name || '?')[0]}</div>;
                    })}
                    {t.assigned_to.length > 4 && <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500 border border-white">+{t.assigned_to.length - 4}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      {tasks.length === 0 && <Empty i="📋" t="Görev bulunamadı" />}
    </div>
  );
}

// ─── TASK DETAIL ─────────────────────────
function TaskDetail({ task, uid, me, can, vols, onBack }) {
  const [progress, setProgress] = useState(task.progress || 0);
  const [newProg, setNewProg] = useState(task.progress || 0);
  const [progNote, setProgNote] = useState('');
  const [logs, setLogs] = useState([]);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const loadDetails = useCallback(async () => {
    const [pl, tc] = await Promise.all([db.getProgressLogs(task.id), db.getTaskComments(task.id)]);
    setLogs(pl.data || []);
    setComments(tc.data || []);
  }, [task.id]);
  useEffect(() => { loadDetails(); }, [loadDetails]);

  const canEdit = can('assign_tasks') || (task.assigned_to && task.assigned_to.includes(uid));

  const submitProgress = async () => {
    if (newProg === progress && !progNote.trim()) return;
    setLoading(true);
    await db.addProgressLog({ task_id: task.id, user_id: uid, previous_value: progress, new_value: newProg, note: progNote });
    await db.updateTaskProgress(task.id, newProg);
    // Notify other assigned users
    if (task.assigned_to) {
      for (const volId of task.assigned_to) {
        if (volId !== uid) {
          await db.sendNotification(volId, 'task', `📊 ${task.title}: %${Math.round(newProg)}`, `${me.display_name}: ${progNote || 'ilerleme guncellendi'}`);
        }
      }
    }
    setProgress(newProg);
    setProgNote('');
    setLoading(false);
    loadDetails();
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    await db.addTaskComment({ task_id: task.id, user_id: uid, content: comment });
    if (task.assigned_to) {
      for (const volId of task.assigned_to) {
        if (volId !== uid) {
          await db.sendNotification(volId, 'task', `💬 ${task.title}`, `${me.display_name}: ${comment.slice(0, 80)}`);
        }
      }
    }
    setComment('');
    setLoading(false);
    loadDetails();
  };

  // Merge logs + comments into timeline
  const timeline = [
    ...logs.map(l => ({ ...l, _type: 'progress', _time: l.created_at })),
    ...comments.map(c => ({ ...c, _type: 'comment', _time: c.created_at })),
  ].sort((a, b) => new Date(b._time) - new Date(a._time));

  return (
    <div className="fade-up space-y-3">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Geri</button>

      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${PRIORITIES[task.priority]?.c}`}>{PRIORITIES[task.priority]?.l}</span>
          <span className={`badge ${task.status === 'done' ? 'bg-emerald-50 text-emerald-600' : task.status === 'review' ? 'bg-blue-50 text-blue-600' : task.status === 'active' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>{STATUSES[task.status]}</span>
        </div>
        <h2 className="font-bold text-base">{task.title}</h2>
        <div className="text-[11px] text-gray-400 mt-1">{DM[task.department]?.i} {DM[task.department]?.l}{task.deadline && ` · Son: ${fdf(task.deadline)}`}</div>
        {task.description && <p className="text-xs text-gray-500 mt-2">{task.description}</p>}
        {/* Assigned */}
        {task.assigned_to?.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-50">
            <span className="text-[10px] text-gray-400">Atanan:</span>
            {task.assigned_to.map(id => {
              const v = vols[id];
              return <div key={id} className="flex items-center gap-1 bg-gray-50 rounded-full pl-0.5 pr-2 py-0.5">
                <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[7px] font-bold text-emerald-600">{(v?.display_name || '?')[0]}</div>
                <span className="text-[10px] text-gray-600">{v?.display_name || '?'}</span>
              </div>;
            })}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">İlerleme</span>
          <span className={`text-sm font-bold ${progress >= 80 ? 'text-emerald-600' : progress >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} />

        {canEdit && task.status !== 'done' && task.status !== 'review' && (
          <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="100" step="5" value={newProg} onChange={e => setNewProg(Number(e.target.value))} className="flex-1 accent-emerald-600" />
              <span className="text-xs font-bold w-10 text-right">{newProg}%</span>
            </div>
            <input className="input-field !text-xs" placeholder="Ne yaptım? (not)" value={progNote} onChange={e => setProgNote(e.target.value)} />
            <button onClick={submitProgress} disabled={loading} className="btn-primary w-full !text-xs disabled:opacity-50">{loading ? '...' : 'Guncelle'}</button>
          </div>
        )}
        {task.status === 'review' && can('assign_tasks') && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-[10px] text-blue-600 mb-2">%100 tamamlandi, koordinator onayi bekleniyor.</p>
            <button onClick={async () => { await db.updateTask(task.id, { status: 'done', completed_at: new Date().toISOString() }); onBack(); }} className="btn-primary w-full !text-xs">✓ Tamamlandiyi Onayla</button>
          </div>
        )}
        {task.status === 'review' && !can('assign_tasks') && (
          <p className="mt-2 text-[10px] text-blue-500">Koordinator onayi bekleniyor...</p>
        )}
      </div>

      {/* Comment input */}
      <div className="card space-y-2">
        <span className="text-sm font-bold">Yorum Ekle</span>
        <textarea className="input-field !text-xs" rows={2} placeholder="Yorum yazin..." value={comment} onChange={e => setComment(e.target.value)} />
        <button onClick={submitComment} disabled={loading || !comment.trim()} className="btn-primary w-full !text-xs disabled:opacity-50">Gonder</button>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-sm font-bold">Aktivite</span>
          {timeline.map(item => (
            <div key={item.id} className="card !p-2.5 flex items-start gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] mt-0.5 ${item._type === 'progress' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                {item._type === 'progress' ? '📊' : '💬'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500">
                  <span className="font-semibold text-gray-700">{item.profiles?.display_name}</span>
                  {item._type === 'progress'
                    ? <>{' '}%{Math.round(item.previous_value)} → %{Math.round(item.new_value)}{item.note && ` — ${item.note}`}</>
                    : <>{' '}{item.content}</>
                  }
                </div>
                <div className="text-[9px] text-gray-300 mt-0.5">{fd(item._time)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HOURS ────────────────────────────────
function HoursView({ uid, me, can }) {
  const [hours, setHours] = useState([]);
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState(can('approve_hours') ? 'pending' : 'my');
  const [f, setF] = useState({ date: today(), hours: '', department: me.department || 'arsiv', description: '' });

  const load = useCallback(async () => {
    const filters = tab === 'my' ? { volunteerId: uid } : tab === 'pending' ? { status: 'pending' } : {};
    const { data } = await db.getHourLogs(filters);
    setHours(data || []);
  }, [uid, tab]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!f.hours) return;
    await db.logHours({ volunteer_id: uid, date: f.date, hours: parseFloat(f.hours), department: f.department, description: f.description });
    setShow(false); setF({ date: today(), hours: '', department: me.department || 'arsiv', description: '' }); load();
  };
  const review = async (id, status) => { await db.reviewHours(id, status, uid); load(); };

  return (
    <div className="fade-up space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold">⏱️ Saat Kaydı</h2>
        <button className="btn-primary !py-1.5 !px-3 !text-xs" onClick={() => setShow(!show)}>{show ? '✕' : '+ Kaydet'}</button>
      </div>
      {show && (
        <div className="card border-l-4 border-emerald-400 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field" type="date" value={f.date} onChange={e => setF({...f, date: e.target.value})} />
            <input className="input-field" type="number" step="0.5" min="0.5" placeholder="Saat" value={f.hours} onChange={e => setF({...f, hours: e.target.value})} />
          </div>
          <select className="input-field" value={f.department} onChange={e => setF({...f, department: e.target.value})}>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.i} {d.l}</option>)}</select>
          <input className="input-field" placeholder="Yapılan iş" value={f.description} onChange={e => setF({...f, description: e.target.value})} />
          <button className="btn-primary w-full !text-sm" onClick={submit}>Kaydet</button>
        </div>
      )}
      <div className="flex gap-1.5">
        {can('approve_hours') && <Tab active={tab==='pending'} onClick={() => setTab('pending')}>Bekleyen</Tab>}
        <Tab active={tab==='my'} onClick={() => setTab('my')}>Benim</Tab>
        {can('approve_hours') && <Tab active={tab==='all'} onClick={() => setTab('all')}>Tümü</Tab>}
      </div>
      {hours.map(h => {
        const sc = h.status === 'approved' ? 'text-emerald-600' : h.status === 'rejected' ? 'text-red-500' : 'text-amber-500';
        return (
          <div key={h.id} className="card">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                {(h.profiles?.display_name || '?')[0]}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-xs">{h.profiles?.display_name || 'Ben'} <span className={`font-semibold ${sc}`}>· {HOUR_S[h.status]}</span></div>
                <div className="text-[10px] text-gray-400">{fd(h.date)} · {DM[h.department]?.i} {DM[h.department]?.l}{h.description && ` · ${h.description}`}</div>
              </div>
              <span className="font-bold text-sm">{h.hours}s</span>
            </div>
            {h.status === 'pending' && can('approve_hours') && h.volunteer_id !== uid && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50">
                <button className="badge bg-emerald-50 text-emerald-600 cursor-pointer" onClick={() => review(h.id, 'approved')}>✓ Onayla</button>
                <button className="badge bg-red-50 text-red-500 cursor-pointer" onClick={() => review(h.id, 'rejected')}>✕ Reddet</button>
              </div>
            )}
          </div>
        );
      })}
      {hours.length === 0 && <Empty i="⏱️" t="Kayıt bulunamadı" />}
    </div>
  );
}

// ─── SCHEDULE ─────────────────────────────
function ScheduleView({ uid, me, can }) {
  const [shifts, setShifts] = useState([]);
  const [show, setShow] = useState(false);
  const [vols, setVols] = useState([]);
  const [f, setF] = useState({ volunteer_id: '', day_of_week: 'Pzt', start_time: '10:00', end_time: '14:00', department: 'arsiv' });
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [noteDay, setNoteDay] = useState(null);

  const load = useCallback(async () => {
    const filters = me.role === 'vol' ? { volunteerId: uid } : {};
    const [s, v] = await Promise.all([db.getShifts(filters), db.getAllProfiles()]);
    setShifts(s.data || []); setVols((v.data || []).filter(v => v.status === 'active'));
    // Load today's shift notes for my department
    if (me.department) {
      const { data } = await db.getShiftNotes(me.department, today());
      setNotes(data || []);
    }
  }, [uid, me.role, me.department]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const vid = f.volunteer_id || (me.role === 'vol' ? uid : '');
    if (!vid) return;
    await db.createShift({ ...f, volunteer_id: vid, created_by: uid });
    setShow(false); load();
  };
  const del = async (id) => { await db.deleteShift(id); load(); };

  const submitNote = async () => {
    if (!noteText.trim() || !me.department) return;
    await db.addShiftNote({ user_id: uid, department: me.department, date: today(), content: noteText });
    // Notify same dept
    const deptVols = vols.filter(v => v.department === me.department && v.id !== uid);
    for (const v of deptVols.slice(0, 10)) {
      await db.sendNotification(v.id, 'shift', `📝 Vardiya notu: ${DM[me.department]?.l}`, `${me.display_name}: ${noteText.slice(0, 80)}`);
    }
    setNoteText(''); setNoteDay(null); load();
  };

  const byDay = {};
  shifts.forEach(s => { (byDay[s.day_of_week] = byDay[s.day_of_week] || []).push(s); });
  const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  return (
    <div className="fade-up space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold">📅 Vardiya Planı</h2>
        {can('manage_vols') && <button className="btn-primary !py-1.5 !px-3 !text-xs" onClick={() => setShow(!show)}>{show ? '✕' : '+ Ekle'}</button>}
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
          <button className="btn-primary w-full !text-sm" onClick={create}>Ekle</button>
        </div>
      )}
      {DAYS.filter(d => byDay[d]).map(day => (
        <div key={day}>
          <div className={`text-xs font-bold mb-1.5 ${day === todayDay ? 'text-emerald-600' : ''}`}>{day === todayDay ? '📍 ' : ''}{day}</div>
          {byDay[day].map(sh => (
            <div key={sh.id} className="card mb-1.5 !p-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-bold text-emerald-600">
                {(sh.profiles?.display_name || '?')[0]}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-xs">{sh.profiles?.display_name}</div>
                <div className="text-[10px] text-gray-400">{DM[sh.department]?.i} {DM[sh.department]?.l}</div>
              </div>
              <span className="text-xs font-semibold">{sh.start_time?.slice(0,5)}–{sh.end_time?.slice(0,5)}</span>
              {can('manage_vols') && <button onClick={() => del(sh.id)} className="text-[10px] text-gray-300 hover:text-red-400">✕</button>}
            </div>
          ))}
          {/* Shift notes for today */}
          {day === todayDay && (
            <div className="ml-2 mt-1 mb-2">
              {notes.map(n => (
                <div key={n.id} className="flex items-start gap-2 py-1">
                  <span className="text-[10px]">📝</span>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-700">{n.profiles?.display_name}: </span>
                    <span className="text-[10px] text-gray-500">{n.content}</span>
                  </div>
                </div>
              ))}
              {noteDay === day ? (
                <div className="flex gap-1.5 mt-1">
                  <input className="input-field !py-1 !text-[10px] flex-1" placeholder="Bugün ne yapıldı, yarına ne kaldı..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                  <button onClick={submitNote} className="btn-primary !py-1 !px-2 !text-[10px]">Ekle</button>
                  <button onClick={() => setNoteDay(null)} className="text-[10px] text-gray-400">✕</button>
                </div>
              ) : (
                <button onClick={() => setNoteDay(day)} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold mt-1">+ Vardiya notu ekle</button>
              )}
            </div>
          )}
        </div>
      ))}
      {shifts.length === 0 && <Empty i="📅" t="Vardiya planı boş" />}
    </div>
  );
}

// ─── ANNOUNCEMENTS ────────────────────────
function AnnouncementsView({ uid, me, can }) {
  const [anns, setAnns] = useState([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', body: '', department: '', is_pinned: false });

  useEffect(() => { db.getAnnouncements().then(({ data }) => setAnns(data || [])); }, []);

  const create = async () => {
    if (!f.title || !f.body) return;
    await db.createAnnouncement({ ...f, department: f.department || null, author_id: uid });
    setShow(false); setF({ title: '', body: '', department: '', is_pinned: false });
    const { data } = await db.getAnnouncements(); setAnns(data || []);
  };

  const visible = me.role === 'vol' ? anns.filter(a => !a.department || a.department === me.department) : anns;

  return (
    <div className="fade-up space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold">📢 Duyurular</h2>
        {can('announcements') && <button className="btn-primary !py-1.5 !px-3 !text-xs" onClick={() => setShow(!show)}>{show ? '✕' : '+ Yeni'}</button>}
      </div>
      {show && (
        <div className="card border-l-4 border-amber-400 space-y-2">
          <input className="input-field" placeholder="Başlık" value={f.title} onChange={e => setF({...f, title: e.target.value})} />
          <textarea className="input-field" rows={3} placeholder="İçerik" value={f.body} onChange={e => setF({...f, body: e.target.value})} />
          <select className="input-field" value={f.department} onChange={e => setF({...f, department: e.target.value})}><option value="">Herkese</option>{DEPTS.map(d => <option key={d.id} value={d.id}>{d.l}</option>)}</select>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer"><input type="checkbox" checked={f.is_pinned} onChange={e => setF({...f, is_pinned: e.target.checked})} /> Sabitle</label>
          <button className="btn-primary w-full !text-sm" onClick={create}>Yayınla</button>
        </div>
      )}
      {visible.map(a => (
        <div key={a.id} className={`card ${a.is_pinned ? 'border-l-4 border-amber-400' : ''}`}>
          <div className="flex items-center gap-1.5 mb-1">{a.is_pinned && <span className="text-[10px]">📌</span>}<span className="font-bold text-sm">{a.title}</span></div>
          <p className="text-xs text-gray-500 leading-relaxed">{a.body}</p>
          <p className="text-[10px] text-gray-300 mt-2">{a.profiles?.display_name} · {fdf(a.created_at)}</p>
        </div>
      ))}
      {visible.length === 0 && <Empty i="📢" t="Duyuru yok" />}
    </div>
  );
}

// ─── APPLICATIONS ─────────────────────────
function ApplicationsView({ uid, me }) {
  const [apps, setApps] = useState([]);
  useEffect(() => { db.getApplications().then(({ data }) => setApps(data || [])); }, []);

  const review = async (id, status) => {
    await db.reviewApplication(id, status, uid);
    setApps(apps.map(a => a.id === id ? { ...a, status } : a));
  };

  return (
    <div className="fade-up space-y-3">
      <h2 className="text-base font-bold">📩 Başvurular ({apps.filter(a => a.status === 'pending').length} bekleyen)</h2>
      {apps.map(a => (
        <div key={a.id} className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">{a.name[0]}</div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{a.name}</div>
              <div className="text-[10px] text-gray-400">{a.email}{a.phone && ` · ${a.phone}`} · {DM[a.department]?.l}</div>
            </div>
            <span className={`badge ${a.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : a.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
              {a.status === 'pending' ? 'Bekliyor' : a.status === 'approved' ? 'Kabul' : 'Red'}
            </span>
          </div>
          {a.motivation && <div className="text-xs text-gray-500 bg-stone-50 rounded-lg p-2.5 mb-2 italic">"{a.motivation}"</div>}
          {a.status === 'pending' && (
            <div className="flex gap-2">
              <button className="badge bg-emerald-50 text-emerald-600 cursor-pointer" onClick={() => review(a.id, 'approved')}>✓ Kabul Et</button>
              <button className="badge bg-amber-50 text-amber-600 cursor-pointer" onClick={() => review(a.id, 'interview')}>🗓 Mülakat</button>
              <button className="badge bg-red-50 text-red-500 cursor-pointer" onClick={() => review(a.id, 'rejected')}>✕ Reddet</button>
            </div>
          )}
        </div>
      ))}
      {apps.length === 0 && <Empty i="📩" t="Başvuru yok" />}
    </div>
  );
}

// ─── REQUESTS ────────────────────────────
const REQ_TYPES = {
  dept_change: { l: 'Departman degistirmek istiyorum', i: '🔄', short: 'Dept. Degisiklik' },
  dept_join: { l: 'Baska departmanda da calismak istiyorum', i: '➕', short: 'Ek Departman' },
  task_cancel: { l: 'Bir gorevi iptal etmek istiyorum', i: '❌', short: 'Gorev Iptali' },
  task_join: { l: 'Baska bir goreve katilmak istiyorum', i: '🙋', short: 'Goreve Katilim' },
  task_help: { l: 'Gorevim icin yardim istiyorum', i: '🆘', short: 'Yardim Talebi' },
  pause: { l: 'Bir sure ara vermek istiyorum', i: '⏸️', short: 'Ara Verme' },
  deactivate: { l: 'Hesabimi pasife almak istiyorum', i: '🔒', short: 'Pasife Alma' },
  resign: { l: 'Vakiftan ayrilmak istiyorum', i: '👋', short: 'Ayrilma' },
  extra_volunteer: { l: 'Ek gonullu talebi', i: '👥', short: 'Ek Gonullu' },
  other: { l: 'Diger', i: '📝', short: 'Diger' },
};
const REQ_STATUS = {
  pending: { l: 'Bekliyor', c: 'bg-amber-50 text-amber-600' },
  approved: { l: 'Onaylandi', c: 'bg-emerald-50 text-emerald-600' },
  rejected: { l: 'Reddedildi', c: 'bg-red-50 text-red-500' },
  cancelled: { l: 'Iptal', c: 'bg-gray-100 text-gray-400' },
};

function RequestsView({ uid, me, can }) {
  const isReviewer = can('manage_vols');

  if (isReviewer) return <ManageRequestsView uid={uid} me={me} />;
  return <MyRequestsView uid={uid} me={me} />;
}

function MyRequestsView({ uid, me }) {
  const [reqs, setReqs] = useState([]);
  const [show, setShow] = useState(false);
  const [type, setType] = useState('other');
  const [desc, setDesc] = useState('');
  const [targetDept, setTargetDept] = useState('');
  const [targetTask, setTargetTask] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.getMyRequests(uid);
    setReqs(data || []);
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (['task_cancel','task_join','task_help'].includes(type)) {
      db.getTasks({ assignedTo: uid }).then(({ data }) => setTasks(data || []));
    }
  }, [type, uid]);

  const submit = async () => {
    if (!desc.trim()) return;
    setLoading(true);
    const title = REQ_TYPES[type]?.short || type;
    const reqData = {
      user_id: uid, type, title, description: desc,
      target_dept: ['dept_change','dept_join'].includes(type) ? targetDept || null : null,
      target_task_id: ['task_cancel','task_join','task_help'].includes(type) ? targetTask || null : null,
    };
    await db.createRequest(reqData);
    // Notify: admins + relevant coordinators
    const { data: admins } = await db.getProfilesByRole('admin');
    const notifyIds = new Set((admins || []).map(a => a.id));
    // For dept_change, notify both current and target dept coordinators
    if (['dept_change','dept_join'].includes(type)) {
      if (me.department) { const { data: c } = await db.getCoordsByDept(me.department); (c || []).forEach(x => notifyIds.add(x.id)); }
      if (targetDept) { const { data: c } = await db.getCoordsByDept(targetDept); (c || []).forEach(x => notifyIds.add(x.id)); }
    } else if (me.department) {
      const { data: c } = await db.getCoordsByDept(me.department); (c || []).forEach(x => notifyIds.add(x.id));
    }
    notifyIds.delete(uid); // Don't notify self
    for (const nid of notifyIds) {
      await db.sendNotification(nid, 'system', `📨 Yeni talep: ${title}`, `${me.display_name}: ${desc.slice(0, 80)}`);
    }
    setShow(false); setDesc(''); setType('other'); setTargetDept(''); setTargetTask('');
    setLoading(false);
    load();
  };

  const cancel = async (id) => {
    await db.cancelRequest(id);
    load();
  };

  return (
    <div className="fade-up space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold">📨 Taleplerim</h2>
        <button className="btn-primary !py-1.5 !px-3 !text-xs" onClick={() => setShow(!show)}>{show ? '✕' : '+ Yeni Talep'}</button>
      </div>

      {show && (
        <div className="card border-l-4 border-blue-400 space-y-2">
          <select className="input-field !text-xs" value={type} onChange={e => setType(e.target.value)}>
            {Object.entries(REQ_TYPES).filter(([k]) => me.role === 'coord' ? k !== 'resign' : k !== 'extra_volunteer').map(([k, v]) => (
              <option key={k} value={k}>{v.i} {v.l}</option>
            ))}
          </select>

          {['dept_change','dept_join'].includes(type) && (
            <select className="input-field !text-xs" value={targetDept} onChange={e => setTargetDept(e.target.value)}>
              <option value="">Hedef departman secin</option>
              {DEPTS.map(d => <option key={d.id} value={d.id}>{d.i} {d.l}</option>)}
            </select>
          )}

          {['task_cancel','task_join','task_help'].includes(type) && (
            <select className="input-field !text-xs" value={targetTask} onChange={e => setTargetTask(e.target.value)}>
              <option value="">Gorev secin</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}

          {type === 'pause' && (
            <p className="text-[10px] text-gray-400">Ara verme tarihlerinizi aciklamaya yazin (ornegin: 15 Nisan - 30 Nisan).</p>
          )}

          <textarea className="input-field !text-xs" rows={3} placeholder="Aciklama yazin (zorunlu)..." value={desc} onChange={e => setDesc(e.target.value)} />
          <button onClick={submit} disabled={loading || !desc.trim()} className="btn-primary w-full !text-sm disabled:opacity-50">
            {loading ? 'Gonderiliyor...' : 'Gonder'}
          </button>
        </div>
      )}

      {reqs.map(r => (
        <div key={r.id} className="card">
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5">{REQ_TYPES[r.type]?.i || '📝'}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{REQ_TYPES[r.type]?.short || r.title}</span>
                <span className={`badge ${REQ_STATUS[r.status]?.c}`}>{REQ_STATUS[r.status]?.l}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{r.description}</p>
              {r.target_dept && <div className="text-[10px] text-gray-400 mt-1">Hedef: {DM[r.target_dept]?.i} {DM[r.target_dept]?.l}</div>}
              {r.tasks?.title && <div className="text-[10px] text-gray-400 mt-0.5">Gorev: {r.tasks.title}</div>}
              <div className="text-[10px] text-gray-300 mt-1">{fdf(r.created_at)}</div>
              {r.review_note && r.status !== 'pending' && (
                <div className={`mt-2 p-2 rounded-lg text-[10px] ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {r.review_note}
                </div>
              )}
            </div>
          </div>
          {r.status === 'pending' && (
            <button onClick={() => cancel(r.id)} className="mt-2 text-[10px] text-gray-400 hover:text-red-500">Vazgectim</button>
          )}
        </div>
      ))}
      {reqs.length === 0 && !show && <Empty i="📨" t="Henuz talebiniz yok" />}
    </div>
  );
}

function ManageRequestsView({ uid, me }) {
  const [reqs, setReqs] = useState([]);
  const [tab, setTab] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const load = useCallback(async () => {
    const filters = {};
    if (tab !== 'all') filters.status = tab;
    if (typeFilter) filters.type = typeFilter;
    const { data } = await db.getAllRequests(filters);
    setReqs(data || []);
  }, [tab, typeFilter]);
  useEffect(() => { load(); }, [load]);

  const pendingCount = reqs.filter(r => r.status === 'pending').length;

  const handleReview = async (id, status) => {
    const { data: req } = await db.reviewRequest(id, status, uid, reviewNote);
    if (req && status === 'approved') {
      // Otomatik aksiyonlar
      if (req.type === 'dept_change' && req.target_dept) {
        // Notify both old and new dept coordinators
        const oldDept = req.profiles?.department;
        if (oldDept) {
          const { data: oldCoords } = await db.getCoordsByDept(oldDept);
          for (const c of (oldCoords || [])) {
            if (c.id !== uid) await db.sendNotification(c.id, 'system', `🔄 ${req.profiles?.display_name} departmandan ayrildi`, `${DM[oldDept]?.l} → ${DM[req.target_dept]?.l}`);
          }
        }
        const { data: newCoords } = await db.getCoordsByDept(req.target_dept);
        for (const c of (newCoords || [])) {
          if (c.id !== uid) await db.sendNotification(c.id, 'system', `🔄 ${req.profiles?.display_name} departmana katildi`, `${DM[oldDept]?.l || '?'} → ${DM[req.target_dept]?.l}`);
        }
        await db.setUserDept(req.user_id, req.target_dept);
      } else if (req.type === 'task_cancel' && req.target_task_id) {
        const { data: task } = await db.getTasks();
        const t = (task || []).find(t => t.id === req.target_task_id);
        if (t) await db.updateTask(t.id, { assigned_to: (t.assigned_to || []).filter(x => x !== req.user_id) });
      } else if (req.type === 'task_join' && req.target_task_id) {
        const { data: task } = await db.getTasks();
        const t = (task || []).find(t => t.id === req.target_task_id);
        if (t) await db.updateTask(t.id, { assigned_to: [...(t.assigned_to || []), req.user_id] });
      } else if (req.type === 'task_help' && req.target_task_id) {
        const dept = req.profiles?.department;
        if (dept) {
          const { data: deptVols } = await db.getProfilesByDept(dept);
          for (const v of (deptVols || []).slice(0, 20)) {
            if (v.id !== req.user_id) {
              await db.sendNotification(v.id, 'task', `🆘 Yardim araniyor: ${req.tasks?.title || ''}`, `${req.profiles?.display_name} bu gorev icin yardim istiyor`);
            }
          }
          // Duyuru olarak da ekle
          await db.createAnnouncement({ title: `🆘 Yardim Araniyor: ${req.tasks?.title || ''}`, body: `${req.profiles?.display_name} "${req.tasks?.title}" gorevi icin yardim ariyor. ${req.description || ''}`, author_id: uid, department: dept, is_pinned: false });
        }
      } else if (req.type === 'dept_join' && req.target_dept) {
        await db.addSecondaryDept(req.user_id, req.target_dept);
      } else if (req.type === 'pause') {
        await db.setUserStatus(req.user_id, 'paused');
      } else if (req.type === 'deactivate') {
        await db.setUserStatus(req.user_id, 'inactive');
      } else if (req.type === 'resign') {
        await db.setUserStatus(req.user_id, 'resigned');
        // Remove from all task assignments
        const { data: allTasks } = await db.getTasks();
        for (const t of (allTasks || [])) {
          if (t.assigned_to?.includes(req.user_id)) {
            await db.updateTask(t.id, { assigned_to: t.assigned_to.filter(x => x !== req.user_id) });
          }
        }
        // Delete shifts
        const { data: shifts } = await db.getShifts({ volunteerId: req.user_id });
        for (const s of (shifts || [])) { await db.deleteShift(s.id); }
      } else if (req.type === 'extra_volunteer') {
        const { data: allVols } = await db.getProfilesByRole('vol');
        for (const v of (allVols || []).slice(0, 30)) {
          await db.sendNotification(v.id, 'announcement', `👥 Ek gonullu araniyor`, req.description?.slice(0, 100) || '');
        }
      }
    }
    // Bildirim gonder
    const statusText = status === 'approved' ? 'onaylandi' : 'reddedildi';
    await db.sendNotification(req?.user_id || id, 'system', `📨 Talebiniz ${statusText}`, reviewNote || `${REQ_TYPES[req?.type]?.short || ''} talebiniz ${statusText}.`);
    setReviewNote(''); setReviewingId(null);
    load();
  };

  return (
    <div className="fade-up space-y-3">
      <h2 className="text-base font-bold">📨 Talepler {tab === 'pending' && pendingCount > 0 && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1">{pendingCount}</span>}</h2>

      <div className="flex gap-1.5 flex-wrap">
        {[['pending','Bekleyen'],['approved','Onaylanan'],['rejected','Reddedilen'],['all','Tumu']].map(([k,l]) => (
          <Tab key={k} active={tab===k} onClick={() => setTab(k)}>{l}</Tab>
        ))}
      </div>

      <select className="input-field !text-xs !py-1.5" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
        <option value="">Tum tipler</option>
        {Object.entries(REQ_TYPES).map(([k, v]) => <option key={k} value={k}>{v.i} {v.short}</option>)}
      </select>

      {reqs.map(r => (
        <div key={r.id} className="card">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
              {(r.profiles?.display_name || '?')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{r.profiles?.display_name}</span>
                <span className={`badge ${REQ_STATUS[r.status]?.c}`}>{REQ_STATUS[r.status]?.l}</span>
              </div>
              <div className="text-[10px] text-gray-400">{r.profiles?.department ? `${DM[r.profiles.department]?.i} ${DM[r.profiles.department]?.l}` : ''}</div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-sm">{REQ_TYPES[r.type]?.i}</span>
                <span className="text-xs font-semibold text-gray-700">{REQ_TYPES[r.type]?.short || r.title}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{r.description}</p>
              {r.target_dept && <div className="text-[10px] text-gray-400 mt-1">Hedef dept: {DM[r.target_dept]?.i} {DM[r.target_dept]?.l}</div>}
              {r.tasks?.title && <div className="text-[10px] text-gray-400 mt-0.5">Gorev: {r.tasks.title}</div>}
              <div className="text-[10px] text-gray-300 mt-1">{fdf(r.created_at)}</div>

              {r.status === 'pending' && r.user_id !== uid && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  {reviewingId === r.id ? (
                    <div className="space-y-1.5">
                      <input className="input-field !text-[10px] !py-1.5" placeholder="Not ekle (opsiyonel)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={() => handleReview(r.id, 'approved')} className="badge bg-emerald-50 text-emerald-600 cursor-pointer">✓ Onayla</button>
                        <button onClick={() => handleReview(r.id, 'rejected')} className="badge bg-red-50 text-red-500 cursor-pointer">✕ Reddet</button>
                        <button onClick={() => { setReviewingId(null); setReviewNote(''); }} className="text-[10px] text-gray-400">Iptal</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setReviewingId(r.id)} className="badge bg-blue-50 text-blue-600 cursor-pointer">Incele</button>
                    </div>
                  )}
                </div>
              )}
              {r.status === 'pending' && r.user_id === uid && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400">Kendi talebinizi onaylayamazsiniz</p>
                </div>
              )}
              {r.review_note && r.status !== 'pending' && (
                <div className={`mt-2 p-2 rounded-lg text-[10px] ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {r.review_note}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      {reqs.length === 0 && <Empty i="📨" t="Talep bulunamadi" />}
    </div>
  );
}

// ─── CHAT ────────────────────────────────
function ChatView({ uid, me }) {
  const isCoordOrAdmin = me.role === 'admin' || me.role === 'coord';
  const [dept, setDept] = useState(me.department || 'arsiv');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    const { data } = await db.getMessages(dept);
    setMessages((data || []).reverse());
  }, [dept]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    const sub = db.subscribeMessages(dept, (payload) => {
      setMessages(prev => [...prev, payload.new]);
    });
    return () => sub.unsubscribe();
  }, [dept]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    await db.sendMessage(uid, dept, text.trim());
    setText('');
    setSending(false);
    loadMessages();
  };

  return (
    <div className="fade-up space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold">💬 Departman Sohbeti</h2>
      </div>
      {isCoordOrAdmin ? (
        <div className="flex gap-1.5 flex-wrap">
          {DEPTS.map(d => (
            <button key={d.id} onClick={() => setDept(d.id)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all ${dept === d.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{d.i} {d.id}</button>
          ))}
        </div>
      ) : (me.secondary_departments?.length > 0) ? (
        <div className="flex gap-1.5 flex-wrap">
          {[me.department, ...(me.secondary_departments || [])].filter(Boolean).map(d => (
            <button key={d} onClick={() => setDept(d)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all ${dept === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{DM[d]?.i} {DM[d]?.l?.split(' ')[0]}</button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-400">{DM[dept]?.i} {DM[dept]?.l}</div>
      )}

      {/* Messages */}
      <div className="card !p-3 space-y-2 max-h-[50vh] overflow-y-auto">
        {messages.length === 0 && <p className="text-xs text-gray-300 text-center py-6">Henuz mesaj yok. Ilk mesaji siz gonderin!</p>}
        {messages.map((m, i) => {
          const isMine = m.user_id === uid;
          return (
            <div key={m.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {!isMine && <div className={`text-[9px] font-bold mb-0.5 ${isMine ? 'text-emerald-200' : 'text-emerald-600'}`}>{m.profiles?.display_name || '?'}</div>}
                <div className="text-xs leading-relaxed">{m.content}</div>
                <div className={`text-[8px] mt-0.5 ${isMine ? 'text-emerald-200' : 'text-gray-300'}`}>{m.created_at ? new Date(m.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input className="input-field flex-1 !text-xs" placeholder="Mesaj yazin..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={sending || !text.trim()} className="btn-primary !px-4 !text-xs disabled:opacity-50">Gonder</button>
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS ────────────────────────
function NotificationsView({ uid, onRead }) {
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    db.getNotifications(uid).then(({ data }) => setNotifs(data || []));
    db.markAllRead(uid); onRead();
  }, [uid, onRead]);
  const icons = { task:'📋', hours:'⏱️', announcement:'📢', application:'📩', shift:'📅', system:'📢', welcome:'🏛️' };
  return (
    <div className="fade-up space-y-3">
      <h2 className="text-base font-bold">🔔 Bildirimler</h2>
      {notifs.map(n => (
        <div key={n.id} className={`card flex items-center gap-3 ${!n.is_read ? 'border-l-4 border-emerald-400' : ''}`}>
          <span className="text-base">{icons[n.type] || '📢'}</span>
          <div className="flex-1"><div className="font-semibold text-xs">{n.title}</div>{n.body && <div className="text-[10px] text-gray-400">{n.body}</div>}</div>
          <span className="text-[10px] text-gray-300">{fd(n.created_at)}</span>
        </div>
      ))}
      {notifs.length === 0 && <Empty i="🔔" t="Bildirim yok" />}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────
function ProfileView({ me, uid, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ display_name: me.display_name, city: me.city || '', bio: me.bio || '' });
  const { adminEmail } = useAdminEmail();
  const save = async () => {
    const { data } = await db.updateProfile(uid, f);
    if (data) onUpdate(data); setEditing(false);
  };
  return (
    <div className="fade-up space-y-3">
      <div className="card text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-xl font-bold text-emerald-600 mx-auto mb-2">{(me.display_name||'?')[0]}</div>
        <div className="font-bold text-lg">{me.display_name}</div>
        <div className="text-xs text-emerald-600 font-semibold">{ROLES[me.role]?.i} {ROLES[me.role]?.l}</div>
        {me.department && <div className="text-xs text-gray-400">{DM[me.department]?.i} {DM[me.department]?.l}</div>}
        {me.city && <div className="text-xs text-gray-400">📍 {me.city}</div>}
        <div className="flex justify-center gap-8 mt-4 pt-3 border-t border-gray-50">
          <div className="text-center"><div className="font-bold text-emerald-600">{Number(me.total_hours||0).toFixed(0)}</div><div className="text-[9px] text-gray-400">Saat</div></div>
          <div className="text-center"><div className="font-bold">{fdf(me.joined_at)}</div><div className="text-[9px] text-gray-400">Üyelik</div></div>
        </div>
      </div>
      <button className="btn-ghost w-full !text-sm" onClick={() => setEditing(!editing)}>{editing ? '✕ İptal' : '✏️ Profili Düzenle'}</button>
      {editing && (
        <div className="card space-y-2">
          <input className="input-field" placeholder="İsim" value={f.display_name} onChange={e => setF({...f, display_name: e.target.value})} />
          <input className="input-field" placeholder="Şehir" value={f.city} onChange={e => setF({...f, city: e.target.value})} />
          <textarea className="input-field" rows={2} placeholder="Hakkımda" value={f.bio} onChange={e => setF({...f, bio: e.target.value})} />
          <button className="btn-primary w-full !text-sm" onClick={save}>Kaydet</button>
        </div>
      )}
      {adminEmail && (
        <div className="card border-l-4 border-blue-300">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🛟</span>
            <span className="text-sm font-bold text-gray-700">Destek</span>
          </div>
          <p className="text-xs text-gray-500">Sorun mu yaşıyorsunuz? Sistem yöneticisi:</p>
          <p className="text-xs font-semibold text-blue-600 mt-1">{adminEmail}</p>
        </div>
      )}
    </div>
  );
}

// ─── YARDIM ──────────────────────────────
function Accordion({ title, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <div className="card !p-0 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-50">{children}</div>}
    </div>
  );
}

function HelpStep({ n, text }) {
  return (
    <div className="flex gap-3 items-start py-1.5">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">{n}</span>
      <span className="text-xs text-gray-600 leading-relaxed">{text}</span>
    </div>
  );
}

function HelpView({ me }) {
  const role = me?.role || 'vol';
  const isCoord = role === 'coord' || role === 'admin';
  const isAdmin = role === 'admin';
  const { adminEmail } = useAdminEmail();

  return (
    <div className="space-y-3 fade-up">
      <div className="text-center py-2">
        <h2 className="text-lg font-bold" style={{fontFamily:"'Playfair Display',serif"}}>❓ Yardım & Kılavuz</h2>
        <p className="text-xs text-gray-400 mt-1">
          {isAdmin ? '👑 Yönetici Kılavuzu' : isCoord ? '📋 Koordinatör Kılavuzu' : '🤝 Gönüllü Kılavuzu'}
        </p>
      </div>

      {/* ── Hızlı Referans Tablosu ── */}
      <Accordion title="📊 Hızlı Referans — Rol Karşılaştırması" defaultOpen>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-1.5 text-gray-500 font-semibold">Özellik</th>
                <th className="text-center py-1.5 text-emerald-600 font-semibold">🤝 Gönüllü</th>
                <th className="text-center py-1.5 text-purple-600 font-semibold">📋 Koordinatör</th>
                <th className="text-center py-1.5 text-orange-600 font-semibold">👑 Yönetici</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {[
                ['Panel & İstatistikler', true, true, true],
                ['Görevleri görüntüleme', true, true, true],
                ['Saat kaydı girme', true, true, true],
                ['Vardiya planını görme', true, true, true],
                ['Duyuruları okuma', true, true, true],
                ['Bildirimler', true, true, true],
                ['Profil düzenleme', true, true, true],
                ['Gönüllü yönetimi', false, true, true],
                ['Görev oluşturma & atama', false, true, true],
                ['Saat onaylama / reddetme', false, true, true],
                ['Vardiya planlama', false, true, true],
                ['Duyuru yazma', false, true, true],
                ['Departman sohbeti', 'kendi', true, true],
                ['Görev ilerleme güncelleme', 'atanan', true, true],
                ['Görev yorumları', 'atanan', true, true],
                ['Vardiya notları', true, true, true],
                ['Talep oluşturma', true, true, false],
                ['Talep onaylama', false, true, true],
                ['Rol atama', false, false, true],
                ['Başvuru yönetimi', false, false, true],
                ['Tüm verilere erişim', false, false, true],
              ].map(([feat, vol, coord, admin], i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 font-medium">{feat}</td>
                  <td className="text-center">{vol === true ? '✅' : typeof vol === 'string' ? `✅ ${vol}` : '—'}</td>
                  <td className="text-center">{coord === true ? '✅' : typeof coord === 'string' ? `✅ ${coord}` : '—'}</td>
                  <td className="text-center">{admin === true ? '✅' : typeof admin === 'string' ? `✅ ${admin}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Accordion>

      {/* ── Gönüllü Bölümü ── */}
      <Accordion title="⏱️ Saat Kaydı Nasıl Girilir?">
        <div className="mt-2">
          <HelpStep n="1" text={`Alt menüden "Saatler" sekmesine tıklayın.`} />
          <HelpStep n="2" text={`"Yeni Kayıt" butonuna basın.`} />
          <HelpStep n="3" text={`Tarih, saat miktarı, departman ve açıklama girin.`} />
          <HelpStep n="4" text={`"Kaydet" ile gönderin. Kaydınız onay bekleyecek.`} />
          <HelpStep n="5" text={`Koordinatörünüz onayladığında bildirim alırsınız.`} />
          <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: Onay bekleyen kayıtlarınızı silebilirsiniz, onaylanmış kayıtlar silinemez.</p>
        </div>
      </Accordion>

      <Accordion title="📋 Görevler Nasıl Takip Edilir?">
        <div className="mt-2">
          <HelpStep n="1" text={`"Görevler" sekmesine gidin.`} />
          <HelpStep n="2" text={`Size atanan görevleri listede göreceksiniz.`} />
          <HelpStep n="3" text={`Öncelik ve durum bilgisine göre filtreleyebilirsiniz.`} />
          <HelpStep n="4" text={`Görevin detaylarını görmek için üzerine tıklayın.`} />
          <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: Yüksek öncelikli görevler kırmızı etiketle gösterilir.</p>
        </div>
      </Accordion>

      <Accordion title="📅 Vardiya Planını Nerede Görürüm?">
        <div className="mt-2">
          <HelpStep n="1" text={`"Vardiya" sekmesine tıklayın.`} />
          <HelpStep n="2" text={`Haftalık vardiya planınızı gün bazında göreceksiniz.`} />
          <HelpStep n="3" text={`Her vardiya kartında saat, departman ve not bilgisi yer alır.`} />
          <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: Tekrarlayan vardiyalar her hafta otomatik görünür.</p>
        </div>
      </Accordion>

      <Accordion title="📢 Duyuruları Nerede Okurum?">
        <div className="mt-2">
          <HelpStep n="1" text={`"Duyurular" sekmesinden tüm duyuruları görebilirsiniz.`} />
          <HelpStep n="2" text={`Sabitlenmiş (pinned) duyurular her zaman en üstte görünür.`} />
          <HelpStep n="3" text={`Departmana özel duyurular sadece ilgili kişilere gösterilir.`} />
        </div>
      </Accordion>

      <Accordion title="🔔 Bildirimler Nasıl Çalışır?">
        <div className="mt-2">
          <HelpStep n="1" text={`Sağ üstteki zil ikonuna tıklayarak bildirimlerinizi görün.`} />
          <HelpStep n="2" text={`Okunmamış bildirim sayısı kırmızı baloncukta gösterilir.`} />
          <HelpStep n="3" text={`Görev atanması, saat onayı ve duyurular bildirim oluşturur.`} />
          <HelpStep n="4" text={`"Tümünü okundu işaretle" ile bildirimleri temizleyebilirsiniz.`} />
        </div>
      </Accordion>

      <Accordion title="👤 Profilimi Nasıl Düzenlerim?">
        <div className="mt-2">
          <HelpStep n="1" text={`Alt menüden "Profil" sekmesine tıklayın.`} />
          <HelpStep n="2" text={`"Düzenle" butonuna basın.`} />
          <HelpStep n="3" text={`Ad, telefon, şehir ve biyografi bilgilerinizi güncelleyin.`} />
          <HelpStep n="4" text={`"Kaydet" ile değişikliklerinizi kaydedin.`} />
        </div>
      </Accordion>

      <Accordion title="💬 Departman Sohbeti Nasıl Kullanılır?">
        <div className="mt-2">
          <p className="text-xs text-gray-600 leading-relaxed">Sohbet sekmesinden departmanınızdaki diğer gönüllülerle mesajlaşabilirsiniz. Mesajlar gerçek zamanlı görünür — sayfa yenilemeye gerek yok.</p>
          <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: Koordinatörler ve yöneticiler tüm departmanların sohbetlerini görebilir.</p>
        </div>
      </Accordion>

      <Accordion title="📊 Görev İlerlemesi Nasıl Güncellenir?">
        <div className="mt-2">
          <HelpStep n="1" text={`"Görevler" sekmesinde ilgili göreve tıklayın.`} />
          <HelpStep n="2" text={`İlerleme barındaki slider ile yüzdeyi güncelleyin.`} />
          <HelpStep n="3" text={`"Ne yaptım?" alanına kısa bir not yazın.`} />
          <HelpStep n="4" text={`"Güncelle" butonuna basın.`} />
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">Diğer atanan kişiler bildirim alır. %100 olunca görev otomatik olarak "Tamamlandı" durumuna geçer.</p>
        </div>
      </Accordion>

      <Accordion title="💬 Görevlere Nasıl Yorum Yazılır?">
        <div className="mt-2">
          <p className="text-xs text-gray-600 leading-relaxed">Görev detay sayfasında ilerleme geçmişinin altında yorum alanı bulunur. Göreve atanan herkes yorum yazabilir. Yorumlar mavi ikonla, ilerleme kayıtları yeşil ikonla gösterilir.</p>
        </div>
      </Accordion>

      <Accordion title="📝 Vardiya Notu Nasıl Bırakılır?">
        <div className="mt-2">
          <HelpStep n="1" text={`"Vardiya" sekmesine gidin.`} />
          <HelpStep n="2" text={`Bugünün vardiyası altında "Vardiya notu ekle" linkine tıklayın.`} />
          <HelpStep n="3" text={`Ne yapıldığını ve yarına ne kaldığını yazın.`} />
          <HelpStep n="4" text={`"Ekle" butonuna basın.`} />
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">Aynı departmandaki herkes bu notları görebilir ve bildirim alır.</p>
        </div>
      </Accordion>

      <Accordion title="📨 Nasıl Talep Oluştururum?">
        <div className="mt-2">
          <HelpStep n="1" text={`Alt menüden "Taleplerim" sekmesine tıklayın.`} />
          <HelpStep n="2" text={`"Yeni Talep" butonuna basın.`} />
          <HelpStep n="3" text={`Talep tipini seçin ve gerekli bilgileri doldurun.`} />
          <HelpStep n="4" text={`Açıklama yazıp "Gönder" butonuna basın.`} />
          <div className="mt-2 space-y-1">
            <p className="text-[10px] font-semibold text-gray-600">Yapabileceğiniz talepler:</p>
            <p className="text-[10px] text-gray-500">🔄 Departman değiştirme</p>
            <p className="text-[10px] text-gray-500">➕ Başka departmanda da çalışma</p>
            <p className="text-[10px] text-gray-500">❌ Görev iptali</p>
            <p className="text-[10px] text-gray-500">🙋 Başka göreve katılma</p>
            <p className="text-[10px] text-gray-500">🆘 Görev için yardım isteme</p>
            <p className="text-[10px] text-gray-500">⏸️ Ara verme (duraklama)</p>
            <p className="text-[10px] text-gray-500">🔒 Hesabı pasife alma</p>
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">Talebiniz koordinatör veya yönetici tarafından incelenir. Sonucu bildirim olarak alırsınız.</p>
        </div>
      </Accordion>

      <Accordion title="📨 Talebimi İptal Edebilir Miyim?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Evet, bekleyen (pending) talepleri "Vazgeçtim" butonuyla iptal edebilirsiniz. Onaylanmış veya reddedilmiş talepler iptal edilemez.</p>
      </Accordion>

      {/* ── Koordinatör Bölümü ── */}
      {isCoord && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 h-px bg-purple-100"></div>
            <span className="text-[10px] font-semibold text-purple-500">📋 Koordinatör Araçları</span>
            <div className="flex-1 h-px bg-purple-100"></div>
          </div>

          <Accordion title="👥 Gönüllü Yönetimi Nasıl Yapılır?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Gönüllüler" sekmesinden tüm aktif gönüllüleri görün.`} />
              <HelpStep n="2" text={`İsme tıklayarak gönüllünün detay profilini açın.`} />
              <HelpStep n="3" text={`Departman ataması ve durum değişikliği yapabilirsiniz.`} />
              <HelpStep n="4" text={`Her gönüllünün toplam saat ve aktif gün sayısını takip edin.`} />
            </div>
          </Accordion>

          <Accordion title="📋 Görev Nasıl Oluşturulur ve Atanır?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Görevler" sekmesinde "Yeni Görev" butonuna tıklayın.`} />
              <HelpStep n="2" text={`Başlık, açıklama, departman ve öncelik belirleyin.`} />
              <HelpStep n="3" text={`Son tarih seçin ve görevi gönüllülere atayın.`} />
              <HelpStep n="4" text={`Atanan gönüllüler otomatik bildirim alır.`} />
              <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: Birden fazla gönüllüyü aynı göreve atayabilirsiniz.</p>
            </div>
          </Accordion>

          <Accordion title="✅ Saat Nasıl Onaylanır / Reddedilir?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Saatler" sekmesine gidin ve "Onay Bekliyor" filtresini seçin.`} />
              <HelpStep n="2" text={`Her kaydın yanındaki onay (✓) veya red (✗) butonuna tıklayın.`} />
              <HelpStep n="3" text={`Reddetme durumunda bir açıklama notu ekleyebilirsiniz.`} />
              <HelpStep n="4" text={`Gönüllü, sonucu bildirim olarak alacaktır.`} />
            </div>
          </Accordion>

          <Accordion title="📅 Vardiya Nasıl Planlanır?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Vardiya" sekmesinde "Yeni Vardiya" butonuna tıklayın.`} />
              <HelpStep n="2" text={`Gönüllü, gün, başlangıç-bitiş saati ve departman seçin.`} />
              <HelpStep n="3" text={`Tekrarlayan vardiya için "Haftalık tekrar" seçeneğini işaretleyin.`} />
              <HelpStep n="4" text={`Mevcut vardiyaları düzenleyebilir veya silebilirsiniz.`} />
            </div>
          </Accordion>

          <Accordion title="📢 Duyuru Nasıl Yazılır?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Duyurular" sekmesinde "Yeni Duyuru" butonuna tıklayın.`} />
              <HelpStep n="2" text={`Başlık ve içerik yazın.`} />
              <HelpStep n="3" text={`Belirli bir departmana mı herkese mi? Seçim yapın.`} />
              <HelpStep n="4" text={`Önemli duyurular için "Sabitle" seçeneğini işaretleyin.`} />
            </div>
          </Accordion>

          <Accordion title="💬 Departman Sohbetlerini Nasıl Yönetirim?">
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">Sohbet sekmesinde üstteki dropdown ile farklı departmanların sohbetlerini görebilirsiniz. Kendi departmanınıza veya diğer departmanlara mesaj yazabilirsiniz.</p>
          </Accordion>

          <Accordion title="📊 Görev İlerlemesini Nasıl Takip Ederim?">
            <div className="mt-2">
              <p className="text-xs text-gray-600 leading-relaxed">Görevler sayfasında her görev kartında mini ilerleme barı görünür. Göreve tıklayarak detaylı timeline görebilirsiniz: kim, ne zaman, ne kadar ilerletti.</p>
              <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: İlerleme barı rengi yüzdeye göre değişir: kırmızı → sarı → yeşil.</p>
            </div>
          </Accordion>

          <Accordion title="📨 Gelen Talepleri Nasıl Onaylarım?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Talepler" sekmesine gidin.`} />
              <HelpStep n="2" text={`Bekleyen talepleri inceleyin.`} />
              <HelpStep n="3" text={`"İncele" butonuna tıklayın.`} />
              <HelpStep n="4" text={`Not ekleyip "Onayla" veya "Reddet" butonuna basın.`} />
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">Onaylanan talepler otomatik uygulanır: departman değişir, görev güncellenir, kullanıcı durumu güncellenir vb.</p>
            </div>
          </Accordion>

          <Accordion title="👥 Ek Gönüllü Nasıl Talep Ederim?">
            <div className="mt-2">
              <p className="text-xs text-gray-600 leading-relaxed">Taleplerim sayfasından "Ek gönüllü talebi" tipinde talep oluşturabilirsiniz. Kaç kişiye ihtiyaç olduğunu ve hangi beceriler arandığını açıklamaya yazın. Yönetici onayladığında tüm gönüllülere duyuru olarak yayınlanır.</p>
            </div>
          </Accordion>

          <Accordion title="📊 Haftalık Departman Özetini Nerede Görürüm?">
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">Panel sayfasında "Bu Hafta" başlığı altında departman bazlı kartlarda bu haftanın toplam saati, tamamlanan görev sayısı ve aktif gönüllü sayısını görebilirsiniz.</p>
          </Accordion>
        </>
      )}

      {/* ── Yönetici Bölümü ── */}
      {isAdmin && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 h-px bg-orange-100"></div>
            <span className="text-[10px] font-semibold text-orange-500">👑 Yönetici Araçları</span>
            <div className="flex-1 h-px bg-orange-100"></div>
          </div>

          <Accordion title="👑 Rol Atama Nasıl Yapılır?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Gönüllüler" sekmesinden kullanıcıyı bulun.`} />
              <HelpStep n="2" text={`Profil detayında rol alanını tıklayın.`} />
              <HelpStep n="3" text={`Gönüllü, Koordinatör veya Yönetici rolünü seçin.`} />
              <p className="text-[10px] text-gray-400 mt-2 bg-amber-50 rounded-lg p-2">⚠️ Dikkat: Yönetici rolü tüm sisteme erişim sağlar. Dikkatli atayın.</p>
            </div>
          </Accordion>

          <Accordion title="📩 Başvuru Yönetimi Nasıl Çalışır?">
            <div className="mt-2">
              <HelpStep n="1" text={`"Başvuru" sekmesine gidin.`} />
              <HelpStep n="2" text={`Bekleyen başvuruları inceleyin: isim, motivasyon, deneyim.`} />
              <HelpStep n="3" text={`Uygun başvuruları "Onayla" ile kabul edin veya "Mülakata Al" ile ayırın.`} />
              <HelpStep n="4" text={`Uygun olmayan başvuruları not ekleyerek reddedin.`} />
              <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: Onaylanan başvuru sahiplerine kayıt linki gönderin.</p>
            </div>
          </Accordion>

          <Accordion title="💼 Günlük Yönetim Önerileri">
            <div className="mt-2 space-y-2">
              <div className="bg-emerald-50 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold text-emerald-700">☀️ Her Gün</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Bekleyen saat kayıtlarını ve talepleri onaylayın. Yeni başvuruları kontrol edin.</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold text-blue-700">📅 Her Hafta</p>
                <p className="text-[10px] text-blue-600 mt-0.5">Vardiya planını güncelleyin. Görev ilerlemelerini kontrol edin. Duyuru paylaşın.</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold text-purple-700">📊 Her Ay</p>
                <p className="text-[10px] text-purple-600 mt-0.5">Departman istatistiklerini inceleyin. Aktif olmayan gönüllüleri takip edin. Rapor çıkarın.</p>
              </div>
            </div>
          </Accordion>

          <Accordion title="💬 Tüm Departman Sohbetlerini Görebilir Miyim?">
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">Evet, Sohbet sekmesinde dropdown ile tüm departmanların sohbetlerini görebilirsiniz. İstediğiniz departmana mesaj da yazabilirsiniz.</p>
          </Accordion>

          <Accordion title="⏸️ Duraklatma/Pasif Talepleri Nasıl Yönetirim?">
            <div className="mt-2">
              <p className="text-xs text-gray-600 leading-relaxed">Talepler sayfasında "pause" ve "deactivate" tipindeki talepler gelir. Onayladığınızda kullanıcının durumu otomatik güncellenir (paused veya inactive).</p>
              <p className="text-[10px] text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">💡 İpucu: Tekrar aktif etmek için Gönüllüler sayfasından durumu "Aktif Et" butonu ile değiştirebilirsiniz.</p>
            </div>
          </Accordion>
        </>
      )}

      {/* ── SSS ── */}
      <div className="flex items-center gap-2 pt-2">
        <div className="flex-1 h-px bg-gray-200"></div>
        <span className="text-[10px] font-semibold text-gray-400">Sık Sorulan Sorular</span>
        <div className="flex-1 h-px bg-gray-200"></div>
      </div>

      <Accordion title="Şifremi unuttum, ne yapmalıyım?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Giriş ekranında "E-posta ile Giriş" &gt; "Şifremi unuttum" linkine tıklayın. E-postanıza sıfırlama linki gönderilecektir.</p>
      </Accordion>

      <Accordion title="Departmanımı değiştirebilir miyim?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Departman değişikliği koordinatör veya yönetici tarafından yapılır. Koordinatörünüze başvurun.</p>
      </Accordion>

      <Accordion title="Saat kaydım reddedildi, ne yapmalıyım?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Bildirimlerde red sebebini okuyun. Düzeltip yeni bir saat kaydı girebilirsiniz. Sorun devam ederse koordinatörünüzle iletişime geçin.</p>
      </Accordion>

      <Accordion title="Birden fazla departmanda çalışabilir miyim?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Taleplerim sayfasından "Başka departmanda da çalışmak istiyorum" talebi oluşturabilirsiniz. Koordinatör onayladığında ilgili departmanın sohbetini ve görevlerini de görebilirsiniz. Saat kayıtlarınızı zaten farklı departmanlar için girebilirsiniz.</p>
      </Accordion>

      <Accordion title="Ara vermek istiyorum, ne yapmalıyım?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Taleplerim sayfasından "Bir süre ara vermek istiyorum" seçin ve tarih aralığını açıklamaya yazın (ör: 15 Nisan - 30 Nisan). Koordinatör onayladığında hesabınız duraklatılır. Döndüğünüzde tekrar aktif edilir.</p>
      </Accordion>

      <Accordion title="Başka bir departmandaki göreve nasıl katılırım?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Taleplerim sayfasından "Başka bir göreve katılmak istiyorum" seçin ve ilgili görevi belirtin. Koordinatör onaylarsa göreve eklenirsiniz ve görev bildirimleri almaya başlarsınız.</p>
      </Accordion>

      <Accordion title="Sisteme kimler erişebilir?">
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">Sadece kayıtlı ve onaylanmış Tarih Vakfı gönüllüleri erişebilir. Tüm veriler Supabase üzerinde güvenli şekilde saklanır ve Row Level Security ile korunur.</p>
      </Accordion>

      <Accordion title="Teknik bir sorun yaşıyorum, kime ulaşmalıyım?">
        <div className="mt-2">
          <p className="text-xs text-gray-600 leading-relaxed">Panel sayfasındaki "Destek Talebi Gönder" butonunu kullanarak doğrudan sistem yöneticisine bildirim gönderebilirsiniz.</p>
          {adminEmail && (
            <div className="bg-blue-50 rounded-lg p-2.5 mt-2 flex items-center gap-2">
              <span className="text-sm">🛟</span>
              <div>
                <p className="text-[10px] font-semibold text-blue-700">Sistem Yöneticisi</p>
                <p className="text-xs text-blue-600 font-medium">{adminEmail}</p>
              </div>
            </div>
          )}
        </div>
      </Accordion>

      <div className="text-center py-4">
        <p className="text-[10px] text-gray-300">Tarih Vakfı Gönüllü Yönetim Sistemi v1.0</p>
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────
function Stat({ v, l, c }) { return <div className="card text-center !p-3"><div className={`text-xl font-bold ${c}`}>{v}</div><div className="text-[9px] text-gray-400">{l}</div></div>; }
function QA({ ic, lb, onClick }) { return <button onClick={onClick} className="card !p-3 text-center cursor-pointer hover:shadow-md transition-shadow"><div className="text-xl">{ic}</div><div className="text-[10px] font-semibold mt-1">{lb}</div></button>; }
function Tab({ active, children, onClick }) { return <button onClick={onClick} className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all ${active ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{children}</button>; }
function Empty({ i, t }) { return <div className="card text-center !py-8"><div className="text-2xl mb-2">{i}</div><p className="text-xs text-gray-400">{t}</p></div>; }
