-- ZANA Framework — additive-only migration (explicit user request: add a
-- Hook -> Problem -> Agitate -> Bridge -> Solution -> Proof/Product Reason ->
-- CTA creative framework as a selectable mode alongside the existing
-- Standard funnel-stage flow and the existing Script structure
-- (Hook -> Belief -> Story -> Proof -> Turning Point -> Offer -> CTA).
--
-- Design constraint from the user: canonical `funnel_stage` on ideas must
-- keep using only Awareness/Consideration/Conversion/Retention (the AI still
-- infers and writes one of these even when the user picks "ZANA Framework"
-- in the UI) — so framework selection is tracked in a *separate* column,
-- never forced into funnel_stage. No existing column is renamed, dropped,
-- or constrained more tightly. Safe to re-run (all `add column if not
-- exists`).

alter table ideas add column if not exists framework text default 'STANDARD';
alter table ideas add column if not exists agitate text;
alter table ideas add column if not exists bridge text;
alter table ideas add column if not exists product_reason text;

alter table scripts add column if not exists framework text default 'STANDARD';
alter table scripts add column if not exists problem text;
alter table scripts add column if not exists agitate text;
alter table scripts add column if not exists bridge text;
alter table scripts add column if not exists solution text;
