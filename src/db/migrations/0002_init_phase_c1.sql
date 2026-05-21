CREATE TYPE "public"."best_time" AS ENUM('any', 'morning', 'midday', 'afternoon', 'evening', 'latenight');--> statement-breakpoint
CREATE TYPE "public"."quote_source" AS ENUM('homepage_widget', 'quote_wizard', 'dispatch_phone', 'dispatch_email', 'empty_leg_inquiry');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'submitted', 'triaged', 'sourcing', 'options_sent', 'held', 'accepted', 'declined', 'expired', 'cancelled', 'converted');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('one_way', 'round', 'multi_leg');--> statement-breakpoint
CREATE TABLE "quote_code_sequence" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"leg_number" integer NOT NULL,
	"from_icao" text,
	"from_iata" text,
	"from_city" text,
	"from_name" text,
	"to_icao" text,
	"to_iata" text,
	"to_city" text,
	"to_name" text,
	"depart_date" date,
	"depart_time" time,
	"depart_tz" text,
	"distance_nm" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_code" text NOT NULL,
	"member_id" uuid,
	"created_by_user_id" uuid,
	"contact_snapshot" jsonb,
	"source" "quote_source" DEFAULT 'quote_wizard' NOT NULL,
	"trip_type" "trip_type" NOT NULL,
	"pax_count" integer NOT NULL,
	"children_count" integer DEFAULT 0 NOT NULL,
	"pets_count" integer DEFAULT 0 NOT NULL,
	"extra_bags_count" integer DEFAULT 0 NOT NULL,
	"requested_category" "aircraft_category",
	"cabin_prefs" jsonb,
	"catering_tier" "catering_tier" DEFAULT 'standard',
	"ground_option" "ground_type" DEFAULT 'sedan',
	"notes" text,
	"contact_methods" jsonb,
	"best_time" "best_time" DEFAULT 'any',
	"referral_source" text,
	"consent_broker" boolean DEFAULT false NOT NULL,
	"consent_contact" boolean DEFAULT false NOT NULL,
	"consent_marketing" boolean DEFAULT false NOT NULL,
	"status" "quote_status" DEFAULT 'submitted' NOT NULL,
	"assigned_dispatcher_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sla_deadline_at" timestamp with time zone DEFAULT now() + interval '30 minutes' NOT NULL,
	"responded_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"indicative_low_usd" integer,
	"indicative_high_usd" integer,
	"final_price_usd" integer,
	"margin_pct" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_pax_range" CHECK ("quotes"."pax_count" >= 1 and "quotes"."pax_count" <= 19),
	CONSTRAINT "quotes_notes_length" CHECK ("quotes"."notes" is null or char_length("quotes"."notes") <= 800)
);
--> statement-breakpoint
ALTER TABLE "quote_legs" ADD CONSTRAINT "quote_legs_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_assigned_dispatcher_id_staff_id_fk" FOREIGN KEY ("assigned_dispatcher_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_legs_quote_leg_uq" ON "quote_legs" USING btree ("quote_id","leg_number");--> statement-breakpoint
CREATE INDEX "quote_legs_route_idx" ON "quote_legs" USING btree ("from_iata","to_iata");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_quote_code_uq" ON "quotes" USING btree ("quote_code");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_member_idx" ON "quotes" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "quotes_dispatcher_idx" ON "quotes" USING btree ("assigned_dispatcher_id");--> statement-breakpoint
CREATE INDEX "quotes_sla_idx" ON "quotes" USING btree ("sla_deadline_at");