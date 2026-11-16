export type SearchFlag = "history" | "bookmark" | "combined";
export type SearchMode = "fast" | "standard";
export type FastStrictness = "broad" | "balanced" | "precise";
export type FastMaxResults = 3 | 5 | 8;

export interface SearchRequest {
  browser_uuid: string;
  query: string;
  flag: SearchFlag;
  mode?: "fast";
  folder?: string;
  fast_strictness?: FastStrictness;
  max_results?: FastMaxResults;
}

export interface RecentSearch {
  id: string;
  query: string;
  flag: SearchFlag;
  searchMode: SearchMode;
  fastStrictness: FastStrictness;
  fastMaxResults: FastMaxResults;
  folder: string | null;
  answer: string;
  sources: Array<Record<string, any>>;
  createdAt: string;
}

export interface RatePromptState {
  successfulSearchCount: number;
  timesShown: number;
  lastShownAt: number | null;
  permanentlyDismissed: boolean;
}

/** Entry stored in chrome.storage.local under `navigationData`. */
export interface NavigationEntry {
  url?: string;
  synced?: boolean;
  flagged?: boolean;
  flag_reason?: "domain" | "keyword" | "query" | null;
  flag_layer?: 1 | 2 | 3 | null;
  local_query?: string;
  [key: string]: unknown;
}
