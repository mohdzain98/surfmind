import type { ApiPayload } from "../types";
import { initializeUserId } from "../components/UserId";

export const PRIVACY_POLICY_URL = "https://surfmind.docschat.in/privacy";
export const TERMS_URL = "https://surfmind.docschat.in/terms";
export const CONTACT_URL = "https://surfmind.docschat.in/contact";

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
  browserUuid: string,
  path: string,
  fallbackMessage: string
): Promise<ApiPayload | null> => {
  const query = new URLSearchParams({ user_id: browserUuid });
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

export const deleteHistoryData = (host: string, browserUuid: string) =>
  deleteRemoteData(
    host,
    browserUuid,
    "/user/history",
    "Could not clear your history"
  );

export const deleteAllData = (host: string, browserUuid: string) =>
  deleteRemoteData(
    host,
    browserUuid,
    "/user/data",
    "Could not clear your SurfMind data"
  );

export const clearHistoryLocal = () =>
  chrome.storage.local.remove(["navigationData", "lastSyncTime"]);

export const clearAllDataLocal = async (): Promise<string> => {
  await chrome.storage.local.clear();
  return initializeUserId();
};
