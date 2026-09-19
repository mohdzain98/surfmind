import {
  RATE_PROMPT_COOLDOWN_MS,
  RATE_PROMPT_STORAGE_KEY,
  claimRatePrompt,
  isRatePromptEligible,
  permanentlyDismissRatePrompt,
  recordSuccessfulSearch,
} from "../services/ratePrompt";

let storage;

beforeEach(() => {
  storage = {};
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(async (defaults) => ({ ...defaults, ...storage })),
        set: jest.fn(async (values) => {
          storage = { ...storage, ...values };
        }),
      },
    },
  };
});

test("counts only calls representing successful searches and persists them", async () => {
  await recordSuccessfulSearch();
  await recordSuccessfulSearch();

  expect(storage[RATE_PROMPT_STORAGE_KEY]).toMatchObject({
    successfulSearchCount: 2,
    timesShown: 0,
    lastShownAt: null,
    permanentlyDismissed: false,
  });
});

test("requires five searches and enforces cooldown, cap, and dismissal", () => {
  const now = Date.UTC(2026, 8, 18);
  const eligible = {
    successfulSearchCount: 5,
    timesShown: 0,
    lastShownAt: null,
    permanentlyDismissed: false,
  };

  expect(isRatePromptEligible(eligible, now)).toBe(true);
  expect(
    isRatePromptEligible({ ...eligible, successfulSearchCount: 4 }, now)
  ).toBe(false);
  expect(isRatePromptEligible({ ...eligible, timesShown: 3 }, now)).toBe(false);
  expect(
    isRatePromptEligible({ ...eligible, permanentlyDismissed: true }, now)
  ).toBe(false);
  expect(
    isRatePromptEligible({ ...eligible, lastShownAt: now - 1000 }, now)
  ).toBe(false);
  expect(
    isRatePromptEligible(
      { ...eligible, lastShownAt: now - RATE_PROMPT_COOLDOWN_MS },
      now
    )
  ).toBe(true);
});

test("claims an eligible prompt when it is shown and starts its cooldown", async () => {
  const now = Date.UTC(2026, 8, 18);
  storage[RATE_PROMPT_STORAGE_KEY] = {
    successfulSearchCount: 5,
    timesShown: 1,
    lastShownAt: now - RATE_PROMPT_COOLDOWN_MS,
    permanentlyDismissed: false,
  };

  await expect(claimRatePrompt(now)).resolves.toBe(true);
  expect(storage[RATE_PROMPT_STORAGE_KEY]).toMatchObject({
    timesShown: 2,
    lastShownAt: now,
  });
  await expect(claimRatePrompt(now + 1000)).resolves.toBe(false);
});

test("permanent dismissal suppresses all future prompts", async () => {
  storage[RATE_PROMPT_STORAGE_KEY] = {
    successfulSearchCount: 12,
    timesShown: 1,
    lastShownAt: null,
    permanentlyDismissed: false,
  };

  await permanentlyDismissRatePrompt();

  expect(storage[RATE_PROMPT_STORAGE_KEY].permanentlyDismissed).toBe(true);
  await expect(claimRatePrompt()).resolves.toBe(false);
});
