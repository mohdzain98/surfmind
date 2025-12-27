<center><h1>SurfMind - Smarter Browsing</h1></center>

<p align="center">
  <a href="https://github.com/mohdzain98/surfmind/releases">
    <img src="https://img.shields.io/github/v/release/mohdzain98/surfmind?color=blue" alt="version"/>
  </a>
  <a href="https://github.com/mohdzain98/surfmind/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-red.svg" alt="license"/>
  </a>
  <img src="https://img.shields.io/badge/chrome-extension-brightgreen" alt="chrome extension"/>
</p>

### Overview
SurfMind is a Chrome extension designed to enhance your browsing experience by intelligently tracking and managing the websites you visit. Leveraging advanced AI technologies like Vector Embeddings and FAISS, SurfMind provides a seamless and efficient way to keep a detailed log of your web activity. <br>

### Key Features
- <strong>Automatic Website Tracking</strong> : Effortlessly logs every website you visit, along with key content, ensuring you never lose track of important information.
- <strong>AI-Powered Search</strong> : Utilize powerful AI models to search your browsing history by topic. Simply ask SurfMind about the websites you've visited related to specific topics, and it will quickly retrieve relevant results
- <strong>Streaming Progress</strong> : See retrieval, LLM response, and validation steps in real time while your answer is generated
- <strong>Local Data Storage</strong> : Keeps your data securely stored locally on user's device, ensuring privacy and security. Data is only sent to the server when user initiate a search, reducing server load and enhancing performance
- <strong>Efficient Data Management</strong> : Automatically manages and maintains your browsing history, keeping only the most recent and relevant data to avoid unnecessary storage buildup.
- <strong>User-Friendly Interface</strong> : Features an intuitive and responsive interface built with React and Bootstrap, making it easy to view and search your browsing history

### How It Works
- <strong>Tracking and Storage</strong>: As you browse, SurfMind tracks the websites you visit and stores the data locally in your browser's storage.
- <strong>Data Ingestion</strong> : When you perform a search, SurfMind ingests the locally stored data, the ingested data is converted into vector embeddings and sends it to the server for processing.
- <strong>AI-Driven Search</strong> : The server utilizes advanced AI models to analyze and retrieve the most relevant websites based on your search query.
- <strong>Efficient Retrieval</strong> : Results are promptly returned to you, providing a comprehensive overview of your browsing history related to your query.

### Benefits
- <strong>Enhanced Productivity</strong> : Quickly find websites you've previously visited without having to remember specific URLs or manually search through your history.
- <strong>Privacy-Focused</strong> : Your data remains private and secure, stored locally, and only shared when necessary for search operations.
- <strong>AI Integration</strong> : Leverage state-of-the-art AI technologies to make your browsing history more accessible and useful.

### Tech Stack
- <strong>Extension UI</strong> : React + Bootstrap (MV3 popup)
- <strong>Backend</strong> : FastAPI + Redis
- <strong>RAG</strong> : LangChain, BM25 + FAISS, Gemini/OpenAI models

### Architecture
- <strong>Extension</strong> : Tracks navigation and bookmarks, stores locally, and triggers search from the popup UI
- <strong>Backend API</strong> : Receives saved data and streams step-by-step search progress (`/api/search/stream`)
- <strong>Retrieval Pipeline</strong> : Hybrid retrieval (BM25 + FAISS), LLM response, structured parsing, and post-processing

## Privacy Policy
<a href="https://docschat.in/product/surfmind" target="_blank" rel="noreferrer">
  <img src="https://img.shields.io/badge/Privacy%20Policy-View-blue" alt="Privacy Policy"/>
</a>

## License
MIT License. See `LICENSE`.
