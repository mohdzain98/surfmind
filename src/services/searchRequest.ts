import type { SearchFlag, SearchRequest } from "../types";
import { createBrowserIdentity } from "./syncApi";

interface SearchRequestInput {
  browserUuid: string;
  query: string;
  flag: SearchFlag;
  folder?: string | null;
}

export const buildSearchRequest = ({
  browserUuid,
  query,
  flag,
  folder,
}: SearchRequestInput): SearchRequest => ({
  ...createBrowserIdentity(browserUuid),
  query,
  flag,
  ...(folder && flag !== "history" ? { folder } : {}),
});
