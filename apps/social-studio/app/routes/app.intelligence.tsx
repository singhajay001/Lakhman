import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { requireSection } from '../lib/principal.server.js';
import { sectionByPath } from '../lib/sections.js';
import { NotBuiltYet } from '../lib/section-page.js';

const PATH = '/app/intelligence';

export async function loader({ request }: LoaderFunctionArgs) {
  // The permission is enforced now, before the screen exists, so that the gate is not
  // something to remember to add when the feature lands.
  await requireSection(request, 'campaign:read');
  const section = sectionByPath(PATH);
  if (!section) throw new Error(`section ${PATH} is routed but not declared in sections.ts`);
  return { section };
}

export default function Screen() {
  const { section } = useLoaderData<typeof loader>();
  return <NotBuiltYet section={section} />;
}
