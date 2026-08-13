# PPM — Roadmap (Milestone Sequence)

## Status legend
- **LOCKED** — selesai & terverifikasi, regressi hijau, jangan refactor.
- **IMPLEMENTED / PENDING USER VERIFICATION** — kode + test selesai, tunggu
  verifikasi manual user sebelum LOCK.
- **PLANNED** — direncanakan, belum dimulai, tunggu instruksi user.
- **DEFERRED** — ditunda / tertiadkan sementara.
- **CURRENT** — milestone aktif.

## Milestones

| No | Milestone | Status | Catatan |
|---|---|---|---|
| M1 | Product Item + Component | LOCKED | 48 PASS regression |
| M1.1 | Default Component Set + Drag Sorting | LOCKED | 40 PASS regression |
| M2 | Technical Specification Foundation | LOCKED | spesifikasi master + nilai |
| M2.1 | Operational Labels & Review Eligibility | LOCKED | `hasSpecValue`, reviewableTotal |
| M2.2 | Technical Review UX Simplification & Empty Spec Fix | LOCKED | 31 PASS |
| **DEV-STD-01** | **Developer + AI Context Standardization** | LOCKED | documentation + tooling |
| **M3** | **Annotation & Component Discussion** | **LOCKED** | 46 PASS; user-accepted 2026-08-10 |
| **M3.1** | **Annotation UX Extension** (register, focus, connector, mobile, Meeting Focus Mode) | **LOCKED** | 70 PASS + render 12 + fit 17; bagian dari M3 |
| **M3.2** | **Hardening + Visual Polish + Meeting Product Discussion Flow** | **LOCKED** | bagian dari M3; user-accepted 2026-08-10 |
| **M4** | **Decision ↔ Technical Specification Reconciliation** | **IMPLEMENTED / PENDING USER VERIFICATION** | 97 PASS (pure+DB+evidence immutability); additive proposal layer; APPLY reuse resolveSpecification; no LOCK, no commit |
| **M4.5A** | **Specification Template + Simple Technical Standards** | **LOCKED** | 123 PASS (62 + 26 bugfix + seed approved + **WIKA master patch 5 komponen/18 spec defs**); migration `202608120002`+`202608120003`+`202608130001` applied + structural verify PASS; template (DEFAULT) & standard (STANDARD) additive master layer; user-accepted 2026-08-13 |
| **M4.5A.1** | **Simple Conditional Technical Standards V1** (JIKA = MAKA, EQUALS only) | **LOCKED** | 67 PASS; migration `202608130002` applied + verify PASS; rules DB + trigger konsistensi komponen + evaluator murni + validation + RLS + **unit suffix bugfix (render-only)**; Simple Standard (FIXED) tetap didukung; user-accepted 2026-08-13 |

> **M3 family LOCKED (2026-08-10)** — user verifikasi manual ACCEPTED (regression
> 284 PASS / 0 FAIL + build PASS). Viewer baseline dikunci: Fit-to-PO, zoom/pan,
> fullscreen preservation, MiniMap, floating dark card, connector, multi-pin,
> smart component focus, Product Discussion Flow, Component Discussion, Meeting
> Focus Mode.

> **M4 IMPLEMENTED / PENDING USER VERIFICATION (2026-08-10)** — Decision ↔ Spec
> via explicit proposal layer (`ppm_spec_change_proposals`, additive). APPLY reuse
> `resolveSpecification()` (no new spec-mutation path, no RPC). Regression
> aggregate 469 PASS / 0 FAIL + build PASS. Viewer internals untouched (M3 LOCKED
> dihormati). Status: **IMPLEMENTED / PENDING USER VERIFICATION — NO LOCK.**
> Verifikasi manual user di browser belum selesai. Lihat
> `docs/ppm/milestones/M4_REPORT.md` + ADR-026.

> **M4.5A LOCKED (user-accepted 2026-08-13)** — Specification
> Template (komposisi komponen+spec per Product Type: DEFAULT + REQUIRED +
> urutan) + Company Technical Standard (nilai STANDARD typed, simple scoped
> value; bukan rule engine). 5 tabel additive + seed product types
> KEMEJA_LAPANGAN/KEMEJA_KANTOR + NULL-safe uniqueness (COALESCE location) +
> RLS (Pattern A master). UI: `/ppm/spec-templates` + `/ppm/technical-standards`
> (nav "Konfigurasi PPM"). **Manual verification bugfix applied (2026-08-12):**
> dropdown spec kini CONTEXTUAL ke component aktif (bug: Scotchlight menampilkan
> spec semua komponen — root cause fallback `defOptions.length ? defOptions :
> specDefs`; dihapus, pakai pure helper `defsForComponent` + clear incompatible
> spec saat ganti component via `specsAfterComponentChange`). **Seed master
> APPROVED user applied (2026-08-12):** SCOTCHLIGHT ×4 (JENIS/LEBAR/POSISI/
> STITCH_SCOTCHLIGHT) + LEBAR_MANSET via `202608120003` (idempotent, pola M2).
> `test:ppm:m4.5a` 88 PASS / 0 FAIL; aggregate 469 PASS / 0 FAIL + build PASS.
> **WIKA master patch (2026-08-13):** 5 komponen (Badan Depan, Lengan, Kerah,
> Manset, Cuff) + 18 spec definitions via `202608130001` (idempotent) —
> **TANPA nilai WIKA** (komponen WIKA tanpa standard nilai → isi manual via
> context-aware picker). `test:ppm:m4.5a` kini **123 PASS / 0 FAIL**; aggregate
> **571 PASS / 0 FAIL** + build PASS.
> Lihat `docs/ppm/milestones/M4_5A_REPORT.md` (termasuk Master Data Gap Audit:> SAKU_LENGAN/SAMPING/BELAKANG belum punya spec definitions — menunggu
> requirement/approval). **LOCKED — user-accepted 2026-08-13.**
> **M4.5B (Customer Model Reference) belum dikerjakan.**
> Milestone berikutnya belum ditentukan — tunggu instruksi user.

> **M4.5A.1 LOCKED (user-accepted 2026-08-13)** — Simple
> Conditional Technical Standards V1: **JIKA (condition spec + operator EQUALS +
> typed value) → MAKA (result spec + typed nilai)**. 1 tabel additive
> `ppm_company_technical_standard_rules` (snapshot key/label/type/unit; unique
> kondisi per standard; `active` soft-delete) + trigger konsistensi komponen
> (JIKA tidak boleh komponen lain dari standard yang sama; pindah komponen =
> reload rules) + evaluator murni `evaluateConditionalStandard` (1→Single
> value, 2+→Double/unknown→none) + validation (EQUALS only, cross-type
> mismatch blocked, duplicate/contradiction blocked, REFERENCED guard
> tambah/hapus) + RLS Pattern A. Simple Standard (FIXED) tetap didukung —
> BUKAN rule engine. `test:ppm:m4.5a.1` 54→**67 PASS / 0 FAIL**
> (**unit suffix bugfix** — suffix unit dirender dari snapshot `default_unit`
> via `ruleUnitLabel`, TANPA hardcode; TEXT/SELECT tanpa unit = tanpa suffix;
> save/refresh unit context terjaga; evaluator semantics unchanged); aggregate
> **571 PASS / 0 FAIL** + build PASS. **LOCKED — user-accepted 2026-08-13**
> (manual verification: contextual picker, unit inch/cm, template persistence,
> duplicate + contradictory rule protection, 1 inch→Single / 2 inch→Double).
> Lihat `docs/ppm/milestones/M4_5A_1_REPORT.md`. Milestone berikutnya belum
> ditentukan — tunggu instruksi user.

## Future (tertunda — urutan belum final)

- Realtime Meeting
- PO Correction + Canva integration
- Material & Accessories
- Size & Measurement (Size Chart seed)
- Material Requirement / Readiness
- Production Planning (baseline)
- Approval
- Revision / Change Request
- Model Library / Repeat Order
- Department Brief
- GarmentPro Integration
- Historical Import
- AI Assistance
- Manual Guide (user guide)
- Staging / physical mobile verification

> **Aturan:** tidak menetapkan urutan milestone future secara kaku sebelum
> final. Jangan mulai M3 hanya karena roadmap tersedia — butuh instruksi user.
