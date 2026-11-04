export const initializeUserId = async (): Promise<string> => {
  const result = await chrome.storage.local.get<{ userId?: string }>("userId");

  if (!result.userId) {
    const newUserId = crypto.randomUUID();
    await chrome.storage.local.set({ userId: newUserId });
    return newUserId;
  }

  return result.userId;
};
