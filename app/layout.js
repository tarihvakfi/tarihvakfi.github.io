import './globals.css';

export const metadata = {
  title: 'Tarih Vakfı — Gönüllü Yönetim Sistemi',
  description: 'Gönüllüleri yönet, görev ata, saat takibi yap',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
