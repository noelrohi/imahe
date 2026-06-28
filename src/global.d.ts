import type { ImaheApi } from './shared/ipc';

declare global {
  interface Window {
    imahe: ImaheApi;
  }
}

export {};
