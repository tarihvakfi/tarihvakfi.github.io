// Snapshot-first loader: static GitHub Pages with optional live Apps Script overlay.
(function () {
  const U = window.TVFUtils;
  const Aggregate = window.TVFAggregate;
  const Renderer = window.TVFRenderDashboard;

  const params = new URLSearchParams(location.search);
  const liveOnly = params.get('live') === '1';
  const debug = params.get('debug') === '1';
  let rendered = false;

  function renderPayload(raw, allowLegacy) {
    const payload = Aggregate.normalizePayload(raw);
    if (!payload || !payload.publicSummary) return false;
    if (!allowLegacy && !isCompatibleSummary(payload.publicSummary)) return false;
    applyVolunteerProfiles(payload);
    Renderer.renderDashboard(payload, { debug, allowLegacy });
    rendered = true;
    return true;
  }

  function publishLivePayload(raw) {
    const payload = Aggregate.normalizePayload(raw);
    if (!payload || !payload.publicSummary) return;
    window.TVF_PUBLIC_DATA = payload;
    window.__SNAPSHOT__ = { ok: true, generatedAt: payload.generatedAt, data: payload };
    window.TVF_LIVE_DATA_READY = true;
    applyVolunteerProfiles(payload);
    if (window.TVF && typeof window.TVF.renderRosterSections === 'function') {
      window.TVF.renderRosterSections();
    }
    document.dispatchEvent(new CustomEvent('tvf:data', { detail: payload }));
  }

  if (!liveOnly) {
    renderPayload(window.TVF_PUBLIC_DATA || window.__SNAPSHOT__, true);
  }

  const url = window.__SHEETSYNC_URL__;
  const configured = typeof url === 'string'
    && url.includes('script.google.com')
    && !url.includes('REPLACE_ME');

  if (configured) {
    const sep = url.includes('?') ? '&' : '?';
    fetch(`${url}${sep}public=1&period=rolling_7_days&t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      redirect: 'follow'
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((body) => {
        if (!body || body.ok !== true) return;
        const raw = body.data || body;
        if (renderPayload(raw, !rendered)) publishLivePayload(raw);
      })
      .catch(() => {
        if (!rendered) Renderer.renderError();
      });
  } else if (!rendered) {
    Renderer.renderError();
  }

  function isCompatibleSummary(summary) {
    return summary
      && summary.source
      && summary.source.recordsAreFullAggregate === true
      && summary.source.volunteerCredit === 'credit-visible, ID-safe volunteer display'
      && summary.period
      && summary.period.mode === 'rolling_7_days';
  }

  function applyVolunteerProfiles(payload) {
    const profiles = payload
      && payload.content
      && Array.isArray(payload.content.volunteerProfiles)
      ? payload.content.volunteerProfiles
      : [];
    const roster = window.TVF_ROSTER;
    if (!profiles.length || !roster || !Array.isArray(roster.volunteers)) return;

    const bySlug = {};
    const byName = {};
    roster.volunteers.forEach((volunteer) => {
      if (volunteer.slug) bySlug[volunteer.slug] = volunteer;
      byName[foldName(volunteer.name)] = volunteer;
    });

    profiles.forEach((profile) => {
      const slug = String(profile.slug || '').trim();
      const name = String(profile.name || '').trim();
      if (!slug && !name) return;
      let volunteer = bySlug[slug] || byName[foldName(name)];
      if (!volunteer) {
        volunteer = {
          name: name || slug,
          slug: slug || slugifyName(name),
          city: '',
          role: '',
          tv_role: 'Gönüllü',
          uni: '',
          dept: '',
          topics: [],
          slots: [],
          sessions: 0,
          tracks: [],
          byMonth: {},
          scanners: [],
          boxes: [],
          firstSeen: null,
          lastSeen: null,
          active: false,
          log: [],
          bio: {}
        };
        roster.volunteers.push(volunteer);
      }
      if (name) volunteer.name = name;
      if (slug) volunteer.slug = slug;
      ['city', 'role', 'uni', 'dept'].forEach((key) => {
        if (profile[key] != null) volunteer[key] = String(profile[key]);
      });
      ['topics', 'slots'].forEach((key) => {
        if (Array.isArray(profile[key])) volunteer[key] = profile[key].map(String).filter(Boolean);
      });
      if (profile.bio && typeof profile.bio === 'object') {
        volunteer.bio = Object.assign({}, volunteer.bio || {}, profile.bio);
      }
      bySlug[volunteer.slug] = volunteer;
      byName[foldName(volunteer.name)] = volunteer;
    });

    if (roster.source) {
      roster.source.bioSize = roster.volunteers.filter((volunteer) => {
        const bio = volunteer.bio || {};
        return Object.keys(bio).some((key) => String(bio[key] || '').trim());
      }).length;
    }
  }

  function foldName(value) {
    return String(value || '')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[ıİI]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[şŞ]/g, 's')
      .replace(/[üÜ]/g, 'u')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function slugifyName(value) {
    return foldName(value).replace(/\s+/g, '-') || 'gonullu';
  }
})();
