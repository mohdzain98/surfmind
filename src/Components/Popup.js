import { useContext, useEffect, useRef } from "react";
import Bookmarks from "./Bookmarks";
import Update from "./Update";
import { userContext } from "../context/userContext";
// import { hist } from "./check_data";

const Popup = (props) => {
  const { host } = props.prop;
  const { state, setState, initializePopup, searchStream, syncHistory } =
    useContext(userContext);
  const {
    historyTab,
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
    await chrome.storage.local.set({ "sm-update-flag-v1.6": true });
    await chrome.storage.local.remove("sm-update-flag");
    setState({ updateFlag: false });
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

    return {
      summary: summary.trim(),
      url: displayUrl,
    };
  };

  function getDaysAgo(searchDateStr) {
    const today = new Date();
    const searchDate = new Date(searchDateStr);

    // Remove time from both dates
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
    // const dataa = hist;
    if (!dataa || dataa.length === 0) {
      setState({ noti: "There is no data in History", disable: false });
      return;
    }
    await searchStream({
      host,
      query,
      userId,
      flag: "history",
    });
  };

  const handleTab = () => {
    setState({
      historyTab: false,
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
      noti: "",
      query: "",
    });
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

  const getShortUrl = (url) => {
    if (url.length > 30) {
      const short_url =
        url.replace("https://", "").slice(0, 15) + "...." + url.slice(-8);
      return short_url;
    }
    return url.replace("https://", "");
  };

  return (
    <div className="container p-4" style={{ width: "350px" }}>
      {historyTab ? (
        <div>
          <div className="mb-3">
            <div className="d-flex">
              <label
                for="exampleInput"
                className="form-label text-muted flex-grow-1"
                style={{ fontSize: "14px" }}
              >
                Search Your <span className="text-primary">History</span>
                {syncing && (
                  <span className="badge bg-info text-dark ms-2">Syncing</span>
                )}
              </label>
              <p
                className="text-danger"
                style={{ fontSize: "14px", cursor: "pointer" }}
                onClick={handleTab}
              >
                Bookmarks
              </p>
            </div>
            <input
              type="text"
              className="form-control"
              id="exampleInput"
              value={query}
              onChange={(e) => setState({ query: e.target.value })}
              placeholder="Search History"
              aria-describedby="textHelp"
            />
            <div
              id="textHelp"
              className="form-text"
              style={{ fontSize: "14px" }}
            >
              Type Keywords for better results
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-warning btn-sm"
            style={{ borderRadius: "10px" }}
            disabled={disable || query === ""}
            onClick={handleSearch}
          >
            Search
            <span
              className={`${
                loading ? "spinner-border spinner-border-sm mx-2" : ""
              } ms-2`}
            ></span>
          </button>
          <button
            type="button"
            className="btn btn-outline-warning btn-sm ms-2 text-secondary"
            style={{ borderRadius: "10px" }}
            onClick={handleClearAllHistory}
          >
            Clear History{" "}
            <span
              className={`${
                histLoader ? "spinner-border spinner-border-sm mx-2" : ""
              }`}
            ></span>
          </button>
        </div>
      ) : (
        <Bookmarks host={host} />
      )}
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
      <div className="mt-2">
        <div className="mb-2">
          <p
            classname="px-4"
            style={{ fontSize: "13px", margin: "0", padding: "0" }}
          >
            {parsed.summary} <br />
            {parsed.url && (
              <>
                <span className="fw-bold me-2">Url:</span>
                {parsed.url}
              </>
            )}
          </p>
        </div>
        {docs.length > 0 && (
          <p
            className="fst-italic text-muted"
            style={{ fontSize: "13px", margin: "0", padding: "0" }}
          >
            Below are the matched Sources
          </p>
        )}
        {docs.length > 0 &&
          docs.map((doc) => (
            <div
              className="bg-light p-2 border rounded mt-1"
              onClick={() => {
                chrome.tabs.create({ url: doc.metadata.source });
              }}
              data-toggle="tooltip"
              data-placement="top"
              title={doc.metadata.source}
            >
              <div style={{ cursor: "pointer" }}>
                <p style={{ margin: "0", padding: "0", fontSize: "13px" }}>
                  {doc.metadata.source &&
                    extractDomainName(doc.metadata.source)
                      .charAt(0)
                      .toUpperCase() +
                      extractDomainName(doc.metadata.source).slice(1)}{" "}
                  {doc.metadata.title.length > 0
                    ? `| ${doc.metadata.title}`
                    : ""}
                </p>
                <div className="d-flex">
                  <p
                    className="text-muted flex-grow-1"
                    style={{ fontSize: "12px", margin: "0", padding: "0" }}
                  >
                    {getShortUrl(doc.metadata.source)}
                  </p>
                  {historyTab && (
                    <p
                      className="text-muted"
                      style={{ fontSize: "12px", margin: "0", padding: "0" }}
                    >
                      {getDaysAgo(doc.metadata.date)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
      {!updateFlag && <Update handleShowUpdate={handleShowUpdate} />}
    </div>
  );
};

export default Popup;
