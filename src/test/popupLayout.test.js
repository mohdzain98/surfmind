import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Popup from "../components/Popup";
import { userContext } from "../context/userContext";

jest.mock("../components/Bookmarks", () => () => <div>Bookmarks view</div>);
jest.mock("../components/Combined", () => () => <div>Combined view</div>);
jest.mock("../components/RecentSearches", () => () => (
  <div data-testid="recent-searches">Recent searches</div>
));
jest.mock("../components/SourceCard", () => () => <div>Source card</div>);
jest.mock("../components/SyncSettings", () => () => <div>Settings view</div>);
jest.mock("../components/PrivacySettings", () => () => <div>Privacy view</div>);
jest.mock("../components/SavedHistory", () => () => (
  <div>Saved history view</div>
));

const baseState = {
  activeTab: "history",
  query: "",
  head: "",
  parsed: { summary: "", url: null },
  loading: false,
  histLoader: false,
  disable: false,
  noti: "",
  docs: [],
  userId: "browser-123",
  updateFlag: true,
  updateNotice: null,
  updateReady: true,
  updateVersion: "1.80.0",
  syncing: false,
  step: null,
  finalReceived: false,
};

const renderPopup = (stateOverrides = {}) => {
  const value = {
    state: { ...baseState, ...stateOverrides },
    setState: jest.fn(),
    initializePopup: jest.fn(),
    searchStream: jest.fn(),
    refreshAfterPairing: jest.fn(),
  };
  const result = render(
    <userContext.Provider value={value}>
      <Popup prop={{ host: "https://api.example.com/v1" }} />
    </userContext.Provider>
  );
  return { ...result, value };
};

beforeEach(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({
          crossBrowserSyncStatus: { isLinked: true, browserCount: 2 },
        }),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  };
});

test("uses a one-time full-page introduction for a major update", async () => {
  const { value } = renderPopup({
    updateFlag: false,
    updateNotice: "major",
  });

  expect(
    screen.getByRole("heading", { name: "SurfMind, reimagined." })
  ).toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/Ask SurfMind/)).not.toBeInTheDocument();

  expect(screen.queryByText(/1\.80\.0/)).not.toBeInTheDocument();
  expect(screen.getByText("Pick up where you left off")).toBeInTheDocument();
  expect(screen.getByText("Return to recent searches")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Let's Surf" }));

  await waitFor(() =>
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      "sm-last-seen-version": "1.80.0",
    })
  );
  await waitFor(() =>
    expect(value.setState).toHaveBeenCalledWith({
      updateFlag: true,
      updateNotice: null,
    })
  );
});

test("keeps the initial search UI centered with mode and recent searches below", () => {
  const { container } = renderPopup();
  const main = container.querySelector("main");
  const input = screen.getByPlaceholderText("Ask SurfMind about your history…");
  const modeButton = screen.getByRole("button", { name: /^History$/ });
  const recent = screen.getByTestId("recent-searches");

  expect(main).toHaveClass("is-search-empty");
  expect(screen.getByText("SM")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "SurfMind" })).toBeInTheDocument();
  expect(screen.getByText("Smarter browsing starts here.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "https://surfmind.docschat.in/privacy"
  );
  expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
    "target",
    "_blank"
  );
  expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "https://surfmind.docschat.in/contact"
  );
  expect(
    screen.getByRole("contentinfo", { name: "SurfMind links" })
  ).toHaveClass("app-footer");
  expect(
    input.compareDocumentPosition(modeButton) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    modeButton.compareDocumentPosition(recent) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});

test("keeps settings as a top-right gear outside the mode dropdown", () => {
  renderPopup();

  expect(
    screen.getByRole("button", { name: "Open settings" })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^History$/ }));

  expect(
    screen.queryByRole("button", { name: "Settings" })
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Bookmarks" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Combined" })).toBeInTheDocument();
});

test("opens completed-answer recent searches on a dedicated page and returns", () => {
  const { container } = renderPopup({
    parsed: { summary: "Completed answer", url: null },
    finalReceived: true,
  });
  const main = container.querySelector("main");

  expect(main).toHaveClass("has-search-activity");
  expect(screen.getByText("SurfMind")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  expect(screen.queryByTestId("recent-searches")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Recent Searches" }));

  expect(screen.getByTestId("recent-searches")).toBeInTheDocument();
  expect(screen.queryByText("Completed answer")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Back to answer" })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Back to answer" }));

  expect(screen.getByText("Completed answer")).toBeInTheDocument();
  expect(screen.queryByTestId("recent-searches")).not.toBeInTheDocument();
});

test("explains when SurfMind has not captured searchable history yet", () => {
  renderPopup({
    parsed: { summary: "No history data found", url: null },
    finalReceived: true,
  });

  expect(
    screen.getByText("SurfMind hasn’t saved any searchable visits yet.")
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Your existing Chrome history isn’t imported automatically\./
    )
  ).toHaveClass("answer-context");
  expect(screen.queryByText("No history data found")).not.toBeInTheDocument();
});

test("hides recent searches while a new search is active", () => {
  renderPopup({
    loading: true,
    disable: true,
    noti: "Retrieving sources...",
  });

  expect(screen.getByText("Retrieving sources...")).toBeInTheDocument();
  expect(screen.queryByTestId("recent-searches")).not.toBeInTheDocument();
});

test("shows a back button and keeps the gear on the settings page", async () => {
  renderPopup({
    activeTab: "settings",
    noti: "Browser linked. Shared history is ready to search.",
  });

  expect(
    screen.getByRole("button", { name: "Back to search" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Return to search" })
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Cross-browser Sync/ })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Privacy/ })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Saved History/ })
  ).toBeInTheDocument();
  expect(await screen.findByText("2 browsers linked")).toBeInTheDocument();
  expect(screen.queryByText("Settings view")).not.toBeInTheDocument();
  expect(screen.queryByText("Privacy view")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Search progress")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Browser linked. Shared history is ready to search.")
  ).not.toBeInTheDocument();
});

test("drills into one settings section at a time and returns to the menu", () => {
  renderPopup({ activeTab: "settings" });

  fireEvent.click(screen.getByRole("button", { name: /Cross-browser Sync/ }));
  expect(screen.getByText("Settings view")).toBeInTheDocument();
  expect(screen.queryByText("Privacy view")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Back to settings" })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
  fireEvent.click(screen.getByRole("button", { name: /Privacy/ }));
  expect(screen.getByText("Privacy view")).toBeInTheDocument();
  expect(screen.queryByText("Settings view")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Back to settings" }));
  fireEvent.click(screen.getByRole("button", { name: /Saved History/ }));
  expect(screen.getByText("Saved history view")).toBeInTheDocument();
});
