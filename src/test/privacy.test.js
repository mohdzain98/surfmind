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
        remove: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
      },
    },
  };
  initializeUserId.mockResolvedValue("new-browser-uuid");
});

test("uses distinct deletion endpoints with the current identity", async () => {
  await deleteHistoryData("https://api.example.com/v1", "browser-123");
  await deleteAllData("https://api.example.com/v1", "browser-123");

  expect(fetch).toHaveBeenNthCalledWith(
    1,
    "https://api.example.com/v1/user/history?user_id=browser-123",
    { method: "DELETE" },
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "https://api.example.com/v1/user/data?user_id=browser-123",
    { method: "DELETE" },
  );
});

test("clears only history keys for the scoped local action", async () => {
  await clearHistoryLocal();

  expect(chrome.storage.local.remove).toHaveBeenCalledWith([
    "navigationData",
    "lastSyncTime",
  ]);
  expect(chrome.storage.local.clear).not.toHaveBeenCalled();
});

test("full local clear regenerates a fresh browser identity", async () => {
  await expect(clearAllDataLocal()).resolves.toBe("new-browser-uuid");

  expect(chrome.storage.local.clear).toHaveBeenCalledTimes(1);
  expect(initializeUserId).toHaveBeenCalledTimes(1);
  expect(chrome.storage.local.clear.mock.invocationCallOrder[0]).toBeLessThan(
    initializeUserId.mock.invocationCallOrder[0],
  );
});
