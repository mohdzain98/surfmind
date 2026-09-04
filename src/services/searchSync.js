export const flushBeforeSearch = async ({
  flag,
  host,
  flushHistory,
  flushBookmarks,
}) => {
  const syncTasks = [];
  if (flag === "history" || flag === "combined") {
    syncTasks.push(flushHistory(host));
  }
  if (flag === "bookmark" || flag === "combined") {
    syncTasks.push(flushBookmarks(host, "pre-query"));
  }
  return Promise.all(syncTasks);
};
