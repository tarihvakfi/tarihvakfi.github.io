'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setHasRecoverySession(!!data?.session);
        setLoading(false);
      }
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasRecoverySession(!!session);
      }
      if (event === 'SIGNED_OUT') {
        setHasRecoverySession(false);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const submit = async () => {
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalı.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess('Şifreniz güncellendi. Şimdi hesabınıza giriş yapabilirsiniz.');
      setPassword('');
      setConfirmPassword('');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(180deg,_#f6f5f1_0%,_#ffffff_55%,_#eef7f2_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center">
        <div className="grid w-full gap-6 overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/90 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur md:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-[#17352f] px-6 py-8 text-white md:px-10 md:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(253,224,71,0.18),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(110,231,183,0.18),_transparent_35%)]" />
            <div className="relative space-y-5">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">
                Hesap Guvenligi
              </span>
              <div>
                <p className="text-sm text-emerald-100/80">Tarih Vakfi</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Yeni sifreni belirle
                </h1>
              </div>
              <p className="max-w-md text-sm leading-7 text-white/75 md:text-base">
                E-postadaki sifre sifirlama baglantisindan geldikten sonra burada yeni sifreni guvenli
                sekilde ayarlayabilirsin.
              </p>
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/65">Ipuclari</p>
                <div className="mt-4 space-y-3 text-sm text-white/78">
                  <p>En az 8 karakter kullan.</p>
                  <p>Buyuk-kucuk harf, rakam ve farkli bir sembol eklersen hesap daha guvenli olur.</p>
                  <p>Eski sifreni tekrar kullanmaman iyi olur.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 md:px-10 md:py-12">
            <div className="mx-auto max-w-md space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Sifre Yenileme</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Hesabina tekrar erisim sagla</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Baglantiyi acinca kurtarma oturumu otomatik taninir. Gerekirse e-postadaki linke tekrar
                  tiklayabilirsin.
                </p>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-5 text-sm text-slate-500">
                  Kurtarma oturumu kontrol ediliyor...
                </div>
              ) : hasRecoverySession ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Yeni sifre</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input-field !rounded-2xl !border-stone-200 !py-3 pr-14"
                        placeholder="En az 8 karakter"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && submit()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400"
                      >
                        {showPassword ? 'Gizle' : 'Goster'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Yeni sifre tekrar</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field !rounded-2xl !border-stone-200 !py-3"
                      placeholder="Sifreyi tekrar yaz"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && submit()}
                    />
                  </div>

                  <button onClick={submit} disabled={saving} className="btn-primary w-full !rounded-2xl !py-3 disabled:opacity-50">
                    {saving ? 'Guncelleniyor...' : 'Sifremi Guncelle'}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                  Gecerli bir kurtarma oturumu bulunamadi. E-postadaki sifirlama linkini tekrar acabilir veya
                  giris ekranindan yeni bir sifirlama e-postasi isteyebilirsin.
                </div>
              )}

              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <a href="/auth/" className="font-semibold text-emerald-700 hover:text-emerald-800">
                  Giris ekranina don
                </a>
                <a href="/" className="text-slate-400 hover:text-slate-600">
                  Ana sayfa
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
