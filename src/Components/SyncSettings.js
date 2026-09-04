import { useCallback, useEffect, useState } from "react";
import { Check, Clipboard, Link2, Link2Off, RefreshCw } from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";
import {
  formatCountdown,
  generateSyncCode,
  getSyncStatus,
  normalizeSyncCode,
  redeemSyncCode,
  unlinkBrowser,
} from "../services/syncApi";

const STATUS_STORAGE_KEY = "crossBrowserSyncStatus";
const SOLO_STATUS = {
  isLinked: false,
  browserCount: 1,
  syncAccountId: "",
  tier: "free",
};

const SyncSettings = ({ host, browserUuid, onPairingChanged }) => {
  const [status, setStatus] = useState(SOLO_STATUS);
  const [generatedCode, setGeneratedCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [redeemCode, setRedeemCode] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [pairingView, setPairingView] = useState("generate");
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);

  const persistStatus = useCallback(async (nextStatus) => {
    setStatus(nextStatus);
    await chrome.storage.local.set({ [STATUS_STORAGE_KEY]: nextStatus });
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!host || !browserUuid) return;
    setBusyAction("status");
    try {
      const stored = await chrome.storage.local.get({
        [STATUS_STORAGE_KEY]: SOLO_STATUS,
      });
      setStatus(stored[STATUS_STORAGE_KEY] || SOLO_STATUS);
      const remoteStatus = await getSyncStatus(host, browserUuid);
      if (remoteStatus) await persistStatus(remoteStatus);
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      setBusyAction("");
    }
  }, [browserUuid, host, persistStatus]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const updateCountdown = () => {
      const nextRemaining = Math.max(0, expiresAt - Date.now());
      setRemainingMs(nextRemaining);
      if (nextRemaining === 0) {
        setGeneratedCode("");
        setExpiresAt(0);
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleGenerate = async () => {
    setBusyAction("generate");
    setMessage(null);
    setCopied(false);
    try {
      const result = await generateSyncCode(host, browserUuid);
      setGeneratedCode(result.code);
      setExpiresAt(result.expiresAt);
      setRemainingMs(Math.max(0, result.expiresAt - Date.now()));
      if (result.status.isLinked) await persistStatus(result.status);
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      setBusyAction("");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
    } catch (error) {
      setMessage({ tone: "danger", text: "Could not copy the sync code" });
    }
  };

  const handleRedeem = async (event) => {
    event.preventDefault();
    setBusyAction("redeem");
    setMessage(null);
    try {
      const nextStatus = await redeemSyncCode(
        host,
        browserUuid,
        redeemCode,
      );
      await persistStatus(nextStatus);
      setRedeemCode("");
      setMessage({
        tone: "success",
        text: "This browser is now linked to the shared history account.",
      });
      await onPairingChanged?.("paired");
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      setBusyAction("");
    }
  };

  const handleUnlink = async () => {
    setBusyAction("unlink");
    setMessage(null);
    try {
      const nextStatus = await unlinkBrowser(host, browserUuid);
      await persistStatus(nextStatus);
      setGeneratedCode("");
      setUnlinkDialogOpen(false);
      setMessage({
        tone: "success",
        text: "This browser now has its own separate history account.",
      });
      await onPairingChanged?.("unlinked");
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      setBusyAction("");
    }
  };

  const isBusy = Boolean(busyAction);

  return (
    <section className="sync-settings" aria-labelledby="sync-settings-title">
      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
        <div>
          <h2 id="sync-settings-title" className="h6 mb-1">
            Cross-browser sync
          </h2>
          <p className="text-muted small mb-0">
            Link browsers without creating an account.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary icon-button"
          onClick={refreshStatus}
          disabled={isBusy}
          aria-label="Refresh sync status"
          title="Refresh sync status"
        >
          <RefreshCw
            size={14}
            className={busyAction === "status" ? "spin" : ""}
          />
        </button>
      </div>

      <p className="sync-settings-description">
        Linked browsers can search the same saved history. Pair them with a
        short-lived code—no email or account is required.
      </p>

      <div className={`sync-status ${status.isLinked ? "is-linked" : ""}`}>
        <span className="sync-status-icon">
          {status.isLinked ? <Link2 size={16} /> : <Link2Off size={16} />}
        </span>
        <div>
          <strong>
            {status.isLinked ? "Browsers linked" : "This browser is solo"}
          </strong>
          <p className="mb-0">
            {status.isLinked
              ? `${status.browserCount} browsers share this history · ${status.tier} tier`
              : "Your history is not shared with another browser."}
          </p>
        </div>
      </div>

      <div
        className={`sync-pairing-switch ${
          pairingView === "link" ? "is-link-selected" : ""
        }`}
        role="tablist"
        aria-label="Choose how to link browsers"
      >
        <button
          type="button"
          role="tab"
          id="sync-generate-tab"
          className={pairingView === "generate" ? "is-active" : ""}
          aria-selected={pairingView === "generate"}
          aria-controls="sync-generate-panel"
          onClick={() => setPairingView("generate")}
        >
          <Clipboard size={13} aria-hidden="true" />
          Generate code
        </button>
        <button
          type="button"
          role="tab"
          id="sync-link-tab"
          className={pairingView === "link" ? "is-active" : ""}
          aria-selected={pairingView === "link"}
          aria-controls="sync-link-panel"
          onClick={() => setPairingView("link")}
        >
          <Link2 size={13} aria-hidden="true" />
          Link browser
        </button>
      </div>

      {pairingView === "generate" ? (
        <div
          className="sync-block sync-pairing-panel"
          id="sync-generate-panel"
          role="tabpanel"
          aria-labelledby="sync-generate-tab"
        >
          <h3 className="h6">Show a code on this browser</h3>
          <p className="text-muted small">
            Enter this one-time code on the browser you want to link.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleGenerate}
            disabled={isBusy || !host || !browserUuid}
          >
            <Clipboard size={13} aria-hidden="true" />
            {busyAction === "generate" ? "Generating…" : "Generate sync code"}
          </button>

          {generatedCode ? (
            <div className="sync-code-card" aria-live="polite">
              <code>{generatedCode}</code>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={handleCopy}
                aria-label="Copy sync code"
              >
                {copied ? <Check size={15} /> : <Clipboard size={15} />}
              </button>
              <span>Expires in {formatCountdown(remainingMs)}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <form
          className="sync-block sync-pairing-panel"
          id="sync-link-panel"
          role="tabpanel"
          aria-labelledby="sync-link-tab"
          onSubmit={handleRedeem}
        >
          <label htmlFor="sync-code-input" className="form-label h6">
            Enter a code from another browser
          </label>
          <input
            id="sync-code-input"
            className="form-control sync-code-input"
            value={redeemCode}
            onChange={(event) =>
              setRedeemCode(normalizeSyncCode(event.target.value))
            }
            placeholder="XXXXXXXX"
            autoComplete="off"
            inputMode="text"
            maxLength={8}
            aria-describedby="sync-code-help"
          />
          <div id="sync-code-help" className="form-text">
            Codes contain eight letters or numbers and expire after about ten
            minutes.
          </div>
          <button
            type="submit"
            className="btn btn-success btn-sm mt-2"
            disabled={isBusy || redeemCode.length !== 8 || !host || !browserUuid}
          >
            <Link2 size={13} aria-hidden="true" />
            {busyAction === "redeem" ? "Linking…" : "Link this browser"}
          </button>
        </form>
      )}

      {status.isLinked ? (
        <div className="sync-block sync-danger-zone">
          <h3 className="h6">Unlink this browser</h3>
          <p className="text-muted small">
            Other linked browsers stay connected. This browser returns to a
            separate history.
          </p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => {
              setMessage(null);
              setUnlinkDialogOpen(true);
            }}
            disabled={isBusy}
          >
            <Link2Off size={13} aria-hidden="true" />
            {busyAction === "unlink" ? "Unlinking…" : "Unlink browser"}
          </button>
        </div>
      ) : null}

      {message ? (
        <div
          className={`alert alert-${message.tone} py-2 mt-3 mb-0`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      {unlinkDialogOpen ? (
        <ConfirmationDialog
          title="Unlink this browser?"
          description={
            <p>
              This browser will stop sharing history with linked browsers and
              return to its own separate history. Other linked browsers stay
              connected. You will need a new code to link it again.
            </p>
          }
          busy={busyAction === "unlink"}
          confirmLabel="Unlink Browser"
          busyLabel="Unlinking…"
          ConfirmIcon={Link2Off}
          onCancel={() => setUnlinkDialogOpen(false)}
          onConfirm={handleUnlink}
        />
      ) : null}
    </section>
  );
};

export default SyncSettings;
