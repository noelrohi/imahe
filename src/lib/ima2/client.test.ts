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
