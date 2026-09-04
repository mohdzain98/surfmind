import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";
import {
  clearAllDataLocal,
  clearHistoryLocal,
  deleteAllData,
  deleteHistoryData,
} from "../services/privacy";

const SYNC_STATUS_KEY = "crossBrowserSyncStatus";

const PrivacySettings = ({
  host,
  browserUuid,
  onHistoryCleared,
  onAllDataCleared,
}) => {
  const [dialog, setDialog] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    let mounted = true;
    chrome.storage.local
      .get({ [SYNC_STATUS_KEY]: { isLinked: false } })
      .then((stored) => {
        if (mounted) setIsLinked(Boolean(stored[SYNC_STATUS_KEY]?.isLinked));
      });

    const handleStorageChange = (changes, areaName) => {
      if (areaName !== "local" || !changes[SYNC_STATUS_KEY]) return;
      setIsLinked(Boolean(changes[SYNC_STATUS_KEY].newValue?.isLinked));
    };
    chrome.storage.onChanged?.addListener(handleStorageChange);
    return () => {
      mounted = false;
      chrome.storage.onChanged?.removeListener(handleStorageChange);
    };
  }, []);

  const openDialog = (type) => {
    setConfirmation("");
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
      await deleteHistoryData(host, browserUuid);
      await clearHistoryLocal();
      setDialog(null);
      setMessage({
        tone: "success",
        text: "Your SurfMind history was cleared.",
      });
      await onHistoryCleared?.();
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
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
      setMessage({ tone: "danger", text: error.message });
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
              <p>
                This removes your browsing history and its search index from
                SurfMind. Bookmarks and recent searches are not affected. This
                cannot be undone.
              </p>
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
          {dialog === "all" ? (
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
