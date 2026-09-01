// DORMANT — not loaded by any page since 20dc113 (2026-08-08,
// "Remove weekly station plan + inline check-in section"). That commit dropped
// the 35 lines of markup from index.html, including the <script> tag for this
// file, per a coordinator decision to remove the homepage station plan. The
// code was kept deliberately for a possible revival: the Apps Script
// 'checkin' endpoint and the server-side weeklyPlan payload still exist, and
// TVFRenderDashboard.hydrateWeeklyPlan() is still there as a guarded no-op.
//
// Nothing here runs today. The element IDs it queries (lpCheckinToggle,
// lpCheckinInline, ciGate, ciDayToggles, …) exist in no page, so the early
// `if (!toggleBtn || !panel) return;` would bail out even if it were loaded.
// The matching styles are also still in css/site.css (.tv-checkin-inline,
// .ci-day-toggle, .ci-hidden). To revive: restore the markup from 20dc113^
// and re-add the <script> tag.

// Inline self check-in — embedded directly in the main dashboard page.
// Reuses window.TVF_LAST_CONTENT (already fetched by data-loader.js) instead
// of fetching its own copy, and after a successful write it patches that
// same content object's weeklyPlan.extras locally, then calls
// TVFRenderDashboard.hydrateWeeklyPlan() to refresh the visible table in
// place — no navigation, no separate page, no full reload.
(function () {
  const TR_WEEKDAYS_5 = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
  const U = window.TVFUtils;

  const toggleBtn = document.getElementById('lpCheckinToggle');
  const panel = document.getElementById('lpCheckinInline');
  const gate = document.getElementById('ciGate');
  const daysWrap = document.getElementById('ciDaysWrap');
  const pwInput = document.getElementById('ciPw');
  const nameSelect = document.getElementById('ciNameSelect');
  const customNameField = document.getElementById('ciCustomNameField');
  const customNameInput = document.getElementById('ciCustomNameInput');
  const enterBtn = document.getElementById('ciEnterBtn');
  const gateStatus = document.getElementById('ciGateStatus');
  const greeting = document.getElementById('ciGreeting');
  const dayToggles = document.getElementById('ciDayToggles');
  const daysStatus = document.getElementById('ciDaysStatus');

  if (!toggleBtn || !panel) return; // markup not present on this page

  let password = '';
  let selectedName = '';
  let opened = false;
  let pollTimer = null;
  let lastLocalChangeAt = 0;

  toggleBtn.addEventListener('click', () => {
    const willOpen = panel.classList.contains('ci-hidden');
    panel.classList.toggle('ci-hidden', !willOpen);
    toggleBtn.textContent = willOpen ? 'katılımını gizle ↑' : 'katılımını işaretle →';
    if (willOpen && !opened) {
      opened = true;
      populateNames();
    }
  });

  function populateNames() {
    const roster = (window.TVF_ROSTER && Array.isArray(window.TVF_ROSTER.volunteers)) ? window.TVF_ROSTER.volunteers : [];
    const names = roster.map((v) => v.name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr'));
    names.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      nameSelect.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = '__other__';
    customOpt.textContent = 'Listede yok, adımı yazacağım…';
    nameSelect.appendChild(customOpt);
  }

  nameSelect.addEventListener('change', () => {
    const isCustom = nameSelect.value === '__other__';
    customNameField.classList.toggle('ci-hidden', !isCustom);
    if (isCustom) customNameInput.focus();
  });

  function foldName(v) { return U && U.foldName ? U.foldName(v) : String(v || '').toLowerCase(); }
  function escapeHtml(v) { return U && U.escapeHtml ? U.escapeHtml(v) : String(v == null ? '' : v); }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function weekDates() {
    const now = new Date();
    const todayKey = dateKey(now);
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    return TR_WEEKDAYS_5.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dateKey(d);
      return { label, isPast: key < todayKey, isToday: key === todayKey };
    });
  }

  function currentPlan() {
    return (window.TVF_LAST_CONTENT && window.TVF_LAST_CONTENT.weeklyPlan) || { days: TR_WEEKDAYS_5, stations: [], extras: {} };
  }

  function isCheckedToday(day) {
    const plan = currentPlan();
    return ((plan.extras && plan.extras[day]) || []).some((e) => e && foldName(e.name) === foldName(selectedName));
  }

  function renderToggles() {
    dayToggles.innerHTML = '';
    weekDates().forEach(({ label, isPast, isToday }) => {
      const checked = isCheckedToday(label);
      const wrap = document.createElement('label');
      wrap.className = 'ci-day-toggle' + (checked ? ' is-checked' : '') + (isPast ? ' is-locked' : '') + (isToday ? ' is-today' : '');
      if (isPast) {
        wrap.innerHTML = `<span>${escapeHtml(label)} · geçti</span>`;
      } else {
        wrap.innerHTML = `<input type="checkbox" data-day="${escapeHtml(label)}" ${checked ? 'checked' : ''} /><span>${escapeHtml(label)}</span>`;
      }
      dayToggles.appendChild(wrap);
    });
    dayToggles.querySelectorAll('input[type="checkbox"]').forEach((box) => {
      box.addEventListener('change', () => sendCheckIn(box.dataset.day, box.checked, box));
    });
  }

  function applyLocalCheckIn(day, present) {
    const content = window.TVF_LAST_CONTENT;
    if (!content || !content.weeklyPlan) return;
    content.weeklyPlan.extras = content.weeklyPlan.extras || {};
    const list = content.weeklyPlan.extras[day] || [];
    const withoutMe = list.filter((e) => e && foldName(e.name) !== foldName(selectedName));
    content.weeklyPlan.extras[day] = present ? withoutMe.concat([{ name: selectedName, device: null }]) : withoutMe;
    if (window.TVFRenderDashboard && window.TVFRenderDashboard.hydrateWeeklyPlan) {
      window.TVFRenderDashboard.hydrateWeeklyPlan(content); // live-refresh the visible table, no reload
    }
  }

  async function sendCheckIn(day, present, checkboxEl) {
    daysStatus.className = 'ci-status';
    daysStatus.textContent = 'Kaydediliyor…';
    const url = window.__SHEETSYNC_URL__;
    if (!(typeof url === 'string' && url.includes('script.google.com'))) {
      daysStatus.className = 'ci-status err';
      daysStatus.textContent = 'Canlı bağlantı yapılandırılmamış — kaydedilemedi.';
      checkboxEl.checked = !present;
      return;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight
        body: JSON.stringify({ action: 'checkin', password, name: selectedName, day, present })
      });
      const body = await res.json();
      if (!body || body.ok !== true) throw new Error((body && body.error) || 'unknown_error');
      applyLocalCheckIn(day, present);
      lastLocalChangeAt = Date.now();
      daysStatus.className = 'ci-status ok';
      daysStatus.textContent = present ? `${day} için işaretlendi ✓` : `${day} için kaldırıldı.`;
    } catch (err) {
      const msg = err && err.message;
      if (msg === 'past_day_locked') {
        daysStatus.className = 'ci-status err';
        daysStatus.textContent = `${day} artık geçmişte kaldı, değiştirilemez.`;
        renderToggles();
        return;
      }
      daysStatus.className = 'ci-status err';
      daysStatus.textContent = 'Kaydedilemedi, tekrar dener misin? (' + msg + ')';
      checkboxEl.checked = !present;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastLocalChangeAt < 4000) return;
      if (!daysWrap.classList.contains('ci-hidden')) renderToggles();
    }, 20000);
  }

  enterBtn.addEventListener('click', () => {
    password = pwInput.value.trim();
    selectedName = nameSelect.value === '__other__'
      ? (customNameInput.value.trim())
      : nameSelect.value;
    if (!password || !selectedName) {
      gateStatus.className = 'ci-status err';
      gateStatus.textContent = 'Şifre ve isim gerekli.';
      return;
    }
    gateStatus.textContent = '';
    gate.classList.add('ci-hidden');
    daysWrap.classList.remove('ci-hidden');
    greeting.textContent = `Merhaba, ${selectedName}`;
    renderToggles();
    startPolling();
  });
})();
