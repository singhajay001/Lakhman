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
  // The workspace packages publish source, so Vite transpiles them rather than
  // expecting a build step (docs/adr/0006).
  ssr: { noExternal: [/^@spirithaus\//] },
});
