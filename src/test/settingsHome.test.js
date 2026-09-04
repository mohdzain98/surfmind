import { render, screen, waitFor } from "@testing-library/react";
import SettingsHome from "../components/SettingsHome";

beforeEach(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({
          crossBrowserSyncStatus: { isLinked: true, browserCount: 2 },
        }),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  };
});

test("shows sync first, saved history, privacy last, and stored summaries", async () => {
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
      onOpenPrivacy={jest.fn()}
    />
  );

  expect(
    screen.getByText("Manage how SurfMind syncs and stores your browsing data.")
  ).toHaveClass("settings-home-subtitle");

  const syncTile = screen.getByRole("button", { name: /Cross-browser Sync/ });
  const historyTile = screen.getByRole("button", { name: /Saved History/ });
  const privacyTile = screen.getByRole("button", { name: /Privacy/ });
  expect(
    syncTile.compareDocumentPosition(privacyTile) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    historyTile.compareDocumentPosition(privacyTile) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  await waitFor(() => expect(syncTile).toHaveTextContent("2 browsers linked"));
  await waitFor(() => expect(historyTile).toHaveTextContent("1 page saved"));
  expect(
    screen.queryByRole("link", { name: "Privacy Policy" })
  ).not.toBeInTheDocument();
});
