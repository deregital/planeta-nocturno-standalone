CREATE TYPE "public"."tenant_plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('provisioning', 'active', 'suspended', 'failed', 'deleting', 'deleted');--> statement-breakpoint
CREATE TABLE "control_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(100) NOT NULL,
	"email" varchar(320) NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "control_admins_username_unique" UNIQUE("username"),
	CONSTRAINT "control_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(63) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"contact_email" varchar(320),
	"favicon_url" text,
	"hue" integer,
	"saturation" integer,
	"mp_access_token" text,
	"mp_refresh_token" text,
	"created_by_control_admin_id" uuid,
	"database_name" varchar(63),
	"plan" "tenant_plan" DEFAULT 'free' NOT NULL,
	"status" "tenant_status" DEFAULT 'provisioning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_database_name_unique" UNIQUE("database_name")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_created_by_control_admin_id_control_admins_id_fk" FOREIGN KEY ("created_by_control_admin_id") REFERENCES "public"."control_admins"("id") ON DELETE set null ON UPDATE no action;
