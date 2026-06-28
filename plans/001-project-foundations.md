# Plan 001: Project foundations — React + Tailwind + shadcn, verification baseline, baseline commit

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: The repo had **no commits** when this plan was written, so there is no SHA to diff against. Instead, confirm the "Current state" excerpts below match the live files. On any mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / tech-debt
- **Planned at**: uncommitted working tree (no git history yet — this plan creates the first commit)

## Why this matters

imahe's UI is specified to be built from shadcn/ui primitives (a sidebar and an input-group prompt bar — see `CONTEXT.md` → "UI shape"), which require React + Tailwind. The current repo is the default Electron Forge + Vite **plain-TypeScript** scaffold: no React, no Tailwind, no JSX support, a "Hello World" `index.html`, and no test runner or typecheck script. Every later plan's verification gates assume `bun run typecheck` and `bun run test` exist. This plan establishes that foundation and the first git commit, so subsequent plans have a stable, drift-checkable baseline.

## Current state

- `package.json` — scripts are only `start`, `package`, `make`, `publish`, `lint`. Dependencies: just `electron-squirrel-startup`. No React, no test runner, no `typecheck` script. The scaffold currently has an npm `package-lock.json`, but repo convention is **Bun**; this plan migrates the lockfile to `bun.lock` and removes `package-lock.json`.
- `tsconfig.json` — minimal; **no `jsx`, no `lib`, no path aliases**:
  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "commonjs",
      "allowJs": true,
      "skipLibCheck": true,
      "esModuleInterop": true,
      "noImplicitAny": true,
      "sourceMap": true,
      "baseUrl": ".",
      "outDir": "dist",
      "moduleResolution": "node",
      "resolveJsonModule": true
    }
  }
  ```
- `vite.renderer.config.ts` — empty config: `export default defineConfig({});`
- `index.html` — "Hello World!" body, loads `/src/renderer.ts`:
  ```html
  <body>
    <h1>💖 Hello World!</h1>
    <p>Welcome to your Electron application.</p>
    <script type="module" src="/src/renderer.ts"></script>
  </body>
  ```
- `src/renderer.ts` — only imports `./index.css` and logs a message. This is the renderer entry referenced by `index.html`.
- `src/index.css` — exists (renderer stylesheet). Imported by `src/renderer.ts`.
- `src/main.ts`, `src/preload.ts` — **OUT OF SCOPE** (owned by plan 002). Do not modify.
- `forge.config.ts` — **OUT OF SCOPE** here (plan 002/003 own the packaging changes).

### Conventions to honor

- This is the canonical vocabulary — use these names in components/comments (from `CONTEXT.md`): the app is **imahe**; **ima2** is the wrapped upstream; an **Asset** is a generated image; a **Variant** is a multimode sibling; a **Remix** is a child generated from a source. Don't invent synonyms.
- Tailwind is to be **v4** (CSS-first config via `@import "tailwindcss";` and the `@tailwindcss/vite` plugin — there is no `tailwind.config.js` in v4 unless customization is needed).
- shadcn components install under `src/components/ui/`. The import alias is `@/` → `src/`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run typecheck`      | exit 0, no errors (added in this plan) |
| Tests     | `bun run test`           | all pass (added in this plan) |
| Lint      | `bun run lint`           | exit 0              |

`bun run start` launches Electron interactively — **do not** use it as a verification gate (it blocks). Use typecheck + tests + lint.

## Suggested executor toolkit

- **Invoke the `shadcn` skill** for steps 4–5 (init + adding the first component). It knows the current shadcn CLI flags, `components.json` shape, and Tailwind v4 setup. Use the Bun runner (`bunx --bun shadcn@latest ...`) and prefer it over guessing CLI invocations.
- Reference: Electron Forge Vite + React guidance and Tailwind v4 Vite plugin docs, if reachable.

## Scope

**In scope** (the only files you should create/modify):
- `package.json` (add deps + scripts + `packageManager`)
- `tsconfig.json` (jsx, lib, paths)
- `vite.renderer.config.ts` (react + tailwind + alias)
- `index.html` (point at `src/renderer.tsx`, real root div)
- `src/renderer.tsx` (create; replaces `src/renderer.ts` as entry)
- `src/renderer.ts` (delete after `.tsx` works)
- `src/App.tsx` (create — minimal root component)
- `src/index.css` (Tailwind import)
- `src/components/ui/*` (created by shadcn)
- `src/lib/utils.ts` (created by shadcn; `cn()` helper)
- `components.json` (created by shadcn)
- `src/App.test.tsx` (create — smoke test)
- `vitest.config.ts` or test config (create)
- `src/test/setup.ts` (create — testing-library matchers)
- `.gitignore` (ensure `node_modules`, `.vite`, `out`, `dist` ignored — only if missing)
- `bun.lock` (created/updated by Bun)
- `package-lock.json` (delete; do not maintain npm lockfiles)

**Out of scope** (do NOT touch):
- `src/main.ts`, `src/preload.ts` — plan 002 owns these. Adding React must not require main-process changes.
- `forge.config.ts`, `vite.main.config.ts`, `vite.preload.config.ts` — packaging is plan 002/003.
- Do NOT add ima2, better-sqlite3, or any networking — those are plans 002/003.

## Git workflow

- The repo has no commits. After all steps verify green, create the **first commit** including the existing scaffold, the new design docs (`CONTEXT.md`, `docs/adr/`, `plans/`), and this plan's changes.
- Suggested message: `chore: project foundations — react, tailwind, shadcn, test baseline`
- Do NOT push or open a PR unless the operator instructed it.
- Record the resulting short SHA in your status update so plans 002–004 can use it as their drift baseline.

## Steps

### Step 1: Migrate to Bun and add React + tooling dependencies

1. Remove the npm lockfile (`package-lock.json`) and use Bun for all dependency changes.
2. Add `"packageManager": "bun@1.3.5"` to `package.json` (or the Bun version reported by `bun --version` if newer).
3. Install runtime and dev deps with Bun:
   - runtime: `react`, `react-dom`
   - dev: `typescript@^5`, `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`

The TypeScript upgrade is required before the typecheck gate: the scaffold's `typescript@~4.5.4` cannot parse modern Electron/Node type declarations.

**Verify**: `test ! -f package-lock.json`; `test -f bun.lock`; `bun pm why react`; `bun pm why react-dom`; `bun pm why vitest`; `bun pm why @tailwindcss/vite`; `bun pm why typescript` → all exit 0.

### Step 2: Configure tsconfig for JSX + path alias

Add to `compilerOptions`: `"jsx": "react-jsx"`, `"lib": ["DOM", "DOM.Iterable", "ESNext"]`, and `"paths": { "@/*": ["src/*"] }` (keep existing `baseUrl: "."`). Leave `module: "commonjs"` as-is — Vite handles renderer transpilation; tsconfig is for type-checking only.

**Verify**: file contains `"jsx": "react-jsx"` and the `@/*` path. `bunx tsc --noEmit` runs (errors about missing files are fine until later steps).

### Step 3: Wire React + Tailwind into the renderer Vite config

Edit `vite.renderer.config.ts` to register `@vitejs/plugin-react` and `@tailwindcss/vite`, and add the `@` → `src` alias:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

**Verify**: `bunx tsc --noEmit vite.renderer.config.ts` has no import errors (or full `bun run typecheck` after step 7).

### Step 4: Convert the renderer entry to React

1. Replace the body of `index.html` with a root container and point the script at the new entry:
   ```html
   <body>
     <div id="root"></div>
     <script type="module" src="/src/renderer.tsx"></script>
   </body>
   ```
   Keep the existing `<head>`/charset. You may set `<title>imahe</title>`.
2. Create `src/renderer.tsx` that imports `./index.css`, creates a React root on `#root`, and renders `<App />`.
3. Create `src/App.tsx` — a minimal component rendering a recognizable element, e.g. `<div className="p-4 text-2xl">imahe</div>`. Use a Tailwind class so step 6 proves Tailwind is active.
4. Delete `src/renderer.ts` (the old entry) once `.tsx` is in place.

**Verify**: `grep -q "renderer.tsx" index.html` → match; `test ! -f src/renderer.ts` → true.

### Step 5: Initialize Tailwind v4 + shadcn

1. In `src/index.css`, ensure the first line is `@import "tailwindcss";` (preserve any existing rules below, or replace boilerplate).
2. Initialize shadcn (**use the `shadcn` skill**) with `bunx --bun shadcn@latest`. It should create `components.json` configured for Tailwind v4, the `@/` alias, a `src/components/ui` output dir, and `src/lib/utils.ts`. If the CLI cannot auto-detect this Electron-Forge layout, configure `components.json` manually so its `tailwind.css` points to `src/index.css`, `aliases.components` is `@/components`, `aliases.utils` is `@/lib/utils`, and the package manager remains Bun.
3. Add one component to prove the pipeline: the **button** (`bunx --bun shadcn@latest add button`). Use it in `src/App.tsx`. Keep any shadcn-added runtime dependencies in `package.json`/`bun.lock`.

**Verify**: `test -f components.json` → true; `test -f src/components/ui/button.tsx` → true; `test -f src/lib/utils.ts` → true; `App.tsx` imports the button from `@/components/ui/button`.

### Step 6: Add a smoke test

1. Create `src/test/setup.ts` importing `@testing-library/jest-dom`.
2. Create a Vitest config (`vitest.config.ts`) with `environment: "jsdom"`, `setupFiles: ["src/test/setup.ts"]`, the `@` alias, and the react plugin (so JSX/TSX compiles in tests).
3. Create `src/App.test.tsx` that renders `<App />` and asserts the text `imahe` is in the document.

**Verify**: `bun run test` → 1 test passes, exit 0.

### Step 7: Add `typecheck` script and confirm the full gate

1. Add to `package.json` scripts: `"typecheck": "tsc --noEmit"`.
2. Add `"test": "vitest run"` (and optionally `"test:watch": "vitest"`).

**Verify**: all three succeed:
- `bun run typecheck` → exit 0, no errors
- `bun run test` → all pass
- `bun run lint` → exit 0 (fix any lint errors introduced; the repo uses the existing eslint config)

### Step 8: Baseline commit

Ensure `.gitignore` ignores `node_modules`, `.vite`, `out`, `dist`. Stage everything (scaffold + `CONTEXT.md` + `docs/` + `plans/` + this plan's changes) and create the first commit (see Git workflow). Record the short SHA.

**Verify**: `git log --oneline -1` → shows the commit; `git status --porcelain` → empty (clean tree).

## Test plan

- New test: `src/App.test.tsx` — renders `<App />`, asserts the `imahe` text node exists (happy path: React mounts, JSX compiles, alias resolves).
- Structural pattern: standard `@testing-library/react` `render` + `screen.getByText`. This is the first test, so it defines the pattern later plans follow (jsdom env, setup file, `@` alias available in tests).
- Verification: `bun run test` → all pass, including the 1 new test.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` exits 0 with no errors
- [ ] `bun run test` exits 0; `src/App.test.tsx` exists and passes
- [ ] `bun run lint` exits 0
- [ ] `package-lock.json` is removed; `bun.lock` is committed; `package.json` has `packageManager`
- [ ] `src/components/ui/button.tsx`, `src/lib/utils.ts`, and `components.json` exist; `App.tsx` renders the shadcn button
- [ ] `index.html` references `src/renderer.tsx`; `src/renderer.ts` no longer exists
- [ ] `src/main.ts`, `src/preload.ts`, `forge.config.ts` are unchanged (`git diff` shows no edits to them)
- [ ] A first git commit exists (`git log --oneline -1` non-empty) and the tree is clean
- [ ] `plans/README.md` status row for 001 updated to DONE with the commit SHA

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live files (the repo drifted since this plan was written).
- The shadcn CLI cannot be made to work with this Electron Forge split-config layout after one manual `components.json` attempt — report what failed rather than restructuring the project.
- Making React/Tailwind work appears to require editing `src/main.ts`, `src/preload.ts`, or `forge.config.ts` — that signals a different problem; stop and report.
- `bun run start` is needed to verify anything — it isn't; if you believe it is, stop and report instead of launching an interactive Electron window.

## Maintenance notes

- The renderer now has the `@/` alias in three places that must stay in sync: `tsconfig.json` paths, `vite.renderer.config.ts` resolve.alias, and `vitest.config.ts`. If one changes, update all three.
- Tailwind v4 has no JS config file by default; if a future plan needs theme tokens, add them via CSS `@theme` in `index.css`, not a `tailwind.config.js`.
- Reviewer should confirm no main-process / packaging files were touched — this plan is renderer + tooling only.
- Plans 002 and 003 will add native modules and packaging config; they assume this plan's typecheck/test scripts exist.
