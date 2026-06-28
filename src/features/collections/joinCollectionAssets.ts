import type { HistoryItem } from '@/lib/ima2/schemas';
import type { AssetRecord } from '@/shared/ipc';

export type JoinedCollectionAsset = {
  assetRecord: AssetRecord;
  asset: HistoryItem;
};

export type JoinedCollectionAssets = {
  items: JoinedCollectionAsset[];
  missing: AssetRecord[];
};

export function joinCollectionAssets(
  assetRecords: AssetRecord[],
  historyItems: HistoryItem[],
): JoinedCollectionAssets {
  const historyByFilename = new Map(
    historyItems.map((historyItem) => [historyItem.filename, historyItem]),
  );

  return assetRecords.reduce<JoinedCollectionAssets>(
    (joinedAssets, assetRecord) => {
      const historyItem = historyByFilename.get(assetRecord.id);

      if (historyItem) {
        joinedAssets.items.push({ assetRecord, asset: historyItem });
      } else {
        joinedAssets.missing.push(assetRecord);
      }

      return joinedAssets;
    },
    { items: [], missing: [] },
  );
}
