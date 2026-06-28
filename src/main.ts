import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { getBaseUrl, startSidecar, stopSidecar } from './main/sidecar';
import { getAsset, getChildren, setFavorite, upsertAsset } from './main/store/assets';
import {
  addToCollection,
  createCollection,
  listAssetsInCollection,
  listCollections,
  removeFromCollection,
} from './main/store/collections';
import { getDb } from './main/store/db';
import { IPC_CHANNELS, type UpsertAssetPayload } from './shared/ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

ipcMain.handle(IPC_CHANNELS.sidecarGetBaseUrl, () => getBaseUrl());
ipcMain.handle(IPC_CHANNELS.shellOpenExternal, (_event, url: unknown) => openExternalUrl(url));
ipcMain.handle(IPC_CHANNELS.storeAssetsUpsert, (_event, asset: UpsertAssetPayload) =>
  upsertAsset(asset),
);
ipcMain.handle(IPC_CHANNELS.storeAssetsSetFavorite, (_event, id: string, favorite: boolean) =>
  setFavorite(id, favorite),
);
ipcMain.handle(IPC_CHANNELS.storeAssetsGet, (_event, id: string) => getAsset(id));
ipcMain.handle(IPC_CHANNELS.storeAssetsGetChildren, (_event, parentId: string) =>
  getChildren(parentId),
);
ipcMain.handle(IPC_CHANNELS.storeCollectionsCreate, (_event, name: string) =>
  createCollection(name),
);
ipcMain.handle(IPC_CHANNELS.storeCollectionsList, () => listCollections());
ipcMain.handle(
  IPC_CHANNELS.storeCollectionsAddAsset,
  (_event, collectionId: string, assetId: string) => addToCollection(collectionId, assetId),
);
ipcMain.handle(
  IPC_CHANNELS.storeCollectionsRemoveAsset,
  (_event, collectionId: string, assetId: string) => removeFromCollection(collectionId, assetId),
);
ipcMain.handle(IPC_CHANNELS.storeCollectionsListAssets, (_event, collectionId: string) =>
  listAssetsInCollection(collectionId),
);

async function openExternalUrl(url: unknown): Promise<void> {
  if (typeof url !== 'string') {
    throw new Error('Only valid HTTPS URLs can be opened externally.');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Only valid HTTPS URLs can be opened externally.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs can be opened externally.');
  }

  await shell.openExternal(parsedUrl.toString());
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

const startApp = async () => {
  try {
    getDb();
  } catch (error) {
    console.error('Failed to initialize imahe store.', error);
  }

  try {
    await startSidecar();
  } catch (error) {
    console.error('Failed to start ima2 sidecar.', error);
  }

  createWindow();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  void startApp();
});

app.on('before-quit', () => {
  stopSidecar();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    void startApp();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
