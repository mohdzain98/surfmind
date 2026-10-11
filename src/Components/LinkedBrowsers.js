import { useState } from "react";
import {
  ChevronDown,
  Laptop,
  Pencil,
  Save,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";
import { normalizeDeviceName } from "../services/deviceName";

const formatRelativeTime = (value) => {
  if (!value) return "Not synced yet";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not synced yet";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
};

const formatLinkedDate = (value) => {
  if (!value) return "Link date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Link date unavailable";
  return `Linked ${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
};

const getDeviceIcon = (name) =>
  /android|iphone|ipad|mobile/i.test(name) ? Smartphone : Laptop;

const LinkedBrowsers = ({ devices, onRename, onUnlink, busy }) => {
  const [editingUuid, setEditingUuid] = useState("");
  const [draftName, setDraftName] = useState("");
  const [rowError, setRowError] = useState(null);
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const beginEditing = (device) => {
    setRowError(null);
    setEditingUuid(device.browserUuid);
    setDraftName(device.deviceName);
  };

  const cancelEditing = () => {
    setEditingUuid("");
    setDraftName("");
    setRowError(null);
  };

  const saveName = async (device) => {
    const nextName = normalizeDeviceName(draftName);
    try {
      await onRename(device, nextName);
      cancelEditing();
    } catch (error) {
      setRowError({ uuid: device.browserUuid, text: error.message });
    }
  };

  return (
    <section className="linked-devices" aria-labelledby="linked-devices-title">
      <button
        type="button"
        className={`linked-devices-heading ${expanded ? "is-expanded" : ""}`}
        aria-expanded={expanded}
        aria-controls="linked-device-list"
        onClick={() => setExpanded((current) => !current)}
      >
        <div>
          <h3 id="linked-devices-title">Linked browsers</h3>
          <p>Name browsers so cross-browser results are easy to recognize.</p>
        </div>
        <span className="linked-devices-heading-actions">
          <span className="linked-devices-count">{devices.length}</span>
          <ChevronDown
            className="linked-devices-chevron"
            size={16}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded ? (
        <div className="linked-device-list" id="linked-device-list">
          {devices.map((device) => {
            const DeviceIcon = getDeviceIcon(device.deviceName);
            const isEditing = editingUuid === device.browserUuid;
            return (
              <div className="linked-device-row" key={device.browserUuid}>
                <span className="linked-device-icon" aria-hidden="true">
                  <DeviceIcon size={17} />
                </span>
                <div className="linked-device-copy">
                  {isEditing ? (
                    <input
                      className="form-control form-control-sm linked-device-input"
                      value={draftName}
                      maxLength={40}
                      autoFocus
                      aria-label={`Rename ${device.deviceName}`}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveName(device);
                        if (event.key === "Escape") cancelEditing();
                      }}
                    />
                  ) : (
                    <div className="linked-device-name">
                      <strong title={device.deviceName}>
                        {device.deviceName}
                      </strong>
                      {device.isCurrent ? <span>This browser</span> : null}
                    </div>
                  )}
                  <small>
                    {formatRelativeTime(device.lastSyncedAt)} ·{" "}
                    {formatLinkedDate(device.linkedAt)}
                  </small>
                  {rowError?.uuid === device.browserUuid ? (
                    <small className="linked-device-error" role="alert">
                      {rowError.text}
                    </small>
                  ) : null}
                </div>
                <div className="linked-device-actions">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveName(device)}
                        disabled={busy}
                        aria-label="Save browser name"
                        title="Save"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={busy}
                        aria-label="Cancel renaming"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => beginEditing(device)}
                        disabled={busy}
                        aria-label={`Rename ${device.deviceName}`}
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      {!device.isCurrent ? (
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => setUnlinkTarget(device)}
                          disabled={busy}
                          aria-label={`Unlink ${device.deviceName}`}
                          title="Unlink"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {unlinkTarget ? (
        <ConfirmationDialog
          title={`Unlink ${unlinkTarget.deviceName}?`}
          description={
            <p>
              This browser will stop syncing with this account. Its saved data
              will not be deleted.
            </p>
          }
          busy={busy}
          confirmLabel="Unlink Browser"
          busyLabel="Unlinking…"
          ConfirmIcon={Trash2}
          onCancel={() => setUnlinkTarget(null)}
          onConfirm={async () => {
            try {
              await onUnlink(unlinkTarget);
              setUnlinkTarget(null);
            } catch (error) {
              setRowError({
                uuid: unlinkTarget.browserUuid,
                text: error.message,
              });
              setUnlinkTarget(null);
            }
          }}
        />
      ) : null}
    </section>
  );
};

export default LinkedBrowsers;
