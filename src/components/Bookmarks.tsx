import { useEffect } from "react";
import { useUserContext } from "../context/userContext";
import SearchComposer from "./SearchComposer";
import { BookmarkFolderPin } from "./BookmarkFolderPicker";

interface BookmarksProps {
  host: string;
}

const Bookmarks = ({ host }: BookmarksProps) => {
  const { state, setState, searchStream, flushBookmarks } = useUserContext();
  const {
    userId,
    query,
    selectedBookmarkFolder,
    loading,
    disable,
    searchMode,
    fastStrictness,
    fastMaxResults,
  } = state;

  useEffect(() => {
    if (!host || !userId) return;
    const prepareBookmarks = async () => {
      try {
        await flushBookmarks(host, "dropdown-open");
      } catch {
        // A later search or background sync will retry.
      }
    };
    prepareBookmarks();
  }, [flushBookmarks, host, userId]);

  const handleSearch = async () => {
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
        mode: searchMode,
        fastStrictness,
        maxResults: fastMaxResults,
      });
    } catch {
      setState({ noti: "There is a problem with bookmark search" });
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
