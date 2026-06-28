# Plan 010: Canvas / inpaint — mask editor → blocking /api/edit

> **Executor instructions**: Follow step by step; run every verify command. STOP conditions halt you. Update `plans/README.md` when done.
>
> **Drift check (run first)**: Re-baseline to plan 008's commit. `git diff --stat <008 SHA>..HEAD -- src/features src/lib/ima2 src/routes src/shared/ipc.ts` — on mismatch with "Current state", STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Depends on**: 003 (store lineage), 007 (detail dialog / asset source), 008 (shared client conventions + cancel/inflight helper)
- **Risk**: MED (canvas drawing + PNG/mask encoding + provider-specific mask support)
- **Category**: feature
- **Planned at**: `afad6d1` against the design; depends on uncommitted 005–008 — re-stamp to 008's SHA.
- **CONTEXT**: v1 includes canvas/inpaint edit. Uses ima2 `/api/edit` with masks.

## Why this matters

Canvas mode lets the user mask a region of an existing Asset and regenerate just that region (inpaint), via `/api/edit` with a mask. It is a v1 feature (CONTEXT.md "v1 includes"). The new work is the mask editor UI and correctly encoding the source image + mask in the format ima2 accepts.

## Current state

- Plan 007's `AssetDetailDialog` is where an "Edit in Canvas" entry point lives.
- Plan 008 provides shared client conventions and `cancelJob`, but **`/api/edit` is blocking JSON in the current pinned ima2 dependency**. It does not support `{ async: true }` and does not publish progress on `/api/events` for the edit request. This plan must use a local pending state around the blocking request; do not wire `/api/edit` as async SSE.
- `/api/edit` request fields used here: `prompt`, `image`, optional `mask`, `quality`, `size`, `moderation`, `provider`, optional `model`, optional `requestId`.
- Confirmed mask contract from `node_modules/ima2-gen/routes/edit.js`:
  - `mask` must be a PNG data URL or raw PNG base64 string.
  - The mask PNG must include an alpha channel.
  - When a mask is present, the source `image` is validated as PNG base64/data URL too.
  - Mask dimensions must exactly match source image dimensions.
  - Max mask bytes: 16 MiB.
- Confirmed provider limitation: masks are rejected for Grok (`GROK_MASK_UNSUPPORTED`), Agy, Grok API, and Gemini API. In imahe v1, masked inpaint must require Codex/OpenAI OAuth (`provider: "oauth"`). Disable or explain the Canvas action when only Grok is connected.
- Vocabulary: the result of an edit is a new **Asset** and should be recorded as a child of the source in the imahe store (`parentId: source.filename`).

### Conventions

- ima2 calls via the `ima2` client + Zod.
- Use local React/Query mutation pending/error state for `/api/edit`; no SSE progress for this endpoint unless ima2 changes in a later version.
- Keep canvas code isolated under `src/features/canvas/`; do not modify shadcn primitives.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | all pass |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/ima2/schemas.ts` — `edit` request/response schemas, including `image` PNG base64/data URL and optional `mask` PNG base64/data URL.
- `src/lib/ima2/client.ts` — `edit(params)` if not already present. It is a blocking JSON POST returning at least `filename`, optional `createdAt`, `image`, `url`/metadata fields.
- `src/features/canvas/` — `CanvasEditor` (source image display + `<canvas>` mask layer with brush/eraser/size/clear), mask/source PNG export helpers, and `useInpaint` (blocking mutation → store lineage → invalidate history).
- Entry point from `AssetDetailDialog` ("Edit in Canvas").
- tests: source/mask export + inpaint payload/lineage.

**Out of scope**:
- Async `/api/edit` or `/api/events` progress for edit — not supported by current ima2.
- Grok masked inpaint — current ima2 rejects masks for Grok.
- Annotation/erase-to-transparent extras beyond a basic brush/eraser mask.
- Video, collections, lineage panel internals.
- A general layered image editor — this is single-mask inpaint only.

## Steps

### Step 1: Encode the confirmed mask/provider contract

Add constants/types near the canvas feature for the contract this plan relies on:

- Canvas inpaint provider is `oauth` only.
- Source image submitted to `/api/edit` must be PNG base64 or a `data:image/png;base64,...` URL.
- Mask submitted to `/api/edit` must be PNG base64/data URL with alpha, same pixel dimensions as the source PNG.

In the UI, show a disabled state or explanatory message if Codex/OpenAI OAuth is not connected. Do not fall back to Grok for masked edits.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Schema + client

Add or extend `client.edit()` as a blocking POST to `/api/edit`. The request schema should include `prompt`, `image`, `mask`, `provider: "oauth"`, `quality`, `size`, `moderation`, optional `model`, optional `requestId`. The response schema must assert `filename`; allow optional `createdAt`, `image`, `provider`, `model`, `revisedPrompt`, etc. via `.passthrough()`.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Canvas mask editor and PNG export helpers

`CanvasEditor`:

- Load the source asset URL from plan 007.
- Draw the source image to an internal canvas at its natural pixel dimensions (or a bounded working size if necessary, but source PNG and mask must share dimensions).
- Maintain a separate mask canvas/layer. Brush paints the selected edit region; eraser clears it; include size control and clear.
- Export **both**:
  - source PNG data URL/base64 (converted from the loaded image, even if original was JPEG/WebP), and
  - mask PNG data URL/base64 with an alpha channel and the same width/height.

Make the pure export/coordinate logic unit-testable without relying entirely on jsdom's incomplete canvas implementation.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Inpaint flow

`useInpaint`: assemble `{ prompt, image: sourcePng, mask: maskPng, provider: "oauth", quality, size, moderation, requestId }`, call `client.edit()` as a blocking mutation, show local pending/error/success state, and optionally call `cancelJob(requestId)` if a Cancel button is present while the request is in flight.

On success, require `response.filename`; call `window.imahe.store.assets.upsert({ id: response.filename, parentId: source.filename, createdAt: response.createdAt ?? Date.now() })`, then invalidate `['history']` and lineage queries for the source. Wire "Edit in Canvas" from the detail dialog.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Tests

- Mask/source export test: given a known source canvas/image abstraction and a painted region, export returns a PNG source and PNG mask with the same dimensions, non-empty alpha in the painted region, and transparent/empty alpha elsewhere.
- Provider guard test: Canvas submit is disabled or explains why when Codex/OpenAI is not connected; it must not submit `provider: "grok"` with a mask.
- Inpaint test: `useInpaint` posts `image` + `mask` + prompt to `client.edit`, then records lineage with `{ id: response.filename, parentId: source.filename }` and invalidates history. Mock client + store bridge.

**Verify**: `bun run test` → all pass.

## Done criteria

- [ ] Canvas editor paints a mask over a source asset with brush + eraser + clear.
- [ ] Source image and mask are encoded as matching-dimension PNG base64/data URLs; mask includes alpha.
- [ ] Inpaint uses blocking `client.edit()` with `provider: "oauth"`; it does not pretend `/api/edit` has async SSE progress.
- [ ] Grok masked inpaint is disabled/explained rather than attempted.
- [ ] Result lands in history and lineage is recorded via `store.assets.upsert({ id: response.filename, parentId: source.filename })`.
- [ ] All ima2 calls via client + Zod.
- [ ] typecheck/test/lint exit 0; new tests pass.
- [ ] `plans/README.md` row updated.

## STOP conditions

- The pinned/live `/api/edit` mask contract differs materially from PNG alpha mask + matching source PNG dimensions.
- Product requirements demand Grok masked inpaint in v1; current ima2 returns `GROK_MASK_UNSUPPORTED`, so this needs an upstream change or product decision.
- jsdom cannot support enough canvas API to unit-test export and you cannot introduce a thin abstraction to test the logic.
- Inpaint appears to need an endpoint other than `/api/edit`.
- Implementing this requires disabling Electron web security or bypassing the typed client.

## Maintenance notes

- Mask conventions are easy to invert visually. Reviewer should smoke-test one real Codex/OpenAI masked edit before calling the feature done.
- This deliberately stays single-mask; multi-region/layered editing is a new plan.
- If a future ima2 release adds async `/api/edit`, update this plan's implementation to reuse plan 008's job system; do not hand-roll a second job bus.
