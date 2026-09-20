# Changelog

## v1.8.2

### Added

- Added human-readable sync and search errors for common HTTP and network failures.
- Added a Sync Coverage tip and Settings shortcut when a search returns no relevant data.

### Changed

- Limited history extraction to 15 sections per page and 2,000 characters per section while preserving richer bookmark content.
- Removed common navigation, footer, sidebar, cookie-consent, and advertisement elements before extracting page content.
- Split large history uploads into sequential, size-bounded batches and checkpointed each completed batch so interrupted full syncs resume safely.
- Simplified the Settings layout by removing the divider below Sync Coverage.

### Fixed

- Prevented oversized history payloads from exceeding server request limits during large catch-up syncs.
- Replaced raw errors such as HTTP 413 responses with actionable messages for extension users.

## v1.8

### Added

- Added a one-time full-page introduction for major releases and retained the compact banner for minor releases.
- Added version-aware update persistence with migration from the legacy per-release flags.

### Changed

- Promoted the popup-to-side-panel redesign and upgraded retrieval experience as a structural 1.x release.

## v1.76

### Added

- Migrated the extension UI from a temporary toolbar popup to Chrome's persistent side panel.
- Added responsive panel sizing and roomier result cards for narrow and wide panel layouts.
- Added Readability-based main-content extraction with heading-aware sections and fallbacks for unstructured pages.
- Added heading breadcrumbs to section-level search result cards.
- Added no-login cross-browser pairing settings with expiring codes, copy support, redemption feedback, and unlink controls.

### Changed

- Toolbar clicks now open SurfMind through Chrome's native side-panel behavior.
- Aligned the package, manifest, update banner, and changelog versions.
- History ingestion now sends full section content and structured heading/domain/visit metadata instead of a 100-character page snippet.
- Save and search requests now use one stable, unsuffixed `browser_uuid` so linked installations resolve to the correct shared account.

### Fixed

- Removed background and content scripts from the React page shell; Chrome now loads them only in their correct manifest-declared contexts.

## v1.7

### Added

- Support for richer bookmark metadata in backend payloads: `domain`, `folder`, and `title`.
- Model selection enums to centralize default/alternate provider routing.
- Exception mapping hooks for Redis and LLM errors to return user-friendly API/SSE messages.

### Changed

- Streaming pipeline now validates retrieved documents earlier so later LLM steps use query-validated docs.
- Post-processing prompt context now includes title/source/content blocks for stronger relevance filtering.
- LLM provider configuration updated to:
  - `gpt-4.1-mini`
  - `gemini-2.5-flash`
- Extension update banner/version tracking bumped from `v1.6` to `v1.7`.
- UI streaming step label updated to `Validating Results with Query`.

### Fixed

- Fixed `/v1/save-data` response path for Redis connection failures (no more `None` response path).
- Fixed bookmark upload validation issue by allowing numeric bookmark timestamps in `HistoryItem.date`.
- Fixed UI stale answer issue by clearing `head`/`format` when final validated docs are empty.
- Improved empty-result behavior to show no-result state instead of showing previous response text.
