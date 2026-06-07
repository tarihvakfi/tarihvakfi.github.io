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
    fetch(`${url}${sep}public=1&t=${Date.now()}`, {
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
      && (summary.period.mode === 'calendar_week_to_date' || summary.period.mode === 'rolling_7_days');
  }
})();
