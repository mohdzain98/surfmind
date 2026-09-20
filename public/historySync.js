(function attachHistorySync(globalScope) {
  const COUNT_THRESHOLD = 25;
  const TIME_SAFETY_NET_MIN = 240;
  const MAX_WAIT_MS = TIME_SAFETY_NET_MIN * 60 * 1000;
  const MAX_HISTORY_SECTION_CHARS = 2_000;
  const MAX_HISTORY_SECTIONS_PER_PAGE = 15;
  const MAX_HISTORY_PAYLOAD_BYTES = 2 * 1024 * 1024;
  const DATA_SCHEMA_VERSION_KEY = "dataSchemaVersion";
  const HISTORY_DATA_SCHEMA_VERSION_KEY = "historyDataSchemaVersion";
  const HISTORY_RESYNC_IN_PROGRESS_KEY = "historyResyncInProgress";
  const pageEntries =
    globalScope.SurfMindPageEntries ||
    (typeof require === "function" ? require("./pageEntries") : null);

  const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const normalizeDataSchemaVersion = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  };

  const readDataSchemaVersion = (payload) => {
    const data = payload?.data || payload || {};
    return normalizeDataSchemaVersion(
      data.dataSchemaVersion ?? data.data_schema_version
    );
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

  const capString = (value, maxLength) =>
    String(value || "").slice(0, maxLength);

  const toApiEntry = ({ synced, capturedAt, captureId, ...entry }) => ({
    ...entry,
    title: capString(entry.title, 500),
    url: capString(entry.url, 8_192),
    content: capString(entry.content, MAX_HISTORY_SECTION_CHARS),
    domain: capString(entry.domain, 253),
    heading_path: Array.isArray(entry.heading_path)
      ? entry.heading_path.slice(0, 8).map((part) => capString(part, 300))
      : [],
  });

  const getHistoryEntryKey = (entry) =>
    `${entry.url || ""}\u0000${JSON.stringify(entry.heading_path || [])}`;

  const coalesceHistoryEntries = (entries) => {
    const entriesBySection = new Map();

    for (const entry of entries) {
      const sectionKey = getHistoryEntryKey(entry);
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

  const prepareHistorySyncRecords = (entries) => {
    const captureIdsBySection = new Map();
    for (const entry of entries) {
      const sectionKey = getHistoryEntryKey(entry);
      const captureIds = captureIdsBySection.get(sectionKey) || [];
      if (entry.captureId) captureIds.push(entry.captureId);
      captureIdsBySection.set(sectionKey, captureIds);
    }

    const selectedSectionKeys = new Set();
    const sectionCountByUrl = new Map();
    const records = [];
    for (const entry of coalesceHistoryEntries(entries)) {
      const url = String(entry.url || "");
      const sectionCount = sectionCountByUrl.get(url) || 0;
      if (sectionCount >= MAX_HISTORY_SECTIONS_PER_PAGE) continue;

      const sectionKey = getHistoryEntryKey(entry);
      selectedSectionKeys.add(sectionKey);
      sectionCountByUrl.set(url, sectionCount + 1);
      records.push({
        apiEntry: toApiEntry(entry),
        captureIds: captureIdsBySection.get(sectionKey) || [],
      });
    }

    const omittedCaptureIds = entries
      .filter((entry) => !selectedSectionKeys.has(getHistoryEntryKey(entry)))
      .map((entry) => entry.captureId)
      .filter(Boolean);

    return { records, omittedCaptureIds };
  };

  const getJsonByteLength = (value) => {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(serialized).length;
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.byteLength(serialized, "utf8");
    }
    return unescape(encodeURIComponent(serialized)).length;
  };

  const createHistoryPayload = (records, browserUuid) => ({
    data: records.map((record) => record.apiEntry),
    browser_uuid: browserUuid,
    flag: "history",
  });

  const createHistoryBatches = (
    records,
    browserUuid,
    maxPayloadBytes = MAX_HISTORY_PAYLOAD_BYTES
  ) => {
    const batches = [];
    let currentBatch = [];

    for (const record of records) {
      const candidate = [...currentBatch, record];
      const candidateBytes = getJsonByteLength(
        createHistoryPayload(candidate, browserUuid)
      );
      if (currentBatch.length > 0 && candidateBytes > maxPayloadBytes) {
        batches.push(currentBatch);
        currentBatch = [record];
      } else {
        currentBatch = candidate;
      }
    }

    if (currentBatch.length > 0) batches.push(currentBatch);
    return batches;
  };

  const createHistorySync = ({
    chromeApi,
    fetchImpl,
    now = () => Date.now(),
    createId = () => crypto.randomUUID(),
    maxPayloadBytes = MAX_HISTORY_PAYLOAD_BYTES,
  }) => {
    let syncInFlight = null;

    const fetchDataSchemaVersion = async (host, browserUuid) => {
      const response = await fetchImpl(`${host}/sync/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browser_uuid: browserUuid }),
      });
      if (!response.ok) return null;
      const payload = await response.json();
      return readDataSchemaVersion(payload);
    };

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

    const markEntriesSynced = async (captureIds) => {
      if (captureIds.length === 0) return;
      const syncedIds = new Set(captureIds);
      const latest = await chromeApi.storage.local.get({ navigationData: [] });
      const updatedHistory = latest.navigationData.map((entry) =>
        syncedIds.has(entry.captureId) ? { ...entry, synced: true } : entry
      );
      await chromeApi.storage.local.set({ navigationData: updatedHistory });
    };

    const performSync = async ({ force, resyncAll, reason, host }) => {
      const stored = await chromeApi.storage.local.get({
        navigationData: [],
        lastSyncTime: null,
        apiHost: "",
        userId: "",
        syncCountThreshold: COUNT_THRESHOLD,
        syncTimeSafetyNetMin: TIME_SAFETY_NET_MIN,
        [DATA_SCHEMA_VERSION_KEY]: null,
        [HISTORY_DATA_SCHEMA_VERSION_KEY]: null,
        [HISTORY_RESYNC_IN_PROGRESS_KEY]: false,
      });
      const syncConfig = resolveSyncConfig(stored);
      let { normalized, changed } = normalizeHistory(stored.navigationData);
      let resyncInProgress = stored[HISTORY_RESYNC_IN_PROGRESS_KEY] === true;

      let unsynced = normalized.filter((entry) => !entry.synced);
      if (resyncAll && normalized.length > 0 && !resyncInProgress) {
        normalized = normalized.map((entry) => ({
          ...entry,
          synced: false,
        }));
        changed = true;
        resyncInProgress = true;
        unsynced = normalized;
      }
      const countReady =
        pageEntries.countDistinctPages(unsynced) >= syncConfig.countThreshold;
      const shouldCheckSchema = force || reason === "time" || countReady;
      const apiHost = host || stored.apiHost;
      let userId = stored.userId;
      if (!userId && normalized.length > 0) {
        userId = createId();
        await chromeApi.storage.local.set({ userId });
      }

      let remoteDataSchemaVersion = null;
      let schemaChanged = false;
      if (shouldCheckSchema && apiHost && userId) {
        try {
          remoteDataSchemaVersion = await fetchDataSchemaVersion(
            apiHost,
            userId
          );
        } catch {
          remoteDataSchemaVersion = null;
        }

        schemaChanged = Boolean(
          remoteDataSchemaVersion !== null &&
          remoteDataSchemaVersion !==
            normalizeDataSchemaVersion(stored[HISTORY_DATA_SCHEMA_VERSION_KEY])
        );
        if (schemaChanged && !resyncInProgress) {
          normalized = normalized.map((entry) => ({
            ...entry,
            synced: false,
          }));
          changed = true;
          resyncInProgress = true;
          unsynced = normalized;
        }
      }

      if (changed) {
        await chromeApi.storage.local.set({
          navigationData: normalized,
          ...(resyncInProgress
            ? { [HISTORY_RESYNC_IN_PROGRESS_KEY]: true }
            : {}),
        });
      }

      if (unsynced.length === 0) {
        await chromeApi.storage.local.set({
          [HISTORY_RESYNC_IN_PROGRESS_KEY]: false,
          ...(remoteDataSchemaVersion !== null
            ? {
                [DATA_SCHEMA_VERSION_KEY]: remoteDataSchemaVersion,
                [HISTORY_DATA_SCHEMA_VERSION_KEY]: remoteDataSchemaVersion,
              }
            : {}),
        });
        return { success: true, synced: 0, skipped: "empty" };
      }

      const oldestCapture = Math.min(
        ...unsynced.map((entry) => entry.capturedAt)
      );
      const timeReady =
        reason === "time" && now() - oldestCapture >= syncConfig.maxWaitMs;

      if (!force && !schemaChanged && !countReady && !timeReady) {
        return { success: true, synced: 0, skipped: "threshold" };
      }

      if (!apiHost) {
        return {
          success: false,
          synced: 0,
          error: "API host is not configured",
        };
      }

      if (!userId) {
        userId = createId();
        await chromeApi.storage.local.set({ userId });
      }

      const { records, omittedCaptureIds } =
        prepareHistorySyncRecords(unsynced);
      await markEntriesSynced(omittedCaptureIds);
      const batches = createHistoryBatches(records, userId, maxPayloadBytes);
      let syncedCount = omittedCaptureIds.length;
      let batchesCompleted = 0;

      for (const batch of batches) {
        const response = await fetchImpl(`${apiHost}/save-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createHistoryPayload(batch, userId)),
        });

        if (!response.ok) {
          return {
            success: false,
            synced: syncedCount,
            omitted: omittedCaptureIds.length,
            batchesCompleted,
            batchesTotal: batches.length,
            error: `History sync failed with status ${response.status}`,
          };
        }

        const batchCaptureIds = batch.flatMap((record) => record.captureIds);
        await markEntriesSynced(batchCaptureIds);
        syncedCount += batchCaptureIds.length;
        batchesCompleted += 1;
      }

      const completedAt = now();
      await chromeApi.storage.local.set({
        lastSyncTime: completedAt,
        [HISTORY_RESYNC_IN_PROGRESS_KEY]: false,
        ...(remoteDataSchemaVersion !== null
          ? {
              [DATA_SCHEMA_VERSION_KEY]: remoteDataSchemaVersion,
              [HISTORY_DATA_SCHEMA_VERSION_KEY]: remoteDataSchemaVersion,
            }
          : {}),
      });

      return {
        success: true,
        synced: syncedCount,
        omitted: omittedCaptureIds.length,
        batches: batches.length,
        lastSyncTime: completedAt,
      };
    };

    const maybeSync = (options = {}) => {
      if (syncInFlight) {
        return syncInFlight.then(() => maybeSync(options));
      }
      syncInFlight = performSync({
        force: options.force === true,
        resyncAll: options.resyncAll === true,
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
    MAX_HISTORY_SECTION_CHARS,
    MAX_HISTORY_SECTIONS_PER_PAGE,
    MAX_HISTORY_PAYLOAD_BYTES,
    DATA_SCHEMA_VERSION_KEY,
    HISTORY_DATA_SCHEMA_VERSION_KEY,
    HISTORY_RESYNC_IN_PROGRESS_KEY,
    normalizeDataSchemaVersion,
    readDataSchemaVersion,
    resolveSyncConfig,
    coalesceHistoryEntries,
    prepareHistorySyncRecords,
    getJsonByteLength,
    createHistoryBatches,
    createHistorySync,
  };
  globalScope.SurfMindHistorySync = exported;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof self !== "undefined" ? self : globalThis);
