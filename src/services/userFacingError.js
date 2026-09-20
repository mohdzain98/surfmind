const STATUS_MESSAGES = {
  400: "SurfMind couldn’t process that request. Please try again.",
  401: "SurfMind couldn’t verify this browser. Please reopen the extension and try again.",
  403: "This browser isn’t allowed to connect to SurfMind right now.",
  404: "The SurfMind service needed for this action is unavailable.",
  408: "The request took too long. Please try again.",
  409: "Your data changed during the sync. Please try again.",
  413: "There’s too much history to sync in one request. SurfMind will retry it in smaller batches.",
  429: "SurfMind is receiving too many requests. Please wait a moment and try again.",
};

const readErrorMessage = (error) => {
  if (typeof error === "string") return error.trim();
  if (typeof error?.message === "string") return error.message.trim();
  return "";
};

export const toUserFacingError = (
  error,
  fallback = "Something went wrong. Please try again."
) => {
  const message = readErrorMessage(error);
  const statusMatch = message.match(/(?:status|http)\s*[:=-]?\s*(\d{3})/i);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status && status >= 500) {
    return "SurfMind is temporarily unavailable. Please try again shortly.";
  }
  if (/failed to fetch|network\s*error|networkerror|offline/i.test(message)) {
    return "SurfMind couldn’t connect. Check your internet connection and try again.";
  }
  if (/streaming request failed/i.test(message)) {
    return "SurfMind couldn’t complete the search. Please try again.";
  }

  return message || fallback;
};
