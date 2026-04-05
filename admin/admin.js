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
  limit,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { showMessage } from "../js/helpers.js";
import { renderReportCard, renderUserCard } from "../js/ui.js";

const pendingUsers = document.getElementById("pendingUsers");
const userDirectory = document.getElementById("userDirectory");
const reportsReviewList = document.getElementById("reportsReviewList");
const taskForm = document.getElementById("taskForm");
const announcementForm = document.getElementById("announcementForm");

function pendingUserCard(user, uid) {
  return `
    <div class="list-card">
      <div>${renderUserCard(user)}</div>
      <div class="admin-actions">
        <button class="btn btn-primary" data-action="approve" data-uid="${uid}">Onayla</button>
        <button class="btn btn-secondary" data-action="block" data-uid="${uid}">Engelle</button>
      </div>
    </div>
  `;
}

async function getCurrentProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function loadPending(currentProfile) {
  let qRef = query(collection(db, "users"), where("status", "==", "pending"), limit(30));
  const snap = await getDocs(qRef);
  const rows = snap.docs.filter((d) => {
    const data = d.data();
    if (currentProfile.role === "admin") return true;
    return data.department === currentProfile.department;
  });

  if (!rows.length) {
    pendingUsers.innerHTML = `<p class="empty">Bekleyen başvuru yok.</p>`;
    return;
  }
  pendingUsers.innerHTML = rows.map((d) => pendingUserCard(d.data(), d.id)).join("");
}

async function loadUsers(currentProfile) {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50)));
  const rows = snap.docs.filter((d) => {
    const data = d.data();
    if (currentProfile.role === "admin") return true;
    return data.department === currentProfile.department;
  });
  if (!rows.length) {
    userDirectory.innerHTML = `<p class="empty">Kullanıcı bulunamadı.</p>`;
    return;
  }
  userDirectory.innerHTML = rows.map((d) => renderUserCard(d.data())).join("");
}

async function loadReports(currentProfile) {
  const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(30)));
  let rows = snap.docs;
  if (currentProfile.role !== "admin") {
    const usersSnap = await getDocs(query(collection(db, "users"), where("department", "==", currentProfile.department)));
    const allowedUid = new Set(usersSnap.docs.map((d) => d.id));
    rows = rows.filter((d) => allowedUid.has(d.data().userUid));
  }
  if (!rows.length) {
    reportsReviewList.innerHTML = `<p class="empty">İncelenecek rapor bulunmuyor.</p>`;
    return;
  }
  reportsReviewList.innerHTML = rows.map((d) => renderReportCard(d.data())).join("");
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !db) return;

  const uid = button.dataset.uid;
  const action = button.dataset.action;
  try {
    if (action === "approve") {
      await updateDoc(doc(db, "users", uid), { status: "approved", updatedAt: serverTimestamp() });
    } else if (action === "block") {
      await updateDoc(doc(db, "users", uid), { status: "blocked", updatedAt: serverTimestamp() });
    }
    button.closest(".list-card")?.remove();
  } catch (error) {
    console.error(error);
    alert("İşlem başarısız oldu.");
  }
});

taskForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth?.currentUser || !db) {
    showMessage("taskMessage", "Giriş bilgisi bulunamadı.", "danger");
    return;
  }
  try {
    await addDoc(collection(db, "tasks"), {
      title: document.getElementById("taskTitle").value.trim(),
      description: document.getElementById("taskDescription").value.trim(),
      department: document.getElementById("taskDepartment").value.trim(),
      assignedToUid: null,
      assignedToEmail: document.getElementById("taskAssignedToEmail").value.trim(),
      dueDate: document.getElementById("taskDueDate").value || null,
      priority: document.getElementById("taskPriority").value,
      status: "open",
      createdByUid: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    taskForm.reset();
    showMessage("taskMessage", "Görev oluşturuldu.");
  } catch (error) {
    console.error(error);
    showMessage("taskMessage", "Görev oluşturulurken hata oluştu.", "danger");
  }
});

announcementForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth?.currentUser || !db) {
    showMessage("announcementMessage", "Giriş bilgisi bulunamadı.", "danger");
    return;
  }
  try {
    await addDoc(collection(db, "announcements"), {
      title: document.getElementById("announcementTitle").value.trim(),
      body: document.getElementById("announcementBody").value.trim(),
      audience: document.getElementById("announcementAudience").value,
      department: document.getElementById("announcementDepartment").value.trim(),
      createdByUid: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    announcementForm.reset();
    showMessage("announcementMessage", "Duyuru yayınlandı.");
  } catch (error) {
    console.error(error);
    showMessage("announcementMessage", "Duyuru oluşturulurken hata oluştu.", "danger");
  }
});

if (!auth || !db) {
  pendingUsers.innerHTML = `<p class="empty">${missingConfigMessage}</p>`;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../auth/";
      return;
    }

    const profile = await getCurrentProfile(user.uid);
    if (!profile || !["admin", "coordinator"].includes(profile.role) || profile.status !== "approved") {
      pendingUsers.innerHTML = `<p class="empty">Bu alan için yetkiniz yok.</p>`;
      return;
    }

    await Promise.all([
      loadPending(profile),
      loadUsers(profile),
      loadReports(profile)
    ]);
  });
}
