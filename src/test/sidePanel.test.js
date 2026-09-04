const fs = require("fs");
const path = require("path");
const manifest = require("../../public/manifest.json");
const extensionPage = fs.readFileSync(
  path.resolve(__dirname, "../../public/index.html"),
  "utf8"
);

test("uses the Chrome side panel as the only toolbar UI", () => {
  expect(manifest.permissions).toContain("sidePanel");
  expect(manifest.side_panel).toEqual({ default_path: "index.html" });
  expect(manifest.action.default_title).toBe("Open SurfMind");
  expect(manifest.action.default_popup).toBeUndefined();
  expect(Number(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(114);
  expect(manifest.content_scripts[0].js).toEqual([
    "readability.js",
    "structuredExtraction.js",
    "content.js",
  ]);
});

test("does not parse the extension manifest as a PWA manifest", () => {
  expect(extensionPage).not.toMatch(/rel=["']manifest["']/i);
});

test("keeps worker scripts out of the side-panel page context", () => {
  const publicDirectory = path.resolve(__dirname, "../../public");
  const indexHtml = fs.readFileSync(
    path.join(publicDirectory, "index.html"),
    "utf8"
  );
  const backgroundScript = fs.readFileSync(
    path.join(publicDirectory, "background.js"),
    "utf8"
  );

  expect(indexHtml).not.toMatch(/<script[^>]+(?:background|content)\.js/);
  expect(backgroundScript).toContain(
    "setPanelBehavior({ openPanelOnActionClick: true })"
  );
});
