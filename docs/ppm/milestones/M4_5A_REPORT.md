# PPM M4.5A — Specification Template + Simple Technical Standards

> Status: **LOCKED — user-accepted 2026-08-13** —
> manual verification user PASS (contextual component → spec picker; unit
> rendering inch/cm; template persistence Edit→Save→Refresh; conditional rules
> via M4.5A.1) +
> **WIKA master patch (2026-08-13, `202608130001`: 5 komponen + 18 spec
> defs, TANPA nilai WIKA)** applied; `test:ppm:m4.5a` **123 PASS / 0 FAIL**;
> aggregate **571 PASS / 0 FAIL** (M1→M4.5A.1) + build PASS.
> **JANGAN REFACTOR.** Suksesor: `docs/ppm/milestones/M4_5A_1_REPORT.md` (LOCKED 2026-08-13).

## 1. Manual Verification Bugfix (2026-08-12) — Contextual Spec Picker

**Bug:** di Template Spesifikasi, saat Component = Scotchlight, dropdown
Specification menampilkan spec definitions dari SEMUA component (Model Saku,
Ukuran Bordir, Stitch Bah, dll).

**Root cause (audited):**
1. `component_specification_definitions` **punya** `component_definition_id`
   (13 defs, semua ter-assign ke 8 komponen; tidak ada NULL) — master OK.
2. `PPMSpecTemplatesPage.jsx` fetch SEMUA defs via `fetchSpecificationDefinitions()`
   (tanpa filter komponen) — wajar (satu fetch untuk semua row).
3. **Fallback bug:** line dropdown memakai `(defOptions.length ? defOptions :
   specDefs)` — saat komponen punya 0 defs (kasus SCOTCHLIGHT: 0 def di master),
   dropdown jatuh ke SEMUA defs. Ini satu-satunya titik yang menampilkan
   cross-component specs.
4. `handleComponentDefChange` juga tidak me-reset spec terpilih yang tidak
   kompatibel saat ganti component (mis. Kerah → Scotchlight, Tinggi Kerah tetap
   terpilih).

**Fix (additive, UI + pure helpers, TANPA migration):**
- Pure helper `defsForComponent(specDefs, componentDefinitionId)` (di
  `ppm-m45a-specs.js`) — HANYA defs milik komponen aktif; tanpa komponen = `[]`
  (Custom spec saja). Dropdown fallback `: specDefs` DIHAPUS.
- Pure helper `specsAfterComponentChange(specs, newCompDefId, specDefs)` —
  spec dengan def komponen lain / unknown di-reset kosong; custom spec (tanpa
  def) dipertahankan; spec kompatibel dipertahankan.
- `PPMSpecTemplatesPage.jsx`: dropdown pakai `defsForComponent`, dan
  `handleComponentDefChange` memakai `specsAfterComponentChange`.
- **Custom Spec tetap tersedia** sebagai escape hatch (option pertama).

**Test baru (test-ppm-m45a.js → 88 PASS):**
- Kerah picker menampilkan TINGGI_KERAH, TIDAK menampilkan TINGGI_SAKU /
  TINGGI_MANSET (P7).
- Saku picker menampilkan TINGGI_SAKU, TIDAK menampilkan TINGGI_KERAH /
  STITCH_BAH (P8).
- Scotchlight picker menampilkan JENIS/LEBAR/POSISI/STITCH_SCOTCHLIGHT (4 defs,
  LEBAR unit inch), TIDAK menampilkan MODEL_KERAH, TIDAK bocor komponen lain (P9a–f).
- Lebar Manset (unit cm) hanya di picker MANSET; tidak muncul di Kerah /
  Scotchlight (P9g1–4).
- Custom spec tetap tersedia; tanpa component → picker kosong (P10).
- Ganti component: Kerah→Scotchlight / Kerah→Saku clear TINGGI_KERAH;
  Kerah→Kerah pertahankan (P11).
- Saved template dengan def kompatibel tetap valid (P12).
- Master integrity: semua spec definitions punya `component_definition_id` (2g).

## 1b. Seed Master (user-APPROVED nomenklatur 2026-08-12)
Migration `supabase/migrations/202608120003_ppm_m45a_specdef_seed.sql`
(idempotent, `ON CONFLICT (component_definition_id, spec_key) DO NOTHING`,
pola seed M2) — 5 definition baru:

| Component | spec_key | Label | value_type | unit | required |
|---|---|---|---|---|---|
| SCOTCHLIGHT | JENIS_SCOTCHLIGHT | Jenis Scotchlight | TEXT | — | ya |
| SCOTCHLIGHT | LEBAR_SCOTCHLIGHT | Lebar Scotchlight | NUMBER | inch | ya |
| SCOTCHLIGHT | POSISI_SCOTCHLIGHT | Posisi Scotchlight | TEXT | — | ya |
| SCOTCHLIGHT | STITCH_SCOTCHLIGHT | Stitch Scotchlight | TEXT | — | tidak |
| MANSET | LEBAR_MANSET | Lebar Manset | NUMBER | cm | tidak |

**Reuse-vs-duplicate design recommendation (dilaporkan sebelum seed):**
schema M2 `component_specification_definitions` memakai
`UNIQUE (component_definition_id, spec_key)` + FK `NOT NULL` + lookup by
component — **tidak ada pivot M:N**. "Reuse lintas komponen" berarti
duplicate row master (mis. `(SAKU_LENGAN, MODEL_SAKU)` nanti), karena:
(1) refactor M2 LOCKED ke M:N = dilarang; (2) duplicate row membuka
per-konteks default (unit/required berbeda antar komponen);
(3) transaksi spec memakai snapshot sehingga rename def aman.
**SAKU_LENGAN / SAKU_SAMPING / SAKU_BELAKANG TIDAK di-seed** (menunggu
requirement; pola reuse di atas siap dipakai).

## 1c. Data-Loss Bugfix (2026-08-13) — Save Template/Standard Non-Atomic

**Bug (laporan user):** edit template spesifikasi → ganti satu komponen
(Kerah → Scotchlight) → Simpan → komponen & spec lain di template HILANG.

**Root cause (audited):** `saveTemplate` mode update = **replace children
non-atomic** — delete semua `ppm_spec_template_components` (cascade specs)
DULU, baru reinsert satu-per-satu. Error apa pun di tengah reinsert memutus
simpan SETELAH delete → data existing hilang permanen. Dua pemicu nyata:
1. **Baris spec yang di-clear** — saat ganti komponen,
   `specsAfterComponentChange` me-reset spec tak kompatibel ke baris kosong
   (def/key/label kosong); baris itu kemudian gagal validasi
   `'Spec wajib memiliki key & label...'` di tengah reinsert.
2. **Komponen duplikat** — pilih komponen yang sudah ada di template
   (def+lokasi sama) → unique index 23505 di tengah reinsert.

**Fix (client-only, TANPA migration):**
- `saveTemplate` / `saveStandard`: **build + validate SEMUA payload SEBELUM
  menulis DB** (nama/key/label, mirror unique DB untuk duplikat komponen dan
  spec per komponen / key per standard) → error muncul SEBELUM delete, data
  existing aman.
- Baris kosong total (komponen/spec draft atau hasil clear) **dilewati** —
  efek: spec yang di-clear saat ganti komponen tidak disimpan (sama dengan
  yang terlihat di form).
- `PPMSpecTemplatesPage.jsx`: pilih komponen yang sudah ada (def+lokasi sama)
  langsung **diblokir dengan toast** sebelum state berubah.
- Verifikasi: `test:ppm:m4.5a` **123 PASS / 0 FAIL** + `test:ppm:m4.5a.1`
  **67 PASS / 0 FAIL** + `build` **PASS**.

> **Catatan untuk user:** template yang sempat kehilangan data akibat bug ini
> TIDAK bisa dipulihkan otomatis — isi ulang komponen & spec lewat Edit
> Template. Sejak fix ini, simpan hanya akan gagal dengan pesan jelas di
> kondisi yang sama (tanpa menghapus data).

## 2. Ringkasan

Menjawab pertanyaan arsitektur M4.5 yang di-scope ulang:
> "Untuk Product Type tertentu, komponen/spec field apa yang **seharusnya ada**,
> nilai apa yang **disarankan** (DEFAULT), mana yang **wajib** (REQUIRED), dan apa
> **standar teknis resmi Harmas/Ofissio** (STANDARD)?"

- **Specification Template** = komposisi "komponen + field spec" per Product Type
  (DEFAULT + REQUIRED + urutan). Bukan model customer spesifik.
- **Company Technical Standard** = nilai teknis resmi Harmas/Ofissio (simple
  scoped value, v1). Bukan rule engine (IF...THEN... = DEFERRED).
- **TIDAK** menjawab "apa model WIKA Kemeja HSE R01?" — itu **M4.5B** (Customer
  Model Reference, belum dikerjakan; tunggu instruksi user).

## 3. Semantik (eksplisit — jangan dicampur)

| Term | Arti | Lokasi |
|---|---|---|
| DEFAULT | Nilai awal yang disarankan | `ppm_spec_template_specs.default_value_*` |
| STANDARD | Aturan teknis resmi Harmas/Ofissio | `ppm_company_technical_standards` + `_standard_specs` |
| REQUIRED | Spec wajib punya nilai untuk kelengkapan | `is_required` (kedua tabel spec) |
| standard_id | Referensi standard eksplisit per template spec | `ppm_spec_template_specs.standard_id` |

Saat **KOMPOSE** (future M4.5B): STANDARD menang atas DEFAULT bila
`standard_id` terisi; bila tidak, DEFAULT dipakai (semantik
`resolveComposeValue`, pure helper). Ini **bukan** rule engine.

## 4. Perubahan Database (additive only)

Migration: `supabase/migrations/202608120002_ppm_m45a_spec_templates.sql`

| Tabel | Isi |
|---|---|
| `ppm_spec_templates` | Master template per Product Type (code UNIQUE, `product_type_id` scope) |
| `ppm_spec_template_components` | Komponen template + lokasi + urutan + required (snapshot nama) |
| `ppm_spec_template_specs` | Field spec template + DEFAULT typed + REQUIRED + `standard_id` link |
| `ppm_company_technical_standards` | Master standar teknis Harmas/Ofissio (code UNIQUE, scope product type) |
| `ppm_company_technical_standard_specs` | Nilai standar per field (typed value_text/number/boolean/json) |

**Seed (idempotent):** `product_types` KEMEJA_LAPANGAN + KEMEJA_KANTOR
(legacy KEMEJA tetap, tidak disentuh).

**Uniqueness NULL-safe** (PostgreSQL UNIQUE menganggap NULL berbeda → ordinary
UNIQUE tidak cukup):

- Komponen template standard: `UNIQUE(template_id, component_definition_id,
  COALESCE(location_label,''))` WHERE def NOT NULL — mirror M1.1 + NULL-safe.
- Komponen template custom: `UNIQUE(template_id, component_name_snapshot,
  COALESCE(location_label,''))` WHERE def IS NULL.
- Template spec standard: `UNIQUE(template_component_id,
  specification_definition_id)` WHERE def NOT NULL — mirror M2.
- Template spec custom: `UNIQUE(template_component_id, spec_key_snapshot)`
  WHERE def IS NULL.
- Standard spec: `UNIQUE(standard_id, spec_key_snapshot)`.

**RLS:** 10 policies (2 per tabel) — Pattern A master: `authenticated read`
(akun ACTIVE) + `super_admin manage`. Anon read/write = 0 rows / ditolak
(diuji).

**Trigger:** `updated_at` memakai helper `update_ppm_m1_updated_at_column()`
(M1) — tidak ada helper baru.

**Catatan bug yang ditemukan & diperbaiki:** draft awal memakai pola M1.1
`(location_label IS NULL), location_label` yang ternyata masih kena NULL-trap
(NULL tetap dianggap berbeda oleh unique index → duplicate lokasi NULL lolos).
Diganti `COALESCE(location_label,'')` di dua index komponen; migration
di-apply ulang index (tabel kosong, aman), diverifikasi oleh test 7a.

## 5. Kode Frontend

| File | Isi |
|---|---|
| `src/lib/ppm-m45a-specs.js` | **Pure helpers** (tanpa import — bisa di-import test Node langsung): `VALUE_TYPE`, `defaultValueInfo`, `standardValueInfo`, `formatTemplateDefault`, `formatStandardValue`, `resolveComposeValue` (STANDARD menang atas DEFAULT), **`defsForComponent` (contextual picker)**, **`specsAfterComponentChange` (clear incompatible spec)** |
| `src/lib/ppm-m45a-helpers.js` | DB helpers (REST via supabase): `fetchTemplates`, `fetchTemplateDetail`, `saveTemplate`, `toggleTemplateActive`, `deleteTemplate`, `fetchStandards`, `fetchStandardDetail`, `saveStandard`, `toggleStandardActive`, `deleteStandard`, `buildValuePayload` |
| `src/pages/PPMSpecTemplatesPage.jsx` | CRUD template + komponen + spec (default per value_type via `SpecValueInput` M2, custom component/spec, standard link per spec, **contextual spec picker + clear-on-component-change**) |
| `src/pages/PPMTechnicalStandardsPage.jsx` | CRUD standar teknis (nilai STANDARD typed per spec row) |
| `src/App.jsx` | Route `/ppm/spec-templates` + `/ppm/technical-standards` |
| `src/components/layout/MainLayout.jsx` | Nav group `Konfigurasi PPM`: Template Spec + Standar Teknis (icon Layers / ShieldCheck) |

UI pakai pattern M4: modal form, list + search + empty state, toggle aktif,
delete, hanya super_admin yang bisa edit (`canEdit`).

## 6. Verification

```bash
node scripts/run-ppm-m45a-migration.js           # apply migration 202608120002
node scripts/run-ppm-m45a-specdef-seed.js        # apply seed 202608120003 (approved)
node scripts/verify-ppm-m45a-migration.js        # structural: 5 tabel + 5 index + RLS + 10 policies + seed
node scripts/run-ppm-m45a-wika-master.js         # apply WIKA master patch 202608130001 (5 komponen + 18 defs)
node scripts/verify-ppm-wika-master.js           # structural WIKA patch + integrity
npm run test:ppm:m4.5a                           # 123 PASS / 0 FAIL
npm run test:ppm                                 # aggregate: 571 PASS / 0 FAIL (M1→M4.5A.1)
npm run build                                    # PASS
```

> **WIKA master patch (2026-08-13, user-approved scope "Master Patch + M4.5A.1"):**
> migration `202608130001_ppm_m45a_wika_master_patch.sql` — **5 komponen baru**
> (SKODER_BAHU, SKODER_LENGAN, KELIM_BAWAH, BELAHAN_SAMPING, LIST) + **18 spec
> definitions** (KONSTRUKSI_SAKU di SAKU_DADA, LEBAR/PANJANG_SKODER ×2 komponen
> [duplicate row disengaja — reuse pattern], LEBAR_PLAKET_DALAM/LUAR,
> PANJANG_SLIT_LENGAN, LEBAR_KELIM_BAWAH, TINGGI_BELAHAN_SAMPING,
> JARAK_SCOTCHLIGHT_DARI_BAHU + KONTINUITAS_SCOTCHLIGHT_PLAKET (SELECT),
> WARNA/LEBAR_LIST, JENIS/REFERENSI/JARAK/ARAH_POSISI_BORDIR), idempotent
> `ON CONFLICT DO NOTHING`. **TANPA nilai WIKA** (customer model = M4.5B);
> `UKURAN_KOTAK_SLIT` tidak dibuat (menunggu verifikasi user); `LEBAR_PLAKET`
> legacy tetap. Detail scope di header migration.
> P13–P20 di `test:ppm:m4.5a` memverifikasi patch (5 komponen + 18 defs +
> SELECT options + picker tetap contextual).

Cakupan `test:ppm:m4.5a` (88 check):

- Schema additive: 5 tabel M4.5A ada (REST probe), M1/M2 tabel master utuh.
- Seed product types: KEMEJA_LAPANGAN, KEMEJA_KANTOR, legacy KEMEJA tetap.
- Master integrity: SEMUA spec definitions punya `component_definition_id` (2g).
- Template CRUD: link product type, snapshot label, component standard/custom.
- **Duplicate defense**: standard component (def+lokasi sama) ditolak; lokasi
  berbeda diizinkan; custom component (nama+lokasi sama) ditolak; standard spec
  (def sama) ditolak; custom spec (key sama) ditolak; standard spec key
  duplikat ditolak — semua termasuk kasus **NULL location / NULL def**.
- Default value per type: TEXT/NUMBER/BOOLEAN/SELECT/MULTI_SELECT (JSON array).
- required, sort_order, deactivate/activate (template + standard).
- DEFAULT vs STANDARD terbedakan (kolom terpisah; 5 vs 4.5).
- standard_id link simple (bukan rule engine).
- Pure helpers P1–P12: info readers, formatter, compose, **contextual picker
  (Kerah/Saku/Manset/Scotchlight tidak saling bocor — termasuk seed baru)**,
  **clear incompatible spec saat ganti component**, custom spec tetap tersedia,
  saved template tetap valid.
- RLS: anon write ditolak, anon read 0 rows, policy structural (10 policy).
- Cleanup by ID + marker sweep — tidak pernah by nama bisnis.

## 7. Master Data Gap Audit (bugfix manual verification)

Audit `component_specification_definitions` (13 defs, semuanya ter-assign —
tidak ada NULL). Pemetaan component → spec saat ini:

| Component | Spec definitions terdaftar |
|---|---|
| KERAH | TINGGI_KERAH, MODEL_KERAH |
| SAKU_DADA | TINGGI_SAKU, LEBAR_SAKU, MODEL_SAKU |
| BORDIR | ARTWORK_BORDIR, POSISI_BORDIR, UKURAN_BORDIR |
| MANSET | TINGGI_MANSET, **LEBAR_MANSET (seed approved)** |
| PLAKET | LEBAR_PLAKET |
| VELCRO | UKURAN_VELCRO |
| ARMHOLE | STITCH_ARMHOLE |
| BAH_YOKE | STITCH_BAH |
| SCOTCHLIGHT | **JENIS/LEBAR/POSISI/STITCH_SCOTCHLIGHT (4 defs, seed approved)** |
| SAKU_LENGAN / SAKU_SAMPING / SAKU_BELAKANG | **0 — belum di-seed (menunggu requirement)** |
| 14 komponen lain (EMBLEM, FURING, LENGAN, KANCING, dll.) | **0** |

**Missing (candidate, BELUM di-seed — menunggu approval user):**
- **SAKU_LENGAN / SAKU_SAMPING / SAKU_BELAKANG:** 0 def (reuse pattern
  duplicate row master, mis. `(SAKU_LENGAN, MODEL_SAKU)` — rekomendasi desain
  di §1b).

> **Catatan:** seed SCOTCHLIGHT ×4 + LEBAR_MANSET sudah APPROVED user
> (2026-08-12) dan terpasang via `202608120003`. Nomenklatur baru lainnya
> tetap menunggu approval user.

> **PENTING:** sesuai instruksi user — JANGAN seed nomenklatur baru tanpa
> approval. Perbaikan picker contextual sudah selesai dan tidak butuh seed;
> pembuatan def master baru untuk komponen lain **menunggu approval user**.

## 8. Milestone Selanjutnya (belum dikerjakan — tunggu instruksi user)

- **M4.5B** — Customer Model Reference ("apa model WIKA Kemeja HSE R01?"):
  komposisi template + nilai override + compose (STANDARD/DEFAULT/OVERRIDE).
- **M5+** — belum ditentukan.
