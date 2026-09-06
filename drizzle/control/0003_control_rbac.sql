CREATE TABLE "control_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "control_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "control_role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" varchar(64) NOT NULL,
	CONSTRAINT "control_role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
ALTER TABLE "control_role_permissions" ADD CONSTRAINT "control_role_permissions_role_id_control_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."control_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "control_roles" ("id", "name", "description", "is_system") VALUES
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'super_admin', 'Acceso completo al panel central', true);--> statement-breakpoint
INSERT INTO "control_role_permissions" ("role_id", "permission") VALUES
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'tenants:read'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'tenants:create'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'tenants:update'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'tenants:suspend'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'tenants:activate'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'tenants:recycle'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'tenants:restore'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'admins:read'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'admins:create'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'admins:update'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'admins:delete'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'roles:read'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'roles:create'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'roles:update'),
	('aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'roles:delete');--> statement-breakpoint
ALTER TABLE "control_admins" ADD COLUMN "role_id" uuid;--> statement-breakpoint
UPDATE "control_admins" SET "role_id" = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001' WHERE "role_id" IS NULL;--> statement-breakpoint
ALTER TABLE "control_admins" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "control_admins" ADD CONSTRAINT "control_admins_role_id_control_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."control_roles"("id") ON DELETE restrict ON UPDATE no action;
