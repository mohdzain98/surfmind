const getDomain = (source) => {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
};

const getShortUrl = (url) => {
  const displayUrl = String(url || "").replace(/^https?:\/\//, "");
  if (displayUrl.length <= 30) return displayUrl;
  return `${displayUrl.slice(0, 15)}....${displayUrl.slice(-8)}`;
};

const getDaysAgo = (dateValue) => {
  const searchDate = new Date(dateValue);
  if (Number.isNaN(searchDate.getTime())) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  searchDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - searchDate) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays > 1) return `${diffDays} days ago`;
  return "";
};

const SourceCard = ({ doc, showDate = false }) => {
  const metadata = doc?.metadata || {};
  const source = metadata.source || doc?.url || doc?.source || "";
  const domain = metadata.domain || doc?.domain || getDomain(source);
  const title = metadata.title || doc?.title || "";
  const rawHeadingPath =
    metadata.heading_path ||
    metadata.headingPath ||
    doc?.heading_path ||
    doc?.headingPath;
  const headingPath = Array.isArray(rawHeadingPath)
    ? rawHeadingPath.filter(Boolean).join(" > ")
    : rawHeadingPath;
  const dateValue =
    metadata.visited_at || metadata.date || doc?.visited_at || doc?.date;
  const relativeDate = showDate && dateValue ? getDaysAgo(dateValue) : "";
  const snippet = doc?.snippet || metadata.snippet || "";

  const openSource = () => {
    if (source) chrome.tabs.create({ url: source });
  };

  return (
    <div
      className="result-card bg-light p-3 border rounded mt-2"
      role={source ? "button" : undefined}
      tabIndex={source ? 0 : undefined}
      onClick={openSource}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openSource();
      }}
      title={source}
    >
      <p style={{ margin: 0, padding: 0, fontSize: "13px" }}>
        {domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : ""}
        {title ? ` | ${title}` : ""}
      </p>
      {headingPath ? (
        <p className="heading-breadcrumb" title={headingPath}>
          {headingPath}
        </p>
      ) : null}
      {snippet ? <p className="source-snippet">{snippet}</p> : null}
      <div className="d-flex gap-2">
        <p
          className="text-muted flex-grow-1"
          style={{ fontSize: "12px", margin: 0, padding: 0 }}
        >
          {getShortUrl(source)}
        </p>
        {relativeDate ? (
          <p className="text-muted" style={{ fontSize: "12px", margin: 0 }}>
            {relativeDate}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default SourceCard;
