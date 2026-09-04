<h1 align="center">SurfMind - Smarter Browsing</h1>

<p align="center">
  <a href="https://github.com/mohdzain98/surfmind/releases">
    <img src="https://img.shields.io/github/v/release/mohdzain98/surfmind?color=blue" alt="version"/>
  </a>
  <a href="https://github.com/mohdzain98/surfmind/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-red.svg" alt="license"/>
  </a>
  <img src="https://img.shields.io/badge/chrome-extension-brightgreen" alt="chrome extension"/>
  <a href="https://surfmind.docschat.in/">
    <img src="https://img.shields.io/badge/website-SurfMind-blueviolet" alt="SurfMind website"/>
  </a>
  <a href="https://surfmind.docschat.in/privacy">
    <img src="https://img.shields.io/badge/privacy-policy-blue" alt="Privacy Policy"/>
  </a>
</p>

### Overview

SurfMind is a Chrome extension designed to enhance your browsing experience by intelligently tracking and managing the websites you visit. Leveraging advanced AI technologies like Vector Embeddings and FAISS, SurfMind provides a seamless and efficient way to keep a detailed log of your web activity. <br>

### Key Features

- <strong>Automatic Website Tracking</strong> : Extracts cleaned page content with Readability and preserves heading-scoped sections for more precise retrieval.
- <strong>AI-Powered Search</strong> : Utilize powerful AI models to search your browsing history by topic. Simply ask SurfMind about the websites you've visited related to specific topics, and it will quickly retrieve relevant results
- <strong>Streaming Progress</strong> : See retrieval, LLM response, and validation steps in real time while your answer is generated
- <strong>Local Data Storage</strong> : Keeps captured sections locally until the hybrid ingestion trigger syncs them. Unsynced data is sent after the configured count/time threshold or immediately before a search.
- <strong>Efficient Data Management</strong> : Automatically manages and maintains your browsing history, keeping only the most recent and relevant data to avoid unnecessary storage buildup.
- <strong>User-Friendly Interface</strong> : Features an intuitive and responsive interface built with React and Bootstrap, making it easy to view and search your browsing history
- <strong>No-Login Browser Sync</strong> : Links multiple browser installations with a short-lived one-time code, with no account signup required.

### How It Works

- <strong>Tracking and Storage</strong>: As you browse, SurfMind stores cleaned, heading-aware sections locally before batched ingestion.
- <strong>Data Ingestion</strong> : SurfMind batches unsynced heading-scoped sections in the background and flushes any remaining sections immediately before search.
- <strong>AI-Driven Search</strong> : The server utilizes advanced AI models to analyze and retrieve the most relevant websites based on your search query.
- <strong>Efficient Retrieval</strong> : Results are promptly returned to you, providing a comprehensive overview of your browsing history related to your query.

### Benefits

- <strong>Enhanced Productivity</strong> : Quickly find websites you've previously visited without having to remember specific URLs or manually search through your history.
- <strong>Privacy-Focused</strong> : Your data remains private and secure, stored locally, and only shared when necessary for search operations.
- <strong>AI Integration</strong> : Leverage state-of-the-art AI technologies to make your browsing history more accessible and useful.

### Tech Stack

- <strong>Extension UI</strong> : React + Bootstrap (Chrome MV3 side panel)
- <strong>Backend</strong> : FastAPI + Redis
- <strong>RAG</strong> : LangChain, BM25 + FAISS, Gemini/OpenAI models

### Architecture

- <strong>Extension</strong>: Tracks navigation and bookmarks, stores locally, and triggers search from a persistent side-panel UI
- <strong>Backend API</strong>: Receives saved data (`/v1/save-data`) and streams step-by-step search progress (`/v1/search-stream`)
- <strong>Retrieval Pipeline</strong>: Hybrid retrieval (BM25 + pgvector), LLM response, structured parsing, and post-processing

## Changelog

[![Changelog](https://img.shields.io/badge/changelog-CHANGELOG.md-blue)](./CHANGELOG.md)

## License

MIT License.
