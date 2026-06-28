import {
  asyncGenerationResponseSchema,
  authStatusResponseSchema,
  authSwitchResponseSchema,
  cancelJobResponseSchema,
  deleteAssetResponseSchema,
  generateRequestSchema,
  grokStatusResponseSchema,
  historyResponseSchema,
  ima2HealthSchema,
  inflightResponseSchema,
  multimodeRequestSchema,
  nodeGenerateAsyncResponseSchema,
  nodeGenerateRequestSchema,
  nodeResponseSchema,
  oauthStatusResponseSchema,
  providersRuntimeResponseSchema,
  quotaResponseSchema,
  restoreAssetResponseSchema,
  type AsyncGenerationResponse,
  type AuthProvider,
  type AuthStatusResponse,
  type AuthSwitchResponse,
  type CancelJobResponse,
  type DeleteAssetResponse,
  type GenerateRequest,
  type GrokStatusResponse,
  type HistoryResponse,
  type Ima2Health,
  type InflightResponse,
  type MultimodeRequest,
  type NodeGenerateAsyncResponse,
  type NodeGenerateRequest,
  type NodeResponse,
  type OAuthStatusResponse,
  type ProvidersRuntimeResponse,
  type QuotaResponse,
  type RestoreAssetResponse,
} from './schemas';

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type GetBaseUrl = () => Promise<string | null> | string | null;
type ResponseSchema<T> = {
  parse: (payload: unknown) => T;
};

export type GenerateParams = Omit<GenerateRequest, 'async' | 'requestId'> & {
  async?: true;
  requestId?: string;
};

export type MultimodeParams = Omit<MultimodeRequest, 'async' | 'requestId'> & {
  async?: true;
  requestId?: string;
};

export type NodeGenerateParams = Omit<NodeGenerateRequest, 'async' | 'requestId'> & {
  async?: true;
  requestId?: string;
};

export type InflightParams = {
  includeTerminal?: boolean;
  kind?: string;
  sessionId?: string;
};

export type HistoryParams = {
  limit?: number;
  before?: number | string;
  beforeFilename?: string;
  since?: number | string;
  sessionId?: string;
  requestId?: string;
  favoritesOnly?: boolean;
  groupBy?: 'session';
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

  generate(params: GenerateParams): Promise<AsyncGenerationResponse> {
    const body = generateRequestSchema.parse({
      ...params,
      async: true,
      requestId: params.requestId ?? createRequestId(),
    });

    return this.request('/api/generate', asyncGenerationResponseSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  multimode(params: MultimodeParams): Promise<AsyncGenerationResponse> {
    const body = multimodeRequestSchema.parse({
      ...params,
      async: true,
      requestId: params.requestId ?? createRequestId(),
    });

    return this.request('/api/generate/multimode', asyncGenerationResponseSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  nodeGenerate(params: NodeGenerateParams): Promise<NodeGenerateAsyncResponse> {
    const body = nodeGenerateRequestSchema.parse({
      ...params,
      async: true,
      requestId: params.requestId ?? createRequestId(),
    });

    return this.request('/api/node/generate', nodeGenerateAsyncResponseSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getNode(nodeId: string): Promise<NodeResponse> {
    return this.request(`/api/node/${encodeURIComponent(nodeId)}`, nodeResponseSchema);
  }

  inflight(params: InflightParams = {}): Promise<InflightResponse> {
    return this.request(buildInflightPath(params), inflightResponseSchema);
  }

  cancelJob(requestId: string): Promise<CancelJobResponse> {
    return this.request(
      `/api/inflight/${encodeURIComponent(requestId)}`,
      cancelJobResponseSchema,
      { method: 'DELETE' },
    );
  }

  history(params: HistoryParams = {}): Promise<HistoryResponse> {
    return this.request(buildHistoryPath(params), historyResponseSchema);
  }

  deleteAsset(filename: string): Promise<DeleteAssetResponse> {
    return this.request(
      `/api/history/${encodeURIComponent(filename)}`,
      deleteAssetResponseSchema,
      { method: 'DELETE' },
    );
  }

  restoreAsset(filename: string, trashId: string): Promise<RestoreAssetResponse> {
    return this.request(
      `/api/history/${encodeURIComponent(filename)}/restore`,
      restoreAssetResponseSchema,
      {
        method: 'POST',
        body: JSON.stringify({ trashId }),
      },
    );
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
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

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

function buildInflightPath(params: InflightParams) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'kind', params.kind);
  appendSearchParam(searchParams, 'sessionId', params.sessionId);

  if (params.includeTerminal !== undefined) {
    searchParams.set('includeTerminal', params.includeTerminal ? '1' : '0');
  }

  const query = searchParams.toString();
  return query ? `/api/inflight?${query}` : '/api/inflight';
}

function buildHistoryPath(params: HistoryParams) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'limit', params.limit);
  appendSearchParam(searchParams, 'before', params.before);
  appendSearchParam(searchParams, 'beforeFilename', params.beforeFilename);
  appendSearchParam(searchParams, 'since', params.since);
  appendSearchParam(searchParams, 'sessionId', params.sessionId);
  appendSearchParam(searchParams, 'requestId', params.requestId);
  appendSearchParam(searchParams, 'groupBy', params.groupBy);

  if (params.favoritesOnly !== undefined) {
    searchParams.set('favoritesOnly', params.favoritesOnly ? 'true' : 'false');
  }

  const query = searchParams.toString();
  return query ? `/api/history?${query}` : '/api/history';
}

function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value !== undefined) {
    searchParams.set(key, String(value));
  }
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `req_${globalThis.crypto.randomUUID()}`;
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
