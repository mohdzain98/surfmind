(function attachStructuredExtraction(globalScope) {
  const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
  const CONTENT_SELECTOR = `${HEADING_SELECTOR}, p, pre, blockquote, li, td, th`;
  const NESTED_CONTENT_SELECTOR = "p, pre, blockquote, ul, ol, table";

  const normalizeText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const createContainer = (documentRef, html) => {
    const container = documentRef.createElement("div");
    container.innerHTML = html;
    return container;
  };

  const buildHeadingSections = (documentRef, cleanedHtml, pageTitle) => {
    const title = normalizeText(pageTitle) || "Untitled page";
    const container = createContainer(documentRef, cleanedHtml);
    const sections = [];
    const sectionsByPath = new Map();
    const headingStack = [];
    let current = { headingPath: [title], level: 0, textParts: [] };

    const flushCurrent = () => {
      const text = normalizeText(current.textParts.join("\n"));
      if (!text) return;
      const pathKey = JSON.stringify(current.headingPath);
      const existing = sectionsByPath.get(pathKey);
      if (existing) {
        existing.text = normalizeText(`${existing.text}\n${text}`);
        return;
      }
      const section = {
        headingPath: current.headingPath,
        level: current.level,
        text,
      };
      sections.push(section);
      sectionsByPath.set(pathKey, section);
    };

    for (const node of container.querySelectorAll(CONTENT_SELECTOR)) {
      if (/^H[1-6]$/.test(node.tagName)) {
        const heading = normalizeText(node.textContent);
        if (!heading) continue;

        flushCurrent();
        const level = Number.parseInt(node.tagName.slice(1), 10);
        headingStack.length = level - 1;
        headingStack[level - 1] = heading;
        current = {
          headingPath: [title, ...headingStack.filter(Boolean)],
          level,
          textParts: [],
        };
        continue;
      }

      if (node.matches("li") && node.querySelector(NESTED_CONTENT_SELECTOR)) {
        continue;
      }

      const text = normalizeText(node.textContent);
      if (text) current.textParts.push(text);
    }

    flushCurrent();
    return sections;
  };

  const getFallbackText = (documentRef) => {
    const clone = documentRef.cloneNode(true);
    for (const element of clone.querySelectorAll(
      "script, style, noscript, nav, footer, aside, form, dialog",
    )) {
      element.remove();
    }
    const main = clone.querySelector("main, article, [role='main']") || clone.body;
    return normalizeText(main?.textContent);
  };

  const createSingleSection = (title, text) => [
    {
      headingPath: [title],
      level: 0,
      text: normalizeText(text),
    },
  ];

  const extractStructuredContent = (documentRef, ReadabilityConstructor) => {
    const fallbackTitle = normalizeText(documentRef.title) || "Untitled page";

    try {
      const article = new ReadabilityConstructor(
        documentRef.cloneNode(true),
      ).parse();
      if (article?.content) {
        const title = normalizeText(article.title) || fallbackTitle;
        const sections = buildHeadingSections(
          documentRef,
          article.content,
          title,
        );
        if (sections.length > 1) {
          return {
            title,
            sections,
            extractionMethod: "readability",
          };
        }

        const articleText = normalizeText(article.textContent);
        if (articleText) {
          return {
            title,
            sections: createSingleSection(title, articleText),
            extractionMethod: "readability-fallback",
          };
        }
      }
    } catch (error) {
      console.warn("Readability extraction failed; using page fallback.", error);
    }

    return {
      title: fallbackTitle,
      sections: createSingleSection(
        fallbackTitle,
        getFallbackText(documentRef),
      ),
      extractionMethod: "dom-fallback",
    };
  };

  const createHistoryEntries = ({
    extraction,
    url,
    capturedAt,
    createId = () => crypto.randomUUID(),
  }) => {
    const visitedAt = new Date(capturedAt).toISOString();
    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch (error) {
      domain = "";
    }

    return extraction.sections
      .filter((section) => normalizeText(section.text))
      .map((section, sectionIndex) => ({
        title: extraction.title,
        url,
        content: normalizeText(section.text),
        heading_path: section.headingPath,
        heading_level: section.level,
        section_index: sectionIndex,
        domain,
        visited_at: visitedAt,
        date: visitedAt,
        capturedAt,
        captureId: createId(),
        synced: false,
      }));
  };

  const createBookmarkEntries = ({ extraction, bookmark }) => {
    const content = extraction.sections
      .filter((section) => normalizeText(section.text))
      .map((section, sectionIndex) => ({
        content: normalizeText(section.text),
        heading_path: section.headingPath,
        heading_level: section.level,
        section_index: sectionIndex,
      }));
    if (content.length === 0) return [];
    return [
      {
        title: bookmark.title || extraction.title,
        url: bookmark.url,
        content,
        folder: bookmark.folder,
        domain: bookmark.domain,
        date: bookmark.date,
      },
    ];
  };

  const exported = {
    buildHeadingSections,
    extractStructuredContent,
    createHistoryEntries,
    createBookmarkEntries,
  };
  globalScope.SurfMindStructuredExtraction = exported;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof self !== "undefined" ? self : globalThis);
