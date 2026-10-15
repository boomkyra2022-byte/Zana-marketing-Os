-- Meta webhook delivery diagnostics. Additive only; safe to drop later
-- (drop table public.chat_webhook_events cascade; drop function public.chat_log_webhook).
--
-- Why: when Meta's POSTs are rejected before any chat data is stored (bad
-- signature, unexpected payload shape, wrong Page id, events delivered as
-- `standby`...) nothing is left behind, and the hosting log UI cannot be
-- relied on. One row per call answers "did Meta call us, and why was it
-- rejected?" without ever storing message text, tokens or secrets: only the
-- outcome, sizes, the User-Agent, and payload SHAPE (entry ids, key names).
begin;

create table public.chat_webhook_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  outcome text not null,
  http_status integer,
  body_bytes integer,
  has_signature boolean,
  user_agent text,
  entries integer,
  events integer,
  detail text
);
create index chat_webhook_events_time on public.chat_webhook_events(received_at desc);
create index chat_webhook_events_outcome_time on public.chat_webhook_events(outcome, received_at desc);

alter table public.chat_webhook_events enable row level security;
revoke all on public.chat_webhook_events from anon, authenticated;
grant all on public.chat_webhook_events to service_role;
grant select on public.chat_webhook_events to authenticated;
create policy chat_webhook_events_read on public.chat_webhook_events for select to authenticated using (public.chat_operator());

create function public.chat_log_webhook(
  p_outcome text, p_status integer, p_bytes integer, p_has_sig boolean,
  p_ua text, p_entries integer, p_events integer, p_detail text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- These outcomes can be produced by anyone on the internet without valid
  -- credentials, so cap them per minute: the table cannot be flooded.
  if p_outcome in ('INVALID_SIGNATURE', 'NOT_CONFIGURED', 'ERROR')
     and (select count(*) from chat_webhook_events
          where outcome = p_outcome and received_at > now() - interval '1 minute') >= 10 then
    return;
  end if;

  insert into chat_webhook_events(outcome, http_status, body_bytes, has_signature, user_agent, entries, events, detail)
  values (left(p_outcome, 40), p_status, p_bytes, p_has_sig, left(p_ua, 120), p_entries, p_events, left(p_detail, 500));

  -- Cheap retention: about 1 call in 50 prunes rows older than 14 days.
  if random() < 0.02 then
    delete from chat_webhook_events where received_at < now() - interval '14 days';
  end if;
end $$;

revoke all on function public.chat_log_webhook(text, integer, integer, boolean, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.chat_log_webhook(text, integer, integer, boolean, text, integer, integer, text) to service_role;

commit;
