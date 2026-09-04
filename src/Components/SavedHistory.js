import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

export const SAVED_HISTORY_PAGE_SIZE = 50;

const getTimestamp = (entry) => {
  if (Number.isFinite(entry?.capturedAt)) return entry.capturedAt;
  for (const value of [entry?.visited_at, entry?.date]) {
    if (Number.isFinite(value)) return value;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

export const groupSavedHistory = (entries = []) => {
  const pages = new Map();

  entries.forEach((entry) => {
    const url = String(entry?.url || "").trim();
    if (!url) return;

    const timestamp = getTimestamp(entry);
    const existing = pages.get(url);
    if (existing) {
      existing.sections.push(entry);
      if (timestamp >= existing.timestamp) {
        existing.timestamp = timestamp;
        existing.title = entry.title || existing.title;
      }
      return;
    }

    pages.set(url, {
      url,
      title: entry.title || url,
      timestamp,
      sections: [entry],
    });
  });

  return Array.from(pages.values()).sort(
    (left, right) => right.timestamp - left.timestamp
  );
};

const formatCapturedAt = (timestamp) => {
  if (!timestamp) return "Saved date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
};

const sectionHeading = (section, index) => {
  const path = Array.isArray(section.heading_path)
    ? section.heading_path.filter(Boolean)
    : [];
  return path.length > 0 ? path.join(" › ") : `Saved section ${index + 1}`;
};

const SavedHistory = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      const stored = await chrome.storage.local.get({ navigationData: [] });
      if (!mounted) return;
      setPages(groupSavedHistory(stored.navigationData));
      setCurrentPage(1);
      setLoading(false);
    };

    loadHistory();

    const handleStorageChange = (changes, areaName) => {
      if (areaName !== "local" || !changes.navigationData) return;
      setPages(groupSavedHistory(changes.navigationData.newValue));
      setCurrentPage(1);
    };
    chrome.storage.onChanged?.addListener(handleStorageChange);

    return () => {
      mounted = false;
      chrome.storage.onChanged?.removeListener(handleStorageChange);
    };
  }, []);

  const totalPages = Math.max(
    1,
    Math.ceil(pages.length / SAVED_HISTORY_PAGE_SIZE)
  );
  const pageStart = (currentPage - 1) * SAVED_HISTORY_PAGE_SIZE;
  const visiblePages = pages.slice(
    pageStart,
    pageStart + SAVED_HISTORY_PAGE_SIZE
  );

  return (
    <section className="saved-history" aria-labelledby="saved-history-title">
      <div className="saved-history-heading">
        <h2 id="saved-history-title">Saved History</h2>
        <p>
          Pages SurfMind captured on this browser. Expand a page to inspect the
          text saved for search and sync.
        </p>
      </div>

      {loading ? (
        <p className="saved-history-status" role="status">
          Loading saved history…
        </p>
      ) : pages.length === 0 ? (
        <div className="saved-history-empty">
          <h3>No saved history yet</h3>
          <p>
            SurfMind saves searchable page content as you browse. Your existing
            Chrome history is not imported automatically.
          </p>
        </div>
      ) : (
        <div className="saved-history-list">
          <p className="saved-history-count">
            {pageStart + 1}–
            {Math.min(pageStart + SAVED_HISTORY_PAGE_SIZE, pages.length)} of{" "}
            {pages.length} {pages.length === 1 ? "page" : "pages"} stored
            locally
          </p>
          {visiblePages.map((page) => (
            <details className="saved-history-item" key={page.url}>
              <summary>
                <span className="saved-history-row-copy">
                  <strong>{page.title}</strong>
                  <small className="saved-history-url">{page.url}</small>
                  <small className="saved-history-time">
                    <Clock3 size={11} aria-hidden="true" />
                    {formatCapturedAt(page.timestamp)} · {page.sections.length}{" "}
                    {page.sections.length === 1 ? "section" : "sections"}
                  </small>
                </span>
                <ChevronDown
                  className="saved-history-chevron"
                  size={15}
                  aria-hidden="true"
                />
              </summary>
              <div className="saved-history-content">
                {page.sections.map((section, index) => (
                  <section
                    className="saved-history-section"
                    key={section.captureId || `${page.url}-${index}`}
                  >
                    <h3>{sectionHeading(section, index)}</h3>
                    <p>{section.content || "No text content was saved."}</p>
                  </section>
                ))}
              </div>
            </details>
          ))}
          {totalPages > 1 ? (
            <nav
              className="saved-history-pagination"
              aria-label="Saved history pages"
            >
              <button
                type="button"
                onClick={() => setCurrentPage((page) => page - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={13} aria-hidden="true" />
                Previous
              </button>
              <span aria-live="polite">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => page + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default SavedHistory;
