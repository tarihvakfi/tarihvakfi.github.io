# Kütüphane arka ucu

Kitap envanteri, raf sayımı, kararlar ve iletişim kayıtları Cloudflare Worker üzerinde çalışır. Yapılandırma:

- D1: `tarih-vakfi-library`
- KV: `PHOTOS` (`dfd21d71f1c046d98c9d11fcea9b0f64`)
- Worker: `tarih-vakfi-library-api`

Gerekli gizli değerler Cloudflare'de tutulur: `LIBRARY_AUTH_PEPPER` ve `RESEND_API_KEY`. Eski ortak şifreler ilk kullanımda eski sunucuda bir kez doğrulanır ve Cloudflare'e yalnızca anahtarlı özeti kaydedilir.

## Dağıtım

```sh
npm install
npm run typecheck
npx wrangler d1 migrations apply tarih-vakfi-library --remote
npx wrangler deploy
```

## Veri aktarımı

Supabase'den alınan JSON dosyalarını D1 aktarımına çevirmek için:

```sh
node tools/import-supabase-data.mjs /yedek/data /tmp/supabase-import.sql
npx wrangler d1 execute tarih-vakfi-library --remote --file /tmp/supabase-import.sql
```

Fotoğraf yedeğini KV toplu aktarım dosyalarına çevirmek için:

```sh
node tools/build-kv-photo-import.mjs /yedek/storage/library-photos /tmp/kv-import
```

Her `photos-*.json` dosyası `npx wrangler kv bulk put DOSYA --binding PHOTOS --remote` komutuyla yüklenir.

## Kabul testi

`tools/smoke.mjs` geçici bir raf ve kitap oluşturur; sayım, fotoğraf, künye onayı, karar verme ve kararı geri alma işlemlerini dener ve geçici kayıtları temizler.
