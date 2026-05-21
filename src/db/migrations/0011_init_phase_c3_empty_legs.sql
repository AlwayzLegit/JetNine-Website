CREATE TYPE "public"."empty_leg_status" AS ENUM('draft', 'scheduled', 'live', 'sold', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "empty_leg_code_sequence" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empty_leg_watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"email" text,
	"phone_e164" text,
	"from_icao" text,
	"from_text" text,
	"to_icao" text,
	"to_text" text,
	"earliest_on" text,
	"latest_on" text,
	"min_discount_pct" integer DEFAULT 30 NOT NULL,
	"notify_channels" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empty_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"aircraft_id" uuid,
	"operator_id" uuid NOT NULL,
	"category" "aircraft_category" NOT NULL,
	"from_icao" text NOT NULL,
	"from_iata" text,
	"from_city" text,
	"from_name" text,
	"to_icao" text NOT NULL,
	"to_iata" text,
	"to_city" text,
	"to_name" text,
	"wheels_up_at" timestamp with time zone NOT NULL,
	"flight_minutes" integer,
	"distance_nm" integer,
	"seats_available" integer NOT NULL,
	"full_charter_ref_usd" integer NOT NULL,
	"listed_price_usd" integer NOT NULL,
	"discount_pct" integer,
	"auto_price_decay" boolean DEFAULT false NOT NULL,
	"min_discount_pct" integer DEFAULT 30 NOT NULL,
	"reserve_lock_minutes" integer DEFAULT 30 NOT NULL,
	"pet_friendly" boolean DEFAULT true NOT NULL,
	"allow_split_sectors" boolean DEFAULT false NOT NULL,
	"headline" text,
	"body_copy" text,
	"sms_copy" text,
	"board_go_live_at" timestamp with time zone,
	"reserve_early_access_at" timestamp with time zone,
	"sms_blast_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"visibility_flags" jsonb,
	"status" "empty_leg_status" DEFAULT 'draft' NOT NULL,
	"sold_to_member_id" uuid,
	"sold_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "empty_leg_watchlists" ADD CONSTRAINT "empty_leg_watchlists_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_legs" ADD CONSTRAINT "empty_legs_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_legs" ADD CONSTRAINT "empty_legs_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_legs" ADD CONSTRAINT "empty_legs_sold_to_member_id_members_id_fk" FOREIGN KEY ("sold_to_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_legs" ADD CONSTRAINT "empty_legs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "empty_leg_watchlists_member_idx" ON "empty_leg_watchlists" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "empty_leg_watchlists_route_idx" ON "empty_leg_watchlists" USING btree ("from_icao","to_icao");--> statement-breakpoint
CREATE UNIQUE INDEX "empty_legs_code_uq" ON "empty_legs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "empty_legs_status_idx" ON "empty_legs" USING btree ("status","wheels_up_at");--> statement-breakpoint
CREATE INDEX "empty_legs_route_idx" ON "empty_legs" USING btree ("from_icao","to_icao");--> statement-breakpoint
CREATE INDEX "empty_legs_operator_idx" ON "empty_legs" USING btree ("operator_id");