CREATE TABLE "tenant_tag_assignments" (
	"tag_id" uuid NOT NULL,
	"tenant_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_tag_assignments_tag_id_tenant_id_pk" PRIMARY KEY("tag_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_admin_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(7) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_tag_assignments" ADD CONSTRAINT "tenant_tag_assignments_tag_id_tenant_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tenant_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_tag_assignments" ADD CONSTRAINT "tenant_tag_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_tags" ADD CONSTRAINT "tenant_tags_control_admin_id_control_admins_id_fk" FOREIGN KEY ("control_admin_id") REFERENCES "public"."control_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_tag_assignments_tenant_id_idx" ON "tenant_tag_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_tags_admin_name_unique" ON "tenant_tags" USING btree ("control_admin_id",lower("name"));