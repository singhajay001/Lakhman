import { useActionData, useLoaderData, Form } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { login } from '../shopify.server.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const errors = await login(request);
  return { errors, showForm: true };
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = await login(request);
  return { errors };
}

/**
 * Plain HTML, deliberately: this page renders outside Shopify Admin, where App Bridge
 * and Polaris are not available and loading them from the CDN would fail.
 */
export default function Login() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = (actionData?.errors ?? loaderData.errors) as Record<string, string> | undefined;

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '32rem',
        margin: '4rem auto',
        padding: '0 1rem',
      }}
    >
      <h1>SPIRITHAUS Social Studio</h1>
      <p>Open this app from your Shopify Admin, or enter your shop domain to install it.</p>
      <Form method="post">
        <label htmlFor="shop" style={{ display: 'block', marginBottom: '0.25rem' }}>
          Shop domain
        </label>
        <input
          id="shop"
          type="text"
          name="shop"
          placeholder="your-shop.myshopify.com"
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
        />
        {errors?.shop ? <p style={{ color: '#cf1c29' }}>{errors.shop}</p> : null}
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>
          Continue
        </button>
      </Form>
    </main>
  );
}
