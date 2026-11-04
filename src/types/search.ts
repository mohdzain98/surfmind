export type SearchFlag = "history" | "bookmark" | "combined";

export interface SearchRequest {
  browser_uuid: string;
  query: string;
  flag: SearchFlag;
  folder?: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  mode: string;
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
  [key: string]: unknown;
}
