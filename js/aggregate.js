// Browser-side normalization and legacy fallback for public dashboard payloads.
(function () {
  const U = window.TVFUtils;

  function normalizePayload(payload) {
    if (!payload) return null;
    if (payload.publicSummary) return payload;
    if (payload.data && payload.data.publicSummary) return payload.data;
    if (payload.ok === true && payload.data) return normalizePayload(payload.data);
    const legacy = legacySummary(payload);
    return legacy ? { publicSummary: legacy, latestActivity: [], content: payload.content || {} } : null;
  }

  function legacySummary(payload) {
    const stats = payload && payload.stats && payload.stats.projects && payload.stats.projects.pnb;
    const ticker = Array.isArray(payload && payload.ticker) ? payload.ticker : [];
    if (!stats && !ticker.length) return null;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    const period = {
      mode: 'rolling_7_days',
      startDate: U.toISODate(start),
      endDate: U.toISODate(today),
      label: `Güncel dönem · ${U.formatDayMonth(start)} – ${U.formatDayMonth(today)}`,
      isPartial: false
    };
    const rows = ticker.filter((row) => {
      const iso = U.toISODate(row.when || row.createdAt);
      return iso && iso >= period.startDate && iso <= period.endDate;
    });
    const materials = U.counterToRows(U.countBy(rows, (r) => r.materialCategory || 'belgeler'));
    const pagesDone = Number(stats && stats.donePages) || rows.length;
    const pagesTarget = Number(stats && stats.totalPages) || 0;
    return {
      generatedAt: new Date().toISOString(),
      period,
      totals: {
        records: rows.length,
        pageRows: rows.length,
        activityRows: 0,
        periodPagesDone: rows.length,
        pagesDone,
        pagesTarget,
        progressPercent: pagesTarget ? Math.round((pagesDone / pagesTarget) * 1000) / 10 : 0,
        boxesTotal: Number(stats && stats.cataloguedBoxes) || null,
        boxesCatalogued: Number(stats && stats.cataloguedBoxes) || 0,
        boxesActive: 0,
        boxesCompleted: 0,
        boxesRemaining: null,
        volunteersActive: 0,
        materials: materials.length
      },
      byDay: [],
      byMaterial: materials,
      byBox: [],
      byVolunteer: [],
      highlights: {},
      warnings: [{ code: 'legacy_payload', message: 'Live endpoint has not deployed publicSummary yet.' }],
      source: { recordsAreFullAggregate: false, latestActivityCap: rows.length }
    };
  }

  window.TVFAggregate = { normalizePayload, legacySummary };
})();
