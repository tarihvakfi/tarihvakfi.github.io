'use client';

import { useState, useEffect, Component } from 'react';
import { supabase } from '../../lib/supabase';
import Dashboard from './layout-client';

class CatchBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      const msg = this.state.err?.message || '';
      // Decode React #310
      let decoded = msg;
      if (msg.includes('#310')) {
        decoded = 'Objects are not valid as a React child. A component is trying to render a JavaScript object instead of a string/number/element.';
      }
      return (
        <div style={{ padding: 40, fontFamily: 'Inter, system-ui', maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>React Render Hatasi</h2>
          <p style={{ color: '#059669', fontSize: 14, marginBottom: 16 }}>{decoded}</p>
          <pre style={{ fontSize: 11, color: '#666', whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
            {this.state.err?.stack}
          </pre>
          <button onClick={() => this.setState({ err: null })} style={{ marginTop: 16, padding: '8px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Tekrar dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  return (
    <CatchBoundary>
      <Dashboard session={session} />
    </CatchBoundary>
  );
}
