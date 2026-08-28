import { useEffect, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Clock3,
  GitMerge,
  Globe2,
  History,
} from "lucide-react";
import { fetchRecentSearches } from "../services/recentSearches";
import {
  formatRelativeTime,
  truncateUrlsInText,
} from "../services/displayText";

const MODE_LABELS = {
  history: "History",
  bookmark: "Bookmarks",
  bookmarks: "Bookmarks",
  combined: "Combined",
};

const MODE_ICONS = {
  history: History,
  bookmark: Bookmark,
  bookmarks: Bookmark,
  combined: GitMerge,
};

const getMode = (mode) => (mode === "bookmarks" ? "bookmark" : mode);

const getSourceDetails = (source) => {
  const metadata = source?.metadata || {};
  const url = metadata.source || source?.url || source?.source || "";
  let domain = metadata.domain || source?.domain || "";
  if (!domain && url) {
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch (error) {
      domain = "";
    }
  }
  return {
    url,
    label: domain || metadata.title || source?.title || "Saved source",
  };
};

const RecentSearches = ({ host, browserUuid }) => {
  const [searches, setSearches] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!host || !browserUuid) return undefined;

    const controller = new AbortController();
    setLoading(true);
    fetchRecentSearches(host, browserUuid, { signal: controller.signal })
      .then(setSearches)
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [browserUuid, host]);

  return (
    <section className="recent-searches mt-4" aria-labelledby="recent-title">
      <div className="d-flex align-items-center gap-2 mb-2">
        <Clock3 size={14} className="text-muted" aria-hidden="true" />
        <h2 id="recent-title" className="h6 mb-0">
          Recent Searches
        </h2>
      </div>

      {loading ? (
        <p className="text-muted recent-searches-empty">Loading…</p>
      ) : null}
      {!loading && searches.length === 0 ? (
        <p className="text-muted recent-searches-empty">
          No recent searches yet.
        </p>
      ) : null}

      {searches.map((search) => {
        const expanded = expandedId === search.id;
        const panelId = `recent-search-${search.id}`;
        const mode = getMode(search.mode);
        const ModeIcon = MODE_ICONS[mode] || History;
        const relativeTime = formatRelativeTime(search.createdAt);
        return (
          <article
            className={`recent-search-item mode-${mode}`}
            key={search.id}
          >
            <button
              type="button"
              className="recent-search-trigger"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpandedId(expanded ? null : search.id)}
            >
              <span className="recent-search-entry-icon" aria-hidden="true">
                <ModeIcon size={13} />
              </span>
              <span className="recent-search-copy">
                <span className="recent-search-query">{search.query}</span>
                {relativeTime ? (
                  <span className="recent-search-time">{relativeTime}</span>
                ) : null}
              </span>
              <span className="recent-search-mode">
                {MODE_LABELS[mode] || mode}
              </span>
              <span className="recent-search-chevron-button" aria-hidden="true">
                <ChevronDown
                  size={14}
                  className={
                    expanded
                      ? "recent-search-chevron is-open"
                      : "recent-search-chevron"
                  }
                />
              </span>
            </button>
            {expanded ? (
              <div className="recent-search-content" id={panelId}>
                {search.answer ? (
                  <p className="recent-search-answer">
                    {truncateUrlsInText(search.answer)}
                  </p>
                ) : null}
                {search.sources.length > 0 ? (
                  <div
                    className="recent-search-source-chips d-flex flex-wrap gap-2"
                    aria-label="Stored sources"
                  >
                    {search.sources.map((source, index) => {
                      const { url, label } = getSourceDetails(source);
                      return (
                        <button
                          type="button"
                          className="recent-search-source-chip"
                          key={`${source.id || url || "source"}-${index}`}
                          onClick={() => {
                            if (url) chrome.tabs.create({ url });
                          }}
                          disabled={!url}
                          title={url}
                        >
                          <Globe2 size={11} aria-hidden="true" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted recent-searches-empty mb-0">
                    No stored sources.
                  </p>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
};

export default RecentSearches;
