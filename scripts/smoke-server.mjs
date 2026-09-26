/**
 * Starts the built server and checks that it answers.
 *
 * `pnpm verify` built the app for three phases without ever running it, and a build that cannot
 * boot still builds: `tesseract.js` was bundled into the ESM server output, where its CommonJS
 * `__dirname` is undefined, so the production server threw on startup before serving anything.
 * Nothing caught that, because nothing started it.
 *
 * So this does the one thing the build cannot: boots the artefact and asks it a question. It
 * needs no Shopify, no network and no real credentials — the route it probes is the OAuth
 * callback, which answers a parameterless request with its own 400 and therefore proves the
 * server is up, the route table is wired and the handler runs.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = process.env.SMOKE_PORT ?? '3919';
const BASE = `http://127.0.0.1:${PORT}`;
const DEADLINE_MS = 45_000;

const server = spawn(
  'node',
  ['./node_modules/@react-router/serve/bin.js', './build/server/index.js'],
  {
    cwd: new URL('../apps/social-studio/', import.meta.url),
    env: {
      ...process.env,
      PORT,
      NODE_ENV: 'production',
      // Present but inert. The smoke check never reaches Shopify; these only have to satisfy the
      // startup checks that refuse to run without them.
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ?? 'smoke-test-key',
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ?? 'smoke-test-secret',
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ?? `http://127.0.0.1:${PORT}`,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://spirithaus:spirithaus@localhost:5432/spirithaus_dev?schema=public',
      // The app fails closed without a key ring (ADR 0014), so the smoke check supplies one.
      // Deterministic and obviously not real: 32 bytes of a repeating pattern, used nowhere else.
      SESSION_ENCRYPTION_KEYS:
        process.env.SESSION_ENCRYPTION_KEYS ?? `smoke:${Buffer.alloc(32, 0x5a).toString('base64')}`,
      SESSION_ENCRYPTION_CURRENT_KEY_ID: process.env.SESSION_ENCRYPTION_CURRENT_KEY_ID ?? 'smoke',
      // The app also fails closed without object storage, because a deployed process that fell
      // back to a local directory would write media the worker machine cannot read. These are
      // syntactically valid and deliberately unroutable: `.invalid` is reserved and resolves
      // nowhere, so a boot that succeeds proves the S3 client is constructed without contacting
      // any provider at module load. If that ever changes, this check hangs and then fails.
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? 'smoke-access-key-id',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? 'smoke-secret-access-key',
      AWS_ENDPOINT_URL_S3: process.env.AWS_ENDPOINT_URL_S3 ?? 'https://object-storage.invalid',
      AWS_REGION: process.env.AWS_REGION ?? 'auto',
      BUCKET_NAME: process.env.BUCKET_NAME ?? 'smoke-bucket',
      LOG_LEVEL: 'silent',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let output = '';
server.stdout.on('data', (chunk) => (output += chunk));
server.stderr.on('data', (chunk) => (output += chunk));

let exited = null;
server.on('exit', (code) => (exited = code));

/**
 * Always run before the process ends. `process.exit()` skips `finally`, which orphaned the
 * spawned server and left it listening — so the *next* run connected to the orphan and passed
 * against a build that could not boot. Found by deliberately breaking the build and watching
 * this pass anyway.
 */
const stop = () => {
  if (exited === null) server.kill('SIGKILL');
};

/** Set, never exited on directly, so cleanup always happens. */
let failure = null;
const started = Date.now();

while (Date.now() - started < DEADLINE_MS) {
  if (exited !== null) {
    failure = `The server exited with code ${exited} before answering.\n\n${output}`;
    break;
  }

  let response = null;
  try {
    // Loopback: an egress proxy would refuse it, and there is nothing external to reach.
    response = await fetch(`${BASE}/livez`);
  } catch {
    // Not listening yet.
  }

  if (response) {
    const body = await response.text();
    // /livez touches no dependency, so a 200 means the process is up and the route table is
    // wired — without needing a database or Redis to be reachable.
    if (response.status !== 200) {
      failure = `Expected 200 from /livez, got ${response.status}: ${body}`;
      break;
    }

    // The callback's own preflight rejects a request with no parameters, which proves a real
    // handler ran rather than a catch-all.
    const callback = await fetch(`${BASE}/auth/shopify/callback`);
    failure =
      callback.status === 400
        ? null
        : `Expected 400 from the callback probe, got ${callback.status}`;
    if (failure === null) {
      console.log('smoke: server booted, /livez answered 200 and the callback probe answered 400');
    }
    break;
  }

  await delay(500);
}

if (failure === null && Date.now() - started >= DEADLINE_MS) {
  failure = `The server did not answer within ${DEADLINE_MS}ms.\n\n${output}`;
}

stop();
// Give the kill a moment to land before the process ends, so nothing is left listening.
await delay(200);

if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
