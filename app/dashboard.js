import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, serverTimestamp, missingConfigMessage } from "../js/firebase-init.js";
import { collection, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, where, limit, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { escapeHTML, formatDate, badge } from "../js/helpers.js";

let currentUser = null;
let currentProfile = null;
let reportDocs = {};
const loadingState = document.getElementById("loadingState");
const tabBar = document.getElementById("tabBar");
const headerUser = document.getElementById("headerUser");
const signOutBtn = document.getElementById("signOutBtn");

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("hidden", c.id !== "tab-" + name));
}
tabBar?.addEventListener("click", (e) => { var t = e.target.closest(".tab"); if (t) switchTab(t.dataset.tab); });
signOutBtn?.addEventListener("click", async () => { if (auth) await signOut(auth); window.location.href = "../auth/"; });

function parseLines(val) { return (val || "").split("\n").map(l => l.trim()).filter(l => l); }
function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }

function renderProfile(p) { return '<div class="list-card"><strong>'+escapeHTML(p.fullName||"-")+'</strong><div>'+escapeHTML(p.email||"-")+'</div><div>Departman: '+escapeHTML(p.department||"-")+'</div><div>Rol: '+badge(p.role||"volunteer")+'</div><div>Durum: '+badge(p.status||"pending")+'</div></div>'; }
function renderTask(t) { var pc = t.priority==="high"?"priority-high":t.priority==="low"?"priority-low":"priority-medium"; return '<div class="task-card"><strong>'+escapeHTML(t.title||"-")+'</strong>'+(t.description?'<div>'+escapeHTML(t.description)+'</div>':'')+'<div class="task-meta"><span class="'+pc+'">'+escapeHTML(t.priority||"medium")+'</span><span>'+escapeHTML(t.department||"-")+'</span>'+(t.dueDate?'<span>Son: '+formatDate(t.dueDate)+'</span>':'')+'<span>'+escapeHTML(t.status||"open")+'</span></div></div>'; }

function renderReport(report, docId) {
  var links = (report.links || []).filter(function(l){return l});
  var images = (report.images || []).filter(function(i){return i});
  var canEdit = report.userUid === (currentUser ? currentUser.uid : "");
  var html = '<div class="report-card" data-report-id="'+docId+'">';
  html += '<div class="report-header"><strong>'+escapeHTML(report.taskId || "Görev belirtilmedi")+'</strong>';
  if (canEdit) html += '<div class="report-actions"><button class="btn btn-secondary btn-sm" data-edit-report="'+docId+'">Düzenle</button><button class="btn btn-block btn-sm" data-delete-report="'+docId+'">Sil</button></div>';
  html += '</div>';
  html += '<div style="margin-top:.35rem;">'+escapeHTML(report.summary||"-")+'</div>';
  html += '<div style="font-size:.85rem;color:var(--muted);margin-top:.35rem;">'+escapeHTML(report.hours||0)+' saat &middot; '+formatDate(report.reportDate)+' &middot; '+escapeHTML(report.status||"submitted")+(report.userEmail?' &middot; '+escapeHTML(report.userEmail):'')+'</div>';
  if (links.length) { html += '<div class="report-links">'; links.forEach(function(l){ html += '<a href="'+escapeHTML(l)+'" target="_blank" rel="noopener">'+escapeHTML(l.length>60?l.substring(0,60)+"...":l)+'</a>'; }); html += '</div>'; }
  if (images.length) { html += '<div class="report-images">'; images.forEach(function(i){ html += '<a href="'+escapeHTML(i)+'" target="_blank" rel="noopener"><img src="'+escapeHTML(i)+'" alt="Rapor görseli" loading="lazy" /></a>'; }); html += '</div>'; }
  html += '</div>';
  return html;
}

function renderAnnouncement(a) { return '<div class="announce-card"><strong>'+escapeHTML(a.title||"-")+'</strong><div>'+escapeHTML(a.body||"")+'</div><div class="announce-date">'+formatDate(a.createdAt)+' &middot; '+escapeHTML(a.audience||"all")+'</div></div>'; }
function renderPendingUser(d,uid) { return '<div class="user-card" id="user-'+uid+'"><div class="user-info"><strong>'+escapeHTML(d.fullName||"-")+'</strong><small>'+escapeHTML(d.email||"-")+' &middot; '+escapeHTML(d.department||"-")+' &middot; '+escapeHTML(d.phone||"-")+'</small>'+(d.notes?'<div style="font-size:.85rem;margin-top:.25rem;">'+escapeHTML(d.notes)+'</div>':'')+'</div><div class="user-actions"><button class="btn btn-approve btn-sm" data-action="approve" data-uid="'+uid+'">Onayla</button><button class="btn btn-block btn-sm" data-action="block" data-uid="'+uid+'">Engelle</button></div></div>'; }
function renderUserRow(d,uid) { return '<div class="user-row" id="urow-'+uid+'"><div><strong>'+escapeHTML(d.fullName||"-")+'</strong><div style="font-size:.85rem;color:var(--muted);">'+escapeHTML(d.email||"-")+' &middot; '+escapeHTML(d.department||"-")+'</div></div><select data-role-uid="'+uid+'"><option value="volunteer"'+(d.role==="volunteer"?" selected":"")+'>Gönüllü</option><option value="coordinator"'+(d.role==="coordinator"?" selected":"")+'>Koordinatör</option><option value="admin"'+(d.role==="admin"?" selected":"")+'>Yönetici</option></select><select data-status-uid="'+uid+'"><option value="pending"'+(d.status==="pending"?" selected":"")+'>Beklemede</option><option value="approved"'+(d.status==="approved"?" selected":"")+'>Onaylı</option><option value="blocked"'+(d.status==="blocked"?" selected":"")+'>Engelli</option></select><button class="btn btn-primary btn-sm" data-save-uid="'+uid+'">Kaydet</button></div>'; }

async function loadHome() { document.getElementById("profileCard").innerHTML=renderProfile(currentProfile); var s=await getDocs(query(collection(db,"announcements"),orderBy("createdAt","desc"),limit(3))); document.getElementById("homeAnnouncements").innerHTML=s.empty?'<p class="empty">Duyuru yok.</p>':s.docs.map(function(d){return renderAnnouncement(d.data())}).join(""); }
async function loadTasks() { var isA=currentProfile.role==="admin"||currentProfile.role==="coordinator"; var q=isA?query(collection(db,"tasks"),orderBy("createdAt","desc"),limit(50)):query(collection(db,"tasks"),where("assignedToEmail","==",currentUser.email||""),orderBy("createdAt","desc"),limit(20)); var s=await getDocs(q); document.getElementById("tasksList").innerHTML=s.empty?'<p class="empty">Görev bulunamadı.</p>':s.docs.map(function(d){return renderTask(d.data())}).join(""); }
async function loadReports() { var isA=currentProfile.role==="admin"||currentProfile.role==="coordinator"; var q; if(isA){q=query(collection(db,"reports"),orderBy("createdAt","desc"),limit(50));document.getElementById("reportsTitle").textContent="Tüm raporlar";}else{q=query(collection(db,"reports"),where("userUid","==",currentUser.uid),orderBy("createdAt","desc"),limit(20));} var s=await getDocs(q); reportDocs={}; s.docs.forEach(function(d){reportDocs[d.id]=d.data();}); document.getElementById("reportsList").innerHTML=s.empty?'<p class="empty">Rapor bulunmuyor.</p>':s.docs.map(function(d){return renderReport(d.data(),d.id)}).join(""); }
async function loadAnnouncements() { var s=await getDocs(query(collection(db,"announcements"),orderBy("createdAt","desc"),limit(20))); document.getElementById("announcementsList").innerHTML=s.empty?'<p class="empty">Duyuru yok.</p>':s.docs.map(function(d){return renderAnnouncement(d.data())}).join(""); }
async function loadPending() { var s=await getDocs(query(collection(db,"users"),where("status","==","pending"),limit(30))); var el=document.getElementById("pendingUsers"); var pt=document.querySelector('[data-tab="pending"]'); if(s.empty){el.innerHTML='<p class="empty">Bekleyen başvuru yok.</p>';return;} el.innerHTML=s.docs.map(function(d){return renderPendingUser(d.data(),d.id)}).join(""); if(pt){var ex=pt.querySelector(".count-badge");if(ex)ex.remove();pt.insertAdjacentHTML("beforeend",'<span class="count-badge">'+s.size+'</span>');} }
async function loadUsers() { var s=await getDocs(query(collection(db,"users"),orderBy("createdAt","desc"),limit(100))); document.getElementById("userDirectory").innerHTML=s.empty?'<p class="empty">Kullanıcı bulunamadı.</p>':s.docs.map(function(d){return renderUserRow(d.data(),d.id)}).join(""); }

function resetReportForm() {
  document.getElementById("reportForm").reset();
  document.getElementById("editReportId").value = "";
  document.getElementById("hours").value = 1;
  document.getElementById("reportDate").value = todayISO();
  document.getElementById("reportFormTitle").textContent = "Rapor gönder";
  document.getElementById("reportSubmitBtn").textContent = "Rapor gönder";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  document.getElementById("reportLinks").value = "";
  document.getElementById("reportImages").value = "";
}
document.getElementById("cancelEditBtn")?.addEventListener("click", resetReportForm);

document.addEventListener("click", async function(e) {
  // Edit report
  var editBtn = e.target.closest("[data-edit-report]");
  if (editBtn) {
    var id = editBtn.dataset.editReport;
    var r = reportDocs[id]; if (!r) return;
    document.getElementById("editReportId").value = id;
    document.getElementById("taskId").value = r.taskId || "";
    document.getElementById("reportDate").value = r.reportDate || "";
    document.getElementById("hours").value = r.hours || 1;
    document.getElementById("summary").value = r.summary || "";
    document.getElementById("reportLinks").value = (r.links || []).join("\n");
    document.getElementById("reportImages").value = (r.images || []).join("\n");
    document.getElementById("reportFormTitle").textContent = "Raporu düzenle";
    document.getElementById("reportSubmitBtn").textContent = "Güncelle";
    document.getElementById("cancelEditBtn").classList.remove("hidden");
    document.querySelector("#tab-reports").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  // Delete report
  var delBtn = e.target.closest("[data-delete-report]");
  if (delBtn && db) {
    if (!confirm("Bu raporu silmek istediğinize emin misiniz?")) return;
    try { delBtn.disabled=true; delBtn.textContent="..."; await deleteDoc(doc(db,"reports",delBtn.dataset.deleteReport)); loadReports(); } catch(err) { console.error(err); alert("Silme hatası: "+err.message); delBtn.disabled=false; delBtn.textContent="Sil"; }
    return;
  }
  // Approve/block user
  var ab = e.target.closest("button[data-action]");
  if (ab && db) { var uid=ab.dataset.uid; try { ab.disabled=true; ab.textContent="..."; await updateDoc(doc(db,"users",uid),{status:ab.dataset.action==="approve"?"approved":"blocked",updatedAt:serverTimestamp()}); var card=document.getElementById("user-"+uid); if(card){card.style.opacity="0.4";card.innerHTML='<div class="user-info"><strong>'+(ab.dataset.action==="approve"?"Onaylandı":"Engellendi")+'</strong></div>';} } catch(err){console.error(err);alert("Hata: "+err.message);ab.disabled=false;} return; }
  // Save user role/status
  var sb = e.target.closest("button[data-save-uid]");
  if (sb && db) { var uid2=sb.dataset.saveUid; var row=document.getElementById("urow-"+uid2); var role=row.querySelector('[data-role-uid="'+uid2+'"]').value; var status=row.querySelector('[data-status-uid="'+uid2+'"]').value; try { sb.disabled=true; sb.textContent="..."; await updateDoc(doc(db,"users",uid2),{role:role,status:status,updatedAt:serverTimestamp()}); sb.textContent="OK"; setTimeout(function(){sb.textContent="Kaydet";sb.disabled=false;},1500); } catch(err){console.error(err);alert("Hata: "+err.message);sb.textContent="Kaydet";sb.disabled=false;} }
});

document.getElementById("reportForm")?.addEventListener("submit", async function(e) {
  e.preventDefault(); if (!currentUser || !db) return;
  var editId = document.getElementById("editReportId").value;
  var data = { taskId: document.getElementById("taskId").value.trim(), summary: document.getElementById("summary").value.trim(), hours: Number(document.getElementById("hours").value||0), reportDate: document.getElementById("reportDate").value, links: parseLines(document.getElementById("reportLinks").value), images: parseLines(document.getElementById("reportImages").value), updatedAt: serverTimestamp() };
  try {
    if (editId) { await updateDoc(doc(db,"reports",editId), data); document.getElementById("reportMessage").textContent = "Rapor güncellendi!"; }
    else { data.userUid=currentUser.uid; data.userEmail=currentUser.email||""; data.status="submitted"; data.reviewerUid=null; data.createdAt=serverTimestamp(); await addDoc(collection(db,"reports"), data); document.getElementById("reportMessage").textContent = "Rapor kaydedildi!"; }
    resetReportForm(); setTimeout(function(){document.getElementById("reportMessage").textContent=""},3000); loadReports();
  } catch(err) { console.error(err); document.getElementById("reportMessage").textContent = "Hata: "+err.message; }
});

document.getElementById("taskForm")?.addEventListener("submit", async function(e) {
  e.preventDefault(); if(!currentUser||!db)return;
  try{await addDoc(collection(db,"tasks"),{title:document.getElementById("taskTitle").value.trim(),description:document.getElementById("taskDescription").value.trim(),department:document.getElementById("taskDepartment").value,assignedToUid:null,assignedToEmail:document.getElementById("taskAssignedToEmail").value.trim(),dueDate:document.getElementById("taskDueDate").value||null,priority:document.getElementById("taskPriority").value,status:"open",createdByUid:currentUser.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    e.target.reset();document.getElementById("taskMessage").textContent="Görev oluşturuldu!";setTimeout(function(){document.getElementById("taskMessage").textContent=""},3000);loadTasks();
  }catch(err){console.error(err);document.getElementById("taskMessage").textContent="Hata: "+err.message;}
});

document.getElementById("addUserForm")?.addEventListener("submit", async function(e) {
  e.preventDefault(); if(!currentUser||!db)return;
  var email=document.getElementById("addUserEmail").value.trim().toLowerCase();
  try{await setDoc(doc(db,"preregistered",email),{email:email,fullName:document.getElementById("addUserName").value.trim(),department:document.getElementById("addUserDepartment").value,role:document.getElementById("addUserRole").value,phone:document.getElementById("addUserPhone").value.trim(),status:"approved",createdByUid:currentUser.uid,createdAt:serverTimestamp()});
    e.target.reset();document.getElementById("addUserMessage").textContent="Ön kayıt oluşturuldu!";setTimeout(function(){document.getElementById("addUserMessage").textContent=""},5000);
  }catch(err){console.error(err);document.getElementById("addUserMessage").textContent="Hata: "+err.message;}
});

document.getElementById("announcementForm")?.addEventListener("submit", async function(e) {
  e.preventDefault(); if(!currentUser||!db)return;
  try{await addDoc(collection(db,"announcements"),{title:document.getElementById("announcementTitle").value.trim(),body:document.getElementById("announcementBody").value.trim(),audience:document.getElementById("announcementAudience").value,department:"",createdByUid:currentUser.uid,createdAt:serverTimestamp()});
    e.target.reset();document.getElementById("announcementMessage").textContent="Duyuru yayınlandı!";setTimeout(function(){document.getElementById("announcementMessage").textContent=""},3000);loadAnnouncements();
  }catch(err){console.error(err);document.getElementById("announcementMessage").textContent="Hata: "+err.message;}
});

if(!auth||!db){loadingState.innerHTML='<p class="empty">'+missingConfigMessage+'</p>';}
else{onAuthStateChanged(auth,async function(user){
  if(!user){window.location.href="../auth/";return;}
  currentUser=user; var snap=await getDoc(doc(db,"users",user.uid));
  if(!snap.exists()||snap.data().status!=="approved"){window.location.href="../auth/";return;}
  currentProfile=snap.data(); var isA=currentProfile.role==="admin"||currentProfile.role==="coordinator";
  headerUser.textContent=currentProfile.fullName||user.email;
  if(isA){document.querySelectorAll(".admin-tab").forEach(function(t){t.classList.remove("hidden")});document.getElementById("adminTaskForm")?.classList.remove("hidden");document.getElementById("adminAnnouncementForm")?.classList.remove("hidden");}
  document.getElementById("reportDate").value=todayISO();
  loadingState.classList.add("hidden");tabBar.classList.remove("hidden");
  await loadHome();loadTasks();loadReports();loadAnnouncements();
  if(isA){loadPending();loadUsers();}
});}
