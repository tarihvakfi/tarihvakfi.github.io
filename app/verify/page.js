'use client';

import { useState } from 'react';
import { verifyCertificate } from '../../lib/supabase';

const MO = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const fdf = d => { if (!d) return ''; const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const TYPES = { participation:'Katılım Belgesi', thanks:'Teşekkür Belgesi', achievement:'Başarı Belgesi', period:'Dönem Sertifikası', special:'Özel Takdir Belgesi' };

export default function VerifyPage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-check from URL
  if (typeof window !== 'undefined' && !code && !result) {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) { setCode(c); verify(c); }
  }

  async function verify(c) {
    const q = c || code;
    if (!q.trim()) return;
    setLoading(true); setError(''); setResult(null);
    const { data, error: err } = await verifyCertificate(q.trim());
    if (err || !data) setError('Belge bulunamadı.');
    else setResult(data);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏛️</div>
          <h1 className="text-xl font-bold" style={{fontFamily:"'Playfair Display',serif"}}>Tarih Vakfı</h1>
          <p className="text-sm text-gray-400">Belge Doğrulama</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex gap-2">
            <input className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500" placeholder="Belge no veya doğrulama kodu" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && verify()} />
            <button onClick={() => verify()} disabled={loading} className="bg-emerald-600 text-white font-semibold px-5 py-3 rounded-xl">{loading ? '...' : 'Doğrula'}</button>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 text-center">❌ {error}</div>}

          {result && (
            <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
              <div className="text-center text-emerald-700 font-bold text-lg">✅ Bu belge geçerlidir</div>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">Belge No:</span> <b>{result.certificate_number}</b></div>
                <div><span className="text-gray-500">Kişi:</span> <b>{result.profiles?.display_name}</b></div>
                <div><span className="text-gray-500">Tür:</span> {TYPES[result.type] || result.title}</div>
                <div><span className="text-gray-500">Tarih:</span> {fdf(result.created_at)}</div>
                {result.department && <div><span className="text-gray-500">Departman:</span> {result.department}</div>}
                {result.total_days > 0 && <div><span className="text-gray-500">Çalışma:</span> {result.total_days} gün, {Math.round(result.total_hours)} saat</div>}
                <div><span className="text-gray-500">Düzenleyen:</span> Tarih Vakfı</div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-4">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfaya Dön</a>
        </div>
      </div>
    </div>
  );
}
