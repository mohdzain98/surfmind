import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SettingsHome from "../components/SettingsHome";

beforeEach(() => {
  const bookmarkEvent = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  global.chrome = {
    runtime: {},
    bookmarks: {
      getTree: jest.fn((callback) =>
        callback([
          {
            id: "0",
            title: "",
            children: [
              { id: "1", title: "Bookmarks bar", children: [] },
              { id: "2", title: "Other bookmarks", children: [] },
            ],
          },
        ])
      ),
      onCreated: bookmarkEvent,
      onRemoved: bookmarkEvent,
    },
    tabs: {
      create: jest.fn(),
    },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({
          crossBrowserSyncStatus: { isLinked: true, browserCount: 2 },
        }),
        set: jest.fn(),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  };
});

test("shows sync first, rate last, and stored summaries", async () => {
  chrome.storage.local.get.mockResolvedValue({
    crossBrowserSyncStatus: { isLinked: true, browserCount: 2 },
    navigationData: [
      { url: "https://example.com", heading_path: ["One"] },
      { url: "https://example.com", heading_path: ["Two"] },
    ],
  });
  render(
    <SettingsHome
      onOpenSync={jest.fn()}
      onOpenHistory={jest.fn()}
      onOpenBookmarks={jest.fn()}
      onOpenPrivacy={jest.fn()}
    />
  );

  expect(
    screen.getByText("Manage how SurfMind syncs and stores your browsing data.")
  ).toHaveClass("settings-home-subtitle");

  const syncTile = screen.getByRole("button", { name: /Cross-browser Sync/ });
  const historyTile = screen.getByRole("button", { name: /Saved History/ });
  const bookmarksTile = screen.getByRole("button", {
    name: /Saved Bookmarks/,
  });
  const rateTile = screen.getByRole("button", { name: /Rate SurfMind/ });
  const privacyTile = screen.getByRole("button", { name: /Privacy/ });
  expect(
    syncTile.compareDocumentPosition(rateTile) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    historyTile.compareDocumentPosition(rateTile) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    privacyTile.compareDocumentPosition(rateTile) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  await waitFor(() => expect(syncTile).toHaveTextContent("2 browsers linked"));
  await waitFor(() => expect(historyTile).toHaveTextContent("1 page saved"));
  await waitFor(() => expect(bookmarksTile).toHaveTextContent("2 folders"));
  expect(
    screen.queryByRole("link", { name: "Privacy Policy" })
  ).not.toBeInTheDocument();
});

test("opens the Web Store review page without changing prompt state", async () => {
  render(
    <SettingsHome
      onOpenSync={jest.fn()}
      onOpenHistory={jest.fn()}
      onOpenBookmarks={jest.fn()}
      onOpenPrivacy={jest.fn()}
    />
  );

  await screen.findByText("2 browsers linked");

  fireEvent.click(screen.getByRole("button", { name: /Rate SurfMind/ }));

  expect(chrome.tabs.create).toHaveBeenCalledWith({
    url: "https://chromewebstore.google.com/detail/surfmind-smarter-browsing/ladckalplikfcplbihpgfnlkonnpehkj/reviews",
  });
  expect(chrome.storage.local.set).not.toHaveBeenCalled();
});

test("shows local and persisted counts for the current browser", async () => {
  render(
    <SettingsHome
      onOpenSync={jest.fn()}
      onOpenHistory={jest.fn()}
      onOpenBookmarks={jest.fn()}
      onOpenPrivacy={jest.fn()}
      pageCounts={{
        status: "ready",
        local: { history: 88, bookmarks: 3 },
        remote: { history: 88, bookmarks: 2 },
        matches: false,
      }}
    />
  );

  expect(screen.getByLabelText("Sync coverage")).toHaveTextContent(
    "History88 local · 88 synced"
  );
  expect(screen.getByLabelText("Sync coverage")).toHaveTextContent(
    "Bookmarks3 local · 2 synced"
  );
  expect(screen.getByText("Sync available")).toBeInTheDocument();
  expect(
    screen.getByText(
      "SurfMind syncs changes automatically, so you usually don’t need to do anything."
    )
  ).toHaveClass("settings-sync-note");
});
