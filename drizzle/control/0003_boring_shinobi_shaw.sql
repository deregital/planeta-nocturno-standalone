ALTER TYPE "public"."tenant_status" ADD VALUE 'deleted';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "deleted_at" timestamp with time zone;