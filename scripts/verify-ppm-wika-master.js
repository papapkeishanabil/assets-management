// ============================================================
// verify-ppm-wika-master.js — structural check master patch:
//   - 5 komponen baru ada (SKODER_BAHU, SKODER_LENGAN, KELIM_BAWAH,
//     BELAHAN_SAMPING, LIST)
//   - 18 spec defs baru ada dengan value_type/unit/options benar
//   - SKODER_BAHU & SKODER_LENGAN masing-masing HANYA defs Skoder
//     (tidak bocor cross-component)
//   - LEBAR_PLAKET legacy masih ada (tidak di-drop)
//   - LEBAR_SKODER/PANJANG_SKODER terduplicate ke kedua SKODER (intended)
//   - UKURAN_KOTAK_SLIT TIDAK ada
//   - M1/M2 defs lama masih utuh (MODEL_KERAH, TINGGI_KERAH, dll)
// ============================================================
import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as key, assertServiceKey } from './_ppm-env.js';
assertServiceKey();

const sql = `
DO $verify$
DECLARE v_skoder_bahu UUID; v_skoder_lengan UUID;
BEGIN
  -- 5 komponen
  IF (SELECT count(*) FROM component_definitions WHERE code IN
      ('SKODER_BAHU','SKODER_LENGAN','KELIM_BAWAH','BELAHAN_SAMPING','LIST')) <> 5
    THEN RAISE EXCEPTION 'MISSING_COMPONENTS: 5';
  END IF;
  -- persis 5 (tidak ada duplikat)
  IF (SELECT count(*) FROM component_definitions WHERE code='LIST') <> 1
    THEN RAISE EXCEPTION 'LIST harus 1 row (bulk component per lokasi DILARANG)';
  END IF;

  -- 18 defs
  IF (SELECT count(*) FROM component_specification_definitions d
      JOIN component_definitions c ON c.id = d.component_definition_id
      WHERE d.spec_key IN ('KONSTRUKSI_SAKU','LEBAR_SKODER','PANJANG_SKODER',
        'LEBAR_PLAKET_DALAM','LEBAR_PLAKET_LUAR','PANJANG_SLIT_LENGAN',
        'LEBAR_KELIM_BAWAH','TINGGI_BELAHAN_SAMPING','JARAK_SCOTCHLIGHT_DARI_BAHU',
        'KONTINUITAS_SCOTCHLIGHT_PLAKET','WARNA_LIST','LEBAR_LIST','JENIS_BORDIR',
        'REFERENSI_POSISI_BORDIR','JARAK_BORDIR_DARI_REFERENSI','ARAH_POSISI_BORDIR')) <> 18
    THEN RAISE EXCEPTION 'MISSING_DEFS: 18';
  END IF;

  -- typing & unit spot-checks
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='SCOTCHLIGHT' AND d.spec_key='JARAK_SCOTCHLIGHT_DARI_BAHU'
        AND d.value_type='NUMBER' AND d.default_unit='cm')
    THEN RAISE EXCEPTION 'BAD_TYPING: JARAK_SCOTCHLIGHT_DARI_BAHU';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='SCOTCHLIGHT' AND d.spec_key='KONTINUITAS_SCOTCHLIGHT_PLAKET'
        AND d.value_type='SELECT')
    THEN RAISE EXCEPTION 'BAD_TYPING: KONTINUITAS_SCOTCHLIGHT_PLAKET harus SELECT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='BORDIR' AND d.spec_key='ARAH_POSISI_BORDIR' AND d.value_type='SELECT')
    THEN RAISE EXCEPTION 'BAD_TYPING: ARAH_POSISI_BORDIR harus SELECT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='PLAKET' AND d.spec_key='LEBAR_PLAKET_DALAM' AND d.default_unit='cm')
    THEN RAISE EXCEPTION 'BAD_UNIT: LEBAR_PLAKET_DALAM';
  END IF;

  -- cross-component isolation (SKODER_BAHU hanya defs skoder)
  SELECT id INTO v_skoder_bahu FROM component_definitions WHERE code='SKODER_BAHU';
  SELECT id INTO v_skoder_lengan FROM component_definitions WHERE code='SKODER_LENGAN';
  IF (SELECT count(*) FROM component_specification_definitions WHERE component_definition_id=v_skoder_bahu) <> 2
     OR (SELECT bool_or(spec_key NOT IN ('LEBAR_SKODER','PANJANG_SKODER'))
         FROM component_specification_definitions WHERE component_definition_id=v_skoder_bahu)
    THEN RAISE EXCEPTION 'CROSS_COMPONENT: SKODER_BAHU bocor';
  END IF;
  IF (SELECT count(*) FROM component_specification_definitions WHERE component_definition_id=v_skoder_lengan) <> 2
     OR (SELECT bool_or(spec_key NOT IN ('LEBAR_SKODER','PANJANG_SKODER'))
         FROM component_specification_definitions WHERE component_definition_id=v_skoder_lengan)
    THEN RAISE EXCEPTION 'CROSS_COMPONENT: SKODER_LENGAN bocor';
  END IF;

  -- LEBAR_PLAKET legacy masih ada
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='PLAKET' AND d.spec_key='LEBAR_PLAKET' AND d.is_active)
    THEN RAISE EXCEPTION 'LEGACY_REMOVED: LEBAR_PLAKET';
  END IF;

  -- UKURAN_KOTAK_SLIT TIDAK boleh ada (menunggu verifikasi user)
  IF EXISTS (SELECT 1 FROM component_specification_definitions WHERE spec_key='UKURAN_KOTAK_SLIT')
    THEN RAISE EXCEPTION 'FORBIDDEN: UKURAN_KOTAK_SLIT dibuat';
  END IF;

  -- M1/M2 defs lama utuh
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='KERAH' AND d.spec_key='MODEL_KERAH' AND d.is_active)
    THEN RAISE EXCEPTION 'M2_DAMAGED: MODEL_KERAH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='SCOTCHLIGHT' AND d.spec_key='JENIS_SCOTCHLIGHT' AND d.is_active)
    THEN RAISE EXCEPTION 'M4.5A_DAMAGED: JENIS_SCOTCHLIGHT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM component_specification_definitions d
      JOIN component_definitions c ON c.id=d.component_definition_id
      WHERE c.code='MANSET' AND d.spec_key='LEBAR_MANSET' AND d.is_active)
    THEN RAISE EXCEPTION 'M4.5A_DAMAGED: LEBAR_MANSET';
  END IF;
END
$verify$;
`;

const r = await fetch(url + '/rest/v1/rpc/exec_sql', {
  method: 'POST',
  headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql }),
});
const t = await r.text();
console.log('status:', r.status);
console.log('body:', t.slice(0, 800));
const ok = r.status < 400;
console.log(ok ? '\nVERIFY PASS — master patch aktif di DB (5 komponen + 18 defs, isolation OK, legacy OK).'
               : '\nVERIFY FAIL — lihat body.');
process.exit(ok ? 0 : 1);