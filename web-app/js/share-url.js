(function (window, document) {
  "use strict";

  var MAX_SHARE_URL_LENGTH = 32000;

  function encodeMarkdownForShare(text) {
    var compressed = pako.deflate(new TextEncoder().encode(text));
    var chunkSize = 0x8000;
    var binary = "";

    for (var i = 0; i < compressed.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, compressed.subarray(i, i + chunkSize));
    }

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeMarkdownFromShare(encoded) {
    var base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    var binary = atob(base64);
    var bytes = Uint8Array.from(binary, function (char) {
      return char.charCodeAt(0);
    });

    return new TextDecoder().decode(pako.inflate(bytes));
  }

  function copyShareUrlFromText(markdownText, btn) {
    var encoded;

    try {
      encoded = encodeMarkdownForShare(markdownText || "");
    } catch (error) {
      console.error("Share encoding failed:", error);
      alert("Failed to encode content for sharing: " + error.message);
      return;
    }

    var shareUrl = window.location.origin + window.location.pathname + "#share=" + encoded;
    var tooLarge = shareUrl.length > MAX_SHARE_URL_LENGTH;
    var originalHTML = btn.innerHTML;
    var copiedHTML = '<i class="bi bi-check-lg"></i> Copied!';

    function onCopied() {
      if (!tooLarge) {
        window.location.hash = "share=" + encoded;
      }

      btn.innerHTML = copiedHTML;
      setTimeout(function () {
        btn.innerHTML = originalHTML;
      }, 2000);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).then(onCopied).catch(function () {
        // clipboard.writeText failed; nothing further to do in secure context
      });
      return;
    }

    try {
      var tempInput = document.createElement("textarea");
      tempInput.value = shareUrl;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      onCopied();
    } catch (_) {
      // copy failed silently
    }
  }

  function registerShareUrl(app, deps) {
    function copyShareUrl(btn) {
      copyShareUrlFromText(deps.markdownEditor.value, btn);
    }

    function loadFromShareHash() {
      if (typeof pako === "undefined") return;

      var hash = window.location.hash;
      if (!hash.startsWith("#share=")) return;

      var encoded = hash.slice("#share=".length);
      if (!encoded) return;

      try {
        var decoded = decodeMarkdownFromShare(encoded);
        deps.markdownEditor.value = decoded;
        deps.renderEditorSyntaxHighlights();
        deps.renderMarkdown();
        deps.saveCurrentTabState();
      } catch (error) {
        console.error("Failed to load shared content:", error);
        alert("The shared URL could not be decoded. It may be corrupted or incomplete.");
      }
    }

    deps.shareButton.addEventListener("click", function () {
      copyShareUrl(deps.shareButton);
    });
    deps.mobileShareButton.addEventListener("click", function () {
      copyShareUrl(deps.mobileShareButton);
    });

    app.actions.copyShareUrl = copyShareUrl;
    app.actions.copyShareUrlFromText = copyShareUrlFromText;
    app.actions.loadFromShareHash = loadFromShareHash;
    app.registerModule("shareUrl", {
      copyShareUrl: copyShareUrl,
      copyShareUrlFromText: copyShareUrlFromText,
      loadFromShareHash: loadFromShareHash,
    });

    loadFromShareHash();
  }

  window.registerMarkdownViewerShareUrl = registerShareUrl;
})(window, document);
