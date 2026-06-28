# Plan 009: Remix + lineage — generate from a source, record parentage, show the tree

> **Executor instructions**: Follow step by step; run every verify command. STOP conditions halt you. Update `plans/README.md` when done.
>
> **Drift check (run first)**: Re-baseline to plan 008's commit. `git diff --stat <008 SHA>..HEAD -- src/features src/lib/ima2 src/routes src/shared/ipc.ts` — on mismatch with "Current state", STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Depends on**: 003 (store: parent_id, getChildren), 007 (gallery + detail dialog), 008 (prompt bar / async job machinery)
- **Risk**: MED
- **Category**: feature
- **Planned at**: `afad6d1` against the design; depends on uncommitted 005–008 — re-stamp to 008's SHA.
- **CONTEXT**: Remix = child generated from a source; Variant = multimode sibling. Lineage stored in the imahe store. ADR 0003, 0004.

## Why this matters

Remix is the second headline feature ("remix images, create variants"). A **remix** takes an existing Asset as the starting point and generates a child (CONTEXT.md). imahe records `parent_id` in its SQLite store **at creation time** (it knows the source then), and the detail view renders the lineage: source → remixes (children) and variants/siblings where available.

## Current state

- The imahe store already supports lineage — **no schema change needed**. `window.imahe.store` (typed in `src/shared/ipc.ts` as `ImaheStoreApi`) exposes:
  - `assets.upsert({ id, parentId?, createdAt }) → AssetRecord`
  - `assets.get(id) → AssetRecord | null`
  - `assets.getChildren(parentId) → AssetRecord[]`
  `AssetRecord = { id, parentId, favorite, createdAt }`. Use these; do not add new store methods unless a STOP condition is reached.
- The store key is the ima2 asset id/filename. For gallery rows from plan 007, use `HistoryItem.filename` as the `AssetRecord.id` and as `parentId`.
- `src/features/gallery/AssetDetailDialog` (plan 007) — extend with a lineage panel.
- `src/features/generate/PromptBar` and job/event helpers (plan 008) — reuse async request ids, `/api/events`, and history invalidation.
- **Confirmed remix endpoint choice**: use `POST /api/node/generate` in async mode for the Remix flow. It supports `{ async: true, requestId }` and accepts a source image as `externalSrc` (use the source history row `filename`) or `parentNodeId` (only when you have a reliable server node id). The `done` payload includes `filename`, `url`, `nodeId`, `parentNodeId`, and `requestId`.
- **Do not use `/api/edit` for the async Remix flow.** In the current pinned ima2 dependency, `/api/edit` is blocking JSON, not async SSE. Plan 010 owns blocking edit/canvas wiring.
- Reference images are base64 strings in `references` (max 5 generally; Grok classic/node cap 3). For a simple Remix from one existing Asset, prefer `externalSrc: source.filename` over fetching the source as base64.

### Conventions

- ima2 reads/mutations via client + Zod. After a remix completes, call `window.imahe.store.assets.upsert({ id: done.filename, parentId: source.filename, createdAt })` to record lineage.
- Lineage children come from `store.assets.getChildren(source.filename)`; join those child ids/filenames back to history rows for thumbnails/metadata.
- `/api/node/:nodeId` supplements with server-side node metadata when a source or child has `nodeId`, but imahe's SQLite `parentId` is the authoritative v1 lineage link.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | all pass |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/ima2/schemas.ts` — node-generate request/async response, node-generate `done` SSE payload, `/api/node/:nodeId` response.
- `src/lib/ima2/client.ts` — `nodeGenerate()`, `getNode()`.
- `src/features/remix/` — `useRemix` (mutation: POST node-generate async with `externalSrc: source.filename`; on done, `store.assets.upsert` with `parentId`; invalidate history + lineage queries), a "Remix" action.
- `src/features/gallery/AssetDetailDialog` — add a **lineage panel**: parent, children (`getChildren`), and Remix/Make variants actions.
- A helper to convert an asset URL to base64 only for additional reference/variant flows that require `references`; the primary Remix source should use `externalSrc`.
- tests: client + remix flow + lineage panel.

**Out of scope**:
- Canvas/mask editing and blocking `/api/edit` UI — plan 010.
- Collections/favorites — plan 011.
- Store schema/IPC changes — plan 003 already created the needed bridge.
- A full graph-canvas visualization — the lineage panel is a simple parent/children/siblings list, not an infinite canvas.

## Steps

### Step 1: Schemas + client methods

Add `.passthrough()` Zod for:

- `nodeGenerate` request fields used here: `prompt`, API `provider` (`oauth` or `grok`), `model`, `quality`, `size`, `format`, `moderation`, `references`, optional `externalSrc`, optional `parentNodeId`, `async`, `requestId`, `contextMode`, `searchMode`.
- Async response: at minimum `{ requestId }`.
- Node `done` event payload: assert `requestId`, `filename`, `url`, optional `nodeId`, optional `parentNodeId`, optional `createdAt`.
- `getNode(nodeId)` response: assert `nodeId`, `url`, optional `meta`.

Add `nodeGenerate()` and `getNode()` to the client. Keep provider mapping consistent with plan 008 (`codex` UI → `oauth` API).

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Optional asset → base64 reference helper

Create a util that fetches an asset URL (via the sidecar base URL from plan 007) and returns base64 suitable for a `references` array. This is for "Make variants with source as reference" and extra attachments, not for the primary Remix source. Enforce max references (5 generally; 3 for Grok total input images) and surface a clear error if exceeded.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: `useRemix` mutation

On Remix:

1. Require a source `HistoryItem` with `filename`.
2. Generate a client `requestId`.
3. Call `client.nodeGenerate({ prompt, provider, model, size, externalSrc: source.filename, async: true, requestId })`.
4. Use plan 008's named-event SSE machinery to watch for this `requestId`.
5. On `done`, read `done.filename` (STOP if absent) and call `window.imahe.store.assets.upsert({ id: done.filename, parentId: source.filename, createdAt: done.createdAt ?? Date.now() })`.
6. Invalidate `['history']` and lineage queries for both source and child.

If the source row has a trustworthy `nodeId` and live testing shows `parentNodeId` works better than `externalSrc`, you may switch to `parentNodeId`; otherwise prefer `externalSrc: source.filename` because it works for ordinary history assets.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Lineage panel + Remix/Variants actions in the detail dialog

Extend `AssetDetailDialog`:

- Fetch the current asset record with `store.assets.get(source.filename)` to find `parentId`.
- Fetch children with `store.assets.getChildren(source.filename)`.
- Join parent/child ids (filenames) to loaded history rows to render thumbnails/metadata; show a "missing asset" placeholder if a store record has no matching history row.
- Add "Remix" button → opens prompt state and calls `useRemix`.
- Add "Make variants" button → reuse plan 008 multimode with the source as a reference (using the base64 helper when needed), not duplicate generation logic.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Tests

- `client.test.ts`: `nodeGenerate`/`getNode` send correct method/path/body; async response parses; node done event schema requires `filename`.
- Remix test: completing a remix calls `store.assets.upsert` with `{ id: done.filename, parentId: source.filename }`; mock store bridge + client + SSE.
- Lineage panel test: given a source with two children (mocked `getChildren`) and matching history rows, the panel renders two child thumbnails; if a child has no history row, it renders a missing placeholder instead of crashing.

**Verify**: `bun run test` → all pass.

## Done criteria

- [ ] Remix generates a child via `/api/node/generate` async, using `externalSrc: source.filename` (or documented `parentNodeId` if confirmed better for node assets).
- [ ] On completion, lineage is recorded via `store.assets.upsert({ id: done.filename, parentId: source.filename })` with no store schema change.
- [ ] Detail dialog shows parent + children and offers Remix + Make variants.
- [ ] References respect the per-provider cap (5 generally; 3 total input images for Grok).
- [ ] All ima2 calls via client + Zod; lineage reads/writes via the store bridge.
- [ ] typecheck/test/lint exit 0; new tests pass.
- [ ] `plans/README.md` row updated.

## STOP conditions

- `/api/node/generate` does not accept `externalSrc: source.filename` for a history asset and `parentNodeId` is not available/reliable.
- The node-generate async response/events do not include a saved child `filename` or another stable id that can key the imahe store.
- Recording lineage appears to need a new store column/method beyond `parentId`/`getChildren`.
- Reference cap or provider rules cannot be determined.
- The implementation appears to require using `/api/edit` as an async SSE endpoint — it is blocking in the current pinned ima2; stop and report instead.

## Maintenance notes

- `parent_id` may dangle if a parent was generated outside imahe or deleted — lineage queries must tolerate a missing parent record.
- If users later want a full node-graph canvas, this lineage data is already captured; only the visualization changes.
- Keep "Make variants" delegating to plan 008's multimode rather than duplicating generation logic.
