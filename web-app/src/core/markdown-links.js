import { getDirectoryPath } from "./utils.js";

export function safeDecodeLinkPath(path) {
  try {
    return decodeURIComponent(String(path || ""));
  } catch (_) {
    return String(path || "");
  }
}

export function normalizeMarkdownLinkPath(path) {
  const normalized = safeDecodeLinkPath(path)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
  const segments = [];

  normalized.split("/").forEach((segment) => {
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

export function resolveMarkdownLinkPath(targetPath, basePath = "") {
  const decodedTarget = safeDecodeLinkPath(targetPath).replace(/\\/g, "/");
  if (!decodedTarget || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(decodedTarget)) {
    return decodedTarget;
  }

  if (decodedTarget.startsWith("/")) {
    return normalizeMarkdownLinkPath(decodedTarget);
  }

  const decodedBasePath = safeDecodeLinkPath(basePath || "").replace(/\\/g, "/");
  const baseDirectory = getDirectoryPath(normalizeMarkdownLinkPath(decodedBasePath));
  return normalizeMarkdownLinkPath(baseDirectory ? `${baseDirectory}/${decodedTarget}` : decodedTarget);
}
