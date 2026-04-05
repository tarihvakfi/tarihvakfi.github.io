# Deployment

## GitHub Pages

1. Repo ayarlarında Pages bölümünü açın.
2. Source olarak `Deploy from a branch` seçin.
3. Branch olarak `main` ve folder olarak `/root` seçin.
4. Yayınlandıktan sonra bağlantılar:
   - `/`
   - `/auth/`
   - `/app/`
   - `/admin/`

## Firebase tarafı

- Authentication > Google aktif
- Authorized domains içinde GitHub Pages domaini ekli
- Firestore rules yayınlandı
- En az bir admin kullanıcı manuel atandı

## Canlıya almadan önce kontrol listesi

- `js/config.firebase.js` repoda commit edilmesin
- Tüm linkler relative path kullansın
- `firestore.rules` yayınlanmış olsun
- İlk test kullanıcılarıyla giriş denensin
- Yetkisiz kullanıcı admin paneline giremesin
- Pending kullanıcı app/admin verilerini göremesin
