import type {
  FastMaxResults,
  FastStrictness,
  SearchFlag,
  SearchMode,
  SearchRequest,
} from "../types";
import { createBrowserIdentity } from "./syncApi";

interface SearchRequestInput {
  browserUuid: string;
  query: string;
  flag: SearchFlag;
  folder?: string | null;
  mode: SearchMode;
  fastStrictness?: FastStrictness;
  maxResults?: FastMaxResults;
}

export const buildSearchRequest = ({
  browserUuid,
  query,
  flag,
  folder,
  mode,
  fastStrictness,
  maxResults,
}: SearchRequestInput): SearchRequest => ({
  ...createBrowserIdentity(browserUuid),
  query,
  flag,
  ...(folder && flag !== "history" ? { folder } : {}),
  ...(mode === "fast"
    ? {
        mode,
        fast_strictness: fastStrictness || "balanced",
        ...(maxResults ? { max_results: maxResults } : {}),
      }
    : {}),
});
