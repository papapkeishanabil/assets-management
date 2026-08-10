import { useMemo, useState, useEffect } from 'react';
import { Layers, MapPin, MessagesSquare, MessageSquare, CheckCircle2, Eye, ListChecks, Plus } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import ComponentDiscussionContent from './ComponentDiscussionContent';
import {
  ANNOTATION_STATUSES,
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
  decisionFirstNotes,
  componentDisplayLabel,
  buildAnnotationRecap,
} from '../../lib/ppm-m3-helpers';
import {
  registerStats,
  applyRegisterFilters,
  buildRegisterByComponent,
} from '../../lib/ppm-m31-helpers';

// ============================================================
// AnnotationSidebar — right sidebar persistent (desktop) M3.2.
// Dua tab:
//   [Daftar Pin] : filter Komponen + Status, group per komponen,
//                  klik pin -> focus viewer; "Tampilkan semua" ->
//                  select semua pin komponen + smart focus.
//   [Rangkuman]  : Annotation Register existing (group per komponen,
//                  decision prominent).
// Lebar ~340px (320–360px) sesuai target desktop layout.
// ============================================================
export default function AnnotationSidebar({
  annotations,
  items,
  selectedPinIds,
  onFocusPin,
  onFocusComponent,
  onQuickAddPin,
  compPinCounts = {},
  activeItemId,
  initialTab = 'pins',
  // M3 Meeting Product Discussion: ketika discussionItem diset, sidebar
  // memunculkan tab "Diskusi" (default) & menyembunyikan tab "Komponen"
  // explorer (pemilihan komponen dipegang page-level rail). §15 one-sidebar.
  discussionItem,
  discussionComponentId,
  onTechnicalReview,
  className = '',
}) {
  const [tab, setTab] = useState(initialTab);
  const [componentId, setComponentId] = useState('');
  const [status, setStatus] = useState('');
  // Component Explorer: item yang sedang di-expand (default = item aktif).
  const [explorerOpenItemId, setExplorerOpenItemId] = useState(activeItemId || null);

  const discussionActive = !!discussionItem;

  // Saat status discussion berubah, jaga agar tab selalu valid:
  // - masuk discussion & sedang di tab 'komponen' (tersembunyi) -> 'diskusi'
  // - keluar discussion & sedang di 'diskusi' (tersembunyi) -> 'pins'
  useEffect(() => {
    setTab((cur) => {
      if (discussionActive) {
        return cur === 'diskusi' || cur === 'pins' || cur === 'recap' ? cur : 'diskusi';
      }
      return cur === 'diskusi' ? 'pins' : cur;
    });
  }, [discussionActive]);

  // Komponen aktif untuk tab Diskusi (resolve dari discussionItem).
  const activeDiscussionComp = useMemo(() => {
    if (!discussionItem || !discussionComponentId) return null;
    return (discussionItem.components || []).find((c) => c.id === discussionComponentId) || null;
  }, [discussionItem, discussionComponentId]);

  const stats = useMemo(() => registerStats(annotations), [annotations]);

  const filtered = useMemo(
    () => applyRegisterFilters(annotations, { componentId, status }),
    [annotations, componentId, status]
  );

  const byComponent = useMemo(() => buildRegisterByComponent(filtered, items), [filtered, items]);
  const recap = useMemo(() => buildAnnotationRecap(annotations, items), [annotations, items]);

  // Semua komponen (dari seluruh item) untuk filter dropdown.
  const componentOptions = useMemo(() => {
    const seen = {};
    (items || []).forEach((it) => (it.components || []).forEach((c) => { seen[c.id] = c; }));
    return Object.values(seen);
  }, [items]);

  const statusBadge = (s) => BADGE_COLOR_CLASSES[ANNOTATION_STATUS_COLORS[s]] || 'badge-gray';

  const resetFilters = () => {
    setComponentId('');
    setStatus('');
  };

  const isSelected = (id) => (selectedPinIds || []).includes(id);

  const tabBtn = (active) =>
    'flex-1 py-2 text-xs font-semibold rounded-md transition-colors ' +
    (active ? 'bg-primary-500/15 text-primary-300 border border-primary-500/30' : 'text-ink-400 hover:text-ink-200');

  return (
    <aside className={'flex flex-col rounded-lg border border-white/10 bg-ink-900/60 overflow-hidden ' + className}>
      {/* Tabs — adaptif: discussion aktif -> [Diskusi|Daftar Pin|Rangkuman];
          else -> [Daftar Pin|Rangkuman|Komponen] (§15 one-sidebar). */}
      <div className="flex items-center gap-1 p-2 border-b border-white/10">
        {discussionActive && (
          <button type="button" onClick={() => setTab('diskusi')} className={tabBtn(tab === 'diskusi')}>
            <span className="inline-flex items-center justify-center gap-1.5">
              <MessageSquare size={12} /> Diskusi
            </span>
          </button>
        )}
        <button type="button" onClick={() => setTab('pins')} className={tabBtn(tab === 'pins')}>
          <span className="inline-flex items-center justify-center gap-1.5">
            <MapPin size={12} /> Daftar Pin
          </span>
        </button>
        <button type="button" onClick={() => setTab('recap')} className={tabBtn(tab === 'recap')}>
          <span className="inline-flex items-center justify-center gap-1.5">
            <MessagesSquare size={12} /> Rangkuman
          </span>
        </button>
        {!discussionActive && (
          <button type="button" onClick={() => setTab('komponen')} className={tabBtn(tab === 'komponen')}>
            <span className="inline-flex items-center justify-center gap-1.5">
              <Layers size={12} /> Komponen
            </span>
          </button>
        )}
      </div>

      {/* Stat ringkas */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 text-[11px] text-ink-400">
        <span>{stats.total} pin</span>
        <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true" />
        <span className="text-green-400">{stats.resolved} resolved</span>
        <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true" />
        <span className="text-amber-400">{stats.open} open</span>
        <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true" />
        <span>{stats.notes} catatan</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'diskusi' ? (
          /* ===== DISKUSI TAB — Meeting Product Discussion (komponen aktif).
             Satu sumber: ComponentDiscussionContent (§17) — dipakai juga di
             blok mobile MeetingProductFlow. */
          <div className="p-3">
            <ComponentDiscussionContent
              item={discussionItem}
              component={activeDiscussionComp}
              annotations={annotations}
              compPinCounts={compPinCounts}
              canManage={!!onQuickAddPin}
              onFocusPin={onFocusPin}
              onQuickAddPin={onQuickAddPin}
              onTechnicalReview={onTechnicalReview}
            />
          </div>
        ) : tab === 'pins' ? (
          <>
            {/* Filters */}
            <div className="px-3 pt-3 space-y-2 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-ink-400 flex-shrink-0" />
                <select
                  value={componentId}
                  onChange={(e) => setComponentId(e.target.value)}
                  className="input text-xs py-1.5"
                  title="Filter komponen"
                >
                  <option value="">Semua Komponen</option>
                  {componentOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {componentDisplayLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <ListChecks size={13} className="text-ink-400 flex-shrink-0" />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input text-xs py-1.5"
                  title="Filter status"
                >
                  <option value="">Semua Status</option>
                  {ANNOTATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ANNOTATION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                {(componentId || status) && (
                  <button type="button" onClick={resetFilters} className="btn-ghost btn-sm flex-shrink-0" title="Reset filter">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Group per komponen */}
            <div className="p-3 space-y-3">
              {byComponent.length === 0 && (
                <p className="text-xs text-ink-400 text-center py-6">Tidak ada pin.</p>
              )}
              {byComponent.map((group) => (
                <div key={group.item.id} className="space-y-1.5">
                  {group.components.map((g) => (
                    <div key={g.component.id} className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{g.label}</p>
                          <p className="text-[10px] text-ink-400 truncate">{group.itemName}</p>
                        </div>
                        <span className="text-[10px] text-ink-400 flex-shrink-0">
                          {g.pinCount} pin · {g.noteCount} catatan
                        </span>
                      </div>
                      <div className="space-y-1">
                        {g.pins.map((pin) => {
                          const dec = (pin.notes || []).find((n) => n.note_type === 'DECISION');
                          const preview = dec || (pin.notes || []).slice(-1)[0] || null;
                          return (
                            <button
                              key={pin.id}
                              type="button"
                              onClick={() => onFocusPin(pin.id)}
                              className={'w-full text-left rounded-md px-2 py-1.5 border transition-colors ' +
                                (isSelected(pin.id)
                                  ? 'border-primary-500/50 bg-primary-500/10'
                                  : 'border-transparent hover:bg-white/5')}
                              title="Klik untuk focus ke pin ini"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-primary-400 flex-shrink-0">
                                  PIN #{pin.pin_number}
                                </span>
                                <span className={'badge ' + statusBadge(pin.status)}>
                                  {ANNOTATION_STATUS_LABELS[pin.status]}
                                </span>
                              </div>
                              {preview && (
                                <p className={'text-[11px] leading-snug break-words line-clamp-1 ' +
                                  (dec ? 'text-green-300 font-medium' : 'text-ink-300')}>
                                  {dec && <span className="font-semibold">Keputusan: </span>}
                                  {preview.note_text}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => onFocusComponent(g.component)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-400 hover:text-primary-300"
                        title="Pilih semua pin komponen ini dan focus zoom"
                      >
                        <Eye size={11} /> Tampilkan semua ({g.pinCount})
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : tab === 'komponen' ? (
          /* ===== KOMPONEN TAB — Component Explorer (meeting quick-add) =====
             Daftar item → komponen (sumber data sama dgn `items`). Tiap komponen
             punya spec ringkas + jumlah pin + tombol "Tambah Pin" yang memicu
             quick-add (pre-select komponen + zoom + mode penempatan) di parent.
             Murni presentasi (§17: satu sumber/dua tata letak). */
          <div className="p-3 space-y-3">
            {(!items || items.length === 0) && (
              <p className="text-xs text-ink-400 text-center py-6">Belum ada item produk.</p>
            )}
            {(items || []).map((it) => {
              const isOpen = explorerOpenItemId === it.id;
              const comps = it.components || [];
              return (
                <div key={it.id} className="rounded-lg border border-white/10 bg-white/[0.025]">
                  <button
                    type="button"
                    onClick={() => setExplorerOpenItemId(isOpen ? null : it.id)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-white/[0.02]"
                  >
                    <span className="text-xs font-bold text-white truncate">{it.item_name}</span>
                    <span className="text-[10px] text-ink-400 flex-shrink-0">{comps.length} komponen</span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {comps.length === 0 && (
                        <p className="text-[11px] text-ink-500 px-1 py-1">Belum ada komponen.</p>
                      )}
                      {comps.map((c) => {
                        const pinCount = (compPinCounts && compPinCounts[c.id]) || 0;
                        return (
                          <div key={c.id} className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onFocusComponent(c)}
                                className="min-w-0 text-left"
                                title="Tampilkan pin komponen ini di gambar"
                              >
                                <p className="text-[11px] font-medium text-white truncate">{componentDisplayLabel(c)}</p>
                                {c.specSummary && c.specSummary.length > 0 && (
                                  <p className="text-[10px] text-ink-400 truncate">{c.specSummary.join(' • ')}</p>
                                )}
                              </button>
                              <span className={'badge text-[10px] px-1.5 py-0.5 flex-shrink-0 ' + (pinCount > 0 ? 'badge-indigo' : 'badge-gray')}>
                                {pinCount} pin
                              </span>
                            </div>
                            {onQuickAddPin && (
                              <button
                                type="button"
                                onClick={() => onQuickAddPin(c)}
                                className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-primary-400 hover:text-primary-300"
                                title={'Tambah pin untuk ' + componentDisplayLabel(c)}
                              >
                                <Plus size={11} /> Tambah Pin
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ===== RANGKUMAN TAB ===== */
          <div className="p-3 space-y-3">
            {recap.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-6">Belum ada annotation.</p>
            )}
            {recap.map((group) => (
              <div key={group.item.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white truncate">{group.item.item_name}</p>
                  <span className="text-[10px] text-ink-400 flex-shrink-0">
                    {group.pinCount} pin · {group.noteCount} catatan
                  </span>
                </div>
                <div className="space-y-2 pl-2 border-l border-white/10">
                  {group.components.filter((g) => g.pinCount > 0).map((g) => (
                    <div key={g.component.id} className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                        <p className="text-xs font-medium text-white">{g.label}</p>
                        <button
                          type="button"
                          onClick={() => onFocusComponent(g.component)}
                          className="text-[10px] font-semibold text-primary-400 hover:text-primary-300"
                        >
                          Tampilkan Semua ({g.pinCount})
                        </button>
                      </div>
                      {g.decisions.length > 0 && (
                        <div className="space-y-1 mb-1.5">
                          {g.decisions.map((n) => (
                            <p key={n.id} className="text-xs text-green-400 leading-snug">
                              <CheckCircle2 size={11} className="inline mr-1 align-[-2px]" />
                              <span className="font-semibold">Keputusan:</span> {n.note_text}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="space-y-0.5">
                        {g.pins.map((pin) => {
                          const dec = (pin.notes || []).find((n) => n.note_type === 'DECISION');
                          const preview = dec || (pin.notes || []).slice(-1)[0] || null;
                          if (!preview) return null;
                          return (
                            <button
                              key={pin.id}
                              type="button"
                              onClick={() => onFocusPin(pin.id)}
                              className="block w-full text-left text-[11px] text-ink-300 leading-snug hover:text-ink-100"
                              title="Klik untuk focus ke pin ini"
                            >
                              <span className="text-ink-500">Pin {pin.pin_number}:</span>{' '}
                              {preview.note_text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
