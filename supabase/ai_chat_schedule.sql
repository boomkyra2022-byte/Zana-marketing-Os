-- OPTIONAL deployment step after 0029, host secrets and live webhook verification.
-- Uses the same pg_cron/pg_net/Vault pattern as existing Ads Automation.
-- Set two secrets in Supabase Vault UI (never commit their values):
-- ai_chat_worker_url = https://mktos.zanadynasty.com/api/ai-chat/worker
-- ai_chat_worker_secret = same value as AI_CHAT_WORKER_SECRET on the app host
-- Requires pg_cron + pg_net + Vault already enabled (see 0015).
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='ai_chat_worker_url')
    or not exists(select 1 from vault.decrypted_secrets where name='ai_chat_worker_secret') then
    raise exception 'Configure AI Chat worker URL and secret in Vault first';
  end if;
end $$;
select cron.schedule('ai-chat-worker-every-minute','* * * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='ai_chat_worker_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='ai_chat_worker_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 55000
  );
$$);
-- To stop only this worker: select cron.unschedule('ai-chat-worker-every-minute');
