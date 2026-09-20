import { collectBookmarkFolders } from "../services/bookmarkFolders";

const tree = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks bar",
        children: [
          { id: "10", title: "Example", url: "https://example.com" },
          {
            id: "2",
            title: "Work",
            children: [
              { id: "20", title: "Docs", url: "https://docs.example.com" },
            ],
          },
        ],
      },
      { id: "3", title: "Other bookmarks", children: [] },
    ],
  },
];

test("returns folders only with recursive bookmark counts", () => {
  expect(collectBookmarkFolders(tree)).toEqual({
    bookmarkCount: 2,
    bookmarkPageCount: 2,
    folders: [
      {
        id: "1",
        title: "Bookmarks bar",
        path: ["Bookmarks bar"],
        depth: 0,
        bookmarkCount: 2,
      },
      {
        id: "2",
        title: "Work",
        path: ["Bookmarks bar", "Work"],
        depth: 1,
        bookmarkCount: 1,
      },
      {
        id: "3",
        title: "Other bookmarks",
        path: ["Other bookmarks"],
        depth: 0,
        bookmarkCount: 0,
      },
    ],
    folderTree: [
      {
        id: "1",
        title: "Bookmarks bar",
        path: ["Bookmarks bar"],
        depth: 0,
        bookmarkCount: 2,
        children: [
          {
            id: "2",
            title: "Work",
            path: ["Bookmarks bar", "Work"],
            depth: 1,
            bookmarkCount: 1,
            children: [],
          },
        ],
      },
      {
        id: "3",
        title: "Other bookmarks",
        path: ["Other bookmarks"],
        depth: 0,
        bookmarkCount: 0,
        children: [],
      },
    ],
  });
});
