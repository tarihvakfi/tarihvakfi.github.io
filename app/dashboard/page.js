'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Dashboard from './layout-client';

export default function DashboardPage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session);
      if (data?.session?.provider_token) {
        localStorage.setItem('tarihvakfi_google_token', data.session.provider_token);
      }
      if (!data?.session) {
        window.location.href = '/auth/';
        return;
      }
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.provider_token) {
        localStorage.setItem('tarihvakfi_google_token', session.provider_token);
      }
      if (!session) window.location.href = '/auth/';
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  if (loading || !session) return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50">
      <div className="text-center">
        <div className="text-4xl mb-3">🏛️</div>
        <p className="text-gray-400 text-sm">Yükleniyor...</p>
      </div>
    </div>
  );

  return <Dashboard session={session} />;
}
