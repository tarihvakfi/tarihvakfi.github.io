export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function setHTML(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

export function formatDate(value) {
  if (!value) return "-";
  try {
    const date = value && typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(date);
  } catch (error) {
    return String(value);
  }
}

export function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function showMessage(id, message, tone = "muted") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `status-line ${tone}`;
}

export function badge(status = "") {
  const normalized = String(status).toLowerCase();
  var labels={volunteer:"Gönüllü",coordinator:"Koordinatör",admin:"Yönetici",pending:"Beklemede",approved:"Onaylı",blocked:"Engelli"};
  return `<span class="badge ${normalized}">${escapeHTML(labels[normalized] || normalized || "unknown")}</span>`;

}
