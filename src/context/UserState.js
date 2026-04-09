import React, { useCallback, useReducer } from "react";
import { userContext } from "./userContext";
import { initializeUserId } from "../components/UserId";

const initialState = {
  activeTab: "history", // "history" | "bookmark" | "combined"
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
  updateFlag: false,
  syncing: false,
  format: null,
  step: null,
  finalReceived: false,
};

const userReducer = (state, action) => {
  switch (action.type) {
    case "SET_STATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

const UserState = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);

  const setState = useCallback((payload) => {
    dispatch({ type: "SET_STATE", payload });
  }, []);

  const syncCombined = useCallback(
    async (host, historyData, bookmarkData, userId) => {
      const cappedHistory = historyData.slice(-50);
      const sortedBookmarks = [...bookmarkData].sort((a, b) => b.date - a.date);
      const halfCount = Math.ceil(sortedBookmarks.length / 2);
      const cappedBookmarks = sortedBookmarks.slice(0, halfCount);
      try {
        await fetch(`${host}/save-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: cappedHistory,
            userId: `${userId}:c`,
            flag: "combined",
            bookmarks: cappedBookmarks,
          }),
        });
      } catch (error) {
        setState({ noti: "There is a problem syncing combined data" });
      }
    },
    [setState],
  );

  const syncBookmarks = useCallback(
    async (host, bookmarkData, userId) => {
      if (!bookmarkData || bookmarkData.length === 0) return;
      try {
        await fetch(`${host}/save-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: bookmarkData,
            userId: `${userId}:b`,
            flag: "bookmark",
          }),
        });
      } catch (error) {
        setState({ noti: "There is a problem syncing bookmarks" });
      }
    },
    [setState],
  );

  const syncHistory = useCallback(
    async (host, historyData, userId) => {
      if (!historyData || historyData.length === 0) {
        setState({ syncing: false });
        return;
      }

      setState({ syncing: true });
      try {
        await fetch(`${host}/save-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: historyData,
            userId: `${userId}:h`,
            flag: "history",
          }),
        });
      } catch (error) {
        setState({ noti: "There is a problem syncing data" });
      } finally {
        setState({ syncing: false });
      }
    },
    [setState],
  );

  const initializePopup = useCallback(
    async (host) => {
      const result = await chrome.storage.local.get({ navigationData: [] });
      const uid = await initializeUserId();
      const upflag = await chrome.storage.local.get("sm-update-flag-v1.75");
      setState({
        data: result,
        userId: uid,
        updateFlag: Boolean(upflag["sm-update-flag-v1.75"]),
      });
    },
    [setState],
  );

  const searchStream = useCallback(
    async ({ host, query, userId, flag }) => {
      setState({
        loading: true,
        disable: true,
        noti: "Retrieving sources...",
        docs: [],
        head: "",
        parsed: { summary: "", url: null },
        format: null,
        step: null,
        finalReceived: false,
      });

      try {
        const response = await fetch(`${host}/search-stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: `${userId}:${flag === "history" ? "h" : flag === "bookmark" ? "b" : "c"}`,
            query,
            flag,
          }),
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
            let event;
            try {
              event = JSON.parse(payload);
            } catch (error) {
              continue;
            }

            const step = event.step;
            const data = event.data || {};

            if (step === "retrieved_parents") {
              const count = data.count || 0;
              setState({
                step: {
                  step,
                  title: "Retrieved Sources",
                  content: `${count} sources`,
                },
              });
              setState({ noti: `Retrieved ${count} sources...` });
            } else if (step === "llm_response") {
              setState({
                step: {
                  step,
                  title: "LLM Response",
                  content: data.text || "",
                },
              });
              setState({
                // head: data.text || "",
                noti: "Generating response...",
              });
            } else if (step === "output_parser") {
              setState({
                step: {
                  step,
                  title: "Structuring Output",
                  content: data.format || {},
                },
              });
              setState({
                // format: data.format || null,
                noti: "Structuring output...",
              });
            } else if (step === "post_processing") {
              const validatedDocs = data.validated_docs || 0;
              setState({
                step: {
                  step,
                  title: "Validating Results with Query",
                  content: `${validatedDocs} validated`,
                },
              });
              setState({ noti: "Validating results..." });
            } else if (step === "final") {
              const finalDocs = data.docs || [];
              setState({
                docs: finalDocs,
                head: finalDocs.length === 0 ? "" : data.result || "",
                format: finalDocs.length === 0 ? null : data.format || null,
                loading: false,
                disable: false,
                noti:
                  finalDocs.length === 0
                    ? "No results found for this query"
                    : "",
                step: null,
                finalReceived: true,
              });
              return;
            } else if (step === "error") {
              setState({
                noti: data.message || "There is a problem generating response",
                loading: false,
                disable: false,
                step: null,
                finalReceived: true,
              });
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
        setState({
          noti: "There is a problem generating response",
          loading: false,
          disable: false,
          step: null,
          finalReceived: true,
        });
      }
    },
    [setState],
  );

  return (
    <userContext.Provider
      value={{ state, setState, initializePopup, syncHistory, syncBookmarks, syncCombined, searchStream }}
    >
      {children}
    </userContext.Provider>
  );
};

export default UserState;
