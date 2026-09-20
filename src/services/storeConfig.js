const DEFAULT_CHROME_REVIEW_URL =
  "https://chromewebstore.google.com/detail/surfmind-smarter-browsing/ladckalplikfcplbihpgfnlkonnpehkj/reviews";

export const BROWSER_TARGET = process.env.REACT_APP_BROWSER_TARGET || "chrome";
export const BROWSER_NAME =
  process.env.REACT_APP_BROWSER_NAME || "Google Chrome";
export const EXTENSION_STORE_NAME =
  process.env.REACT_APP_EXTENSION_STORE_NAME || "Chrome Web Store";
export const EXTENSION_STORE_REVIEW_URL =
  process.env.REACT_APP_EXTENSION_STORE_REVIEW_URL === undefined
    ? DEFAULT_CHROME_REVIEW_URL
    : process.env.REACT_APP_EXTENSION_STORE_REVIEW_URL;
export const HAS_EXTENSION_STORE_REVIEW = Boolean(EXTENSION_STORE_REVIEW_URL);
