# Frontend stack: TanStack Router (file-based) + TanStack Query + Zod boundary

The renderer uses TanStack Router (file-based routing, hash history) for navigation, TanStack Query for all ima2 server-state, and a single typed `ima2` client module that validates every response with Zod. We migrated off react-router (used in the initial shell) to TanStack Router for type-safe routing that composes with Query's loader/caching model.

## Why

Almost everything imahe renders is server-state owned by the ima2 sidecar — gallery (`/api/history`), providers/models (`/api/providers`), OAuth status polling (`/api/auth/switch/:id`), and SSE-driven job progress (`/api/events`). TanStack Query gives caching, background refetch, polling, and optimistic updates (favorites) without hand-rolling them. Zod sits at the seam because ima2's exact response field shapes are third-party and unverified (see CONTEXT.md "Open verification tasks") — validating there turns a wrong shape into a loud, located error instead of an undefined deep in a component.

## Rejected

- **react-router** — fine for the shell, but no type-safe params/loaders and weaker Query integration. Migrating now is cheap (only `App.tsx` + three route files exist).
- **Zustand / Redux** — Query + local state cover v1; adding a global store now is premature.
- **Drizzle / an ORM** — the imahe store is small hand-written raw SQL (ADR 0003); an ORM is churn for no gain.
- **tRPC-over-IPC, react-hook-form** — overkill at this size; the existing typed IPC bridge and controlled inputs suffice.

## Consequences

- File-based routing adds the `@tanstack/router-plugin` to `vite.renderer.config.ts` and a generated `routeTree.gen.ts` (git-ignored or committed, per plan).
- Hash history is retained — browser-history routing breaks under packaged Electron's `file://`.
- Every new ima2 endpoint gets a Zod schema in the `ima2` client module before a Query hook consumes it.
