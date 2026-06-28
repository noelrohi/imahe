import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ima2Client } from '@/lib/ima2/client';
import type { HistoryParams } from '@/lib/ima2/client';
import type {
  DeleteAssetResponse,
  HistoryItem,
  HistoryResponse,
  RestoreAssetResponse,
} from '@/lib/ima2/schemas';

import { GalleryGrid } from './GalleryGrid';

vi.mock('@/lib/ima2/client', () => ({
  ima2Client: {
    history: vi.fn(),
    deleteAsset: vi.fn(),
    restoreAsset: vi.fn(),
  },
}));

type MockedIma2Client = {
  history: ReturnType<typeof vi.fn<(params?: HistoryParams) => Promise<HistoryResponse>>>;
  deleteAsset: ReturnType<typeof vi.fn<(filename: string) => Promise<DeleteAssetResponse>>>;
  restoreAsset: ReturnType<
    typeof vi.fn<(filename: string, trashId: string) => Promise<RestoreAssetResponse>>
  >;
};

const mockedClient = ima2Client as unknown as MockedIma2Client;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();

  Object.defineProperty(window, 'imahe', {
    configurable: true,
    value: {
      getSidecarBaseUrl: vi.fn(async () => 'http://127.0.0.1:4890'),
      store: {},
    },
  });
});

describe('GalleryGrid', () => {
  it('renders history cards and fetches the next page', async () => {
    const cat = createAsset('cat.png', { prompt: 'Cat prompt', createdAt: 3_000 });
    const dog = createAsset('dog.png', { prompt: 'Dog prompt', createdAt: 2_000 });
    const bird = createAsset('bird.png', { prompt: 'Bird prompt', createdAt: 1_000 });

    mockedClient.history.mockImplementation(async (params) => {
      if (params?.before === 2_000 && params.beforeFilename === 'dog.png') {
        return { items: [bird], total: 3, nextCursor: null };
      }

      return {
        items: [cat, dog],
        total: 3,
        nextCursor: { before: 2_000, beforeFilename: 'dog.png' },
      };
    });

    renderGallery({ pageSize: 2 });

    expect(
      await screen.findByRole('button', { name: /Open asset Cat prompt/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Open asset Dog prompt/i }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Cat prompt' })).toHaveAttribute(
      'src',
      'http://127.0.0.1:4890/generated/cat.png',
    );

    fireEvent.click(screen.getByRole('button', { name: /Load more/i }));

    expect(
      await screen.findByRole('button', { name: /Open asset Bird prompt/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedClient.history).toHaveBeenCalledWith({
        limit: 2,
        before: 2_000,
        beforeFilename: 'dog.png',
      });
    });
  });

  it('opens the detail dialog when a card is clicked', async () => {
    const cat = createAsset('cat.png', { prompt: 'Cat prompt', model: 'gpt-image' });
    mockedClient.history.mockResolvedValue({ items: [cat], total: 1, nextCursor: null });

    renderGallery();

    fireEvent.click(await screen.findByRole('button', { name: /Open asset Cat prompt/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'cat.png' })).toBeInTheDocument();
    expect(within(dialog).getByText('gpt-image')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Cat prompt' })).toHaveAttribute(
      'src',
      'http://127.0.0.1:4890/generated/cat.png',
    );
  });

  it('deletes an asset, removes it from the grid, and invalidates history', async () => {
    const cat = createAsset('cat.png', { prompt: 'Cat prompt' });
    let deleted = false;

    mockedClient.history.mockImplementation(async () => ({
      items: deleted ? [] : [cat],
      total: deleted ? 0 : 1,
      nextCursor: null,
    }));
    mockedClient.deleteAsset.mockImplementation(async (filename) => {
      deleted = true;
      return { ok: true, filename, trash: 'system', undoableInApp: false };
    });

    const { queryClient } = renderGallery();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(await screen.findByRole('button', { name: /Open asset Cat prompt/i }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', {
      name: /Delete/i,
    }));

    await waitFor(() => {
      expect(mockedClient.deleteAsset).toHaveBeenCalledWith('cat.png');
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Open asset Cat prompt/i }),
      ).not.toBeInTheDocument();
    });

    expect(invalidateSpy).toHaveBeenCalled();
    expect(screen.getByText('Deleted cat.png')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Undo/i })).not.toBeInTheDocument();
  });
});

function renderGallery({ pageSize = 24 }: { pageSize?: number } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <GalleryGrid pageSize={pageSize} />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

function createAsset(filename: string, overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    filename,
    url: `/generated/${filename}`,
    thumb: null,
    createdAt: 1_716_000_000_000,
    mediaType: 'image',
    prompt: null,
    model: null,
    provider: 'oauth',
    sessionId: null,
    nodeId: null,
    requestId: null,
    kind: null,
    refsCount: 0,
    ...overrides,
  };
}
