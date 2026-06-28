# Plan 002: Sidecar lifecycle — bundle & spawn ima2, port + health, preload bridge

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat <SHA from plan 001>..HEAD -- src/main.ts src/preload.ts forge.config.ts package.json bun.lock src/shared/ipc.ts src/global.d.ts` — if any in-scope file changed since plan 001's commit, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (native packaging + child-process lifecycle)
- **Depends on**: 001
- **Category**: tech-debt / migration (foundational integration)
- **Planned at**: commit produced by plan 001 (record its SHA when 001 lands)

## Why this matters

imahe is a **wrapper**: it owns the UI, but ima2 owns all generation, providers, auth, and the image store (ADR 0001). ADR 0002 decided imahe **bundles** ima2 and launches it itself, so the app is one-click with zero user setup. Nothing else in imahe — gallery, generate, remix, auth — works until `ima2 serve` is running and the renderer knows its base URL. This plan makes the main process spawn, supervise, and expose the ima2 sidecar.

Inlined from ADR 0002 (the executor has not read it): *"ima2 is a Node CLI, so it must be spawned with a Node runtime. We reuse Electron's bundled Node via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` pointing at ima2's CLI entry — no separate Node install required. With `asar: true`, the ima2 package must live under `asar.unpacked` so the child process can load it."*

## Current state

- `src/main.ts` — default Electron Forge main process. Creates an 800×600 `BrowserWindow`, loads the Vite dev URL or built `index.html`, opens DevTools. Key excerpt:
  ```ts
  const createWindow = () => {
    const mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: { preload: path.join(__dirname, 'preload.js') },
    });
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    mainWindow.webContents.openDevTools();
  };
  app.on('ready', createWindow);
  ```
- `src/preload.ts` — **empty** (only a comment). This is where the renderer↔main bridge goes.
- `forge.config.ts` — `packagerConfig: { asar: true }`; `plugins` includes `new VitePlugin({...})` and `FusesPlugin`. There is currently **no** `auto-unpack-natives` plugin and no `asar.unpacked` config. `@electron-forge/plugin-auto-unpack-natives` is in devDependencies but may not be registered in `forge.config.ts`. The current fuses set `[FuseV1Options.RunAsNode]: false`; this plan must change it to `true` because the sidecar uses `ELECTRON_RUN_AS_NODE=1`.
- ima2 is **not yet a dependency** — this plan adds it.
- `package.json` `main` field → `.vite/build/main.js`. Renderer security: `BrowserWindow` currently has no `contextIsolation`/`nodeIntegration` overrides (Electron defaults: contextIsolation on, nodeIntegration off — keep these defaults).

### ima2 facts the executor needs (from `CONTEXT.md` + ima2 docs)

- Package: `ima2-gen` (npm, MIT). CLI entry starts a server with `ima2 serve`.
- Port via env `IMA2_PORT` (default 3333). On port conflict ima2 advertises its URL in `~/.ima2/server.json`.
- Health endpoint: `GET /api/health` returns server status/version/paths.
- The renderer must NOT hardcode `3333` — it must receive the actual base URL from the main process (the port may be chosen dynamically).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun run test`           | all pass            |
| Lint      | `bun run lint`           | exit 0              |
| Locate ima2 CLI | `bun -e "console.log(require.resolve('ima2-gen/package.json'))"` | prints a path under `node_modules` |

`bun run start` launches Electron interactively — not a CI gate. Manual smoke (optional, operator-run) is described in the test plan.

## Scope

**In scope**:
- `package.json` / `bun.lock` — add `ima2-gen` to dependencies with Bun
- `forge.config.ts` — register `auto-unpack-natives`, add `asar.unpack` coverage for `ima2-gen` and native transitive deps, and enable the `RunAsNode` fuse
- `src/main/sidecar.ts` (create) — spawn/supervise/health-check logic
- `src/main.ts` — call sidecar startup on `ready`, shutdown on quit, register IPC for "get base URL"
- `src/preload.ts` — expose a typed `window.imahe.getSidecarBaseUrl()` bridge
- `src/shared/ipc.ts` (create) — shared IPC channel names + types used by both main and preload
- `src/global.d.ts` (create or extend) — `Window` type augmentation for `window.imahe`
- `src/main/sidecar.test.ts` (create) — unit test for port/URL helpers (pure functions only)

**Out of scope** (do NOT touch):
- Any renderer UI files (`src/App.tsx`, components) — consuming the base URL in UI is plan 005/006.
- `src/store` / better-sqlite3 — plan 003.
- ima2's own source — never vendor or patch it; it is a black-box dependency.
- Do not implement any `/api/*` calls beyond `/api/health` — those belong to feature plans.

## Git workflow

- Branch: `advisor/002-sidecar-lifecycle` (or repo convention if one emerges).
- Commit per logical unit; message style matches plan 001's `chore:`/`feat:` prefix.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add ima2 as a bundled dependency

Add `ima2-gen` to `package.json` dependencies with Bun (`bun add ima2-gen`).

**Verify**: `bun -e "console.log(require.resolve('ima2-gen/package.json'))"` prints a `node_modules/ima2-gen/package.json` path. Inspect that `package.json`'s `bin` field and record the CLI entry path (you need it in step 3). `bun pm why ima2-gen` exits 0.

### Step 2: Configure packaging so the bundled ima2 is reachable at runtime

In `forge.config.ts`:
1. Register `@electron-forge/plugin-auto-unpack-natives` in the `plugins` array (it's already a devDependency) if not present.
2. Change `[FuseV1Options.RunAsNode]` to `true`. This is required for `process.execPath` + `ELECTRON_RUN_AS_NODE=1`; leaving it `false` makes the packaged sidecar strategy fail.
3. Add `asar: { unpack: '<glob>' }` (or equivalent `unpackDir`) to `packagerConfig` so ima2 is spawnable and native transitive deps are available. Do not only unpack `ima2-gen`; include the native dependency closure pulled by ima2 (at minimum any present `better-sqlite3`, `sharp`, and `@img/**` packages) or verify that `auto-unpack-natives` covers them in the packaged output. Avoid unpacking all of `node_modules` unless the operator approves the bundle-size tradeoff.

**Verify**: `bun run typecheck` → exit 0 (config still type-checks). `rg "auto-unpack-natives|AutoUnpackNativesPlugin" forge.config.ts` → match; `rg "ima2-gen" forge.config.ts` → match; `rg "RunAsNode.*true" forge.config.ts` → match; `rg "better-sqlite3|sharp|@img" forge.config.ts` → match if those native deps are present in the installed ima2 dependency tree.

### Step 3: Implement the sidecar module (`src/main/sidecar.ts`)

Create a module that:
1. **Resolves ima2's CLI entry** at runtime from the resolved package path. Derive it from `require.resolve('ima2-gen/package.json')` + its `bin` entry rather than hardcoding. In packaged builds, account for `app.asar`/`app.asar.unpacked` path mapping and verify dependency resolution; if executing the unpacked CLI breaks resolution of JS deps still inside `app.asar`, either launch the asar path with native deps unpacked or set an explicit module resolution strategy. Do not guess silently — document the chosen path strategy in code comments.
2. **Picks a free port** (e.g. bind a `net.Server` to port 0, read the assigned port, close it) — expose this as a pure, unit-testable helper `getFreePort(): Promise<number>`.
3. **Spawns** the CLI with `child_process.spawn(process.execPath, [<ima2 cli entry>, 'serve'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', IMA2_PORT: String(port) } })`. Capture stdout/stderr to the main-process log.
4. **Waits for health**: poll `GET http://127.0.0.1:<port>/api/health` until it responds 200 (timeout ~30s, interval ~500ms). Expose `waitForHealth(baseUrl, opts)`.
5. Exposes `startSidecar(): Promise<{ baseUrl: string }>`, `stopSidecar(): void` (kill the child), and a `getBaseUrl(): string | null` accessor.
6. Handles crash: if the child exits unexpectedly while the app is running, log it and attempt one restart; if it fails again, surface an error state (a later plan renders it — for now, log).

Keep the URL/port helpers as exported pure functions so they can be unit-tested without spawning anything.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Wire startup/shutdown into `src/main.ts`

- On `app.on('ready')`: `await startSidecar()` **before** (or concurrently with) `createWindow()`. Store the base URL.
- Register an IPC handler (`ipcMain.handle`) for the channel defined in `src/shared/ipc.ts` (e.g. `'sidecar:get-base-url'`) that returns the current base URL.
- On `app.on('before-quit')`: call `stopSidecar()` so no orphan ima2 process is left running. On `window-all-closed`, only stop the sidecar on platforms where the app is actually quitting (the existing non-macOS path); keep it alive on macOS so `activate` can reopen a window without a dead sidecar.
- Do not change the existing window security defaults; keep `contextIsolation` on, `nodeIntegration` off, preload path as-is.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Expose the bridge in `src/preload.ts`

Using `contextBridge.exposeInMainWorld`, expose `window.imahe = { getSidecarBaseUrl: () => ipcRenderer.invoke('sidecar:get-base-url') }`. Define the channel name + payload types in `src/shared/ipc.ts` and the `Window` augmentation in `src/global.d.ts` so the renderer is typed.

**Verify**: `bun run typecheck` → exit 0 (the `window.imahe` type resolves).

### Step 6: Unit-test the pure helpers

In `src/main/sidecar.test.ts`, test the side-effect-free helpers only: `getFreePort()` returns a number > 0 and two calls differ or are both bindable; any URL-building helper produces `http://127.0.0.1:<port>` correctly. Do **not** spawn ima2 in tests.

**Verify**: `bun run test` → all pass including the new file.

## Test plan

- New tests: `src/main/sidecar.test.ts` — `getFreePort()` returns a valid port; URL helper formats `http://127.0.0.1:<port>` (happy path + an edge case like port 0 handling). Model structure after `src/App.test.tsx` from plan 001 (same vitest setup).
- **Do not** integration-test the real spawn in the unit suite (it needs the bundled binary + network). Instead document a manual smoke for the operator:
  1. `bun run start`, open DevTools console, run `await window.imahe.getSidecarBaseUrl()` → returns an `http://127.0.0.1:<port>` string.
  2. `curl <that url>/api/health` → 200 with JSON.
  3. Quit the app; confirm no `ima2` process remains (`pgrep -fl ima2` → empty).
- Verification: `bun run test` → all pass.

## Done criteria

ALL must hold:

- [ ] `ima2-gen` is in `package.json` dependencies and resolvable
- [ ] `forge.config.ts` registers `auto-unpack-natives`, enables the `RunAsNode` fuse, and unpacks `ima2-gen` plus required native transitive deps
- [ ] `bun run typecheck` exits 0
- [ ] `bun run test` exits 0; `src/main/sidecar.test.ts` exists and passes
- [ ] `bun run lint` exits 0
- [ ] `window.imahe.getSidecarBaseUrl` is exposed via contextBridge and typed in `src/global.d.ts`
- [ ] No renderer UI files and no store files were modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- ima2's `package.json` has no `bin` entry / no obvious `serve` CLI entry, or the CLI cannot be located via `require.resolve` — report what you found.
- `/api/health` never returns 200 within the timeout when manually smoke-tested — the spawn env or args are wrong; report the captured ima2 stdout/stderr rather than guessing.
- Making the spawn work appears to require disabling `contextIsolation` or enabling `nodeIntegration` — it must not; stop and report.
- ima2 requires a separate Node install, the `RunAsNode` fuse cannot be enabled, or native/transitive deps cannot be made available without unpacking all `node_modules` — report before attempting workarounds.

## Maintenance notes

- The renderer must always obtain the base URL via `window.imahe.getSidecarBaseUrl()` — never hardcode `3333`. Reviewer should reject any literal port in renderer code.
- The crash-restart policy is intentionally minimal (one retry, then log). When plan 005+ adds UI, surface a user-visible "ima2 stopped" state and a manual restart action.
- `ELECTRON_RUN_AS_NODE` + `process.execPath` is the load-bearing trick for running a Node CLI without bundling Node — see ADR 0002. If Electron is upgraded, re-verify this still spawns correctly.
- If a future plan needs ima2's generated-image directory path, get it from `/api/health` (it reports paths) rather than assuming `~/.ima2/generated`.
