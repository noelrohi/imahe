import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  FolderPlusIcon,
  GitBranchIcon,
  ImagesSquareIcon,
  SparkleIcon,
  StarIcon,
} from '@phosphor-icons/react';

import {
  useAddAssetToCollectionMutation,
  useCollections,
} from '@/features/collections/hooks';
import { CanvasEditorDialog } from '@/features/canvas/CanvasEditorDialog';
import { useGenerate, type UiGenerationProvider } from '@/features/generate/hooks';
import { assetUrlsToBase64References } from '@/features/remix/references';
import {
  apiProviderToUiProvider,
  lineageQueryKeys,
  useRemix,
} from '@/features/remix/useRemix';
import { ima2Client } from '@/lib/ima2/client';
import type {
  FavoriteResponse,
  HistoryItem,
  HistoryResponse,
} from '@/lib/ima2/schemas';
import type { AssetRecord } from '@/shared/ipc';

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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCreatedAt, getAssetTitle, isVideoAsset } from './assetMetadata';
import { useAssetUrl } from './useAssetUrl';
import { historyQueryKey } from './useHistory';

const DEFAULT_IMAGE_SIZE = '1024x1024';
const DEFAULT_VARIANT_COUNT = 3;

const DEFAULT_MODEL_BY_PROVIDER: Record<UiGenerationProvider, string> = {
  codex: 'gpt-5.4-mini',
  grok: 'grok-imagine-image',
};

type AssetDetailDialogProps = {
  asset: HistoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetChange?: (asset: HistoryItem) => void;
  onDelete?: (asset: HistoryItem) => void;
  onSelectAsset?: (asset: HistoryItem) => void;
  historyItems?: HistoryItem[];
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
  onSelectAsset,
  historyItems = [],
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
  const remixMutation = useRemix();
  const variantsMutation = useGenerate();
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [actionPrompt, setActionPrompt] = useState('');
  const [localActionError, setLocalActionError] = useState<string | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const assetFilename = asset?.filename ?? '';

  const assetRecordQuery = useQuery({
    queryKey: lineageQueryKeys.asset(assetFilename),
    queryFn: () => window.imahe.store.assets.get(assetFilename),
    enabled: open && assetFilename.length > 0,
  });
  const childrenQuery = useQuery({
    queryKey: lineageQueryKeys.children(assetFilename),
    queryFn: () => window.imahe.store.assets.getChildren(assetFilename),
    enabled: open && assetFilename.length > 0,
  });

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
    setActionPrompt(asset?.prompt ?? '');
    setLocalActionError(null);
  }, [asset?.filename, asset?.prompt]);

  useEffect(() => {
    if (!open) {
      setCanvasOpen(false);
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

  const historyByFilename = useMemo(() => {
    const nextHistoryByFilename = new Map<string, HistoryItem>();

    for (const item of historyItems) {
      nextHistoryByFilename.set(item.filename, item);
    }

    if (asset) {
      nextHistoryByFilename.set(asset.filename, asset);
    }

    return nextHistoryByFilename;
  }, [asset, historyItems]);

  if (!asset) {
    return null;
  }

  const title = getAssetTitle(asset);
  const assetIsVideo = isVideoAsset(asset);
  const canvasUnavailable = assetIsVideo || !fullAssetUrl;
  const sourceProvider = apiProviderToUiProvider(asset.provider);
  const sourceModel = asset.model ?? DEFAULT_MODEL_BY_PROVIDER[sourceProvider];
  const actionPromptBlank = actionPrompt.trim().length === 0;
  const actionDisabled = actionPromptBlank || remixMutation.isPending || variantsMutation.isPending;
  const currentRecord = assetRecordQuery.data ?? null;
  const children = childrenQuery.data ?? [];
  const parentId = currentRecord?.parentId ?? null;
  const isFavorite = asset.isFavorite === true;
  const canAddToCollection = selectedCollectionId.length > 0;
  const actionErrorMessage =
    localActionError ??
    (remixMutation.error ? getErrorMessage(remixMutation.error) : null) ??
    (variantsMutation.error ? getErrorMessage(variantsMutation.error) : null);
  const selectLineageAsset = onSelectAsset ?? onAssetChange;

  const handleRemix = () => {
    if (actionDisabled) {
      return;
    }

    setLocalActionError(null);

    void remixMutation
      .mutateAsync({
        source: asset,
        prompt: actionPrompt,
        provider: sourceProvider,
        model: sourceModel,
        size: DEFAULT_IMAGE_SIZE,
        quality: 'medium',
        format: 'png',
        moderation: 'low',
      })
      .catch((error) => setLocalActionError(getErrorMessage(error)));
  };

  const handleMakeVariants = () => {
    if (actionDisabled) {
      return;
    }

    setLocalActionError(null);

    void createVariantsFromSource({
      asset,
      prompt: actionPrompt,
      provider: sourceProvider,
      model: sourceModel,
      mutateAsync: variantsMutation.mutateAsync,
    }).catch((error) => setLocalActionError(getErrorMessage(error)));
  };

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
            <div className="grid min-h-full gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex min-h-[24rem] items-center justify-center rounded-lg bg-background p-2">
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

              <LineagePanel
                parentId={parentId}
                children={children}
                historyByFilename={historyByFilename}
                isLoading={assetRecordQuery.isPending || childrenQuery.isPending}
                onSelectAsset={selectLineageAsset}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t p-4">
            <form
              aria-label="Create from this image"
              className="flex flex-col gap-3"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">Create from this image</h2>
                <p className="text-xs text-muted-foreground">
                  Remix uses this asset as externalSrc; variants attach it as a reference.
                </p>
              </div>
              <InputGroup className="h-auto items-stretch overflow-hidden bg-background">
                <InputGroupTextarea
                  aria-label="Remix prompt"
                  className="min-h-20 px-3 py-2"
                  placeholder="Describe how to transform or vary this image…"
                  value={actionPrompt}
                  onChange={(event) => setActionPrompt(event.target.value)}
                />
                <InputGroupAddon
                  align="block-end"
                  className="flex-wrap justify-between gap-2 border-t bg-muted/20"
                >
                  <span className="text-xs text-muted-foreground">
                    {sourceProvider === 'grok' ? 'Grok' : 'Codex/OpenAI'} · {sourceModel}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <InputGroupButton
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actionDisabled}
                      onClick={handleMakeVariants}
                    >
                      <ImagesSquareIcon data-icon="inline-start" />
                      {variantsMutation.isPending ? 'Making variants…' : 'Make variants'}
                    </InputGroupButton>
                    <InputGroupButton
                      type="button"
                      size="sm"
                      disabled={actionDisabled}
                      onClick={handleRemix}
                    >
                      <SparkleIcon data-icon="inline-start" />
                      {remixMutation.isPending ? 'Remixing…' : 'Remix'}
                    </InputGroupButton>
                  </div>
                </InputGroupAddon>
              </InputGroup>
              {actionErrorMessage ? (
                <p role="alert" className="text-sm text-destructive">
                  {actionErrorMessage}
                </p>
              ) : null}
            </form>

            <Separator />

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

          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-background sm:justify-between">
            <div className="flex flex-wrap gap-2">
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
            </div>
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

type CreateVariantsInput = {
  asset: HistoryItem;
  prompt: string;
  provider: UiGenerationProvider;
  model: string;
  mutateAsync: ReturnType<typeof useGenerate>['mutateAsync'];
};

async function createVariantsFromSource({
  asset,
  prompt,
  provider,
  model,
  mutateAsync,
}: CreateVariantsInput) {
  const references = await assetUrlsToBase64References([asset.url], {
    provider,
    getBaseUrl: () => window.imahe.getSidecarBaseUrl(),
  });

  await mutateAsync({
    prompt,
    provider,
    model,
    count: DEFAULT_VARIANT_COUNT,
    size: DEFAULT_IMAGE_SIZE,
    quality: 'medium',
    format: 'png',
    moderation: 'low',
    references,
  });
}

type LineagePanelProps = {
  parentId: string | null;
  children: AssetRecord[];
  historyByFilename: Map<string, HistoryItem>;
  isLoading: boolean;
  onSelectAsset?: (asset: HistoryItem) => void;
};

function LineagePanel({
  parentId,
  children,
  historyByFilename,
  isLoading,
  onSelectAsset,
}: LineagePanelProps) {
  const parentEntries = parentId
    ? [{ id: parentId, asset: historyByFilename.get(parentId) ?? null }]
    : [];
  const childEntries = children.map((child) => ({
    id: child.id,
    asset: historyByFilename.get(child.id) ?? null,
  }));

  return (
    <aside className="flex min-h-0 flex-col gap-4 rounded-lg border bg-background p-3">
      <div className="flex items-start gap-2">
        <GitBranchIcon className="mt-0.5 text-muted-foreground" data-icon="inline-start" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Lineage</h2>
          <p className="text-xs text-muted-foreground">
            Parent and remixes recorded in the local imahe store.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-4 overflow-auto">
          <LineageList
            title="Parent"
            emptyText="No parent recorded."
            entries={parentEntries}
            onSelectAsset={onSelectAsset}
          />
          <Separator />
          <LineageList
            title={`Remixes (${childEntries.length})`}
            emptyText="No remixes yet."
            entries={childEntries}
            onSelectAsset={onSelectAsset}
          />
        </div>
      )}
    </aside>
  );
}

type LineageEntry = {
  id: string;
  asset: HistoryItem | null;
};

type LineageListProps = {
  title: string;
  emptyText: string;
  entries: LineageEntry[];
  onSelectAsset?: (asset: HistoryItem) => void;
};

function LineageList({ title, emptyText, entries, onSelectAsset }: LineageListProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <LineageAssetItem
              key={entry.id}
              entry={entry}
              onSelectAsset={onSelectAsset}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type LineageAssetItemProps = {
  entry: LineageEntry;
  onSelectAsset?: (asset: HistoryItem) => void;
};

function LineageAssetItem({ entry, onSelectAsset }: LineageAssetItemProps) {
  const assetUrl = useAssetUrl(entry.asset?.thumb ?? entry.asset?.url);

  if (!entry.asset) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
        <div className="flex size-12 items-center justify-center rounded bg-muted">
          Missing
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Missing asset</p>
          <p className="truncate">{entry.id}</p>
        </div>
      </div>
    );
  }

  const title = getAssetTitle(entry.asset);

  return (
    <button
      type="button"
      className="flex min-w-0 items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
      disabled={!onSelectAsset}
      onClick={() => onSelectAsset?.(entry.asset as HistoryItem)}
    >
      {assetUrl ? (
        <img
          src={assetUrl}
          alt={title}
          className="size-12 rounded object-cover"
        />
      ) : (
        <Skeleton className="size-12" />
      )}
      <div className="min-w-0 text-xs">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-muted-foreground">{entry.asset.filename}</p>
        <p className="truncate text-muted-foreground">
          {formatCreatedAt(entry.asset.createdAt)}
        </p>
      </div>
    </button>
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
