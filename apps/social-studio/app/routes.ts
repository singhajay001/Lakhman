import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

/**
 * Explicit route configuration rather than file-name conventions: the section list in
 * app/lib/sections.ts is the navigation, and having the routes next to it makes a
 * missing screen a type error rather than a 404 nobody noticed.
 */
export default [
  index('routes/_index.tsx'),

  // OAuth. Handled by the Shopify library, which owns the callback shape.
  route('auth/*', 'routes/auth.$.tsx'),
  route('auth/login', 'routes/auth.login.tsx'),

  // Webhooks are outside the app layout: no session, no UI, HMAC verified first.
  route('webhooks/app', 'routes/webhooks.app.tsx'),
  route('webhooks/catalogue', 'routes/webhooks.catalogue.tsx'),
  route('webhooks/inventory', 'routes/webhooks.inventory.tsx'),
  route('webhooks/privacy', 'routes/webhooks.privacy.tsx'),

  layout('routes/app.tsx', [
    route('app', 'routes/app._index.tsx'),
    route('app/products', 'routes/app.products.tsx'),
    route('app/research', 'routes/app.research.tsx'),
    route('app/intelligence', 'routes/app.intelligence.tsx'),
    route('app/trends', 'routes/app.trends.tsx'),
    route('app/competitors', 'routes/app.competitors.tsx'),
    route('app/campaigns', 'routes/app.campaigns.tsx'),
    route('app/campaigns/:id', 'routes/app.campaigns.$id.tsx'),
    route('app/create', 'routes/app.create.tsx'),
    route('app/media', 'routes/app.media.tsx'),
    route('app/calendar', 'routes/app.calendar.tsx'),
    route('app/approvals', 'routes/app.approvals.tsx'),
    route('app/queue', 'routes/app.queue.tsx'),
    route('app/inbox', 'routes/app.inbox.tsx'),
    route('app/segments', 'routes/app.segments.tsx'),
    route('app/forecasting', 'routes/app.forecasting.tsx'),
    route('app/experiments', 'routes/app.experiments.tsx'),
    route('app/analytics', 'routes/app.analytics.tsx'),
    route('app/brand-kit', 'routes/app.brand-kit.tsx'),
    route('app/connections', 'routes/app.connections.tsx'),
    route('app/automation', 'routes/app.automation.tsx'),
    route('app/governance', 'routes/app.governance.tsx'),
    route('app/settings', 'routes/app.settings.tsx'),
    route('app/audit', 'routes/app.audit.tsx'),
  ]),
] satisfies RouteConfig;
