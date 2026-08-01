-- ZANA Marketing OS V2 — video_analysis was missing update/delete RLS
-- policies (0001 only added select+insert). The V2 Loop needs to UPDATE a
-- video_analysis row after "Generate V2 Recommendation" (priority_fixes,
-- revised_script, revised_edit_plan) — without this policy RLS silently
-- blocks the update. Additive only, mirrors the pattern already used by
-- ideas/scripts/storyboards/videos/winners.

create policy "video_analysis_update" on video_analysis for update using (public.current_role() <> 'viewer');
create policy "video_analysis_delete" on video_analysis for delete using (public.current_role() in ('admin','owner'));
