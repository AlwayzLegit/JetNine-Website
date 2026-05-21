CREATE TYPE "public"."schedule_block_kind" AS ENUM('trip', 'maintenance', 'repositioning', 'crew_rest', 'owner', 'hold', 'unavailable');--> statement-breakpoint
CREATE TABLE "aircraft_schedule_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"kind" "schedule_block_kind" NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"related_trip_id" uuid,
	"related_quote_id" uuid,
	"from_icao" text,
	"to_icao" text,
	"crew_ids" jsonb,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aircraft_schedule_blocks" ADD CONSTRAINT "aircraft_schedule_blocks_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_schedule_blocks" ADD CONSTRAINT "aircraft_schedule_blocks_related_trip_id_trips_id_fk" FOREIGN KEY ("related_trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_schedule_blocks" ADD CONSTRAINT "aircraft_schedule_blocks_related_quote_id_quotes_id_fk" FOREIGN KEY ("related_quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_schedule_blocks" ADD CONSTRAINT "aircraft_schedule_blocks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_schedule_blocks" ADD CONSTRAINT "asb_window_chk" CHECK (end_at > start_at);--> statement-breakpoint
CREATE INDEX "asb_aircraft_window_idx" ON "aircraft_schedule_blocks" USING btree ("aircraft_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "asb_kind_idx" ON "aircraft_schedule_blocks" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "asb_window_idx" ON "aircraft_schedule_blocks" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "asb_related_trip_idx" ON "aircraft_schedule_blocks" USING btree ("related_trip_id");--> statement-breakpoint
CREATE INDEX "asb_related_quote_idx" ON "aircraft_schedule_blocks" USING btree ("related_quote_id");
