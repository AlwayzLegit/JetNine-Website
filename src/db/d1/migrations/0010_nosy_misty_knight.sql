CREATE TABLE IF NOT EXISTS `chat_daily` (
	`day` text PRIMARY KEY NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`messages` integer DEFAULT 0 NOT NULL,
	`handoffs` integer DEFAULT 0 NOT NULL,
	`guard_hits` integer DEFAULT 0 NOT NULL,
	`fallbacks` integer DEFAULT 0 NOT NULL
);
