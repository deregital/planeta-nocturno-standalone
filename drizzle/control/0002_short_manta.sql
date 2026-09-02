ALTER TABLE "tenants" ADD COLUMN "custom_id" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "comments" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_custom_id_unique" UNIQUE("custom_id");