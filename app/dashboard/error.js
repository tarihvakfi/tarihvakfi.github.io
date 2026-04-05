'use client';

export default function DashboardError({ error, reset }) {
  return (
    <div style={{ padding: 40, fontFamily: 'Inter, system-ui', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 12 }}>Dashboard hatasi</h2>
      <pre style={{ fontSize: 12, color: '#666', whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        {error?.message}
        {'\n\n'}
        {error?.stack}
      </pre>
      <button onClick={reset} style={{ padding: '8px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        Tekrar dene
      </button>
    </div>
  );
}
