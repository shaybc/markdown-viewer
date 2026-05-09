(function(window, document) {
  "use strict";

  function registerMarkdownViewerRecentItems(app, deps) {
    const RECENT_FILES_KEY = "markdownViewerRecentFiles";
    const RECENT_FOLDERS_KEY = "markdownViewerRecentFolders";
    const RECENT_PROFILE_DIR = ".mdviewer";
    const RECENT_PROFILE_FILE = "recent-items.json";
    const GLOBAL_PROFILE_FILE = "preferences.json";
    const RECENT_HANDLES_DB = "markdownViewerRecentHandles";
    const RECENT_HANDLES_STORE = "handles";
    const MAX_RECENT_ITEMS = 10;
    const recentFileHandles = new Map();
    const recentFolderHandles = new Map();
    const recentItemsCache = {
      [RECENT_FILES_KEY]: readRecentItemsFromLocalStorage(RECENT_FILES_KEY),
      [RECENT_FOLDERS_KEY]: readRecentItemsFromLocalStorage(RECENT_FOLDERS_KEY)
    };
    let recentProfilePathPromise = null;
    let recentProfileWriteTimer = null;
    let globalProfilePathPromise = null;
    let globalProfileWriteTimer = null;
    let recentHandlesDbPromise = null;

    function isNeutralinoRuntime() {
      return typeof NL_VERSION !== "undefined" && typeof Neutralino !== "undefined";
    }

    function normalizeRecentItems(items) {
      return Array.isArray(items) ? items.slice(0, MAX_RECENT_ITEMS) : [];
    }

    function readRecentItemsFromLocalStorage(storageKey) {
      try {
        const items = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return normalizeRecentItems(items);
      } catch (error) {
        console.warn("Failed to read recent items:", error);
        return [];
      }
    }

    function writeRecentItemsToLocalStorage(storageKey, items) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalizeRecentItems(items)));
      } catch (error) {
        console.warn("Failed to save recent items:", error);
      }
    }

    function readRecentItems(storageKey) {
      return normalizeRecentItems(recentItemsCache[storageKey] || []);
    }

    function writeRecentItems(storageKey, items) {
      recentItemsCache[storageKey] = normalizeRecentItems(items);
      writeRecentItemsToLocalStorage(storageKey, recentItemsCache[storageKey]);
      scheduleRecentProfileWrite();
    }

    function getRecentItemKey(item) {
      return String(item && (item.path || item.handleName || item.name || item.label) || "").toLowerCase();
    }

    function getRecentHandleStore(storageKey) {
      return storageKey === RECENT_FOLDERS_KEY ? recentFolderHandles : recentFileHandles;
    }

    function getRecentHandleId(storageKey, key) {
      return `${storageKey}:${key}`;
    }

    function openRecentHandlesDatabase() {
      if (isNeutralinoRuntime() || !window.indexedDB) return Promise.resolve(null);

      if (!recentHandlesDbPromise) {
        recentHandlesDbPromise = new Promise((resolve) => {
          const request = window.indexedDB.open(RECENT_HANDLES_DB, 1);

          request.onupgradeneeded = function(event) {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(RECENT_HANDLES_STORE)) {
              database.createObjectStore(RECENT_HANDLES_STORE, { keyPath: "id" });
            }
          };

          request.onsuccess = function(event) {
            resolve(event.target.result);
          };

          request.onerror = function(event) {
            console.warn("Failed to open recent handles database:", event.target.error);
            resolve(null);
          };

          request.onblocked = function() {
            console.warn("Opening the recent handles database was blocked by another tab.");
            resolve(null);
          };
        });
      }

      return recentHandlesDbPromise;
    }

    async function persistRecentHandle(storageKey, key, handle) {
      if (!handle || isNeutralinoRuntime()) return;

      const database = await openRecentHandlesDatabase();
      if (!database) return;

      try {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(RECENT_HANDLES_STORE, "readwrite");
          const store = transaction.objectStore(RECENT_HANDLES_STORE);
          store.put({
            id: getRecentHandleId(storageKey, key),
            storageKey,
            key,
            handle,
            updatedAt: Date.now()
          });
          transaction.oncomplete = resolve;
          transaction.onerror = function(event) { reject(event.target.error); };
          transaction.onabort = function(event) { reject(event.target.error); };
        });
      } catch (error) {
        console.warn("Failed to save recent file-system handle:", error);
      }
    }

    async function getPersistedRecentHandle(storageKey, key) {
      const handleStore = getRecentHandleStore(storageKey);
      const cachedHandle = handleStore.get(key);
      if (cachedHandle) return cachedHandle;

      const database = await openRecentHandlesDatabase();
      if (!database) return null;

      try {
        const record = await new Promise((resolve, reject) => {
          const transaction = database.transaction(RECENT_HANDLES_STORE, "readonly");
          const request = transaction.objectStore(RECENT_HANDLES_STORE).get(getRecentHandleId(storageKey, key));
          request.onsuccess = function(event) { resolve(event.target.result || null); };
          request.onerror = function(event) { reject(event.target.error); };
        });
        if (record && record.handle) {
          handleStore.set(key, record.handle);
          return record.handle;
        }
      } catch (error) {
        console.warn("Failed to read recent file-system handle:", error);
      }

      return null;
    }

    async function hydrateRecentHandlesFromIndexedDB() {
      const database = await openRecentHandlesDatabase();
      if (!database) return;

      try {
        const records = await new Promise((resolve, reject) => {
          const transaction = database.transaction(RECENT_HANDLES_STORE, "readonly");
          const request = transaction.objectStore(RECENT_HANDLES_STORE).getAll();
          request.onsuccess = function(event) { resolve(event.target.result || []); };
          request.onerror = function(event) { reject(event.target.error); };
        });

        records.forEach((record) => {
          if (!record || !record.storageKey || !record.key || !record.handle) return;
          getRecentHandleStore(record.storageKey).set(record.key, record.handle);
        });
      } catch (error) {
        console.warn("Failed to hydrate recent file-system handles:", error);
      }
    }

    async function ensureFileSystemHandlePermission(handle, mode = "read") {
      if (!handle || typeof handle.queryPermission !== "function") return true;

      const options = { mode };
      try {
        if (await handle.queryPermission(options) === "granted") return true;
        if (typeof handle.requestPermission !== "function") return false;
        return await handle.requestPermission(options) === "granted";
      } catch (error) {
        console.warn("Failed to verify file-system handle permission:", error);
        return false;
      }
    }

    function mergeRecentItems(...itemGroups) {
      const mergedByKey = new Map();

      itemGroups.flat().forEach((item) => {
        const key = getRecentItemKey(item);
        if (!key) return;

        const existing = mergedByKey.get(key);
        if (!existing || Number(item.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
          mergedByKey.set(key, item);
        }
      });

      return Array.from(mergedByKey.values())
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
        .slice(0, MAX_RECENT_ITEMS);
    }

    function getProfileSeparator(profileDir) {
      return profileDir.includes("\\") ? "\\" : "/";
    }

    async function getUserProfileDir() {
      if (!isNeutralinoRuntime() || !Neutralino.os || !Neutralino.os.getEnv) return null;

      const envVars = NL_OS === "Windows" ? ["USERPROFILE", "HOME"] : ["HOME", "USERPROFILE"];
      for (const envVar of envVars) {
        try {
          const value = await Neutralino.os.getEnv(envVar);
          if (value) return value;
        } catch (error) {
          // Try the next platform-appropriate profile variable.
        }
      }

      return null;
    }

    async function getProfileFilePath(fileName, cacheKey) {
      if (!isNeutralinoRuntime()) return null;

      if (!cacheKey.promise) {
        cacheKey.promise = (async () => {
          const profileDir = await getUserProfileDir();
          if (!profileDir) return null;

          const separator = getProfileSeparator(profileDir);
          const dataDir = `${profileDir}${separator}${RECENT_PROFILE_DIR}`;
          try {
            if (Neutralino.filesystem && Neutralino.filesystem.createDirectory) {
              await Neutralino.filesystem.createDirectory(dataDir);
            }
          } catch (error) {
            // The directory may already exist; reads/writes below will report real failures.
          }

          return `${dataDir}${separator}${fileName}`;
        })();
      }

      return cacheKey.promise;
    }

    async function getRecentProfilePath() {
      return getProfileFilePath(RECENT_PROFILE_FILE, {
        get promise() { return recentProfilePathPromise; },
        set promise(value) { recentProfilePathPromise = value; }
      });
    }

    async function getGlobalProfilePath() {
      return getProfileFilePath(GLOBAL_PROFILE_FILE, {
        get promise() { return globalProfilePathPromise; },
        set promise(value) { globalProfilePathPromise = value; }
      });
    }

    function getRecentProfilePayload() {
      return {
        version: 1,
        updatedAt: Date.now(),
        recentFiles: readRecentItems(RECENT_FILES_KEY),
        recentFolders: readRecentItems(RECENT_FOLDERS_KEY)
      };
    }

    async function writeRecentItemsToProfile() {
      const profilePath = await getRecentProfilePath();
      if (!profilePath) return;

      try {
        await Neutralino.filesystem.writeFile(profilePath, JSON.stringify(getRecentProfilePayload(), null, 2));
      } catch (error) {
        console.warn("Failed to save recent items to user profile:", error);
      }
    }

    function scheduleRecentProfileWrite() {
      if (!isNeutralinoRuntime()) return;

      clearTimeout(recentProfileWriteTimer);
      recentProfileWriteTimer = setTimeout(() => {
        writeRecentItemsToProfile();
      }, 100);
    }

    async function hydrateRecentItemsFromProfile() {
      const profilePath = await getRecentProfilePath();
      if (!profilePath) return;

      try {
        const rawProfileData = await Neutralino.filesystem.readFile(profilePath);
        const profileData = JSON.parse(rawProfileData || "{}");
        recentItemsCache[RECENT_FILES_KEY] = mergeRecentItems(
          profileData.recentFiles || [],
          recentItemsCache[RECENT_FILES_KEY]
        );
        recentItemsCache[RECENT_FOLDERS_KEY] = mergeRecentItems(
          profileData.recentFolders || [],
          recentItemsCache[RECENT_FOLDERS_KEY]
        );
        writeRecentItemsToLocalStorage(RECENT_FILES_KEY, recentItemsCache[RECENT_FILES_KEY]);
        writeRecentItemsToLocalStorage(RECENT_FOLDERS_KEY, recentItemsCache[RECENT_FOLDERS_KEY]);
        renderRecentMenus();
        scheduleRecentProfileWrite();
      } catch (error) {
        // First launch is expected to have no profile data file yet. Seed it from localStorage.
        scheduleRecentProfileWrite();
      }
    }

    function getGlobalProfilePayload() {
      return {
        version: 1,
        updatedAt: Date.now(),
        state: deps.loadGlobalState()
      };
    }

    async function writeGlobalStateToProfile() {
      const profilePath = await getGlobalProfilePath();
      if (!profilePath) return;

      try {
        await Neutralino.filesystem.writeFile(profilePath, JSON.stringify(getGlobalProfilePayload(), null, 2));
      } catch (error) {
        console.warn("Failed to save preferences to user profile:", error);
      }
    }

    function scheduleGlobalProfileWrite() {
      if (!isNeutralinoRuntime()) return;

      clearTimeout(globalProfileWriteTimer);
      globalProfileWriteTimer = setTimeout(() => {
        writeGlobalStateToProfile();
      }, 100);
    }

    async function hydrateGlobalStateFromProfile() {
      const profilePath = await getGlobalProfilePath();
      if (!profilePath) return;

      try {
        const rawProfileData = await Neutralino.filesystem.readFile(profilePath);
        const profileData = JSON.parse(rawProfileData || "{}");
        if (profileData && profileData.state && typeof profileData.state === "object") {
          localStorage.setItem(deps.globalStateKey, JSON.stringify({ ...deps.loadGlobalState(), ...profileData.state }));
          deps.applyGlobalPreferences(deps.loadGlobalState());
        }
        scheduleGlobalProfileWrite();
      } catch (error) {
        // First launch is expected to have no profile data file yet. Seed it from localStorage.
        scheduleGlobalProfileWrite();
      }
    }

    function createRecentEntry(entry) {
      const path = entry && entry.path ? String(entry.path) : null;
      const handleName = entry && entry.handle && entry.handle.name ? entry.handle.name : null;
      const name = entry && entry.name ? String(entry.name) : (path ? deps.getFileName(path) : handleName);
      const label = entry && entry.label ? String(entry.label) : (name || path || handleName || "Untitled");
      return {
        name: name || label,
        label,
        path,
        handleName,
        updatedAt: Date.now()
      };
    }

    function rememberRecentItem(storageKey, entry, handleStore) {
      const recentEntry = createRecentEntry(entry);
      const key = getRecentItemKey(recentEntry);
      if (!key) return;

      if (entry && entry.handle) {
        handleStore.set(key, entry.handle);
        persistRecentHandle(storageKey, key, entry.handle);
      }

      const items = readRecentItems(storageKey).filter((item) => getRecentItemKey(item) !== key);
      items.unshift(recentEntry);
      writeRecentItems(storageKey, items);
      renderRecentMenus();
    }

    function rememberRecentFile(entry) {
      rememberRecentItem(RECENT_FILES_KEY, entry, recentFileHandles);
    }

    function rememberRecentFolder(entry) {
      rememberRecentItem(RECENT_FOLDERS_KEY, entry, recentFolderHandles);
    }

    function getRecentSubmenuMarkup(kind, iconClass, title) {
      return `
        <div class="dropdown-submenu action-menu-submenu recent-${kind}-submenu">
          <button class="dropdown-item action-menu-item dropdown-toggle" type="button" aria-haspopup="true" aria-expanded="false">
            <i class="bi ${iconClass} me-2"></i> ${title}
          </button>
          <div class="dropdown-menu action-submenu recent-${kind}-menu" aria-label="${title}"></div>
        </div>`;
    }

    function ensureRecentMenuContainers() {
      document.querySelectorAll(".action-menu").forEach((menu) => {
        const openFolderButton = menu.querySelector("#import-from-folder");
        if (!openFolderButton || menu.querySelector(".recent-files-submenu")) return;

        openFolderButton.insertAdjacentHTML("afterend", getRecentSubmenuMarkup("folders", "bi-clock-history", "Recent folders"));
        openFolderButton.insertAdjacentHTML("afterend", getRecentSubmenuMarkup("files", "bi-clock-history", "Recent files"));
      });
      renderRecentMenus();
    }

    function renderRecentMenu(menu, items, emptyText, itemType) {
      menu.innerHTML = "";

      if (!items.length) {
        const emptyItem = document.createElement("button");
        emptyItem.type = "button";
        emptyItem.className = "dropdown-item action-menu-item recent-empty-item";
        emptyItem.disabled = true;
        emptyItem.textContent = emptyText;
        menu.appendChild(emptyItem);
        return;
      }

      items.slice(0, MAX_RECENT_ITEMS).forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dropdown-item action-menu-item recent-menu-item";
        button.dataset.recentType = itemType;
        button.dataset.recentKey = getRecentItemKey(item);
        button.title = item.path || item.label || item.name;
        button.innerHTML = `<span class="recent-menu-label">${deps.escapeHtml(item.label || item.name || item.path || "Untitled")}</span>`;
        menu.appendChild(button);
      });
    }

    function renderRecentMenus() {
      const recentFiles = readRecentItems(RECENT_FILES_KEY);
      const recentFolders = readRecentItems(RECENT_FOLDERS_KEY);

      document.querySelectorAll(".recent-files-menu").forEach((menu) => {
        renderRecentMenu(menu, recentFiles, "No recent files", "file");
      });

      document.querySelectorAll(".recent-folders-menu").forEach((menu) => {
        renderRecentMenu(menu, recentFolders, "No recent folders", "folder");
      });
    }

    const api = {
      ensureFileSystemHandlePermission,
      ensureRecentMenuContainers,
      getPersistedRecentHandle,
      getRecentItemKey,
      hydrateGlobalStateFromProfile,
      hydrateRecentHandlesFromIndexedDB,
      hydrateRecentItemsFromProfile,
      isNeutralinoRuntime,
      readRecentItems,
      rememberRecentFile,
      rememberRecentFolder,
      renderRecentMenus,
      scheduleGlobalProfileWrite,
      keys: {
        files: RECENT_FILES_KEY,
        folders: RECENT_FOLDERS_KEY
      }
    };

    app.registerModule("recentItems", api);
    return api;
  }

  window.registerMarkdownViewerRecentItems = registerMarkdownViewerRecentItems;
})(window, document);
