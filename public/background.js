const BATCH_SIZE = 100;
const date = new Date();
const options = {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
};
const formattedDate = date.toLocaleDateString("en-US", options);

const initializeUserId = async () => {
  const result = await chrome.storage.local.get("userId");
  if (!result.userId) {
    const newUserId = crypto.randomUUID();
    await chrome.storage.local.set({ userId: newUserId });
    console.log("Generated new userId (background):", newUserId);
    return newUserId;
  }
  return result.userId;
};

// const saveDataLocally = async (data) => {
//   try {
//     const result = await chrome.storage.local.get({ navigationData: [] });
//     let updatedData = result.navigationData.concat(data);

//     if (updatedData.length > BATCH_SIZE) {
//       updatedData = updatedData.slice(updatedData.length - BATCH_SIZE);
//     }

//     await chrome.storage.local.set({ navigationData: updatedData });
//   } catch (error) {
//     console.error("Error saving data locally:", error);
//   }
// };

const saveDataLocally = async (data) => {
  try {
    const result = await chrome.storage.local.get({ navigationData: [] });
    let existingData = result.navigationData;

    // Create a map for quick deduplication based on URL
    const urlMap = new Map();

    // First, add existing data
    for (const item of existingData) {
      urlMap.set(item.url, item);
    }

    // Then override/add with new data (latest wins)
    for (const item of data) {
      urlMap.set(item.url, item);
    }

    // Convert map back to array
    let updatedData = Array.from(urlMap.values());

    // Trim to BATCH_SIZE if needed
    if (updatedData.length > BATCH_SIZE) {
      updatedData = updatedData.slice(updatedData.length - BATCH_SIZE);
    }

    await chrome.storage.local.set({ navigationData: updatedData });
  } catch (error) {
    console.error("Error saving data locally:", error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  initializeUserId();
});

chrome.webNavigation.onCompleted.addListener((details) => {
  chrome.tabs.get(details.tabId, (tab) => {
    if (tab.url.startsWith("http")) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          function: () => {
            const rawParagraphs = Array.from(document.querySelectorAll("p"))
              .map((p) => p.innerText.trim())
              .filter(Boolean)
              .join(" ");

            const limitedParagraphs = rawParagraphs.slice(0, 100);
            return {
              title: document.title,
              headings: Array.from(document.querySelectorAll("h1, h2")).map(
                (h) => h.innerText
              ),
              // paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText)
              paragraphs: limitedParagraphs,
            };
          },
        },
        (results) => {
          let content = results[0].result;
          let data = [
            {
              title: content.title,
              url: tab.url,
              content: `${content.title} ${content.headings.join(" ")} ${
                content.paragraphs
              }`,
              date: `${formattedDate} `,
            },
          ];

          saveDataLocally(data);
          console.log(data);
        }
      );
    }
  });
});
