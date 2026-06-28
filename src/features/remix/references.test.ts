import { describe, expect, it, vi } from 'vitest';

import {
  assertReferenceLimit,
  assetUrlToBase64Reference,
} from './references';

describe('reference helpers', () => {
  it('fetches relative asset URLs through the sidecar base URL and returns base64', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([104, 105]), {
        headers: { 'Content-Type': 'image/png' },
      }),
    );

    await expect(
      assetUrlToBase64Reference('/generated/source.png', {
        fetchImpl,
        getBaseUrl: () => 'http://127.0.0.1:4890',
      }),
    ).resolves.toBe('aGk=');
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4890/generated/source.png');
  });

  it('enforces the Grok total input image cap', () => {
    expect(() => assertReferenceLimit(4, { provider: 'grok' })).toThrow(
      /Grok.*at most 3/i,
    );
    expect(() => assertReferenceLimit(3, { provider: 'grok' })).not.toThrow();
    expect(() => assertReferenceLimit(5, { provider: 'codex' })).not.toThrow();
  });
});
