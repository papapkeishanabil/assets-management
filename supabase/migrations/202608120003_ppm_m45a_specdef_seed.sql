-- ============================================================
-- PPM M4.5A SEED — Specification Definitions tambahan
-- (user-APPROVED 2026-08-12, nomenklatur final)
--
--   SCOTCHLIGHT:
--     JENIS_SCOTCHLIGHT   TEXT
--     LEBAR_SCOTCHLIGHT   NUMBER (inch)
--     POSISI_SCOTCHLIGHT  TEXT
--     STITCH_SCOTCHLIGHT  TEXT
--   MANSET:
--     LEBAR_MANSET        NUMBER (cm)  — setelah TINGGI_MANSET (sort 2)
--
-- Idempotent (ON CONFLICT (component_definition_id, spec_key) DO NOTHING),
-- mengikuti pola seed M2 (JOIN VALUES + JOIN component_definitions by code).
-- ADDITIVE: tanpa DROP/RENAME, tanpa schema change, RLS/tabel tidak disentuh.
-- SAKU_LENGAN/SAKU_SAMPING/SAKU_BELAKANG TIDAK di-seed (menunggu requirement).
-- ============================================================
INSERT INTO component_specification_definitions
  (component_definition_id, spec_key, spec_label, value_type, default_unit, sort_order, is_required_default)
SELECT cd.id, v.key, v.label, v.typ, v.unit, v.sort, v.req
FROM component_definitions cd
JOIN (VALUES
  -- SCOTCHLIGHT
  ('SCOTCHLIGHT','JENIS_SCOTCHLIGHT','Jenis Scotchlight','TEXT',NULL,1,true),
  ('SCOTCHLIGHT','LEBAR_SCOTCHLIGHT','Lebar Scotchlight','NUMBER','inch',2,true),
  ('SCOTCHLIGHT','POSISI_SCOTCHLIGHT','Posisi Scotchlight','TEXT',NULL,3,true),
  ('SCOTCHLIGHT','STITCH_SCOTCHLIGHT','Stitch Scotchlight','TEXT',NULL,4,false),
  -- MANSET
  ('MANSET','LEBAR_MANSET','Lebar Manset','NUMBER','cm',2,false)
) v(code, key, label, typ, unit, sort, req) ON v.code = cd.code
ON CONFLICT (component_definition_id, spec_key) DO NOTHING;

SELECT 'PPM M4.5A seed (SCOTCHLIGHT x4 + LEBAR_MANSET) applied successfully!' AS message;
