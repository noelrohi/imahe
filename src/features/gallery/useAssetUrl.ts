import { useQuery } from '@tanstack/react-query';

export const sidecarBaseUrlQueryKey = ['sidecar-base-url'] as const;

export function useSidecarBaseUrl() {
  return useQuery({
    queryKey: sidecarBaseUrlQueryKey,
    queryFn: () => window.imahe.getSidecarBaseUrl(),
    staleTime: 30_000,
  });
}

export function resolveAssetUrl(
  assetUrl: string | null | undefined,
  sidecarBaseUrl: string | null | undefined,
) {
  if (!assetUrl) {
    return undefined;
  }

  if (isAbsoluteHttpUrl(assetUrl)) {
    return assetUrl;
  }

  if (assetUrl.startsWith('/') && sidecarBaseUrl) {
    return new URL(assetUrl, sidecarBaseUrl).toString();
  }

  return assetUrl;
}

export function useAssetUrl(assetUrl: string | null | undefined) {
  const shouldLoadSidecarBaseUrl = Boolean(
    assetUrl && !isAbsoluteHttpUrl(assetUrl) && assetUrl.startsWith('/'),
  );
  const { data: sidecarBaseUrl } = useQuery({
    queryKey: sidecarBaseUrlQueryKey,
    queryFn: () => window.imahe.getSidecarBaseUrl(),
    staleTime: 30_000,
    enabled: shouldLoadSidecarBaseUrl,
  });

  return resolveAssetUrl(assetUrl, sidecarBaseUrl);
}

function isAbsoluteHttpUrl(assetUrl: string) {
  return assetUrl.startsWith('http://') || assetUrl.startsWith('https://');
}
