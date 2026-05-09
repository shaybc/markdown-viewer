# Web app module ownership

`src/main.js` is the module entrypoint loaded by `web-app/index.html`. It should stay small: wait for `DOMContentLoaded`, create shared `dom` and `state` objects, then call feature initializers in the same order as the legacy app.

## App-level modules

- `app/dom.js` owns document lookups. Add new `getElementById`/`querySelector` calls there and pass the returned element through initializer arguments instead of querying from feature modules.
- `app/state.js` owns mutable cross-feature state, constants, and storage keys. Prefer adding properties to `createAppState()` over exporting mutable bindings.

## Feature modules

New behavior should live under the relevant feature folder (`editor/`, `sidebar/`, `graph/`, `export/`, `sharing/`, etc.) and expose an `initX({ dom, state, services })` function when it needs to wire UI behavior. Keep `main.js` as orchestration only; do not add feature logic there.

During the migration, `web-app/script.js` remains a legacy compatibility module that is initialized by `src/main.js`. Move leaf utilities and feature code out incrementally while preserving public behavior after each step.
