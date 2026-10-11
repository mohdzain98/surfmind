import {
  buildDefaultDeviceName,
  normalizeDeviceName,
  resolveUniqueDeviceName,
} from "../services/deviceName";

test("builds Chrome and Edge names from user agent data", () => {
  expect(
    buildDefaultDeviceName({
      userAgentData: {
        brands: [{ brand: "Google Chrome" }],
        platform: "macOS",
      },
    })
  ).toBe("Chrome on macOS");

  expect(
    buildDefaultDeviceName({
      userAgentData: {
        brands: [{ brand: "Chromium" }, { brand: "Microsoft Edge" }],
        platform: "Windows",
      },
    })
  ).toBe("Edge on Windows");
});

test("falls back to user agent parsing and normalizes unsafe whitespace", () => {
  expect(
    buildDefaultDeviceName({
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36",
    })
  ).toBe("Chrome on Windows");
  expect(normalizeDeviceName("  Work\n\tLaptop\u0000  ")).toBe("Work Laptop");
});

test("adds the browser suffix when a default name collides", () => {
  expect(
    resolveUniqueDeviceName("Chrome on macOS", "uuid-3f9a", [
      { browserUuid: "uuid-other", deviceName: "Chrome on macOS" },
    ])
  ).toBe("Chrome on macOS · 3f9a");
});
