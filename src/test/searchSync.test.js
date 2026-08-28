import { flushBeforeSearch } from "../services/searchSync";

const createFlushes = () => ({
  flushHistory: jest.fn(async () => ({ success: true })),
  flushBookmarks: jest.fn(async () => ({ success: true })),
});

test.each([
  ["history", 1, 0],
  ["bookmark", 0, 1],
  ["combined", 1, 1],
])(
  "flushes the required sources before a %s search",
  async (flag, historyCalls, bookmarkCalls) => {
    const flushes = createFlushes();

    await flushBeforeSearch({
      flag,
      host: "https://api.example.com/v1",
      ...flushes,
    });

    expect(flushes.flushHistory).toHaveBeenCalledTimes(historyCalls);
    expect(flushes.flushBookmarks).toHaveBeenCalledTimes(bookmarkCalls);
    if (bookmarkCalls) {
      expect(flushes.flushBookmarks).toHaveBeenCalledWith(
        "https://api.example.com/v1",
        "pre-query",
      );
    }
  },
);
