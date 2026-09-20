const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const buildPath = path.resolve(projectRoot, process.env.BUILD_PATH || "build");
const readabilityPath = path.join(
  projectRoot,
  "node_modules/@mozilla/readability"
);

fs.mkdirSync(buildPath, { recursive: true });
fs.copyFileSync(
  path.join(readabilityPath, "Readability.js"),
  path.join(buildPath, "readability.js")
);
fs.copyFileSync(
  path.join(readabilityPath, "LICENSE.md"),
  path.join(buildPath, "readability.LICENSE.md")
);
