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
window.__SHEETSYNC_URL__ = "https://script.google.com/macros/s/AKfycbzSGPTbBnrfhSDdw_iOrfxAfGLYp08qpZwl8rqZSb90o_x5cUK7Eo1HYnrjk-hvJWE/exec";

window.__APP_CONFIG__ = {
  appName: "Tarih Vakfı Gönüllü Takip Sistemi"
};
