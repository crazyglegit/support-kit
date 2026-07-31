CREATE TYPE "public"."support_conversation_status" AS ENUM('open', 'waiting_for_agent', 'waiting_for_customer', 'resolved', 'closed', 'spam');--> statement-breakpoint
CREATE TYPE "public"."support_delivery_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."support_message_type" AS ENUM('text', 'image', 'file', 'bot', 'system', 'internal_note', 'quick_reply');--> statement-breakpoint
CREATE TYPE "public"."support_participant_type" AS ENUM('customer', 'visitor', 'agent');--> statement-breakpoint
CREATE TYPE "public"."support_sender_type" AS ENUM('customer', 'visitor', 'agent', 'bot', 'system');--> statement-breakpoint
CREATE TABLE "support_agents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"external_agent_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_agents_project_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "support_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"message_id" uuid,
	"file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid,
	"actor_type" "support_sender_type" NOT NULL,
	"resource_id" uuid,
	"resource_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_conversation_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"assigned_by_agent_id" uuid,
	"unassigned_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_conversation_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"participant_type" "support_participant_type" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_conversation_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "support_conversation_status" NOT NULL,
	"subject" text,
	"priority" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_conversations_project_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "support_customer_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"customer_id" uuid,
	"visitor_id" uuid,
	"session_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"external_customer_id" text NOT NULL,
	"name" text,
	"email" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_customers_project_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "support_message_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reader_type" "support_participant_type" NOT NULL,
	"reader_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"client_message_id" text,
	"type" "support_message_type" NOT NULL,
	"sender_type" "support_sender_type" NOT NULL,
	"sender_id" uuid,
	"body" text NOT NULL,
	"delivery_status" "support_delivery_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_messages_project_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "support_projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_key" text NOT NULL,
	"name" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_saved_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by_agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_tags_project_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
ALTER TABLE "support_agents" ADD CONSTRAINT "support_agents_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_project_message_fk" FOREIGN KEY ("project_id","message_id") REFERENCES "public"."support_messages"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_audit_logs" ADD CONSTRAINT "support_audit_logs_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_assignments" ADD CONSTRAINT "support_conversation_assignments_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_assignments" ADD CONSTRAINT "support_assignments_project_conversation_fk" FOREIGN KEY ("project_id","conversation_id") REFERENCES "public"."support_conversations"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_assignments" ADD CONSTRAINT "support_assignments_project_agent_fk" FOREIGN KEY ("project_id","agent_id") REFERENCES "public"."support_agents"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_assignments" ADD CONSTRAINT "support_assignments_project_assigner_fk" FOREIGN KEY ("project_id","assigned_by_agent_id") REFERENCES "public"."support_agents"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_participants" ADD CONSTRAINT "support_conversation_participants_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_participants" ADD CONSTRAINT "support_participants_project_conversation_fk" FOREIGN KEY ("project_id","conversation_id") REFERENCES "public"."support_conversations"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_tags" ADD CONSTRAINT "support_conversation_tags_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_tags" ADD CONSTRAINT "support_conversation_tags_project_conversation_fk" FOREIGN KEY ("project_id","conversation_id") REFERENCES "public"."support_conversations"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversation_tags" ADD CONSTRAINT "support_conversation_tags_project_tag_fk" FOREIGN KEY ("project_id","tag_id") REFERENCES "public"."support_tags"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_customer_sessions" ADD CONSTRAINT "support_customer_sessions_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_customer_sessions" ADD CONSTRAINT "support_customer_sessions_project_customer_fk" FOREIGN KEY ("project_id","customer_id") REFERENCES "public"."support_customers"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_customers" ADD CONSTRAINT "support_customers_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_message_receipts" ADD CONSTRAINT "support_message_receipts_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_message_receipts" ADD CONSTRAINT "support_receipts_project_message_fk" FOREIGN KEY ("project_id","message_id") REFERENCES "public"."support_messages"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_message_receipts" ADD CONSTRAINT "support_receipts_project_conversation_fk" FOREIGN KEY ("project_id","conversation_id") REFERENCES "public"."support_conversations"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_project_conversation_fk" FOREIGN KEY ("project_id","conversation_id") REFERENCES "public"."support_conversations"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_saved_replies" ADD CONSTRAINT "support_saved_replies_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_saved_replies" ADD CONSTRAINT "support_saved_replies_project_agent_fk" FOREIGN KEY ("project_id","created_by_agent_id") REFERENCES "public"."support_agents"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tags" ADD CONSTRAINT "support_tags_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_agents_project_external_uidx" ON "support_agents" USING btree ("project_id","external_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_attachments_project_id_uidx" ON "support_attachments" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "support_attachments_project_message_idx" ON "support_attachments" USING btree ("project_id","message_id");--> statement-breakpoint
CREATE INDEX "support_audit_project_cursor_idx" ON "support_audit_logs" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX "support_audit_project_resource_idx" ON "support_audit_logs" USING btree ("project_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "support_assignments_project_conversation_idx" ON "support_conversation_assignments" USING btree ("project_id","conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "support_assignments_one_active_uidx" ON "support_conversation_assignments" USING btree ("project_id","conversation_id") WHERE "support_conversation_assignments"."unassigned_at" is null;--> statement-breakpoint
CREATE INDEX "support_assignments_project_agent_idx" ON "support_conversation_assignments" USING btree ("project_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_participants_project_conversation_actor_uidx" ON "support_conversation_participants" USING btree ("project_id","conversation_id","participant_type","participant_id");--> statement-breakpoint
CREATE INDEX "support_participants_project_actor_idx" ON "support_conversation_participants" USING btree ("project_id","participant_type","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_conversation_tags_project_pair_uidx" ON "support_conversation_tags" USING btree ("project_id","conversation_id","tag_id");--> statement-breakpoint
CREATE INDEX "support_conversation_tags_project_tag_idx" ON "support_conversation_tags" USING btree ("project_id","tag_id");--> statement-breakpoint
CREATE INDEX "support_conversations_project_status_updated_idx" ON "support_conversations" USING btree ("project_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "support_customer_sessions_project_hash_uidx" ON "support_customer_sessions" USING btree ("project_id","session_hash");--> statement-breakpoint
CREATE INDEX "support_customer_sessions_project_customer_idx" ON "support_customer_sessions" USING btree ("project_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_customers_project_external_uidx" ON "support_customers" USING btree ("project_id","external_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_receipts_project_message_reader_uidx" ON "support_message_receipts" USING btree ("project_id","message_id","reader_type","reader_id");--> statement-breakpoint
CREATE INDEX "support_receipts_project_conversation_idx" ON "support_message_receipts" USING btree ("project_id","conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_messages_project_conversation_client_uidx" ON "support_messages" USING btree ("project_id","conversation_id","client_message_id") WHERE "support_messages"."client_message_id" is not null;--> statement-breakpoint
CREATE INDEX "support_messages_project_conversation_cursor_idx" ON "support_messages" USING btree ("project_id","conversation_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_projects_project_key_uidx" ON "support_projects" USING btree ("project_key");--> statement-breakpoint
CREATE UNIQUE INDEX "support_saved_replies_project_id_uidx" ON "support_saved_replies" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "support_saved_replies_project_title_idx" ON "support_saved_replies" USING btree ("project_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "support_tags_project_name_uidx" ON "support_tags" USING btree ("project_id","name");--> statement-breakpoint
CREATE FUNCTION support_reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'support audit logs are immutable' USING ERRCODE = '23000';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER support_audit_logs_immutable
BEFORE UPDATE OR DELETE ON support_audit_logs
FOR EACH ROW EXECUTE FUNCTION support_reject_audit_mutation();--> statement-breakpoint
CREATE FUNCTION support_guard_assignment_history() RETURNS trigger AS $$
BEGIN
  IF OLD.id <> NEW.id
    OR OLD.project_id <> NEW.project_id
    OR OLD.conversation_id <> NEW.conversation_id
    OR OLD.agent_id <> NEW.agent_id
    OR OLD.assigned_by_agent_id IS DISTINCT FROM NEW.assigned_by_agent_id
    OR OLD.created_at <> NEW.created_at
    OR OLD.unassigned_at IS NOT NULL
    OR NEW.unassigned_at IS NULL THEN
    RAISE EXCEPTION 'support assignment history is immutable' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER support_assignment_history_immutable
BEFORE UPDATE ON support_conversation_assignments
FOR EACH ROW EXECUTE FUNCTION support_guard_assignment_history();
