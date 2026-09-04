(function attachHistorySync(globalScope) {
  const COUNT_THRESHOLD = 25;
  const TIME_SAFETY_NET_MIN = 240;
  const MAX_WAIT_MS = TIME_SAFETY_NET_MIN * 60 * 1000;
  const pageEntries =
    globalScope.SurfMindPageEntries ||
    (typeof require === "function" ? require("./pageEntries") : null);

  const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const resolveSyncConfig = (stored = {}) => {
    const countThreshold = parsePositiveInteger(
      stored.syncCountThreshold,
      COUNT_THRESHOLD
    );
    const timeSafetyNetMin = parsePositiveInteger(
      stored.syncTimeSafetyNetMin,
      TIME_SAFETY_NET_MIN
    );
    return {
      countThreshold,
      timeSafetyNetMin,
      maxWaitMs: timeSafetyNetMin * 60 * 1000,
    };
  };

  const getCapturedAt = (entry, fallback) => {
    if (Number.isFinite(entry.capturedAt)) return entry.capturedAt;
    const parsedDate = Date.parse(entry.date);
    return Number.isNaN(parsedDate) ? fallback : parsedDate;
  };

  const toApiEntry = ({ synced, capturedAt, captureId, ...entry }) => entry;

  const coalesceHistoryEntries = (entries) => {
    const entriesBySection = new Map();

    for (const entry of entries) {
      const sectionKey = `${entry.url || ""}\u0000${JSON.stringify(
        entry.heading_path || []
      )}`;
      const existing = entriesBySection.get(sectionKey);
      if (!existing) {
        entriesBySection.set(sectionKey, { ...entry });
        continue;
      }

      if (existing.capturedAt !== entry.capturedAt) {
        const existingTime = Number(existing.capturedAt) || 0;
        const entryTime = Number(entry.capturedAt) || 0;
        if (entryTime >= existingTime)
          entriesBySection.set(sectionKey, { ...entry });
        continue;
      }

      entriesBySection.set(sectionKey, {
        ...existing,
        ...entry,
        content: [existing.content, entry.content]
          .filter(Boolean)
          .join("\n")
          .trim(),
      });
    }

    return Array.from(entriesBySection.values());
  };

  const createHistorySync = ({
    chromeApi,
    fetchImpl,
    now = () => Date.now(),
    createId = () => crypto.randomUUID(),
  }) => {
    let syncInFlight = null;

    const normalizeHistory = (entries) => {
      const normalizedAt = now();
      let changed = false;
      const normalized = entries.map((entry) => {
        const nextEntry = {
          ...entry,
          synced: entry.synced === true,
          capturedAt: getCapturedAt(entry, normalizedAt),
          captureId: entry.captureId || createId(),
        };
        if (
          nextEntry.synced !== entry.synced ||
          nextEntry.capturedAt !== entry.capturedAt ||
          nextEntry.captureId !== entry.captureId
        ) {
          changed = true;
        }
        return nextEntry;
      });
      return { normalized, changed };
    };

    const performSync = async ({ force, reason, host }) => {
      const stored = await chromeApi.storage.local.get({
        navigationData: [],
        lastSyncTime: null,
        apiHost: "",
        userId: "",
        syncCountThreshold: COUNT_THRESHOLD,
        syncTimeSafetyNetMin: TIME_SAFETY_NET_MIN,
      });
      const syncConfig = resolveSyncConfig(stored);
      const { normalized, changed } = normalizeHistory(stored.navigationData);

      if (changed) {
        await chromeApi.storage.local.set({ navigationData: normalized });
      }

      const unsynced = normalized.filter((entry) => !entry.synced);
      if (unsynced.length === 0) {
        return { success: true, synced: 0, skipped: "empty" };
      }

      const oldestCapture = Math.min(
        ...unsynced.map((entry) => entry.capturedAt)
      );
      const countReady =
        pageEntries.countDistinctPages(unsynced) >= syncConfig.countThreshold;
      const timeReady =
        reason === "time" && now() - oldestCapture >= syncConfig.maxWaitMs;

      if (!force && !countReady && !timeReady) {
        return { success: true, synced: 0, skipped: "threshold" };
      }

      const apiHost = host || stored.apiHost;
      if (!apiHost) {
        return {
          success: false,
          synced: 0,
          error: "API host is not configured",
        };
      }

      let userId = stored.userId;
      if (!userId) {
        userId = createId();
        await chromeApi.storage.local.set({ userId });
      }

      const response = await fetchImpl(`${apiHost}/save-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: coalesceHistoryEntries(unsynced).map(toApiEntry),
          browser_uuid: userId,
          flag: "history",
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          synced: 0,
          error: `History sync failed with status ${response.status}`,
        };
      }

      const syncedIds = new Set(unsynced.map((entry) => entry.captureId));
      const latest = await chromeApi.storage.local.get({ navigationData: [] });
      const updatedHistory = latest.navigationData.map((entry) =>
        syncedIds.has(entry.captureId) ? { ...entry, synced: true } : entry
      );
      const completedAt = now();
      await chromeApi.storage.local.set({
        navigationData: updatedHistory,
        lastSyncTime: completedAt,
      });

      return {
        success: true,
        synced: unsynced.length,
        lastSyncTime: completedAt,
      };
    };

    const maybeSync = (options = {}) => {
      if (syncInFlight) {
        return syncInFlight.then(() => maybeSync(options));
      }
      syncInFlight = performSync({
        force: options.force === true,
        reason: options.reason || "count",
        host: options.host || "",
      }).finally(() => {
        syncInFlight = null;
      });
      return syncInFlight;
    };

    return { maybeSync };
  };

  const exported = {
    COUNT_THRESHOLD,
    TIME_SAFETY_NET_MIN,
    MAX_WAIT_MS,
    resolveSyncConfig,
    coalesceHistoryEntries,
    createHistorySync,
  };
  globalScope.SurfMindHistorySync = exported;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof self !== "undefined" ? self : globalThis);
