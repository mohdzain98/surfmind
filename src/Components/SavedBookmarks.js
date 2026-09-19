import { useEffect, useState } from "react";
import { ChevronDown, Folder } from "lucide-react";
import { readBookmarkFolders } from "../services/bookmarkFolders";

const EMPTY_SUMMARY = { bookmarkCount: 0, folders: [], folderTree: [] };
const BOOKMARK_EVENTS = ["onCreated", "onRemoved", "onChanged", "onMoved"];

const FolderRow = ({ folder, expandable }) => (
  <div className={`saved-bookmarks-row ${expandable ? "is-expandable" : ""}`}>
    <span className="saved-bookmarks-folder-icon" aria-hidden="true">
      <Folder size={15} />
    </span>
    <span className="saved-bookmarks-folder-copy">
      <strong>{folder.title}</strong>
      {folder.path.length > 1 ? (
        <small>{folder.path.slice(0, -1).join(" › ")}</small>
      ) : null}
    </span>
    <span
      className="saved-bookmarks-folder-count"
      aria-label={`${folder.bookmarkCount} ${folder.bookmarkCount === 1 ? "bookmark" : "bookmarks"}`}
    >
      {folder.bookmarkCount}
    </span>
    {expandable ? (
      <ChevronDown
        className="saved-bookmarks-chevron"
        size={15}
        aria-hidden="true"
      />
    ) : null}
  </div>
);

const BookmarkFolder = ({ folder }) => {
  const expandable = folder.children.length > 0;

  return (
    <li className="saved-bookmarks-item">
      {expandable ? (
        <details>
          <summary>
            <FolderRow folder={folder} expandable />
          </summary>
          <ul className="saved-bookmarks-children">
            {folder.children.map((child) => (
              <BookmarkFolder folder={child} key={child.id} />
            ))}
          </ul>
        </details>
      ) : (
        <FolderRow folder={folder} expandable={false} />
      )}
    </li>
  );
};

const SavedBookmarks = () => {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;

    const loadFolders = async () => {
      try {
        const nextSummary = await readBookmarkFolders();
        if (!mounted) return;
        setSummary(nextSummary);
        setStatus("ready");
      } catch {
        if (!mounted) return;
        setStatus("error");
      }
    };

    loadFolders();
    for (const eventName of BOOKMARK_EVENTS) {
      chrome.bookmarks[eventName]?.addListener(loadFolders);
    }

    return () => {
      mounted = false;
      for (const eventName of BOOKMARK_EVENTS) {
        chrome.bookmarks[eventName]?.removeListener(loadFolders);
      }
    };
  }, []);

  return (
    <section
      className="saved-bookmarks"
      aria-labelledby="saved-bookmarks-title"
    >
      <div className="saved-bookmarks-heading">
        <h2 id="saved-bookmarks-title">Saved Bookmarks</h2>
        <p>
          Your browser bookmark folders and their bookmark counts. Individual
          bookmark names and URLs are not shown here.
        </p>
      </div>

      {status === "loading" ? (
        <p className="saved-bookmarks-status" role="status">
          Loading bookmark folders…
        </p>
      ) : status === "error" ? (
        <div className="saved-bookmarks-empty" role="alert">
          <h3>Bookmarks could not be loaded</h3>
          <p>Close and reopen SurfMind, then try again.</p>
        </div>
      ) : summary.folders.length === 0 ? (
        <div className="saved-bookmarks-empty">
          <h3>No bookmark folders yet</h3>
          <p>Create a folder in your browser bookmarks to see it here.</p>
        </div>
      ) : (
        <div className="saved-bookmarks-list">
          <p className="saved-bookmarks-count">
            {summary.folders.length}{" "}
            {summary.folders.length === 1 ? "folder" : "folders"} ·{" "}
            {summary.bookmarkCount}{" "}
            {summary.bookmarkCount === 1 ? "bookmark" : "bookmarks"}
          </p>
          <ul>
            {summary.folderTree.map((folder) => (
              <BookmarkFolder folder={folder} key={folder.id} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default SavedBookmarks;
