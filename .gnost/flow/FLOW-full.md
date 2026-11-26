# Full Execution Flow

```mermaid
flowchart TD
  dir_src_services["src/services<br/>15 files"]
  dir_src_context["src/context<br/>2 files"]
  dir_src_types["src/types<br/>5 files"]
  dir_src_components["src/components<br/>20 files"]
  dir_src["src<br/>3 files"]
  dir_src --> dir_src_components
  dir_src --> dir_src_context
  dir_src_components -->|3| dir_src_context
  dir_src_components -->|24| dir_src_services
  dir_src_components -.->|12| dir_src_types
  dir_src_context --> dir_src_components
  dir_src_context -->|7| dir_src_services
  dir_src_context -.->|2| dir_src_types
  dir_src_services --> dir_src_components
  dir_src_services -.->|11| dir_src_types
  dir_src_types -.-> dir_src_services
```

> Grouped by folder to stay readable: 5 folders; numbers on arrows count the file-level imports they stand for.
> Dotted arrows: imports that do not run when the module loads.

# Detail by folder

The diagram above groups files by folder. These show the files inside the biggest folders.

## `src/components` (20 files)

```mermaid
flowchart TD
  src_components_BookmarkFolderPicker_tsx["src/components/BookmarkFolderPicker.tsx"]
  src_components_Bookmarks_tsx["src/components/Bookmarks.tsx"]
  src_components_Combined_tsx["src/components/Combined.tsx"]
  src_components_ConfirmationDialog_tsx["src/components/ConfirmationDialog.tsx"]
  src_components_FastModeSettings_tsx["src/components/FastModeSettings.tsx"]
  src_components_LinkedBrowsers_tsx["src/components/LinkedBrowsers.tsx"]
  src_components_Popup_tsx["src/components/Popup.tsx"]
  src_components_PrivacySettings_tsx["src/components/PrivacySettings.tsx"]
  src_components_RatePromptBanner_tsx["src/components/RatePromptBanner.tsx"]
  src_components_RecentSearches_tsx["src/components/RecentSearches.tsx"]
  src_components_SavedBookmarks_tsx["src/components/SavedBookmarks.tsx"]
  src_components_SavedHistory_tsx["src/components/SavedHistory.tsx"]
  src_components_SearchComposer_tsx["src/components/SearchComposer.tsx"]
  src_components_SearchModeToggle_tsx["src/components/SearchModeToggle.tsx"]
  src_components_SearchThought_tsx["src/components/SearchThought.tsx"]
  src_components_SettingsHome_tsx["src/components/SettingsHome.tsx"]
  src_components_SourceCard_tsx["src/components/SourceCard.tsx"]
  src_components_SyncSettings_tsx["src/components/SyncSettings.tsx"]
  src_components_Update_tsx["src/components/Update.tsx"]
  src_components_Bookmarks_tsx --> src_components_BookmarkFolderPicker_tsx
  src_components_Bookmarks_tsx --> src_components_SearchComposer_tsx
  src_components_Combined_tsx --> src_components_SearchComposer_tsx
  src_components_LinkedBrowsers_tsx --> src_components_ConfirmationDialog_tsx
  src_components_Popup_tsx --> src_components_BookmarkFolderPicker_tsx
  src_components_Popup_tsx --> src_components_Bookmarks_tsx
  src_components_Popup_tsx --> src_components_Combined_tsx
  src_components_Popup_tsx --> src_components_FastModeSettings_tsx
  src_components_Popup_tsx --> src_components_PrivacySettings_tsx
  src_components_Popup_tsx --> src_components_RatePromptBanner_tsx
  src_components_Popup_tsx --> src_components_RecentSearches_tsx
  src_components_Popup_tsx --> src_components_SavedBookmarks_tsx
  src_components_Popup_tsx --> src_components_SavedHistory_tsx
  src_components_Popup_tsx --> src_components_SearchComposer_tsx
  src_components_Popup_tsx --> src_components_SearchModeToggle_tsx
  src_components_Popup_tsx --> src_components_SearchThought_tsx
  src_components_Popup_tsx --> src_components_SettingsHome_tsx
  src_components_Popup_tsx --> src_components_SourceCard_tsx
  src_components_Popup_tsx --> src_components_SyncSettings_tsx
  src_components_Popup_tsx --> src_components_Update_tsx
  src_components_PrivacySettings_tsx --> src_components_ConfirmationDialog_tsx
  src_components_RecentSearches_tsx --> src_components_SourceCard_tsx
  src_components_SyncSettings_tsx --> src_components_ConfirmationDialog_tsx
  src_components_SyncSettings_tsx --> src_components_LinkedBrowsers_tsx
```

## `src/services` (15 files)

```mermaid
flowchart TD
  src_services_bookmarkFolders_ts["src/services/bookmarkFolders.ts"]
  src_services_fastMode_ts["src/services/fastMode.ts"]
  src_services_pageCounts_ts["src/services/pageCounts.ts"]
  src_services_ratePrompt_ts["src/services/ratePrompt.ts"]
  src_services_recentSearches_ts["src/services/recentSearches.ts"]
  src_services_searchRequest_ts["src/services/searchRequest.ts"]
  src_services_storeConfig_ts["src/services/storeConfig.ts"]
  src_services_syncApi_ts["src/services/syncApi.ts"]
  src_services_pageCounts_ts --> src_services_bookmarkFolders_ts
  src_services_ratePrompt_ts --> src_services_storeConfig_ts
  src_services_recentSearches_ts --> src_services_fastMode_ts
  src_services_searchRequest_ts --> src_services_syncApi_ts
```

## `src/types` (5 files)

```mermaid
flowchart TD
  src_types_bookmarks_ts["src/types/bookmarks.ts"]
  src_types_index_ts["src/types/index.ts"]
  src_types_search_ts["src/types/search.ts"]
  src_types_sync_ts["src/types/sync.ts"]
  src_types_user_ts["src/types/user.ts"]
  src_types_index_ts --> src_types_bookmarks_ts
  src_types_index_ts --> src_types_search_ts
  src_types_index_ts --> src_types_sync_ts
  src_types_index_ts --> src_types_user_ts
  src_types_user_ts -.-> src_types_search_ts
```

> Dotted arrows: imports that do not run when the module loads.

## `src` (3 files)

```mermaid
flowchart TD
  src_App_tsx["src/App.tsx"]
  src_index_tsx["src/index.tsx"]
  src_reportWebVitals_ts["src/reportWebVitals.ts"]
  src_index_tsx --> src_App_tsx
  src_index_tsx --> src_reportWebVitals_ts
```

## `src/context` (2 files)

```mermaid
flowchart TD
  src_context_UserState_tsx["src/context/UserState.tsx"]
  src_context_userContext_ts["src/context/userContext.ts"]
  src_context_UserState_tsx --> src_context_userContext_ts
```

> ℹ️ This file renders the complete Mermaid diagram on GitHub.
> For raw Mermaid source, see [**FLOW-full.mmd**](./FLOW-full.mmd). Every file and import, ungrouped and nothing omitted: [**flow-complete.mmd**](./flow-complete.mmd)

---

<sub>Generated by [GNOST](https://gnost.readthedocs.io) 0.7.0rc2. Try it on your own code: `npx gnost-cli onboard .`</sub>
