-- Ads Automation Bot — Phase 2: schedule the ads-rules-evaluator Edge
-- Function via pg_cron + pg_net, every 15 minutes, offset 5 minutes after
-- ads-sync's :00/:15/:30/:45 schedule so it evaluates against a snapshot
-- that just landed rather than racing it.
--
-- No new Vault secret needed here: the function URL is not sensitive (it's
-- just https://<project-ref>.supabase.co/functions/v1/<name>, derivable from
-- the public project ref already in this repo) so it's inlined directly.
-- The service-role key is still pulled from Vault, reusing the
-- 'ads_sync_service_role_key' secret created in 0015 — same project, same key.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'ads-rules-evaluator-every-15-min',
  '5-59/15 * * * *', -- :05, :20, :35, :50
  $$
  select net.http_post(
    url := 'https://czpjkszttfibbwcmxwpb.supabase.co/functions/v1/ads-rules-evaluator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ads_sync_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
