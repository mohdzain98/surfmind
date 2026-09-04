const getResponseData = (payload) => payload?.data || payload || {};

const getErrorMessage = (payload, fallback) => {
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  if (typeof detail?.message === "string") return detail.message;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return detail[0].msg;
  }
  if (typeof payload?.message === "string") return payload.message;
  return fallback;
};

const requestJson = async (url, options, fallbackMessage) => {
  const response = await fetch(url, options);
  let payload = null;
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

export const createBrowserIdentity = (browserUuid) => ({
  browser_uuid: browserUuid,
});

export const normalizeSyncCode = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

export const formatCountdown = (remainingMs) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const normalizeSyncStatus = (payload) => {
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

export const generateSyncCode = async (host, browserUuid) => {
  const data = await requestJson(
    `${host}/sync/generate-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBrowserIdentity(browserUuid)),
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

export const redeemSyncCode = async (host, browserUuid, code) => {
  const data = await requestJson(
    `${host}/sync/redeem-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBrowserIdentity(browserUuid),
        code: normalizeSyncCode(code),
      }),
    },
    "Could not redeem this sync code"
  );
  return { ...normalizeSyncStatus(data), isLinked: true };
};

export const unlinkBrowser = async (host, browserUuid) => {
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

export const getSyncStatus = async (host, browserUuid) => {
  const response = await fetch(`${host}/sync/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBrowserIdentity(browserUuid)),
  });
  if (response.status === 404 || response.status === 405) return null;

  let payload = null;
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
