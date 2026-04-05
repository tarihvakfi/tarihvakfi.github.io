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
      if (!data?.session) {
        window.location.href = '/auth/';
        return;
      }
      setLoading(false);
    });
  }, []);

  if (loading || !session) return <p>Yukleniyor...</p>;

  return <Dashboard session={session} />;
}
