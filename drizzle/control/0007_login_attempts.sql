CREATE TABLE "login_attempts" (
	"username" varchar(100) PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_failed_at" timestamp with time zone DEFAULT now() NOT NULL
);
