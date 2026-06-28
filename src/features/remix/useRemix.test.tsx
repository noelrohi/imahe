import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NodeGenerateAsyncResponse, HistoryItem } from '@/lib/ima2/schemas';
import type { AssetRecord, UpsertAssetPayload } from '@/shared/ipc';
import type { EventSourceConstructor, EventSourceLike } from '@/lib/ima2/events';

import { useRemix, type RemixClient } from './useRemix';

class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  readonly url: string | URL;
  closed = false;

  constructor(url: string | URL) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) ?? new Set<(event: Event) => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown, lastEventId = '1') {
    this.listeners.get(type)?.forEach((listener) => {
      listener(new MessageEvent(type, { data: JSON.stringify(data), lastEventId }));
    });
  }
}

const FakeEventSourceConstructor = FakeEventSource as unknown as EventSourceConstructor;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.resetAllMocks();
});

describe('useRemix', () => {
  it('records lineage when a matching node-generate done event completes', async () => {
    const source = createAsset('source.png', { prompt: 'source prompt' });
    const client: RemixClient = {
      nodeGenerate: vi.fn(async () => acceptedResponse('req_remix')),
    };
    const store = {
      upsert: vi.fn(async (asset: UpsertAssetPayload): Promise<AssetRecord> => ({
        id: asset.id,
        parentId: asset.parentId ?? null,
        favorite: false,
        createdAt: asset.createdAt,
      })),
    };
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <RemixHarness client={client} store={store} source={source} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Start remix/i }));

    await waitFor(() => {
      expect(client.nodeGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'make it cinematic',
          provider: 'oauth',
          model: 'gpt-5.4-mini',
          size: '1024x1024',
          externalSrc: 'source.png',
          async: true,
          requestId: 'req_remix',
        }),
      );
    });

    const eventSource = FakeEventSource.instances[0];
    expect(String(eventSource.url)).toBe('http://127.0.0.1:4890/api/events');

    eventSource.emit('done', {
      requestId: 'req_remix',
      filename: 'child.png',
      url: '/generated/child.png',
      nodeId: 'node_child',
      createdAt: 2_000,
    });

    await waitFor(() => {
      expect(store.upsert).toHaveBeenCalledWith({
        id: 'child.png',
        parentId: 'source.png',
        createdAt: 2_000,
      });
    });
    expect(eventSource.closed).toBe(true);
    expect(await screen.findByText('child.png')).toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['history'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['lineage', 'children', 'source.png'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['lineage', 'asset', 'child.png'],
    });
  });
});

function RemixHarness({
  client,
  store,
  source,
}: {
  client: RemixClient;
  store: { upsert: (asset: UpsertAssetPayload) => Promise<AssetRecord> };
  source: HistoryItem;
}) {
  const remix = useRemix({
    client,
    store,
    getBaseUrl: () => 'http://127.0.0.1:4890',
    EventSource: FakeEventSourceConstructor,
    now: () => 123_456,
  });

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          remix.mutate({
            source,
            prompt: 'make it cinematic',
            provider: 'codex',
            model: 'gpt-5.4-mini',
            size: '1024x1024',
            requestId: 'req_remix',
          })
        }
      >
        Start remix
      </button>
      {remix.data ? <p>{remix.data.done.filename}</p> : null}
    </div>
  );
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function acceptedResponse(requestId: string): NodeGenerateAsyncResponse {
  return { requestId, async: true };
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
