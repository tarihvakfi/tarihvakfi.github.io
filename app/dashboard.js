import { auth, db, signOut, onAuthStateChanged, serverTimestamp, missingConfigMessage } from "../js/firebase-init.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { escapeHTML, formatDate, badge } from "../js/helpers.js";

const PNB_PROJECT_ID = "pnb";
const PNB_PROJECT_TITLE = "Pertev Naili Boratav Arşivi Dijitalleştirme";

let cu = null;
let cp = null;
let rd = {};
let pi = [];
let allUsers = [];
let archiveUnits = [];
let archiveById = {};
let availabilityRecords = [];
let communicationPlans = [];
let pnbImportPreview = null;

const ld = document.getElementById("loadingState");
const tb = document.getElementById("tabBar");
const hu = document.getElementById("headerUser");

const archiveStatusLabels = {
  not_started: "Başlamadı",
  assigned: "Atandı",
  in_progress: "Devam ediyor",
  review: "Kontrol",
  done: "Tamamlandı",
  blocked: "Engelli"
};

const taskStatusLabels = {
  open: "Açık",
  in_progress: "Devam ediyor",
  done: "Tamamlandı",
  cancelled: "İptal",
  closed: "Kapalı"
};

const reportStatusLabels = {
  submitted: "Gönderildi",
  revision_needed: "Düzeltme İstendi",
  approved: "Onaylandı"
};

function isStaff() {
  return cp && (cp.role === "admin" || cp.role === "coordinator");
}

function isAdmin() {
  return cp && cp.role === "admin";
}

function sw(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach((section) => section.classList.toggle("hidden", section.id !== `tab-${name}`));
}

function htmlEmpty(message) {
  return `<p class="empty">${escapeHTML(message)}</p>`;
}

function pl(value) {
  return (value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function td() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function numberText(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

function percent(done, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(done || 0) / Number(total || 0)) * 100)));
}

function userDisplayName(user) {
  if (!user) return "";
  return user.data?.fullName || user.data?.email || user.uid || "";
}

function userEmail(uid) {
  const user = allUsers.find((item) => item.uid === uid);
  return user?.data?.email || "";
}

function findUserName(uid) {
  return userDisplayName(allUsers.find((item) => item.uid === uid)) || uid || "";
}

function findUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return allUsers.find((item) => String(item.data?.email || "").trim().toLowerCase() === normalized);
}

function approvedUsers() {
  return allUsers.filter((item) => item.data?.status === "approved");
}

function getSelectedValues(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean);
}

function setSelectedValues(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const selected = values || [];
  Array.from(select.options).forEach((option) => {
    option.selected = selected.includes(option.value);
  });
}

function cleanData(data) {
  const cleaned = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) cleaned[key] = value;
  });
  return cleaned;
}

function ci(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        let width = image.width;
        let height = image.height;
        if (width > 800) {
          height = Math.round((height * 800) / width);
          width = 800;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      image.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function uip() {
  const preview = document.getElementById("imagePreview");
  if (!preview) return;
  preview.innerHTML = pi.map((src, index) => (
    `<div class="preview-item"><img src="${src}"/><button type="button" class="preview-remove" data-ri="${index}">&times;</button></div>`
  )).join("");
}

async function createNotif(toUid, type, message, tab) {
  if (!db || !toUid) return;
  try {
    await addDoc(collection(db, "notifications"), {
      toUid,
      type,
      message,
      tab: tab || "home",
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Bildirim hatası:", error);
  }
}

async function logActivity(action, targetType, targetId, metadata = {}) {
  if (!db || !cu) return;
  try {
    await addDoc(collection(db, "activityLogs"), {
      actorUid: cu.uid,
      actorEmail: cu.email || "",
      action,
      targetType,
      targetId,
      metadata,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Aktivite kaydı yazılamadı:", error);
  }
}

async function loadNotifs() {
  if (!cu || !db) return;
  try {
    const snap = await getDocs(query(collection(db, "notifications"), where("toUid", "==", cu.uid), orderBy("createdAt", "desc"), limit(20)));
    const list = document.getElementById("notifList");
    const count = document.getElementById("notifCount");
    if (!list || !count) return;
    let unread = 0;
    if (snap.empty) {
      list.innerHTML = '<p class="empty" style="padding:1rem">Bildirim yok.</p>';
      count.textContent = "0";
      count.classList.add("hidden");
      return;
    }
    list.innerHTML = snap.docs.map((item) => {
      const notif = item.data();
      if (!notif.read) unread += 1;
      return `<div class="notif-item${notif.read ? "" : " unread"}" data-notif="${item.id}" data-tab="${notif.tab || "home"}"><div>${escapeHTML(notif.message || "")}</div><div class="notif-date">${formatDate(notif.createdAt)}</div></div>`;
    }).join("");
    count.textContent = unread;
    count.classList.toggle("hidden", unread === 0);
  } catch (error) {
    console.error("Bildirim yükleme hatası:", error);
  }
}

function rp(profile) {
  return `<div class="profile-card"><div class="profile-avatar">${escapeHTML((profile.fullName || "?")[0].toUpperCase())}</div><div class="profile-info"><h3>${escapeHTML(profile.fullName || "-")}</h3><div class="profile-details"><span>${escapeHTML(profile.email || "-")}</span><span>${escapeHTML(profile.department || "-")}</span></div><div class="profile-badges">${badge(profile.role || "volunteer")}${badge(profile.status || "pending")}</div></div></div>`;
}

function statusLabel(status) {
  return archiveStatusLabels[status] || taskStatusLabels[status] || reportStatusLabels[status] || status || "-";
}

function statusClass(status) {
  if (status === "approved" || status === "done") return "badge approved";
  if (status === "revision_needed" || status === "review") return "badge pending";
  if (status === "blocked") return "badge blocked";
  return "badge";
}

function archiveLabel(unit) {
  if (!unit) return "";
  return `${unit.sourceCode || "PNB"} / ${unit.seriesNo || "-"} · Kutu ${unit.boxNo || "-"}`;
}

function archiveOptions(selectedId = "", includeEmpty = true) {
  const options = includeEmpty ? ['<option value="">Bağlantı yok</option>'] : [];
  archiveUnits
    .slice()
    .sort((a, b) => archiveLabel(a).localeCompare(archiveLabel(b), "tr"))
    .forEach((unit) => {
      options.push(`<option value="${escapeHTML(unit.id)}"${unit.id === selectedId ? " selected" : ""}>${escapeHTML(archiveLabel(unit))}</option>`);
    });
  return options.join("");
}

function userOptions(selected = []) {
  const selectedSet = new Set(selected || []);
  return approvedUsers()
    .slice()
    .sort((a, b) => userDisplayName(a).localeCompare(userDisplayName(b), "tr"))
    .map((user) => `<option value="${escapeHTML(user.uid)}"${selectedSet.has(user.uid) ? " selected" : ""}>${escapeHTML(userDisplayName(user))}</option>`)
    .join("");
}

function populateUserSelects() {
  const configs = [
    { id: "reportForUser", defaultLabel: "Kendim için", excludeSelf: true },
    { id: "reportCoworker", defaultLabel: null, excludeSelf: true },
    { id: "taskAssignedTo", defaultLabel: "Seçiniz", excludeSelf: false }
  ];
  configs.forEach((config) => {
    const select = document.getElementById(config.id);
    if (!select) return;
    select.innerHTML = config.defaultLabel ? `<option value="">${config.defaultLabel}</option>` : "";
    const seen = new Set();
    approvedUsers().forEach((user) => {
      if (config.excludeSelf && user.uid === cu.uid) return;
      const name = userDisplayName(user);
      if (!name || seen.has(name)) return;
      seen.add(name);
      select.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(user.uid)}">${escapeHTML(name)}</option>`);
    });
  });
}

function populateArchiveSelects() {
  const reportSelect = document.getElementById("archiveUnitSelect");
  const taskSelect = document.getElementById("taskArchiveUnit");
  if (reportSelect) reportSelect.innerHTML = archiveOptions(reportSelect.value || "");
  if (taskSelect) taskSelect.innerHTML = archiveOptions(taskSelect.value || "");
}

async function loadAllUsers() {
  allUsers = [];
  if (!db || !cu || !cp) return;
  if (!isStaff()) {
    allUsers = [{ uid: cu.uid, data: cp }];
    populateUserSelects();
    return;
  }
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(300)));
    snap.docs.forEach((item) => allUsers.push({ uid: item.id, data: item.data() }));
  } catch (error) {
    console.warn("Kullanıcı listesi yüklenemedi, yalnızca mevcut profil kullanılacak:", error);
    allUsers = [{ uid: cu.uid, data: cp }];
  }
  populateUserSelects();
}

function rt(task, id) {
  const priorityLabels = { high: "Yüksek", medium: "Orta", low: "Düşük" };
  const priorityClass = task.priority === "high" ? "priority-high" : task.priority === "low" ? "priority-low" : "priority-medium";
  const staff = isStaff();
  const assigned = task.assignedToUid ? findUserName(task.assignedToUid) : task.assignedToEmail;
  const unit = task.archiveUnitId ? archiveById[task.archiveUnitId] : null;
  let html = `<div class="task-card"><div class="report-header"><strong>${escapeHTML(task.title || "-")}</strong>`;
  if (staff) {
    html += `<div class="report-actions"><button class="btn btn-secondary btn-sm" data-et="${id}">Düzenle</button><button class="btn btn-block btn-sm" data-dt="${id}">Sil</button></div>`;
  }
  html += `</div>${task.description ? `<div>${escapeHTML(task.description)}</div>` : ""}<div class="task-meta"><span class="${priorityClass}">${escapeHTML(priorityLabels[task.priority] || task.priority || "Orta")}</span><span>${escapeHTML(task.department || "-")}</span>`;
  if (unit) html += `<span>Arşiv: ${escapeHTML(archiveLabel(unit))}</span>`;
  if (assigned) html += `<span>Atanan: ${escapeHTML(assigned)}</span>`;
  if (task.dueDate) html += `<span>Son: ${formatDate(task.dueDate)}</span>`;
  html += `<span>${escapeHTML(taskStatusLabels[task.status] || task.status || "Açık")}</span></div></div>`;
  return html;
}

function rr(report, id) {
  const links = (report.links || []).filter(Boolean);
  const images = (report.images || []).filter(Boolean);
  const own = report.userUid === cu?.uid;
  const staff = isStaff();
  const canEdit = own || staff;
  const coworkerNames = (report.coworkerUids || []).map((uid) => findUserName(uid)).filter(Boolean);
  const feedback = report.feedback || [];
  const status = report.status || "submitted";
  const unit = report.archiveUnitId ? archiveById[report.archiveUnitId] : null;
  let html = `<div class="report-card report-${status}"><div class="report-header"><strong>${escapeHTML(report.taskId || "Görev belirtilmedi")}</strong><div class="report-actions">`;
  if (canEdit) html += `<button class="btn btn-secondary btn-sm" data-er="${id}">Düzenle</button><button class="btn btn-block btn-sm" data-dr="${id}">Sil</button>`;
  html += `</div></div><div style="margin-top:.35rem">${escapeHTML(report.summary || "-")}</div><div style="font-size:.85rem;color:var(--muted);margin-top:.35rem">${escapeHTML(report.hours || 0)} saat · ${formatDate(report.reportDate)} · <span class="${statusClass(status)}">${escapeHTML(reportStatusLabels[status] || status)}</span>`;
  if (report.userUid) html += ` · ${escapeHTML(findUserName(report.userUid))}`;
  if (unit) html += ` · ${escapeHTML(archiveLabel(unit))}`;
  if (coworkerNames.length) html += ` · Ekip: ${escapeHTML(coworkerNames.join(", "))}`;
  html += "</div>";
  if (status === "revision_needed" && own) {
    html += `<div class="revision-alert"><strong>Düzeltme istendi</strong><p>Lütfen raporu düzenleyip tekrar gönderin.</p><button class="btn btn-primary btn-sm" data-er="${id}">Düzelt ve Tekrar Gönder</button></div>`;
  }
  if (feedback.length) {
    html += '<div class="report-feedback-list">';
    feedback.forEach((item) => {
      html += `<div class="feedback-item"><strong>${escapeHTML(item.by || item.reviewerName || "-")}</strong> <span style="font-size:.8rem;color:var(--muted)">${escapeHTML(item.date || "")}</span><div>${escapeHTML(item.text || item.comment || "")}</div></div>`;
    });
    html += "</div>";
  }
  if (staff && status !== "approved") {
    html += `<div class="report-review-area"><textarea class="review-text" data-review-id="${id}" rows="2" placeholder="Geri bildirim yazın..."></textarea><div class="report-actions" style="margin-top:.35rem"><button class="btn btn-approve btn-sm" data-approve="${id}">Onayla</button><button class="btn btn-secondary btn-sm" data-revision="${id}">Düzeltme İste</button></div></div>`;
  }
  if (links.length) {
    html += '<div class="report-links">';
    links.forEach((link) => {
      html += `<a href="${escapeHTML(link)}" target="_blank" rel="noopener">${escapeHTML(link.length > 60 ? `${link.substring(0, 60)}...` : link)}</a>`;
    });
    html += "</div>";
  }
  if (images.length) {
    html += '<div class="report-images">';
    images.forEach((image) => {
      html += `<img src="${escapeHTML(image)}" alt="Görsel" loading="lazy" class="lightbox-img"/>`;
    });
    html += "</div>";
  }
  return `${html}</div>`;
}

function ra(announcement, id) {
  const staff = isStaff();
  const audiences = { all: "Tümü", volunteers: "Gönüllüler", coordinators: "Koordinatörler" };
  let html = `<div class="announce-card"><div class="report-header"><strong>${escapeHTML(announcement.title || "-")}</strong>`;
  if (staff && id) {
    html += `<div class="report-actions"><button class="btn btn-secondary btn-sm" data-ea="${id}">Düzenle</button><button class="btn btn-block btn-sm" data-da="${id}">Sil</button></div>`;
  }
  html += `</div><div>${escapeHTML(announcement.body || "")}</div><div class="announce-date">${formatDate(announcement.createdAt)} · ${escapeHTML(audiences[announcement.audience] || announcement.audience || "Tümü")}</div></div>`;
  return html;
}

function rpu(data, uid) {
  return `<div class="user-card" id="user-${uid}"><div class="user-info"><strong>${escapeHTML(data.fullName || "-")}</strong><small>${escapeHTML(data.email || "-")} · ${escapeHTML(data.department || "-")}</small></div><div class="user-actions"><button class="btn btn-approve btn-sm" data-action="approve" data-uid="${uid}">Onayla</button><button class="btn btn-block btn-sm" data-action="block" data-uid="${uid}">Engelle</button></div></div>`;
}

function rur(data, uid) {
  return `<div class="user-edit-card" id="urow-${uid}">
    <div class="form-row">
      <label>Ad Soyad <input data-fn="${uid}" value="${escapeHTML(data.fullName || "")}" /></label>
      <label>E-posta <input data-em="${uid}" value="${escapeHTML(data.email || "")}" /></label>
      <label>Telefon <input data-ph="${uid}" value="${escapeHTML(data.phone || "")}" /></label>
    </div>
    <div class="form-row">
      <label>Departman <select data-dp="${uid}"><option value="">Seçiniz</option><option${data.department === "Eğitim" ? " selected" : ""}>Eğitim</option><option${data.department === "Arşiv" ? " selected" : ""}>Arşiv</option><option${data.department === "İletişim" ? " selected" : ""}>İletişim</option><option${data.department === "Etkinlik" ? " selected" : ""}>Etkinlik</option><option${data.department === "Dijital İçerik" ? " selected" : ""}>Dijital İçerik</option></select></label>
      <label>Rol <select data-ru="${uid}"><option value="volunteer"${data.role === "volunteer" ? " selected" : ""}>Gönüllü</option><option value="coordinator"${data.role === "coordinator" ? " selected" : ""}>Koordinatör</option><option value="admin"${data.role === "admin" ? " selected" : ""}>Yönetici</option></select></label>
      <label>Durum <select data-su="${uid}"><option value="pending"${data.status === "pending" ? " selected" : ""}>Beklemede</option><option value="approved"${data.status === "approved" ? " selected" : ""}>Onaylı</option><option value="blocked"${data.status === "blocked" ? " selected" : ""}>Engelli</option></select></label>
    </div>
    <div class="form-row">
      <label>Yetenek / İlgi <input data-sk="${uid}" value="${escapeHTML(data.skillsText || "")}" placeholder="Osmanlıca, dijitalleştirme..." /></label>
      <label>Koordinatör notu <input data-cn="${uid}" value="${escapeHTML(data.coordinatorNotes || "")}" /></label>
    </div>
    <div class="form-actions"><button class="btn btn-primary btn-sm" data-sv="${uid}">Kaydet</button><button class="btn btn-block btn-sm" data-del-user="${uid}">Sil</button></div>
  </div>`;
}

async function lh() {
  document.getElementById("profileCard").innerHTML = rp(cp);
  const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(3)));
  document.getElementById("homeAnnouncements").innerHTML = snap.empty ? htmlEmpty("Duyuru yok.") : snap.docs.map((item) => ra(item.data(), item.id)).join("");
}

async function lt() {
  const staff = isStaff();
  const taskQuery = staff
    ? query(collection(db, "tasks"), orderBy("createdAt", "desc"), limit(80))
    : query(collection(db, "tasks"), where("assignedToUid", "==", cu.uid), limit(40));
  const snap = await getDocs(taskQuery);
  const tasks = snap.docs.map((item) => ({ id: item.id, data: item.data() }));
  tasks.sort((a, b) => {
    const at = a.data.createdAt?.toMillis?.() || 0;
    const bt = b.data.createdAt?.toMillis?.() || 0;
    return bt - at;
  });
  document.getElementById("tasksList").innerHTML = tasks.length ? tasks.map((item) => rt(item.data, item.id)).join("") : htmlEmpty("Görev bulunamadı.");
}

async function lr() {
  const staff = isStaff();
  rd = {};
  if (staff) {
    const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(80)));
    snap.docs.forEach((item) => { rd[item.id] = item.data(); });
    document.getElementById("reportsTitle").textContent = "Tüm raporlar";
  } else {
    const own = await getDocs(query(collection(db, "reports"), where("userUid", "==", cu.uid), limit(40)));
    own.docs.forEach((item) => { rd[item.id] = item.data(); });
    try {
      const coworker = await getDocs(query(collection(db, "reports"), where("coworkerUids", "array-contains", cu.uid), limit(40)));
      coworker.docs.forEach((item) => { if (!rd[item.id]) rd[item.id] = item.data(); });
    } catch (error) {
      console.warn("Ekip arkadaşı raporları yüklenemedi:", error);
    }
    document.getElementById("reportsTitle").textContent = "Raporlarım";
  }
  const ids = Object.keys(rd);
  ids.sort((a, b) => {
    const at = rd[a].createdAt?.toMillis?.() || 0;
    const bt = rd[b].createdAt?.toMillis?.() || 0;
    return bt - at;
  });
  document.getElementById("reportsList").innerHTML = ids.length ? ids.map((id) => rr(rd[id], id)).join("") : htmlEmpty("Rapor bulunmuyor.");
}

async function la() {
  const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20)));
  document.getElementById("announcementsList").innerHTML = snap.empty ? htmlEmpty("Duyuru yok.") : snap.docs.map((item) => ra(item.data(), item.id)).join("");
}

async function lp() {
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "pending"), limit(50)));
  const list = document.getElementById("pendingUsers");
  const tab = document.querySelector('[data-tab="pending"]');
  if (snap.empty) {
    list.innerHTML = htmlEmpty("Bekleyen başvuru yok.");
    return;
  }
  list.innerHTML = snap.docs.map((item) => rpu(item.data(), item.id)).join("");
  if (tab) {
    const old = tab.querySelector(".count-badge");
    if (old) old.remove();
    tab.insertAdjacentHTML("beforeend", `<span class="count-badge">${snap.size}</span>`);
  }
}

async function lu() {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(150)));
  document.getElementById("userDirectory").innerHTML = snap.empty ? htmlEmpty("Kullanıcı bulunamadı.") : snap.docs.map((item) => rur(item.data(), item.id)).join("");
}

async function loadArchiveUnits() {
  archiveUnits = [];
  archiveById = {};
  if (!db || !cu || !cp) return;
  try {
    if (isStaff()) {
      const snap = await getDocs(query(collection(db, "archiveUnits"), where("projectId", "==", PNB_PROJECT_ID), limit(250)));
      archiveUnits = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    } else {
      const byId = {};
      const byUid = await getDocs(query(collection(db, "archiveUnits"), where("assignedToUids", "array-contains", cu.uid), limit(120)));
      byUid.docs.forEach((item) => { byId[item.id] = { id: item.id, ...item.data() }; });
      if (cu.email) {
        const byEmail = await getDocs(query(collection(db, "archiveUnits"), where("assignedToEmails", "array-contains", cu.email.toLowerCase()), limit(120)));
        byEmail.docs.forEach((item) => { byId[item.id] = { id: item.id, ...item.data() }; });
      }
      archiveUnits = Object.values(byId);
    }
    archiveUnits.sort((a, b) => archiveLabel(a).localeCompare(archiveLabel(b), "tr", { numeric: true }));
    archiveById = Object.fromEntries(archiveUnits.map((unit) => [unit.id, unit]));
  } catch (error) {
    console.error("PNB arşiv birimleri yüklenemedi:", error);
    document.getElementById("archiveUnitList").innerHTML = `<div class="pnb-empty-action">PNB arşiv verisi yüklenemedi: ${escapeHTML(error.message)}</div>`;
  }
}

async function loadAvailability() {
  availabilityRecords = [];
  if (!isStaff()) return;
  try {
    const snap = await getDocs(query(collection(db, "availability"), where("projectId", "==", PNB_PROJECT_ID), limit(200)));
    availabilityRecords = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("Gönüllü uygunluk verisi yüklenemedi:", error);
  }
}

async function loadCommunicationPlans() {
  communicationPlans = [];
  try {
    const snap = await getDocs(query(collection(db, "communicationPlans"), where("projectId", "==", PNB_PROJECT_ID), limit(40)));
    communicationPlans = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("İletişim planı yüklenemedi:", error);
  }
}

function renderPnbStats() {
  const statsEl = document.getElementById("pnbStats");
  const hero = document.getElementById("pnbHeroStatus");
  if (!statsEl || !hero) return;
  if (!archiveUnits.length) {
    hero.textContent = "Genel çalışma ortamı";
    statsEl.innerHTML = `<div class="pnb-empty-action">PNB arşiv iş paketleri henüz Firestore'a aktarılmamış. Diğer gönüllü işleri için Görevler, Raporlar, Duyurular ve Kullanıcılar sekmeleri kullanılabilir. Yönetici olarak PNB verisini eklemek için "PNB İçe Aktar" sekmesini açabilirsiniz.</div>`;
    return;
  }
  const totals = archiveUnits.reduce((acc, unit) => {
    acc.units += 1;
    acc.files += Number(unit.fileCount || 0);
    acc.documents += Number(unit.documentCount || 0);
    acc.pages += Number(unit.pageCount || 0);
    acc.completedFiles += Number(unit.completedFileCount || 0);
    acc.completedDocs += Number(unit.completedDocumentCount || 0);
    acc.blocked += unit.status === "blocked" ? 1 : 0;
    acc.done += unit.status === "done" ? 1 : 0;
    acc.unassigned += (unit.assignedToUids || []).length || (unit.assignedToEmails || []).length ? 0 : 1;
    return acc;
  }, { units: 0, files: 0, documents: 0, pages: 0, completedFiles: 0, completedDocs: 0, blocked: 0, done: 0, unassigned: 0 });
  hero.textContent = `${numberText(totals.units)} iş paketi · ${numberText(totals.pages)} sayfa`;
  statsEl.innerHTML = [
    ["İş paketi", totals.units],
    ["Dosya", totals.files],
    ["Belge", totals.documents],
    ["Sayfa", totals.pages],
    ["Tamamlanan belge", totals.completedDocs],
    ["Tamamlandı", totals.done],
    ["Engelli", totals.blocked],
    ["Atanmamış", totals.unassigned]
  ].map(([label, value]) => `<div class="kpi-card"><strong>${numberText(value)}</strong><span>${escapeHTML(label)}</span></div>`).join("");
}

function renderNextActions() {
  const el = document.getElementById("pnbNextActions");
  if (!el) return;
  if (!archiveUnits.length) {
    el.innerHTML = htmlEmpty(isStaff() ? "İçe aktarılacak PNB verisi bekleniyor." : "Size atanmış PNB arşiv birimi yok.");
    return;
  }
  if (isStaff()) {
    const blocked = archiveUnits.filter((unit) => unit.status === "blocked").slice(0, 5);
    const unassigned = archiveUnits.filter((unit) => !(unit.assignedToUids || []).length && !(unit.assignedToEmails || []).length).slice(0, 5);
    const capacity = availabilityRecords.filter((item) => item.slotCount > 0).sort((a, b) => Number(b.slotCount || 0) - Number(a.slotCount || 0)).slice(0, 5);
    let html = "";
    html += `<div class="feedback-item"><strong>Engelli işler</strong><div>${blocked.length ? blocked.map((unit) => escapeHTML(archiveLabel(unit))).join("<br>") : "Engelli iş yok."}</div></div>`;
    html += `<div class="feedback-item"><strong>Atanmamış ilk işler</strong><div>${unassigned.length ? unassigned.map((unit) => escapeHTML(archiveLabel(unit))).join("<br>") : "Atanmamış iş yok."}</div></div>`;
    html += `<div class="feedback-item"><strong>Uygunluğu görünen gönüllüler</strong><div>${capacity.length ? capacity.map((item) => `${escapeHTML(item.personName)} (${escapeHTML(item.slotCount)} slot)`).join("<br>") : "Uygunluk verisi yok."}</div></div>`;
    el.innerHTML = html;
    return;
  }
  const next = archiveUnits.filter((unit) => !["done", "blocked"].includes(unit.status)).slice(0, 4);
  el.innerHTML = next.length
    ? next.map((unit) => `<div class="feedback-item"><strong>${escapeHTML(archiveLabel(unit))}</strong><div>${escapeHTML(statusLabel(unit.status))} · ${numberText(unit.pageCount)} sayfa</div><button class="btn btn-primary btn-sm" style="margin-top:.4rem" data-report-au="${unit.id}">Bu iş için rapor yaz</button></div>`).join("")
    : htmlEmpty("Açık PNB işiniz yok. Tamamlanan işler için teşekkürler.");
}

function renderCommunicationPlans() {
  const el = document.getElementById("communicationPlanList");
  if (!el) return;
  if (!communicationPlans.length) {
    el.innerHTML = htmlEmpty("İletişim planı yok.");
    return;
  }
  el.innerHTML = communicationPlans.map((plan) => (
    `<div class="announce-card"><strong>${escapeHTML(plan.title || "-")}</strong><div class="announce-date">${escapeHTML(plan.frequency || "Sıklık yok")} · ${escapeHTML(plan.channel || "Ortam yok")}</div><div>${escapeHTML(plan.goal || "")}</div>${plan.deliverables ? `<div class="archive-meta"><span class="archive-chip">Teslim: ${escapeHTML(plan.deliverables)}</span></div>` : ""}</div>`
  )).join("");
}

function archiveCard(unit) {
  const staff = isStaff();
  const progress = percent(unit.completedDocumentCount || unit.completedFileCount || 0, unit.documentCount || unit.fileCount || 0);
  const assignedNames = (unit.assignedToUids || []).map((uid) => findUserName(uid)).filter(Boolean);
  (unit.assignedToEmails || []).forEach((email) => {
    if (!assignedNames.includes(email)) assignedNames.push(email);
  });
  let html = `<article class="archive-card ${escapeHTML(unit.status || "not_started")}">
    <div class="archive-title"><strong>${escapeHTML(archiveLabel(unit))}</strong><span class="status-pill ${escapeHTML(unit.status || "not_started")}">${escapeHTML(statusLabel(unit.status || "not_started"))}</span></div>
    <div class="archive-meta">
      <span class="archive-chip">${numberText(unit.fileCount)} dosya</span>
      <span class="archive-chip">${numberText(unit.documentCount)} belge</span>
      <span class="archive-chip">${numberText(unit.pageCount)} sayfa</span>
      ${unit.materialType ? `<span class="archive-chip">Tür: ${escapeHTML(unit.materialType)}</span>` : ""}
    </div>
    ${unit.notes ? `<p class="muted" style="font-size:.84rem">${escapeHTML(unit.notes)}</p>` : ""}
    <div class="archive-progress" title="${progress}%"><span style="width:${progress}%"></span></div>
    <div class="archive-meta"><span class="archive-chip">Tamamlanan: ${numberText(unit.completedDocumentCount || 0)} belge</span><span class="archive-chip">Atanan: ${escapeHTML(assignedNames.join(", ") || "Yok")}</span></div>
    ${unit.blockerNote ? `<div class="revision-alert"><strong>Engel</strong><p>${escapeHTML(unit.blockerNote)}</p></div>` : ""}`;
  if (staff) {
    html += `<div class="archive-controls">
      <div class="form-row">
        <label>Durum <select data-au-status="${unit.id}">${Object.entries(archiveStatusLabels).map(([value, label]) => `<option value="${value}"${(unit.status || "not_started") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Öncelik <select data-au-priority="${unit.id}"><option value="low"${unit.priority === "low" ? " selected" : ""}>Düşük</option><option value="medium"${(unit.priority || "medium") === "medium" ? " selected" : ""}>Orta</option><option value="high"${unit.priority === "high" ? " selected" : ""}>Yüksek</option></select></label>
        <label>Son tarih <input type="date" data-au-due="${unit.id}" value="${escapeHTML(unit.dueDate || "")}" /></label>
      </div>
      <label>Atanan gönüllüler <select multiple data-au-assign="${unit.id}">${userOptions(unit.assignedToUids || [])}</select></label>
      <label>Engel / not <textarea rows="2" data-au-blocker="${unit.id}">${escapeHTML(unit.blockerNote || "")}</textarea></label>
      <div class="archive-actions"><button class="btn btn-primary btn-sm" data-save-au="${unit.id}">Kaydet</button><button class="btn btn-secondary btn-sm" data-create-task-au="${unit.id}">Görev oluştur</button><button class="btn btn-secondary btn-sm" data-report-au="${unit.id}">Rapor yaz</button></div>
    </div>`;
  } else {
    html += `<div class="archive-controls"><label>Engel bildir <textarea rows="2" data-vol-blocker="${unit.id}" placeholder="Bu işte sizi durduran sorunu yazın...">${escapeHTML(unit.blockerNote || "")}</textarea></label><div class="archive-actions"><button class="btn btn-primary btn-sm" data-report-au="${unit.id}">Rapor yaz</button><button class="btn btn-secondary btn-sm" data-block-au="${unit.id}">Engel bildir</button></div></div>`;
  }
  return `${html}</article>`;
}

function renderArchiveUnits() {
  const el = document.getElementById("archiveUnitList");
  if (!el) return;
  const filter = document.getElementById("pnbStatusFilter")?.value || "";
  const units = filter ? archiveUnits.filter((unit) => (unit.status || "not_started") === filter) : archiveUnits;
  el.innerHTML = units.length ? units.map(archiveCard).join("") : htmlEmpty("Bu filtrede PNB arşiv birimi yok.");
}

function renderPnb() {
  renderPnbStats();
  renderNextActions();
  renderCommunicationPlans();
  renderArchiveUnits();
  populateArchiveSelects();
}

async function reloadPnb() {
  await loadArchiveUnits();
  await loadAvailability();
  await loadCommunicationPlans();
  renderPnb();
}

function rf() {
  document.getElementById("reportForm").reset();
  document.getElementById("editReportId").value = "";
  document.getElementById("hours").value = 1;
  document.getElementById("reportDate").value = td();
  document.getElementById("reportFormTitle").textContent = "Rapor gönder";
  document.getElementById("reportSubmitBtn").textContent = "Rapor gönder";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  document.getElementById("reportLinks").value = "";
  const sel = document.getElementById("reportForUser");
  if (sel) sel.value = "";
  const archiveSelect = document.getElementById("archiveUnitSelect");
  if (archiveSelect) archiveSelect.value = "";
  const coworkers = document.getElementById("reportCoworker");
  if (coworkers) Array.from(coworkers.options).forEach((option) => { option.selected = false; });
  pi = [];
  uip();
}

function renderImportPreview(preview) {
  const el = document.getElementById("pnbImportPreview");
  const commitButton = document.getElementById("pnbCommitBtn");
  if (!el || !preview) return;
  const summary = preview.summary || {};
  const checks = preview.checks || {};
  const missingEmails = checks.missingEmails || [];
  const duplicates = checks.duplicateNames || [];
  const unmatched = checks.unmatchedAvailabilityNames || [];
  const emptyAssigned = checks.emptyAssignedArchiveUnits || [];
  const countCard = (label, value) => `<div class="kpi-card"><strong>${numberText(value)}</strong><span>${escapeHTML(label)}</span></div>`;
  const sampleList = (items, formatter) => {
    if (!items.length) return "<p class=\"muted\">Sorun yok.</p>";
    return `<ul>${items.slice(0, 8).map(formatter).join("")}${items.length > 8 ? `<li>+ ${items.length - 8} kayıt daha</li>` : ""}</ul>`;
  };
  el.innerHTML = `
    <p class="eyebrow">Önizleme: ${escapeHTML(preview.project?.title || PNB_PROJECT_TITLE)}</p>
    <div class="import-summary">
      ${countCard("Arşiv birimi", summary.archiveUnits || 0)}
      ${countCard("Dosya", summary.fileCount || 0)}
      ${countCard("Belge", summary.documentCount || 0)}
      ${countCard("Sayfa", summary.pageCount || 0)}
      ${countCard("Kişi", summary.people || 0)}
      ${countCard("Uygunluk satırı", summary.availabilityRows || 0)}
      ${countCard("Uygunluk slotu", summary.availabilitySlotCount || 0)}
      ${countCard("İletişim rutini", summary.communicationPlans || 0)}
    </div>
    <div class="import-checks">
      <div class="check-card ${missingEmails.length ? "warning" : ""}"><strong>E-posta eksikleri (${missingEmails.length})</strong>${sampleList(missingEmails, (item) => `<li>${escapeHTML(item.name || "-")} · satır ${escapeHTML(item.sourceRow || "")}</li>`)}</div>
      <div class="check-card ${duplicates.length ? "warning" : ""}"><strong>Tekrarlanan adlar (${duplicates.length})</strong>${sampleList(duplicates, (item) => `<li>${escapeHTML(item.name || "-")} · ${escapeHTML(item.count || "")} kayıt</li>`)}</div>
      <div class="check-card ${unmatched.length ? "warning" : ""}"><strong>Eşleşmeyen uygunluk (${unmatched.length})</strong>${sampleList(unmatched, (item) => `<li>${escapeHTML(item.name || "-")} · ${escapeHTML(item.slotCount || 0)} slot</li>`)}</div>
      <div class="check-card ${emptyAssigned.length ? "warning" : ""}"><strong>Atanmamış arşiv birimi (${emptyAssigned.length})</strong><p class="muted">Bu normal olabilir; koordinatörler PNB sekmesinden atama yapabilir.</p></div>
    </div>
  `;
  if (commitButton) commitButton.disabled = !isAdmin();
}

async function commitBatchedWrites(writes) {
  // Firestore evaluates rules per write. Sequential writes are slower but avoid
  // batch rule access-call limits during one-time admin imports.
  for (const write of writes) {
    try {
      await setDoc(write.ref, write.data, { merge: true });
    } catch (error) {
      const paths = write.label || write.ref.path;
      throw new Error(`${error.message} (${paths})`);
    }
  }
}

async function commitPnbImport() {
  if (!pnbImportPreview || !isAdmin()) return;
  const message = document.getElementById("pnbImportMessage");
  const button = document.getElementById("pnbCommitBtn");
  try {
    if (button) button.disabled = true;
    if (message) message.textContent = "Firestore aktarımı başladı...";
    const writes = [];
    const people = pnbImportPreview.people || [];
    const availability = pnbImportPreview.availability || [];
    const units = pnbImportPreview.archiveUnits || [];
    const plans = pnbImportPreview.communicationPlans || [];
    const summary = pnbImportPreview.summary || {};
    const emailToUidSeed = new Map();

    writes.push({
      ref: doc(db, "projects", PNB_PROJECT_ID),
      data: {
        id: PNB_PROJECT_ID,
        title: pnbImportPreview.project?.title || PNB_PROJECT_TITLE,
        type: "archive_digitization",
        status: "active",
        department: "Arşiv",
        description: "Pertev Naili Boratav arşiv dijitalleştirme çalışması. Bu proje, genel gönüllü yönetim ortamındaki ilk ayrıntılı arşiv vaka çalışmasıdır.",
        archiveUnitCount: summary.archiveUnits || units.length,
        fileCount: summary.fileCount || 0,
        documentCount: summary.documentCount || 0,
        pageCount: summary.pageCount || 0,
        peopleCount: summary.people || people.length,
        availabilitySlotCount: summary.availabilitySlotCount || 0,
        communicationPlanCount: summary.communicationPlans || plans.length,
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      label: `projects/${PNB_PROJECT_ID}`
    });

    people.forEach((person) => {
      const projectPersonData = cleanData({ ...person, importedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      delete projectPersonData.id;
      writes.push({ ref: doc(db, "projectPeople", person.id), data: projectPersonData, label: `projectPeople/${person.id}` });

      if (!person.email) return;
      const existingUser = findUserByEmail(person.email);
      const uid = existingUser?.uid || `manual_${person.email}`;
      emailToUidSeed.set(person.email, uid);
      if (!existingUser) return;
      const userData = {
        uid,
        email: person.email,
        fullName: person.fullName,
        phone: person.phone || existingUser?.data?.phone || "",
        department: "Arşiv",
        role: existingUser?.data?.role || "volunteer",
        status: existingUser?.data?.status || "approved",
        notes: existingUser?.data?.notes || "",
        skillsText: [person.projectRole, person.profession, person.educationDepartment].filter(Boolean).join(" · "),
        stakeholder: {
          projectId: PNB_PROJECT_ID,
          foundationRole: person.foundationRole || "",
          projectRole: person.projectRole || "",
          expectation: person.expectation || "",
          power: person.power || 0,
          interest: person.interest || 0,
          stakeholderLevel: person.stakeholderLevel || ""
        },
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastSeenAt: existingUser?.data?.lastSeenAt || serverTimestamp()
      };
      if (!existingUser) userData.createdAt = serverTimestamp();
      writes.push({ ref: doc(db, "users", uid), data: userData, label: `users/${uid}` });
    });

    const emailToUid = new Map();
    allUsers.forEach((user) => {
      const email = String(user.data?.email || "").toLowerCase();
      if (email) emailToUid.set(email, user.uid);
    });
    people.forEach((person) => {
      if (person.email && !emailToUid.has(person.email)) emailToUid.set(person.email, emailToUidSeed.get(person.email) || "");
    });

    availability.forEach((item) => {
      const data = cleanData({ ...item, userUid: item.email ? emailToUid.get(item.email) || "" : "", importedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      delete data.id;
      writes.push({ ref: doc(db, "availability", item.id), data, label: `availability/${item.id}` });
    });

    units.forEach((unit) => {
      const assignedToUids = (unit.assignedToEmails || []).map((email) => emailToUid.get(email)).filter(Boolean);
      const data = cleanData({
        ...unit,
        assignedToUids,
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: archiveById[unit.id]?.createdAt || serverTimestamp()
      });
      delete data.id;
      writes.push({ ref: doc(db, "archiveUnits", unit.id), data, label: `archiveUnits/${unit.id}` });
    });

    plans.forEach((plan) => {
      const data = cleanData({ ...plan, importedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      delete data.id;
      writes.push({ ref: doc(db, "communicationPlans", plan.id), data, label: `communicationPlans/${plan.id}` });
    });

    await commitBatchedWrites(writes);
    await logActivity("pnb_import_committed", "project", PNB_PROJECT_ID, {
      archiveUnits: units.length,
      people: people.length,
      availability: availability.length,
      communicationPlans: plans.length
    });
    if (message) message.textContent = `${writes.length} kayıt Firestore'a aktarıldı.`;
    await loadAllUsers();
    await reloadPnb();
  } catch (error) {
    console.error(error);
    if (message) message.textContent = `Hata: ${error.message}`;
  } finally {
    if (button) button.disabled = !pnbImportPreview || !isAdmin();
  }
}

tb?.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (tab) sw(tab.dataset.tab);
});

document.getElementById("signOutBtn")?.addEventListener("click", async () => {
  if (auth) await signOut(auth);
  window.location.href = "../auth/";
});

document.getElementById("deleteAccountBtn")?.addEventListener("click", async () => {
  if (!cu || !db) return;
  if (!confirm("Hesabınız kalıcı olarak silinecek. Emin misiniz?")) return;
  if (!confirm("Bu işlem geri alınamaz. Devam etmek istiyor musunuz?")) return;
  try {
    await deleteDoc(doc(db, "users", cu.uid));
    await signOut(auth);
    window.location.href = "../auth/";
  } catch (error) {
    alert(`Hata: ${error.message}`);
  }
});

document.getElementById("reportImageFiles")?.addEventListener("change", async (event) => {
  for (const file of event.target.files) {
    if (file.size > 5e6) {
      alert(`Maks 5MB: ${file.name}`);
      continue;
    }
    pi.push(await ci(file));
  }
  event.target.value = "";
  uip();
});

document.getElementById("notifBtn")?.addEventListener("click", () => {
  document.getElementById("notifPanel")?.classList.toggle("hidden");
});

document.getElementById("notifReadAll")?.addEventListener("click", async () => {
  if (!cu || !db) return;
  try {
    const snap = await getDocs(query(collection(db, "notifications"), where("toUid", "==", cu.uid), where("read", "==", false), limit(50)));
    await Promise.all(snap.docs.map((item) => updateDoc(doc(db, "notifications", item.id), { read: true })));
    loadNotifs();
  } catch (error) {
    console.error(error);
  }
});

document.getElementById("cancelEditBtn")?.addEventListener("click", rf);
document.getElementById("refreshPnbBtn")?.addEventListener("click", reloadPnb);
document.getElementById("pnbStatusFilter")?.addEventListener("change", renderArchiveUnits);
document.getElementById("pnbCommitBtn")?.addEventListener("click", commitPnbImport);

document.getElementById("pnbImportFile")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  const message = document.getElementById("pnbImportMessage");
  if (!file) return;
  try {
    const text = await file.text();
    pnbImportPreview = JSON.parse(text);
    if (pnbImportPreview.version !== 1 || pnbImportPreview.project?.id !== PNB_PROJECT_ID) {
      throw new Error("Bu dosya PNB import JSON v1 formatında değil.");
    }
    if (message) message.textContent = "Önizleme yüklendi. Kontrol edin, sonra aktarın.";
    renderImportPreview(pnbImportPreview);
  } catch (error) {
    pnbImportPreview = null;
    if (message) message.textContent = `Hata: ${error.message}`;
    const button = document.getElementById("pnbCommitBtn");
    if (button) button.disabled = true;
  }
});

document.addEventListener("click", async (event) => {
  const lightboxImage = event.target.closest(".lightbox-img");
  if (lightboxImage) {
    const lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.onclick = () => lightbox.remove();
    lightbox.innerHTML = `<img src="${lightboxImage.src}"/>`;
    document.body.appendChild(lightbox);
    return;
  }
  const lightbox = event.target.closest(".lightbox");
  if (lightbox) {
    lightbox.remove();
    return;
  }

  const notif = event.target.closest("[data-notif]");
  if (notif) {
    updateDoc(doc(db, "notifications", notif.dataset.notif), { read: true });
    notif.classList.remove("unread");
    sw(notif.dataset.tab || "home");
    document.getElementById("notifPanel")?.classList.add("hidden");
    loadNotifs();
    return;
  }
  if (!event.target.closest("#notifPanel") && !event.target.closest("#notifBtn")) {
    document.getElementById("notifPanel")?.classList.add("hidden");
  }

  const saveArchive = event.target.closest("[data-save-au]");
  if (saveArchive) {
    const unitId = saveArchive.dataset.saveAu;
    const selectedUids = Array.from(document.querySelector(`[data-au-assign="${unitId}"]`)?.selectedOptions || []).map((option) => option.value);
    const selectedEmails = selectedUids.map(userEmail).filter(Boolean).map((email) => email.toLowerCase());
    const status = document.querySelector(`[data-au-status="${unitId}"]`)?.value || "not_started";
    const update = {
      assignedToUids: selectedUids,
      assignedToEmails: selectedEmails,
      status,
      priority: document.querySelector(`[data-au-priority="${unitId}"]`)?.value || "medium",
      dueDate: document.querySelector(`[data-au-due="${unitId}"]`)?.value || null,
      blockerNote: document.querySelector(`[data-au-blocker="${unitId}"]`)?.value.trim() || "",
      updatedAt: serverTimestamp()
    };
    try {
      saveArchive.disabled = true;
      await updateDoc(doc(db, "archiveUnits", unitId), update);
      await logActivity("archive_unit_updated", "archiveUnit", unitId, { status, assignedToUids: selectedUids });
      selectedUids.forEach((uid) => {
        if (uid !== cu.uid) createNotif(uid, "archive_assigned", `PNB arşiv birimi güncellendi: ${archiveLabel(archiveById[unitId])}`, "pnb");
      });
      await reloadPnb();
    } catch (error) {
      alert(`Hata: ${error.message}`);
    } finally {
      saveArchive.disabled = false;
    }
    return;
  }

  const blockArchive = event.target.closest("[data-block-au]");
  if (blockArchive) {
    const unitId = blockArchive.dataset.blockAu;
    const blockerNote = document.querySelector(`[data-vol-blocker="${unitId}"]`)?.value.trim();
    if (!blockerNote) {
      alert("Lütfen engel açıklaması yazın.");
      return;
    }
    try {
      await updateDoc(doc(db, "archiveUnits", unitId), { status: "blocked", blockerNote, updatedAt: serverTimestamp() });
      await logActivity("archive_unit_blocked", "archiveUnit", unitId, { blockerNote });
      allUsers.filter((user) => user.data?.role === "admin" || user.data?.role === "coordinator").forEach((user) => createNotif(user.uid, "archive_blocked", `PNB engel bildirildi: ${archiveLabel(archiveById[unitId])}`, "pnb"));
      await reloadPnb();
    } catch (error) {
      alert(`Hata: ${error.message}`);
    }
    return;
  }

  const reportArchive = event.target.closest("[data-report-au]");
  if (reportArchive) {
    const unitId = reportArchive.dataset.reportAu;
    const unit = archiveById[unitId];
    document.getElementById("archiveUnitSelect").value = unitId;
    document.getElementById("taskId").value = unit ? `PNB ${archiveLabel(unit)}` : "PNB Arşiv";
    sw("reports");
    document.querySelector("#tab-reports")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const createTaskArchive = event.target.closest("[data-create-task-au]");
  if (createTaskArchive) {
    const unitId = createTaskArchive.dataset.createTaskAu;
    const unit = archiveById[unitId];
    if (!unit) return;
    document.getElementById("taskArchiveUnit").value = unitId;
    document.getElementById("taskTitle").value = `PNB ${archiveLabel(unit)}`;
    document.getElementById("taskDepartment").value = "Arşiv";
    document.getElementById("taskDescription").value = `${unit.notes || ""}\n${numberText(unit.documentCount)} belge, ${numberText(unit.pageCount)} sayfa.`;
    document.getElementById("taskPriority").value = unit.priority || "medium";
    sw("tasks");
    document.querySelector("#tab-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const approveButton = event.target.closest("[data-approve]");
  if (approveButton && db) {
    const reportId = approveButton.dataset.approve;
    const textarea = document.querySelector(`[data-review-id="${reportId}"]`);
    const feedbackText = textarea ? textarea.value.trim() : "";
    const report = rd[reportId];
    const feedback = (report?.feedback || []).slice();
    if (feedbackText) feedback.push({ by: cp.fullName || cu.email, date: td(), text: feedbackText });
    try {
      approveButton.disabled = true;
      approveButton.textContent = "...";
      await updateDoc(doc(db, "reports", reportId), { status: "approved", feedback, reviewerUid: cu.uid, updatedAt: serverTimestamp() });
      if (report?.archiveUnitId) {
        await updateDoc(doc(db, "archiveUnits", report.archiveUnitId), { status: "review", latestReportAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      if (report?.userUid && report.userUid !== cu.uid) createNotif(report.userUid, "report_approved", `Raporunuz onaylandı: ${report.taskId || ""}`, "reports");
      await lr();
      await reloadPnb();
    } catch (error) {
      alert(`Hata: ${error.message}`);
      approveButton.disabled = false;
      approveButton.textContent = "Onayla";
    }
    return;
  }

  const revisionButton = event.target.closest("[data-revision]");
  if (revisionButton && db) {
    const reportId = revisionButton.dataset.revision;
    const textarea = document.querySelector(`[data-review-id="${reportId}"]`);
    const feedbackText = textarea ? textarea.value.trim() : "";
    if (!feedbackText) {
      alert("Lütfen düzeltme için geri bildirim yazın.");
      return;
    }
    const report = rd[reportId];
    const feedback = (report?.feedback || []).slice();
    feedback.push({ by: cp.fullName || cu.email, date: td(), text: feedbackText });
    try {
      revisionButton.disabled = true;
      revisionButton.textContent = "...";
      await updateDoc(doc(db, "reports", reportId), { status: "revision_needed", feedback, reviewerUid: cu.uid, updatedAt: serverTimestamp() });
      if (report?.userUid && report.userUid !== cu.uid) createNotif(report.userUid, "report_revision", `Raporunuz için düzeltme istendi: ${report.taskId || ""}`, "reports");
      await lr();
    } catch (error) {
      alert(`Hata: ${error.message}`);
      revisionButton.disabled = false;
      revisionButton.textContent = "Düzeltme İste";
    }
    return;
  }

  const editAnnouncement = event.target.closest("[data-ea]");
  if (editAnnouncement) {
    const snap = await getDoc(doc(db, "announcements", editAnnouncement.dataset.ea));
    if (!snap.exists()) return;
    const data = snap.data();
    document.getElementById("announcementTitle").value = data.title || "";
    document.getElementById("announcementBody").value = data.body || "";
    document.getElementById("announcementAudience").value = data.audience || "all";
    document.getElementById("announcementForm").dataset.editId = editAnnouncement.dataset.ea;
    document.getElementById("announcementMessage").textContent = "Duyuruyu düzenliyorsunuz...";
    sw("announcements");
    return;
  }

  const deleteAnnouncement = event.target.closest("[data-da]");
  if (deleteAnnouncement && db) {
    if (!confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    try {
      deleteAnnouncement.disabled = true;
      deleteAnnouncement.textContent = "...";
      await deleteDoc(doc(db, "announcements", deleteAnnouncement.dataset.da));
      await la();
      await lh();
    } catch (error) {
      alert(`Hata: ${error.message}`);
      deleteAnnouncement.disabled = false;
      deleteAnnouncement.textContent = "Sil";
    }
    return;
  }

  const editTask = event.target.closest("[data-et]");
  if (editTask) {
    const snap = await getDoc(doc(db, "tasks", editTask.dataset.et));
    if (!snap.exists()) return;
    const data = snap.data();
    document.getElementById("taskTitle").value = data.title || "";
    document.getElementById("taskDescription").value = data.description || "";
    document.getElementById("taskDepartment").value = data.department || "";
    document.getElementById("taskArchiveUnit").value = data.archiveUnitId || "";
    document.getElementById("taskAssignedTo").value = data.assignedToUid || "";
    document.getElementById("taskDueDate").value = data.dueDate || "";
    document.getElementById("taskPriority").value = data.priority || "medium";
    document.getElementById("taskForm").dataset.editId = editTask.dataset.et;
    document.getElementById("taskMessage").textContent = "Görevi düzenliyorsunuz...";
    sw("tasks");
    document.querySelector("#tab-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const deleteTask = event.target.closest("[data-dt]");
  if (deleteTask && db) {
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    try {
      deleteTask.disabled = true;
      deleteTask.textContent = "...";
      await deleteDoc(doc(db, "tasks", deleteTask.dataset.dt));
      await lt();
    } catch (error) {
      alert(`Hata: ${error.message}`);
      deleteTask.disabled = false;
      deleteTask.textContent = "Sil";
    }
    return;
  }

  const editReport = event.target.closest("[data-er]");
  if (editReport) {
    const id = editReport.dataset.er;
    const report = rd[id];
    if (!report) return;
    document.getElementById("editReportId").value = id;
    document.getElementById("archiveUnitSelect").value = report.archiveUnitId || "";
    document.getElementById("taskId").value = report.taskId || "";
    document.getElementById("reportDate").value = report.reportDate || "";
    document.getElementById("hours").value = report.hours || 1;
    document.getElementById("summary").value = report.summary || "";
    document.getElementById("reportLinks").value = (report.links || []).join("\n");
    const userSelect = document.getElementById("reportForUser");
    if (userSelect) userSelect.value = report.userUid === cu.uid ? "" : report.userUid || "";
    setSelectedValues("reportCoworker", report.coworkerUids || []);
    pi = (report.images || []).slice();
    uip();
    document.getElementById("reportFormTitle").textContent = "Raporu düzenle";
    document.getElementById("reportSubmitBtn").textContent = "Güncelle";
    document.getElementById("cancelEditBtn").classList.remove("hidden");
    document.querySelector("#tab-reports")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const deleteReport = event.target.closest("[data-dr]");
  if (deleteReport && db) {
    if (!confirm("Bu raporu silmek istediğinize emin misiniz?")) return;
    try {
      deleteReport.disabled = true;
      deleteReport.textContent = "...";
      await deleteDoc(doc(db, "reports", deleteReport.dataset.dr));
      await lr();
    } catch (error) {
      alert(`Hata: ${error.message}`);
      deleteReport.disabled = false;
      deleteReport.textContent = "Sil";
    }
    return;
  }

  const removeImage = event.target.closest("[data-ri]");
  if (removeImage) {
    pi.splice(Number(removeImage.dataset.ri), 1);
    uip();
    return;
  }

  const applicationAction = event.target.closest("button[data-action]");
  if (applicationAction && db) {
    try {
      applicationAction.disabled = true;
      applicationAction.textContent = "...";
      await updateDoc(doc(db, "users", applicationAction.dataset.uid), {
        status: applicationAction.dataset.action === "approve" ? "approved" : "blocked",
        updatedAt: serverTimestamp()
      });
      const card = document.getElementById(`user-${applicationAction.dataset.uid}`);
      if (card) {
        card.style.opacity = "0.4";
        card.innerHTML = `<div class="user-info"><strong>${applicationAction.dataset.action === "approve" ? "Onaylandı" : "Engellendi"}</strong></div>`;
      }
    } catch (error) {
      alert(`Hata: ${error.message}`);
      applicationAction.disabled = false;
    }
    return;
  }

  const saveUser = event.target.closest("button[data-sv]");
  if (saveUser && db) {
    const uid = saveUser.dataset.sv;
    const row = document.getElementById(`urow-${uid}`);
    try {
      saveUser.disabled = true;
      saveUser.textContent = "...";
      await updateDoc(doc(db, "users", uid), {
        fullName: row.querySelector(`[data-fn="${uid}"]`).value.trim(),
        email: row.querySelector(`[data-em="${uid}"]`).value.trim().toLowerCase(),
        phone: row.querySelector(`[data-ph="${uid}"]`).value.trim(),
        department: row.querySelector(`[data-dp="${uid}"]`).value,
        role: row.querySelector(`[data-ru="${uid}"]`).value,
        status: row.querySelector(`[data-su="${uid}"]`).value,
        skillsText: row.querySelector(`[data-sk="${uid}"]`).value.trim(),
        coordinatorNotes: row.querySelector(`[data-cn="${uid}"]`).value.trim(),
        updatedAt: serverTimestamp()
      });
      saveUser.textContent = "OK";
      await loadAllUsers();
      renderPnb();
      setTimeout(() => {
        saveUser.textContent = "Kaydet";
        saveUser.disabled = false;
      }, 1500);
    } catch (error) {
      alert(`Hata: ${error.message}`);
      saveUser.textContent = "Kaydet";
      saveUser.disabled = false;
    }
    return;
  }

  const deleteUser = event.target.closest("button[data-del-user]");
  if (deleteUser && db) {
    if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
    try {
      deleteUser.disabled = true;
      deleteUser.textContent = "...";
      await deleteDoc(doc(db, "users", deleteUser.dataset.delUser));
      document.getElementById(`urow-${deleteUser.dataset.delUser}`)?.remove();
    } catch (error) {
      alert(`Hata: ${error.message}`);
      deleteUser.disabled = false;
      deleteUser.textContent = "Sil";
    }
  }
});

document.getElementById("reportForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cu || !db) return;
  const editId = document.getElementById("editReportId").value;
  const userSelect = document.getElementById("reportForUser");
  const targetUid = userSelect && userSelect.value ? userSelect.value : cu.uid;
  const targetUser = allUsers.find((user) => user.uid === targetUid);
  const targetEmail = targetUser ? targetUser.data.email || "" : cu.email || "";
  const archiveUnitId = document.getElementById("archiveUnitSelect").value || "";
  const coworkerUids = getSelectedValues("reportCoworker");
  const data = {
    taskId: document.getElementById("taskId").value.trim(),
    archiveUnitId,
    projectId: archiveUnitId ? PNB_PROJECT_ID : "",
    summary: document.getElementById("summary").value.trim(),
    hours: Number(document.getElementById("hours").value || 0),
    reportDate: document.getElementById("reportDate").value,
    links: pl(document.getElementById("reportLinks").value),
    images: pi.slice(),
    coworkerUids,
    updatedAt: serverTimestamp()
  };
  try {
    if (editId) {
      data.status = "submitted";
      await updateDoc(doc(db, "reports", editId), data);
      document.getElementById("reportMessage").textContent = "Rapor güncellendi!";
    } else {
      data.userUid = targetUid;
      data.userEmail = targetEmail;
      data.status = "submitted";
      data.reviewerUid = null;
      data.feedback = [];
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "reports"), data);
      document.getElementById("reportMessage").textContent = "Rapor kaydedildi!";
      allUsers.forEach((user) => {
        if ((user.data.role === "admin" || user.data.role === "coordinator") && user.uid !== cu.uid) {
          createNotif(user.uid, "report_submitted", `Yeni rapor gönderildi: ${data.taskId} - ${findUserName(targetUid)}`, "reports");
        }
      });
    }
    if (archiveUnitId) {
      await updateDoc(doc(db, "archiveUnits", archiveUnitId), {
        status: archiveById[archiveUnitId]?.status === "not_started" || archiveById[archiveUnitId]?.status === "assigned" ? "in_progress" : archiveById[archiveUnitId]?.status || "in_progress",
        latestReportAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    rf();
    setTimeout(() => { document.getElementById("reportMessage").textContent = ""; }, 3000);
    await lr();
    await reloadPnb();
  } catch (error) {
    document.getElementById("reportMessage").textContent = `Hata: ${error.message}`;
  }
});

document.getElementById("taskForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cu || !db) return;
  const editId = event.target.dataset.editId || "";
  const assigneeSelect = document.getElementById("taskAssignedTo");
  const assignedUid = assigneeSelect ? assigneeSelect.value || null : null;
  const assignedEmail = assignedUid ? userEmail(assignedUid) : "";
  const archiveUnitId = document.getElementById("taskArchiveUnit").value || "";
  const data = {
    title: document.getElementById("taskTitle").value.trim(),
    description: document.getElementById("taskDescription").value.trim(),
    department: document.getElementById("taskDepartment").value,
    archiveUnitId,
    projectId: archiveUnitId ? PNB_PROJECT_ID : "",
    assignedToUid: assignedUid,
    assignedToEmail: assignedEmail,
    dueDate: document.getElementById("taskDueDate").value || null,
    priority: document.getElementById("taskPriority").value,
    status: "open",
    updatedAt: serverTimestamp()
  };
  try {
    if (editId) {
      await updateDoc(doc(db, "tasks", editId), data);
      document.getElementById("taskMessage").textContent = "Görev güncellendi!";
      delete event.target.dataset.editId;
    } else {
      data.createdByUid = cu.uid;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "tasks"), data);
      document.getElementById("taskMessage").textContent = "Görev oluşturuldu!";
    }
    if (archiveUnitId && assignedUid) {
      await updateDoc(doc(db, "archiveUnits", archiveUnitId), {
        assignedToUids: [assignedUid],
        assignedToEmails: assignedEmail ? [assignedEmail.toLowerCase()] : [],
        status: "assigned",
        dueDate: data.dueDate,
        priority: data.priority,
        updatedAt: serverTimestamp()
      });
    }
    if (assignedUid && assignedUid !== cu.uid) createNotif(assignedUid, "task_assigned", `Size yeni görev atandı: ${data.title}`, "tasks");
    event.target.reset();
    setTimeout(() => { document.getElementById("taskMessage").textContent = ""; }, 3000);
    await lt();
    await reloadPnb();
  } catch (error) {
    document.getElementById("taskMessage").textContent = `Hata: ${error.message}`;
  }
});

document.getElementById("addUserForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cu || !db) return;
  const email = document.getElementById("addUserEmail").value.trim().toLowerCase();
  const userData = {
    email,
    fullName: document.getElementById("addUserName").value.trim(),
    department: document.getElementById("addUserDepartment").value,
    role: document.getElementById("addUserRole").value,
    phone: document.getElementById("addUserPhone").value.trim(),
    status: "approved",
    notes: "",
    uid: `manual_${email}`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp()
  };
  try {
    await setDoc(doc(db, "users", `manual_${email}`), userData, { merge: true });
    await setDoc(doc(db, "preregistered", email), {
      email,
      fullName: userData.fullName,
      department: userData.department,
      role: userData.role,
      phone: userData.phone,
      status: "approved",
      createdByUid: cu.uid,
      createdAt: serverTimestamp()
    }, { merge: true });
    event.target.reset();
    document.getElementById("addUserMessage").textContent = "Kullanıcı eklendi!";
    setTimeout(() => { document.getElementById("addUserMessage").textContent = ""; }, 3000);
    await loadAllUsers();
    await lu();
    renderPnb();
  } catch (error) {
    document.getElementById("addUserMessage").textContent = `Hata: ${error.message}`;
  }
});

document.getElementById("announcementForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cu || !db) return;
  const editId = event.target.dataset.editId || "";
  const data = {
    title: document.getElementById("announcementTitle").value.trim(),
    body: document.getElementById("announcementBody").value.trim(),
    audience: document.getElementById("announcementAudience").value,
    department: "",
    updatedAt: serverTimestamp()
  };
  try {
    if (editId) {
      await updateDoc(doc(db, "announcements", editId), data);
      document.getElementById("announcementMessage").textContent = "Duyuru güncellendi!";
      delete event.target.dataset.editId;
    } else {
      data.createdByUid = cu.uid;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "announcements"), data);
      document.getElementById("announcementMessage").textContent = "Duyuru yayınlandı!";
      allUsers.forEach((user) => {
        if (user.uid !== cu.uid) createNotif(user.uid, "announcement", `Yeni duyuru: ${data.title}`, "announcements");
      });
    }
    event.target.reset();
    setTimeout(() => { document.getElementById("announcementMessage").textContent = ""; }, 3000);
    await la();
    await lh();
  } catch (error) {
    document.getElementById("announcementMessage").textContent = `Hata: ${error.message}`;
  }
});

if (!auth || !db) {
  ld.innerHTML = `<p class="empty">${missingConfigMessage}</p>`;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../auth/";
      return;
    }
    cu = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists() || snap.data().status !== "approved") {
      window.location.href = "../auth/";
      return;
    }
    cp = snap.data();
    const staff = isStaff();
    hu.textContent = cp.fullName || user.email;
    if (staff) {
      document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.remove("hidden"));
      document.getElementById("adminTaskForm")?.classList.remove("hidden");
      document.getElementById("adminAnnouncementForm")?.classList.remove("hidden");
      document.getElementById("reportUserRow")?.classList.remove("hidden");
    }
    if (!isAdmin()) {
      document.querySelector('[data-tab="pnb-import"]')?.classList.add("hidden");
    }
    await loadAllUsers();
    await reloadPnb();
    document.getElementById("reportDate").value = td();
    ld.classList.add("hidden");
    tb.classList.remove("hidden");
    await lh();
    await lt();
    await lr();
    await la();
    if (staff) {
      await lp();
      await lu();
    }
    loadNotifs();
  });
}
