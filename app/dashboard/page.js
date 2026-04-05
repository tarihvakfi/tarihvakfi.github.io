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
    <div className="flex items-center justify-center min-h-screen bg-[#FAFAFA]">
      <div className="space-y-3 w-48"><div className="skeleton h-3 w-full"/><div className="skeleton h-3 w-3/4"/><div className="skeleton h-3 w-1/2"/></div>
    </div>
  );

  return <Dashboard session={session} />;
}
