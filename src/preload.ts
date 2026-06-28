import { contextBridge, ipcRenderer } from 'electron';

import {
  IPC_CHANNELS,
  type AssetRecord,
  type CollectionRecord,
  type ImaheApi,
  type SidecarBaseUrl,
  type UpsertAssetPayload,
} from './shared/ipc';

const imaheApi: ImaheApi = {
  getSidecarBaseUrl: () =>
    ipcRenderer.invoke(IPC_CHANNELS.sidecarGetBaseUrl) as Promise<SidecarBaseUrl>,
  openExternal: (url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.shellOpenExternal, url) as Promise<void>,
  store: {
    assets: {
      upsert: (asset: UpsertAssetPayload) =>
        ipcRenderer.invoke(IPC_CHANNELS.storeAssetsUpsert, asset) as Promise<AssetRecord>,
      setFavorite: (id: string, favorite: boolean) =>
        ipcRenderer.invoke(IPC_CHANNELS.storeAssetsSetFavorite, id, favorite) as Promise<AssetRecord>,
      get: (id: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.storeAssetsGet, id) as Promise<AssetRecord | null>,
      getChildren: (parentId: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.storeAssetsGetChildren, parentId) as Promise<AssetRecord[]>,
    },
    collections: {
      create: (name: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.storeCollectionsCreate, name) as Promise<CollectionRecord>,
      list: () =>
        ipcRenderer.invoke(IPC_CHANNELS.storeCollectionsList) as Promise<CollectionRecord[]>,
      addAsset: (collectionId: string, assetId: string) =>
        ipcRenderer.invoke(
          IPC_CHANNELS.storeCollectionsAddAsset,
          collectionId,
          assetId,
        ) as Promise<void>,
      removeAsset: (collectionId: string, assetId: string) =>
        ipcRenderer.invoke(
          IPC_CHANNELS.storeCollectionsRemoveAsset,
          collectionId,
          assetId,
        ) as Promise<void>,
      listAssets: (collectionId: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.storeCollectionsListAssets, collectionId) as Promise<AssetRecord[]>,
    },
  },
};

contextBridge.exposeInMainWorld('imahe', imaheApi);
