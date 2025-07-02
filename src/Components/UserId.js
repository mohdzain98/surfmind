export const initializeUserId = async () => {
  const result = await chrome.storage.local.get("userId");

  if (!result.userId) {
    const newUserId = crypto.randomUUID();
    await chrome.storage.local.set({ userId: newUserId });
    console.log("Generated new userId:", newUserId);
    return newUserId;
  }

  return result.userId;
};
