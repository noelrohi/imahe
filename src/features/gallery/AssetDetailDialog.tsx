import { useEffect, useState, type ReactNode } from 'react';

import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { FolderPlusIcon, StarIcon } from 'lucide-react';

import {
  useAddAssetToCollectionMutation,
  useCollections,
} from '@/features/collections/hooks';
import { ima2Client } from '@/lib/ima2/client';
import type {
  FavoriteResponse,
  HistoryItem,
  HistoryResponse,
} from '@/lib/ima2/schemas';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCreatedAt, getAssetTitle, isVideoAsset } from './assetMetadata';
import { useAssetUrl } from './useAssetUrl';
import { historyQueryKey } from './useHistory';

type AssetDetailDialogProps = {
  asset: HistoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetChange?: (asset: HistoryItem) => void;
  onDelete?: (asset: HistoryItem) => void;
  isDeleting?: boolean;
  deleteError?: string | null;
  activeCollectionName?: string;
  onRemoveFromCollection?: (asset: HistoryItem) => void;
  isRemovingFromCollection?: boolean;
  removeFromCollectionError?: string | null;
};

type FavoriteMutationContext = {
  previousHistory: Array<[QueryKey, InfiniteData<HistoryResponse> | undefined]>;
  previousAsset: HistoryItem;
};

export function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
  onAssetChange,
  onDelete,
  isDeleting = false,
  deleteError = null,
  activeCollectionName,
  onRemoveFromCollection,
  isRemovingFromCollection = false,
  removeFromCollectionError = null,
}: AssetDetailDialogProps) {
  const fullAssetUrl = useAssetUrl(asset?.url);
  const queryClient = useQueryClient();
  const collectionsQuery = useCollections({ enabled: open && asset !== null });
  const addToCollectionMutation = useAddAssetToCollectionMutation();
  const [selectedCollectionId, setSelectedCollectionId] = useState('');

  const favoriteMutation = useMutation<
    FavoriteResponse,
    Error,
    HistoryItem,
    FavoriteMutationContext
  >({
    mutationFn: (targetAsset) => ima2Client.toggleFavorite(targetAsset.filename),
    onMutate: async (targetAsset) => {
      const nextFavorite = targetAsset.isFavorite !== true;
      const nextAsset = { ...targetAsset, isFavorite: nextFavorite };

      await queryClient.cancelQueries({ queryKey: historyQueryKey });
      const previousHistory = queryClient.getQueriesData<InfiniteData<HistoryResponse>>({
        queryKey: historyQueryKey,
      });

      queryClient.setQueriesData<InfiniteData<HistoryResponse>>(
        { queryKey: historyQueryKey },
        (current) => updateHistoryFavorite(current, targetAsset.filename, nextFavorite),
      );
      onAssetChange?.(nextAsset);

      return { previousHistory, previousAsset: targetAsset };
    },
    onError: (_error, _targetAsset, context) => {
      context?.previousHistory.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });

      if (context?.previousAsset) {
        onAssetChange?.(context.previousAsset);
      }
    },
    onSuccess: (response, targetAsset) => {
      const nextAsset = { ...targetAsset, isFavorite: response.isFavorite };

      queryClient.setQueriesData<InfiniteData<HistoryResponse>>(
        { queryKey: historyQueryKey },
        (current) => updateHistoryFavorite(current, targetAsset.filename, response.isFavorite),
      );
      onAssetChange?.(nextAsset);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
  });

  const collections = collectionsQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      setSelectedCollectionId('');
      return;
    }

    if (selectedCollectionId && !collections.some((item) => item.id === selectedCollectionId)) {
      setSelectedCollectionId('');
      return;
    }

    if (!selectedCollectionId && collections.length > 0) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, open, selectedCollectionId]);

  if (!asset) {
    return null;
  }

  const title = getAssetTitle(asset);
  const isFavorite = asset.isFavorite === true;
  const canAddToCollection = selectedCollectionId.length > 0;

  return (
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
              isVideoAsset(asset) ? (
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

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderPlusIcon aria-hidden="true" />
                Add to collection
              </div>
              {collectionsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading collections…</p>
              ) : collectionsQuery.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {getErrorMessage(collectionsQuery.error)}
                </p>
              ) : collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a collection first, then add this asset to it.
                </p>
              ) : (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();

                    if (!canAddToCollection) {
                      return;
                    }

                    addToCollectionMutation.mutate({
                      collectionId: selectedCollectionId,
                      assetId: asset.filename,
                    });
                  }}
                >
                  <Select
                    value={selectedCollectionId}
                    onValueChange={setSelectedCollectionId}
                    disabled={addToCollectionMutation.isPending}
                  >
                    <SelectTrigger aria-label="Collection" className="w-full sm:w-64">
                      <SelectValue placeholder="Choose collection" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {collections.map((collection) => (
                          <SelectItem key={collection.id} value={collection.id}>
                            {collection.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!canAddToCollection || addToCollectionMutation.isPending}
                  >
                    {addToCollectionMutation.isPending ? 'Adding…' : 'Add'}
                  </Button>
                </form>
              )}
              {addToCollectionMutation.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {getErrorMessage(addToCollectionMutation.error)}
                </p>
              ) : null}
              {removeFromCollectionError ? (
                <p role="alert" className="text-sm text-destructive">
                  {removeFromCollectionError}
                </p>
              ) : null}
            </div>

            {onRemoveFromCollection ? (
              <div className="flex flex-col justify-center gap-2 rounded-lg border bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground">
                  In {activeCollectionName ?? 'this collection'}
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isRemovingFromCollection}
                  onClick={() => onRemoveFromCollection(asset)}
                >
                  {isRemovingFromCollection ? 'Removing…' : 'Remove from collection'}
                </Button>
              </div>
            ) : null}
          </div>

          {favoriteMutation.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {getErrorMessage(favoriteMutation.error)}
            </p>
          ) : null}
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-background">
          <Button
            type="button"
            variant={isFavorite ? 'secondary' : 'outline'}
            aria-pressed={isFavorite}
            disabled={favoriteMutation.isPending}
            onClick={() => favoriteMutation.mutate(asset)}
          >
            <StarIcon data-icon="inline-start" />
            {favoriteMutation.isPending
              ? 'Saving…'
              : isFavorite
                ? 'Favorited'
                : 'Favorite'}
          </Button>
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(asset)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function updateHistoryFavorite(
  current: InfiniteData<HistoryResponse> | undefined,
  filename: string,
  isFavorite: boolean,
) {
  if (!current) {
    return current;
  }

  let changed = false;

  const pages = current.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => {
      if (item.filename !== filename) {
        return item;
      }

      changed = true;
      return { ...item, isFavorite };
    }),
  }));

  if (!changed) {
    return current;
  }

  return {
    ...current,
    pages,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}
