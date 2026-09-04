import { useEffect, useState } from "react";
import { ChevronRight, History, Link2, ShieldCheck } from "lucide-react";

const SYNC_STATUS_KEY = "crossBrowserSyncStatus";
const SOLO_STATUS = { isLinked: false, browserCount: 1 };

const countSavedPages = (entries = []) =>
  new Set(entries.map((entry) => entry?.url).filter(Boolean)).size;

const SettingsHome = ({ onOpenSync, onOpenHistory, onOpenPrivacy }) => {
  const [syncStatus, setSyncStatus] = useState(SOLO_STATUS);
  const [savedPageCount, setSavedPageCount] = useState(0);

  useEffect(() => {
    const storage = chrome.storage;
    if (!storage?.local) return undefined;

    let mounted = true;
    storage.local
      .get({ [SYNC_STATUS_KEY]: SOLO_STATUS, navigationData: [] })
      .then((stored) => {
        if (!mounted) return;
        setSyncStatus(stored[SYNC_STATUS_KEY] || SOLO_STATUS);
        setSavedPageCount(countSavedPages(stored.navigationData));
      });

    const handleStorageChange = (changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[SYNC_STATUS_KEY]) {
        setSyncStatus(changes[SYNC_STATUS_KEY].newValue || SOLO_STATUS);
      }
      if (changes.navigationData) {
        setSavedPageCount(countSavedPages(changes.navigationData.newValue));
      }
    };
    storage.onChanged?.addListener(handleStorageChange);

    return () => {
      mounted = false;
      storage.onChanged?.removeListener(handleStorageChange);
    };
  }, []);

  const syncSummary = syncStatus.isLinked
    ? `${syncStatus.browserCount} ${
        syncStatus.browserCount === 1 ? "browser" : "browsers"
      } linked`
    : "Link and manage your browsers";

  return (
    <section className="settings-home" aria-labelledby="settings-home-title">
      <h1 id="settings-home-title">Settings</h1>
      <p className="settings-home-subtitle">
        Manage how SurfMind syncs and stores your browsing data.
      </p>

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
          onClick={onOpenPrivacy}
        >
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
      </div>

    </section>
  );
};

export default SettingsHome;
