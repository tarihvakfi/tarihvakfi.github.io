'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, getPublicStats, getPublicAnnouncements, getDeptVolunteerCounts } from '../lib/supabase';

const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };

const DEPTS = [
  { id:'arsiv', l:'Arşiv & Dokümantasyon', i:'📜', desc:'Tarih Vakfı\'nın zengin arşivini dijitalleştirme ve koruma' },
  { id:'egitim', l:'Eğitim & Atölye', i:'📚', desc:'Tarih atölyeleri, eğitim programları ve müfredat geliştirme' },
  { id:'etkinlik', l:'Etkinlik & Organizasyon', i:'🎪', desc:'Konferans, sempozyum, panel ve söyleşi organizasyonları' },
  { id:'dijital', l:'Dijital & Sosyal Medya', i:'💻', desc:'Sosyal medya, web içerik ve dijital iletişim yönetimi' },
  { id:'rehber', l:'Rehberlik & Gezi', i:'🏛️', desc:'Tarih gezileri, müze turları ve saha çalışmaları' },
  { id:'baski', l:'Yayın & Baskı', i:'📰', desc:'Toplumsal Tarih dergisi ve kitap yayın süreçleri' },
  { id:'bagis', l:'Bağış & Sponsorluk', i:'💰', desc:'Bağışçı ilişkileri, sponsorluk ve kaynak geliştirme' },
  { id:'idari', l:'İdari İşler', i:'🏢', desc:'İdari süreçler, koordinasyon ve lojistik' },
];

function AnimCount({ target }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = Number(target) || 0;
    if (!t) { setVal(0); return; }
    let v = 0;
    const step = Math.max(1, Math.ceil(t / 40));
    const id = setInterval(() => { v += step; if (v >= t) { setVal(t); clearInterval(id); } else setVal(v); }, 30);
    return () => clearInterval(id);
  }, [target]);
  return <span>{val}</span>;
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [anns, setAnns] = useState([]);
  const [deptCounts, setDeptCounts] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session));
    (async () => {
      try {
        const [s, a, d] = await Promise.all([
          getPublicStats(),
          getPublicAnnouncements(),
          getDeptVolunteerCounts(),
        ]);
        setStats(s?.data);
        setAnns(s?.data ? (a?.data || []) : []);
        setDeptCounts(d || {});
      } catch (e) { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/">
            <img src="https://tarihvakfi.org.tr/wp-content/uploads/2025/05/tarih-vakfi-logo.png" alt="Tarih Vakfı" className="h-8 w-auto" onError={e => { e.target.onerror=null; e.target.src=''; e.target.alt='🏛️ Tarih Vakfı'; }} />
          </a>
          {session ? (
            <a href="/dashboard/" className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all">Panelim</a>
          ) : (
            <a href="/auth/" className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all">Giriş Yap</a>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{background:'linear-gradient(135deg, #1a3c34 0%, #2d5a4e 40%, #1e3a5f 100%)'}}>
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\'/%3E%3Cpath d=\'M0 40L40 0\' stroke=\'%23fff\' stroke-width=\'.5\'/%3E%3C/svg%3E")'}} />
        <div className="relative max-w-3xl mx-auto text-center py-20 md:py-28 px-4">
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">
            Tarih Vakfı<br />Gönüllü Platformu
          </h1>
          <p className="text-base md:text-lg text-white/60 mt-5 max-w-xl mx-auto leading-relaxed">
            1991'den beri tarihi korumak ve toplumsal tarih bilincini geliştirmek için çalışıyoruz. Gönüllülerimizle birlikte büyüyoruz.
          </p>
        </div>
      </section>

      {/* Vakıf Hakkında */}
      <section className="py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Hakkımızda</h2>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            Tarih Vakfı, 1991 yılında 12 kişilik Girişim Kurulu ve 264 Kurucu Mütevelli ile kurulan, tarihe dair demokratik perspektifi geliştirmeyi amaçlayan bağımsız bir sivil toplum kuruluşudur. 35 yıllık tarihinde yüzlerce proje, sergi, kongre, konferans, sempozyum, atölye, söyleşi ve panel gerçekleştirmiştir.
          </p>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            <em>Toplumsal Tarih</em> dergisi Türkiye'nin 30 yaşını dolduran tek tarih dergisidir ve 400. sayısına yaklaşmaktadır. 600'den fazla başlıklı <em>Tarih Vakfı Yurt Yayınları</em>, İstanbul Ansiklopedisi ve Sendikacılık Ansiklopedisi vakfın önemli yayınları arasındadır.
          </p>
          <a href="https://tarihvakfi.org.tr" target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-sm text-emerald-600 font-semibold hover:underline">tarihvakfi.org.tr → Daha Fazla</a>
        </div>
      </section>

      {/* Canlı İstatistikler */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { v: stats?.active_volunteers, l: 'Aktif Gönüllü', c: 'text-emerald-600', i: '👥' },
            { v: stats?.completed_tasks, l: 'Tamamlanan Görev', c: 'text-purple-600', i: '✅' },
            { v: Math.round(stats?.monthly_hours || 0), l: 'Bu Ay Saat', c: 'text-amber-500', i: '⏱️' },
            { v: stats?.department_count, l: 'Departman', c: 'text-blue-600', i: '🏢' },
          ].map((s, i) => (
            <div key={i} className="bg-stone-50 rounded-2xl p-5 shadow-sm text-center">
              <div className="text-2xl mb-1">{s.i}</div>
              <div className={`text-3xl font-bold ${s.c}`}>{loaded ? <AnimCount target={s.v} /> : '—'}</div>
              <div className="text-xs text-gray-400 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Çalışma Alanları / Departmanlar */}
      <section className="py-14 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Çalışma Alanlarımız</h2>
          <p className="text-sm text-gray-400 text-center mb-8">Gönüllülerimiz 8 farklı departmanda aktif olarak çalışmaktadır</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DEPTS.map(d => (
              <div key={d.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 text-center hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">{d.i}</div>
                <div className="font-semibold text-sm">{d.l.split('&')[0].trim()}</div>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{d.desc}</p>
                {deptCounts[d.id] > 0 && <div className="text-xs text-emerald-600 font-semibold mt-2">{deptCounts[d.id]} gönüllü</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl Gönüllü Olurum */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Nasıl Gönüllü Olurum?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { i: '📝', n: '1', t: 'Kayıt Ol', d: 'Google hesabınız veya e-posta ile hızlıca kayıt olun.' },
              { i: '⏳', n: '2', t: 'Onay Bekleyin', d: 'Yönetici hesabınızı inceler ve onaylar.' },
              { i: '🚀', n: '3', t: 'Başlayın', d: 'Görev alın, çalışmanızı raporlayın!' },
              { i: '📱', n: '4', t: 'Telegram Bağla', d: 'Telefonunuzdan kolayca rapor girin (opsiyonel)' },
            ].map((s, i) => (
              <div key={i} className="bg-stone-50 rounded-2xl p-6 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center">{s.n}</div>
                <div className="text-4xl mt-2 mb-3">{s.i}</div>
                <div className="font-bold text-lg mb-1">{s.t}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="/auth/" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-all inline-block active:scale-[0.98] shadow-lg shadow-emerald-500/20">Gönüllü Ol</a>
          </div>
        </div>
      </section>

      {/* Son Gelişmeler */}
      {anns.length > 0 && (
        <section className="py-14 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Son Gelişmeler</h2>
            <div className="space-y-3">
              {anns.map((a, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
                  <div className="font-semibold text-[15px]">{a.title}</div>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{a.body?.slice(0, 200)}{a.body?.length > 200 ? '...' : ''}</p>
                  <div className="text-xs text-gray-300 mt-2">{fd(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="text-white" style={{background:'linear-gradient(135deg, #1a3c34, #1e3a5f)'}}>
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sol */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏛️</span>
                <span className="font-bold text-lg">Tarih Vakfı</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                Tarihe dair demokratik perspektifi geliştirmeyi amaçlayan bağımsız bir sivil toplum kuruluşu.
              </p>
              <p className="text-xs text-white/30 mt-3">© 2026 Tarih Vakfı. Tüm hakları saklıdır.</p>
            </div>
            {/* Orta */}
            <div>
              <div className="font-semibold text-sm mb-3 text-white/80">İletişim</div>
              <div className="space-y-1.5 text-sm text-white/50">
                <p>📍 Sarıdemir Mah. Ragıp Gümüşpala Cad.<br />Değirmen Sok. No:10, Eminönü/İstanbul</p>
                <p>📞 (212) 522 02 02 – (212) 513 52 35</p>
                <a href="https://tarihvakfi.org.tr" target="_blank" rel="noopener noreferrer" className="inline-block text-emerald-400 hover:text-emerald-300 transition-colors">🌐 tarihvakfi.org.tr</a>
              </div>
            </div>
            {/* Sağ */}
            <div>
              <div className="font-semibold text-sm mb-3 text-white/80">Destek Olun</div>
              <p className="text-sm text-white/50 mb-3">Tarih Vakfı'nın çalışmalarına destek olmak için Tarih Dostu olabilirsiniz.</p>
              <a href="https://fonzip.com/tarihvakfi/tarih-dostu" target="_blank" rel="noopener noreferrer" className="inline-block bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-semibold px-5 py-2.5 rounded-xl border border-emerald-500/30 transition-all text-sm">❤️ Tarih Dostu Ol</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
