import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    port: Number(process.env.PORT ?? 3000),
    // Shopify tunnels the app over HTTPS; the dev server is behind it.
    allowedHosts: true,
  },
  ssr: {
    // The workspace packages publish source, so Vite transpiles them rather than
    // expecting a build step (docs/adr/0006).
    noExternal: [/^@spirithaus\//],
    // ...but not all the way down. Pulling a workspace package in also pulls in what it
    // depends on, and these are native or CommonJS Node modules that must not be bundled:
    // tesseract.js reads `__dirname`, which is undefined in the ESM server bundle, so
    // bundling it makes the built server throw on startup before it serves anything. The
    // build succeeded either way, which is why `pnpm verify` now also boots the server.
    external: ['sharp', 'tesseract.js', '@tesseract.js-data/eng'],
  },
});
