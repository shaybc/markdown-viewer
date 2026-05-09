(function(window) {
  "use strict";

  function registerMarkdownViewerEditorSyntaxHighlight(app, deps) {
    const markdownEditor = deps.markdownEditor;
    const editorSyntaxHighlight = deps.editorSyntaxHighlight;
    const escapeHtml = deps.escapeHtml;

    function rangesOverlap(existingRanges, start, end) {
      return existingRanges.some(function(range) {
        return start < range.end && end > range.start;
      });
    }

    function addInlineSyntaxRanges(line, regex, className, ranges) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (end > start && !rangesOverlap(ranges, start, end)) {
          ranges.push({ start, end, className });
        }
        if (match[0] === "") regex.lastIndex += 1;
      }
    }

    function renderInlineMarkdownSyntax(line) {
      if (!line) return "";

      const ranges = [];
      addInlineSyntaxRanges(line, /`+[^`\n]*`+/g, "editor-md-code", ranges);
      addInlineSyntaxRanges(line, /!?\[[^\]\n]+\]\([^\)\n]+\)/g, "editor-md-link", ranges);
      addInlineSyntaxRanges(line, /https?:\/\/[^\s<>)]+/g, "editor-md-url", ranges);
      addInlineSyntaxRanges(line, /(\*\*|__)(?=\S)(.+?\S)\1/g, "editor-md-strong", ranges);
      addInlineSyntaxRanges(line, /(^|[^*_])(\*|_)(?=\S)([^*_\n]+?\S)\2(?!\2)/g, "editor-md-emphasis", ranges);

      ranges.sort(function(a, b) {
        return a.start - b.start || b.end - a.end;
      });

      let markup = "";
      let cursor = 0;
      ranges.forEach(function(range) {
        if (range.start < cursor) return;
        markup += escapeHtml(line.slice(cursor, range.start));
        markup += `<span class="${range.className}">${escapeHtml(line.slice(range.start, range.end))}</span>`;
        cursor = range.end;
      });
      markup += escapeHtml(line.slice(cursor));
      return markup;
    }

    function renderMarkdownSyntaxLine(line, state) {
      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
      if (fenceMatch) {
        state.inFence = !state.inFence;
        return `${escapeHtml(fenceMatch[1])}<span class="editor-md-marker">${escapeHtml(fenceMatch[2])}</span><span class="editor-md-code">${escapeHtml(fenceMatch[3])}</span>`;
      }

      if (state.inFence) {
        return `<span class="editor-md-code">${escapeHtml(line)}</span>`;
      }

      const headingMatch = line.match(/^(\s*)(#{1,6})(\s+.*)$/);
      if (headingMatch) {
        return `${escapeHtml(headingMatch[1])}<span class="editor-md-marker">${escapeHtml(headingMatch[2])}</span><span class="editor-md-heading">${renderInlineMarkdownSyntax(headingMatch[3])}</span>`;
      }

      const hrMatch = line.match(/^(\s{0,3})([-*_])(?:\s*\2){2,}\s*$/);
      if (hrMatch) {
        return `<span class="editor-md-hr">${escapeHtml(line)}</span>`;
      }

      const quoteMatch = line.match(/^(\s*>+\s?)(.*)$/);
      if (quoteMatch) {
        return `<span class="editor-md-quote">${escapeHtml(quoteMatch[1])}</span>${renderInlineMarkdownSyntax(quoteMatch[2])}`;
      }

      const listMatch = line.match(/^(\s*)([-+*]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/);
      if (listMatch) {
        const taskMarkup = listMatch[4]
          ? `<span class="editor-md-task">${escapeHtml(listMatch[4])}</span>`
          : "";
        return `${escapeHtml(listMatch[1])}<span class="editor-md-list">${escapeHtml(listMatch[2])}</span>${escapeHtml(listMatch[3])}${taskMarkup}${renderInlineMarkdownSyntax(listMatch[5])}`;
      }

      if (/^\s*\|.*\|\s*$/.test(line) || /^\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+$/.test(line)) {
        return `<span class="editor-md-table">${renderInlineMarkdownSyntax(line)}</span>`;
      }

      return renderInlineMarkdownSyntax(line);
    }

    function renderEditorSyntaxHighlights() {
      if (!editorSyntaxHighlight || !markdownEditor) return;

      const state = { inFence: false };
      const lines = markdownEditor.value.split("\n");
      const markup = lines.map(function(line, index) {
        const renderedLine = renderMarkdownSyntaxLine(line, state) || " ";
        return renderedLine + (index < lines.length - 1 ? "\n" : "");
      }).join("");

      editorSyntaxHighlight.innerHTML = `<div class="editor-syntax-highlight-inner">${markup}</div>`;
      markdownEditor.classList.add("syntax-highlight-enabled");
      syncEditorSyntaxHighlightScroll();
    }

    function syncEditorSyntaxHighlightScroll() {
      if (!editorSyntaxHighlight) return;

      const inner = editorSyntaxHighlight.querySelector(".editor-syntax-highlight-inner");
      if (!inner) return;

      inner.style.transform = `translate(${-markdownEditor.scrollLeft}px, ${-markdownEditor.scrollTop}px)`;
    }

    const api = {
      renderEditorSyntaxHighlights,
      renderInlineMarkdownSyntax,
      renderMarkdownSyntaxLine,
      syncEditorSyntaxHighlightScroll
    };

    app.registerModule("editorSyntaxHighlight", api);
    return api;
  }

  window.registerMarkdownViewerEditorSyntaxHighlight = registerMarkdownViewerEditorSyntaxHighlight;
})(window);
