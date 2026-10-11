import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Clipboard,
  Link2,
  Link2Off,
  RefreshCw,
} from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";
import LinkedBrowsers from "./LinkedBrowsers";
import {
  formatCountdown,
  generateSyncCode,
  getLinkedDevices,
  getSyncStatus,
  normalizeSyncCode,
  redeemSyncCode,
  renameLinkedDevice,
  unlinkBrowser,
  unlinkLinkedDevice,
} from "../services/syncApi";
import {
  buildDefaultDeviceName,
  normalizeDeviceName,
  resolveUniqueDeviceName,
} from "../services/deviceName";

const STATUS_STORAGE_KEY = "crossBrowserSyncStatus";
const SOLO_STATUS = {
  isLinked: false,
  browserCount: 1,
  syncAccountId: "",
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
  const [pairingView, setPairingView] = useState("");
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [devices, setDevices] = useState([]);
  const [defaultDeviceName] = useState(() => buildDefaultDeviceName());
  const [deviceName, setDeviceName] = useState(defaultDeviceName);

  const persistStatus = useCallback(async (nextStatus) => {
    setStatus(nextStatus);
    await chrome.storage.local.set({ [STATUS_STORAGE_KEY]: nextStatus });
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!host || !browserUuid) return [];
    const nextDevices = await getLinkedDevices(host, browserUuid);
    const sortedDevices = [...nextDevices].sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
      return (
        new Date(right.lastSyncedAt || 0).getTime() -
        new Date(left.lastSyncedAt || 0).getTime()
      );
    });
    setDevices(sortedDevices);
    const currentDevice = sortedDevices.find((device) => device.isCurrent);
    if (currentDevice?.deviceName) setDeviceName(currentDevice.deviceName);
    return sortedDevices;
  }, [browserUuid, host]);

  const refreshStatus = useCallback(async () => {
    if (!host || !browserUuid) return;
    setBusyAction("status");
    try {
      const stored = await chrome.storage.local.get({
        [STATUS_STORAGE_KEY]: SOLO_STATUS,
      });
      const storedStatus = stored[STATUS_STORAGE_KEY] || SOLO_STATUS;
      setStatus(storedStatus);
      const remoteStatus = await getSyncStatus(host, browserUuid);
      if (remoteStatus) {
        await persistStatus(remoteStatus);
        if (remoteStatus.isLinked) await refreshDevices();
        else setDevices([]);
      } else if (storedStatus.isLinked) {
        await refreshDevices();
      }
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      setBusyAction("");
    }
  }, [browserUuid, host, persistStatus, refreshDevices]);

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
      const result = await generateSyncCode(
        host,
        browserUuid,
        normalizeDeviceName(deviceName) || defaultDeviceName
      );
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
        normalizeDeviceName(deviceName) || defaultDeviceName
      );
      await persistStatus(nextStatus);
      const linkedDevices = await refreshDevices();
      const submittedName = normalizeDeviceName(deviceName);
      if (!submittedName || submittedName === defaultDeviceName) {
        const currentDevice = linkedDevices.find((device) => device.isCurrent);
        if (currentDevice) {
          const uniqueName = resolveUniqueDeviceName(
            submittedName || defaultDeviceName,
            browserUuid,
            linkedDevices
          );
          if (uniqueName !== currentDevice.deviceName) {
            const updated = await renameLinkedDevice(
              host,
              browserUuid,
              browserUuid,
              uniqueName
            );
            setDevices((currentDevices) =>
              currentDevices.map((item) =>
                item.browserUuid === browserUuid
                  ? {
                      ...item,
                      ...updated,
                      deviceName: updated.deviceName || uniqueName,
                    }
                  : item
              )
            );
            setDeviceName(uniqueName);
          }
        }
      }
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
      setDevices([]);
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

  const handleRenameDevice = async (device, nextName) => {
    const previousDevices = devices;
    const previousDeviceName = deviceName;
    const optimisticName =
      nextName ||
      (device.isCurrent
        ? defaultDeviceName
        : `Linked browser · ${device.browserUuid.slice(-4)}`);
    setDevices((currentDevices) =>
      currentDevices.map((item) =>
        item.browserUuid === device.browserUuid
          ? { ...item, deviceName: optimisticName }
          : item
      )
    );
    if (device.isCurrent) setDeviceName(optimisticName);
    try {
      const updated = await renameLinkedDevice(
        host,
        browserUuid,
        device.browserUuid,
        nextName
      );
      setDevices((currentDevices) =>
        currentDevices.map((item) =>
          item.browserUuid === device.browserUuid
            ? {
                ...item,
                ...updated,
                deviceName: updated.deviceName || optimisticName,
              }
            : item
        )
      );
      if (device.isCurrent) {
        setDeviceName(updated.deviceName || optimisticName);
      }
    } catch (error) {
      setDevices(previousDevices);
      if (device.isCurrent) setDeviceName(previousDeviceName);
      throw error;
    }
  };

  const handleUnlinkDevice = async (device) => {
    setBusyAction(`unlink-${device.browserUuid}`);
    setMessage(null);
    try {
      await unlinkLinkedDevice(host, browserUuid, device.browserUuid);
      await refreshDevices();
      const remoteStatus = await getSyncStatus(host, browserUuid);
      if (remoteStatus) await persistStatus(remoteStatus);
      setMessage({
        tone: "success",
        text: `${device.deviceName} was unlinked. No saved data was deleted.`,
      });
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
      throw error;
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
              ? `${status.browserCount} browsers share this history`
              : "Your history is not shared with another browser."}
          </p>
        </div>
      </div>

      <div className="sync-pairing-accordions">
        <button
          type="button"
          className="sync-pairing-trigger"
          id="sync-generate-trigger"
          aria-expanded={pairingView === "generate"}
          aria-controls="sync-generate-panel"
          onClick={() =>
            setPairingView((current) =>
              current === "generate" ? "" : "generate"
            )
          }
        >
          <span className="sync-pairing-trigger-icon" aria-hidden="true">
            <Clipboard size={14} />
          </span>
          <span>Show a code on this browser</span>
          <ChevronDown
            className="sync-pairing-chevron"
            size={16}
            aria-hidden="true"
          />
        </button>

        {pairingView === "generate" ? (
          <div
            className="sync-block sync-pairing-panel"
            id="sync-generate-panel"
            role="region"
            aria-labelledby="sync-generate-trigger"
          >
            <p className="text-muted small">
              Enter this one-time code on the browser you want to link.
            </p>
            <label
              htmlFor="sync-generate-device-name"
              className="form-label small"
            >
              Name this browser <span className="text-muted">(optional)</span>
            </label>
            <input
              id="sync-generate-device-name"
              className="form-control form-control-sm sync-device-name-input"
              value={deviceName}
              maxLength={40}
              onChange={(event) => setDeviceName(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2"
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
        ) : null}

        <button
          type="button"
          className="sync-pairing-trigger"
          id="sync-link-trigger"
          aria-expanded={pairingView === "link"}
          aria-controls="sync-link-panel"
          onClick={() =>
            setPairingView((current) => (current === "link" ? "" : "link"))
          }
        >
          <span className="sync-pairing-trigger-icon" aria-hidden="true">
            <Link2 size={14} />
          </span>
          <span>Enter a code from another browser</span>
          <ChevronDown
            className="sync-pairing-chevron"
            size={16}
            aria-hidden="true"
          />
        </button>

        {pairingView === "link" ? (
          <form
            className="sync-block sync-pairing-panel"
            id="sync-link-panel"
            role="region"
            aria-labelledby="sync-link-trigger"
            onSubmit={handleRedeem}
          >
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
              aria-label="Sync code"
              aria-describedby="sync-code-help"
            />
            <div id="sync-code-help" className="form-text">
              Codes contain eight letters or numbers and expire after about ten
              minutes.
            </div>
            <label
              htmlFor="sync-redeem-device-name"
              className="form-label small mt-2"
            >
              Name this browser <span className="text-muted">(optional)</span>
            </label>
            <input
              id="sync-redeem-device-name"
              className="form-control form-control-sm sync-device-name-input"
              value={deviceName}
              maxLength={40}
              onChange={(event) => setDeviceName(event.target.value)}
            />
            <button
              type="submit"
              className="btn btn-success btn-sm mt-2"
              disabled={
                isBusy || redeemCode.length !== 8 || !host || !browserUuid
              }
            >
              <Link2 size={13} aria-hidden="true" />
              {busyAction === "redeem" ? "Linking…" : "Link this browser"}
            </button>
          </form>
        ) : null}
      </div>

      {status.isLinked && devices.length > 0 ? (
        <LinkedBrowsers
          devices={devices}
          onRename={handleRenameDevice}
          onUnlink={handleUnlinkDevice}
          busy={isBusy}
        />
      ) : null}

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
