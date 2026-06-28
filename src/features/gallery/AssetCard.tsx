import type { HistoryItem } from '@/lib/ima2/schemas';

import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCreatedAt, getAssetTitle, isVideoAsset } from './assetMetadata';
import { useAssetUrl } from './useAssetUrl';

type AssetCardProps = {
  asset: HistoryItem;
  onOpen: (asset: HistoryItem) => void;
};

export function AssetCard({ asset, onOpen }: AssetCardProps) {
  const title = getAssetTitle(asset);
  const previewUrl = useAssetUrl(asset.thumb ?? asset.url);

  return (
    <button
      type="button"
      aria-label={`Open asset ${title}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-left text-card-foreground shadow-sm transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={() => onOpen(asset)}
    >
      <AspectRatio ratio={1} className="overflow-hidden bg-muted">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={title}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <Skeleton className="size-full rounded-none" />
        )}
        {isVideoAsset(asset) ? (
          <span className="absolute right-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            Video
          </span>
        ) : null}
      </AspectRatio>
      <span className="flex min-w-0 flex-col gap-1 p-3">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{asset.filename}</span>
        <span className="text-xs text-muted-foreground">
          {formatCreatedAt(asset.createdAt)}
        </span>
      </span>
    </button>
  );
}
