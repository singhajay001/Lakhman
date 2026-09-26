import { redirect, type LoaderFunctionArgs } from 'react-router';

/**
 * The app has no public landing page. A request with a shop parameter is an install
 * attempt and goes to OAuth; anything else goes to the login form.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  if (shop) return redirect(`/auth/shopify/login?${url.searchParams.toString()}`);
  return redirect('/auth/shopify/login');
}
