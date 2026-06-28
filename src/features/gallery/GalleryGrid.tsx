import { useMemo, useState } from 'react';

import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { StarIcon } from '@phosphor-icons/react';

import { ima2Client } from '@/lib/ima2/client';
import type {
  DeleteAssetResponse,
  HistoryItem,
  HistoryResponse,
} from '@/lib/ima2/schemas';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { AssetCard } from './AssetCard';
import { AssetDetailDialog } from './AssetDetailDialog';
import { historyQueryKey, useHistory } from './useHistory';

type GalleryGridProps = {
  pageSize?: number;
};

type DeleteMutationContext = {
  previousHistory: Array<[QueryKey, InfiniteData<HistoryResponse> | undefined]>;
};

type DeletedAssetNotice = {
  filename: string;
  response: DeleteAssetResponse;
};

export function GalleryGrid({ pageSize = 24 }: GalleryGridProps) {
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState<HistoryItem | null>(null);
  const [deletedAsset, setDeletedAsset] = useState<DeletedAssetNotice | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const historyQuery = useHistory({ favoritesOnly, limit: pageSize });

  const assets = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );

  const restoreMutation = useMutation({
    mutationFn: ({ filename, trashId }: { filename: string; trashId: string }) =>
      ima2Client.restoreAsset(filename, trashId),
    onSuccess: () => {
      setDeletedAsset(null);
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
  });

  const deleteMutation = useMutation<
    DeleteAssetResponse,
    Error,
    HistoryItem,
    DeleteMutationContext
  >({
    mutationFn: (asset) => ima2Client.deleteAsset(asset.filename),
    onMutate: async (asset) => {
      await queryClient.cancelQueries({ queryKey: historyQueryKey });
      const previousHistory = queryClient.getQueriesData<InfiniteData<HistoryResponse>>({
        queryKey: historyQueryKey,
      });

      queryClient.setQueriesData<InfiniteData<HistoryResponse>>(
        { queryKey: historyQueryKey },
        (current) => removeAssetFromHistory(current, asset.filename),
      );

      return { previousHistory };
    },
    onError: (_error, _asset, context) => {
      context?.previousHistory.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: (response, asset) => {
      setDeletedAsset({ filename: asset.filename, response });
      setSelectedAsset(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
  });

  const restoreTrashId = deletedAsset ? getRestoreTrashId(deletedAsset.response) : null;

  if (historyQuery.isPending) {
    return (
      <section className="flex flex-col gap-6 p-4">
        <GalleryHeader
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
        />
        <GallerySkeletonGrid />
      </section>
    );
  }

  if (historyQuery.isError) {
    return (
      <section className="flex flex-col gap-6 p-4">
        <GalleryHeader
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
        />
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <h2 className="text-lg font-semibold">Gallery could not load</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {getErrorMessage(historyQuery.error)}
          </p>
          <Button type="button" variant="outline" onClick={() => void historyQuery.refetch()}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 p-4">
      <GalleryHeader
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
      />

      {deletedAsset ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border bg-card p-3 text-sm text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 truncate">Deleted {deletedAsset.filename}</span>
          {restoreTrashId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={restoreMutation.isPending}
              onClick={() =>
                restoreMutation.mutate({
                  filename: deletedAsset.filename,
                  trashId: restoreTrashId,
                })
              }
            >
              {restoreMutation.isPending ? 'Restoring…' : 'Undo'}
            </Button>
          ) : null}
          {restoreMutation.isError ? (
            <span role="alert" className="text-sm text-destructive">
              {getErrorMessage(restoreMutation.error)}
            </span>
          ) : null}
        </div>
      ) : null}

      {assets.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <h2 className="text-lg font-semibold">
            {favoritesOnly ? 'No favorites yet' : 'No assets yet'}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {favoritesOnly
              ? 'Favorite assets from the detail dialog to collect them here.'
              : 'Generated images will appear here after ima2 writes them to history.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {assets.map((asset) => (
            <AssetCard key={asset.filename} asset={asset} onOpen={setSelectedAsset} />
          ))}
        </div>
      )}

      {historyQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={historyQuery.isFetchingNextPage}
            onClick={() => void historyQuery.fetchNextPage()}
          >
            {historyQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}

      <AssetDetailDialog
        asset={selectedAsset}
        open={selectedAsset !== null}
        historyItems={assets}
        onSelectAsset={setSelectedAsset}
        onOpenChange={(open) => {
          if (!open) {
            deleteMutation.reset();
            setSelectedAsset(null);
          }
        }}
        onAssetChange={setSelectedAsset}
        onDelete={(asset) => deleteMutation.mutate(asset)}
        isDeleting={deleteMutation.isPending}
        deleteError={deleteMutation.isError ? getErrorMessage(deleteMutation.error) : null}
      />
    </section>
  );
}

type GalleryHeaderProps = {
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (favoritesOnly: boolean) => void;
};

function GalleryHeader({ favoritesOnly, onFavoritesOnlyChange }: GalleryHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
        <p className="text-sm text-muted-foreground">
          Browse generated assets from your local ima2 history.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={favoritesOnly ? 'outline' : 'secondary'}
          onClick={() => onFavoritesOnlyChange(false)}
        >
          All
        </Button>
        <Button
          type="button"
          variant={favoritesOnly ? 'secondary' : 'outline'}
          aria-pressed={favoritesOnly}
          onClick={() => onFavoritesOnlyChange(true)}
        >
          <StarIcon data-icon="inline-start" />
          Favorites
        </Button>
      </div>
    </div>
  );
}

function GallerySkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          <Skeleton className="aspect-square w-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function removeAssetFromHistory(
  current: InfiniteData<HistoryResponse> | undefined,
  filename: string,
) {
  if (!current) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => {
      const items = page.items.filter((item) => item.filename !== filename);
      const removedCount = page.items.length - items.length;

      if (removedCount === 0) {
        return page;
      }

      return {
        ...page,
        items,
        total: Math.max(0, page.total - removedCount),
      };
    }),
  };
}

function getRestoreTrashId(response: DeleteAssetResponse) {
  if (response.undoableInApp !== true) {
    return null;
  }

  if (isNonEmptyString(response.trashId)) {
    return response.trashId;
  }

  if (isNonEmptyString(response.restoreToken)) {
    return response.restoreToken;
  }

  if (isRecord(response.trash)) {
    const trashId = response.trash.trashId ?? response.trash.id;

    if (isNonEmptyString(trashId)) {
      return trashId;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}
