import { initializeUserId } from "../components/UserId";
import {
  clearAllDataLocal,
  clearHistoryLocal,
  deleteAllData,
  deleteHistoryData,
} from "../services/privacy";

jest.mock("../components/UserId", () => ({
  initializeUserId: jest.fn(),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ status: "cleared" }),
  });
  global.chrome = {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({ navigationData: [] }),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as typeof chrome;
  (initializeUserId as jest.Mock).mockResolvedValue("new-browser-uuid");
});

test("uses distinct deletion endpoints with the current identity", async () => {
  await deleteHistoryData("https://api.example.com/v1", "browser-123");
  await deleteAllData("https://api.example.com/v1", "browser-123");

  expect(fetch).toHaveBeenNthCalledWith(
    1,
    "https://api.example.com/v1/user/history?browser_uuid=browser-123&range=24h",
    { method: "DELETE" }
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "https://api.example.com/v1/user/data?user_id=browser-123",
    { method: "DELETE" }
  );
});

test("sends the selected history range", async () => {
  await deleteHistoryData("https://api.example.com/v1", "browser-123", "30d");

  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.com/v1/user/history?browser_uuid=browser-123&range=30d",
    { method: "DELETE" }
  );
});

test("sends and applies the all-time history range", async () => {
  await deleteHistoryData("https://api.example.com/v1", "browser-123", "all");
  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.com/v1/user/history?browser_uuid=browser-123&range=all",
    { method: "DELETE" }
  );

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({
    navigationData: [
      { url: "https://old.example.com", date: "2020-01-01T00:00:00.000Z" },
      { url: "https://recent.example.com", capturedAt: Date.now() },
    ],
  });
  await expect(clearHistoryLocal("all")).resolves.toEqual([]);
  expect(chrome.storage.local.set).toHaveBeenCalledWith({ navigationData: [] });
});

test("clears only local history inside the selected range", async () => {
  const now = Date.parse("2026-11-13T12:00:00.000Z");
  const oldEntry = {
    url: "https://old.example.com",
    visited_at: "2026-11-01T12:00:00.000Z",
  };
  const recentEntry = {
    url: "https://recent.example.com",
    capturedAt: now - 2 * 60 * 60 * 1000,
  };
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({
    navigationData: [oldEntry, recentEntry],
  });

  await expect(clearHistoryLocal("7d", now)).resolves.toEqual([oldEntry]);

  expect(chrome.storage.local.set).toHaveBeenCalledWith({
    navigationData: [oldEntry],
  });
  expect(chrome.storage.local.remove).toHaveBeenCalledWith("lastSyncTime");
  expect(chrome.storage.local.clear).not.toHaveBeenCalled();
});

test("full local clear regenerates a fresh browser identity", async () => {
  await expect(clearAllDataLocal()).resolves.toBe("new-browser-uuid");

  expect(chrome.storage.local.clear).toHaveBeenCalledTimes(1);
  expect(initializeUserId).toHaveBeenCalledTimes(1);
  expect(
    (chrome.storage.local.clear as jest.Mock).mock.invocationCallOrder[0]
  ).toBeLessThan((initializeUserId as jest.Mock).mock.invocationCallOrder[0]);
});
