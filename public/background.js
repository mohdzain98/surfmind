importScripts(
  "pageEntries.js",
  "historySync.js",
  "structuredExtraction.js",
  "bookmarkSync.js",
);

const HISTORY_LIMIT = 100;
const SYNC_ALARM = "surfmind-history-sync";
const BOOKMARK_SYNC_ALARM = "surfmind-bookmark-sync";
const historySync = SurfMindHistorySync.createHistorySync({
  chromeApi: chrome,
  fetchImpl: (...args) => fetch(...args),
});
const bookmarkSync = SurfMindBookmarkSync.createBookmarkSync({
  chromeApi: chrome,
  fetchImpl: (...args) => fetch(...args),
});
let captureQueue = Promise.resolve();
const UPDATE_VERSION_KEY = "sm-last-seen-version";
const UPDATE_PREVIOUS_VERSION_KEY = "sm-update-previous-version";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => {
    console.error("Failed to configure the SurfMind side panel:", error);
  });

const initializeUserId = async () => {
  const result = await chrome.storage.local.get("userId");
  if (!result.userId) {
    const newUserId = crypto.randomUUID();
    await chrome.storage.local.set({ userId: newUserId });
    // console.log("Generated new userId (background):", newUserId);
    return newUserId;
  }
  return result.userId;
};

const saveDataLocally = async (data) => {
  try {
    const result = await chrome.storage.local.get({ navigationData: [] });
    const urlMap = new Map();
    const refreshedUrls = new Set(data.map((item) => item.url));

    for (const item of result.navigationData) {
      if (refreshedUrls.has(item.url)) continue;
      const entryKey = `${item.url}\u0000${JSON.stringify(item.heading_path || [])}`;
      urlMap.set(entryKey, item);
    }

    for (const item of data) {
      const entryKey = `${item.url}\u0000${JSON.stringify(item.heading_path)}`;
      urlMap.set(entryKey, item);
    }

    const updatedData = SurfMindPageEntries.selectRecentPages(
      Array.from(urlMap.values()),
      HISTORY_LIMIT,
    );

    await chrome.storage.local.set({ navigationData: updatedData });
    const resultOfSync = await historySync.maybeSync({ reason: "count" });
    if (!resultOfSync.success && resultOfSync.error) {
      console.warn("History sync deferred:", resultOfSync.error);
    }
  } catch (error) {
    console.error("Error saving data locally:", error);
  }
};

const queueCapturedData = (data) => {
  captureQueue = captureQueue.then(() => saveDataLocally(data));
};

const ensureSyncAlarm = async () => {
  const stored = await chrome.storage.local.get({
    syncTimeSafetyNetMin: SurfMindHistorySync.TIME_SAFETY_NET_MIN,
  });
  const { timeSafetyNetMin } = SurfMindHistorySync.resolveSyncConfig(stored);
  const periodInMinutes = Math.max(1, Math.min(60, timeSafetyNetMin));
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes });
};

const ensureBookmarkSyncAlarm = () => {
  chrome.alarms.create(BOOKMARK_SYNC_ALARM, {
    periodInMinutes: SurfMindBookmarkSync.SAFETY_NET_MIN,
  });
};

const markBookmarksDirty = () => {
  bookmarkSync.markDirty().catch((error) => {
    console.error("Failed to mark bookmarks dirty:", error);
  });
};

const getActiveTab = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Could not read active tab"));
        return;
      }
      resolve(tabs[0] || null);
    });
  });

const extractContentFromTab = (tabId) =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { action: "extractStructuredContent" },
      (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError || !response?.success) {
          reject(
            new Error(
              runtimeError?.message ||
                response?.error ||
                "Could not extract bookmark content",
            ),
          );
          return;
        }
        resolve(response.extraction);
      },
    );
  });

const captureCreatedBookmark = (bookmark) => {
  bookmarkSync
    .captureCreatedBookmark(bookmark, {
      getActiveTab,
      extractFromTab: extractContentFromTab,
    })
    .catch((error) => {
      console.warn("Live bookmark extraction unavailable:", error);
    });
};

chrome.runtime.onInstalled.addListener((details) => {
  const versionState =
    details.reason === "install"
      ? { [UPDATE_VERSION_KEY]: chrome.runtime.getManifest().version }
      : details.reason === "update" && details.previousVersion
        ? { [UPDATE_PREVIOUS_VERSION_KEY]: details.previousVersion }
        : null;
  if (versionState) {
    chrome.storage.local.set(versionState).catch((error) => {
      console.error("Failed to save the extension update version:", error);
    });
  }

  initializeUserId().catch((error) => {
    console.error("Failed to initialize user ID:", error);
  });
  ensureSyncAlarm().catch((error) => {
    console.error("Failed to schedule history sync:", error);
  });
  ensureBookmarkSyncAlarm();
  markBookmarksDirty();
});

chrome.runtime.onStartup.addListener(() => {
  ensureSyncAlarm().catch((error) => {
    console.error("Failed to schedule history sync:", error);
  });
  ensureBookmarkSyncAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) {
    historySync.maybeSync({ reason: "time" }).catch((error) => {
      console.error("Timed history sync failed:", error);
    });
  }
  if (alarm.name === BOOKMARK_SYNC_ALARM) {
    bookmarkSync.syncIfDirty({ reason: "time" }).catch((error) => {
      console.error("Timed bookmark sync failed:", error);
    });
  }
});

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  captureCreatedBookmark(bookmark);
});
chrome.bookmarks.onRemoved.addListener(markBookmarksDirty);
chrome.bookmarks.onChanged.addListener(markBookmarksDirty);
chrome.bookmarks.onMoved.addListener(markBookmarksDirty);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "maybeSyncBookmarks") {
    Promise.all([
      ensureBookmarkSyncAlarm(),
      bookmarkSync.syncIfDirty({
        reason: request.reason || "manual",
        host: request.host || "",
      }),
    ])
      .then(([, result]) => sendResponse(result))
      .catch((error) =>
        sendResponse({ success: false, synced: 0, error: error.message }),
      );
    return true;
  }

  if (request.action !== "maybeSyncHistory") return false;

  Promise.all([
    ensureSyncAlarm(),
    historySync.maybeSync({
      force: request.force === true,
      reason: request.reason || "manual",
      host: request.host || "",
    }),
  ])
    .then(([, result]) => sendResponse(result))
    .catch((error) =>
      sendResponse({ success: false, synced: 0, error: error.message }),
    );
  return true;
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;

  chrome.tabs.get(details.tabId, (tab) => {
    if (!tab || !tab.url || !tab.url.startsWith("http")) {
      return;
    }

    if (tab.url.startsWith("http")) {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "extractStructuredContent" },
        (response) => {
          if (chrome.runtime.lastError || !response?.success) {
            console.warn(
              "Structured extraction unavailable:",
              chrome.runtime.lastError?.message || response?.error,
            );
            return;
          }

          const capturedAt = Date.now();
          const data = SurfMindStructuredExtraction.createHistoryEntries({
            extraction: response.extraction,
            url: tab.url,
            capturedAt,
          });

          if (data.length > 0) queueCapturedData(data);
        },
      );
    }
  });
});
