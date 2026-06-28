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
  FavoriteResponse,
  HistoryItem,
  HistoryResponse,
  RestoreAssetResponse,
} from '@/lib/ima2/schemas';
import type { AssetRecord, CollectionRecord, UpsertAssetPayload } from '@/shared/ipc';

import Collections from './Collections';

vi.mock('@/lib/ima2/client', () => ({
  ima2Client: {
    history: vi.fn(),
    deleteAsset: vi.fn(),
    restoreAsset: vi.fn(),
    toggleFavorite: vi.fn(),
  },
}));

type MockedIma2Client = {
  history: ReturnType<typeof vi.fn<(params?: HistoryParams) => Promise<HistoryResponse>>>;
  deleteAsset: ReturnType<typeof vi.fn<(filename: string) => Promise<DeleteAssetResponse>>>;
  restoreAsset: ReturnType<
    typeof vi.fn<(filename: string, trashId: string) => Promise<RestoreAssetResponse>>
  >;
  toggleFavorite: ReturnType<
    typeof vi.fn<(filename: string) => Promise<FavoriteResponse>>
  >;
};

type CollectionsStoreMock = {
  create: ReturnType<typeof vi.fn<(name: string) => Promise<CollectionRecord>>>;
  list: ReturnType<typeof vi.fn<() => Promise<CollectionRecord[]>>>;
  addAsset: ReturnType<
    typeof vi.fn<(collectionId: string, assetId: string) => Promise<void>>
  >;
  removeAsset: ReturnType<
    typeof vi.fn<(collectionId: string, assetId: string) => Promise<void>>
  >;
  listAssets: ReturnType<typeof vi.fn<(collectionId: string) => Promise<AssetRecord[]>>>;
};

const mockedClient = ima2Client as unknown as MockedIma2Client;

let collections: CollectionRecord[];
let assetsByCollection: Map<string, AssetRecord[]>;
let collectionsStore: CollectionsStoreMock;
let createdAtCounter: number;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();

  collections = [];
  assetsByCollection = new Map();
  createdAtCounter = 1_000;
  collectionsStore = createCollectionsStoreMock();

  mockedClient.history.mockResolvedValue({
    items: [createAsset('cat.png', { prompt: 'Cat prompt' })],
    total: 1,
    nextCursor: null,
  });
  mockedClient.toggleFavorite.mockResolvedValue({ isFavorite: true });

  Object.defineProperty(window, 'imahe', {
    configurable: true,
    value: {
      getSidecarBaseUrl: vi.fn(async () => 'http://127.0.0.1:4890'),
      openExternal: vi.fn(),
      store: {
        assets: {
          upsert: vi.fn(async (asset: UpsertAssetPayload) => ({
            id: asset.id,
            parentId: asset.parentId ?? null,
            favorite: false,
            createdAt: asset.createdAt,
          })),
          setFavorite: vi.fn(),
          get: vi.fn(async () => null),
          getChildren: vi.fn(async () => []),
        },
        collections: collectionsStore,
      },
    },
  });
});

describe('Collections route', () => {
  it('creates a collection, joins added asset ids to history rows, and removes assets', async () => {
    renderCollections();

    fireEvent.change(screen.getByLabelText('Collection name'), {
      target: { value: 'Moodboard' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    expect(await screen.findByRole('button', { name: /Moodboard/i })).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText('Asset filename'), {
      target: { value: 'cat.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add asset/i }));

    expect(await screen.findByRole('button', { name: /Open asset Cat prompt/i })).toBeInTheDocument();
    expect(collectionsStore.addAsset).toHaveBeenCalledWith('collection-1', 'cat.png');

    fireEvent.click(screen.getByRole('button', { name: /Open asset Cat prompt/i }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: /Remove from collection/i,
      }),
    );

    await waitFor(() => {
      expect(collectionsStore.removeAsset).toHaveBeenCalledWith('collection-1', 'cat.png');
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Open asset Cat prompt/i }),
      ).not.toBeInTheDocument();
    });
  });
});

function renderCollections() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <Collections />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

function createCollectionsStoreMock(): CollectionsStoreMock {
  return {
    create: vi.fn(async (name) => {
      const collection = {
        id: `collection-${collections.length + 1}`,
        name,
        createdAt: nextCreatedAt(),
      };

      collections = [collection, ...collections];
      assetsByCollection.set(collection.id, []);

      return collection;
    }),
    list: vi.fn(async () => collections),
    addAsset: vi.fn(async (collectionId, assetId) => {
      const currentAssets = assetsByCollection.get(collectionId) ?? [];

      if (!currentAssets.some((asset) => asset.id === assetId)) {
        assetsByCollection.set(collectionId, [
          {
            id: assetId,
            parentId: null,
            favorite: false,
            createdAt: nextCreatedAt(),
          },
          ...currentAssets,
        ]);
      }
    }),
    removeAsset: vi.fn(async (collectionId, assetId) => {
      const currentAssets = assetsByCollection.get(collectionId) ?? [];
      assetsByCollection.set(
        collectionId,
        currentAssets.filter((asset) => asset.id !== assetId),
      );
    }),
    listAssets: vi.fn(async (collectionId) => assetsByCollection.get(collectionId) ?? []),
  };
}

function nextCreatedAt() {
  createdAtCounter += 1_000;
  return createdAtCounter;
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
    isFavorite: false,
    ...overrides,
  };
}
