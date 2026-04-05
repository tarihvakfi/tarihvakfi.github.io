import { escapeHTML, formatDate, badge } from "./helpers.js";

export function renderUserCard(user) {
  if (!user) return `<p class="empty">Kullanıcı bilgisi bulunamadı.</p>`;
  return `
    <div class="list-card">
      <strong>${escapeHTML(user.fullName || "-")}</strong>
      <div>${escapeHTML(user.email || "-")}</div>
      <div>Departman: ${escapeHTML(user.department || "-")}</div>
      <div>Rol: ${escapeHTML(user.role || "-")}</div>
      <div>Durum: ${badge(user.status || "pending")}</div>
    </div>
  `;
}

export function renderTaskCard(task) {
  return `
    <div class="list-card">
      <strong>${escapeHTML(task.title || "-")}</strong>
      <div>${escapeHTML(task.description || "")}</div>
      <div>Departman: ${escapeHTML(task.department || "-")}</div>
      <div>Öncelik: ${escapeHTML(task.priority || "medium")}</div>
      <div>Durum: ${escapeHTML(task.status || "open")}</div>
      <div>Son tarih: ${formatDate(task.dueDate)}</div>
    </div>
  `;
}

export function renderReportCard(report) {
  return `
    <div class="list-card">
      <strong>${escapeHTML(report.summary || "-")}</strong>
      <div>Saat: ${escapeHTML(report.hours || "-")}</div>
      <div>Tarih: ${formatDate(report.reportDate)}</div>
      <div>Durum: ${escapeHTML(report.status || "submitted")}</div>
    </div>
  `;
}

export function renderAnnouncementCard(item) {
  return `
    <div class="list-card">
      <strong>${escapeHTML(item.title || "-")}</strong>
      <div>${escapeHTML(item.body || "")}</div>
      <div>Hedef: ${escapeHTML(item.audience || "all")}</div>
      <div>Tarih: ${formatDate(item.createdAt)}</div>
    </div>
  `;
}
