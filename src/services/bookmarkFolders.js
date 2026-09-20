const visitFolder = (node, depth, parentPath) => {
  if (node?.url) {
    return { bookmarkCount: 1, folders: [], folderTree: [] };
  }

  const title = String(node?.title || "").trim();
  const path = title ? [...parentPath, title] : parentPath;
  let bookmarkCount = 0;
  const childFolders = [];
  const childFolderTree = [];

  for (const child of node?.children || []) {
    const result = visitFolder(child, title ? depth + 1 : depth, path);
    bookmarkCount += result.bookmarkCount;
    childFolders.push(...result.folders);
    childFolderTree.push(...result.folderTree);
  }

  if (!title) {
    return {
      bookmarkCount,
      folders: childFolders,
      folderTree: childFolderTree,
    };
  }

  const folder = {
    id: String(node.id || path.join("/")),
    title,
    path,
    depth: Math.max(0, depth),
    bookmarkCount,
  };

  return {
    bookmarkCount,
    folders: [folder, ...childFolders],
    folderTree: [{ ...folder, children: childFolderTree }],
  };
};

export const collectBookmarkFolders = (tree = []) => {
  const result = { bookmarkCount: 0, folders: [], folderTree: [] };
  const bookmarkUrls = new Set();

  const collectBookmarkUrls = (nodes) => {
    for (const node of nodes || []) {
      if (node?.url && /^https?:\/\//.test(node.url)) {
        try {
          const normalized = new URL(node.url);
          normalized.search = "";
          normalized.hash = "";
          bookmarkUrls.add(normalized.toString().replace(/\/$/, ""));
        } catch {
          bookmarkUrls.add(node.url);
        }
      }
      collectBookmarkUrls(node?.children);
    }
  };

  for (const node of tree) {
    const branch = visitFolder(node, 0, []);
    result.bookmarkCount += branch.bookmarkCount;
    result.folders.push(...branch.folders);
    result.folderTree.push(...branch.folderTree);
  }

  collectBookmarkUrls(tree);

  return { ...result, bookmarkPageCount: bookmarkUrls.size };
};

export const readBookmarkFolders = (bookmarksApi = chrome.bookmarks) =>
  new Promise((resolve, reject) => {
    bookmarksApi.getTree((tree) => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Could not read bookmarks"));
        return;
      }
      resolve(collectBookmarkFolders(tree));
    });
  });
