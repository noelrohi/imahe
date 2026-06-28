import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ima2Client, type Ima2Client } from '@/lib/ima2/client';
import type { AuthProvider, AuthStatusResponse } from '@/lib/ima2/schemas';

export const authQueryKeys = {
  all: ['auth'] as const,
  oauthStatus: ['auth', 'oauth-status'] as const,
  grokStatus: ['auth', 'grok-status'] as const,
  quota: ['auth', 'quota'] as const,
};

const DEFAULT_AUTH_POLL_INTERVAL_MS = 2_000;

export type ProviderStatusClient = Pick<Ima2Client, 'oauthStatus' | 'grokStatus' | 'quota'>;
export type OAuthClient = Pick<Ima2Client, 'authSwitch' | 'authStatus'>;

type UseProviderStatusesOptions = {
  client?: ProviderStatusClient;
};

type OAuthFlowStatus = 'idle' | AuthStatusResponse['status'];

export type OAuthFlowState = {
  provider: AuthProvider;
  status: OAuthFlowStatus;
  sessionId?: string;
  userCode?: string;
  verificationUrl?: string;
  error?: string;
} | {
  provider?: undefined;
  status: 'idle';
  sessionId?: undefined;
  userCode?: undefined;
  verificationUrl?: undefined;
  error?: undefined;
};

export type ProviderCardStatus = {
  provider: AuthProvider;
  title: string;
  description: string;
  connected: boolean;
  statusText: string;
  rawStatus: string | undefined;
  quotaAuthenticated: boolean | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

export type UseStartOAuthOptions = {
  client?: OAuthClient;
  openExternal?: (url: string) => Promise<void>;
  pollIntervalMs?: number;
};

export class OAuthFlowError extends Error {
  readonly authStatus: AuthStatusResponse | undefined;

  constructor(message: string, authStatus?: AuthStatusResponse) {
    super(message);
    this.name = 'OAuthFlowError';
    this.authStatus = authStatus;
  }
}

export function useProviderStatuses(options: UseProviderStatusesOptions = {}) {
  const client = options.client ?? ima2Client;

  const oauthStatusQuery = useQuery({
    queryKey: authQueryKeys.oauthStatus,
    queryFn: () => client.oauthStatus(),
  });
  const grokStatusQuery = useQuery({
    queryKey: authQueryKeys.grokStatus,
    queryFn: () => client.grokStatus(),
  });
  const quotaQuery = useQuery({
    queryKey: authQueryKeys.quota,
    queryFn: () => client.quota(),
  });

  const providers = useMemo(
    () => ({
      codex: deriveProviderStatus({
        provider: 'codex',
        title: 'Codex / OpenAI',
        description: 'Sign in with your OpenAI account for Codex-backed image generation.',
        rawStatus: oauthStatusQuery.data?.status,
        quotaAuthenticated: quotaQuery.data?.codex?.authenticated,
        isLoading: oauthStatusQuery.isPending || quotaQuery.isPending,
        error: firstError(oauthStatusQuery.error, quotaQuery.error),
      }),
      grok: deriveProviderStatus({
        provider: 'grok',
        title: 'Grok',
        description: 'Sign in with your Grok account for xAI image generation.',
        rawStatus: grokStatusQuery.data?.status,
        quotaAuthenticated: quotaQuery.data?.grok?.authenticated,
        isLoading: grokStatusQuery.isPending || quotaQuery.isPending,
        error: firstError(grokStatusQuery.error, quotaQuery.error),
      }),
    }),
    [
      grokStatusQuery.data?.status,
      grokStatusQuery.error,
      grokStatusQuery.isPending,
      oauthStatusQuery.data?.status,
      oauthStatusQuery.error,
      oauthStatusQuery.isPending,
      quotaQuery.data?.codex?.authenticated,
      quotaQuery.data?.grok?.authenticated,
      quotaQuery.error,
      quotaQuery.isPending,
    ],
  );

  return {
    providers,
    queries: {
      oauthStatus: oauthStatusQuery,
      grokStatus: grokStatusQuery,
      quota: quotaQuery,
    },
  };
}

export function useStartOAuth(
  provider: AuthProvider,
  options: UseStartOAuthOptions = {},
) {
  const queryClient = useQueryClient();
  const client = options.client ?? ima2Client;
  const openExternal = options.openExternal ?? defaultOpenExternal;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_AUTH_POLL_INTERVAL_MS;
  const [flow, setFlow] = useState<OAuthFlowState>({ status: 'idle' });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetFlow = useCallback((nextFlow: OAuthFlowState) => {
    if (mountedRef.current) {
      setFlow(nextFlow);
    }
  }, []);

  const mutation = useMutation({
    mutationKey: ['auth', 'start', provider],
    mutationFn: async () => {
      safeSetFlow({ provider, status: 'pending' });

      const switchResponse = await client.authSwitch(provider);
      safeSetFlow({
        provider,
        status: 'pending',
        sessionId: switchResponse.sessionId,
        userCode: switchResponse.userCode,
        verificationUrl: switchResponse.verificationUrl,
      });

      await openExternal(switchResponse.verificationUrl);

      const terminalStatus = await pollAuthStatus(
        client,
        switchResponse.sessionId,
        pollIntervalMs,
      );

      if (terminalStatus.status === 'complete') {
        safeSetFlow({
          provider,
          status: 'complete',
          sessionId: switchResponse.sessionId,
          userCode: switchResponse.userCode,
          verificationUrl: switchResponse.verificationUrl,
        });
        await queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
        return terminalStatus;
      }

      const error = new OAuthFlowError(
        authStatusErrorMessage(terminalStatus),
        terminalStatus,
      );
      safeSetFlow({
        provider,
        status: terminalStatus.status,
        sessionId: switchResponse.sessionId,
        userCode: switchResponse.userCode,
        verificationUrl: switchResponse.verificationUrl,
        error: error.message,
      });
      throw error;
    },
    onError: (error) => {
      setFlow((currentFlow) => {
        if (currentFlow.status === 'error' || currentFlow.status === 'expired') {
          return currentFlow;
        }

        return {
          provider,
          status: 'error',
          sessionId: currentFlow.sessionId,
          userCode: currentFlow.userCode,
          verificationUrl: currentFlow.verificationUrl,
          error: errorToMessage(error),
        };
      });
    },
  });

  const reset = useCallback(() => {
    mutation.reset();
    setFlow({ status: 'idle' });
  }, [mutation]);

  return {
    ...mutation,
    flow,
    start: mutation.mutate,
    startAsync: mutation.mutateAsync,
    reset,
  };
}

function deriveProviderStatus({
  provider,
  title,
  description,
  rawStatus,
  quotaAuthenticated,
  isLoading,
  error,
}: {
  provider: AuthProvider;
  title: string;
  description: string;
  rawStatus: string | undefined;
  quotaAuthenticated: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
}): ProviderCardStatus {
  const connected = isReadyStatus(rawStatus) || quotaAuthenticated === true;

  return {
    provider,
    title,
    description,
    connected,
    statusText: providerStatusText({ connected, rawStatus, quotaAuthenticated, isLoading, error }),
    rawStatus,
    quotaAuthenticated,
    isLoading,
    isError: error !== null,
    error,
  };
}

async function pollAuthStatus(
  client: OAuthClient,
  sessionId: string,
  pollIntervalMs: number,
): Promise<AuthStatusResponse> {
  let status = await client.authStatus(sessionId);

  while (status.status === 'pending') {
    await delay(pollIntervalMs);
    status = await client.authStatus(sessionId);
  }

  return status;
}

function isReadyStatus(status: string | undefined): boolean {
  return status?.toLowerCase() === 'ready';
}

function providerStatusText({
  connected,
  rawStatus,
  quotaAuthenticated,
  isLoading,
  error,
}: {
  connected: boolean;
  rawStatus: string | undefined;
  quotaAuthenticated: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
}): string {
  if (connected) {
    return 'Connected';
  }

  if (isLoading) {
    return 'Checking status…';
  }

  if (error) {
    return 'Status unavailable';
  }

  if (rawStatus) {
    return `Not connected (${rawStatus})`;
  }

  if (quotaAuthenticated === false) {
    return 'Not connected';
  }

  return 'Not connected';
}

function firstError(...errors: Array<Error | null>): Error | null {
  return errors.find((error): error is Error => error !== null) ?? null;
}

function defaultOpenExternal(url: string): Promise<void> {
  return window.imahe.openExternal(url);
}

function authStatusErrorMessage(authStatus: AuthStatusResponse): string {
  if (authStatus.error) {
    return authStatus.error;
  }

  if (authStatus.status === 'expired') {
    return 'The sign-in code expired. Try signing in again.';
  }

  return 'Sign-in failed. Try signing in again.';
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Sign-in failed. Try signing in again.';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
