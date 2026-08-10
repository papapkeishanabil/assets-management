import { ClipboardList, Plus } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import {
  componentDisplayLabel,
  decisionFirstNotes,
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
} from '../../lib/ppm-m3-helpers';
import { groupComponentPins } from '../../lib/ppm-m31-helpers';
import {
  formatSpecValue,
  getSpecDisplayLabel,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  hasSpecValue,
} from '../../lib/ppm-m2-helpers';

// ============================================================
// ComponentDiscussionContent — isi panel "Diskusi" untuk sebuah
// komponen (atau Overview) di Meeting Product Discussion.
// SATU SUMBER (§17): dipakai AnnotationSidebar tab "Diskusi"
// (desktop) DAN blok mobile di MeetingProductFlow.
//
// Props:
//   item            — product item aktif (harus punya .components)
//   component       — komponen aktif (null = Overview)
//   annotations     — semua pin PO (untuk catatan visual)
//   compPinCounts   — map componentId -> jumlah pin
//   canManage       — tampilkan aksi Tambah Pin
//   onFocusPin(pinId)         — focus viewer ke pin
//   onQuickAddPin(component)  — mulai quick-add pin untuk komponen
//   onTechnicalReview(item)   — buka TechnicalReviewModal (item-scoped)
//
// Pure presentational. Tidak ada state / viewer / DB.
// ============================================================
export default function ComponentDiscussionContent({
  item,
  component,
  annotations,
  compPinCounts = {},
  canManage,
  onFocusPin,
  onQuickAddPin,
  onTechnicalReview,
}) {
  if (!item) {
    return <p className="text-xs text-ink-400 text-center py-6">Pilih produk untuk dibahas.</p>;
  }

  const specs = (component && component.specs) || [];
  const pins = component ? groupComponentPins(annotations || [], component.id) : [];

  // Overview: ringkasan agregat produk (bukan duplikat rail — hanya
  // statistik + hint; pemilihan komponen ada di rail MeetingProductFlow).
  const comps = item.components || [];
  const itemPinCount = comps.reduce((acc, c) => acc + (compPinCounts[c.id] || 0), 0);
  const rp = item.reviewProgress || {};

  const secLabel = 'text-[11px] font-semibold text-ink-300 uppercase tracking-wide';
  const reviewBadge = (status) =>
    BADGE_COLOR_CLASSES[REVIEW_STATUS_COLORS[status]] || 'badge-gray';
  const pinBadge = (status) =>
    BADGE_COLOR_CLASSES[ANNOTATION_STATUS_COLORS[status]] || 'badge-gray';

  return (
    <div className="space-y-3">
      {/* ---------- HEADER (eyebrow konteks + judul — §7/§8) ---------- */}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary-400 mb-0.5">
          {component ? 'Pembahasan Komponen' : 'Overview Produk'}
        </p>
        {component ? (
          <>
            <p className="text-sm font-bold text-white break-words">{componentDisplayLabel(component)}</p>
            <p className="text-xs text-ink-400 truncate">{item.item_name}</p>
            {component.is_custom && (
              <span className="badge badge-yellow text-[10px] px-1.5 py-0.5 mt-1">Custom</span>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-white break-words">{item.item_name}</p>
            <p className="text-xs text-ink-400">
              {comps.length} komponen
              {rp.reviewableTotal > 0 && <> · Review {rp.reviewableSelesai || 0}/{rp.reviewableTotal}</>}
              {itemPinCount > 0 && <> · {itemPinCount} pin</>}
            </p>
          </>
        )}
      </div>

      {/* ---------- SPESIFIKASI (component) / KOMPONEN (overview) ---------- */}
      {component ? (
        <div>
          <h4 className={secLabel + ' mb-2'}>Spesifikasi</h4>
          {specs.length === 0 ? (
            <p className="text-xs text-ink-400">Belum ada spesifikasi untuk komponen ini.</p>
          ) : (
            <div className="space-y-1.5">
              {specs.map((spec) => {
                const hasVal = hasSpecValue(spec);
                return (
                  <div
                    key={spec.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{getSpecDisplayLabel(spec)}</p>
                      <p className={'text-[11px] leading-snug ' + (hasVal ? 'text-ink-300' : 'text-ink-500 italic')}>
                        {hasVal ? formatSpecValue(spec) : 'Tidak Dicantumkan'}
                      </p>
                    </div>
                    <span className={'badge text-[10px] px-1.5 py-0.5 flex-shrink-0 ' + reviewBadge(spec.review_status)}>
                      {REVIEW_STATUS_LABELS[spec.review_status]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Overview: daftar komponen ringkas (read-only statistik) */
        <div>
          <h4 className={secLabel + ' mb-2'}>Komponen</h4>
          {comps.length === 0 ? (
            <p className="text-xs text-ink-400">Belum ada komponen pada produk ini.</p>
          ) : (
            <div className="space-y-1">
              {comps.map((c) => {
                const totalSpecs = (c.specs || []).length;
                const done = c.specDoneCount || 0;
                const pinN = compPinCounts[c.id] || 0;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 bg-black/10">
                    <span className="text-xs text-white truncate">{componentDisplayLabel(c)}</span>
                    <span className="text-[10px] text-ink-400 flex-shrink-0">
                      {totalSpecs > 0
                        ? `${done}/${totalSpecs} spec${pinN > 0 ? ` · ${pinN} pin` : ''}`
                        : pinN > 0 ? `${pinN} pin` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-ink-500 mt-2">Pilih komponen di rail atas untuk membahas spesifikasi & catatan visual.</p>
        </div>
      )}

      {/* ---------- CATATAN VISUAL (component only) ---------- */}
      {component && (
        <div>
          <h4 className={secLabel + ' mb-2'}>Catatan Visual</h4>
          {pins.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 px-2.5 py-3 text-center">
              <p className="text-xs text-ink-400 mb-2">Belum ada catatan visual untuk komponen ini.</p>
              {canManage && onQuickAddPin && (
                <button
                  type="button"
                  onClick={() => onQuickAddPin(component)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-400 hover:text-primary-300"
                >
                  <Plus size={12} /> Tambah Pin
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {pins.map((pin) => {
                const notes = decisionFirstNotes(pin.notes || []);
                const preview = notes[0] || null;
                const isDecision = preview && preview.note_type === 'DECISION';
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => onFocusPin && onFocusPin(pin.id)}
                    className="w-full text-left rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 hover:bg-white/[0.04] transition-colors"
                    title="Klik untuk focus ke pin ini"
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[11px] font-bold text-primary-400">Pin #{pin.pin_number}</span>
                      <span className={'badge text-[10px] px-1.5 py-0.5 ' + pinBadge(pin.status)}>
                        {ANNOTATION_STATUS_LABELS[pin.status]}
                      </span>
                    </div>
                    {preview ? (
                      <p className={'text-[11px] leading-snug break-words line-clamp-2 ' + (isDecision ? 'text-green-300 font-medium' : 'text-ink-300')}>
                        {isDecision && <span className="font-semibold">Keputusan: </span>}
                        {preview.note_text}
                      </p>
                    ) : (
                      <p className="text-[11px] text-ink-500 italic">Tanpa catatan</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------- ACTIONS ---------- */}
      <div className="flex flex-wrap gap-2 pt-1">
        {onTechnicalReview && (
          <button
            type="button"
            onClick={() => onTechnicalReview(item)}
            className="btn-secondary btn-sm"
            title="Mulai / lanjutkan Technical Review produk ini"
          >
            <ClipboardList size={14} /> Technical Review
          </button>
        )}
        {component && canManage && onQuickAddPin && (
          <button
            type="button"
            onClick={() => onQuickAddPin(component)}
            className="btn-primary btn-sm"
            title={'Tambah pin untuk ' + componentDisplayLabel(component)}
          >
            <Plus size={14} /> Tambah Pin
          </button>
        )}
      </div>
    </div>
  );
}
