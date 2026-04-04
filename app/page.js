'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, getPublicStats, getPublicAnnouncements, getDeptVolunteerCounts } from '../lib/supabase';

const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };

const DEPTS = [
  { id:'arsiv', l:'Arşiv & Dokümantasyon', i:'📜', desc:'Tarihî belgelerin korunması, dijitalleştirilmesi ve kataloglanması' },
  { id:'egitim', l:'Eğitim & Atölye', i:'📚', desc:'Tarih eğitimi, atölye çalışmaları ve yaz okulları' },
  { id:'etkinlik', l:'Etkinlik & Organizasyon', i:'🎪', desc:'Konferans, seminer, gezi ve kültürel etkinlikler' },
  { id:'dijital', l:'Dijital & Sosyal Medya', i:'💻', desc:'Web, sosyal medya ve dijital içerik üretimi' },
  { id:'rehber', l:'Rehberlik & Gezi', i:'🏛️', desc:'Müze rehberliği, tarihî mekân gezileri' },
  { id:'baski', l:'Yayın & Baskı', i:'📰', desc:'Kitap, dergi ve bülten yayınları' },
  { id:'bagis', l:'Bağış & Sponsorluk', i:'💰', desc:'Fon geliştirme ve sponsor ilişkileri' },
  { id:'idari', l:'İdari İşler', i:'🏢', desc:'Organizasyon, planlama ve koordinasyon' },
];

function AnimCount({ target }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const t = Number(target) || 0;
    if (!t) { setVal(0); return; }
    let v = 0;
    const step = Math.max(1, Math.ceil(t / 40));
    const id = setInterval(() => { v += step; if (v >= t) { setVal(t); clearInterval(id); } else setVal(v); }, 30);
    return () => clearInterval(id);
  }, [target]);
  return <span ref={ref}>{val}</span>;
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [anns, setAnns] = useState([]);
  const [deptCounts, setDeptCounts] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session));
    Promise.all([
      getPublicStats(),
      getPublicAnnouncements(),
      getDeptVolunteerCounts(),
    ]).then(([s, a, d]) => {
      setStats(s.data);
      setAnns(a.data || []);
      setDeptCounts(d);
      setLoaded(true);
    });
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <span className="font-bold text-gray-800" style={{fontFamily:"'Playfair Display',serif"}}>Tarih Vakfı</span>
          </a>
          <div className="flex items-center gap-3">
            {session ? (<>
              <a href="/dashboard/" className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all">Panel</a>
            </>) : (<>
              <a href="/auth/" className="text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">Giriş Yap</a>
              <a href="/auth/" className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all">Gönüllü Ol</a>
            </>)}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-6xl mb-4">🏛️</div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight" style={{fontFamily:"'Playfair Display',serif"}}>
            Tarih Vakfı Gönüllü Platformu
          </h1>
          <p className="text-lg text-white/60 mt-4 max-w-lg mx-auto leading-relaxed">
            Tarihi korumak için birlikte çalışıyoruz. Arşivden eğitime, dijitalden rehberliğe — her alanda gönüllülerimizle büyüyoruz.
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <a href="/auth/" className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition-all active:scale-[0.98]">Gönüllü Ol</a>
            <a href="/auth/" className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition-all">Giriş Yap</a>
          </div>
        </div>
      </section>

      {/* Canlı İstatistikler */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { v: stats?.active_volunteers, l: 'Aktif Gönüllü', c: 'text-emerald-600', i: '👥' },
            { v: stats?.completed_tasks, l: 'Tamamlanan Görev', c: 'text-purple-600', i: '✅' },
            { v: Math.round(stats?.monthly_hours || 0), l: 'Bu Ay Saat', c: 'text-amber-500', i: '⏱️' },
            { v: stats?.department_count, l: 'Departman', c: 'text-blue-600', i: '🏢' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 text-center">
              <div className="text-2xl mb-1">{s.i}</div>
              <div className={`text-3xl font-bold ${s.c}`}>{loaded ? <AnimCount target={s.v} /> : '—'}</div>
              <div className="text-xs text-gray-400 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Departmanlar */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8" style={{fontFamily:"'Playfair Display',serif"}}>Departmanlarımız</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DEPTS.map(d => (
              <div key={d.id} className="bg-stone-50 rounded-2xl p-4 text-center hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">{d.i}</div>
                <div className="font-semibold text-sm">{d.l.split('&')[0].trim()}</div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{d.desc}</p>
                {deptCounts[d.id] > 0 && <div className="text-xs text-emerald-600 font-semibold mt-2">{deptCounts[d.id]} gönüllü</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl Gönüllü Olurum */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8" style={{fontFamily:"'Playfair Display',serif"}}>Nasıl Gönüllü Olurum?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { i: '📝', t: 'Kayıt Ol', d: 'Google hesabınız veya e-posta ile hızlıca kayıt olun.' },
              { i: '⏳', t: 'Onay Bekle', d: 'Yönetici hesabınızı inceler ve onaylar.' },
              { i: '🚀', t: 'Başla', d: 'Görev alın, saat kaydedin, departman ekibine katılın!' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-50 text-center">
                <div className="text-4xl mb-3">{s.i}</div>
                <div className="font-bold text-lg mb-1">{s.t}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="/auth/" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 rounded-xl transition-all inline-block active:scale-[0.98]">Hemen Başvur</a>
          </div>
        </div>
      </section>

      {/* Duyurular */}
      {anns.length > 0 && (
        <section className="py-12 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8" style={{fontFamily:"'Playfair Display',serif"}}>Son Gelişmeler</h2>
            <div className="space-y-3">
              {anns.map((a, i) => (
                <div key={i} className="bg-stone-50 rounded-2xl p-4">
                  <div className="font-semibold">{a.title}</div>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{a.body?.slice(0, 200)}</p>
                  <div className="text-xs text-gray-300 mt-2">{fd(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white/60 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-2xl mb-2">🏛️</div>
          <div className="font-bold text-white mb-2" style={{fontFamily:"'Playfair Display',serif"}}>Tarih Vakfı</div>
          <p className="text-sm max-w-md mx-auto leading-relaxed">
            Tarih Vakfı, Türkiye'nin tarihî ve kültürel mirasının korunması, araştırılması ve toplumla paylaşılması amacıyla çalışan bağımsız bir sivil toplum kuruluşudur.
          </p>
          <div className="mt-4 text-xs text-white/30">
            © 2026 Tarih Vakfı. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}
