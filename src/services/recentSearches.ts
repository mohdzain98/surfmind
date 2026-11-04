import type { ApiPayload, RecentSearch } from "../types";

const normalizeSources = (sources: unknown): Array<Record<string, any>> => {
  if (Array.isArray(sources)) return sources;
  if (typeof sources !== "string") return [];

  try {
    const parsed = JSON.parse(sources);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const normalizeRecentSearch = (
  search: ApiPayload | null | undefined,
  index = 0
): RecentSearch => ({
  id: String(search?.id || `recent-search-${index}`),
  query: String(search?.query || "Untitled search"),
  mode: String(search?.mode || search?.flag || "history"),
  answer: String(search?.answer || search?.result || ""),
  sources: normalizeSources(search?.sources || search?.docs),
  createdAt: search?.created_at || search?.createdAt || "",
});

export const fetchRecentSearches = async (
  host: string,
  browserUuid: string,
  { limit = 5, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<RecentSearch[]> => {
  const response = await fetch(`${host}/recent-searches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ browser_uuid: browserUuid, limit }),
    signal,
  });
  if (!response.ok) throw new Error("Could not load recent searches");

  const payload = await response.json();
  const data = payload?.data || payload || {};
  const searches: ApiPayload[] = Array.isArray(data.searches)
    ? data.searches
    : [];
  return searches
    .slice(0, limit)
    .map((search, index) => normalizeRecentSearch(search, index));
};
