CREATE TYPE "public"."support_attachment_status" AS ENUM('pending_upload', 'uploaded', 'scanning', 'ready', 'rejected', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."support_attachment_scan_status" AS ENUM('pending', 'clean', 'infected', 'suspicious', 'failed', 'skipped');--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "uploader_type" "support_sender_type";--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "uploader_id" uuid;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "visibility" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "safe_display_filename" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "claimed_mime_type" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "detected_mime_type" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "checksum_sha256" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "status" "support_attachment_status";--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "scan_status" "support_attachment_scan_status";--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "rejection_reason_code" text;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "upload_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "attached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "support_attachments" a SET
  "conversation_id" = m."conversation_id",
  "uploader_type" = m."sender_type",
  "uploader_id" = COALESCE(m."sender_id", m."id"),
  "visibility" = CASE WHEN m."type" = 'internal_note' THEN 'internal_note' ELSE 'public' END,
  "storage_key" = 'legacy/' || a."project_id" || '/' || a."id",
  "original_filename" = a."file_name",
  "safe_display_filename" = a."file_name",
  "claimed_mime_type" = a."media_type",
  "detected_mime_type" = a."media_type",
  "status" = 'ready',
  "scan_status" = 'skipped',
  "uploaded_at" = a."created_at",
  "scanned_at" = a."created_at",
  "attached_at" = a."created_at"
FROM "support_messages" m WHERE a."message_id" = m."id" AND a."project_id" = m."project_id";--> statement-breakpoint
DELETE FROM "support_attachments" WHERE "conversation_id" IS NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "conversation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "uploader_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "uploader_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "visibility" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_visibility_check" CHECK ("visibility" IN ('public', 'internal_note'));--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "storage_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "original_filename" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "safe_display_filename" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "claimed_mime_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" ALTER COLUMN "scan_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_attachments" DROP COLUMN "file_name";--> statement-breakpoint
ALTER TABLE "support_attachments" DROP COLUMN "media_type";--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_project_conversation_fk" FOREIGN KEY ("project_id","conversation_id") REFERENCES "public"."support_conversations"("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_attachments_storage_key_uidx" ON "support_attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "support_attachments_project_conversation_idx" ON "support_attachments" USING btree ("project_id","conversation_id");--> statement-breakpoint
CREATE INDEX "support_attachments_project_uploader_idx" ON "support_attachments" USING btree ("project_id","uploader_type","uploader_id");--> statement-breakpoint
CREATE INDEX "support_attachments_project_status_idx" ON "support_attachments" USING btree ("project_id","status");
