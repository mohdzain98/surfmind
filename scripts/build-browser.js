const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const configPath = path.join(projectRoot, "config/browser-builds.json");
const buildConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const requestedTarget = process.argv[2] || "all";
const targets =
  requestedTarget === "all" ? Object.keys(buildConfig) : [requestedTarget];
const buildRoot = path.join(projectRoot, "build");

if (requestedTarget !== "all" && !buildConfig[requestedTarget]) {
  const validTargets = Object.keys(buildConfig).join(", ");
  throw new Error(
    `Unknown browser target "${requestedTarget}". Expected one of: ${validTargets}, all.`
  );
}

const prepareBuildRoot = () => {
  if (requestedTarget === "all") {
    fs.rmSync(buildRoot, { recursive: true, force: true });
    fs.mkdirSync(buildRoot, { recursive: true });
    return;
  }

  fs.mkdirSync(buildRoot, { recursive: true });
  const browserDirectories = new Set(Object.keys(buildConfig));
  for (const entry of fs.readdirSync(buildRoot)) {
    if (browserDirectories.has(entry)) continue;
    fs.rmSync(path.join(buildRoot, entry), { recursive: true, force: true });
  }
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

const inspectArchive = (archivePath) => {
  const result = spawnSync("zipinfo", ["-1", archivePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);

  const files = result.stdout.split("\n").filter(Boolean);
  if (!files.includes("manifest.json")) {
    throw new Error("Packaging failed: manifest.json is not at the ZIP root.");
  }
  if (files.some((file) => /(^|\/)\.DS_Store$|\.map$/.test(file))) {
    throw new Error("Packaging failed: ZIP contains .DS_Store or source maps.");
  }
};

const packageTarget = (target) => {
  const targetConfig = buildConfig[target];
  const buildRelativePath = path.join("build", target);
  const buildPath = path.join(projectRoot, buildRelativePath);
  const manifestPath = path.join(buildPath, "manifest.json");

  fs.rmSync(buildPath, { recursive: true, force: true });

  run("npm", ["run", "build"], {
    env: {
      ...process.env,
      BUILD_PATH: buildRelativePath,
      GENERATE_SOURCEMAP: "false",
      REACT_APP_BROWSER_TARGET: target,
      REACT_APP_BROWSER_NAME: targetConfig.browserName,
      REACT_APP_EXTENSION_STORE_NAME: targetConfig.storeName,
      REACT_APP_EXTENSION_STORE_REVIEW_URL: targetConfig.storeReviewUrl,
    },
  });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  Object.assign(manifest, targetConfig.manifest || {});
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const version = manifest.version_name || manifest.version;
  const distPath = path.join(projectRoot, "dist");
  const archivePath = path.join(
    distPath,
    `${targetConfig.archiveName}-${version}.zip`
  );
  fs.mkdirSync(distPath, { recursive: true });
  fs.rmSync(archivePath, { force: true });

  run(
    "zip",
    [
      "-qr",
      archivePath,
      ".",
      "-x",
      ".DS_Store",
      "*/.DS_Store",
      "*.map",
      "*/**/*.map",
    ],
    { cwd: buildPath }
  );
  run("unzip", ["-tq", archivePath]);
  inspectArchive(archivePath);

  console.log(`Created ${path.relative(projectRoot, archivePath)}`);
};

prepareBuildRoot();
for (const target of targets) packageTarget(target);
