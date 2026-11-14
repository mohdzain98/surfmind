import type { ApiPayload, SearchDoc, SearchFlag } from "../types";

const withSourceType = (doc: SearchDoc, type: SearchFlag): SearchDoc => ({
  ...doc,
  type: doc.type || type,
  metadata: {
    ...(doc.metadata || {}),
    type: doc.metadata?.type || doc.type || type,
  },
});

const normalizeGroup = (value: unknown, type: SearchFlag): SearchDoc[] =>
  Array.isArray(value)
    ? value.map((doc) => withSourceType(doc as SearchDoc, type))
    : [];

export const normalizeFastResults = (
  data: ApiPayload,
  flag: SearchFlag
): SearchDoc[] => {
  if (Array.isArray(data.results)) {
    return data.results.map((doc: SearchDoc) =>
      withSourceType(
        doc,
        (doc.type || doc.metadata?.type || flag) as SearchFlag
      )
    );
  }

  const grouped = data.results || {};
  const history = normalizeGroup(
    grouped.history || data.history_results || data.history,
    "history"
  );
  const bookmarks = normalizeGroup(
    grouped.bookmarks ||
      grouped.bookmark ||
      data.bookmark_results ||
      data.bookmarks,
    "bookmark"
  );
  return [...history, ...bookmarks];
};
