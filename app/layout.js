import './globals.css';

export const metadata = {
  title: 'Tarih Vakfı — Gönüllü Platformu',
  description: 'Tarih Vakfı gönüllü yönetim sistemi. 1991\'den beri tarihi korumak ve toplumsal tarih bilincini geliştirmek için çalışıyoruz. Arşiv, eğitim, etkinlik, dijital ve daha fazla alanda gönüllü olun.',
  openGraph: {
    title: 'Tarih Vakfı — Gönüllü Platformu',
    description: '1991\'den beri tarihi korumak için birlikte çalışıyoruz. Gönüllü olun, görev alın, ekibe katılın.',
    siteName: 'Tarih Vakfı',
    type: 'website',
    url: 'https://tarihvakfi.github.io',
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
