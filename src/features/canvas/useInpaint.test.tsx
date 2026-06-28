import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { historyQueryKey } from '@/features/gallery/useHistory';
import type { AssetRecord } from '@/shared/ipc';

import { canvasQueryKeys, useInpaint, type InpaintClient, type InpaintStore } from './useInpaint';

describe('useInpaint', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('posts PNG image and mask to client.edit, records lineage, and invalidates history', async () => {
    const client: InpaintClient = {
      edit: vi.fn(async () => ({ filename: 'child.png', createdAt: 1_700_000_000_000 })),
      cancelJob: vi.fn(async (requestId) => ({ requestId })),
    };
    const store: InpaintStore = {
      upsert: vi.fn(async (asset): Promise<AssetRecord> => ({
        id: asset.id,
        parentId: asset.parentId ?? null,
        favorite: false,
        createdAt: asset.createdAt,
      })),
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <InpaintHarness client={client} store={store} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Run inpaint/i }));

    await waitFor(() => {
      expect(client.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'replace the moon',
          image: 'data:image/png;base64,AAAA',
          mask: 'data:image/png;base64,BBBB',
          provider: 'oauth',
          requestId: 'req_test_inpaint',
        }),
      );
    });

    expect(client.edit).not.toHaveBeenCalledWith(expect.objectContaining({ provider: 'grok' }));
    await waitFor(() => {
      expect(store.upsert).toHaveBeenCalledWith({
        id: 'child.png',
        parentId: 'source.png',
        createdAt: 1_700_000_000_000,
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: historyQueryKey });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: canvasQueryKeys.lineage('source.png'),
      });
    });
  });
});

function InpaintHarness({ client, store }: { client: InpaintClient; store: InpaintStore }) {
  const inpaint = useInpaint({ client, store });

  return (
    <button
      type="button"
      onClick={() => {
        void inpaint.mutateAsync({
          source: { filename: 'source.png', url: '/generated/source.png' },
          prompt: 'replace the moon',
          sourcePng: 'data:image/png;base64,AAAA',
          maskPng: 'data:image/png;base64,BBBB',
          model: 'gpt-5.4-mini',
          quality: 'medium',
          size: '1024x1024',
          moderation: 'low',
          requestId: 'req_test_inpaint',
        });
      }}
    >
      Run inpaint
    </button>
  );
}
