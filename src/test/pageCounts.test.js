import {
  countSavedHistoryPages,
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
