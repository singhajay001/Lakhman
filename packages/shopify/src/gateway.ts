import { childLogger } from '@spirithaus/observability';
import { AdminClient, type AdminError, type AdminResult } from './admin-client.js';
import { ADMIN_API_VERSION } from './queries.js';
import { describeProxyEnvironment } from './network.js';

/**
 * Reaching the Admin API when it may not be reachable.
 *
 * Two things stop an Admin call from happening in this environment, and neither is a bug:
 * OAuth has never been completed, so `PrismaSessionStorage` has no offline session to hand out;
 * and `*.myshopify.com` is refused by the container's egress policy, so even a real token would
 * not get out. Background work has to survive both without crashing the worker.
 *
 * What it must not do is pretend. A mutation that reports success without having happened is the
 * single most dangerous failure mode in this system: operations would believe inventory was
 * checked or a tag was written, act on it, and only find out later. Section 21 forbids
 * simulating an outcome, and the provider mocks already establish the shape — `mock: true`,
 * `verified: false`, publishers returning `published: false`.
 *
 * So a sandboxed call returns `outcome: 'sandboxed'`, never `outcome: 'applied'`. The three
 * cases are a discriminated union with no field named `success`, which means the compiler makes
 * every caller decide what to do when the write did not happen. That is the whole point: the
 * call does not throw, the worker does not die, and nothing downstream can mistake a bypassed
 * mutation for a completed one.
 */

export interface AdminSessionContainer {
  shopDomain: string;
  /** Null under a mock session. There is no token to use, and none is invented. */
  accessToken: string | null;
  /** True when this container stands in for a session that could not be obtained. */
  isMock: boolean;
  /** Why it is a mock, in words that name the thing to fix. Null on a live session. */
  reason: string | null;
}

/** How the gateway finds an offline token. A port, so the worker and the app share this code. */
export type OfflineSessionLookup = (shopDomain: string) => Promise<string | null>;

export type ReadOutcome<T> =
  | { outcome: 'read'; data: T }
  | { outcome: 'sandboxed'; reason: string }
  | { outcome: 'failed'; error: AdminError };

/**
 * The result of a mutation.
 *
 * `applied` is the only value that means the write reached Shopify. `sandboxed` means it did
 * not happen and nothing changed. There is deliberately no boolean called `success` to
 * misread, and no default case: a caller that ignores `sandboxed` will not compile.
 */
export type MutationOutcome<T> =
  | { outcome: 'applied'; data: T }
  | { outcome: 'sandboxed'; reason: string }
  | { outcome: 'failed'; error: AdminError };

export const SANDBOX_MUTATION_LOG =
  '[SANDBOX] Outbound mutation bypassed due to network proxy isolation';

export interface GatewayOptions {
  shopDomain: string;
  lookupOfflineToken: OfflineSessionLookup;
  apiVersion?: string;
  /** Injected for tests; the real one is built from the resolved session. */
  clientFactory?: (session: AdminSessionContainer) => AdminClient;
}

/**
 * Resolves a session once, then routes reads and mutations through it.
 *
 * The session is resolved lazily and cached for the life of the gateway, because a job that
 * makes twenty calls should not make twenty session lookups, and because the reason a session
 * is mock does not change mid-job.
 */
export class ShopifyGateway {
  private session: AdminSessionContainer | null = null;
  private client: AdminClient | null = null;
  private readonly log = childLogger({ part: 'shopify-gateway' });

  constructor(private readonly options: GatewayOptions) {}

  /**
   * The session this gateway will act as.
   *
   * Never throws and never returns null: when no offline token exists, it returns a container
   * flagged `isMock` carrying the reason, so a caller can report *why* it is degraded instead of
   * reporting that something is missing.
   */
  async resolveSession(): Promise<AdminSessionContainer> {
    if (this.session) return this.session;

    let token: string | null = null;
    let lookupError: string | null = null;
    try {
      token = await this.options.lookupOfflineToken(this.options.shopDomain);
    } catch (thrown) {
      // A database that cannot answer is not a reason to take down a worker, but it is a
      // different reason from "no session", so it is reported separately.
      lookupError = thrown instanceof Error ? thrown.message : String(thrown);
      this.log.warn(
        { shop: this.options.shopDomain, error: lookupError },
        'session lookup failed; continuing in sandbox mode',
      );
    }

    if (token) {
      this.session = {
        shopDomain: this.options.shopDomain,
        accessToken: token,
        isMock: false,
        reason: null,
      };
      return this.session;
    }

    const proxy = describeProxyEnvironment();
    const reason = lookupError
      ? `The session store could not be read (${lookupError}), so no offline token is available for ${this.options.shopDomain}.`
      : `No offline session is stored for ${this.options.shopDomain}. OAuth has not been completed for this shop${
          proxy.httpsProxy && !proxy.nodeUsesEnvProxy
            ? ', and outbound calls are bypassing the configured proxy (NODE_USE_ENV_PROXY is not set), so the handshake could not complete from here'
            : ''
        }.`;

    this.session = {
      shopDomain: this.options.shopDomain,
      accessToken: null,
      isMock: true,
      reason,
    };
    return this.session;
  }

  private async clientFor(session: AdminSessionContainer): Promise<AdminClient | null> {
    if (session.isMock || !session.accessToken) return null;
    if (!this.client) {
      this.client = this.options.clientFactory
        ? this.options.clientFactory(session)
        : new AdminClient({
            shopDomain: session.shopDomain,
            accessToken: session.accessToken,
            apiVersion: this.options.apiVersion ?? ADMIN_API_VERSION,
          });
    }
    return this.client;
  }

  /**
   * A read. Returns `sandboxed` rather than empty data, so a caller cannot mistake "we could not
   * ask" for "Shopify said there is nothing".
   */
  async read<T>(query: string, variables: Record<string, unknown> = {}): Promise<ReadOutcome<T>> {
    const session = await this.resolveSession();
    const client = await this.clientFor(session);

    if (!client) {
      this.log.warn(
        { shop: session.shopDomain },
        `[SANDBOX] Outbound read bypassed: ${session.reason ?? 'no live session'}`,
      );
      return { outcome: 'sandboxed', reason: session.reason ?? 'No live Admin session.' };
    }

    const result: AdminResult<T> = await client.query<T>(query, variables);
    if (result.ok) return { outcome: 'read', data: result.value.data };

    // A blocked host is a sandbox condition, not a failure the caller should treat as Shopify
    // refusing. Everything else stays a failure.
    if (result.error.class === 'network_blocked') {
      this.log.warn({ shop: session.shopDomain }, `[SANDBOX] ${result.error.message}`);
      return { outcome: 'sandboxed', reason: result.error.message };
    }
    return { outcome: 'failed', error: result.error };
  }

  /**
   * A mutation. Under a mock session, or against a blocked host, nothing is sent and the outcome
   * says so — it is never reported as applied.
   */
  async mutate<T>(
    description: string,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<MutationOutcome<T>> {
    const session = await this.resolveSession();
    const client = await this.clientFor(session);

    if (!client) {
      const reason = session.reason ?? 'No live Admin session.';
      this.log.warn(
        { shop: session.shopDomain, mutation: description, isMock: true },
        `${SANDBOX_MUTATION_LOG}: ${reason}`,
      );
      return { outcome: 'sandboxed', reason };
    }

    const result: AdminResult<T> = await client.query<T>(query, variables);
    if (result.ok) return { outcome: 'applied', data: result.value.data };

    if (result.error.class === 'network_blocked') {
      this.log.warn(
        { shop: session.shopDomain, mutation: description },
        `${SANDBOX_MUTATION_LOG}: ${result.error.message}`,
      );
      return { outcome: 'sandboxed', reason: result.error.message };
    }
    return { outcome: 'failed', error: result.error };
  }
}
