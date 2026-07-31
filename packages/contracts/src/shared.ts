import { z } from "zod";

/** Non-empty opaque identifier used at transport boundaries. */
export const identifierSchema = z.string().trim().min(1).max(255);

/** ISO 8601 timestamp with an explicit timezone. */
export const isoTimestampSchema = z.iso.datetime({ offset: true });

/** JSON-like metadata accepted from host identity adapters. */
export const metadataSchema = z.record(z.string(), z.unknown());

/** Client-generated message idempotency key. */
export const clientMessageIdSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{6,126}[A-Za-z0-9])$/,
    "Client message ID must be 8-128 safe ASCII characters.",
  );
