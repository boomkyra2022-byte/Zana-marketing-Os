-- Ads Automation Bot — Phase 1: schedule the ads-sync Edge Function via
-- pg_cron + pg_net, every 15 minutes.
--
-- ============================================================
-- ONE-TIME MANUAL STEP REQUIRED BEFORE THIS SCHEDULE WILL WORK
-- ============================================================
-- This migration deliberately does NOT hardcode the project URL or the
-- service-role key (both are secrets / environment-specific). Instead the
-- cron job reads them from Supabase Vault. Run the block below ONCE in the
-- Supabase SQL editor (NOT committed to this repo, real values only):
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/ads-sync', 'ads_sync_function_url');
--   select vault.create_secret('<service-role-key>', 'ads_sync_service_role_key');
--
-- If you ever rotate the service-role key, update the secret with:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'ads_sync_service_role_key'),
--     '<new-service-role-key>'
--   );

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- cron.schedule() upserts by job name (pg_cron 1.4+), so re-running this
-- migration is safe and just re-applies the same schedule.
select cron.schedule(
  'ads-sync-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ads_sync_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ads_sync_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
