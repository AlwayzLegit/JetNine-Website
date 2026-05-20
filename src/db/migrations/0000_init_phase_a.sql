CREATE TYPE "public"."aircraft_category" AS ENUM('turboprop', 'light', 'midsize', 'supermid', 'heavy', 'ulr');--> statement-breakpoint
CREATE TYPE "public"."catering_tier" AS ENUM('standard', 'plus', 'premium', 'custom');--> statement-breakpoint
CREATE TYPE "public"."companion_relation" AS ENUM('spouse', 'family', 'business', 'assistant', 'pet', 'other');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('passport', 'global_entry', 'known_traveler', 'second_passport');--> statement-breakpoint
CREATE TYPE "public"."ground_type" AS ENUM('none', 'sedan', 'suv_sprinter', 'custom');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."member_tier" AS ENUM('on_demand', 'card_100', 'card_250', 'card_500', 'reserve_50', 'reserve_100', 'reserve_250', 'reserve_500_apply');--> statement-breakpoint
CREATE TYPE "public"."rule_severity" AS ENUM('info', 'warn', 'flag');--> statement-breakpoint
CREATE TYPE "public"."staff_desk" AS ENUM('west', 'east', 'overnight', 'sourcing', 'float', 'lead');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('on', 'break', 'off', 'on_call');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'dispatcher', 'admin', 'superadmin', 'operator_contact');--> statement-breakpoint
-- auth.users is managed by Supabase Auth — DO NOT recreate. Drizzle emits
-- this CREATE TABLE because we declared a pgSchema("auth") reference; it's
-- stripped here so the FK constraint below points at the real auth.users.
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"preferred_name" text,
	"phone_e164" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"desk" "staff_desk" DEFAULT 'float' NOT NULL,
	"years_experience" integer,
	"lane_specialty" text,
	"shift_start" time,
	"shift_end" time,
	"direct_line_e164" text,
	"status" "staff_status" DEFAULT 'off' NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dispatcher_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"member_code" text NOT NULL,
	"legal_name" text,
	"preferred_name" text,
	"birth_date" date,
	"mobile_e164" text,
	"company_name" text,
	"role_title" text,
	"billing_entity_name" text,
	"billing_address" jsonb,
	"tax_id_enc" text,
	"tier" "member_tier" DEFAULT 'on_demand' NOT NULL,
	"tier_since" date,
	"member_since" date,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"primary_dispatcher_id" uuid,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"lifetime_trips_cache" integer DEFAULT 0 NOT NULL,
	"lifetime_hours_cache" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatcher_assignments" ADD CONSTRAINT "dispatcher_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatcher_assignments" ADD CONSTRAINT "dispatcher_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_primary_dispatcher_id_staff_id_fk" FOREIGN KEY ("primary_dispatcher_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispatcher_assignments_member_idx" ON "dispatcher_assignments" USING btree ("member_id","ended_on");--> statement-breakpoint
CREATE INDEX "dispatcher_assignments_staff_idx" ON "dispatcher_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_code_uq" ON "members" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "members_tier_idx" ON "members" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "members_status_idx" ON "members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "members_dispatcher_idx" ON "members" USING btree ("primary_dispatcher_id");