import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, serverTimestamp, missingConfigMessage } from "../js/firebase-init.js";
import {
  collection, addDoc, doc, getDoc, getDocs,
  query, orderBy, where, limit, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { escapeHTML, formatDate, badge } from "../js/helpers.js";

let currentUser = null;
let currentProfile = null;

const loadingState = document.getElementById("loadingState");
const tabBar = document.getElementById("tabBar");
const headerUser = document.getElementById("headerUser");
const signOutBtn = document.getElementById("signOutBtn");

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("hidden", c.id !== "tab-" + name));
}
tabBar?.addEventListener("click", (e) => { const tab = e.target.closest(".tab"); if (tab) switchTab(tab.dataset.tab); });
signOutBtn?.addEventListener("click", async () => { if (auth) await signOut(auth); window.location.href = "../auth/"; });

function renderProfile(p) {
  return '<div class="list-card"><strong>' + escapeHTML(p.fullName||"-") + '</strong><div>' + escapeHTML(p.email||"-") + '</div><div>Departman: ' + escapeHTML(p.department||"-") + '</div><div>Rol: ' + badge(p.role||"volunteer") + '</div><div>Durum: ' + badge(p.status||"pending") + '</div></div>';
}
function renderTask(t) {
  var pc = t.priority==="high"?"priority-high":t.priority==="low"?"priority-low":"priority-medium";
  return '<div class="task-card"><strong>' + escapeHTML(t.title||"-") + '</strong>' + (t.description?'<div>'+escapeHTML(t.description)+'</div>':'') + '<div class="task-meta"><span class="'+pc+'">' + escapeHTML(t.priority||"medium") + '</span><span>' + escapeHTML(t.department||"-") + '</span>' + (t.dueDate?'<span>Son: '+formatDate(t.dueDate)+'</span>':'') + '<span>' + escapeHTML(t.status||"open") + '</span></div></div>';
}
function renderReport(r) {
  return '<div class="report-card"><strong>' + escapeHTML(r.summary||"-") + '</strong><div style="font-size:.85rem;color:var(--muted);margin-top:.25rem;">' + escapeHTML(r.hours||0) + ' saat &middot; ' + formatDate(r.reportDate) + ' &middot; ' + escapeHTML(r.status||"submitted") + (r.userEmail?' &middot; '+escapeHTML(r.userEmail):'') + '</div></div>';
}
function renderAnnouncement(a) {
  return '<div class="announce-card"><strong>' + escapeHTML(a.title||"-") + '</strong><div>' + escapeHTML(a.body||"") + '</div><div class="announce-date">' + formatDate(a.createdAt) + ' &middot; ' + escapeHTML(a.audience||"all") + '</div></div>';
}
function renderPendingUser(d, uid) {
  return '<div class="user-card" id="user-' + uid + '"><div class="user-info"><strong>' + escapeHTML(d.fullName||"-") + '</strong><small>' + escapeHTML(d.email||"-") + ' &middot; ' + escapeHTML(d.department||"-") + ' &middot; ' + escapeHTML(d.phone||"-") + '</small>' + (d.notes?'<div style="font-size:.85rem;margin-top:.25rem;">'+escapeHTML(d.notes)+'</div>':'') + '</div><div class="user-actions"><button class="btn btn-approve btn-sm" data-action="approve" data-uid="' + uid + '">Onayla</button><button class="btn btn-block btn-sm" data-action="block" data-uid="' + uid + '">Engelle</button></div></div>';
}
function renderUserRow(d, uid) {
  return '<div class="user-row" id="urow-' + uid + '"><div><strong>' + escapeHTML(d.fullName||"-") + '</strong><div style="font-size:.85rem;color:var(--muted);">' + escapeHTML(d.email||"-") + ' &middot; ' + escapeHTML(d.department||"-") + '</div></div><select data-role-uid="' + uid + '"><option value="volunteer"' + (d.role==="volunteer"?" selected":"") + '>Gönüllü</option><option value="coordinator"' + (d.role==="coordinator"?" selected":"") + '>Koordinatör</option><option value="admin"' + (d.role==="admin"?" selected":"") + '>Yönetici</option></select><select data-status-uid="' + uid + '"><option value="pending"' + (d.status==="pending"?" selected":"") + '>Beklemede</option><option value="approved"' + (d.status==="approved"?" selected":"") + '>Onaylı</option><option value="blocked"' + (d.status==="blocked"?" selected":"") + '>Engelli</option></select><button class="btn btn-primary btn-sm" data-save-uid="' + uid + '">Kaydet</button></div>';
}

async function loadHome() {
  document.getElementById("profileCard").innerHTML = renderProfile(currentProfile);
  var snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(3)));
  document.getElementById("homeAnnouncements").innerHTML = snap.empty ? '<p class="empty">Duyuru yok.</p>' : snap.docs.map(function(d){return renderAnnouncement(d.data())}).join("");
}
async function loadTasks() {
  var isA = currentProfile.role==="admin"||currentProfile.role==="coordinator";
  var q = isA ? query(collection(db,"tasks"),orderBy("createdAt","desc"),limit(50)) : query(collection(db,"tasks"),where("assignedToEmail","==",currentUser.email||""),orderBy("createdAt","desc"),limit(20));
  var snap = await getDocs(q);
  document.getElementById("tasksList").innerHTML = snap.empty ? '<p class="empty">Görev bulunamadı.</p>' : snap.docs.map(function(d){return renderTask(d.data())}).join("");
}
async function loadReports() {
  var isA = currentProfile.role==="admin"||currentProfile.role==="coordinator";
  var q;
  if (isA) { q = query(collection(db,"reports"),orderBy("createdAt","desc"),limit(50)); document.getElementById("reportsTitle").textContent = "Tüm raporlar"; }
  else { q = query(collection(db,"reports"),where("userUid","==",currentUser.uid),orderBy("createdAt","desc"),limit(20)); }
  var snap = await getDocs(q);
  document.getElementById("reportsList").innerHTML = snap.empty ? '<p class="empty">Rapor bulunmuyor.</p>' : snap.docs.map(function(d){return renderReport(d.data())}).join("");
}
async function loadAnnouncements() {
  var snap = await getDocs(query(collection(db,"announcements"),orderBy("createdAt","desc"),limit(20)));
  document.getElementById("announcementsList").innerHTML = snap.empty ? '<p class="empty">Duyuru yok.</p>' : snap.docs.map(function(d){return renderAnnouncement(d.data())}).join("");
}
async function loadPending() {
  var snap = await getDocs(query(collection(db,"users"),where("status","==","pending"),limit(30)));
  var el = document.getElementById("pendingUsers");
  var pendingTab = document.querySelector('[data-tab="pending"]');
  if (snap.empty) { el.innerHTML = '<p class="empty">Bekleyen başvuru yok.</p>'; return; }
  el.innerHTML = snap.docs.map(function(d){return renderPendingUser(d.data(),d.id)}).join("");
  if (pendingTab) { var ex = pendingTab.querySelector(".count-badge"); if (ex) ex.remove(); pendingTab.insertAdjacentHTML("beforeend", '<span class="count-badge">' + snap.size + '</span>'); }
}
async function loadUsers() {
  var snap = await getDocs(query(collection(db,"users"),orderBy("createdAt","desc"),limit(100)));
  document.getElementById("userDirectory").innerHTML = snap.empty ? '<p class="empty">Kullanıcı bulunamadı.</p>' : snap.docs.map(function(d){return renderUserRow(d.data(),d.id)}).join("");
}

document.addEventListener("click", async function(e) {
  var actionBtn = e.target.closest("button[data-action]");
  if (actionBtn && db) {
    var uid = actionBtn.dataset.uid; var action = actionBtn.dataset.action;
    try { actionBtn.disabled = true; actionBtn.textContent = "...";
      await updateDoc(doc(db,"users",uid), { status: action==="approve"?"approved":"blocked", updatedAt: serverTimestamp() });
      var card = document.getElementById("user-"+uid);
      if (card) { card.style.opacity = "0.4"; card.innerHTML = '<div class="user-info"><strong>' + (action==="approve"?"Onaylandı":"Engellendi") + '</strong></div>'; }
    } catch(err) { console.error(err); alert("Hata: "+err.message); actionBtn.disabled = false; }
    return;
  }
  var saveBtn = e.target.closest("button[data-save-uid]");
  if (saveBtn && db) {
    var uid2 = saveBtn.dataset.saveUid; var row = document.getElementById("urow-"+uid2);
    var role = row.querySelector('[data-role-uid="'+uid2+'"]').value;
    var status = row.querySelector('[data-status-uid="'+uid2+'"]').value;
    try { saveBtn.disabled = true; saveBtn.textContent = "...";
      await updateDoc(doc(db,"users",uid2), { role: role, status: status, updatedAt: serverTimestamp() });
      saveBtn.textContent = "OK"; setTimeout(function(){ saveBtn.textContent = "Kaydet"; saveBtn.disabled = false; }, 1500);
    } catch(err) { console.error(err); alert("Hata: "+err.message); saveBtn.textContent = "Kaydet"; saveBtn.disabled = false; }
  }
});

document.getElementById("taskForm")?.addEventListener("submit", async function(e) {
  e.preventDefault(); if (!currentUser||!db) return;
  try { await addDoc(collection(db,"tasks"), { title: document.getElementById("taskTitle").value.trim(), description: document.getElementById("taskDescription").value.trim(), department: document.getElementById("taskDepartment").value, assignedToUid: null, assignedToEmail: document.getElementById("taskAssignedToEmail").value.trim(), dueDate: document.getElementById("taskDueDate").value||null, priority: document.getElementById("taskPriority").value, status: "open", createdByUid: currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    e.target.reset(); document.getElementById("taskMessage").textContent = "Görev oluşturuldu!"; setTimeout(function(){document.getElementById("taskMessage").textContent=""},3000); loadTasks();
  } catch(err) { console.error(err); document.getElementById("taskMessage").textContent = "Hata: "+err.message; }
});

document.getElementById("reportForm")?.addEventListener("submit", async function(e) {
  e.preventDefault(); if (!currentUser||!db) return;
  try { await addDoc(collection(db,"reports"), { userUid: currentUser.uid, userEmail: currentUser.email||"", taskId: document.getElementById("taskId").value.trim(), summary: document.getElementById("summary").value.trim(), hours: Number(document.getElementById("hours").value||0), reportDate: document.getElementById("reportDate").value, status: "submitted", reviewerUid: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    e.target.reset(); document.getElementById("hours").value = 1; document.getElementById("reportMessage").textContent = "Rapor kaydedildi!"; setTimeout(function(){document.getElementById("reportMessage").textContent=""},3000); loadReports();
  } catch(err) { console.error(err); document.getElementById("reportMessage").textContent = "Hata: "+err.message; }
});

document.getElementById("announcementForm")?.addEventListener("submit", async function(e) {
  e.preventDefault(); if (!currentUser||!db) return;
  try { await addDoc(collection(db,"announcements"), { title: document.getElementById("announcementTitle").value.trim(), body: document.getElementById("announcementBody").value.trim(), audience: document.getElementById("announcementAudience").value, department: "", createdByUid: currentUser.uid, createdAt: serverTimestamp() });
    e.target.reset(); document.getElementById("announcementMessage").textContent = "Duyuru yayınlandı!"; setTimeout(function(){document.getElementById("announcementMessage").textContent=""},3000); loadAnnouncements();
  } catch(err) { console.error(err); document.getElementById("announcementMessage").textContent = "Hata: "+err.message; }
});

if (!auth||!db) { loadingState.innerHTML = '<p class="empty">'+missingConfigMessage+'</p>'; }
else { onAuthStateChanged(auth, async function(user) {
  if (!user) { window.location.href = "../auth/"; return; }
  currentUser = user;
  var snap = await getDoc(doc(db,"users",user.uid));
  if (!snap.exists()||snap.data().status!=="approved") { window.location.href = "../auth/"; return; }
  currentProfile = snap.data();
  var isA = currentProfile.role==="admin"||currentProfile.role==="coordinator";
  headerUser.textContent = currentProfile.fullName||user.email;
  if (isA) { document.querySelectorAll(".admin-tab").forEach(function(t){t.classList.remove("hidden")}); document.getElementById("adminTaskForm")?.classList.remove("hidden"); document.getElementById("adminAnnouncementForm")?.classList.remove("hidden"); }
  loadingState.classList.add("hidden"); tabBar.classList.remove("hidden");
  await loadHome(); loadTasks(); loadReports(); loadAnnouncements();
  if (isA) { loadPending(); loadUsers(); }
}); }
