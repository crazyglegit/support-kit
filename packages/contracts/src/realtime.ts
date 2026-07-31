import { z } from "zod";
import { identifierSchema, isoTimestampSchema } from "./shared.js";

/** Creates a runtime schema for a versioned realtime event envelope. */
export function createRealtimeEventEnvelopeSchema<TSchema extends z.ZodType>(
  data: TSchema,
) {
  return z.strictObject({
    eventId: identifierSchema,
    eventType: z.string().trim().min(1).max(200),
    eventVersion: z.number().int().positive(),
    projectId: identifierSchema,
    conversationId: identifierSchema.optional(),
    occurredAt: isoTimestampSchema,
    data,
  });
}

/** Runtime schema for a realtime envelope with an unknown payload. */
export const realtimeEventEnvelopeSchema = createRealtimeEventEnvelopeSchema(
  z.unknown(),
);

/** A versioned realtime event envelope. */
export interface RealtimeEventEnvelope<TData = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly projectId: string;
  readonly conversationId?: string;
  readonly occurredAt: string;
  readonly data: TData;
}

/** Public support realtime event envelope name used by adapter APIs. */
export type SupportRealtimeEvent<TData = unknown> =
  RealtimeEventEnvelope<TData>;
