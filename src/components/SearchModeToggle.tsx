import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, MessageSquareText, Zap } from "lucide-react";
import type { SearchMode } from "../types";

interface SearchModeToggleProps {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS = [
  {
    value: "standard" as const,
    label: "Standard",
    description: "Get an answer, written for you, with sources.",
    Icon: MessageSquareText,
  },
  {
    value: "fast" as const,
    label: "Fast",
    description: "Jump straight to the matching pages.",
    Icon: Zap,
  },
];

const SearchModeToggle = ({
  value,
  onChange,
  disabled = false,
}: SearchModeToggleProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedMode = MODE_OPTIONS.find((option) => option.value === value)!;
  const SelectedIcon = selectedMode.Icon;

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selectMode = (mode: SearchMode) => {
    if (mode !== value) onChange(mode);
    setOpen(false);
  };

  return (
    <div className="search-response-mode" ref={rootRef}>
      <p className="search-response-disclaimer">
        AI answers can make mistakes. Check important details.
      </p>

      <div className="search-response-mode-picker">
        <button
          type="button"
          className="search-response-mode-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Choose response mode. ${selectedMode.label} selected`}
          onClick={() => setOpen((current) => !current)}
          disabled={disabled}
        >
          <SelectedIcon size={12} aria-hidden="true" />
          <span>{selectedMode.label}</span>
          <ChevronUp
            size={12}
            className={open ? "is-open" : ""}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <div
            className="search-response-mode-menu"
            role="menu"
            aria-label="Response mode"
          >
            {MODE_OPTIONS.map(
              ({ value: optionValue, label, description, Icon }) => {
                const selected = optionValue === value;
                return (
                  <button
                    type="button"
                    className={selected ? "is-selected" : ""}
                    role="menuitemradio"
                    aria-checked={selected}
                    autoFocus={selected}
                    key={optionValue}
                    onClick={() => selectMode(optionValue)}
                  >
                    <span className="search-response-option-icon">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span className="search-response-option-copy">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    {selected ? (
                      <Check
                        size={14}
                        className="search-response-option-check"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              }
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SearchModeToggle;
