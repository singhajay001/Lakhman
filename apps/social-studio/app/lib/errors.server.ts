import { DomainError, httpStatusFor } from '@spirithaus/domain';

/**
 * Turns a domain refusal into a response a screen can render. Section 8 asks for
 * plain-language error recovery, which starts with the error saying what is wrong
 * rather than "something went wrong".
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return new Response(
      JSON.stringify({ code: error.code, message: error.message, details: error.details }),
      {
        status: httpStatusFor(error.code),
        headers: { 'content-type': 'application/json' },
      },
    );
  }
  throw error;
}

/** Wraps a loader or action so a DomainError becomes a response instead of a 500. */
export function withDomainErrors<Args, Result>(
  handler: (args: Args) => Promise<Result>,
): (args: Args) => Promise<Result | Response> {
  return async (args: Args) => {
    try {
      return await handler(args);
    } catch (error) {
      if (error instanceof DomainError) return toErrorResponse(error);
      throw error;
    }
  };
}
