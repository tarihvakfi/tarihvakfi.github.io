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
const fmtHours = h => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return `${hrs}s ${String(mins).padStart(2,'0')}dk`; };

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
    ? [['mine','Benim'],['team','Takımım'],['all','Tüm İşler'],['vols','Gönüllüler'],['shifts','Vardiya']]
    : isCoord
    ? [['mine','Benim'],['team','Takımım'],['all','Tüm İşler']]
    : [];

  const [subTab, setSubTab] = useState('mine');

  if (!isCoord) return <VolunteerWorkView uid={uid} me={me} />;

  return (
    <div>
      <TabBar tabs={tabs} active={subTab} onChange={setSubTab} />
      {subTab === 'mine' && <VolunteerWorkView uid={uid} me={me} />}
      {subTab === 'team' && <TeamView uid={uid} me={me} />}
      {subTab === 'all' && <AllTasksView uid={uid} me={me} can={can} />}
      {subTab === 'vols' && isAdmin && <VolunteersView uid={uid} me={me} />}
      {subTab === 'shifts' && isAdmin && <ShiftPlanView uid={uid} me={me} />}
    </div>
  );
}

// ── Gönüllü İş Görünümü (Check-in/out + İşler + Geçmiş + Vardiya) ──
function VolunteerWorkView({ uid, me }) {
  const [active, setActive] = useState(null); // aktif check-in
  const [lastCheckin, setLastCheckin] = useState(null);
  const [missedCheckout, setMissedCheckout] = useState(null);
  const [missedTime, setMissedTime] = useState('17:00');
  const [checkoutForm, setCheckoutForm] = useState(false);
  const [workDone, setWorkDone] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [elapsed, setElapsed] = useState('');
  const [tasks, setTasks] = useState([]);
  const [expandTask, setExpandTask] = useState(null);
  const [progVal, setProgVal] = useState(0);
  const [progNote, setProgNote] = useState('');
  const [weekHistory, setWeekHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [ac, lc, t, wk, sh, ws] = await Promise.all([
      db.getActiveCheckin(uid),
      db.getLastCheckin(uid),
      db.getTasks({ assignedTo: uid }),
      db.getWeekCheckins(uid),
      db.getShifts({ volunteerId: uid }),
      db.getWorkSummary(uid),
    ]);
    setActive(ac.data);
    setLastCheckin(lc.data);
    setTasks((t.data || []).filter(t => t.status !== 'done' && t.status !== 'cancelled'));
    setWeekHistory(wk.data || []);
    setShifts(sh.data || []);
    setSummary(ws.data);
    // Missed checkout check
    if (ac.data && ac.data.date !== today()) setMissedCheckout(ac.data);
    else setMissedCheckout(null);
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  // Live timer
  useEffect(() => {
    if (!active || missedCheckout) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(active.check_in).getTime()) / 1000);
      const h = Math.floor(diff / 3600); const m = Math.floor((diff % 3600) / 60);
      setElapsed(`${h}s ${String(m).padStart(2,'0')}dk`);
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [active, missedCheckout]);

  const doCheckIn = async () => {
    setSaving(true);
    await db.checkIn(uid);
    setSaving(false); load();
  };

  const doFixMissed = async () => {
    if (!missedCheckout) return;
    setSaving(true);
    const d = new Date(missedCheckout.check_in);
    const [h, m] = missedTime.split(':');
    d.setHours(parseInt(h), parseInt(m), 0, 0);
    await db.fixMissedCheckout(missedCheckout.id, d.toISOString());
    await db.updateCheckinHours(missedCheckout.id);
    setMissedCheckout(null); setSaving(false); load();
  };

  const startCheckout = () => { setCheckoutForm(true); };

  const doCheckOut = async () => {
    if (!workDone.trim() || !active) return;
    setSaving(true);
    const now = new Date().toISOString();
    await db.checkOut(active.id, now, workDone, nextPlan);
    await db.updateCheckinHours(active.id);
    setCheckoutForm(false); setWorkDone(''); setNextPlan('');
    setSaving(false); load();
  };

  const updateProgress = async (task) => {
    if (!progNote.trim()) return;
    setSaving(true);
    await db.addProgressLog({ task_id: task.id, user_id: uid, previous_value: task.progress || 0, new_value: progVal, note: progNote });
    await db.updateTaskProgress(task.id, progVal);
    if (task.assigned_to) {
      for (const vid of task.assigned_to) {
        if (vid !== uid) await db.sendNotification(vid, 'task', `📊 ${task.title}: %${progVal}`, `${me.display_name}: ${progNote}`);
      }
    }
    setProgNote(''); setExpandTask(null); setSaving(false); load();
  };

  const fmtTime = t => new Date(t).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
  const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const weekTotal = weekHistory.reduce((a, c) => a + Number(c.hours || 0), 0);

  return (
    <div className="space-y-5">
      {/* ═══ CHECK-IN / CHECK-OUT KARTI ═══ */}
      {missedCheckout ? (
        <div className="card border-l-4 border-amber-400 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <div className="font-bold">Dünkü çıkışını yapmadın!</div>
          <div className="text-sm text-gray-500">Giriş: {fmtTime(missedCheckout.check_in)} ({fd(missedCheckout.date)})</div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm">Kaçta çıktın?</span>
            <input type="time" className="input-field !w-28 !py-2 text-center" value={missedTime} onChange={e => setMissedTime(e.target.value)} />
          </div>
          <button onClick={doFixMissed} disabled={saving} className="btn-primary !py-3 w-full disabled:opacity-50">Çıkışı Kaydet ve Devam Et</button>
        </div>
      ) : !active ? (
        <div className="card text-center space-y-3">
          <div className="text-sm text-gray-400">Henüz giriş yapmadın</div>
          {lastCheckin?.next_plan && (
            <div className="bg-amber-50 rounded-xl p-3 text-left">
              <div className="text-xs text-amber-600 font-semibold mb-0.5">📌 Geçen seferden notun:</div>
              <div className="text-sm text-amber-800">{lastCheckin.next_plan}</div>
            </div>
          )}
          <button onClick={doCheckIn} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl py-5 px-8 rounded-2xl w-full transition-all active:scale-[0.97] shadow-lg shadow-emerald-500/20 disabled:opacity-50">
            🟢 GELDİM
          </button>
          {lastCheckin && (
            <div className="text-xs text-gray-400">Son gelişin: {fd(lastCheckin.date)}, {fmtTime(lastCheckin.check_in)}–{fmtTime(lastCheckin.check_out)} ({fmtHours(lastCheckin.hours)})</div>
          )}
        </div>
      ) : !checkoutForm ? (
        <div className="card text-center space-y-3 border-l-4 border-emerald-400">
          <div className="text-sm text-emerald-600 font-semibold">🟢 Çalışıyorsun — {fmtTime(active.check_in)}'den beri</div>
          <div className="text-3xl font-bold text-emerald-600">{elapsed}</div>
          {lastCheckin?.next_plan && (
            <div className="bg-amber-50 rounded-xl p-3 text-left">
              <div className="text-xs text-amber-600 font-semibold mb-0.5">📌 Planın:</div>
              <div className="text-sm text-amber-800">{lastCheckin.next_plan}</div>
            </div>
          )}
          <button onClick={startCheckout} className="bg-red-500 hover:bg-red-600 text-white font-bold text-xl py-5 px-8 rounded-2xl w-full transition-all active:scale-[0.97] shadow-lg shadow-red-500/20">
            🔴 ÇIKIYORUM
          </button>
        </div>
      ) : (
        <div className="card border-l-4 border-blue-400 space-y-3">
          <div className="text-center">
            <div className="text-sm text-gray-500">✅ Bugünkü çalışman: {fmtTime(active.check_in)} — şimdi</div>
            <div className="text-lg font-bold">{elapsed}</div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Bugün ne yaptın? *</label>
            <input className="input-field mt-1" placeholder="Örn: 3. kutudaki belgeleri taradım" value={workDone} onChange={e => setWorkDone(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Sonraki gelişinde ne yapacaksın?</label>
            <input className="input-field mt-1" placeholder="Örn: 4. kutuya geçeceğim" value={nextPlan} onChange={e => setNextPlan(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={doCheckOut} disabled={saving || !workDone.trim()} className="btn-primary flex-1 !py-3 disabled:opacity-50">{saving ? '...' : '✓ Kaydet'}</button>
            <button onClick={() => setCheckoutForm(false)} className="btn-ghost !py-3">İptal</button>
          </div>
        </div>
      )}

      {/* ═══ MİNİ ÖZET ═══ */}
      {summary && (summary.week_days > 0 || summary.month_days > 0) && (
        <div className="card !py-3 text-center text-sm text-gray-600">
          Bu hafta <b className="text-emerald-600">{summary.week_days} gün</b>, <b className="text-emerald-600">{fmtHours(Number(summary.week_hours))}</b> çalıştın 💪
        </div>
      )}

      {/* ═══ AKTİF İŞLERİM ═══ */}
      {tasks.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">📋 Aktif İşlerim</h2>
          {tasks.map(t => {
            const overdue = t.deadline && new Date(t.deadline) < new Date();
            const expanded = expandTask === t.id;
            return (
              <div key={t.id} className={`card mb-3 ${overdue ? 'border-l-4 border-red-400' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1"><div className="font-bold">{t.title}</div><div className="text-sm text-gray-400">{DM[t.department]?.i} {DM[t.department]?.l}{t.deadline && ` · ${fd(t.deadline)}`}{overdue && ' ⚠️'}</div></div>
                  <span className={`text-sm font-bold ${(t.progress||0) >= 80 ? 'text-emerald-600' : 'text-gray-400'}`}>{Math.round(t.progress||0)}%</span>
                </div>
                <div className="mt-2 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${(t.progress||0) >= 80 ? 'bg-emerald-500' : (t.progress||0) >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{width:`${t.progress||0}%`}} />
                </div>
                <button onClick={() => { setExpandTask(expanded ? null : t.id); setProgVal(t.progress||0); }} className="text-sm font-semibold text-emerald-600 mt-2">{expanded ? '✕ Kapat' : '📊 Güncelle'}</button>
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="100" step="5" value={progVal} onChange={e => setProgVal(Number(e.target.value))} className="flex-1 accent-emerald-600" />
                      <span className="text-sm font-bold w-12 text-right">{progVal}%</span>
                    </div>
                    <input className="input-field" placeholder="Ne yaptım?" value={progNote} onChange={e => setProgNote(e.target.value)} />
                    <button onClick={() => updateProgress(t)} disabled={saving} className="btn-primary w-full disabled:opacity-50">Kaydet</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ BU HAFTA GEÇMİŞİM ═══ */}
      {/* ═══ BU HAFTA + GEÇMİŞ KAYIT ═══ */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">📅 Bu Hafta</h2>
          <RetroForm uid={uid} onSave={load} />
        </div>
        {weekHistory.map(c => (
          <div key={c.id} className={`card mb-2 !py-3 flex items-center gap-3 ${c.is_retroactive ? 'border-l-4 border-amber-300' : ''}`}>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {fd(c.date)} · {fmtTime(c.check_in)}–{c.check_out ? fmtTime(c.check_out) : '?'}
                {c.is_retroactive && <span className="text-xs text-amber-500 ml-1">⏰</span>}
                {c.source === 'telegram' && <span className="text-xs ml-1">✈️</span>}
              </div>
              <div className="text-xs text-gray-400">{c.work_done || '—'}</div>
            </div>
            <span className="text-sm font-bold">{c.hours ? fmtHours(c.hours) : '—'}</span>
            <span className={`text-xs font-semibold ${c.status === 'approved' ? 'text-emerald-600' : 'text-amber-500'}`}>{c.status === 'approved' ? '✓' : '⏳'}</span>
          </div>
        ))}
        {weekHistory.length > 0 && <div className="text-sm text-gray-500 text-right font-semibold">Toplam: {fmtHours(weekTotal)}</div>}
        {weekHistory.length === 0 && <div className="card text-center py-4"><p className="text-sm text-gray-400">Bu hafta kayıt yok</p></div>}
      </div>

      {/* ═══ VARDİYAM ═══ */}
      {shifts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">📅 Vardiyam</h2>
          <div className="card">
            <table className="w-full text-sm">
              <tbody>
                {DAYS.filter(d => shifts.some(s => s.day_of_week === d)).map(day => {
                  const sh = shifts.find(s => s.day_of_week === day);
                  return (
                    <tr key={day} className={`border-b border-gray-50 ${day === todayDay ? 'bg-emerald-50' : ''}`}>
                      <td className="py-2 font-semibold">{day === todayDay ? `📍 ${day}` : day}</td>
                      <td className="py-2">{sh?.start_time?.slice(0,5)}–{sh?.end_time?.slice(0,5)}</td>
                      <td className="py-2 text-gray-400">{DM[sh?.department]?.i}</td>
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

// ── Geçmiş Kayıt Ekleme ──
function RetroForm({ uid, onSave }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ date: '', checkIn: '10:00', checkOut: '15:00', workDone: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Max 7 gün geriye
  const minDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // dünden geriye

  const save = async () => {
    setError('');
    if (!f.date || !f.checkIn || !f.checkOut || !f.workDone.trim()) { setError('Tüm alanları doldurun'); return; }
    if (f.checkIn >= f.checkOut) { setError('Çıkış, girişten sonra olmalı'); return; }
    const exists = await db.hasCheckinOnDate(uid, f.date);
    if (exists) { setError('Bu güne zaten kayıt var'); return; }
    setSaving(true);
    await db.addRetroactiveCheckin(uid, f.date, f.checkIn, f.checkOut, f.workDone, 'web');
    setShow(false); setF({ date: '', checkIn: '10:00', checkOut: '15:00', workDone: '' }); setSaving(false);
    onSave();
  };

  if (!show) return <button onClick={() => setShow(true)} className="text-sm font-semibold text-amber-600">+ Geçmiş Ekle</button>;

  return (
    <div className="card border-l-4 border-amber-300 space-y-2 mt-2 w-full">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold">⏰ Geçmiş Kayıt Ekle</span>
        <button onClick={() => setShow(false)} className="text-xs text-gray-400">✕</button>
      </div>
      <input type="date" className="input-field" min={minDate} max={maxDate} value={f.date} onChange={e => setF({...f, date: e.target.value})} />
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-gray-500">Giriş</label><input type="time" className="input-field" value={f.checkIn} onChange={e => setF({...f, checkIn: e.target.value})} /></div>
        <div><label className="text-xs text-gray-500">Çıkış</label><input type="time" className="input-field" value={f.checkOut} onChange={e => setF({...f, checkOut: e.target.value})} /></div>
      </div>
      <input className="input-field" placeholder="O gün ne yaptın?" value={f.workDone} onChange={e => setF({...f, workDone: e.target.value})} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50">{saving ? '...' : 'Kaydet'}</button>
      <p className="text-xs text-gray-400">Koordinatör onayı gerekir</p>
    </div>
  );
}

// ── Takımım (Koordinatör/Admin) ──
function TeamView({ uid, me }) {
  const [activeNow, setActiveNow] = useState([]);
  const [pending, setPending] = useState([]);
  const [weekTotal, setWeekTotal] = useState({ vols: 0, hours: 0 });
  const [volSummaries, setVolSummaries] = useState([]);
  const [sortBy, setSortBy] = useState('hours');

  const load = useCallback(async () => {
    const [ac, pend, ws] = await Promise.all([
      db.getActiveCheckins(),
      db.getPendingCheckins(),
      db.getAllWorkSummaries(),
    ]);
    setActiveNow(ac.data || []);
    setPending(pend.data || []);
    setVolSummaries(ws.data || []);
    // Week stats
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay()+6)%7));
    const weekPend = (pend.data || []).filter(c => new Date(c.date) >= monday);
    const uniqueVols = new Set(weekPend.map(c => c.user_id));
    setWeekTotal({ vols: uniqueVols.size, hours: weekPend.reduce((a,c) => a + Number(c.hours||0), 0) });
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (id) => { await db.approveCheckin(id, uid); load(); };
  const fmtTime = t => new Date(t).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });

  return (
    <div className="space-y-5">
      {/* Şu an burada */}
      <div>
        <h2 className="text-lg font-bold mb-3">🟢 Şu An Burada ({activeNow.length})</h2>
        {activeNow.length === 0 && <div className="card text-center py-4"><p className="text-sm text-gray-400">Şu an kimse yok</p></div>}
        {activeNow.map(c => {
          const diff = Math.floor((Date.now() - new Date(c.check_in).getTime()) / 60000);
          const h = Math.floor(diff / 60); const m = diff % 60;
          return (
            <div key={c.id} className="card mb-2 !py-3 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex-1">
                <div className="font-semibold text-sm">{c.profiles?.display_name}</div>
                <div className="text-xs text-gray-400">{fmtTime(c.check_in)}'den beri · {DM[c.profiles?.department]?.i}</div>
              </div>
              <span className="text-sm font-bold text-emerald-600">{h}s {m}dk</span>
            </div>
          );
        })}
      </div>

      {/* Onay Bekleyenler */}
      <div>
        <h2 className="text-lg font-bold mb-3">⏳ Onay Bekleyenler ({pending.length})</h2>
        {pending.map(c => (
          <div key={c.id} className="card mb-2 !py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs">{c.source === 'telegram' ? '✈️' : '🌐'}{c.is_retroactive ? '⏰' : ''}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{c.profiles?.display_name}</div>
                <div className="text-xs text-gray-400">{fd(c.date)} · {fmtTime(c.check_in)}–{c.check_out ? fmtTime(c.check_out) : '?'} · {c.hours ? fmtHours(c.hours) : '—'}{c.is_retroactive ? ' · sonradan' : ''}</div>
                {c.work_done && <div className="text-xs text-gray-500 mt-0.5">{c.work_done}</div>}
              </div>
              {c.user_id !== uid ? (
                <button onClick={() => approve(c.id)} className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg">✓ Onayla</button>
              ) : (
                <span className="text-xs text-gray-400">Kendi kaydın</span>
              )}
            </div>
            {c.photo_url && <img src={c.photo_url} alt="Çalışma fotoğrafı" className="mt-2 rounded-xl max-h-40 object-cover w-full" />}
          </div>
        ))}
        {pending.length === 0 && <div className="card text-center py-4"><p className="text-sm text-gray-400">Bekleyen onay yok</p></div>}
      </div>

      {/* Hafta Özet */}
      <div className="card text-center">
        <div className="text-sm text-gray-500">Bu hafta: <span className="font-bold text-gray-800">{weekTotal.vols} gönüllü</span>, <span className="font-bold text-emerald-600">{fmtHours(weekTotal.hours)}</span></div>
      </div>

      {/* Gönüllü Çalışma Özeti */}
      {volSummaries.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">👥 Gönüllü Özeti</h2>
            <div className="flex gap-1">
              {[['hours','Saat'],['days','Gün'],['name','Ad']].map(([k,l]) => (
                <button key={k} onClick={() => setSortBy(k)} className={`text-xs px-2 py-1 rounded-lg ${sortBy === k ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{l}</button>
              ))}
            </div>
          </div>
          {[...volSummaries].sort((a, b) => sortBy === 'hours' ? Number(b.month_hours) - Number(a.month_hours) : sortBy === 'days' ? Number(b.month_days) - Number(a.month_days) : a.display_name.localeCompare(b.display_name)).map(v => {
            const isOnline = activeNow.some(c => c.user_id === v.id);
            return (
              <div key={v.id} className="card mb-2 !py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">{(v.display_name||'?')[0]}</div>
                    {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{v.display_name} <span className="text-xs text-gray-400">{DM[v.department]?.i}</span></div>
                    <div className="text-xs text-gray-400">Bu ay: {v.month_days}g / {fmtHours(Number(v.month_hours))} · Toplam: {v.total_days}g / {fmtHours(Number(v.total_hours))}</div>
                  </div>
                  {v.last_visit && <span className="text-xs text-gray-300">{v.last_visit === today() ? 'Bugün' : fd(v.last_visit)}</span>}
                </div>
              </div>
            );
          })}
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
  const [allSummaries, setAllSummaries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, dc, t, ws] = await Promise.all([
        db.getOverviewStats(),
        db.getDeptComparison(),
        db.getTasksForOverview(),
        db.getAllWorkSummaries(),
      ]);
      setStats(s); setDeptComp(dc.data || []); setTasks(t.data || []); setAllSummaries(ws.data || []); setLoaded(true);
    })();
  }, []);

  const maxH = Math.max(...deptComp.map(d => Number(d.this_month)), 1);

  if (!loaded) return <div className="text-center py-12 text-gray-400">Yükleniyor...</div>;

  return (
    <div className="space-y-5">
      {/* Özet */}
      {(() => {
        const monthDays = allSummaries.reduce((a, s) => a + Number(s.month_days), 0);
        const monthHrs = allSummaries.reduce((a, s) => a + Number(s.month_hours), 0);
        const topVol = allSummaries[0];
        return (<>
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: stats?.totalVols, l: 'Aktif Gönüllü', c: 'text-emerald-600' },
              { v: Math.round(stats?.monthlyHours || monthHrs), l: 'Bu Ay Saat', c: 'text-amber-500' },
              { v: monthDays, l: 'Bu Ay Çalışma Günü', c: 'text-purple-600' },
              { v: stats?.doneTasks, l: 'Tamamlanan İş', c: 'text-blue-600' },
            ].map((s, i) => (
              <div key={i} className="card text-center">
                <div className={`text-2xl font-bold ${s.c}`}>{s.v ?? '—'}</div>
                <div className="text-xs text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>
          {topVol && Number(topVol.month_hours) > 0 && (
            <div className="card !py-3 text-center text-sm text-gray-600">🏆 En aktif: <b>{topVol.display_name}</b> — {topVol.month_days}g / {fmtHours(Number(topVol.month_hours))}</div>
          )}
        </>);
      })()}

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
  const [tgCode, setTgCode] = useState(null);
  const [tgLinked, setTgLinked] = useState(!!me.telegram_id);
  const [summary, setSummary] = useState(null);

  useEffect(() => { db.getWorkSummary(uid).then(({ data }) => setSummary(data)); }, [uid]);

  const save = async () => {
    const { data } = await db.updateProfile(uid, f);
    if (data) onUpdate(data); setEditing(false);
  };

  const linkTelegram = async () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.updateProfile(uid, { telegram_link_code: code });
    setTgCode(code);
  };

  const unlinkTelegram = async () => {
    await db.updateProfile(uid, { telegram_id: null, telegram_link_code: null, telegram_state: null });
    setTgLinked(false); setTgCode(null);
    onUpdate({ ...me, telegram_id: null });
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

      {/* Çalışma Özeti */}
      {summary && (
        <div className="card mt-3">
          <h3 className="font-bold text-sm mb-3">📊 Çalışma Özeti</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-50"><td className="py-1.5 text-gray-500">Bu Hafta</td><td className="py-1.5 font-semibold text-right">{summary.week_days} gün · {fmtHours(Number(summary.week_hours))}</td></tr>
              <tr className="border-b border-gray-50"><td className="py-1.5 text-gray-500">Bu Ay</td><td className="py-1.5 font-semibold text-right">{summary.month_days} gün · {fmtHours(Number(summary.month_hours))}</td></tr>
              <tr><td className="py-1.5 text-gray-500">Toplam</td><td className="py-1.5 font-bold text-emerald-600 text-right">{summary.total_days} gün · {fmtHours(Number(summary.total_hours))}</td></tr>
            </tbody>
          </table>
          {summary.first_visit && <div className="text-xs text-gray-400 mt-2">İlk giriş: {fdf(summary.first_visit)} · Son: {summary.last_visit === today() ? 'Bugün' : fdf(summary.last_visit)}</div>}
        </div>
      )}

      {/* Telegram Bağlama */}
      <div className="card mt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">✈️</span>
          <span className="font-bold text-sm">Telegram</span>
          {tgLinked && <span className="text-xs text-emerald-600 font-semibold">✓ Bağlı</span>}
        </div>
        {tgLinked ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Telegram ile giriş/çıkış yapabilirsiniz.</p>
            <button onClick={unlinkTelegram} className="text-xs text-red-500 font-semibold">Bağlantıyı Kaldır</button>
          </div>
        ) : tgCode ? (
          <div className="space-y-2 text-center">
            <p className="text-sm text-gray-500">Telegram'da <b>@tarihvakfi_bot</b>'a gidin ve şu komutu gönderin:</p>
            <div className="bg-gray-100 rounded-xl py-3 px-4 font-mono text-lg font-bold text-gray-800 tracking-wider">/start {tgCode}</div>
            <a href={`https://t.me/tarihvakfi_bot?start=${tgCode}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-semibold">veya buraya tıklayın →</a>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Telegram ile giriş/çıkış yapmak için hesabınızı bağlayın.</p>
            <button onClick={linkTelegram} className="btn-primary w-full !text-sm">📱 Telegram Bağla</button>
          </div>
        )}
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
    { q: 'Giriş/çıkış nasıl yapılır?', a: 'İşlerim sayfasında "GELDİM" butonuna bas. Çalışman bitince "ÇIKIYORUM" bas, ne yaptığını yaz, kaydet. Süre otomatik hesaplanır.' },
    { q: 'Çıkış yapmayı unuttum, ne olur?', a: 'Ertesi gün "GELDİM"a bastığında "Dünkü çıkışını yapmadın" uyarısı çıkar. Çıkış saatini girersin, sonra yeni giriş başlar.' },
    { q: 'Vardiyamı nerede görürüm?', a: 'İşlerim sayfasının alt kısmında vardiya tablonu görürsün.' },
    { q: 'Mesaj nasıl yazarım?', a: 'Mesajlar → Sohbet sekmesinden departman sohbetine mesaj yazabilirsiniz.' },
    { q: 'İstek nasıl gönderirim?', a: 'Mesajlar sayfasının altında "İstek Gönder" butonu var. Serbest metin yazın, koordinatörünüze/yöneticiye gider.' },
    { q: 'Profilimi nasıl düzenlerim?', a: 'Ben → Profil kartında "Düzenle" butonuna basın.' },
  ];
  if (me.role !== 'vol') {
    items.push(
      { q: 'Giriş/çıkış kayıtlarını nasıl onaylarım?', a: 'İşlerim → "Takımım" sekmesinde bekleyen check-out kayıtlarını onaylayın. Kendi kaydınızı onaylayamazsınız. "Şu an burada" bölümünde aktif gönüllüleri görebilirsiniz.' },
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
