CREATE TYPE "public"."airport_customs" AS ENUM('none', 'user_fee', 'aoe', 'intl');--> statement-breakpoint
CREATE TABLE "airports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"icao" char(4) NOT NULL,
	"iata" char(3),
	"name" text NOT NULL,
	"city" text NOT NULL,
	"region" text,
	"country_iso2" char(2) NOT NULL,
	"lat" numeric(8, 5) NOT NULL,
	"lon" numeric(8, 5) NOT NULL,
	"elevation_ft" integer,
	"tz" text,
	"category" text,
	"longest_runway_ft" integer,
	"customs" "airport_customs" DEFAULT 'none' NOT NULL,
	"slot_controlled" boolean DEFAULT false NOT NULL,
	"private_only" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fbos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"airport_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"radio_freq_mhz" numeric(6, 3),
	"phone_e164" text,
	"after_hours_phone_e164" text,
	"email" text,
	"website" text,
	"hours_weekday" text,
	"hours_weekend" text,
	"customs_24h" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fbos" ADD CONSTRAINT "fbos_airport_id_airports_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "airports_icao_uq" ON "airports" USING btree ("icao");--> statement-breakpoint
CREATE INDEX "airports_iata_idx" ON "airports" USING btree ("iata");--> statement-breakpoint
CREATE INDEX "airports_country_idx" ON "airports" USING btree ("country_iso2");--> statement-breakpoint
CREATE INDEX "airports_city_idx" ON "airports" USING btree ("city");--> statement-breakpoint
CREATE INDEX "fbos_airport_idx" ON "fbos" USING btree ("airport_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fbos_airport_name_uq" ON "fbos" USING btree ("airport_id","name");
