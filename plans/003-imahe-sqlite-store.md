# Plan 003: imahe SQLite store — schema, migrations, asar.unpack, IPC data layer

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat <SHA from plan 002>..HEAD -- forge.config.ts package.json bun.lock src/main.ts src/preload.ts src/shared/ipc.ts src/global.d.ts` — if any in-scope file changed since plan 002's commit, compare "Current state" against live code; on mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (native module rebuild for Electron + packaging)
- **Depends on**: 001, 002
- **Category**: tech-debt / migration (foundational)
- **Planned at**: commit produced by plan 002 (record its SHA when 002 lands)

## Why this matters

ADR 0003 decided imahe owns an **organizational state layer** separate from ima2's asset store: ima2 owns the image bytes + generation metadata (`~/.ima2/generated`); imahe owns **favorites, collections, and lineage links**, keyed by ima2 asset id. This layer is needed by the lineage view (plan 008) and collections (plan 010). It must be a real queryable store because those features filter across potentially thousands of assets.

Inlined from ADR 0003 (executor has not read it): *"imahe keeps its own SQLite database (better-sqlite3) in Electron `userData`, written from the main process, keyed by ima2 asset id/filename. imahe never writes into ima2's store. SQLite was chosen over JSON/IndexedDB because the v1 features need real queries and frequent writes. Cost: better-sqlite3 is a native module, so it must be rebuilt for Electron and unpacked from asar."*

⚠️ **Open question (do not resolve by guessing)**: ima2 may already track favorites server-side (`ima2 ls --favorites`). This plan builds the schema with a `favorite` flag, but plan 010 will decide whether imahe or ima2 owns favorites. Build the column; do not wire favorites UI here.

## Current state

- No store code exists. No database. `better-sqlite3` is **not** a direct imahe store dependency yet (plan 002 may have pulled it transitively through `ima2-gen`; this plan adds/owns the direct dependency and typings).
- `src/main.ts` — Electron main process after plan 002 starts the sidecar and registers preload IPC. This plan adds store initialization alongside that structure; do not rewrite or remove sidecar startup/shutdown.
- `forge.config.ts` — plan 002 added `auto-unpack-natives`, enabled the `RunAsNode` fuse, and configured `asar.unpack` for ima2/native deps. **Extend** that unpack coverage for direct `better-sqlite3` usage if needed; do not overwrite plan 002's sidecar packaging config.
- Electron version: see `package.json` devDependencies (`electron` `42.5.0` at authoring time) — native modules must be rebuilt against this Electron's ABI.

### Conventions (from `CONTEXT.md`)

- Vocabulary to use in table/column/function names: **Asset** (a generated image; the join key is the ima2 asset id/filename), **Collection** (user-named grouping; imahe-only), **Favorite** (imahe-only flag), **lineage** via `parent_id`. Don't invent alternative names.
- The store is **main-process only**. The renderer reaches it exclusively through IPC (mirroring the preload-bridge pattern plan 002 establishes for the sidecar).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun run test`           | all pass            |
| Lint      | `bun run lint`           | exit 0              |
| Rebuild native for Electron | `bunx electron-rebuild -f -w better-sqlite3` (or `@electron/rebuild`) | rebuilds, exit 0 |

## Scope

**In scope**:
- `package.json` / `bun.lock` — add `better-sqlite3` (dep), `@types/better-sqlite3` (devDep), and `@electron/rebuild` (devDep) if not present; add a `rebuild:native` script if helpful
- `forge.config.ts` — extend `asar.unpack` to include `better-sqlite3`
- `src/main/store/db.ts` (create) — open/create the SQLite DB in `app.getPath('userData')`, run migrations
- `src/main/store/migrations.ts` (create) — versioned schema migrations
- `src/main/store/assets.ts`, `src/main/store/collections.ts` (create) — typed query functions
- `src/main/store/store.test.ts` (create) — unit tests against an in-memory/temp DB
- `src/main.ts` — initialize the store on `ready`; register IPC handlers for store operations
- `src/preload.ts` — extend `window.imahe` with store methods (e.g. `collections.list()`, `assets.setFavorite(id, bool)`)
- `src/shared/ipc.ts` — add store channel names + types to the file created by plan 002
- `src/global.d.ts` — extend the `window.imahe` type

**Out of scope** (do NOT touch):
- ima2's store / `~/.ima2/generated` — read-only territory owned by ima2; this DB never duplicates image bytes.
- Any renderer UI — consuming the store in UI is plans 008/010.
- The sidecar module from plan 002 — don't modify it.
- Do not implement collections/favorites **UI or business rules** — only the storage + access layer.

## Git workflow

- Branch: `advisor/003-imahe-sqlite-store`.
- Commit per logical unit; match plan 001's message style.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add better-sqlite3 and native rebuild tooling

Add `better-sqlite3` to dependencies and `@types/better-sqlite3` + `@electron/rebuild` to devDependencies with Bun; install. Keep the local install usable by Node/Vitest during development, and rely on Electron Forge / the explicit rebuild script to rebuild native modules for Electron when starting or packaging.

Recommended script:
- `"rebuild:native": "electron-rebuild -f -w better-sqlite3"`

**Verify**: `bun pm why better-sqlite3`; `bun pm why @types/better-sqlite3`; `bun pm why @electron/rebuild`; `bun -e "require('better-sqlite3'); console.log('ok')"` exits 0 under the development Node runtime. Confirm a `.node` file exists under `node_modules/better-sqlite3/build/Release`.

**Electron ABI check**: run `bun run rebuild:native` (or `bunx electron-rebuild -f -w better-sqlite3`) before manual Electron/package smoke testing. If this rebuild makes the Node/Vitest ABI unusable afterward, restore the development install with `bun install` before running `bun run test`; do not leave the repo in a state where the standard test gate fails.

### Step 2: Unpack better-sqlite3 from asar

Extend the `asar.unpack` glob in `forge.config.ts` (created/added by plan 002) to also match `**/node_modules/better-sqlite3/**` if it is not already covered by plan 002's native-dependency unpacking. Preserve plan 002's `auto-unpack-natives` plugin and `RunAsNode` fuse setting.

**Verify**: `bun run typecheck` → exit 0; `rg "better-sqlite3" forge.config.ts` → match.

### Step 3: Implement DB open + migrations

1. `src/main/store/db.ts`: expose a pure `openDb(dbPath: string)` helper for tests and a main-process `getDb()` singleton that opens (creating if absent) `path.join(app.getPath('userData'), 'imahe.db')`. Keep the Electron `app.getPath()` call out of test-only paths. Enable `PRAGMA journal_mode = WAL` for file-backed DBs and `foreign_keys = ON` for all DBs.
2. `src/main/store/migrations.ts`: a simple versioned runner using `PRAGMA user_version`. Migration 1 creates:
   - `assets(id TEXT PRIMARY KEY, parent_id TEXT, favorite INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)` — `id` is the ima2 asset id/filename; `parent_id` is the lineage link (nullable; FK to `assets.id` is optional since parents may be external).
   - `collections(id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL)`
   - `collection_items(collection_id TEXT NOT NULL, asset_id TEXT NOT NULL, PRIMARY KEY (collection_id, asset_id), FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE)`
   - index on `assets(parent_id)` for lineage queries.
3. Run migrations on first `getDb()`.

Allow `db.ts` to accept an explicit path (e.g. `:memory:`) for tests via a parameter or env, so tests don't touch the real userData DB.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Typed access functions

- `src/main/store/assets.ts`: `upsertAsset({id, parentId?, createdAt})`, `setFavorite(id, boolean)`, `getChildren(parentId)`, `getAsset(id)`.
- `src/main/store/collections.ts`: `createCollection(name)`, `listCollections()`, `addToCollection(collectionId, assetId)`, `removeFromCollection(collectionId, assetId)`, `listAssetsInCollection(collectionId)`.
All synchronous (better-sqlite3 is sync), typed, no `any`.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: IPC + preload exposure

- Register `ipcMain.handle` handlers for the store operations under channels named in `src/shared/ipc.ts` (e.g. `'store:collections:list'`, `'store:assets:set-favorite'`).
- Initialize the store in `src/main.ts` on `ready` (before creating the window is fine; it's synchronous and fast).
- Extend `window.imahe` in `src/preload.ts` with a typed `store` namespace mirroring the access functions; augment `Window` in `src/global.d.ts`.

**Verify**: `bun run typecheck` → exit 0.

### Step 6: Unit tests against a temp DB

`src/main/store/store.test.ts`: open an in-memory DB, run migrations, then test: create a collection and list it; add/remove an asset to a collection; `setFavorite` toggles; `upsertAsset` with `parentId` then `getChildren` returns it. Cover the happy paths plus one edge (adding a duplicate `collection_items` row is idempotent / handled).

**Verify**: `bun run test` → all pass including the new file.

## Test plan

- New tests: `src/main/store/store.test.ts` — migrations create tables; CRUD on collections; favorite toggle; lineage `getChildren`. Use an in-memory SQLite DB (pass `:memory:`); do not write to userData.
- Structural pattern: vitest from plan 001. Note these run under Node (not jsdom) — set the test file's environment to `node` if your vitest config defaults to jsdom, or add a `// @vitest-environment node` directive.
- Keep the development install Node-compatible for this unit suite. If an Electron rebuild was run immediately before tests and causes an ABI mismatch, restore the development install with `bun install` and rerun the gate; do not change SQLite libraries or skip store tests.
- Verification: `bun run test` → all pass.

## Done criteria

ALL must hold:

- [ ] `better-sqlite3` is a dependency, `@types/better-sqlite3` is a devDependency, and the native rebuild script/check is documented
- [ ] `forge.config.ts` unpacks `better-sqlite3` from asar without removing plan 002's sidecar packaging settings
- [ ] `bun run typecheck` exits 0
- [ ] `bun run test` exits 0; `src/main/store/store.test.ts` exists and passes
- [ ] `bun run lint` exits 0
- [ ] Migrations create `assets`, `collections`, `collection_items` with the documented columns
- [ ] `window.imahe.store.*` is exposed via contextBridge and typed
- [ ] No renderer UI files and no ima2/sidecar files were modified beyond the `src/main.ts` init hook (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `electron-rebuild` fails for better-sqlite3 against this Electron version — report the error; do not switch SQLite libraries on your own.
- The Vitest/Node process cannot load better-sqlite3 after restoring the development install with `bun install` — report; do not hack around it or switch SQLite libraries.
- Resolving the favorites design appears necessary to proceed — it isn't; build the `favorite` column and stop short of favorites UI/rules (that's plan 010).
- Store initialization seems to require writing into ima2's `~/.ima2/generated` — it must not; the imahe DB lives only in `userData`.

## Maintenance notes

- Schema changes must go through `migrations.ts` with an incremented `user_version` — never edit a shipped migration; add a new one.
- `parent_id` has no enforced FK to `assets.id` because a parent asset may have been generated outside imahe (only present in ima2's store). Lineage queries must tolerate dangling `parent_id`.
- The favorites column is provisional pending the plan-010 decision on whether ima2 owns favorites. If ima2 owns them, this column may be dropped in a later migration.
- Reviewer should confirm the store is main-process only — no `better-sqlite3` import in any renderer file.
- Native modules (better-sqlite3) must be re-rebuilt after any Electron version bump; document this in the eventual CONTRIBUTING/CLAUDE.md.
