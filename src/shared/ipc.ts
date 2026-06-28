export const IPC_CHANNELS = {
  sidecarGetBaseUrl: 'sidecar:get-base-url',
} as const;

export type SidecarBaseUrl = string | null;

export type ImaheApi = {
  getSidecarBaseUrl: () => Promise<SidecarBaseUrl>;
};
