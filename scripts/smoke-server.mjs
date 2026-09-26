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
    response = await fetch(`${BASE}/auth/shopify/callback`);
  } catch {
    // Not listening yet.
  }

  if (response) {
    const body = await response.text();
    // A callback with no parameters is rejected by the route's own preflight, so 400 proves
    // the server booted, the route table is wired and the handler ran.
    failure =
      response.status === 400
        ? null
        : `Expected 400 from the callback probe, got ${response.status}: ${body}`;
    if (failure === null) {
      console.log(`smoke: server booted and answered the callback probe with ${response.status}`);
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
