import {
  buildPageSyncCoverage,
  countSavedHistoryPages,
  getResourceSyncCoverage,
  pageCountsMatch,
  readLocalPageCounts,
} from "../services/pageCounts";

beforeEach(() => {
  global.chrome = {
    runtime: {},
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({
          navigationData: [
            { url: "https://example.com", heading_path: ["One"] },
            { url: "https://example.com", heading_path: ["Two"] },
            { url: "https://other.example.com" },
          ],
        }),
      },
    },
    bookmarks: {
      getTree: jest.fn((callback) =>
        callback([
          {
            id: "0",
            children: [
              { id: "1", title: "One", url: "https://example.com?q=one" },
              { id: "2", title: "Two", url: "https://example.com?q=two" },
            ],
          },
        ])
      ),
    },
  };
});

test("counts unique local pages using the same bookmark URL normalization", async () => {
  expect(
    countSavedHistoryPages([
      { url: "https://example.com", heading_path: ["One"] },
      { url: "https://example.com", heading_path: ["Two"] },
    ])
  ).toBe(1);
  await expect(readLocalPageCounts()).resolves.toEqual({
    history: 2,
    bookmarks: 1,
    dirty: { history: true, bookmarks: false },
  });
});

test("matches only when both history and bookmark counts agree", () => {
  expect(
    pageCountsMatch({ history: 2, bookmarks: 1 }, { history: 2, bookmarks: 1 })
  ).toBe(true);
  expect(
    pageCountsMatch({ history: 2, bookmarks: 1 }, { history: 2, bookmarks: 0 })
  ).toBe(false);
});

test.each([
  [
    "nothing local",
    { localCount: 0, syncedCount: 0, totalCount: 0, cap: 100 },
    "Not synced yet",
    "sync",
  ],
  [
    "dirty local data",
    {
      localCount: 100,
      syncedCount: 100,
      totalCount: 100,
      cap: 100,
      dirty: true,
    },
    "Sync available",
    "sync",
  ],
  [
    "new local pages",
    { localCount: 12, syncedCount: 10, totalCount: 10, cap: 100 },
    "Sync available (2 new)",
    "sync",
  ],
  [
    "fully synced below cap",
    { localCount: 10, syncedCount: 10, totalCount: 10, cap: 100 },
    "Up to date",
    null,
  ],
  [
    "shared data from another browser",
    { localCount: 10, syncedCount: 10, totalCount: 20, cap: 100 },
    "Synced from your other devices",
    null,
  ],
  [
    "local data beyond cap",
    { localCount: 300, syncedCount: 250, totalCount: 250, cap: 250 },
    "At capacity — showing your most recent 250",
    "refresh",
  ],
  [
    "fully synced at cap",
    { localCount: 100, syncedCount: 100, totalCount: 100, cap: 100 },
    "At capacity, up to date",
    null,
  ],
  [
    "cap reached by another browser",
    { localCount: 40, syncedCount: 40, totalCount: 100, cap: 100 },
    "At capacity via your other devices",
    null,
  ],
])("describes %s", (_name, input, label, action) => {
  expect(getResourceSyncCoverage(input)).toMatchObject({ label, action });
});

test("dirty state wins over matching capacity counts", () => {
  expect(
    getResourceSyncCoverage({
      localCount: 100,
      syncedCount: 100,
      totalCount: 100,
      cap: 100,
      dirty: true,
    })
  ).toMatchObject({ key: "dirty", canSync: true, action: "sync" });
});

test("combines history and bookmark states into one sync action", () => {
  const coverage = buildPageSyncCoverage(
    {
      history: 100,
      bookmarks: 300,
      dirty: { history: false, bookmarks: false },
    },
    {
      history: 100,
      bookmarks: 250,
      totals: { history: 100, bookmarks: 250 },
      caps: { history: 100, bookmarks: 250 },
    }
  );

  expect(coverage.history.key).toBe("capacity-current");
  expect(coverage.bookmarks.key).toBe("capacity-refresh");
  expect(coverage).toMatchObject({ canSync: true, action: "refresh" });
});
