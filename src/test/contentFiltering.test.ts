export {};

const {
  BLOCKLIST_STORAGE_KEY,
  BLOCKLIST_UPDATED_AT_KEY,
  FLAGGED_BOOKMARKS_KEY,
  compileKeywordMatcher,
  createContentFilter,
  createSearchHistoryEntries,
  getSearchPageInfo,
  parseDomainList,
} = require("../../public/contentFiltering");

const createChromeStorage = (initial: Record<string, any> = {}) => {
  let storage = { ...initial };
  return {
    chromeApi: {
      storage: {
        local: {
          get: jest.fn(async (defaults) => ({ ...defaults, ...storage })),
          set: jest.fn(async (values) => {
            storage = { ...storage, ...values };
          }),
        },
      },
    },
    getStorage: () => storage,
  };
};

test("parses hosts-format and plain-domain blocklists", () => {
  expect(
    parseDomainList("# comment\n0.0.0.0 bad.example\nphish.example\n")
  ).toEqual(["bad.example", "phish.example"]);
});

test("matches keywords on boundaries without substring false positives", () => {
  const matches = compileKeywordMatcher(["porn", "adult video"]);
  expect(matches("An adult video directory")).toBe(true);
  expect(matches("A report about pornography policy")).toBe(false);
  expect(matches("popcorn recipes")).toBe(false);
});

test("extracts supported search-engine queries", () => {
  expect(
    getSearchPageInfo("https://www.google.com/search?q=vector+database")
  ).toMatchObject({ query: "vector database" });
  expect(
    getSearchPageInfo("https://search.yahoo.com/search?p=browser+history")
  ).toMatchObject({ query: "browser history" });
  expect(getSearchPageInfo("https://example.com/search?q=test")).toBeNull();
});

test("classifies domains, metadata, and search queries by layer", async () => {
  const { chromeApi } = createChromeStorage({
    [BLOCKLIST_STORAGE_KEY]: { adult: ["blocked.example"] },
  });
  const filter = createContentFilter({
    chromeApi,
    fetchImpl: jest.fn(),
    keywordTerms: ["adult video"],
  });

  await expect(
    filter.classifyItem({ url: "https://sub.blocked.example/page" })
  ).resolves.toMatchObject({
    flagged: true,
    flag_reason: "domain",
    flag_layer: 1,
  });
  await expect(
    filter.classifyItem({
      url: "https://example.com/page",
      title: "Adult video archive",
    })
  ).resolves.toMatchObject({
    flagged: true,
    flag_reason: "keyword",
    flag_layer: 2,
  });
  await expect(
    filter.classifyItem({
      url: "https://www.google.com/search?q=adult+video",
      title: "Search results",
    })
  ).resolves.toMatchObject({
    flagged: true,
    flag_reason: "query",
    flag_layer: 3,
  });
});

test("flagged search records keep the query locally without exposing it as content", () => {
  const [entry] = createSearchHistoryEntries({
    url: "https://www.google.com/search?q=adult+video&source=test",
    query: "adult video",
    capturedAt: 10_000,
    createId: () => "capture-1",
    classification: {
      flagged: true,
      flag_reason: "query",
      flag_layer: 3,
    },
  });

  expect(entry).toMatchObject({
    title: "Filtered search page",
    content: "",
    url: "https://www.google.com/search?q=adult+video&source=test",
    local_query: "adult video",
    flagged: true,
    flag_reason: "query",
  });
  expect(entry.title).not.toContain("adult video");
});

test("weekly refresh keeps successful lists and records its timestamp", async () => {
  const { chromeApi, getStorage } = createChromeStorage({
    [BLOCKLIST_STORAGE_KEY]: { adult: ["old.example"] },
    [BLOCKLIST_UPDATED_AT_KEY]: 0,
  });
  const fetchImpl = jest.fn(async (url: string) => ({
    ok: !url.includes("malware"),
    status: url.includes("malware") ? 503 : 200,
    text: jest.fn(async () => "0.0.0.0 new.example\n"),
  }));
  const filter = createContentFilter({
    chromeApi,
    fetchImpl,
    now: () => 50_000,
    keywordTerms: [],
    blocklistUrls: {
      adult: "https://lists.example/adult",
      malware: "https://lists.example/malware",
    },
  });

  await expect(
    filter.refreshBlocklists({ force: true })
  ).resolves.toMatchObject({ refreshed: true });
  expect(getStorage()[BLOCKLIST_STORAGE_KEY]).toEqual({
    adult: ["new.example"],
  });
  expect(getStorage()[BLOCKLIST_UPDATED_AT_KEY]).toBe(50_000);
});

test("flagged bookmark audit records scrub explicit search queries", async () => {
  const { chromeApi, getStorage } = createChromeStorage();
  const filter = createContentFilter({
    chromeApi,
    fetchImpl: jest.fn(),
    keywordTerms: [],
    now: () => 70_000,
  });

  await filter.recordFlaggedBookmark({
    url: "https://www.google.com/search?q=adult+video",
    title: "adult video - Google Search",
    domain: "www.google.com",
    flag_reason: "query",
    flag_layer: 3,
  });

  expect(getStorage()[FLAGGED_BOOKMARKS_KEY][0]).toMatchObject({
    url: "https://www.google.com/search",
    title: "Filtered search page",
    flag_reason: "query",
  });
});
