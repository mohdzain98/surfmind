import type { NavigationEntry, SearchFlag } from "./search";
import type { UpdateNotice } from "../services/updateVersion";

export type ActiveTab = SearchFlag | "settings";

/** One step reported by the streaming search endpoint. */
export interface SearchStep {
  step: string;
  title: string;
  content: unknown;
}

export interface SearchThoughtEntry {
  id: string;
  message: string;
  step: SearchStep | null;
}

/** Source document returned by search; the API shape varies per mode. */
export type SearchDoc = Record<string, any>;

export interface ParsedSummary {
  summary: string;
  url: string | null;
}

export interface UserStateShape {
  activeTab: ActiveTab;
  query: string;
  head: string;
  parsed: ParsedSummary;
  loading: boolean;
  histLoader: boolean;
  disable: boolean;
  noti: string;
  data: { navigationData: NavigationEntry[] };
  docs: SearchDoc[];
  userId: string;
  updateFlag: boolean;
  updateNotice: UpdateNotice;
  updateReady: boolean;
  updateVersion: string;
  syncing: boolean;
  format: Record<string, any> | null;
  step: SearchStep | null;
  thoughts: SearchThoughtEntry[];
  finalReceived: boolean;
  selectedBookmarkFolder: string | null;
}

export type UserAction = {
  type: "SET_STATE";
  payload: Partial<UserStateShape>;
};

export type PairingAction = "paired" | "unlinked";

export interface SearchStreamParams {
  host: string;
  query: string;
  userId: string;
  flag: SearchFlag;
  folder?: string | null;
}

export interface UserContextValue {
  state: UserStateShape;
  setState: (payload: Partial<UserStateShape>) => void;
  initializePopup: (host?: string) => Promise<void>;
  flushBookmarks: (host: string, reason?: string) => Promise<unknown>;
  searchStream: (params: SearchStreamParams) => Promise<void>;
  refreshAfterPairing: (host: string, action: PairingAction) => Promise<void>;
}
