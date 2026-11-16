CREATE TABLE `agent_memory` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`author` text NOT NULL,
	`source_run_id` text,
	`created_by` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "agent_memory_kind_check" CHECK("agent_memory"."kind" in ('fact','lesson','preference','todo')),
	CONSTRAINT "agent_memory_body_check" CHECK(length("agent_memory"."body") between 1 and 600),
	CONSTRAINT "agent_memory_author_check" CHECK("agent_memory"."author" in ('agent','owner'))
);
--> statement-breakpoint
CREATE INDEX `agent_memory_active_idx` ON `agent_memory` ("pinned" desc,"updated_at" desc) WHERE "agent_memory"."archived_at" is null;--> statement-breakpoint
CREATE TABLE `agent_playbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`general_md` text NOT NULL,
	`jobs` text DEFAULT '[]' NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "agent_playbooks_version_check" CHECK("agent_playbooks"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_playbooks_version_unique` ON `agent_playbooks` (`version`);--> statement-breakpoint
CREATE TABLE `agent_run_items` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`subject_code` text,
	`title` text NOT NULL,
	`body_md` text,
	`url` text,
	`status` text DEFAULT 'open' NOT NULL,
	`dismissed_by` text,
	`dismissed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dismissed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "agent_run_items_kind_check" CHECK("agent_run_items"."kind" in ('post','flag','draft','note','insight','proposal')),
	CONSTRAINT "agent_run_items_title_check" CHECK(length("agent_run_items"."title") between 1 and 200),
	CONSTRAINT "agent_run_items_body_md_check" CHECK("agent_run_items"."body_md" is null or length("agent_run_items"."body_md") <= 8000),
	CONSTRAINT "agent_run_items_url_check" CHECK("agent_run_items"."url" is null or length("agent_run_items"."url") <= 600),
	CONSTRAINT "agent_run_items_status_check" CHECK("agent_run_items"."status" in ('open','dismissed','done'))
);
--> statement-breakpoint
CREATE INDEX `agent_run_items_run_idx` ON `agent_run_items` (`run_id`);--> statement-breakpoint
CREATE INDEX `agent_run_items_open_subject_idx` ON `agent_run_items` (`subject_type`,`subject_id`) WHERE "agent_run_items"."status" = 'open';--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`started_at` integer NOT NULL,
	`closed_at` integer,
	`key_id` text,
	`playbook_version` integer DEFAULT 0 NOT NULL,
	`summary_md` text,
	`report` text,
	`metrics` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "agent_runs_status_check" CHECK("agent_runs"."status" in ('open','closed','failed'))
);
--> statement-breakpoint
CREATE INDEX `agent_runs_date_idx` ON `agent_runs` ("run_date" desc,"started_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_runs_one_open_per_key` ON `agent_runs` (`key_id`) WHERE "agent_runs"."status" = 'open' and "agent_runs"."key_id" is not null;--> statement-breakpoint
CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`api_key_enc` text NOT NULL,
	`api_key_last4` text NOT NULL,
	`default_model` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_tested_at` integer,
	`last_test_ok` integer,
	`last_test_note` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_providers_provider_unique` ON `ai_providers` (`provider`);--> statement-breakpoint
CREATE TABLE `ai_routes` (
	`purpose` text PRIMARY KEY NOT NULL,
	`primary_provider_id` text,
	`fallback_provider_id` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`primary_provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`fallback_provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `aircraft` (
	`id` text PRIMARY KEY NOT NULL,
	`tail_number` text NOT NULL,
	`operator_id` text NOT NULL,
	`category` text NOT NULL,
	`make_model` text NOT NULL,
	`year_manufactured` integer,
	`seats` integer NOT NULL,
	`range_nm` integer NOT NULL,
	`speed_kt` integer NOT NULL,
	`wifi_type` text DEFAULT 'none' NOT NULL,
	`cabin_height_in` integer,
	`standup_cabin` integer DEFAULT false NOT NULL,
	`lavatory_enclosed` integer DEFAULT false NOT NULL,
	`lieflat_capable` integer DEFAULT false NOT NULL,
	`pet_friendly` integer DEFAULT true NOT NULL,
	`flight_attendant_standard` integer DEFAULT false NOT NULL,
	`base_icao` text,
	`total_hours` integer,
	`last_c_check_on` text,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "aircraft_category_enum" CHECK("aircraft"."category" in ('turboprop', 'light', 'midsize', 'supermid', 'heavy', 'ulr')),
	CONSTRAINT "aircraft_wifi_type_enum" CHECK("aircraft"."wifi_type" in ('none', 'aircell', 'gogo', 'ka', 'yes')),
	CONSTRAINT "aircraft_status_enum" CHECK("aircraft"."status" in ('available', 'aog', 'maint', 'sold'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aircraft_tail_number_uq` ON `aircraft` (`tail_number`);--> statement-breakpoint
CREATE INDEX `aircraft_operator_idx` ON `aircraft` (`operator_id`);--> statement-breakpoint
CREATE INDEX `aircraft_category_idx` ON `aircraft` (`category`);--> statement-breakpoint
CREATE INDEX `aircraft_base_idx` ON `aircraft` (`base_icao`);--> statement-breakpoint
CREATE INDEX `aircraft_status_idx` ON `aircraft` (`status`);--> statement-breakpoint
CREATE TABLE `airports` (
	`id` text PRIMARY KEY NOT NULL,
	`icao` text NOT NULL,
	`iata` text,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`region` text,
	`country_iso2` text NOT NULL,
	`lat` text NOT NULL,
	`lon` text NOT NULL,
	`elevation_ft` integer,
	`tz` text,
	`category` text,
	`longest_runway_ft` integer,
	`customs` text DEFAULT 'none' NOT NULL,
	`slot_controlled` integer DEFAULT false NOT NULL,
	`private_only` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "airports_customs_enum" CHECK("airports"."customs" in ('none', 'user_fee', 'aoe', 'intl')),
	CONSTRAINT "airports_icao_len" CHECK(length("airports"."icao") = 4),
	CONSTRAINT "airports_iata_len" CHECK(length("airports"."iata") = 3),
	CONSTRAINT "airports_country_iso2_len" CHECK(length("airports"."country_iso2") = 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `airports_icao_uq` ON `airports` (`icao`);--> statement-breakpoint
CREATE INDEX `airports_iata_idx` ON `airports` (`iata`);--> statement-breakpoint
CREATE INDEX `airports_country_idx` ON `airports` (`country_iso2`);--> statement-breakpoint
CREATE INDEX `airports_city_idx` ON `airports` (`city`);--> statement-breakpoint
CREATE TABLE `fbos` (
	`id` text PRIMARY KEY NOT NULL,
	`airport_id` text NOT NULL,
	`name` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	`radio_freq_mhz` text,
	`phone_e164` text,
	`after_hours_phone_e164` text,
	`email` text,
	`website` text,
	`hours_weekday` text,
	`hours_weekend` text,
	`customs_24h` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`airport_id`) REFERENCES `airports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fbos_airport_idx` ON `fbos` (`airport_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fbos_airport_name_uq` ON `fbos` (`airport_id`,`name`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`token_hash` text NOT NULL,
	`last4` text NOT NULL,
	`scopes` text NOT NULL,
	`requires_approval` integer DEFAULT true NOT NULL,
	`rate_limit_per_min` integer DEFAULT 120 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`last_used_ip` text,
	`last_used_ua` text,
	`revoked_at` integer,
	`revoked_by` text,
	`revoke_reason` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "api_keys_name_check" CHECK(length("api_keys"."name") between 1 and 60),
	CONSTRAINT "api_keys_scopes_check" CHECK(json_array_length("api_keys"."scopes") > 0 and replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace("api_keys"."scopes", '"read"', ''), '"content"', ''), '"desk"', ''), '"clients"', ''), '"money"', ''), '"settings"', ''), '"admin"', ''), '"agent"', ''), '[', ''), ']', ''), ',', ''), ' ', '') = ''),
	CONSTRAINT "api_keys_rate_limit_per_min_check" CHECK("api_keys"."rate_limit_per_min" between 1 and 2000),
	CONSTRAINT "api_keys_agent_supervised" CHECK(instr("api_keys"."scopes", '"agent"') = 0 or "api_keys"."requires_approval")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_prefix_unique` ON `api_keys` (`prefix`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_unique` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_created_by_idx` ON `api_keys` (`created_by`);--> statement-breakpoint
CREATE TABLE `api_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key_id` text,
	`legacy` integer DEFAULT false NOT NULL,
	`method` text NOT NULL,
	`route` text NOT NULL,
	`status` integer NOT NULL,
	`error_code` text,
	`duration_ms` integer,
	`ip` text,
	`ua` text,
	`run_id` text,
	`request_id` text,
	`at` integer NOT NULL,
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `api_requests_key_at_idx` ON `api_requests` (`key_id`,"at" desc);--> statement-breakpoint
CREATE INDEX `api_requests_at_idx` ON `api_requests` (`at`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`edited_payload` text,
	`summary` text NOT NULL,
	`preview` text,
	`reason` text,
	`risk` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`subject_code` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`dedupe_key` text NOT NULL,
	`requested_by_key` text,
	`requested_by_user` text,
	`run_id` text,
	`decided_by` text,
	`decided_at` integer,
	`decision_note` text,
	`result` text,
	`error` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`requested_by_key`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`requested_by_user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "approvals_summary_check" CHECK(length("approvals"."summary") between 1 and 300),
	CONSTRAINT "approvals_reason_check" CHECK("approvals"."reason" is null or length("approvals"."reason") <= 2000),
	CONSTRAINT "approvals_risk_check" CHECK("approvals"."risk" in ('client','money','settings','access','content')),
	CONSTRAINT "approvals_status_check" CHECK("approvals"."status" in ('pending','executing','executed','failed','rejected','expired')),
	CONSTRAINT "approvals_decision_note_check" CHECK("approvals"."decision_note" is null or length("approvals"."decision_note") <= 1000)
);
--> statement-breakpoint
CREATE INDEX `approvals_status_created_idx` ON `approvals` (`status`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `approvals_pending_subject_idx` ON `approvals` (`subject_type`,`subject_id`) WHERE "approvals"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX `approvals_pending_dedupe_uq` ON `approvals` (`dedupe_key`) WHERE "approvals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `approvals_key_created_idx` ON `approvals` (`requested_by_key`,"created_at" desc);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`actor_role` text,
	`action` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text,
	`subject_code` text,
	`diff` text,
	`metadata` text,
	`ip` text,
	`user_agent` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "audit_log_subject_type_enum" CHECK("audit_log"."subject_type" in ('quote', 'trip', 'invoice', 'member', 'membership', 'reserve_transaction', 'operator', 'aircraft', 'empty_leg', 'empty_leg_watchlist', 'blog_subscriber', 'ai_provider', 'contact_inquiry', 'preferences', 'user_role', 'system', 'api_key', 'blog_post', 'approval', 'agent_run', 'agent_playbook', 'agent_memory'))
);
--> statement-breakpoint
CREATE INDEX `audit_log_subject_idx` ON `audit_log` (`subject_type`,`subject_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_log_occurred_idx` ON `audit_log` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`channel` text NOT NULL,
	`direction` text NOT NULL,
	`from_address` text,
	`to_address` text,
	`from_user_id` text,
	`to_user_id` text,
	`preview` text,
	`body` text,
	`is_read` integer DEFAULT false NOT NULL,
	`delivery_status` text DEFAULT 'skipped' NOT NULL,
	`delivery_provider` text,
	`delivery_message_id` text,
	`delivery_error` text,
	`delivered_at` integer,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "messages_subject_type_enum" CHECK("messages"."subject_type" in ('quote', 'trip', 'invoice', 'member', 'membership', 'reserve_transaction', 'operator', 'aircraft', 'empty_leg', 'empty_leg_watchlist', 'blog_subscriber', 'ai_provider', 'contact_inquiry', 'preferences', 'user_role', 'system', 'api_key', 'blog_post', 'approval', 'agent_run', 'agent_playbook', 'agent_memory')),
	CONSTRAINT "messages_channel_enum" CHECK("messages"."channel" in ('sms', 'email', 'call', 'voicemail', 'inapp', 'system', 'whatsapp')),
	CONSTRAINT "messages_direction_enum" CHECK("messages"."direction" in ('in', 'out')),
	CONSTRAINT "messages_delivery_status_enum" CHECK("messages"."delivery_status" in ('queued', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE INDEX `messages_subject_idx` ON `messages` (`subject_type`,`subject_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `messages_unread_idx` ON `messages` (`is_read`,`to_user_id`);--> statement-breakpoint
CREATE INDEX `messages_delivery_status_idx` ON `messages` (`delivery_status`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `blog_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirm_token_hash` text,
	`confirm_expires_at` integer,
	`confirm_sent_at` integer,
	`confirmed_at` integer,
	`unsubscribe_token` text NOT NULL,
	`unsubscribed_at` integer,
	`last_digest_at` integer,
	`source` text DEFAULT 'blog' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT "blog_subscribers_status_enum" CHECK("blog_subscribers"."status" in ('pending', 'confirmed', 'unsubscribed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_subscribers_email_uq` ON `blog_subscribers` (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX `blog_subscribers_unsub_token_uq` ON `blog_subscribers` (`unsubscribe_token`);--> statement-breakpoint
CREATE INDEX `blog_subscribers_status_idx` ON `blog_subscribers` (`status`);--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`body_md` text NOT NULL,
	`hero_image_url` text,
	`hero_image_alt` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`faq` text DEFAULT '[]' NOT NULL,
	`author` text DEFAULT 'JetNine dispatch desk' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT "blog_posts_status_enum" CHECK("blog_posts"."status" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_posts_slug_idx` ON `blog_posts` (`slug`);--> statement-breakpoint
CREATE INDEX `blog_posts_status_published_idx` ON `blog_posts` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `contact_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`reason` text DEFAULT 'quote' NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`from_text` text,
	`to_text` text,
	`date_text` text,
	`pax_text` text,
	`notes` text,
	`member_id` text,
	`status` text DEFAULT 'new' NOT NULL,
	`handled_by_user_id` text,
	`handled_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`handled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "contact_inquiries_reason_enum" CHECK("contact_inquiries"."reason" in ('quote', 'card', 'trip', 'other')),
	CONSTRAINT "contact_inquiries_status_enum" CHECK("contact_inquiries"."status" in ('new', 'handled'))
);
--> statement-breakpoint
CREATE INDEX `contact_inquiries_status_idx` ON `contact_inquiries` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `contact_inquiries_email_idx` ON `contact_inquiries` (`email`);--> statement-breakpoint
CREATE TABLE `desk_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `staff_notification_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`new_request` integer DEFAULT true NOT NULL,
	`reply_due_soon` integer DEFAULT true NOT NULL,
	`client_pick` integer DEFAULT true NOT NULL,
	`morning_summary` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `empty_leg_code_sequence` (
	`year` integer PRIMARY KEY NOT NULL,
	`last_value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `empty_leg_watchlist_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`watchlist_id` text NOT NULL,
	`leg_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text,
	`provider_message_id` text,
	`error` text,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`watchlist_id`) REFERENCES `empty_leg_watchlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leg_id`) REFERENCES `empty_legs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empty_leg_watchlist_matches_uq` ON `empty_leg_watchlist_matches` (`watchlist_id`,`leg_id`,`channel`);--> statement-breakpoint
CREATE INDEX `empty_leg_watchlist_matches_leg_idx` ON `empty_leg_watchlist_matches` (`leg_id`);--> statement-breakpoint
CREATE TABLE `empty_leg_watchlists` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`email` text,
	`phone_e164` text,
	`from_icao` text,
	`from_text` text,
	`to_icao` text,
	`to_text` text,
	`earliest_on` text,
	`latest_on` text,
	`min_discount_pct` integer DEFAULT 30 NOT NULL,
	`notify_channels` text,
	`active` integer DEFAULT true NOT NULL,
	`sms_confirmed_at` integer,
	`email_confirmed_at` integer,
	`confirm_sms_token_hash` text,
	`confirm_email_token_hash` text,
	`confirm_sent_at` integer,
	`unsubscribe_token` text NOT NULL,
	`confirm_expires_at` integer,
	`deactivated_at` integer,
	`deactivated_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `empty_leg_watchlists_member_idx` ON `empty_leg_watchlists` (`member_id`);--> statement-breakpoint
CREATE INDEX `empty_leg_watchlists_route_idx` ON `empty_leg_watchlists` (`from_icao`,`to_icao`);--> statement-breakpoint
CREATE INDEX `empty_leg_watchlists_phone_idx` ON `empty_leg_watchlists` (`phone_e164`);--> statement-breakpoint
CREATE TABLE `empty_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`aircraft_id` text,
	`operator_id` text NOT NULL,
	`category` text NOT NULL,
	`from_icao` text NOT NULL,
	`from_iata` text,
	`from_city` text,
	`from_name` text,
	`to_icao` text NOT NULL,
	`to_iata` text,
	`to_city` text,
	`to_name` text,
	`wheels_up_at` integer NOT NULL,
	`flight_minutes` integer,
	`distance_nm` integer,
	`seats_available` integer NOT NULL,
	`full_charter_ref_usd` integer NOT NULL,
	`listed_price_usd` integer NOT NULL,
	`discount_pct` integer,
	`auto_price_decay` integer DEFAULT false NOT NULL,
	`min_discount_pct` integer DEFAULT 30 NOT NULL,
	`reserve_lock_minutes` integer DEFAULT 30 NOT NULL,
	`pet_friendly` integer DEFAULT true NOT NULL,
	`allow_split_sectors` integer DEFAULT false NOT NULL,
	`headline` text,
	`body_copy` text,
	`sms_copy` text,
	`board_go_live_at` integer,
	`reserve_early_access_at` integer,
	`sms_blast_at` integer,
	`expires_at` integer,
	`visibility_flags` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`sold_to_member_id` text,
	`sold_at` integer,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`from_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`to_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`sold_to_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "empty_legs_category_enum" CHECK("empty_legs"."category" in ('turboprop', 'light', 'midsize', 'supermid', 'heavy', 'ulr')),
	CONSTRAINT "empty_legs_status_enum" CHECK("empty_legs"."status" in ('draft', 'scheduled', 'live', 'sold', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empty_legs_code_uq` ON `empty_legs` (`code`);--> statement-breakpoint
CREATE INDEX `empty_legs_status_idx` ON `empty_legs` (`status`,`wheels_up_at`);--> statement-breakpoint
CREATE INDEX `empty_legs_route_idx` ON `empty_legs` (`from_icao`,`to_icao`);--> statement-breakpoint
CREATE INDEX `empty_legs_from_icao_idx` ON `empty_legs` (`from_icao`);--> statement-breakpoint
CREATE INDEX `empty_legs_to_icao_idx` ON `empty_legs` (`to_icao`);--> statement-breakpoint
CREATE INDEX `empty_legs_operator_idx` ON `empty_legs` (`operator_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`preferred_name` text,
	`phone_e164` text,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_role_enum" CHECK("users"."role" in ('member', 'dispatcher', 'admin', 'superadmin', 'operator_contact'))
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`desk` text DEFAULT 'float' NOT NULL,
	`years_experience` integer,
	`lane_specialty` text,
	`shift_start` text,
	`shift_end` text,
	`direct_line_e164` text,
	`status` text DEFAULT 'off' NOT NULL,
	`is_lead` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "staff_desk_enum" CHECK("staff"."desk" in ('west', 'east', 'overnight', 'sourcing', 'float', 'lead')),
	CONSTRAINT "staff_status_enum" CHECK("staff"."status" in ('on', 'break', 'off', 'on_call'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_user_id_unique` ON `staff` (`user_id`);--> statement-breakpoint
CREATE TABLE `dispatcher_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`is_primary` integer DEFAULT true NOT NULL,
	`started_on` text NOT NULL,
	`ended_on` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dispatcher_assignments_member_idx` ON `dispatcher_assignments` (`member_id`,`ended_on`);--> statement-breakpoint
CREATE INDEX `dispatcher_assignments_staff_idx` ON `dispatcher_assignments` (`staff_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`member_code` text NOT NULL,
	`legal_name` text,
	`preferred_name` text,
	`birth_date` text,
	`mobile_e164` text,
	`company_name` text,
	`role_title` text,
	`billing_entity_name` text,
	`billing_address` text,
	`tax_id_enc` text,
	`tier` text DEFAULT 'on_demand' NOT NULL,
	`tier_since` text,
	`member_since` text,
	`status` text DEFAULT 'active' NOT NULL,
	`primary_dispatcher_id` text,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`marketing_opt_in` integer DEFAULT false NOT NULL,
	`lifetime_trips_cache` integer DEFAULT 0 NOT NULL,
	`lifetime_hours_cache` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_dispatcher_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "members_tier_enum" CHECK("members"."tier" in ('on_demand', 'card_100', 'card_250', 'card_500', 'reserve_50', 'reserve_100', 'reserve_250', 'reserve_500_apply')),
	CONSTRAINT "members_status_enum" CHECK("members"."status" in ('active', 'paused', 'closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_id_unique` ON `members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_member_code_uq` ON `members` (`member_code`);--> statement-breakpoint
CREATE INDEX `members_tier_idx` ON `members` (`tier`);--> statement-breakpoint
CREATE INDEX `members_status_idx` ON `members` (`status`);--> statement-breakpoint
CREATE INDEX `members_dispatcher_idx` ON `members` (`primary_dispatcher_id`);--> statement-breakpoint
CREATE TABLE `quote_code_sequence` (
	`year` integer PRIMARY KEY NOT NULL,
	`last_value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`leg_number` integer NOT NULL,
	`from_icao` text,
	`from_iata` text,
	`from_city` text,
	`from_name` text,
	`to_icao` text,
	`to_iata` text,
	`to_city` text,
	`to_name` text,
	`depart_date` text,
	`depart_time` text,
	`depart_tz` text,
	`distance_nm` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`to_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_legs_quote_leg_uq` ON `quote_legs` (`quote_id`,`leg_number`);--> statement-breakpoint
CREATE INDEX `quote_legs_route_idx` ON `quote_legs` (`from_iata`,`to_iata`);--> statement-breakpoint
CREATE INDEX `quote_legs_from_icao_idx` ON `quote_legs` (`from_icao`);--> statement-breakpoint
CREATE INDEX `quote_legs_to_icao_idx` ON `quote_legs` (`to_icao`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_code` text DEFAULT '' NOT NULL,
	`member_id` text,
	`created_by_user_id` text,
	`contact_snapshot` text,
	`source` text DEFAULT 'quote_wizard' NOT NULL,
	`trip_type` text NOT NULL,
	`pax_count` integer NOT NULL,
	`children_count` integer DEFAULT 0 NOT NULL,
	`pets_count` integer DEFAULT 0 NOT NULL,
	`extra_bags_count` integer DEFAULT 0 NOT NULL,
	`requested_category` text,
	`cabin_prefs` text,
	`catering_tier` text DEFAULT 'standard',
	`ground_option` text DEFAULT 'sedan',
	`notes` text,
	`contact_methods` text,
	`best_time` text DEFAULT 'any',
	`referral_source` text,
	`consent_broker` integer DEFAULT false NOT NULL,
	`consent_contact` integer DEFAULT false NOT NULL,
	`consent_marketing` integer DEFAULT false NOT NULL,
	`client_idempotency_key` text,
	`status_token` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`assigned_dispatcher_id` text,
	`converted_trip_id` text,
	`received_at` integer NOT NULL,
	`sla_deadline_at` integer NOT NULL,
	`responded_at` integer,
	`sla_alerted_at` integer,
	`accepted_at` integer,
	`indicative_low_usd` integer,
	`indicative_high_usd` integer,
	`final_price_usd` integer,
	`margin_pct` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_dispatcher_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "quotes_pax_range" CHECK("quotes"."pax_count" >= 1 and "quotes"."pax_count" <= 19),
	CONSTRAINT "quotes_notes_length" CHECK("quotes"."notes" is null or length("quotes"."notes") <= 800),
	CONSTRAINT "quotes_source_enum" CHECK("quotes"."source" in ('homepage_widget', 'quote_wizard', 'dispatch_phone', 'dispatch_email', 'empty_leg_inquiry')),
	CONSTRAINT "quotes_trip_type_enum" CHECK("quotes"."trip_type" in ('one_way', 'round', 'multi_leg')),
	CONSTRAINT "quotes_requested_category_enum" CHECK("quotes"."requested_category" in ('turboprop', 'light', 'midsize', 'supermid', 'heavy', 'ulr')),
	CONSTRAINT "quotes_catering_tier_enum" CHECK("quotes"."catering_tier" in ('standard', 'plus', 'premium', 'custom')),
	CONSTRAINT "quotes_ground_option_enum" CHECK("quotes"."ground_option" in ('none', 'sedan', 'suv_sprinter', 'custom')),
	CONSTRAINT "quotes_best_time_enum" CHECK("quotes"."best_time" in ('any', 'morning', 'midday', 'afternoon', 'evening', 'latenight')),
	CONSTRAINT "quotes_status_enum" CHECK("quotes"."status" in ('draft', 'submitted', 'triaged', 'sourcing', 'options_sent', 'held', 'accepted', 'declined', 'expired', 'cancelled', 'converted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_quote_code_uq` ON `quotes` (`quote_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_status_token_uq` ON `quotes` (`status_token`);--> statement-breakpoint
CREATE INDEX `quotes_status_idx` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `quotes_member_idx` ON `quotes` (`member_id`);--> statement-breakpoint
CREATE INDEX `quotes_dispatcher_idx` ON `quotes` (`assigned_dispatcher_id`);--> statement-breakpoint
CREATE INDEX `quotes_sla_idx` ON `quotes` (`sla_deadline_at`);--> statement-breakpoint
CREATE TABLE `operator_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`phone_e164` text,
	`email` text,
	`is_escalation` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `operator_contacts_operator_idx` ON `operator_contacts` (`operator_id`);--> statement-breakpoint
CREATE TABLE `operators` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cert_number` text,
	`faa_part` text DEFAULT '135' NOT NULL,
	`home_airport_icao` text,
	`years_partner` integer,
	`is_preferred` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`argus_rating` text DEFAULT 'none' NOT NULL,
	`wyvern_wingman` integer DEFAULT false NOT NULL,
	`isbao_stage` integer,
	`vetting_extras` text,
	`argus_renews_on` text,
	`wyvern_renews_on` text,
	`isbao_renews_on` text,
	`insurance_renews_on` text,
	`next_audit_on` text,
	`liability_limit_usd` integer,
	`payment_terms` text,
	`volume_discount_pct` text,
	`rate_lock` integer DEFAULT false NOT NULL,
	`notes` text,
	`suspended_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "operators_status_enum" CHECK("operators"."status" in ('active', 'audit_due', 'hold', 'suspended', 'banned')),
	CONSTRAINT "operators_argus_rating_enum" CHECK("operators"."argus_rating" in ('platinum', 'gold', 'silver', 'none'))
);
--> statement-breakpoint
CREATE INDEX `operators_status_idx` ON `operators` (`status`);--> statement-breakpoint
CREATE INDEX `operators_preferred_idx` ON `operators` (`is_preferred`);--> statement-breakpoint
CREATE INDEX `operators_argus_idx` ON `operators` (`argus_rating`);--> statement-breakpoint
CREATE UNIQUE INDEX `operators_cert_number_uq` ON `operators` (`cert_number`);--> statement-breakpoint
CREATE TABLE `trip_code_sequence` (
	`year` integer PRIMARY KEY NOT NULL,
	`last_value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trip_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`leg_number` integer NOT NULL,
	`from_icao` text,
	`from_iata` text,
	`from_city` text,
	`from_name` text,
	`to_icao` text,
	`to_iata` text,
	`to_city` text,
	`to_name` text,
	`scheduled_dep_at` integer,
	`scheduled_arr_at` integer,
	`actual_dep_at` integer,
	`actual_arr_at` integer,
	`depart_date` text,
	`depart_time` text,
	`depart_tz` text,
	`distance_nm` integer,
	`route_string` text,
	`squawk` text,
	`cruise_alt_fl` integer,
	`fuel_onboard_lb` integer,
	`alternate_icaos` text,
	`status_note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`to_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_legs_trip_leg_uq` ON `trip_legs` (`trip_id`,`leg_number`);--> statement-breakpoint
CREATE INDEX `trip_legs_route_idx` ON `trip_legs` (`from_iata`,`to_iata`);--> statement-breakpoint
CREATE INDEX `trip_legs_from_icao_idx` ON `trip_legs` (`from_icao`);--> statement-breakpoint
CREATE INDEX `trip_legs_to_icao_idx` ON `trip_legs` (`to_icao`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_code` text DEFAULT '' NOT NULL,
	`member_id` text NOT NULL,
	`quote_id` text,
	`assigned_dispatcher_id` text,
	`mission_type` text NOT NULL,
	`is_international` integer DEFAULT false NOT NULL,
	`pax_count` integer NOT NULL,
	`crew_count` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`aircraft_id` text,
	`operator_id` text,
	`bill_to_entity` text,
	`bill_to_terms` text,
	`revenue_usd` integer,
	`operator_cost_usd` integer,
	`margin_pct` text,
	`processor_fee_usd` integer,
	`notes_member` text,
	`notes_dispatch` text,
	`manifest_locked_at` integer,
	`apis_filed_at` integer,
	`wheels_up_at` integer,
	`wheels_down_at` integer,
	`eta_at` integer,
	`weight_balance_status` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_dispatcher_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trips_mission_type_enum" CHECK("trips"."mission_type" in ('one_way', 'round', 'multi_leg', 'empty_leg_purchase', 'repositioning_internal')),
	CONSTRAINT "trips_status_enum" CHECK("trips"."status" in ('draft', 'confirmed', 'crew_briefed', 'boarding', 'airborne', 'wheels_down', 'completed', 'cancelled_wx', 'cancelled_other', 'diverted', 'irregular_ops'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trips_trip_code_uq` ON `trips` (`trip_code`);--> statement-breakpoint
CREATE INDEX `trips_status_idx` ON `trips` (`status`);--> statement-breakpoint
CREATE INDEX `trips_member_idx` ON `trips` (`member_id`);--> statement-breakpoint
CREATE INDEX `trips_dispatcher_idx` ON `trips` (`assigned_dispatcher_id`);--> statement-breakpoint
CREATE INDEX `trips_quote_idx` ON `trips` (`quote_id`);--> statement-breakpoint
CREATE TABLE `invoice_code_sequence` (
	`year` integer PRIMARY KEY NOT NULL,
	`last_value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_code` text DEFAULT '' NOT NULL,
	`member_id` text NOT NULL,
	`trip_id` text,
	`kind` text DEFAULT 'charter' NOT NULL,
	`issued_on` text NOT NULL,
	`due_on` text,
	`due_reminder_sent_at` integer,
	`overdue_notified_at` integer,
	`paid_on` text,
	`paid_at` integer,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal_usd` integer,
	`fet_usd` integer,
	`segment_fee_usd` integer,
	`total_usd` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "invoices_kind_enum" CHECK("invoices"."kind" in ('charter', 'credit', 'refund', 'top_up', 'renewal')),
	CONSTRAINT "invoices_status_enum" CHECK("invoices"."status" in ('draft', 'due', 'paid', 'overdue', 'credit', 'void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_code_uq` ON `invoices` (`invoice_code`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_member_idx` ON `invoices` (`member_id`,`issued_on`);--> statement-breakpoint
CREATE INDEX `invoices_trip_idx` ON `invoices` (`trip_id`);--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_type_idx` ON `stripe_webhook_events` (`type`,`received_at`);--> statement-breakpoint
CREATE TABLE `companions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`relation` text NOT NULL,
	`legal_name` text NOT NULL,
	`birth_date` text,
	`ktn_enc` text,
	`apis_complete` integer DEFAULT false NOT NULL,
	`cc_on_itinerary` integer DEFAULT false NOT NULL,
	`species_breed` text,
	`weight_lb` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "companions_relation_enum" CHECK("companions"."relation" in ('spouse', 'family', 'business', 'assistant', 'pet', 'other'))
);
--> statement-breakpoint
CREATE INDEX `companions_member_idx` ON `companions` (`member_id`);--> statement-breakpoint
CREATE TABLE `member_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`country_iso2` text,
	`number_enc` text,
	`expires_on` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "member_documents_doc_type_enum" CHECK("member_documents"."doc_type" in ('passport', 'global_entry', 'known_traveler', 'second_passport')),
	CONSTRAINT "member_documents_country_iso2_len" CHECK(length("member_documents"."country_iso2") = 2)
);
--> statement-breakpoint
CREATE INDEX `member_documents_member_idx` ON `member_documents` (`member_id`,`doc_type`);--> statement-breakpoint
CREATE TABLE `member_lanes` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`from_icao` text NOT NULL,
	`to_icao` text NOT NULL,
	`frequency_per_year` integer,
	`seasonal` integer DEFAULT false NOT NULL,
	`last_flown_at` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_lanes_unique` ON `member_lanes` (`member_id`,`from_icao`,`to_icao`);--> statement-breakpoint
CREATE INDEX `member_lanes_member_idx` ON `member_lanes` (`member_id`);--> statement-breakpoint
CREATE TABLE `member_preferences` (
	`member_id` text PRIMARY KEY NOT NULL,
	`default_aircraft_category` text,
	`cabin_wifi` integer DEFAULT true NOT NULL,
	`cabin_standup` integer DEFAULT false NOT NULL,
	`cabin_lavatory_enclosed` integer DEFAULT true NOT NULL,
	`cabin_lieflat` integer DEFAULT false NOT NULL,
	`cabin_flight_attendant` integer DEFAULT false NOT NULL,
	`cabin_pet_friendly` integer DEFAULT false NOT NULL,
	`lieflat_min_hours` integer DEFAULT 5 NOT NULL,
	`catering_tier` text DEFAULT 'standard' NOT NULL,
	`dietary` text,
	`bar_preferences` text,
	`standing_catering_notes` text,
	`ground_type` text DEFAULT 'sedan' NOT NULL,
	`ground_vendor` text,
	`fbo_defaults` text,
	`arrival_window_minutes` integer DEFAULT 15 NOT NULL,
	`comms_voice` integer DEFAULT true NOT NULL,
	`comms_email` integer DEFAULT true NOT NULL,
	`comms_sms_updates` integer DEFAULT false NOT NULL,
	`comms_sms_empty_leg` integer DEFAULT false NOT NULL,
	`quiet_hours_start` text,
	`quiet_hours_end` text,
	`quiet_hours_tz` text,
	`empty_leg_alert_threshold_pct` integer DEFAULT 40 NOT NULL,
	`anonymize_manifest` integer DEFAULT false NOT NULL,
	`block_flight_tracking` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "member_preferences_default_aircraft_category_enum" CHECK("member_preferences"."default_aircraft_category" in ('turboprop', 'light', 'midsize', 'supermid', 'heavy', 'ulr')),
	CONSTRAINT "member_preferences_catering_tier_enum" CHECK("member_preferences"."catering_tier" in ('standard', 'plus', 'premium', 'custom')),
	CONSTRAINT "member_preferences_ground_type_enum" CHECK("member_preferences"."ground_type" in ('none', 'sedan', 'suv_sprinter', 'custom'))
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`program` text NOT NULL,
	`deposit_usd` integer NOT NULL,
	`cashback_pct` text DEFAULT '0' NOT NULL,
	`callout_hours` integer NOT NULL,
	`rate_lock_months` integer DEFAULT 24 NOT NULL,
	`catering_included_tier` text,
	`catering_allowance_usd` integer DEFAULT 0 NOT NULL,
	`ground_allowance_usd` integer DEFAULT 0 NOT NULL,
	`named_cardholders_limit` integer DEFAULT 1 NOT NULL,
	`empty_leg_advance_minutes` integer DEFAULT 30 NOT NULL,
	`activated_on` text NOT NULL,
	`expires_on` text,
	`auto_renew` integer DEFAULT false NOT NULL,
	`next_renewal_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`activated_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memberships_program_enum" CHECK("memberships"."program" in ('on_demand', 'card_100', 'card_250', 'card_500', 'reserve_50', 'reserve_100', 'reserve_250', 'reserve_500_apply')),
	CONSTRAINT "memberships_catering_included_tier_enum" CHECK("memberships"."catering_included_tier" in ('standard', 'plus', 'premium', 'custom')),
	CONSTRAINT "memberships_status_enum" CHECK("memberships"."status" in ('active', 'paused', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `memberships_member_idx` ON `memberships` (`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `memberships_program_idx` ON `memberships` (`program`);--> statement-breakpoint
CREATE TABLE `reserve_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`membership_id` text,
	`kind` text NOT NULL,
	`amount_usd` integer NOT NULL,
	`description` text,
	`trip_id` text,
	`invoice_id` text,
	`stripe_payment_intent_id` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reserve_transactions_kind_enum" CHECK("reserve_transactions"."kind" in ('top_up', 'charter_draw', 'credit_accrual', 'refund', 'adjustment'))
);
--> statement-breakpoint
CREATE INDEX `reserve_transactions_member_idx` ON `reserve_transactions` (`member_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `reserve_transactions_membership_idx` ON `reserve_transactions` (`membership_id`);--> statement-breakpoint
CREATE INDEX `reserve_transactions_trip_idx` ON `reserve_transactions` (`trip_id`);--> statement-breakpoint
CREATE INDEX `reserve_transactions_invoice_idx` ON `reserve_transactions` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `aircraft_schedule_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`aircraft_id` text NOT NULL,
	`kind` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`related_trip_id` text,
	`related_quote_id` text,
	`from_icao` text,
	`to_icao` text,
	`crew_ids` text,
	`notes` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`to_icao`) REFERENCES `airports`(`icao`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "aircraft_schedule_blocks_kind_enum" CHECK("aircraft_schedule_blocks"."kind" in ('trip', 'maintenance', 'repositioning', 'crew_rest', 'owner', 'hold', 'unavailable'))
);
--> statement-breakpoint
CREATE INDEX `asb_aircraft_window_idx` ON `aircraft_schedule_blocks` (`aircraft_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `asb_kind_idx` ON `aircraft_schedule_blocks` (`kind`);--> statement-breakpoint
CREATE INDEX `asb_window_idx` ON `aircraft_schedule_blocks` (`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `asb_related_trip_idx` ON `aircraft_schedule_blocks` (`related_trip_id`);--> statement-breakpoint
CREATE INDEX `asb_related_quote_idx` ON `aircraft_schedule_blocks` (`related_quote_id`);--> statement-breakpoint
CREATE INDEX `asb_from_icao_idx` ON `aircraft_schedule_blocks` (`from_icao`);--> statement-breakpoint
CREATE INDEX `asb_to_icao_idx` ON `aircraft_schedule_blocks` (`to_icao`);--> statement-breakpoint
CREATE TABLE `sourced_options` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`option_number` integer NOT NULL,
	`avinode_ref` text,
	`aircraft_type` text,
	`tail_number` text,
	`is_floating_fleet` integer DEFAULT false NOT NULL,
	`year_of_make` integer,
	`category` text,
	`pax_capacity` integer,
	`refurb_interior_year` integer,
	`refurb_exterior_year` integer,
	`operator_name_raw` text,
	`operator_id` text,
	`operator_matched` integer DEFAULT false NOT NULL,
	`argus_rating` text,
	`wyvern_wingman` integer,
	`isbao_stage` integer,
	`safety_floor_passed` integer DEFAULT false NOT NULL,
	`positioning_time_min` integer,
	`positioning_airport` text,
	`total_flight_time_min` integer,
	`operator_cost_usd` integer,
	`markup_type` text DEFAULT 'percent' NOT NULL,
	`markup_value` text,
	`client_price_usd` integer,
	`soft_hold_expiry` integer,
	`status` text DEFAULT 'sourced' NOT NULL,
	`is_chosen` integer DEFAULT false NOT NULL,
	`dispatcher_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sourced_options_category_enum" CHECK("sourced_options"."category" in ('turboprop', 'light', 'midsize', 'supermid', 'heavy', 'ulr')),
	CONSTRAINT "sourced_options_argus_rating_enum" CHECK("sourced_options"."argus_rating" in ('platinum', 'gold', 'silver', 'none')),
	CONSTRAINT "sourced_options_markup_type_enum" CHECK("sourced_options"."markup_type" in ('percent', 'flat')),
	CONSTRAINT "sourced_options_status_enum" CHECK("sourced_options"."status" in ('sourced', 'shortlisted', 'sent_to_client', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sourced_options_quote_option_uq` ON `sourced_options` (`quote_id`,`option_number`);--> statement-breakpoint
CREATE INDEX `sourced_options_quote_idx` ON `sourced_options` (`quote_id`);--> statement-breakpoint
CREATE TABLE `voice_agent_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`version` integer NOT NULL,
	`config` text NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `voice_agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_agent_versions_agent_id_version_key` ON `voice_agent_versions` (`agent_id`,`version`);--> statement-breakpoint
CREATE TABLE `voice_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_live` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_agents_one_live_idx` ON `voice_agents` (`is_live`) WHERE "voice_agents"."is_live";--> statement-breakpoint
CREATE TABLE `user_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_idx` ON `user_sessions` (`expires_at`);