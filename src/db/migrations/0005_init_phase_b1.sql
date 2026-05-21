CREATE TYPE "public"."aircraft_status" AS ENUM('available', 'aog', 'maint', 'sold');--> statement-breakpoint
CREATE TYPE "public"."aircraft_wifi" AS ENUM('none', 'aircell', 'gogo', 'ka', 'yes');--> statement-breakpoint
CREATE TYPE "public"."operator_status" AS ENUM('active', 'audit_due', 'hold', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."operator_vetting_argus" AS ENUM('platinum', 'gold', 'silver', 'none');--> statement-breakpoint
CREATE TABLE "aircraft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tail_number" text NOT NULL,
	"operator_id" uuid NOT NULL,
	"category" "aircraft_category" NOT NULL,
	"make_model" text NOT NULL,
	"year_manufactured" integer,
	"seats" integer NOT NULL,
	"range_nm" integer NOT NULL,
	"speed_kt" integer NOT NULL,
	"wifi_type" "aircraft_wifi" DEFAULT 'none' NOT NULL,
	"cabin_height_in" integer,
	"standup_cabin" boolean DEFAULT false NOT NULL,
	"lavatory_enclosed" boolean DEFAULT false NOT NULL,
	"lieflat_capable" boolean DEFAULT false NOT NULL,
	"pet_friendly" boolean DEFAULT true NOT NULL,
	"flight_attendant_standard" boolean DEFAULT false NOT NULL,
	"base_icao" text,
	"total_hours" integer,
	"last_c_check_on" date,
	"status" "aircraft_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone_e164" text,
	"email" text,
	"is_escalation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cert_number" text,
	"faa_part" text DEFAULT '135' NOT NULL,
	"home_airport_icao" text,
	"years_partner" integer,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"status" "operator_status" DEFAULT 'active' NOT NULL,
	"argus_rating" "operator_vetting_argus" DEFAULT 'none' NOT NULL,
	"wyvern_wingman" boolean DEFAULT false NOT NULL,
	"isbao_stage" integer,
	"vetting_extras" jsonb,
	"argus_renews_on" date,
	"wyvern_renews_on" date,
	"isbao_renews_on" date,
	"insurance_renews_on" date,
	"next_audit_on" date,
	"liability_limit_usd" bigint,
	"payment_terms" text,
	"volume_discount_pct" numeric(5, 2),
	"rate_lock" boolean DEFAULT false NOT NULL,
	"notes" text,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "quote_code" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_contacts" ADD CONSTRAINT "operator_contacts_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aircraft_tail_number_uq" ON "aircraft" USING btree ("tail_number");--> statement-breakpoint
CREATE INDEX "aircraft_operator_idx" ON "aircraft" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "aircraft_category_idx" ON "aircraft" USING btree ("category");--> statement-breakpoint
CREATE INDEX "aircraft_base_idx" ON "aircraft" USING btree ("base_icao");--> statement-breakpoint
CREATE INDEX "aircraft_status_idx" ON "aircraft" USING btree ("status");--> statement-breakpoint
CREATE INDEX "operator_contacts_operator_idx" ON "operator_contacts" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "operators_status_idx" ON "operators" USING btree ("status");--> statement-breakpoint
CREATE INDEX "operators_preferred_idx" ON "operators" USING btree ("is_preferred");--> statement-breakpoint
CREATE INDEX "operators_argus_idx" ON "operators" USING btree ("argus_rating");--> statement-breakpoint
CREATE UNIQUE INDEX "operators_cert_number_uq" ON "operators" USING btree ("cert_number");