import type Sqlite from 'better-sqlite3';

type Migration = {
  version: number;
  up: (db: Sqlite.Database) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE assets (
          id TEXT PRIMARY KEY,
          parent_id TEXT,
          favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
          created_at INTEGER NOT NULL
        );

        CREATE INDEX assets_parent_id_idx ON assets(parent_id);

        CREATE TABLE collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE collection_items (
          collection_id TEXT NOT NULL,
          asset_id TEXT NOT NULL,
          PRIMARY KEY (collection_id, asset_id),
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
        );
      `);
    },
  },
];

export function runMigrations(db: Sqlite.Database): void {
  const currentVersion = getUserVersion(db);

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    const migrate = db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    });

    migrate();
  }
}

function getUserVersion(db: Sqlite.Database): number {
  const version = db.pragma('user_version', { simple: true });

  if (typeof version !== 'number') {
    throw new Error(`Unexpected SQLite user_version value: ${String(version)}`);
  }

  return version;
}
