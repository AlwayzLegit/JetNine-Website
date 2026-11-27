CREATE TABLE IF NOT EXISTS `lead_desk` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`source` text NOT NULL,
	`received_at` integer NOT NULL,
	`reply_due_at` integer,
	`sla_alerted_at` integer,
	`pointer` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "lead_desk_subject_type_enum" CHECK("lead_desk"."subject_type" in ('quote', 'contact', 'voice', 'chat', 'text', 'email')),
	CONSTRAINT "lead_desk_pointer_enum" CHECK("lead_desk"."pointer" in ('sent', 'failed', 'not_stored'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_desk_subject_due_idx` ON `lead_desk` (`subject_type`,`reply_due_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_desk_created_idx` ON `lead_desk` (`created_at`);