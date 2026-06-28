import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

type Ima2PackageJson = {
  bin?: string | Record<string, string>;
};

export type SidecarInfo = {
  baseUrl: string;
};

export type WaitForHealthOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_HEALTH_TIMEOUT_MS = 30_000;
const DEFAULT_HEALTH_INTERVAL_MS = 500;
const IMA2_PACKAGE_JSON = 'ima2-gen/package.json';

let sidecarProcess: ChildProcess | null = null;
let sidecarBaseUrl: string | null = null;
let startPromise: Promise<SidecarInfo> | null = null;
let isQuitting = false;
let restartAttempts = 0;

export function buildSidecarBaseUrl(port: number): string {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new RangeError(`Invalid sidecar port: ${port}`);
  }

  return `http://127.0.0.1:${port}`;
}

export function preferAsarPathForModuleResolution(filePath: string): string {
  return filePath.replace(
    `${path.sep}app.asar.unpacked${path.sep}`,
    `${path.sep}app.asar${path.sep}`,
  );
}

export function resolveIma2CliEntryPath(
  packageJsonPath = require.resolve(IMA2_PACKAGE_JSON),
): string {
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, 'utf8'),
  ) as Ima2PackageJson;
  const binEntry =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.ima2 ?? Object.values(packageJson.bin ?? {})[0];

  if (!binEntry) {
    throw new Error('ima2-gen package.json does not define a CLI bin entry.');
  }

  const cliPath = path.resolve(path.dirname(packageJsonPath), binEntry);

  // Keep the JS entry inside app.asar so Node's normal parent-directory module
  // resolution can find ima2-gen's JS dependencies. forge.config.ts unpacks the
  // sidecar package and native transitive dependencies; Electron transparently
  // loads unpacked native assets from app.asar.unpacked when required.
  return preferAsarPathForModuleResolution(cliPath);
}

export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not determine an available sidecar port.'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

export async function waitForHealth(
  baseUrl: string,
  options: WaitForHealthOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_HEALTH_INTERVAL_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const healthUrl = `${baseUrl}/api/health`;
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), intervalMs);

    try {
      const response = await fetchImpl(healthUrl, { signal: controller.signal });

      if (response.ok) {
        return;
      }

      lastError = new Error(`Health endpoint returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    await delay(intervalMs);
  }

  throw new Error(
    `Timed out waiting for ima2 health at ${healthUrl}. Last error: ${formatError(
      lastError,
    )}`,
  );
}

export async function startSidecar(): Promise<SidecarInfo> {
  if (sidecarBaseUrl && sidecarProcess) {
    return { baseUrl: sidecarBaseUrl };
  }

  if (startPromise) {
    return startPromise;
  }

  isQuitting = false;
  restartAttempts = 0;
  startPromise = spawnAndWaitForSidecar().finally(() => {
    startPromise = null;
  });

  return startPromise;
}

export function stopSidecar(): void {
  isQuitting = true;
  const child = sidecarProcess;

  sidecarProcess = null;
  sidecarBaseUrl = null;

  if (child && !child.killed) {
    child.kill();
  }
}

export function getBaseUrl(): string | null {
  return sidecarBaseUrl;
}

async function spawnAndWaitForSidecar(): Promise<SidecarInfo> {
  const port = await getFreePort();
  const baseUrl = buildSidecarBaseUrl(port);
  const cliEntryPath = resolveIma2CliEntryPath();
  const child = spawn(process.execPath, [cliEntryPath, 'serve'], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      IMA2_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  sidecarProcess = child;
  sidecarBaseUrl = baseUrl;

  child.stdout?.on('data', (chunk: Buffer) => {
    console.log(`[ima2] ${chunk.toString().trimEnd()}`);
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    console.error(`[ima2] ${chunk.toString().trimEnd()}`);
  });

  child.once('exit', (code, signal) => {
    handleSidecarExit(child, code, signal);
  });

  try {
    await waitForHealth(baseUrl);
    return { baseUrl };
  } catch (error) {
    if (!child.killed) {
      child.kill();
    }

    if (sidecarProcess === child) {
      sidecarProcess = null;
      sidecarBaseUrl = null;
    }

    throw error;
  }
}

function handleSidecarExit(
  child: ChildProcess,
  code: number | null,
  signal: NodeJS.Signals | null,
): void {
  if (sidecarProcess === child) {
    sidecarProcess = null;
    sidecarBaseUrl = null;
  }

  if (isQuitting || child.killed) {
    return;
  }

  console.error(`ima2 sidecar exited unexpectedly (code=${code}, signal=${signal}).`);

  if (restartAttempts >= 1) {
    console.error('ima2 sidecar restart failed; leaving sidecar unavailable.');
    return;
  }

  restartAttempts += 1;
  void spawnAndWaitForSidecar().catch((error: unknown) => {
    console.error(`ima2 sidecar restart failed: ${formatError(error)}`);
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
