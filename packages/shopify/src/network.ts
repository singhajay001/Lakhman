/**
 * Telling "the network would not let us out" apart from "Shopify said no".
 *
 * Both look like a failure at the call site and they need opposite responses: a rejected token
 * is a problem with the app's credentials, while a blocked host is a problem with the
 * container's egress policy and no amount of retrying will fix it. Getting this wrong is not
 * cosmetic. Measured in this environment, the two failure shapes are:
 *
 * **Through the proxy** (`NODE_USE_ENV_PROXY=1`), the call throws:
 *
 *     TypeError: fetch failed
 *       cause: Error: Request was cancelled.
 *         cause: AbortError: Proxy response (403) !== 200 when HTTP Tunneling  [UND_ERR_ABORTED]
 *
 * The thrown value is a `TypeError`, so a `thrown.name === 'AbortError'` check on it is false
 * and the failure reads as an ordinary transient error — three retries with backoff, then a
 * message naming nothing useful. The signature is two levels down the cause chain.
 *
 * **Without the proxy**, Node's `fetch` ignores `https_proxy` entirely, goes direct, and the
 * egress gateway answers with a real HTTP response:
 *
 *     403 Forbidden
 *     x-deny-reason: host_not_allowed
 *     Host not in allowlist: <host>. Add this host to your network egress settings...
 *
 * That 403 is indistinguishable from a rejected Admin token unless the header is read — so
 * without this, a blocked host reports as "your access token was rejected", which sends whoever
 * is debugging it to the Partner Dashboard instead of the network settings.
 *
 * On `NODE_USE_ENV_PROXY`: Node reads it once at startup to install its proxy-aware dispatcher.
 * Application code cannot switch it on afterwards, so nothing here tries to. What it does
 * instead is notice the combination that produces the confusing direct-403 — proxy variables
 * set, `NODE_USE_ENV_PROXY` unset — and say so in the diagnostic, because that is the actual
 * misconfiguration and it has a one-line fix.
 */

export interface ProxyEnvironment {
  /** The proxy URL that would be used for HTTPS, with any credentials removed. */
  httpsProxy: string | null;
  /** Whether Node was started with proxy support for `fetch`. */
  nodeUsesEnvProxy: boolean;
  noProxy: string | null;
  /**
   * True when proxy variables are set but Node will ignore them for `fetch`, which sends
   * outbound calls direct and makes an egress denial look like an authentication failure.
   */
  proxyConfiguredButUnused: boolean;
}

/** Strips any `user:password@` from a proxy URL so it can be logged. */
function redactProxyUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
      return `${url.toString()} (credentials redacted)`;
    }
    return url.toString();
  } catch {
    // Not a URL. Say that it is set without echoing something that might carry a secret.
    return '(set, but not a parseable URL)';
  }
}

export function describeProxyEnvironment(env: NodeJS.ProcessEnv = process.env): ProxyEnvironment {
  const raw = env.https_proxy ?? env.HTTPS_PROXY ?? null;
  const httpsProxy = raw ? redactProxyUrl(raw) : null;
  // Node treats any non-empty value as on, except an explicit "0".
  const flag = env.NODE_USE_ENV_PROXY;
  const nodeUsesEnvProxy = flag !== undefined && flag !== '' && flag !== '0';

  return {
    httpsProxy,
    nodeUsesEnvProxy,
    noProxy: env.no_proxy ?? env.NO_PROXY ?? null,
    proxyConfiguredButUnused: httpsProxy !== null && !nodeUsesEnvProxy,
  };
}

export type OutboundBlock =
  /** The proxy refused to open a tunnel to the host. */
  | { kind: 'proxy_tunnel_refused'; detail: string }
  /** The egress gateway answered the request itself with a denial. */
  | { kind: 'egress_denied'; detail: string };

/** Walks an error's cause chain, because the useful signature is never on the outermost error. */
function causeChain(thrown: unknown, limit = 5): Error[] {
  const chain: Error[] = [];
  let current: unknown = thrown;
  while (current instanceof Error && chain.length < limit) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

/**
 * Whether a thrown fetch failure was the network refusing to let the call out.
 *
 * Deliberately narrow: it matches the proxy's own tunnelling message rather than any abort or
 * any 403, so a genuine timeout or a real Shopify rejection is not mislabelled as a network
 * policy problem. A wrong answer here points whoever is debugging at the wrong system.
 */
export function classifyThrownOutbound(thrown: unknown): OutboundBlock | null {
  for (const error of causeChain(thrown)) {
    const message = error.message ?? '';
    if (/Proxy response \(\d+\) !== 200 when HTTP Tunneling/i.test(message)) {
      return { kind: 'proxy_tunnel_refused', detail: message };
    }
    if (/tunnel|CONNECT/i.test(message) && /refus|denied|forbidden|failed/i.test(message)) {
      return { kind: 'proxy_tunnel_refused', detail: message };
    }
    const code = (error as { code?: string }).code;
    if (code === 'ECONNREFUSED' && /proxy/i.test(message)) {
      return { kind: 'proxy_tunnel_refused', detail: message };
    }
  }
  return null;
}

/**
 * Whether a response came from the egress gateway rather than from Shopify.
 *
 * The gateway marks its denials with `x-deny-reason`. Without that header this returns null even
 * for a 403, because a 403 from Shopify is a real authentication failure and must keep reading
 * as one.
 */
export function classifyDeniedResponse(response: {
  status: number;
  headers: { get(name: string): string | null };
}): OutboundBlock | null {
  const reason = response.headers.get('x-deny-reason');
  if (!reason) return null;
  if (response.status !== 403 && response.status !== 407) return null;
  return {
    kind: 'egress_denied',
    detail: `the egress gateway refused this request (${reason})`,
  };
}

/**
 * What to tell whoever is reading the log. Names the host, what refused, and the one change
 * that would fix it — including the `NODE_USE_ENV_PROXY` case, which is the one that otherwise
 * presents as an authentication failure.
 */
export function outboundDiagnostic(
  host: string,
  block: OutboundBlock,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const proxy = describeProxyEnvironment(env);
  const lines = [
    block.kind === 'proxy_tunnel_refused'
      ? `The network proxy refused to open a connection to ${host} (${block.detail}).`
      : `The network gateway refused a request to ${host}: ${block.detail}.`,
    `This is the container's egress policy, not Shopify: no token, scope or API version would change it, and retrying will not help.`,
    `Add ${host} to the environment's allowed hosts to reach it.`,
  ];

  if (proxy.proxyConfiguredButUnused) {
    lines.push(
      `Note also that ${proxy.httpsProxy} is configured but this process was not started with NODE_USE_ENV_PROXY, so Node's fetch is bypassing it and going direct. Start the process with NODE_USE_ENV_PROXY=1 so outbound calls use the proxy.`,
    );
  } else if (!proxy.httpsProxy) {
    lines.push('No HTTPS proxy is configured in this environment.');
  }

  return lines.join(' ');
}
