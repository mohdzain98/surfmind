# Changelog

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
