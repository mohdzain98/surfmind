import type { FastMaxResults, FastStrictness, SearchMode } from "../types";

export const SEARCH_MODE_KEY = "searchMode";
export const FAST_STRICTNESS_KEY = "fastStrictness";
export const FAST_MAX_RESULTS_KEY = "fastMaxResults";

export const DEFAULT_SEARCH_MODE: SearchMode = "standard";
export const DEFAULT_FAST_STRICTNESS: FastStrictness = "balanced";
export const DEFAULT_FAST_MAX_RESULTS: FastMaxResults = 5;

const SEARCH_MODES = new Set<SearchMode>(["fast", "standard"]);
const FAST_STRICTNESS_OPTIONS = new Set<FastStrictness>([
  "broad",
  "balanced",
  "precise",
]);
const FAST_MAX_RESULTS_OPTIONS = new Set<number>([3, 5, 8]);

export interface FastModePreferences {
  searchMode: SearchMode;
  fastStrictness: FastStrictness;
  fastMaxResults: FastMaxResults;
}

export const normalizeSearchMode = (value: unknown): SearchMode =>
  SEARCH_MODES.has(value as SearchMode)
    ? (value as SearchMode)
    : DEFAULT_SEARCH_MODE;

export const normalizeFastStrictness = (value: unknown): FastStrictness =>
  FAST_STRICTNESS_OPTIONS.has(value as FastStrictness)
    ? (value as FastStrictness)
    : DEFAULT_FAST_STRICTNESS;

export const normalizeFastMaxResults = (value: unknown): FastMaxResults => {
  const numericValue = Number(value);
  return FAST_MAX_RESULTS_OPTIONS.has(numericValue)
    ? (numericValue as FastMaxResults)
    : DEFAULT_FAST_MAX_RESULTS;
};

export const readFastModePreferences =
  async (): Promise<FastModePreferences> => {
    const stored = await chrome.storage.local.get({
      [SEARCH_MODE_KEY]: DEFAULT_SEARCH_MODE,
      [FAST_STRICTNESS_KEY]: DEFAULT_FAST_STRICTNESS,
      [FAST_MAX_RESULTS_KEY]: DEFAULT_FAST_MAX_RESULTS,
    });

    return {
      searchMode: normalizeSearchMode(stored[SEARCH_MODE_KEY]),
      fastStrictness: normalizeFastStrictness(stored[FAST_STRICTNESS_KEY]),
      fastMaxResults: normalizeFastMaxResults(stored[FAST_MAX_RESULTS_KEY]),
    };
  };

export const persistFastModePreferences = async (
  preferences: Partial<FastModePreferences>
): Promise<void> => {
  const update: Record<string, SearchMode | FastStrictness | FastMaxResults> =
    {};

  if (preferences.searchMode !== undefined) {
    update[SEARCH_MODE_KEY] = normalizeSearchMode(preferences.searchMode);
  }
  if (preferences.fastStrictness !== undefined) {
    update[FAST_STRICTNESS_KEY] = normalizeFastStrictness(
      preferences.fastStrictness
    );
  }
  if (preferences.fastMaxResults !== undefined) {
    update[FAST_MAX_RESULTS_KEY] = normalizeFastMaxResults(
      preferences.fastMaxResults
    );
  }

  if (Object.keys(update).length > 0) {
    await chrome.storage.local.set(update);
  }
};
