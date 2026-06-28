# Bundle ima2 inside the app and spawn it as a sidecar

imahe ships `ima2-gen` as a pinned dependency and launches it itself, rather than relying on a global install or auto-installing on first run. Goal: a true one-click desktop app with zero setup for the user.

## Consequences

- ima2 is a Node CLI, so it must be spawned with a Node runtime. We reuse Electron's bundled Node via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` pointing at ima2's CLI entry — no separate Node install required on the user's machine.
- ima2 and its dependencies must be reachable at runtime. With `asar: true`, the ima2 package (and any native deps) must live under `asar.unpacked` (e.g. via the existing `plugin-auto-unpack-natives`) so the child process can load them.
- imahe owns the pinned ima2 version and is responsible for bumping it; upstream fixes do not arrive automatically.
- Credentials/providers still require user input even though install is zero-setup — see ADR for credential configuration.
