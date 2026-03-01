import { useContext, useEffect, useState } from "react";
import { userContext } from "../context/userContext";
// import { bmdata } from "./check_data";

const Bookmarks = ({ host }) => {
  const { state, setState, searchStream } = useContext(userContext);
  const { userId } = state;
  const [ques, setQues] = useState("");
  const [loader, setLoader] = useState("");
  const [disable, setDisable] = useState(false);
  const [bookmark, setBookmarks] = useState([]);

  useEffect(() => {
    async function getData() {
      const result = await fetchBookmarks();
      console.log("bookmarks", result);
      setBookmarks(result);
    }
    getData();
    // eslint-disable-next-line
  }, []);

  // const fetchBookmarks = async () => {
  //   const all = [];
  //   chrome.bookmarks.getTree((nodes) => {
  //     const traverse = (nodeList) => {
  //       for (const node of nodeList) {
  //         if (node.url && node.url.startsWith("http")) {
  //           all.push({
  //             url: node.url,
  //             content: node.title, // or you can fetch page later
  //           });
  //         }
  //         if (node.children) traverse(node.children);
  //       }
  //     };

  //     traverse(nodes);
  //     // setBookmarks(all);
  //   });
  //   return all;
  // };
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

  const handleSearchbm = async (e) => {
    e.preventDefault();
    setLoader("spinner-border spinner-border-sm mx-2");
    setDisable(true);
    setState({
      noti: "processing data...",
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
    });
    const dataa = bookmark;
    console.log(dataa);
    // const dataa = bmdata;
    if (dataa && dataa.length > 0) {
      setState({ noti: "Uploading Your Bookmarks..." });
      try {
        const upload = await fetch(`${host}/save-data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: dataa,
            userId: `${userId}:b`,
            flag: "bookmark",
          }),
        });
        const resp = await upload.json();
        if (!resp.success) {
          setState({ noti: "Error uploading data, please try again" });
          setLoader("");
          setDisable(false);
          return;
        }
        try {
          await searchStream({
            host,
            query: ques,
            userId,
            flag: "bookmark",
          });
          setLoader("");
          setDisable(false);
        } catch (err) {
          setState({ noti: "there is a problem generating response" });
          setLoader("");
          setDisable(false);
        }
      } catch (error) {
        setState({ noti: "there is a problem uploading data" });
        setLoader("");
        setDisable(false);
      }
    } else {
      setLoader("");
      setState({ noti: "There is no data in History" });
      setDisable(false);
    }
  };

  const handleTabBM = () => {
    setState({
      historyTab: true,
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
      noti: "",
    });
    setQues("");
  };

  return (
    <div>
      <div class="mb-3">
        <div className="d-flex">
          <label
            for="exampleInput"
            class="form-label text-muted flex-grow-1"
            style={{ fontSize: "14px" }}
          >
            Search Your <span className="text-danger">Bookmarks</span>
          </label>
          <p
            className="text-primary"
            style={{ fontSize: "14px", cursor: "pointer" }}
            onClick={handleTabBM}
          >
            History
          </p>
        </div>
        <input
          type="text"
          class="form-control"
          id="exampleInput"
          value={ques}
          onChange={(e) => setQues(e.target.value)}
          placeholder="Search Bookmarks"
          aria-describedby="textHelp"
          style={{ fontSize: "14px" }}
        />
        <div id="textHelp" class="form-text">
          Type Keywords for better results
        </div>
      </div>
      <button
        type="submit"
        class="btn btn-warning btn-sm"
        style={{ borderRadius: "10px" }}
        disabled={disable || ques === ""}
        onClick={handleSearchbm}
      >
        Search
        <span className={`${loader} ms-2`}></span>
      </button>
    </div>
  );
};

export default Bookmarks;
