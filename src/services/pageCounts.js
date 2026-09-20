import { readBookmarkFolders } from "./bookmarkFolders";

export const countSavedHistoryPages = (entries = []) =>
  new Set(entries.map((entry) => entry?.url).filter(Boolean)).size;

export const readLocalPageCounts = async () => {
  const [stored, bookmarkSummary] = await Promise.all([
    chrome.storage.local.get({ navigationData: [] }),
    readBookmarkFolders(),
  ]);

  return {
    history: countSavedHistoryPages(stored.navigationData),
    bookmarks: bookmarkSummary.bookmarkPageCount,
  };
};

export const pageCountsMatch = (local, remote) =>
  local.history === remote.history && local.bookmarks === remote.bookmarks;
