const { Readability } = require("@mozilla/readability");
const {
  MAX_HISTORY_SECTION_CHARS,
  MAX_HISTORY_SECTIONS_PER_PAGE,
  buildHeadingSections,
  createBookmarkEntries,
  extractStructuredContent,
  createHistoryEntries,
} = require("../../public/structuredExtraction");

const parseDocument = (html) =>
  new DOMParser().parseFromString(html, "text/html");

test("builds nested heading paths from cleaned article content", () => {
  const documentRef = parseDocument("<title>Docs</title>");
  const sections = buildHeadingSections(
    documentRef,
    `
      <h1>Installation</h1><p>Install the package.</p>
      <h2>Docker Setup</h2><p>Run the container.</p>
      <h2>Local Setup</h2><p>Run it locally.</p>
    `,
    "Docs"
  );

  expect(sections).toEqual([
    {
      headingPath: ["Docs", "Installation"],
      level: 1,
      text: "Install the package.",
    },
    {
      headingPath: ["Docs", "Installation", "Docker Setup"],
      level: 2,
      text: "Run the container.",
    },
    {
      headingPath: ["Docs", "Installation", "Local Setup"],
      level: 2,
      text: "Run it locally.",
    },
  ]);
});

test("joins all paragraphs under a heading into one section", () => {
  const documentRef = parseDocument("<title>Paper</title>");
  const sections = buildHeadingSections(
    documentRef,
    `
      <h1>Abstract</h1>
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
      <p>Third paragraph.</p>
    `,
    "Paper"
  );

  expect(sections).toEqual([
    {
      headingPath: ["Paper", "Abstract"],
      level: 1,
      text: "First paragraph. Second paragraph. Third paragraph.",
    },
  ]);
});

test("coalesces repeated heading paths into one section", () => {
  const documentRef = parseDocument("<title>Paper</title>");
  const sections = buildHeadingSections(
    documentRef,
    `
      <h1>Abstract</h1><p>First part.</p>
      <h1>Abstract</h1><p>Second part.</p>
    `,
    "Paper"
  );

  expect(sections).toHaveLength(1);
  expect(sections[0].text).toBe("First part. Second part.");
});

test("uses Readability and keeps full section text beyond the old snippet", () => {
  const longText = "Structured retrieval content. ".repeat(80);
  const documentRef = parseDocument(`
    <html><head><title>Guide</title></head><body>
      <nav>Navigation should be removed</nav>
      <article>
        <h1>Getting Started</h1><p>${longText}</p>
        <h2>Configuration</h2><p>${longText}</p>
      </article>
    </body></html>
  `);

  const extraction = extractStructuredContent(documentRef, Readability);

  expect(extraction.extractionMethod).toBe("readability");
  expect(extraction.sections.length).toBeGreaterThan(1);
  expect(extraction.sections[0].text.length).toBeGreaterThan(100);
  expect(
    extraction.sections.map((section) => section.text).join(" ")
  ).not.toContain("Navigation should be removed");
});

test("falls back to one page section when Readability cannot parse", () => {
  class FailedReadability {
    parse() {
      return null;
    }
  }
  const documentRef = parseDocument(`
    <html><head><title>Product</title></head><body>
      <nav>Menu</nav><main>Product details and pricing.</main>
    </body></html>
  `);

  const extraction = extractStructuredContent(documentRef, FailedReadability);

  expect(extraction).toEqual({
    title: "Product",
    sections: [
      {
        headingPath: ["Product"],
        level: 0,
        text: "Product details and pricing.",
      },
    ],
    extractionMethod: "dom-fallback",
  });
});

test("creates section-scoped entries using the shared ingestion contract", () => {
  const entries = createHistoryEntries({
    extraction: {
      title: "Docs",
      sections: [
        {
          headingPath: ["Docs", "Install"],
          level: 1,
          text: "Install instructions.",
        },
      ],
    },
    url: "https://docs.example.com/install",
    capturedAt: 1_700_000_000_000,
    createId: () => "capture-1",
  });

  expect(entries[0]).toMatchObject({
    title: "Docs",
    content: "Install instructions.",
    heading_path: ["Docs", "Install"],
    heading_level: 1,
    section_index: 0,
    domain: "docs.example.com",
    visited_at: "2023-11-14T22:13:20.000Z",
    captureId: "capture-1",
    synced: false,
  });
});

test("bounds history extraction while keeping bookmark extraction rich", () => {
  const longText = "Detailed page context. ".repeat(300);
  const extraction = {
    title: "Large guide",
    sections: Array.from(
      { length: MAX_HISTORY_SECTIONS_PER_PAGE + 5 },
      (_, index) => ({
        headingPath: ["Large guide", `Section ${index}`],
        level: 2,
        text: longText,
      })
    ),
  };

  const historyEntries = createHistoryEntries({
    extraction,
    url: "https://example.com/large-guide",
    capturedAt: 1_700_000_000_000,
    createId: () => "capture",
  });
  const bookmarkEntries = createBookmarkEntries({
    extraction,
    bookmark: {
      title: "Large guide",
      url: "https://example.com/large-guide",
    },
  });

  expect(historyEntries).toHaveLength(MAX_HISTORY_SECTIONS_PER_PAGE);
  expect(
    historyEntries.every(
      (item) => item.content.length <= MAX_HISTORY_SECTION_CHARS
    )
  ).toBe(true);
  expect(bookmarkEntries[0].content).toHaveLength(extraction.sections.length);
  expect(bookmarkEntries[0].content[0].content.length).toBeGreaterThan(
    MAX_HISTORY_SECTION_CHARS
  );
});

test("removes common site chrome before building heading sections", () => {
  const documentRef = parseDocument("<title>Article</title>");
  const sections = buildHeadingSections(
    documentRef,
    `
      <nav><p>Repeated navigation</p></nav>
      <aside><p>Repeated sidebar</p></aside>
      <div class="cookie-consent"><p>Accept cookies</p></div>
      <article><h1>Main topic</h1><p>Useful article content.</p></article>
      <footer><p>Repeated footer</p></footer>
    `,
    "Article"
  );

  expect(sections).toEqual([
    {
      headingPath: ["Article", "Main topic"],
      level: 1,
      text: "Useful article content.",
    },
  ]);
});

test("creates bookmark sections using the same heading-aware contract", () => {
  const entries = createBookmarkEntries({
    extraction: {
      title: "Docs",
      sections: [
        {
          headingPath: ["Docs", "Install"],
          level: 1,
          text: "Install instructions.",
        },
      ],
    },
    bookmark: {
      title: "Saved docs",
      url: "https://docs.example.com/install",
      folder: "Bookmarks bar / Research",
      domain: "docs.example.com",
      date: 123,
    },
  });

  expect(entries).toEqual([
    {
      title: "Saved docs",
      url: "https://docs.example.com/install",
      content: [
        {
          content: "Install instructions.",
          heading_path: ["Docs", "Install"],
          heading_level: 1,
          section_index: 0,
        },
      ],
      folder: "Bookmarks bar / Research",
      domain: "docs.example.com",
      date: 123,
    },
  ]);
});
