import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CircleAlert,
  Clock3,
  Search,
  SearchX,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const STEP_META = {
  retrieved_parents: { Icon: Search, type: "retrieval" },
  post_processing: { Icon: ShieldCheck, type: "validation" },
  llm_response: { Icon: Sparkles, type: "generation" },
};

const MESSAGE_META = [
  { pattern: /problem|error|failed/i, Icon: CircleAlert, type: "error" },
  { pattern: /no (?:results?|sources?)/i, Icon: SearchX, type: "empty" },
  { pattern: /validat/i, Icon: ShieldCheck, type: "validation" },
  { pattern: /generat|response/i, Icon: Sparkles, type: "generation" },
  { pattern: /retriev|sources?|results?/i, Icon: Search, type: "retrieval" },
];

const MODE_TITLES = {
  history: "Searching history",
  bookmark: "Searching bookmarks",
  combined: "Thinking",
};

const shouldHideThought = ({ message, step }) =>
  step?.step === "output_parser" ||
  /syncing recent history|structuring output|no results? found/i.test(message);

const getThoughtMeta = (step, message) => {
  if (step?.step && STEP_META[step.step]) return STEP_META[step.step];
  return (
    MESSAGE_META.find(({ pattern }) => pattern.test(message)) || {
      Icon: Clock3,
      type: "thinking",
    }
  );
};

const SearchThought = ({
  message,
  step,
  thoughts = [],
  mode = "history",
  complete = false,
}) => {
  const [open, setOpen] = useState(true);
  const scrollRef = useRef(null);

  const hasCurrentSequence =
    thoughts.length > 0 &&
    (!message || thoughts[thoughts.length - 1].message === message);
  const entries = (
    hasCurrentSequence
      ? thoughts
      : message
        ? [{ id: "current-thought", message, step }]
        : []
  ).filter((thought) => !shouldHideThought(thought));

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!open || !scrollContainer) return;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [entries.length, open]);

  useEffect(() => {
    setOpen(!complete);
  }, [complete]);

  if (entries.length === 0) return null;

  const panelId = "search-thought-panel";

  return (
    <section className="search-thought-list" aria-label="Search progress">
      <button
        type="button"
        className="search-thought-toggle d-flex align-items-center gap-2"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <ChevronDown
          size={15}
          className={`search-thought-chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        />
        {MODE_TITLES[mode] || "Thinking"}
      </button>
      {open ? (
        <div className="search-thought-scroll" id={panelId} ref={scrollRef}>
          {entries.map((thought, index) => {
            const { Icon, type } = getThoughtMeta(
              thought.step,
              thought.message,
            );
            const isCurrent = index === entries.length - 1;
            return (
              <div
                key={thought.id}
                className={`search-thought-item thought-${type} d-flex align-items-center gap-2`}
                role={isCurrent ? "status" : undefined}
                aria-live={isCurrent ? "polite" : undefined}
                aria-atomic={isCurrent ? "true" : undefined}
              >
                <span className="search-thought-icon" aria-hidden="true">
                  <Icon size={14} />
                </span>
                <p className="mb-0">{thought.message}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

export default SearchThought;
