const {
  EXTRACTED_CONTENT_KEY,
  SAFETY_NET_MIN,
  createBookmarkSync,
  flattenBookmarks,
} = require("../../public/bookmarkSync");

const bookmarkTree = [
  {
    title: "Bookmarks bar",
    children: [
      {
        title: "Research",
        children: [
          {
            title: "Vector guide",
            url: "https://example.com/vector?q=old#section",
            dateAdded: 123,
          },
        ],
      },
    ],
  },
];

const createHarness = ({
  dirty = false,
  responseOk = true,
  extractedContent = {},
} = {}) => {
  let storage = {
    apiHost: "https://api.example.com/v1",
    userId: "browser-1",
    bookmarksDirty: dirty,
    bookmarksDirtyVersion: dirty ? 1 : 0,
    [EXTRACTED_CONTENT_KEY]: extractedContent,
  };
  const chromeApi = {
    bookmarks: {
      getTree: jest.fn((callback) => callback(bookmarkTree)),
    },
    runtime: {},
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
  const logger = { log: jest.fn() };
  const sync = createBookmarkSync({
    chromeApi,
    fetchImpl,
    now: () => 50_000,
    logger,
  });

  return {
    sync,
    chromeApi,
    fetchImpl,
    logger,
    getStorage: () => storage,
  };
};

test("normalizes the full bookmark tree for the existing ingestion contract", () => {
  expect(flattenBookmarks(bookmarkTree)).toEqual([
    {
      url: "https://example.com/vector",
      title: "Vector guide",
      content: "Vector guide",
      folder: "Bookmarks bar / Research",
      domain: "example.com",
      date: 123,
    },
  ]);
});

test("nests heading-aware sections under one bookmark entry", () => {
  const extractedContent = {
    "https://example.com/vector": {
      title: "Vector guide",
      extractionMethod: "readability",
      sections: [
        {
          headingPath: ["Vector guide", "Introduction"],
          level: 1,
          text: "Vector search introduction.",
        },
        {
          headingPath: ["Vector guide", "Indexing"],
          level: 1,
          text: "Indexing details.",
        },
      ],
    },
  };

  expect(flattenBookmarks(bookmarkTree, extractedContent)).toEqual([
    {
      url: "https://example.com/vector",
      title: "Vector guide",
      content: [
        {
          content: "Vector search introduction.",
          heading_path: ["Vector guide", "Introduction"],
          heading_level: 1,
          section_index: 0,
        },
        {
          content: "Indexing details.",
          heading_path: ["Vector guide", "Indexing"],
          heading_level: 1,
          section_index: 1,
        },
      ],
      folder: "Bookmarks bar / Research",
      domain: "example.com",
      date: 123,
    },
  ]);
});

test("a clean conditional flush is an instant no-op", async () => {
  const { sync, chromeApi, fetchImpl } = createHarness();

  const result = await sync.syncIfDirty({ reason: "dropdown-open" });

  expect(result).toMatchObject({ success: true, synced: 0, skipped: "clean" });
  expect(chromeApi.bookmarks.getTree).not.toHaveBeenCalled();
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("bookmark events only persist dirty state without uploading", async () => {
  const { sync, fetchImpl, getStorage } = createHarness();

  await sync.markDirty();
  await sync.markDirty();

  expect(fetchImpl).not.toHaveBeenCalled();
  expect(getStorage().bookmarksDirty).toBe(true);
  expect(getStorage().bookmarksDirtyVersion).toBe(2);
});

test("pre-search flush immediately syncs dirty bookmarks", async () => {
  const { sync, fetchImpl, getStorage } = createHarness();

  await sync.markDirty();
  const result = await sync.syncIfDirty({ reason: "pre-query" });

  expect(result).toMatchObject({ success: true, synced: 1 });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(getStorage().bookmarksDirty).toBe(false);
});

test("captures content only when the new bookmark matches the active tab", async () => {
  const { sync, getStorage, logger } = createHarness();
  const extraction = {
    title: "Vector guide",
    extractionMethod: "readability",
    sections: [
      {
        headingPath: ["Vector guide", "Overview"],
        level: 1,
        text: "Full bookmark page content.",
      },
    ],
  };
  const extractFromTab = jest.fn().mockResolvedValue(extraction);

  const result = await sync.captureCreatedBookmark(
    { url: "https://example.com/vector?q=old#section" },
    {
      getActiveTab: jest.fn().mockResolvedValue({
        id: 7,
        url: "https://example.com/vector?q=old#section",
      }),
      extractFromTab,
    },
  );

  expect(result).toEqual({ captured: true, reason: "live-tab" });
  expect(extractFromTab).toHaveBeenCalledWith(7);
  expect(
    getStorage()[EXTRACTED_CONTENT_KEY]["https://example.com/vector"],
  ).toEqual(extraction);
  expect(getStorage().bookmarksDirty).toBe(true);
  expect(logger.log).toHaveBeenCalledWith(
    "[SurfMind] Bookmark content saved locally",
    expect.objectContaining({
      storageKey: "https://example.com/vector",
      extraction,
    }),
  );
});

test("keeps the flat title payload when the bookmarked page is not active", async () => {
  const { sync, fetchImpl, logger } = createHarness();
  const extractFromTab = jest.fn();

  const captureResult = await sync.captureCreatedBookmark(
    { url: "https://example.com/vector?q=old#section" },
    {
      getActiveTab: jest.fn().mockResolvedValue({
        id: 8,
        url: "chrome://bookmarks/",
      }),
      extractFromTab,
    },
  );
  await sync.syncIfDirty({ reason: "pre-query" });

  const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(captureResult).toEqual({ captured: false, reason: "tab-not-active" });
  expect(extractFromTab).not.toHaveBeenCalled();
  expect(payload.data).toEqual([
    {
      url: "https://example.com/vector",
      title: "Vector guide",
      content: "Vector guide",
      folder: "Bookmarks bar / Research",
      domain: "example.com",
      date: 123,
    },
  ]);
  expect(payload.data[0]).not.toHaveProperty("needs_server_extraction");
  expect(logger.log).toHaveBeenCalledWith(
    "[SurfMind] Bookmark saved with title-only fallback",
    expect.objectContaining({
      reason: "bookmarked page is not the active tab",
    }),
  );
  expect(logger.log).toHaveBeenCalledWith(
    "[SurfMind] Bookmark /save-data payload",
    payload,
  );
});

test("sends cached live-tab content in the next bookmark sync", async () => {
  const extractedContent = {
    "https://example.com/vector": {
      title: "Vector guide",
      extractionMethod: "readability",
      sections: [
        {
          headingPath: ["Vector guide", "Overview"],
          level: 1,
          text: "Full bookmark page content.",
        },
      ],
    },
  };
  const { sync, fetchImpl } = createHarness({
    dirty: true,
    extractedContent,
  });

  await sync.syncIfDirty({ reason: "time" });

  const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(payload.data).toHaveLength(1);
  expect(payload.data[0].content).toEqual([
    {
      content: "Full bookmark page content.",
      heading_path: ["Vector guide", "Overview"],
      heading_level: 1,
      section_index: 0,
    },
  ]);
});

test("failed bookmark uploads remain dirty for a later retry", async () => {
  const { sync, getStorage } = createHarness({ dirty: true, responseOk: false });

  const result = await sync.syncIfDirty({ reason: "time" });

  expect(result.success).toBe(false);
  expect(getStorage().bookmarksDirty).toBe(true);
});

test("uses the stable browser UUID and bookmark flag", async () => {
  const { sync, fetchImpl } = createHarness({ dirty: true });

  await sync.syncIfDirty({ reason: "time" });

  const [url, options] = fetchImpl.mock.calls[0];
  const payload = JSON.parse(options.body);
  expect(url).toBe("https://api.example.com/v1/save-data");
  expect(payload).toMatchObject({
    browser_uuid: "browser-1",
    flag: "bookmark",
  });
  expect(payload).not.toHaveProperty("userId");
  expect(payload.data).toHaveLength(1);
  expect(SAFETY_NET_MIN).toBe(360);
});
