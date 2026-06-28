// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAsset, getChildren, setFavorite, upsertAsset } from './assets';
import {
  addToCollection,
  createCollection,
  listAssetsInCollection,
  listCollections,
  removeFromCollection,
} from './collections';
import { openDb, type ImaheDatabase } from './db';

type SqliteNameRow = {
  name: string;
};

describe('imahe store', () => {
  let db: ImaheDatabase;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('runs migrations and creates the v1 schema', () => {
    const tableNames = db
      .prepare<[], SqliteNameRow>(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name IN ('assets', 'collections', 'collection_items')
        ORDER BY name ASC
      `)
      .all()
      .map((row) => row.name);

    expect(tableNames).toEqual(['assets', 'collection_items', 'collections']);
  });

  it('creates and lists Collections', () => {
    const collection = createCollection('Reference Assets', db);

    expect(listCollections(db)).toEqual([collection]);
  });

  it('adds and removes Assets in a Collection idempotently', () => {
    const collection = createCollection('Remixes', db);

    upsertAsset({ id: 'asset-1', createdAt: 100 }, db);
    addToCollection(collection.id, 'asset-1', db);
    addToCollection(collection.id, 'asset-1', db);

    expect(listAssetsInCollection(collection.id, db)).toEqual([
      {
        id: 'asset-1',
        parentId: null,
        favorite: false,
        createdAt: 100,
      },
    ]);

    removeFromCollection(collection.id, 'asset-1', db);

    expect(listAssetsInCollection(collection.id, db)).toEqual([]);
  });

  it('toggles the Favorite flag for an Asset', () => {
    upsertAsset({ id: 'asset-2', createdAt: 200 }, db);

    expect(setFavorite('asset-2', true, db).favorite).toBe(true);
    expect(getAsset('asset-2', db)?.favorite).toBe(true);

    expect(setFavorite('asset-2', false, db).favorite).toBe(false);
    expect(getAsset('asset-2', db)?.favorite).toBe(false);
  });

  it('queries child Assets by lineage parent id', () => {
    upsertAsset({ id: 'parent-asset', createdAt: 100 }, db);
    upsertAsset({ id: 'child-asset', parentId: 'parent-asset', createdAt: 300 }, db);

    expect(getChildren('parent-asset', db)).toEqual([
      {
        id: 'child-asset',
        parentId: 'parent-asset',
        favorite: false,
        createdAt: 300,
      },
    ]);
  });
});
