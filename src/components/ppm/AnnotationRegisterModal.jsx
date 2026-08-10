import { useState, useMemo } from 'react';
import { X, ListChecks, Layers, MapPin, CheckCircle2 } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import {
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
  NOTE_TYPE,
  NOTE_TYPE_LABELS,
  NOTE_TYPE_COLORS,
  componentDisplayLabel,
} from '../../lib/ppm-m3-helpers';
import {
  registerStats,
  applyRegisterFilters,
  buildRegisterByComponent,
  buildRegisterByPin,
  componentOptionsForItem,
} from '../../lib/ppm-m31-helpers';

// ============================================================
// AnnotationRegisterModal — daftar resmi seluruh pin dalam PO (F).
// - Header metadata (PO/Project/Customer/Meeting/Product Item + stat).
// - Dua view mode: Berdasarkan Komponen (default) / Nomor Pin.
// - Filter: Product Item, Component, Status, (opsional) Has Decision.
// - Decision note menonjol; discussion/info history tetap tampil.
// - Klik PIN -> onFocusPin: viewer di-focus ke pin tersebut.
// - Menggunakan source data SAMA (annotations + notes + items) —
//   fondasi export/print/share resmi nanti (tanpa data khusus).
// ============================================================
export default function AnnotationRegisterModal({
  open,
  onClose,
  annotations,
  items,
  po,
  meeting,
  onFocusPin,
}) {
  const [viewMode, setViewMode] = useState('component');
  const [itemId, setItemId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [status, setStatus] = useState('');
  const [hasDecision, setHasDecision] = useState(false);

  const stats = useMemo(() => registerStats(annotations), [annotations]);

  const filtered = useMemo(
    () => applyRegisterFilters(annotations, { itemId, componentId, status, hasDecision }),
    [annotations, itemId, componentId, status, hasDecision]
  );

  const byComponent = useMemo(() => buildRegisterByComponent(filtered, items), [filtered, items]);
  const byPin = useMemo(() => buildRegisterByPin(filtered, items), [filtered, items]);

  const componentOptions = useMemo(() => componentOptionsForItem(items, itemId), [items, itemId]);

  if (!open) return null;

  const statusBadge = (s) => BADGE_COLOR_CLASSES[ANNOTATION_STATUS_COLORS[s]] || 'badge-gray';
  const noteBadge = (t) => BADGE_COLOR_CLASSES[NOTE_TYPE_COLORS[t]] || 'badge-gray';

  const resetFilters = () => {
    setItemId('');
    setComponentId('');
    setStatus('');
    setHasDecision(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-black/70 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-ink-900 border border-white/10 rounded-2xl shadow-2xl my-4 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Annotation Register"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks size={18} className="text-primary-400 flex-shrink-0" />
            <h2 className="font-semibold text-white">Annotation Register</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-400 hover:text-white" title="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {po && po.po_number && (
              <div>
                <p className="text-xs text-ink-500">PO</p>
                <p className="text-white font-mono">{po.po_number}</p>
              </div>
            )}
            {po && po.project_name && (
              <div>
                <p className="text-xs text-ink-500">Project</p>
                <p className="text-white">{po.project_name}</p>
              </div>
            )}
            {po && po.customer_name && (
              <div>
                <p className="text-xs text-ink-500">Customer</p>
                <p className="text-white">{po.customer_name}</p>
              </div>
            )}
            {meeting && meeting.title && (
              <div>
                <p className="text-xs text-ink-500">Meeting</p>
                <p className="text-white truncate">{meeting.title}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-ink-500">Product Item</p>
              <p className="text-white truncate">
                {(items || []).map((i) => i.item_name).join(', ') || '-'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-ink-500">Ringkasan</p>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                <span className="badge badge-indigo">Total {stats.total} pin</span>
                <span className="badge badge-yellow">Open {stats.open}</span>
                <span className="badge badge-green">Selesai {stats.resolved}</span>
                <span className="badge badge-blue">Keputusan {stats.decisions}</span>
              </div>
            </div>
          </div>

          {/* View mode + filters */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex gap-1.5">
              <button
                onClick={() => setViewMode('component')}
                className={'btn btn-sm ' + (viewMode === 'component' ? 'btn-primary' : 'btn-secondary')}
              >
                <Layers size={13} /> Berdasarkan Komponen
              </button>
              <button
                onClick={() => setViewMode('pin')}
                className={'btn btn-sm ' + (viewMode === 'pin' ? 'btn-primary' : 'btn-secondary')}
              >
                <MapPin size={13} /> Berdasarkan Nomor Pin
              </button>
            </div>
            <button onClick={resetFilters} className="btn btn-ghost btn-sm">Reset Filter</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={itemId}
              onChange={(e) => { setItemId(e.target.value); setComponentId(''); }}
              className="input text-xs py-1.5"
            >
              <option value="">Semua Product Item</option>
              {(items || []).map((it) => (
                <option key={it.id} value={it.id}>{it.item_name}</option>
              ))}
            </select>
            <select
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              className="input text-xs py-1.5"
            >
              <option value="">Semua Komponen</option>
              {componentOptions.map((c) => (
                <option key={c.id} value={c.id}>{componentDisplayLabel(c)}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input text-xs py-1.5"
            >
              <option value="">Semua Status</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-ink-300 px-1">
              <input
                type="checkbox"
                checked={hasDecision}
                onChange={(e) => setHasDecision(e.target.checked)}
                className="accent-primary-500"
              />
              Has Decision
            </label>
          </div>

          {/* Content */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-ink-400">
              <p className="text-sm">Tidak ada pin yang cocok dengan filter.</p>
              <p className="text-xs text-ink-500 mt-1">Total pin PO: {stats.total}</p>
            </div>
          ) : viewMode === 'component' ? (
            <div className="space-y-5">
              {byComponent.map((itemGroup) => (
                <div key={itemGroup.item.id}>
                  <p className="text-sm font-semibold text-white mb-2">{itemGroup.itemName}</p>
                  <div className="space-y-3 pl-2 border-l border-white/10">
                    {itemGroup.components.map((group) => (
                      <div key={group.component.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{group.label}</p>
                          <span className="text-xs text-ink-400">
                            {group.pinCount} pin · {group.noteCount} catatan
                          </span>
                        </div>

                        {group.decisions.length > 0 && (
                          <div className="space-y-1 mb-2 rounded-lg border border-green-500/25 bg-green-500/[0.05] p-2">
                            <p className="text-[11px] font-semibold text-green-400 uppercase tracking-wide">
                              Keputusan
                            </p>
                            {group.decisions.map((n) => (
                              <p key={n.id} className="text-sm text-green-300">
                                <CheckCircle2 size={12} className="inline -mt-0.5 mr-1" />
                                {n.note_text}
                                <span className="text-ink-400 text-xs"> (Pin #{n._pinNumber})</span>
                              </p>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          {group.pins.map((pin) => (
                            <div key={pin.id} className="rounded-lg border border-white/5 bg-ink-900/40 p-2.5">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <button
                                  onClick={() => { onFocusPin(pin.id); onClose(); }}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-400 hover:text-primary-300"
                                  title="Focus viewer ke pin ini"
                                >
                                  <MapPin size={12} /> PIN #{pin.pin_number}
                                </button>
                                <span className={'badge ' + statusBadge(pin.status)}>
                                  {ANNOTATION_STATUS_LABELS[pin.status]}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {pin.notes.map((n) => (
                                  <p key={n.id} className="text-xs text-ink-300 leading-snug break-words">
                                    <span className={'badge text-[10px] px-1.5 py-0.5 mr-1 ' + noteBadge(n.note_type)}>
                                      {NOTE_TYPE_LABELS[n.note_type]}
                                    </span>
                                    {n.note_text}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {byPin.map((row) => (
                <div key={row.annotation.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <button
                      onClick={() => { onFocusPin(row.annotation.id); onClose(); }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-400 hover:text-primary-300"
                      title="Focus viewer ke pin ini"
                    >
                      <MapPin size={12} /> PIN #{String(row.pinNumber).padStart(2, '0')}
                    </button>
                    <span className={'badge ' + statusBadge(row.annotation.status)}>
                      {ANNOTATION_STATUS_LABELS[row.annotation.status]}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-ink-300 mb-2">
                    <p>Product Item: <span className="text-white">{row.itemName || '-'}</span></p>
                    <p>Component: <span className="text-white">{row.componentLabel || '-'}</span></p>
                    <p>Specification: <span className="text-white">{row.specLabel || '-'}</span></p>
                  </div>
                  <div className="space-y-1">
                    {row.notes.map((n) => (
                      <p key={n.id} className="text-xs text-ink-300 leading-snug break-words">
                        <span className={'badge text-[10px] px-1.5 py-0.5 mr-1 ' + noteBadge(n.note_type)}>
                          {NOTE_TYPE_LABELS[n.note_type]}
                        </span>
                        {n.note_text}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
