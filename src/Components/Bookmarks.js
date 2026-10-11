import { useContext, useEffect, useState } from "react";
import { userContext } from "../context/userContext";
import SearchComposer from "./SearchComposer";
import { BookmarkFolderPin } from "./BookmarkFolderPicker";

const Bookmarks = ({ host }) => {
  const { state, setState, searchStream, flushBookmarks } =
    useContext(userContext);
  const { userId, query, selectedBookmarkFolder } = state;
  const [loading, setLoading] = useState(false);
  const [disable, setDisable] = useState(false);

  useEffect(() => {
    if (!host || !userId) return;
    flushBookmarks(host, "dropdown-open").catch(() => {});
  }, [flushBookmarks, host, userId]);

  const handleSearch = async () => {
    setLoading(true);
    setDisable(true);
    setState({
      noti: "Retrieving sources...",
      docs: [],
      head: "",
      parsed: { summary: "", url: null },
    });

    try {
      await searchStream({
        host,
        query,
        userId,
        flag: "bookmark",
        folder: selectedBookmarkFolder,
      });
    } catch {
      setState({ noti: "There is a problem with bookmark search" });
    } finally {
      setLoading(false);
      setDisable(false);
    }
  };

  return (
    <div className="bookmark-search-controls">
      <SearchComposer
        id="bookmark-search"
        value={query}
        onChange={(value) => setState({ query: value })}
        onSubmit={handleSearch}
        placeholder="Ask SurfMind about your bookmarks…"
        mode="bookmark"
        disabled={disable}
        loading={loading}
      />
      <BookmarkFolderPin
        selectedFolder={selectedBookmarkFolder}
        onClear={() => setState({ selectedBookmarkFolder: null })}
        disabled={disable}
      />
    </div>
  );
};

export default Bookmarks;
