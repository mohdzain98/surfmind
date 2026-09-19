import { Clock3, Star, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { EXTENSION_STORE_NAME } from "../services/storeConfig";

const RatePromptBanner = ({ mode, onRate, onLater, onDismiss }) => {
  const bannerRef = useRef(null);

  useEffect(() => {
    bannerRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  return (
    <aside
      ref={bannerRef}
      className={`rate-prompt-banner mode-${mode}`}
      aria-labelledby="rate-prompt-title"
    >
      <div className="rate-prompt-copy">
        <span className="rate-prompt-icon" aria-hidden="true">
          <Star size={16} />
        </span>
        <div>
          <h2 id="rate-prompt-title">Enjoying SurfMind?</h2>
          <p>A quick {EXTENSION_STORE_NAME} review helps a lot.</p>
        </div>
      </div>
      <div className="rate-prompt-actions">
        <button type="button" className="rate-prompt-primary" onClick={onRate}>
          <Star size={13} aria-hidden="true" />
          Rate on {EXTENSION_STORE_NAME}
        </button>
        <button
          type="button"
          className="rate-prompt-secondary"
          onClick={onLater}
        >
          <Clock3 size={13} aria-hidden="true" />
          Maybe later
        </button>
        <button type="button" className="rate-prompt-ghost" onClick={onDismiss}>
          <X size={13} aria-hidden="true" />
          No thanks
        </button>
      </div>
    </aside>
  );
};

export default RatePromptBanner;
