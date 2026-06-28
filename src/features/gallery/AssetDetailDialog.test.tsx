import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HistoryItem } from '@/lib/ima2/schemas';
import type { AssetRecord } from '@/shared/ipc';

import { AssetDetailDialog } from './AssetDetailDialog';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AssetDetailDialog lineage panel', () => {
  it('renders child thumbnails by joining lineage records to loaded history rows', async () => {
    const source = createAsset('source.png', { prompt: 'Source prompt' });
    const childOne = createAsset('child-one.png', { prompt: 'Child one prompt' });
    const childTwo = createAsset('child-two.png', { prompt: 'Child two prompt' });

    installImaheMocks({
      currentRecord: createRecord('source.png'),
      children: [createRecord('child-one.png', 'source.png'), createRecord('child-two.png', 'source.png')],
    });

    renderDialog({ asset: source, historyItems: [source, childOne, childTwo] });

    const remixes = await screen.findByRole('region', { name: /Remixes \(2\)/i });
    expect(within(remixes).getByRole('img', { name: 'Child one prompt' })).toHaveAttribute(
      'src',
      'http://127.0.0.1:4890/generated/child-one.png',
    );
    expect(within(remixes).getByRole('img', { name: 'Child two prompt' })).toHaveAttribute(
      'src',
      'http://127.0.0.1:4890/generated/child-two.png',
    );
  });

  it('renders a missing placeholder when a lineage child is absent from loaded history', async () => {
    const source = createAsset('source.png', { prompt: 'Source prompt' });

    installImaheMocks({
      currentRecord: createRecord('source.png'),
      children: [createRecord('missing-child.png', 'source.png')],
    });

    renderDialog({ asset: source, historyItems: [source] });

    const remixes = await screen.findByRole('region', { name: /Remixes \(1\)/i });
    expect(within(remixes).getByText('Missing asset')).toBeInTheDocument();
    expect(within(remixes).getByText('missing-child.png')).toBeInTheDocument();
  });
});

function renderDialog({
  asset,
  historyItems,
}: {
  asset: HistoryItem;
  historyItems: HistoryItem[];
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AssetDetailDialog
        asset={asset}
        open
        historyItems={historyItems}
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
      />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

function installImaheMocks({
  currentRecord,
  children,
}: {
  currentRecord: AssetRecord | null;
  children: AssetRecord[];
}) {
  Object.defineProperty(window, 'imahe', {
    configurable: true,
    value: {
      getSidecarBaseUrl: vi.fn(async () => 'http://127.0.0.1:4890'),
      openExternal: vi.fn(),
      store: {
        assets: {
          upsert: vi.fn(),
          setFavorite: vi.fn(),
          get: vi.fn(async () => currentRecord),
          getChildren: vi.fn(async () => children),
        },
        collections: {
          create: vi.fn(),
          list: vi.fn(),
          addAsset: vi.fn(),
          removeAsset: vi.fn(),
          listAssets: vi.fn(),
        },
      },
    },
  });
}

function createRecord(id: string, parentId: string | null = null): AssetRecord {
  return {
    id,
    parentId,
    favorite: false,
    createdAt: 1_716_000_000_000,
  };
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
