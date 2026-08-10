import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Circle,
  Settings2,
  MessagesSquare,
} from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import { componentDisplayLabel } from '../../lib/ppm-m3-helpers';
import ComponentDiscussionContent from './ComponentDiscussionContent';

// ============================================================
// MeetingProductFlow — orkestrasi tampilan MEETING di luar
// workspace (Order Overview + Product Selection + Product
// Discussion header + component rail + nav).
//
// Dua branch (controlled penuh oleh parent — tidak ada state):
//   discussionItemId === null  -> PRODUCT SELECTION (kartu produk + [Bahas Produk])
//   discussionItemId !== null  -> PRODUCT DISCUSSION (header + component rail + nav)
//
// Workspace (AnnotationCanvas + sidebar) TIDAK ada di sini —
// tetap di parent (PPMPoDetailPage), selalu mounted (§15).
//
// Pure presentational. Tidak ada viewer / DB.
// ============================================================
export default function MeetingProductFlow({
  items,
  compPinCounts,
  annotations,
  discussionItemId,
  activeItem,
  discussionComponentId,
  canManage,
  // callbacks
  onStartDiscussion,
  onBackToProducts,
  onDiscussComponent,
  onDiscussOverview,
  onNextProduct,
  onFocusPin,
  onQuickAddPin,
  onMeetingTechnicalReview,
  onManageItem,
  onManageComponents,
}) {
  // ---------- [1] PRODUCT SELECTION (entry default) ----------
  // Order Context (PO#/customer/Meeting Aktif/qty/Produk/Review/Pin + [Lihat
  // Detail PO]) sudah disajikan meeting-header strip di PPMPoDetailPage — TIDAK
  // diulang di sini (§1 single Order Context). Langsung ke daftar produk.
  if (!discussionItemId) {
    return (
      <div className="m-sec-meetingselect">
        {/* PRODUK YANG AKAN DIBAHAS */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <MessagesSquare size={16} className="text-primary-400" />
            <h2 className="text-sm font-semibold text-white">Produk yang Akan Dibahas</h2>
          </div>
          {items.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
              <p className="text-sm text-ink-400 mb-1">Belum ada produk pada PO ini.</p>
              {canManage && onManageItem && (
                <button type="button" onClick={onManageItem} className="btn-secondary btn-sm mt-2">
                  <Settings2 size={14} /> Tambah Produk
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => {
                const rp = item.reviewProgress || {};
                const comps = item.components || [];
                const itemPinCount = comps.reduce((acc, c) => acc + (compPinCounts[c.id] || 0), 0);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-500/10 text-primary-400 font-bold text-xs flex-shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.item_name}</p>
                        <p className="text-[11px] text-ink-400">
                          {item.quantity != null ? `${item.quantity} pcs` : ''}
                          {item.quantity != null && comps.length > 0 ? ' · ' : ''}
                          {comps.length > 0 ? `${comps.length} komponen` : ''}
                          {rp.reviewableTotal > 0 ? ` · Review ${rp.reviewableSelesai || 0}/${rp.reviewableTotal}` : ''}
                          {itemPinCount > 0 ? ` · ${itemPinCount} pin` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canManage && onManageComponents && (
                        <button
                          type="button"
                          onClick={() => onManageComponents(item)}
                          className="text-xs font-medium text-ink-400 hover:text-ink-200 px-1.5"
                          title="Kelola komponen produk (admin)"
                        >
                          Kelola
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onStartDiscussion(item)}
                        className="btn-primary btn-sm"
                      >
                        Bahas Produk
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- [2] PRODUCT DISCUSSION ----------
  if (!activeItem) {
    // safety: item hilang (mis. dihapus) -> balik ke selection
    return (
      <div className="m-sec-discussion">
        <button type="button" onClick={onBackToProducts} className="btn-ghost btn-sm">
          <ArrowLeft size={14} /> Semua Produk
        </button>
        <p className="text-sm text-ink-400 mt-2">Produk tidak ditemukan.</p>
      </div>
    );
  }

  const comps = activeItem.components || [];
  const activeComp = discussionComponentId
    ? comps.find((c) => c.id === discussionComponentId) || null
    : null;
  const rp = activeItem.reviewProgress || {};
  const itemIdx = items.findIndex((it) => it.id === discussionItemId);
  const nextItem = itemIdx >= 0 && itemIdx < items.length - 1 ? items[itemIdx + 1] : null;

  // index komponen aktif di rail (Overview = -1)
  const railSeq = [null, ...comps.map((c) => c.id)]; // null = Overview di depan
  const compIdx = railSeq.indexOf(discussionComponentId); // -1 jika null -> 0
  const canPrevComp = compIdx > 0;
  const canNextComp = compIdx >= 0 && compIdx < railSeq.length - 1;

  const goPrevComp = () => {
    if (!canPrevComp) return;
    const prevId = railSeq[compIdx - 1];
    if (prevId === null) onDiscussOverview();
    else onDiscussComponent(comps.find((c) => c.id === prevId));
  };
  const goNextComp = () => {
    if (!canNextComp) return;
    const nextId = railSeq[compIdx + 1];
    if (nextId === null) onDiscussOverview();
    else onDiscussComponent(comps.find((c) => c.id === nextId));
  };

  // status badge per komponen (derive — §10, no new enum)
  const compStatus = (c) => {
    const totalSpecs = (c.specs || []).length;
    const done = c.specDoneCount || 0;
    const openPins = (annotations || []).some(
      (a) => a.item_component_id === c.id && a.status !== 'RESOLVED'
    );
    if (totalSpecs > 0 && done >= totalSpecs) return 'done';
    if (openPins) return 'open';
    return 'neutral';
  };
  const StatusIcon = ({ s }) =>
    s === 'done' ? <CheckCircle2 size={12} className="text-green-400" /> :
    s === 'open' ? <AlertCircle size={12} className="text-amber-400" /> :
    <Circle size={12} className="text-ink-500" />;

  const railBtn = (active) =>
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border ' +
    (active
      ? 'bg-primary-500/15 text-primary-300 border-primary-500/40'
      : 'bg-white/[0.02] text-ink-300 border-white/10 hover:bg-white/[0.05]');

  return (
    <div className="m-sec-discussion">
      {/* Header produk — baris 1: nav (back / next product); baris 2: judul +
          meta (qty · komponen · Review). Review dipindah ke baris judul (§3). */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <button
          type="button"
          onClick={onBackToProducts}
          className="btn-ghost btn-sm"
        >
          <ArrowLeft size={14} /> Semua Produk
        </button>
        {nextItem && (
          <button
            type="button"
            onClick={() => onNextProduct(nextItem)}
            className="btn-secondary btn-sm"
            title={'Lanjut bahas ' + nextItem.item_name}
          >
            Berikutnya: {nextItem.item_name} <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
        <h1 className="text-lg font-bold text-white">{activeItem.item_name}</h1>
        {activeItem.quantity != null && (
          <span className="text-sm text-ink-400">· {activeItem.quantity} pcs</span>
        )}
        <span className="text-sm text-ink-500">· {comps.length} komponen</span>
        {rp.reviewableTotal > 0 && (
          <span className={'badge ' + BADGE_COLOR_CLASSES[rp.reviewableSelesai === rp.reviewableTotal ? 'green' : 'yellow']}>
            Review {rp.reviewableSelesai || 0}/{rp.reviewableTotal}
          </span>
        )}
      </div>

      {/* COMPONENT RAIL — [Overview] + komponen dari data nyata (§9) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1">
        <button
          type="button"
          onClick={onDiscussOverview}
          className={railBtn(!discussionComponentId)}
          title="Tampilkan keseluruhan produk (Fit)"
        >
          <MapPin size={12} /> Overview
        </button>
        {comps.map((c) => {
          const active = discussionComponentId === c.id;
          const pinN = compPinCounts[c.id] || 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onDiscussComponent(c)}
              className={railBtn(active)}
              title={componentDisplayLabel(c)}
            >
              <StatusIcon s={compStatus(c)} />
              <span className="truncate max-w-[140px]">{componentDisplayLabel(c)}</span>
              {pinN > 0 && (
                <span
                  className="badge badge-indigo text-[10px] leading-none px-1.5 py-0.5"
                  title={`${pinN} pin`}
                >
                  {pinN}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* NAV antar komponen (§18) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={goPrevComp}
          disabled={!canPrevComp}
          className="btn-ghost btn-sm disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Sebelumnya
        </button>
        <span className="text-[11px] text-ink-400">
          {discussionComponentId ? componentDisplayLabel(activeComp) : 'Overview'}
        </span>
        <button
          type="button"
          onClick={goNextComp}
          disabled={!canNextComp}
          className="btn-ghost btn-sm disabled:opacity-30"
        >
          Berikutnya <ChevronRight size={14} />
        </button>
      </div>

      {/* MOBILE component context (desktop panel ada di sidebar) */}
      <div className="card lg:hidden mb-4 p-3 max-h-[60vh] overflow-y-auto">
        <ComponentDiscussionContent
          item={activeItem}
          component={activeComp}
          annotations={annotations}
          compPinCounts={compPinCounts}
          canManage={canManage}
          onFocusPin={onFocusPin}
          onQuickAddPin={onQuickAddPin}
          onTechnicalReview={onMeetingTechnicalReview}
        />
      </div>
    </div>
  );
}
