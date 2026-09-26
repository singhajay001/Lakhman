import { AppProvider as ShopifyAppProvider } from '@shopify/shopify-app-react-router/react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { AppProvider as PolarisProvider, Banner, Frame, Navigation } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url';
import {
  Outlet,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useRouteError,
  type HeadersFunction,
  type LinksFunction,
  type LoaderFunctionArgs,
} from 'react-router';
import { permissionsFor } from '@spirithaus/domain';
import { SECTIONS } from '../lib/sections.js';
import { authenticateAdmin } from '../lib/principal.server.js';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: polarisStyles }];

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await authenticateAdmin(request);
  const granted = permissionsFor(context.principal.roles);

  return {
    apiKey: process.env.SHOPIFY_API_KEY ?? '',
    shop: context.shop,
    user: context.user,
    roles: context.principal.roles,
    missingScopes: context.missingScopes,
    // The navigation shows only what this person may open. A link that 403s is worse
    // than a link that is not there.
    sections: SECTIONS.filter((section) => granted.has(section.permission)).map((section) => ({
      path: section.path,
      label: section.label,
    })),
  };
}

export default function AppLayout() {
  const { apiKey, sections, missingScopes, roles, shop } = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <ShopifyAppProvider apiKey={apiKey}>
      <PolarisProvider i18n={enTranslations}>
        <Frame
          navigation={
            <Navigation location={location.pathname}>
              <Navigation.Section
                title="SPIRITHAUS Social Studio"
                items={sections.map((section) => ({
                  url: section.path,
                  label: section.label,
                  selected: location.pathname === section.path,
                }))}
              />
            </Navigation>
          }
        >
          {roles.length === 0 ? (
            <Banner tone="warning" title="No role has been assigned to this account">
              <p>
                You can sign in, and you cannot do anything yet. An administrator assigns roles in
                Settings. This is deliberate: an account with no role has no permissions rather than
                a default set.
              </p>
            </Banner>
          ) : null}
          {missingScopes.length > 0 ? (
            <Banner tone="critical" title="Shopify did not grant every required scope">
              <p>
                Missing: {missingScopes.join(', ')}. Features depending on them are disabled rather
                than failing later. Reinstall the app from {shop.domain} to grant them.
              </p>
            </Banner>
          ) : null}
          <Outlet />
        </Frame>
      </PolarisProvider>
    </ShopifyAppProvider>
  );
}

/** Shopify requires these headers on embedded routes for App Bridge to load. */
export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 403) {
    const body = error.data as { message?: string; details?: { permission?: string } } | undefined;
    return (
      <PolarisProvider i18n={enTranslations}>
        <Banner tone="critical" title="Your role does not allow this">
          <p>{body?.message ?? 'This account lacks the permission this screen requires.'}</p>
        </Banner>
      </PolarisProvider>
    );
  }

  return boundary.error(error);
}
