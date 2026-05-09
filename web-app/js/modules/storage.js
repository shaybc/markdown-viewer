import { createStorageJsonHelpers } from "../core/storage.js";

export function registerStorage(app) {
  app.services.storage = window.localStorage;
  app.services.storageJson = createStorageJsonHelpers(app.services.storage);
}
