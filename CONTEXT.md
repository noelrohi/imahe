# imahe

A desktop (Electron) app that wraps [ima2-gen](https://github.com/lidge-jun/ima2-gen). It runs ima2 as a background server and presents a custom UI for browsing all generated images, remixing them, and creating variants.

## Language

**imahe**:
This desktop app. The custom Electron + React wrapper.
_Avoid_: "the app", "the wrapper" (ambiguous with ima2)

**ima2**:
The upstream `ima2-gen` CLI/server we wrap. Owns generation, providers, auth, and the image store. We never reimplement its logic.
_Avoid_: "the engine", "the backend"

**Sidecar**:
The `ima2 serve` process that imahe spawns and manages as a child process. Exposes ima2's REST API on a local port.

**Generated store**:
ima2's on-disk image directory (`~/.ima2/generated`, override via `IMA2_GENERATED_DIR`), where each image persists with its generation metadata. Owned by ima2; imahe reads but never writes it.

**imahe store**:
imahe's own SQLite DB in Electron `userData`. Holds organizational state only — favorites, collections, lineage links — keyed by ima2 asset id. See ADR 0003.

**Collection**:
A user-named grouping of assets. An imahe-only concept; ima2 has no equivalent.

**Favorite**:
A user flag marking an asset as liked. imahe-only.

**Asset**:
A single generated image. Bytes + generation metadata live in ima2's Generated store; organizational state lives in the imahe store, joined by asset id.

**Remix**:
Generating a new image that uses an existing one as its starting point — the source is passed as a reference / edit base (ima2 `/api/edit` or `/api/node/generate`). The result is a **child** of the source in lineage.
_Avoid_: "edit" (edit is one mechanism, remix is the user intent)

**Variant**:
Multiple candidate images produced together from a single prompt in one request (ima2 `/api/generate/multimode`; surfaced as the image-count control in the prompt bar). Variants are **siblings** of each other.
_Avoid_: "batch"

## UI shape

Modeled loosely on Ideogram (see reference), kept deliberately simple, built from shadcn primitives:

- **Sidebar** (shadcn `sidebar`): top-level nav — Home/gallery, (later) collections, settings.
- **Prompt bar** (shadcn `input-group`): the central compose box — prompt text, model/provider picker, image-count (= variants), aspect ratio, attach reference (= remix source).
- **Gallery grid**: all generated images from the Generated store.
- **Detail/lineage view**: opens on image click; shows source, remixes, variants; offers Remix / Make variants.

## Relationships

- **imahe** spawns and supervises one **Sidecar**
- **imahe**'s renderer talks to the **Sidecar** over ima2's REST API
- The **Sidecar** writes images into the **Generated store**, which imahe reads/displays

## Scope decisions

- **Auth is OAuth-only**, for **OpenAI** (ChatGPT/Codex login) and **Grok** only. No API-key entry, no Gemini, in v1. Settings = two "Sign in" buttons + connection status.
  - Mechanism: device-code flow via `POST /api/auth/switch {provider: "codex"|"grok"}` → `{sessionId, userCode, verificationUrl}`; imahe opens `verificationUrl` in the system browser and polls `GET /api/auth/switch/:sessionId` until `complete`. ima2 stores tokens (`~/.progrok/auth.json`, codex login).

- **v1 includes**: gallery (see all), generate (text-to-image), remix, variants, OAuth sign-in, lineage/tree detail view, canvas/inpaint edit, collections/favorites.
- **v1 excludes**: video generation (Grok video) — deferred.

## Flagged ambiguities

- "wrapper" — resolved: imahe builds its own UI against ima2's REST API; it does NOT embed ima2's web UI. See ADR 0001.
- "use the CLI instead?" — resolved: no. ima2's `gen/edit/multimode/ls` CLI commands require a running `ima2 serve` (they are thin HTTP clients). CLI = same server lifecycle + extra process spawn + stdout parsing. imahe calls the HTTP API directly.
- **Favorites ownership — UNVERIFIED.** `ima2 ls --favorites` suggests ima2 may track favorites server-side. If confirmed, imahe's store should NOT own favorites — only collections + lineage. Verify against `docs/API.md`/live server before building the store; would shrink ADR 0003.
