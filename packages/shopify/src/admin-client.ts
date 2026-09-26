import { err, ok, type Result } from '@spirithaus/domain';
import { childLogger } from '@spirithaus/observability';
import { classifyDeniedResponse, classifyThrownOutbound, outboundDiagnostic } from './network.js';

export type AdminErrorClass =
  | 'auth'
  | 'throttled'
  | 'user_error'
  | 'transient'
  | 'timeout'
  | 'unavailable'
  /**
   * The container's network refused to let the call out. Separate from `auth` because an
   * egress denial arrives as a 403 and would otherwise read as a rejected token, and separate
   * from `transient` because it is never worth retrying.
   */
  | 'network_blocked';

export interface AdminError {
  class: AdminErrorClass;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  requestId?: string;
}

export interface AdminResponse<T> {
  data: T;
  requestId?: string;
  /** Shopify's leaky-bucket state, when the response reported it. */
  cost?: { requested: number; actual: number; available: number; restoreRate: number };
}

export type AdminResult<T> = Result<AdminResponse<T>, AdminError>;

export interface AdminClientOptions {
  shopDomain: string;
  accessToken: string;
  /** Pinned, and recorded per response. Shopify deprecates versions on a schedule. */
  apiVersion: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface GraphQlBody<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: { currentlyAvailable: number; restoreRate: number };
    };
  };
}

/**
 * A thin Admin GraphQL client. Thin on purpose: the value it adds over fetch is
 * throttle handling, error classification and the request id, and everything else
 * belongs to the caller.
 */
export class AdminClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: AdminClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get endpoint(): string {
    return `https://${this.options.shopDomain}/admin/api/${this.options.apiVersion}/graphql.json`;
  }

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<AdminResult<T>> {
    const log = childLogger({ shop: this.options.shopDomain, apiVersion: this.options.apiVersion });
    let last: AdminError = { class: 'unavailable', message: 'never called', retryable: false };

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const outcome = await this.once<T>(query, variables);
      if (outcome.ok) return outcome;

      last = outcome.error;
      if (!outcome.error.retryable || attempt === this.maxAttempts) break;

      const delay = outcome.error.retryAfterMs ?? 500 * 2 ** (attempt - 1);
      log.warn(
        { attempt, errorClass: outcome.error.class, delay },
        'admin api call failed, retrying',
      );
      await this.sleep(delay);
    }

    return err(last);
  }

  private async once<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<AdminResult<T>> {
    const log = childLogger({
      shop: this.options.shopDomain,
      apiVersion: this.options.apiVersion,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.options.accessToken,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      const requestId = response.headers.get('x-request-id') ?? undefined;

      // Checked before the auth branch: when Node's fetch bypasses the proxy and goes direct,
      // the egress gateway answers a blocked host with its own 403. Read as authentication,
      // that sends whoever is debugging to the Partner Dashboard over a network setting.
      const denied = classifyDeniedResponse(response);
      if (denied) {
        const message = outboundDiagnostic(this.options.shopDomain, denied);
        log.warn({ block: denied.kind, status: response.status }, message);
        return { ok: false, error: { class: 'network_blocked', message, retryable: false } };
      }

      if (response.status === 401 || response.status === 403) {
        return err({
          class: 'auth',
          message: `Shopify rejected the access token (${response.status}). The app may need reinstalling.`,
          retryable: false,
          requestId,
        });
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '2');
        return err({
          class: 'throttled',
          message: 'Shopify rate limit reached.',
          retryable: true,
          retryAfterMs: Math.max(1000, retryAfter * 1000),
          requestId,
        });
      }

      if (response.status >= 500) {
        return err({
          class: 'transient',
          message: `Shopify returned ${response.status}.`,
          retryable: true,
          requestId,
        });
      }

      const body = (await response.json()) as GraphQlBody<T>;

      if (body.errors?.length) {
        const throttled = body.errors.some((e) => e.extensions?.code === 'THROTTLED');
        return err({
          class: throttled ? 'throttled' : 'user_error',
          message: body.errors.map((e) => e.message).join('; '),
          retryable: throttled,
          retryAfterMs: throttled ? 2000 : undefined,
          requestId,
        });
      }

      if (!body.data) {
        return err({
          class: 'unavailable',
          message: 'Shopify returned neither data nor errors.',
          retryable: false,
          requestId,
        });
      }

      const cost = body.extensions?.cost;
      return ok({
        data: body.data,
        requestId,
        cost: cost
          ? {
              requested: cost.requestedQueryCost,
              actual: cost.actualQueryCost,
              available: cost.throttleStatus.currentlyAvailable,
              restoreRate: cost.throttleStatus.restoreRate,
            }
          : undefined,
      });
    } catch (thrown) {
      // Order matters. A refused proxy tunnel surfaces as a TypeError wrapping an AbortError,
      // so checking for an abort first would report a network policy denial as a timeout.
      const blocked = classifyThrownOutbound(thrown);
      if (blocked) {
        const message = outboundDiagnostic(this.options.shopDomain, blocked);
        log.warn({ block: blocked.kind }, message);
        return { ok: false, error: { class: 'network_blocked', message, retryable: false } };
      }

      const aborted = thrown instanceof Error && thrown.name === 'AbortError';
      return err({
        class: aborted ? 'timeout' : 'transient',
        message: aborted ? `Request exceeded ${this.timeoutMs}ms` : String(thrown),
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
