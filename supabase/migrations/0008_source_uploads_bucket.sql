-- Enables direct-from-device upload for the Editor tool, without ever
-- routing the raw file through a Vercel Function (still a hard 4.5MB
-- request-body limit there — unrelated to this table/bucket, just the
-- reason this has to be a *direct browser -> Supabase Storage* upload).
-- The browser uploads straight to this bucket using the user's own
-- session (RLS-scoped to their own uid folder below); our server never
-- touches the raw bytes, it only later downloads from a signed URL like
-- it already does for any other source_url.

insert into storage.buckets (id, name, public)
values ('source-uploads', 'source-uploads', false)
on conflict (id) do nothing;

drop policy if exists "source_uploads_insert_own" on storage.objects;
drop policy if exists "source_uploads_select_own" on storage.objects;
drop policy if exists "source_uploads_delete_own" on storage.objects;

create policy "source_uploads_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'source-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "source_uploads_select_own" on storage.objects
  for select
  using (
    bucket_id = 'source-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "source_uploads_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'source-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
