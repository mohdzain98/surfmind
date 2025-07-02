import { useEffect, useState } from "react";
import Bookmarks from "./Bookmarks";
import { initializeUserId } from "./UserId";
import Update from "./Update";
// import { hist } from "./check_data";

const Popup = (props) => {
  const { host } = props.prop;
  const [historyTab, setHistoryTab] = useState(true);
  const [query, setQuery] = useState("");
  const [head, setHead] = useState("");
  const [parsed, setParsed] = useState({
    // parsed version
    summary: "",
    url: null,
  });
  const [loader, setLoader] = useState("");
  const [histLoader, setHistLoader] = useState(false);
  const [disable, setDisable] = useState(false);
  const [noti, setNoti] = useState("");
  const [data, setData] = useState("");
  const [docs, setDocs] = useState([]);
  const [userId, setUserId] = useState("");
  const [updateFlag, setUpdateFlag] = useState(false);

  useEffect(() => {
    async function getData() {
      const result = await chrome.storage.local.get({ navigationData: [] });
      const uid = await initializeUserId();
      const upflag = await chrome.storage.local.get("sm-update-flag");
      if (upflag["sm-update-flag"]) {
        console.log("upflag use effect", upflag["sm-update-flag"]);
        setUpdateFlag(true);
      }
      setData(result);
      setUserId(uid);
      console.log(result);
      console.log("UserID in popup:", uid);
    }
    getData();
    // eslint-disable-next-line
  }, []);
  console.log("upflag", updateFlag);
  useEffect(() => {
    if (head) {
      const extracted = extractUrlFromHead(head);
      setParsed(extracted);
    }
  }, [head]);

  const extractDomainName = (url) => {
    // eslint-disable-next-line
    const match = url.match(/https?:\/\/(www\.)?([^\.]+)/);
    return match ? match[2] : null;
  };
  const handleShowUpdate = async () => {
    await chrome.storage.local.set({ "sm-update-flag": true });
    setUpdateFlag(false);
  };

  const clearAllHistory = async () => {
    try {
      setHistLoader(true);
      await chrome.storage.local.set({ navigationData: [] });
      console.log("History cleared successfully.");
      setHistLoader(false);
    } catch (error) {
      console.error("Error clearing history:", error);
      setHistLoader(false);
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
    setLoader("spinner-border spinner-border-sm mx-2");
    setHead("");
    setParsed({ summary: "", url: null });
    setDisable(true);
    setNoti("processing data...");
    setDocs([]);
    const dataa = data.navigationData;
    // const dataa = hist;
    // console.log(dataa, dataa.length);
    if (dataa && dataa.length > 0) {
      setNoti("Uploading your History...");
      console.log("inside handlesearch", userId);
      try {
        const upload = await fetch(`${host}/save-data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: dataa, userId: userId + "h" }),
        });
        const resp = await upload.json();
        console.log("response", resp);
        if (!resp.success) {
          setNoti("Error uploading data, please try again");
          setLoader("");
          setDisable(false);
          return;
        }
        try {
          setNoti("Surfing through your History...");
          const response = await fetch(`${host}/search`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: userId,
              data: dataa,
              query: query,
              flag: "history",
            }),
          });
          const data = await response.json();
          console.log("response", data);
          console.log("docs", data.docs);
          if (data.docs.length === 0) {
            setNoti("No results found for this query");
            setLoader("");
            setDisable(false);
            return;
          }
          setDocs(data.docs);
          setHead(data.result);
          // setResults({ url: data.format.url, date: data.format.date });
          setNoti("");
          setLoader("");
          setDisable(false);
        } catch (err) {
          setNoti("there is a problem generating response");
          setLoader("");
          setDisable(false);
        }
      } catch (error) {
        setNoti("there is a problem uploading data");
        setLoader("");
        setDisable(false);
      }
    } else {
      setLoader("");
      setNoti("There is no data in History");
      setDisable(false);
    }
  };

  const handleTab = () => {
    setHistoryTab(false);
    setDocs([]);
    setHead("");
    setParsed({ summary: "", url: null });
    setNoti("");
    setQuery("");
  };

  const handleClearAllHistory = async () => {
    await clearAllHistory();
    setDocs([]);
    setHead("");
    setParsed({ summary: "", url: null });
    setNoti("History Cleared Successfully");
    setQuery("");
    setData("");
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
    <div
      className="container p-4"
      style={{ width: "500px", marginTop: "70px" }}
    >
      {historyTab ? (
        <div>
          <div class="mb-3">
            <div className="d-flex">
              <label
                for="exampleInput"
                class="form-label text-muted flex-grow-1"
                style={{ fontSize: "14px" }}
              >
                Search Your <span className="text-primary">History</span>
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
              class="form-control"
              id="exampleInput"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search History"
              aria-describedby="textHelp"
            />
            <div id="textHelp" class="form-text">
              Type Keywords for better results
            </div>
          </div>
          <button
            type="submit"
            class="btn btn-warning btn-sm"
            style={{ borderRadius: "10px" }}
            disabled={disable || query === ""}
            onClick={handleSearch}
          >
            Search
            <span className={`${loader} ms-2`}></span>
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
        <Bookmarks
          setDocs={setDocs}
          setHead={setHead}
          setHistoryTab={setHistoryTab}
          host={host}
          setNoti={setNoti}
          setParsed={setParsed}
          userId={userId}
        />
      )}
      <p className="m-2" style={{ fontSize: "12px" }}>
        {noti}
      </p>
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
