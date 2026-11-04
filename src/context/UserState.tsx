import React, { useCallback, useEffect, useReducer } from "react";
import type { ReactNode } from "react";
import type {
  ApiPayload,
  NavigationEntry,
  PairingAction,
  SearchStep,
  SearchStreamParams,
  SearchThoughtEntry,
  UserAction,
  UserContextValue,
  UserStateShape,
} from "../types";
import { userContext } from "./userContext";
import { initializeUserId } from "../components/UserId";
import { flushBeforeSearch } from "../services/searchSync";
import { recordSuccessfulSearch } from "../services/ratePrompt";
import { toUserFacingError } from "../services/userFacingError";
import { buildSearchRequest } from "../services/searchRequest";
import {
  LEGACY_UPDATE_VERSIONS,
  UPDATE_PREVIOUS_VERSION_KEY,
  UPDATE_VERSION_KEY,
  getStoredUpdateVersion,
  getUpdateNotice,
} from "../services/updateVersion";

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number
): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const syncConfig = {
  syncCountThreshold: parsePositiveInteger(
    process.env.REACT_APP_SYNC_COUNT_THRESHOLD,
    25
  ),
  syncTimeSafetyNetMin: parsePositiveInteger(
    process.env.REACT_APP_SYNC_TIME_SAFETY_NET_MIN,
    240
  ),
};

const initialState: UserStateShape = {
  activeTab: "history",
  query: "",
  head: "",
  parsed: { summary: "", url: null },
  loading: false,
  histLoader: false,
  disable: false,
  noti: "",
  data: { navigationData: [] },
  docs: [],
  userId: "",
  updateFlag: true,
  updateNotice: null,
  updateReady: false,
  updateVersion: "",
  syncing: false,
  format: null,
  step: null,
  thoughts: [],
  finalReceived: false,
  selectedBookmarkFolder: null,
};

const userReducer = (
  state: UserStateShape,
  action: UserAction
): UserStateShape => {
  switch (action.type) {
    case "SET_STATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

const UserState = ({ children }: { children?: ReactNode }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);

  const setState = useCallback((payload: Partial<UserStateShape>) => {
    dispatch({ type: "SET_STATE", payload });
  }, []);

  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local" || !changes.navigationData) return;
      setState({
        data: {
          navigationData:
            (changes.navigationData.newValue as NavigationEntry[]) || [],
        },
      });
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [setState]);

  const flushHistory = useCallback(async (host: string) => {
    const result = await chrome.runtime.sendMessage({
      action: "maybeSyncHistory",
      force: true,
      reason: "pre-query",
      host,
    });
    if (!result?.success) {
      throw new Error(
        toUserFacingError(
          result?.error,
          "SurfMind couldn’t sync your history. Please try again."
        )
      );
    }
    return result;
  }, []);

  const flushBookmarks = useCallback(
    async (host: string, reason = "manual") => {
      const result = await chrome.runtime.sendMessage({
        action: "maybeSyncBookmarks",
        reason,
        host,
      });
      if (!result?.success) {
        throw new Error(
          toUserFacingError(
            result?.error,
            "SurfMind couldn’t sync your bookmarks. Please try again."
          )
        );
      }
      return result;
    },
    []
  );

  const initializePopup = useCallback(
    async (host?: string) => {
      const currentVersion = chrome.runtime.getManifest().version;
      const updateDefaults = {
        [UPDATE_VERSION_KEY]: "",
        [UPDATE_PREVIOUS_VERSION_KEY]: "",
        ...Object.fromEntries(
          LEGACY_UPDATE_VERSIONS.map(({ key }) => [key, false])
        ),
      };
      const [result, uid, storedUpdate] = await Promise.all([
        chrome.storage.local.get<{ navigationData: NavigationEntry[] }>({
          navigationData: [],
        }),
        initializeUserId(),
        chrome.storage.local.get<Record<string, string | boolean>>(
          updateDefaults
        ),
      ]);
      const storedVersion = getStoredUpdateVersion(storedUpdate);
      const updateNotice = getUpdateNotice(storedVersion, currentVersion);
      await chrome.storage.local.set({
        ...(host ? { apiHost: host } : {}),
        ...syncConfig,
      });
      const pendingSync = chrome.runtime.sendMessage({
        action: "maybeSyncHistory",
        reason: "count",
        host,
      });
      setState({
        data: result,
        userId: uid,
        updateFlag: updateNotice === null,
        updateNotice,
        updateReady: true,
        updateVersion: currentVersion,
      });
      await pendingSync;
    },
    [setState]
  );

  const searchStream = useCallback(
    async ({
      host,
      query,
      userId,
      flag,
      folder = null,
    }: SearchStreamParams) => {
      let thoughtSequence = 0;
      let thoughts: SearchThoughtEntry[] = [];
      const appendThought = (
        message: string,
        currentStep: SearchStep | null = null,
        statePatch: Partial<UserStateShape> = {}
      ) => {
        const previous = thoughts[thoughts.length - 1];
        if (previous?.message !== message) {
          thoughts = [
            ...thoughts,
            {
              id: `search-thought-${thoughtSequence}`,
              message,
              step: currentStep,
            },
          ];
          thoughtSequence += 1;
        }
        setState({
          ...statePatch,
          noti: message,
          step: currentStep,
          thoughts,
        });
      };

      setState({
        loading: true,
        disable: true,
        noti: "",
        docs: [],
        head: "",
        parsed: { summary: "", url: null },
        format: null,
        step: null,
        thoughts: [],
        finalReceived: false,
      });

      try {
        appendThought("Syncing recent history...", null, { syncing: true });
        await flushBeforeSearch({
          flag,
          host,
          flushHistory,
          flushBookmarks,
        });
        appendThought("Retrieving sources...", null, { syncing: false });

        const response = await fetch(`${host}/search-stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildSearchRequest({
              browserUuid: userId,
              query,
              flag,
              folder,
            })
          ),
        });

        if (!response.ok || !response.body) {
          throw new Error("Streaming request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          for (const chunk of chunks) {
            const line = chunk.trim();
            if (!line.startsWith("data:")) continue;

            const payload = line.replace(/^data:\s*/, "");
            let event: ApiPayload;
            try {
              event = JSON.parse(payload);
            } catch (error) {
              continue;
            }

            const step = event.step;
            const data = event.data || {};

            if (step === "retrieved_parents") {
              const count = data.count || 0;
              const currentStep = {
                step,
                title: "Retrieved Sources",
                content: `${count} sources`,
              };
              appendThought(`Retrieved ${count} sources...`, currentStep);
            } else if (step === "llm_response") {
              const currentStep = {
                step,
                title: "LLM Response",
                content: data.text || "",
              };
              appendThought("Generating response...", currentStep);
            } else if (step === "output_parser") {
              const currentStep = {
                step,
                title: "Structuring Output",
                content: data.format || {},
              };
              appendThought("Structuring output...", currentStep);
            } else if (step === "post_processing") {
              const validatedDocs = data.validated_docs || 0;
              const currentStep = {
                step,
                title: "Validating Results with Query",
                content: `${validatedDocs} validated`,
              };
              appendThought("Validating results...", currentStep);
            } else if (step === "final") {
              const finalDocs = data.docs || [];
              if (finalDocs.length > 0) {
                try {
                  await recordSuccessfulSearch();
                } catch {
                  // Rating telemetry must never interrupt a completed search.
                }
              }
              setState({
                docs: finalDocs,
                head:
                  data.result ||
                  (finalDocs.length === 0
                    ? "No results found for this query."
                    : ""),
                format: finalDocs.length === 0 ? null : data.format || null,
                loading: false,
                disable: false,
                noti: "",
                step: null,
                thoughts,
                finalReceived: true,
              });
              return;
            } else if (step === "error") {
              appendThought(
                toUserFacingError(
                  data.message,
                  "SurfMind couldn’t generate a response. Please try again."
                ),
                null,
                {
                  loading: false,
                  disable: false,
                  finalReceived: true,
                }
              );
              return;
            }
          }
        }
        setState({
          loading: false,
          disable: false,
          finalReceived: true,
          step: null,
        });
      } catch (error) {
        appendThought(
          toUserFacingError(
            error,
            "SurfMind couldn’t generate a response. Please try again."
          ),
          null,
          {
            syncing: false,
            loading: false,
            disable: false,
            finalReceived: true,
          }
        );
      }
    },
    [flushBookmarks, flushHistory, setState]
  );

  const refreshAfterPairing = useCallback(
    async (host: string, action: PairingAction) => {
      setState({
        docs: [],
        head: "",
        parsed: { summary: "", url: null },
        format: null,
        step: null,
        finalReceived: false,
        syncing: true,
        noti:
          action === "paired"
            ? "Browser linked. Shared history is ready to search."
            : "Browser unlinked. New visits will use its separate history.",
      });
      try {
        await flushHistory(host);
      } catch (error) {
        setState({
          noti:
            action === "paired"
              ? "Browser linked. Recent local history will retry syncing automatically."
              : "Browser unlinked. Recent local history will retry syncing automatically.",
        });
      } finally {
        setState({ syncing: false });
      }
    },
    [flushHistory, setState]
  );

  const value: UserContextValue = {
    state,
    setState,
    initializePopup,
    flushBookmarks,
    searchStream,
    refreshAfterPairing,
  };

  return <userContext.Provider value={value}>{children}</userContext.Provider>;
};

export default UserState;
