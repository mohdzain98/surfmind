#!/usr/bin/env node
/**
 * Language breakdown of the repo, approximating GitHub's language bar.
 *
 * GitHub (linguist) shares by bytes of tracked, non-vendored code files.
 * This script reads the file list from git (tracked + untracked, honouring
 * .gitignore) and reports bytes (GitHub's metric), lines and files per
 * language, plus a JS/TS split by area.
 *
 * Usage: npm run stats:lang
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const LANGUAGES = {
  TypeScript: [".ts", ".tsx"],
  JavaScript: [".js", ".jsx", ".mjs", ".cjs"],
  CSS: [".css"],
  HTML: [".html"],
  Shell: [".sh"],
};

// Mirrors linguist's vendored/generated rules for this repo.
const EXCLUDED = [
  /^public\/js\//,
  /^public\/css\/bootstrap/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /package-lock\.json$/,
  /^(build|dist|node_modules|coverage)\//,
];

const AREAS = [
  ["src/test", /^src\/test\//],
  ["src (app)", /^src\//],
  ["public", /^public\//],
  ["scripts", /^scripts\//],
];

const extToLanguage = new Map(
  Object.entries(LANGUAGES).flatMap(([language, exts]) =>
    exts.map((ext) => [ext, language])
  )
);

const listFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\0")
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(ROOT, file)));

const emptyTotals = () => ({ bytes: 0, lines: 0, files: 0 });

const add = (totals, bytes, lines) => {
  totals.bytes += bytes;
  totals.lines += lines;
  totals.files += 1;
};

const byLanguage = {};
const byArea = {};

for (const file of listFiles()) {
  if (EXCLUDED.some((pattern) => pattern.test(file))) continue;
  const language = extToLanguage.get(path.extname(file).toLowerCase());
  if (!language) continue;

  const content = fs.readFileSync(path.join(ROOT, file), "utf8");
  const bytes = Buffer.byteLength(content);
  const lines = content.split("\n").filter((line) => line.trim()).length;

  add((byLanguage[language] ||= emptyTotals()), bytes, lines);

  if (language === "TypeScript" || language === "JavaScript") {
    const area =
      AREAS.find(([, pattern]) => pattern.test(file))?.[0] || "other";
    add(((byArea[area] ||= {})[language] ||= emptyTotals()), bytes, lines);
  }
}

const pct = (value, total) =>
  total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
const fmt = (value) => value.toLocaleString("en-US");

const printTable = (title, rows, total) => {
  console.log(`\n${title}`);
  console.log(
    `${"Language".padEnd(14)}${"Bytes".padStart(10)}${"Share".padStart(8)}` +
      `${"Lines".padStart(9)}${"Files".padStart(7)}`
  );
  for (const [name, t] of rows) {
    console.log(
      `${name.padEnd(14)}${fmt(t.bytes).padStart(10)}` +
        `${pct(t.bytes, total).padStart(8)}${fmt(t.lines).padStart(9)}` +
        `${fmt(t.files).padStart(7)}`
    );
  }
};

const totalBytes = Object.values(byLanguage).reduce((n, t) => n + t.bytes, 0);
printTable(
  "Repository languages (GitHub-style, by bytes)",
  Object.entries(byLanguage).sort((a, b) => b[1].bytes - a[1].bytes),
  totalBytes
);

console.log("\nTypeScript vs JavaScript by area");
console.log(
  `${"Area".padEnd(14)}${"TS bytes".padStart(10)}${"JS bytes".padStart(10)}` +
    `${"TS lines".padStart(10)}${"JS lines".padStart(10)}`
);
for (const [area] of [...AREAS, ["other"]]) {
  const row = byArea[area];
  if (!row) continue;
  const ts = row.TypeScript || emptyTotals();
  const js = row.JavaScript || emptyTotals();
  console.log(
    `${area.padEnd(14)}${fmt(ts.bytes).padStart(10)}${fmt(js.bytes).padStart(10)}` +
      `${fmt(ts.lines).padStart(10)}${fmt(js.lines).padStart(10)}`
  );
}

const ts = byLanguage.TypeScript || emptyTotals();
const js = byLanguage.JavaScript || emptyTotals();
console.log(
  `\nTS : JS = ${pct(ts.bytes, ts.bytes + js.bytes)} : ${pct(js.bytes, ts.bytes + js.bytes)} (bytes), ` +
    `${pct(ts.lines, ts.lines + js.lines)} : ${pct(js.lines, ts.lines + js.lines)} (lines)`
);
console.log(
  "Note: GitHub's bar can lag and applies extra linguist heuristics; " +
    "this is an approximation."
);
