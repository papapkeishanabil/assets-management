# PPM — Architecture Decisions (ADR)

Format: lean ADR. `status: Accepted`. Semua keputusan ini terverifikasi dalam
konteks milestone LOCKED; jangan direvisi tanpa kebutuan eksplisit.

---

## ADR-001
**PPM adalah modul Pra-Produksi, bukan owner seluruh Master Data.**
PPM bertanggung jawab pada data transaksional meeting → PO → item → komponen →
spesifikasi → review. Master data lain (mis. size chart, material library,
employee, department) dikelola modul lain dan di-referensikan via ID.

## ADR-002
**Shared Master Data terpisah dari PPM transaction.**
Tidak ada hardcode shared master (kode warna, supplier, dll.) di frontend.
Semua referensi master melalui tabel master + foreign key, dan nilainya
disnapshoot ke transaksi (mis. `component_name_snapshot`) agar sejarah PO
tetap stabil meski master berubah.

## ADR-003
**Satu PO dapat memiliki banyak Product Item.**
`ppm_po_items` mewujudkan relasi 1..* PO → item. Setiap item memiliki satu
Product Type (Kemeja / Celana) dan quantity.

## ADR-004
**Product Type memiliki Default Component Set, tapi komponen tetap editable.**
`product_type_default_components` memberi template urut (sort_order) per tipe.
Item dapat menambah/menghapus/mereorder komponen (`ppm_item_components`),
dan urutan master tidak berubah ketika item di-drag.

## ADR-005
**Kemeja WIKA ≠ Kemeja AKP.**
Kesamaan kode tipe ("Kemeja") saja tidak berarti spesifikasi identik. Setiap
komponen dan spesifikasinya bisa berbeda per item. Jangan mengasumsikan
nilai default universal.

## ADR-006
**Specification Definition ≠ Specification Value.**
Definition = master ("Tinggi Jadi Kerah, unit cm"). PO Value = nilai spesifik
PO ("5 cm"). "5 cm" bukan default universal Kemeja.

## ADR-007
**Empty optional specification tidak blocking Technical Review.**
- tidak reviewable (`isSpecificationReviewable = false`)
- tidak masuk denominator progress
- tidak muncul badge "Belum Direview"
- UI presentation = "Tidak Dicantumkan" (bukan review_status DB baru)

## ADR-008
**Repeat Order memakai Model Library / Golden Reference.**
Pada milestone Size & Measurement. Pengguna tidak dipaksa input ulang semua
spesifikasi — referensi golden digunakan.

## ADR-009
**Historical PO = referensi, bukan meeting palsu.**
PO historis dipakai sebagai sumber nilai referensi, tidak direplay sebagai
meeting palsu.

## ADR-010
**Size Chart Harmas di-SEED ke database.**
Pada milestone Size & Measurement. Jangan meminta user input ulang size chart
yang sudah diberikan.

## ADR-011
**Purchasing Excel import: Import → Preview → Normalization → Validation → Commit.**
Jangan import mentah langsung jadi master data.

## ADR-012
**Production Planning termasuk PPM.**
PPM menghasilkan INITIAL BASELINE PLAN awal.

## ADR-013
**Production Planning ≠ actual execution.**
- PPM: baseline.
- GarmentPro: execution / actual / forecast / replanning.

## ADR-014
**Production Routing dinamis.**
Contoh urutan operasi dapat bervariasi:
Cutting → Hanca → Bordir → Sewing  **atau**  Cutting → Hanca → Sewing → Bordir.
Jangan hardcode sequence.

## ADR-015
**Production Strategy:** Full Inhouse · Hybrid · Full Vendor · Split quantity.

## ADR-016
**Hanca adalah production operation resmi** (bagian dari routing).

## ADR-017
**Canva = editable PO source; PPM simpan snapshot/version.**
PPM menyimpan snapshot / evidence versi, bukan sekadar URL edit.

## ADR-018
**PO correction tidak overwrite dokumen lama.**
Gunakan version history.

## ADR-019
**Canva Design ID = reference utama**, bukan temporary edit URL.

## ADR-020
**GarmentPro adalah aplikasi existing yang sudah berjalan.**
Jangan redesign dari nol.

## ADR-021
**Integration via API layer**, bukan direct database sharing.

## ADR-022
**API credentials per application, dengan scopes yang tepat.**

## ADR-023
**Technical Revision (R) dan Production Plan Revision (P) dipisahkan.**
Contoh: Technical R01, Plan P01.

## ADR-024
**PPM Production Plan adalah baseline awal**, dapat berbeda dengan actual.

## ADR-025
**Test data tidak boleh menghapus data production.**
Cleanup hanya berdasarkan created ID + marker test unik.

## ADR-026
**Annotation Decision → Technical Specification via explicit proposal layer
(governed), bukan overwrite langsung.**
Technical Specification (`ppm_component_specifications`) = satu-satunya FINAL
STRUCTURED PRODUCT TRUTH. Annotation = visual evidence; Annotation **Decision**
(`note_type=DECISION`) = keputusan meeting. Sebuah keputusan yang berkaitan dgn
spec **TIDAK menimpa** spec secara langsung — ditenun lewat layer governance baru
`ppm_spec_change_proposals` (M4, additive):
- **Structured proposed value (`value_*` typed per `value_type`) DIPISAH dari
  discussion note (`decision_note` free text).** Sebuah keputusan bernilai
  terstruktur ≠ catatan diskusi.
- **Proposal status domain TERPISAH** dari `review_status` spec
  (CONFIRMED/RESOLVED/dst) maupun `status` annotation (OPEN/RESOLVED). Proposal:
  `PROPOSED → {APPROVED | REJECTED | DEFERRED}`. Tiga domain berbeda, tidak
  saling mengganggu progress/eligibility spec (M2.2 LOCKED).
- **APPLY proposal = SIDE EFFECT pada spec via `resolveSpecification()` (M2.2
  path)** — TIDAK ada jalur spec-mutation baru, TIDAK ada RPC/PG function. Spec
  jadi `RESOLVED` + `source_type=MEETING`; `original_value_*` dijaga trigger DB.
  Proposal `APPROVED` = terminal.
- **Stale protection**: baseline snapshot spec's current value saat propose;
  APPLY membandingkan baseline vs current — block default bila berubah
  (`conflict_snapshot_json`), `force=true` untuk override (mencatat
  `applied_despite_conflict`), `rebase` untuk review ulang dari nilai terkini.
- **Idempotency**: APPLY/REJECT/DEFER memakai `WHERE id=? AND status IN
  (PROPOSED,DEFERRED)` — re-APPLY setelah `APPROVED` = no-op. Client-orchestrated
  (sesuai konvensi PPM; tidak ada RPC).
- Evidence link (`annotation_id`/`annotation_note_id` nullable SET NULL) +
  `component_specification_id` nullable SET NULL: governance/audit trail
  proposal + snapshot tetap utuh walau pin/note/spec dihapus.
