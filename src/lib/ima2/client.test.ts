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

  it('starts OAuth with the correct provider payload', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:3333',
      fetchImpl: async (input, init) => {
        fetchCalls.push({ input, init });
        return jsonResponse({
          sessionId: 'session-1',
          userCode: 'ABCD-EFGH',
          verificationUrl: 'https://example.com/device',
          ignored: true,
        });
      },
    });

    await expect(client.authSwitch('codex')).resolves.toMatchObject({
      sessionId: 'session-1',
      userCode: 'ABCD-EFGH',
      verificationUrl: 'https://example.com/device',
      ignored: true,
    });
    expect(fetchCalls).toHaveLength(1);
    expect(String(fetchCalls[0].input)).toBe('http://127.0.0.1:3333/api/auth/switch');
    expect(fetchCalls[0].init?.method).toBe('POST');
    expect(fetchCalls[0].init?.body).toBe(JSON.stringify({ provider: 'codex' }));
    expect(new Headers(fetchCalls[0].init?.headers).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('polls OAuth status from the session endpoint', async () => {
    const fetchCalls: Array<RequestInfo | URL> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:3333',
      fetchImpl: async (input) => {
        fetchCalls.push(input);
        return jsonResponse({ status: 'complete', account: 'user@example.com' });
      },
    });

    await expect(client.authStatus('session/1')).resolves.toMatchObject({
      status: 'complete',
      account: 'user@example.com',
    });
    expect(fetchCalls.map(String)).toEqual([
      'http://127.0.0.1:3333/api/auth/switch/session%2F1',
    ]);
  });

  it('parses provider status and quota responses from the expected endpoints', async () => {
    const fetchCalls: Array<RequestInfo | URL> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:3333',
      fetchImpl: async (input) => {
        fetchCalls.push(input);

        if (String(input).endsWith('/api/oauth/status')) {
          return jsonResponse({ status: 'ready', models: ['gpt-image-1'] });
        }

        if (String(input).endsWith('/api/grok/status')) {
          return jsonResponse({ status: 'ready', models: [{ id: 'grok-2-image' }] });
        }

        return jsonResponse({
          codex: { authenticated: true, remaining: 10 },
          grok: { authenticated: false },
          resetsAt: 'tomorrow',
        });
      },
    });

    await expect(client.oauthStatus()).resolves.toMatchObject({ status: 'ready' });
    await expect(client.grokStatus()).resolves.toMatchObject({ status: 'ready' });
    await expect(client.quota()).resolves.toMatchObject({
      codex: { authenticated: true, remaining: 10 },
      grok: { authenticated: false },
      resetsAt: 'tomorrow',
    });
    expect(fetchCalls.map(String)).toEqual([
      'http://127.0.0.1:3333/api/oauth/status',
      'http://127.0.0.1:3333/api/grok/status',
      'http://127.0.0.1:3333/api/quota',
    ]);
  });

  it('rejects malformed auth and provider payloads for fields imahe reads', async () => {
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:3333',
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith('/api/auth/switch')) {
          return jsonResponse({ sessionId: 123, userCode: 'ABCD', verificationUrl: 'https://example.com' });
        }

        if (url.includes('/api/auth/switch/')) {
          return jsonResponse({ status: 'done' });
        }

        if (url.endsWith('/api/oauth/status')) {
          return jsonResponse({ status: 200 });
        }

        if (url.endsWith('/api/grok/status')) {
          return jsonResponse({ status: 'ready', models: 'grok-2-image' });
        }

        return jsonResponse({ codex: { authenticated: 'yes' } });
      },
    });

    await expect(client.authSwitch('grok')).rejects.toBeInstanceOf(ZodError);
    await expect(client.authStatus('bad-session')).rejects.toBeInstanceOf(ZodError);
    await expect(client.oauthStatus()).rejects.toBeInstanceOf(ZodError);
    await expect(client.grokStatus()).rejects.toBeInstanceOf(ZodError);
    await expect(client.quota()).rejects.toBeInstanceOf(ZodError);
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

  it('posts async generate requests with n and parses the accepted response', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async (input, init) => {
        fetchCalls.push({ input, init });
        return jsonResponse({ requestId: 'req_single', async: true }, { status: 202 });
      },
    });

    await expect(
      client.generate({
        prompt: 'a moonlit heron',
        provider: 'oauth',
        model: 'gpt-5.4-mini',
        size: '1024x1024',
        n: 1,
        references: [],
        requestId: 'req_single',
      }),
    ).resolves.toMatchObject({ requestId: 'req_single', async: true });

    expect(fetchCalls).toHaveLength(1);
    expect(String(fetchCalls[0].input)).toBe('http://127.0.0.1:4567/api/generate');
    expect(fetchCalls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(fetchCalls[0].init?.body))).toMatchObject({
      prompt: 'a moonlit heron',
      provider: 'oauth',
      model: 'gpt-5.4-mini',
      size: '1024x1024',
      n: 1,
      async: true,
      requestId: 'req_single',
    });
  });

  it('posts async multimode requests with maxImages and parses the accepted response', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async (input, init) => {
        fetchCalls.push({ input, init });
        return jsonResponse({ requestId: 'req_variants' }, { status: 202 });
      },
    });

    await expect(
      client.multimode({
        prompt: 'four toy robots',
        provider: 'grok',
        model: 'grok-imagine-image',
        size: '1024x1024',
        maxImages: 4,
        references: [],
        requestId: 'req_variants',
      }),
    ).resolves.toMatchObject({ requestId: 'req_variants' });

    expect(fetchCalls).toHaveLength(1);
    expect(String(fetchCalls[0].input)).toBe(
      'http://127.0.0.1:4567/api/generate/multimode',
    );
    expect(fetchCalls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(fetchCalls[0].init?.body))).toMatchObject({
      prompt: 'four toy robots',
      provider: 'grok',
      model: 'grok-imagine-image',
      size: '1024x1024',
      maxImages: 4,
      async: true,
      requestId: 'req_variants',
    });
  });

  it('lists and cancels inflight jobs through the expected endpoints', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createIma2Client({
      getBaseUrl: () => 'http://127.0.0.1:4567',
      fetchImpl: async (input, init) => {
        fetchCalls.push({ input, init });

        if (String(input).includes('/api/inflight?')) {
          return jsonResponse({
            jobs: [{ requestId: 'req_active', phase: 'streaming' }],
            terminalJobs: [{ requestId: 'req_done', status: 'completed' }],
          });
        }

        return jsonResponse({ requestId: 'req_active', active: true, aborted: true });
      },
    });

    await expect(client.inflight({ includeTerminal: true })).resolves.toMatchObject({
      jobs: [{ requestId: 'req_active' }],
      terminalJobs: [{ requestId: 'req_done' }],
    });
    await expect(client.cancelJob('req_active')).resolves.toMatchObject({
      requestId: 'req_active',
      active: true,
      aborted: true,
    });

    expect(fetchCalls.map((call) => String(call.input))).toEqual([
      'http://127.0.0.1:4567/api/inflight?includeTerminal=1',
      'http://127.0.0.1:4567/api/inflight/req_active',
    ]);
    expect(fetchCalls[1].init?.method).toBe('DELETE');
  });
});
