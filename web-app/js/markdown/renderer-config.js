(function(window, document) {
  "use strict";

  function registerMarkdownViewerRendererConfig(app, deps) {
    const marked = deps.marked;
    const hljs = deps.hljs;
    const mermaid = deps.mermaid;

    function initMermaid() {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const mermaidTheme = currentTheme === "dark" ? "dark" : "default";

      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        securityLevel: "loose",
        flowchart: { useMaxWidth: true, htmlLabels: true },
        fontSize: 16
      });
    }

    function renderCodeBlock(code, language) {
      const normalizedLanguage = (language || "").trim().split(/\s+/)[0].toLowerCase();

      if (normalizedLanguage === "mermaid") {
        const uniqueId = "mermaid-diagram-" + Math.random().toString(36).substr(2, 9);
        return `<div class="mermaid-container"><div class="mermaid" id="${uniqueId}">${code}</div></div>`;
      }

      const validLanguage = hljs.getLanguage(normalizedLanguage) ? normalizedLanguage : "plaintext";
      const highlightedCode = hljs.highlight(code, {
        language: validLanguage
      }).value;
      return `<pre><code class="hljs ${validLanguage}">${highlightedCode}</code></pre>`;
    }

    function configureMarkedRenderer() {
      const markedOptions = {
        gfm: true,
        breaks: false,
        pedantic: false,
        sanitize: false,
        smartypants: false,
        xhtml: false,
        headerIds: true,
        mangle: false
      };

      const renderer = new marked.Renderer();
      renderer.code = renderCodeBlock;

      marked.setOptions({
        ...markedOptions,
        renderer
      });
    }

    function initialize() {
      try {
        initMermaid();
      } catch (error) {
        console.warn("Mermaid initialization failed:", error);
      }

      configureMarkedRenderer();
    }

    const api = {
      configureMarkedRenderer,
      initMermaid,
      initialize,
      renderCodeBlock
    };

    app.registerModule("rendererConfig", api);
    return api;
  }

  window.registerMarkdownViewerRendererConfig = registerMarkdownViewerRendererConfig;
})(window, document);
