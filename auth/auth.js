import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, serverTimestamp, missingConfigMessage } from "../js/firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { showMessage } from "../js/helpers.js";
import { renderUserCard } from "../js/ui.js";

const googleSignInBtn = document.getElementById("googleSignInBtn");
const applicationForm = document.getElementById("applicationForm");
const emailInput = document.getElementById("email");
const fullNameInput = document.getElementById("fullName");
const phoneInput = document.getElementById("phone");
const departmentInput = document.getElementById("department");
const notesInput = document.getElementById("notes");
const pendingProfile = document.getElementById("pendingProfile");
const editProfileBtn = document.getElementById("editProfileBtn");

const steps = {
  loading: document.getElementById("stepLoading"),
  signIn: document.getElementById("stepSignIn"),
  application: document.getElementById("stepApplication"),
  pending: document.getElementById("stepPending"),
  blocked: document.getElementById("stepBlocked"),
  redirect: document.getElementById("stepRedirect")
};

function showStep(name) {
  Object.values(steps).forEach(el => el.classList.remove("active"));
  if (steps[name]) steps[name].classList.add("active");
}

document.querySelectorAll("[id^=signOutBtn]").forEach(btn => {
  btn.addEventListener("click", async () => { if (!auth) return; await signOut(auth); });
});

googleSignInBtn?.addEventListener("click", async () => {
  if (!auth || !provider) { alert(missingConfigMessage); return; }
  try {
    googleSignInBtn.disabled = true;
    googleSignInBtn.textContent = "Giriş yapılıyor...";
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    showMessage("authStatus", "Giriş sırasında hata oluştu.", "danger");
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48" style="flex-shrink:0"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.03 24.03 0 0 0 0 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Google ile giriş yap';
  }
});

applicationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth?.currentUser || !db) { showMessage("applicationMessage", "Önce giriş yapmalısınız.", "danger"); return; }
  const current = auth.currentUser;
  try {
    const ref = doc(db, "users", current.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { fullName: fullNameInput.value.trim(), phone: phoneInput.value.trim(), department: departmentInput.value, notes: notesInput.value.trim(), updatedAt: serverTimestamp(), lastSeenAt: serverTimestamp() });
    } else {
      await setDoc(ref, { uid: current.uid, fullName: fullNameInput.value.trim(), email: current.email || "", phone: phoneInput.value.trim(), department: departmentInput.value, role: "volunteer", status: "pending", notes: notesInput.value.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastSeenAt: serverTimestamp() });
    }
    const latest = await loadUserProfile(current);
    routeUser(latest, current);
  } catch (error) { console.error(error); showMessage("applicationMessage", "Başvuru kaydedilirken hata oluştu.", "danger"); }
});

editProfileBtn?.addEventListener("click", () => { showStep("application"); });

async function checkPreregistration(authUser) {
  if (!db || !authUser?.email) return null;
  var email = authUser.email.toLowerCase();
  var preRef = doc(db, "preregistered", email);
  var preSnap = await getDoc(preRef);
  if (!preSnap.exists()) return null;
  var preData = preSnap.data();
  var userData = { uid: authUser.uid, fullName: preData.fullName || authUser.displayName || "", email: email, phone: preData.phone || "", department: preData.department || "", role: preData.role || "volunteer", status: "approved", notes: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastSeenAt: serverTimestamp() };
  await setDoc(doc(db, "users", authUser.uid), userData);
  await deleteDoc(preRef);
  return userData;
}

async function loadUserProfile(authUser) {
  if (!db || !authUser) return null;
  var ref = doc(db, "users", authUser.uid);
  var snap = await getDoc(ref);
  if (!snap.exists()) {
    var preData = await checkPreregistration(authUser);
    if (preData) return preData;
    return null;
  }
  var data = snap.data();
  emailInput.value = data.email || authUser.email || "";
  fullNameInput.value = data.fullName || authUser.displayName || "";
  phoneInput.value = data.phone || "";
  departmentInput.value = data.department || "";
  notesInput.value = data.notes || "";
  return data;
}

function routeUser(userDoc, authUser) {
  if (!authUser) { showStep("signIn"); return; }
  if (!userDoc) { emailInput.value = authUser.email || ""; fullNameInput.value = fullNameInput.value || authUser.displayName || ""; showStep("application"); return; }
  var status = userDoc.status || "pending";
  if (status === "blocked") { showStep("blocked"); return; }
  if (status === "approved") { showStep("redirect"); setTimeout(function(){ window.location.href = "../app/"; }, 600); return; }
  pendingProfile.innerHTML = renderUserCard(userDoc);
  showStep("pending");
}

if (!auth) { showStep("signIn"); showMessage("authStatus", missingConfigMessage, "danger"); }
else { onAuthStateChanged(auth, async function(user) {
  if (!user) { showStep("signIn"); return; }
  var userDoc = await loadUserProfile(user);
  routeUser(userDoc, user);
}); }
