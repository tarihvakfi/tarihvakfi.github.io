# Firestore Şeması

Bu uygulama GitHub Pages üzerinde çalışan statik bir arayüzdür; operasyonel veri Cloud Firestore koleksiyonlarında tutulur.

## users

Doküman kimliği: Firebase `uid`; Excel/ön kayıt ile eklenen kişiler için geçici olarak `manual_{email}` kullanılabilir.

- `uid`: string
- `fullName`: string
- `email`: string
- `phone`: string
- `department`: string
- `role`: `volunteer | coordinator | admin`
- `status`: `pending | approved | blocked`
- `notes`: string
- `skillsText`: string
- `coordinatorNotes`: string
- `stakeholder`: map, PNB importundan gelen paydaş alanları
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `lastSeenAt`: timestamp
- `lastReportAt`: timestamp | null — en son rapor gönderim zamanı; gönüllü rapor oluştururken aynı batch içinde `serverTimestamp()` ile yazılır. "Aktif / yavaşlayan / durmuş" sınıflandırmasının temelidir.
- `reportCount7d`: number — son 7 günde gönderilen rapor sayısı. Rapor yazarken client-side artırılır, pencere dışına çıktığında sıfırlanır.
- `reportCount30d`: number — son 30 günde gönderilen rapor sayısı. Aynı mantıkla güncellenir.
- `counterWindowStart`: timestamp | null — `reportCount7d` / `reportCount30d` pencerelerinin başlangıcı. Yedi/otuz günden eski olduğunda sayaçlar sıfırlanır.
- `rhythm`: `"regular" | "casual" | "burst" | null` — gönüllünün kendi beyan ettiği çalışma temposu. Aktiflik sınıflandırmasını (`active / slow / stalled`) bu alan belirler.
  - `regular`: haftalık düzende çalışır; standart 14/28 günlük eşikler uygulanır.
  - `casual`: fırsat buldukça katılır; hiçbir zaman otomatik "durmuş" olarak işaretlenmez, ayrı bir "Serbest tempo" kovasında gösterilir.
  - `burst`: yoğun bloklar hâlinde çalışır; 30/45 günlük daha geniş eşikler uygulanır.
  - `null`: varsayılan; `regular` gibi değerlendirilir.

### Gönüllü profili — opsiyonel zenginleştirme alanları

Aşağıdaki alanlar koordinatör/admin tarafından paydaş ve zaman çizelgesi Excel'lerinden `tools/volunteer_enrichment.py` ile doldurulur. Tümü opsiyoneldir; var olan bir değer yeni import sırasında üzerine yazılmaz, yalnızca boşluk doldurulur.

- `specialty`: string[] — sabit kod listesinden çekilir: `dijitallestirme`, `osmanlica`, `teknik_destek`, `web_altyapi`, `gonullu_koordinasyonu`, `arsivcilik`, `dokumantasyon_sistemi`, `gorsel_isitsel_envanter`, `mimari_projeler_envanteri`, `dijital_envanter`, `gecmis_envanter_ayiklama`. Tipografi varyantları kabul edilmez; yeni bir uzmanlık eklenmesi için kod listesinin güncellenmesi gerekir.
- `availabilityDays`: string[] — slot kodları: `mon-am`, `mon-pm`, `tue-am`, `tue-pm`, `wed-am`, `wed-pm`, `thu-am`, `thu-pm`, `fri-am`, `fri-pm`. Excel'deki `x` işaretli yarım günlere karşılık gelir.
- `profession`: string — paydaş Meslek alanı.
- `university`: string — paydaş Üniversite alanı.
- `city`: string — yalnızca `istanbul` veya `ankara`. Başka bir değer görünürse import bunu inceleme bayrağına taşır, doğrudan yazmaz.
- `projectExpectation`: string — paydaş "Projeden Beklentisi" alanının ham metni.

`Gücü (1-5)`, `İlgisi (1-5)`, `Güç/ilgi seviyesi`, `Tarih vakfındaki Rolü`, `Projede Rolü` paydaş kolonları rapor-öncelikli modelle ilgisiz oldukları için içe aktarılmaz.

Yazma yetkisi: `specialty` ve `availabilityDays` yalnızca admin tarafından düzenlenebilir; gönüllüler değişiklik talebini koordinatöre iletir. Okuma yetkisi: kişi kendi alanlarını, koordinatör/admin ise tüm gönüllülerin alanlarını okuyabilir (departman sınırı yoktur, çünkü uzmanlık eşleştirmesi departmanlar arası çalışır).

## archiveUnits

PNB gibi arşiv projelerinde kutu/seri/dosya düzeyindeki asıl iş paketleri. Diğer proje türleri genel `tasks` ve `reports` akışıyla yönetilebilir; arşiv benzeri yeni projeler aynı modeli `projectId` ile tekrar kullanabilir.

## projects

Tek yönetim ortamındaki çalışma başlıkları. PNB ilk ayrıntılı kayıt olarak `projects/pnb` dokümanına yazılır.

- `id`: string
- `title`: string
- `type`: string, ör. `archive_digitization`, `event`, `publication`, `education`
- `status`: `active | paused | done | archived`
- `department`: string
- `description`: string
- `archiveUnitCount`: number
- `fileCount`: number
- `documentCount`: number
- `pageCount`: number
- `peopleCount`: number
- `availabilitySlotCount`: number
- `communicationPlanCount`: number
- `importedAt`: timestamp
- `updatedAt`: timestamp

- `projectId`: string, PNB için `pnb`
- `projectTitle`: string
- `title`: string
- `sourceCode`: string
- `seriesNo`: string
- `boxNo`: string
- `fileCount`: number
- `documentCount`: number
- `pageCount`: number
- `materialType`: string
- `notes`: string
- `startDate`: string | null
- `updatedDate`: string | null
- `endDate`: string | null
- `assignedNames`: string[]
- `assignedToUids`: string[]
- `assignedToEmails`: string[]
- `completedFileCount`: number
- `completedDocumentCount`: number
- `completedPageCount`: number
- `remainingFileCount`: number
- `remainingDocumentCount`: number
- `remainingPageCount`: number
- `status`: `not_started | assigned | in_progress | review | done | blocked`
- `priority`: `low | medium | high`
- `dueDate`: string | null
- `blockerNote`: string
- `latestReportAt`: timestamp | null
- `lastActivityAt`: timestamp | null — rapor-öncelikli akışta yazılan birincil aktivite damgası. `latestReportAt` ile eş tutulur (eski ekranlar bozulmasın diye).
- `lastReporterId`: string | null — son raporu yazan gönüllünün uid'i.
- `lastReporterName`: string | null — son raporu yazan gönüllünün adı, denormalize edilmiş (yönetim listelerinde join'siz okunabilsin diye).
- `lastReportNotePreview`: string | null — son raporun ilk 80 karakteri. "Bu birimde son ne oldu?" sorusuna tek bakışta cevap verir.
- `digitized`: boolean — kutunun içeriği taranıp Drive'a taşındığında `true`. Ankara'daki gönüllülerin görebileceği kutuları (`digitized == true`) filtrelemek için kullanılır. Rapor modalindeki opsiyonel onay kutusu sadece `digitized == false` olduğunda görünür ve işaretlendiğinde true'ya çevrilir.
- `createdByVolunteerId`: string | null — "liste dışı" yoluyla bir gönüllü tarafından oluşturulduğunda kayıt eden gönüllünün uid'i. Bu doküman koordinatör tarafından gözden geçirilene kadar `status == "pending_review"` ile başlar.
- `sourceIdentifier`: string — typeahead'in eşlemek için baktığı insan-okur kaynak kodu (ör. `48 / 120.5 / K75`).
- `priority`: `low | medium | high` — typeahead sıralamasında ve karta ait pillerde kullanılır.
- `suitableFor`: string[] — bu kutuda hangi uzmanlıkların işe yaradığı. Gönüllünün `users/{uid}.specialty[]` alanı ile kesişirse typeahead sonuçlarında bir miktar yukarı çekilir.
- `city`: string — kutunun fiziksel olarak bulunduğu şehir; `istanbul` veya `ankara`. Ankara'daki gönüllüler yalnızca `digitized == true` olan kutuları görebileceği için bu alan filtreleme için kullanılır.
- `contentDescription`: string — typeahead için aranan ana metin alanı; arama sonuçlarında ikinci satırda 60 karakterle kesilerek gösterilir.
- `materialType`: string — fotoğraf, defter, evrak vb. malzeme türü; arama metnine dahildir.
- `folderCount`: number | null — klasör sayısı (rapor-öncelikli null-aware sayaç).
- `projectId`: string — birden fazla projenin paylaşılan altyapı üzerinde yaşamasına izin verir.
- `sheetUrl`: string | null — bu birime bağlı Google Sheets / LibreOffice / Excel online çalışma dosyası URL'si. Koordinatörler "Ayarla" panelinden ekleyebilir; gönüllüler karttan ve kanal görünümünden "📊 Sheet'i aç" butonuyla erişir. İleride Apps Script ile Firestore'a otomatik olarak düzenleme mesajları yazabilir (şu an manuel).
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `importedAt`: timestamp

## tasks

İnsanlara atanan yapılabilir görevler. PNB iş paketine bağlanabilir.

- `title`: string
- `description`: string
- `department`: string
- `projectId`: string
- `archiveUnitId`: string | null
- `assignedToUid`: string | null
- `assignedToEmail`: string | null
- `dueDate`: string | null
- `priority`: `low | medium | high`
- `status`: `open | in_progress | done | cancelled`
- `createdByUid`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp

## reports

Gönüllü iş raporları. PNB arşiv birimi ile ilişkilendirilebilir.

- `userUid`: string — eski şema (rapor-öncelikli akış da bu alanı `volunteerId` ile aynı değere doldurur).
- `userEmail`: string
- `taskId`: string
- `projectId`: string
- `archiveUnitId`: string | null — eski isim, rapor-öncelikli akış aynı değeri `unitId` olarak da yazar.
- `summary`: string — serbest metin notu (hibrit rapor yapısının "özgür" kısmı).
- `hours`: number
- `pagesDone`: number | null — bu raporla tamamlanan sayfa sayısı. Arşiv birimine bağlı hibrit raporlarda zorunlu, diğer durumlarda opsiyonel.
- `workStatus`: `in_progress | unit_done | blocked` — gönüllünün seçtiği yapılandırılmış durum etiketi. Arşiv birimi `status`'unu güncellemek için kullanılır.
- `source`: `quick | detailed | report_first | coordinator_logged | system` — formun hangi varyantından geldiği. Kullanıcı deneyimi analizi için.

#### Rapor-öncelikli akışta eklenen alanlar

Aşağıdaki alanlar `Rapor Ver` modalindeki yeni şemayı tanımlar; eski alanlar listelerin/kuralların bozulmaması için doldurulmaya devam eder.

- `unitId`: string — `archiveUnits/{id}` (eski `archiveUnitId` ile aynı değer).
- `unitSnapshot`: map — `{ sourceIdentifier, contentDescription }`. Birim sonradan yeniden adlandırılır veya silinirse rapor okunabilir kalsın diye denormalize edilir.
- `note`: string — gönüllünün serbest metin notu, ≤ 500 karakter.
- `effort`: `small | medium | large` — segmentli buton seçimi (`< 1 saat` / `1-3 saat` / `3+ saat`).
- `status`: `in_progress | review | done | blocked` — birim için yeni durum.
- `reportedSubstatus`: `started | ongoing | review | done | blocked` — UX nüansı: "Başladım" ve "Devam ediyor" aynı `status: "in_progress"`'e gider ama burada ayırt edilir; analitik için kullanılır.
- `url`: string | null — opsiyonel link.
- `volunteerId`: string — gönüllünün uid'i (kuralların yeni şemayla doğrulanmasını mümkün kılar).
- `volunteerName`: string — denormalize edilmiş ad.
- `reportDate`: string
- `links`: string[]
- `images`: string[]
- `coworkerUids`: string[]
- `status`: `submitted | revision_needed | approved` — koordinatör inceleme durumu (`workStatus`'tan farklıdır: bu admin tarafıdır).
- `feedback`: map[]
- `reviewerUid`: string | null
- `createdAt`: timestamp
- `updatedAt`: timestamp

## projectPeople

PNB paydaş/kişi listesinin hesap oluşturmak zorunda olmayan kayıtları. İletişim bilgisi içerdiği için yalnızca koordinatör/admin erişimine açıktır.

- `projectId`: string
- `fullName`: string
- `normalizedName`: string
- `email`: string
- `phone`: string
- `profession`: string
- `university`: string
- `educationDepartment`: string
- `city`: string
- `foundationRole`: string
- `projectRole`: string
- `expectation`: string
- `power`: number
- `interest`: number
- `stakeholderLevel`: string
- `sourceRow`: number
- `importedAt`: timestamp
- `updatedAt`: timestamp

## availability

Gönüllü uygunluk çizelgesinden normalize edilen haftalık slotlar.

- `projectId`: string
- `personName`: string
- `normalizedName`: string
- `email`: string
- `userUid`: string
- `topics`: string[]
- `slots`: map[]; `label`, `day`, `slot`
- `slotCount`: number
- `sourceRow`: number
- `importedAt`: timestamp
- `updatedAt`: timestamp

## communicationPlans

Proje iletişim matrisinden gelen toplantı/rapor rutinleri.

- `projectId`: string
- `title`: string
- `goal`: string
- `channel`: string
- `frequency`: string
- `meetingPlan`: string
- `participants`: string
- `owner`: string
- `deliverables`: string
- `format`: string
- `sourceRow`: number

## announcements

- `title`: string
- `body`: string
- `audience`: `all | volunteers | coordinators | department`
- `department`: string
- `createdByUid`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp

## notifications

- `toUid`: string
- `type`: string
- `message`: string
- `tab`: string
- `read`: boolean
- `createdAt`: timestamp

## preregistered

Ön kayıt / Excel import ile e-posta bazlı onay kayıtları. Kullanıcı Google ile giriş yaptığında gerçek `users/{uid}` kaydına taşınır.

## activityLogs

- `actorUid`: string
- `actorEmail`: string
- `action`: string
- `targetType`: string
- `targetId`: string
- `metadata`: map
- `createdAt`: timestamp
