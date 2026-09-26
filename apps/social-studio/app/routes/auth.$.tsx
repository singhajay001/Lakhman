import type { LoaderFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  // The library performs the OAuth exchange, verifies the callback HMAC and state,
  // and stores the session. It throws a redirect, which is the response.
  await authenticate.admin(request);
  return null;
}
