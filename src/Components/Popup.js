import { useContext, useEffect, useRef, useState } from "react";
import {
  Search,
  Trash2,
  History,
  Bookmark,
  GitMerge,
  ArrowRight,
} from "lucide-react";
import Bookmarks from "./Bookmarks";
import Combined from "./Combined";
import Update from "./Update";
import { userContext } from "../context/userContext";

const Popup = (props) => {
  const { host } = props.prop;
  const { state, setState, initializePopup, searchStream, syncHistory } =
    useContext(userContext);
  const {
    activeTab,
    query,
    head,
    parsed,
    loading,
    histLoader,
    disable,
    noti,
    data,
    docs,
    userId,
    updateFlag,
    syncing,
    step,
    finalReceived,
  } = state;
  const syncRequestedRef = useRef(false);

  useEffect(() => {
    initializePopup(host);
  }, [host, initializePopup]);

  useEffect(() => {
    if (syncRequestedRef.current) return;
    if (!host || !userId || !data?.navigationData?.length) return;
    syncRequestedRef.current = true;
    syncHistory(host, data.navigationData, userId);
  }, [data, host, syncHistory, userId]);

  useEffect(() => {
    if (!head) {
      setState({ parsed: { summary: "", url: null } });
      return;
    }
    const extracted = extractUrlFromHead(head);
    setState({ parsed: extracted });
  }, [head, setState]);

  const extractDomainName = (url) => {
    // eslint-disable-next-line
    const match = url.match(/https?:\/\/(www\.)?([^\.]+)/);
    return match ? match[2] : null;
  };

  const handleShowUpdate = async () => {
    await chrome.storage.local.set({ "sm-update-flag-v1.75": true });
    await chrome.storage.local.remove("sm-update-flag-v1.7");
    setState({ updateFlag: true });
  };

  const clearAllHistory = async () => {
    try {
      setState({ histLoader: true });
      await chrome.storage.local.set({ navigationData: [] });
      setState({ histLoader: false });
    } catch (error) {
      console.error("Error clearing history:", error);
      setState({ histLoader: false });
    }
  };

  const extractUrlFromHead = (head) => {
    if (!head || !head.includes("URL:"))
      return { summary: head || "", url: null };
    const [summary, urlRaw] = head.split("URL:");
    const url = urlRaw.trim();
    const displayUrl = url.length > 50 ? url.slice(0, 50) + "..." : url;
    return { summary: summary.trim(), url: displayUrl };
  };

  function getDaysAgo(searchDateStr) {
    const today = new Date();
    const searchDate = new Date(searchDateStr);
    today.setHours(0, 0, 0, 0);
    searchDate.setHours(0, 0, 0, 0);
    const diffTime = today - searchDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    const dataa = data.navigationData;
    if (!dataa || dataa.length === 0) {
      setState({ noti: "There is no data in History", disable: false });
      return;
    }
    await searchStream({ host, query, userId, flag: "history" });
  };

  const handleClearAllHistory = async () => {
    await clearAllHistory();
    setState({
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
      noti: "History Cleared Successfully",
      query: "",
      data: { navigationData: [] },
    });
  };

  const handleTabChange = (tab) => {
    setState({
      activeTab: tab,
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
      noti: "",
      query: "",
    });
  };

  const getShortUrl = (url) => {
    if (url.length > 30) {
      return url.replace("https://", "").slice(0, 15) + "...." + url.slice(-8);
    }
    return url.replace("https://", "");
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  const DocCard = ({ doc, showDate }) => {
    const domain =
      doc.metadata.source && extractDomainName(doc.metadata.source);
    return (
      <div
        className="bg-light p-2 border rounded mt-1"
        style={{ cursor: "pointer" }}
        onClick={() => chrome.tabs.create({ url: doc.metadata.source })}
        title={doc.metadata.source}
      >
        <p style={{ margin: "0", padding: "0", fontSize: "13px" }}>
          {domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : ""}
          {doc.metadata.title?.length > 0 ? ` | ${doc.metadata.title}` : ""}
        </p>
        <div className="d-flex">
          <p
            className="text-muted flex-grow-1"
            style={{ fontSize: "12px", margin: "0", padding: "0" }}
          >
            {getShortUrl(doc.metadata.source)}
          </p>
          {showDate && doc.metadata.date && (
            <p
              className="text-muted"
              style={{ fontSize: "12px", margin: "0", padding: "0" }}
            >
              {getDaysAgo(doc.metadata.date)}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container p-4" style={{ width: "350px" }}>
      {/* ── Header ── */}
      <div className="d-flex align-items-center mb-3">
        <span className="flex-grow-1">
          <span
            className="fw-bold"
            style={{
              fontSize: "16px",
              display: "inline-block",
              background: "linear-gradient(90deg, #0d6efd, #6f42c1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SurfMind
            {syncing && (
              <span
                className="badge bg-info text-dark ms-2"
                style={{ fontSize: "10px", WebkitTextFillColor: "initial" }}
              >
                Syncing
              </span>
            )}
          </span>
        </span>

        {/* ── Tab dropdown ── */}
        <div className="position-relative">
          {/* NEW badge — tied to updateFlag so it disappears when user dismisses the Update box */}
          {!updateFlag && (
            <span
              className="badge bg-danger position-absolute"
              style={{
                fontSize: "9px",
                borderRadius: "4px",
                top: "-7px",
                right: "-7px",
                zIndex: 2,
              }}
            >
              NEW
            </span>
          )}
          <button
            className={`btn btn-sm btn-outline-${tabColor[activeTab]} dropdown-toggle d-flex align-items-center gap-1`}
            style={{ borderRadius: "6px", minWidth: "105px", fontSize: "13px" }}
            onClick={() => setDropdownOpen((o) => !o)}
          >
            {activeTab === "history" && <History size={13} />}
            {activeTab === "bookmark" && <Bookmark size={13} />}
            {activeTab === "combined" && <GitMerge size={13} />}
            {tabLabel[activeTab]}
          </button>
          {dropdownOpen && (
            <>
              {/* backdrop to close on outside click */}
              <div
                className="position-fixed top-0 start-0 w-100 h-100"
                style={{ zIndex: 100 }}
                onClick={() => setDropdownOpen(false)}
              />
              <ul
                className="dropdown-menu show shadow"
                style={{
                  position: "absolute",
                  right: 0,
                  left: "auto",
                  top: "calc(100% + 4px)",
                  zIndex: 1050,
                  borderRadius: "6px",
                  minWidth: "130px",
                  border: "1.5px solid #dee2e6",
                }}
              >
                <li>
                  <button
                    className="dropdown-item rounded-top d-flex align-items-center gap-2"
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
                    className="dropdown-item d-flex align-items-center gap-2"
                    onClick={() => {
                      handleTabChange("bookmark");
                      setDropdownOpen(false);
                    }}
                  >
                    <Bookmark size={14} className="text-danger" /> Bookmarks
                  </button>
                </li>
                <li>
                  <button
                    className="dropdown-item rounded-bottom d-flex align-items-center gap-2"
                    onClick={() => {
                      handleTabChange("combined");
                      setDropdownOpen(false);
                    }}
                  >
                    <GitMerge size={14} className="text-success" /> Combined
                    <span
                      className="badge bg-success ms-auto"
                      style={{ fontSize: "9px" }}
                    >
                      New
                    </span>
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ── Views ── */}
      {activeTab === "history" && (
        <div>
          <div className="mb-3">
            <label
              htmlFor="exampleInput"
              className="form-label text-muted d-flex align-items-center gap-1"
              style={{ fontSize: "14px" }}
            >
              <History size={14} className="text-primary" />
              Search Your <span className="text-primary">History</span>
            </label>
            <input
              type="text"
              className="form-control"
              id="exampleInput"
              value={query}
              onChange={(e) => setState({ query: e.target.value })}
              placeholder="Search History"
              aria-describedby="textHelp"
            />
            <div className="form-text" style={{ fontSize: "12px" }}>
              Type Keywords for better results
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
            style={{ borderRadius: "10px" }}
            disabled={disable || query === ""}
            onClick={handleSearch}
          >
            <Search size={13} />
            Search
            {loading && (
              <span className="spinner-border spinner-border-sm ms-1"></span>
            )}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm ms-2 d-inline-flex align-items-center gap-1"
            style={{ borderRadius: "10px" }}
            onClick={handleClearAllHistory}
          >
            <Trash2 size={13} />
            Clear
            {histLoader && (
              <span className="spinner-border spinner-border-sm ms-1"></span>
            )}
          </button>
        </div>
      )}

      {activeTab === "bookmark" && <Bookmarks host={host} />}
      {activeTab === "combined" && <Combined host={host} />}

      {/* ── Streaming step indicator ── */}
      <p className="m-2" style={{ fontSize: "12px" }}>
        {noti}
      </p>
      {!finalReceived && step && (
        <div className="mt-2">
          <details className="mb-2">
            <summary
              className="text-muted"
              style={{ fontSize: "12px", cursor: "pointer" }}
            >
              {step.title}
            </summary>
            <pre
              className="bg-light border rounded p-2 mt-1"
              style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}
            >
              {typeof step.content === "string"
                ? step.content
                : JSON.stringify(step.content, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* ── Final answer card ── */}
      {finalReceived && (parsed.summary || parsed.url) && (
        <div
          className="border rounded p-3 mt-2"
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
          <p style={{ fontSize: "13px", margin: "0 0 6px 0" }}>
            {parsed.summary}
          </p>
          {parsed.url && (
            <a
              href={parsed.url}
              onClick={(e) => {
                e.preventDefault();
                chrome.tabs.create({ url: parsed.url });
              }}
              style={{ fontSize: "12px", wordBreak: "break-all" }}
            >
              {parsed.url}
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
                  <DocCard key={i} doc={doc} showDate={true} />
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
                  <DocCard key={i} doc={doc} showDate={false} />
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
              <DocCard key={i} doc={doc} showDate={activeTab === "history"} />
            ))}
          </div>
        )}
      </div>

      {!updateFlag && <Update handleShowUpdate={handleShowUpdate} />}
    </div>
  );
};

export default Popup;
