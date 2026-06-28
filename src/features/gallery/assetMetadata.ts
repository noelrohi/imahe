import type { HistoryItem } from '@/lib/ima2/schemas';

export function getAssetTitle(asset: HistoryItem) {
  return asset.prompt || asset.filename;
}

export function formatCreatedAt(createdAt: HistoryItem['createdAt']) {
  if (createdAt === undefined || createdAt === null || createdAt === '') {
    return 'Unknown date';
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return String(createdAt);
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function isVideoAsset(asset: HistoryItem) {
  return asset.mediaType === 'video' || asset.url.toLowerCase().endsWith('.mp4');
}
