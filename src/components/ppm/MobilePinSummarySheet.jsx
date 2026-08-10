import { X, MapPin, ChevronRight, CheckCircle2 } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import {
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
} from '../../lib/ppm-m3-helpers';
import { groupComponentPins } from '../../lib/ppm-m31-helpers';

// ============================================================
// MobilePinSummarySheet — bottom sheet untuk mobile 375px (E).
// - Desktop: floating cards. Mobile: JANGAN render kartu di atas
//   gambar; tap pin -> highlight + bottom sheet summary.
// - Jika komponen punya banyak pin, sheet menampilkan daftarnya;
//   tap satu pin -> viewer focus/highlight pin itu.
// ============================================================
export default function MobilePinSummarySheet({
  open,
  annotation,
  annotations,
  onClose,
  onFocusPin,
  onOpenDetail,
}) {
  if (!open || !annotation) return null;

  const componentPins = groupComponentPins(annotations || [], annotation.item_component_id);
  const statusKey = ANNOTATION_STATUS_COLORS[annotation.status] || 'gray';
  const statusBadge = BADGE_COLOR_CLASSES[statusKey] || 'badge-gray';

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full bg-ink-900 border-t border-white/10 rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ringkasan pin annotation"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-5 pt-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary-400 flex-shrink-0" />
              <h3 className="font-semibold text-white truncate">
                {annotation._componentLabel || 'Komponen'}
              </h3>
            </div>
            {annotation._itemName && (
              <p className="text-xs text-ink-400 mt-0.5">{annotation._itemName}</p>
            )}
            <p className="text-xs text-ink-500 mt-0.5">
              {componentPins.length} {componentPins.length === 1 ? 'Pin' : 'Pin'} ·{' '}
              {(annotation.notes || []).length} catatan
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-400 hover:text-white" title="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Pin list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {componentPins.map((pin) => {
            const isTapped = pin.id === annotation.id;
            const firstNote = (pin.notes || [])[0];
            const isOpen = pin.status === 'OPEN';
            return (
              <button
                key={pin.id}
                type="button"
                onClick={() => { onFocusPin(pin.id); onClose(); }}
                className={
                  'w-full text-left rounded-lg border p-3 transition-colors ' +
                  (isTapped
                    ? 'border-primary-500/50 bg-primary-500/10'
                    : 'border-white/10 bg-black/20')
                }
                aria-label={'Fokus ke ' + (isOpen ? 'Pin Terbuka' : 'Pin Selesai') + ' nomor ' + pin.pin_number}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={
                        'flex items-center justify-center h-6 min-w-[24px] px-1 rounded-full text-[11px] font-bold flex-shrink-0 ' +
                        (isOpen ? 'bg-primary-600/90 text-white' : 'bg-ink-700/90 text-ink-200')
                      }
                    >
                      {pin.pin_number}
                    </span>
                    <span className="text-sm text-white font-medium truncate">
                      Pin #{pin.pin_number}
                    </span>
                  </div>
                  <span className={'badge flex-shrink-0 ' + statusBadge}>
                    {ANNOTATION_STATUS_LABELS[pin.status]}
                  </span>
                </div>
                {firstNote && (
                  <p className="text-xs text-ink-300 mt-1.5 line-clamp-2 break-words">
                    {firstNote.note_text}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail action for tapped pin */}
        <div className="px-5 pb-5 pt-1">
          <button
            type="button"
            onClick={() => { onOpenDetail(annotation); onClose(); }}
            className="btn-primary btn-sm w-full flex items-center justify-center gap-1"
          >
            <CheckCircle2 size={14} /> Lihat Detail Pin #{annotation.pin_number}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
