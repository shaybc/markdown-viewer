export const STORAGE_KEYS = Object.freeze({
  tabs: "markdownViewerTabs",
  activeTabId: "markdownViewerActiveTabId",
  theme: "markdownViewerTheme",
});

export const APP_CONSTANTS = Object.freeze({
  renderDelay: 100,
  scrollSyncDelay: 10,
});

export function createAppState() {
  return {
    markdownRenderTimeout: null,
    RENDER_DELAY: APP_CONSTANTS.renderDelay,
    syncScrollingEnabled: true,
    isEditorScrolling: false,
    isPreviewScrolling: false,
    scrollSyncTimeout: null,
    SCROLL_SYNC_DELAY: APP_CONSTANTS.scrollSyncDelay,
    currentViewMode: "split",
    autoSelectFileEnabled: true,
    currentFolderTreeNodes: [],
    folderTreeFilterText: "",
    selectedFolderTreeTags: new Set(),
    currentFolderSortMode: "name-asc",
    showUnsupportedFolderFiles: false,
    isFolderOpen: false,
    shownFolderInputFallbackNotice: false,
    previewHoveredLinkUrl: "",
    linkAutocompleteLayer: null,
    linkAutocompleteState: null,
    tabs: [],
    activeTabId: null,
    graph: {
      currentTabId: null,
      tabs: [],
      snapshots: new Map(),
    },
  };
}
