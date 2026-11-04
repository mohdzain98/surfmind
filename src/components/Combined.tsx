import { useEffect, useState } from "react";
import { useUserContext } from "../context/userContext";
import SearchComposer from "./SearchComposer";

interface CombinedProps {
  host: string;
}

const Combined = ({ host }: CombinedProps) => {
  const { state, setState, searchStream, flushBookmarks } = useUserContext();
  const { userId, query } = state;
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
      await searchStream({ host, query, userId, flag: "combined" });
    } catch {
      setState({ noti: "There is a problem with combined search" });
    } finally {
      setLoading(false);
      setDisable(false);
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
