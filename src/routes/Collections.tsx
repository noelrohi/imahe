import { useEffect, useMemo, useState } from 'react';

import { FolderIcon, ImageBrokenIcon, PlusIcon } from '@phosphor-icons/react';

import {
  useAddAssetToCollectionMutation,
  useCollectionAssetCounts,
  useCollectionAssets,
  useCollections,
  useCreateCollectionMutation,
  useRemoveAssetFromCollectionMutation,
} from '@/features/collections/hooks';
import { joinCollectionAssets } from '@/features/collections/joinCollectionAssets';
import { AssetCard } from '@/features/gallery/AssetCard';
import { AssetDetailDialog } from '@/features/gallery/AssetDetailDialog';
import { formatCreatedAt } from '@/features/gallery/assetMetadata';
import { useHistory } from '@/features/gallery/useHistory';
import type { HistoryItem } from '@/lib/ima2/schemas';
import { cn } from '@/lib/utils';
import type { AssetRecord, CollectionRecord } from '@/shared/ipc';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function Collections() {
  const collectionsQuery = useCollections();
  const collections = collectionsQuery.data ?? [];
  const countQueries = useCollectionAssetCounts(collections);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  useEffect(() => {
    if (collections.length === 0) {
      if (selectedCollectionId !== null) {
        setSelectedCollectionId(null);
      }

      return;
    }

    if (!selectedCollectionId || !collections.some((item) => item.id === selectedCollectionId)) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  const selectedCollection =
    collections.find((collection) => collection.id === selectedCollectionId) ?? null;

  return (
    <section className="flex flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
        <p className="text-sm text-muted-foreground">
          Organize local ima2 assets without changing their generated history.
        </p>
      </div>

      <CreateCollectionCard
        onCreated={(collection) => setSelectedCollectionId(collection.id)}
      />

      {collectionsQuery.isPending ? (
        <CollectionsSkeleton />
      ) : collectionsQuery.isError ? (
        <ErrorCard
          title="Collections could not load"
          message={getErrorMessage(collectionsQuery.error)}
          onRetry={() => void collectionsQuery.refetch()}
        />
      ) : collections.length === 0 ? (
        <EmptyCollections />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
          <CollectionList
            collections={collections}
            countQueries={countQueries}
            selectedCollectionId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
          />
          <CollectionDetail collection={selectedCollection} />
        </div>
      )}
    </section>
  );
}

type CreateCollectionCardProps = {
  onCreated: (collection: CollectionRecord) => void;
};

function CreateCollectionCard({ onCreated }: CreateCollectionCardProps) {
  const [name, setName] = useState('');
  const createCollection = useCreateCollectionMutation();
  const trimmedName = name.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>New collection</CardTitle>
        <CardDescription>Create a local grouping for generated assets.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();

            if (!trimmedName) {
              return;
            }

            createCollection.mutate(trimmedName, {
              onSuccess: (collection) => {
                setName('');
                onCreated(collection);
              },
            });
          }}
        >
          <Input
            aria-label="Collection name"
            placeholder="Reference shots"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={!trimmedName || createCollection.isPending}>
            <PlusIcon data-icon="inline-start" />
            {createCollection.isPending ? 'Creating…' : 'Create'}
          </Button>
        </form>
        {createCollection.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {getErrorMessage(createCollection.error)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

type CollectionListProps = {
  collections: CollectionRecord[];
  countQueries: ReturnType<typeof useCollectionAssetCounts>;
  selectedCollectionId: string | null;
  onSelect: (collectionId: string) => void;
};

function CollectionList({
  collections,
  countQueries,
  selectedCollectionId,
  onSelect,
}: CollectionListProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>All collections</CardTitle>
        <CardDescription>{collections.length} saved locally</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {collections.map((collection, index) => {
          const countQuery = countQueries[index];
          const count = countQuery?.data;
          const isActive = collection.id === selectedCollectionId;

          return (
            <button
              type="button"
              key={collection.id}
              aria-pressed={isActive}
              className={cn(
                'flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                isActive ? 'bg-muted text-foreground' : 'bg-background text-foreground',
              )}
              onClick={() => onSelect(collection.id)}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FolderIcon aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {collection.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatCreatedAt(collection.createdAt)}
                  </span>
                </span>
              </span>
              <Badge variant="secondary">
                {countQuery?.isPending ? '…' : `${count ?? 0}`}
              </Badge>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

type CollectionDetailProps = {
  collection: CollectionRecord | null;
};

function CollectionDetail({ collection }: CollectionDetailProps) {
  const collectionAssetsQuery = useCollectionAssets(collection?.id);
  const historyQuery = useHistory({ limit: 100 });
  const addAssetMutation = useAddAssetToCollectionMutation();
  const removeAssetMutation = useRemoveAssetFromCollectionMutation();
  const [selectedAsset, setSelectedAsset] = useState<HistoryItem | null>(null);

  useEffect(() => {
    setSelectedAsset(null);
  }, [collection?.id]);

  const historyItems = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );

  const assetRecords = collectionAssetsQuery.data ?? [];
  const joinedAssets = useMemo(
    () => joinCollectionAssets(assetRecords, historyItems),
    [assetRecords, historyItems],
  );

  if (!collection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a collection</CardTitle>
          <CardDescription>Choose a collection to inspect its assets.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isLoadingAssets = collectionAssetsQuery.isPending || historyQuery.isPending;
  const hasAssets = assetRecords.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{collection.name}</CardTitle>
        <CardDescription>
          {assetRecords.length} {assetRecords.length === 1 ? 'asset' : 'assets'} in this
          collection
        </CardDescription>
        <CardAction>
          <Badge variant="outline">Local</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AddAssetByFilenameForm
          isPending={addAssetMutation.isPending}
          error={addAssetMutation.error}
          onAdd={(assetId) =>
            addAssetMutation.mutate({ collectionId: collection.id, assetId })
          }
        />

        {collectionAssetsQuery.isError ? (
          <ErrorCard
            title="Collection assets could not load"
            message={getErrorMessage(collectionAssetsQuery.error)}
            onRetry={() => void collectionAssetsQuery.refetch()}
          />
        ) : historyQuery.isError ? (
          <ErrorCard
            title="History could not load"
            message={getErrorMessage(historyQuery.error)}
            onRetry={() => void historyQuery.refetch()}
          />
        ) : isLoadingAssets ? (
          <CollectionAssetSkeleton />
        ) : !hasAssets ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-8 text-center">
            <FolderIcon aria-hidden="true" />
            <h2 className="text-lg font-semibold">This collection is empty</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Add a filename from ima2 history, or use the asset detail dialog from the gallery.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {joinedAssets.items.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {joinedAssets.items.map(({ asset }) => (
                  <AssetCard key={asset.filename} asset={asset} onOpen={setSelectedAsset} />
                ))}
              </div>
            ) : null}

            {joinedAssets.missing.length > 0 ? (
              <MissingAssetsList
                assets={joinedAssets.missing}
                isRemoving={removeAssetMutation.isPending}
                onRemove={(assetId) =>
                  removeAssetMutation.mutate({ collectionId: collection.id, assetId })
                }
              />
            ) : null}

            {joinedAssets.missing.length > 0 && historyQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={historyQuery.isFetchingNextPage}
                  onClick={() => void historyQuery.fetchNextPage()}
                >
                  {historyQuery.isFetchingNextPage
                    ? 'Searching history…'
                    : 'Load more history'}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
      {removeAssetMutation.isError ? (
        <CardFooter>
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(removeAssetMutation.error)}
          </p>
        </CardFooter>
      ) : null}
      <AssetDetailDialog
        asset={selectedAsset}
        open={selectedAsset !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAsset(null);
          }
        }}
        onAssetChange={setSelectedAsset}
        activeCollectionName={collection.name}
        onRemoveFromCollection={(asset) =>
          removeAssetMutation.mutate(
            { collectionId: collection.id, assetId: asset.filename },
            {
              onSuccess: () => setSelectedAsset(null),
            },
          )
        }
        isRemovingFromCollection={removeAssetMutation.isPending}
        removeFromCollectionError={
          removeAssetMutation.isError ? getErrorMessage(removeAssetMutation.error) : null
        }
      />
    </Card>
  );
}

type AddAssetByFilenameFormProps = {
  isPending: boolean;
  error: unknown;
  onAdd: (assetId: string) => void;
};

function AddAssetByFilenameForm({ isPending, error, onAdd }: AddAssetByFilenameFormProps) {
  const [assetId, setAssetId] = useState('');
  const trimmedAssetId = assetId.trim();

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();

        if (!trimmedAssetId) {
          return;
        }

        onAdd(trimmedAssetId);
        setAssetId('');
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Input
          aria-label="Asset filename"
          placeholder="generated/cat.png"
          value={assetId}
          onChange={(event) => setAssetId(event.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(error)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Asset ids are ima2 history filenames.
          </p>
        )}
      </div>
      <Button type="submit" variant="outline" disabled={!trimmedAssetId || isPending}>
        <PlusIcon data-icon="inline-start" />
        {isPending ? 'Adding…' : 'Add asset'}
      </Button>
    </form>
  );
}

type MissingAssetsListProps = {
  assets: AssetRecord[];
  isRemoving: boolean;
  onRemove: (assetId: string) => void;
};

function MissingAssetsList({ assets, isRemoving, onRemove }: MissingAssetsListProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ImageBrokenIcon aria-hidden="true" />
        Missing or unloaded history rows
      </div>
      <p className="text-sm text-muted-foreground">
        These collection ids do not match the loaded ima2 history rows yet. They may be
        deleted, or older than the loaded pages.
      </p>
      <div className="flex flex-col gap-2">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="flex flex-col gap-2 rounded-lg bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="min-w-0 truncate text-sm font-medium">{asset.id}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isRemoving}
              onClick={() => onRemove(asset.id)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyCollections() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-8 text-center">
      <FolderIcon aria-hidden="true" />
      <h2 className="text-lg font-semibold">No collections yet</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Create a collection to group generated images by project, moodboard, or client.
      </p>
    </div>
  );
}

type ErrorCardProps = {
  title: string;
  message: string;
  onRetry: () => void;
};

function ErrorCard({ title, message, onRetry }: ErrorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </CardFooter>
    </Card>
  );
}

function CollectionsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
      <CollectionAssetSkeleton />
    </div>
  );
}

function CollectionAssetSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, index) => (
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}
