const BATCH_SIZE = 100; 
const date = new Date()
const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' };
const formattedDate = date.toLocaleDateString('en-US', options);

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
            headings: Array.from(document.querySelectorAll('h1, h2')).map(h => h.innerText),
            // paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText)
          };
        }
      }, (results) => {
        let content = results[0].result;
        let data = [{
          url: tab.url,
          content: `${content.title} ${content.headings.join(' ')}`,
          date:`${formattedDate} `
        }];

        saveDataLocally(data);
        console.log(data)
      });
    }
  });
});
