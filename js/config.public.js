// Public landing page configuration.
// The landing page is fully static (GitHub Pages) and reads all live
// project data from a Google Apps Script web app that proxies the
// shared Google Sheet. No Firebase, no login, no Firestore.
//
// To rotate the endpoint:
//   1. Open apps-script.google.com → Tarih Vakfı SheetSync project
//   2. Deploy → Manage Deployments → New Deployment
//   3. Type: Web App, Execute as: <foundation account>, Access: Anyone
//   4. Copy the /exec URL below.
//
// 2026-08-07: endpoint rotated to a fresh deployment (…1IKi) to leave
// behind the stale/poisoned instances of the previous one (…hvJWE).
window.__SHEETSYNC_URL__ = "https://script.google.com/macros/s/AKfycbzYlAT_pkft3ePBZ12ABD1zPw6nyK-NnotzOBAfzaLdlblezSFLzCnbCUfODjBo1IKi/exec";

window.__APP_CONFIG__ = {
  appName: "Tarih Vakfı Gönüllü Emek Günlüğü"
};
