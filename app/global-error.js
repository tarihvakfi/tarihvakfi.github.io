'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>Bir hata oluştu</h2>
        <pre style={{ fontSize: 12, color: '#666', whiteSpace: 'pre-wrap', maxWidth: 600, margin: '0 auto', textAlign: 'left', background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
          {error?.message || 'Bilinmeyen hata'}
        </pre>
        <button onClick={reset} style={{ marginTop: 16, padding: '8px 24px', background: '#10B981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Tekrar Dene
        </button>
      </body>
    </html>
  );
}
