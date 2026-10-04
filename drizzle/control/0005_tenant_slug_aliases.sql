CREATE TABLE "tenant_slug_aliases" (
	"slug" varchar(63) PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_slug_aliases" ADD CONSTRAINT "tenant_slug_aliases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_slug_aliases_tenant_id_idx" ON "tenant_slug_aliases" USING btree ("tenant_id");