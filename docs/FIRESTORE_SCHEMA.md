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

## archiveUnits

PNB gibi arşiv projelerinde kutu/seri/dosya düzeyindeki asıl iş paketleri.

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

- `userUid`: string
- `userEmail`: string
- `taskId`: string
- `projectId`: string
- `archiveUnitId`: string | null
- `summary`: string
- `hours`: number
- `reportDate`: string
- `links`: string[]
- `images`: string[]
- `coworkerUids`: string[]
- `status`: `submitted | revision_needed | approved`
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
