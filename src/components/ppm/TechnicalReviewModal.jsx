import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { X, ChevronLeft, ChevronRight, Check, MessageSquare, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import { fetchItemComponents } from '../../lib/ppm-m1-helpers';
import {
  fetchSpecsForComponents,
  formatSpecValue,
  specValueAsInput,
  specOriginalInfo,
  confirmSpecification,
  markDiscussionRequired,
  markPending,
  resolveSpecification,
  computeReviewProgress,
  REVIEW_STATUS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  SPEC_SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
    SPEC_VALUE_TYPES,
  getSpecDisplayLabel,
  getSpecHelperText,
  isSpecificationReviewable,
} from '../../lib/ppm-m2-helpers';

// ============================================================
// Technical Review Modal - review per Product Item
// ============================================================
export default function TechnicalReviewModal({ open, onClose, item, profile, onSaved }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState(null); // { value, notes, saving }

  const canEdit = !!(profile && profile.id);

  const reload = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      const components = await fetchItemComponents(item.id);
      const compMap = {};
      (components || []).forEach((c) => { compMap[c.id] = c; });
      const specsMap = await fetchSpecsForComponents(components.map((c) => c.id));

      const list = [];
      (components || []).forEach((c) => {
        (specsMap[c.id] || []).forEach((s) => list.push({ component: c, spec: s }));
      });
            setEntries(list.filter((e) => isSpecificationReviewable(e.spec)));
            setIndex((i) => Math.min(i, Math.max(list.filter((e) => isSpecificationReviewable(e.spec)).length - 1, 0)));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data review');
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    if (open && item) {
      setIndex(0);
      setDecision(null);
      reload();
    }
    // eslint-disable-next-line
  }, [open, item]);

  if (!open || !item) return null;

  const current = entries[index];
  const progress = computeReviewProgress(entries.map((e) => e.spec));

  const mark = async (action) => {
    if (!current) return;
    setSaving(true);
    try {
      if (action === 'CONFIRMED') await confirmSpecification(current.spec.id, profile?.id);
      else if (action === 'DISCUSSION_REQUIRED') await markDiscussionRequired(current.spec.id);
      else if (action === 'PENDING') await markPending(current.spec.id);
      toast.success(reviewDoneToast(action));
      await reload();
      if (index >= entries.length - 1) {
        // tetap di posisi terakhir; reload sudah menyesuaikan
      } else {
        setIndex((i) => i + 1);
      }
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status');
    } finally {
      setSaving(false);
    }
  };

  const handleDecisionSave = async () => {
    if (!current || !decision) return;
    setDecision({ ...decision, saving: true });
    try {
      await resolveSpecification(current.spec.id, {
        value: decision.value,
        unit: current.spec.unit,
        notes: decision.notes || null,
        reviewerId: profile?.id,
      });
      toast.success('Keputusan disimpan (Sudah Diputuskan)');
      setDecision(null);
      await reload();
      if (index < entries.length - 1) setIndex((i) => i + 1);
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan keputusan');
    } finally {
      setDecision((d) => d ? { ...d, saving: false } : d);
    }
  };

  const previous = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(entries.length - 1, i + 1));

  const statusColor = current ? (REVIEW_STATUS_COLORS[current.spec.review_status] || 'gray') : 'gray';
  const currentStatusClass = BADGE_COLOR_CLASSES[statusColor] || 'badge-gray';
  const needsDecision = current && (current.spec.review_status === REVIEW_STATUS.DISCUSSION_REQUIRED || current.spec.review_status === REVIEW_STATUS.PENDING);
const compLabel = current
    ? (current.component.location_label
        ? current.component.component_name_snapshot + ' - ' + current.component.location_label
        : current.component.component_name_snapshot)
    : '';

  const originalText = current ? originalToText(current.spec) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-ink-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Technical Review</h3>
              <p className="text-xs text-ink-400">{item.item_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Progress */}
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-300">Progress</span>
            <span className="text-white font-medium">{progress.reviewableSelesai} / {progress.reviewableTotal} selesai</span>
          </div>
          <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all" style={{ width: progress.reviewableTotal ? (progress.reviewableSelesai / progress.reviewableTotal * 100) + '%' : '0%' }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
            <span className="text-green-400">{progress.confirmed} sesuai</span>
            <span className="text-blue-400">{progress.resolved} diputuskan</span>
            <span className="text-orange-400">{progress.discussion} perlu dibahas</span>
            <span className="text-yellow-400">{progress.pending} pending</span>
          </div>
        </div>

        {/* Entry body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="animate-spin h-6 w-6 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-white/10 rounded-lg">
              <p className="text-sm text-ink-400 mb-2">Belum ada spesifikasi untuk item ini.</p>
              <p className="text-xs text-ink-500">Tambahkan spesifikasi melalui "Kelola Spesifikasi" pada setiap komponen. Component tanpa spesifikasi tidak dianggap error.</p>
            </div>
          ) : current ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                <span className="font-mono">#{index + 1} / {entries.length}</span>
                <span className="badge badge-blue">{compLabel}</span>
                <span className={'badge ' + currentStatusClass}>{REVIEW_STATUS_LABELS[current.spec.review_status]}</span>
              </div>

              <div>
                <p className="text-xs text-ink-500 mb-1">SPESIFIKASI</p>
                <h4 className="text-lg font-semibold text-white">{getSpecDisplayLabel(current.spec)}</h4>
              {getSpecHelperText(current.spec) && <p className="text-xs text-ink-400 mt-1">{getSpecHelperText(current.spec)}</p>}
              </div>

              <div className="border border-white/10 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">NILAI</span>
                  <span className="text-sm text-white font-medium">{formatSpecValue(current.spec)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Sumber</span>
                  <span className="text-xs text-ink-300">{SOURCE_TYPE_LABELS[current.spec.source_type] || current.spec.source_type}</span>
                </div>
                {originalText && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Nilai PO semula</span>
                    <span className="text-xs text-ink-300">{originalText}</span>
                  </div>
                )}
                {current.spec.notes && (
                  <div className="pt-1">
                    <span className="text-xs text-ink-500">Catatan: </span>
                    <span className="text-xs text-ink-300">{current.spec.notes}</span>
                  </div>
                )}
              </div>
{/* Set Keputusan */}
              {needsDecision && decision ? (
                <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3 space-y-3">
                  <p className="text-sm text-yellow-300 font-medium">Set Keputusan</p>
                  <div>
                    <label className="label">Nilai</label>
                    <input
                      type={current.spec.value_type === SPEC_VALUE_TYPES.NUMBER ? 'number' : 'text'}
                      value={decision.value ?? ''}
                      onChange={(e) => setDecision({ ...decision, value: e.target.value })}
                      className="input"
                      disabled={decision.saving}
                    />
                    {current.spec.unit && <span className="text-xs text-ink-400">{current.spec.unit}</span>}
                  </div>
                  <div>
                    <label className="label">Catatan Keputusan</label>
                    <textarea value={decision.notes} onChange={(e) => setDecision({ ...decision, notes: e.target.value })} className="input" rows={2} disabled={decision.saving} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setDecision(null)} className="btn-ghost btn-sm">Batal</button>
                    <button onClick={handleDecisionSave} className="btn-primary btn-sm" disabled={decision.saving}>
                      {decision.saving ? 'Menyimpan...' : 'Sudah Diputuskan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => mark('CONFIRMED')} className="btn-primary btn-sm" disabled={saving || !canEdit}>
                                        <Check size={16} /> Sesuai
                  </button>
                  <button onClick={() => mark('DISCUSSION_REQUIRED')} className="btn-secondary btn-sm" disabled={saving || !canEdit}>
                                        <MessageSquare size={16} /> Perlu Dibahas
                  </button>
                  <button onClick={() => mark('PENDING')} className="btn-secondary btn-sm" disabled={saving || !canEdit}>
                                        <Clock size={16} /> Pending
                  </button>
                  {needsDecision && (
                    <button onClick={() => setDecision({ value: specValueAsInput(current.spec), notes: current.spec.notes || '', saving: false })} className="btn-secondary btn-sm" disabled={saving}>
                      <Sparkles size={16} /> Set Keputusan
                    </button>
                  )}
                </div>
              )}
              {needsDecision && !decision && (
                <p className="text-xs text-ink-400">"Spesifikasi ditandai untuk dibahas." Gunakan Set Keputusan bila keputusan sudah didapat.</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Navigation footer */}
        {entries.length > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
            <button onClick={previous} disabled={index === 0} className="btn-ghost btn-sm disabled:opacity-30"><ChevronLeft size={16} /> Sebelumnya</button>
            <span className="text-xs text-ink-400 font-mono">{index + 1} / {entries.length}</span>
            <button onClick={next} disabled={index >= entries.length - 1} className="btn-ghost btn-sm disabled:opacity-30">Berikutnya <ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function originalToText(spec) {
  const info = specOriginalInfo(spec);
  if (info.value === null || info.value === undefined || info.value === '') return '';
  if (spec.value_type === SPEC_VALUE_TYPES.SELECT || spec.value_type === SPEC_VALUE_TYPES.MULTI_SELECT) {
    const arr = Array.isArray(info.value) ? info.value : [info.value];
    return arr.filter(Boolean).join(', ') + (spec.unit ? ' ' + spec.unit : '');
  }
  return String(info.value) + (spec.unit ? ' ' + spec.unit : '');
}

function reviewDoneToast(action) {
  if (action === 'CONFIRMED') return 'Dibuat Sesuai (CONFIRMED)';
  if (action === 'DISCUSSION_REQUIRED') return 'Ditandai Perlu Dibahas';
  return 'Ditandai PENDING';
}