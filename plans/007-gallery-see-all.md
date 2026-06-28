# Plan 007: Gallery — "see all" paginated grid + fullscreen detail from /api/history

> **Executor instructions**: Follow step by step; run every verify command. STOP conditions halt you. Update `plans/README.md` when done.
>
> **Drift check (run first)**: Re-baseline to plan 005's commit. `git diff --stat <005 SHA>..HEAD -- src/routes src/features src/lib/ima2 index.html src/main.ts` — on mismatch with "Current state", STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Depends on**: 005
- **Risk**: MED (renderer reads sidecar HTTP JSON/images and must not disable Electron web security)
- **Category**: feature
- **Planned at**: `afad6d1` against the design; depends on uncommitted 005 — re-stamp to 005's SHA.
- **CONTEXT**: "UI shape" (gallery grid is Home; click → detail), ADR 0004

## Why this matters

The gallery is the home screen and the literal ask ("a ui where i can see all"). It lists assets from ima2's Generated store via `GET /api/history` and opens a fullscreen detail on click. It is also the surface later plans hang actions off: generation results appear here (008), remix/lineage extends the detail dialog (009), and collections/favorites reuse the grid (011).

## Current state

- `src/routes/index.tsx` or the imported `src/routes/Home.tsx` component (depending on plan 005's implementation) is a placeholder rendering Home. This plan fills it.
- `src/lib/ima2/client.ts` + `schemas.ts` (005) — add `history()`, `deleteAsset()`, and `restoreAsset()` + schemas.
- Query + `QueryClient` from 005.
- **Confirmed `/api/history` shape in the pinned ima2 dependency**: `GET /api/history` returns `{ items, total, nextCursor }`; it is paginated. Query params include `limit`, `before`, `beforeFilename`, `since`, `sessionId`, `requestId`, `favoritesOnly`, and `groupBy=session`. Use `useInfiniteQuery`; do not assume one request returns all assets.
- **Confirmed history row fields** include `filename`, `url`, optional `thumb`, `mediaType`, `createdAt`, `prompt`, `model`, `provider`, `sessionId`, `nodeId`, `requestId`, `kind`, `refsCount`, and optional `isFavorite` when a browser id header is supplied. For imahe store joins, treat `filename` as the stable Asset id unless a later plan explicitly says otherwise.
- **Confirmed delete/restore semantics**: `DELETE /api/history/:filename` tombstones/trashes an asset and returns metadata such as `ok`, `filename`, `trash`, `undoableInApp`. `POST /api/history/:filename/restore` requires body `{ trashId }`. The current delete response does **not** expose `trashId`; therefore the UI must not promise Undo unless the live response includes both `undoableInApp` and a restore token.
- Images are served by the ima2 sidecar under row `url`/`thumb`, typically `/generated/<encoded filename>`. Prefix relative URLs with `window.imahe.getSidecarBaseUrl()` (`http://127.0.0.1:<port>`). Do not hardcode the port.
- `index.html` currently has no CSP meta tag. If a CSP is added later it must allow `img-src http://127.0.0.1:*` and `connect-src http://127.0.0.1:*` for sidecar HTTP/SSE.

### Conventions

- All ima2 calls go through the `ima2` client; schemas use `.passthrough()` and assert only read fields.
- shadcn for UI (`skeleton` for loading, `dialog` for fullscreen; add `dialog`/`aspect-ratio` via the shadcn skill if absent).
- Vocabulary: each row is an **Asset**; its imahe join id is `filename`.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | all pass |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/ima2/schemas.ts` — `HistoryItem` (assert `filename`, `url`, optional `thumb`, `createdAt`, optional `mediaType`), `HistoryResponse` (`items`, `total`, `nextCursor`), delete/restore responses.
- `src/lib/ima2/client.ts` — `history(params?)`, `deleteAsset(filename)`, `restoreAsset(filename, trashId)`.
- `src/features/gallery/` — `useHistory` (infinite Query), `GalleryGrid`, `AssetCard`, `AssetDetailDialog`, `useAssetUrl` helper that prefixes sidecar base URL for relative `url`/`thumb` values.
- Home route/component — render the grid; click opens the detail dialog.
- tests under `src/features/gallery/` + extend `client.test.ts`.

**Out of scope**:
- Generation/remix/variants (008/009) — gallery only reads + delete/conditional restore.
- Lineage panel (009 extends the detail dialog).
- Collections/favorites UI (011) — though the detail dialog should remain composable.
- Changing Electron security settings to make sidecar access work.

## Steps

### Step 1: Schemas + client methods

Add `.passthrough()` schemas for paginated history. Assert only fields this UI reads: `items`, `total`, `nextCursor`, and per-item `filename`, `url`, `thumb?`, `createdAt?`, `mediaType?`. Add `history(params?)` with pagination params, `deleteAsset(filename)`, and `restoreAsset(filename, trashId)`.

For URL/path params, `encodeURIComponent` each filename segment exactly once. Do not pass an unencoded filename containing `/` directly into the route string.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: `useAssetUrl` + base URL

Create a helper/hook that reads the sidecar base URL (via Query key like `['sidecar-base-url']`) and builds absolute image URLs:

- If the row URL is already `http://` or `https://`, return it unchanged.
- If it starts with `/`, prefix the sidecar base URL.
- Prefer `thumb` for grid cards when present; use `url` for the detail dialog.

Centralize this so no component hardcodes the sidecar port.

**Verify**: `bun run typecheck` → exit 0; `rg "3333|localhost:3333" src/` → no matches introduced by this plan.

### Step 3: Paginated gallery grid + cards

`useHistory()` should be a `useInfiniteQuery` over `client.history({ limit, before, beforeFilename })`, using `nextCursor` to fetch more. Render a responsive grid of `AssetCard`s with shadcn `skeleton` while loading, empty state when no items, and a clear error state if the query fails. Fill the Home route/component with `GalleryGrid` and a "Load more" button or intersection-observer trigger.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Detail dialog + delete/conditional restore

Clicking a card opens `AssetDetailDialog` (shadcn `dialog`) showing the full image and metadata. Include Delete (mutation → `deleteAsset`, optimistic remove + invalidate `['history']`). Only show an Undo/restore affordance if the delete response exposes enough information to call `restoreAsset(filename, trashId)` safely. With the current pinned ima2 route, no `trashId` is returned, so the expected UI is delete without in-app undo.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Tests

- `client.test.ts`: `history()` parses a valid paginated response and rejects a malformed item; `deleteAsset` and `restoreAsset` hit the right method/path/body.
- gallery tests: with a mocked client returning two items on page 1 and a `nextCursor`, grid renders two cards and can fetch a next page; clicking opens the dialog; delete calls `deleteAsset` and removes/invalidates. Mock `window.imahe.getSidecarBaseUrl`. Keep the `matchMedia` polyfill.

**Verify**: `bun run test` → all pass.

## Done criteria

- [ ] Home renders a paginated/infinite grid from `/api/history` with loading, empty, error, and load-more states.
- [ ] Image URLs are built from the sidecar base URL (no hardcoded port; `rg "3333|localhost:3333" src/` returns no introduced matches).
- [ ] Detail dialog opens on click and shows full image + metadata.
- [ ] Delete works and invalidates history; restore is implemented in the client but UI only exposes Undo if the API returns a usable `trashId`/restore token.
- [ ] `.passthrough()` schemas for history/delete/restore; all calls via the `ima2` client.
- [ ] `bun run typecheck` / `bun run test` / `bun run lint` exit 0; new tests pass.
- [ ] `plans/README.md` row updated.

## STOP conditions

- `/api/history` response is not `{ items, total, nextCursor }` and cannot be adapted locally with a schema/client change.
- Renderer `fetch` to the sidecar is blocked by CORS/security policy. Report the console/network error; do not disable `webSecurity`.
- Images won't load due to CSP/webSecurity blocking `http://127.0.0.1` from the renderer. Report the exact console error; the fix (CSP allowlist vs custom protocol/proxy) is an operator decision.
- `/api/history` requires params you cannot infer (e.g. mandatory session id) — STOP and report.

## Maintenance notes

- The detail dialog is extended by plan 009 (lineage) and may host favorite/collection actions (011) — keep it composable and avoid baking Home-only assumptions into it.
- If thumbnails are available, prefer thumbnail URLs in the grid and full image in the dialog for performance.
- Revisit the base-URL strategy if the sidecar can restart with a new port mid-session (plan 002 picks a free port per launch).
