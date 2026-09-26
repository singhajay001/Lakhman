import '@shopify/shopify-app-react-router/adapters/node';
import { ApiVersion, AppDistribution, shopifyApp } from '@shopify/shopify-app-react-router/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { prisma } from '@spirithaus/db';
import { mandatoryScopeList } from '@spirithaus/shopify';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    // A missing credential is a startup failure, not a 500 halfway through an OAuth
    // callback. Section 33.
    throw new Error(`${name} is not set. Copy .env.example and fill it in.`);
  }
  return value;
}

const shopify = shopifyApp({
  apiKey: required('SHOPIFY_API_KEY'),
  apiSecretKey: required('SHOPIFY_API_SECRET'),
  apiVersion: ApiVersion.July25,
  scopes: mandatoryScopeList(),
  appUrl: required('SHOPIFY_APP_URL'),
  // Derives callbackPath, loginPath, patchSessionTokenPath and exitIframePath. The callback
  // that results, <SHOPIFY_APP_URL>/auth/shopify/callback, is what has to be registered as an
  // allowed redirection URL in the Partner Dashboard — byte for byte, scheme included.
  authPathPrefix: '/auth/shopify',
  // Online tokens, deliberately: section 20 requires a *verified human* for every
  // approval, and an offline session has no user attached to verify.
  useOnlineTokens: true,
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
});

export default shopify;
export const apiVersion = ApiVersion.July25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
