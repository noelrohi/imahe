# Plan 004: App shell + shadcn sidebar navigation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat <SHA from plan 001>..HEAD -- package.json bun.lock src/App.tsx src/App.test.tsx src/components src/routes src/index.css index.html components.json` — if any in-scope file changed since plan 001's commit, compare "Current state" against live code. Dependency-only changes from plans 002/003 are acceptable if no router/sidebar shell exists yet; on any relevant mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (renderer-only, no integrations)
- **Depends on**: 001
- **Category**: dx (UI scaffold)
- **Planned at**: commit produced by plan 001 (record its SHA when 001 lands)

## Why this matters

`CONTEXT.md` → "UI shape" specifies imahe is modeled loosely on Ideogram, built from shadcn primitives, with a **sidebar** for top-level navigation (Home/gallery, Settings, Collections). The feature plans (005 auth → Settings, 006 gallery → Home, 010 → Collections) each need a place to mount their view. This plan builds the empty navigable shell so those plans drop their screens into named routes instead of reinventing layout. It is renderer-only and integrates with nothing — deliberately, so it's low-risk and unblocks parallel feature work.

Inlined from `CONTEXT.md` → "UI shape": *"Sidebar (shadcn `sidebar`): top-level nav — Home/gallery, (later) collections, settings. Prompt bar (shadcn `input-group`): the central compose box. Gallery grid: all generated images. Detail/lineage view: opens on image click."* This plan delivers the **sidebar + routed empty panes** only; the prompt bar, gallery, and detail view are later plans.

## Current state

- After plan 001: `src/App.tsx` renders a minimal placeholder (e.g. `<div className="p-4 text-2xl">imahe</div>`) using a shadcn button to prove the pipeline. React + Tailwind v4 + shadcn (`components.json`, `src/components/ui/`) are configured. The `@/` alias resolves in tsconfig, vite, and vitest.
- No router is installed. No layout components exist beyond `App.tsx`.
- shadcn `sidebar` component is **not yet added**.

### Conventions (from plan 001 + `CONTEXT.md`)

- shadcn components live in `src/components/ui/`; app components elsewhere under `src/` with the `@/` alias for imports.
- Use the canonical nav labels from `CONTEXT.md`: **Home** (the gallery / "see all"), **Settings** (where OAuth sign-in lives), **Collections**. Don't rename them.
- Tailwind v4: theme tokens via CSS `@theme` in `index.css`, not a JS config.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun run test`           | all pass            |
| Lint      | `bun run lint`           | exit 0              |

`bun run start` is interactive — not a verification gate.

## Suggested executor toolkit

- **Invoke the `shadcn` skill** to add the `sidebar` component (and its dependencies like `sheet`, `separator` — the skill knows the set). It also knows the `SidebarProvider`/`Sidebar`/`SidebarMenu` composition pattern.

## Scope

**In scope**:
- `package.json` / `bun.lock` — add a router suited to a hash/in-app SPA (recommend `react-router-dom`; hash-based history works best in Electron's `file://` packaged context)
- `src/components/ui/*` — shadcn `sidebar` (+ its deps), added via the shadcn CLI
- `src/components/app-sidebar.tsx` (create) — the imahe nav sidebar
- `src/routes/Home.tsx`, `src/routes/Settings.tsx`, `src/routes/Collections.tsx` (create) — empty placeholder panes, each rendering a heading with its name
- `src/App.tsx` — export `AppShell` + route config, and default-export the hash-router-backed app
- `src/App.test.tsx` — update to assert the shell renders (nav items present)

**Out of scope** (do NOT touch):
- `src/main.ts`, `src/preload.ts`, `src/main/**` — main process (plans 002/003).
- Any ima2 API calls or store access — the panes are empty placeholders. No `window.imahe` usage here.
- The prompt bar / input-group, the gallery grid, the detail/lineage view — later plans fill the panes.

## Git workflow

- Branch: `advisor/004-app-shell-sidebar`.
- Commit per logical unit; match plan 001's message style.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a router

Install `react-router-dom` with Bun (`bun add react-router-dom`). Use **hash-based** routing (`createHashRouter` / `HashRouter`) — packaged Electron serves from `file://`, where browser-history routing breaks.

**Verify**: `bun pm why react-router-dom` → listed, exit 0.

### Step 2: Add the shadcn sidebar

Use the `shadcn` skill to add the `sidebar` component and its dependencies with `bunx --bun shadcn@latest`. Confirm files land in `src/components/ui/` and any shadcn-added deps are reflected in `package.json`/`bun.lock`.

**Verify**: `test -f src/components/ui/sidebar.tsx` → true; `bun run typecheck` → exit 0.

### Step 3: Build `AppSidebar`

Create `src/components/app-sidebar.tsx` using the shadcn sidebar composition: a header with the "imahe" wordmark and a menu with three items — **Home**, **Settings**, **Collections** — each a router `NavLink`/`Link` to `/`, `/settings`, `/collections` respectively, with an icon (use the icon library installed/configured by shadcn, typically `lucide-react`). Mark the active item using the router's active state.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Create the three route panes

`src/routes/Home.tsx`, `Settings.tsx`, `Collections.tsx` — each a default-exported component rendering a single heading with its name (e.g. `<h1 className="text-xl font-semibold p-4">Home</h1>`). These are intentionally empty; later plans replace the bodies. Add a short comment in each pointing to the plan that fills it (Home → plan 006, Settings → plan 005, Collections → plan 010).

**Verify**: `bun run typecheck` → exit 0.

### Step 5: Compose the shell in `App.tsx`

Replace the placeholder `App.tsx` with two exported pieces:
1. `AppShell` — assumes router context and renders `SidebarProvider` wrapping `AppSidebar` + a main content region with `<Outlet />`.
2. `routes` / route config — `/` → Home, `/settings` → Settings, `/collections` → Collections, nested under `AppShell`.

The default `App` should create/use a **hash router** (`createHashRouter(routes)` + `RouterProvider`, or equivalent `HashRouter`) for production Electron. Keep it minimal and styled with Tailwind utility classes consistent with shadcn defaults.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 6: Update the smoke test

Update `src/App.test.tsx` to test the shell without nesting routers: create a memory router from the exported `routes` (`createMemoryRouter(routes, { initialEntries: ["/"] })`) and render `<RouterProvider router={router} />`. Assert the nav links **Home**, **Settings**, **Collections** are present, preferably with role-based queries (`getByRole("link", { name: /Home/i })`) to avoid matching page headings.

**Verify**: `bun run test` → all pass.

## Test plan

- Updated test: `src/App.test.tsx` — renders the shell through `createMemoryRouter(routes)`, asserts the three nav links exist (happy path: shell mounts, sidebar renders, router provides context).
- Structural pattern: the existing `src/App.test.tsx` from plan 001 (testing-library + jsdom).
- Verification: `bun run test` → all pass.

## Done criteria

ALL must hold:

- [ ] `react-router-dom` installed; routing is hash-based
- [ ] `src/components/ui/sidebar.tsx` exists (shadcn)
- [ ] `AppSidebar` renders Home / Settings / Collections nav items linking to `/`, `/settings`, `/collections`
- [ ] Three route panes exist as empty placeholders
- [ ] `bun run typecheck` exits 0
- [ ] `bun run test` exits 0; updated `App.test.tsx` asserts the three nav items
- [ ] `bun run lint` exits 0
- [ ] No main-process, preload, or `window.imahe` usage introduced (`git status` + grep)
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The shadcn sidebar component cannot be added via the CLI for this project layout — report; do not hand-write a sidebar from scratch.
- Routing requires browser-history mode that breaks under `file://` — confirm you used hash routing; if hash routing still fails in `bun run start`, report.
- A pane seems to need real data/`window.imahe` to render — it shouldn't; the panes are placeholders. Stop and report if the plan seems to demand integration here.

## Maintenance notes

- This shell is the mount point for feature plans: Settings (005), Home/gallery (006), Collections (010). Those plans replace the placeholder pane bodies — they should not need to restructure `App.tsx` or the sidebar.
- The prompt bar (shadcn `input-group`) from plan 007 will likely live inside the Home pane's layout; leave room for it.
- Hash routing is a deliberate choice for packaged Electron — a reviewer should reject any switch to browser-history routing without testing the packaged (`file://`) build.
- Keep shadcn components unmodified in `src/components/ui/`; app-specific composition belongs in `src/components/` (like `app-sidebar.tsx`).
