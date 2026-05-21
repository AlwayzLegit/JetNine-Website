CREATE TABLE "companions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"relation" "companion_relation" NOT NULL,
	"legal_name" text NOT NULL,
	"birth_date" date,
	"ktn_enc" text,
	"apis_complete" boolean DEFAULT false NOT NULL,
	"cc_on_itinerary" boolean DEFAULT false NOT NULL,
	"species_breed" text,
	"weight_lb" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"country_iso2" char(2),
	"number_enc" text,
	"expires_on" date,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_lanes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"from_icao" text NOT NULL,
	"to_icao" text NOT NULL,
	"frequency_per_year" integer,
	"seasonal" boolean DEFAULT false NOT NULL,
	"last_flown_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_preferences" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"default_aircraft_category" "aircraft_category",
	"cabin_wifi" boolean DEFAULT true NOT NULL,
	"cabin_standup" boolean DEFAULT false NOT NULL,
	"cabin_lavatory_enclosed" boolean DEFAULT true NOT NULL,
	"cabin_lieflat" boolean DEFAULT false NOT NULL,
	"cabin_flight_attendant" boolean DEFAULT false NOT NULL,
	"cabin_pet_friendly" boolean DEFAULT false NOT NULL,
	"lieflat_min_hours" integer DEFAULT 5 NOT NULL,
	"catering_tier" "catering_tier" DEFAULT 'standard' NOT NULL,
	"dietary" text,
	"bar_preferences" text,
	"standing_catering_notes" text,
	"ground_type" "ground_type" DEFAULT 'sedan' NOT NULL,
	"ground_vendor" text,
	"fbo_defaults" jsonb,
	"arrival_window_minutes" integer DEFAULT 15 NOT NULL,
	"comms_voice" boolean DEFAULT true NOT NULL,
	"comms_email" boolean DEFAULT true NOT NULL,
	"comms_sms_updates" boolean DEFAULT false NOT NULL,
	"comms_sms_empty_leg" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"quiet_hours_tz" text,
	"empty_leg_alert_threshold_pct" integer DEFAULT 40 NOT NULL,
	"anonymize_manifest" boolean DEFAULT false NOT NULL,
	"block_flight_tracking" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companions" ADD CONSTRAINT "companions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_lanes" ADD CONSTRAINT "member_lanes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_preferences" ADD CONSTRAINT "member_preferences_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companions_member_idx" ON "companions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_documents_member_idx" ON "member_documents" USING btree ("member_id","doc_type");--> statement-breakpoint
CREATE UNIQUE INDEX "member_lanes_unique" ON "member_lanes" USING btree ("member_id","from_icao","to_icao");--> statement-breakpoint
CREATE INDEX "member_lanes_member_idx" ON "member_lanes" USING btree ("member_id");