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
      getBaseUrl: () => 'http://127.0.0.1:3333',
      fetchImpl: async (input) => {
        fetchCalls.push(input);
        return jsonResponse({ status: 'ok', version: '2.0.0' });
      },
    });

    await expect(client.health()).resolves.toMatchObject({
      status: 'ok',
      version: '2.0.0',
    });
    expect(fetchCalls.map(String)).toEqual(['http://127.0.0.1:3333/api/health']);
  });

  it('rejects malformed health responses', async () => {
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:3333',
      fetchImpl: async () => jsonResponse({ status: 200 }),
    });

    await expect(client.health()).rejects.toBeInstanceOf(ZodError);
  });

  it('throws typed errors for non-2xx responses', async () => {
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:3333',
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
});
