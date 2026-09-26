/**
 * Every fallible boundary returns a Result rather than throwing, so that a caller
 * cannot ignore a failure by not writing a catch. Section 43 lists silent failures
 * as a prohibited shortcut; this is the shape that makes them awkward.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
