'use client';

import { useState, useEffect, useRef } from 'react';
import * as db from '../../lib/supabase';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const DEPTS = [
  { id:'arsiv', l:'Arşiv', i:'📜', color:'#81B29A' },
  { id:'egitim', l:'Eğitim', i:'📚', color:'#E07A5F' },
  { id:'etkinlik', l:'Etkinlik', i:'🎪', color:'#E4B363' },
  { id:'dijital', l:'Dijital', i:'💻', color:'#7B6D8D' },
  { id:'rehber', l:'Rehber', i:'🏛️', color:'#3D405B' },
  { id:'baski', l:'Yayın', i:'📰', color:'#F4A261' },
  { id:'bagis', l:'Bağış', i:'💰', color:'#2A9D8F' },
  { id:'idari', l:'İdari', i:'🏢', color:'#264653' },
];
const DM = Object.fromEntries(DEPTS.map(d => [d.id, d]));
const DAYS_SHORT = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]}`; };

function AnimatedCount({ target, duration = 1200 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const t = Number(target) || 0;
    if (t === 0) { setVal(0); return; }
    let start = 0;
    const step = t / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= t) { setVal(t); clearInterval(id); }
      else setVal(Math.round(start));
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return <span ref={ref}>{typeof target === 'number' && target % 1 !== 0 ? val.toFixed(1) : val}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}</div>
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">{[1,2].map(i => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}</div>
      <div className="h-32 bg-gray-100 rounded-2xl" />
    </div>
  );
}

export default function OverviewView({ uid, me }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [deptComp, setDeptComp] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [trend, setTrend] = useState([]);
  const [topVols, setTopVols] = useState([]);
  const [activity, setActivity] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [allTasks, setAllTasks] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, dc, t, hm, tr, tv, act, profs, at] = await Promise.all([
        db.getOverviewStats(),
        db.getDeptComparison(),
        db.getTasksForOverview(),
        db.getHeatmapData(),
        db.getWeeklyTrend(),
        db.getTopVolunteers(),
        db.getRecentActivity(),
        db.getAllProfiles(),
        db.getTasks(),
      ]);
      setStats(s);
      setDeptComp(dc.data || []);
      setTasks(t.data || []);
      setHeatmap(hm.data || []);
      setTrend(tr.data || []);
      setTopVols(tv.data || []);
      setActivity(act);
      setAllProfiles(profs.data || []);
      setAllTasks(at.data || []);
      setLoading(false);
    })();
  }, []);

  const volMap = Object.fromEntries(allProfiles.map(p => [p.id, p]));

  if (loading) return <Skeleton />;

  // Pie chart data
  const now = new Date();
  const pieData = [
    { name: 'Bekliyor', value: allTasks.filter(t => t.status === 'pending').length, color: '#9CA3AF' },
    { name: 'Devam Ediyor', value: allTasks.filter(t => t.status === 'active').length, color: '#E4B363' },
    { name: 'Kontrol', value: allTasks.filter(t => t.status === 'review').length, color: '#60A5FA' },
    { name: 'Tamamlandi', value: allTasks.filter(t => t.status === 'done').length, color: '#81B29A' },
    { name: 'Gecikmis', value: allTasks.filter(t => t.deadline && new Date(t.deadline) < now && !['done','cancelled'].includes(t.status)).length, color: '#E07A5F' },
  ].filter(d => d.value > 0);
  const totalTasks = allTasks.length;

  // Dept bar data
  const maxHours = Math.max(...deptComp.map(d => Math.max(Number(d.this_month), Number(d.last_month))), 1);
  const topDept = deptComp.reduce((a, b) => Number(a?.this_month || 0) > Number(b.this_month) ? a : b, null);

  // Heatmap: build 30-day grid
  const heatmapMap = Object.fromEntries(heatmap.map(h => [h.date, h]));
  const heatDays = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const data = heatmapMap[key];
    heatDays.push({ date: key, day: d.getDay(), hours: Number(data?.total_hours || 0), vols: Number(data?.volunteer_count || 0) });
  }
  const maxHeat = Math.max(...heatDays.map(d => d.hours), 1);

  // Vol dept distribution
  const deptDistrib = DEPTS.map(d => ({
    ...d,
    count: allProfiles.filter(p => p.department === d.id && p.status === 'active').length,
  })).filter(d => d.count > 0);
  const maxCount = Math.max(...deptDistrib.map(d => d.count), 1);

  // Upcoming shifts (7 days)
  const upcoming = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const dayName = DAYS_SHORT[dayIdx];
    upcoming.push({ date: d.toISOString().slice(0, 10), dayName, isToday: i === 0 });
  }

  // Relative time
  const relTime = (t) => {
    const diff = (now - new Date(t)) / 1000;
    if (diff < 60) return 'az once';
    if (diff < 3600) return `${Math.floor(diff / 60)}dk once`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa once`;
    return `${Math.floor(diff / 86400)}g once`;
  };

  return (
    <div className="fade-up space-y-5">
      <h2 className="text-lg font-bold" style={{fontFamily:"'Playfair Display',serif"}}>📊 Genel Durum</h2>

      {/* 1. Canli Ozet */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center !p-4"><div className="text-[28px] font-bold text-emerald-600"><AnimatedCount target={stats?.totalVols} /></div><div className="text-xs text-gray-400">Aktif Gonullu</div></div>
        <div className="card text-center !p-4"><div className="text-[28px] font-bold text-amber-500"><AnimatedCount target={Math.round(stats?.monthlyHours)} /></div><div className="text-xs text-gray-400">Bu Ay Saat</div></div>
        <div className="card text-center !p-4"><div className="text-[28px] font-bold text-purple-500"><AnimatedCount target={stats?.activeTasks} /></div><div className="text-xs text-gray-400">Aktif Gorev</div></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center !p-3"><div className="text-xl font-bold text-emerald-600"><AnimatedCount target={stats?.doneTasks} /></div><div className="text-xs text-gray-400">Tamamlanan (bu ay)</div></div>
        <div className="card text-center !p-3"><div className="text-xl font-bold text-blue-500"><AnimatedCount target={stats?.totalShifts} /></div><div className="text-xs text-gray-400">Toplam Vardiya</div></div>
      </div>

      {/* 2. Departman Aktivite */}
      <div className="card">
        <h3 className="text-[15px] font-bold mb-3">Departman Aktivitesi (Bu Ay)</h3>
        <div className="space-y-2.5">
          {DEPTS.map(d => {
            const data = deptComp.find(c => c.department === d.id);
            const thisM = Number(data?.this_month || 0);
            const lastM = Number(data?.last_month || 0);
            const isTop = topDept?.department === d.id && thisM > 0;
            return (
              <div key={d.id} className={`${isTop ? 'bg-amber-50 rounded-xl p-2 -mx-1' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{d.i}</span>
                  <span className="text-xs font-semibold text-gray-700 flex-1">{d.l}</span>
                  <span className="text-xs font-bold text-gray-800">{thisM}s</span>
                  {isTop && <span className="text-xs">🏆</span>}
                </div>
                <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-gray-200 rounded-full" style={{ width: `${(lastM / maxHours) * 100}%` }} />
                  <div className="absolute h-full rounded-full" style={{ width: `${(thisM / maxHours) * 100}%`, backgroundColor: d.color }} />
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-2 bg-emerald-500 rounded" /> Bu ay</div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 bg-gray-200 rounded" /> Gecen ay</div>
          </div>
        </div>
      </div>

      {/* 3. Pie + 5. Trend yan yana */}
      <div className="grid grid-cols-2 gap-3">
        {/* Pie Chart */}
        <div className="card !p-3">
          <h3 className="text-xs font-bold mb-2 text-center">Gorev Durumlari</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center"><div className="text-lg font-bold">{totalTasks}</div><div className="text-[10px] text-gray-400">gorev</div></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
            {pieData.map(d => <div key={d.name} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-[10px] text-gray-500">{d.name} ({d.value})</span></div>)}
          </div>
        </div>

        {/* Trend Chart */}
        <div className="card !p-3">
          <h3 className="text-xs font-bold mb-2 text-center">Haftalik Trend</h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={trend.map(t => ({ name: `H${Math.round(t.week_num)}`, saat: Number(t.total_hours) }))}>
              <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#81B29A" stopOpacity={0.3}/><stop offset="95%" stopColor="#81B29A" stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v} saat`]} />
              <Area type="monotone" dataKey="saat" stroke="#81B29A" fill="url(#tg)" strokeWidth={2} dot={{ r: 3, fill: '#81B29A' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Heatmap */}
      <div className="card">
        <h3 className="text-[15px] font-bold mb-3">Son 30 Gun Aktivitesi</h3>
        <div className="flex flex-wrap gap-1">
          {heatDays.map((d, i) => {
            const intensity = d.hours / maxHeat;
            const bg = d.hours === 0 ? '#F3F4F6' : `rgba(129, 178, 154, ${0.2 + intensity * 0.8})`;
            return (
              <div key={i} className="group relative">
                <div className="w-[18px] h-[18px] rounded-[3px] cursor-pointer transition-transform hover:scale-125" style={{ backgroundColor: bg }} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap hidden group-hover:block z-10">
                  {fd(d.date)} — {d.hours}s ({d.vols} gonullu)
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-gray-400">Az</span>
          {[0.1, 0.3, 0.5, 0.7, 1].map((v, i) => <div key={i} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: `rgba(129, 178, 154, ${0.2 + v * 0.8})` }} />)}
          <span className="text-[10px] text-gray-400">Cok</span>
        </div>
      </div>

      {/* 6. Gorev Ilerleme Panosu */}
      <div className="card">
        <h3 className="text-[15px] font-bold mb-3">Aktif Gorevler</h3>
        <div className="space-y-2.5">
          {tasks.slice(0, 10).map(t => {
            const overdue = t.deadline && new Date(t.deadline) < now && !['done','cancelled'].includes(t.status);
            return (
              <div key={t.id} className={`bg-gray-50 rounded-xl p-3 ${overdue ? 'border border-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] truncate">{t.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold" style={{ backgroundColor: `${DM[t.department]?.color}20`, color: DM[t.department]?.color }}>{DM[t.department]?.i} {DM[t.department]?.l}</span>
                      {overdue && <span className="text-xs text-red-500 font-semibold">⚠️ Gecikti</span>}
                      {t.deadline && !overdue && <span className="text-xs text-gray-400">{fd(t.deadline)}</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${t.progress >= 80 ? 'text-emerald-600' : t.progress >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{Math.round(t.progress || 0)}%</span>
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${t.progress >= 80 ? 'bg-emerald-500' : t.progress >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${t.progress || 0}%` }} />
                </div>
                {t.assigned_to?.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="flex -space-x-1.5">
                      {t.assigned_to.slice(0, 4).map(id => {
                        const v = volMap[id];
                        return <div key={id} className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600 border border-white" title={v?.display_name}>{(v?.display_name || '?')[0]}</div>;
                      })}
                    </div>
                    <span className="text-[10px] text-gray-400 ml-1">{t.assigned_to.length} kisi</span>
                  </div>
                )}
              </div>
            );
          })}
          {tasks.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Aktif gorev yok</p>}
        </div>
      </div>

      {/* 7. Gonullu Dagilimi */}
      <div className="card">
        <h3 className="text-[15px] font-bold mb-3">Gonullu Dagilimi</h3>
        <div className="flex flex-wrap gap-3 justify-center">
          {deptDistrib.map(d => {
            const size = 48 + (d.count / maxCount) * 40;
            return (
              <div key={d.id} className="flex flex-col items-center gap-1">
                <div className="rounded-full flex items-center justify-center shadow-sm border-2" style={{ width: size, height: size, backgroundColor: `${d.color}20`, borderColor: d.color }}>
                  <div className="text-center"><div className="text-sm">{d.i}</div><div className="text-xs font-bold" style={{ color: d.color }}>{d.count}</div></div>
                </div>
                <span className="text-[10px] text-gray-500">{d.l}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 9. En Aktif Gonulluler */}
      {topVols.length > 0 && (
        <div className="card">
          <h3 className="text-[15px] font-bold mb-3">Bu Ayin En Aktifleri</h3>
          <div className="space-y-2">
            {topVols.map((v, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              const barW = (Number(v.monthly_hours) / Number(topVols[0]?.monthly_hours || 1)) * 100;
              return (
                <div key={v.id} className="flex items-center gap-3">
                  <span className="text-sm w-6 text-center">{medal}</span>
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">{(v.display_name || '?')[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{v.display_name}</div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${barW}%` }} /></div>
                  </div>
                  <span className="text-[15px] font-bold text-emerald-600">{Number(v.monthly_hours).toFixed(0)}s</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 10. Canli Aktivite Akisi */}
      <div className="card">
        <h3 className="text-[15px] font-bold mb-3">Son Aktiviteler</h3>
        <div className="space-y-2">
          {activity.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1">
              <span className="text-sm mt-0.5">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 leading-relaxed">{a.text}</p>
              </div>
              <span className="text-[10px] text-gray-300 whitespace-nowrap">{relTime(a.time)}</span>
            </div>
          ))}
          {activity.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Henuz aktivite yok</p>}
        </div>
      </div>

      <div className="text-center py-2">
        <p className="text-[10px] text-gray-300">Veriler gercek zamanli guncellenir</p>
      </div>
    </div>
  );
}
