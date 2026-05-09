(function (window, document) {
  "use strict";

  function isPrimaryModifier(event) {
    return !!(event.ctrlKey || event.metaKey);
  }

  function registerKeyboardShortcuts(app, deps) {
    function handleDocumentKeydown(event) {
      var key = String(event.key || "");

      if (isPrimaryModifier(event) && key === "s") {
        event.preventDefault();
        deps.saveCurrentFileIfChanged();
        return;
      }

      if (isPrimaryModifier(event) && key === "c") {
        var activeEl = document.activeElement;
        var isTextControl = activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT");
        var hasSelection = window.getSelection && window.getSelection().toString().trim().length > 0;
        var editorHasSelection = deps.markdownEditor.selectionStart !== deps.markdownEditor.selectionEnd;

        if (!isTextControl && !hasSelection && !editorHasSelection) {
          event.preventDefault();
          deps.copyMarkdownButton.click();
        }
      }

      if (isPrimaryModifier(event) && event.shiftKey && key === "S") {
        event.preventDefault();
        if (deps.getCurrentViewMode() === "split") {
          deps.toggleSyncScrolling();
        }
        return;
      }

      if (isPrimaryModifier(event) && key === "t") {
        event.preventDefault();
        deps.newTab();
        return;
      }

      if (isPrimaryModifier(event) && key === "w") {
        event.preventDefault();
        deps.closeTab(deps.getActiveTabId());
        return;
      }

      if (key === "Escape") {
        deps.closeMermaidModal();
        deps.closeGraphComparisonDetailsModal();
        deps.hideGraphStaleModal();
      }
    }

    document.addEventListener("keydown", handleDocumentKeydown);

    var api = {
      handleDocumentKeydown: handleDocumentKeydown,
    };

    app.registerModule("keyboardShortcuts", api);
    return api;
  }

  window.registerMarkdownViewerKeyboardShortcuts = registerKeyboardShortcuts;
})(window, document);
