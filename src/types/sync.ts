export interface BrowserIdentity {
  browser_uuid: string;
}

/** Loosely-shaped server payload; the API mixes snake_case and camelCase. */
export type ApiPayload = Record<string, any>;

export interface SyncStatus {
  isLinked: boolean;
  browserCount: number;
  syncAccountId: string;
  tier: string;
}

export interface SyncCodeResult {
  code: string;
  expiresAt: number;
  status: SyncStatus;
}

export interface LinkedDevice {
  browserUuid: string;
  deviceName: string;
  linkedAt: string | null;
  lastSyncedAt: string | null;
  isCurrent: boolean;
}

export interface ResourceCounts {
  history: number;
  bookmarks: number;
}

export interface SyncPageCounts extends ResourceCounts {
  totals: ResourceCounts;
  caps: ResourceCounts;
}

export interface LocalPageCounts extends ResourceCounts {
  dirty: { history: boolean; bookmarks: boolean };
}

/** Local counts; `dirty` is optional because callers may omit it. */
export type LocalCountsInput = ResourceCounts &
  Partial<Pick<LocalPageCounts, "dirty">>;

/** Remote counts; `totals` and `caps` are optional for older servers. */
export type RemoteCountsInput = ResourceCounts &
  Partial<Pick<SyncPageCounts, "totals" | "caps">>;

export type CoverageAction = "sync" | "refresh" | null;

export interface ResourceSyncCoverage {
  key: string;
  label: string;
  canSync: boolean;
  action: CoverageAction;
}

export interface PageSyncCoverage {
  history: ResourceSyncCoverage;
  bookmarks: ResourceSyncCoverage;
  canSync: boolean;
  action: CoverageAction;
  matches: boolean;
}

/** Sync status as persisted in chrome.storage; a solo browser has no account/tier. */
export type StoredSyncStatus = Partial<SyncStatus> &
  Pick<SyncStatus, "isLinked" | "browserCount">;

export type PageCountsStatus = "idle" | "checking" | "ready" | "error";

/** Page-count/coverage state shown in the header and Settings home. */
export interface PageCountsState {
  status: PageCountsStatus;
  local: LocalCountsInput;
  remote: RemoteCountsInput;
  coverage?: PageSyncCoverage;
  matches: boolean;
  error?: string;
}
