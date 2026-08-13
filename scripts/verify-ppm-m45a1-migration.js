// ============================================================
// verify-ppm-m45a1-migration.js — structural check M4.5A.1:
//   - table ppm_company_technical_standard_rules ada
//   - kolom standard_type di ppm_company_technical_standards
//     (NOT NULL, default FIXED, backfill tuntas)
//   - unique index cond (duplicate+contradiction blocker)
//   - trigger konsistensi komponen ada
//   - RLS + 2 policies
//   - tabel simple M4.5A tetap utuh
// ============================================================
import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as key, assertServiceKey } from './_ppm-env.js';
assertServiceKey();

const sql = `
DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_company_technical_standard_rules')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: rules table';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ppm_company_technical_standard_rules_cond_unique'
      AND tablename='ppm_company_technical_standard_rules')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: cond_unique index';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='trigger_pctsr_consistency'
      AND tgrelid='ppm_company_technical_standard_rules'::regclass) <> 1
    THEN RAISE EXCEPTION 'MISSING_TRIGGER: consistency';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE tablename='ppm_company_technical_standard_rules') <> 2
    THEN RAISE EXCEPTION 'MISSING_POLICY: rules 2';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='ppm_company_technical_standards' AND column_name='standard_type'
        AND data_type='character varying')
    THEN RAISE EXCEPTION 'MISSING_COLUMN: standard_type';
  END IF;
  IF (SELECT is_nullable FROM information_schema.columns
      WHERE table_name='ppm_company_technical_standards' AND column_name='standard_type') <> 'NO'
    THEN RAISE EXCEPTION 'BAD_COLUMN: standard_type harus NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM ppm_company_technical_standards WHERE standard_type IS NULL)
    THEN RAISE EXCEPTION 'BAD_BACKFILL: masih ada standard_type NULL';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conname='ppm_company_technical_standards_standard_type_check'
      AND conrelid='ppm_company_technical_standards'::regclass) <> 1
    THEN RAISE EXCEPTION 'MISSING_CHECK: standard_type check';
  END IF;
  -- sibling M4.5A simple tables masih utuh
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_company_technical_standard_specs')
    THEN RAISE EXCEPTION 'M4.5A_DAMAGED: standard_specs hilang';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_spec_templates')
    THEN RAISE EXCEPTION 'M4.5A_DAMAGED: spec_templates hilang';
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
console.log(ok ? '\nVERIFY PASS — M4.5A.1 aktif di DB (rules + standard_type + trigger + RLS + simple M4.5A utuh).'
               : '\nVERIFY FAIL — lihat body.');
process.exit(ok ? 0 : 1);