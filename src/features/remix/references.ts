import type { GenerationProvider } from '@/lib/ima2/schemas';
import { resolveAssetUrl } from '@/features/gallery/useAssetUrl';

export const DEFAULT_MAX_REFERENCES = 5;
export const GROK_MAX_INPUT_IMAGES = 3;

export type ReferenceProvider = GenerationProvider | 'codex';

export type ReferenceLimitOptions = {
  provider?: ReferenceProvider;
  existingInputImages?: number;
  maxReferences?: number;
};

export type AssetReferenceOptions = ReferenceLimitOptions & {
  fetchImpl?: typeof fetch;
  getBaseUrl?: () => Promise<string | null> | string | null;
  includeDataUrlPrefix?: boolean;
};

export async function assetUrlToBase64Reference(
  assetUrl: string | null | undefined,
  options: AssetReferenceOptions = {},
): Promise<string> {
  const resolvedUrl = await resolveReferenceUrl(assetUrl, options.getBaseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(resolvedUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch reference image (${response.status}).`);
  }

  const contentType = response.headers.get('Content-Type') ?? 'image/png';
  const base64 = arrayBufferToBase64(await response.arrayBuffer());

  return options.includeDataUrlPrefix ? `data:${contentType};base64,${base64}` : base64;
}

export async function assetUrlsToBase64References(
  assetUrls: Array<string | null | undefined>,
  options: AssetReferenceOptions = {},
): Promise<string[]> {
  assertReferenceLimit(assetUrls.length, options);

  const references = await Promise.all(
    assetUrls.map((assetUrl) => assetUrlToBase64Reference(assetUrl, options)),
  );

  assertReferenceLimit(references.length, options);
  return references;
}

export function assertReferenceLimit(
  referenceCount: number,
  options: ReferenceLimitOptions = {},
) {
  const existingInputImages = options.existingInputImages ?? 0;
  const totalInputImages = referenceCount + existingInputImages;
  const limit = options.maxReferences ?? getReferenceLimit(options.provider);

  if (totalInputImages > limit) {
    throw new Error(
      `Too many reference images: ${totalInputImages} provided, but ${providerLabel(
        options.provider,
      )} supports at most ${limit}.`,
    );
  }
}

export function getReferenceLimit(provider: ReferenceProvider | undefined) {
  return provider === 'grok' ? GROK_MAX_INPUT_IMAGES : DEFAULT_MAX_REFERENCES;
}

async function resolveReferenceUrl(
  assetUrl: string | null | undefined,
  getBaseUrl: AssetReferenceOptions['getBaseUrl'],
) {
  if (!assetUrl) {
    throw new Error('Asset URL is required to create a reference image.');
  }

  const needsSidecarBaseUrl = assetUrl.startsWith('/') && !isAbsoluteHttpUrl(assetUrl);
  const sidecarBaseUrl = needsSidecarBaseUrl
    ? await Promise.resolve((getBaseUrl ?? defaultGetBaseUrl)())
    : null;
  const resolvedUrl = resolveAssetUrl(assetUrl, sidecarBaseUrl);

  if (!resolvedUrl) {
    throw new Error('Could not resolve asset URL for reference image.');
  }

  return resolvedUrl;
}

function defaultGetBaseUrl() {
  return window.imahe.getSidecarBaseUrl();
}

function isAbsoluteHttpUrl(assetUrl: string) {
  return assetUrl.startsWith('http://') || assetUrl.startsWith('https://');
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function providerLabel(provider: ReferenceProvider | undefined) {
  return provider === 'grok' ? 'Grok' : 'this provider';
}
