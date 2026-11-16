import { useEffect } from "react";
import { useUserContext } from "../context/userContext";
import SearchComposer from "./SearchComposer";

interface CombinedProps {
  host: string;
}

const Combined = ({ host }: CombinedProps) => {
  const { state, setState, searchStream, flushBookmarks } = useUserContext();
  const {
    userId,
    query,
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
        flag: "combined",
        mode: searchMode,
        fastStrictness,
        maxResults: fastMaxResults,
      });
    } catch {
      setState({ noti: "There is a problem with combined search" });
    }
  };

  return (
    <SearchComposer
      id="combined-search"
      value={query}
      onChange={(value) => setState({ query: value })}
      onSubmit={handleSearch}
      placeholder="Ask across history and bookmarks…"
      mode="combined"
      disabled={disable}
      loading={loading}
    />
  );
};

export default Combined;
