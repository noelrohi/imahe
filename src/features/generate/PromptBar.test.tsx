import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderStatusClient } from '@/features/auth/hooks';
import type { AsyncGenerationResponse, QuotaResponse } from '@/lib/ima2/schemas';

import { PromptBar } from './PromptBar';
import type { GenerateClient } from './hooks';

type RenderPromptOptions = {
  statusClient?: ProviderStatusClient;
  generateClient?: GenerateClient;
};

const connectedStatusClient = createStatusClient({ codex: true, grok: true });

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PromptBar', () => {
  it('routes count 1 to generate and maps Codex UI provider to oauth', async () => {
    const generateClient = createGenerateClient();
    renderPrompt({ statusClient: connectedStatusClient, generateClient });

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), {
      target: { value: 'a crystal fox' },
    });

    await clickSubmit(/Generate/i);

    await waitFor(() => {
      expect(generateClient.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'a crystal fox',
          provider: 'oauth',
          model: 'gpt-5.4-mini',
          n: 1,
          async: true,
          requestId: expect.stringMatching(/^req_/),
        }),
      );
    });
    expect(generateClient.multimode).not.toHaveBeenCalled();
  });

  it('routes count greater than 1 to multimode with maxImages', async () => {
    const generateClient = createGenerateClient();
    renderPrompt({ statusClient: connectedStatusClient, generateClient });

    await selectOption(/Image count/i, /3 variants/i);
    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), {
      target: { value: 'three ceramic birds' },
    });

    await clickSubmit(/Create variants/i);

    await waitFor(() => {
      expect(generateClient.multimode).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'three ceramic birds',
          provider: 'oauth',
          maxImages: 3,
          async: true,
          requestId: expect.stringMatching(/^req_/),
        }),
      );
    });
    expect(generateClient.generate).not.toHaveBeenCalled();
  });

  it('maps Grok UI provider to grok', async () => {
    const generateClient = createGenerateClient();
    renderPrompt({ statusClient: connectedStatusClient, generateClient });

    await selectOption(/Provider/i, /^Grok$/i);
    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), {
      target: { value: 'a neon canyon' },
    });

    await clickSubmit(/Generate/i);

    await waitFor(() => {
      expect(generateClient.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'a neon canyon',
          provider: 'grok',
          model: 'grok-imagine-image',
          n: 1,
        }),
      );
    });
  });

  it('keeps submit disabled when no provider is connected', async () => {
    const generateClient = createGenerateClient();
    renderPrompt({
      statusClient: createStatusClient({ codex: false, grok: false }),
      generateClient,
    });

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), {
      target: { value: 'a quiet meadow' },
    });

    await waitFor(() => {
      expect(screen.getByText(/Connect Codex\/OpenAI or Grok/i)).toBeInTheDocument();
    });

    const submit = screen.getByRole('button', { name: /Generate/i });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(generateClient.generate).not.toHaveBeenCalled();
    expect(generateClient.multimode).not.toHaveBeenCalled();
  });
});

function renderPrompt(options: RenderPromptOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <PromptBar
        providerStatusClient={options.statusClient ?? connectedStatusClient}
        generateClient={options.generateClient ?? createGenerateClient()}
      />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

function createGenerateClient(): GenerateClient {
  return {
    generate: vi.fn(async () => acceptedResponse('req_generate')),
    multimode: vi.fn(async () => acceptedResponse('req_variants')),
  };
}

function acceptedResponse(requestId: string): AsyncGenerationResponse {
  return { requestId, async: true };
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

async function clickSubmit(name: RegExp) {
  await waitFor(() => {
    expect(screen.getByRole('button', { name })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name }));
}

async function selectOption(label: RegExp, optionName: RegExp) {
  const trigger = await screen.findByRole('combobox', { name: label });
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
  fireEvent.click(trigger);

  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.click(option);
}
