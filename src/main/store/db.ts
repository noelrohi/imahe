import Sqlite from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

import { runMigrations } from './migrations';

export type ImaheDatabase = Sqlite.Database;

let db: ImaheDatabase | null = null;

export function openDb(dbPath: string): ImaheDatabase {
  const database = new Sqlite(dbPath);

  database.pragma('foreign_keys = ON');

  if (dbPath !== ':memory:') {
    database.pragma('journal_mode = WAL');
  }

  runMigrations(database);

  return database;
}

export function getDb(): ImaheDatabase {
  if (!db) {
    db = openDb(getDbPath());
  }

  return db;
}

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'imahe.db');
}

export function closeDb(): void {
  if (!db) {
    return;
  }

  db.close();
  db = null;
}
