import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bookmark,
  BriefcaseBusiness,
  CircleHelp,
  Clapperboard,
  Clock3,
  Code2,
  ExternalLink,
  Gamepad2,
  Folder,
  GraduationCap,
  HeartPulse,
  History,
  LoaderCircle,
  Newspaper,
  Plane,
  Search,
  ShoppingBag,
  Tags,
  Users,
  Utensils,
  WalletCards,
} from "lucide-react";
import {
  getCategoryPages,
  getCategorySearchAnalytics,
} from "../services/categoriesApi";

const formatVisitedAt = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
};

const CATEGORY_ICON_RULES = [
  {
    pattern: /work|professional|career|job|business/i,
    Icon: BriefcaseBusiness,
  },
  { pattern: /shop|product|e-?commerce|order|price/i, Icon: ShoppingBag },
  { pattern: /learn|education|course|tutorial|study/i, Icon: GraduationCap },
  { pattern: /entertainment|movie|film|video|stream/i, Icon: Clapperboard },
  { pattern: /game|gaming/i, Icon: Gamepad2 },
  { pattern: /travel|trip|flight|hotel|destination/i, Icon: Plane },
  { pattern: /finance|money|bank|invest|budget/i, Icon: WalletCards },
  { pattern: /health|fitness|medical|wellness/i, Icon: HeartPulse },
  { pattern: /news|journal|article/i, Icon: Newspaper },
  { pattern: /code|developer|programming|software|tech/i, Icon: Code2 },
  { pattern: /social|community|people/i, Icon: Users },
  { pattern: /food|recipe|restaurant|cooking/i, Icon: Utensils },
  { pattern: /book|read|documentation/i, Icon: BookOpen },
];

const getCategoryIcon = (name, description, uncategorized) => {
  if (uncategorized) return CircleHelp;
  const categoryText = `${name} ${description}`;
  return (
    CATEGORY_ICON_RULES.find(({ pattern }) => pattern.test(categoryText))
      ?.Icon || Tags
  );
};

const PageRow = ({ page }) => {
  const visitedAt = formatVisitedAt(page.visitedAt);
  const confidence = Number.isFinite(page.categoryConfidence)
    ? `${Math.round(page.categoryConfidence * 100)}% match`
    : "";
  const isBookmark = page.flag === "bookmark";

  const content = (
    <>
      <span
        className={`category-page-mode ${isBookmark ? "is-bookmark" : "is-history"}`}
        aria-hidden="true"
      >
        {isBookmark ? <Bookmark size={13} /> : <History size={13} />}
      </span>
      <span className="category-page-copy">
        <strong>{page.title}</strong>
        <span className="category-page-domain">{page.domain || page.url}</span>
        <span className="category-page-meta">
          {page.folder ? (
            <span>
              <Folder size={11} aria-hidden="true" />
              {page.folder}
            </span>
          ) : null}
          {visitedAt ? (
            <span>
              <Clock3 size={11} aria-hidden="true" />
              {visitedAt}
            </span>
          ) : null}
          {confidence ? <span>{confidence}</span> : null}
        </span>
      </span>
      {page.url ? (
        <ExternalLink
          className="category-page-external"
          size={13}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  return page.url ? (
    <a
      className="category-page-row"
      href={page.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {content}
    </a>
  ) : (
    <div className="category-page-row">{content}</div>
  );
};

const CategoryGroup = ({
  groupKey,
  name,
  description,
  pages,
  searchCount,
  isOpen,
  onToggle,
  uncategorized = false,
}) => {
  const CategoryIcon = getCategoryIcon(name, description, uncategorized);

  return (
    <section className={`category-browser-group ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="category-browser-toggle"
        onClick={() => onToggle(groupKey)}
        aria-expanded={isOpen}
        aria-controls={`category-pages-${groupKey}`}
      >
        <span
          className={`category-browser-icon ${uncategorized ? "is-uncategorized" : ""}`}
          aria-hidden="true"
        >
          <CategoryIcon size={15} />
        </span>
        <span className="category-browser-copy">
          <strong>{name}</strong>
          <small>{description}</small>
        </span>
        <span className="category-browser-stats">
          <span>
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </span>
          <span>
            <Search size={11} aria-hidden="true" />
            {searchCount}
          </span>
        </span>
      </button>

      {isOpen ? (
        <div className="category-pages-list" id={`category-pages-${groupKey}`}>
          {pages.length ? (
            pages.map((page, index) => (
              <PageRow key={page.id || `${page.url}-${index}`} page={page} />
            ))
          ) : (
            <p>No pages are assigned here yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
};

const CategoryBrowser = ({ host, browserUuid }) => {
  const [groups, setGroups] = useState([]);
  const [uncategorized, setUncategorized] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [openGroup, setOpenGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    if (!host || !browserUuid) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [pageData, analyticsData] = await Promise.all([
          getCategoryPages(host, browserUuid),
          getCategorySearchAnalytics(host, browserUuid),
        ]);
        if (cancelled) return;
        setGroups(pageData.categories);
        setUncategorized(pageData.uncategorized);
        setAnalytics(analyticsData);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [browserUuid, host, requestKey]);

  const analyticsByCategory = useMemo(
    () =>
      new Map(
        analytics.map((item) => [
          item.categoryId == null ? "uncategorized" : String(item.categoryId),
          item.searchCount,
        ])
      ),
    [analytics]
  );

  const totalPages = useMemo(
    () =>
      groups.reduce((total, category) => total + category.pages.length, 0) +
      uncategorized.length,
    [groups, uncategorized.length]
  );
  const totalSearches = useMemo(
    () => analytics.reduce((total, item) => total + item.searchCount, 0),
    [analytics]
  );

  const handleToggle = (groupKey) => {
    setOpenGroup((current) => (current === groupKey ? null : groupKey));
  };

  return (
    <section
      className="category-browser"
      aria-labelledby="category-browser-title"
    >
      <div className="category-browser-heading">
        <h1 id="category-browser-title">Your categories</h1>
        <p>
          Browse the pages SurfMind organized and how often each topic appears
          in search.
        </p>
      </div>

      {loading ? (
        <div className="category-browser-state" role="status">
          <LoaderCircle className="spin" size={17} aria-hidden="true" />
          Loading your categories…
        </div>
      ) : null}

      {!loading && error ? (
        <div className="category-browser-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setRequestKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="category-browser-summary">
            <span>
              <strong>{totalPages}</strong> saved pages
            </span>
            <span>
              <strong>{totalSearches}</strong> searches
            </span>
          </div>

          {groups.length || uncategorized.length ? (
            <div className="category-browser-groups">
              {groups.map((category) => {
                const groupKey = String(category.id);
                return (
                  <CategoryGroup
                    key={groupKey}
                    groupKey={groupKey}
                    name={category.name}
                    description={category.description}
                    pages={category.pages}
                    searchCount={analyticsByCategory.get(groupKey) || 0}
                    isOpen={openGroup === groupKey}
                    onToggle={handleToggle}
                  />
                );
              })}

              {uncategorized.length ? (
                <CategoryGroup
                  groupKey="uncategorized"
                  name="Uncategorized"
                  description="Pages waiting to be organized"
                  pages={uncategorized}
                  searchCount={analyticsByCategory.get("uncategorized") || 0}
                  isOpen={openGroup === "uncategorized"}
                  onToggle={handleToggle}
                  uncategorized
                />
              ) : null}
            </div>
          ) : (
            <div className="category-browser-empty">
              <Tags size={20} aria-hidden="true" />
              <h2>No categorized pages yet</h2>
              <p>
                Enable Categories in Settings, then return here after SurfMind
                organizes your pages.
              </p>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
};

export default CategoryBrowser;
