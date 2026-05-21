CREATE TYPE "public"."trip_mission_type" AS ENUM('one_way', 'round', 'multi_leg', 'empty_leg_purchase', 'repositioning_internal');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('draft', 'confirmed', 'crew_briefed', 'boarding', 'airborne', 'wheels_down', 'completed', 'cancelled_wx', 'cancelled_other', 'diverted', 'irregular_ops');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('charter', 'credit', 'refund', 'top_up', 'renewal');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'due', 'paid', 'overdue', 'credit', 'void');--> statement-breakpoint
CREATE TABLE "trip_code_sequence" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"leg_number" integer NOT NULL,
	"from_icao" text,
	"from_iata" text,
	"from_city" text,
	"from_name" text,
	"to_icao" text,
	"to_iata" text,
	"to_city" text,
	"to_name" text,
	"scheduled_dep_at" timestamp with time zone,
	"scheduled_arr_at" timestamp with time zone,
	"actual_dep_at" timestamp with time zone,
	"actual_arr_at" timestamp with time zone,
	"depart_date" date,
	"depart_time" time,
	"depart_tz" text,
	"distance_nm" integer,
	"route_string" text,
	"squawk" text,
	"cruise_alt_fl" integer,
	"fuel_onboard_lb" integer,
	"alternate_icaos" jsonb,
	"status_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_code" text DEFAULT '' NOT NULL,
	"member_id" uuid NOT NULL,
	"quote_id" uuid,
	"assigned_dispatcher_id" uuid,
	"mission_type" "trip_mission_type" NOT NULL,
	"is_international" boolean DEFAULT false NOT NULL,
	"pax_count" integer NOT NULL,
	"crew_count" integer DEFAULT 2 NOT NULL,
	"status" "trip_status" DEFAULT 'confirmed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"aircraft_id" uuid,
	"operator_id" uuid,
	"bill_to_entity" text,
	"bill_to_terms" text,
	"revenue_usd" integer,
	"operator_cost_usd" integer,
	"margin_pct" numeric(5, 2),
	"processor_fee_usd" integer,
	"notes_member" text,
	"notes_dispatch" text,
	"manifest_locked_at" timestamp with time zone,
	"apis_filed_at" timestamp with time zone,
	"wheels_up_at" timestamp with time zone,
	"wheels_down_at" timestamp with time zone,
	"eta_at" timestamp with time zone,
	"weight_balance_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_code_sequence" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_code" text DEFAULT '' NOT NULL,
	"member_id" uuid NOT NULL,
	"trip_id" uuid,
	"kind" "invoice_kind" DEFAULT 'charter' NOT NULL,
	"issued_on" date DEFAULT current_date NOT NULL,
	"due_on" date,
	"paid_on" date,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal_usd" integer,
	"fet_usd" integer,
	"segment_fee_usd" integer,
	"total_usd" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "converted_trip_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_assigned_dispatcher_id_staff_id_fk" FOREIGN KEY ("assigned_dispatcher_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_legs_trip_leg_uq" ON "trip_legs" USING btree ("trip_id","leg_number");--> statement-breakpoint
CREATE INDEX "trip_legs_route_idx" ON "trip_legs" USING btree ("from_iata","to_iata");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_trip_code_uq" ON "trips" USING btree ("trip_code");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trips_member_idx" ON "trips" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "trips_dispatcher_idx" ON "trips" USING btree ("assigned_dispatcher_id");--> statement-breakpoint
CREATE INDEX "trips_quote_idx" ON "trips" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_code_uq" ON "invoices" USING btree ("invoice_code");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_member_idx" ON "invoices" USING btree ("member_id","issued_on");--> statement-breakpoint
CREATE INDEX "invoices_trip_idx" ON "invoices" USING btree ("trip_id");