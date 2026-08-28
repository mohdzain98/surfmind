import { X } from "lucide-react";

const ConfirmationDialog = ({
  title,
  description,
  children,
  busy = false,
  confirmDisabled = false,
  confirmLabel,
  busyLabel,
  ConfirmIcon,
  confirmButtonClass = "btn-danger",
  onCancel,
  onConfirm,
}) => (
  <div className="privacy-dialog-backdrop">
    <section
      className="privacy-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
    >
      <h3 id="confirmation-dialog-title">{title}</h3>
      <div id="confirmation-dialog-description" className="privacy-dialog-copy">
        {description}
      </div>

      {children}

      <div className="privacy-dialog-actions">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={onCancel}
          disabled={busy}
        >
          <X size={13} aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          className={`btn btn-sm ${confirmButtonClass}`}
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
        >
          {ConfirmIcon ? <ConfirmIcon size={13} aria-hidden="true" /> : null}
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </section>
  </div>
);

export default ConfirmationDialog;
