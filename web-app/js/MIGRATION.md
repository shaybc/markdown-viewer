# `web-app/script.js` Classic Script Migration

This app is being migrated from one large classic script into smaller classic
scripts. Keep `script.js` behavior-compatible while moving one feature area at
a time into `web-app/js/`.

## Current Boot Shape

- `js/core/context.js` creates `window.createMarkdownViewerApp()`.
- `js/app.js` creates `window.markdownViewerApp`.
- `script.js` still owns the main `DOMContentLoaded` flow and bridges its local
  DOM references, constants, and selected state into `window.markdownViewerApp`.
- New classic scripts expose one `window.registerMarkdownViewer...` function.
  `script.js` calls that function with the specific dependencies the module
  needs.
- Shared services live under `window.markdownViewerApp.services`, for example
  `app.services.preferences`.

## Migration Order

| Area | Target | Status |
|------|--------|--------|
| Share URL logic | `js/share-url.js` | Moved |
| Theme and global preferences | `js/ui/theme-preferences.js` | Partial: preference storage and theme toggle moved |
| Folder picker platform helpers | `js/platform/folder-picker.js` | Moved |
| Clipboard copy helpers | `js/clipboard.js` | Moved |
| Scroll synchronization | `js/scroll-sync.js` | Moved |
| Unsaved-change tracking | `js/unsaved-changes.js` | Moved |
| Recent files and folders | `js/recent/index.js` | Pending |
| Keyboard shortcuts | `js/keyboard-shortcuts.js` | Moved |
| Editor context menu | `js/editor/context-menu.js` | Pending |
| Editor line/status UI | `js/editor/line-status.js` | Partial: line numbers, current-line highlight, and selection highlights moved |
| Autocomplete | `js/editor/autocomplete.js` | Pending |
| Markdown renderer configuration | `js/markdown/renderer-config.js` | Pending |
| Markdown rendering | `js/markdown/rendering.js` | Pending |
| Mermaid tools | `js/markdown/mermaid.js` | Pending |
| Tabs | `js/tabs/index.js` | Pending |
| Folder tree | `js/sidebar/folder-tree.js` | Pending |
| Sidebar file/folder operations | `js/sidebar/file-folder-operations.js` | Pending |
| Graph extraction | `js/graph/extraction.js` | Pending |
| Graph persistence and comparison | `js/graph/persistence.js` | Pending |
| Graph rendering and interaction | `js/graph/rendering.js` | Pending |
| Import: drag and drop | `js/import/drag-drop.js` | Pending |
| Import: GitHub | `js/import/github.js` | Pending |
| Export logic | `js/export/index.js` | Pending |
| Save logic | `js/save/index.js` | Pending |
| View mode and layout controls | `js/ui/view-layout.js` | Pending |
| Modal and menu lifecycle | `js/ui/modal-menu.js` | Pending |
| Tags | `js/tags/index.js` | Pending |
| Rename and link maintenance | `js/rename-link-maintenance.js` | Pending |
