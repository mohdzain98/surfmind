import { useContext, useEffect, useState } from "react";
import { Search, GitMerge } from "lucide-react";
import { userContext } from "../context/userContext";

const Combined = ({ host }) => {
  const { state, setState, searchStream, syncCombined } =
    useContext(userContext);
  const { userId, data } = state;
  const [ques, setQues] = useState("");
  const [loader, setLoader] = useState("");
  const [disable, setDisable] = useState(false);
  const [bookmark, setBookmarks] = useState([]);

  useEffect(() => {
    async function getData() {
      const result = await fetchBookmarks();
      setBookmarks(result);
      if (userId && host) {
        const historyData = data.navigationData || [];
        await syncCombined(host, historyData, result, userId);
      }
    }
    getData();
    // eslint-disable-next-line
  }, [userId]);

  const fetchBookmarks = () => {
    return new Promise((resolve) => {
      const all = [];

      const normalizeUrl = (url) => {
        try {
          const u = new URL(url);
          u.search = "";
          u.hash = "";
          return u.toString().replace(/\/$/, "");
        } catch {
          return url;
        }
      };

      chrome.bookmarks.getTree((nodes) => {
        const traverse = (nodeList, folderPath = []) => {
          for (const node of nodeList) {
            const currentPath = node.title
              ? [...folderPath, node.title]
              : folderPath;

            if (node.url && /^https?:\/\//.test(node.url)) {
              const normalized = normalizeUrl(node.url);
              const domain = new URL(normalized).hostname;

              all.push({
                url: normalized,
                title: node.title,
                content: node.title,
                folder: folderPath.join(" / "),
                domain,
                date: node.dateAdded,
              });
            }

            if (node.children) {
              traverse(node.children, currentPath);
            }
          }
        };

        traverse(nodes);
        resolve(all);
      });
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if ((data.navigationData || []).length === 0 && bookmark.length === 0) {
      setState({ noti: "No history or bookmarks found" });
      return;
    }

    setLoader("spinner-border spinner-border-sm mx-2");
    setDisable(true);
    setState({
      noti: "Retrieving sources...",
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
    });

    try {
      await searchStream({ host, query: ques, userId, flag: "combined" });
    } catch {
      setState({ noti: "There is a problem with combined search" });
    } finally {
      setLoader("");
      setDisable(false);
    }
  };

  return (
    <div>
      <div className="mb-3">
        <label
          htmlFor="combinedInput"
          className="form-label text-muted d-flex align-items-center gap-1"
          style={{ fontSize: "14px" }}
        >
          <GitMerge size={14} className="text-success" />
          Search <span className="text-success">History + Bookmarks</span>
        </label>
        <input
          type="text"
          className="form-control"
          id="combinedInput"
          value={ques}
          onChange={(e) => setQues(e.target.value)}
          placeholder="Search across history and bookmarks"
          aria-describedby="combinedHelp"
          style={{ fontSize: "14px" }}
        />
        <div
          id="combinedHelp"
          className="form-text"
          style={{ fontSize: "12px" }}
        >
          Searches last 50 history items + half your bookmarks (newest first)
        </div>
      </div>
      <button
        type="submit"
        className="btn btn-success btn-sm d-inline-flex align-items-center gap-1"
        style={{ borderRadius: "10px" }}
        disabled={disable || ques === ""}
        onClick={handleSearch}
      >
        <Search size={13} />
        Search
        {loader && (
          <span className="spinner-border spinner-border-sm ms-1"></span>
        )}
      </button>
    </div>
  );
};

export default Combined;
