import {
  fetchRecentSearches,
  normalizeRecentSearch,
} from "../services/recentSearches";

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  json: jest.fn(async () => payload),
});

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("fetches five recent searches with the stable browser identity", async () => {
  fetch.mockResolvedValue(
    jsonResponse({
      data: {
        searches: [
          {
            id: "search-1",
            query: "vector databases",
            mode: "history",
            answer: "Stored answer",
            sources: JSON.stringify([{ url: "https://example.com" }]),
            created_at: "2026-08-23T10:00:00Z",
          },
        ],
      },
    })
  );

  const result = await fetchRecentSearches(
    "https://api.example.com/v1",
    "browser-123"
  );

  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.com/v1/recent-searches",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser_uuid: "browser-123", limit: 5 }),
      signal: undefined,
    }
  );
  expect(result[0]).toMatchObject({
    id: "search-1",
    query: "vector databases",
    answer: "Stored answer",
    sources: [{ url: "https://example.com" }],
  });
});

test("normalizes alternate fields and malformed source snapshots", () => {
  expect(
    normalizeRecentSearch({
      flag: "bookmark",
      result: "Answer",
      docs: "not-json",
      createdAt: "today",
    })
  ).toMatchObject({
    mode: "bookmark",
    answer: "Answer",
    sources: [],
    createdAt: "today",
  });
});

test("rejects failed requests for the UI to handle silently", async () => {
  fetch.mockResolvedValue(jsonResponse({}, 500));

  await expect(
    fetchRecentSearches("https://api.example.com/v1", "browser-123")
  ).rejects.toThrow("Could not load recent searches");
});
