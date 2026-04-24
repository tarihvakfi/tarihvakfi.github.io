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
  updateDoc,
  writeBatch,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { escapeHTML, formatDate, badge } from "../js/helpers.js";

const PNB_PROJECT_ID = "pnb";
const PNB_PROJECT_TITLE = "Pertev Naili Boratav Arşivi Dijitalleştirme";

let cu = null;
let cp = null;
let rd = {};
let pi = [];
let allUsers = [];
let taskItems = [];
let announcementItems = [];
let archiveUnits = [];
let archiveById = {};
let availabilityRecords = [];
let communicationPlans = [];
let pnbImportPreview = null;
let pendingApplicationCount = 0;

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
  const target = name === "tasks" ? "pnb" : name;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === target));
  document.querySelectorAll(".tab-content").forEach((section) => section.classList.toggle("hidden", section.id !== `tab-${target}`));
  // Stylish home gets a near-white body background; other tabs revert.
  document.body.classList.toggle("sv-active", target === "home");
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
  // Prefer the unit's own title if present; fall back to a structured identifier;
  // last resort is "Birim #N" so the UI never shows "- / - · Kutu -".
  if (unit.title && String(unit.title).trim()) return String(unit.title).trim();
  const src = unit.sourceCode && String(unit.sourceCode).trim();
  const series = unit.seriesNo && String(unit.seriesNo).trim();
  const box = unit.boxNo && String(unit.boxNo).trim();
  if (src && (series || box)) return `${src}${series ? " / " + series : ""}${box ? " · Kutu " + box : ""}`;
  if (box) return `Kutu ${box}`;
  // Deterministic short identifier based on the doc id, readable but not ugly.
  const shortId = (unit.id || "").slice(-4).toUpperCase();
  return shortId ? `Birim #${shortId}` : "Birim";
}

// True when a unit has no human-friendly label data — use to show a muted
// "İsim/kaynak bilgisi eksik" hint next to the computed fallback.
function archiveLabelIncomplete(unit) {
  if (!unit) return false;
  const hasTitle = unit.title && String(unit.title).trim();
  const hasAnyId = (unit.sourceCode && String(unit.sourceCode).trim()) || (unit.boxNo && String(unit.boxNo).trim());
  return !hasTitle && !hasAnyId;
}

function archiveTotals() {
  return archiveUnits.reduce((acc, unit) => {
    acc.units += 1;
    acc.pages += Number(unit.pageCount || 0);
    acc.done += unit.status === "done" ? 1 : 0;
    acc.blocked += unit.status === "blocked" ? 1 : 0;
    acc.review += unit.status === "review" ? 1 : 0;
    acc.unassigned += (unit.assignedToUids || []).length || (unit.assignedToEmails || []).length ? 0 : 1;
    return acc;
  }, { units: 0, pages: 0, done: 0, blocked: 0, review: 0, unassigned: 0 });
}

function assignedOpenArchiveUnits() {
  return archiveUnits.filter((unit) => !["done", "blocked"].includes(unit.status || "not_started"));
}

function setRoleShell(staff) {
  document.body.classList.toggle("volunteer-shell", !staff);
  document.body.classList.toggle("staff-shell", staff);
  const labels = staff
    ? { home: "Bugün", pnb: "İşler", reports: "Rapor Yaz", announcements: "Duyurular" }
    : { home: "Bugün", pnb: "İşim", reports: "Rapor", announcements: "Duyuru" };
  Object.entries(labels).forEach(([tab, label]) => {
    const button = document.querySelector(`[data-tab="${tab}"]`);
    if (button) button.textContent = label;
  });
}

function renderVolunteerMission(nextWork, assignedUnits, openTasks) {
  const unit = assignedUnits[0];
  if (unit) {
    nextWork.innerHTML = `<div class="today-detail">
      <div class="today-facts">
        <span><strong>${escapeHTML(statusLabel(unit.status || "not_started"))}</strong> durum</span>
        <span><strong>${numberText(unit.pageCount)}</strong> sayfa</span>
        <span><strong>${numberText(unit.documentCount)}</strong> belge</span>
      </div>
      ${unit.notes ? `<p>${escapeHTML(unit.notes)}</p>` : `<p>Çalışmayı tamamladığında kısa bir rapor bırakman yeterli.</p>`}
    </div>`;
    return;
  }

  const taskItem = openTasks[0];
  if (taskItem) {
    const task = taskItem.data || {};
    nextWork.innerHTML = `<div class="today-detail">
      <div class="today-facts">
        <span><strong>${escapeHTML(statusLabel(task.status || "open"))}</strong> durum</span>
        <span><strong>${escapeHTML(task.department || "Genel")}</strong> alan</span>
        ${task.dueDate ? `<span><strong>${formatDate(task.dueDate)}</strong> son</span>` : ""}
      </div>
      ${task.description ? `<p>${escapeHTML(task.description)}</p>` : `<p>Çalışmayı tamamladığında kısa bir rapor bırakman yeterli.</p>`}
    </div>`;
    return;
  }

  nextWork.innerHTML = `<div class="today-detail empty">
    <p>Yeni iş gelince burada görünecek. Şimdilik duyurulara bakman yeterli.</p>
    <button class="btn btn-secondary" type="button" data-go-tab="announcements">Duyurulara bak</button>
  </div>`;
}

function renderManagementOverview() {
  const actions = document.getElementById("managementActions");
  if (!actions) return;
  if (!isStaff()) {
    actions.innerHTML = "";
    return;
  }
  const totals = archiveTotals();
  const reports = Object.values(rd || {});
  const submittedReports = reports.filter((report) => (report.status || "submitted") === "submitted").length;
  const approvedCount = approvedUsers().length;
  const capacityCount = availabilityRecords.filter((item) => Number(item.slotCount || 0) > 0).length;
  const progressText = totals.units ? `${numberText(totals.done)}/${numberText(totals.units)}` : "0";
  const items = [
    ["İlerleme", progressText, `${percent(totals.done, totals.units)}% tamamlandı`, "pnb", "", false],
    ["Ekip", approvedCount, "Onaylı kişi", "management", "userDirectoryPanel", false],
    ["Kapasite", capacityCount, "Uygunluğu görünen kişi", "management", "capacityPanel", false],
    ["Başvurular", pendingApplicationCount, "Yeni gönüllü onayı", "management", "pendingPanel", pendingApplicationCount > 0],
    ["Atanmamış işler", totals.unassigned, "Gönüllüye bağlanacak iş", "pnb", "", totals.unassigned > 0],
    ["Raporlar", submittedReports, "Kontrol bekleyen rapor", "reports", "", submittedReports > 0],
    ["Engeller", totals.blocked, "Çözülmesi gereken takılma", "pnb", "", totals.blocked > 0]
  ];
  // Add a "stalled volunteers" tile if anyone is 14+ days inactive; gives admins a
  // one-click hop to the activity panel without them having to go looking.
  const stalledCount = volunteerPool().filter((u) => {
    const bucket = bucketForUser(u);
    return bucket === "slow" || bucket === "stalled";
  }).length;
  items.push(["Yavaşlayan / durmuş gönüllü", stalledCount, "14+ gün rapor yazmamış", "management", "activityPanel", stalledCount > 0]);

  actions.innerHTML = items.map(([label, value, note, tab, scrollTo, needsAttention]) => (
    `<button class="management-task${needsAttention ? " needs-attention" : ""}" type="button" data-go-tab="${tab}"${scrollTo ? ` data-scroll-to="${scrollTo}"` : ""}>
      <span class="management-task-count">${escapeHTML(String(value))}</span>
      <span class="management-task-main">${escapeHTML(label)}</span>
      <span class="management-task-note">${escapeHTML(note)}</span>
    </button>`
  )).join("");
  renderActivityPanel();
}

// --- Option B redesign: home lanes + queue CTA + stats strip ---

// Render the compact stats strip under the hero. Volunteer sees their own numbers;
// staff sees the team's numbers. Tabular nums for clean alignment.
function renderHomeStats() {
  const strip = document.getElementById("homeStatsStrip");
  if (!strip) return;
  const stats = [];
  if (isStaff()) {
    const totals = archiveTotals();
    const approved = approvedUsers().length;
    const reports = Object.values(rd || {});
    const pagesDone = reports.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
    stats.push([numberText(totals.units), "iş paketi"]);
    stats.push([numberText(totals.pages), "toplam sayfa"]);
    stats.push([numberText(approved), "onaylı gönüllü"]);
    stats.push([numberText(reports.length), "rapor"]);
    stats.push([numberText(pagesDone), "bu ay tasnif edilen sayfa"]);
  } else {
    const myReports = Object.values(rd || {}).filter((r) => r.userUid === cu?.uid);
    const monthAgo = Date.now() - 30 * 86400000;
    const recentReports = myReports.filter((r) => {
      const t = toDateFromTs(r.createdAt)?.getTime() || 0;
      return t >= monthAgo;
    });
    const monthPages = recentReports.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
    const totalPages = myReports.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
    stats.push([numberText(recentReports.length), "son 30 gün rapor"]);
    stats.push([numberText(monthPages), "sayfa tasnif ettin"]);
    stats.push([numberText(myReports.length), "toplam rapor"]);
    stats.push([numberText(totalPages), "toplam sayfa"]);
  }
  strip.innerHTML = stats.map((s, i) => (
    `${i > 0 ? '<span class="sep">·</span>' : ""}<span class="stat"><strong>${escapeHTML(String(s[0]))}</strong>${escapeHTML(String(s[1]))}</span>`
  )).join("");
}

// Self-claim banner for volunteers. Renders above the wa-prog hero inside
// the sv-home frame. Three modes driven by how many active units the
// volunteer already has:
//   0 open → "Bu iş paketi boş duruyor, istersen sen al" + claim button
//   1 open → hidden (they have work)
//   2+ open → cap reached, list each open unit with a Bırak button
function renderHomeQueueCta() {
  const oldCta = document.getElementById("homeQueueCta");
  if (oldCta) oldCta.classList.add("hidden");
  const banner = document.getElementById("svSelfClaim");
  if (!banner) return;
  if (isStaff() || !cu) { banner.classList.add("hidden"); banner.innerHTML = ""; return; }

  const myEmail = String(cu.email || "").toLowerCase();
  const isMine = (unit) => (unit.assignedToUids || []).includes(cu.uid) ||
    (myEmail && (unit.assignedToEmails || []).map((e) => String(e).toLowerCase()).includes(myEmail));
  const myOpen = archiveUnits.filter((unit) => isMine(unit) && !["done", "blocked"].includes(unit.status || "not_started"));

  if (myOpen.length >= 2) {
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div class="sv-selfclaim-text">
        <strong>Önce birini bitir ya da bırak</strong>
        <span>İki iş paketin birden açık. Biri kapanmadan yenisini alamazsın.</span>
      </div>
      <div class="sv-selfclaim-list">
        ${myOpen.map((u) => `
          <div class="sv-selfclaim-row">
            <div class="sv-selfclaim-row-t">${escapeHTML(archiveLabel(u))}</div>
            <button type="button" class="btn btn-secondary btn-sm" data-self-release="${escapeHTML(u.id)}">Bırak</button>
          </div>`).join("")}
      </div>`;
    return;
  }

  if (myOpen.length === 1) {
    banner.classList.add("hidden");
    banner.innerHTML = "";
    return;
  }

  const next = pickNextQueueUnit();
  if (!next) {
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div class="sv-selfclaim-text">
        <strong>Şu an boş iş paketi yok</strong>
        <span>Koordinatör yeni paket eklediğinde burada görünecek.</span>
      </div>`;
    return;
  }

  const bits = [archiveLabel(next)];
  if (next.pageCount) bits.push(`${numberText(next.pageCount)} sayfa`);
  if (next.priority === "high") bits.push("Yüksek öncelik");
  banner.classList.remove("hidden");
  banner.innerHTML = `
    <div class="sv-selfclaim-text">
      <strong>Bu iş paketi boş duruyor, istersen sen al</strong>
      <span>${escapeHTML(bits.join(" · "))}</span>
    </div>
    <div class="sv-selfclaim-cta">
      <button type="button" class="btn btn-primary" data-self-claim="${escapeHTML(next.id)}">Bu işi ben alayım</button>
    </div>`;
}

// Volunteer claims an unassigned unit for themselves. Two writes: first adds
// them to the assignee arrays (permitted by the self-claim rule), then
// promotes the unit from not_started → assigned and touches latestReportAt
// (permitted by the normal assigned-volunteer rule, which now sees them as
// assigned). Logs an activity entry and opens the unit channel.
async function handleSelfClaim(btn) {
  if (!cu || !db || isStaff()) return;
  const unitId = btn.dataset.selfClaim;
  if (!unitId) return;
  const unit = archiveById[unitId];
  if (!unit) return;
  const email = String(cu.email || "").toLowerCase();
  const myEmail = email;
  const isMine = (unit.assignedToUids || []).includes(cu.uid) ||
    (myEmail && (unit.assignedToEmails || []).map((e) => String(e).toLowerCase()).includes(myEmail));
  const hasAssignees = (unit.assignedToUids || []).length || (unit.assignedToEmails || []).length;
  if (isMine || hasAssignees) return;

  const myOpen = archiveUnits.filter((u) => {
    const mine = (u.assignedToUids || []).includes(cu.uid) ||
      (myEmail && (u.assignedToEmails || []).map((e) => String(e).toLowerCase()).includes(myEmail));
    return mine && !["done", "blocked"].includes(u.status || "not_started");
  });
  if (myOpen.length >= 2) {
    alert("Önce birini bitir ya da bırak. Aynı anda en fazla 2 iş paketi alabilirsin.");
    return;
  }

  btn.disabled = true;
  const prevLabel = btn.textContent;
  btn.textContent = "Alınıyor…";
  try {
    await updateDoc(doc(db, "archiveUnits", unitId), {
      assignedToUids: arrayUnion(cu.uid),
      assignedToEmails: arrayUnion(email)
    });
    const followUp = { latestReportAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if ((unit.status || "not_started") === "not_started") followUp.status = "assigned";
    await updateDoc(doc(db, "archiveUnits", unitId), followUp);
    await logActivity("archive_unit_self_claimed", "archiveUnit", unitId, {
      title: archiveLabel(unit),
      previousStatus: unit.status || "not_started"
    });
    await reloadPnb();
    openUnitChannel(unitId);
  } catch (error) {
    alert(`Alınamadı: ${error.message}`);
    btn.disabled = false;
    btn.textContent = prevLabel;
  }
}

// Volunteer releases a unit they previously self-claimed. Removes just them
// from assignedToUids/Emails; leaves status/notes alone (coordinator can
// tidy up). Permitted by the self-release rule.
async function handleSelfRelease(btn) {
  if (!cu || !db || isStaff()) return;
  const unitId = btn.dataset.selfRelease;
  if (!unitId) return;
  const unit = archiveById[unitId];
  if (!unit) return;
  const email = String(cu.email || "").toLowerCase();
  btn.disabled = true;
  const prevLabel = btn.textContent;
  btn.textContent = "Bırakılıyor…";
  try {
    await updateDoc(doc(db, "archiveUnits", unitId), {
      assignedToUids: arrayRemove(cu.uid),
      assignedToEmails: arrayRemove(email)
    });
    await logActivity("archive_unit_self_released", "archiveUnit", unitId, {
      title: archiveLabel(unit)
    });
    await reloadPnb();
  } catch (error) {
    alert(`Bırakılamadı: ${error.message}`);
    btn.disabled = false;
    btn.textContent = prevLabel;
  }
}

// Pick the next archive unit a volunteer could reasonably pick up: unassigned,
// not blocked or done, highest priority first, then oldest updated.
function pickNextQueueUnit() {
  const candidates = archiveUnits.filter((unit) => {
    const status = unit.status || "not_started";
    if (["done", "blocked", "review"].includes(status)) return false;
    const hasAssignees = (unit.assignedToUids || []).length || (unit.assignedToEmails || []).length;
    return !hasAssignees;
  });
  const priorityRank = { high: 3, medium: 2, low: 1 };
  candidates.sort((a, b) => {
    const pa = priorityRank[a.priority] || 2;
    const pb = priorityRank[b.priority] || 2;
    if (pa !== pb) return pb - pa;
    const ua = toDateFromTs(a.updatedAt)?.getTime() || 0;
    const ub = toDateFromTs(b.updatedAt)?.getTime() || 0;
    return ua - ub; // oldest first
  });
  return candidates[0] || null;
}

// Lane renderer: row rendering shared by all three lanes.
function renderLaneItem(title, hint, right, clickHandler) {
  return `<div class="lane-item" ${clickHandler}>
    <div class="li-main"><div class="li-title">${escapeHTML(title)}</div>${hint ? `<div class="li-hint">${escapeHTML(hint)}</div>` : ""}</div>
    <div class="li-right">${escapeHTML(right || "")}</div>
  </div>`;
}

function renderHomeLanes() {
  const now = document.getElementById("laneNow");
  const next = document.getElementById("laneNext");
  const done = document.getElementById("laneDone");
  const nowCount = document.getElementById("laneNowCount");
  const nextCount = document.getElementById("laneNextCount");
  const doneCount = document.getElementById("laneDoneCount");
  if (!now || !next || !done) return;

  let nowItems = [];
  let nextItems = [];
  let doneItems = [];

  if (isStaff()) {
    // Staff view: team-wide operations snapshot.
    nowItems = archiveUnits
      .filter((u) => ["in_progress", "review"].includes(u.status || ""))
      .sort((a, b) => (toDateFromTs(b.latestReportAt)?.getTime() || 0) - (toDateFromTs(a.latestReportAt)?.getTime() || 0))
      .slice(0, 5);
    nextItems = archiveUnits
      .filter((u) => {
        const s = u.status || "not_started";
        if (["done", "blocked"].includes(s)) return false;
        return !(u.assignedToUids || []).length && !(u.assignedToEmails || []).length;
      })
      .slice(0, 5);
    doneItems = archiveUnits.filter((u) => u.status === "done").slice(0, 5);
  } else {
    // Volunteer view: personal.
    const uid = cu?.uid;
    const email = (cu?.email || "").toLowerCase();
    const isMine = (u) => (u.assignedToUids || []).includes(uid) ||
      (email && (u.assignedToEmails || []).map((e) => String(e).toLowerCase()).includes(email));
    nowItems = archiveUnits.filter((u) => isMine(u) && !["done", "blocked"].includes(u.status || ""));
    // My recent quality reports for units (hints of the next step for me)
    const next3 = archiveUnits
      .filter((u) => !isMine(u) && !(u.assignedToUids || []).length && !(u.assignedToEmails || []).length && !["done", "blocked"].includes(u.status || ""))
      .slice(0, 5);
    nextItems = next3;
    // Biten: from my reports in the last 60 days, show the unique units I completed.
    const myReports = Object.values(rd || {}).filter((r) => r.userUid === uid);
    const recentIds = new Set(myReports
      .filter((r) => r.workStatus === "unit_done" || (r.archiveUnitId && archiveById[r.archiveUnitId]?.status === "done"))
      .map((r) => r.archiveUnitId)
      .filter(Boolean));
    doneItems = Array.from(recentIds).map((id) => archiveById[id]).filter(Boolean).slice(0, 5);
  }

  const toRow = (u) => {
    const label = archiveLabel(u);
    const incomplete = archiveLabelIncomplete(u);
    const status = statusLabel(u.status || "not_started");
    const progress = percent(u.completedDocumentCount || u.completedFileCount || 0, u.documentCount || u.fileCount || 0);
    const lastReport = toDateFromTs(u.latestReportAt);
    const when = lastReport ? daysSinceLabel(daysSince(lastReport)) : (u.status === "done" ? "Tamamlandı" : "—");
    const hint = incomplete ? "İsim/kaynak eksik" : `${status} · ${progress}%`;
    return `<div class="lane-item" data-drill-unit="${escapeHTML(u.id)}" role="button" tabindex="0">
      <div class="li-main"><div class="li-title">${escapeHTML(label)}</div><div class="li-hint">${escapeHTML(hint)}</div></div>
      <div class="li-right">${escapeHTML(when)}</div>
    </div>`;
  };

  now.innerHTML = nowItems.length ? nowItems.map(toRow).join("") : '<p class="lane-empty">Şu an aktif iş yok.</p>';
  next.innerHTML = nextItems.length ? nextItems.map(toRow).join("") : '<p class="lane-empty">Sıradaki iş yok.</p>';
  done.innerHTML = doneItems.length ? doneItems.map(toRow).join("") : '<p class="lane-empty">Henüz bitmiş iş yok.</p>';
  if (nowCount) nowCount.textContent = nowItems.length;
  if (nextCount) nextCount.textContent = nextItems.length;
  if (doneCount) doneCount.textContent = doneItems.length;
}

// "3 gün önce" / "dün" / "bugün" in Turkish.
// --- Stylish editorial home (sv-*) ---
// A single-screen command center: hero with the one number that matters,
// three pre-decided actions, minimal three-lane work list, live activity pulse.
// Reuses existing data. No schema changes.

function renderStylishHome() {
  const home = document.getElementById("tab-home");
  if (!home) return;
  // Ensure page-level body gets the near-white background while this tab is shown.
  if (!home.classList.contains("hidden")) document.body.classList.add("sv-active");
  else document.body.classList.remove("sv-active");

  // --- Hero: project name, % done, sub-line, 12-week sparkline ---
  const totals = archiveTotals();
  const totalPages = totals.pages || archiveUnits.reduce((acc, u) => acc + (Number(u.pageCount) || 0), 0);
  const reports = Object.values(rd || {});
  const pagesDoneTotal = reports.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
  const overallPct = totalPages > 0 ? Math.max(0, Math.min(100, Math.round((pagesDoneTotal / totalPages) * 100))) : percent(totals.done, totals.units);

  const setT = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setT("svHeroPct", String(overallPct));
  setT("svHeroEyebrow", "Pertev Naili Boratav Arşivi");
  setT("waProgEyebrow", "Pertev Naili Boratav Arşivi");

  // Greeting: "Merhaba, <first name>" + today's date in Turkish
  const firstName = (cp?.fullName || "").split(" ")[0] || "hoş geldin";
  setT("svGreetName", `Merhaba, ${firstName}`);
  const today = new Date();
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  setT("svGreetSub", `Tarih Vakfı · ${today.getDate()} ${months[today.getMonth()]}`);

  const approvedCount = approvedUsers().length;
  const monthAgo = Date.now() - 30 * 86400000;
  const monthReports = reports.filter((r) => (toDateFromTs(r.createdAt)?.getTime() || 0) >= monthAgo);
  const monthPages = monthReports.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
  const activeVolunteers = new Set(monthReports.map((r) => r.userUid).filter(Boolean)).size;
  const heroLine = document.getElementById("svHeroLine");
  if (heroLine) {
    heroLine.innerHTML = `${numberText(totalPages)} sayfadan <strong>${numberText(pagesDoneTotal)}</strong> tasnif edildi · bu hafta <strong>+${numberText(0)} sayfa</strong>`;
    // Recompute weekly for hero (same value used below for the weekly tile).
    const nowMs = Date.now();
    const weekMs = 7 * 86400000;
    const thisWeek = reports.filter((r) => (toDateFromTs(r.createdAt)?.getTime() || 0) >= nowMs - weekMs);
    const thisPages = thisWeek.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
    heroLine.innerHTML = `${numberText(totalPages)} sayfadan <strong>${numberText(pagesDoneTotal)}</strong> tasnif edildi · bu hafta <strong>+${numberText(thisPages)} sayfa</strong>`;
  }

  // Fourth action tile: active volunteers in the last 7 days
  const weekMs2 = 7 * 86400000;
  const weekReports = reports.filter((r) => (toDateFromTs(r.createdAt)?.getTime() || 0) >= Date.now() - weekMs2);
  const weekActive = new Set(weekReports.map((r) => r.userUid).filter(Boolean)).size;
  setT("svTeamVal", `${numberText(weekActive)} kişi`);
  setT("svTeamSub", `son 7 günde ${numberText(weekReports.length)} rapor yazıldı`);

  // Brand title reflects role
  setT("svProjectTitle", isStaff() ? "Tarih Vakfı · Yönetim panosu" : "Tarih Vakfı · Çalışma panosu");

  // Avatar initials from current user
  const av = document.getElementById("svAvatar");
  if (av && cp) {
    const name = cp.fullName || cp.email || "";
    const initials = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "·";
    av.textContent = initials;
  }

  // --- Sparkline: pages/week for last 12 weeks (Monday-start buckets) ---
  renderSparkline(reports);

  // --- Action cards ---
  // 1) Sıradaki iş: volunteers see next-for-them; staff see next unassigned.
  const nextUnit = pickNextQueueUnit();
  const nextBtn = document.getElementById("svActNext");
  const waCta = document.getElementById("waCta");
  if (nextUnit) {
    setT("svNextTitle", archiveLabel(nextUnit));
    const bits = [];
    if (nextUnit.boxNo) bits.push(`Kutu ${nextUnit.boxNo}`);
    if (nextUnit.pageCount) bits.push(`${numberText(nextUnit.pageCount)} sayfa`);
    if (nextUnit.priority === "high") bits.push("Yüksek öncelik");
    setT("svNextSub", bits.join(" · "));
    if (nextBtn) nextBtn.dataset.unitId = nextUnit.id;
    // Populate the persistent "Başla →" CTA ribbon at the bottom of Bugün
    setT("waCtaTitle", "Sıradaki işe başla");
    const ctaBits = [archiveLabel(nextUnit)];
    if (nextUnit.pageCount) ctaBits.push(`${numberText(nextUnit.pageCount)} sayfa`);
    setT("waCtaSub", ctaBits.join(" · "));
    if (waCta) { waCta.dataset.unitId = nextUnit.id; waCta.classList.remove("hidden"); }
  } else {
    setT("svNextTitle", "Uygun iş yok");
    setT("svNextSub", "Şu an boş iş paketi görünmüyor.");
    if (nextBtn) nextBtn.dataset.unitId = "";
    setT("waCtaTitle", "Bekleyen iş yok");
    setT("waCtaSub", "Yeni iş gelince burada görünecek.");
    if (waCta) waCta.dataset.unitId = "";
  }

  // 2) Dikkat: blocked + review pending (staff view) OR my open tasks (volunteer).
  const blocked = archiveUnits.filter((u) => u.status === "blocked");
  const review = archiveUnits.filter((u) => u.status === "review");
  const attnBtn = document.getElementById("svActAttention");
  const attnLab = document.getElementById("svAttnLab");
  if (isStaff()) {
    const count = blocked.length + review.length;
    if (attnLab) attnLab.innerHTML = count > 0 ? '<span class="dot"></span>Dikkat' : "Dikkat";
    const parts = [];
    if (blocked.length) parts.push(`${blocked.length} engel`);
    if (review.length) parts.push(`${review.length} kontrol`);
    setT("svAttnVal", count > 0 ? parts.join(" · ") : "Temiz");
    setT("svAttnSub", count > 0 ? "Çözülmesi bekleyen" : "Şu an bekleyen iş yok.");
    attnBtn?.classList.toggle("warn", count > 0);
  } else {
    const uid = cu?.uid;
    const email = (cu?.email || "").toLowerCase();
    const myOpen = archiveUnits.filter((u) => {
      const mine = (u.assignedToUids || []).includes(uid) ||
        (email && (u.assignedToEmails || []).map((e) => String(e).toLowerCase()).includes(email));
      return mine && !["done"].includes(u.status || "not_started");
    });
    if (attnLab) attnLab.textContent = "Üstümdeki iş";
    setT("svAttnVal", myOpen.length > 0 ? `${myOpen.length} iş` : "Boş");
    setT("svAttnSub", myOpen.length > 0 ? myOpen.map((u) => archiveLabel(u)).slice(0, 2).join(" · ") : "Atanmış iş yok.");
    attnBtn?.classList.remove("warn");
  }

  // 3) Bu hafta: pages this week vs last week, with delta.
  const now = Date.now();
  const weekMs = 7 * 86400000;
  const thisWeek = reports.filter((r) => (toDateFromTs(r.createdAt)?.getTime() || 0) >= now - weekMs);
  const lastWeek = reports.filter((r) => {
    const t = toDateFromTs(r.createdAt)?.getTime() || 0;
    return t >= now - 2 * weekMs && t < now - weekMs;
  });
  const thisPages = thisWeek.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
  const lastPages = lastWeek.reduce((acc, r) => acc + (Number(r.pagesDone) || 0), 0);
  setT("svWeekVal", `${numberText(thisPages)} sayfa`);
  const weekSub = document.getElementById("svWeekSub");
  if (weekSub) {
    if (lastPages === 0 && thisPages === 0) weekSub.textContent = "Henüz aktivite yok.";
    else if (lastPages === 0) weekSub.innerHTML = `Başlangıç · <strong>${numberText(thisWeek.length)} rapor</strong>`;
    else {
      const delta = Math.round(((thisPages - lastPages) / lastPages) * 100);
      const sign = delta >= 0 ? "+" : "";
      weekSub.innerHTML = `Geçen haftadan <strong>${sign}${delta}%</strong> · ${numberText(thisWeek.length)} rapor`;
    }
  }

  // --- Three lanes: top 3 per lane ---
  const searchInput = document.getElementById("svSearch");
  const searchText = searchInput ? searchInput.value.trim().toLocaleLowerCase("tr") : "";
  const filterBySearch = (u) => {
    if (!searchText) return true;
    const hay = [archiveLabel(u), u.title, u.sourceCode, u.boxNo, u.seriesNo, u.notes, u.blockerNote]
      .filter(Boolean).join(" ").toLocaleLowerCase("tr");
    return hay.includes(searchText);
  };
  const prioRank = { high: 3, medium: 2, low: 1 };
  const sortPrio = (a, b) => {
    const pa = prioRank[a.priority] || 2;
    const pb = prioRank[b.priority] || 2;
    if (pa !== pb) return pb - pa;
    return (toDateFromTs(b.latestReportAt)?.getTime() || 0) - (toDateFromTs(a.latestReportAt)?.getTime() || 0);
  };
  const units = archiveUnits.filter(filterBySearch);
  const todoUnits = units.filter((u) => ["not_started", "assigned"].includes(u.status || "not_started")).sort(sortPrio);
  const doingUnits = units.filter((u) => ["in_progress", "blocked"].includes(u.status || "")).sort(sortPrio);
  const doneUnits = units.filter((u) => ["review", "done"].includes(u.status || "")).sort(sortPrio);

  setT("svLaneTodoCount", todoUnits.length);
  setT("svLaneDoingCount", doingUnits.length);
  setT("svLaneDoneCount", doneUnits.length);
  renderSvLane("svLaneTodo", todoUnits.slice(0, 3));
  renderSvLane("svLaneDoing", doingUnits.slice(0, 3));
  renderSvLane("svLaneDone", doneUnits.slice(0, 3));

  // --- Pulse: last 2 activity items ---
  const recent = reports
    .filter((r) => r.source !== "system")
    .sort((a, b) => (toDateFromTs(b.createdAt)?.getTime() || 0) - (toDateFromTs(a.createdAt)?.getTime() || 0))
    .slice(0, 3);
  const pulseEl = document.getElementById("svPulse");
  if (pulseEl) {
    if (recent.length === 0) {
      pulseEl.textContent = "Henüz aktivite yok.";
    } else {
      pulseEl.innerHTML = recent.map((r, i) => {
        const who = findUserName(r.userUid) || r.userEmail || "—";
        const unit = archiveById[r.archiveUnitId];
        const target = unit ? archiveLabel(unit) : "bir birim";
        const when = toDateFromTs(r.createdAt);
        const ago = when ? daysSinceLabel(daysSince(when)) : "";
        const bit = r.pagesDone ? `${r.pagesDone} sayfa ekledi` : (r.summary ? "bir mesaj bıraktı" : "ilerleme kaydetti");
        const sep = i > 0 ? '<span class="sep">·</span>' : "";
        return `${sep}<span><strong>${escapeHTML(who)}</strong> ${escapeHTML(target)}'e ${escapeHTML(bit)} · ${escapeHTML(ago)}</span>`;
      }).join(" ");
    }
  }
}

function renderSvLane(containerId, units) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!units.length) { el.innerHTML = '<p class="sv-empty">Boş</p>'; return; }
  el.innerHTML = units.map((u) => {
    const status = u.status || "not_started";
    const incomplete = archiveLabelIncomplete(u);
    const progress = percent(u.completedDocumentCount || u.completedFileCount || 0, u.documentCount || u.fileCount || 0);
    const uids = u.assignedToUids || [];

    const stClass = status === "in_progress" ? "doing" : status === "blocked" ? "blocked" : status === "done" ? "done" : status === "review" ? "review" : "";
    const pillText = status === "blocked" ? "Engelli"
      : status === "in_progress" ? "Devam"
      : status === "done" ? "Bitti"
      : status === "review" ? "Kontrol"
      : "Sıradaki";

    // Colored initial icon per unit (first two uppercase chars of title/label)
    const label = archiveLabel(u);
    const initials = label.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "").slice(0, 2).toUpperCase() || "·";

    const assignedNames = uids.slice(0, 2).map((uid) => {
      const user = allUsers.find((x) => x.uid === uid);
      return user ? userDisplayName(user).split(" ")[0] : (findUserName(uid) || "?");
    }).filter(Boolean);
    const metaBits = [];
    if (u.boxNo) metaBits.push(`Kutu ${u.boxNo}`);
    if (assignedNames.length) metaBits.push(assignedNames.join(", "));
    if (progress > 0) metaBits.push(`${progress}%`);

    return `<div class="sv-u st-${escapeHTML(stClass)}" data-drill-unit="${escapeHTML(u.id)}" data-initials="${escapeHTML(initials)}">
      <div>
        <div class="ti${incomplete ? " incomplete" : ""}">${escapeHTML(label)}</div>
        <div class="meta">${escapeHTML(metaBits.join(" · ") || "—")}</div>
      </div>
      <div class="sv-u-right">
        <span class="sv-pill ${escapeHTML(stClass)}">${escapeHTML(pillText)}</span>
        ${progress > 0 && progress < 100 ? `<div class="sv-u-bar"><span style="width:${progress}%"></span></div>` : ""}
      </div>
    </div>`;
  }).join("");
}

// 12-week sparkline: pages completed per week. Last week is highlighted.
function renderSparkline(reports) {
  const spark = document.getElementById("svSparkline");
  if (!spark) return;
  const weeks = 12;
  const weekMs = 7 * 86400000;
  const now = Date.now();
  const buckets = new Array(weeks).fill(0);
  reports.forEach((r) => {
    const t = toDateFromTs(r.createdAt)?.getTime() || 0;
    if (!t) return;
    const weeksAgo = Math.floor((now - t) / weekMs);
    if (weeksAgo < 0 || weeksAgo >= weeks) return;
    buckets[weeks - 1 - weeksAgo] += Number(r.pagesDone) || 0;
  });
  const max = Math.max(1, ...buckets);
  spark.innerHTML = buckets.map((v, i) => {
    const h = Math.max(2, Math.round((v / max) * 52));
    const hot = i >= weeks - 2 ? " hot" : "";
    return `<i class="${hot.trim()}" style="height:${h}px" title="${numberText(v)} sayfa"></i>`;
  }).join("");
}

// --- Kanban board (Bugün home) ---
// Three columns derived from archiveUnit.status:
//   todo  = not_started + assigned (units queued or just-assigned)
//   doing = in_progress + blocked (active work, incl. stuck)
//   done  = review + done (awaiting review or finalized)
// Moving a card between columns updates archiveUnit.status; a system
// message is posted into the unit's channel automatically.

const KANBAN_BUCKETS = {
  todo: { status: "not_started", alt: ["assigned"] },
  doing: { status: "in_progress", alt: ["blocked"] },
  done: { status: "review", alt: ["done"] }
};

let kbShowMyOnly = false;

function bucketOfUnit(unit) {
  const s = unit.status || "not_started";
  if (s === "not_started" || s === "assigned") return "todo";
  if (s === "in_progress" || s === "blocked") return "doing";
  if (s === "review" || s === "done") return "done";
  return "todo";
}

function kanbanCard(unit) {
  const label = archiveLabel(unit);
  const incomplete = archiveLabelIncomplete(unit);
  const status = unit.status || "not_started";
  const progress = percent(unit.completedDocumentCount || unit.completedFileCount || 0, unit.documentCount || unit.fileCount || 0);
  const hasProgress = progress > 0 || status === "in_progress" || status === "review" || status === "done";

  // Avatar stack for assignees — max 3 shown.
  const uids = unit.assignedToUids || [];
  const avatars = [];
  const seen = new Set();
  uids.slice(0, 3).forEach((uid) => {
    const u = allUsers.find((x) => x.uid === uid);
    const name = u ? userDisplayName(u) : (findUserName(uid) || "?");
    const initials = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
    if (seen.has(initials + name)) return;
    seen.add(initials + name);
    avatars.push(`<span class="av" title="${escapeHTML(name)}">${escapeHTML(initials)}</span>`);
  });
  const extraCount = uids.length - avatars.length;
  const avatarHtml = avatars.length
    ? `<span class="av-stack">${avatars.join("")}</span>${extraCount > 0 ? `<span class="av-more">+${extraCount}</span>` : ""}`
    : '<span class="hint">Atanmamış</span>';

  // Last-activity hint: show new-message count if any reports since last read
  // (we don't track read-state yet so just show total report count as a proxy).
  const unitReports = Object.values(rd || {}).filter((r) => r.archiveUnitId === unit.id);
  const latest = toDateFromTs(unit.latestReportAt);
  let msgText = "Henüz mesaj yok";
  let msgClass = "msg-quiet";
  if (unitReports.length > 0) {
    const days = latest ? daysSince(latest) : null;
    if (days !== null && days <= 2) {
      msgText = `${unitReports.length} mesaj · ${daysSinceLabel(days)}`;
      msgClass = "msg-new";
    } else {
      msgText = `${unitReports.length} mesaj · ${latest ? daysSinceLabel(daysSince(latest)) : "—"}`;
    }
  }

  const subLine = incomplete
    ? `<div class="kb-sub incomplete">İsim/kaynak bilgisi eksik · ${numberText(unit.fileCount)} dosya</div>`
    : `<div class="kb-sub">${unit.boxNo ? `Kutu ${escapeHTML(String(unit.boxNo))} · ` : ""}${numberText(unit.fileCount)} dosya · ${numberText(unit.pageCount)} sayfa</div>`;

  return `<article class="kb-card st-${escapeHTML(status)}" draggable="true" data-kb-unit="${escapeHTML(unit.id)}" tabindex="0" role="button">
    <button class="kb-menu" type="button" data-kb-menu="${escapeHTML(unit.id)}" aria-label="Menü">⋮</button>
    <div class="kb-menu-list" data-kb-menu-list="${escapeHTML(unit.id)}">
      <button type="button" data-kb-move="${escapeHTML(unit.id)}" data-move-to="not_started">Sıradakine taşı</button>
      <button type="button" data-kb-move="${escapeHTML(unit.id)}" data-move-to="in_progress">Yapılıyor'a taşı</button>
      <button type="button" data-kb-move="${escapeHTML(unit.id)}" data-move-to="review">Biten'e taşı</button>
      <div class="sep"></div>
      <button type="button" data-kb-move="${escapeHTML(unit.id)}" data-move-to="blocked">Engelli olarak işaretle</button>
      ${unit.sheetUrl ? `<div class="sep"></div><button type="button" data-kb-sheet="${escapeHTML(unit.sheetUrl)}">📊 Sheet'i aç</button>` : ""}
    </div>
    <div class="kb-ti">${escapeHTML(label)}</div>
    ${subLine}
    ${hasProgress ? `<div class="kb-bar"><div class="bar"><span style="width:${progress}%"></span></div><span class="pct">${progress}%</span></div>` : ""}
    <div class="kb-foot">${avatarHtml}<span class="${msgClass}">${escapeHTML(msgText)}</span></div>
  </article>`;
}

function renderKanban() {
  const board = document.getElementById("kbBoard");
  if (!board) return;
  const cols = {
    todo: document.getElementById("kbColTodo"),
    doing: document.getElementById("kbColDoing"),
    done: document.getElementById("kbColDone")
  };
  if (!cols.todo || !cols.doing || !cols.done) return;

  const searchInput = document.getElementById("kbSearchInput");
  const searchText = searchInput ? searchInput.value.trim().toLocaleLowerCase("tr") : "";
  const uid = cu?.uid;
  const email = (cu?.email || "").toLowerCase();
  const isMine = (u) => (u.assignedToUids || []).includes(uid) ||
    (email && (u.assignedToEmails || []).map((e) => String(e).toLowerCase()).includes(email));

  let units = archiveUnits.slice();
  if (kbShowMyOnly) units = units.filter(isMine);
  if (searchText) {
    units = units.filter((u) => {
      const hay = [archiveLabel(u), u.title, u.sourceCode, u.boxNo, u.seriesNo, u.materialType, u.notes, u.blockerNote]
        .filter(Boolean).join(" ").toLocaleLowerCase("tr");
      return hay.includes(searchText);
    });
  }

  // Bucket units, priority-sort each column.
  const grouped = { todo: [], doing: [], done: [] };
  units.forEach((u) => grouped[bucketOfUnit(u)].push(u));
  const priorityRank = { high: 3, medium: 2, low: 1 };
  const sortWith = (a, b) => {
    const pa = priorityRank[a.priority] || 2;
    const pb = priorityRank[b.priority] || 2;
    if (pa !== pb) return pb - pa;
    const lb = toDateFromTs(b.latestReportAt)?.getTime() || 0;
    const la = toDateFromTs(a.latestReportAt)?.getTime() || 0;
    return lb - la;
  };
  Object.keys(grouped).forEach((k) => grouped[k].sort(sortWith));

  cols.todo.innerHTML = grouped.todo.length ? grouped.todo.map(kanbanCard).join("") : '<p class="kb-empty">Sıradaki iş yok.</p>';
  cols.doing.innerHTML = grouped.doing.length ? grouped.doing.map(kanbanCard).join("") : '<p class="kb-empty">Aktif iş yok.</p>';
  cols.done.innerHTML = grouped.done.length ? grouped.done.map(kanbanCard).join("") : '<p class="kb-empty">Henüz bitmiş iş yok.</p>';

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("kbCountTodo", grouped.todo.length);
  set("kbCountDoing", grouped.doing.length);
  set("kbCountDone", grouped.done.length);

  const totals = archiveTotals();
  set("kbProjStats", `${numberText(totals.units)} birim · ${numberText(totals.pages)} sayfa · %${percent(totals.done, totals.units)} tamamlandı`);
  const myBtn = document.getElementById("kbMyOnly");
  if (myBtn) {
    myBtn.textContent = kbShowMyOnly ? "Herkes" : "Sadece benim";
    myBtn.classList.toggle("btn-primary", kbShowMyOnly);
    myBtn.classList.toggle("btn-secondary", !kbShowMyOnly);
  }
}

// Move a unit to a new status. Used by drag-drop and by the card's ⋮ menu.
async function moveUnitStatus(unitId, newStatus) {
  if (!db) return;
  const unit = archiveById[unitId];
  if (!unit || unit.status === newStatus) return;
  try {
    await updateDoc(doc(db, "archiveUnits", unitId), {
      status: newStatus,
      updatedAt: serverTimestamp(),
      latestReportAt: serverTimestamp()
    });
    // Post a system message into the channel so the status change is visible
    // in the thread alongside human messages.
    await addDoc(collection(db, "reports"), {
      userUid: cu?.uid || "",
      userEmail: cu?.email || "",
      archiveUnitId: unitId,
      projectId: unit.projectId || PNB_PROJECT_ID,
      taskId: archiveLabel(unit),
      summary: `Durum: ${statusLabel(newStatus)}`,
      hours: 0,
      pagesDone: null,
      workStatus: newStatus === "review" || newStatus === "done" ? "unit_done" : newStatus === "blocked" ? "blocked" : "in_progress",
      source: "system",
      messageType: "status_change",
      reportDate: td(),
      links: [],
      images: [],
      coworkerUids: [],
      status: "submitted",
      reviewerUid: null,
      feedback: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await reloadPnb();
    await lr();
  } catch (error) {
    console.error("Durum güncellenemedi:", error);
    alert(`Durum güncellenemedi: ${error.message}`);
  }
}

// --- Drag-drop wiring (HTML5) ---
let kbDragUnitId = null;

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest?.("[data-kb-unit]");
  if (!card) return;
  kbDragUnitId = card.dataset.kbUnit;
  card.classList.add("dragging");
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragend", (event) => {
  const card = event.target.closest?.("[data-kb-unit]");
  if (card) card.classList.remove("dragging");
  kbDragUnitId = null;
  document.querySelectorAll(".kb-col.drag-over").forEach((el) => el.classList.remove("drag-over"));
});
document.addEventListener("dragover", (event) => {
  const col = event.target.closest?.(".kb-col");
  if (!col || !kbDragUnitId) return;
  event.preventDefault();
  col.classList.add("drag-over");
});
document.addEventListener("dragleave", (event) => {
  const col = event.target.closest?.(".kb-col");
  if (col && !col.contains(event.relatedTarget)) col.classList.remove("drag-over");
});
document.addEventListener("drop", async (event) => {
  const col = event.target.closest?.(".kb-col");
  if (!col || !kbDragUnitId) return;
  event.preventDefault();
  col.classList.remove("drag-over");
  const target = col.dataset.targetStatus || "not_started";
  const unitId = kbDragUnitId;
  kbDragUnitId = null;
  await moveUnitStatus(unitId, target);
});

// --- Channel rendering (drill-modal in channel mode) ---

function renderChannelSide(unit) {
  const side = document.getElementById("chSide");
  if (!side) return;
  const status = unit.status || "not_started";
  const progress = percent(unit.completedDocumentCount || unit.completedFileCount || 0, unit.documentCount || unit.fileCount || 0);
  const uids = unit.assignedToUids || [];
  const avHtml = uids.slice(0, 5).map((uid) => {
    const u = allUsers.find((x) => x.uid === uid);
    const name = u ? userDisplayName(u) : (findUserName(uid) || "?");
    const initials = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
    return `<span class="av" title="${escapeHTML(name)}">${escapeHTML(initials)}</span>`;
  }).join("") || '<span class="muted" style="font-size:.82rem">Atanmamış</span>';
  const assignedNames = uids.map((uid) => {
    const u = allUsers.find((x) => x.uid === uid);
    return u ? userDisplayName(u) : findUserName(uid);
  }).filter(Boolean).join(", ");
  const box = unit.boxNo ? `Kutu ${unit.boxNo}` : "";
  const subBits = [box, unit.sourceCode, unit.materialType].filter(Boolean).join(" · ");
  side.innerHTML = `
    <div class="ch-pinned">
      <div>
        <h2>${escapeHTML(archiveLabel(unit))}</h2>
        ${subBits ? `<div class="ch-sub">${escapeHTML(subBits)}</div>` : ""}
      </div>
      <span class="status-pill ${escapeHTML(status)}">${escapeHTML(statusLabel(status))}</span>
      <div class="stat-row">
        <span class="k">İlerleme</span>
        <span class="v">${progress}% · ${numberText(unit.completedDocumentCount || 0)}/${numberText(unit.documentCount || 0)} belge</span>
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
      </div>
      <div class="stat-row">
        <span class="k">Atanan</span>
        <div class="avs">${avHtml}</div>
        ${assignedNames ? `<div class="ch-sub" style="margin-top:.2rem">${escapeHTML(assignedNames)}</div>` : ""}
      </div>
      <div class="stat-row">
        <span class="k">Öncelik</span>
        <span class="v">${escapeHTML({ high: "Yüksek", medium: "Orta", low: "Düşük" }[unit.priority] || "Orta")}</span>
      </div>
      ${unit.sheetUrl ? `
      <div class="stat-row">
        <span class="k">Çalışma sayfası</span>
        <a href="${escapeHTML(unit.sheetUrl)}" target="_blank" rel="noopener" style="font-size:.85rem;color:var(--primary);word-break:break-all">📊 Sheet'i aç</a>
      </div>` : ""}
      ${isStaff() ? '<button type="button" class="btn btn-secondary btn-sm" id="chOpenEdit" style="margin-top:.5rem">Ayarla…</button>' : ""}
    </div>`;
}

function formatDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDayHuman(d) {
  const today = new Date();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === y.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

function renderChannelThread(reports) {
  const thread = document.getElementById("chThread");
  if (!thread) return;
  // Chronological: oldest at top, newest at bottom (chat convention).
  const chrono = reports.slice().reverse();
  let lastDayKey = null;
  const parts = [];
  chrono.forEach((r) => {
    const when = toDateFromTs(r.createdAt) || new Date();
    const dayKey = formatDayKey(when);
    if (dayKey !== lastDayKey) {
      parts.push(`<div class="ch-day">${escapeHTML(formatDayHuman(when))}</div>`);
      lastDayKey = dayKey;
    }
    const isMe = r.userUid === cu?.uid;
    const author = r.userUid === cu?.uid ? "Sen" : (findUserName(r.userUid) || r.userEmail || "—");
    const timeStr = when.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    if (r.source === "system" || r.messageType === "status_change") {
      parts.push(`<div class="ch-sys">${escapeHTML(author)}: ${escapeHTML(r.summary || "durumu güncelledi")}</div>`);
      return;
    }

    const attachments = [];
    if (r.pagesDone != null && r.pagesDone !== "") {
      attachments.push(`<span class="at pages">+ ${numberText(r.pagesDone)} sayfa</span>`);
    }
    if (r.workStatus === "blocked" || r.messageType === "blocker") {
      attachments.push(`<span class="at blocker">⚠ Engel</span>`);
    }
    if (r.workStatus === "unit_done") {
      attachments.push(`<span class="at status-done">✓ Bitti işaretli</span>`);
    }

    const text = (r.summary || "").trim();
    const hasText = text.length > 0;
    const hasAttach = attachments.length > 0;
    if (!hasText && !hasAttach) {
      // Skip effectively empty reports (no content, no tags).
      return;
    }

    parts.push(`<div class="ch-msg ${isMe ? "me" : "them"}">
      <div class="who">${escapeHTML(author)}</div>
      ${hasText ? `<div>${escapeHTML(text)}</div>` : ""}
      ${attachments.join(" ")}
      <div class="when">${escapeHTML(timeStr)}</div>
    </div>`);
  });
  thread.innerHTML = parts.join("") || '<p class="muted" style="margin:auto;text-align:center">Henüz mesaj yok. İlk güncellemeyi yaz: kısa bir not, "+ Sayfa" ekle, ya da "Engel" bildir.</p>';
  // Scroll to the bottom where the latest messages live.
  thread.scrollTop = thread.scrollHeight;
}

// Open the drill-modal in channel mode (kanban card click path).
async function openUnitChannel(unitId) {
  const unit = archiveById[unitId];
  const modal = document.getElementById("unitDrillModal");
  if (!unit || !modal) return;
  modal.classList.add("channel-mode");
  drillCurrentUnitId = unitId;
  drillCurrentReports = [];

  // Populate side pane + header
  renderChannelSide(unit);
  const title = document.getElementById("chTitle");
  if (title) title.textContent = `# ${archiveLabel(unit).toLocaleLowerCase("tr").replace(/\s+/g, "-").slice(0, 48)}`;
  const sheetLink = document.getElementById("chSheetLink");
  if (sheetLink) {
    if (unit.sheetUrl) { sheetLink.href = unit.sheetUrl; sheetLink.classList.remove("hidden"); }
    else sheetLink.classList.add("hidden");
  }

  // Show modal
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  const thread = document.getElementById("chThread");
  if (thread) thread.innerHTML = '<p class="muted" style="margin:auto">Yükleniyor…</p>';

  // Load reports for this unit
  try {
    const snap = await getDocs(query(
      collection(db, "reports"),
      where("archiveUnitId", "==", unitId),
      orderBy("createdAt", "desc"),
      limit(100)
    ));
    if (drillCurrentUnitId !== unitId) return;
    drillCurrentReports = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderChannelThread(drillCurrentReports);
  } catch (error) {
    if (thread) thread.innerHTML = `<p class="muted">Mesajlar yüklenemedi: ${escapeHTML(error.message)}</p>`;
  }

  // Focus composer input
  setTimeout(() => document.getElementById("chComposeText")?.focus(), 80);
}

function closeUnitChannel() {
  const modal = document.getElementById("unitDrillModal");
  if (!modal) return;
  modal.classList.remove("channel-mode");
  closeUnitDrill();
}

// Send a channel message. Writes a new report doc; data.messageType tags the kind.
async function sendChannelMessage({ type, text, pagesDone }) {
  if (!cu || !db || !drillCurrentUnitId) return;
  const unit = archiveById[drillCurrentUnitId];
  if (!unit) return;

  const trimmed = (text || "").trim();
  let workStatus = "in_progress";
  if (type === "blocker") workStatus = "blocked";
  if (type === "done") workStatus = "unit_done";

  const data = {
    taskId: archiveLabel(unit),
    archiveUnitId: drillCurrentUnitId,
    projectId: unit.projectId || PNB_PROJECT_ID,
    summary: trimmed,
    hours: 0,
    pagesDone: typeof pagesDone === "number" ? pagesDone : null,
    workStatus,
    source: "quick",
    messageType: type || "note",
    reportDate: td(),
    links: [],
    images: [],
    coworkerUids: []
  };

  try {
    await createReportBatched(data, { targetUid: cu.uid, targetEmail: cu.email || "" });
    // Reload this channel's reports so the new message appears at the bottom.
    const snap = await getDocs(query(
      collection(db, "reports"),
      where("archiveUnitId", "==", drillCurrentUnitId),
      orderBy("createdAt", "desc"),
      limit(100)
    ));
    drillCurrentReports = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderChannelThread(drillCurrentReports);
    // Refresh kanban + lanes in the background.
    await reloadPnb();
  } catch (error) {
    alert(`Gönderilemedi: ${error.message}`);
  }
}

function daysSinceLabel(d) {
  if (d == null) return "—";
  if (d === 0) return "bugün";
  if (d === 1) return "dün";
  if (d < 7) return `${d} gün önce`;
  if (d < 30) return `${Math.floor(d / 7)} hafta önce`;
  if (d < 365) return `${Math.floor(d / 30)} ay önce`;
  return `${Math.floor(d / 365)} yıl önce`;
}

function renderHomeOverview() {
  if (!cp) return;
  const kpis = document.getElementById("homeKpis");
  const nextWork = document.getElementById("homeNextWork");
  const management = document.getElementById("homeManagement");
  const homeSection = document.getElementById("tab-home");
  const shortcutCard = document.getElementById("homeShortcutCard");
  const profileCard = document.getElementById("homeProfileCard");
  const heroTitle = document.getElementById("homeHeroTitle");
  const heroText = document.getElementById("homeHeroText");
  const heroActions = document.getElementById("homeHeroActions");
  const heroEyebrow = document.getElementById("homeHeroEyebrow");
  if (!kpis || !nextWork || !management) return;

  const totals = archiveTotals();
  const reports = Object.values(rd || {});
  const submittedReports = reports.filter((report) => (report.status || "submitted") === "submitted").length;
  const openTasks = taskItems.filter((item) => !["done", "cancelled", "closed"].includes(item.data?.status || "open"));
  const assignedOpenUnits = assignedOpenArchiveUnits();

  const volunteerMode = !isStaff();
  homeSection?.classList.toggle("volunteer-home", volunteerMode);
  homeSection?.classList.toggle("staff-home", !volunteerMode);
  kpis.classList.toggle("hidden", volunteerMode);
  shortcutCard?.classList.toggle("hidden", volunteerMode);
  profileCard?.classList.toggle("hidden", true);

  if (volunteerMode) {
    const firstUnit = assignedOpenUnits[0];
    const firstTask = openTasks[0];
    const hasWork = Boolean(firstUnit || firstTask);
    if (heroEyebrow) heroEyebrow.textContent = hasWork ? "Sıradaki iş" : "Bugün";
    if (heroTitle) heroTitle.textContent = firstUnit ? archiveLabel(firstUnit) : firstTask ? (firstTask.data?.title || "Atanmış iş") : "Bugün sakin";
    if (heroText) heroText.textContent = firstUnit
      ? `${statusLabel(firstUnit.status || "not_started")} · ${numberText(firstUnit.pageCount)} sayfa · ${numberText(firstUnit.documentCount)} belge`
      : firstTask
        ? `${firstTask.data?.department || "Genel"} · ${statusLabel(firstTask.data?.status || "open")}${firstTask.data?.dueDate ? ` · Son: ${formatDate(firstTask.data.dueDate)}` : ""}`
        : "Sana atanmış açık iş yok. Yeni iş gelirse burada görünecek.";
    if (heroActions) {
      heroActions.innerHTML = firstUnit
        ? `<button class="btn btn-primary" type="button" data-report-au="${firstUnit.id}">Rapor yaz</button><button class="btn btn-secondary" type="button" data-open-work="${firstUnit.id}">Ayrıntı</button>`
        : firstTask
          ? `<button class="btn btn-primary" type="button" data-report-task="${firstTask.id}">Rapor yaz</button><button class="btn btn-secondary" type="button" data-go-tab="pnb" data-scroll-to="generalTaskPanel">Ayrıntı</button>`
          : `<button class="btn btn-secondary" type="button" data-go-tab="announcements">Duyurular</button>`;
    }
    renderVolunteerMission(nextWork, assignedOpenUnits, openTasks);
    management.innerHTML = "";
    // Option B: volunteers also get the stats strip, lanes, and queue CTA.
    renderHomeStats();
    renderHomeLanes();
    renderHomeQueueCta();
    renderKanban();
    renderStylishHome();
    return;
  }

  const approvedCount = approvedUsers().length;
  const capacityCount = availabilityRecords.filter((item) => Number(item.slotCount || 0) > 0).length;
  if (heroEyebrow) heroEyebrow.textContent = "Operasyon";
  if (heroTitle) heroTitle.textContent = "Bütün resim";
  if (heroText) heroText.textContent = `${numberText(totals.units)} iş · ${numberText(totals.done)} tamamlandı · ${numberText(approvedCount)} kişi · ${numberText(capacityCount)} uygunluk`;
  if (heroActions) {
    heroActions.innerHTML = `<button class="btn btn-primary" type="button" data-go-tab="management">Yönetim</button>
      <button class="btn btn-secondary" type="button" data-go-tab="pnb">İşler</button>
      <button class="btn btn-secondary" type="button" data-go-tab="reports">Raporlar</button>`;
  }

  const progressValue = percent(totals.done, totals.units);
  kpis.innerHTML = `
    <div class="picture-card picture-progress">
      <span>İlerleme</span>
      <strong>${numberText(totals.done)} / ${numberText(totals.units)}</strong>
      <div class="picture-bar"><i style="width:${progressValue}%"></i></div>
      <small>${progressValue}% tamamlandı</small>
    </div>
    <div class="picture-card">
      <span>Ekip</span>
      <strong>${numberText(approvedCount)}</strong>
      <small>${numberText(capacityCount)} kişinin uygunluğu görünüyor</small>
    </div>
    <div class="picture-card">
      <span>Karar</span>
      <strong>${numberText(totals.unassigned + totals.blocked + submittedReports + pendingApplicationCount)}</strong>
      <small>Atama, engel, rapor veya başvuru</small>
    </div>`;

  if (isStaff()) {
    const blocked = archiveUnits.filter((unit) => unit.status === "blocked").slice(0, 3);
    const unassigned = archiveUnits.filter((unit) => !(unit.assignedToUids || []).length && !(unit.assignedToEmails || []).length).slice(0, 3);
    const attention = [];
    if (blocked.length) attention.push(`<div class="ops-alert danger"><strong>${blocked.length} engelli iş</strong><span>${blocked.map((unit) => escapeHTML(archiveLabel(unit))).join("<br>")}</span><button class="btn btn-secondary btn-sm" type="button" data-go-tab="pnb">Engelleri aç</button></div>`);
    if (unassigned.length) attention.push(`<div class="ops-alert"><strong>${totals.unassigned} atanmamış iş</strong><span>${unassigned.map((unit) => escapeHTML(archiveLabel(unit))).join("<br>")}</span><button class="btn btn-secondary btn-sm" type="button" data-go-tab="pnb">Atama yap</button></div>`);
    if (submittedReports) attention.push(`<div class="ops-alert"><strong>${submittedReports} rapor kontrol bekliyor</strong><span>Raporları onaylayın veya düzeltme isteyin.</span><button class="btn btn-secondary btn-sm" type="button" data-go-tab="reports">Raporları aç</button></div>`);
    if (pendingApplicationCount) attention.push(`<div class="ops-alert"><strong>${pendingApplicationCount} başvuru bekliyor</strong><span>Yeni gönüllüleri onaylayıp uygun işe yönlendirin.</span><button class="btn btn-secondary btn-sm" type="button" data-go-tab="management">Başvuruları aç</button></div>`);
    nextWork.innerHTML = attention.length ? attention.join("") : `<div class="ops-alert"><strong>Şu an kritik bekleyen iş yok.</strong><span>İş yükünü ve raporları düzenli kontrol etmek yeterli.</span><button class="btn btn-secondary btn-sm" type="button" data-go-tab="pnb">İş yükünü aç</button></div>`;
  } else {
    const items = [];
    assignedOpenUnits.slice(0, 3).forEach((unit) => {
      items.push(`<div class="ops-alert"><strong>${escapeHTML(archiveLabel(unit))}</strong><span>${escapeHTML(statusLabel(unit.status || "not_started"))} · ${numberText(unit.pageCount)} sayfa</span><button class="btn btn-primary btn-sm" type="button" data-report-au="${unit.id}">Rapor yaz</button></div>`);
    });
    openTasks.slice(0, 3).forEach((item) => {
      items.push(`<div class="ops-alert"><strong>${escapeHTML(item.data?.title || "İş")}</strong><span>${escapeHTML(item.data?.department || "-")} · ${escapeHTML(statusLabel(item.data?.status || "open"))}</span><button class="btn btn-secondary btn-sm" type="button" data-go-tab="pnb" data-scroll-to="generalTaskPanel">İşi aç</button></div>`);
    });
    nextWork.innerHTML = items.length ? items.join("") : `<div class="ops-alert"><strong>Açık atanmış iş görünmüyor.</strong><span>Yeni iş gelene kadar duyuruları takip edebilir veya koordinatöre yazabilirsiniz.</span><button class="btn btn-secondary btn-sm" type="button" data-go-tab="announcements">Duyurular</button></div>`;
  }

  const shortcuts = [
    ["management", "Bütün liste", "İlerleme, ekip ve karar bekleyenleri tek yerde gör."],
    ["pnb", "İşler", "Atama, durum ve engelleri yönet."],
    ["reports", "Raporlar", "Gelen raporları kontrol et."],
    ["announcements", "Duyurular", "Takım kararlarını yayınla veya oku."]
  ];
  if (isAdmin()) shortcuts.push(["maintenance", "Bakım", "Sadece gerektiğinde veri/import araçları."]);
  management.innerHTML = shortcuts.map(([tab, title, text]) => `<button class="ops-link-card" type="button" data-go-tab="${tab}"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(text)}</span></button>`).join("");
  renderManagementOverview();

  // Option B additions: stats strip + lanes + queue CTA always refreshed alongside.
  renderHomeStats();
  renderHomeLanes();
  renderHomeQueueCta();
  renderKanban();
  renderStylishHome();
}

function renderPeopleOps() {
  const capacity = document.getElementById("peopleCapacityList");
  const warnings = document.getElementById("peopleDataWarnings");
  if (!capacity || !warnings) return;

  if (!isStaff()) {
    capacity.innerHTML = "";
    warnings.innerHTML = "";
    return;
  }

  const capacityRows = availabilityRecords
    .filter((item) => Number(item.slotCount || 0) > 0)
    .sort((a, b) => Number(b.slotCount || 0) - Number(a.slotCount || 0))
    .slice(0, 8);
  capacity.innerHTML = capacityRows.length
    ? capacityRows.map((item) => `<div class="feedback-item"><strong>${escapeHTML(item.personName || "-")}</strong><div>${numberText(item.slotCount || 0)} uygunluk slotu${item.interests ? ` · ${escapeHTML(item.interests)}` : ""}</div></div>`).join("")
    : htmlEmpty("Uygunluk verisi yok.");

  const approved = approvedUsers();
  const missingSkill = approved.filter((user) => !String(user.data?.skillsText || "").trim()).slice(0, 6);
  const missingDepartment = approved.filter((user) => !String(user.data?.department || "").trim()).slice(0, 6);
  const rows = [];
  if (missingSkill.length) rows.push(`<div class="ops-alert"><strong>Yetenek/ilgi eksik</strong><span>${missingSkill.map((user) => escapeHTML(userDisplayName(user))).join("<br>")}</span></div>`);
  if (missingDepartment.length) rows.push(`<div class="ops-alert"><strong>Departman eksik</strong><span>${missingDepartment.map((user) => escapeHTML(userDisplayName(user))).join("<br>")}</span></div>`);
  warnings.innerHTML = rows.length ? rows.join("") : htmlEmpty("Kritik eksik görünmüyor.");
}

function archiveOptions(selectedId = "", includeEmpty = true, emptyLabel = "Bağlantı yok") {
  const options = includeEmpty ? [`<option value="">${escapeHTML(emptyLabel)}</option>`] : [];
  archiveUnits
    .slice()
    .sort((a, b) => archiveLabel(a).localeCompare(archiveLabel(b), "tr"))
    .forEach((unit) => {
      options.push(`<option value="${escapeHTML(unit.id)}"${unit.id === selectedId ? " selected" : ""}>${escapeHTML(archiveLabel(unit))}</option>`);
    });
  return options.join("");
}

// For the quick report form: show only units assigned to the current volunteer,
// newest first by latestReportAt, so the most relevant one is on top.
function myArchiveOptions(selectedId = "") {
  if (!cu) return '<option value="">İş seçiniz</option>';
  const mine = archiveUnits.filter((unit) => {
    const uids = Array.isArray(unit.assignedToUids) ? unit.assignedToUids : [];
    const emails = Array.isArray(unit.assignedToEmails) ? unit.assignedToEmails : [];
    return uids.includes(cu.uid) || (cu.email && emails.includes(String(cu.email).toLowerCase()));
  });
  const list = isStaff() && mine.length === 0 ? archiveUnits.slice() : mine;
  list.sort((a, b) => {
    const at = a.latestReportAt?.seconds || 0;
    const bt = b.latestReportAt?.seconds || 0;
    if (bt !== at) return bt - at;
    return archiveLabel(a).localeCompare(archiveLabel(b), "tr");
  });
  const options = ['<option value="">İş seçiniz</option>'];
  list.forEach((unit) => {
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
  const quickSelect = document.getElementById("quickArchiveUnitSelect");
  if (reportSelect) reportSelect.innerHTML = archiveOptions(reportSelect.value || "");
  if (taskSelect) taskSelect.innerHTML = archiveOptions(taskSelect.value || "");
  if (quickSelect) quickSelect.innerHTML = myArchiveOptions(quickSelect.value || "");
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
  if (!staff) {
    return `<article class="simple-work-card">
      <div>
        <span class="mission-label">İş</span>
        <h3>${escapeHTML(task.title || "-")}</h3>
        ${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}
        <div class="simple-meta">${escapeHTML(task.department || "Genel")}${task.dueDate ? ` · Son: ${formatDate(task.dueDate)}` : ""} · ${escapeHTML(taskStatusLabels[task.status] || task.status || "Açık")}</div>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-report-task="${id}">Rapor yaz</button>
    </article>`;
  }
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
  let html = `<div class="report-card report-${status}"><div class="report-header"><strong>${escapeHTML(report.taskId || "İş belirtilmedi")}</strong><div class="report-actions">`;
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
      <label>Tempo <select data-rh="${uid}"><option value=""${!data.rhythm ? " selected" : ""}>Belirsiz</option><option value="regular"${data.rhythm === "regular" ? " selected" : ""}>Düzenli</option><option value="casual"${data.rhythm === "casual" ? " selected" : ""}>Serbest</option><option value="burst"${data.rhythm === "burst" ? " selected" : ""}>Yoğun blok</option></select></label>
    </div>
    <div class="form-actions"><button class="btn btn-primary btn-sm" data-sv="${uid}">Kaydet</button><button class="btn btn-block btn-sm" data-del-user="${uid}">Sil</button></div>
  </div>`;
}

async function lh() {
  document.getElementById("profileCard").innerHTML = rp(cp);
  const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(3)));
  announcementItems = snap.docs.map((item) => ({ id: item.id, data: item.data() }));
  const homeDocs = isStaff() ? snap.docs : snap.docs.slice(0, 1);
  document.getElementById("homeAnnouncements").innerHTML = homeDocs.length ? homeDocs.map((item) => ra(item.data(), item.id)).join("") : htmlEmpty("Duyuru yok.");
  renderHomeOverview();
}

async function lt() {
  const staff = isStaff();
  const taskQuery = staff
    ? query(collection(db, "tasks"), orderBy("createdAt", "desc"), limit(80))
    : query(collection(db, "tasks"), where("assignedToUid", "==", cu.uid), limit(40));
  const snap = await getDocs(taskQuery);
  taskItems = snap.docs.map((item) => ({ id: item.id, data: item.data() }));
  taskItems.sort((a, b) => {
    const at = a.data.createdAt?.toMillis?.() || 0;
    const bt = b.data.createdAt?.toMillis?.() || 0;
    return bt - at;
  });
  document.getElementById("tasksList").innerHTML = taskItems.length ? taskItems.map((item) => rt(item.data, item.id)).join("") : htmlEmpty("İş bulunamadı.");
  renderHomeOverview();
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
  renderHomeOverview();
}

async function la() {
  const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20)));
  announcementItems = snap.docs.map((item) => ({ id: item.id, data: item.data() }));
  document.getElementById("announcementsList").innerHTML = snap.empty ? htmlEmpty("Duyuru yok.") : snap.docs.map((item) => ra(item.data(), item.id)).join("");
  renderHomeOverview();
}

async function lp() {
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "pending"), limit(50)));
  const list = document.getElementById("pendingUsers");
  const tab = document.querySelector('[data-tab="management"]');
  pendingApplicationCount = snap.size;
  if (snap.empty) {
    list.innerHTML = htmlEmpty("Bekleyen başvuru yok.");
    const old = tab?.querySelector(".count-badge");
    if (old) old.remove();
    renderHomeOverview();
    return;
  }
  list.innerHTML = snap.docs.map((item) => rpu(item.data(), item.id)).join("");
  if (tab) {
    const old = tab.querySelector(".count-badge");
    if (old) old.remove();
    tab.insertAdjacentHTML("beforeend", `<span class="count-badge">${snap.size}</span>`);
  }
  renderHomeOverview();
}

async function lu() {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(150)));
  document.getElementById("userDirectory").innerHTML = snap.empty ? htmlEmpty("Kullanıcı bulunamadı.") : snap.docs.map((item) => rur(item.data(), item.id)).join("");
  renderActivityPanel();
}

// --- Activity panel (active / slowing / stalled / never reported) ---

const ACTIVITY_BUCKETS = [
  { key: "active",  label: "Aktif (0–13 gün)",     minDays: 0,  maxDays: 13,  tone: "ok"      },
  { key: "slow",    label: "Yavaşlayan (14–27 gün)", minDays: 14, maxDays: 27, tone: "warn"   },
  { key: "stalled", label: "Durmuş (28+ gün)",     minDays: 28, maxDays: Infinity, tone: "danger" },
  { key: "never",   label: "Hiç rapor yazmamış",   minDays: null, maxDays: null,    tone: "mute" },
  { key: "casual",  label: "Serbest tempo",        minDays: null, maxDays: null,    tone: "mute" }
];

function toDateFromTs(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  return null;
}

function daysSince(date) {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function bucketForUser(user) {
  const rhythm = user.data?.rhythm || null;
  if (rhythm === "casual") return "casual";
  const last = toDateFromTs(user.data?.lastReportAt);
  if (!last) return "never";
  const d = daysSince(last);
  if (rhythm === "burst") {
    if (d < 30) return "active";
    if (d < 45) return "slow";
    return "stalled";
  }
  if (d <= 13) return "active";
  if (d <= 27) return "slow";
  return "stalled";
}

function volunteerPool() {
  // Consider anyone with role=volunteer and status=approved.
  return allUsers.filter((u) => (u.data?.role || "volunteer") === "volunteer" && (u.data?.status || "") === "approved");
}

function renderActivityPanel() {
  const bucketsEl = document.getElementById("activityBuckets");
  const summaryEl = document.getElementById("activitySummary");
  if (!bucketsEl || !summaryEl) return;
  if (!isStaff()) { bucketsEl.innerHTML = ""; summaryEl.innerHTML = ""; return; }

  const deptSelect = document.getElementById("activityDeptFilter");
  const dept = deptSelect ? deptSelect.value : "";
  const pool = volunteerPool().filter((u) => !dept || (u.data?.department || "") === dept);

  const grouped = { active: [], slow: [], stalled: [], never: [], casual: [] };
  pool.forEach((u) => { grouped[bucketForUser(u)].push(u); });

  // Sort each bucket: most recent activity first within "active/slow/stalled",
  // alphabetical within "never".
  ["active", "slow", "stalled"].forEach((k) => {
    grouped[k].sort((a, b) => {
      const ad = toDateFromTs(a.data?.lastReportAt)?.getTime() || 0;
      const bd = toDateFromTs(b.data?.lastReportAt)?.getTime() || 0;
      return bd - ad;
    });
  });
  grouped.never.sort((a, b) => userDisplayName(a).localeCompare(userDisplayName(b), "tr"));
  grouped.casual.sort((a, b) => userDisplayName(a).localeCompare(userDisplayName(b), "tr"));

  summaryEl.innerHTML = ACTIVITY_BUCKETS.map((b) => (
    `<div class="activity-kpi activity-${b.tone}"><strong>${grouped[b.key].length}</strong><span>${escapeHTML(b.label)}</span></div>`
  )).join("");

  bucketsEl.innerHTML = ACTIVITY_BUCKETS.map((b) => {
    const people = grouped[b.key];
    if (!people.length) return "";
    const rows = people.map((u) => renderActivityRow(u, b.key)).join("");
    return `<section class="activity-bucket activity-${b.tone}">
      <header><h3>${escapeHTML(b.label)}</h3><span>${people.length} kişi</span></header>
      <div class="activity-rows">${rows}</div>
    </section>`;
  }).join("") || htmlEmpty("Bu filtreye uyan gönüllü yok.");
}

function renderActivityRow(user, bucketKey) {
  const name = userDisplayName(user);
  const email = user.data?.email || "";
  const dept = user.data?.department || "-";
  const last = toDateFromTs(user.data?.lastReportAt);
  const d = last ? daysSince(last) : null;
  const lastText = last ? `${d} gün önce · ${formatDate(last.toISOString().slice(0,10))}` : "Hiç rapor yok";
  const needsNudge = bucketKey === "slow" || bucketKey === "stalled" || bucketKey === "never";
  const nudgeBtn = needsNudge && email
    ? `<button class="btn btn-secondary btn-sm" type="button" data-nudge-email="${escapeHTML(email)}" data-nudge-name="${escapeHTML(name)}" data-nudge-days="${d ?? ""}">Hatırlatma gönder</button>`
    : "";
  return `<div class="activity-row" data-uid="${escapeHTML(user.uid)}">
    <div class="activity-who">
      <strong>${escapeHTML(name)}</strong>
      <span class="muted">${escapeHTML(dept)}${email ? ` · ${escapeHTML(email)}` : ""}</span>
    </div>
    <div class="activity-when">${escapeHTML(lastText)}</div>
    <div class="activity-actions">${nudgeBtn}</div>
  </div>`;
}

function nudgeMailtoUrl(name, days) {
  const subject = `Tarih Vakfı gönüllü takibi: kısa hatırlatma`;
  const inactiveLine = days == null || days === ""
    ? "Son zamanlarda sistemde rapor görünmüyor."
    : `Son raporun üzerinden yaklaşık ${days} gün geçmiş.`;
  const body = [
    `Merhaba ${name || ""},`,
    "",
    inactiveLine,
    "Müsait olduğunda kısa bir rapor yazabilir veya bir engel varsa bize iletebilir misin?",
    "",
    "Teşekkürler,",
    "Tarih Vakfı koordinasyon"
  ].join("\r\n");
  return { subject, body };
}

// --- Per-unit drill-down modal ---

const workStatusLabels = {
  in_progress: "Devam ediyor",
  unit_done: "Birim bitti",
  blocked: "Takıldı"
};

let drillCurrentUnitId = null;
let drillCurrentReports = [];

function openUnitDrill(unitId) {
  // Drill-down queries reports by archiveUnitId, which is only allowed by
  // Firestore rules for coordinators/admins. Guard client-side too so a
  // misplaced button can't trigger a rejected query for volunteers.
  if (!isStaff()) return;
  const unit = archiveById[unitId];
  const modal = document.getElementById("unitDrillModal");
  if (!unit || !modal) return;
  drillCurrentUnitId = unitId;
  drillCurrentReports = [];

  document.getElementById("drillTitle").textContent = archiveLabel(unit);
  const subtitleBits = [];
  if (unit.sourceCode) subtitleBits.push(`Kaynak: ${unit.sourceCode}`);
  if (unit.boxNo) subtitleBits.push(`Kutu: ${unit.boxNo}`);
  if (unit.seriesNo) subtitleBits.push(`Seri: ${unit.seriesNo}`);
  if (unit.materialType) subtitleBits.push(unit.materialType);
  document.getElementById("drillSubtitle").textContent = subtitleBits.join(" · ");

  const progress = percent(unit.completedDocumentCount || unit.completedFileCount || 0, unit.documentCount || unit.fileCount || 0);
  const stats = [
    ["Durum", statusLabel(unit.status || "not_started")],
    ["İlerleme", `${progress}%`],
    ["Sayfa", numberText(unit.pageCount)],
    ["Belge", `${numberText(unit.completedDocumentCount || 0)} / ${numberText(unit.documentCount || 0)}`],
    ["Dosya", `${numberText(unit.completedFileCount || 0)} / ${numberText(unit.fileCount || 0)}`]
  ];
  document.getElementById("drillStats").innerHTML = stats.map(([k, v]) => (
    `<div class="drill-stat"><span>${escapeHTML(k)}</span><strong>${escapeHTML(String(v))}</strong></div>`
  )).join("") + `<div class="drill-progress" title="${progress}%"><span style="width:${progress}%"></span></div>`;

  const blockerEl = document.getElementById("drillBlocker");
  if (unit.blockerNote && unit.status === "blocked") {
    blockerEl.innerHTML = `<div class="revision-alert"><strong>Engel</strong><p>${escapeHTML(unit.blockerNote)}</p></div>`;
  } else if (unit.blockerNote) {
    blockerEl.innerHTML = `<div class="drill-note"><strong>Not</strong><p>${escapeHTML(unit.blockerNote)}</p></div>`;
  } else {
    blockerEl.innerHTML = "";
  }

  // Assigned volunteers: names from allUsers where possible, fallback to stored emails.
  const uids = Array.isArray(unit.assignedToUids) ? unit.assignedToUids : [];
  const emails = Array.isArray(unit.assignedToEmails) ? unit.assignedToEmails : [];
  const namesFromUids = uids.map((uid) => {
    const u = allUsers.find((x) => x.uid === uid);
    return u ? userDisplayName(u) : findUserName(uid) || uid;
  });
  const seen = new Set(namesFromUids);
  const namesFromEmails = emails.filter((e) => {
    const match = allUsers.find((x) => (x.data?.email || "").toLowerCase() === String(e).toLowerCase());
    const label = match ? userDisplayName(match) : e;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  const assignedList = [...namesFromUids, ...namesFromEmails];
  document.getElementById("drillAssignees").innerHTML = assignedList.length
    ? assignedList.map((n) => `<span class="drill-chip">${escapeHTML(n)}</span>`).join("")
    : '<p class="muted">Bu birime henüz kimse atanmadı.</p>';

  document.getElementById("drillExportCsv").classList.toggle("hidden", !isStaff());
  document.getElementById("drillReports").innerHTML = '<p class="muted">Yükleniyor...</p>';

  // Populate the staff-only Ayarla edit section in the drill-down.
  const drillEdit = document.getElementById("drillEdit");
  if (drillEdit) {
    if (isStaff()) {
      drillEdit.classList.remove("hidden");
      const statusSel = document.getElementById("drillEditStatus");
      const prioSel = document.getElementById("drillEditPriority");
      const dueInp = document.getElementById("drillEditDue");
      const assignSel = document.getElementById("drillEditAssign");
      const blockerTa = document.getElementById("drillEditBlocker");
      const msg = document.getElementById("drillEditMsg");
      if (statusSel) statusSel.value = unit.status || "not_started";
      if (prioSel) prioSel.value = unit.priority || "medium";
      if (dueInp) dueInp.value = unit.dueDate || "";
      if (blockerTa) blockerTa.value = unit.blockerNote || "";
      if (assignSel) assignSel.innerHTML = userOptions(unit.assignedToUids || []);
      const sheetUrlInp = document.getElementById("drillEditSheetUrl");
      if (sheetUrlInp) sheetUrlInp.value = unit.sheetUrl || "";
      if (msg) msg.textContent = "";
      drillEdit.dataset.unitId = unitId;
    } else {
      drillEdit.classList.add("hidden");
    }
  }

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  // Focus the close button for keyboard users.
  setTimeout(() => modal.querySelector("[data-drill-close]")?.focus(), 50);

  loadDrillReports(unitId).catch((error) => {
    document.getElementById("drillReports").innerHTML = `<p class="muted">Raporlar yüklenemedi: ${escapeHTML(error.message)}</p>`;
  });
}

async function loadDrillReports(unitId) {
  const container = document.getElementById("drillReports");
  // Security rules enforce per-user visibility server-side; we just render what comes back.
  const snap = await getDocs(query(
    collection(db, "reports"),
    where("archiveUnitId", "==", unitId),
    orderBy("createdAt", "desc"),
    limit(50)
  ));
  if (drillCurrentUnitId !== unitId) return; // user closed/switched while loading
  drillCurrentReports = snap.docs.map((item) => ({ id: item.id, ...item.data() }));

  if (drillCurrentReports.length === 0) {
    container.innerHTML = '<p class="muted">Bu birim için henüz rapor yok.</p>';
    return;
  }

  // Cumulative pagesDone across the visible reports (chronological sum).
  const chrono = drillCurrentReports.slice().reverse();
  let running = 0;
  const runningByReportId = new Map();
  chrono.forEach((r) => {
    const p = Number(r.pagesDone || 0);
    running += Number.isFinite(p) ? p : 0;
    runningByReportId.set(r.id, running);
  });
  const totalPages = running;

  const reportRows = drillCurrentReports.map((r) => {
    const who = r.userUid ? (findUserName(r.userUid) || r.userEmail || "—") : (r.userEmail || "—");
    const createdAt = toDateFromTs(r.createdAt);
    const dateStr = createdAt ? createdAt.toLocaleDateString("tr-TR") + " " + createdAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : (r.reportDate || "—");
    const ws = r.workStatus ? `<span class="drill-tag ws-${escapeHTML(r.workStatus)}">${escapeHTML(workStatusLabels[r.workStatus] || r.workStatus)}</span>` : "";
    const src = r.source ? `<span class="drill-tag src-${escapeHTML(r.source)}">${escapeHTML(r.source === "quick" ? "Hızlı" : "Detaylı")}</span>` : "";
    const pages = r.pagesDone != null && r.pagesDone !== "" ? `<span class="drill-pages">${numberText(r.pagesDone)} sayfa</span>` : "";
    const cumulative = runningByReportId.has(r.id) ? `<span class="drill-cum">Toplam: ${numberText(runningByReportId.get(r.id))}</span>` : "";
    const summary = r.summary ? `<p class="drill-summary">${escapeHTML(r.summary)}</p>` : "";
    const reviewStatus = r.status ? `<span class="drill-tag review-${escapeHTML(r.status)}">${escapeHTML(reportStatusLabels[r.status] || r.status)}</span>` : "";
    return `<article class="drill-report">
      <header>
        <div><strong>${escapeHTML(who)}</strong><span class="muted"> · ${escapeHTML(dateStr)}</span></div>
        <div class="drill-tags">${ws}${src}${reviewStatus}</div>
      </header>
      <div class="drill-numbers">${pages}${cumulative}${r.hours ? `<span class="drill-hours">${numberText(r.hours)} saat</span>` : ""}</div>
      ${summary}
    </article>`;
  }).join("");

  const banner = `<div class="drill-summary-banner"><strong>${numberText(drillCurrentReports.length)}</strong> rapor · <strong>${numberText(totalPages)}</strong> sayfa toplam</div>`;
  container.innerHTML = banner + reportRows;
}

function closeUnitDrill() {
  const modal = document.getElementById("unitDrillModal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  drillCurrentUnitId = null;
  drillCurrentReports = [];
}

function exportDrillCsv() {
  if (!drillCurrentUnitId || !drillCurrentReports.length) return;
  const unit = archiveById[drillCurrentUnitId];
  const rows = [["createdAt_iso", "volunteer", "email", "workStatus", "pagesDone", "hours", "reviewStatus", "source", "summary"]];
  // Chronological order for analysis.
  drillCurrentReports.slice().reverse().forEach((r) => {
    const createdAt = toDateFromTs(r.createdAt);
    const who = r.userUid ? (findUserName(r.userUid) || "") : "";
    rows.push([
      createdAt ? createdAt.toISOString() : "",
      who,
      r.userEmail || "",
      r.workStatus || "",
      r.pagesDone == null ? "" : String(r.pagesDone),
      r.hours == null ? "" : String(r.hours),
      r.status || "",
      r.source || "",
      r.summary || ""
    ]);
  });
  const csv = rows.map((r) => r.map((v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (unit ? archiveLabel(unit) : drillCurrentUnitId).replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 50) || drillCurrentUnitId;
  a.href = url;
  a.download = `arsiv-birim-${slug}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Build a CSV of volunteer activity for offline analysis.
function exportActivityCsv() {
  const pool = volunteerPool();
  const rows = [["uid", "ad_soyad", "email", "departman", "lastReportAt_iso", "gun_once", "kova"]];
  pool.forEach((u) => {
    const last = toDateFromTs(u.data?.lastReportAt);
    const d = last ? daysSince(last) : "";
    rows.push([
      u.uid,
      userDisplayName(u),
      u.data?.email || "",
      u.data?.department || "",
      last ? last.toISOString() : "",
      d === "" ? "" : String(d),
      bucketForUser(u)
    ]);
  });
  const csv = rows.map((r) => r.map((v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `gonullu-aktiflik-${stamp}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
  if (!isStaff()) {
    hero.textContent = "";
    statsEl.innerHTML = "";
    return;
  }
  if (!archiveUnits.length) {
    hero.textContent = "Genel çalışma ortamı";
    statsEl.innerHTML = `<div class="pnb-empty-action">PNB arşiv iş paketleri görünmüyor. PNB dışındaki işler aynı ekrandaki Diğer işler bölümünden yürütülebilir. Yönetici olarak veri bakım araçları için Bakım sekmesini açabilirsiniz.</div>`;
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
  const rows = [["Atanmamış", totals.unassigned], ["Engelli", totals.blocked], ["Tamamlandı", totals.done], ["Toplam iş", totals.units]];
  statsEl.innerHTML = rows.map(([label, value]) => `<div class="kpi-card"><strong>${numberText(value)}</strong><span>${escapeHTML(label)}</span></div>`).join("");
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
  if (!staff) {
    return `<article id="archive-unit-${escapeHTML(unit.id)}" class="simple-work-card archive-card ${escapeHTML(unit.status || "not_started")}">
      <div>
        <span class="mission-label">Arşiv işi</span>
        <h3>${escapeHTML(archiveLabel(unit))}</h3>
        <p>${escapeHTML(statusLabel(unit.status || "not_started"))} · ${numberText(unit.pageCount)} sayfa · ${numberText(unit.documentCount)} belge</p>
        ${unit.notes ? `<p class="mission-note">${escapeHTML(unit.notes)}</p>` : ""}
        ${unit.blockerNote ? `<div class="revision-alert"><strong>Engel</strong><p>${escapeHTML(unit.blockerNote)}</p></div>` : ""}
        <details class="blocker-details">
          <summary>Engel bildir</summary>
          <textarea rows="2" data-vol-blocker="${unit.id}" placeholder="Kısaca yazın...">${escapeHTML(unit.blockerNote || "")}</textarea>
          <button class="btn btn-secondary btn-sm" type="button" data-block-au="${unit.id}">Gönder</button>
        </details>
      </div>
      <div class="archive-actions">
        <button class="btn btn-primary btn-sm" type="button" data-report-au="${unit.id}">Rapor yaz</button>
      </div>
    </article>`;
  }
  let html = `<article id="archive-unit-${escapeHTML(unit.id)}" class="archive-card ${escapeHTML(unit.status || "not_started")}">
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
      <div class="archive-actions"><button class="btn btn-primary btn-sm" data-save-au="${unit.id}">Kaydet</button><button class="btn btn-secondary btn-sm" data-create-task-au="${unit.id}">İş oluştur</button><button class="btn btn-secondary btn-sm" data-report-au="${unit.id}">Rapor yaz</button><button class="btn btn-secondary btn-sm" data-drill-unit="${unit.id}">Geçmişi aç</button></div>
    </div>`;
  } else {
    html += `<div class="archive-controls"><label>Engel bildir <textarea rows="2" data-vol-blocker="${unit.id}" placeholder="Bu işte sizi durduran sorunu yazın...">${escapeHTML(unit.blockerNote || "")}</textarea></label><div class="archive-actions"><button class="btn btn-primary btn-sm" data-report-au="${unit.id}">Rapor yaz</button><button class="btn btn-secondary btn-sm" data-block-au="${unit.id}">Engel bildir</button><button class="btn btn-secondary btn-sm" data-drill-unit="${unit.id}">Geçmişi aç</button></div></div>`;
  }
  return `${html}</article>`;
}

// Staff table row: a compact single-line summary. Clicking the row opens the
// existing drill-down panel (reused) which shows the full report history.
// The row is a native <tr> so keyboard+screen-reader nav works; a dedicated
// "Düzenle" button on the side opens an edit panel for status/priority/etc.
function archiveTableRow(unit) {
  const progress = percent(unit.completedDocumentCount || unit.completedFileCount || 0, unit.documentCount || unit.fileCount || 0);
  const label = archiveLabel(unit);
  const incomplete = archiveLabelIncomplete(unit);
  const status = unit.status || "not_started";
  const statusText = statusLabel(status);
  const box = unit.boxNo ? `Kutu ${unit.boxNo}` : "—";
  const uids = unit.assignedToUids || [];
  const emails = unit.assignedToEmails || [];
  const avatars = [];
  const seen = new Set();
  uids.slice(0, 3).forEach((uid) => {
    const u = allUsers.find((x) => x.uid === uid);
    const name = u ? userDisplayName(u) : (findUserName(uid) || "?");
    const initials = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    if (seen.has(initials + name)) return;
    seen.add(initials + name);
    avatars.push(`<span class="av" title="${escapeHTML(name)}">${escapeHTML(initials || "?")}</span>`);
  });
  const extraCount = (uids.length + emails.length) - avatars.length;
  const avatarsHtml = avatars.length
    ? `<span class="av-stack">${avatars.join("")}</span>${extraCount > 0 ? `<span class="av-more">+${extraCount}</span>` : ""}`
    : '<span class="unit-hint" style="font-size:.8rem">Atanmamış</span>';
  const lastReport = toDateFromTs(unit.latestReportAt);
  const lastText = lastReport ? daysSinceLabel(daysSince(lastReport)) : "—";
  const subHint = incomplete
    ? '<div class="unit-hint incomplete">İsim/kaynak bilgisi eksik</div>'
    : `<div class="unit-hint">${numberText(unit.fileCount)} dosya · ${numberText(unit.pageCount)} sayfa${unit.materialType ? ` · ${escapeHTML(unit.materialType)}` : ""}</div>`;
  return `<tr class="clickable" id="archive-unit-${escapeHTML(unit.id)}" data-drill-unit="${escapeHTML(unit.id)}" role="button" tabindex="0">
    <td><div class="unit-label">${escapeHTML(label)}</div>${subHint}</td>
    <td>${escapeHTML(box)}</td>
    <td><span class="status-pill ${escapeHTML(status)}">${escapeHTML(statusText)}</span></td>
    <td>${avatarsHtml}</td>
    <td><div class="unit-progress"><span style="width:${progress}%"></span></div><div class="unit-progress-label">${progress}%</div></td>
    <td class="unit-hint">${escapeHTML(lastText)}</td>
  </tr>`;
}

function renderArchiveUnitsTable(units) {
  return `<div class="units-wrap">
    <table class="units-table">
      <colgroup><col style="width:34%"><col style="width:10%"><col style="width:13%"><col style="width:18%"><col style="width:14%"><col style="width:11%"></colgroup>
      <thead><tr><th>Birim</th><th>Kutu</th><th>Durum</th><th>Atanan</th><th>İlerleme</th><th>Son rapor</th></tr></thead>
      <tbody>${units.map(archiveTableRow).join("")}</tbody>
    </table>
  </div>`;
}

// Compute counts for the status chip filter row (admin İşler tab).
function unitStatusCounts() {
  const counts = { not_started: 0, assigned: 0, in_progress: 0, review: 0, done: 0, blocked: 0, unassigned: 0, total: 0 };
  archiveUnits.forEach((u) => {
    counts.total += 1;
    const s = u.status || "not_started";
    counts[s] = (counts[s] || 0) + 1;
    if (!(u.assignedToUids || []).length && !(u.assignedToEmails || []).length) counts.unassigned += 1;
  });
  return counts;
}

function renderUnitsChipRow() {
  const host = document.getElementById("unitsChipRow");
  if (!host) return;
  const c = unitStatusCounts();
  const active = document.getElementById("pnbStatusFilter")?.value || "";
  const makeChip = (value, label, count) => (
    `<button type="button" class="unit-chip${active === value ? " on" : ""}${count > 0 && value === "blocked" ? " attn" : ""}" data-chip-status="${escapeHTML(value)}"><strong>${numberText(count)}</strong>${escapeHTML(label)}</button>`
  );
  host.innerHTML = [
    makeChip("", "Tümü", c.total),
    makeChip("not_started", "Başlamadı", c.not_started || 0),
    makeChip("in_progress", "Devam", c.in_progress || 0),
    makeChip("review", "Kontrol", c.review || 0),
    makeChip("done", "Tamamlandı", c.done || 0),
    makeChip("blocked", "Engelli", c.blocked || 0)
  ].join("");
}

function renderArchiveUnits() {
  const el = document.getElementById("archiveUnitList");
  if (!el) return;
  const filterStatus = document.getElementById("pnbStatusFilter")?.value || "";
  const searchInput = document.getElementById("unitsSearchInput");
  const searchText = searchInput ? searchInput.value.trim().toLocaleLowerCase("tr") : "";
  let units = archiveUnits.slice();
  if (filterStatus) units = units.filter((unit) => (unit.status || "not_started") === filterStatus);
  if (searchText) {
    units = units.filter((unit) => {
      const hay = [
        archiveLabel(unit),
        unit.title || "",
        unit.sourceCode || "",
        unit.boxNo || "",
        unit.seriesNo || "",
        unit.materialType || "",
        unit.notes || "",
        unit.blockerNote || ""
      ].join(" ").toLocaleLowerCase("tr");
      return hay.includes(searchText);
    });
  }
  if (isStaff()) {
    renderUnitsChipRow();
    el.innerHTML = units.length
      ? renderArchiveUnitsTable(units)
      : htmlEmpty("Bu filtrede arşiv birimi yok.");
  } else {
    el.innerHTML = units.length ? units.map(archiveCard).join("") : htmlEmpty("Sana atanmış arşiv işi yok.");
  }
}

function renderPnb() {
  const volunteer = !isStaff();
  document.getElementById("tab-pnb")?.classList.toggle("volunteer-work", volunteer);
  document.getElementById("pnbArchivePanel")?.classList.toggle("hidden", volunteer && !archiveUnits.length);
  const title = document.getElementById("pnbTitle");
  const intro = document.getElementById("pnbIntro");
  const archiveTitle = document.getElementById("pnbArchiveTitle");
  const archiveHint = document.getElementById("pnbArchiveHint");
  if (volunteer) {
    if (title) title.textContent = "İşim";
    if (intro) intro.textContent = "Sana atanan işler burada. Birini açıp rapor yazman yeterli.";
    if (archiveTitle) archiveTitle.textContent = "İşim";
    if (archiveHint) archiveHint.textContent = "Sadece sana atanmış işler görünür.";
  } else {
    if (title) title.textContent = "Atanacak ve yapılacak işler";
    if (intro) intro.textContent = "Koordinatör için atama ve takip; gönüllü için kendi işi ve rapor aksiyonu.";
    if (archiveTitle) archiveTitle.textContent = "İş listesi";
    if (archiveHint) archiveHint.textContent = "Bir kart, bir iş. Atama, durum, engel ve rapor aynı yerden.";
  }
  renderPnbStats();
  renderNextActions();
  renderCommunicationPlans();
  renderArchiveUnits();
  populateArchiveSelects();
  renderPeopleOps();
  renderHomeOverview();
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
  // After reset (including cancel-edit), return to the quick form as the default view.
  document.getElementById("reportFormCard")?.classList.add("hidden");
  document.getElementById("quickReportCard")?.classList.remove("hidden");
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
      const path = write.label || write.ref.path;
      throw new Error(`${error.message} (${path})`);
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
      if (!existingUser) return;
      const uid = existingUser.uid;
      const userData = {
        uid,
        email: person.email,
        fullName: existingUser.data?.fullName || person.fullName,
        phone: person.phone || existingUser?.data?.phone || "",
        department: existingUser.data?.department || "Arşiv",
        role: existingUser?.data?.role || "volunteer",
        status: existingUser?.data?.status || "approved",
        notes: existingUser?.data?.notes || "",
        skillsText: existingUser.data?.skillsText || [person.projectRole, person.profession, person.educationDepartment].filter(Boolean).join(" · "),
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
      writes.push({ ref: doc(db, "users", uid), data: userData, label: `users/${uid}` });
    });

    const emailToUid = new Map();
    allUsers.forEach((user) => {
      const email = String(user.data?.email || "").toLowerCase();
      if (email) emailToUid.set(email, user.uid);
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
document.getElementById("activityDeptFilter")?.addEventListener("change", renderActivityPanel);
document.getElementById("unitsSearchInput")?.addEventListener("input", () => renderArchiveUnits());

// Close the unit drill-down modal on Escape.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const modal = document.getElementById("unitDrillModal");
  if (modal && !modal.classList.contains("hidden")) {
    if (modal.classList.contains("channel-mode")) closeUnitChannel();
    else closeUnitDrill();
  }
});

// Kanban controls (search, my-only toggle)
document.getElementById("kbSearchInput")?.addEventListener("input", () => renderKanban());
document.getElementById("kbMyOnly")?.addEventListener("click", () => {
  kbShowMyOnly = !kbShowMyOnly;
  renderKanban();
});

// Stylish home search input
document.getElementById("svSearch")?.addEventListener("input", () => renderStylishHome());

// Stylish home action cards
document.getElementById("svActNext")?.addEventListener("click", () => {
  const btn = document.getElementById("svActNext");
  const unitId = btn?.dataset.unitId || "";
  if (unitId) openUnitChannel(unitId);
  else sw("pnb");
});
document.getElementById("svActAttention")?.addEventListener("click", () => {
  // Staff: jump to İşler with Engelli filter. Volunteer: just jump to İşler.
  sw("pnb");
  if (isStaff()) {
    const select = document.getElementById("pnbStatusFilter");
    if (select) { select.value = "blocked"; renderArchiveUnits(); }
  }
});
document.getElementById("svActWeek")?.addEventListener("click", () => {
  // Staff: review queue; Volunteer: their recent reports.
  sw("reports");
});
document.getElementById("svActTeam")?.addEventListener("click", () => {
  // Jump to the team / activity section depending on role.
  if (isStaff()) {
    sw("management");
    setTimeout(() => document.getElementById("activityPanel")?.setAttribute("open", ""), 60);
  } else {
    sw("announcements");
  }
});
document.getElementById("waCta")?.addEventListener("click", () => {
  const btn = document.getElementById("waCta");
  const unitId = btn?.dataset.unitId || "";
  if (unitId) openUnitChannel(unitId);
});

// Channel composer: quick actions + send
let composerMode = null; // null | "pages" | "blocker" | "done"
function setComposerMode(mode) {
  composerMode = mode;
  const pagesInput = document.getElementById("chComposePages");
  document.querySelectorAll('#chComposer [data-compose]').forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.compose === mode);
  });
  if (pagesInput) pagesInput.classList.toggle("hidden", mode !== "pages");
  if (mode === "pages") setTimeout(() => pagesInput?.focus(), 40);
}
document.addEventListener("click", (event) => {
  const btn = event.target.closest('#chComposer [data-compose]');
  if (!btn) return;
  const mode = btn.dataset.compose;
  if (mode === "paste") {
    const raw = prompt("Excel/Sheets'ten kopyaladığın satırları yapıştır:");
    if (!raw) return;
    const summary = raw.split("\n").map((r) => r.trim()).filter(Boolean).slice(0, 10).join(" · ");
    sendChannelMessage({ type: "note", text: `Tablodan: ${summary}`, pagesDone: null });
    return;
  }
  if (composerMode === mode) {
    setComposerMode(null);
  } else {
    setComposerMode(mode);
  }
});
document.getElementById("chComposeSend")?.addEventListener("click", async () => {
  const textEl = document.getElementById("chComposeText");
  const pagesEl = document.getElementById("chComposePages");
  const text = textEl?.value || "";
  const pagesVal = pagesEl?.value;
  const pagesDone = composerMode === "pages" && pagesVal !== "" ? Math.max(0, Math.floor(Number(pagesVal) || 0)) : null;
  const type = composerMode || "note";
  if (!text.trim() && pagesDone === null && type !== "done" && type !== "blocker") {
    textEl?.focus();
    return;
  }
  await sendChannelMessage({ type, text, pagesDone });
  if (textEl) textEl.value = "";
  if (pagesEl) pagesEl.value = "";
  setComposerMode(null);
  textEl?.focus();
});
document.getElementById("chComposeText")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.getElementById("chComposeSend")?.click();
  }
});

// "Ayarla…" button inside the channel side pane → opens the existing drillEdit
// details element in-place. Keeps edit UI in one place.
document.addEventListener("click", (event) => {
  if (event.target.id !== "chOpenEdit") return;
  // Leave channel mode so drillEdit is visible
  const modal = document.getElementById("unitDrillModal");
  if (!modal) return;
  const unitId = drillCurrentUnitId;
  if (!unitId) return;
  modal.classList.remove("channel-mode");
  openUnitDrill(unitId);
  // Auto-open the edit section
  const edit = document.getElementById("drillEdit");
  if (edit) edit.open = true;
});

// Save the staff-only edit section inside the drill-down modal. Mirrors the
// legacy archiveCard edit flow but opens from the table-row click path.
document.getElementById("drillEditSave")?.addEventListener("click", async () => {
  if (!isStaff() || !db) return;
  const drillEdit = document.getElementById("drillEdit");
  const unitId = drillEdit?.dataset.unitId || drillCurrentUnitId;
  if (!unitId) return;
  const msg = document.getElementById("drillEditMsg");
  const btn = document.getElementById("drillEditSave");
  const selected = Array.from(document.getElementById("drillEditAssign")?.selectedOptions || []).map((o) => o.value);
  const assignedEmails = selected.map((uid) => {
    const u = allUsers.find((x) => x.uid === uid);
    return (u?.data?.email || "").toLowerCase();
  }).filter(Boolean);
  const sheetUrlRaw = document.getElementById("drillEditSheetUrl")?.value?.trim() || "";
  const update = {
    status: document.getElementById("drillEditStatus").value,
    priority: document.getElementById("drillEditPriority").value,
    dueDate: document.getElementById("drillEditDue").value || null,
    blockerNote: document.getElementById("drillEditBlocker").value.trim(),
    assignedToUids: selected,
    assignedToEmails: assignedEmails,
    sheetUrl: sheetUrlRaw,
    updatedAt: serverTimestamp()
  };
  btn.disabled = true;
  if (msg) msg.textContent = "Kaydediliyor…";
  try {
    await updateDoc(doc(db, "archiveUnits", unitId), update);
    if (msg) msg.textContent = "Kaydedildi.";
    await reloadPnb();
    // Refresh drill-down view with updated data.
    openUnitDrill(unitId);
  } catch (error) {
    if (msg) msg.textContent = `Hata: ${error.message}`;
  } finally {
    btn.disabled = false;
  }
});
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
  const tabTarget = event.target.closest("[data-go-tab]");
  if (tabTarget) {
    const tabName = tabTarget.dataset.goTab === "tasks" ? "pnb" : tabTarget.dataset.goTab;
    // If the element also carries data-status-filter, apply it on the İşler tab.
    const statusFilter = tabTarget.dataset.statusFilter;
    if (statusFilter !== undefined) {
      const select = document.getElementById("pnbStatusFilter");
      if (select) { select.value = statusFilter || ""; renderArchiveUnits(); }
    }
    sw(tabName);
    const scrollTarget = tabTarget.dataset.scrollTo ? document.getElementById(tabTarget.dataset.scrollTo) : document.getElementById(`tab-${tabName}`);
    if (scrollTarget?.tagName === "DETAILS") scrollTarget.open = true;
    scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
    const focusId = tabTarget.dataset.focus;
    if (focusId) setTimeout(() => document.getElementById(focusId)?.focus(), 150);
    return;
  }

  // Volunteer activity nudge: opens a prefilled mailto: so the coordinator
  // can personalize and send via their own mail client. Keeps us fully
  // client-side (no Apps Script / Cloud Function needed).
  const nudgeBtn = event.target.closest("[data-nudge-email]");
  if (nudgeBtn) {
    const email = nudgeBtn.dataset.nudgeEmail || "";
    const name = nudgeBtn.dataset.nudgeName || "";
    const days = nudgeBtn.dataset.nudgeDays || "";
    const target = findUserByEmail(email);
    if (target?.data?.rhythm === "casual" && !confirm("Bu kişi serbest tempo olarak işaretli. Yine de hatırlatma gönderilsin mi?")) return;
    const { subject, body } = nudgeMailtoUrl(name, days);
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return;
  }

  if (event.target.id === "exportActivityBtn") {
    exportActivityCsv();
    return;
  }

  // Kanban card menu: toggle the ⋮ dropdown. Clicking the menu button or
  // its items must not bubble up to the card click (which opens the channel).
  const kbMenuBtn = event.target.closest("[data-kb-menu]");
  if (kbMenuBtn) {
    event.stopPropagation();
    const id = kbMenuBtn.dataset.kbMenu;
    const list = document.querySelector(`[data-kb-menu-list="${id}"]`);
    document.querySelectorAll(".kb-menu-list.open").forEach((el) => { if (el !== list) el.classList.remove("open"); });
    list?.classList.toggle("open");
    return;
  }
  const kbMoveBtn = event.target.closest("[data-kb-move]");
  if (kbMoveBtn) {
    event.stopPropagation();
    const id = kbMoveBtn.dataset.kbMove;
    const to = kbMoveBtn.dataset.moveTo;
    document.querySelectorAll(".kb-menu-list.open").forEach((el) => el.classList.remove("open"));
    moveUnitStatus(id, to);
    return;
  }
  const kbSheetBtn = event.target.closest("[data-kb-sheet]");
  if (kbSheetBtn) {
    event.stopPropagation();
    const url = kbSheetBtn.dataset.kbSheet;
    document.querySelectorAll(".kb-menu-list.open").forEach((el) => el.classList.remove("open"));
    if (url) window.open(url, "_blank", "noopener");
    return;
  }
  // Close any open kanban menus when clicking outside.
  if (!event.target.closest(".kb-menu-list") && !event.target.closest("[data-kb-menu]")) {
    document.querySelectorAll(".kb-menu-list.open").forEach((el) => el.classList.remove("open"));
  }

  // Kanban card click → open the channel view for that unit.
  const kbCard = event.target.closest("[data-kb-unit]");
  if (kbCard) {
    openUnitChannel(kbCard.dataset.kbUnit);
    return;
  }

  const drillOpen = event.target.closest("[data-drill-unit]");
  if (drillOpen) {
    openUnitDrill(drillOpen.dataset.drillUnit);
    return;
  }
  const drillClose = event.target.closest("[data-drill-close]");
  if (drillClose) {
    closeUnitDrill();
    return;
  }
  if (event.target.id === "drillExportCsv") {
    exportDrillCsv();
    return;
  }

  // Units status chip row (İşler): click a chip to filter.
  const chipBtn = event.target.closest("[data-chip-status]");
  if (chipBtn) {
    const value = chipBtn.dataset.chipStatus || "";
    const select = document.getElementById("pnbStatusFilter");
    if (select) select.value = value;
    renderArchiveUnits();
    return;
  }

  const selfClaimBtn = event.target.closest("[data-self-claim]");
  if (selfClaimBtn) {
    event.preventDefault();
    await handleSelfClaim(selfClaimBtn);
    return;
  }
  const selfReleaseBtn = event.target.closest("[data-self-release]");
  if (selfReleaseBtn) {
    event.preventDefault();
    await handleSelfRelease(selfReleaseBtn);
    return;
  }

  // Home queue CTA: volunteer clicks "Bana bir iş ver" or "İşe git" →
  // jump to the unit on the İşler tab and focus it.
  if (event.target.id === "homeQueueBtn") {
    const action = event.target.dataset.queueAction || "";
    const unitId = event.target.dataset.unitId || "";
    if (action === "announcements") {
      sw("announcements");
      return;
    }
    if (unitId) {
      sw("pnb");
      setTimeout(() => document.getElementById(`archive-unit-${unitId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
    return;
  }

  const openWork = event.target.closest("[data-open-work]");
  if (openWork) {
    const unitId = openWork.dataset.openWork;
    sw("pnb");
    document.getElementById(`archive-unit-${unitId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const openBlocker = event.target.closest("[data-open-blocker]");
  if (openBlocker) {
    const unitId = openBlocker.dataset.openBlocker;
    sw("pnb");
    document.getElementById(`archive-unit-${unitId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const blockerField = document.querySelector(`[data-vol-blocker="${unitId}"]`);
      const details = blockerField?.closest("details");
      if (details) details.open = true;
      blockerField?.focus();
    }, 250);
    return;
  }

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

  const reportTask = event.target.closest("[data-report-task]");
  if (reportTask) {
    const taskItem = taskItems.find((item) => item.id === reportTask.dataset.reportTask);
    const task = taskItem?.data || {};
    document.getElementById("archiveUnitSelect").value = task.archiveUnitId || "";
    document.getElementById("taskId").value = task.title || "Genel iş";
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
    sw("pnb");
    document.querySelector("#adminTaskForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    document.getElementById("taskMessage").textContent = "İşi düzenliyorsunuz...";
    sw("pnb");
    document.querySelector("#adminTaskForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const deleteTask = event.target.closest("[data-dt]");
  if (deleteTask && db) {
    if (!confirm("Bu işi silmek istediğinize emin misiniz?")) return;
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
    // Edits always happen in the detailed form; reveal it and hide the quick card.
    document.getElementById("reportFormCard")?.classList.remove("hidden");
    document.getElementById("quickReportCard")?.classList.add("hidden");
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
      await loadAllUsers();
      await lp();
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
      const updateData = {
        fullName: row.querySelector(`[data-fn="${uid}"]`).value.trim(),
        email: row.querySelector(`[data-em="${uid}"]`).value.trim().toLowerCase(),
        phone: row.querySelector(`[data-ph="${uid}"]`).value.trim(),
        department: row.querySelector(`[data-dp="${uid}"]`).value,
        role: row.querySelector(`[data-ru="${uid}"]`).value,
        status: row.querySelector(`[data-su="${uid}"]`).value,
        skillsText: row.querySelector(`[data-sk="${uid}"]`).value.trim(),
        coordinatorNotes: row.querySelector(`[data-cn="${uid}"]`).value.trim(),
        rhythm: row.querySelector(`[data-rh="${uid}"]`).value || null,
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "users", uid), updateData);
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
      await loadAllUsers();
    } catch (error) {
      alert(`Hata: ${error.message}`);
      deleteUser.disabled = false;
      deleteUser.textContent = "Sil";
    }
  }
});

// Shared helper for creating a new report. Writes the report doc, updates
// users/{targetUid}.lastReportAt, and (if linked) updates the archive unit's
// status + latestReportAt — all in a single atomic batch.
// Derives the archive unit's new status from the volunteer's workStatus when
// provided ("unit_done" -> review, "blocked" -> blocked, else in_progress).
async function createReportBatched(data, { targetUid, targetEmail }) {
  const archiveUnitId = data.archiveUnitId || "";
  const batch = writeBatch(db);
  const reportRef = doc(collection(db, "reports"));
  const reportDoc = {
    ...data,
    userUid: targetUid,
    userEmail: targetEmail,
    status: "submitted",
    reviewerUid: null,
    feedback: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(reportRef, reportDoc);

  // Denormalize: keep users/{uid}.lastReportAt + lastSeenAt in sync for
  // "active vs stalled" admin views. Only fields in userSelfEditableFields()
  // (or admin-modifiable) are touched here.
  if (targetUid) {
    batch.update(doc(db, "users", targetUid), {
      lastReportAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  if (archiveUnitId) {
    const currentStatus = archiveById[archiveUnitId]?.status;
    let nextStatus = currentStatus || "in_progress";
    if (data.workStatus === "unit_done") nextStatus = "review";
    else if (data.workStatus === "blocked") nextStatus = "blocked";
    else if (currentStatus === "not_started" || currentStatus === "assigned") nextStatus = "in_progress";
    const unitUpdate = {
      status: nextStatus,
      latestReportAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (data.workStatus === "blocked" && data.summary) unitUpdate.blockerNote = data.summary;
    batch.update(doc(db, "archiveUnits", archiveUnitId), unitUpdate);
  }

  await batch.commit();
  return { reportId: reportRef.id, reportDoc };
}

function notifyStaffOfReport(targetUid, taskLabel) {
  allUsers.forEach((user) => {
    if ((user.data.role === "admin" || user.data.role === "coordinator") && user.uid !== cu.uid) {
      createNotif(user.uid, "report_submitted", `Yeni rapor gönderildi: ${taskLabel} - ${findUserName(targetUid)}`, "reports");
    }
  });
}

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
    pagesDone: null,
    workStatus: archiveUnitId ? "in_progress" : null,
    source: "detailed",
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
      await createReportBatched(data, { targetUid, targetEmail });
      document.getElementById("reportMessage").textContent = "Rapor kaydedildi!";
      notifyStaffOfReport(targetUid, data.taskId);
    }
    rf();
    setTimeout(() => { document.getElementById("reportMessage").textContent = ""; }, 3000);
    await lr();
    await reloadPnb();
  } catch (error) {
    document.getElementById("reportMessage").textContent = `Hata: ${error.message}`;
  }
});

// Quick report form: minimal fields, mobile-first, reuses the atomic helper.
document.getElementById("quickReportForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cu || !db) return;
  const messageEl = document.getElementById("quickReportMessage");
  const archiveUnitId = document.getElementById("quickArchiveUnitSelect").value || "";
  const workStatus = document.getElementById("quickWorkStatus").value || "in_progress";
  const pagesDoneRaw = document.getElementById("quickPagesDone").value;
  const pagesDone = pagesDoneRaw === "" ? null : Math.max(0, Math.floor(Number(pagesDoneRaw) || 0));
  const summary = document.getElementById("quickSummary").value.trim();

  if (!archiveUnitId) {
    messageEl.textContent = "Lütfen bir arşiv birimi seçin.";
    return;
  }
  // Require at least pagesDone OR a short note so the report has some content.
  if (pagesDone === null && !summary && workStatus === "in_progress") {
    messageEl.textContent = "Sayfa sayısı veya kısa bir not yazın.";
    return;
  }

  const unitLabel = archiveById[archiveUnitId] ? archiveLabel(archiveById[archiveUnitId]) : archiveUnitId;
  const data = {
    taskId: unitLabel,
    archiveUnitId,
    projectId: PNB_PROJECT_ID,
    summary,
    hours: 0,
    pagesDone,
    workStatus,
    source: "quick",
    reportDate: td(),
    links: [],
    images: [],
    coworkerUids: []
  };

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    await createReportBatched(data, { targetUid: cu.uid, targetEmail: cu.email || "" });
    messageEl.textContent = "Teşekkürler, rapor alındı.";
    notifyStaffOfReport(cu.uid, unitLabel);
    event.target.reset();
    setTimeout(() => { messageEl.textContent = ""; }, 3000);
    await lr();
    await reloadPnb();
  } catch (error) {
    messageEl.textContent = `Hata: ${error.message}`;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

// Toggle between quick and detailed report forms.
document.getElementById("toggleDetailedBtn")?.addEventListener("click", () => {
  document.getElementById("quickReportCard")?.classList.add("hidden");
  document.getElementById("reportFormCard")?.classList.remove("hidden");
  document.getElementById("taskId")?.focus();
});
document.getElementById("toggleQuickBtn")?.addEventListener("click", () => {
  document.getElementById("reportFormCard")?.classList.add("hidden");
  document.getElementById("quickReportCard")?.classList.remove("hidden");
  document.getElementById("quickArchiveUnitSelect")?.focus();
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
      document.getElementById("taskMessage").textContent = "İş güncellendi!";
      delete event.target.dataset.editId;
    } else {
      data.createdByUid = cu.uid;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "tasks"), data);
      document.getElementById("taskMessage").textContent = "İş oluşturuldu!";
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
    if (assignedUid && assignedUid !== cu.uid) createNotif(assignedUid, "task_assigned", `Size yeni iş atandı: ${data.title}`, "pnb");
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
    setRoleShell(staff);
    hu.textContent = cp.fullName || user.email;
    if (staff) {
      document.querySelectorAll(".staff-tab").forEach((tab) => tab.classList.remove("hidden"));
      document.querySelectorAll(".staff-only").forEach((item) => item.classList.remove("hidden"));
      document.getElementById("adminTaskForm")?.classList.remove("hidden");
      document.getElementById("adminAnnouncementForm")?.classList.remove("hidden");
      document.getElementById("reportUserRow")?.classList.remove("hidden");
    }
    document.getElementById("tab-reports")?.classList.toggle("volunteer-report", !staff);
    if (isAdmin()) {
      document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.remove("hidden"));
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
