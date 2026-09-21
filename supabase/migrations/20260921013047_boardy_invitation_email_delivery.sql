alter table public.boardy_invitations
  add column email_status text
    check (email_status is null or email_status in ('pending', 'sent', 'failed', 'suppressed')),
  add column email_attempt_count integer not null default 0
    check (email_attempt_count between 0 and 12),
  add column email_sent_at timestamptz,
  add column email_provider_message_id text,
  add column email_last_error text;

comment on column public.boardy_invitations.email_status is
  'Transactional invitation-email delivery state. Null means no email was requested.';
