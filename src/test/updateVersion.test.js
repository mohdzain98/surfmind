import {
  getStoredUpdateVersion,
  getUpdateNotice,
} from "../services/updateVersion";

test("uses the full page for structural releases and major increases", () => {
  expect(getUpdateNotice("1.76.0", "1.80.0")).toBe("major");
  expect(getUpdateNotice("2.0.0", "3.1.0")).toBe("major");
});

test("uses the banner when only the minor version increases", () => {
  expect(getUpdateNotice("1.80.0", "1.81.0")).toBe("minor");
  expect(getUpdateNotice("2.1.0", "2.1.1")).toBeNull();
  expect(getUpdateNotice("2.1.0", "2.1.0")).toBeNull();
});

test("migrates the newest acknowledged legacy update flag", () => {
  expect(
    getStoredUpdateVersion({
      "sm-update-flag-v1.76": true,
      "sm-update-flag-v1.7": true,
    })
  ).toBe("1.76.0");
  expect(
    getStoredUpdateVersion({ "sm-update-previous-version": "1.76.0" })
  ).toBe("1.76.0");
  expect(getStoredUpdateVersion({})).toBe("0.0.0");
});
