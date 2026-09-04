import { useContext, useEffect, useState } from "react";
import {
  ArrowLeft,
  History,
  Bookmark,
  ChevronRight,
  Clock3,
  GitMerge,
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
import RecentSearches from "./RecentSearches";
import SearchComposer from "./SearchComposer";
import SearchThought from "./SearchThought";
import SourceCard from "./SourceCard";
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
  const [welcomeLine] = useState(
    () => WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)]
  );

  const handleTabChange = (tab) => {
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

  const handleClearSearch = () => {
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
  const showRecentSearches = Boolean(
    activeTab !== "settings" && !hasSearchActivity
  );
  const showRecentSearchLink = Boolean(
    activeTab !== "settings" && hasCompletedAnswer
  );

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
                  onOpenPrivacy={() => setSettingsView("privacy")}
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
                      <SourceCard key={i} doc={doc} showDate={true} />
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
                      <SourceCard key={i} doc={doc} showDate={false} />
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
