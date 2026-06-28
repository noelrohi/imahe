import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderStatusClient } from '@/features/auth/hooks';
import type { QuotaResponse } from '@/lib/ima2/schemas';

import { CanvasEditorDialog } from './CanvasEditorDialog';
import type { InpaintClient } from './useInpaint';

describe('CanvasEditorDialog provider guard', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('disables masked inpaint when only Grok is connected', async () => {
    const inpaintClient: InpaintClient = {
      edit: vi.fn(async () => ({ filename: 'child.png' })),
      cancelJob: vi.fn(async (requestId) => ({ requestId })),
    };

    renderDialog({
      inpaintClient,
      providerStatusClient: createStatusClient({ codex: false, grok: true }),
    });

    expect(await screen.findByText(/Grok masked editing is not supported/i)).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: /Inpaint masked area/i });
    await waitFor(() => expect(submit).toBeDisabled());
    fireEvent.click(submit);

    expect(inpaintClient.edit).not.toHaveBeenCalled();
  });
});

function renderDialog({
  inpaintClient,
  providerStatusClient,
}: {
  inpaintClient: InpaintClient;
  providerStatusClient: ProviderStatusClient;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CanvasEditorDialog
        asset={{ filename: 'source.png', url: '/generated/source.png' }}
        sourceUrl={undefined}
        open
        onOpenChange={() => undefined}
        inpaintClient={inpaintClient}
        providerStatusClient={providerStatusClient}
      />
    </QueryClientProvider>,
  );
}

function createStatusClient({
  codex,
  grok,
}: {
  codex: boolean;
  grok: boolean;
}): ProviderStatusClient {
  const quota: QuotaResponse = {
    codex: { authenticated: codex },
    grok: { authenticated: grok },
  };

  return {
    oauthStatus: vi.fn(async () => ({ status: codex ? 'ready' : 'auth_required' })),
    grokStatus: vi.fn(async () => ({ status: grok ? 'ready' : 'auth_required' })),
    quota: vi.fn(async () => quota),
  };
}
