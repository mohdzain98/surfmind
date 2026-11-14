import {
  formatRelativeTime,
  truncateUrl,
  truncateUrlsInText,
} from "../services/displayText";

const longUrl =
  "https://www.google.com/search?q=apple+iphone+price&sca_esv=very-long-query-identifier&source=extension";

test("truncates a long standalone URL to the requested display length", () => {
  const result = truncateUrl(longUrl, 40);

  expect(result).toHaveLength(40);
  expect(result).toContain("…");
  expect(result).toMatch(/^https:\/\/www\.google\.com/);
});

test("truncates long URLs inside answers without truncating answer text", () => {
  const answer = `Read the price list at [Apple prices](${longUrl}) for details.`;
  const result = truncateUrlsInText(answer, 40);

  expect(result).toContain("Read the price list at [Apple prices]");
  expect(result).toContain("for details.");
  expect(result).not.toContain(longUrl);
  expect(result).toContain("…");
});

test("formats recent-search timestamps relative to the current time", () => {
  const now = new Date("2026-08-23T12:00:00Z").getTime();

  expect(formatRelativeTime("2026-08-23T10:00:00Z", now)).toBe("2h ago");
  expect(formatRelativeTime("2026-08-22T12:00:00Z", now)).toBe("Yesterday");
  expect(formatRelativeTime("2026-08-21T12:00:00Z", now)).toBe("2 days ago");
  expect(formatRelativeTime("not-a-date", now)).toBe("");
});
