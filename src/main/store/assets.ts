import type { AssetRecord } from '../../shared/ipc';

import { getDb, type ImaheDatabase } from './db';

export type UpsertAssetInput = {
  id: string;
  parentId?: string | null;
  createdAt: number;
};

export type AssetRow = {
  id: string;
  parent_id: string | null;
  favorite: 0 | 1;
  created_at: number;
};

export function upsertAsset(
  asset: UpsertAssetInput,
  db: ImaheDatabase = getDb(),
): AssetRecord {
  db.prepare<{
    id: string;
    parentId: string | null;
    createdAt: number;
  }>(`
    INSERT INTO assets (id, parent_id, created_at)
    VALUES (@id, @parentId, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      parent_id = excluded.parent_id,
      created_at = excluded.created_at
  `).run({
    id: asset.id,
    parentId: asset.parentId ?? null,
    createdAt: asset.createdAt,
  });

  const stored = getAsset(asset.id, db);

  if (!stored) {
    throw new Error(`Failed to upsert Asset ${asset.id}.`);
  }

  return stored;
}

export function setFavorite(
  id: string,
  favorite: boolean,
  db: ImaheDatabase = getDb(),
): AssetRecord {
  db.prepare<{
    id: string;
    favorite: number;
    createdAt: number;
  }>(`
    INSERT INTO assets (id, favorite, created_at)
    VALUES (@id, @favorite, @createdAt)
    ON CONFLICT(id) DO UPDATE SET favorite = excluded.favorite
  `).run({
    id,
    favorite: favorite ? 1 : 0,
    createdAt: Date.now(),
  });

  const stored = getAsset(id, db);

  if (!stored) {
    throw new Error(`Failed to set Favorite for Asset ${id}.`);
  }

  return stored;
}

export function getChildren(
  parentId: string,
  db: ImaheDatabase = getDb(),
): AssetRecord[] {
  const rows = db
    .prepare<[string], AssetRow>(`
      SELECT id, parent_id, favorite, created_at
      FROM assets
      WHERE parent_id = ?
      ORDER BY created_at DESC, id ASC
    `)
    .all(parentId);

  return rows.map(mapAssetRow);
}

export function getAsset(
  id: string,
  db: ImaheDatabase = getDb(),
): AssetRecord | null {
  const row = db
    .prepare<[string], AssetRow>(`
      SELECT id, parent_id, favorite, created_at
      FROM assets
      WHERE id = ?
    `)
    .get(id);

  return row ? mapAssetRow(row) : null;
}

export function mapAssetRow(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    favorite: row.favorite === 1,
    createdAt: row.created_at,
  };
}
