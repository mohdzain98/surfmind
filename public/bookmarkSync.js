(function attachBookmarkSync(globalScope) {
  const SAFETY_NET_MIN = 360;
  const EXTRACTED_CONTENT_KEY = "bookmarkExtractedContent";

  const normalizeUrl = (url) => {
    try {
      const normalized = new URL(url);
      normalized.search = "";
      normalized.hash = "";
      return normalized.toString().replace(/\/$/, "");
    } catch (error) {
      return url;
    }
  };

  const getStructuredExtraction = () =>
    globalScope.SurfMindStructuredExtraction ||
    (typeof require === "function" ? require("./structuredExtraction") : null);

  const sanitizeExtraction = (extraction) => {
    const sections = (extraction?.sections || [])
      .filter((section) => String(section?.text || "").trim())
      .map((section) => ({
        headingPath: Array.isArray(section.headingPath)
          ? section.headingPath.map(String)
          : [],
        level: Number.isFinite(section.level) ? section.level : 0,
        text: String(section.text).trim(),
      }));
    if (sections.length === 0) return null;
    return {
      title: String(extraction.title || ""),
      sections,
      extractionMethod: String(extraction.extractionMethod || "live-tab"),
    };
  };

  const flattenBookmarks = (nodes, extractedContent = {}) => {
    const bookmarks = [];

    const traverse = (nodeList, folderPath = []) => {
      for (const node of nodeList || []) {
        const currentPath = node.title
          ? [...folderPath, node.title]
          : folderPath;

        if (node.url && /^https?:\/\//.test(node.url)) {
          const url = normalizeUrl(node.url);
          let domain = "";
          try {
            domain = new URL(url).hostname;
          } catch (error) {
            domain = "";
          }

          const bookmark = {
            url,
            title: node.title || "",
            content: node.title || "",
            folder: folderPath.join(" / "),
            domain,
            date: node.dateAdded,
          };
          const extraction = sanitizeExtraction(extractedContent[url]);
          const structuredExtraction = getStructuredExtraction();
          const extractedEntries =
            extraction && structuredExtraction?.createBookmarkEntries
              ? structuredExtraction.createBookmarkEntries({
                  extraction,
                  bookmark,
                })
              : [];
          bookmarks.push(...(extractedEntries.length ? extractedEntries : [bookmark]));
        }

        if (node.children) traverse(node.children, currentPath);
      }
    };

    traverse(nodes);
    return bookmarks;
  };

  const createBookmarkSync = ({
    chromeApi,
    fetchImpl,
    now = () => Date.now(),
    createId = () => crypto.randomUUID(),
    logger = console,
  }) => {
    let syncInFlight = null;
    let markQueue = Promise.resolve();

    const getBookmarkTree = () =>
      new Promise((resolve, reject) => {
        chromeApi.bookmarks.getTree((nodes) => {
          const runtimeError = chromeApi.runtime?.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || "Could not read bookmarks"));
            return;
          }
          resolve(nodes);
        });
      });

    const getAllBookmarks = async () => {
      const [nodes, stored] = await Promise.all([
        getBookmarkTree(),
        chromeApi.storage.local.get({ [EXTRACTED_CONTENT_KEY]: {} }),
      ]);
      return flattenBookmarks(nodes, stored[EXTRACTED_CONTENT_KEY]);
    };

    const performSync = async ({ host = "" } = {}) => {
      await markQueue;
      const stored = await chromeApi.storage.local.get({
        bookmarksDirty: false,
        bookmarksDirtyVersion: 0,
        apiHost: "",
        userId: "",
      });

      if (!stored.bookmarksDirty) {
        return { success: true, synced: 0, skipped: "clean" };
      }

      const dirtyVersion = stored.bookmarksDirtyVersion;
      const apiHost = host || stored.apiHost;
      if (!apiHost) {
        return { success: false, synced: 0, error: "API host is not configured" };
      }

      let userId = stored.userId;
      if (!userId) {
        userId = createId();
        await chromeApi.storage.local.set({ userId });
      }

      const bookmarks = await getAllBookmarks();
      const requestPayload = {
        data: bookmarks,
        browser_uuid: userId,
        flag: "bookmark",
      };
      logger.log("[SurfMind] Bookmark /save-data payload", requestPayload);
      const response = await fetchImpl(`${apiHost}/save-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        return {
          success: false,
          synced: 0,
          error: `Bookmark sync failed with status ${response.status}`,
        };
      }

      const latest = await chromeApi.storage.local.get({
        bookmarksDirty: false,
        bookmarksDirtyVersion: 0,
      });
      const completedAt = now();
      const stateUpdate = { lastBookmarkSyncTime: completedAt };
      if (latest.bookmarksDirtyVersion === dirtyVersion) {
        stateUpdate.bookmarksDirty = false;
      }
      await chromeApi.storage.local.set(stateUpdate);

      return {
        success: true,
        synced: bookmarks.length,
        pending: latest.bookmarksDirtyVersion !== dirtyVersion,
        lastSyncTime: completedAt,
      };
    };

    const syncIfDirty = (options = {}) => {
      if (syncInFlight) {
        return syncInFlight.then(() => syncIfDirty(options));
      }
      syncInFlight = performSync(options).finally(() => {
        syncInFlight = null;
      });
      return syncInFlight;
    };

    const markDirty = () => {
      markQueue = markQueue.catch(() => {}).then(async () => {
        const stored = await chromeApi.storage.local.get({
          bookmarksDirtyVersion: 0,
        });
        await chromeApi.storage.local.set({
          bookmarksDirty: true,
          bookmarksDirtyVersion: stored.bookmarksDirtyVersion + 1,
        });
      });
      return markQueue;
    };

    const attachExtractedContent = (url, extraction) => {
      const normalizedExtraction = sanitizeExtraction(extraction);
      if (!normalizedExtraction) return Promise.resolve(false);
      const normalizedUrl = normalizeUrl(url);

      markQueue = markQueue.catch(() => {}).then(async () => {
        const stored = await chromeApi.storage.local.get({
          [EXTRACTED_CONTENT_KEY]: {},
          bookmarksDirtyVersion: 0,
        });
        await chromeApi.storage.local.set({
          [EXTRACTED_CONTENT_KEY]: {
            ...stored[EXTRACTED_CONTENT_KEY],
            [normalizedUrl]: normalizedExtraction,
          },
          bookmarksDirty: true,
          bookmarksDirtyVersion: stored.bookmarksDirtyVersion + 1,
        });
      });
      return markQueue.then(() => true);
    };

    const captureCreatedBookmark = async (
      bookmark,
      { getActiveTab, extractFromTab },
    ) => {
      await markDirty();
      if (!bookmark?.url || !/^https?:\/\//.test(bookmark.url)) {
        logger.log("[SurfMind] Bookmark ignored for content extraction", {
          bookmark,
          reason: "unsupported-url",
        });
        return { captured: false, reason: "unsupported-url" };
      }

      const activeTab = await getActiveTab();
      if (activeTab?.id == null || activeTab.url !== bookmark.url) {
        logger.log("[SurfMind] Bookmark saved with title-only fallback", {
          bookmark,
          reason: "bookmarked page is not the active tab",
        });
        return { captured: false, reason: "tab-not-active" };
      }

      const extraction = await extractFromTab(activeTab.id);
      const stored = await attachExtractedContent(bookmark.url, extraction);
      logger.log("[SurfMind] Bookmark content saved locally", {
        bookmark,
        storageKey: normalizeUrl(bookmark.url),
        extraction: sanitizeExtraction(extraction),
      });
      return {
        captured: stored,
        reason: stored ? "live-tab" : "empty-extraction",
      };
    };

    return {
      getAllBookmarks,
      markDirty,
      syncIfDirty,
      attachExtractedContent,
      captureCreatedBookmark,
    };
  };

  const exported = {
    SAFETY_NET_MIN,
    EXTRACTED_CONTENT_KEY,
    normalizeUrl,
    sanitizeExtraction,
    flattenBookmarks,
    createBookmarkSync,
  };
  globalScope.SurfMindBookmarkSync = exported;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof self !== "undefined" ? self : globalThis);
