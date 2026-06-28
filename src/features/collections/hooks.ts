import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AssetRecord, CollectionRecord } from '@/shared/ipc';

export const collectionsQueryKey = ['collections'] as const;

export function collectionAssetsQueryKey(collectionId: string) {
  return [...collectionsQueryKey, 'assets', collectionId] as const;
}

export type UseCollectionsOptions = {
  enabled?: boolean;
};

export function useCollections({ enabled = true }: UseCollectionsOptions = {}) {
  return useQuery({
    queryKey: collectionsQueryKey,
    queryFn: () => window.imahe.store.collections.list(),
    enabled,
  });
}

export function useCollectionAssets(collectionId: string | null | undefined) {
  return useQuery({
    queryKey: collectionAssetsQueryKey(collectionId ?? 'none'),
    queryFn: () => window.imahe.store.collections.listAssets(collectionId ?? ''),
    enabled: Boolean(collectionId),
  });
}

export function useCollectionAssetCounts(collections: CollectionRecord[]) {
  return useQueries({
    queries: collections.map((collection) => ({
      queryKey: collectionAssetsQueryKey(collection.id),
      queryFn: () => window.imahe.store.collections.listAssets(collection.id),
      select: (assets: AssetRecord[]) => assets.length,
    })),
  });
}

export function useCreateCollectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => window.imahe.store.collections.create(name.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionsQueryKey });
    },
  });
}

export type CollectionAssetMutationVariables = {
  collectionId: string;
  assetId: string;
};

export function useAddAssetToCollectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, assetId }: CollectionAssetMutationVariables) =>
      window.imahe.store.collections.addAsset(collectionId, assetId),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: collectionAssetsQueryKey(variables.collectionId),
      });
    },
  });
}

export function useRemoveAssetFromCollectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, assetId }: CollectionAssetMutationVariables) =>
      window.imahe.store.collections.removeAsset(collectionId, assetId),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: collectionAssetsQueryKey(variables.collectionId),
      });
    },
  });
}
