import { buildSearchRequest } from "../services/searchRequest";

test("adds a selected folder to bookmark and combined searches", () => {
  const base = {
    browserUuid: "browser-123",
    query: "deployment notes",
    folder: "Bookmarks bar / Work / Reading",
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
    })
  ).not.toHaveProperty("folder");

  expect(
    buildSearchRequest({
      browserUuid: "browser-123",
      query: "deployment notes",
      flag: "history",
      folder: "Bookmarks bar / Work",
    })
  ).not.toHaveProperty("folder");
});
