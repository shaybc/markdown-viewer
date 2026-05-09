const DEFAULT_JSON_FALLBACK = null;

export function getDefaultLocalStorage(globalScope = globalThis) {
  return globalScope && globalScope.localStorage ? globalScope.localStorage : null;
}

export function normalizeStorageKeyPart(part) {
  return String(part ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createStorageKey(namespace, ...parts) {
  return [namespace, ...parts]
    .map(normalizeStorageKeyPart)
    .filter(Boolean)
    .join(":");
}

export function prefixStorageKey(prefix, key) {
  const normalizedPrefix = normalizeStorageKeyPart(prefix);
  const normalizedKey = normalizeStorageKeyPart(key);
  return [normalizedPrefix, normalizedKey].filter(Boolean).join(":");
}

export function parseStorageJson(value, fallback = DEFAULT_JSON_FALLBACK) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse stored JSON:", error);
    return fallback;
  }
}

export function stringifyStorageJson(value, fallback = "null") {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? fallback : json;
  } catch (error) {
    console.warn("Failed to stringify storage JSON:", error);
    return fallback;
  }
}

export function readJsonFromStorage(storage, key, fallback = DEFAULT_JSON_FALLBACK) {
  if (!storage || !key) return fallback;
  try {
    return parseStorageJson(storage.getItem(key), fallback);
  } catch (error) {
    console.warn(`Failed to read storage key "${key}":`, error);
    return fallback;
  }
}

export function writeJsonToStorage(storage, key, value) {
  if (!storage || !key) return false;
  try {
    storage.setItem(key, stringifyStorageJson(value));
    return true;
  } catch (error) {
    console.warn(`Failed to write storage key "${key}":`, error);
    return false;
  }
}

export function removeStorageKey(storage, key) {
  if (!storage || !key) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove storage key "${key}":`, error);
    return false;
  }
}

export function createStorageJsonHelpers(storage = getDefaultLocalStorage()) {
  return {
    key: createStorageKey,
    prefixKey: prefixStorageKey,
    parse: parseStorageJson,
    stringify: stringifyStorageJson,
    read(key, fallback = DEFAULT_JSON_FALLBACK) {
      return readJsonFromStorage(storage, key, fallback);
    },
    write(key, value) {
      return writeJsonToStorage(storage, key, value);
    },
    remove(key) {
      return removeStorageKey(storage, key);
    }
  };
}
