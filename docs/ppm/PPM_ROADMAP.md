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
| **M4** | **Decision ↔ Technical Specification Reconciliation** | **IMPLEMENTED / PENDING USER VERIFICATION** | 65 PASS (pure+DB); additive proposal layer; APPLY reuse resolveSpecification; no LOCK, no commit |

> **M3 family LOCKED (2026-08-10)** — user verifikasi manual ACCEPTED (regression
> 284 PASS / 0 FAIL + build PASS). Viewer baseline dikunci: Fit-to-PO, zoom/pan,
> fullscreen preservation, MiniMap, floating dark card, connector, multi-pin,
> smart component focus, Product Discussion Flow, Component Discussion, Meeting
> Focus Mode.

> **M4 IMPLEMENTED / PENDING USER VERIFICATION (2026-08-10)** — Decision ↔ Spec
> via explicit proposal layer (`ppm_spec_change_proposals`, additive). APPLY reuse
> `resolveSpecification()` (no new spec-mutation path, no RPC). Regression
> aggregate 349 PASS / 0 FAIL + build PASS. Viewer internals untouched (M3 LOCKED
> dihormati). Status: **IMPLEMENTED / PENDING USER VERIFICATION — NO LOCK.**
> Verifikasi manual user di browser belum selesai. Lihat
> `docs/ppm/milestones/M4_REPORT.md` + ADR-026. Milestone berikutnya (M5) belum
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
