export const UPDATE_VERSION_KEY = "sm-last-seen-version";
export const UPDATE_PREVIOUS_VERSION_KEY = "sm-update-previous-version";

export const LEGACY_UPDATE_VERSIONS = [
  { key: "sm-update-flag-v1.76", version: "1.76.0" },
  { key: "sm-update-flag-v1.75", version: "1.75.0" },
  { key: "sm-update-flag-v1.7", version: "1.7.0" },
];

const FULL_PAGE_UPDATE_VERSIONS = new Set(["1.80.0"]);

const parseVersion = (version = "0.0.0") => {
  const [major = 0, minor = 0] = String(version)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return { major, minor };
};

export const getStoredUpdateVersion = (stored) => {
  if (stored[UPDATE_VERSION_KEY]) return stored[UPDATE_VERSION_KEY];
  if (stored[UPDATE_PREVIOUS_VERSION_KEY]) {
    return stored[UPDATE_PREVIOUS_VERSION_KEY];
  }
  return (
    LEGACY_UPDATE_VERSIONS.find(({ key }) => Boolean(stored[key]))?.version ||
    "0.0.0"
  );
};

export const getUpdateNotice = (storedVersion, currentVersion) => {
  const stored = parseVersion(storedVersion);
  const current = parseVersion(currentVersion);
  const isNewer =
    current.major > stored.major ||
    (current.major === stored.major && current.minor > stored.minor);

  if (current.major > stored.major) return "major";
  if (isNewer && FULL_PAGE_UPDATE_VERSIONS.has(currentVersion)) return "major";
  if (current.major === stored.major && current.minor > stored.minor) {
    return "minor";
  }
  return null;
};
