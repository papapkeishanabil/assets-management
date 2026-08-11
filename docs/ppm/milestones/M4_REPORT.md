# M4 — Decision ↔ Technical Specification Reconciliation (IMPLEMENTED / PENDING USER VERIFICATION)

## Status
**IMPLEMENTED / PENDING USER VERIFICATION** (NO LOCK). Regression aggregate
**349 PASS / 0 FAIL** (48+40+68+46+70+12+65) + build PASS. Verifikasi manual
user di browser **belum** selesai — automated test PASS ≠ manual UX PASS.

> **Batasan eksplisit:** M4 murni **additive**. TIDAK menulis ulang M2/M3, TIDAK
> mengubah schema `ppm_component_specifications` / `ppm_annotations` /
> `ppm_annotation_notes`, TIDAK menambah `APPROVED`/`REJECTED` ke `review_status`
> CHECK (destructive ALTER dilarang). APPLY reuse `resolveSpecification()` (M2.2
> path) — tidak ada jalur spec-mutation baru, tidak ada RPC. Lihat ADR-026.

## Ringkasan (devangka)
- **Business rule user:** Technical Specification = FINAL STRUCTURED PRODUCT
  TRUTH. Annotation **Decision** = keputusan meeting. Jika keputusan berkaitan
  dgn spec dan nilainya berbeda → **rekonsiliasi eksplisit** via proposal layer.
- **Entitas baru `ppm_spec_change_proposals`** = governance record satu keputusan
  meeting yang menarget **satu** spec. 1 DECISION note → 0..N proposals (satu
  keputusan bisa mengubah beberapa spec).
- **Typed proposed value** (`value_*` per `value_type` TEXT/NUMBER/BOOLEAN/
  SELECT/MULTI_SELECT — mirror spec) **DIPISAH** dari `decision_note` (free text).
- **Baseline snapshot** spec's current value saat propose → dasar deteksi stale
  saat APPLY.
- **Lifecycle:** `PROPOSED → {APPROVED | REJECTED | DEFERRED}`.
  - `APPROVED` = terminal; spec dimutasi via `resolveSpecification()` →
    `RESOLVED` + `source_type=MEETING`; `original_value_*` dijaga trigger M2.
  - `REJECTED` = terminal; spec **tidak** disentuh; `rejection_reason` tercatat.
  - `DEFERRED` = ditunda; re-open → `PROPOSED`, atau langsung apply/reject.
- **Domain separation (3 domain terpisah):**
  - proposal status (`PROPOSED`/`APPROVED`/`REJECTED`/`DEFERRED`)
  - spec `review_status` (`CONFIRMED`/`RESOLVED`/dst — M2.2 LOCKED, untouched)
  - annotation `status` (`OPEN`/`RESOLVED` — M3 LOCKED, untouched)
- **Unreconciled** = `{PROPOSED, DEFERRED}` → muncul badge "⚠ Belum Diselaraskan"
  di FloatingPinCard + sub-row "⚠ Meeting Decision [Selaraskan]" per-spec di
  ComponentDiscussionContent.
- **Stale protection + idempotency** (client-orchestrated, no RPC): WHERE
  `status IN (PROPOSED,DEFERRED)` guard; 0 rows = race → idempotent no-op.
- **Evidence link nullable SET NULL** (`annotation_id`, `annotation_note_id`,
  `component_specification_id`) → audit trail proposal + baseline snapshot tetap
  utuh walau pin/note/spec dihapus. `item_component_id` NOT NULL CASCADE.

## Schema (additive — `supabase/migrations/202608100002_ppm_m4_spec_change_proposals.sql`)
- CREATE TABLE `ppm_spec_change_proposals` (no DROP, no destructive ALTER).
  - **TARGET:** `component_specification_id` (SET NULL), `item_component_id`
    (NOT NULL CASCADE), `po_item_id` (CASCADE), `meeting_po_id` (NOT NULL CASCADE).
  - **EVIDENCE:** `annotation_id` (SET NULL), `annotation_note_id` (SET NULL).
  - **PROPOSED VALUE (typed):** `value_type` CHECK
    (TEXT/NUMBER/BOOLEAN/SELECT/MULTI_SELECT) + `value_text`/`value_number`/
    `value_boolean`/`value_json` + `proposed_unit` + `decision_note`.
  - **BASELINE:** `baseline_value_text`/`_number`/`_boolean`/`_json`.
  - **LIFECYCLE:** `status` CHECK (PROPOSED/APPROVED/REJECTED/DEFERRED) DEFAULT
    PROPOSED + `proposed_by`/`proposed_at` + `decided_by`/`decided_at` +
    `rejection_reason`.
  - **APPLY audit:** `applied_despite_conflict` BOOL DEFAULT false +
    `conflict_snapshot_json` JSONB.
  - `created_by`/`created_at`/`updated_at`.
- 5 indexes (spec, component, po, annotation, status).
- RLS ENABLED + 4 policies:
  - **SELECT (Pattern A):** authenticated + active `user_profiles`.
  - **INSERT / UPDATE / DELETE (Pattern B via `meeting_po_id`):** creator of
    meeting OR `super_admin` — menelusuri `meeting_po_id → meeting_pos →
    meetings.created_by`. Tidak ada helper `is_ppm_manager()`.
- Trigger `trigger_pmscp_updated_at` reuse `update_ppm_m1_updated_at_column()`.
- **Spec mutation saat APPLY** lewat RLS existing di `ppm_component_specifications`
  (creator/super_admin) — konsisten dgn Technical Review.

## RLS / permission model (ikut existing PPM)
- Frontend actor: `useAuth()` → `profile.id` (= `user_profiles.id` PK), BUKAN
  `user.id`. canManage = super_admin OR `meeting.created_by === profile.id`.
- Anonymous write ditolak (RLS); anonymous read difilter (0 baris).
- Frontend **no service_role** — hanya anon publishable + RLS.

## Helpers (two-tier convention: `*-specs.js` pure + `*-helpers.js` DB)
- **`src/lib/ppm-m4-specs.js`** (pure, no DB): `PROPOSAL_STATUS`/`_LABELS`/
  `_COLORS`, `UNRECONCILED_STATUSES`, `TERMINAL_STATUSES`, `VALUE_TYPE`,
  `proposalValueInfo`, `proposalBaselineInfo`, `firstDecisionNote` (centralized
  dedup — sebelumnya inlined di 3 komponen), `formatProposalValue`,
  `isUnreconciled`, `canTransition` (state machine), `isApplyable`,
  `detectConflict` (typed compare baseline vs current), `specValueChanged`,
  `hasSpecOriginalValue`.
- **`src/lib/ppm-m4-helpers.js`** (DB I/O, re-export specs): `fetchProposalsForPO`,
  `createProposal` (baseline snapshot via `baselinePayloadFromSpec`),
  `applyProposal` (idempotency WHERE guard + conflict detection + force override
  + reuse `resolveSpecification`), `fetchProposalById`, `rejectProposal`,
  `deferProposal`, `rebaseProposal` (update baseline ke current, stay PROPOSED,
  clear conflict). PGRST116 / 0-rows = idempotent.

## UI (additive — viewer internals untouched)
- **`src/components/ppm/SpecValueInput.jsx`** (NEW, pure) — controlled input per
  `value_type`: BOOLEAN=Ya/Tidak, NUMBER=input, SELECT=dropdown-if-options-else-
  text, MULTI_SELECT=checkboxes-if-options-else-comma-text, TEXT=input.
- **`src/components/ppm/SpecReconciliationModal.jsx`** (NEW) — dua mode:
  - **create** — target spec picker + SpecValueInput + decision_note textarea.
  - **review** — spec current + proposal + kartu konflik (saat baseline≠current)
    + 3-way actions: [Terapkan ke Spesifikasi] / [Tetap Spesifikasi Lama (Tolak)]
    / [Tunda]. Saat konflik: [Terapkan Paksa] / [Review Ulang (re-base)] /
    [Tolak]. Modal tetap terbuka bila APPLY return `{conflict:true}` (race).
- **PATCH (additive optional props — no behavior change when absent):**
  - `FloatingPinCard.jsx` — +optional `onProposeSpecChange`; badge compact
    "⚠ Belum Diselaraskan [Detail]" sebagai sibling setelah blok DECISION (NO
    big form — rekonsiliasi penuh di modal); link "Usulkan ke Spec" di expanded
    footer. **No geometry change.**
  - `ComponentDiscussionContent.jsx` — +optional `onSelaraskan` +
    `proposalsBySpec`; per-spec sub-row "⚠ Meeting Decision: <proposed>
    [Selaraskan]".
  - `AnnotationSidebar.jsx` — pass-through `onSelaraskan` + `proposalsBySpec` ke
    ComponentDiscussionContent (tab Diskusi).
  - `MeetingProductFlow.jsx` — pass-through ke mount mobile
    ComponentDiscussionContent.
  - `AnnotationCanvas.jsx` (protected viewer file) — +optional
    `onProposeSpecChange` **pure pass-through** (TIDAK mengubah viewer engine /
    geometry / focus), mirror pola `onOpenPinDetail`/`onClosePinCard`.
- **`src/pages/PPMPoDetailPage.jsx`** (orchestrator) — `fetchProposalsForPO` di
  `fetchPO`; `proposalsBySpec` + `proposalsByAnnotation` memo; enrichment
  `annotation._unreconciledProposal` pada `filteredAnnotations` (derived map,
  bukan raw state). Handler: `handleProposeSpecChange`, `handleSelaraskan`,
  `handleCreateProposal`, `handleApplyProposal` (return res; if `res.conflict` →
  toast + refresh + tanpa close), `handleRejectProposal`, `handleDeferProposal`,
  `handleRebaseProposal`. `<SpecReconciliationModal>` di modal stack. Wire
  `onProposeSpecChange={canManage ? handler : undefined}`.

## M2/M3 rewrite check — NONE
| Area | Status M4 |
|---|---|
| `ppm_component_specifications` schema | Untouched. APPLY via `resolveSpecification`. |
| `review_status` / `source_type` CHECK | Untouched. No APPROVED/REJECTED added. |
| `ppm_annotations` / `ppm_annotation_notes` | Untouched. Proposal FK them. Note stays free-text. |
| M3 boundary "Decision note TIDAK mengubah spec" | Deliberately extended via governed proposal layer (not violated) — ADR-026. |
| Viewer internals | Untouched. All seams additive optional props. |
| M2.2 helpers (`resolveSpecification`, `computeReviewProgress`) | Reused as-is. |
| TechnicalReviewModal / SpecificationManagerModal (locked) | Untouched. M4 builds own SpecReconciliationModal. |

## Test (`scripts/test-ppm-m4.js`, marker `__TEST_M4__<run_id>`)
**65 PASS / 0 FAIL.** Cleanup by created ID + marker sweep (never business names).
Pure helpers diuji langsung via import; DB contract via REST (service key) —
mereplikasi kontrak REST helper (karena singleton supabase = safe stub di Node,
sama dgn konvensi test-ppm-m3.js).

Cakupan:
- Pure: PROPOSAL_STATUS constants, firstDecisionNote (urut + null-safe),
  proposalValueInfo/BaselineInfo (NUMBER + TEXT), formatProposalValue (NUMBER+
  unit / BOOLEAN / empty), isUnreconciled/canTransition/isApplyable (state
  machine incl. terminal + self-idempotent + re-open), detectConflict (no-conflict
  + conflict), specValueChanged/hasSpecOriginalValue.
- DB: migration additive + schema utuh (M2/M3 field lengkap); create proposal
  PROPOSED + baseline snapshot benar + proposed value benar + value_type snapshot
  + decision_note terpisah dari structured value; APPLY APPROVED → spec
  `value_number` terupdate + `review_status=RESOLVED` + `source_type=MEETING` +
  `original_value_number` preserved (trigger M2); proposal → APPROVED +
  `decided_at`; idempotency re-APPLY 0 rows (status guard); stale conflict
  detectConflict + APPLY blocked (`conflict_snapshot_json` tercatat, spec TIDAK
  berubah, proposal tetap PROPOSED); force APPLY → APPROVED +
  `applied_despite_conflict=true` + spec=proposed; reject → REJECTED +
  `rejection_reason` + spec untouched + re-reject no-op; defer → DEFERRED →
  APPROVED (applyable); rebase → baseline=current + stay PROPOSED +
  conflict_snapshot cleared; RLS anon INSERT ditolak + anon READ difilter (0
  baris) + service role bisa baca.

## Verification (hasil aktual, fresh — 2026-08-10)
- Migration applied (`scripts/run-ppm-m4-migration.js` → status 204, "Migration
  M4 applied successfully.").
- `npm run test:ppm:m4` → **65 PASS / 0 FAIL**.
- `npm run test:ppm` (aggregate) → **349 PASS / 0 FAIL**
  (48+40+68+46+70+12+65) — regression M1–M3 hijau.
- `npm run build` → **PASS** (Vite EXIT 0, 1497 modules, 21.8s).
- Manual browser (auth) — alur create proposal dari DECISION pin → review → APPLY
  (spec RESOLVED + MEETING, original preserved) → stale conflict → force/rebase/
  reject/defer → badge FloatingPinCard + sub-row ComponentDiscussionContent:
  **NOT TESTED** (tunggu verifikasi user).

## Out of scope / preserved
- Viewer internals, fullscreen, connector, MiniMap, floating-card geometry (M3 LOCKED).
- M2.2 progress/review semantics (`computeReviewProgress` untouched).
- TechnicalReviewModal / SpecificationManagerModal (locked).
- Bulk PO-level reconciliation (per-component/spec only, konsisten dgn M2.2).
- Realtime / mention / attachment.
- M5 — NOT started.
- **NO commit/push, NO auto-LOCK M4.** Status = IMPLEMENTED / PENDING USER
  VERIFICATION. STOP setelah build/test hijau.
- Working tree masih ada unrelated Contract/PKWTT changes — TIDAK disentuh/
  staged/commit.

## Related docs
- `docs/ppm/PPM_DECISIONS.md` — ADR-026.
- `docs/ppm/PPM_CURRENT_STATE.md`.
- `docs/ppm/PPM_ROADMAP.md`.
- `docs/development/TESTING.md`.
