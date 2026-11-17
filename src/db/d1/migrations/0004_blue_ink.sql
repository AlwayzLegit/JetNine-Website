CREATE TABLE `voice_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`call_sid` text NOT NULL,
	`from_number` text,
	`to_number` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_seconds` integer,
	`outcome` text,
	`escalation_reason` text,
	`recording_sid` text,
	`recording_url` text,
	`transcript` text DEFAULT '[]' NOT NULL,
	`summary` text,
	`lead_id` text,
	`returning_caller` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `voice_leads`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "voice_calls_outcome_enum" CHECK("voice_calls"."outcome" in ('lead', 'message', 'escalated', 'abandoned', 'other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_calls_call_sid_idx` ON `voice_calls` (`call_sid`);--> statement-breakpoint
CREATE INDEX `voice_calls_started_idx` ON `voice_calls` ("started_at" desc);--> statement-breakpoint
CREATE TABLE `voice_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`name` text,
	`email` text,
	`source` text DEFAULT 'voice' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `voice_leads_phone_idx` ON `voice_leads` (`phone`);--> statement-breakpoint
CREATE TABLE `voice_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text,
	`name` text,
	`company` text,
	`reason` text,
	`callback` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`call_id`) REFERENCES `voice_calls`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `voice_trip_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`call_id` text,
	`origin` text,
	`destination` text,
	`depart_date` text,
	`depart_date_iso` text,
	`return_date` text,
	`return_date_iso` text,
	`trip_type` text,
	`pax` integer,
	`urgency` text,
	`notes` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `voice_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`call_id`) REFERENCES `voice_calls`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `voice_trip_requests_lead_idx` ON `voice_trip_requests` (`lead_id`);--> statement-breakpoint
CREATE INDEX `voice_trip_requests_status_idx` ON `voice_trip_requests` (`status`,"created_at" desc);