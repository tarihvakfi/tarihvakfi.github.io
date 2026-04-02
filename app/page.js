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
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
