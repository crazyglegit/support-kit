import { z } from "zod";
import { identifierSchema, isoTimestampSchema } from "./shared.js";

export const ATTACHMENT_STATUSES = [
  "pending_upload",
  "uploaded",
  "scanning",
  "ready",
  "rejected",
  "failed",
  "deleted",
] as const;
export const ATTACHMENT_SCAN_STATUSES = [
  "pending",
  "clean",
  "infected",
  "suspicious",
  "failed",
  "skipped",
] as const;
export const DEFAULT_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
] as const;

export const attachmentStatusSchema = z.enum(ATTACHMENT_STATUSES);
export const attachmentScanStatusSchema = z.enum(ATTACHMENT_SCAN_STATUSES);
export const publicAttachmentSchema = z.strictObject({
  id: identifierSchema,
  fileName: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(127),
  sizeBytes: z.number().int().nonnegative(),
  status: z.literal("ready"),
});
export const createUploadIntentSchema = z.strictObject({
  conversationId: identifierSchema,
  fileName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
  purpose: z.enum(["reply", "internal_note"]).optional(),
});
export const uploadTargetSchema = z.strictObject({
  attachment: publicAttachmentSchema.omit({ status: true }).extend({
    status: z.literal("pending_upload"),
  }),
  upload: z.strictObject({
    method: z.literal("PUT"),
    url: z.url(),
    headers: z.record(z.string(), z.string()),
    expiresAt: isoTimestampSchema,
  }),
});
export const attachmentIdsSchema = z.array(identifierSchema).max(5).default([]);

export type PublicAttachment = z.infer<typeof publicAttachmentSchema>;
export type CreateUploadIntentRequest = z.infer<
  typeof createUploadIntentSchema
>;
export type AttachmentUploadIntent = z.infer<typeof uploadTargetSchema>;
