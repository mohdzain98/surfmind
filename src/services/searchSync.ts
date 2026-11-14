import type { SearchFlag } from "../types";

interface FlushBeforeSearchInput {
  flag: SearchFlag;
  host: string;
  flushHistory: (host: string) => Promise<unknown>;
  flushBookmarks: (host: string, reason: string) => Promise<unknown>;
}

export const flushBeforeSearch = async ({
  flag,
  host,
  flushHistory,
  flushBookmarks,
}: FlushBeforeSearchInput): Promise<unknown[]> => {
  const syncTasks: Promise<unknown>[] = [];
  if (flag === "history" || flag === "combined") {
    syncTasks.push(flushHistory(host));
  }
  if (flag === "bookmark" || flag === "combined") {
    syncTasks.push(flushBookmarks(host, "pre-query"));
  }
  return Promise.all(syncTasks);
};
