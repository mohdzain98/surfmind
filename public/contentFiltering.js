(function attachContentFiltering(globalScope) {
  const BLOCKLIST_STORAGE_KEY = "contentFilterBlocklists";
  const BLOCKLIST_UPDATED_AT_KEY = "contentFilterBlocklistsUpdatedAt";
  const FLAGGED_BOOKMARKS_KEY = "contentFilterFlaggedBookmarks";
  const REFRESH_ALARM = "surfmind-content-filter-refresh";
  const REFRESH_PERIOD_MIN = 7 * 24 * 60;
  const MAX_FLAGGED_BOOKMARKS = 500;
  const BLOCKLIST_URLS = Object.freeze({
    adult: "https://blocklistproject.github.io/Lists/alt-version/porn-nl.txt",
    malware:
      "https://blocklistproject.github.io/Lists/alt-version/malware-nl.txt",
    phishing:
      "https://blocklistproject.github.io/Lists/alt-version/phishing-nl.txt",
    scam: "https://blocklistproject.github.io/Lists/alt-version/scam-nl.txt",
  });

  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/\s+/g, " ")
      .trim();

  const parseDomainList = (text) => {
    const domains = new Set();
    for (const rawLine of String(text || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const candidate = line
        .split(/\s+/)
        .pop()
        .replace(/^\|\|/, "")
        .replace(/\^$/, "");
      const hostname = candidate
        .toLocaleLowerCase("en-US")
        .replace(/^www\./, "");
      if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(hostname)) domains.add(hostname);
    }
    return Array.from(domains);
  };

  const hostnameMatches = (hostname, domainSets) => {
    const labels = hostname
      .toLocaleLowerCase("en-US")
      .replace(/^www\./, "")
      .split(".");
    for (let index = 0; index < labels.length - 1; index += 1) {
      const candidate = labels.slice(index).join(".");
      if (domainSets.some((set) => set.has(candidate))) return true;
    }
    return false;
  };

  const getSearchPageInfo = (value) => {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLocaleLowerCase("en-US");
      let parameter = null;
      if (
        (hostname === "google.com" || hostname.endsWith(".google.com")) &&
        url.pathname === "/search"
      )
        parameter = "q";
      else if (
        (hostname === "bing.com" || hostname.endsWith(".bing.com")) &&
        url.pathname === "/search"
      )
        parameter = "q";
      else if (
        hostname === "duckduckgo.com" ||
        hostname.endsWith(".duckduckgo.com")
      )
        parameter = "q";
      else if (
        (hostname === "search.yahoo.com" ||
          hostname.endsWith(".search.yahoo.com")) &&
        url.pathname.startsWith("/search")
      )
        parameter = "p";
      if (!parameter) return null;
      const query = String(url.searchParams.get(parameter) || "").trim();
      return query ? { query, hostname, parameter } : null;
    } catch {
      return null;
    }
  };

  const sanitizeSearchUrl = (value) => {
    try {
      const url = new URL(value);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "";
    }
  };

  const createSearchHistoryEntries = ({
    url,
    query,
    capturedAt,
    classification,
    createId = () => crypto.randomUUID(),
  }) => {
    const flagged = classification?.flagged === true;
    const storedUrl = url;
    const visitedAt = new Date(capturedAt).toISOString();
    let domain = "";
    try {
      domain = new URL(storedUrl).hostname;
    } catch {
      domain = "";
    }
    return [
      {
        title: flagged ? "Filtered search page" : `Search: ${query}`,
        url: storedUrl,
        content: flagged ? "" : query,
        ...(flagged ? { local_query: query } : {}),
        heading_path: [flagged ? "Filtered search page" : "Search query"],
        heading_level: 0,
        section_index: 0,
        domain,
        visited_at: visitedAt,
        date: visitedAt,
        capturedAt,
        captureId: createId(),
        synced: false,
        flagged,
        flag_reason: classification?.flag_reason ?? null,
        flag_layer: classification?.flag_layer ?? null,
      },
    ];
  };

  const compileKeywordMatcher = (terms) => {
    const normalizedTerms = Array.from(
      new Set((terms || []).map(normalizeText).filter(Boolean))
    ).sort((left, right) => right.length - left.length);
    return (value) => {
      const text = normalizeText(value);
      if (!text) return false;
      return normalizedTerms.some((term) => {
        let start = text.indexOf(term);
        while (start >= 0) {
          const before = start === 0 ? "" : text[start - 1];
          const after = text[start + term.length] || "";
          if (
            (!before || !/[\p{L}\p{N}]/u.test(before)) &&
            (!after || !/[\p{L}\p{N}]/u.test(after))
          ) {
            return true;
          }
          start = text.indexOf(term, start + 1);
        }
        return false;
      });
    };
  };

  const createContentFilter = ({
    chromeApi,
    fetchImpl,
    now = () => Date.now(),
    keywordTerms = globalScope.SurfMindContentFilterKeywords || [],
    blocklistUrls = BLOCKLIST_URLS,
  }) => {
    let cachedDomainSets = null;
    let refreshInFlight = null;
    const hasKeyword = compileKeywordMatcher(keywordTerms);

    const loadDomainSets = async () => {
      if (cachedDomainSets) return cachedDomainSets;
      const stored = await chromeApi.storage.local.get({
        [BLOCKLIST_STORAGE_KEY]: {},
      });
      cachedDomainSets = Object.values(stored[BLOCKLIST_STORAGE_KEY] || {}).map(
        (domains) => new Set(Array.isArray(domains) ? domains : [])
      );
      return cachedDomainSets;
    };

    const refreshBlocklists = async ({ force = false } = {}) => {
      if (refreshInFlight) return refreshInFlight;
      refreshInFlight = (async () => {
        const stored = await chromeApi.storage.local.get({
          [BLOCKLIST_STORAGE_KEY]: {},
          [BLOCKLIST_UPDATED_AT_KEY]: 0,
        });
        const age = now() - Number(stored[BLOCKLIST_UPDATED_AT_KEY] || 0);
        if (!force && age < REFRESH_PERIOD_MIN * 60 * 1000) {
          return { refreshed: false, reason: "fresh" };
        }

        const nextLists = { ...(stored[BLOCKLIST_STORAGE_KEY] || {}) };
        let updated = false;
        for (const [name, url] of Object.entries(blocklistUrls)) {
          try {
            const response = await fetchImpl(url, { cache: "no-store" });
            if (!response.ok) continue;
            const domains = parseDomainList(await response.text());
            if (domains.length > 0) {
              nextLists[name] = domains;
              updated = true;
            }
          } catch {
            // Keep the last successful copy for this category.
          }
        }
        if (updated) {
          await chromeApi.storage.local.set({
            [BLOCKLIST_STORAGE_KEY]: nextLists,
            [BLOCKLIST_UPDATED_AT_KEY]: now(),
          });
          cachedDomainSets = Object.values(nextLists).map(
            (domains) => new Set(domains)
          );
        }
        return {
          refreshed: updated,
          reason: updated ? "updated" : "unavailable",
        };
      })().finally(() => {
        refreshInFlight = null;
      });
      return refreshInFlight;
    };

    const classifyItem = async ({ url, title, metaDescription }) => {
      let hostname = "";
      try {
        hostname = new URL(url).hostname;
      } catch {
        return { flagged: false, flag_reason: null, flag_layer: null };
      }
      const domainSets = await loadDomainSets();
      if (hostnameMatches(hostname, domainSets)) {
        return {
          flagged: true,
          flag_reason: "domain",
          flag_layer: 1,
        };
      }
      const searchPage = getSearchPageInfo(url);
      if (searchPage && hasKeyword(searchPage.query)) {
        return {
          flagged: true,
          flag_reason: "query",
          flag_layer: 3,
        };
      }
      if (hasKeyword(title) || hasKeyword(metaDescription)) {
        return {
          flagged: true,
          flag_reason: "keyword",
          flag_layer: 2,
        };
      }
      return { flagged: false, flag_reason: null, flag_layer: null };
    };

    const recordFlaggedBookmark = async (entry) => {
      const stored = await chromeApi.storage.local.get({
        [FLAGGED_BOOKMARKS_KEY]: [],
      });
      const safeUrl =
        entry.flag_reason === "query"
          ? sanitizeSearchUrl(entry.url)
          : entry.url;
      const record = {
        url: safeUrl,
        domain: entry.domain || "",
        title:
          entry.flag_reason === "query"
            ? "Filtered search page"
            : entry.title || "Untitled bookmark",
        folder: entry.folder || "",
        flagged: true,
        flag_reason: entry.flag_reason,
        flag_layer: entry.flag_layer,
        flagged_at: now(),
      };
      const previous = (stored[FLAGGED_BOOKMARKS_KEY] || []).filter(
        (item) => item.url !== record.url
      );
      await chromeApi.storage.local.set({
        [FLAGGED_BOOKMARKS_KEY]: [...previous, record].slice(
          -MAX_FLAGGED_BOOKMARKS
        ),
      });
    };

    return {
      classifyItem,
      getSearchPageInfo,
      hasKeyword,
      recordFlaggedBookmark,
      refreshBlocklists,
    };
  };

  const exported = {
    BLOCKLIST_STORAGE_KEY,
    BLOCKLIST_UPDATED_AT_KEY,
    FLAGGED_BOOKMARKS_KEY,
    REFRESH_ALARM,
    REFRESH_PERIOD_MIN,
    BLOCKLIST_URLS,
    parseDomainList,
    getSearchPageInfo,
    sanitizeSearchUrl,
    createSearchHistoryEntries,
    compileKeywordMatcher,
    createContentFilter,
  };
  globalScope.SurfMindContentFiltering = exported;
  if (typeof module !== "undefined" && module.exports)
    module.exports = exported;
})(typeof self !== "undefined" ? self : globalThis);
