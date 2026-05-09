(function (window) {
  "use strict";

  function createMarkdownViewerApp() {
    return {
      constants: {},
      dom: {},
      state: {},
      actions: {},
      services: {},
      modules: {},
      registerModule: function registerModule(name, moduleApi) {
        if (!name) return;
        this.modules[name] = moduleApi || {};
      },
    };
  }

  window.createMarkdownViewerApp = createMarkdownViewerApp;
})(window);
