export async function copyToClipboard(text, { onCopied, errorLabel = "content" } = {}) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      onCopied?.();
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error("Copy command was unsuccessful");
    }

    onCopied?.();
  } catch (err) {
    console.error("Copy failed:", err);
    alert(`Failed to copy ${errorLabel}: ${err.message}`);
  }
}

export function showCopiedMessage(button, html = '<i class="bi bi-check-lg"></i> Copied!', duration = 2000) {
  if (!button) return;
  const originalText = button.innerHTML;
  button.innerHTML = html;
  setTimeout(() => {
    button.innerHTML = originalText;
  }, duration);
}
