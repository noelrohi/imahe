export const IPC_CHANNELS = {
  sidecarGetBaseUrl: 'sidecar:get-base-url',
  shellOpenExternal: 'shell:open-external',
  storeAssetsUpsert: 'store:assets:upsert',
  storeAssetsSetFavorite: 'store:assets:set-favorite',
  storeAssetsGet: 'store:assets:get',
  storeAssetsGetChildren: 'store:assets:get-children',
  storeCollectionsCreate: 'store:collections:create',
  storeCollectionsList: 'store:collections:list',
  storeCollectionsAddAsset: 'store:collections:add-asset',
  storeCollectionsRemoveAsset: 'store:collections:remove-asset',
  storeCollectionsListAssets: 'store:collections:list-assets',
} as const;

export type SidecarBaseUrl = string | null;

export type AssetRecord = {
  id: string;
  parentId: string | null;
  favorite: boolean;
  createdAt: number;
};

export type UpsertAssetPayload = {
  id: string;
  parentId?: string | null;
  createdAt: number;
};

export type CollectionRecord = {
  id: string;
  name: string;
  createdAt: number;
};

export type ImaheStoreApi = {
  assets: {
    upsert: (asset: UpsertAssetPayload) => Promise<AssetRecord>;
    setFavorite: (id: string, favorite: boolean) => Promise<AssetRecord>;
    get: (id: string) => Promise<AssetRecord | null>;
    getChildren: (parentId: string) => Promise<AssetRecord[]>;
  };
  collections: {
    create: (name: string) => Promise<CollectionRecord>;
    list: () => Promise<CollectionRecord[]>;
    addAsset: (collectionId: string, assetId: string) => Promise<void>;
    removeAsset: (collectionId: string, assetId: string) => Promise<void>;
    listAssets: (collectionId: string) => Promise<AssetRecord[]>;
  };
};

export type ImaheApi = {
  getSidecarBaseUrl: () => Promise<SidecarBaseUrl>;
  openExternal: (url: string) => Promise<void>;
  store: ImaheStoreApi;
};
