import { randomUUID } from 'node:crypto';

import type { AssetRecord, CollectionRecord } from '../../shared/ipc';

import { getDb, type ImaheDatabase } from './db';
import { mapAssetRow, type AssetRow } from './assets';

type CollectionRow = {
  id: string;
  name: string;
  created_at: number;
};

export function createCollection(
  name: string,
  db: ImaheDatabase = getDb(),
): CollectionRecord {
  const collection: CollectionRecord = {
    id: randomUUID(),
    name,
    createdAt: Date.now(),
  };

  db.prepare<CollectionRecord>(`
    INSERT INTO collections (id, name, created_at)
    VALUES (@id, @name, @createdAt)
  `).run(collection);

  return collection;
}

export function listCollections(
  db: ImaheDatabase = getDb(),
): CollectionRecord[] {
  const rows = db
    .prepare<[], CollectionRow>(`
      SELECT id, name, created_at
      FROM collections
      ORDER BY created_at DESC, name ASC
    `)
    .all();

  return rows.map(mapCollectionRow);
}

export function addToCollection(
  collectionId: string,
  assetId: string,
  db: ImaheDatabase = getDb(),
): void {
  const addItem = db.transaction(() => {
    db.prepare<{
      id: string;
      createdAt: number;
    }>(`
      INSERT OR IGNORE INTO assets (id, created_at)
      VALUES (@id, @createdAt)
    `).run({ id: assetId, createdAt: Date.now() });

    db.prepare<{
      collectionId: string;
      assetId: string;
    }>(`
      INSERT OR IGNORE INTO collection_items (collection_id, asset_id)
      VALUES (@collectionId, @assetId)
    `).run({ collectionId, assetId });
  });

  addItem();
}

export function removeFromCollection(
  collectionId: string,
  assetId: string,
  db: ImaheDatabase = getDb(),
): void {
  db.prepare<{
    collectionId: string;
    assetId: string;
  }>(`
    DELETE FROM collection_items
    WHERE collection_id = @collectionId AND asset_id = @assetId
  `).run({ collectionId, assetId });
}

export function listAssetsInCollection(
  collectionId: string,
  db: ImaheDatabase = getDb(),
): AssetRecord[] {
  const rows = db
    .prepare<[string], AssetRow>(`
      SELECT assets.id, assets.parent_id, assets.favorite, assets.created_at
      FROM assets
      INNER JOIN collection_items ON collection_items.asset_id = assets.id
      WHERE collection_items.collection_id = ?
      ORDER BY assets.created_at DESC, assets.id ASC
    `)
    .all(collectionId);

  return rows.map(mapAssetRow);
}

function mapCollectionRow(row: CollectionRow): CollectionRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}
