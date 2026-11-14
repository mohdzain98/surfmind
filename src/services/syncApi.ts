import type {
  ApiPayload,
  BrowserIdentity,
  LinkedDevice,
  SyncCodeResult,
  SyncPageCounts,
  SyncStatus,
} from "../types";

const getResponseData = (payload: ApiPayload | null | undefined): ApiPayload =>
  payload?.data || payload || {};
const DEFAULT_HISTORY_CAP = 100;
const DEFAULT_BOOKMARK_CAP = 250;

const getErrorMessage = (
  payload: ApiPayload | null | undefined,
  fallback: string
): string => {
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  if (typeof detail?.message === "string") return detail.message;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return detail[0].msg;
  }
  if (typeof payload?.message === "string") return payload.message;
  return fallback;
};

const requestJson = async (
  url: string,
  options: RequestInit,
  fallbackMessage: string
): Promise<ApiPayload> => {
  const response = await fetch(url, options);
  let payload: ApiPayload | null = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, fallbackMessage));
  }
  return getResponseData(payload);
};

export const createBrowserIdentity = (
  browserUuid: string
): BrowserIdentity => ({
  browser_uuid: browserUuid,
});

export const normalizeSyncCode = (value: unknown): string =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

export const formatCountdown = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const normalizeSyncStatus = (
  payload: ApiPayload | null | undefined
): SyncStatus => {
  const data = getResponseData(payload);
  const browserCount = Number(
    data.browser_count ?? data.linked_browser_count ?? data.browserCount ?? 1
  );
  const isLinked = Boolean(
    data.is_linked ?? data.is_synced ?? data.linked ?? browserCount > 1
  );
  return {
    isLinked,
    browserCount: Number.isFinite(browserCount) ? browserCount : 1,
    syncAccountId: data.sync_account_id || data.syncAccountId || "",
    tier: data.tier || "free",
  };
};

export const generateSyncCode = async (
  host: string,
  browserUuid: string,
  deviceName?: string
): Promise<SyncCodeResult> => {
  const data = await requestJson(
    `${host}/sync/generate-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBrowserIdentity(browserUuid),
        ...(deviceName ? { device_name: deviceName } : {}),
      }),
    },
    "Could not generate a sync code"
  );
  const code = normalizeSyncCode(data.code || data.sync_code);
  if (!code) throw new Error("The server did not return a sync code");

  const parsedExpiry = Date.parse(data.expires_at || data.expiresAt || "");
  const expiresInSeconds = Number(
    data.expires_in_seconds || data.expires_in || data.expiresIn || 600
  );
  const expiresAt = Number.isNaN(parsedExpiry)
    ? Date.now() + expiresInSeconds * 1000
    : parsedExpiry;
  return { code, expiresAt, status: normalizeSyncStatus(data) };
};

export const redeemSyncCode = async (
  host: string,
  browserUuid: string,
  code: string,
  deviceName?: string
): Promise<SyncStatus> => {
  const data = await requestJson(
    `${host}/sync/redeem-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBrowserIdentity(browserUuid),
        code: normalizeSyncCode(code),
        ...(deviceName ? { device_name: deviceName } : {}),
      }),
    },
    "Could not redeem this sync code"
  );
  return { ...normalizeSyncStatus(data), isLinked: true };
};

const normalizeDevice = (device: ApiPayload = {}): LinkedDevice => {
  const browserUuid = device.browser_uuid || device.browserUuid || "";
  return {
    browserUuid,
    deviceName:
      device.device_name ||
      device.deviceName ||
      `Linked browser · ${browserUuid.slice(-4)}`,
    linkedAt: device.linked_at || device.linkedAt || null,
    lastSyncedAt: device.last_synced_at || device.lastSyncedAt || null,
    isCurrent: Boolean(device.is_current ?? device.isCurrent),
  };
};

export const getLinkedDevices = async (
  host: string,
  browserUuid: string
): Promise<LinkedDevice[]> => {
  const data = await requestJson(
    `${host}/sync/devices`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBrowserIdentity(browserUuid)),
    },
    "Could not load linked browsers"
  );
  const devices: ApiPayload[] = Array.isArray(data.devices) ? data.devices : [];
  return devices.map((device) => normalizeDevice(device));
};

export const renameLinkedDevice = async (
  host: string,
  browserUuid: string,
  targetBrowserUuid: string,
  deviceName: string
): Promise<LinkedDevice> => {
  const data = await requestJson(
    `${host}/sync/devices/rename`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browser_uuid: browserUuid,
        target_browser_uuid: targetBrowserUuid,
        device_name: deviceName,
      }),
    },
    "Could not rename this browser"
  );
  return normalizeDevice(data.device || data);
};

export const unlinkLinkedDevice = async (
  host: string,
  browserUuid: string,
  targetBrowserUuid: string
): Promise<boolean> => {
  await requestJson(
    `${host}/sync/devices/unlink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browser_uuid: browserUuid,
        target_browser_uuid: targetBrowserUuid,
      }),
    },
    "Could not unlink this browser"
  );
  return true;
};

export const unlinkBrowser = async (
  host: string,
  browserUuid: string
): Promise<SyncStatus> => {
  const data = await requestJson(
    `${host}/sync/unlink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBrowserIdentity(browserUuid)),
    },
    "Could not unlink this browser"
  );
  return { ...normalizeSyncStatus(data), isLinked: false, browserCount: 1 };
};

export const getSyncStatus = async (
  host: string,
  browserUuid: string
): Promise<SyncStatus | null> => {
  const response = await fetch(`${host}/sync/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBrowserIdentity(browserUuid)),
  });
  if (response.status === 404 || response.status === 405) return null;

  let payload: ApiPayload | null = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Could not load sync status"));
  }
  return normalizeSyncStatus(payload);
};

export const getSyncPageCounts = async (
  host: string,
  browserUuid: string
): Promise<SyncPageCounts> => {
  const data = await requestJson(
    `${host}/sync/page-counts`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBrowserIdentity(browserUuid)),
    },
    "Could not compare synced data"
  );

  const history = Number(data.history_count ?? data.historyCount ?? 0);
  const bookmarks = Number(data.bookmark_count ?? data.bookmarkCount ?? 0);
  const historyTotal = Number(
    data.history_total ?? data.historyTotal ?? history
  );
  const bookmarkTotal = Number(
    data.bookmark_total ?? data.bookmarkTotal ?? bookmarks
  );
  const historyCap = Number(
    data.history_cap ?? data.historyCap ?? DEFAULT_HISTORY_CAP
  );
  const bookmarkCap = Number(
    data.bookmark_cap ?? data.bookmarkCap ?? DEFAULT_BOOKMARK_CAP
  );

  return {
    history: Number.isFinite(history) ? history : 0,
    bookmarks: Number.isFinite(bookmarks) ? bookmarks : 0,
    totals: {
      history: Number.isFinite(historyTotal) ? historyTotal : history,
      bookmarks: Number.isFinite(bookmarkTotal) ? bookmarkTotal : bookmarks,
    },
    caps: {
      history: Number.isFinite(historyCap) ? historyCap : DEFAULT_HISTORY_CAP,
      bookmarks: Number.isFinite(bookmarkCap)
        ? bookmarkCap
        : DEFAULT_BOOKMARK_CAP,
    },
  };
};
