-- Blog subscribers are consent-bearing rows, so their confirm/unsubscribe
-- transitions belong in the audit log like the watchlist ones do.
alter type audit_subject_type add value if not exists 'blog_subscriber';
