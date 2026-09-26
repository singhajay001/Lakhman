import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Session } from '@shopify/shopify-api';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { prisma } from '@spirithaus/db';
import { EncryptedSessionStorage } from './storage.js';
import { isEncryptedEnvelope, encryptToken } from './envelope.js';
import { resolveSessionCryptoPolicy } from './policy.js';

/**
 * Encryption through the real session storage against a real database.
 *
 * The unit tests prove the envelope. This proves the thing that actually matters: that store,
 * load, findSessionsByShop and delete all work end to end, and that the column genuinely holds
 * ciphertext afterwards.
 */
const KEY_A = Buffer.alloc(32, 0xa1).toString('base64');
const KEY_B = Buffer.alloc(32, 0xb2).toString('base64');

const policyFor = (env: Record<string, string>) =>
  resolveSessionCryptoPolicy({
    env: { NODE_ENV: 'test', ...env } as NodeJS.ProcessEnv,
    component: 'test',
  });

const CURRENT = { SESSION_ENCRYPTION_KEYS: `k1:${KEY_A}`, SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1' };

const storage = (env: Record<string, string>) =>
  new EncryptedSessionStorage(new PrismaSessionStorage(prisma), policyFor(env));

const TOKEN = 'shpat_not_a_real_token_0123456789';

function session(overrides: Partial<Session> & { id: string }): Session {
  return new Session({
    shop: 'encrypt-test.myshopify.com',
    state: 'nonce',
    isOnline: false,
    accessToken: TOKEN,
    scope: 'read_products',
    ...overrides,
  });
}

const rawToken = async (id: string): Promise<string> =>
  (await prisma.session.findUniqueOrThrow({ where: { id }, select: { accessToken: true } }))
    .accessToken;

beforeEach(async () => {
  await prisma.session.deleteMany({ where: { shop: 'encrypt-test.myshopify.com' } });
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { shop: 'encrypt-test.myshopify.com' } });
  await prisma.$disconnect();
});

describe('storing and loading through the real session storage', () => {
  it('writes ciphertext and reads back the token', async () => {
    const store = storage(CURRENT);
    await store.storeSession(session({ id: 'offline_1' }));

    // The column is what matters: anyone reading the database must not find a usable credential.
    const stored = await rawToken('offline_1');
    expect(isEncryptedEnvelope(stored)).toBe(true);
    expect(stored).not.toContain(TOKEN);

    const loaded = await store.loadSession('offline_1');
    expect(loaded?.accessToken).toBe(TOKEN);
  });

  it('encrypts an online session too, not only an offline one', async () => {
    // An online token is a live credential for as long as it lives. The library stores both
    // through the same interface, and so does this.
    const store = storage(CURRENT);
    await store.storeSession(
      session({ id: 'online_1', isOnline: true, expires: new Date(Date.now() + 3_600_000) }),
    );

    expect(isEncryptedEnvelope(await rawToken('online_1'))).toBe(true);
    const loaded = await store.loadSession('online_1');
    expect(loaded?.isOnline).toBe(true);
    expect(loaded?.accessToken).toBe(TOKEN);
  });

  it('encrypts the refresh token, which is the more valuable credential', async () => {
    // The refresh token mints access tokens. Encrypting one and leaving the other beside it in
    // plaintext would protect nothing.
    //
    // This column did not exist until the storage was exercised against the real library, which
    // failed every storeSession with "Unknown argument `refreshToken`" — OAuth could never have
    // persisted a session.
    const store = storage(CURRENT);
    const withRefresh = session({ id: 'refresh_1' });
    withRefresh.refreshToken = 'shprt_also_not_real_987654321';
    await store.storeSession(withRefresh);

    const row = await prisma.session.findUniqueOrThrow({
      where: { id: 'refresh_1' },
      select: { accessToken: true, refreshToken: true },
    });
    expect(isEncryptedEnvelope(row.accessToken)).toBe(true);
    expect(isEncryptedEnvelope(row.refreshToken as string)).toBe(true);
    expect(row.refreshToken).not.toContain('shprt_also_not_real');

    const loaded = await store.loadSession('refresh_1');
    expect(loaded?.accessToken).toBe(TOKEN);
    expect(loaded?.refreshToken).toBe('shprt_also_not_real_987654321');
  });

  it('refuses the whole session when the refresh token cannot be opened', async () => {
    const store = storage(CURRENT);
    const withRefresh = session({ id: 'refresh_broken' });
    withRefresh.refreshToken = 'shprt_also_not_real_987654321';
    await store.storeSession(withRefresh);

    await prisma.session.update({
      where: { id: 'refresh_broken' },
      data: { refreshToken: encryptToken('x', { id: 'k1', material: Buffer.alloc(32, 0xdd) }) },
    });
    expect(await store.loadSession('refresh_broken')).toBeUndefined();
  });

  it('leaves a session with no token alone', async () => {
    // Session.accessToken is optional and the column is NOT NULL, so the library writes ''.
    // An envelope around nothing is just a longer nothing.
    const store = storage(CURRENT);
    const withoutToken = session({ id: 'no_token' });
    withoutToken.accessToken = undefined;
    await store.storeSession(withoutToken);

    expect(await rawToken('no_token')).toBe('');
    const loaded = await store.loadSession('no_token');
    expect(loaded?.accessToken).toBeFalsy();
  });

  it('does not mutate the session it was handed', async () => {
    // The library reuses instances; a caller holding a reference must not find its plaintext
    // token replaced by ciphertext.
    const store = storage(CURRENT);
    const original = session({ id: 'not_mutated' });
    await store.storeSession(original);
    expect(original.accessToken).toBe(TOKEN);
  });

  it('does not double-encrypt a session that is stored again', async () => {
    const store = storage(CURRENT);
    await store.storeSession(session({ id: 'twice' }));
    const loaded = await store.loadSession('twice');
    await store.storeSession(loaded as Session);

    expect((await rawToken('twice')).split('.')).toHaveLength(6);
    expect((await store.loadSession('twice'))?.accessToken).toBe(TOKEN);
  });

  it('finds sessions by shop and decrypts each one', async () => {
    const store = storage(CURRENT);
    await store.storeSession(session({ id: 'by_shop_1' }));
    await store.storeSession(session({ id: 'by_shop_2', isOnline: true }));

    const found = await store.findSessionsByShop('encrypt-test.myshopify.com');
    expect(found).toHaveLength(2);
    for (const entry of found) expect(entry.accessToken).toBe(TOKEN);
  });

  it('deletes without needing to decrypt', async () => {
    const store = storage(CURRENT);
    await store.storeSession(session({ id: 'delete_me' }));
    expect(await store.deleteSession('delete_me')).toBe(true);
    expect(await store.loadSession('delete_me')).toBeUndefined();
  });

  it('deletes many, which is what uninstall does', async () => {
    const store = storage(CURRENT);
    await store.storeSession(session({ id: 'bulk_1' }));
    await store.storeSession(session({ id: 'bulk_2' }));
    await store.deleteSessions(['bulk_1', 'bulk_2']);
    expect(await prisma.session.count({ where: { shop: 'encrypt-test.myshopify.com' } })).toBe(0);
  });
});

describe('rotation through the storage', () => {
  it('reads a session encrypted with a retired key and rewrites it with the current one', async () => {
    const old = policyFor({
      SESSION_ENCRYPTION_KEYS: `k0:${KEY_B}`,
      SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k0',
    });
    await new EncryptedSessionStorage(new PrismaSessionStorage(prisma), old).storeSession(
      session({ id: 'rotate_me' }),
    );
    expect((await rawToken('rotate_me')).split('.')[2]).toBe('k0');

    // k1 is current; k0 stays in the ring so existing values keep opening.
    const rotated = storage({
      SESSION_ENCRYPTION_KEYS: `k0:${KEY_B},k1:${KEY_A}`,
      SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1',
    });
    expect((await rotated.loadSession('rotate_me'))?.accessToken).toBe(TOKEN);

    // Re-encryption is fire-and-forget so a read is never blocked by a write.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((await rawToken('rotate_me')).split('.')[2]).toBe('k1');
    expect((await rotated.loadSession('rotate_me'))?.accessToken).toBe(TOKEN);
  });

  it('refuses a session whose key has been retired rather than returning ciphertext', async () => {
    const old = policyFor({
      SESSION_ENCRYPTION_KEYS: `k0:${KEY_B}`,
      SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k0',
    });
    await new EncryptedSessionStorage(new PrismaSessionStorage(prisma), old).storeSession(
      session({ id: 'orphaned' }),
    );

    // Handing back the ciphertext would send an unreadable string to Shopify and produce an
    // authentication error naming the wrong cause.
    expect(await storage(CURRENT).loadSession('orphaned')).toBeUndefined();
  });
});

describe('legacy plaintext', () => {
  const writePlaintext = (id: string) =>
    prisma.session.create({
      data: {
        id,
        shop: 'encrypt-test.myshopify.com',
        state: 'nonce',
        isOnline: false,
        accessToken: TOKEN,
      },
    });

  it('is refused by default, rather than silently accepted forever', async () => {
    await writePlaintext('legacy_refused');
    expect(await storage(CURRENT).loadSession('legacy_refused')).toBeUndefined();
  });

  it('is readable only when the switch is explicitly on', async () => {
    await writePlaintext('legacy_allowed');
    const permissive = storage({ ...CURRENT, SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS: 'true' });
    expect((await permissive.loadSession('legacy_allowed'))?.accessToken).toBe(TOKEN);
  });

  it('is encrypted in place by the one-time migration', async () => {
    await writePlaintext('legacy_migrated');
    const { encryptStoredSessions } = await import('@spirithaus/db/encrypt-sessions');

    const previous = { ...process.env };
    Object.assign(process.env, CURRENT, { NODE_ENV: 'test' });
    try {
      const counts = await encryptStoredSessions(true);
      expect(counts.encrypted).toBeGreaterThanOrEqual(1);
    } finally {
      process.env = previous;
    }

    expect(isEncryptedEnvelope(await rawToken('legacy_migrated'))).toBe(true);
    expect((await storage(CURRENT).loadSession('legacy_migrated'))?.accessToken).toBe(TOKEN);
  });
});

describe('a tampered row', () => {
  it('is refused, and the session does not load', async () => {
    const store = storage(CURRENT);
    await store.storeSession(session({ id: 'tampered' }));

    const parts = (await rawToken('tampered')).split('.');
    const ciphertext = Buffer.from(parts[5] as string, 'base64url');
    ciphertext[0] = (ciphertext[0] as number) ^ 0xff;
    parts[5] = ciphertext.toString('base64url');
    await prisma.session.update({
      where: { id: 'tampered' },
      data: { accessToken: parts.join('.') },
    });

    expect(await store.loadSession('tampered')).toBeUndefined();
  });

  it('is refused when encrypted under a foreign key', async () => {
    const store = storage(CURRENT);
    await store.storeSession(session({ id: 'foreign' }));
    await prisma.session.update({
      where: { id: 'foreign' },
      data: { accessToken: encryptToken(TOKEN, { id: 'k1', material: Buffer.alloc(32, 0xcc) }) },
    });
    expect(await store.loadSession('foreign')).toBeUndefined();
  });
});
