# imahe owns an organizational state layer in SQLite

ima2's API has no concept of favorites or collections, and only partial lineage in its node metadata. imahe therefore keeps its own SQLite database (better-sqlite3) in Electron `userData`, written from the main process, keyed by ima2 asset id/filename.

This draws a clear ownership boundary: **ima2 owns the assets** (image bytes + generation metadata in `~/.ima2/generated`); **imahe owns organization** (favorites, collections, and lineage links it records at creation time). imahe never writes into ima2's store.

SQLite was chosen over a JSON file or renderer IndexedDB because the chosen v1 features (lineage tree, collections, favorites) need real queries and frequent writes across potentially thousands of assets. Cost: better-sqlite3 is a native module, so it must be rebuilt for Electron and unpacked from asar alongside ima2.
