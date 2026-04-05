import { auth, db, onAuthStateChanged, serverTimestamp, missingConfigMessage } from "../js/firebase-init.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { showMessage, setHTML } from "../js/helpers.js";
import { renderAnnouncementCard, renderReportCard, renderTaskCard, renderUserCard } from "../js/ui.js";

const profileCard = document.getElementById("profileCard");
const tasksList = document.getElementById("tasksList");
const reportsList = document.getElementById("reportsList");
const announcementsList = document.getElementById("announcementsList");
const reportForm = document.getElementById("reportForm");

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function loadTasks(email) {
  const q = query(collection(db, "tasks"), where("assignedToEmail", "==", email), orderBy("createdAt", "desc"), limit(20));
  const snap = await getDocs(q);
  if (snap.empty) {
    tasksList.innerHTML = `<p class="empty">Henüz görev bulunamadı.</p>`;
    return;
  }
  tasksList.innerHTML = snap.docs.map((d) => renderTaskCard(d.data())).join("");
}

async function loadReports(uid) {
  const q = query(collection(db, "reports"), where("userUid", "==", uid), orderBy("createdAt", "desc"), limit(20));
  const snap = await getDocs(q);
  if (snap.empty) {
    reportsList.innerHTML = `<p class="empty">Henüz rapor bulunmuyor.</p>`;
    return;
  }
  reportsList.innerHTML = snap.docs.map((d) => renderReportCard(d.data())).join("");
}

async function loadAnnouncements() {
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(10));
  const snap = await getDocs(q);
  if (snap.empty) {
    announcementsList.innerHTML = `<p class="empty">Henüz duyuru yok.</p>`;
    return;
  }
  announcementsList.innerHTML = snap.docs.map((d) => renderAnnouncementCard(d.data())).join("");
}

if (!auth || !db) {
  profileCard.innerHTML = `<p class="empty">${missingConfigMessage}</p>`;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../auth/";
      return;
    }

    const profile = await loadProfile(user.uid);
    if (!profile) {
      profileCard.innerHTML = `<p class="empty">Profil bulunamadı. Önce başvuru formunu doldurun.</p>`;
      return;
    }

    if (profile.status === "blocked") {
      profileCard.innerHTML = `<p class="empty">Erişiminiz engellenmiş.</p>`;
      return;
    }

    if (profile.status !== "approved") {
      profileCard.innerHTML = `${renderUserCard(profile)}<p class="muted">Hesabınız henüz onaylanmadı. Durum: ${profile.status}</p>`;
      return;
    }

    profileCard.innerHTML = renderUserCard(profile);
    await Promise.all([
      loadTasks(user.email || ""),
      loadReports(user.uid),
      loadAnnouncements()
    ]);
  });
}

reportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth?.currentUser || !db) {
    showMessage("reportMessage", "Giriş bilgisi bulunamadı.", "danger");
    return;
  }

  try {
    await addDoc(collection(db, "reports"), {
      userUid: auth.currentUser.uid,
      userEmail: auth.currentUser.email || "",
      taskId: document.getElementById("taskId").value.trim(),
      summary: document.getElementById("summary").value.trim(),
      hours: Number(document.getElementById("hours").value || 0),
      reportDate: document.getElementById("reportDate").value,
      status: "submitted",
      reviewerUid: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    reportForm.reset();
    document.getElementById("hours").value = 1;
    showMessage("reportMessage", "Rapor kaydedildi.");
    await loadReports(auth.currentUser.uid);
  } catch (error) {
    console.error(error);
    showMessage("reportMessage", "Rapor kaydedilirken hata oluştu.", "danger");
  }
});
