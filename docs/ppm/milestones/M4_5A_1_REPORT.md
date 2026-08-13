# PPM M4.5A.1 — Simple Conditional Technical Standards V1

> Status: **LOCKED — user-accepted 2026-08-13** —
> migration `202608130002` applied + verify PASS; `test:ppm:m4.5a.1`
> 54→**67 PASS / 0 FAIL** (termasuk **unit suffix bugfix** — render-only,
> TANPA migration); aggregate **571 PASS / 0 FAIL** (M1→M4.5A.1) +
> build PASS. Metrics final: M4.5A **123**, M4.5A.1 **67** — total **571**.
> **JANGAN REFACTOR.**

## 0. User Manual Verification (2026-08-13) — ACCEPTED

1. Contextual component → spec picker — **PASS**
2. Unit rendering: `inch` & `cm` — **PASS**
3. Template persistence: Edit → Save → Refresh; komponen/spec lain tetap utuh — **PASS**
4. Duplicate conditional rule protection — **PASS**
5. Contradictory conditional rule protection — **PASS**
6. Conditional standard: Lebar Scotchlight 1 inch → Single Stitch;
   Lebar Scotchlight 2 inch → Double Stitch — **PASS**

**Known deferred (M4.5A family close-out, 2026-08-13):**
- Customer Model Reference = **M4.5B** (belum dikerjakan)
- explicit APPLICABLE / NOT_APPLICABLE = **M4.5B**
- Build From Reference / fork = **M4.5B**
- colorway / body color structure = **M4.5B**
- Artwork Library = **future**
- Customer Model → PO clone = **M4.5C**
- Historical import = **M4.5D**

## 1. Latar Belakang & Scope

Setelah WIKA Master Patch (2026-08-13, `202608130001` — 5 komponen + 18 spec
defs, TANPA nilai WIKA), user menyetujui task **"Master Patch + M4.5A.1"**:
standar teknis bersyarat **V1 sederhana** — **JIKA `<spec>` = `<nilai>` MAKA
`<spec>` = `<nilai>`**, operator **EQUALS saja**.

**BUKAN rule engine.** TIDAK ada AND/OR/nested/formula/scripting/arbitrary
expression. Conflict lintas standard = DEFERRED (tidak dibuat). WIKA override
tetap pure-evaluation concern **M4.5B** (migration ini TIDAK menyentuh customer
model).

**Contoh nyata Harmas yang menjadi fixtures test:** JIKA `LEBAR_SCOTCHLIGHT` = 1
inch MAKA `STITCH_SCOTCHLIGHT` = Single Stitch; JIKA `LEBAR_SCOTCHLIGHT` = 2
inch MAKA `STITCH_SCOTCHLIGHT` = Double Stitch.

## 2. Perubahan Database (additive only)

Migration: `supabase/migrations/202608130002_ppm_m45a1_conditional_rules.sql`

| Perubahan | Isi |
|---|---|
| `ppm_company_technical_standards.standard_type` (ADD COLUMN IF NOT EXISTS) | `FIXED` (existing simple) / `CONDITIONAL` (rules); CHECK constraint; backfill existing → `FIXED`; default `FIXED`; NOT NULL |
| `ppm_company_technical_standard_rules` (NEW) | 1 baris = 1 aturan: `standard_id` (CASCADE) + `component_definition_id` (SET NULL saat def dihapus) + condition (JIKA): spec key/label snapshot + operator `EQUALS` (CHECK) + typed value (`condition_value_text/number/boolean/json`) + result (MAKA): spec key/label snapshot + typed value; `sort_order`, `is_active` (soft-delete), `created_by`, timestamps |
| Index | 5 index lookup (standard/component/condition/result/active) + **unique index NULL-safe** `ppm_company_technical_standard_rules_cond_unique` pada `(standard_id, component_definition_id, condition_spec_key_snapshot, condition_value_type, COALESCE(...))` — sentinel `-1e300` untuk numeric, `false` boolean, `'null'::jsonb` — **duplicate DAN kontradiksi otomatis DITOLAK** (satu kondisi hanya 1 hasil per standard) |
| Trigger `check_ppm_std_rule_consistency()` | BEFORE INSERT/UPDATE: condition & result spec WAJIB milik komponen rule (cross-component DITOLAK — error `CONDITION_COMPONENT_MISMATCH` / `RESULT_COMPONENT_MISMATCH`); typed value wajib terisi sesuai `value_type` (error `*_VALUE_REQUIRED`). Tanpa ini rule "Scotchlight → Tinggi Kerah" bisa masuk via REST |
| Trigger `updated_at` | Reuse `update_ppm_m1_updated_at_column()` (M1) — tidak ada helper baru |
| RLS | Pattern A master (sama M4.5A): `authenticated read` (akun ACTIVE) + `super_admin manage` (WITH CHECK) — 2 policies |

**Additive only:** TIDAK ada DROP/RENAME/destructive ALTER/RLS disable.
Simple Standard (FIXED) tetap didukung penuh (`standard_type='FIXED'` default).

## 3. Kode Frontend (pure evaluator — TANPA DB mutation)

| File | Isi |
|---|---|
| `src/lib/ppm-m45a1-rules.js` | **Pure module (zero import)** — `RULE_VALUE_TYPE`/`RULE_OPERATOR` (EQUALS), `ruleConditionValue`/`ruleResultValue` (pembaca kolom typed), `typedValuesEqual` (NUMBER numerik presisi / BOOLEAN / SELECT+MULTI_SELECT JSON sorted / TEXT trim), `formatRuleValue` (typed + unit, e.g. "1 inch"), `evaluateTechnicalStandardRules` (filter is_active + EQUALS, match typed, sort by `sort_order` → `{ matched, byResultKey }`; **tidak memutasi input**), `evaluateStandardResultKeys` (ringkas untuk compose M4.5B), `validateTechnicalStandardRules` (client-side friendly: komponen/spec/nilai wajib, duplicate + kontradiksi diblokir — DB tetap penjaga terakhir) |

**Provenance (future M4.5B compose):** hasil evaluasi = **STANDARD value**;
customer explicit value berbeda = OVERRIDE dan menang saat compose; standard
TIDAK berubah. Evaluator ini hanya menyediakan lapisan "applicable standard",
bukan precedence resolver (M4.5B).

## 4. Verification

```bash
node scripts/run-ppm-m45a1-migration.js          # apply migration 202608130002
node scripts/verify-ppm-m45a1-migration.js       # structural: rules table + cond_unique + trigger + RLS 2 policies + standard_type col/backfill + simple M4.5A utuh
node scripts/run-ppm-m45a-wika-master.js         # (sudah applied 2026-08-13) master patch 202608130001
node scripts/verify-ppm-wika-master.js           # structural WIKA patch + integrity M4.5A/M4.5A.1
npm run test:ppm:m4.5a.1                         # 67 PASS / 0 FAIL
npm run test:ppm                                 # aggregate: 571 PASS / 0 FAIL (M1→M4.5A.1)
npm run build                                    # PASS
```

Cakupan `test:ppm:m4.5a.1` (67 check — 54 asli + 13 unit suffix):

- Setup: KEMEJA_LAPANGAN + komponen SCOTCHLIGHT/KERAH/SKODER_BAHU/BORDIR +
  spec defs (LEBAR inch, STITCH TEXT, KONTINUITAS SELECT, TINGGI_KERAH
  cross-component fixture).
- Create: standard `CONDITIONAL` + rule `1 inch → Single Stitch` +
  `2 inch → Double Stitch` (mustCreate invariant — gagal = SEGERA FAIL).
- Typed: condition NUMBER + unit inch tersimpan; result TEXT tersimpan;
  operator EQUALS.
- Pure evaluator: 1 inch → Single (1 matched); 2 inch → Double;
  3 inch / 1.5 inch → tidak ada hasil (equality numerik tepat).
- Component consistency: condition & result belong SCOTCHLIGHT; cross-component
  (TINGGI_KERAH di rule SCOTCHLIGHT) DITOLAK trigger + token
  `CONDITION_COMPONENT_MISMATCH`.
- Duplicate rule (sama persis) → 409; kontradiksi (kondisi sama hasil beda) →
  409; kondisi berbeda hasil sama → diizinkan.
- is_active: rule nonaktif DIABAIKAN evaluator.
- Simple Standard (FIXED): tetap dibuat + spec tersimpan; default `FIXED`
  (backfill aman); `standard_type` di luar FIXED/CONDITIONAL ditolak;
  standard CONDITIONAL tidak punya simple specs (tipe eksklusif).
- Contextual picker tetap benar (master patch utuh): SCOTCHLIGHT 6 defs (tidak
  bocor), SKODER_BAHU 2 defs, BORDIR 7 defs, TIDAK menampilkan TINGGI_KERAH.
- Evaluator tidak memutasi input (deep-equal).
- Pure helpers spot: ruleConditionValue / ruleResultValue / typedValuesEqual /
  formatRuleValue ("1 inch", "Single Stitch") / validate client-side
  (duplicate, kontradiksi, nilai MAKA kosong).
- RLS: anon write ditolak; policy structural (authenticated read + super_admin
  manage; sibling M4.5A policies utuh); anon read 0 rows.
- Schema: kolom `standard_type` ada.
- Cleanup: cascade rules otomatis dari standard; marker sweep — tidak pernah
  by nama bisnis.

## 5. Catatan Keputusan & Batasan V1

- **ONE CONDITION → ONE RESULT.** Operator EQUALS saja. Perluasan (AND/OR/
  operator lain/expression) = task/requirement baru, BUKAN refactor.
- Unique index nullable-NULL-safe via COALESCE + sentinel — duplicate rule
  TIDAK bisa lolos lewat kolom NULL (mengulang pelajaran NULL-trap M4.5A).
- `condition_value_type` ikut index → TEXT '1' vs NUMBER 1 dianggap beda.
- `is_active` = soft-delete; rule dihapus = baris dihapus (cascade saat
  standard dihapus).
- Trigger konsistensi hanya INSERT/UPDATE; `component_definition_id` FK
  ON DELETE SET NULL (def master dihapus → rule kehilangan komponen —
  validasi tetap jalan saat UPDATE berikutnya).
- WIKA override / compose STANDARD-DEFAULT-OVERRIDE = **M4.5B** (belum
  dikerjakan — tunggu instruksi user).

## 5b. Manual Verification Bugfix (2026-08-13) — Unit Suffix di Rule Editor

**Bug (laporan user):** di UI Aturan Bersyarat, kondisi "Lebar Scotchlight = 1"
tidak menampilkan unit `inch` padahal master `LEBAR_SCOTCHLIGHT` punya
`value_type=NUMBER, default_unit=inch`. Expected: `Lebar Scotchlight = [1] inch`.

**Audit hasil:**
1. Spec definition membawa unit → **YA** (`component_specification_definitions.default_unit`;
   LEBAR_SCOTCHLIGHT=inch, JARAK_SCOTCHLIGHT_DARI_BAHU=cm, STITCH_SCOTCHLIGHT=tidak ada).
2. Rule editor menyimpan/snapshot unit → **YA** — saat spec dipilih,
   `condition_unit`/`result_unit` diisi dari `def.default_unit`;
   tersimpan ke DB (`buildRulePayload`) dan di-reload (`handleEdit`).
3. Unit hanya tidak dirender → **YA** — payload/DB benar; JSX rule editor
   tidak pernah menampilkan `condition_unit`/`result_unit`. Bug = render-only.
4. Condition/result typed input tetap reuse definition metadata → **YA**
   (`value_type` + `options_json` dari def; unit adalah snapshot).

**Fix (minimal, TANPA migration):**
- Pure helper `ruleUnitLabel(rule, side)` di `src/lib/ppm-m45a1-rules.js` —
  membaca SNAPSHOT `condition_unit`/`result_unit` (trim), mengembalikan `''`
  bila tidak ada (TEXT tanpa unit / SELECT tanpa unit → tanpa suffix).
  **TIDAK ada hardcode `inch`.**
- `PPMTechnicalStandardsPage.jsx`: suffix unit dirender dari
  `ruleUnitLabel(r, 'condition')` / `ruleUnitLabel(r, 'result')` setelah
  input value (flex row) — otomatis `inch`, `cm`, atau hilang sesuai data.

**Tests ditambahkan (`test:ppm:m4.5a.1`, 54 → 67):**
- U1: unit `inch` tersimpan di condition rule (snapshot).
- U2: LEBAR_SCOTCHLIGHT → suffix `inch`. U3: JARAK_SCOTCHLIGHT_DARI_BAHU →
  suffix `cm`. U4: STITCH_SCOTCHLIGHT (TEXT) → tanpa suffix.
- U5: result LEBAR → `inch`; U6: result STITCH → tanpa suffix.
- U7/U7b: save/refresh — unit tetap di DB & label tetap setelah re-fetch.
- U8/U9: evaluator semantics UNCHANGED — unit tidak mengubah matching
  (JARAK=10 → STITCH=Double Stitch; STITCH=Single Stitch → LEBAR=1).
Verifikasi: `test:ppm:m4.5a.1` **67 PASS / 0 FAIL**; aggregate **571 PASS /
0 FAIL**; build **PASS**.

## 6. Milestone Selanjutnya (belum dikerjakan — tunggu instruksi user)

- **M4.5B** — Customer Model Reference ("apa model WIKA Kemeja HSE R01?"):
  komposisi template + nilai override + compose (STANDARD/DEFAULT/OVERRIDE,
  memakai `evaluateTechnicalStandardRules` + `resolveComposeValue`).
- **M5+** — belum ditentukan.