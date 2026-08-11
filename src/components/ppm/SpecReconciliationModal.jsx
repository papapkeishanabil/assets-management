import { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Check, Ban, Clock, Scale, GitCompare, RefreshCw } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import {
  specValueAsInput,
  getSpecDisplayLabel,
  formatSpecValue,
  hasSpecValue,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
} from '../../lib/ppm-m2-helpers';
import {
  formatProposalValue,
  detectConflict,
  firstDecisionNote,
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
} from '../../lib/ppm-m4-helpers';
import SpecValueInput from './SpecValueInput';

// ============================================================
// SpecReconciliationModal (M4) — jembatan Decision -> Specification.
//
// Dua mode:
//   mode="create" — usulkan perubahan terstruktur dari sebuah keputusan.
//       Target spec (default = spec aktif / picker), nilai keputusan
//       terstruktur (SpecValueInput per value_type), catatan diskusi
//       (free text, DIPISAH dari nilai). Save -> onCreateProposal.
//
//   mode="review" — telaah satu proposal: bandingkan Spesifikasi Resmi
//       (current) vs Keputusan Meeting (proposed). Kartu konflik muncul
//       bila spec berubah sejak keputusan dibuat (baseline != current).
//       Aksi: [Terapkan ke Spesifikasi] / [Tetap Gunakan Spesifikasi Lama
//       (Tolak)] / [Tunda]. Saat konflik: [Terapkan Paksa] /
//       [Review Ulang (re-base)] / [Tolak].
//
// APPLY/Tolak/Tunda di-handle parent (page) via callback — modal hanya
// presentational + local form state. Tidak ada DB / viewer.
// ============================================================
export default function SpecReconciliationModal({
  open,
  onClose,
  mode = 'create',
  // create props
  spec,
  specs = [],
  component,
  annotation,
  onCreateProposal,
  // review props
  proposal,
  onApply,
  onReject,
  onDefer,
  onRebase,
}) {
  // -------- CREATE MODE state --------
  const [selectedSpecId, setSelectedSpecId] = useState('');
  const [value, setValue] = useState('');
  const [proposedUnit, setProposedUnit] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [saving, setSaving] = useState(false);

  // -------- REVIEW MODE state --------
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Resolve target spec list (create): spec tunggal atau picker.
  const specList = useMemo(() => {
    if (specs && specs.length > 0) return specs;
    if (spec) return [spec];
    return [];
  }, [specs, spec]);

  const targetSpec = useMemo(() => {
    if (mode !== 'create') return spec || null;
    if (!selectedSpecId) return specList[0] || spec || null;
    return specList.find((s) => s.id === selectedSpecId) || spec || null;
  }, [mode, selectedSpecId, specList, spec]);

  // Init/ reset form ketika modal dibuka / mode berubah.
  useEffect(() => {
    if (!open) return;
    if (mode === 'create') {
      const initSpec = spec || (annotation && annotation.component_specification_id
        ? specList.find((s) => s.id === annotation.component_specification_id)
        : null) || specList[0] || null;
      setSelectedSpecId(initSpec ? initSpec.id : '');
      setValue(specValueAsInput(initSpec)); // mulai dari nilai current (bisa diubah)
      setProposedUnit(initSpec ? initSpec.unit || '' : '');
      // default decision_note = isi DECISION note yang spawn-nya (jika ada).
      const dn = annotation && annotation.notes
        ? (firstDecisionNote(annotation.notes) || {}).note_text || ''
        : '';
      setDecisionNote(dn);
    } else {
      setRejectionReason('');
      setShowRejectInput(false);
    }
    setSaving(false);
    setBusy(false);
    // eslint-disable-next-line
  }, [open, mode, spec, annotation]);

  if (!open) return null;

  // -------- CREATE validation --------
  const vt = targetSpec ? targetSpec.value_type : 'TEXT';
  const isValueEmpty = () => {
    if (vt === 'BOOLEAN') return value !== true && value !== false;
    if (vt === 'MULTI_SELECT') return !Array.isArray(value) || value.length === 0;
    return value === '' || value === null || value === undefined;
  };
  const canSaveCreate = !!targetSpec && !isValueEmpty() && !saving;

  const handleCreate = async () => {
    if (!canSaveCreate) return;
    setSaving(true);
    try {
      await onCreateProposal({
        specId: targetSpec.id,
        valueType: targetSpec.value_type,
        value,
        proposedUnit,
        decisionNote,
      });
      onClose();
    } catch (e) {
      // parent toast menangani pesan; tutup busy agar bisa retry.
      setSaving(false);
    }
  };

  // -------- REVIEW conflict + actions --------
  const conflict = useMemo(() => {
    if (mode !== 'review' || !proposal) return null;
    return detectConflict(proposal, spec);
  }, [mode, proposal, spec]);

  const runAction = async (fn) => {
    setBusy(true);
    try {
      const res = await fn();
      // APPLY dapat mengembalikan {conflict:true} (race: spec berubah setelah
      // modal dibuka). Jangan tutup — biarkan user lihat konflik & memaksa/
      // re-base. Handler lain (reject/defer/rebase) tidak mengembalikan conflict.
      if (res && res.conflict) {
        setBusy(false);
        return;
      }
      onClose();
    } catch (e) {
      setBusy(false);
    }
  };

  const proposalStatus = proposal ? proposal.status : null;
  const isTerminal = proposalStatus === PROPOSAL_STATUS.APPROVED || proposalStatus === PROPOSAL_STATUS.REJECTED;

  const reviewBadge = (s) => BADGE_COLOR_CLASSES[REVIEW_STATUS_COLORS[s]] || 'badge-gray';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-black/70 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-ink-900 border border-white/10 rounded-2xl shadow-2xl my-4 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Rekonsiliasi Keputusan ke Spesifikasi"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Scale size={18} className="text-primary-400 flex-shrink-0" />
            <h2 className="font-semibold text-white truncate">
              {mode === 'create' ? 'Usulkan Perubahan Spesifikasi' : 'Rekonsiliasi Keputusan'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-400 hover:text-white" title="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Context (component / pin evidence) */}
          {(component || annotation) && (
            <div className="text-xs text-ink-400 flex flex-wrap items-center gap-x-2 gap-y-1">
              {component && (
                <span className="badge badge-gray text-[10px]">{component.component_name_snapshot || component.name || 'Komponen'}</span>
              )}
              {annotation && (
                <span>Pin #{annotation.pin_number}</span>
              )}
              {annotation && annotation._specLabel && (
                <span className="text-ink-500">· {annotation._specLabel}</span>
              )}
            </div>
          )}

          {mode === 'create' ? (
            /* ===================== CREATE ===================== */
            <>
              {/* Target spec */}
              <div>
                <label className="block text-xs font-semibold text-ink-300 mb-1.5">Target Spesifikasi</label>
                {specList.length > 1 ? (
                  <select
                    value={selectedSpecId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSpecId(id);
                      const s = specList.find((x) => x.id === id);
                      setValue(specValueAsInput(s));
                      setProposedUnit(s ? s.unit || '' : '');
                    }}
                    className="input text-sm py-2"
                  >
                    {specList.map((s) => (
                      <option key={s.id} value={s.id}>{getSpecDisplayLabel(s)}</option>
                    ))}
                  </select>
                ) : targetSpec ? (
                  <p className="text-sm text-white px-3 py-2 rounded-md bg-black/20 border border-white/10">
                    {getSpecDisplayLabel(targetSpec)}
                    <span className="text-ink-500 text-xs ml-2">(nilai saat ini: {hasSpecValue(targetSpec) ? formatSpecValue(targetSpec) : '—'})</span>
                  </p>
                ) : (
                  <p className="text-xs text-ink-400 italic">Komponen ini belum punya spesifikasi. Tambahkan spesifikasi dulu.</p>
                )}
              </div>

              {/* Nilai Keputusan (structured, typed) */}
              {targetSpec && (
                <div>
                  <label className="block text-xs font-semibold text-ink-300 mb-1.5">Nilai Keputusan</label>
                  <SpecValueInput
                    id="m4-proposed-value"
                    valueType={targetSpec.value_type}
                    value={value}
                    onChange={setValue}
                    disabled={saving}
                  />
                  {targetSpec.value_type === 'NUMBER' && (
                    <input
                      type="text"
                      value={proposedUnit}
                      onChange={(e) => setProposedUnit(e.target.value)}
                      placeholder="satuan (mis. cm)"
                      disabled={saving}
                      className="input text-xs py-1.5 mt-2 w-40"
                    />
                  )}
                </div>
              )}

              {/* Catatan (discussion note, SEPARATE from structured value) */}
              <div>
                <label className="block text-xs font-semibold text-ink-300 mb-1.5">
                  Catatan <span className="text-ink-500 font-normal">(diskusi, terpisah dari nilai)</span>
                </label>
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  disabled={saving}
                  rows={2}
                  placeholder="Mis. Marketing konfirmasi customer."
                  className="input text-sm py-2 resize-none"
                />
              </div>

              <p className="text-[11px] text-ink-500 leading-snug">
                Usulan akan disimpan berstatus <span className="font-semibold text-amber-400">Diusulkan</span>.
                Spesifikasi resmi belum berubah sampai ditelaah & diterapkan.
              </p>
            </>
          ) : (
            /* ===================== REVIEW ===================== */
            proposal && spec && (
              <>
                {/* Spesifikasi Resmi (current) */}
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-1">Spesifikasi Resmi</p>
                  <p className="text-sm font-medium text-white">{getSpecDisplayLabel(spec)}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-ink-300">
                      Nilai saat ini: <span className="text-white">{hasSpecValue(spec) ? formatSpecValue(spec) : '—'}</span>
                    </p>
                    <span className={'badge text-[10px] px-1.5 py-0.5 ' + reviewBadge(spec.review_status)}>
                      {REVIEW_STATUS_LABELS[spec.review_status]}
                    </span>
                  </div>
                </div>

                {/* Meeting Decision (proposed) */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-1">
                    <AlertTriangle size={11} /> Keputusan Meeting
                  </p>
                  <p className="text-xs text-ink-300 mb-0.5">Nilai Keputusan:</p>
                  <p className="text-sm text-white font-medium">{formatProposalValue(proposal)}</p>
                  {proposal.decision_note && (
                    <p className="text-xs text-ink-400 mt-1.5 leading-snug">“{proposal.decision_note}”</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-ink-500">
                    <span className={'badge text-[10px] px-1.5 py-0.5 ' + (BADGE_COLOR_CLASSES[PROPOSAL_STATUS_COLORS[proposalStatus]] || 'badge-gray')}>
                      {PROPOSAL_STATUS_LABELS[proposalStatus]}
                    </span>
                    {proposal.proposed_at && (
                      <span>diusulkan {new Date(proposal.proposed_at).toLocaleDateString('id-ID')}</span>
                    )}
                  </div>
                </div>

                {/* Conflict card (stale detection) */}
                {conflict && conflict.conflict && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2.5">
                    <p className="flex items-center gap-1 text-xs font-semibold text-red-400 mb-1.5">
                      <GitCompare size={13} /> Spesifikasi telah berubah sejak keputusan dibuat
                    </p>
                    <div className="text-xs text-ink-300 space-y-0.5">
                      <p>Saat keputusan dibuat (baseline): <span className="text-white">{conflict.baseline === null || conflict.baseline === undefined || conflict.baseline === '' ? '—' : String(conflict.baseline)}</span></p>
                      <p>Saat ini: <span className="text-white">{conflict.current === null || conflict.current === undefined || conflict.current === '' ? '—' : String(conflict.current)}</span></p>
                      <p>Keputusan mengusulkan: <span className="text-white">{conflict.proposed === null || conflict.proposed === undefined || conflict.proposed === '' ? '—' : String(conflict.proposed)}</span></p>
                    </div>
                    <p className="text-[11px] text-red-300 mt-1.5">Review ulang diperlukan sebelum menerapkan.</p>
                  </div>
                )}

                {/* Rejection reason (only when rejecting) */}
                {showRejectInput && (
                  <div>
                    <label className="block text-xs font-semibold text-ink-300 mb-1.5">Alasan Menolak</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      placeholder="Mis. Pertahankan nilai lama sesuai PO."
                      className="input text-sm py-2 resize-none"
                    />
                  </div>
                )}

                {/* Terminal info */}
                {isTerminal && (
                  <p className="text-xs text-ink-400 italic">
                    Usulan ini sudah <span className="font-semibold">{PROPOSAL_STATUS_LABELS[proposalStatus]}</span>. Tidak ada aksi lain.
                  </p>
                )}
              </>
            )
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-white/10 px-5 py-3 flex-shrink-0">
          {mode === 'create' ? (
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost btn-sm" disabled={saving}>Batal</button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSaveCreate}
                className="btn-primary btn-sm"
              >
                {saving ? 'Menyimpan…' : 'Usulkan Perubahan'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost btn-sm">Tutup</button>
              {!isTerminal && (
                <>
                  <button
                    type="button"
                    onClick={() => runAction(() => onDefer(proposal.id))}
                    disabled={busy}
                    className="btn-secondary btn-sm"
                  >
                    <Clock size={13} /> Tunda
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!showRejectInput) { setShowRejectInput(true); return; }
                      runAction(() => onReject(proposal.id, { reason: rejectionReason }));
                    }}
                    disabled={busy}
                    className="btn-secondary btn-sm"
                  >
                    <Ban size={13} /> {showRejectInput ? 'Konfirmasi Tolak' : 'Tetap Spesifikasi Lama'}
                  </button>
                  {conflict && conflict.conflict ? (
                    <>
                      <button
                        type="button"
                        onClick={() => runAction(() => onRebase(proposal.id))}
                        disabled={busy}
                        className="btn-secondary btn-sm"
                        title="Perbarui baseline ke nilai saat ini, tetap Diusulkan"
                      >
                        <RefreshCw size={13} /> Review Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm('Spec telah berubah. Terapkan paksa keputusan meeting? Nilai saat ini akan ditimpa.')) return;
                          runAction(() => onApply(proposal.id, { force: true }));
                        }}
                        disabled={busy}
                        className="btn-primary btn-sm"
                      >
                        <Check size={13} /> Terapkan Paksa
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runAction(() => onApply(proposal.id, { force: false }))}
                      disabled={busy}
                      className="btn-primary btn-sm"
                    >
                      <Check size={13} /> Terapkan ke Spesifikasi
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
