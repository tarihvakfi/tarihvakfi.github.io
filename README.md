# 🏛️ Tarih Vakfı — Gönüllü Yönetim Sistemi

Vakıf gönüllülerini yönetmek için web uygulaması.
`tarihvakfi.github.io` adresinde ücretsiz çalışır.

## Özellikler

- **5 Giriş Yöntemi** — Google, Telefon SMS, E-posta, Magic Link, GitHub
- **3 Rol** — Yönetici, Koordinatör, Gönüllü
- **8 Departman** — Arşiv, Eğitim, Etkinlik, Dijital, Rehberlik, Yayın, Bağış, İdari
- **Görev Yönetimi** — Oluştur, ata, öncelik, son tarih, durum takibi
- **Saat Takibi** — Kayıt, onay/red, departman bazlı filtreleme
- **Vardiya Planı** — Haftalık, gün bazlı, bugünkü vardiyalar
- **Duyurular** — Sabitlenebilir, departmana özel
- **Başvuru Sistemi** — Kabul/mülakat/red
- **Bildirimler** — Gerçek zamanlı (Supabase Realtime)

## Maliyet: 0 TL

| Servis | Maliyet |
|--------|---------|
| GitHub Pages hosting | Ücretsiz |
| Supabase (DB + Auth) | Ücretsiz (50K kullanıcıya kadar) |
| Google OAuth | Ücretsiz |
| Domain (tarihvakfi.github.io) | Ücretsiz |
| SSL (https) | Otomatik, ücretsiz |

---

## Kurulum (Adım Adım)

### Adım 1 — Supabase Projesi (5 dk)

1. [supabase.com](https://supabase.com) → "Start your project" → Ücretsiz proje oluştur
2. Proje açıldığında → **SQL Editor** → `supabase-schema.sql` dosyasının tamamını yapıştır → **Run**
3. **Settings → API** sayfasından kopyala:
   - `Project URL` (ör: `https://abcdef.supabase.co`)
   - `anon / public` key

### Adım 2 — Google Auth Aç (3 dk)

1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. "Create Credentials" → "OAuth Client ID" → Web application
3. "Authorized redirect URIs" → Ekle:
   ```
   https://YOUR_PROJECT.supabase.co/auth/v1/callback
   ```
4. Client ID ve Client Secret'ı kopyala
5. Supabase Dashboard → **Authentication → Providers → Google** → Enable → yapıştır

### Adım 3 — GitHub Repo Oluştur (2 dk)

1. GitHub'da yeni repo: **`tarihvakfi.github.io`**
   - Bu özel isim → otomatik `https://tarihvakfi.github.io` URL'si verir
   - Farklı isim kullanırsan `https://KULLANICI.github.io/REPO-ADI/` olur

2. Projeyi push'la:
   ```bash
   cd tarih-vakfi
   git init
   git add .
   git commit -m "ilk commit"
   git remote add origin https://github.com/KULLANICI/tarihvakfi.github.io.git
   git push -u origin main
   ```

### Adım 4 — GitHub Secrets Ekle (2 dk)

GitHub repo → **Settings → Secrets and variables → Actions** → "New repository secret":

| Secret Adı | Değer |
|------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdef.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

### Adım 5 — GitHub Pages Aç (1 dk)

GitHub repo → **Settings → Pages**:
- Source: **"GitHub Actions"** seç (klasik değil!)

### Adım 6 — Deploy (Otomatik)

Push yaptığında GitHub Actions otomatik çalışır:
1. `npm install`
2. `npm run build` (static export)
3. `out/` klasörünü GitHub Pages'e deploy eder

İlk deploy ~2 dakika sürer. Sonra `https://tarihvakfi.github.io` adresinde site canlı!

### Adım 7 — İlk Admin (1 dk)

1. Siteye git → Google ile giriş yap
2. Supabase → SQL Editor:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'senin@gmail.com';
   ```
3. Sayfayı yenile → Yönetici paneli açılır

---

## Lokal Geliştirme

```bash
npm install
cp .env.local.example .env.local
# .env.local'e Supabase URL ve key yaz
npm run dev
# → http://localhost:3000
```

## Özel Domain (Opsiyonel)

Eğer `tarihvakfi.org` gibi bir domain alırsan:

1. GitHub repo → Settings → Pages → "Custom domain" → `tarihvakfi.org` yaz
2. Domain sağlayıcında DNS ayarı:
   ```
   CNAME  →  tarihvakfi.github.io
   ```
3. "Enforce HTTPS" kutusunu işaretle

## Proje Yapısı

```
tarih-vakfi/
├── .github/workflows/deploy.yml  ← Otomatik deploy
├── app/
│   ├── globals.css
│   ├── layout.js
│   ├── page.js                   ← Auth yönlendirme
│   ├── auth/page.js              ← 5 giriş yöntemi
│   └── dashboard/layout-client.js ← Tüm yönetim sayfaları
├── lib/supabase.js               ← 50+ API fonksiyonu
├── public/.nojekyll
├── supabase-schema.sql           ← Veritabanı şeması
├── next.config.js                ← Static export ayarı
├── .gitignore
├── .env.local.example
└── package.json
```

## Veritabanı

| Tablo | Açıklama |
|-------|----------|
| profiles | Kullanıcılar, roller, departmanlar |
| tasks | Görevler, atamalar, öncelikler |
| hour_logs | Saat kayıtları, onay durumu |
| shifts | Vardiya planları |
| announcements | Duyurular |
| applications | Gönüllü başvuruları |
| notifications | Bildirimler |

3 Trigger: Otomatik profil, saat onay bildirimi, görev atama bildirimi

## Telegram Bot Kurulumu

### Adim 1 — Bot Olustur
1. Telegram'da **@BotFather**'a gidin
2. `/newbot` komutunu gonderin
3. Bot adi: `Tarih Vakfi Gonullu`
4. Username: `tarihvakfi_bot`
5. API token'i kopyalayin

### Adim 2 — Supabase Edge Function Deploy
```bash
supabase functions deploy telegram-webhook --project-ref PROJE_REF
```

### Adim 3 — Secrets Ayarla
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=BOT_TOKEN_BURAYA
supabase secrets set TELEGRAM_WEBHOOK_SECRET=RASTGELE_BIR_ANAHTAR
```

### Adim 4 — Webhook Kaydet
```bash
curl "https://api.telegram.org/botBOT_TOKEN/setWebhook?url=https://SUPABASE_URL/functions/v1/telegram-webhook&secret_token=WEBHOOK_SECRET"
```

### Kullanim
- Gonulluler: Profil → Telegram Bagla → kodu bot'a gonderin
- `geldim` → giris yap
- `cikiyorum` → cikis yap + rapor yaz
- `/durum` → haftalik ozet
- `/yardim` → komut listesi

## Lisans

MIT
