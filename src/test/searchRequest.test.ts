import { buildSearchRequest } from "../services/searchRequest";

test("adds a selected folder to bookmark and combined searches", () => {
  const base = {
    browserUuid: "browser-123",
    query: "deployment notes",
    folder: "Bookmarks bar / Work / Reading",
    mode: "standard" as const,
  };

  expect(buildSearchRequest({ ...base, flag: "bookmark" })).toEqual({
    browser_uuid: "browser-123",
    query: "deployment notes",
    flag: "bookmark",
    folder: "Bookmarks bar / Work / Reading",
  });
  expect(buildSearchRequest({ ...base, flag: "combined" })).toHaveProperty(
    "folder",
    "Bookmarks bar / Work / Reading"
  );
});

test("omits the folder for entire-bookmark and history searches", () => {
  expect(
    buildSearchRequest({
      browserUuid: "browser-123",
      query: "deployment notes",
      flag: "bookmark",
      folder: null,
      mode: "standard",
    })
  ).not.toHaveProperty("folder");

  expect(
    buildSearchRequest({
      browserUuid: "browser-123",
      query: "deployment notes",
      flag: "history",
      folder: "Bookmarks bar / Work",
      mode: "standard",
    })
  ).not.toHaveProperty("folder");
});

test("sends Fast preferences only for Fast searches", () => {
  expect(
    buildSearchRequest({
      browserUuid: "browser-123",
      query: "deployment notes",
      flag: "history",
      mode: "fast",
      fastStrictness: "precise",
      maxResults: 8,
    })
  ).toEqual({
    browser_uuid: "browser-123",
    query: "deployment notes",
    flag: "history",
    mode: "fast",
    fast_strictness: "precise",
    max_results: 8,
  });

  expect(
    buildSearchRequest({
      browserUuid: "browser-123",
      query: "deployment notes",
      flag: "history",
      mode: "standard",
      fastStrictness: "broad",
      maxResults: 3,
    })
  ).toEqual({
    browser_uuid: "browser-123",
    query: "deployment notes",
    flag: "history",
  });
});
