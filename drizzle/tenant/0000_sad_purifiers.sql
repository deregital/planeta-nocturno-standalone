CREATE TYPE "public"."InviteCondition" AS ENUM('TRADITIONAL', 'INVITATION', 'SIMPLE');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('ADMIN', 'TICKETING', 'ORGANIZER', 'CHIEF_ORGANIZER', 'CONTROL_TICKETING');--> statement-breakpoint
CREATE TYPE "public"."TicketGroupStatus" AS ENUM('BOOKED', 'PAID', 'FREE');--> statement-breakpoint
CREATE TYPE "public"."TicketTypeCategory" AS ENUM('FREE', 'PAID', 'TABLE');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "account_pkey" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "authenticator" (
	"credentialId" text NOT NULL,
	"userId" uuid NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_pkey" PRIMARY KEY("credentialId","userId")
);
--> statement-breakpoint
CREATE TABLE "emittedTicket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fullName" text NOT NULL,
	"dni" text NOT NULL,
	"mail" text NOT NULL,
	"gender" text NOT NULL,
	"phoneNumber" text NOT NULL,
	"instagram" text,
	"birthDate" text NOT NULL,
	"paidOnLocation" boolean DEFAULT false NOT NULL,
	"scanned" boolean DEFAULT false NOT NULL,
	"scannedAt" timestamp with time zone,
	"scannedByUserId" uuid,
	"ticketTypeId" uuid NOT NULL,
	"ticketGroupId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"eventId" uuid NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emittedTicketScan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emittedTicketId" uuid NOT NULL,
	"scannedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"scannedByUserId" uuid
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"coverImageUrl" text NOT NULL,
	"slug" text NOT NULL,
	"startingDate" timestamp with time zone NOT NULL,
	"endingDate" timestamp with time zone NOT NULL,
	"minAge" integer,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"locationId" uuid NOT NULL,
	"categoryId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"inviteCondition" "InviteCondition" DEFAULT 'TRADITIONAL' NOT NULL,
	"extraTicketData" boolean DEFAULT true NOT NULL,
	"emailNotification" text,
	"serviceFee" double precision,
	"ticketSlugVisibleInPdf" boolean DEFAULT false NOT NULL,
	"folderId" uuid,
	"hasSimpleInvitation" boolean DEFAULT false NOT NULL,
	"videoUrl" text
);
--> statement-breakpoint
CREATE TABLE "eventCategory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventFolder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventQuestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"eventId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_EVENT_X_USER" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL,
	CONSTRAINT "_EVENT_X_USER_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "eventXOrganizer" (
	"eventId" uuid NOT NULL,
	"organizerId" uuid NOT NULL,
	"discountPercentage" integer,
	"ticketAmount" integer,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "eventXOrganizer_pkey" PRIMARY KEY("eventId","organizerId")
);
--> statement-breakpoint
CREATE TABLE "feature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"value" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"googleMapsUrl" text NOT NULL,
	"capacity" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"createdById" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketGroup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "TicketGroupStatus" NOT NULL,
	"amountTickets" integer DEFAULT 0 NOT NULL,
	"event_id" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"invitedById" uuid,
	"isOrganizerGroup" boolean DEFAULT false NOT NULL,
	"invitedBySimple" text,
	"totalAmount" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketGroupAnswer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer" text NOT NULL,
	"questionId" uuid NOT NULL,
	"ticketGroupId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketType" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" double precision,
	"maxAvailable" integer NOT NULL,
	"maxPerPurchase" integer NOT NULL,
	"category" "TicketTypeCategory" NOT NULL,
	"maxSellDate" timestamp with time zone,
	"visibleInWeb" boolean DEFAULT true NOT NULL,
	"scanLimit" timestamp with time zone,
	"eventId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lowStockThreshold" integer,
	"slug" text DEFAULT upper(substr(md5((random())::text), 1, 6)) NOT NULL,
	"startingDate" timestamp with time zone NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"allowMultipleScans" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketTypePerGroup" (
	"amount" integer NOT NULL,
	"ticketTypeId" uuid NOT NULL,
	"ticketGroupId" uuid NOT NULL,
	CONSTRAINT "ticketTypePerGroup_pkey" PRIMARY KEY("ticketTypeId","ticketGroupId")
);
--> statement-breakpoint
CREATE TABLE "_TICKET_TYPE_X_ORGANIZERS" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL,
	CONSTRAINT "_TICKET_TYPE_X_ORGANIZERS_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "ticketXOrganizer" (
	"ticketId" uuid,
	"organizerId" uuid NOT NULL,
	"ticketGroupId" uuid,
	"eventId" uuid NOT NULL,
	"code" text DEFAULT upper(substr(md5((random())::text), 1, 6)) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"shortId" integer NOT NULL,
	CONSTRAINT "ticketXOrganizer_pkey" PRIMARY KEY("eventId","code")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" timestamp with time zone,
	"image" text,
	"fullName" text NOT NULL,
	"role" "Role" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"birthDate" text NOT NULL,
	"code" text DEFAULT upper(substr(md5((random())::text), 1, 6)) NOT NULL,
	"dni" text NOT NULL,
	"gender" text NOT NULL,
	"phoneNumber" text NOT NULL,
	"instagram" text,
	"shortId" serial NOT NULL,
	"chiefOrganizerId" uuid,
	"googleDriveUrl" text,
	"mercadopago" text
);
--> statement-breakpoint
CREATE TABLE "_USER_X_TAG" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL,
	CONSTRAINT "_USER_X_TAG_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verificationToken_pkey" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "emittedTicket" ADD CONSTRAINT "emittedTicket_scannedByUserId_fkey" FOREIGN KEY ("scannedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "emittedTicket" ADD CONSTRAINT "emittedTicket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "public"."ticketType"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "emittedTicket" ADD CONSTRAINT "emittedTicket_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "public"."ticketGroup"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "emittedTicket" ADD CONSTRAINT "emittedTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "emittedTicketScan" ADD CONSTRAINT "emittedTicketScan_emittedTicketId_fkey" FOREIGN KEY ("emittedTicketId") REFERENCES "public"."emittedTicket"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "emittedTicketScan" ADD CONSTRAINT "emittedTicketScan_scannedByUserId_fkey" FOREIGN KEY ("scannedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."eventCategory"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "public"."eventFolder"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "eventQuestion" ADD CONSTRAINT "eventQuestion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_EVENT_X_USER" ADD CONSTRAINT "_EVENT_X_USER_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_EVENT_X_USER" ADD CONSTRAINT "_EVENT_X_USER_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "eventXOrganizer" ADD CONSTRAINT "eventXOrganizer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "eventXOrganizer" ADD CONSTRAINT "eventXOrganizer_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketGroup" ADD CONSTRAINT "ticketGroup_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketGroup" ADD CONSTRAINT "ticketGroup_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketGroupAnswer" ADD CONSTRAINT "ticketGroupAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."eventQuestion"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketGroupAnswer" ADD CONSTRAINT "ticketGroupAnswer_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "public"."ticketGroup"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketType" ADD CONSTRAINT "ticketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketTypePerGroup" ADD CONSTRAINT "ticketTypePerGroup_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "public"."ticketType"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketTypePerGroup" ADD CONSTRAINT "ticketTypePerGroup_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "public"."ticketGroup"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_TICKET_TYPE_X_ORGANIZERS" ADD CONSTRAINT "_TICKET_TYPE_X_ORGANIZERS_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."ticketType"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_TICKET_TYPE_X_ORGANIZERS" ADD CONSTRAINT "_TICKET_TYPE_X_ORGANIZERS_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."emittedTicket"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "public"."ticketGroup"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_chiefOrganizerId_fkey" FOREIGN KEY ("chiefOrganizerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_USER_X_TAG" ADD CONSTRAINT "_USER_X_TAG_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_USER_X_TAG" ADD CONSTRAINT "_USER_X_TAG_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "authenticator_credentialID_key" ON "authenticator" USING btree ("credentialId" text_ops);--> statement-breakpoint
CREATE INDEX "emittedTicketScan_emittedTicketId_idx" ON "emittedTicketScan" USING btree ("emittedTicketId" uuid_ops);--> statement-breakpoint
CREATE INDEX "_EVENT_X_USER_B_index" ON "_EVENT_X_USER" USING btree ("B" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "feature_key_key" ON "feature" USING btree ("key" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "session_sessionToken_key" ON "session" USING btree ("sessionToken" text_ops);--> statement-breakpoint
CREATE INDEX "tag_createdById_idx" ON "tag" USING btree ("createdById" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ticketType_eventId_slug_key" ON "ticketType" USING btree ("eventId" uuid_ops,"slug" text_ops);--> statement-breakpoint
CREATE INDEX "ticketType_eventId_sortOrder_idx" ON "ticketType" USING btree ("eventId" uuid_ops,"sortOrder" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ticketType_eventId_sortOrder_key" ON "ticketType" USING btree ("eventId" uuid_ops,"sortOrder" int4_ops);--> statement-breakpoint
CREATE INDEX "_TICKET_TYPE_X_ORGANIZERS_B_index" ON "_TICKET_TYPE_X_ORGANIZERS" USING btree ("B" uuid_ops);--> statement-breakpoint
CREATE INDEX "ticketXOrganizer_code_idx" ON "ticketXOrganizer" USING btree ("code" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ticketXOrganizer_code_key" ON "ticketXOrganizer" USING btree ("code" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ticketXOrganizer_eventId_shortId_key" ON "ticketXOrganizer" USING btree ("eventId" uuid_ops,"shortId" int4_ops);--> statement-breakpoint
CREATE INDEX "ticketXOrganizer_organizerId_idx" ON "ticketXOrganizer" USING btree ("organizerId" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ticketXOrganizer_ticketId_key" ON "ticketXOrganizer" USING btree ("ticketId" uuid_ops);--> statement-breakpoint
CREATE INDEX "user_code_idx" ON "user" USING btree ("code" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_code_key" ON "user" USING btree ("code" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_dni_key" ON "user" USING btree ("dni" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_key" ON "user" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_name_key" ON "user" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_shortId_key" ON "user" USING btree ("shortId" int4_ops);--> statement-breakpoint
CREATE INDEX "_USER_X_TAG_B_index" ON "_USER_X_TAG" USING btree ("B" uuid_ops);