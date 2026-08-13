// ============================================================
// verify-ppm-m45a-migration.js — structural check bahwa M4.5A
// benar-benar terpasang di DB:
//   - 5 tabel baru (template, template_components, template_specs,
//     company_technical_standards, company_technical_standard_specs)
//   - index unik (std+custom, NULL-safe uniqueness strategy)
//   - RLS enabled pada 5 tabel
//   - 10 policies (Pattern A read + super_admin manage)
//   - seed product types KEMEJA_LAPANGAN / KEMEJA_KANTOR
// Memakai exec_sql (service key). TIDAK mencetak key.
// ============================================================
import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as key, assertServiceKey } from './_ppm-env.js';
assertServiceKey();

const sql = `
DO $verify$
BEGIN
  -- 5 tables
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_spec_templates')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: table ppm_spec_templates';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_spec_template_components')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: table ppm_spec_template_components';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_spec_template_specs')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: table ppm_spec_template_specs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_company_technical_standards')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: table ppm_company_technical_standards';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_company_technical_standard_specs')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: table ppm_company_technical_standard_specs';
  END IF;

  -- unique indexes (NULL-safe strategy)
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ppm_spec_template_components_std_unique' AND tablename='ppm_spec_template_components')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: index ppm_spec_template_components_std_unique';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ppm_spec_template_components_custom_unique' AND tablename='ppm_spec_template_components')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: index ppm_spec_template_components_custom_unique';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ppm_spec_template_specs_std_unique' AND tablename='ppm_spec_template_specs')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: index ppm_spec_template_specs_std_unique';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ppm_spec_template_specs_custom_unique' AND tablename='ppm_spec_template_specs')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: index ppm_spec_template_specs_custom_unique';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ppm_company_technical_standard_specs_key_unique' AND tablename='ppm_company_technical_standard_specs')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: index ppm_company_technical_standard_specs_key_unique';
  END IF;

  -- RLS enabled
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_spec_templates' AND rowsecurity)
    THEN RAISE EXCEPTION 'MISSING_RLS: ppm_spec_templates';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_spec_template_components' AND rowsecurity)
    THEN RAISE EXCEPTION 'MISSING_RLS: ppm_spec_template_components';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_spec_template_specs' AND rowsecurity)
    THEN RAISE EXCEPTION 'MISSING_RLS: ppm_spec_template_specs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_company_technical_standards' AND rowsecurity)
    THEN RAISE EXCEPTION 'MISSING_RLS: ppm_company_technical_standards';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_company_technical_standard_specs' AND rowsecurity)
    THEN RAISE EXCEPTION 'MISSING_RLS: ppm_company_technical_standard_specs';
  END IF;

  -- policies (2 per table = 10)
  IF (SELECT count(*) FROM pg_policies WHERE tablename IN
        ('ppm_spec_templates','ppm_spec_template_components','ppm_spec_template_specs',
         'ppm_company_technical_standards','ppm_company_technical_standard_specs')) <> 10
    THEN RAISE EXCEPTION 'MISSING_POLICY: expected 10 policies';
  END IF;

  -- seed product types
  IF NOT EXISTS (SELECT 1 FROM product_types WHERE code='KEMEJA_LAPANGAN')
    THEN RAISE EXCEPTION 'MISSING_SEED: KEMEJA_LAPANGAN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM product_types WHERE code='KEMEJA_KANTOR')
    THEN RAISE EXCEPTION 'MISSING_SEED: KEMEJA_KANTOR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM product_types WHERE code='KEMEJA')
    THEN RAISE EXCEPTION 'MISSING_LEGACY: KEMEJA should remain';
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
console.log(ok ? '\nVERIFY PASS — M4.5A aktif di DB (5 tabel + 5 unique index + RLS + 10 policies + seed product types).'
               : '\nVERIFY FAIL — komponen belum terpasang di DB (lihat body).');
process.exit(ok ? 0 : 1);
