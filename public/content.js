const extractContent = () => {
    return {
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText),
      paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText)
    };
  };
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractContent") {
      sendResponse(extractContent());
    }
  });
  