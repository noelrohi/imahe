import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/lib/query';
import type { AuthStatusResponse } from '@/lib/ima2/schemas';

import { SettingsAuth, type SettingsAuthClient } from './SettingsAuth';

describe('SettingsAuth', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'imahe');
  });

  it('derives connected provider cards from status endpoints and quota', async () => {
    const client = createMockClient({
      oauthStatus: vi.fn<SettingsAuthClient['oauthStatus']>(async () => ({ status: 'ready' })),
      grokStatus: vi.fn<SettingsAuthClient['grokStatus']>(async () => ({ status: 'needs_auth' })),
      quota: vi.fn<SettingsAuthClient['quota']>(async () => ({
        codex: { authenticated: false },
        grok: { authenticated: true },
      })),
    });

    renderSettingsAuth(client);

    expect(await within(providerCard('Codex / OpenAI')).findByText('Connected')).toBeInTheDocument();
    expect(await within(providerCard('Grok')).findByText('Connected')).toBeInTheDocument();
  });

  it('starts OAuth, opens the verification URL, and refreshes status after completion', async () => {
    let codexRawStatus = 'needs_auth';
    let resolveComplete: ((status: AuthStatusResponse) => void) | undefined;

    const authSwitch = vi.fn<SettingsAuthClient['authSwitch']>(async () => ({
      sessionId: 'session-1',
      userCode: 'ABCD-EFGH',
      verificationUrl: 'https://example.com/device',
    }));
    const authStatus = vi.fn<SettingsAuthClient['authStatus']>();
    authStatus.mockResolvedValueOnce({ status: 'pending' });
    authStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveComplete = (status) => {
            codexRawStatus = 'ready';
            resolve(status);
          };
        }),
    );

    const client = createMockClient({
      authSwitch,
      authStatus,
      oauthStatus: vi.fn<SettingsAuthClient['oauthStatus']>(async () => ({
        status: codexRawStatus,
      })),
      grokStatus: vi.fn<SettingsAuthClient['grokStatus']>(async () => ({ status: 'needs_auth' })),
      quota: vi.fn<SettingsAuthClient['quota']>(async () => ({
        codex: { authenticated: false },
        grok: { authenticated: false },
      })),
    });
    const openExternal = vi.fn(async () => undefined);
    stubImaheOpenExternal(openExternal);

    renderSettingsAuth(client);

    const codexCard = providerCard('Codex / OpenAI');
    fireEvent.click(await within(codexCard).findByRole('button', { name: 'Sign in' }));

    expect(await within(codexCard).findByText('ABCD-EFGH')).toBeInTheDocument();
    expect(authSwitch).toHaveBeenCalledWith('codex');
    expect(openExternal).toHaveBeenCalledWith('https://example.com/device');

    await waitFor(() => expect(resolveComplete).toBeDefined());
    await act(async () => {
      resolveComplete?.({ status: 'complete' });
    });

    expect(await within(codexCard).findByText('Connected')).toBeInTheDocument();
    await waitFor(() => expect(client.oauthStatus).toHaveBeenCalledTimes(2));
  });
});

function renderSettingsAuth(client: SettingsAuthClient) {
  const queryClient = createAppQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <SettingsAuth client={client} pollIntervalMs={0} />
    </QueryClientProvider>,
  );

  return queryClient;
}

function providerCard(name: string): HTMLElement {
  const title = screen.getByRole('heading', { name });
  const card = title.closest('[data-slot="card"]');

  if (!card) {
    throw new Error(`Could not find provider card for ${name}.`);
  }

  return card as HTMLElement;
}

function stubImaheOpenExternal(openExternal: (url: string) => Promise<void>) {
  Object.defineProperty(window, 'imahe', {
    configurable: true,
    value: { openExternal },
  });
}

function createMockClient(overrides: Partial<SettingsAuthClient> = {}): SettingsAuthClient {
  return {
    authSwitch: vi.fn<SettingsAuthClient['authSwitch']>(async () => ({
      sessionId: 'session-1',
      userCode: 'ABCD-EFGH',
      verificationUrl: 'https://example.com/device',
    })),
    authStatus: vi.fn<SettingsAuthClient['authStatus']>(async () => ({ status: 'complete' })),
    oauthStatus: vi.fn<SettingsAuthClient['oauthStatus']>(async () => ({ status: 'needs_auth' })),
    grokStatus: vi.fn<SettingsAuthClient['grokStatus']>(async () => ({ status: 'needs_auth' })),
    quota: vi.fn<SettingsAuthClient['quota']>(async () => ({
      codex: { authenticated: false },
      grok: { authenticated: false },
    })),
    ...overrides,
  };
}
