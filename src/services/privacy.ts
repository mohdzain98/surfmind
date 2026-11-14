import type { ApiPayload, NavigationEntry } from "../types";
import { initializeUserId } from "../components/UserId";

export const PRIVACY_POLICY_URL = "https://surfmind.docschat.in/privacy";
export const TERMS_URL = "https://surfmind.docschat.in/terms";
export const CONTACT_URL = "https://surfmind.docschat.in/contact";

export type HistoryRange = "1h" | "24h" | "7d" | "30d" | "all";

export const DEFAULT_HISTORY_RANGE: HistoryRange = "24h";

export const HISTORY_RANGE_OPTIONS: ReadonlyArray<{
  value: HistoryRange;
  label: string;
}> = [
  { value: "1h", label: "Last 1 hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 1 month" },
  { value: "all", label: "All time" },
];

const HISTORY_RANGE_MS: Record<HistoryRange, number | null> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export const resolveHistoryRange = (value: unknown): HistoryRange =>
  typeof value === "string" && value in HISTORY_RANGE_MS
    ? (value as HistoryRange)
    : DEFAULT_HISTORY_RANGE;

const getErrorMessage = (
  payload: ApiPayload | null | undefined,
  fallback: string
): string => {
  if (typeof payload?.detail === "string") return payload.detail;
  if (typeof payload?.message === "string") return payload.message;
  return fallback;
};

const deleteRemoteData = async (
  host: string,
  path: string,
  queryValues: Record<string, string>,
  fallbackMessage: string
): Promise<ApiPayload | null> => {
  const query = new URLSearchParams(queryValues);
  const response = await fetch(`${host}${path}?${query}`, { method: "DELETE" });
  let payload: ApiPayload | null = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, fallbackMessage));
  }
  return payload;
};

export const deleteHistoryData = (
  host: string,
  browserUuid: string,
  range: HistoryRange = DEFAULT_HISTORY_RANGE
) =>
  deleteRemoteData(
    host,
    "/user/history",
    { browser_uuid: browserUuid, range },
    "Could not clear your history"
  );

export const deleteAllData = (host: string, browserUuid: string) =>
  deleteRemoteData(
    host,
    "/user/data",
    { user_id: browserUuid },
    "Could not clear your SurfMind data"
  );

const getEntryTimestamp = (entry: NavigationEntry): number | null => {
  if (Number.isFinite(entry.capturedAt)) return Number(entry.capturedAt);
  for (const value of [entry.visited_at, entry.date]) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
};

export const clearHistoryLocal = async (
  range: HistoryRange = DEFAULT_HISTORY_RANGE,
  now = Date.now()
): Promise<NavigationEntry[]> => {
  const duration = HISTORY_RANGE_MS[resolveHistoryRange(range)];
  const stored = await chrome.storage.local.get<{
    navigationData: NavigationEntry[];
  }>({ navigationData: [] });
  const remaining =
    duration === null
      ? []
      : stored.navigationData.filter((entry) => {
          const timestamp = getEntryTimestamp(entry);
          return timestamp === null || timestamp < now - duration;
        });
  await chrome.storage.local.set({ navigationData: remaining });
  await chrome.storage.local.remove("lastSyncTime");
  return remaining;
};

export const clearAllDataLocal = async (): Promise<string> => {
  await chrome.storage.local.clear();
  return initializeUserId();
};
