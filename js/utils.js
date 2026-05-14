// Tarih Vakfı · Sayım Defteri shared browser utilities.
(function () {
  const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const TR_WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNum(value) {
    return new Intl.NumberFormat('tr-TR').format(Number(value) || 0);
  }

  function formatPct(value) {
    const n = Number(value) || 0;
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  }

  function toISODate(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function weekdayTR(iso) {
    const d = new Date(`${toISODate(iso)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : TR_WEEKDAYS[d.getDay()];
  }

  function formatDayMonth(value) {
    const iso = toISODate(value);
    if (!iso) return '—';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getDate()} ${TR_MONTHS[d.getMonth()]}`;
  }

  function formatHM(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function relativeDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'az önce';
    const diff = Date.now() - d.getTime();
    const mins = Math.max(0, Math.round(diff / 60000));
    if (mins < 2) return 'az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    return formatDayMonth(d);
  }

  function initialOf(value) {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toLocaleUpperCase('tr') : '·';
  }

  function sameIsoDate(a, b) {
    return toISODate(a) === toISODate(b);
  }

  function isLocalPreview() {
    return ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  }

  function countBy(rows, fn) {
    const out = {};
    (rows || []).forEach((row) => {
      const key = fn(row);
      if (!key) return;
      out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  function counterToRows(obj) {
    const entries = Object.entries(obj || {});
    const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);
    return entries.sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0], 'tr'))
      .map(([key, count]) => ({
        material: key,
        label: key.charAt(0).toLocaleUpperCase('tr') + key.slice(1),
        count,
        percent: total ? Math.round((Number(count) / total) * 1000) / 10 : 0
      }));
  }

  window.TVFUtils = {
    TR_MONTHS,
    TR_WEEKDAYS,
    escapeHtml,
    formatNum,
    formatPct,
    toISODate,
    weekdayTR,
    formatDayMonth,
    formatHM,
    relativeDate,
    initialOf,
    sameIsoDate,
    isLocalPreview,
    countBy,
    counterToRows
  };
})();
