import { useEffect, useState, type ReactNode } from 'react';

import type { HistoryItem } from '@/lib/ima2/schemas';
import { CanvasEditorDialog } from '@/features/canvas/CanvasEditorDialog';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCreatedAt, getAssetTitle, isVideoAsset } from './assetMetadata';
import { useAssetUrl } from './useAssetUrl';

type AssetDetailDialogProps = {
  asset: HistoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (asset: HistoryItem) => void;
  isDeleting?: boolean;
  deleteError?: string | null;
};

export function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
  onDelete,
  isDeleting = false,
  deleteError = null,
}: AssetDetailDialogProps) {
  const fullAssetUrl = useAssetUrl(asset?.url);
  const [canvasOpen, setCanvasOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setCanvasOpen(false);
    }
  }, [open]);

  if (!asset) {
    return null;
  }

  const title = getAssetTitle(asset);
  const assetIsVideo = isVideoAsset(asset);
  const canvasUnavailable = assetIsVideo || !fullAssetUrl;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)]">
          <DialogHeader className="border-b p-4 pr-14">
            <DialogTitle className="truncate">{asset.filename}</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {asset.prompt || 'Generated asset details'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
            <div className="flex min-h-full items-center justify-center rounded-lg bg-background p-2">
              {fullAssetUrl ? (
                assetIsVideo ? (
                  <video
                    src={fullAssetUrl}
                    controls
                    className="max-h-[calc(100vh-14rem)] max-w-full rounded-md"
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <img
                    src={fullAssetUrl}
                    alt={title}
                    className="max-h-[calc(100vh-14rem)] max-w-full rounded-md object-contain"
                  />
                )
              ) : (
                <Skeleton className="h-[min(60vh,36rem)] w-full max-w-4xl" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t p-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <MetadataItem label="Created" value={formatCreatedAt(asset.createdAt)} />
              <MetadataItem label="Media" value={asset.mediaType ?? 'Unknown'} />
              <MetadataItem label="Provider" value={asset.provider} />
              <MetadataItem label="Model" value={asset.model} />
              <MetadataItem label="Session" value={asset.sessionId} />
              <MetadataItem label="Request" value={asset.requestId} />
              <MetadataItem label="Node" value={asset.nodeId} />
              <MetadataItem
                label="References"
                value={asset.refsCount === undefined ? null : String(asset.refsCount)}
              />
            </dl>

            {deleteError ? (
              <p role="alert" className="text-sm text-destructive">
                {deleteError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-background sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCanvasOpen(true)}
              disabled={canvasUnavailable}
              title={assetIsVideo ? 'Canvas inpaint is available for images only.' : undefined}
            >
              Edit in Canvas
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(asset)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {canvasOpen ? (
        <CanvasEditorDialog
          asset={asset}
          sourceUrl={fullAssetUrl}
          open={canvasOpen}
          onOpenChange={setCanvasOpen}
        />
      ) : null}
    </>
  );
}

type MetadataItemProps = {
  label: string;
  value: ReactNode;
};

function MetadataItem({ label, value }: MetadataItemProps) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}
