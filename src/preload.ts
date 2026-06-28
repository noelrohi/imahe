import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS, type ImaheApi } from './shared/ipc';

const imaheApi: ImaheApi = {
  getSidecarBaseUrl: () => ipcRenderer.invoke(IPC_CHANNELS.sidecarGetBaseUrl),
};

contextBridge.exposeInMainWorld('imahe', imaheApi);
