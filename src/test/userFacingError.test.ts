import { toUserFacingError } from "../services/userFacingError";

test("turns oversized sync responses into actionable copy", () => {
  expect(toUserFacingError("History sync failed with status 413")).toBe(
    "There’s too much history to sync in one request. SurfMind will retry it in smaller batches."
  );
});

test("turns server and network failures into readable messages", () => {
  expect(toUserFacingError(new Error("Request failed with status 503"))).toBe(
    "SurfMind is temporarily unavailable. Please try again shortly."
  );
  expect(toUserFacingError(new TypeError("Failed to fetch"))).toBe(
    "SurfMind couldn’t connect. Check your internet connection and try again."
  );
});

test("keeps useful backend messages and supports a fallback", () => {
  expect(toUserFacingError("This sync code has expired")).toBe(
    "This sync code has expired"
  );
  expect(toUserFacingError(null, "Please retry the action.")).toBe(
    "Please retry the action."
  );
});
