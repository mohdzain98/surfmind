const {
  COUNT_THRESHOLD,
  MAX_WAIT_MS,
  createHistorySync,
} = require("../../public/historySync");

const createHarness = ({
  entries,
  currentTime = 10_000,
  responseOk = true,
  syncCountThreshold,
  syncTimeSafetyNetMin,
}) => {
  let storage = {
    navigationData: entries,
    apiHost: "https://api.example.com/v1",
    userId: "user-1",
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
  const fetchImpl = jest.fn(async () => ({ ok: responseOk, status: 500 }));
  let id = 0;
  const sync = createHistorySync({
    chromeApi,
    fetchImpl,
    now: () => currentTime,
    createId: () => `generated-${++id}`,
  });

  return { sync, fetchImpl, getStorage: () => storage };
};

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
    entry(index),
  );
  const { sync, fetchImpl, getStorage } = createHarness({ entries });

  const result = await sync.maybeSync({ reason: "count" });

  expect(result).toMatchObject({ success: true, synced: COUNT_THRESHOLD });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
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

  expect(result).toMatchObject({ success: true, synced: 0, skipped: "threshold" });
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
  expect(fetchImpl).toHaveBeenCalledTimes(1);
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
  expect(fetchImpl).toHaveBeenCalledTimes(1);
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

test("preserves full structured section content in the ingestion payload", async () => {
  const fullContent = "Full section sentence. ".repeat(12_000);
  const structuredEntry = {
    ...entry(1),
    content: fullContent,
    heading_path: ["Docs", "Architecture", "Storage"],
    heading_level: 2,
    section_index: 4,
    domain: "example.com",
    visited_at: "2026-08-23T10:00:00.000Z",
  };
  const { sync, fetchImpl } = createHarness({ entries: [structuredEntry] });

  await sync.maybeSync({ force: true, reason: "pre-query" });

  const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(requestBody.browser_uuid).toBe("user-1");
  expect(requestBody).not.toHaveProperty("userId");
  expect(requestBody.data[0]).toMatchObject({
    content: fullContent,
    heading_path: ["Docs", "Architecture", "Storage"],
    heading_level: 2,
    section_index: 4,
  });
  expect(requestBody.data[0]).not.toHaveProperty("synced");
  expect(requestBody.data[0]).not.toHaveProperty("captureId");
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
  const entries = ["First paragraph.", "Second paragraph.", "Third paragraph."].map(
    (content, index) => ({
      ...shared,
      content,
      captureId: `paragraph-${index}`,
    }),
  );
  const { sync, fetchImpl, getStorage } = createHarness({ entries });

  await sync.maybeSync({ force: true, reason: "pre-query" });

  const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(requestBody.data).toHaveLength(1);
  expect(requestBody.data[0]).toMatchObject({
    url: shared.url,
    heading_path: shared.heading_path,
    content: "First paragraph.\nSecond paragraph.\nThird paragraph.",
  });
  expect(getStorage().navigationData.every((item) => item.synced)).toBe(true);
});
