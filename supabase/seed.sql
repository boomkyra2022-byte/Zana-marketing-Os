-- OPTIONAL demo/seed data — run manually, never automatically, never in production.
-- MASTER_PROMPT.md §22. Safe to skip entirely on a fresh production project.

insert into products (brand, sku, product_name, category, status, selling_price, cogs, is_hero)
values
  ('ZANA Kid', 'ZK-PERF-001', 'Kid Perfume', 'Fragrance', 'active', 259.00, 60.00, true),
  ('ZANA', 'ZN-MAT-001', 'Maternity Pants', 'Apparel', 'active', 390.00, 110.00, false),
  ('Kyra', 'KY-VITC-001', 'HYA Vitamin C', 'Skincare', 'active', 490.00, 120.00, true),
  ('Kyra', 'KY-ARB-001', 'Alpha Arbutin', 'Skincare', 'active', 450.00, 100.00, false),
  ('Kyra', 'KY-PUR-001', 'Alpha Purple', 'Skincare', 'active', 420.00, 95.00, false),
  ('ZANA Kid', 'ZK-BROW-001', 'Kid Eyebrow', 'Beauty', 'active', 199.00, 45.00, false)
on conflict (sku) do nothing;

insert into personas (name, age_range, life_stage, pains, desires, preferred_language)
values
  ('Busy Mom 30s', '28-38', 'parent of young kids', '["no time","kid skin sensitivity"]'::jsonb, '["convenience","safety"]'::jsonb, 'th'),
  ('Beauty Beginner', '18-24', 'first job / student', '["dull skin","budget"]'::jsonb, '["glow","affordability"]'::jsonb, 'th')
on conflict do nothing;
