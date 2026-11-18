-- Content Studio: automatic Monday news run per client (opt-in).
-- /api/cron/content-studio-weekly (vercel.json, every day 08:00 Asia/Bangkok)
-- makes this week's Creative Brief (Trend Scout web search + brief) for every
-- client with weekly_auto = true that has no brief yet since Monday, and saves
-- it to the library as a draft. Off by default because each run costs OpenAI
-- credit. Safe to run more than once.

alter table studio_clients add column if not exists weekly_auto boolean not null default false;
