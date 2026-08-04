import { SevDeskError } from './errors';

export const DEFAULT_BASE_URL = 'https://my.sevdesk.de/api/v1';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_USER_AGENT = '@genz-its/sevdesk-sdk';
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 500;
const RETRY_MAX_DELAY = 10_000;
const RETRY_AFTER_MAX_DELAY = 60_000;
const RETRYABLE_METHODS = new Set(['GET', 'PUT', 'DELETE']);
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export interface SevDeskOptions {
  /** The sevdesk API token, sent as raw `Authorization` header value. */
  token: string;
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
  userAgent?: string;
  fetch?: typeof globalThis.fetch;
}

export type QueryValue = string | number | boolean | string[] | undefined;

export type Query = Record<string, QueryValue>;

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Query;
  body?: unknown;
  formData?: FormData;
}

export class HttpClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(options: SevDeskOptions) {
    this.token = options.token.trim();
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  /**
   * Performs a request and returns the payload of the `objects` response
   * envelope. Responses without an envelope are returned as-is.
   */
  public async request<T>(options: HttpRequestOptions): Promise<T> {
    const response = await this.fetchWithRetry(options);
    const text = await response.text();
    if (text.length === 0) {
      return undefined as T;
    }
    return unwrap(JSON.parse(text)) as T;
  }

  private async fetchWithRetry(options: HttpRequestOptions): Promise<Response> {
    const url = this.buildUrl(options);
    const retryable = RETRYABLE_METHODS.has(options.method);
    for (let attempt = 0; ; attempt++) {
      const canRetry = retryable && attempt < RETRY_MAX_ATTEMPTS;
      let response: Response;
      try {
        response = await this.fetch(url, this.buildRequestInit(options));
      } catch (error) {
        if (canRetry) {
          await delay(backoffDelay(attempt));
          continue;
        }
        throw error;
      }
      if (response.ok) {
        return response;
      }
      if (canRetry && RETRYABLE_STATUS_CODES.has(response.status)) {
        await delay(
          retryAfterDelay(response.headers.get('Retry-After')) ??
            backoffDelay(attempt),
        );
        continue;
      }
      throw new SevDeskError({
        status: response.status,
        statusText: response.statusText,
        body: await parseErrorBody(response),
      });
    }
  }

  private buildUrl(options: HttpRequestOptions): string {
    const url = new URL(this.baseUrl + options.path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.append(
        key,
        Array.isArray(value) ? value.join(',') : String(value),
      );
    }
    return url.toString();
  }

  private buildRequestInit(options: HttpRequestOptions): RequestInit {
    const headers: Record<string, string> = {
      Authorization: this.token,
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    };
    let body: RequestInit['body'];
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    return {
      method: options.method,
      headers,
      body,
      signal: AbortSignal.timeout(this.timeout),
    };
  }
}

function unwrap(payload: unknown): unknown {
  if (typeof payload === 'object' && payload !== null && 'objects' in payload) {
    return (payload as { objects: unknown }).objects;
  }
  return payload;
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function backoffDelay(attempt: number): number {
  const ceiling = Math.min(RETRY_MAX_DELAY, RETRY_BASE_DELAY * 2 ** attempt);
  return ceiling / 2 + Math.random() * (ceiling / 2);
}

function retryAfterDelay(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }
  const seconds = Number(header);
  const milliseconds = Number.isFinite(seconds)
    ? seconds * 1000
    : new Date(header).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return undefined;
  }
  return Math.min(milliseconds, RETRY_AFTER_MAX_DELAY);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
