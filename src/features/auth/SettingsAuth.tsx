import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  type OAuthClient,
  type OAuthFlowState,
  type ProviderCardStatus,
  type ProviderStatusClient,
  useProviderStatuses,
  useStartOAuth,
} from './hooks';

export type SettingsAuthClient = OAuthClient & ProviderStatusClient;

type SettingsAuthProps = {
  client?: SettingsAuthClient;
  openExternal?: (url: string) => Promise<void>;
  pollIntervalMs?: number;
};

type ProviderCardProps = SettingsAuthProps & {
  status: ProviderCardStatus;
};

export function SettingsAuth({ client, openExternal, pollIntervalMs }: SettingsAuthProps = {}) {
  const { providers } = useProviderStatuses({ client });

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Connect OAuth providers for ima2 generation. imahe opens the provider page in
          your browser and waits for the sidecar to confirm the device-code sign-in.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProviderCard
          status={providers.codex}
          client={client}
          openExternal={openExternal}
          pollIntervalMs={pollIntervalMs}
        />
        <ProviderCard
          status={providers.grok}
          client={client}
          openExternal={openExternal}
          pollIntervalMs={pollIntervalMs}
        />
      </div>
    </section>
  );
}

function ProviderCard({ status, client, openExternal, pollIntervalMs }: ProviderCardProps) {
  const oauth = useStartOAuth(status.provider, { client, openExternal, pollIntervalMs });
  const effectiveConnected = status.connected || oauth.flow.status === 'complete';
  const actionLabel = getActionLabel(effectiveConnected, oauth.flow);
  const actionDisabled = oauth.flow.status === 'pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>{status.title}</CardTitle>
        <CardDescription>{status.description}</CardDescription>
        <CardAction>
          <p
            className={cn(
              'text-sm font-medium',
              !effectiveConnected && 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {effectiveConnected ? 'Connected' : status.statusText}
          </p>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ProviderDiagnostics status={status} />
        <OAuthFlowDetails flow={oauth.flow} />
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {effectiveConnected ? 'You can switch accounts at any time.' : 'No API key required.'}
        </p>
        <Button type="button" onClick={() => oauth.start()} disabled={actionDisabled}>
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProviderDiagnostics({ status }: ProviderCardProps) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground">Provider status</dt>
        <dd>{status.rawStatus ?? 'unknown'}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground">Quota authenticated</dt>
        <dd>{formatBoolean(status.quotaAuthenticated)}</dd>
      </div>
      {status.isError ? (
        <div className="flex flex-col gap-1 sm:col-span-2">
          <dt className="text-muted-foreground">Diagnostics</dt>
          <dd role="alert">{status.error?.message ?? 'Provider status is unavailable.'}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function OAuthFlowDetails({ flow }: { flow: OAuthFlowState }) {
  if (flow.status === 'idle') {
    return null;
  }

  if (flow.status === 'pending' && !flow.userCode) {
    return (
      <div className="rounded-lg bg-muted p-3 text-sm" aria-live="polite">
        Requesting a sign-in code…
      </div>
    );
  }

  if (flow.status === 'pending') {
    return (
      <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 text-sm" aria-live="polite">
        <div className="flex flex-col gap-1">
          <p className="font-medium">Enter this code in your browser</p>
          <code className="w-fit rounded-md bg-background px-2 py-1 font-mono text-base tracking-widest">
            {flow.userCode}
          </code>
        </div>
        <p className="text-muted-foreground">Waiting for browser verification…</p>
      </div>
    );
  }

  if (flow.status === 'complete') {
    return (
      <div className="rounded-lg bg-muted p-3 text-sm" aria-live="polite">
        Sign-in complete. Provider statuses are refreshing.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-sm" role="alert">
      <p className="font-medium">
        {flow.status === 'expired' ? 'The sign-in code expired.' : 'Sign-in failed.'}
      </p>
      <p className="text-muted-foreground">
        {flow.error ?? 'Try signing in again to start a fresh OAuth flow.'}
      </p>
    </div>
  );
}

function getActionLabel(connected: boolean, flow: OAuthFlowState): string {
  if (flow.status === 'pending') {
    return 'Waiting…';
  }

  if (flow.status === 'error' || flow.status === 'expired') {
    return 'Try again';
  }

  return connected ? 'Switch account' : 'Sign in';
}

function formatBoolean(value: boolean | undefined): string {
  if (value === true) {
    return 'yes';
  }

  if (value === false) {
    return 'no';
  }

  return 'unknown';
}
