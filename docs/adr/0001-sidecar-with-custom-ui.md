# Wrap ima2-gen as a sidecar with a custom UI

imahe spawns `ima2 serve` as a managed child process and builds its own React renderer against ima2's REST API (localhost) and the on-disk generated store, rather than embedding ima2's existing web UI or forking its generation code.

This keeps full control over the gallery / remix / variants experience while letting ima2 own generation, providers, auth, and models — so upstream improvements come for free. The cost: imahe depends on ima2's REST API shape staying stable and must manage the child-process lifecycle (startup, port, shutdown, crashes).
