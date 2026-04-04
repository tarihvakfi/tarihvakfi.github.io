'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AuthPage from './auth/page';
import Dashboard from './dashboard/layout-client';

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session);
      // Google provider_token'i persist et
      if (data?.session?.provider_token) {
        localStorage.setItem('tarihvakfi_google_token', data.session.provider_token);
      }
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.provider_token) {
        localStorage.setItem('tarihvakfi_google_token', session.provider_token);
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50">
      <div className="text-center">
        <div className="text-4xl mb-3">🏛️</div>
        <p className="text-gray-400 text-sm">Yükleniyor...</p>
      </div>
    </div>
  );

  if (!session) return <AuthPage />;
  return <Dashboard session={session} />;
}
