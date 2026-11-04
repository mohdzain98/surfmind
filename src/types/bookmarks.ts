export interface BookmarkFolder {
  id: string;
  title: string;
  path: string[];
  depth: number;
  bookmarkCount: number;
}

export interface BookmarkFolderNode extends BookmarkFolder {
  children: BookmarkFolderNode[];
}

export interface BookmarkFolderSummary {
  bookmarkCount: number;
  folders: BookmarkFolder[];
  folderTree: BookmarkFolderNode[];
  bookmarkPageCount: number;
}

export type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
