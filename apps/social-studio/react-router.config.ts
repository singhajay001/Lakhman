import type { Config } from '@react-router/dev/config';

export default {
  // Server-rendered: an embedded Shopify app authenticates every request against a
  // session token, which is server work.
  ssr: true,
} satisfies Config;
