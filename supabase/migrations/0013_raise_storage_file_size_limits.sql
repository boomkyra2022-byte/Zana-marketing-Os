-- Fixes a real upload failure the user hit: direct-from-device uploads to
-- the "source-uploads" bucket were rejected with "The object exceeded the
-- maximum allowed size" even though the file was under our own app-level
-- 300MB cap (MAX_UPLOAD_BYTES in editor-client.tsx / MAX_BYTES_DEFAULT
-- server-side). Root cause: neither storage bucket (source-uploads,
-- edited-clips) ever set its own file_size_limit when created, so both fell
-- back to Supabase's project-wide default — commonly 50MB unless raised.
--
-- IMPORTANT: a bucket-level limit can never exceed the project's GLOBAL
-- file size limit (Supabase Dashboard -> Project Settings -> Storage). That
-- global setting is hard-capped at 50MB on Supabase's Free plan (cannot be
-- raised at all on Free) and must be raised MANUALLY in the dashboard on
-- Pro plan and up. This migration only fixes the bucket-level half of the
-- limit — see TODO.md for the required manual dashboard step.

update storage.buckets set file_size_limit = 314572800 where id = 'source-uploads'; -- 300MB, matches MAX_UPLOAD_BYTES
update storage.buckets set file_size_limit = 314572800 where id = 'edited-clips';   -- 300MB, matches MAX_BYTES_DEFAULT
