import { useEffect, useState } from "react";
import {
  Bookmark,
  ChevronRight,
  History,
  Link2,
  ShieldCheck,
  Star,
} from "lucide-react";
import { STORE_REVIEW_URL } from "../services/ratePrompt";
import { readBookmarkFolders } from "../services/bookmarkFolders";
import { countSavedHistoryPages } from "../services/pageCounts";
import {
  EXTENSION_STORE_NAME,
  HAS_EXTENSION_STORE_REVIEW,
} from "../services/storeConfig";

const SYNC_STATUS_KEY = "crossBrowserSyncStatus";
const SOLO_STATUS = { isLinked: false, browserCount: 1 };

const SettingsHome = ({
  onOpenSync,
  onOpenHistory,
  onOpenBookmarks,
  onOpenPrivacy,
  pageCounts,
}) => {
  const [syncStatus, setSyncStatus] = useState(SOLO_STATUS);
  const [savedPageCount, setSavedPageCount] = useState(0);
  const [bookmarkFolderCount, setBookmarkFolderCount] = useState(0);

  useEffect(() => {
    const storage = chrome.storage;
    if (!storage?.local) return undefined;

    let mounted = true;
    storage.local
      .get({ [SYNC_STATUS_KEY]: SOLO_STATUS, navigationData: [] })
      .then((stored) => {
        if (!mounted) return;
        setSyncStatus(stored[SYNC_STATUS_KEY] || SOLO_STATUS);
        setSavedPageCount(countSavedHistoryPages(stored.navigationData));
      });

    const handleStorageChange = (changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[SYNC_STATUS_KEY]) {
        setSyncStatus(changes[SYNC_STATUS_KEY].newValue || SOLO_STATUS);
      }
      if (changes.navigationData) {
        setSavedPageCount(
          countSavedHistoryPages(changes.navigationData.newValue)
        );
      }
    };
    storage.onChanged?.addListener(handleStorageChange);

    return () => {
      mounted = false;
      storage.onChanged?.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!chrome.bookmarks?.getTree) return undefined;
    let mounted = true;

    const loadBookmarkCount = async () => {
      try {
        const summary = await readBookmarkFolders();
        if (mounted) setBookmarkFolderCount(summary.folders.length);
      } catch {
        if (mounted) setBookmarkFolderCount(0);
      }
    };

    loadBookmarkCount();
    chrome.bookmarks.onCreated?.addListener(loadBookmarkCount);
    chrome.bookmarks.onRemoved?.addListener(loadBookmarkCount);

    return () => {
      mounted = false;
      chrome.bookmarks.onCreated?.removeListener(loadBookmarkCount);
      chrome.bookmarks.onRemoved?.removeListener(loadBookmarkCount);
    };
  }, []);

  const syncSummary = syncStatus.isLinked
    ? `${syncStatus.browserCount} ${
        syncStatus.browserCount === 1 ? "browser" : "browsers"
      } linked`
    : "Link and manage your browsers";

  const openReviewPage = () => {
    if (STORE_REVIEW_URL) chrome.tabs.create({ url: STORE_REVIEW_URL });
  };

  const renderCoverageResource = (resource) => {
    const localCount = pageCounts.local[resource];
    const syncedCount = pageCounts.remote[resource];
    const totalCount = pageCounts.remote.totals?.[resource] ?? syncedCount;
    const cap = pageCounts.remote.caps?.[resource];
    const coverage = pageCounts.coverage?.[resource];
    const showAccountTotal = syncStatus.isLinked || totalCount !== syncedCount;
    const showCapacity =
      Number.isFinite(cap) &&
      Math.max(localCount, syncedCount, totalCount) >= cap;
    const countSummary = [
      `${localCount} local`,
      `${syncedCount} synced`,
      showAccountTotal ? `${totalCount} total` : null,
      showCapacity ? `${cap} max` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <details className="settings-sync-resource" key={resource}>
        <summary className="settings-sync-resource-heading">
          <span className="settings-sync-resource-name">
            {resource === "history" ? "History" : "Bookmarks"}
          </span>
          <span className="settings-sync-resource-action">
            {coverage?.label ? (
              <em className={`settings-sync-resource-state is-${coverage.key}`}>
                {coverage.label}
              </em>
            ) : null}
            <ChevronRight
              className="settings-sync-resource-chevron"
              size={14}
              aria-hidden="true"
            />
          </span>
        </summary>
        <small className="settings-sync-resource-summary">{countSummary}</small>
      </details>
    );
  };

  return (
    <section className="settings-home" aria-labelledby="settings-home-title">
      <h1 id="settings-home-title">Settings</h1>
      <p className="settings-home-subtitle">
        Manage how SurfMind syncs and stores your browsing data.
      </p>

      {pageCounts ? (
        <section className="settings-sync-counts" aria-label="Sync coverage">
          <div className="settings-sync-counts-heading">
            <strong>Sync coverage</strong>
            {pageCounts.status !== "ready" ? (
              <span className={`settings-sync-state is-${pageCounts.status}`}>
                {["idle", "checking"].includes(pageCounts.status)
                  ? "Checking…"
                  : "Unavailable"}
              </span>
            ) : null}
          </div>
          <p className="settings-sync-note">
            SurfMind syncs changes automatically.
          </p>
          {pageCounts.status === "ready" ? (
            <div className="settings-sync-count-grid">
              {renderCoverageResource("history")}
              {renderCoverageResource("bookmarks")}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="settings-menu">
        <button type="button" className="settings-tile" onClick={onOpenSync}>
          <span className="settings-tile-icon is-sync" aria-hidden="true">
            <Link2 size={18} />
          </span>
          <span className="settings-tile-copy">
            <strong>Cross-browser Sync</strong>
            <small>{syncSummary}</small>
          </span>
          <ChevronRight
            className="settings-tile-chevron"
            size={17}
            aria-hidden="true"
          />
        </button>

        <button type="button" className="settings-tile" onClick={onOpenHistory}>
          <span className="settings-tile-icon is-history" aria-hidden="true">
            <History size={18} />
          </span>
          <span className="settings-tile-copy">
            <strong>Saved History</strong>
            <small>
              {savedPageCount === 0
                ? "No pages saved on this browser"
                : `${savedPageCount} ${savedPageCount === 1 ? "page" : "pages"} saved on this browser`}
            </small>
          </span>
          <ChevronRight
            className="settings-tile-chevron"
            size={17}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          className="settings-tile"
          onClick={onOpenBookmarks}
        >
          <span className="settings-tile-icon is-bookmarks" aria-hidden="true">
            <Bookmark size={18} />
          </span>
          <span className="settings-tile-copy">
            <strong>Saved Bookmarks</strong>
            <small>
              {bookmarkFolderCount === 0
                ? "No bookmark folders found"
                : `${bookmarkFolderCount} ${bookmarkFolderCount === 1 ? "folder" : "folders"} on this browser`}
            </small>
          </span>
          <ChevronRight
            className="settings-tile-chevron"
            size={17}
            aria-hidden="true"
          />
        </button>

        <button type="button" className="settings-tile" onClick={onOpenPrivacy}>
          <span className="settings-tile-icon is-privacy" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          <span className="settings-tile-copy">
            <strong>Privacy</strong>
            <small>Control what SurfMind stores</small>
          </span>
          <ChevronRight
            className="settings-tile-chevron"
            size={17}
            aria-hidden="true"
          />
        </button>

        {HAS_EXTENSION_STORE_REVIEW ? (
          <button
            type="button"
            className="settings-tile"
            onClick={openReviewPage}
          >
            <span className="settings-tile-icon is-rate" aria-hidden="true">
              <Star size={18} />
            </span>
            <span className="settings-tile-copy">
              <strong>Rate SurfMind</strong>
              <small>Share your experience on the {EXTENSION_STORE_NAME}</small>
            </span>
            <ChevronRight
              className="settings-tile-chevron"
              size={17}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default SettingsHome;
