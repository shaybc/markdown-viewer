const { expect, test } = require("@playwright/test");

const browserLibraryStub = `
  (function () {
    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function inlineMarkdown(value) {
      return escapeHtml(value)
        .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
        .replace(/\\*([^*]+)\\*/g, "<em>$1</em>");
    }

    var markedOptions = {};
    window.marked = {
      Renderer: function Renderer() {},
      setOptions: function setOptions(options) {
        markedOptions = options || {};
      },
      parse: function parse(markdown) {
        var lines = String(markdown || "").split(/\\r?\\n/);
        var html = "";
        var inList = false;

        for (var index = 0; index < lines.length; index += 1) {
          var line = lines[index];

          if (/^\`\`\`/.test(line)) {
            var language = line.replace(/^\`\`\`/, "").trim();
            var codeLines = [];
            index += 1;
            while (index < lines.length && !/^\`\`\`/.test(lines[index])) {
              codeLines.push(lines[index]);
              index += 1;
            }
            if (inList) {
              html += "</ul>";
              inList = false;
            }
            if (markedOptions.renderer && typeof markedOptions.renderer.code === "function") {
              html += markedOptions.renderer.code(codeLines.join("\\n"), language);
            } else {
              html += "<pre><code>" + escapeHtml(codeLines.join("\\n")) + "</code></pre>";
            }
            continue;
          }

          var heading = line.match(/^(#{1,6})\\s+(.+)$/);
          if (heading) {
            if (inList) {
              html += "</ul>";
              inList = false;
            }
            var level = heading[1].length;
            html += "<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">";
            continue;
          }

          var listItem = line.match(/^[-*]\\s+(.+)$/);
          if (listItem) {
            if (!inList) {
              html += "<ul>";
              inList = true;
            }
            html += "<li>" + inlineMarkdown(listItem[1]) + "</li>";
            continue;
          }

          if (!line.trim()) {
            if (inList) {
              html += "</ul>";
              inList = false;
            }
            continue;
          }

          if (inList) {
            html += "</ul>";
            inList = false;
          }
          html += "<p>" + inlineMarkdown(line) + "</p>";
        }

        if (inList) html += "</ul>";
        return html;
      }
    };

    window.hljs = {
      getLanguage: function () { return true; },
      highlight: function (code) { return { value: escapeHtml(code) }; }
    };
    window.DOMPurify = { sanitize: function (html) { return html; } };
    window.mermaid = {
      initialize: function () {},
      init: function () { return Promise.resolve(); },
      run: function () { return Promise.resolve(); }
    };
    window.MathJax = { typesetPromise: function () { return Promise.resolve(); } };
    window.joypixels = { shortnameToUnicode: function (value) { return value; } };
    window.pako = {
      deflate: function (bytes) { return bytes; },
      inflate: function (bytes) { return bytes; }
    };
    window.jsyaml = {
      load: function () { return {}; },
      dump: function () { return ""; }
    };
    window.saveAs = function () {};
    window.html2pdf = function () { return { set: function () { return this; }, from: function () { return this; }, save: function () { return Promise.resolve(); } }; };
    window.jspdf = { jsPDF: function () { return { internal: { pageSize: { getWidth: function () { return 100; }, getHeight: function () { return 100; } } }, addImage: function () {}, save: function () {} }; } };
    window.html2canvas = function () { return Promise.resolve(document.createElement("canvas")); };
    window.pdfMake = {};
    window.d3 = {};
    window.bootstrap = {};
  })();
`;

async function stubBrowserLibraries(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
      await route.continue();
      return;
    }

    if (/\.css(?:\?|$)/.test(url)) {
      await route.fulfill({ contentType: "text/css", body: "" });
      return;
    }

    await route.fulfill({ contentType: "application/javascript", body: browserLibraryStub });
  });
}

test.beforeEach(async ({ page }) => {
  page.errors = [];

  await stubBrowserLibraries(page);

  page.on("pageerror", (error) => page.errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

async function openApp(page, path = "/") {
  await page.goto(path);
  await expect(page.locator("#markdown-editor")).toBeVisible();
  await expect(page.locator("#markdown-preview")).toBeVisible();
}

test("loads into an editable split-view document", async ({ page }) => {
  await openApp(page);

  await expect(page.locator(".view-mode-btn[data-mode='split']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#markdown-editor")).toBeEditable();
  await expect(page.locator("#markdown-preview")).toBeVisible();
});

test("renders typed markdown in the preview", async ({ page }) => {
  await openApp(page);

  await page.locator("#markdown-editor").fill("# Project Notes\n\n- Alpha\n- Beta\n\n```js\nconsole.log('ok');\n```");

  const preview = page.locator("#markdown-preview");
  await expect(preview.getByRole("heading", { name: "Project Notes" })).toBeVisible();
  await expect(preview.locator("li", { hasText: "Alpha" })).toBeVisible();
  await expect(preview.locator("code", { hasText: "console.log" })).toBeVisible();
  await expect(preview.locator("code.hljs.js", { hasText: "console.log" })).toBeVisible();
});

test("switches between editor, preview, and split views", async ({ page }) => {
  await openApp(page);

  const editorPane = page.locator(".editor-pane");
  const previewPane = page.locator(".preview-pane");

  await page.locator(".view-mode-btn[data-mode='preview']").click();
  await expect(page.locator(".view-mode-btn[data-mode='preview']")).toHaveAttribute("aria-pressed", "true");
  await expect(previewPane).toBeVisible();
  await expect(editorPane).not.toBeVisible();

  await page.locator(".view-mode-btn[data-mode='editor']").click();
  await expect(page.locator(".view-mode-btn[data-mode='editor']")).toHaveAttribute("aria-pressed", "true");
  await expect(editorPane).toBeVisible();
  await expect(previewPane).not.toBeVisible();

  await page.locator(".view-mode-btn[data-mode='split']").click();
  await expect(page.locator(".view-mode-btn[data-mode='split']")).toHaveAttribute("aria-pressed", "true");
  await expect(editorPane).toBeVisible();
  await expect(previewPane).toBeVisible();
});

test("toggles theme and persists it across reloads", async ({ page }) => {
  await openApp(page);

  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const expectedTheme = initialTheme === "dark" ? "light" : "dark";

  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", expectedTheme);
  await expect(page.locator("#theme-toggle")).toContainText(initialTheme === "dark" ? "Dark Mode" : "Light Mode");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", expectedTheme);
});

test("opens and closes the mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  await page.locator("#mobile-menu-toggle").click();
  await expect(page.locator("#mobile-menu-panel")).toHaveClass(/active/);
  await expect(page.locator("#mobile-menu-overlay")).toHaveClass(/active/);

  await page.locator("#close-mobile-menu").click();
  await expect(page.locator("#mobile-menu-panel")).not.toHaveClass(/active/);

  await page.locator("#mobile-menu-toggle").click();
  await page.locator("#mobile-menu-overlay").dispatchEvent("click");
  await expect(page.locator("#mobile-menu-panel")).not.toHaveClass(/active/);
});

test("supports document keyboard shortcut for split-view sync scrolling", async ({ page }) => {
  await openApp(page);

  const syncButton = page.locator("#toggle-sync");
  const initialSyncText = await syncButton.innerText();

  await page.keyboard.press("Control+Shift+S");
  await expect(syncButton).not.toHaveText(initialSyncText);

  const toggledSyncText = await syncButton.innerText();
  await page.locator(".view-mode-btn[data-mode='preview']").click();
  await page.keyboard.press("Control+Shift+S");
  await expect(syncButton).toHaveText(toggledSyncText);
});

test("syncs editor scrolling to the preview pane while enabled", async ({ page }) => {
  await openApp(page);

  const markdown = Array.from({ length: 80 }, (_, index) => `## Section ${index + 1}\n\nParagraph ${index + 1}`).join("\n\n");
  await page.locator("#markdown-editor").fill(markdown);
  await expect(page.locator("#markdown-preview").getByRole("heading", { name: "Section 80" })).toBeVisible();

  await page.locator("#markdown-editor").evaluate((editor) => {
    editor.scrollTop = editor.scrollHeight;
    editor.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect.poll(() => page.locator(".preview-pane").evaluate((pane) => pane.scrollTop)).toBeGreaterThan(0);
});

test("keeps editor line numbers in sync with typed content", async ({ page }) => {
  await openApp(page);

  await page.locator("#markdown-editor").fill("First line\nSecond line\nThird line");

  const lineNumbers = page.locator("#editor-line-numbers .editor-line-number");
  await expect(lineNumbers).toHaveCount(3);
  await expect(lineNumbers.nth(0)).toHaveText("1");
  await expect(lineNumbers.nth(1)).toHaveText("2");
  await expect(lineNumbers.nth(2)).toHaveText("3");
});

test("updates document statistics and focused editor position", async ({ page }) => {
  await openApp(page);

  const markdown = "Alpha beta\nGamma delta";
  await page.locator("#markdown-editor").fill(markdown);

  await expect(page.locator("#word-count")).toHaveText("4");
  await expect(page.locator("#char-count")).toHaveText(String(markdown.length));
  await expect(page.locator("#reading-time")).toHaveText("1");

  await page.locator("#markdown-editor").evaluate((editor) => {
    editor.focus();
    editor.selectionStart = editor.value.length;
    editor.selectionEnd = editor.value.length;
    editor.dispatchEvent(new Event("keyup", { bubbles: true }));
  });

  await expect(page.locator("#editor-total-lines")).toHaveText("2");
  await expect(page.locator("#editor-cursor-line")).toHaveText("2");
  await expect(page.locator("#editor-cursor-column")).toHaveText("12");
  await expect(page.locator("#editor-position-label")).toHaveText("Pos");
  await expect(page.locator("#editor-position-value")).toHaveText(String(markdown.length + 1));
});

test("converts selected editor text from the context menu", async ({ page }) => {
  await openApp(page);

  const editor = page.locator("#markdown-editor");
  await editor.fill("Context heading");
  await editor.evaluate((textarea) => {
    textarea.focus();
    textarea.selectionStart = 0;
    textarea.selectionEnd = textarea.value.length;
  });
  await editor.dispatchEvent("contextmenu", { button: 2, clientX: 160, clientY: 180 });

  await expect(page.locator("#editor-context-menu")).toBeVisible();
  await page.locator("#editor-context-menu [data-markdown-action='heading-1']").click();

  await expect(editor).toHaveValue("# Context heading");
});

test("mirrors editor markdown syntax in the highlight overlay", async ({ page }) => {
  await openApp(page);

  await page.locator("#markdown-editor").fill("# Overlay Title\n\n- **Important** item");

  await expect(page.locator("#editor-syntax-highlight .editor-md-marker")).toHaveText("#");
  await expect(page.locator("#editor-syntax-highlight .editor-md-heading")).toContainText("Overlay Title");
  await expect(page.locator("#editor-syntax-highlight .editor-md-list")).toHaveText("-");
  await expect(page.locator("#editor-syntax-highlight .editor-md-strong")).toHaveText("**Important**");
});

test("suggests and accepts known tags while typing", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("markdownViewerGlobalState", JSON.stringify({ knownTags: ["alpha", "archive"] }));
  });
  await openApp(page);

  const editor = page.locator("#markdown-editor");
  await editor.fill("#alp");
  await expect(page.locator("#link-autocomplete-layer")).toBeVisible();
  await expect(page.locator("#link-autocomplete-layer .link-autocomplete-option").first()).toContainText("#alpha");

  await page.keyboard.press("Enter");
  await expect(editor).toHaveValue("#alpha");
});

test("renders recent files in the action menu", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("markdownViewerRecentFiles", JSON.stringify([
      { name: "notes.md", label: "notes.md", path: "docs/notes.md", updatedAt: Date.now() }
    ]));
  });
  await openApp(page);

  await expect(page.locator(".recent-files-menu .recent-menu-item")).toHaveCount(1);
  await expect(page.locator(".recent-files-menu .recent-menu-item")).toContainText("notes.md");
});

test("shows active dropzone state during drag", async ({ page }) => {
  await openApp(page);

  const dropzone = page.locator("#dropzone");
  await dropzone.dispatchEvent("dragenter");
  await expect(dropzone).toHaveClass(/active/);

  await dropzone.dispatchEvent("dragleave");
  await expect(dropzone).not.toHaveClass(/active/);
});

test("marks edited documents as unsaved", async ({ page }) => {
  await openApp(page);

  await expect(page.locator("#tab-list .tab-item.active")).not.toHaveClass(/unsaved/);
  await page.locator("#markdown-editor").fill("# Unsaved Draft\n\nChanged content.");

  await expect(page.locator("#tab-list .tab-item.active")).toHaveClass(/unsaved/);
  await expect.poll(() => page.evaluate(() => window.markdownViewerHasUnsavedChanges())).toBe(true);
});

test("copies markdown content to the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openApp(page);

  const markdown = "# Clipboard Check\n\nCopied from the editor.";
  await page.locator("#markdown-editor").fill(markdown);
  await page.locator("#copy-markdown-button").click({ force: true });

  await expect(page.locator("#copy-markdown-button")).toContainText("Copied!");
  await expect.poll(async () => {
    const copiedText = await page.evaluate(() => navigator.clipboard.readText());
    return copiedText.replace(/\r\n/g, "\n");
  }).toBe(markdown);
});

test("share URL restores markdown content on reload", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openApp(page);

  await page.locator("#markdown-editor").fill("# Shared Document\n\nContent from a share link.");
  await page.locator("#share-button").click();

  await expect(page).toHaveURL(/#share=/);
  const sharedUrl = page.url();

  const sharedPage = await context.newPage();
  const sharedErrors = [];
  sharedPage.on("pageerror", (error) => sharedErrors.push(error.message));
  await stubBrowserLibraries(sharedPage);

  await sharedPage.goto(sharedUrl);
  await expect(sharedPage.locator("#markdown-editor")).toHaveValue(/Shared Document/);
  await expect(sharedPage.locator("#markdown-preview").getByRole("heading", { name: "Shared Document" })).toBeVisible();
  expect(sharedErrors).toEqual([]);
});

test("open folder uses the native directory picker when the browser exposes it", async ({ page }) => {
  await page.addInitScript(() => {
    window.__directoryPickerCalled = false;
    window.showDirectoryPicker = async () => {
      window.__directoryPickerCalled = true;
      throw new DOMException("User cancelled", "AbortError");
    };
  });
  await openApp(page);

  await page.locator("#import-from-folder").click();

  await expect.poll(() => page.evaluate(() => window.__directoryPickerCalled)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.markdownViewerFolderPickerMode)).toBe("native");
});

test("open folder falls back to folder input when native picker is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    delete window.showDirectoryPicker;
    window.__folderInputClicked = false;
    var originalClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.id === "folder-input") {
        window.__folderInputClicked = true;
        return;
      }
      return originalClick.call(this);
    };
  });
  await openApp(page);

  await page.locator("#import-from-folder").click();

  await expect.poll(() => page.evaluate(() => window.__folderInputClicked)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.markdownViewerFolderPickerMode)).toBe("folder-input");
});
