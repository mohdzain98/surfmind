(function attachPageEntries(globalScope) {
  const getEntryTimestamp = (entry, fallbackIndex = 0) => {
    if (Number.isFinite(entry?.capturedAt)) return entry.capturedAt;

    for (const value of [entry?.visited_at, entry?.date]) {
      if (Number.isFinite(value)) return value;
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }

    return fallbackIndex;
  };

  const groupEntriesByUrl = (entries = []) => {
    const pagesByUrl = new Map();

    entries.forEach((entry, index) => {
      const url = String(entry?.url || "");
      const timestamp = getEntryTimestamp(entry, index);
      const existing = pagesByUrl.get(url);
      if (existing) {
        existing.entries.push(entry);
        existing.latestTimestamp = Math.max(
          existing.latestTimestamp,
          timestamp
        );
        existing.lastIndex = index;
        return;
      }

      pagesByUrl.set(url, {
        url,
        entries: [entry],
        latestTimestamp: timestamp,
        lastIndex: index,
      });
    });

    return Array.from(pagesByUrl.values()).sort(
      (left, right) =>
        left.latestTimestamp - right.latestTimestamp ||
        left.lastIndex - right.lastIndex
    );
  };

  const selectRecentPages = (entries, pageLimit) => {
    const limit = Number.parseInt(pageLimit, 10);
    if (!Number.isFinite(limit) || limit <= 0) return [];
    return groupEntriesByUrl(entries)
      .slice(-limit)
      .flatMap((page) => page.entries);
  };

  const countDistinctPages = (entries) => groupEntriesByUrl(entries).length;

  const exported = {
    getEntryTimestamp,
    groupEntriesByUrl,
    selectRecentPages,
    countDistinctPages,
  };
  globalScope.SurfMindPageEntries = exported;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof self !== "undefined" ? self : globalThis);
