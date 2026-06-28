import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';

import { Ima2HttpError, createIma2Client } from './client';

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('Ima2Client', () => {
  it('parses a valid health response', async () => {
    const fetchCalls: Array<RequestInfo | URL> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async (input) => {
        fetchCalls.push(input);
        return jsonResponse({ status: 'ok', version: '2.0.0' });
      },
    });

    await expect(client.health()).resolves.toMatchObject({
      status: 'ok',
      version: '2.0.0',
    });
    expect(fetchCalls.map(String)).toEqual(['http://127.0.0.1:4567/api/health']);
  });

  it('rejects malformed health responses', async () => {
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async () => jsonResponse({ status: 200 }),
    });

    await expect(client.health()).rejects.toBeInstanceOf(ZodError);
  });

  it('throws typed errors for non-2xx responses', async () => {
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async () =>
        new Response('server exploded', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
    });

    try {
      await client.health();
      throw new Error('Expected health() to reject.');
    } catch (error) {
      expect(error).toBeInstanceOf(Ima2HttpError);

      if (error instanceof Ima2HttpError) {
        expect(error.status).toBe(500);
        expect(error.statusText).toBe('Internal Server Error');
        expect(error.body).toBe('server exploded');
      }
    }
  });

  it('parses a valid paginated history response', async () => {
    const fetchCalls: Array<RequestInfo | URL> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async (input) => {
        fetchCalls.push(input);
        return jsonResponse({
          items: [
            {
              filename: 'folder/cat.png',
              url: '/generated/folder/cat.png',
              thumb: null,
              createdAt: 1_716_000_000_000,
              mediaType: 'image',
              prompt: 'cat',
              extraField: true,
            },
          ],
          total: 2,
          nextCursor: {
            before: 1_716_000_000_000,
            beforeFilename: 'folder/cat.png',
          },
        });
      },
    });

    await expect(
      client.history({ limit: 1, before: 2_000, beforeFilename: 'folder/dog.png' }),
    ).resolves.toMatchObject({
      items: [
        {
          filename: 'folder/cat.png',
          url: '/generated/folder/cat.png',
          extraField: true,
        },
      ],
      total: 2,
      nextCursor: {
        before: 1_716_000_000_000,
        beforeFilename: 'folder/cat.png',
      },
    });
    expect(fetchCalls.map(String)).toEqual([
      'http://127.0.0.1:4567/api/history?limit=1&before=2000&beforeFilename=folder%2Fdog.png',
    ]);
  });

  it('rejects malformed history items', async () => {
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async () =>
        jsonResponse({
          items: [{ filename: 'missing-url.png' }],
          total: 1,
          nextCursor: null,
        }),
    });

    await expect(client.history()).rejects.toBeInstanceOf(ZodError);
  });

  it('sends deleteAsset to the encoded history path', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async (input, init) => {
        fetchCalls.push({ input, init });
        return jsonResponse({ ok: true, filename: 'folder/cat one.png' });
      },
    });

    await expect(client.deleteAsset('folder/cat one.png')).resolves.toMatchObject({
      ok: true,
      filename: 'folder/cat one.png',
    });
    expect(fetchCalls).toHaveLength(1);
    expect(String(fetchCalls[0].input)).toBe(
      'http://127.0.0.1:4567/api/history/folder%2Fcat%20one.png',
    );
    expect(fetchCalls[0].init?.method).toBe('DELETE');
  });

  it('sends restoreAsset to the encoded history path with a trashId body', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async (input, init) => {
        fetchCalls.push({ input, init });
        return jsonResponse({ ok: true });
      },
    });

    await expect(
      client.restoreAsset('folder/cat one.png', 'trash-123'),
    ).resolves.toMatchObject({ ok: true });
    expect(fetchCalls).toHaveLength(1);
    expect(String(fetchCalls[0].input)).toBe(
      'http://127.0.0.1:4567/api/history/folder%2Fcat%20one.png/restore',
    );
    expect(fetchCalls[0].init?.method).toBe('POST');
    expect(fetchCalls[0].init?.body).toBe(JSON.stringify({ trashId: 'trash-123' }));
  });
});
