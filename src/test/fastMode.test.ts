import {
  DEFAULT_FAST_MAX_RESULTS,
  DEFAULT_FAST_STRICTNESS,
  DEFAULT_SEARCH_MODE,
  normalizeFastMaxResults,
  normalizeFastStrictness,
  normalizeSearchMode,
  persistFastModePreferences,
  readFastModePreferences,
} from "../services/fastMode";

beforeEach(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as typeof chrome;
});

test("falls back to safe Fast Mode defaults for invalid values", () => {
  expect(normalizeSearchMode("unknown")).toBe(DEFAULT_SEARCH_MODE);
  expect(normalizeFastStrictness("strict")).toBe(DEFAULT_FAST_STRICTNESS);
  expect(normalizeFastMaxResults(20)).toBe(DEFAULT_FAST_MAX_RESULTS);
});

test("reads and normalizes the per-browser preferences", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({
    searchMode: "fast",
    fastStrictness: "precise",
    fastMaxResults: 8,
  });

  await expect(readFastModePreferences()).resolves.toEqual({
    searchMode: "fast",
    fastStrictness: "precise",
    fastMaxResults: 8,
  });
});

test("persists only normalized preference updates", async () => {
  await persistFastModePreferences({
    searchMode: "fast",
    fastStrictness: "broad",
    fastMaxResults: 3,
  });

  expect(chrome.storage.local.set).toHaveBeenCalledWith({
    searchMode: "fast",
    fastStrictness: "broad",
    fastMaxResults: 3,
  });
});
