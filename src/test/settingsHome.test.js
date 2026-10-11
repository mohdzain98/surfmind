import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SettingsHome from "../components/SettingsHome";
import { buildPageSyncCoverage } from "../services/pageCounts";

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
  const local = {
    history: 100,
    bookmarks: 300,
    dirty: { history: false, bookmarks: false },
  };
  const remote = {
    history: 100,
    bookmarks: 200,
    totals: { history: 100, bookmarks: 250 },
    caps: { history: 100, bookmarks: 250 },
  };

  render(
    <SettingsHome
      onOpenSync={jest.fn()}
      onOpenHistory={jest.fn()}
      onOpenBookmarks={jest.fn()}
      onOpenPrivacy={jest.fn()}
      pageCounts={{
        status: "ready",
        local,
        remote,
        coverage: buildPageSyncCoverage(local, remote),
        matches: false,
      }}
    />
  );

  await waitFor(() =>
    expect(screen.getByLabelText("Sync coverage")).toHaveTextContent(
      "HistoryAt capacity, up to date100 local · 100 synced · 100 total · 100 max"
    )
  );
  expect(screen.getByLabelText("Sync coverage")).toHaveTextContent(
    "BookmarksAt capacity — showing your most recent 250300 local · 200 synced · 250 total · 250 max"
  );
  expect(screen.getByText("SurfMind syncs changes automatically.")).toHaveClass(
    "settings-sync-note"
  );
});

test("shows when linked browsers filled the shared account capacity", () => {
  const local = {
    history: 40,
    bookmarks: 20,
    dirty: { history: false, bookmarks: false },
  };
  const remote = {
    history: 40,
    bookmarks: 20,
    totals: { history: 100, bookmarks: 250 },
    caps: { history: 100, bookmarks: 250 },
  };

  render(
    <SettingsHome
      onOpenSync={jest.fn()}
      onOpenHistory={jest.fn()}
      onOpenBookmarks={jest.fn()}
      onOpenPrivacy={jest.fn()}
      pageCounts={{
        status: "ready",
        local,
        remote,
        coverage: buildPageSyncCoverage(local, remote),
        matches: true,
      }}
    />
  );

  expect(
    screen.getAllByText("At capacity via your other devices")
  ).toHaveLength(2);
});

test("always shows shared totals when cross-browser sync is linked", async () => {
  const local = {
    history: 82,
    bookmarks: 136,
    dirty: { history: false, bookmarks: false },
  };
  const remote = {
    history: 82,
    bookmarks: 136,
    totals: { history: 82, bookmarks: 136 },
    caps: { history: 100, bookmarks: 250 },
  };

  render(
    <SettingsHome
      onOpenSync={jest.fn()}
      onOpenHistory={jest.fn()}
      onOpenBookmarks={jest.fn()}
      onOpenPrivacy={jest.fn()}
      pageCounts={{
        status: "ready",
        local,
        remote,
        coverage: buildPageSyncCoverage(local, remote),
        matches: true,
      }}
    />
  );

  await waitFor(() => {
    const coverage = screen.getByLabelText("Sync coverage");
    expect(coverage).toHaveTextContent(
      "HistoryUp to date82 local · 82 synced · 82 total"
    );
    expect(coverage).toHaveTextContent(
      "BookmarksUp to date136 local · 136 synced · 136 total"
    );
  });

  const historyDetails = screen.getByText("History").closest("details");
  expect(historyDetails).not.toHaveAttribute("open");
  fireEvent.click(historyDetails.querySelector("summary"));
  expect(historyDetails).toHaveAttribute("open");
});
