import type { FastMaxResults, FastStrictness } from "../types";

interface FastModeSettingsProps {
  strictness: FastStrictness;
  maxResults: FastMaxResults;
  onStrictnessChange: (strictness: FastStrictness) => void;
  onMaxResultsChange: (maxResults: FastMaxResults) => void;
}

const STRICTNESS_OPTIONS: Array<{
  value: FastStrictness;
  label: string;
  description: string;
}> = [
  {
    value: "broad",
    label: "Broad",
    description:
      "Shows more results, including looser matches. Best when you only remember a little.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "A good mix of relevant results and few misses.",
  },
  {
    value: "precise",
    label: "Precise",
    description: "Shows only close matches. Fewer results, less noise.",
  },
];

const RESULT_OPTIONS: FastMaxResults[] = [3, 5, 8];

const FastModeSettings = ({
  strictness,
  maxResults,
  onStrictnessChange,
  onMaxResultsChange,
}: FastModeSettingsProps) => (
  <section className="fast-mode-settings" aria-labelledby="fast-mode-title">
    <div className="fast-mode-settings-heading">
      <h2 id="fast-mode-title">Fast Mode</h2>
      <p>Fast Mode returns matching links without an AI-written answer.</p>
    </div>

    <fieldset className="fast-setting-group">
      <legend>Match strictness</legend>
      <div className="fast-strictness-options">
        {STRICTNESS_OPTIONS.map((option) => (
          <label
            className={strictness === option.value ? "is-selected" : ""}
            key={option.value}
          >
            <input
              className="visually-hidden"
              type="radio"
              name="fast-strictness"
              value={option.value}
              checked={strictness === option.value}
              onChange={() => onStrictnessChange(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              {option.value === "balanced" ? <em>Default</em> : null}
            </span>
            <small>{option.description}</small>
          </label>
        ))}
      </div>
    </fieldset>

    <fieldset className="fast-setting-group fast-results-setting">
      <legend>Max results</legend>
      <div className="fast-results-options">
        {RESULT_OPTIONS.map((option) => (
          <label
            className={maxResults === option ? "is-selected" : ""}
            key={option}
          >
            <input
              className="visually-hidden"
              type="radio"
              name="fast-max-results"
              value={option}
              checked={maxResults === option}
              onChange={() => onMaxResultsChange(option)}
            />
            {option}
          </label>
        ))}
      </div>
      <p>Usually shows up to {maxResults} results.</p>
    </fieldset>

    <p className="fast-settings-note">
      Changes apply to your next Fast search.
    </p>
  </section>
);

export default FastModeSettings;
