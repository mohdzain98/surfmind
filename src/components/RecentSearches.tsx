import { useEffect, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Clock3,
  GitMerge,
  Globe2,
  History,
  RotateCcw,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RecentSearch } from "../types";
import { fetchRecentSearches } from "../services/recentSearches";
import {
  formatRelativeTime,
  truncateUrlsInText,
} from "../services/displayText";
import SourceCard from "./SourceCard";

const MODE_LABELS: Record<string, string> = {
  history: "History",
  bookmark: "Bookmarks",
  bookmarks: "Bookmarks",
  combined: "Combined",
};

const MODE_ICONS: Record<string, LucideIcon> = {
  history: History,
  bookmark: Bookmark,
  bookmarks: Bookmark,
  combined: GitMerge,
};

const getMode = (mode: string): string =>
  mode === "bookmarks" ? "bookmark" : mode;

const getSourceDetails = (
  source?: Record<string, any>
): { url: string; label: string } => {
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

interface RecentSearchesProps {
  host: string;
  browserUuid: string;
  onRerun?: (search: RecentSearch) => void;
}

const RecentSearches = ({
  host,
  browserUuid,
  onRerun,
}: RecentSearchesProps) => {
  const [searches, setSearches] = useState<RecentSearch[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!host || !browserUuid) return undefined;

    const controller = new AbortController();
    const loadSearches = async () => {
      setLoading(true);
      try {
        const nextSearches = await fetchRecentSearches(host, browserUuid, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setSearches(nextSearches);
      } catch {
        if (!controller.signal.aborted) setSearches([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadSearches();

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
        const mode = getMode(search.flag);
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
              <span className="recent-search-tags">
                <span className="recent-search-mode">
                  {MODE_LABELS[mode] || mode}
                </span>
                {search.searchMode === "fast" ? (
                  <span
                    className="recent-search-fast-tag"
                    aria-label="Fast search"
                    title="Fast search"
                  >
                    <Zap size={11} aria-hidden="true" />
                  </span>
                ) : null}
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
                {search.searchMode === "fast" ? (
                  search.sources.length > 0 ? (
                    <div className="recent-fast-results">
                      {search.sources.map((source, index) => (
                        <SourceCard
                          key={`${source.id || source.url || "source"}-${index}`}
                          doc={source}
                          showDate={search.flag === "history"}
                          variant="recent"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted recent-searches-empty mb-0">
                      No stored results.
                    </p>
                  )
                ) : search.answer ? (
                  <p className="recent-search-answer">
                    {truncateUrlsInText(search.answer)}
                  </p>
                ) : null}
                {search.searchMode !== "fast" && search.sources.length > 0 ? (
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
                ) : search.searchMode !== "fast" ? (
                  <p className="text-muted recent-searches-empty mb-0">
                    No stored sources.
                  </p>
                ) : null}
                {onRerun ? (
                  <button
                    type="button"
                    className="recent-search-rerun"
                    onClick={() => onRerun(search)}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    Run again
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
};

export default RecentSearches;
