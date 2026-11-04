import { useEffect, useState } from "react";
import { ChevronDown, Folder, X } from "lucide-react";
import { readBookmarkFolders } from "../services/bookmarkFolders";
import type { BookmarkFolder } from "../types";

const BOOKMARK_EVENTS = [
  "onCreated",
  "onRemoved",
  "onChanged",
  "onMoved",
] as const;

type LoadStatus = "loading" | "ready" | "error";

const getFolderPath = (folder: BookmarkFolder): string =>
  folder.path.join(" / ");

interface BookmarkFolderPinProps {
  selectedFolder?: string | null;
  onClear: () => void;
  disabled?: boolean;
}

export const BookmarkFolderPin = ({
  selectedFolder,
  onClear,
  disabled = false,
}: BookmarkFolderPinProps) => {
  if (!selectedFolder) return null;

  return (
    <div className="bookmark-folder-pin" title={selectedFolder}>
      <Folder size={12} aria-hidden="true" />
      <span>{selectedFolder}</span>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        aria-label="Search all bookmarks"
        title="Search all bookmarks"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
};

interface BookmarkFolderPickerProps {
  selectedFolder?: string | null;
  onSelect: (folder: string | null) => void;
  disabled?: boolean;
}

const BookmarkFolderPicker = ({
  selectedFolder,
  onSelect,
  disabled = false,
}: BookmarkFolderPickerProps) => {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let mounted = true;
    const bookmarksApi = chrome.bookmarks;

    if (!bookmarksApi?.getTree) {
      setStatus("error");
      return undefined;
    }

    const loadFolders = async () => {
      try {
        const summary = await readBookmarkFolders(bookmarksApi);
        if (!mounted) return;
        setFolders(summary.folders);
        setStatus("ready");
      } catch {
        if (mounted) setStatus("error");
      }
    };

    loadFolders();
    for (const eventName of BOOKMARK_EVENTS) {
      bookmarksApi[eventName]?.addListener(loadFolders);
    }

    return () => {
      mounted = false;
      for (const eventName of BOOKMARK_EVENTS) {
        bookmarksApi[eventName]?.removeListener(loadFolders);
      }
    };
  }, []);

  return (
    <div className="bookmark-folder-scope">
      <select
        id="bookmark-folder-filter"
        value={selectedFolder || ""}
        onChange={(event) => onSelect(event.target.value || null)}
        disabled={disabled || status !== "ready"}
        aria-label="Choose a bookmark folder"
      >
        <option value="">
          {status === "loading"
            ? "Loading folders…"
            : status === "error"
              ? "Folders unavailable"
              : "Entire bookmarks"}
        </option>
        {folders.map((folder) => {
          const path = getFolderPath(folder);
          return (
            <option value={path} key={folder.id}>
              {path} ({folder.bookmarkCount})
            </option>
          );
        })}
      </select>
      <ChevronDown
        className="bookmark-folder-chevron"
        size={14}
        aria-hidden="true"
      />
    </div>
  );
};

export default BookmarkFolderPicker;
