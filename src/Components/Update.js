import {
  ArrowRight,
  Clock3,
  FolderSearch,
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

const MINOR_UPDATE_CONTENT = {
  "1.80.4": {
    title: "Search inside bookmark folders",
    description:
      "Choose any bookmark folder to search only that folder and its subfolders.",
  },
};

const DEFAULT_MINOR_UPDATE = {
  title: "SurfMind just got better",
  description: "New improvements are ready for you.",
};

const Update = ({ severity = "minor", version, handleShowUpdate }) => {
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

  const content = MINOR_UPDATE_CONTENT[version] || DEFAULT_MINOR_UPDATE;

  return (
    <aside className="update-banner" aria-label="What’s new">
      <span className="update-banner-icon" aria-hidden="true">
        <FolderSearch size={16} />
      </span>
      <div className="update-banner-content">
        <span className="update-banner-label">New</span>
        <strong>{content.title}</strong>
        <p>{content.description}</p>
      </div>
      <button
        type="button"
        className="btn-close update-banner-close"
        aria-label="Dismiss update"
        onClick={handleShowUpdate}
      />
    </aside>
  );
};

export default Update;
