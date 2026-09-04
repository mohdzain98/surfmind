const normalizeSources = (sources) => {
  if (Array.isArray(sources)) return sources;
  if (typeof sources !== "string") return [];

  try {
    const parsed = JSON.parse(sources);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const normalizeRecentSearch = (search, index = 0) => ({
  id: String(search?.id || `recent-search-${index}`),
  query: String(search?.query || "Untitled search"),
  mode: String(search?.mode || search?.flag || "history"),
  answer: String(search?.answer || search?.result || ""),
  sources: normalizeSources(search?.sources || search?.docs),
  createdAt: search?.created_at || search?.createdAt || "",
});

export const fetchRecentSearches = async (
  host,
  browserUuid,
  { limit = 5, signal } = {}
) => {
  const response = await fetch(`${host}/recent-searches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ browser_uuid: browserUuid, limit }),
    signal,
  });
  if (!response.ok) throw new Error("Could not load recent searches");

  const payload = await response.json();
  const data = payload?.data || payload || {};
  const searches = Array.isArray(data.searches) ? data.searches : [];
  return searches.slice(0, limit).map(normalizeRecentSearch);
};
