'use client';

import { useState, useEffect } from 'react';
import {
  supabase, signInWithGoogle,
  signUpWithEmail, signInWithEmail, resetPassword,
} from '../../lib/supabase';

export default function AuthPage() {
  const [mode, setMode] = useState('main');
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) window.location.href = '/dashboard/';
    });
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const clear = () => { setError(''); setSuccess(''); };

  const handleGoogle = async () => { clear(); const { error } = await signInWithGoogle(); if (error) setError(error.message); };
  const handleEmailLogin = async () => { clear(); setLoading(true); const { error } = await signInWithEmail(email, password); if (error) setError(error.message); else window.location.href = '/dashboard/'; setLoading(false); };
  const handleEmailSignup = async () => { clear(); if (!name.trim()) { setError('İsim gerekli'); return; } setLoading(true); const { error } = await signUpWithEmail(email, password, name); if (error) setError(error.message); else setSuccess('Kayıt başarılı! E-postanıza gelen linke tıklayın.'); setLoading(false); };
  const handleReset = async () => { clear(); setLoading(true); const { error } = await resetPassword(email); if (error) setError(error.message); else setSuccess('Şifre sıfırlama linki gönderildi!'); setLoading(false); };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px]" style={{ padding: '40px 24px' }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-[24px] font-semibold mb-1">Tarih Vakfı</div>
          <div className="text-[13px] text-[#9CA3AF]">Gönüllü yönetim sistemi</div>
        </div>

        {/* Main */}
        {mode === 'main' && (
          <div className="space-y-4">
            <button onClick={handleGoogle}
              className="btn flex items-center justify-center gap-2" style={{ background: '#4285F4' }}>
              <span className="bg-white text-[#4285F4] w-6 h-6 rounded inline-flex items-center justify-center font-bold text-[14px]">G</span>
              Google ile devam et
            </button>
            <div className="text-center text-[12px] text-[#C4C4C4] py-1">veya</div>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">E-posta</label>
                <input type="email" className="inp" placeholder="ornek@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Şifre</label>
                <input type="password" className="inp" placeholder="********" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailLogin()} />
              </div>
            </div>
            <button onClick={handleEmailLogin} disabled={loading} className="btn">{loading ? 'Giriş yapılıyor...' : 'Giriş yap'}</button>
            <div className="text-center text-[13px] text-[#9CA3AF]">
              Hesabın yok mu?{' '}
              <button onClick={() => { clear(); setMode('email-signup'); }} className="text-[#059669] font-medium">Kayıt ol</button>
            </div>
            <div className="text-center">
              <button onClick={() => { clear(); setMode('reset'); }} className="text-[12px] text-[#C4C4C4] hover:text-[#9CA3AF] transition-colors">Şifremi unuttum</button>
            </div>
          </div>
        )}

        {/* Signup */}
        {mode === 'email-signup' && (
          <div className="space-y-4">
            <div className="page-title text-center">Kayıt ol</div>
            <div>
              <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Ad Soyad</label>
              <input className="inp" placeholder="Ad Soyad" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">E-posta</label>
              <input type="email" className="inp" placeholder="ornek@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Şifre</label>
              <input type="password" className="inp" placeholder="En az 6 karakter" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button onClick={handleEmailSignup} disabled={loading} className="btn">{loading ? 'Kaydediliyor...' : 'Kayıt ol'}</button>
            <button onClick={() => { clear(); setMode('main'); }} className="block mx-auto text-[13px] text-[#9CA3AF]">&larr; Geri</button>
          </div>
        )}

        {/* Reset */}
        {mode === 'reset' && (
          <div className="space-y-4">
            <div className="page-title text-center">Şifre sıfırlama</div>
            <div>
              <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">E-posta</label>
              <input type="email" className="inp" placeholder="ornek@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <button onClick={handleReset} disabled={loading} className="btn">{loading ? 'Gönderiliyor...' : 'Sıfırlama linki gönder'}</button>
            <button onClick={() => { clear(); setMode('main'); }} className="block mx-auto text-[13px] text-[#9CA3AF]">&larr; Geri</button>
          </div>
        )}

        {/* Messages */}
        {error && <div className="mt-4 bg-[#FEF2F2] text-[#EF4444] text-[13px] rounded-lg px-4 py-3">{error}</div>}
        {success && <div className="mt-4 bg-[#ECFDF5] text-[#059669] text-[13px] rounded-lg px-4 py-3">{success}</div>}

        <p className="text-center text-[11px] text-[#C4C4C4] mt-6">
          Giriş yaparak gönüllü sözleşmesini kabul edersiniz.
          <br /><a href="/" className="text-[#059669]">&larr; Ana sayfa</a>
        </p>
      </div>
    </div>
  );
}
