CREATE TABLE "support_visitors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"external_visitor_id" text NOT NULL,
	"session_id" text,
	"name" text,
	"email" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_visitors_project_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
ALTER TABLE "support_visitors" ADD CONSTRAINT "support_visitors_project_id_support_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."support_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_visitors_project_external_uidx" ON "support_visitors" USING btree ("project_id","external_visitor_id");--> statement-breakpoint
CREATE INDEX "support_visitors_project_session_idx" ON "support_visitors" USING btree ("project_id","session_id");