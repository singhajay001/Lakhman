export type DomainErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'conflict'
  | 'precondition_failed'
  | 'capability_unavailable'
  | 'budget_refused';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export const httpStatusFor = (code: DomainErrorCode): number =>
  ({
    forbidden: 403,
    not_found: 404,
    invalid_input: 422,
    conflict: 409,
    precondition_failed: 412,
    capability_unavailable: 501,
    budget_refused: 402,
  })[code];
