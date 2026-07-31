/** Stable error codes raised by pure domain rules. */
export const DOMAIN_ERROR_CODES = [
  "INVALID_STATE_TRANSITION",
  "INVALID_CLIENT_MESSAGE_ID",
] as const;

/** A stable domain error code. */
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/** Structured error raised when a domain invariant is violated. */
export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details: Readonly<Record<string, unknown>> | undefined;

  public constructor(
    code: DomainErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

/** Creates a typed domain error. */
export function createDomainError(
  code: DomainErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): DomainError {
  return new DomainError(code, message, details);
}

/** Identifies errors raised by support domain rules. */
export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
