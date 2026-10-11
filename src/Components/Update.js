import {
  ArrowRight,
  Clock3,
  FolderSearch,
  Laptop,
  Link2,
  PanelRightOpen,
  Pencil,
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

const LINKED_BROWSER_HIGHLIGHTS = [
  {
    Icon: Pencil,
    title: "Name every linked browser",
    description:
      "Use familiar names such as Work Laptop, Home Edge, or Personal Mac.",
  },
  {
    Icon: Link2,
    title: "Search across linked browsers",
    description:
      "Find history and bookmarks saved on another browser from the one you’re using now.",
  },
  {
    Icon: Laptop,
    title: "See where each result came from",
    description:
      "Matched sources identify the linked browser that originally saved the page.",
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

const Update = ({
  severity = "minor",
  version,
  handleShowUpdate,
  handleOpenSync,
}) => {
  if (severity === "major") {
    const isLinkedBrowserUpdate = version === "1.90.0";
    const highlights = isLinkedBrowserUpdate
      ? LINKED_BROWSER_HIGHLIGHTS
      : MAJOR_HIGHLIGHTS;
    return (
      <main className="update-takeover" aria-labelledby="major-update-title">
        <section className="update-takeover-card">
          <div className="update-takeover-icon" aria-hidden="true">
            <Sparkles size={25} />
          </div>
          <span className="update-eyebrow">
            {isLinkedBrowserUpdate
              ? "Cross-browser search, made clearer"
              : "Meet the new SurfMind"}
          </span>
          <h1 id="major-update-title">
            {isLinkedBrowserUpdate
              ? "Know which browser found it."
              : "SurfMind, reimagined."}
          </h1>
          <p className="update-intro">
            {isLinkedBrowserUpdate
              ? "Give linked browsers recognizable names and see exactly where cross-browser search results came from."
              : "Your browsing assistant has moved from a popup into a persistent, smarter side panel."}
          </p>

          <div className="update-highlights">
            {highlights.map(({ Icon, title, description }) => (
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

          {isLinkedBrowserUpdate ? (
            <div
              className="update-device-example"
              aria-label="Example search result"
            >
              <div className="update-device-example-copy">
                <span>Example search result</span>
                <strong>An article you saved for later</strong>
                <small>example.com</small>
              </div>
              <span className="update-device-example-badge">
                <Laptop size={12} aria-hidden="true" />
                Found on Work Laptop
              </span>
            </div>
          ) : null}

          <div className="update-cta-row">
            <button
              type="button"
              className="btn btn-primary update-cta"
              onClick={handleShowUpdate}
            >
              Let&apos;s Surf
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {isLinkedBrowserUpdate ? (
              <button
                type="button"
                className="btn update-cta update-cta-secondary"
                onClick={handleOpenSync}
              >
                <Link2 size={15} aria-hidden="true" />
                Set up sync
              </button>
            ) : null}
          </div>
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
