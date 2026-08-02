/** Stable error codes raised by pure domain rules. */
export const DOMAIN_ERROR_CODES = [
  "VALIDATION_ERROR",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INVALID_STATE_TRANSITION",
  "INVALID_CLIENT_MESSAGE_ID",
  "ATTACHMENTS_DISABLED",
  "FILE_TOO_LARGE",
  "FILE_TYPE_NOT_ALLOWED",
  "TOO_MANY_ATTACHMENTS",
  "ATTACHMENT_NOT_READY",
  "ATTACHMENT_REJECTED",
  "ATTACHMENT_ALREADY_ATTACHED",
  "UPLOAD_EXPIRED",
  "UPLOAD_NOT_FOUND",
  "UPLOAD_VERIFICATION_FAILED",
  "MALWARE_DETECTED",
  "SCAN_FAILED",
  "STORAGE_UNAVAILABLE",
  "CHATBOT_DISABLED",
  "CHATBOT_SESSION_NOT_FOUND",
  "CHATBOT_SESSION_LIMIT_REACHED",
  "KNOWLEDGE_UNAVAILABLE",
  "KNOWLEDGE_NOT_FOUND",
  "KNOWLEDGE_NOT_PUBLISHED",
  "RETRIEVAL_FAILED",
  "INSUFFICIENT_KNOWLEDGE",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_RESPONSE_INVALID",
  "CITATION_VALIDATION_FAILED",
  "HANDOFF_ALREADY_REQUESTED",
  "EMBEDDING_DIMENSION_MISMATCH",
  "INDEXING_FAILED",
  "INTERNAL_ERROR",
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
