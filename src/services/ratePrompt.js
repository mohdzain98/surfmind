import {
  EXTENSION_STORE_REVIEW_URL,
  HAS_EXTENSION_STORE_REVIEW,
} from "./storeConfig";

export const RATE_PROMPT_STORAGE_KEY = "ratePrompt";
export const RATE_PROMPT_MIN_SEARCHES = 5;
export const RATE_PROMPT_MAX_SHOWS = 3;
export const RATE_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const STORE_REVIEW_URL = EXTENSION_STORE_REVIEW_URL;

const DEFAULT_RATE_PROMPT_STATE = Object.freeze({
  successfulSearchCount: 0,
  timesShown: 0,
  lastShownAt: null,
  permanentlyDismissed: false,
});

const normalizeState = (value = {}) => ({
  successfulSearchCount: Math.max(0, Number(value.successfulSearchCount) || 0),
  timesShown: Math.max(0, Number(value.timesShown) || 0),
  lastShownAt:
    value.lastShownAt !== null &&
    value.lastShownAt !== undefined &&
    Number.isFinite(Number(value.lastShownAt))
      ? Number(value.lastShownAt)
      : null,
  permanentlyDismissed: Boolean(value.permanentlyDismissed),
});

export const getRatePromptState = async () => {
  const stored = await chrome.storage.local.get({
    [RATE_PROMPT_STORAGE_KEY]: DEFAULT_RATE_PROMPT_STATE,
  });
  return normalizeState(stored[RATE_PROMPT_STORAGE_KEY]);
};

const saveRatePromptState = async (state) => {
  const normalized = normalizeState(state);
  await chrome.storage.local.set({ [RATE_PROMPT_STORAGE_KEY]: normalized });
  return normalized;
};

export const recordSuccessfulSearch = async () => {
  if (!HAS_EXTENSION_STORE_REVIEW) return normalizeState();
  const state = await getRatePromptState();
  return saveRatePromptState({
    ...state,
    successfulSearchCount: state.successfulSearchCount + 1,
  });
};

export const isRatePromptEligible = (state, now = Date.now()) => {
  if (!HAS_EXTENSION_STORE_REVIEW) return false;
  const normalized = normalizeState(state);
  if (normalized.permanentlyDismissed) return false;
  if (normalized.successfulSearchCount < RATE_PROMPT_MIN_SEARCHES) return false;
  if (normalized.timesShown >= RATE_PROMPT_MAX_SHOWS) return false;
  if (normalized.lastShownAt === null) return true;
  return now - normalized.lastShownAt >= RATE_PROMPT_COOLDOWN_MS;
};

export const claimRatePrompt = async (now = Date.now()) => {
  if (!HAS_EXTENSION_STORE_REVIEW) return false;
  const state = await getRatePromptState();
  if (!isRatePromptEligible(state, now)) return false;

  await saveRatePromptState({
    ...state,
    timesShown: state.timesShown + 1,
    lastShownAt: now,
  });
  return true;
};

export const permanentlyDismissRatePrompt = async () => {
  const state = await getRatePromptState();
  return saveRatePromptState({ ...state, permanentlyDismissed: true });
};
