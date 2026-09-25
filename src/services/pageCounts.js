import { readBookmarkFolders } from "./bookmarkFolders";

export const DEFAULT_HISTORY_CAP = 100;
export const DEFAULT_BOOKMARK_CAP = 250;

export const countSavedHistoryPages = (entries = []) =>
  new Set(entries.map((entry) => entry?.url).filter(Boolean)).size;

export const readLocalPageCounts = async () => {
  const [stored, bookmarkSummary] = await Promise.all([
    chrome.storage.local.get({
      navigationData: [],
      bookmarksDirty: false,
    }),
    readBookmarkFolders(),
  ]);

  return {
    history: countSavedHistoryPages(stored.navigationData),
    bookmarks: bookmarkSummary.bookmarkPageCount,
    dirty: {
      history: stored.navigationData.some((entry) => entry?.synced !== true),
      bookmarks: stored.bookmarksDirty === true,
    },
  };
};

const normalizeCount = (value, fallback = 0) => {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : fallback;
};

export const getResourceSyncCoverage = ({
  localCount,
  syncedCount,
  totalCount = syncedCount,
  cap,
  dirty = false,
}) => {
  const local = normalizeCount(localCount);
  const synced = normalizeCount(syncedCount);
  const total = normalizeCount(totalCount, synced);
  const maximum = Math.max(1, normalizeCount(cap, Number.MAX_SAFE_INTEGER));

  if (local === 0) {
    return {
      key: "not-synced",
      label: "Not synced yet",
      canSync: true,
      action: "sync",
    };
  }

  if (dirty) {
    return {
      key: "dirty",
      label: "Sync available",
      canSync: true,
      action: "sync",
    };
  }

  const atCapacity = total >= maximum || synced >= maximum;
  if (atCapacity && local > maximum) {
    return {
      key: "capacity-refresh",
      label: `At capacity — showing your most recent ${maximum}`,
      canSync: true,
      action: "refresh",
    };
  }

  if (atCapacity && (local < maximum || total > synced)) {
    return {
      key: "capacity-other-devices",
      label: "At capacity via your other devices",
      canSync: false,
      action: null,
    };
  }

  if (atCapacity) {
    return {
      key: "capacity-current",
      label: "At capacity, up to date",
      canSync: false,
      action: null,
    };
  }

  if (local > synced) {
    const difference = local - synced;
    return {
      key: "new-local",
      label: `Sync available (${difference} new)`,
      canSync: true,
      action: "sync",
    };
  }

  if (local < synced || total > synced) {
    return {
      key: "other-devices",
      label: "Synced from your other devices",
      canSync: false,
      action: null,
    };
  }

  return {
    key: "current",
    label: "Up to date",
    canSync: false,
    action: null,
  };
};

export const buildPageSyncCoverage = (local, remote) => {
  const history = getResourceSyncCoverage({
    localCount: local.history,
    syncedCount: remote.history,
    totalCount: remote.totals?.history ?? remote.history,
    cap: remote.caps?.history ?? DEFAULT_HISTORY_CAP,
    dirty: local.dirty?.history === true,
  });
  const bookmarks = getResourceSyncCoverage({
    localCount: local.bookmarks,
    syncedCount: remote.bookmarks,
    totalCount: remote.totals?.bookmarks ?? remote.bookmarks,
    cap: remote.caps?.bookmarks ?? DEFAULT_BOOKMARK_CAP,
    dirty: local.dirty?.bookmarks === true,
  });
  const resources = [history, bookmarks];
  const canSync = resources.some((resource) => resource.canSync);
  const action = resources.some((resource) => resource.action === "sync")
    ? "sync"
    : resources.some((resource) => resource.action === "refresh")
      ? "refresh"
      : null;

  return {
    history,
    bookmarks,
    canSync,
    action,
    matches: !canSync,
  };
};

export const pageCountsMatch = (local, remote) =>
  buildPageSyncCoverage(local, remote).matches;
