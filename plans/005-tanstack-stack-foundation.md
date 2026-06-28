# Plan 005: Tech-stack foundation — migrate to TanStack Router (file-based) + add TanStack Query + Zod ima2 client

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat afad6d1..HEAD -- src/App.tsx src/App.test.tsx src/routes/ src/components/app-sidebar.tsx vite.renderer.config.ts package.json` — if any in-scope file changed since this plan was written, compare the "Current state" excerpts below against live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (replaces the router every view mounts on)
- **Depends on**: 004
- **Category**: tech-debt / migration
- **Planned at**: commit `afad6d1`, 2026-06-28
- **ADR**: docs/adr/0004-frontend-stack-tanstack-query-zod.md

## Why this matters

The feature plans that follow (006 auth, 007 gallery, 008 generate/variants, 009 remix/lineage, 010 canvas, 011 collections) are almost entirely **server-state from the ima2 sidecar**. ADR 0004 decided the renderer uses **TanStack Router** (file-based, hash history), **TanStack Query** (caching/refetch/polling/optimistic updates), and a single typed **`ima2` client module that validates responses with Zod**. The shell currently uses react-router; this plan migrates it and installs the data layer so every later plan builds on it instead of hand-rolling fetching. Doing it now is cheap — only `App.tsx`, `App.test.tsx`, and three placeholder routes exist.

Inlined from ADR 0004 (executor has not read it): *"Hash history is retained — browser-history routing breaks under packaged Electron's `file://`. Every new ima2 endpoint gets a Zod schema in the `ima2` client module before a Query hook consumes it. Zod sits at the seam because ima2's exact response field shapes are third-party and unverified."*

## Current state

- `src/App.tsx` — react-router shell. Builds a `RouteObject[]` and a `createHashRouter`, exported as `routes` and `App`:
  ```tsx
  import { Outlet, RouterProvider, createHashRouter, type RouteObject } from 'react-router-dom';
  // ...
  export function AppShell() { /* TooltipProvider > SidebarProvider > AppSidebar + SidebarInset(header + <Outlet/>) */ }
  export const routes: RouteObject[] = [
    { path: '/', element: <AppShell />, children: [
      { index: true, element: <Home /> },
      { path: 'settings', element: <Settings /> },
      { path: 'collections', element: <Collections /> },
    ]},
  ];
  const router = createHashRouter(routes);
  export function App() { return <RouterProvider router={router} />; }
  ```
- `src/components/app-sidebar.tsx` — uses react-router `NavLink` + `useMatch` for the three nav items (`/`, `/settings`, `/collections`). Excerpt:
  ```tsx
  import { NavLink, useMatch } from 'react-router-dom';
  const match = useMatch({ path: item.to, end: true });
  // <SidebarMenuButton asChild isActive={Boolean(match)}><NavLink to={item.to} end>...
  ```
- `src/routes/Home.tsx`, `Settings.tsx`, `Collections.tsx` — each a default-exported placeholder, e.g. `export default function Home() { return <h1 ...>Home</h1>; }`, with a comment naming the plan that fills it.
- `src/App.test.tsx` — renders via `createMemoryRouter(routes, ...)` + `RouterProvider` and asserts the three nav links exist. Includes a `window.matchMedia` polyfill in `beforeAll` (the sidebar's `use-mobile` hook needs it — **keep this polyfill**).
- `vite.renderer.config.ts` — `plugins: [react(), tailwindcss()]`, `resolve.alias` `@` → `src`. No router plugin yet.
- `package.json` — has `react-router-dom@^7.18.0`. No `@tanstack/*`, no `zod`.
- `window.imahe.getSidecarBaseUrl()` (from plan 002, typed in `src/shared/ipc.ts` as `ImaheApi`) returns the sidecar base URL string — the `ima2` client uses this.

### Conventions to honor

- Vocabulary (`CONTEXT.md`): **Asset**, **Variant**, **Remix**, **Collection**, **Favorite**, **ima2**, **imahe**. Use these in schema/type names.
- shadcn components stay unmodified in `src/components/ui/`; app composition lives elsewhere under `src/`.
- Hash history is mandatory (`file://`). Use TanStack Router's hash history, not browser history.
- Tests: vitest + jsdom + testing-library (see `src/App.test.tsx` as the pattern); keep the `matchMedia` polyfill.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun run test`           | all pass            |
| Lint      | `bun run lint`           | exit 0              |

`bun run start` is interactive — not a verification gate.

## Suggested executor toolkit

- TanStack Router file-based setup with Vite: add `@tanstack/react-router` + `@tanstack/router-plugin`. The plugin generates `routeTree.gen.ts` from `src/routes/`. If reachable, consult TanStack Router "File-Based Routing" + "Vite plugin" docs and TanStack Query "Quick Start".

## Scope

**In scope**:
- `package.json` / `bun.lock` — remove `react-router-dom`; add `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-query`, `zod`. (Optionally `@tanstack/react-query-devtools` as devDep.)
- `vite.renderer.config.ts` — add the TanStack Router plugin
- `src/routes/__root.tsx` (create) — root route = the app shell (sidebar + outlet)
- `src/routes/index.tsx`, `src/routes/settings.tsx`, `src/routes/collections.tsx` (create) — file-based routes wrapping the existing placeholder bodies
- `src/routes/Home.tsx`, `Settings.tsx`, `Collections.tsx` (delete after their content moves into the file-based routes, OR keep as presentational components imported by the route files — pick one; see step 4)
- `src/App.tsx` — replace with router + QueryClientProvider bootstrap
- `src/components/app-sidebar.tsx` — swap react-router `NavLink`/`useMatch` for TanStack Router `Link` + active state
- `src/lib/ima2/client.ts` (create) — typed fetch wrapper around the sidecar base URL
- `src/lib/ima2/schemas.ts` (create) — Zod schemas (start with `/api/health`)
- `src/lib/query.ts` (create) — the shared `QueryClient`
- `src/App.test.tsx` — update for the new router
- `src/lib/ima2/client.test.ts` (create) — unit test the client against a mocked fetch
- `routeTree.gen.ts` — generated; add to `.gitignore` OR commit it (step 2 decides)
- `tsconfig.json` — only if the generated route tree needs an include path; avoid otherwise

**Out of scope** (do NOT touch):
- `src/main.ts`, `src/preload.ts`, `src/main/**`, `src/shared/ipc.ts` — main process / IPC are settled (plans 002/003). The `ima2` client consumes `window.imahe.getSidecarBaseUrl()`; it does not change the bridge.
- `forge.config.ts` and the other vite configs.
- Do NOT implement any real feature views (auth, gallery, etc.) — routes stay placeholders. Only `/api/health` is wired, as a connectivity smoke for the client.
- shadcn `src/components/ui/*`.

## Git workflow

- Branch: `advisor/005-tanstack-stack-foundation`.
- Commit per logical unit; match the repo's `feat:`/`chore:` message style (see `git log`).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Swap dependencies

Remove `react-router-dom`; add `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-query`, `zod` with Bun.

**Verify**: `bun pm why @tanstack/react-router`, `bun pm why @tanstack/react-query`, `bun pm why zod` → exit 0; `bun pm why react-router-dom` → not found (or absent from `package.json`).

### Step 2: Register the router plugin + decide on the generated tree

Add the TanStack Router Vite plugin to `vite.renderer.config.ts` (before `react()` per its docs), pointed at `src/routes`. Decide whether to commit `routeTree.gen.ts`: **recommended — git-ignore it** (add to `.gitignore`) and ensure it's generated on dev/build; the typecheck/test gates must still work, so if the generated file isn't present during `bun run typecheck`, generate it first (the plugin generates on `vite` runs; for standalone typecheck you may need `tsr generate` from `@tanstack/router-cli`, or commit the file). If git-ignoring makes the typecheck gate fail, commit the file instead and note it.

**Verify**: `bun run typecheck` → exit 0 (after the route files in step 3 exist).

### Step 3: Create the file-based route tree

- `src/routes/__root.tsx` — `createRootRoute` whose component is the app shell: `TooltipProvider > SidebarProvider > AppSidebar + SidebarInset(header with SidebarTrigger + <Outlet/>)`. Port this JSX from the current `AppShell` in `App.tsx` verbatim (same shadcn imports). Use TanStack Router's `<Outlet />`.
- `src/routes/index.tsx` — `createFileRoute('/')` rendering the Home body.
- `src/routes/settings.tsx` — `createFileRoute('/settings')` rendering the Settings body.
- `src/routes/collections.tsx` — `createFileRoute('/collections')` rendering the Collections body.

**Verify**: after `bun run start` (or the plugin's generate), `routeTree.gen.ts` lists all four routes; `bun run typecheck` → exit 0.

### Step 4: Resolve the placeholder components

Choose ONE and apply consistently:
- (a) Move the placeholder JSX directly into the route files and **delete** `src/routes/Home.tsx`, `Settings.tsx`, `Collections.tsx`; or
- (b) Keep `Home.tsx`/`Settings.tsx`/`Collections.tsx` as presentational components and import them from the route files.

Recommended: (b) — later feature plans already reference these filenames (their comments say "Plan 00X replaces this placeholder"). Keeping them as imported components preserves those anchors. If you pick (a), update those plans' references is NOT your job — instead leave a note in your status update.

**Verify**: `bun run typecheck` → exit 0.

### Step 5: Migrate the sidebar to TanStack Router

In `src/components/app-sidebar.tsx`, replace `import { NavLink, useMatch } from 'react-router-dom'` with TanStack Router's `Link`. Use `Link`'s active props (e.g. `activeProps`/`activeOptions={{ exact: true }}`) or `useRouterState` to set `SidebarMenuButton`'s `isActive`. Keep the same three items, icons, labels, and the `asChild` composition.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 6: Bootstrap Query + Router in `App.tsx`

Replace `src/App.tsx` with: create a `QueryClient` (import from `src/lib/query.ts`), create the router from the generated `routeTree`, and render `<QueryClientProvider><RouterProvider router={router} /></QueryClientProvider>`. Register the router type via the `declare module '@tanstack/react-router'` `Register` interface for type-safe links. Use hash history (`createHashHistory()`).

`src/lib/query.ts` exports a configured `QueryClient` (sensible defaults; e.g. `staleTime` small, `retry` low — generation is local).

**Verify**: `bun run typecheck` → exit 0.

### Step 7: Build the typed ima2 client + first Zod schema

- `src/lib/ima2/schemas.ts` — a Zod schema for `/api/health` (keep it permissive: `z.object({ ... }).passthrough()` so unknown fields don't break — we only assert the fields we use). ⚠️ The exact health response shape is **unverified**; schema only the fields you actually read, and use `.passthrough()`.
- `src/lib/ima2/client.ts` — an `Ima2Client` (or factory `createIma2Client(getBaseUrl)`) that: resolves the base URL via `window.imahe.getSidecarBaseUrl()`, performs `fetch`, throws a typed error on non-2xx, and parses the body through the matching Zod schema. Expose `health()` as the first method. Make `getBaseUrl` and `fetchImpl` injectable so the client is unit-testable.

**Verify**: `bun run typecheck` → exit 0.

### Step 8: Tests

- Update `src/App.test.tsx`: render the app via TanStack Router's testing approach — create a router with a **memory history** (`createMemoryHistory({ initialEntries: ['/'] })`) and the generated `routeTree`, wrap in `QueryClientProvider`, and assert the three nav links (Home/Settings/Collections) render. **Keep the `matchMedia` polyfill.**
- Create `src/lib/ima2/client.test.ts`: inject a fake `fetchImpl` returning a valid health payload → `health()` resolves the parsed object; a malformed payload → `health()` rejects (Zod error); a 500 → rejects with the client's typed error. Inject a stub `getBaseUrl`.

**Verify**: `bun run test` → all pass including the new/updated files.

## Test plan

- `src/lib/ima2/client.test.ts` (new): happy path (valid health parses), bad-shape path (Zod rejects), HTTP-error path (non-2xx rejects). Inject `fetchImpl` + `getBaseUrl` — no real network, no real `window.imahe`.
- `src/App.test.tsx` (updated): shell renders with TanStack Router + Query providers; three nav links present. Pattern: existing test structure, swapping the router provider.
- Verification: `bun run test` → all pass.

## Done criteria

ALL must hold:

- [ ] `react-router-dom` removed; `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-query`, `zod` present
- [ ] `vite.renderer.config.ts` registers the TanStack Router plugin
- [ ] File-based routes exist (`__root`, `/`, `/settings`, `/collections`); `routeTree.gen.ts` is generated (and either git-ignored or committed per step 2)
- [ ] `app-sidebar.tsx` uses TanStack Router `Link` with working active state; no `react-router-dom` imports remain anywhere (`rg "react-router" src/` → no matches)
- [ ] `App.tsx` wraps the app in `QueryClientProvider` + `RouterProvider` with hash history
- [ ] `src/lib/ima2/client.ts` + `schemas.ts` exist; `health()` validates via Zod
- [ ] `bun run typecheck` exits 0
- [ ] `bun run test` exits 0; `client.test.ts` and updated `App.test.tsx` pass
- [ ] `bun run lint` exits 0
- [ ] No changes to `src/main.ts`, `src/preload.ts`, `src/shared/ipc.ts`, `forge.config.ts` (`git status`)
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The TanStack Router Vite plugin's generated `routeTree.gen.ts` cannot be made to satisfy `bun run typecheck` in CI (neither git-ignore-and-generate nor commit works) — report what failed.
- Active-link state in the sidebar can't be wired without restructuring the shadcn sidebar component — report; do not modify `src/components/ui/sidebar.tsx`.
- Wiring the `ima2` client appears to require changing the preload bridge or `src/shared/ipc.ts` — it must not; the client only *calls* `window.imahe.getSidecarBaseUrl()`. Stop and report.
- `rg "react-router" src/` still returns matches after migration and you can't resolve them — report rather than leaving a mixed-router state.

## Maintenance notes

- From here on, **every new ima2 endpoint gets a Zod schema in `src/lib/ima2/schemas.ts` before a Query hook consumes it** (ADR 0004). Reviewer should reject raw `fetch` in feature code that bypasses the `ima2` client.
- Schemas use `.passthrough()` and only assert read fields because ima2's shapes are unverified — when a field is confirmed against ima2's `docs/API.md`/live server, tighten the schema.
- Hash history is mandatory for packaged `file://` — reject any switch to browser history without testing the packaged build.
- If `routeTree.gen.ts` is git-ignored, ensure the typecheck/test CI step generates it first; document the command in CLAUDE.md when one is added.
- The placeholder route components (`Home`/`Settings`/`Collections`) are the mount points for plans 006/007/011 — keep their filenames stable (step 4 option b).
