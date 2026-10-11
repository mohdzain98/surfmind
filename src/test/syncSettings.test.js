import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SyncSettings from "../components/SyncSettings";
import {
  getLinkedDevices,
  getSyncStatus,
  unlinkBrowser,
} from "../services/syncApi";

jest.mock("../services/syncApi", () => ({
  formatCountdown: jest.fn(() => "10:00"),
  generateSyncCode: jest.fn(),
  getLinkedDevices: jest.fn(),
  getSyncStatus: jest.fn(),
  normalizeSyncCode: jest.fn((value) => value.toUpperCase()),
  redeemSyncCode: jest.fn(),
  renameLinkedDevice: jest.fn(),
  unlinkBrowser: jest.fn(),
  unlinkLinkedDevice: jest.fn(),
}));

beforeEach(() => {
  getSyncStatus.mockResolvedValue(null);
  getLinkedDevices.mockResolvedValue([]);
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

  expect(
    await screen.findByText("2 browsers share this history")
  ).toBeInTheDocument();
  expect(screen.queryByText(/free tier/i)).not.toBeInTheDocument();

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

test("shows one browser-linking accordion at a time", async () => {
  render(
    <SyncSettings host="https://api.example.com/v1" browserUuid="browser-123" />
  );

  await waitFor(() => expect(getSyncStatus).toHaveBeenCalledTimes(1));

  expect(
    screen.getByText(/Linked browsers can search the same saved history/)
  ).toBeInTheDocument();

  const generateTrigger = screen.getByRole("button", {
    name: "Show a code on this browser",
  });
  const linkTrigger = screen.getByRole("button", {
    name: "Enter a code from another browser",
  });
  expect(generateTrigger).toHaveAttribute("aria-expanded", "false");
  expect(linkTrigger).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(generateTrigger);
  expect(generateTrigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByLabelText(/Name this browser/)).toBeInTheDocument();

  fireEvent.click(linkTrigger);
  expect(generateTrigger).toHaveAttribute("aria-expanded", "false");
  expect(linkTrigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByLabelText("Sync code")).toBeInTheDocument();
});

test("shows linked browsers with the current browser first", async () => {
  getSyncStatus.mockResolvedValue({
    isLinked: true,
    browserCount: 2,
    syncAccountId: "account-123",
  });
  getLinkedDevices.mockResolvedValue([
    {
      browserUuid: "browser-456",
      deviceName: "Home Edge",
      linkedAt: "2026-10-01T00:00:00Z",
      lastSyncedAt: "2026-10-10T00:00:00Z",
      isCurrent: false,
    },
    {
      browserUuid: "browser-123",
      deviceName: "Work Chrome",
      linkedAt: "2026-09-01T00:00:00Z",
      lastSyncedAt: "2026-10-09T00:00:00Z",
      isCurrent: true,
    },
  ]);

  render(
    <SyncSettings host="https://api.example.com/v1" browserUuid="browser-123" />
  );

  expect(await screen.findByText("Linked browsers")).toBeInTheDocument();
  expect(screen.queryByText("Work Chrome")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Linked browsers.*2/i }));
  fireEvent.click(
    screen.getByRole("button", { name: "Show a code on this browser" })
  );
  expect(screen.getByLabelText(/Name this browser/)).toHaveValue("Work Chrome");
  const browserNames = screen.getAllByText(/Work Chrome|Home Edge/);
  expect(browserNames[0]).toHaveTextContent("Work Chrome");
  expect(screen.getByText("This browser")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Unlink Home Edge" })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Unlink Work Chrome" })
  ).not.toBeInTheDocument();
});
