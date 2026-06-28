# Plan 006: Auth — Settings screen with device-code OAuth (Codex/OpenAI + Grok)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a "STOP conditions" item occurs, stop and report — do not improvise. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: Re-baseline to plan 005's commit. `git diff --stat <005 SHA>..HEAD -- src/routes src/features src/lib/ima2 src/preload.ts src/shared/ipc.ts src/main.ts src/global.d.ts` — if in-scope files changed since 005, compare "Current state" against live code; on mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (adds a new IPC channel for external URLs and relies on renderer → sidecar HTTP)
- **Depends on**: 005
- **Category**: feature
- **Planned at**: `afad6d1` against the design; **depends on uncommitted 005** — re-stamp to 005's SHA when it lands.
- **ADR/CONTEXT**: CONTEXT.md "Scope decisions" (auth is OAuth-only: OpenAI/Codex + Grok), ADR 0004 (Query + Zod client)

## Why this matters

ima2 is bundled with no interactive `ima2 setup` step (ADR 0002), so imahe must drive sign-in itself. Auth is **OAuth-only for OpenAI/Codex and Grok** — no API keys, no Gemini (CONTEXT.md). Without this, no generation works. ima2 exposes a device-code flow purpose-built for GUI clients.

Confirmed ima2 auth contract (from `node_modules/ima2-gen/docs/API.md` and routes in the pinned dependency):

- `POST /api/auth/switch` with `{ "provider": "codex" | "grok" }` starts device-code OAuth and returns `{ sessionId, userCode, verificationUrl }`.
- `GET /api/auth/switch/:sessionId` returns `{ status }`, where status is `pending`, `complete`, `error`, or `expired`.
- **Do not use `/api/providers` as connection status.** In the current ima2 route it returns runtime/provider-policy data (`apiKey`, `oauth`, runtime ports), not per-provider auth state.
- Use `GET /api/oauth/status` for Codex/OpenAI OAuth status, `GET /api/grok/status` for Grok image-model status, and optionally `GET /api/quota` for authenticated/account/quota detail.
- UI provider id **`codex` maps to generation payload provider `oauth`** in later plans. UI provider id `grok` maps to generation payload provider `grok`.

## Current state

- `src/routes/settings.tsx` or the imported `src/routes/Settings.tsx` component (depending on plan 005's implementation) is a placeholder rendering Settings. This plan fills it.
- `src/lib/ima2/client.ts` + `schemas.ts` (from 005) — the typed sidecar client; add auth/status methods + Zod schemas here.
- `src/lib/query.ts` (from 005) — shared `QueryClient`.
- `window.imahe` bridge (`src/preload.ts`, typed in `src/shared/ipc.ts` as `ImaheApi`) currently exposes `getSidecarBaseUrl()` + `store`. It has no way to open an external URL — OAuth `verificationUrl` must open in the system browser via Electron `shell.openExternal`, which is a main-process API. This plan adds a guarded IPC channel + preload method for it.
- `src/main.ts` — registers existing IPC handlers; add the `openExternal` handler here.
- Renderer direct HTTP to the sidecar is assumed by ADR 0004. If the first auth/status query fails because Chromium blocks cross-origin `fetch` to `http://127.0.0.1:<port>`, STOP; the fix is a cross-cutting main-process proxy/custom protocol decision, not a feature-level workaround.

### Conventions

- All ima2 HTTP calls go through the `ima2` client (ADR 0004); schemas use `.passthrough()` and assert only read fields.
- shadcn components live in `src/components/ui/`; add any new ones via the `shadcn` skill.
- Vocabulary: a **provider** in the UI is `codex` or `grok`. In ima2 generation payloads, `codex` becomes `oauth`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | all pass |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/shared/ipc.ts` — add `shellOpenExternal: 'shell:open-external'` channel + `ImaheApi.openExternal(url: string): Promise<void>`.
- `src/preload.ts` — expose `window.imahe.openExternal`.
- `src/main.ts` — import `shell`; handle `shell:open-external` with `shell.openExternal(url)` after validating `url` with `new URL(url)` and requiring `protocol === 'https:'`.
- `src/lib/ima2/schemas.ts` — Zod for `/api/auth/switch`, `/api/auth/switch/:id`, `/api/oauth/status`, `/api/grok/status`, `/api/quota`, and optionally `/api/providers` runtime info.
- `src/lib/ima2/client.ts` — `authSwitch(provider)`, `authStatus(sessionId)`, `oauthStatus()`, `grokStatus()`, `quota()`, optional `providersRuntime()`.
- `src/features/auth/` (create) — `useProviderStatuses` (Query), `useStartOAuth` (mutation + polling), and Settings UI components.
- Settings route/component — render provider cards with connect/switch buttons + status.
- tests: extend `src/lib/ima2/client.test.ts`; add `src/features/auth/*.test.tsx`; add IPC validation tests only if the repo already has a main-process IPC test pattern.

**Out of scope**:
- API-key entry, Gemini, direct xAI API key, any provider besides Codex/OpenAI OAuth and Grok OAuth.
- ima2's own setup/settings pages — do NOT embed them.
- The sidecar lifecycle / store internals.
- Generation model selection beyond surfacing provider status; generation payload mapping is implemented in plan 008.

## Steps

### Step 1: Add the guarded `openExternal` IPC channel

Add the channel name + `ImaheApi.openExternal` type in `src/shared/ipc.ts`; expose it in `src/preload.ts`; handle it in `src/main.ts` with `shell.openExternal`. Reject any URL that cannot be parsed or whose protocol is not `https:`.

**Verify**: `bun run typecheck` → exit 0; `rg "open-external|openExternal" src/` → matches in ipc/preload/main/types only.

### Step 2: Schemas + client methods

Add `.passthrough()` Zod schemas:

- `AuthSwitchResponse`: `sessionId`, `userCode`, `verificationUrl`.
- `AuthStatusResponse`: `status` ∈ `pending|complete|error|expired`, optional `error`.
- `OAuthStatusResponse`: assert `status` string and optional `models` array.
- `GrokStatusResponse`: assert `status` string and optional `models` array.
- `QuotaResponse`: assert optional `codex` and `grok` objects with optional `authenticated` boolean; keep the rest passthrough.
- Optional `ProvidersRuntimeResponse` for `/api/providers` if the UI needs runtime/port diagnostics. Do not treat it as auth state.

Add client methods `authSwitch(provider: 'codex'|'grok')`, `authStatus(sessionId)`, `oauthStatus()`, `grokStatus()`, `quota()`, optional `providersRuntime()`.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Query hooks and polling flow

Create `useProviderStatuses()` from separate queries for `['auth','oauth-status']`, `['auth','grok-status']`, and optional `['auth','quota']`. Derive card states in one place:

- Codex/OpenAI is connected when `/api/oauth/status` reports `ready` **or** quota `codex.authenticated === true`.
- Grok is connected when `/api/grok/status` reports `ready` **or** quota `grok.authenticated === true`.
- Preserve raw statuses for diagnostics/tooltips.

Create `useStartOAuth(provider)` mutation: call `authSwitch`, store/show `userCode`, call `window.imahe.openExternal(verificationUrl)`, then poll `authStatus(sessionId)` about every 2 seconds until a terminal status. On `complete`, invalidate all auth/status query keys. On `error`/`expired`, expose a retryable error state.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Settings UI

Fill the Settings route: two provider cards (Codex/OpenAI and Grok), each showing connection status and a "Sign in" / "Switch account" button that triggers `useStartOAuth`. While pending, show the `userCode` and a "waiting for browser verification…" state; on `complete`, show connected; on `error`/`expired`, show retry. Use shadcn `button`/`card` (add `card` via the shadcn skill if absent).

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Tests

- `client.test.ts`: `authSwitch()`/`authStatus()`/`oauthStatus()`/`grokStatus()`/`quota()` parse valid payloads, reject malformed payloads for fields the app reads, and hit the correct paths/methods (inject `fetchImpl`).
- Auth UI tests: render Settings with mocked client hooks and `window.imahe.openExternal` stub; clicking Sign in calls `authSwitch` and `openExternal`; a `complete` poll flips the card to connected and invalidates statuses. Wrap in `QueryClientProvider` (+ router if needed). Keep the `matchMedia` polyfill pattern from `App.test.tsx`.

**Verify**: `bun run test` → all pass.

## Done criteria

- [ ] `window.imahe.openExternal` exists, is typed, and rejects non-`https:` URLs.
- [ ] `authSwitch`/`authStatus`/`oauthStatus`/`grokStatus`/`quota` client methods + `.passthrough()` schemas exist.
- [ ] Settings shows Codex/OpenAI + Grok cards with status + working Sign in/Switch flow (mutation → openExternal → poll → connected).
- [ ] `/api/providers` is not used as the source of provider connection/auth state.
- [ ] No API-key/Gemini UI; no ima2 pages embedded.
- [ ] `bun run typecheck` / `bun run test` / `bun run lint` all exit 0; new tests pass.
- [ ] `plans/README.md` row updated.

## STOP conditions

- `/api/auth/switch` response field names differ from `{sessionId,userCode,verificationUrl}` in the pinned ima2 docs/live server and cannot be adapted locally in the schema/client.
- OAuth requires embedding ima2's web page rather than `openExternal` + polling.
- `shell.openExternal` appears to require disabling Electron security settings — it must not.
- Renderer `fetch` to the sidecar is blocked by CORS/security policy. Report the exact console/network error; do not bypass the typed client or disable `webSecurity`.
- Provider status cannot be determined from `/api/oauth/status`, `/api/grok/status`, or `/api/quota`.

## Maintenance notes

- `openExternal` is a general capability; reviewer should confirm the `https:`-only guard stays.
- When ima2's provider/status field names are confirmed in tests against a live server, tighten the schemas off `.passthrough()` where practical.
- Plan 008 must map UI provider `codex` to generation payload provider `oauth`; do not send `provider: "codex"` to generation endpoints.
