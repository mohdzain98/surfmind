import { createBrowserIdentity } from "./syncApi";

export const buildSearchRequest = ({ browserUuid, query, flag, folder }) => ({
  ...createBrowserIdentity(browserUuid),
  query,
  flag,
  ...(folder && flag !== "history" ? { folder } : {}),
});
