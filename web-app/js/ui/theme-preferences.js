(function (window) {
  "use strict";

  function registerThemePreferences(app, deps) {
    var storageKey = deps.storageKey;
    var defaultState = deps.defaultState;

    function loadGlobalState() {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || {};
      } catch (_) {
        return {};
      }
    }

    function saveGlobalState(patch) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Object.assign({}, loadGlobalState(), patch)));
        deps.scheduleGlobalProfileWrite();
      } catch (error) {
        console.warn("Failed to save preferences:", error);
      }
    }

    function getDefaultThemePreference() {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    function getDefaultGlobalState() {
      return Object.assign({}, defaultState, {
        theme: getDefaultThemePreference(),
      });
    }

    function updateThemeButtonLabels(theme) {
      var nextThemeLabel = theme === "dark" ? "Light" : "Dark";
      var icon = theme === "dark" ? "bi-sun" : "bi-moon";
      var labelHtml = '<i class="bi ' + icon + ' me-2"></i> ' + nextThemeLabel + " Mode";

      if (deps.themeToggle) deps.themeToggle.innerHTML = labelHtml;
      if (deps.mobileThemeToggle) deps.mobileThemeToggle.innerHTML = labelHtml;
    }

    function initializeTheme() {
      var savedTheme = loadGlobalState().theme;
      var initialTheme = savedTheme || getDefaultThemePreference();

      document.documentElement.setAttribute("data-theme", initialTheme);
      updateThemeButtonLabels(initialTheme);

      return initialTheme;
    }

    function toggleTheme() {
      var theme = document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";

      document.documentElement.setAttribute("data-theme", theme);
      saveGlobalState({ theme: theme });
      updateThemeButtonLabels(theme);
      deps.renderMarkdown();
    }

    function bindThemeToggle() {
      if (deps.themeToggle) {
        deps.themeToggle.addEventListener("click", toggleTheme);
      }
    }

    var api = {
      bindThemeToggle: bindThemeToggle,
      getDefaultGlobalState: getDefaultGlobalState,
      getDefaultThemePreference: getDefaultThemePreference,
      initializeTheme: initializeTheme,
      loadGlobalState: loadGlobalState,
      saveGlobalState: saveGlobalState,
      toggleTheme: toggleTheme,
      updateThemeButtonLabels: updateThemeButtonLabels,
    };

    app.services.preferences = api;
    app.actions.toggleTheme = toggleTheme;
    app.registerModule("themePreferences", api);

    return api;
  }

  window.registerMarkdownViewerThemePreferences = registerThemePreferences;
})(window);
