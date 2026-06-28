export const CANVAS_INPAINT_PROVIDER = 'oauth' as const;

export const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

export const MAX_EDIT_MASK_BYTES = 16 * 1024 * 1024;

export const CANVAS_INPAINT_CONTRACT = {
  provider: CANVAS_INPAINT_PROVIDER,
  sourceImage:
    'Source image submitted to /api/edit must be PNG base64 or a data:image/png;base64 URL.',
  mask:
    'Mask submitted to /api/edit must be a PNG base64/data URL with an alpha channel and dimensions matching the source PNG.',
  maxMaskBytes: MAX_EDIT_MASK_BYTES,
} as const;

export type CanvasInpaintProvider = typeof CANVAS_INPAINT_PROVIDER;

export function isPngDataUrl(value: string): boolean {
  return value.startsWith(PNG_DATA_URL_PREFIX);
}
