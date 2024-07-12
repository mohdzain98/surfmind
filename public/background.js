const BATCH_SIZE = 100; 
const date = new Date()

const saveDataLocally = async (data) => {
  try {
    const result = await chrome.storage.local.get({ navigationData: [] });
    let updatedData = result.navigationData.concat(data);

    if (updatedData.length > BATCH_SIZE) {
      updatedData = updatedData.slice(updatedData.length - BATCH_SIZE);
    }

    await chrome.storage.local.set({ navigationData: updatedData });
  } catch (error) {
    console.error('Error saving data locally:', error);
  }
};

chrome.webNavigation.onCompleted.addListener((details) => {
  chrome.tabs.get(details.tabId, (tab) => {
    if (tab.url.startsWith("http")) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          return {
            title: document.title,
            headings: Array.from(document.querySelectorAll('h1')).map(h => h.innerText),
            // paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText)${content.paragraphs.join(' ')}
          };
        }
      }, (results) => {
        let content = results[0].result;
        let data = [{
          url: tab.url,
          content: `${content.title} ${content.headings.join(' ')}`,
          date:`${date.getDate()} ${date.getMonth()} ${date.getFullYear()}`
        }];

        saveDataLocally(data);
        console.log(data)
      });
    }
  });
});
