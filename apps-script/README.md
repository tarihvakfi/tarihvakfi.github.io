# Apps Script kurulumu

Bu klasördeki `.gs` dosyalarını yeni bir Google Apps Script projesine kopyalayın.

## Gerekli sheet sekmeleri

- `MailQueue`
- `Logs`
- `WeeklySummary`

## İlk satır başlık önerileri

### MailQueue
- createdAt
- type
- recipient
- subject
- body
- status
- metadata

### Logs
- timestamp
- email
- action
- detail

### WeeklySummary
Bu sekme script tarafından doldurulur.

## Kurulum

1. Yeni bir Google Spreadsheet oluşturun.
2. Yukarıdaki sekmeleri açın.
3. Apps Script projesi ekleyin.
4. Bu klasördeki dosyaları yapıştırın.
5. `createTriggers()` fonksiyonunu bir kez manuel çalıştırın.
6. Yetkileri onaylayın.
