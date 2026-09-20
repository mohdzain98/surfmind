const {
  COUNT_THRESHOLD,
  DATA_SCHEMA_VERSION_KEY,
  HISTORY_DATA_SCHEMA_VERSION_KEY,
  HISTORY_RESYNC_IN_PROGRESS_KEY,
  MAX_HISTORY_SECTION_CHARS,
  MAX_WAIT_MS,
  createHistorySync,
} = require("../../public/historySync");

const createHarness = ({
  entries,
  currentTime = 10_000,
  responseOk = true,
  syncCountThreshold,
  syncTimeSafetyNetMin,
  dataSchemaVersion = 1,
  remoteDataSchemaVersion = 1,
  statusOk = true,
  saveResponseStatuses,
  maxPayloadBytes,
}) => {
  let storage = {
    navigationData: entries,
    apiHost: "https://api.example.com/v1",
    userId: "user-1",
    [DATA_SCHEMA_VERSION_KEY]: dataSchemaVersion,
    [HISTORY_DATA_SCHEMA_VERSION_KEY]: dataSchemaVersion,
    ...(syncCountThreshold ? { syncCountThreshold } : {}),
    ...(syncTimeSafetyNetMin ? { syncTimeSafetyNetMin } : {}),
  };
  const chromeApi = {
    storage: {
      local: {
        get: jest.fn(async (defaults) => ({ ...defaults, ...storage })),
        set: jest.fn(async (values) => {
          storage = { ...storage, ...values };
        }),
      },
    },
  };
  let saveRequestIndex = 0;
  const fetchImpl = jest.fn(async (url) => {
    if (url.endsWith("/sync/status")) {
      return {
        ok: statusOk,
        status: statusOk ? 200 : 503,
        json: jest.fn(async () => ({
          dataSchemaVersion: remoteDataSchemaVersion,
        })),
      };
    }
    const status = saveResponseStatuses
      ? saveResponseStatuses[
          Math.min(saveRequestIndex++, saveResponseStatuses.length - 1)
        ]
      : responseOk
        ? 200
        : 500;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn(async () => ({})),
    };
  });
  let id = 0;
  const sync = createHistorySync({
    chromeApi,
    fetchImpl,
    now: () => currentTime,
    createId: () => `generated-${++id}`,
    ...(maxPayloadBytes ? { maxPayloadBytes } : {}),
  });

  return { sync, fetchImpl, getStorage: () => storage };
};

const getSaveDataCall = (fetchImpl) =>
  fetchImpl.mock.calls.find(([url]) => url.endsWith("/save-data"));

const getSaveDataCalls = (fetchImpl) =>
  fetchImpl.mock.calls.filter(([url]) => url.endsWith("/save-data"));

const entry = (index, capturedAt = 10_000) => ({
  url: `https://example.com/${index}`,
  title: `Page ${index}`,
  content: `Content ${index}`,
  date: new Date(capturedAt).toISOString(),
  capturedAt,
  captureId: `capture-${index}`,
  synced: false,
});

test("heavy-user path syncs when 25 unsynced pages accumulate", async () => {
  const entries = Array.from({ length: COUNT_THRESHOLD }, (_, index) =>
    entry(index)
  );
  const { sync, fetchImpl, getStorage } = createHarness({ entries });

  const result = await sync.maybeSync({ reason: "count" });

  expect(result).toMatchObject({ success: true, synced: COUNT_THRESHOLD });
  expect(getSaveDataCall(fetchImpl)).toBeDefined();
  expect(getStorage().navigationData.every((item) => item.synced)).toBe(true);
  expect(getStorage().lastSyncTime).toBe(10_000);
});

test("count threshold counts pages instead of sections", async () => {
  const entries = Array.from({ length: COUNT_THRESHOLD }, (_, index) => ({
    ...entry(index),
    url: "https://example.com/heading-rich-page",
    heading_path: ["Rich page", `Section ${index}`],
  }));
  const { sync, fetchImpl } = createHarness({ entries });

  const result = await sync.maybeSync({ reason: "count" });

  expect(result).toMatchObject({
    success: true,
    synced: 0,
    skipped: "threshold",
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("light-user path syncs after the four-hour maximum wait", async () => {
  const currentTime = MAX_WAIT_MS + 20_000;
  const { sync, fetchImpl } = createHarness({
    entries: [entry(1, 10_000)],
    currentTime,
  });

  const result = await sync.maybeSync({ reason: "time" });

  expect(result).toMatchObject({ success: true, synced: 1 });
  expect(getSaveDataCall(fetchImpl)).toBeDefined();
});

test("uses development count and time thresholds from extension storage", async () => {
  const countHarness = createHarness({
    entries: [entry(1), entry(2), entry(3)],
    syncCountThreshold: 3,
  });
  const countResult = await countHarness.sync.maybeSync({ reason: "count" });

  expect(countResult).toMatchObject({ success: true, synced: 3 });

  const timeHarness = createHarness({
    entries: [entry(1, 10_000)],
    currentTime: 130_001,
    syncTimeSafetyNetMin: 2,
  });
  const timeResult = await timeHarness.sync.maybeSync({ reason: "time" });

  expect(timeResult).toMatchObject({ success: true, synced: 1 });
});

test("pre-query flush syncs a recent entry below the thresholds", async () => {
  const { sync, fetchImpl } = createHarness({ entries: [entry(1)] });

  const result = await sync.maybeSync({
    force: true,
    reason: "pre-query",
  });

  expect(result).toMatchObject({ success: true, synced: 1 });
  expect(getSaveDataCall(fetchImpl)).toBeDefined();
});

test("manual full sync re-ingests all retained history", async () => {
  const syncedEntries = [entry(1), entry(2)].map((item) => ({
    ...item,
    synced: true,
  }));
  const { sync, fetchImpl, getStorage } = createHarness({
    entries: syncedEntries,
  });

  const result = await sync.maybeSync({
    force: true,
    resyncAll: true,
    reason: "manual-full",
  });

  expect(result).toMatchObject({ success: true, synced: 2 });
  const payload = JSON.parse(getSaveDataCall(fetchImpl)[1].body);
  expect(payload.data).toHaveLength(2);
  expect(getStorage().navigationData.every((item) => item.synced)).toBe(true);
});

test("entries remain unsynced when the backend rejects the batch", async () => {
  const { sync, getStorage } = createHarness({
    entries: [entry(1)],
    responseOk: false,
  });

  const result = await sync.maybeSync({ force: true, reason: "pre-query" });

  expect(result.success).toBe(false);
  expect(getStorage().navigationData[0].synced).toBe(false);
  expect(getStorage().lastSyncTime).toBeUndefined();
});

test("caps structured history section content in the ingestion payload", async () => {
  const fullContent = "Full section sentence. ".repeat(12_000);
  const structuredEntry = {
    ...entry(1),
    content: fullContent.slice(0, MAX_HISTORY_SECTION_CHARS),
    heading_path: ["Docs", "Architecture", "Storage"],
    heading_level: 2,
    section_index: 4,
    domain: "example.com",
    visited_at: "2026-08-23T10:00:00.000Z",
  };
  const { sync, fetchImpl } = createHarness({ entries: [structuredEntry] });

  await sync.maybeSync({ force: true, reason: "pre-query" });

  const requestBody = JSON.parse(getSaveDataCall(fetchImpl)[1].body);
  expect(requestBody.browser_uuid).toBe("user-1");
  expect(requestBody).not.toHaveProperty("userId");
  expect(requestBody.data[0]).toMatchObject({
    content: fullContent.slice(0, MAX_HISTORY_SECTION_CHARS),
    heading_path: ["Docs", "Architecture", "Storage"],
    heading_level: 2,
    section_index: 4,
  });
  expect(requestBody.data[0]).not.toHaveProperty("synced");
  expect(requestBody.data[0]).not.toHaveProperty("captureId");
});

test("sends at most 15 sections per history page", async () => {
  const entries = Array.from({ length: 20 }, (_, index) => ({
    ...entry(index),
    url: "https://example.com/large-page",
    heading_path: ["Large page", `Section ${index}`],
  }));
  const { sync, fetchImpl, getStorage } = createHarness({ entries });

  const result = await sync.maybeSync({ force: true, reason: "pre-query" });

  const payload = JSON.parse(getSaveDataCall(fetchImpl)[1].body);
  expect(payload.data).toHaveLength(15);
  expect(result).toMatchObject({ success: true, synced: 20, omitted: 5 });
  expect(getStorage().navigationData.every((item) => item.synced)).toBe(true);
});

test("splits large history syncs into sequential size-bounded requests", async () => {
  const maxPayloadBytes = 2_700;
  const entries = Array.from({ length: 5 }, (_, index) => ({
    ...entry(index),
    content: "Useful history context. ".repeat(80),
  }));
  const { sync, fetchImpl } = createHarness({
    entries,
    maxPayloadBytes,
  });

  const result = await sync.maybeSync({ force: true, reason: "pre-query" });
  const saveCalls = getSaveDataCalls(fetchImpl);

  expect(result.success).toBe(true);
  expect(saveCalls.length).toBeGreaterThan(1);
  for (const [, options] of saveCalls) {
    expect(Buffer.byteLength(options.body, "utf8")).toBeLessThanOrEqual(
      maxPayloadBytes
    );
  }
});

test("resumes a failed full resync without resending completed batches", async () => {
  const entries = Array.from({ length: 4 }, (_, index) => ({
    ...entry(index),
    synced: true,
    content: "Resume-safe history context. ".repeat(70),
  }));
  const { sync, fetchImpl, getStorage } = createHarness({
    entries,
    maxPayloadBytes: 2_700,
    saveResponseStatuses: [200, 500, 200, 200, 200],
  });

  const firstResult = await sync.maybeSync({
    force: true,
    resyncAll: true,
    reason: "manual-full",
  });
  const syncedAfterFailure = getStorage().navigationData.filter(
    (item) => item.synced
  ).length;

  expect(firstResult.success).toBe(false);
  expect(syncedAfterFailure).toBeGreaterThan(0);
  expect(syncedAfterFailure).toBeLessThan(entries.length);
  expect(getStorage()[HISTORY_RESYNC_IN_PROGRESS_KEY]).toBe(true);

  const callsBeforeRetry = getSaveDataCalls(fetchImpl).length;
  const secondResult = await sync.maybeSync({
    force: true,
    resyncAll: true,
    reason: "manual-full",
  });
  const retryCalls = getSaveDataCalls(fetchImpl).slice(callsBeforeRetry);
  const retriedUrls = retryCalls.flatMap(([, options]) =>
    JSON.parse(options.body).data.map((item) => item.url)
  );

  expect(secondResult.success).toBe(true);
  expect(retryCalls).toHaveLength(entries.length - syncedAfterFailure);
  expect(retriedUrls).not.toContain("https://example.com/0");
  expect(getStorage().navigationData.every((item) => item.synced)).toBe(true);
  expect(getStorage()[HISTORY_RESYNC_IN_PROGRESS_KEY]).toBe(false);
});

test("sends each URL and heading path only once per batch", async () => {
  const shared = {
    url: "https://example.com/paper",
    title: "Paper",
    heading_path: ["Paper", "Abstract"],
    capturedAt: 10_000,
    date: new Date(10_000).toISOString(),
    synced: false,
  };
  const entries = [
    "First paragraph.",
    "Second paragraph.",
    "Third paragraph.",
  ].map((content, index) => ({
    ...shared,
    content,
    captureId: `paragraph-${index}`,
  }));
  const { sync, fetchImpl, getStorage } = createHarness({ entries });

  await sync.maybeSync({ force: true, reason: "pre-query" });

  const requestBody = JSON.parse(getSaveDataCall(fetchImpl)[1].body);
  expect(requestBody.data).toHaveLength(1);
  expect(requestBody.data[0]).toMatchObject({
    url: shared.url,
    heading_path: shared.heading_path,
    content: "First paragraph.\nSecond paragraph.\nThird paragraph.",
  });
  expect(getStorage().navigationData.every((item) => item.synced)).toBe(true);
});

test("a backend schema bump re-ingests all locally retained history", async () => {
  const syncedEntries = [entry(1), entry(2)].map((item) => ({
    ...item,
    synced: true,
  }));
  const { sync, fetchImpl, getStorage } = createHarness({
    entries: syncedEntries,
    currentTime: MAX_WAIT_MS + 20_000,
    dataSchemaVersion: 1,
    remoteDataSchemaVersion: 2,
  });

  const result = await sync.maybeSync({ reason: "time" });

  expect(result).toMatchObject({ success: true, synced: 2 });
  const payload = JSON.parse(getSaveDataCall(fetchImpl)[1].body);
  expect(payload.flag).toBe("history");
  expect(payload.data).toHaveLength(2);
  expect(getStorage().navigationData.every((item) => item.synced)).toBe(true);
  expect(getStorage()[DATA_SCHEMA_VERSION_KEY]).toBe(2);
  expect(getStorage()[HISTORY_DATA_SCHEMA_VERSION_KEY]).toBe(2);
});

test("the first observed schema version recovers retained history", async () => {
  const { sync, getStorage } = createHarness({
    entries: [{ ...entry(1), synced: true }],
    dataSchemaVersion: null,
    remoteDataSchemaVersion: 1,
  });

  await sync.maybeSync({ force: true, reason: "pre-query" });

  expect(getStorage().navigationData[0].synced).toBe(true);
  expect(getStorage()[HISTORY_DATA_SCHEMA_VERSION_KEY]).toBe(1);
});

test("a failed schema check does not block pending history ingestion", async () => {
  const { sync, fetchImpl, getStorage } = createHarness({
    entries: [entry(1)],
    statusOk: false,
  });

  const result = await sync.maybeSync({
    force: true,
    reason: "pre-query",
  });

  expect(result).toMatchObject({ success: true, synced: 1 });
  expect(getSaveDataCall(fetchImpl)).toBeDefined();
  expect(getStorage().navigationData[0].synced).toBe(true);
  expect(getStorage()[HISTORY_DATA_SCHEMA_VERSION_KEY]).toBe(1);
});
