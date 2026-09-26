import { describe, expect, it } from 'vitest';
import {
  classifyDeniedResponse,
  classifyThrownOutbound,
  describeProxyEnvironment,
  outboundDiagnostic,
} from './network.js';

/**
 * The shapes below were taken from this container, not invented. They are what a refused
 * Shopify Admin host actually produces.
 */
const proxyTunnelFailure = () => {
  const inner = Object.assign(new Error('Proxy response (403) !== 200 when HTTP Tunneling'), {
    name: 'AbortError',
    code: 'UND_ERR_ABORTED',
  });
  const middle = Object.assign(new Error('Request was cancelled.'), { cause: inner, code: 0 });
  return Object.assign(new TypeError('fetch failed'), { cause: middle });
};

const deniedResponse = () => ({
  status: 403,
  headers: new Headers({ 'x-deny-reason': 'host_not_allowed', 'content-type': 'text/plain' }),
});

describe('recognising a refused proxy tunnel', () => {
  it('finds the signature two levels down the cause chain', () => {
    // The thrown value is a TypeError, so a `thrown.name === "AbortError"` check on it is
    // false. That is why this walks the chain.
    const block = classifyThrownOutbound(proxyTunnelFailure());
    expect(block?.kind).toBe('proxy_tunnel_refused');
  });

  it('does not claim an ordinary timeout was a network block', () => {
    const timeout = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    expect(classifyThrownOutbound(timeout)).toBeNull();
  });

  it('does not claim an ordinary connection failure was a network block', () => {
    expect(
      classifyThrownOutbound(
        Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
        }),
      ),
    ).toBeNull();
  });

  it('tolerates a non-error and a cause cycle without hanging', () => {
    expect(classifyThrownOutbound('just a string')).toBeNull();
    const a = new Error('a');
    const b = new Error('b');
    Object.assign(a, { cause: b });
    Object.assign(b, { cause: a });
    expect(classifyThrownOutbound(a)).toBeNull();
  });
});

describe('recognising a gateway denial', () => {
  it('reads the deny header the gateway sets', () => {
    const block = classifyDeniedResponse(deniedResponse());
    expect(block?.kind).toBe('egress_denied');
    expect(block?.detail).toContain('host_not_allowed');
  });

  it('leaves a 403 from Shopify itself alone', () => {
    // Without the header this is a rejected token, and it has to keep reading as one.
    expect(
      classifyDeniedResponse({ status: 403, headers: new Headers({ 'x-request-id': 'abc' }) }),
    ).toBeNull();
  });

  it('ignores the header on a status that is not a denial', () => {
    expect(
      classifyDeniedResponse({ status: 200, headers: new Headers({ 'x-deny-reason': 'odd' }) }),
    ).toBeNull();
  });
});

describe('describing the proxy environment', () => {
  it('spots proxy variables that Node will ignore', () => {
    // The combination that makes an egress denial arrive as a plain 403, which then reads as
    // an authentication failure.
    const env = describeProxyEnvironment({
      https_proxy: 'http://127.0.0.1:8080',
    } as NodeJS.ProcessEnv);
    expect(env.proxyConfiguredButUnused).toBe(true);
    expect(env.nodeUsesEnvProxy).toBe(false);
  });

  it('treats an explicit zero as off', () => {
    const env = describeProxyEnvironment({
      https_proxy: 'http://127.0.0.1:8080',
      NODE_USE_ENV_PROXY: '0',
    } as NodeJS.ProcessEnv);
    expect(env.nodeUsesEnvProxy).toBe(false);
  });

  it('never echoes proxy credentials', () => {
    const env = describeProxyEnvironment({
      https_proxy: 'http://user:hunter2@proxy.internal:8080',
    } as NodeJS.ProcessEnv);
    expect(env.httpsProxy).not.toContain('hunter2');
    expect(env.httpsProxy).toContain('credentials redacted');
  });

  it('does not echo an unparseable proxy value, which might be a secret', () => {
    const env = describeProxyEnvironment({ https_proxy: 'hunter2' } as NodeJS.ProcessEnv);
    expect(env.httpsProxy).not.toContain('hunter2');
  });
});

describe('the diagnostic', () => {
  it('names the host, rules out Shopify, and says retrying will not help', () => {
    const block = classifyThrownOutbound(proxyTunnelFailure());
    const message = outboundDiagnostic('x.myshopify.com', block!, {} as NodeJS.ProcessEnv);
    expect(message).toContain('x.myshopify.com');
    expect(message).toContain('not Shopify');
    expect(message).toContain('retrying will not help');
  });

  it('points at NODE_USE_ENV_PROXY when that is the actual misconfiguration', () => {
    const block = classifyDeniedResponse(deniedResponse());
    const message = outboundDiagnostic('x.myshopify.com', block!, {
      https_proxy: 'http://127.0.0.1:8080',
    } as NodeJS.ProcessEnv);
    expect(message).toContain('NODE_USE_ENV_PROXY');
  });
});
