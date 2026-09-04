const {
  countDistinctPages,
  groupEntriesByUrl,
  selectRecentPages,
} = require("../../public/pageEntries");

const section = (page, sectionIndex, capturedAt = page) => ({
  url: `https://example.com/page-${page}`,
  heading_path: [`Page ${page}`, `Section ${sectionIndex}`],
  content: `Page ${page}, section ${sectionIndex}`,
  capturedAt,
});

test("counts distinct pages instead of section rows", () => {
  const entries = [section(1, 1), section(1, 2), section(1, 3), section(2, 1)];

  expect(countDistinctPages(entries)).toBe(2);
});

test("retains the latest 100 complete pages", () => {
  const entries = Array.from({ length: 101 }, (_, pageIndex) =>
    Array.from({ length: pageIndex === 100 ? 120 : 2 }, (_, sectionIndex) =>
      section(pageIndex, sectionIndex)
    )
  ).flat();

  const retained = selectRecentPages(entries, 100);
  const retainedUrls = new Set(retained.map((entry) => entry.url));

  expect(retainedUrls.size).toBe(100);
  expect(retainedUrls.has("https://example.com/page-0")).toBe(false);
  expect(
    retained.filter((entry) => entry.url === "https://example.com/page-100")
  ).toHaveLength(120);
});

test("combined selection never splits a page at the 50-page boundary", () => {
  const entries = Array.from({ length: 51 }, (_, pageIndex) =>
    Array.from({ length: (pageIndex % 3) + 1 }, (_, sectionIndex) =>
      section(pageIndex, sectionIndex)
    )
  ).flat();

  const selected = selectRecentPages(entries, 50);

  expect(new Set(selected.map((entry) => entry.url)).size).toBe(50);
  expect(selected.some((entry) => entry.url.endsWith("page-0"))).toBe(false);
  for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
    expect(
      selected.filter((entry) => entry.url.endsWith(`page-${pageIndex}`))
    ).toHaveLength((pageIndex % 3) + 1);
  }
});

test("a revisit moves the complete page to the newest position", () => {
  const entries = [
    section(1, 1, 1_000),
    section(2, 1, 2_000),
    section(1, 2, 3_000),
  ];

  const pages = groupEntriesByUrl(entries);

  expect(pages.map((page) => page.url)).toEqual([
    "https://example.com/page-2",
    "https://example.com/page-1",
  ]);
  expect(pages[1].entries).toHaveLength(2);
});
