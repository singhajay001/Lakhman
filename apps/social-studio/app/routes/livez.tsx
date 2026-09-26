/**
 * Liveness: is this process running?
 *
 * Nothing else. No database, no Redis, no version, no environment. A liveness probe that touches
 * a dependency turns a slow database into a restart loop — the platform kills a process that is
 * perfectly healthy and merely waiting, and the restart makes the database slower.
 *
 * Unauthenticated, because a platform health checker has no credentials, and safe to be so
 * because the response says nothing an anonymous caller could use.
 */
export function loader(): Response {
  return new Response(JSON.stringify({ status: 'alive' }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // A cached liveness answer is a lie about the present.
      'cache-control': 'no-store',
    },
  });
}
