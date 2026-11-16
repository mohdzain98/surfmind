import { Folder, Laptop } from "lucide-react";
import type { SearchDoc } from "../types";

const getDomain = (source: string): string => {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
};

const getShortUrl = (url: unknown): string => {
  const displayUrl = String(url || "").replace(/^https?:\/\//, "");
  if (displayUrl.length <= 30) return displayUrl;
  return `${displayUrl.slice(0, 15)}....${displayUrl.slice(-8)}`;
};

const getDaysAgo = (dateValue: string | number | Date): string => {
  const searchDate = new Date(dateValue);
  if (Number.isNaN(searchDate.getTime())) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  searchDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (today.getTime() - searchDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays > 1) return `${diffDays} days ago`;
  return "";
};

interface SourceCardProps {
  doc?: SearchDoc;
  showDate?: boolean;
  onOpen?: () => void;
  variant?: "default" | "recent";
}

const SourceCard = ({
  doc,
  showDate = false,
  onOpen,
  variant = "default",
}: SourceCardProps) => {
  const metadata = doc?.metadata || {};
  const source = metadata.source || doc?.url || doc?.source || "";
  const domain = metadata.domain || doc?.domain || getDomain(source);
  const title = metadata.title || doc?.title || "";
  const displayDomain = domain
    ? domain.charAt(0).toUpperCase() + domain.slice(1)
    : "";
  const displayHeading =
    displayDomain && title
      ? `${displayDomain} | ${title}`
      : title || displayDomain;
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
  const snippet = String(
    doc?.snippet || metadata.snippet || doc?.content || metadata.content || ""
  ).trim();
  const folder = String(metadata.folder || doc?.folder || "").trim();
  const foundOnOtherBrowser =
    metadata.found_on_other_browser === true ||
    doc?.found_on_other_browser === true ||
    Boolean(metadata.source_device_name || doc?.source_device_name);
  const sourceDeviceName = String(
    metadata.device_name ||
      metadata.source_device_name ||
      doc?.source_device_name ||
      ""
  ).trim();
  const linkedBrowserLabel = sourceDeviceName
    ? `Found on ${sourceDeviceName}`
    : "Found on another browser";

  const openSource = () => {
    if (!source) return;
    chrome.tabs.create({ url: source });
    onOpen?.();
  };

  return (
    <div
      className={
        variant === "recent"
          ? "result-card result-card-recent"
          : "result-card bg-light p-3 border rounded mt-2"
      }
      role={source ? "button" : undefined}
      tabIndex={source ? 0 : undefined}
      onClick={openSource}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openSource();
      }}
      title={source}
    >
      {displayHeading ? (
        <p className="source-card-heading">{displayHeading}</p>
      ) : null}
      {folder || foundOnOtherBrowser ? (
        <div className="source-context-tags">
          {folder ? (
            <span className="source-folder-tag" title={folder}>
              <Folder size={11} aria-hidden="true" />
              <span>{folder}</span>
            </span>
          ) : null}
          {foundOnOtherBrowser ? (
            <span className="linked-browser-tag" title={linkedBrowserLabel}>
              <Laptop size={11} aria-hidden="true" />
              <span>{linkedBrowserLabel}</span>
            </span>
          ) : null}
        </div>
      ) : null}
      {headingPath ? (
        <p className="heading-breadcrumb" title={headingPath}>
          {headingPath}
        </p>
      ) : null}
      {snippet ? <p className="source-snippet">{snippet}</p> : null}
      <div className="source-card-link-row">
        <p className="source-card-link" title={source}>
          {getShortUrl(source)}
        </p>
        {relativeDate ? (
          <p className="source-card-date">{relativeDate}</p>
        ) : null}
      </div>
    </div>
  );
};

export default SourceCard;
