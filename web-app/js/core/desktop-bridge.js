import {
  isAbsoluteFilesystemPath as isAbsolutePath,
  joinPaths,
  normalizeFilesystemLinkPath
} from "./paths.js";

export function isNeutralinoRuntime(globalScope = globalThis) {
  return typeof globalScope.NL_VERSION !== "undefined" && typeof globalScope.Neutralino !== "undefined";
}

export function getNeutralino(globalScope = globalThis) {
  return isNeutralinoRuntime(globalScope) ? globalScope.Neutralino : null;
}

export function getNeutralinoFilesystem(globalScope = globalThis) {
  return getNeutralino(globalScope)?.filesystem || null;
}

export function hasNeutralinoFilesystemMethod(methodName, globalScope = globalThis) {
  const filesystem = getNeutralinoFilesystem(globalScope);
  return typeof filesystem?.[methodName] === "function";
}

export function isAbsoluteFilesystemPath(path) {
  return isAbsolutePath(path);
}

export function resolveFilesystemPath(path, options = {}) {
  const {
    basePath = "",
    requireRuntime = true,
    globalScope = globalThis,
    normalize = true
  } = options;

  if (!path || (requireRuntime && !isNeutralinoRuntime(globalScope))) return null;

  const resolvedPath = isAbsoluteFilesystemPath(path)
    ? String(path)
    : (basePath ? joinPaths(basePath, path) : "");

  if (!resolvedPath) return null;
  return normalize ? normalizeFilesystemLinkPath(resolvedPath) : resolvedPath;
}

export function getNodeFilesystemPath(graphNode, options = {}) {
  const {
    snapshotFile = null,
    getSnapshotFile = null,
    basePath = "",
    globalScope = globalThis,
    requireRuntime = true
  } = options;

  const resolvedSnapshotFile = snapshotFile || (typeof getSnapshotFile === "function" ? getSnapshotFile(graphNode) : null);
  const candidatePaths = [
    resolvedSnapshotFile?.fullPath,
    resolvedSnapshotFile?.path,
    graphNode?.fullPath,
    graphNode?.path
  ];

  for (const candidatePath of candidatePaths) {
    const resolvedPath = resolveFilesystemPath(candidatePath, {
      basePath,
      globalScope,
      requireRuntime
    });
    if (resolvedPath) return resolvedPath;
  }

  return null;
}
