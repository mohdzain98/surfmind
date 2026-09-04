import {
  createBrowserIdentity,
  formatCountdown,
  generateSyncCode,
  getSyncStatus,
  normalizeSyncCode,
  redeemSyncCode,
  unlinkBrowser,
} from "../services/syncApi";

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn(async () => payload),
});

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("uses one stable browser_uuid without mode suffixes", () => {
  expect(createBrowserIdentity("browser-123")).toEqual({
    browser_uuid: "browser-123",
  });
});

test("generates and normalizes an expiring eight-character code", async () => {
  jest.spyOn(Date, "now").mockReturnValue(1_000);
  fetch.mockResolvedValue(
    jsonResponse({
      code: "ab12-cd34",
      expires_in_seconds: 600,
    })
  );

  const result = await generateSyncCode(
    "https://api.example.com/v1",
    "browser-123"
  );

  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.com/v1/sync/generate-code",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ browser_uuid: "browser-123" }),
    })
  );
  expect(result).toMatchObject({ code: "AB12CD34", expiresAt: 601_000 });
});

test("redeems a code and surfaces backend validation messages", async () => {
  fetch.mockResolvedValueOnce(
    jsonResponse({ linked_browser_count: 2, tier: "free" })
  );
  const status = await redeemSyncCode(
    "https://api.example.com/v1",
    "browser-456",
    "ab12cd34"
  );

  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    browser_uuid: "browser-456",
    code: "AB12CD34",
  });
  expect(status).toMatchObject({ isLinked: true, browserCount: 2 });

  fetch.mockResolvedValueOnce(
    jsonResponse({ detail: { message: "Sync code has expired" } }, 410)
  );
  await expect(
    redeemSyncCode("https://api.example.com/v1", "browser-456", "AB12CD34")
  ).rejects.toThrow("Sync code has expired");
});

test("unlinks a browser and gracefully handles an unavailable status route", async () => {
  fetch.mockResolvedValueOnce(jsonResponse({ tier: "free" }));
  await expect(
    unlinkBrowser("https://api.example.com/v1", "browser-456")
  ).resolves.toMatchObject({ isLinked: false, browserCount: 1 });

  fetch.mockResolvedValueOnce(jsonResponse({}, 404));
  await expect(
    getSyncStatus("https://api.example.com/v1", "browser-456")
  ).resolves.toBeNull();
  expect(fetch).toHaveBeenLastCalledWith(
    "https://api.example.com/v1/sync/status",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser_uuid: "browser-456" }),
    }
  );
});

test("normalizes code input and formats the expiry countdown", () => {
  expect(normalizeSyncCode(" ab12-cd34-extra ")).toBe("AB12CD34");
  expect(formatCountdown(125_000)).toBe("2:05");
  expect(formatCountdown(-1)).toBe("0:00");
});
