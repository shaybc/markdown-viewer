const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const webRoot = path.resolve(__dirname, "..");

function readWebFile(relativePath) {
  return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

test("classic migration scripts load before the legacy monolith", () => {
  const html = readWebFile("index.html");
  const expectedOrder = [
    'src="js/core/context.js"',
    'src="js/app.js"',
    'src="js/platform/folder-picker.js"',
    'src="js/ui/theme-preferences.js"',
    'src="js/clipboard.js"',
    'src="js/scroll-sync.js"',
    'src="js/unsaved-changes.js"',
    'src="js/editor/line-status.js"',
    'src="js/share-url.js"',
    'src="js/keyboard-shortcuts.js"',
    'src="script.js"',
  ];

  let lastIndex = -1;
  for (const scriptReference of expectedOrder) {
    const index = html.indexOf(scriptReference);
    assert.notEqual(index, -1, `${scriptReference} should be present`);
    assert.ok(index > lastIndex, `${scriptReference} should load after the previous migration script`);
    lastIndex = index;
  }
});

test("legacy script bridges into the shared classic app context", () => {
  const script = readWebFile("script.js");

  assert.match(script, /window\.markdownViewerApp/);
  assert.match(script, /Object\.assign\(app\.dom,/);
  assert.match(script, /Object\.defineProperties\(app\.state,/);
});

test("share URL logic is registered from its extracted classic script", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const shareScript = readWebFile("js/share-url.js");

  assert.match(html, /src="js\/share-url\.js"/);
  assert.match(shareScript, /window\.registerMarkdownViewerShareUrl\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerShareUrl\(app,/);
});

test("theme preference logic is registered from its extracted classic script", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const themeScript = readWebFile("js/ui/theme-preferences.js");

  assert.match(html, /src="js\/ui\/theme-preferences\.js"/);
  assert.match(themeScript, /window\.registerMarkdownViewerThemePreferences\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerThemePreferences\(app,/);
  assert.doesNotMatch(legacyScript, /themeToggle\.addEventListener\("click"/);
});

test("keyboard shortcuts are registered from their extracted classic script", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const shortcutScript = readWebFile("js/keyboard-shortcuts.js");

  assert.match(html, /src="js\/keyboard-shortcuts\.js"/);
  assert.match(shortcutScript, /window\.registerMarkdownViewerKeyboardShortcuts\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerKeyboardShortcuts\(app,/);
  assert.doesNotMatch(legacyScript, /document\.addEventListener\("keydown", function \(e\)/);
});

test("clipboard logic is registered from its extracted classic script", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const clipboardScript = readWebFile("js/clipboard.js");

  assert.match(html, /src="js\/clipboard\.js"/);
  assert.match(clipboardScript, /window\.registerMarkdownViewerClipboard\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerClipboard\(app,/);
  assert.doesNotMatch(legacyScript, /async function copyToClipboard/);
  assert.doesNotMatch(legacyScript, /function showCopiedMessage/);
});

test("scroll sync logic is registered from its extracted classic script", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const scrollSyncScript = readWebFile("js/scroll-sync.js");

  assert.match(html, /src="js\/scroll-sync\.js"/);
  assert.match(scrollSyncScript, /window\.registerMarkdownViewerScrollSync\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerScrollSync\(app,/);
  assert.doesNotMatch(legacyScript, /function syncEditorToPreview/);
  assert.doesNotMatch(legacyScript, /function syncPreviewToEditor/);
  assert.doesNotMatch(legacyScript, /function toggleSyncScrolling/);
});

test("unsaved-change logic is registered from its extracted classic script", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const unsavedScript = readWebFile("js/unsaved-changes.js");

  assert.match(html, /src="js\/unsaved-changes\.js"/);
  assert.match(unsavedScript, /window\.registerMarkdownViewerUnsavedChanges\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerUnsavedChanges\(app,/);
  assert.doesNotMatch(legacyScript, /function normalizeEditorContent/);
  assert.doesNotMatch(legacyScript, /function tabHasUnsavedChanges/);
  assert.doesNotMatch(legacyScript, /window\.markdownViewerConfirmDiscardUnsavedBeforeExit =/);
});

test("editor line UI is registered from its extracted classic script", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const lineStatusScript = readWebFile("js/editor/line-status.js");

  assert.match(html, /src="js\/editor\/line-status\.js"/);
  assert.match(lineStatusScript, /window\.registerMarkdownViewerEditorLineStatus\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerEditorLineStatus\(app,/);
  assert.doesNotMatch(legacyScript, /function updateEditorLineNumbers/);
  assert.doesNotMatch(legacyScript, /function updateEditorSelectionHighlights/);
  assert.doesNotMatch(legacyScript, /let editorLineMeasure/);
});

test("folder open defaults to native directory picker when the browser supports it", () => {
  const html = readWebFile("index.html");
  const legacyScript = readWebFile("script.js");
  const folderPickerScript = readWebFile("js/platform/folder-picker.js");
  const match = folderPickerScript.match(/function shouldUseNativeDirectoryPicker\(\) \{([\s\S]*?)\n    \}/);

  assert.match(html, /src="js\/platform\/folder-picker\.js"/);
  assert.match(folderPickerScript, /window\.registerMarkdownViewerFolderPicker\s*=/);
  assert.match(legacyScript, /window\.registerMarkdownViewerFolderPicker\(app\)/);
  assert.match(legacyScript, /folderPicker\.shouldUseNativeDirectoryPicker\(event\)/);
  assert.ok(match, "shouldUseNativeDirectoryPicker should exist");
  assert.match(match[1], /supported = supportsNativeDirectoryPicker\(\);/);
  assert.match(match[1], /return supported;/);
  assert.doesNotMatch(match[1], /event\.altKey/);
});

test("folder input fallback remains available for unsupported browsers", () => {
  const html = readWebFile("index.html");
  const script = readWebFile("script.js");

  assert.match(html, /id="folder-input"[^>]*webkitdirectory[^>]*directory[^>]*multiple/);
  assert.match(script, /folderInput\.click\(\)/);
  assert.match(script, /Folder selection is not supported in this environment/);
});
