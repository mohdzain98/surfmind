const ENV_KEYS = [
  "REACT_APP_BROWSER_TARGET",
  "REACT_APP_BROWSER_NAME",
  "REACT_APP_EXTENSION_STORE_NAME",
  "REACT_APP_EXTENSION_STORE_REVIEW_URL",
];

const originalValues = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalValues[key] === undefined) delete process.env[key];
    else process.env[key] = originalValues[key];
  }
  jest.resetModules();
});

test("uses Chrome values for the normal development build", () => {
  jest.isolateModules(() => {
    const config = require("../services/storeConfig");

    expect(config.BROWSER_TARGET).toBe("chrome");
    expect(config.EXTENSION_STORE_NAME).toBe("Chrome Web Store");
    expect(config.HAS_EXTENSION_STORE_REVIEW).toBe(true);
  });
});

test("uses the Edge Add-ons listing for an Edge build", () => {
  process.env.REACT_APP_BROWSER_TARGET = "edge";
  process.env.REACT_APP_BROWSER_NAME = "Microsoft Edge";
  process.env.REACT_APP_EXTENSION_STORE_NAME = "Microsoft Edge Add-ons";
  delete process.env.REACT_APP_EXTENSION_STORE_REVIEW_URL;

  jest.isolateModules(() => {
    const config = require("../services/storeConfig");

    expect(config.BROWSER_TARGET).toBe("edge");
    expect(config.BROWSER_NAME).toBe("Microsoft Edge");
    expect(config.EXTENSION_STORE_NAME).toBe("Microsoft Edge Add-ons");
    expect(config.EXTENSION_STORE_REVIEW_URL).toBe(
      "https://microsoftedge.microsoft.com/addons/detail/hdnflpjcaomgjkjmggiaihifillgdofk"
    );
    expect(config.HAS_EXTENSION_STORE_REVIEW).toBe(true);
  });
});

test("allows a browser build to explicitly disable its review link", () => {
  process.env.REACT_APP_BROWSER_TARGET = "edge";
  process.env.REACT_APP_EXTENSION_STORE_REVIEW_URL = "";

  jest.isolateModules(() => {
    const config = require("../services/storeConfig");

    expect(config.EXTENSION_STORE_REVIEW_URL).toBe("");
    expect(config.HAS_EXTENSION_STORE_REVIEW).toBe(false);
  });
});
