# Plan 011: Collections + ima2-owned favorites

> **Executor instructions**: Follow step by step; run every verify command. STOP conditions halt you. Update `plans/README.md` when done.
>
> **Drift check (run first)**: Re-baseline to plan 007's commit. `git diff --stat <007 SHA>..HEAD -- src/features src/routes src/components/app-sidebar.tsx src/shared/ipc.ts src/lib/ima2` — on mismatch with "Current state", STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Depends on**: 003 (store: collections), 007 (gallery + detail dialog)
- **Risk**: LOW–MED (joins local collection rows with ima2 history rows; adds stable browser id header for favorites)
- **Category**: feature
- **Planned at**: `afad6d1` against the design; depends on uncommitted 005–007 — re-stamp to 007's SHA.
- **CONTEXT/ADR**: ADR 0003 (imahe owns collections + lineage); favorites ownership has been resolved against the pinned ima2 API.

## Why this matters

Collections are imahe's organizational layer over ima2's flat Generated store. Favorites look similar in the UI, but the pinned ima2 API already owns them server-side. This plan therefore splits responsibility cleanly: **collections use the imahe SQLite store**, while **favorites use ima2 history/favorite endpoints**.

## Resolved decision: favorites are ima2-owned

The earlier CONTEXT ambiguity is resolved for the pinned `ima2-gen` version:

- `GET /api/history` accepts `favoritesOnly=1|true` and overlays `isFavorite` onto rows when the request includes `X-Ima2-Browser-Id`.
- `POST /api/history/favorite` toggles favorite state. Body: `{ filename }`. Header required: `X-Ima2-Browser-Id`.
- The CLI mapping also lists `ima2 history favorite`.

Therefore: **do not wire favorites to `window.imahe.store.assets.setFavorite` in new UI.** The SQLite `favorite` column exists from plan 003 for historical/backcompat reasons; leave it alone and consider deprecating it in a later migration. Do not drop or migrate it here.

## Current state

- The imahe store + bridge (from plan 003, typed in `src/shared/ipc.ts`) already expose everything collections need — **no store/IPC change required**:
  - `store.collections.create(name) → CollectionRecord`
  - `store.collections.list() → CollectionRecord[]`
  - `store.collections.addAsset(collectionId, assetId)` / `removeAsset(...)`
  - `store.collections.listAssets(collectionId) → AssetRecord[]`
- `store.collections.listAssets(collectionId)` returns `AssetRecord[]` only (`id`, `parentId`, `favorite`, `createdAt`); it does **not** return image URLs/thumbs/metadata. Collection grids must join these ids (filenames) against `/api/history` rows from plan 007.
- `src/routes/collections.tsx` or imported `src/routes/Collections.tsx` — placeholder. This plan fills it.
- `src/components/app-sidebar.tsx` — has a Collections nav item already (plan 004/005). Optionally list collections under it.
- `src/features/gallery/AssetDetailDialog` (plan 007) — add "Add to collection" + favorite toggle here.
- `src/lib/ima2/client.ts` and `schemas.ts` (plans 005/007) — extend `history()` to support browser id/favorites and add `toggleFavorite(filename)`.

### Conventions

- Collections are local imahe state via the `window.imahe.store` bridge.
- Favorites are ima2 server state via `/api/history` and `/api/history/favorite` with a stable browser id header.
- Vocabulary: **Collection**, **Favorite**, **Asset**. Asset id = ima2 filename/history row `filename`.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | all pass |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/ima2/browser-id.ts` (create) — stable browser id helper using `localStorage` (for example key `imahe.browserId`, value `imahe-${crypto.randomUUID()}` with a safe fallback if `crypto.randomUUID` is unavailable).
- `src/lib/ima2/client.ts` + `schemas.ts` — include `X-Ima2-Browser-Id` on history/favorite requests; add `toggleFavorite(filename)`; support `history({ favoritesOnly: true })`.
- `src/features/collections/` — `useCollections`/`useCollectionAssets` (Query over the store bridge), create-collection UI, collection detail grid, add/remove, helper to join `AssetRecord[]` to history `HistoryItem[]`.
- Collections route — list collections; open one → grid of its assets (reuse plan 007's card/grid components where possible).
- `AssetDetailDialog` — "Add to collection" menu + favorite toggle (optimistic, via ima2 favorite endpoint).
- optional: Favorites filter/view and listing collections in the sidebar.
- tests: collection CRUD UI + favorite toggle/browser-id header.

**Out of scope**:
- Store schema/IPC changes (already done in plan 003).
- Using `store.assets.setFavorite` for new favorites UI.
- Generation/remix/canvas.
- Sharing/export/sync of collections.
- Dropping/deprecating the SQLite `favorite` column — later migration only.

## Steps

### Step 0: Stable browser id + favorite-capable ima2 client

Create a stable browser id helper. The value must persist across app restarts (localStorage is acceptable for v1) and be safe to send as an HTTP header. Update the ima2 client so requests that need favorite overlay include `X-Ima2-Browser-Id`:

- `history()` should include the header by default so rows can carry `isFavorite`.
- `history({ favoritesOnly: true })` should send `favoritesOnly=1`.
- `toggleFavorite(filename)` should `POST /api/history/favorite` with body `{ filename }` and the same header, returning `{ isFavorite }`.

**Verify**: `bun run typecheck` → exit 0.

### Step 1: Collections data hooks

Create `useCollections()` (Query: `store.collections.list`), `useCollectionAssets(collectionId)` (`store.collections.listAssets`), and mutations for create/addAsset/removeAsset that invalidate the relevant queries. Keep asset ids as filenames.

Add a pure join helper: `joinCollectionAssets(assetRecords, historyItems)` returns renderable rows by matching `assetRecord.id === historyItem.filename`, plus a missing list for records whose history row is absent/deleted.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Collections route

Fill the Collections route:

- List collections with counts when available.
- "New collection" action (create).
- Clicking a collection shows its assets using plan 007's `GalleryGrid`/`AssetCard` or a small wrapper around them.
- Fetch/reuse history rows from the gallery query so collection asset ids can be joined to image URLs/thumbs. If a collection contains an id not present in currently loaded history pages, either fetch more history pages until found or show a clear missing/deleted placeholder; do not crash.
- Empty state when there are no collections or a collection has no assets.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Detail dialog actions

In `AssetDetailDialog`:

- Add an "Add to collection" control (pick existing collection; optionally create a collection inline → `store.collections.addAsset(collectionId, asset.filename)`).
- Add remove-from-collection in collection context if the dialog knows the active collection.
- Add a favorite toggle using `client.toggleFavorite(asset.filename)` with optimistic update of the history query row's `isFavorite` field. Do not call `store.assets.setFavorite`.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 4: Favorites view/filter + sidebar polish

Add one minimal way to see favorites:

- Either a Home/Gallery filter chip that calls `history({ favoritesOnly: true })`, or
- a Favorites item under Collections/sidebar using the same history query.

Optionally list collections under the sidebar Collections item, but keep this minimal.

**Verify**: `bun run typecheck` → exit 0.

### Step 5: Tests

- Browser id/client test: history and `toggleFavorite` include `X-Ima2-Browser-Id`; `toggleFavorite` hits `POST /api/history/favorite` with `{ filename }` and parses `{ isFavorite }`.
- Collections test: create → appears in list; addAsset → asset id joins to a mocked history row and shows in collection grid; removeAsset → gone. Mock the `window.imahe.store` bridge.
- Favorite test: toggling calls the ima2 method, optimistically updates the UI, and rolls back or shows error on failure.

**Verify**: `bun run test` → all pass.

## Done criteria

- [ ] Favorites use ima2 (`/api/history`, `/api/history/favorite`) with stable `X-Ima2-Browser-Id`; no new UI calls `store.assets.setFavorite`.
- [ ] Collections route: list, create, open, asset grid, add/remove.
- [ ] Collection asset ids are joined to history rows for URLs/thumbs; missing/deleted assets do not crash the UI.
- [ ] Detail dialog: add-to-collection + favorite toggle (optimistic).
- [ ] At least one favorites view/filter exists.
- [ ] typecheck/test/lint exit 0; new tests pass.
- [ ] `plans/README.md` row updated; update `CONTEXT.md` favorites ambiguity note if the operator explicitly allows docs changes in the execution task.

## STOP conditions

- The pinned/live ima2 API no longer exposes `/api/history/favorite` or no longer supports `favoritesOnly`/`isFavorite` with `X-Ima2-Browser-Id`.
- A stable browser id cannot be stored safely in the renderer.
- Collections appear to need store/IPC methods that do not exist in `ImaheStoreApi`.
- Joining collection asset ids to history rows would require a new server endpoint or store schema change to be usable at v1 scale — report before extending scope.

## Maintenance notes

- Collections are local to this machine (imahe store in `userData`); cross-device sync is future work.
- Favorites are scoped by ima2's browser id. If browser id storage changes, existing favorite state may appear to reset for the user.
- Reuse plan 007's grid/card components rather than forking them, so gallery and collection views stay consistent.
