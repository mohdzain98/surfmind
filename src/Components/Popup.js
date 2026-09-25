import { useCallback, useContext, useEffect, useState } from "react";
import {
  ArrowLeft,
  History,
  Bookmark,
  ChevronRight,
  Clock3,
  GitMerge,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import Bookmarks from "./Bookmarks";
import Combined from "./Combined";
import Update from "./Update";
import SyncSettings from "./SyncSettings";
import PrivacySettings from "./PrivacySettings";
import SettingsHome from "./SettingsHome";
import SavedHistory from "./SavedHistory";
import SavedBookmarks from "./SavedBookmarks";
import RecentSearches from "./RecentSearches";
import SearchComposer from "./SearchComposer";
import SearchThought from "./SearchThought";
import SourceCard from "./SourceCard";
import RatePromptBanner from "./RatePromptBanner";
import { userContext } from "../context/userContext";
import { truncateUrl, truncateUrlsInText } from "../services/displayText";
import {
  CONTACT_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from "../services/privacy";
import {
  LEGACY_UPDATE_VERSIONS,
  UPDATE_PREVIOUS_VERSION_KEY,
  UPDATE_VERSION_KEY,
} from "../services/updateVersion";
import {
  claimRatePrompt,
  STORE_REVIEW_URL,
  permanentlyDismissRatePrompt,
} from "../services/ratePrompt";
import { getSyncPageCounts } from "../services/syncApi";
import {
  buildPageSyncCoverage,
  readLocalPageCounts,
} from "../services/pageCounts";
import { toUserFacingError } from "../services/userFacingError";

const EMPTY_PAGE_COUNTS = {
  status: "idle",
  local: { history: 0, bookmarks: 0 },
  remote: { history: 0, bookmarks: 0 },
  matches: false,
};
const COVERAGE_RECHECK_ATTEMPTS = 8;
const COVERAGE_RECHECK_DELAY_MS = 750;

const wait = (delayMs) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const WELCOME_LINES = [
  "Hi, what would you like to rediscover today?",
  "Let’s find what you saw before.",
  "Forgot where you found it? Just ask.",
  "Your history remembers. What are we looking for?",
  "Bookmarks saved it. SurfMind can bring it back.",
  "A past page is only one question away.",
  "Somewhere in your history, this is waiting.",
  "You've seen it before. Let's go find it.",
  "One search away from that page you lost.",
  "Ask, and your browsing does the rest.",
  "That tab you closed too soon? Still here.",
  "What did you read that you can't quite place?",
];

const Popup = (props) => {
  const { host } = props.prop;
  const {
    state,
    setState,
    initializePopup,
    searchStream,
    refreshAfterPairing,
  } = useContext(userContext);
  const {
    activeTab,
    query,
    head,
    parsed,
    loading,
    disable,
    noti,
    docs,
    userId,
    updateFlag,
    updateNotice,
    updateReady,
    updateVersion,
    syncing,
    step,
    thoughts = [],
    finalReceived,
  } = state;
  useEffect(() => {
    initializePopup(host);
  }, [host, initializePopup]);

  useEffect(() => {
    if (!head) {
      setState({ parsed: { summary: "", url: null } });
      return;
    }
    const extracted = extractUrlFromHead(head);
    setState({ parsed: extracted });
  }, [head, setState]);

  const handleShowUpdate = async () => {
    await chrome.storage.local.set({ [UPDATE_VERSION_KEY]: updateVersion });
    await chrome.storage.local.remove([
      UPDATE_PREVIOUS_VERSION_KEY,
      ...LEGACY_UPDATE_VERSIONS.map(({ key }) => key),
    ]);
    setState({ updateFlag: true, updateNotice: null });
  };

  const extractUrlFromHead = (head) => {
    if (!head || !head.includes("URL:"))
      return { summary: head || "", url: null };
    const [summary, urlRaw] = head.split("URL:");
    const url = urlRaw.trim();
    return { summary: summary.trim(), url };
  };

  const handleSearch = async () => {
    await searchStream({ host, query, userId, flag: "history" });
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [lastSearchTab, setLastSearchTab] = useState("history");
  const [showRecentPage, setShowRecentPage] = useState(false);
  const [settingsView, setSettingsView] = useState("home");
  const [showRatePrompt, setShowRatePrompt] = useState(false);
  const [manualSync, setManualSync] = useState({
    status: "idle",
    message: "",
  });
  const [pageCounts, setPageCounts] = useState(EMPTY_PAGE_COUNTS);
  const [welcomeLine] = useState(
    () => WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)]
  );

  const handleTabChange = (tab) => {
    setShowRatePrompt(false);
    setShowRecentPage(false);
    setSettingsView("home");
    if (tab !== "settings") setLastSearchTab(tab);
    setState({
      activeTab: tab,
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
      noti: "",
      query: "",
      loading: false,
      step: null,
      thoughts: [],
      finalReceived: false,
    });
  };

  const handleSettingsToggle = () => {
    setDropdownOpen(false);
    setSettingsView("home");
    handleTabChange(activeTab === "settings" ? lastSearchTab : "settings");
  };

  useEffect(() => {
    if (!manualSync.message || manualSync.status === "syncing") {
      return undefined;
    }
    const timeoutId = setTimeout(() => {
      setManualSync({ status: "idle", message: "" });
    }, 6000);
    return () => clearTimeout(timeoutId);
  }, [manualSync.message, manualSync.status]);

  const refreshPageCounts = useCallback(async () => {
    if (!host || !userId) return null;

    setPageCounts((current) => ({ ...current, status: "checking" }));
    try {
      const [local, remote] = await Promise.all([
        readLocalPageCounts(),
        getSyncPageCounts(host, userId),
      ]);
      const coverage = buildPageSyncCoverage(local, remote);
      const nextCounts = {
        status: "ready",
        local,
        remote,
        coverage,
        matches: coverage.matches,
      };
      setPageCounts(nextCounts);
      return nextCounts;
    } catch (error) {
      setPageCounts((current) => ({
        ...current,
        status: "error",
        error: error?.message || "Could not compare synced data",
      }));
      return null;
    }
  }, [host, userId]);

  useEffect(() => {
    refreshPageCounts();
  }, [refreshPageCounts]);

  const refreshPageCountsAfterSync = useCallback(async () => {
    let latestCounts = null;

    for (let attempt = 0; attempt < COVERAGE_RECHECK_ATTEMPTS; attempt += 1) {
      latestCounts = await refreshPageCounts();
      const waitingForCountUpdate = [
        latestCounts?.coverage?.history?.key,
        latestCounts?.coverage?.bookmarks?.key,
      ].some((key) => ["dirty", "new-local"].includes(key));
      if (!latestCounts || latestCounts.matches || !waitingForCountUpdate) {
        break;
      }
      if (attempt < COVERAGE_RECHECK_ATTEMPTS - 1) {
        await wait(COVERAGE_RECHECK_DELAY_MS);
      }
    }

    return latestCounts;
  }, [refreshPageCounts]);

  const handleManualSync = async () => {
    if (manualSync.status === "syncing") return;
    setManualSync({ status: "syncing", message: "Syncing all saved data…" });

    try {
      const result = await chrome.runtime.sendMessage({
        action: "syncAllData",
        host,
      });
      if (!result?.success) {
        throw new Error(
          toUserFacingError(
            result?.error,
            "SurfMind couldn’t sync your saved data. Please try again."
          )
        );
      }

      setManualSync({
        status: "syncing",
        message: "Sync complete. Updating coverage…",
      });
      const refreshedCounts = await refreshPageCountsAfterSync();
      setManualSync({
        status: "success",
        message: refreshedCounts?.matches
          ? "Sync complete. History and bookmarks are up to date."
          : "Sync complete. Coverage was refreshed.",
      });
    } catch (error) {
      setManualSync({
        status: "error",
        message: toUserFacingError(
          error,
          "SurfMind couldn’t sync your saved data. Please try again."
        ),
      });
    }
  };

  const syncAction = pageCounts.coverage?.action || null;
  const syncAvailable = Boolean(
    pageCounts.status === "ready" && pageCounts.coverage?.canSync
  );
  const allLocalPagesSynced = Boolean(
    pageCounts.status === "ready" && !syncAvailable
  );
  const refreshOnly = syncAction === "refresh";
  const checkingPageCounts = ["idle", "checking"].includes(pageCounts.status);

  const handleClearSearch = () => {
    setShowRatePrompt(false);
    setShowRecentPage(false);
    setState({
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
      noti: "",
      query: "",
      loading: false,
      disable: false,
      syncing: false,
      step: null,
      thoughts: [],
      finalReceived: false,
    });
  };

  const handleHistoryCleared = () => {
    setState({ data: { navigationData: [] } });
  };

  const handleAllDataCleared = (nextUserId) => {
    setShowRatePrompt(false);
    setShowRecentPage(false);
    setState({
      activeTab: "history",
      query: "",
      head: "",
      parsed: { summary: "", url: null },
      loading: false,
      disable: false,
      noti: "",
      data: { navigationData: [] },
      docs: [],
      userId: nextUserId,
      updateFlag: true,
      updateNotice: null,
      updateReady: true,
      syncing: false,
      step: null,
      thoughts: [],
      finalReceived: false,
    });
  };

  const tabLabel = {
    history: "History",
    bookmark: "Bookmarks",
    combined: "Combined",
  };
  const tabColor = {
    history: "primary",
    bookmark: "danger",
    combined: "success",
  };

  // For combined view, split docs by source type
  const historyDocs = docs.filter((d) => d.metadata?.type === "history");
  const bookmarkDocs = docs.filter((d) => d.metadata?.type === "bookmark");
  const isCombined = activeTab === "combined";
  const hasSearchActivity = Boolean(
    loading || syncing || step || finalReceived || head || docs.length
  );
  const hasCompletedAnswer = Boolean(
    finalReceived && (parsed.summary || parsed.url)
  );
  const hasEmptyHistoryAnswer = Boolean(
    activeTab === "history" &&
    /\bno history data found\b/i.test(parsed.summary || "")
  );
  const hasNoDataAnswer = Boolean(
    /\bno\s+(?:(?:relevant|history|bookmark)\s+)?data\s+found\b/i.test(
      parsed.summary || ""
    )
  );
  const showRecentSearches = Boolean(
    activeTab !== "settings" && !hasSearchActivity
  );
  const showRecentSearchLink = Boolean(
    activeTab !== "settings" && hasCompletedAnswer
  );

  const handleSourceOpen = async () => {
    try {
      if (await claimRatePrompt()) setShowRatePrompt(true);
    } catch {
      // Opening a matched source should still work if prompt storage fails.
    }
  };

  const handleRateNow = async () => {
    setShowRatePrompt(false);
    if (STORE_REVIEW_URL) chrome.tabs.create({ url: STORE_REVIEW_URL });
    try {
      await permanentlyDismissRatePrompt();
    } catch {
      // The Web Store action should not be blocked by a storage failure.
    }
  };

  const handleRateDismiss = async () => {
    setShowRatePrompt(false);
    try {
      await permanentlyDismissRatePrompt();
    } catch {
      // The banner remains dismissible if storage is temporarily unavailable.
    }
  };

  if (!updateReady) {
    return (
      <main className="update-loading" aria-label="Loading SurfMind">
        <Sparkles size={22} aria-hidden="true" />
      </main>
    );
  }

  if (updateNotice === "major") {
    return <Update severity="major" handleShowUpdate={handleShowUpdate} />;
  }

  return (
    <main
      className={`container-fluid side-panel-shell ${
        hasSearchActivity ? "has-search-activity" : "is-search-empty"
      } ${showRecentPage ? "is-recent-page" : ""}`}
    >
      {/* ── Header ── */}
      <div className="panel-nav d-flex align-items-center mb-3">
        <div className="flex-grow-1">
          {showRecentPage ? (
            <button
              type="button"
              className="panel-back-button"
              onClick={() => setShowRecentPage(false)}
              aria-label="Back to answer"
            >
              <ArrowLeft size={17} aria-hidden="true" />
              Back
            </button>
          ) : activeTab === "settings" ? (
            <button
              type="button"
              className="panel-back-button"
              onClick={
                settingsView === "home"
                  ? handleSettingsToggle
                  : () => setSettingsView("home")
              }
              aria-label={
                settingsView === "home" ? "Back to search" : "Back to settings"
              }
            >
              <ArrowLeft size={17} aria-hidden="true" />
              Back
            </button>
          ) : (
            <span className="panel-brand">
              {hasSearchActivity ? "SurfMind" : "SM"}
            </span>
          )}
          {syncing ? (
            <span className="badge bg-info text-dark ms-2 syncing-badge">
              Syncing
            </span>
          ) : null}
        </div>

        <div className="panel-nav-actions">
          <button
            type="button"
            className={`manual-sync-button ${manualSync.status === "syncing" ? "is-syncing" : ""} ${allLocalPagesSynced ? "is-synced" : ""}`}
            onClick={handleManualSync}
            disabled={
              manualSync.status === "syncing" ||
              !syncAvailable ||
              checkingPageCounts
            }
            aria-label={
              refreshOnly
                ? "Refresh synced history and bookmarks"
                : "Sync all history and bookmarks"
            }
            title={
              allLocalPagesSynced
                ? "History and bookmarks are up to date"
                : checkingPageCounts
                  ? "Checking sync status"
                  : refreshOnly
                    ? "Refresh the most recent saved history and bookmarks"
                    : "Sync all saved history and bookmarks"
            }
          >
            <RefreshCw size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`settings-button ${activeTab === "settings" ? "is-active" : ""}`}
            onClick={handleSettingsToggle}
            aria-label={
              activeTab === "settings" ? "Return to search" : "Open settings"
            }
            title={activeTab === "settings" ? "Return to search" : "Settings"}
          >
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {manualSync.message ? (
        <div
          className={`manual-sync-notice is-${manualSync.status}`}
          role="status"
          aria-live="polite"
        >
          {manualSync.message}
        </div>
      ) : null}

      {showRecentPage ? (
        <div className="recent-searches-page">
          <RecentSearches host={host} browserUuid={userId} />
        </div>
      ) : (
        <>
          {activeTab !== "settings" && !hasSearchActivity ? (
            <section
              className="search-welcome"
              aria-labelledby="surfmind-welcome"
            >
              <div className="search-welcome-icon" aria-hidden="true">
                <Sparkles size={26} />
              </div>
              <h1 id="surfmind-welcome">SurfMind</h1>
              <p className="search-welcome-tagline">
                Smarter browsing starts here.
              </p>
              <div className="search-welcome-divider" aria-hidden="true">
                <span />
              </div>
              <p className="search-welcome-line">{welcomeLine}</p>
            </section>
          ) : null}

          {/* ── Views ── */}
          {activeTab === "history" && (
            <div className="search-controls">
              <SearchComposer
                id="history-search"
                value={query}
                onChange={(value) => setState({ query: value })}
                onSubmit={handleSearch}
                placeholder="Ask SurfMind about your history…"
                mode="history"
                disabled={disable}
                loading={loading}
              />
            </div>
          )}

          {activeTab === "bookmark" && (
            <div className="search-controls">
              <Bookmarks host={host} />
            </div>
          )}
          {activeTab === "combined" && (
            <div className="search-controls">
              <Combined host={host} />
            </div>
          )}
          {activeTab === "settings" && (
            <div className="settings-page">
              {settingsView === "home" ? (
                <SettingsHome
                  onOpenSync={() => setSettingsView("sync")}
                  onOpenHistory={() => setSettingsView("history")}
                  onOpenBookmarks={() => setSettingsView("bookmarks")}
                  onOpenPrivacy={() => setSettingsView("privacy")}
                  pageCounts={pageCounts}
                />
              ) : null}
              {settingsView === "sync" ? (
                <div className="settings-detail">
                  <SyncSettings
                    host={host}
                    browserUuid={userId}
                    onPairingChanged={(action) =>
                      refreshAfterPairing(host, action)
                    }
                  />
                </div>
              ) : null}
              {settingsView === "history" ? (
                <div className="settings-detail">
                  <SavedHistory />
                </div>
              ) : null}
              {settingsView === "bookmarks" ? (
                <div className="settings-detail">
                  <SavedBookmarks />
                </div>
              ) : null}
              {settingsView === "privacy" ? (
                <div className="settings-detail">
                  <PrivacySettings
                    host={host}
                    browserUuid={userId}
                    onHistoryCleared={handleHistoryCleared}
                    onAllDataCleared={handleAllDataCleared}
                  />
                </div>
              ) : null}
            </div>
          )}

          {activeTab !== "settings" ? (
            <div className="search-mode-selector position-relative mt-3 d-flex justify-content-between align-items-center">
              <div className="position-relative">
                {!updateFlag ? (
                  <span className="mode-new-badge badge bg-danger">NEW</span>
                ) : null}
                <button
                  type="button"
                  className={`btn btn-sm btn-outline-${tabColor[activeTab]} dropdown-toggle d-flex align-items-center gap-1`}
                  onClick={() => setDropdownOpen((open) => !open)}
                  aria-expanded={dropdownOpen}
                >
                  {activeTab === "history" ? <History size={13} /> : null}
                  {activeTab === "bookmark" ? <Bookmark size={13} /> : null}
                  {activeTab === "combined" ? <GitMerge size={13} /> : null}
                  {tabLabel[activeTab]}
                </button>
                {dropdownOpen ? (
                  <>
                    <div
                      className="position-fixed top-0 start-0 w-100 h-100"
                      style={{ zIndex: 100 }}
                      onClick={() => setDropdownOpen(false)}
                    />
                    <ul className="dropdown-menu dropdown-menu-end show shadow search-mode-menu">
                      <li>
                        <button
                          type="button"
                          className="dropdown-item d-flex align-items-center gap-2"
                          onClick={() => {
                            handleTabChange("history");
                            setDropdownOpen(false);
                          }}
                        >
                          <History size={14} className="text-primary" /> History
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="dropdown-item d-flex align-items-center gap-2"
                          onClick={() => {
                            handleTabChange("bookmark");
                            setDropdownOpen(false);
                          }}
                        >
                          <Bookmark size={14} className="text-danger" />{" "}
                          Bookmarks
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="dropdown-item d-flex align-items-center gap-2"
                          onClick={() => {
                            handleTabChange("combined");
                            setDropdownOpen(false);
                          }}
                        >
                          <GitMerge size={14} className="text-success" />{" "}
                          Combined
                        </button>
                      </li>
                    </ul>
                  </>
                ) : null}
              </div>
              {hasSearchActivity ? (
                <button
                  type="button"
                  className="search-clear-button"
                  onClick={handleClearSearch}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          {/* ── Current streamed thought ── */}
          {activeTab !== "settings" ? (
            <SearchThought
              message={noti}
              step={step}
              thoughts={thoughts}
              mode={activeTab}
              complete={hasCompletedAnswer}
            />
          ) : null}

          {showRatePrompt ? (
            <RatePromptBanner
              mode={activeTab}
              onRate={handleRateNow}
              onLater={() => setShowRatePrompt(false)}
              onDismiss={handleRateDismiss}
            />
          ) : null}

          {/* ── Final answer card ── */}
          {finalReceived && (parsed.summary || parsed.url) && (
            <div
              className="answer-card border rounded p-3 mt-2"
              style={{ backgroundColor: "#f8f9ff", borderColor: "#d0d8ff" }}
            >
              <p
                className="text-muted mb-1"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                ANSWER
              </p>
              <p
                className="answer-text"
                style={{ fontSize: "13px", margin: "0 0 6px 0" }}
              >
                {hasEmptyHistoryAnswer
                  ? "SurfMind hasn’t saved any searchable visits yet."
                  : truncateUrlsInText(parsed.summary)}
              </p>
              {hasEmptyHistoryAnswer ? (
                <p className="answer-context mb-0">
                  Your existing Chrome history isn’t imported automatically.
                  SurfMind builds its own searchable history from pages you
                  visit after installing it.
                </p>
              ) : null}
              {hasNoDataAnswer ? (
                <div className="answer-sync-tip">
                  <span>
                    Check Sync Coverage in Settings to make sure your data is
                    synced.
                  </span>
                  <div className="answer-sync-tip-actions">
                    <button
                      type="button"
                      onClick={() => handleTabChange("settings")}
                    >
                      Open Settings
                    </button>
                  </div>
                </div>
              ) : null}
              {parsed.url && (
                <a
                  href={parsed.url}
                  onClick={(e) => {
                    e.preventDefault();
                    chrome.tabs.create({ url: parsed.url });
                  }}
                  className="answer-url"
                  style={{ fontSize: "12px" }}
                >
                  {truncateUrl(parsed.url)}
                </a>
              )}
            </div>
          )}

          {/* ── Matched sources ── */}
          <div className="mt-2">
            {/* Combined view: split by source type */}
            {isCombined && docs.length > 0 && (
              <div>
                {historyDocs.length > 0 && (
                  <div className="mt-2">
                    <p
                      className="text-muted mb-1"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                      }}
                    >
                      FROM HISTORY
                    </p>
                    {historyDocs.map((doc, i) => (
                      <SourceCard
                        key={i}
                        doc={doc}
                        showDate={true}
                        onOpen={handleSourceOpen}
                      />
                    ))}
                  </div>
                )}
                {bookmarkDocs.length > 0 && (
                  <div className="mt-2">
                    <p
                      className="text-muted mb-1"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                      }}
                    >
                      FROM BOOKMARKS
                    </p>
                    {bookmarkDocs.map((doc, i) => (
                      <SourceCard
                        key={i}
                        doc={doc}
                        showDate={false}
                        onOpen={handleSourceOpen}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* History / Bookmark view: flat list */}
            {!isCombined && docs.length > 0 && (
              <div>
                <p
                  className="fst-italic text-muted mb-1"
                  style={{ fontSize: "13px" }}
                >
                  Matched Sources
                </p>
                {docs.map((doc, i) => (
                  <SourceCard
                    key={i}
                    doc={doc}
                    showDate={activeTab === "history"}
                    onOpen={handleSourceOpen}
                  />
                ))}
              </div>
            )}
          </div>

          {showRecentSearches ? (
            <RecentSearches host={host} browserUuid={userId} />
          ) : null}

          {showRecentSearchLink ? (
            <button
              type="button"
              className="recent-searches-link"
              onClick={() => setShowRecentPage(true)}
            >
              <Clock3 size={15} aria-hidden="true" />
              <span>Recent Searches</span>
              <ChevronRight
                size={15}
                className="recent-searches-link-arrow"
                aria-hidden="true"
              />
            </button>
          ) : null}

          {updateNotice === "minor" ? (
            <Update severity="minor" handleShowUpdate={handleShowUpdate} />
          ) : null}
        </>
      )}

      <footer className="app-footer" aria-label="SurfMind links">
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
          Privacy
        </a>
        <span aria-hidden="true">·</span>
        <a href={TERMS_URL} target="_blank" rel="noreferrer">
          Terms
        </a>
        <span aria-hidden="true">·</span>
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Contact
        </a>
      </footer>
    </main>
  );
};

export default Popup;
