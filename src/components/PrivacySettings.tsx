import { useEffect, useState } from "react";
import { History, ShieldCheck, Trash2 } from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";
import { getErrorText } from "../services/userFacingError";
import type { NavigationEntry, SyncStatus } from "../types";
import {
  DEFAULT_HISTORY_RANGE,
  HISTORY_RANGE_OPTIONS,
  PRIVACY_POLICY_URL,
  clearAllDataLocal,
  clearHistoryLocal,
  deleteAllData,
  deleteHistoryData,
  resolveHistoryRange,
  type HistoryRange,
} from "../services/privacy";

type DialogType = "history" | "all";

interface Message {
  tone: "success" | "danger";
  text: string;
}

interface PrivacySettingsProps {
  host: string;
  browserUuid: string;
  onHistoryCleared?: (
    remainingHistory: NavigationEntry[]
  ) => void | Promise<void>;
  onAllDataCleared?: (nextBrowserUuid: string) => void | Promise<void>;
}

const SYNC_STATUS_KEY = "crossBrowserSyncStatus";

const PrivacySettings = ({
  host,
  browserUuid,
  onHistoryCleared,
  onAllDataCleared,
}: PrivacySettingsProps) => {
  const [dialog, setDialog] = useState<DialogType | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [historyRange, setHistoryRange] = useState<HistoryRange>(
    DEFAULT_HISTORY_RANGE
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    let mounted = true;
    chrome.storage.local
      .get<Record<string, { isLinked?: boolean }>>({
        [SYNC_STATUS_KEY]: { isLinked: false },
      })
      .then((stored) => {
        if (mounted) setIsLinked(Boolean(stored[SYNC_STATUS_KEY]?.isLinked));
      });

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local" || !changes[SYNC_STATUS_KEY]) return;
      setIsLinked(
        Boolean((changes[SYNC_STATUS_KEY].newValue as SyncStatus)?.isLinked)
      );
    };
    chrome.storage.onChanged?.addListener(handleStorageChange);
    return () => {
      mounted = false;
      chrome.storage.onChanged?.removeListener(handleStorageChange);
    };
  }, []);

  const openDialog = (type: DialogType): void => {
    setConfirmation("");
    if (type === "history") setHistoryRange(DEFAULT_HISTORY_RANGE);
    setMessage(null);
    setDialog(type);
  };

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setConfirmation("");
  };

  const handleClearHistory = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await deleteHistoryData(host, browserUuid, historyRange);
      const resolvedRange = response?.range
        ? resolveHistoryRange(response.range)
        : historyRange;
      const remainingHistory = await clearHistoryLocal(resolvedRange);
      setDialog(null);
      setMessage({
        tone: "success",
        text: `${
          HISTORY_RANGE_OPTIONS.find((option) => option.value === resolvedRange)
            ?.label || "Selected history"
        } was cleared from SurfMind.`,
      });
      await onHistoryCleared?.(remainingHistory);
    } catch (error) {
      setMessage({ tone: "danger", text: getErrorText(error) });
    }
    setBusy(false);
  };

  const handleClearAll = async () => {
    if (confirmation !== "CLEAR") return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteAllData(host, browserUuid);
      const nextBrowserUuid = await clearAllDataLocal();
      setDialog(null);
      setConfirmation("");
      setBusy(false);
      await onAllDataCleared?.(nextBrowserUuid);
    } catch (error) {
      setMessage({ tone: "danger", text: getErrorText(error) });
      setBusy(false);
    }
  };

  const actionsDisabled = busy || !host || !browserUuid;

  return (
    <section
      className="privacy-settings"
      aria-labelledby="privacy-settings-title"
    >
      <div className="privacy-settings-heading">
        <h2 id="privacy-settings-title" className="h6 mb-1">
          Privacy
        </h2>
        <p className="text-muted small mb-0">
          Control what SurfMind stores about your browsing.
        </p>
      </div>

      <article className="privacy-filtering-card">
        <span className="privacy-filtering-icon" aria-hidden="true">
          <ShieldCheck size={17} />
        </span>
        <div>
          <h3>Content filtering</h3>
          <p>
            SurfMind skips known adult and malicious sites. Checks run on your
            device, and flagged pages are never sent to our servers.{" "}
            <a
              href={`${PRIVACY_POLICY_URL}#content-filtering`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
            </a>
          </p>
        </div>
      </article>

      <div className="privacy-action">
        <div>
          <h3>Clear History</h3>
          <p>
            Removes your browsing history and its search index. Bookmarks and
            recent searches are kept.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={() => openDialog("history")}
          disabled={actionsDisabled}
        >
          <History size={13} aria-hidden="true" />
          Clear History
        </button>
      </div>

      <div className="privacy-action privacy-action-all">
        <div>
          <h3>Clear All Data</h3>
          <p>Removes history, bookmarks, and recent searches.</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => openDialog("all")}
          disabled={actionsDisabled}
        >
          <Trash2 size={13} aria-hidden="true" />
          Clear All Data
        </button>
      </div>

      {message ? (
        <div
          className={`alert alert-${message.tone} py-2 mt-3 mb-0`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      {dialog ? (
        <ConfirmationDialog
          title={
            dialog === "all" ? "Clear all your data?" : "Clear your history?"
          }
          description={
            dialog === "all" ? (
              <>
                <p>
                  This permanently removes your history, bookmarks, and recent
                  searches from SurfMind
                  {isLinked ? " on this browser and every linked browser" : ""}.
                </p>
                <p>This cannot be undone.</p>
              </>
            ) : (
              <>
                <p>
                  Choose the time range to remove. Selecting All time removes
                  every saved history entry.
                </p>
                <p>
                  Bookmarks and recent searches are not affected. This cannot be
                  undone.
                </p>
              </>
            )
          }
          busy={busy}
          confirmDisabled={dialog === "all" && confirmation !== "CLEAR"}
          confirmLabel={dialog === "all" ? "Clear All Data" : "Clear History"}
          busyLabel="Clearing…"
          ConfirmIcon={dialog === "all" ? Trash2 : History}
          onCancel={closeDialog}
          onConfirm={dialog === "all" ? handleClearAll : handleClearHistory}
        >
          {dialog === "history" ? (
            <fieldset className="privacy-history-ranges">
              <legend>Time range</legend>
              {HISTORY_RANGE_OPTIONS.map((option) => (
                <label key={option.value} className="privacy-history-range">
                  <input
                    type="radio"
                    name="history-range"
                    value={option.value}
                    checked={historyRange === option.value}
                    onChange={() => setHistoryRange(option.value)}
                    disabled={busy}
                  />
                  <span>{option.label}</span>
                  {option.value === DEFAULT_HISTORY_RANGE ? (
                    <small>Default</small>
                  ) : null}
                </label>
              ))}
            </fieldset>
          ) : dialog === "all" ? (
            <label
              className="privacy-confirm-label"
              htmlFor="clear-data-confirm"
            >
              Type <strong>CLEAR</strong> to confirm
              <input
                id="clear-data-confirm"
                className="form-control form-control-sm mt-1"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                autoFocus
              />
            </label>
          ) : null}
        </ConfirmationDialog>
      ) : null}
    </section>
  );
};

export default PrivacySettings;
