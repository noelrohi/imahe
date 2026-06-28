import net from 'node:net';
import { describe, expect, it } from 'vitest';

import { buildSidecarBaseUrl, getFreePort } from './sidecar';

describe('sidecar helpers', () => {
  it('builds the loopback base URL for a port', () => {
    expect(buildSidecarBaseUrl(3333)).toBe('http://127.0.0.1:3333');
    expect(buildSidecarBaseUrl(0)).toBe('http://127.0.0.1:0');
    expect(() => buildSidecarBaseUrl(65_536)).toThrow(RangeError);
  });

  it('returns ports that can be rebound', async () => {
    const firstPort = await getFreePort();
    const secondPort = await getFreePort();

    expect(firstPort).toBeGreaterThan(0);
    expect(secondPort).toBeGreaterThan(0);

    await expectPortBindable(firstPort);
    await expectPortBindable(secondPort);
  });
});

async function expectPortBindable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });
}
