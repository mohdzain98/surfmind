import {
  ArrowRight,
  Clock3,
  FolderSearch,
  Laptop,
  Link2,
  MessageSquareText,
  PanelRightOpen,
  Pencil,
  SearchCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Highlight {
  Icon: LucideIcon;
  title: string;
  description: string;
}

const MAJOR_HIGHLIGHTS: Highlight[] = [
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

const LINKED_BROWSER_HIGHLIGHTS: Highlight[] = [
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

const FAST_MODE_HIGHLIGHTS: Highlight[] = [
  {
    Icon: Zap,
    title: "Jump straight to matching pages",
    description:
      "Fast Mode returns close matches from your history and bookmarks without waiting for an AI-written answer.",
  },
  {
    Icon: MessageSquareText,
    title: "Keep Standard when you want an answer",
    description:
      "Standard Mode writes an answer for you and keeps the supporting sources alongside it.",
  },
  {
    Icon: SlidersHorizontal,
    title: "Choose how closely results should match",
    description:
      "Use Broad, Balanced, or Precise matching and choose how many Fast results to show from Settings.",
  },
  {
    Icon: Trash2,
    title: "Clear the history you choose",
    description:
      "Remove the last hour, day, week, month, or all saved history from Settings.",
  },
];

const MINOR_UPDATE_CONTENT: Record<
  string,
  { title: string; description: string }
> = {
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

interface UpdateProps {
  severity?: "major" | "minor";
  version?: string;
  handleShowUpdate: () => void;
  handleOpenSync?: () => void;
}

const Update = ({
  severity = "minor",
  version,
  handleShowUpdate,
  handleOpenSync,
}: UpdateProps) => {
  if (severity === "major") {
    const isLinkedBrowserUpdate = version === "1.90.0";
    const isFastModeUpdate = version === "1.100.0";
    const highlights = isFastModeUpdate
      ? FAST_MODE_HIGHLIGHTS
      : isLinkedBrowserUpdate
        ? LINKED_BROWSER_HIGHLIGHTS
        : MAJOR_HIGHLIGHTS;
    const eyebrow = isFastModeUpdate
      ? "New: Fast Mode"
      : isLinkedBrowserUpdate
        ? "Cross-browser search, made clearer"
        : "Meet the new SurfMind";
    const title = isFastModeUpdate
      ? "Choose how SurfMind responds."
      : isLinkedBrowserUpdate
        ? "Know which browser found it."
        : "SurfMind, reimagined.";
    const intro = isFastModeUpdate
      ? "Use Fast Mode when you want matching pages immediately, or Standard Mode when you want SurfMind to write a sourced answer."
      : isLinkedBrowserUpdate
        ? "Give linked browsers recognizable names and see exactly where cross-browser search results came from."
        : "Your browsing assistant has moved from a popup into a persistent, smarter side panel.";
    const TakeoverIcon = isFastModeUpdate ? Zap : Sparkles;
    return (
      <main className="update-takeover" aria-labelledby="major-update-title">
        <section className="update-takeover-card">
          <div className="update-takeover-icon" aria-hidden="true">
            <TakeoverIcon size={25} />
          </div>
          <span className="update-eyebrow">{eyebrow}</span>
          <h1 id="major-update-title">{title}</h1>
          <p className="update-intro">{intro}</p>

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

  const content =
    (version ? MINOR_UPDATE_CONTENT[version] : undefined) ||
    DEFAULT_MINOR_UPDATE;
  const BannerIcon = FolderSearch;

  return (
    <aside className="update-banner" aria-label="What’s new">
      <span className="update-banner-icon" aria-hidden="true">
        <BannerIcon size={16} />
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
