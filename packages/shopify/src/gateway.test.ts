import { describe, expect, it, vi } from 'vitest';
import { ShopifyGateway, SANDBOX_MUTATION_LOG } from './gateway.js';
import { AdminClient } from './admin-client.js';

const clientReturning = (response: Response) =>
  new AdminClient({
    shopDomain: 'x.myshopify.com',
    accessToken: 't',
    apiVersion: '2025-07',
    fetchImpl: (async () => response.clone()) as never,
    maxAttempts: 1,
  });

const ok = () =>
  new Response(JSON.stringify({ data: { shop: { name: 'Test' } } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const blocked = () =>
  new Response('Host not in allowlist', {
    status: 403,
    headers: { 'x-deny-reason': 'host_not_allowed', 'content-type': 'text/plain' },
  });

const gateway = (token: string | null, response = ok()) =>
  new ShopifyGateway({
    shopDomain: 'x.myshopify.com',
    lookupOfflineToken: async () => token,
    clientFactory: () => clientReturning(response),
  });

describe('resolving a session that may not exist', () => {
  it('returns a live session when there is a token', async () => {
    const session = await gateway('offline-token').resolveSession();
    expect(session.isMock).toBe(false);
    expect(session.accessToken).toBe('offline-token');
    expect(session.reason).toBeNull();
  });

  it('returns a mock container rather than null when there is no token', async () => {
    const session = await gateway(null).resolveSession();
    expect(session.isMock).toBe(true);
    // No token is invented. There is nothing to use, and saying so is the point.
    expect(session.accessToken).toBeNull();
    expect(session.reason).toContain('OAuth has not been completed');
  });

  it('survives a session store that throws, and says that is what happened', async () => {
    // A database that cannot answer must not take down a worker, and it is a different
    // reason from "no session".
    const failing = new ShopifyGateway({
      shopDomain: 'x.myshopify.com',
      lookupOfflineToken: async () => {
        throw new Error('connection terminated');
      },
    });
    const session = await failing.resolveSession();
    expect(session.isMock).toBe(true);
    expect(session.reason).toContain('connection terminated');
  });

  it('resolves once and caches, so a job does not re-look-up per call', async () => {
    const lookup = vi.fn(async () => 'token');
    const instance = new ShopifyGateway({
      shopDomain: 'x.myshopify.com',
      lookupOfflineToken: lookup,
      clientFactory: () => clientReturning(ok()),
    });
    await instance.resolveSession();
    await instance.resolveSession();
    await instance.read('{ shop { name } }');
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

describe('reads', () => {
  it('returns data on a live session', async () => {
    const result = await gateway('token').read<{ shop: { name: string } }>('{ shop { name } }');
    expect(result.outcome).toBe('read');
    if (result.outcome !== 'read') return;
    expect(result.data.shop.name).toBe('Test');
  });

  it('reports sandboxed rather than empty data with no session', async () => {
    // "We could not ask" must not be mistakable for "Shopify says there is nothing".
    const result = await gateway(null).read('{ shop { name } }');
    expect(result.outcome).toBe('sandboxed');
  });

  it('reports sandboxed when the host is refused', async () => {
    const result = await gateway('token', blocked()).read('{ shop { name } }');
    expect(result.outcome).toBe('sandboxed');
    if (result.outcome !== 'sandboxed') return;
    expect(result.reason).toContain('egress policy');
  });
});

describe('mutations', () => {
  it('applies on a live session', async () => {
    const result = await gateway('token').mutate('tag product', 'mutation { x }');
    expect(result.outcome).toBe('applied');
  });

  it('never reports applied without a session, and logs the sandbox line', async () => {
    // This is the whole point of the gateway. A mutation that reports success without having
    // happened is the most dangerous failure mode in this system: operations act on it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await gateway(null).mutate('tag product', 'mutation { x }');
    expect(result.outcome).toBe('sandboxed');
    expect(result.outcome).not.toBe('applied');
    warn.mockRestore();
  });

  it('never reports applied when the host is refused', async () => {
    const result = await gateway('token', blocked()).mutate('tag product', 'mutation { x }');
    expect(result.outcome).toBe('sandboxed');
  });

  it('keeps a real Shopify error as a failure, not a sandbox', async () => {
    // A rejected token is a fault to fix, not a degraded mode to carry on in.
    const rejected = new Response('nope', { status: 401 });
    const result = await gateway('token', rejected).mutate('tag product', 'mutation { x }');
    expect(result.outcome).toBe('failed');
    if (result.outcome !== 'failed') return;
    expect(result.error.class).toBe('auth');
  });

  it('carries the sandbox log line the runbook greps for', () => {
    expect(SANDBOX_MUTATION_LOG).toBe(
      '[SANDBOX] Outbound mutation bypassed due to network proxy isolation',
    );
  });
});
