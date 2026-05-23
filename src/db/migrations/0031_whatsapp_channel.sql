-- Add 'whatsapp' to the message_channel enum so dispatchers can post
-- WhatsApp messages on a thread the same way they post SMS.
--
-- ALTER TYPE ... ADD VALUE doesn't take a transaction in older Postgres,
-- but since PG12 it's transactional in most contexts. Supabase is
-- PG17 so we're fine.

alter type public.message_channel add value if not exists 'whatsapp';
