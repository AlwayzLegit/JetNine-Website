CREATE TYPE "public"."membership_program" AS ENUM('on_demand', 'card_100', 'card_250', 'card_500', 'reserve_50', 'reserve_100', 'reserve_250', 'reserve_500_apply');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'paused', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reserve_tx_kind" AS ENUM('top_up', 'charter_draw', 'credit_accrual', 'refund', 'adjustment');--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"program" "membership_program" NOT NULL,
	"deposit_usd" integer NOT NULL,
	"cashback_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"callout_hours" integer NOT NULL,
	"rate_lock_months" integer DEFAULT 24 NOT NULL,
	"catering_included_tier" "catering_tier",
	"catering_allowance_usd" integer DEFAULT 0 NOT NULL,
	"ground_allowance_usd" integer DEFAULT 0 NOT NULL,
	"named_cardholders_limit" integer DEFAULT 1 NOT NULL,
	"empty_leg_advance_minutes" integer DEFAULT 30 NOT NULL,
	"activated_on" date DEFAULT current_date NOT NULL,
	"expires_on" date,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"next_renewal_date" date,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserve_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"membership_id" uuid,
	"kind" "reserve_tx_kind" NOT NULL,
	"amount_usd" integer NOT NULL,
	"description" text,
	"trip_id" uuid,
	"invoice_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_transactions" ADD CONSTRAINT "reserve_transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_transactions" ADD CONSTRAINT "reserve_transactions_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_transactions" ADD CONSTRAINT "reserve_transactions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_transactions" ADD CONSTRAINT "reserve_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_member_idx" ON "memberships" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "memberships_program_idx" ON "memberships" USING btree ("program");--> statement-breakpoint
CREATE INDEX "reserve_transactions_member_idx" ON "reserve_transactions" USING btree ("member_id","occurred_at");--> statement-breakpoint
CREATE INDEX "reserve_transactions_membership_idx" ON "reserve_transactions" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "reserve_transactions_trip_idx" ON "reserve_transactions" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "reserve_transactions_invoice_idx" ON "reserve_transactions" USING btree ("invoice_id");