export function safeDecodePath(path) {
  try {
    return decodeURIComponent(String(path || ""));
  } catch (_) {
    return String(path || "");
  }
}

export function isAbsoluteFilesystemPath(path) {
  const value = String(path || "");
  return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value) || value.startsWith("/");
}

function normalizePathSegments(path) {
  const segments = [];
  String(path || "").split("/").forEach((segment) => {
    if (!segment || segment === ".") return;
    if (segment === "..") {
      if (segments.length && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else {
        segments.push(segment);
      }
      return;
    }
    segments.push(segment);
  });
  return segments.join("/");
}

export function normalizePath(path) {
  const decoded = safeDecodePath(path)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
  return normalizePathSegments(decoded);
}

export function normalizeFilesystemLinkPath(path) {
  const rawPath = safeDecodePath(path).replace(/\\/g, "/");
  const driveMatch = rawPath.match(/^[a-zA-Z]:\//);
  const prefix = driveMatch ? driveMatch[0] : (rawPath.startsWith("/") ? "/" : "");
  const pathWithoutPrefix = prefix ? rawPath.slice(prefix.length) : rawPath;
  return `${prefix}${normalizePath(pathWithoutPrefix)}`;
}

export function joinPaths(...parts) {
  const pathParts = parts
    .filter((part) => part !== null && part !== undefined && String(part) !== "")
    .map((part) => String(part));

  if (!pathParts.length) return "";
  const [firstPart, ...remainingParts] = pathParts;
  return remainingParts.reduce((joined, part) => {
    if (!joined) return part;
    return `${joined.replace(/[\\/]+$/, "")}/${part.replace(/^[\\/]+/, "")}`;
  }, firstPart);
}

export function getDirectoryPath(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

export function getFileName(path, fallback = "document.md") {
  return String(path || "").split(/[\\/]/).pop() || fallback;
}

export function getFileExtension(path) {
  const fileName = getFileName(path, "");
  const extensionMatch = fileName.match(/\.([^.]*)$/);
  return extensionMatch ? extensionMatch[1].toLowerCase() : "";
}

export function hasFileExtension(path, extensions) {
  const normalizedExtensions = Array.isArray(extensions) ? extensions : [extensions];
  const extension = getFileExtension(path);
  return normalizedExtensions
    .map((value) => String(value || "").replace(/^\./, "").toLowerCase())
    .filter(Boolean)
    .includes(extension);
}

export function hasMarkdownExtension(path) {
  return hasFileExtension(path, ["md", "markdown"]);
}

export function ensureFileExtension(path, extension) {
  const normalizedExtension = String(extension || "").replace(/^\./, "");
  if (!path || !normalizedExtension || getFileExtension(path)) return path;
  return `${path}.${normalizedExtension}`;
}
