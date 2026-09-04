chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "extractStructuredContent") return false;

  try {
    const extraction = SurfMindStructuredExtraction.extractStructuredContent(
      document,
      Readability
    );
    sendResponse({ success: true, extraction });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
  return false;
});
