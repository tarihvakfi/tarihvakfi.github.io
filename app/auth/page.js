'use client';

import { useState } from 'react';
import {
  signInWithGoogle, signInWithGitHub,
  signUpWithEmail, signInWithEmail, signInWithMagicLink,
  signInWithPhone, verifyPhoneOtp, resetPassword,
} from '../../lib/supabase';

export default function AuthPage() {
  const [mode, setMode] = useState('main'); // main, email-login, email-signup, phone, magic, reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const clear = () => { setError(''); setSuccess(''); };

  // OAuth
  const handleOAuth = async (provider) => {
    clear();
    const fn = provider === 'google' ? signInWithGoogle : signInWithGitHub;
    const { error } = await fn();
    if (error) setError(error.message);
  };

  // Email login
  const handleEmailLogin = async () => {
    clear(); setLoading(true);
    const { error } = await signInWithEmail(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  // Email signup
  const handleEmailSignup = async () => {
    clear();
    if (!name.trim()) { setError('İsim gerekli'); return; }
    setLoading(true);
    const { error } = await signUpWithEmail(email, password, name);
    if (error) setError(error.message);
    else setSuccess('Kayıt başarılı! E-postanıza gelen linke tıklayın.');
    setLoading(false);
  };

  // Magic link
  const handleMagicLink = async () => {
    clear(); setLoading(true);
    const { error } = await signInWithMagicLink(email);
    if (error) setError(error.message);
    else setSuccess('Giriş linki e-postanıza gönderildi! Gelen kutunuzu kontrol edin.');
    setLoading(false);
  };

  // Phone
  const handlePhoneSend = async () => {
    clear();
    if (!phone || phone.length < 10) { setError('Geçerli telefon numarası girin (+90...)'); return; }
    setLoading(true);
    const { error } = await signInWithPhone(phone);
    if (error) setError(error.message);
    else { setOtpSent(true); setSuccess('SMS kodu gönderildi!'); }
    setLoading(false);
  };

  const handlePhoneVerify = async () => {
    clear(); setLoading(true);
    const { error } = await verifyPhoneOtp(phone, otp);
    if (error) setError(error.message);
    setLoading(false);
  };

  // Reset password
  const handleReset = async () => {
    clear(); setLoading(true);
    const { error } = await resetPassword(email);
    if (error) setError(error.message);
    else setSuccess('Şifre sıfırlama linki gönderildi!');
    setLoading(false);
  };

  const inputCls = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all";
  const btnPrimary = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-3 px-4 text-sm transition-all active:scale-[0.98] disabled:opacity-50";
  const btnBack = "text-sm text-gray-400 hover:text-gray-600 transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-stone-50 to-stone-100">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏛️</div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
            Tarih Vakfı
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gönüllü Yönetim Sistemi</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* ─── ANA EKRAN ─── */}
          {mode === 'main' && (
            <div className="space-y-3">
              {/* Google — En üstte, herkes kullanır */}
              <button onClick={() => handleOAuth('google')}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl py-3 px-4 text-sm border border-gray-200 transition-all active:scale-[0.98]">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google ile Devam Et
              </button>

              {/* Telefon */}
              <button onClick={() => { clear(); setMode('phone'); }}
                className="w-full flex items-center justify-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl py-3 px-4 text-sm transition-all active:scale-[0.98]">
                📱 Telefon ile Giriş
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-gray-100"></div>
                <span className="text-xs text-gray-300">veya</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>

              {/* Email login/signup */}
              <button onClick={() => { clear(); setMode('email-login'); }}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl py-3 text-sm transition-all active:scale-[0.98]">
                ✉️ E-posta ile Giriş
              </button>

              <button onClick={() => { clear(); setMode('email-signup'); }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-3 text-sm transition-all active:scale-[0.98]">
                Yeni Kayıt Ol
              </button>

              {/* Magic Link */}
              <button onClick={() => { clear(); setMode('magic'); }}
                className="w-full text-gray-400 hover:text-gray-600 text-xs text-center py-2 transition-colors">
                💌 Şifresiz giriş linki gönder
              </button>

              {/* GitHub */}
              <button onClick={() => handleOAuth('github')}
                className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 text-xs py-2 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub ile giriş (geliştiriciler)
              </button>
            </div>
          )}

          {/* ─── E-POSTA GİRİŞ ─── */}
          {mode === 'email-login' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-center mb-2">✉️ E-posta ile Giriş</h3>
              <input className={inputCls} type="email" placeholder="E-posta adresiniz" value={email} onChange={e=>setEmail(e.target.value)} />
              <input className={inputCls} type="password" placeholder="Şifreniz" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleEmailLogin()} />
              <button onClick={handleEmailLogin} disabled={loading} className={btnPrimary}>{loading?'Giriş yapılıyor...':'Giriş Yap'}</button>
              <button onClick={()=>{clear();setMode('reset')}} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">Şifremi unuttum</button>
              <button onClick={()=>{clear();setMode('main')}} className={btnBack}>← Geri</button>
            </div>
          )}

          {/* ─── E-POSTA KAYIT ─── */}
          {mode === 'email-signup' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-center mb-2">Yeni Kayıt</h3>
              <input className={inputCls} placeholder="Ad Soyad" value={name} onChange={e=>setName(e.target.value)} />
              <input className={inputCls} type="email" placeholder="E-posta adresiniz" value={email} onChange={e=>setEmail(e.target.value)} />
              <input className={inputCls} type="password" placeholder="Şifre (en az 6 karakter)" value={password} onChange={e=>setPassword(e.target.value)} />
              <button onClick={handleEmailSignup} disabled={loading} className={btnPrimary}>{loading?'Kaydediliyor...':'Kayıt Ol'}</button>
              <button onClick={()=>{clear();setMode('main')}} className={btnBack}>← Geri</button>
            </div>
          )}

          {/* ─── TELEFON ─── */}
          {mode === 'phone' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-center mb-2">📱 Telefon ile Giriş</h3>
              {!otpSent ? (
                <>
                  <input className={inputCls} type="tel" placeholder="+90 5XX XXX XX XX" value={phone} onChange={e=>setPhone(e.target.value)} />
                  <p className="text-xs text-gray-400">Telefon numaranıza SMS ile doğrulama kodu gönderilecek.</p>
                  <button onClick={handlePhoneSend} disabled={loading} className={btnPrimary}>{loading?'Gönderiliyor...':'Kod Gönder'}</button>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 text-center">{phone} numarasına kod gönderildi</p>
                  <input className={`${inputCls} text-center text-lg tracking-widest`} maxLength={6} placeholder="● ● ● ● ● ●" value={otp} onChange={e=>setOtp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handlePhoneVerify()} />
                  <button onClick={handlePhoneVerify} disabled={loading} className={btnPrimary}>{loading?'Doğrulanıyor...':'Doğrula'}</button>
                  <button onClick={()=>{setOtpSent(false);setOtp('')}} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">Tekrar gönder</button>
                </>
              )}
              <button onClick={()=>{clear();setOtpSent(false);setMode('main')}} className={btnBack}>← Geri</button>
            </div>
          )}

          {/* ─── MAGIC LINK ─── */}
          {mode === 'magic' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-center mb-2">💌 Şifresiz Giriş</h3>
              <p className="text-xs text-gray-400 text-center">E-postanıza tek kullanımlık giriş linki gönderilecek. Şifre gerekmez.</p>
              <input className={inputCls} type="email" placeholder="E-posta adresiniz" value={email} onChange={e=>setEmail(e.target.value)} />
              <button onClick={handleMagicLink} disabled={loading} className={btnPrimary}>{loading?'Gönderiliyor...':'Giriş Linki Gönder'}</button>
              <button onClick={()=>{clear();setMode('main')}} className={btnBack}>← Geri</button>
            </div>
          )}

          {/* ─── ŞİFRE SIFIRLAMA ─── */}
          {mode === 'reset' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-center mb-2">🔑 Şifre Sıfırlama</h3>
              <input className={inputCls} type="email" placeholder="E-posta adresiniz" value={email} onChange={e=>setEmail(e.target.value)} />
              <button onClick={handleReset} disabled={loading} className={btnPrimary}>{loading?'Gönderiliyor...':'Sıfırlama Linki Gönder'}</button>
              <button onClick={()=>{clear();setMode('email-login')}} className={btnBack}>← Geri</button>
            </div>
          )}

          {/* Error / Success */}
          {error && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5">{error}</div>}
          {success && <div className="mt-3 bg-green-50 text-green-700 text-sm rounded-xl px-4 py-2.5">{success}</div>}
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-4">
          Giriş yaparak Tarih Vakfı gönüllü sözleşmesini kabul etmiş olursunuz.
        </p>
      </div>
    </div>
  );
}
