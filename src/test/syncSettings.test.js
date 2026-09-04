import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SyncSettings from "../components/SyncSettings";
import { getSyncStatus, unlinkBrowser } from "../services/syncApi";

jest.mock("../services/syncApi", () => ({
  formatCountdown: jest.fn(() => "10:00"),
  generateSyncCode: jest.fn(),
  getSyncStatus: jest.fn(),
  normalizeSyncCode: jest.fn((value) => value.toUpperCase()),
  redeemSyncCode: jest.fn(),
  unlinkBrowser: jest.fn(),
}));

beforeEach(() => {
  getSyncStatus.mockResolvedValue(null);
  global.chrome = {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
      },
    },
  };
});

test("confirms unlinking in the shared confirmation dialog", async () => {
  getSyncStatus.mockResolvedValue({
    isLinked: true,
    browserCount: 2,
    syncAccountId: "account-123",
    tier: "free",
  });
  unlinkBrowser.mockResolvedValue({
    isLinked: false,
    browserCount: 1,
    syncAccountId: "",
    tier: "free",
  });

  render(
    <SyncSettings host="https://api.example.com/v1" browserUuid="browser-123" />
  );

  fireEvent.click(
    await screen.findByRole("button", { name: "Unlink browser" })
  );
  const dialog = screen.getByRole("dialog", { name: "Unlink this browser?" });
  expect(unlinkBrowser).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Unlink Browser" }));

  await waitFor(() =>
    expect(unlinkBrowser).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "browser-123"
    )
  );
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
});

test("shows one browser-linking workflow at a time", async () => {
  render(
    <SyncSettings host="https://api.example.com/v1" browserUuid="browser-123" />
  );

  await waitFor(() => expect(getSyncStatus).toHaveBeenCalledTimes(1));

  expect(
    screen.getByText(/Linked browsers can search the same saved history/)
  ).toBeInTheDocument();

  expect(screen.getByRole("tab", { name: "Generate code" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByText("Show a code on this browser")).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Enter a code from another browser")
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Link browser" }));

  expect(screen.getByRole("tab", { name: "Link browser" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(
    screen.getByLabelText("Enter a code from another browser")
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Show a code on this browser")
  ).not.toBeInTheDocument();
});
