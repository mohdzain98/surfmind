import type { ApiPayload, RecentSearch } from "../types";
import type { SearchFlag, SearchMode } from "../types";
import {
  normalizeFastMaxResults,
  normalizeFastStrictness,
  normalizeSearchMode,
} from "./fastMode";

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

const SEARCH_FLAGS = new Set<SearchFlag>(["history", "bookmark", "combined"]);

const normalizeFlag = (search: ApiPayload): SearchFlag => {
  const value = search.flag || search.corpus || search.source_type;
  if (SEARCH_FLAGS.has(value as SearchFlag)) return value as SearchFlag;
  if (search.mode === "bookmarks") return "bookmark";
  if (SEARCH_FLAGS.has(search.mode as SearchFlag)) {
    return search.mode as SearchFlag;
  }
  return "history";
};

const normalizeRecentSearchMode = (search: ApiPayload): SearchMode => {
  const value = search.search_mode || search.response_mode || search.mode;
  return value === "fast" ? "fast" : normalizeSearchMode(value);
};

export const normalizeRecentSearch = (
  search: ApiPayload | null | undefined,
  index = 0
): RecentSearch => {
  const value = search || {};
  return {
    id: String(value.id || `recent-search-${index}`),
    query: String(value.query || "Untitled search"),
    flag: normalizeFlag(value),
    searchMode: normalizeRecentSearchMode(value),
    fastStrictness: normalizeFastStrictness(
      value.fast_strictness || value.fastStrictness
    ),
    fastMaxResults: normalizeFastMaxResults(
      value.max_results || value.fastMaxResults
    ),
    folder: value.folder ? String(value.folder) : null,
    answer: String(value.answer || value.result || ""),
    sources: normalizeSources(value.sources || value.docs || value.results),
    createdAt: value.created_at || value.createdAt || "",
  };
};

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
