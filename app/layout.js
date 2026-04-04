import './globals.css';

export const metadata = {
  title: 'Tarih Vakfı — Gönüllü Platformu',
  description: 'Tarih Vakfı gönüllü yönetim sistemi. Arşiv, eğitim, etkinlik, dijital ve daha fazla alanda gönüllü olarak katkıda bulunun.',
  openGraph: {
    title: 'Tarih Vakfı — Gönüllü Platformu',
    description: 'Tarihi korumak için birlikte çalışıyoruz. Gönüllü olun, görev alın, ekibe katılın.',
    siteName: 'Tarih Vakfı',
    type: 'website',
  },
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
