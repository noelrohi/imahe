import {
  authStatusResponseSchema,
  authSwitchResponseSchema,
  grokStatusResponseSchema,
  ima2HealthSchema,
  oauthStatusResponseSchema,
  providersRuntimeResponseSchema,
  quotaResponseSchema,
  type AuthProvider,
  type AuthStatusResponse,
  type AuthSwitchResponse,
  type GrokStatusResponse,
  type Ima2Health,
  type OAuthStatusResponse,
  type ProvidersRuntimeResponse,
  type QuotaResponse,
} from './schemas';

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type GetBaseUrl = () => Promise<string | null> | string | null;
type ResponseSchema<T> = {
  parse: (payload: unknown) => T;
};

export type Ima2ClientOptions = {
  fetchImpl?: FetchImpl;
  getBaseUrl?: GetBaseUrl;
};

export class Ima2HttpError extends Error {
  readonly body: string | undefined;
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string, body?: string) {
    super(`ima2 request failed with ${status}${statusText ? ` ${statusText}` : ''}`);
    this.name = 'Ima2HttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class Ima2UnavailableError extends Error {
  constructor() {
    super('ima2 sidecar base URL is not available.');
    this.name = 'Ima2UnavailableError';
  }
}

export class Ima2Client {
  private readonly fetchImpl: FetchImpl;
  private readonly getBaseUrl: GetBaseUrl;

  constructor(options: Ima2ClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? defaultFetchImpl;
    this.getBaseUrl = options.getBaseUrl ?? getWindowSidecarBaseUrl;
  }

  health(): Promise<Ima2Health> {
    return this.request('/api/health', ima2HealthSchema);
  }

  authSwitch(provider: AuthProvider): Promise<AuthSwitchResponse> {
    return this.request('/api/auth/switch', authSwitchResponseSchema, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider }),
    });
  }

  authStatus(sessionId: string): Promise<AuthStatusResponse> {
    return this.request(
      `/api/auth/switch/${encodeURIComponent(sessionId)}`,
      authStatusResponseSchema,
    );
  }

  oauthStatus(): Promise<OAuthStatusResponse> {
    return this.request('/api/oauth/status', oauthStatusResponseSchema);
  }

  grokStatus(): Promise<GrokStatusResponse> {
    return this.request('/api/grok/status', grokStatusResponseSchema);
  }

  quota(): Promise<QuotaResponse> {
    return this.request('/api/quota', quotaResponseSchema);
  }

  providersRuntime(): Promise<ProvidersRuntimeResponse> {
    return this.request('/api/providers', providersRuntimeResponseSchema);
  }

  private async request<T>(
    pathname: string,
    schema: ResponseSchema<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const baseUrl = await this.getBaseUrl();

    if (!baseUrl) {
      throw new Ima2UnavailableError();
    }

    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    const response = await this.fetchImpl(new URL(pathname, baseUrl), {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Ima2HttpError(
        response.status,
        response.statusText,
        await readErrorBody(response),
      );
    }

    const payload: unknown = await response.json();
    return schema.parse(payload);
  }
}

export function createIma2Client(options: Ima2ClientOptions = {}) {
  return new Ima2Client(options);
}

export const ima2Client = createIma2Client();

function defaultFetchImpl(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}

function getWindowSidecarBaseUrl(): Promise<string | null> {
  return window.imahe.getSidecarBaseUrl();
}

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
