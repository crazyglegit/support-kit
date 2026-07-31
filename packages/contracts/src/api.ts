import { z } from "zod";

/** Stable error codes shared by all support transports. */
export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INVALID_STATE_TRANSITION",
  "INTERNAL_ERROR",
] as const;

/** Runtime schema for stable API error codes. */
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

/** Runtime schema for a structured API error envelope. */
export const apiErrorEnvelopeSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().min(1).optional(),
  }),
});

/** Creates a runtime schema for a successful API envelope. */
export function createApiSuccessEnvelopeSchema<TSchema extends z.ZodType>(
  data: TSchema,
) {
  return z.strictObject({ success: z.literal(true), data });
}

/** Runtime schema for a successful API envelope with an unknown payload. */
export const apiSuccessEnvelopeSchema = createApiSuccessEnvelopeSchema(
  z.unknown(),
);

/** A stable API error code. */
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
/** A structured API error response. */
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
/** A successful API response containing the supplied data type. */
export type ApiSuccessEnvelope<TData> = Readonly<{
  success: true;
  data: TData;
}>;
