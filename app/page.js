'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, getPublicStats, getPublicAnnouncements, getDeptVolunteerCounts, getPublicDashboard, getAllSiteContent } from '../lib/supabase';

const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const fd = d => { const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };

const DEPTS = [
  { id:'arsiv', l:'Arşiv ve Dokümantasyon', desc:'Tarih Vakfı\'nın zengin arşivini dijitalleştirme ve koruma' },
  { id:'egitim', l:'Eğitim ve Atölye', desc:'Tarih atölyeleri, eğitim programları ve müfredat geliştirme' },
  { id:'etkinlik', l:'Etkinlik ve Organizasyon', desc:'Konferans, sempozyum, panel ve söyleşi organizasyonları' },
  { id:'dijital', l:'Dijital ve Sosyal Medya', desc:'Sosyal medya, web içerik ve dijital iletişim yönetimi' },
  { id:'rehber', l:'Rehberlik ve Gezi', desc:'Tarih gezileri, müze turları ve saha çalışmaları' },
  { id:'baski', l:'Yayın ve Baskı', desc:'Toplumsal Tarih dergisi ve kitap yayın süreçleri' },
  { id:'bagis', l:'Bağış ve Sponsorluk', desc:'Bağışçı ilişkileri, sponsorluk ve kaynak geliştirme' },
  { id:'idari', l:'İdari İşler', desc:'İdari süreçler, koordinasyon ve lojistik' },
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

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [anns, setAnns] = useState([]);
  const [deptCounts, setDeptCounts] = useState({});
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [cms, setCms] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data?.session) setSession(data.session); });
    (async () => {
      const [s, pd, a, d, sc] = await Promise.all([getPublicStats(), getPublicDashboard(), getPublicAnnouncements(), getDeptVolunteerCounts(), getAllSiteContent()]);
      const merged = { ...(s.data || {}), ...(pd || {}) };
      setStats(merged); setAnns(a.data || []); setDeptCounts(d || {}); setCms(sc || {}); setLoaded(true);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#F3F4F6] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-semibold text-[15px] text-[#111827]">Tarih Vakfı</a>
          {session ? (
            <a href="/dashboard/" className="bg-[#059669] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#047857] transition-colors">Panelim</a>
          ) : (
            <a href="/auth/" className="bg-[#059669] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#047857] transition-colors">Giriş Yap</a>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{background:'linear-gradient(135deg, #064E3B 0%, #059669 100%)'}}>
        <div className="relative max-w-3xl mx-auto text-center py-20 md:py-28 px-4">
          <h1 className="text-3xl md:text-5xl font-semibold leading-tight">
            {(cms.homepage_hero?.title || 'Tarih Vakfı Gönüllü Platformu').split('\n').map((line,i)=><span key={i}>{line}<br/></span>)}
          </h1>
          <p className="text-base md:text-lg text-white/60 mt-5 max-w-xl mx-auto leading-relaxed">
            {cms.homepage_hero?.subtitle || '1991\'den beri tarihi korumak ve toplumsal tarih bilincini geliştirmek için çalışıyoruz.'}
          </p>
        </div>
      </section>

      {/* Hakkımızda */}
      <section className="py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[22px] font-medium mb-4">{cms.homepage_about?.title || 'Hakkımızda'}</h2>
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            {cms.homepage_about?.text || 'Tarih Vakfı, 1991 yılında kurulan, tarihe dair demokratik perspektifi geliştirmeyi amaçlayan bağımsız bir sivil toplum kuruluşudur.'}
          </p>
          <a href="https://tarihvakfi.org.tr" target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-[13px] text-[#059669] font-medium hover:underline">tarihvakfi.org.tr</a>
        </div>
      </section>

      {/* İstatistikler */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { v: stats?.active_volunteers, l: 'Aktif gönüllü', c: 'text-[#059669]' },
            { v: Math.round(stats?.weekly_hours || stats?.monthly_hours || 0), l: 'Bu hafta saat', c: 'text-[#D97706]' },
            { v: stats?.completed_this_week || stats?.completed_tasks, l: 'Tamamlanan iş', c: 'text-[#6D28D9]' },
            { v: stats?.department_count || 8, l: 'Departman', c: 'text-[#2563EB]' },
          ].map((s, i) => (
            <div key={i} className="stat-box">
              <div className={`stat-n ${s.c}`}>{loaded ? <AnimCount target={s.v} /> : '—'}</div>
              <div className="stat-l">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Departmanlar */}
      <section className="py-14 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[22px] font-medium text-center mb-2">Çalışma Alanlarımız</h2>
          <p className="text-[13px] text-[#9CA3AF] text-center mb-8">Gönüllülerimiz 8 farklı departmanda aktif olarak çalışmaktadır</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DEPTS.map(d => (
              <div key={d.id} className="bg-white rounded-[10px] p-5 border border-[#F3F4F6] text-center hover:border-[#E5E7EB] transition-colors">
                <div className="font-medium text-[14px] mb-1">{d.l.split(' ve ')[0]}</div>
                <p className="text-[12px] text-[#9CA3AF] leading-relaxed">{d.desc}</p>
                {deptCounts[d.id] > 0 && <div className="text-[12px] text-[#059669] font-medium mt-2">{deptCounts[d.id]} gönüllü</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl Gönüllü Olurum */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[22px] font-medium text-center mb-8">Nasıl Gönüllü Olurum?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(cms.homepage_steps?.steps || [
              { n: '1', t: 'Kayıt Ol', d: 'Google hesabınız veya e-posta ile hızlıca kayıt olun.' },
              { n: '2', t: 'Onay Bekleyin', d: 'Yönetici hesabınızı inceler ve onaylar.' },
              { n: '3', t: 'Başlayın', d: 'Görev alın, çalışmanızı raporlayın.' },
              { n: '4', t: 'Telegram', d: 'Telefonunuzdan kolayca rapor girin (opsiyonel).' },
            ]).map((s, i) => (
              <div key={i} className="stat-box relative pt-8">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#059669] text-white text-[13px] font-semibold flex items-center justify-center">{s.n}</div>
                <div className="font-medium text-[14px] mb-1">{s.t}</div>
                <p className="text-[12px] text-[#9CA3AF] leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="/auth/" className="btn !w-auto !inline-block !px-8">Gönüllü Ol</a>
          </div>
        </div>
      </section>

      {/* Son Gelişmeler */}
      {anns.length > 0 && (
        <section className="py-14 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-[22px] font-medium text-center mb-8">Son Gelişmeler</h2>
            <div className="space-y-3">
              {anns.map((a, i) => (
                <div key={i} className="bg-white rounded-[10px] p-5 border border-[#F3F4F6]">
                  <div className="font-medium text-[14px]">{a.title}</div>
                  <p className="text-[13px] text-[#6B7280] mt-1.5 leading-relaxed">{a.body?.slice(0, 200)}{a.body?.length > 200 ? '...' : ''}</p>
                  <div className="text-[12px] text-[#C4C4C4] mt-2">{fd(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{background:'linear-gradient(135deg, #064E3B, #059669)'}}>
        <div className="max-w-5xl mx-auto px-4 py-12 text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="font-semibold text-[15px] mb-3">Tarih Vakfı</div>
              <p className="text-[13px] text-white/50 leading-relaxed">Tarihe dair demokratik perspektifi geliştirmeyi amaçlayan bağımsız bir sivil toplum kuruluşu.</p>
              <p className="text-[11px] text-white/30 mt-3">2026 Tarih Vakfı. Tüm hakları saklıdır.</p>
            </div>
            <div>
              <div className="font-medium text-[13px] mb-3 text-white/80">İletişim</div>
              <div className="space-y-1.5 text-[13px] text-white/50">
                <p>Sarıdemir Mah. Ragıp Gümüşpala Cad.<br />Değirmen Sok. No:10, Eminönü/İstanbul</p>
                <p>(212) 522 02 02 – (212) 513 52 35</p>
                <a href="https://tarihvakfi.org.tr" target="_blank" rel="noopener noreferrer" className="inline-block text-[#34D399] hover:underline">tarihvakfi.org.tr</a>
              </div>
            </div>
            <div>
              <div className="font-medium text-[13px] mb-3 text-white/80">Destek Olun</div>
              <p className="text-[13px] text-white/50 mb-3">Tarih Vakfı&apos;nın çalışmalarına destek olmak için Tarih Dostu olabilirsiniz.</p>
              <a href="https://fonzip.com/tarihvakfi/tarih-dostu" target="_blank" rel="noopener noreferrer" className="btn-outline !text-white/80 !border-white/20 hover:!border-white/40 !text-[13px]">Tarih Dostu Ol</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
