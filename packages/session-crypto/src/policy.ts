import { logger } from '@spirithaus/observability';
import { loadKeyRing, SessionKeyConfigError, type KeyRing } from './keys.js';

/**
 * What this process is allowed to do with session tokens, decided once at startup.
 *
 * The rule is fail-closed: anything that is not plainly a developer's machine must have a valid
 * key ring, or the process does not start. A misconfigured key that is discovered on the first
 * OAuth callback is a token written in plaintext to a database that nobody is watching.
 */
export interface SessionCryptoPolicy {
  keys: KeyRing | null;
  /**
   * Whether a stored value without the envelope marker may be read as a plaintext token.
   * Off unless explicitly enabled, and impossible in production.
   */
  allowPlaintextReads: boolean;
  /** True on a developer machine with no keys configured: tokens are stored as they were. */
  encryptionDisabled: boolean;
}

/** `NODE_ENV` values that are a developer's machine or a test run, and nothing else. */
const UNDEPLOYED = new Set(['development', 'test']);

export interface PolicyOptions {
  env?: NodeJS.ProcessEnv;
  /** Named for the log line, so a failure says which process refused to start. */
  component: string;
}

export function resolveSessionCryptoPolicy(options: PolicyOptions): SessionCryptoPolicy {
  const env = options.env ?? process.env;
  const nodeEnv = env.NODE_ENV ?? 'development';
  const deployed = !UNDEPLOYED.has(nodeEnv);

  const allowPlaintextRequested =
    (env.SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS ?? '').trim().toLowerCase() === 'true';

  // Checked before the key ring, so the answer to "why did it refuse" is the worse of the two
  // problems rather than whichever was tested first.
  if (deployed && allowPlaintextRequested) {
    throw new SessionKeyConfigError(
      `SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS is set in NODE_ENV=${nodeEnv}. Reading plaintext tokens is a migration aid for a developer machine and is refused in a deployed environment. Run the one-time migration instead: pnpm db:encrypt-sessions`,
    );
  }

  const keys = loadKeyRing(env, { required: deployed });

  if (!keys) {
    // Only reachable undeployed, because loadKeyRing throws otherwise.
    logger.warn(
      { component: options.component, nodeEnv },
      'session encryption is not configured; Shopify access tokens will be stored as given. This is refused outside development.',
    );
    return { keys: null, allowPlaintextReads: true, encryptionDisabled: true };
  }

  if (allowPlaintextRequested) {
    logger.warn(
      { component: options.component },
      'SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS is enabled: stored values without an envelope will be read as plaintext tokens. Migrate them and turn this off.',
    );
  }

  return { keys, allowPlaintextReads: allowPlaintextRequested, encryptionDisabled: false };
}

/**
 * Validates configuration and throws, without building anything.
 *
 * Called at startup by every process that can read or write a session, so a bad key ring stops
 * the process rather than surfacing on the first request that needs a token.
 */
export function assertSessionCryptoConfigured(options: PolicyOptions): SessionCryptoPolicy {
  try {
    return resolveSessionCryptoPolicy(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ component: options.component }, `refusing to start: ${message}`);
    throw error;
  }
}
