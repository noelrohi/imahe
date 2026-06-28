# Plan 008: Prompt bar — generate + variants with async SSE progress

> **Executor instructions**: Follow step by step; run every verify command. STOP conditions halt you. Update `plans/README.md` when done.
>
> **Drift check (run first)**: Re-baseline to plan 007's commit. `git diff --stat <007 SHA>..HEAD -- src/routes src/features src/lib/ima2` — on mismatch with "Current state", STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Depends on**: 006 (must know auth/provider status), 007 (results land in the gallery)
- **Risk**: MED (SSE streaming, async job lifecycle, renderer → sidecar HTTP)
- **Category**: feature
- **Planned at**: `afad6d1` against the design; depends on uncommitted 005–007 — re-stamp to 007's SHA.
- **CONTEXT**: "UI shape" (prompt bar = shadcn input-group; image-count = variants), "Tech stack" (async + `/api/events` SSE)

## Why this matters

This is the create surface — the central prompt bar from the Ideogram-style design. Single generation uses `/api/generate`; **variants** (multiple candidates from one prompt) use `/api/generate/multimode` (CONTEXT.md defines Variant = multimode siblings). Generation runs in **async mode** (`{ async: true, requestId }`) with progress from the `/api/events` SSE multiplex, so the UI stays responsive and multiple jobs can run while browsing.

## Current state

- Home (`src/routes/index.tsx` or imported `Home.tsx`) renders the gallery grid (plan 007). This plan adds the prompt bar above it.
- `src/lib/ima2/client.ts` (005/006/007) — add `generate()`, `multimode()`, `inflight()`, `cancelJob()`.
- `useProviderStatuses()` (006) gives Codex/OpenAI and Grok connection status. **UI provider `codex` must be sent to generation endpoints as `provider: "oauth"`; UI provider `grok` is sent as `provider: "grok"`. Do not send `provider: "codex"` to ima2 generation endpoints.**
- shadcn **input-group** is the specified component for the prompt bar — it is NOT yet added. Add via the `shadcn` skill (`shadcn add input-group`); if that component id does not exist, compose the prompt bar from `input`/`button`/`select`/`textarea` primitives and note the fallback.
- References are base64 strings in a `references` array (max 5 generally; Grok classic/node cap 3). Attach-reference/remix UI is plan 009; this plan may keep `references: []`.

### Confirmed ima2 async/SSE contract

- `POST /api/generate` in the pinned route accepts `async: true` and immediately returns `202 { requestId, async: true }` after starting a job.
- `POST /api/generate/multimode` accepts `async: true` and returns `202 { requestId }`.
- `GET /api/events` emits **named SSE events** (`phase`, `partial`, `image`, `done`, `error`, `replay-gap`) with JSON data. Do not rely on only `EventSource.onmessage`; register listeners for named events with `addEventListener`.
- Each SSE data payload includes `jobId` and/or `requestId`; filter events by the request id returned from the POST.
- `GET /api/inflight` lists jobs; `DELETE /api/inflight/:requestId` cancels/forgets a job.
- `/api/edit` is blocking JSON in the current pinned ima2 dependency; do not model edit/canvas as async SSE in this plan.

### Conventions

- ima2 HTTP calls go through the `ima2` client + Zod. SSE is the one exception to ordinary fetch — wrap `EventSource` in a small typed helper and validate event payloads with Zod.
- Vocabulary: count > 1 ⇒ **Variants** (multimode); count 1 ⇒ a single generation.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | all pass |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/ima2/schemas.ts` — request/response schemas for generate + multimode async responses, inflight jobs, cancel response, and SSE event payloads.
- `src/lib/ima2/client.ts` — `generate(params)`, `multimode(params)`, `inflight(params?)`, `cancelJob(requestId)`.
- `src/lib/ima2/events.ts` (create) — typed `subscribeToEvents(baseUrl, handlers)` over `EventSource(baseUrl + '/api/events')`, registering named event listeners and Zod-validating each event.
- `src/features/generate/` — `PromptBar` (prompt, provider/model picker, image-count = variants, aspect ratio), `useGenerate` (mutation: POST async → returns requestId), `useJobEvents` (subscribe, map progress into Query cache; invalidate `['history']` on final image/done).
- Home route/component — mount `PromptBar` above the gallery; show in-progress jobs and cancel controls.
- tests: client/events/`PromptBar`.

**Out of scope**:
- Reference/attach/remix — plan 009.
- Canvas/inpaint — plan 010.
- Video — deferred (not in v1).
- Fixing CORS/security policy if direct renderer sidecar calls are blocked; stop and report instead.

## Steps

### Step 1: Schemas + client methods

Add Zod (`.passthrough()`) for:

- Generate request: `prompt`, API `provider` (`oauth` or `grok` for v1), `model`, `quality`, `size`, `format`, `moderation`, `n`, `references`, `async`, `requestId`.
- Multimode request: same core fields, but use `maxImages` for count.
- Async response: at minimum `requestId`; allow optional `async` boolean.
- Inflight response: `{ jobs }` and optional `terminalJobs`.

Add `generate`, `multimode`, `inflight`, `cancelJob`. Generate `requestId` client-side (for example `req_${crypto.randomUUID()}`) before POST so the UI can correlate SSE events.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Named-event SSE helper

Create `src/lib/ima2/events.ts`: `subscribeToEvents(baseUrl, handlers, options?)` opens `EventSource(baseUrl + '/api/events')`, registers `addEventListener` handlers for `phase`, `partial`, `image`, `done`, `error`, and `replay-gap`, parses `event.data` through Zod, and dispatches typed events including the event name. Return an unsubscribe that removes listeners and closes the EventSource. Make the `EventSource` constructor injectable for tests.

On `replay-gap`, call a handler that can reconcile with `client.inflight({ includeTerminal: true })` or mark progress stale; do not ignore it silently.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Prompt bar UI

Build `PromptBar` with shadcn input-group (or documented fallback): prompt text, provider/model picker, image-count control (1 = single, N = variants), aspect-ratio/size control, submit. Use `useProviderStatuses()` from plan 006:

- Disable Codex/OpenAI option unless Codex is connected; when selected, submit payload uses `provider: "oauth"` and a Codex/OpenAI image model default (use the current ima2 docs default such as `gpt-5.4-mini` unless live models say otherwise).
- Disable Grok option unless Grok is connected; when selected, submit payload uses `provider: "grok"` and a Grok image model default (`grok-imagine-image` or `grok-imagine-image-quality`).
- Disable submit when no connected provider is selected or prompt is blank.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Generate + job tracking

`useGenerate`: on submit, build the API payload and POST async:

- count 1 → `client.generate({ ..., n: 1, async: true, requestId })`.
- count > 1 → `client.multimode({ ..., maxImages: count, async: true, requestId })`.

`useJobEvents`: keep one EventSource subscription for the app/root generate feature, filter events by `requestId`, surface per-job progress/phase/partial previews, and invalidate `['history']` when a final `image` or `done` event indicates assets were saved. Support cancel via `cancelJob(requestId)`.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Tests

- `client.test.ts`: generate/multimode send correct method/path/body (`n` for generate, `maxImages` for multimode); async responses parse.
- `events.test.ts`: inject a fake EventSource, emit named `phase`, `image`, `done`, `error`, and `replay-gap` events → handlers receive typed events; malformed event data is rejected/ignored safely with a logged/returned error path.
- `PromptBar` test: count > 1 routes to `multimode`; count 1 routes to `generate`; Codex UI maps to API provider `oauth`; Grok maps to `grok`; submit disabled when no provider connected.

**Verify**: `bun run test` → all pass.

## Done criteria

- [ ] Prompt bar with prompt/provider/model/count/aspect-ratio mounted on Home above the gallery.
- [ ] UI provider `codex` sends `provider: "oauth"`; UI provider `grok` sends `provider: "grok"`.
- [ ] count 1 → `/api/generate` with `n: 1`; count > 1 → `/api/generate/multimode` with `maxImages`; both async with client-generated `requestId`.
- [ ] SSE via `/api/events` uses named event listeners, drives progress, handles `replay-gap`, and invalidates `['history']` on saved images/completion.
- [ ] Submit disabled until a connected provider is selected.
- [ ] All ima2 calls via client/events helpers with Zod; no hardcoded port.
- [ ] typecheck/test/lint exit 0; new tests pass.
- [ ] `plans/README.md` row updated.

## STOP conditions

- The async contract differs from `{ async: true, requestId }` + `/api/events` in the pinned ima2 docs/live server and cannot be adapted by changing schemas/request fields.
- `EventSource` cannot reach `http://127.0.0.1:<port>/api/events` from the renderer (CORS/CSP/connect-src). Report the exact console error; do not disable `webSecurity`.
- `multimode` requires parameters you cannot infer.
- Provider status hooks from plan 006 are absent or do not distinguish Codex/OpenAI vs Grok connection state.

## Maintenance notes

- The reference/attach control (plan 009) plugs into this same `PromptBar` (`references` array, max 5; Grok max 3).
- Job/progress state is currently local + Query cache; if it must persist globally across views, that is the trigger to add a small store (ADR 0004 deferred Zustand for exactly this).
- When ima2 SSE event shapes are confirmed further, tighten the event schemas while preserving `.passthrough()` for route-specific payloads.
