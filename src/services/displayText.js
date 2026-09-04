const URL_PATTERN = /https?:\/\/[^\s)\]}]+/g;

export const truncateUrl = (value, maxLength = 52) => {
  const url = String(value || "");
  if (url.length <= maxLength) return url;

  const tailLength = Math.min(10, Math.floor(maxLength / 4));
  const headLength = Math.max(1, maxLength - tailLength - 1);
  return `${url.slice(0, headLength)}…${url.slice(-tailLength)}`;
};

export const truncateUrlsInText = (value, maxLength = 52) =>
  String(value || "").replace(URL_PATTERN, (url) =>
    truncateUrl(url, maxLength)
  );

export const formatRelativeTime = (value, now = Date.now()) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const elapsedMs = Math.max(0, now - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsedMs < minute) return "Just now";
  if (elapsedMs < hour) return `${Math.floor(elapsedMs / minute)}m ago`;
  if (elapsedMs < day) return `${Math.floor(elapsedMs / hour)}h ago`;

  const days = Math.floor(elapsedMs / day);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};
