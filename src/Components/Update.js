import {
  ArrowRight,
  Clock3,
  Link2,
  PanelRightOpen,
  SearchCheck,
  Sparkles,
} from "lucide-react";

const MAJOR_HIGHLIGHTS = [
  {
    Icon: PanelRightOpen,
    title: "A side panel that stays with you",
    description:
      "A fresh design now lives in Chrome’s side panel, keeping SurfMind open across tabs.",
  },
  {
    Icon: SearchCheck,
    title: "Better retrieval quality",
    description:
      "Upgraded section-aware search finds stronger context for more relevant answers.",
  },
  {
    Icon: Link2,
    title: "Pick up where you left off",
    description:
      "Link browsers with a one-time code—no login, no account. Your history follows you.",
  },
  {
    Icon: Clock3,
    title: "Return to recent searches",
    description:
      "Reopen previous answers and their sources without running the same search again.",
  },
];

const Update = ({ severity = "minor", handleShowUpdate }) => {
  if (severity === "major") {
    return (
      <main className="update-takeover" aria-labelledby="major-update-title">
        <section className="update-takeover-card">
          <div className="update-takeover-icon" aria-hidden="true">
            <Sparkles size={25} />
          </div>
          <span className="update-eyebrow">Meet the new SurfMind</span>
          <h1 id="major-update-title">SurfMind, reimagined.</h1>
          <p className="update-intro">
            Your browsing assistant has moved from a popup into a persistent,
            smarter side panel.
          </p>

          <div className="update-highlights">
            {MAJOR_HIGHLIGHTS.map(({ Icon, title, description }) => (
              <div className="update-highlight" key={title}>
                <span className="update-highlight-icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary update-cta"
            onClick={handleShowUpdate}
          >
            Let&apos;s Surf
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  }

  return (
    <div
      className="update-banner alert alert-success alert-dismissible fade show mt-3"
      role="alert"
    >
      <div className="d-flex flex-column justify-content-start mb-2">
        <h5 className="alert-heading mb-0">What&apos;s New!</h5>
      </div>
      <p className="update-banner-copy">
        <ArrowRight size={14} aria-hidden="true" />
        <span>SurfMind has new improvements ready for you.</span>
      </p>
      <button
        type="button"
        className="btn-close"
        aria-label="Close"
        onClick={handleShowUpdate}
      />
    </div>
  );
};

export default Update;
