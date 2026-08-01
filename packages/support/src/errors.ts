import { isDomainError } from "@crazyglegit/support-core";

/** Stable errors raised by the public SDK composition layer. */
export const SUPPORT_KIT_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
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
  "FEATURE_UNAVAILABLE",
  "CONFIGURATION_ERROR",
  "SDK_DISPOSED",
  "INTERNAL_ERROR",
] as const;

export type SupportKitErrorCode = (typeof SUPPORT_KIT_ERROR_CODES)[number];

/** Sanitized error exposed by all SDK operations. */
export class SupportKitError extends Error {
  public readonly code: SupportKitErrorCode;
  public readonly details: Readonly<Record<string, unknown>> | undefined;

  public constructor(
    code: SupportKitErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "SupportKitError";
    this.code = code;
    this.details = details;
  }
}

export function isSupportKitError(value: unknown): value is SupportKitError {
  return value instanceof SupportKitError;
}

export function toSupportKitError(error: unknown): SupportKitError {
  if (isSupportKitError(error)) return error;
  if (isDomainError(error))
    return new SupportKitError(error.code, error.message, error.details);
  return new SupportKitError("INTERNAL_ERROR", "The support operation failed.");
}

export function unauthenticated(actor: string): SupportKitError {
  return new SupportKitError(
    "UNAUTHENTICATED",
    `No verified ${actor} identity was resolved.`,
  );
}

export function configurationError(message: string): SupportKitError {
  return new SupportKitError("CONFIGURATION_ERROR", message);
}
