import { forwardRef } from 'react';
import { X, CheckCircle2, ChevronUp, ArrowRight } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import {
  decisionFirstNotes,
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
  NOTE_TYPE,
  NOTE_TYPE_LABELS,
  NOTE_TYPE_COLORS,
} from '../../lib/ppm-m3-helpers';

// ============================================================
// FloatingPinCard — summary card desktop (B).
//
// Mode COLLAPSED: ringkas (pin number, komponen, spec opsional,
// status, preview note, jumlah catatan, [Detail →]).
//
// Mode EXPANDED: card meng-ekspand di tempat menampilkan DETAIL
// lengkap (konteks komponen/item/spec + SEMUA catatan dengan badge
// jenis) — sehingga tidak perlu membuka halaman/panel detil di kanan
// (khususnya berguna saat fullscreen viewer aktif).
//
// [Detail →]      = toggle expanded (via onToggleExpand).
// [Panel Lengkap] = buka drawer pengelolaan penuh (onOpenDetail).
// [X]             = deselect / tutup card.
// Kartu di-posisikan oleh parent (AnnotationCanvas).
// ============================================================
const FloatingPinCard = forwardRef(function FloatingPinCard(
  { annotation, onOpenDetail, onClose, expanded = false, onToggleExpand },
  ref
) {
  const ordered = decisionFirstNotes(annotation.notes || []);
  const decision = ordered.find((n) => n.note_type === NOTE_TYPE.DECISION);
  // "latest/important" note: decision jika ada, selain itu note terakhir.
  const latest = ordered[ordered.length - 1] || null;
  const preview = decision || latest;

  const statusKey = ANNOTATION_STATUS_COLORS[annotation.status] || 'gray';
  const statusBadge = BADGE_COLOR_CLASSES[statusKey] || 'badge-gray';
  const noteCount = (annotation.notes || []).length;

  const handleDetail = () => {
    if (onToggleExpand) onToggleExpand(annotation);
    else if (onOpenDetail) onOpenDetail(annotation);
  };

  const noteBadge = (t) => BADGE_COLOR_CLASSES[NOTE_TYPE_COLORS[t]] || 'badge-gray';

  return (
    <div
      ref={ref}
      className={'annotation-card rounded-xl overflow-hidden ' + (expanded ? 'w-[340px]' : 'w-[264px]')}
    >
      {/* Accent garis atas (blue -> indigo) */}
      <div className="h-[3px] w-full bg-gradient-to-r from-blue-500/80 via-indigo-400/70 to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold annotation-card-title truncate leading-tight">
            PIN #{annotation.pin_number} · {annotation._componentLabel || 'Komponen'}
          </p>
          {annotation._itemName && (
            <p className="text-[11px] annotation-card-sub truncate">{annotation._itemName}</p>
          )}
          {annotation.component_specification_id && annotation._specLabel && (
            <p className="text-[11px] annotation-card-faint truncate">• {annotation._specLabel}</p>
          )}
        </div>
        <button
          onClick={() => onClose(annotation)}
          className="p-1 -m-1 annotation-card-close rounded flex-shrink-0"
          title="Tutup kartu / deselect"
          aria-label="Tutup kartu pin"
        >
          <X size={14} />
        </button>
      </div>

      {/* Status — teks + warna (bukan color-only) */}
      <div className="px-3 pt-1.5">
        <span className={'badge ' + statusBadge}>
          {ANNOTATION_STATUS_LABELS[annotation.status]}
        </span>
      </div>

      {!expanded ? (
        /* ================= COLLAPSED ================= */
        <>
          {/* Latest / important note */}
          {preview && (
            <div className="px-3 pt-2">
              <p className="text-xs annotation-card-body leading-snug break-words line-clamp-3">
                {preview.note_text}
              </p>
            </div>
          )}

          {/* Decision prominent */}
          {decision && (
            <div className="mx-3 mt-2 rounded-lg border border-green-500/30 bg-green-500/5 px-2.5 py-1.5">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-green-400 uppercase tracking-wide">
                <CheckCircle2 size={11} /> Keputusan
              </p>
              <p className="text-xs text-green-300 leading-snug line-clamp-2">{decision.note_text}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between gap-2 border-t annotation-card-divider px-3 py-2">
            <span className="text-[11px] annotation-card-sub">
              {noteCount} {noteCount === 1 ? 'catatan' : 'catatan'}
            </span>
            <button
              onClick={handleDetail}
              className="inline-flex items-center gap-1 text-[12px] font-semibold annotation-card-link"
              title={onToggleExpand ? 'Ekspansi kartu untuk melihat detail' : 'Buka panel Detail Annotation'}
            >
              Detail →
            </button>
          </div>
        </>
      ) : (
        /* ================= EXPANDED (detail lengkap) ================= */
        <>
          {/* Konteks */}
          <div className="mx-3 mt-2 rounded-lg annotation-card-inset px-2.5 py-2 space-y-0.5">
            {annotation._componentLabel && (
              <p className="text-xs font-medium annotation-card-title">{annotation._componentLabel}</p>
            )}
            {annotation._itemName && <p className="text-[11px] annotation-card-sub">{annotation._itemName}</p>}
            {annotation.component_specification_id && annotation._specLabel && (
              <p className="text-[11px] annotation-card-faint">• {annotation._specLabel}</p>
            )}
            <p className="text-[10px] annotation-card-faint">
              Posisi: {annotation.x_percent != null ? Number(annotation.x_percent).toFixed(1) : '-'}%, {annotation.y_percent != null ? Number(annotation.y_percent).toFixed(1) : '-'}%
            </p>
          </div>

          {/* Semua catatan */}
          <div className="px-3 pt-2">
            <h4 className="text-[10px] font-semibold annotation-card-faint uppercase tracking-wide mb-1.5">
              Catatan ({noteCount})
            </h4>
            {noteCount === 0 ? (
              <p className="text-xs annotation-card-faint">Belum ada catatan.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {ordered.map((note) => (
                  <div
                    key={note.id}
                    className={'rounded-lg border p-2 ' + (note.note_type === NOTE_TYPE.DECISION ? 'border-green-500/40 bg-green-500/5' : 'annotation-card-inset')}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={'badge ' + noteBadge(note.note_type)}>
                        {NOTE_TYPE_LABELS[note.note_type]}
                      </span>
                    </div>
                    <p className="text-xs annotation-card-body whitespace-pre-wrap break-words">{note.note_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer expanded */}
          <div className="mt-2 flex items-center justify-between gap-2 border-t annotation-card-divider px-3 py-2">
            <button
              onClick={handleDetail}
              className="inline-flex items-center gap-1 text-[12px] font-semibold annotation-card-sub annotation-card-sub-hover"
              title="Ciutkan kembali kartu"
            >
              <ChevronUp size={13} /> Tutup Detail
            </button>
            {onOpenDetail && (
              <button
                onClick={() => onOpenDetail(annotation)}
                className="inline-flex items-center gap-1 text-[12px] font-semibold annotation-card-link"
                title="Buka panel pengelolaan lengkap"
              >
                Panel Lengkap <ArrowRight size={13} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});

export default FloatingPinCard;
