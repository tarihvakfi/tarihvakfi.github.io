import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, serverTimestamp, missingConfigMessage } from "../js/firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { showMessage } from "../js/helpers.js";
import { renderUserCard } from "../js/ui.js";

const googleSignInBtn = document.getElementById("googleSignInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const applicationForm = document.getElementById("applicationForm");
const statePanel = document.getElementById("statePanel");
const authStatus = document.getElementById("authStatus");
const emailInput = document.getElementById("email");
const fullNameInput = document.getElementById("fullName");
const phoneInput = document.getElementById("phone");
const departmentInput = document.getElementById("department");
const notesInput = document.getElementById("notes");

function updateStatePanel(userDoc, authUser) {
  if (!authUser) {
    statePanel.innerHTML = "<p>Giriş yapılmadı.</p>";
    return;
  }

  if (!userDoc) {
    statePanel.innerHTML = `
      <div class="list-card">
        <strong>Yeni kullanıcı</strong>
        <p>Başvuru formunu doldurup kaydedin.</p>
      </div>
    `;
    return;
  }

  statePanel.innerHTML = renderUserCard(userDoc);
}

async function loadUserProfile(authUser) {
  if (!db || !authUser) return null;
  const ref = doc(db, "users", authUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  emailInput.value = data.email || authUser.email || "";
  fullNameInput.value = data.fullName || authUser.displayName || "";
  phoneInput.value = data.phone || "";
  departmentInput.value = data.department || "";
  notesInput.value = data.notes || "";
  return data;
}

googleSignInBtn?.addEventListener("click", async () => {
  if (!auth || !provider) {
    alert(missingConfigMessage);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    showMessage("authStatus", "Giriş sırasında hata oluştu.", "danger");
  }
});

signOutBtn?.addEventListener("click", async () => {
  if (!auth) return;
  await signOut(auth);
});

applicationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth?.currentUser || !db) {
    showMessage("applicationMessage", "Önce giriş yapmalısınız.", "danger");
    return;
  }

  const current = auth.currentUser;
  const userData = {
    uid: current.uid,
    fullName: fullNameInput.value.trim(),
    email: current.email || "",
    phone: phoneInput.value.trim(),
    department: departmentInput.value,
    role: "volunteer",
    status: "pending",
    notes: notesInput.value.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp()
  };

  try {
    const ref = doc(db, "users", current.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        fullName: userData.fullName,
        phone: userData.phone,
        department: userData.department,
        notes: userData.notes,
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp()
      });
    } else {
      await setDoc(ref, userData);
    }
    showMessage("applicationMessage", "Başvuru bilgileri kaydedildi. Durumunuz pending olarak yönetici onayını bekliyor.");
    const latest = await loadUserProfile(current);
    updateStatePanel(latest, current);
  } catch (error) {
    console.error(error);
    showMessage("applicationMessage", "Başvuru kaydedilirken hata oluştu.", "danger");
  }
});

if (!auth) {
  showMessage("authStatus", missingConfigMessage, "danger");
  statePanel.innerHTML = "<p>Firebase yapılandırması eksik.</p>";
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      authStatus.textContent = "Henüz giriş yapılmadı.";
      signOutBtn.classList.add("hidden");
      googleSignInBtn.classList.remove("hidden");
      emailInput.value = "";
      updateStatePanel(null, null);
      return;
    }

    authStatus.textContent = `Giriş yapıldı: ${user.email}`;
    emailInput.value = user.email || "";
    fullNameInput.value = fullNameInput.value || user.displayName || "";
    googleSignInBtn.classList.add("hidden");
    signOutBtn.classList.remove("hidden");

    const userDoc = await loadUserProfile(user);
    updateStatePanel(userDoc, user);
  });
}
