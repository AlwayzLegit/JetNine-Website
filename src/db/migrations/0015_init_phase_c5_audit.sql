CREATE TYPE "public"."audit_subject_type" AS ENUM('quote', 'trip', 'invoice', 'member', 'membership', 'reserve_transaction', 'operator', 'aircraft', 'empty_leg', 'empty_leg_watchlist', 'preferences', 'user_role', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('sms', 'email', 'call', 'voicemail', 'inapp', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"subject_type" "audit_subject_type" NOT NULL,
	"subject_id" uuid,
	"subject_code" text,
	"diff" jsonb,
	"metadata" jsonb,
	"ip" text,
	"user_agent" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "audit_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel" "message_channel" NOT NULL,
	"direction" "message_direction" NOT NULL,
	"from_address" text,
	"to_address" text,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"preview" text,
	"body" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "messages_subject_idx" ON "messages" USING btree ("subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "messages_unread_idx" ON "messages" USING btree ("is_read","to_user_id");