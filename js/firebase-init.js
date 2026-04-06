import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const missingConfigMessage = `Firebase yapılandırması bulunamadı.
Lütfen js/config.firebase.example.js dosyasını js/config.firebase.js olarak kopyalayın ve proje bilgilerinizi ekleyin.`;

let app = null;
let auth = null;
let db = null;
let provider = null;

async function ensureConfigLoaded() {
  if (window.__FIREBASE_CONFIG__) return;
  try {
    await import("./config.firebase.js");
  } catch (error) {
    console.warn("config.firebase.js yüklenemedi.", error);
  }
}

await ensureConfigLoaded();

if (window.__FIREBASE_CONFIG__) {
  app = initializeApp(window.__FIREBASE_CONFIG__);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
} else {
  console.warn(missingConfigMessage);
}

export { app, auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, serverTimestamp, missingConfigMessage };
