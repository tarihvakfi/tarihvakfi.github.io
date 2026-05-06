import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const missingConfigMessage = `Firebase yapılandırması bulunamadı.
Lütfen js/config.firebase.example.js dosyasını js/config.firebase.js olarak kopyalayın ve proje bilgilerinizi ekleyin.`;

let app = null;
let auth = null;
let provider = null;

if (window.__FIREBASE_CONFIG__) {
  app = initializeApp(window.__FIREBASE_CONFIG__);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
} else {
  console.warn(missingConfigMessage);
}

export { app, auth, provider, signInWithPopup, signOut, onAuthStateChanged, missingConfigMessage };
