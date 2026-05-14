// Credit-visible, ID-safe volunteer display helpers.
(function () {
  const UNNAMED = 'Adı belirtilmeyen gönüllü';
  const HIDDEN = 'İsmini gizlemeyi tercih eden gönüllü';

  const NAME_KEYS = [
    'publicDisplayName', 'public_display_name', 'kamusalAd', 'kamusal_ad',
    'volunteerName', 'volunteer_name', 'name', 'adSoyad', 'ad_soyad',
    'paydas', 'paydaş', 'kaydiOlusturan', 'kaydi_olusturan',
    'kaydiOlusuran', 'kaydi_olusuran', 'kaydıOluşturan',
    '_sheet_person', 'sheetPerson'
  ];

  const FIRST_KEYS = ['firstName', 'first_name', 'ad', 'isim'];
  const LAST_KEYS = ['lastName', 'last_name', 'soyad', 'soyisim'];
  const OPTOUT_KEYS = [
    'public_credit', 'credit_visible', 'hide_name', 'name_hidden',
    'publicCredit', 'creditVisible', 'hideName', 'ad_gizli',
    'adGizli', 'ismini_gizle', 'isminiGizle'
  ];

  function fold(value) {
    return String(value || '').replace(/ı/g, 'i').replace(/İ/g, 'I')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }

  function looksOptedOut(value) {
    const text = fold(value).trim().toLowerCase();
    if (!text) return false;
    return ['no', 'false', '0', 'hayir', 'hayır', 'gizli', 'hide', 'hidden', 'evet', 'yes', '1', 'true'].includes(text);
  }

  function hasExplicitOptOut(row) {
    return OPTOUT_KEYS.some((key) => {
      if (!Object.prototype.hasOwnProperty.call(row || {}, key)) return false;
      const raw = row[key];
      const normalizedKey = fold(key).toLowerCase();
      const text = fold(raw).trim().toLowerCase();
      if (normalizedKey.includes('credit_visible')) return ['false', '0', 'no', 'hayir', 'hayır'].includes(text);
      if (normalizedKey.includes('public_credit')) return ['no', 'false', '0', 'hayir', 'hayır'].includes(text);
      return looksOptedOut(raw);
    });
  }

  function isUnsafePublicIdentifier(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) return true;
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(text)) return true;
    if (/^[0-9a-fA-F]{12,}$/.test(text)) return true;
    if (/^(sheet|row|uid|user|firebase|google|apps?|script|token|id)[_:-]/i.test(text)) return true;
    const compact = text.replace(/[^A-Za-z0-9]/g, '');
    if (compact.length >= 24) return true;
    if (compact.length >= 16 && /[0-9]/.test(compact) && /[A-Za-z]/.test(compact)) {
      const words = text.match(/[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/g) || [];
      const vowels = text.match(/[aeıioöuüAEIİOÖUÜ]/g) || [];
      if (words.length < 2 || vowels.length < 2) return true;
    }
    return false;
  }

  function normalizeVolunteerName(value) {
    let text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || isUnsafePublicIdentifier(text)) return '';
    text = text.replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, '');
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)) return '';
    if (text.length > 64) return '';
    return text;
  }

  function valueFrom(row, keys) {
    for (const key of keys) {
      const value = row && row[key];
      const name = normalizeVolunteerName(value);
      if (name) return name;
    }
    return '';
  }

  function getVolunteerDisplayName(row) {
    if (hasExplicitOptOut(row || {})) return HIDDEN;
    const explicit = valueFrom(row, ['publicDisplayName', 'public_display_name', 'kamusalAd', 'kamusal_ad']);
    if (explicit) return explicit;
    const full = valueFrom(row, NAME_KEYS);
    if (full) return full;
    const first = valueFrom(row, FIRST_KEYS);
    const last = valueFrom(row, LAST_KEYS);
    const combined = normalizeVolunteerName(`${first} ${last}`.trim());
    if (combined) return combined;
    if (first) return first;
    return UNNAMED;
  }

  function collectVolunteerCredits(records) {
    const byName = new Map();
    (records || []).forEach((record) => {
      const label = getVolunteerDisplayName(record);
      const key = label.toLocaleLowerCase('tr');
      const current = byName.get(key) || { label, records: 0, pageRows: 0, activityRows: 0, pagesDone: 0, boxes: {} };
      current.records += 1;
      if (record.kind === 'activity') current.activityRows += 1;
      else current.pageRows += 1;
      current.pagesDone += Number(record.pagesDone || record.pageUnits || 0);
      if (record.boxLabel || record.box) {
        const box = record.boxLabel || `Kutu ${record.box}`;
        current.boxes[box] = (current.boxes[box] || 0) + 1;
      }
      byName.set(key, current);
    });
    return Array.from(byName.values()).sort((a, b) => b.records - a.records || a.label.localeCompare(b.label, 'tr'));
  }

  window.TVFVolunteerCredit = {
    UNNAMED,
    HIDDEN,
    getVolunteerDisplayName,
    isUnsafePublicIdentifier,
    normalizeVolunteerName,
    collectVolunteerCredits
  };
})();
