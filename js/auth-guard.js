import { auth, onAuthStateChanged, missingConfigMessage } from "./firebase-init.js";

export function requireSignIn(redirectPath = "../auth/") {
  return new Promise((resolve) => {
    if (!auth) {
      alert(missingConfigMessage);
      resolve(null);
      return;
    }
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = redirectPath;
        resolve(null);
        return;
      }
      resolve(user);
    });
  });
}
