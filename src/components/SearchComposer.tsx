import { useLayoutEffect, useRef } from "react";
import type { SyntheticEvent } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";

const MIN_TEXTAREA_HEIGHT = 64;
const MAX_TEXTAREA_HEIGHT = 112;

interface SearchComposerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  mode?: string;
  disabled?: boolean;
  loading?: boolean;
}

const SearchComposer = ({
  id,
  value,
  onChange,
  onSubmit,
  placeholder,
  mode = "history",
  disabled = false,
  loading = false,
}: SearchComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT),
      MAX_TEXTAREA_HEIGHT
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [value]);

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (!disabled && value.trim()) onSubmit();
  };

  return (
    <form className={`search-composer mode-${mode}`} onSubmit={submit}>
      <label className="visually-hidden" htmlFor={id}>
        Search SurfMind
      </label>
      <textarea
        ref={textareaRef}
        id={id}
        className="search-composer-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) submit(event);
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button
        type="submit"
        className="search-composer-send"
        disabled={disabled || !value.trim()}
        aria-label="Send search"
        title="Send search"
      >
        {loading ? (
          <LoaderCircle className="spin" size={17} aria-hidden="true" />
        ) : (
          <ArrowUp size={18} aria-hidden="true" />
        )}
      </button>
    </form>
  );
};

export default SearchComposer;
