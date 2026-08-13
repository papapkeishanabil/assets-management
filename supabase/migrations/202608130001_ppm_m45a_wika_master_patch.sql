-- ============================================================
-- PPM M4.5 MASTER PATCH — WIKA Kemeja Blueprint (user-APPROVED scope,
-- 2026-08-13). Phase 1 dari task "WIKA KEMEJA MASTER PATCH + M4.5A.1".
--
-- ADDITIVE + IDEMPOTENT (INSERT ... ON CONFLICT DO NOTHING):
--   * TIDAK ada DROP/RENAME/destructive ALTER/RLS disable.
--   * TIDAK ada nilai customer WIKA (5cm, 12x15, Korea, Orange, dst) —
--     itu Customer Model Reference (M4.5B).
--   * TIDAK patch KEMEJA_LAPANGAN default components — product type
--     generic harus tetap reusable untuk customer non-WIKA (Part E).
--
-- SCOPE:
--   A. 5 komponen baru: SKODER_BAHU, SKODER_LENGAN, KELIM_BAWAH,
--      BELAHAN_SAMPING, LIST.
--      * SKODER_BAHU/LENGAN != BAH_YOKE — jangan merge (Part A).
--      * LIST = satu reusable component; instance ganda nanti dibedakan
--        location_label (KERAH_BAWAH/ATAS_MANSET/DADA_ATAS_SCOTCHLIGHT) —
--        JANGAN buat component per lokasi.
--   B. 18 spec definitions baru (typing + unit + opsi SELECT).
--      * LEBAR_SKODER/PANJANG_SKODER di-duplicate ke SKODER_BAHU &
--        SKODER_LENGAN — disengaja, kompatibel M2 component-scoped
--        uniqueness (pattern reuse-dengan-duplicate row).
--      * LEBAR_PLAKET legacy TETAP (tidak pernah di-deactivate/drop);
--        template/model baru prefer DALAM+LUAR.
--      * UKURAN_KOTAK_SLIT TIDAK dibuat — makna "kotak 4 cm" masih
--        menunggu verifikasi user.
--      * SELECT options disimpan di options_json (shape [{value,label}] —
--        dipakai SpecValueInput & picker).
--   C. Pos pemeriksaan akhir sesuai convention (DO block + message).
-- ============================================================

-- ============================================================
-- A. COMPONENT DEFINITIONS (idempotent by code UNIQUE)
-- ============================================================
INSERT INTO component_definitions (code, name, is_active)
VALUES
  ('SKODER_BAHU', 'Skoder Bahu', true),
  ('SKODER_LENGAN', 'Skoder Lengan', true),
  ('KELIM_BAWAH', 'Kelim Bawah', true),
  ('BELAHAN_SAMPING', 'Belahan Samping', true),
  ('LIST', 'List / Trim', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- B. SPECIFICATION DEFINITIONS (idempotent by UNIQUE
--    (component_definition_id, spec_key); pola seed M2/M4.5A:
--    JOIN VALUES by component code).
-- ============================================================
INSERT INTO component_specification_definitions
  (component_definition_id, spec_key, spec_label, value_type, default_unit, options_json, sort_order, is_required_default)
SELECT cd.id, v.key, v.label, v.typ, v.unit, v.opts::jsonb, v.sort, v.req
FROM component_definitions cd
JOIN (VALUES
  -- ---- SAKU_DADA -------------------------------------------------
  ('SAKU_DADA','KONSTRUKSI_SAKU','Konstruksi / Pemasangan Saku','TEXT',NULL,NULL,2,true),
  -- Model Saku ("Tempel") dan Konstruksi ("Dijepit") TETAP dua field
  -- terpisah — JANGAN digabung jadi "Tempel (Dijepit)".
  -- ---- SKODER_BAHU ------------------------------------------------
  ('SKODER_BAHU','LEBAR_SKODER','Lebar Skoder','NUMBER','cm',NULL,1,false),
  ('SKODER_BAHU','PANJANG_SKODER','Panjang Skoder','NUMBER','cm',NULL,2,false),
  -- ---- SKODER_LENGAN ----------------------------------------------
  ('SKODER_LENGAN','LEBAR_SKODER','Lebar Skoder','NUMBER','cm',NULL,1,false),
  ('SKODER_LENGAN','PANJANG_SKODER','Panjang Skoder','NUMBER','cm',NULL,2,false),
  -- Duplicate spec_key lintas komponen DISENGAJA (uniqueness scoped
  -- per component_definition_id — kompatibel M2).
  -- ---- PLAKET -----------------------------------------------------
  ('PLAKET','LEBAR_PLAKET_DALAM','Lebar Plaket Dalam','NUMBER','cm',NULL,2,false),
  ('PLAKET','LEBAR_PLAKET_LUAR','Lebar Plaket Luar','NUMBER','cm',NULL,3,false),
  -- LEBAR_PLAKET (legacy, sort 1) TETAP — tidak di-deactivate/drop.
  -- ---- SLIT_LENGAN ------------------------------------------------
  ('SLIT_LENGAN','PANJANG_SLIT_LENGAN','Panjang Slit Lengan','NUMBER','cm',NULL,1,false),
  -- UKURAN_KOTAK_SLIT TIDAK dibuat (makna belum diverifikasi user).
  -- ---- KELIM_BAWAH ------------------------------------------------
  ('KELIM_BAWAH','LEBAR_KELIM_BAWAH','Lebar Kelim Bawah','NUMBER','cm',NULL,1,false),
  -- ---- BELAHAN_SAMPING --------------------------------------------
  ('BELAHAN_SAMPING','TINGGI_BELAHAN_SAMPING','Tinggi Belahan Samping','NUMBER','cm',NULL,1,false),
  -- ---- SCOTCHLIGHT ------------------------------------------------
  ('SCOTCHLIGHT','JARAK_SCOTCHLIGHT_DARI_BAHU','Jarak Scotchlight dari Bahu','NUMBER','cm',NULL,5,false),
  ('SCOTCHLIGHT','KONTINUITAS_SCOTCHLIGHT_PLAKET','Kontinuitas Scotchlight pada Plaket','SELECT',NULL,
     '[{"value":"MENYAMBUNG_TIDAK_TERPUTUS","label":"Menyambung / Tidak Terputus"},{"value":"TERPUTUS_DI_PLAKET","label":"Terputus di Plaket"}]',6,false),
  -- JENIS/LEBAR/POSISI/STITCH_SCOTCHLIGHT tetap; POSISI_SCOTCHLIGHT
  -- TIDAK di-deactivate (detail metadata opsional; location_label =
  -- lokasi instance utama).
  -- ---- LIST -------------------------------------------------------
  ('LIST','WARNA_LIST','Warna List','TEXT',NULL,NULL,1,false),
  ('LIST','LEBAR_LIST','Lebar List','NUMBER','cm',NULL,2,false),
  -- TIDAK seed nilai (Orange/0.7/2 cm) — future Customer Model.
  -- ---- BORDIR -----------------------------------------------------
  ('BORDIR','JENIS_BORDIR','Jenis / Identitas Bordir','TEXT',NULL,NULL,4,true),
  ('BORDIR','REFERENSI_POSISI_BORDIR','Referensi Posisi Bordir','TEXT',NULL,NULL,5,false),
  ('BORDIR','JARAK_BORDIR_DARI_REFERENSI','Jarak Bordir dari Referensi','NUMBER','cm',NULL,6,false),
  ('BORDIR','ARAH_POSISI_BORDIR','Arah Posisi Bordir','SELECT',NULL,
     '[{"value":"DI_ATAS","label":"Di Atas"},{"value":"DI_BAWAH","label":"Di Bawah"},{"value":"DI_KIRI","label":"Di Kiri"},{"value":"DI_KANAN","label":"Di Kanan"}]',7,false)
  -- ARTWORK/UKURAN/POSISI_BORDIR tetap (tidak di-deactivate). Contoh
  -- future: "2 cm DI_ATAS Saku Dada" dipisah terstruktur, bukan
  -- free-text "2 cm di atas saku".
) v(code, key, label, typ, unit, opts, sort, req) ON v.code = cd.code
ON CONFLICT (component_definition_id, spec_key) DO NOTHING;

-- ============================================================
-- C. VERIFY (DO block — exec_sql kembalikan 204 untuk SELECT)
-- ============================================================
DO $verify$
BEGIN
  IF (SELECT count(*) FROM component_definitions WHERE code IN
      ('SKODER_BAHU','SKODER_LENGAN','KELIM_BAWAH','BELAHAN_SAMPING','LIST')) <> 5
    THEN RAISE EXCEPTION 'MISSING_COMPONENTS: expected 5 new components';
  END IF;
  IF (SELECT count(*) FROM component_specification_definitions d
      JOIN component_definitions c ON c.id = d.component_definition_id
      WHERE c.code IN ('SKODER_BAHU','SKODER_LENGAN','KELIM_BAWAH','BELAHAN_SAMPING','LIST',
                       'SAKU_DADA','PLAKET','SLIT_LENGAN','SCOTCHLIGHT','BORDIR')
        AND d.spec_key IN ('KONSTRUKSI_SAKU','LEBAR_SKODER','PANJANG_SKODER',
                           'LEBAR_PLAKET_DALAM','LEBAR_PLAKET_LUAR','PANJANG_SLIT_LENGAN',
                           'LEBAR_KELIM_BAWAH','TINGGI_BELAHAN_SAMPING',
                           'JARAK_SCOTCHLIGHT_DARI_BAHU','KONTINUITAS_SCOTCHLIGHT_PLAKET',
                           'WARNA_LIST','LEBAR_LIST','JENIS_BORDIR',
                           'REFERENSI_POSISI_BORDIR','JARAK_BORDIR_DARI_REFERENSI',
                           'ARAH_POSISI_BORDIR')) <> 18
    THEN RAISE EXCEPTION 'MISSING_DEFS: expected 18 new spec definitions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id = d.component_definition_id
      WHERE c.code='SCOTCHLIGHT' AND d.spec_key='KONTINUITAS_SCOTCHLIGHT_PLAKET'
        AND d.value_type='SELECT'
        AND d.options_json::text LIKE '%MENYAMBUNG_TIDAK_TERPUTUS%'
        AND d.options_json::text LIKE '%TERPUTUS_DI_PLAKET%')
    THEN RAISE EXCEPTION 'MISSING_OPTIONS: KONTINUITAS_SCOTCHLIGHT_PLAKET options';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id = d.component_definition_id
      WHERE c.code='BORDIR' AND d.spec_key='ARAH_POSISI_BORDIR'
        AND d.value_type='SELECT' AND d.options_json::text LIKE '%DI_KANAN%')
    THEN RAISE EXCEPTION 'MISSING_OPTIONS: ARAH_POSISI_BORDIR options';
  END IF;
END
$verify$;

SELECT 'PPM M4.5A WIKA master patch (5 komponen + 18 defs) applied successfully! (no WIKA values seeded)' AS message;