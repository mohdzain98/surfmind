const EDGE_BRAND_PATTERN = /Microsoft Edge|Edge|Edg/i;
const CHROME_BRAND_PATTERN = /Google Chrome|Chrome|Chromium/i;

const normalizePlatform = (value) => {
  const platform = String(value || "").toLowerCase();
  if (platform.includes("mac")) return "macOS";
  if (platform.includes("win")) return "Windows";
  if (platform.includes("android")) return "Android";
  if (platform.includes("iphone") || platform.includes("ipad")) return "iOS";
  if (platform.includes("linux")) return "Linux";
  return "this device";
};

const getBrowserFromBrands = (brands = []) => {
  const names = brands.map((brand) => String(brand?.brand || ""));
  if (names.some((name) => EDGE_BRAND_PATTERN.test(name))) return "Edge";
  if (names.some((name) => CHROME_BRAND_PATTERN.test(name))) return "Chrome";
  return "Browser";
};

const getBrowserFromUserAgent = (userAgent = "") => {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Chrome\//i.test(userAgent)) return "Chrome";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Browser";
};

export const buildDefaultDeviceName = (navigatorLike = navigator) => {
  const userAgentData = navigatorLike?.userAgentData;
  const browser = userAgentData
    ? getBrowserFromBrands(userAgentData.brands)
    : getBrowserFromUserAgent(navigatorLike?.userAgent);
  const platform = normalizePlatform(
    userAgentData?.platform ||
      navigatorLike?.platform ||
      navigatorLike?.userAgent
  );
  return `${browser} on ${platform}`;
};

export const normalizeDeviceName = (value) =>
  Array.from(String(value || ""), (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

export const resolveUniqueDeviceName = (
  proposedName,
  browserUuid,
  devices = []
) => {
  const normalized = normalizeDeviceName(proposedName);
  const fallback = normalized || buildDefaultDeviceName();
  const collision = devices.some(
    (device) =>
      device?.browserUuid !== browserUuid &&
      normalizeDeviceName(device?.deviceName).toLocaleLowerCase() ===
        fallback.toLocaleLowerCase()
  );
  if (!collision) return fallback;
  return normalizeDeviceName(`${fallback} · ${String(browserUuid).slice(-4)}`);
};
