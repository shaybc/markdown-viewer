(function (window) {
  "use strict";

  function registerScrollSync(app, deps) {
    var state = app.state;
    var delay = deps.delay;

    function syncEditorToPreview() {
      if (!state.syncScrollingEnabled || state.isPreviewScrolling) return;

      state.isEditorScrolling = true;
      clearTimeout(state.scrollSyncTimeout);

      state.scrollSyncTimeout = setTimeout(function () {
        var editorScrollRatio =
          deps.editorPane.scrollTop /
          (deps.editorPane.scrollHeight - deps.editorPane.clientHeight);
        var previewScrollPosition =
          (deps.previewPane.scrollHeight - deps.previewPane.clientHeight) *
          editorScrollRatio;

        if (!isNaN(previewScrollPosition) && isFinite(previewScrollPosition)) {
          deps.previewPane.scrollTop = previewScrollPosition;
        }

        setTimeout(function () {
          state.isEditorScrolling = false;
        }, 50);
      }, delay);
    }

    function syncPreviewToEditor() {
      if (!state.syncScrollingEnabled || state.isEditorScrolling) return;

      state.isPreviewScrolling = true;
      clearTimeout(state.scrollSyncTimeout);

      state.scrollSyncTimeout = setTimeout(function () {
        var previewScrollRatio =
          deps.previewPane.scrollTop /
          (deps.previewPane.scrollHeight - deps.previewPane.clientHeight);
        var editorScrollPosition =
          (deps.editorPane.scrollHeight - deps.editorPane.clientHeight) *
          previewScrollRatio;

        if (!isNaN(editorScrollPosition) && isFinite(editorScrollPosition)) {
          deps.editorPane.scrollTop = editorScrollPosition;
        }

        setTimeout(function () {
          state.isPreviewScrolling = false;
        }, 50);
      }, delay);
    }

    function updateSyncToggleButtons() {
      deps.syncToggleButtons.forEach(function (button) {
        if (state.syncScrollingEnabled) {
          button.innerHTML = '<i class="bi bi-link-45deg"></i> <span>Sync Off</span>';
          button.classList.add("sync-disabled");
          button.classList.remove("sync-enabled");
          button.classList.add("border-primary");
          button.setAttribute("aria-label", "Turn sync scrolling off");
        } else {
          button.innerHTML = '<i class="bi bi-link"></i> <span>Sync On</span>';
          button.classList.add("sync-enabled");
          button.classList.remove("sync-disabled");
          button.classList.remove("border-primary");
          button.setAttribute("aria-label", "Turn sync scrolling on");
        }
      });
    }

    function toggleSyncScrolling() {
      state.syncScrollingEnabled = !state.syncScrollingEnabled;
      updateSyncToggleButtons();
      deps.saveGlobalState({ syncScrollingEnabled: state.syncScrollingEnabled });
    }

    function bindScrollSync() {
      deps.editorPane.addEventListener("scroll", syncEditorToPreview);
      deps.previewPane.addEventListener("scroll", syncPreviewToEditor);
      deps.syncToggleButtons.forEach(function (button) {
        button.addEventListener("click", toggleSyncScrolling);
      });
    }

    var api = {
      bindScrollSync: bindScrollSync,
      syncEditorToPreview: syncEditorToPreview,
      syncPreviewToEditor: syncPreviewToEditor,
      toggleSyncScrolling: toggleSyncScrolling,
      updateSyncToggleButtons: updateSyncToggleButtons,
    };

    app.registerModule("scrollSync", api);
    return api;
  }

  window.registerMarkdownViewerScrollSync = registerScrollSync;
})(window);
