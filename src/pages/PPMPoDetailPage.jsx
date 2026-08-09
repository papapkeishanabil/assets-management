import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Settings2, Pencil, Trash2, Plus, Layers, ChevronUp, ChevronDown, ShieldCheck, ClipboardList } from 'lucide-react';
import { formatDateLongID, PPM_PO_STATUS_LABELS, PPM_PO_STATUS_COLORS, BADGE_COLOR_CLASSES, isImageDocument } from '../lib/constants';
import ProductItemModal from '../components/ppm/ProductItemModal';
import ComponentManagerModal from '../components/ppm/ComponentManagerModal';
import SpecificationManagerModal from '../components/ppm/SpecificationManagerModal';
import TechnicalReviewModal from '../components/ppm/TechnicalReviewModal';
import {
  fetchPOItems,
  deletePOItem,
  swapPOItemSort
} from '../lib/ppm-m1-helpers';
import {
  fetchSpecsForComponents,
  computeReviewProgress,
  formatSpecValue,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
    SOURCE_TYPE_LABELS,
  getSpecDisplayLabel,
  hasSpecValue,
    isSpecificationReviewable,
  getSpecHelperText,
} from '../lib/ppm-m2-helpers';

export default function PPMPoDetailPage() {
  const { meetingId, poId } = useParams();
  const { profile, role } = useAuth();
  const [po, setPO] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [componentModalItem, setComponentModalItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedItemId, setExpandedItemId] = useState(null);

  // M2: specification state
  const [specManagerComponent, setSpecManagerComponent] = useState(null);
  const [techReviewItem, setTechReviewItem] = useState(null);
  const [expandedCompId, setExpandedCompId] = useState(null);

  // Permission check: meeting creator or super_admin can manage items
  const canManage = role && (
    role.role_name === 'super_admin' ||
    (meeting && profile && meeting.created_by === profile.id)
  );

  // M2: attach specifications + review progress to loaded items/components
  const enrichItemsWithSpecs = useCallback(async (poItems) => {
    if (!poItems || poItems.length === 0) return poItems;
    const compIds = [];
    poItems.forEach((it) => (it.components || []).forEach((c) => compIds.push(c.id)));
    const specsMap = compIds.length ? await fetchSpecsForComponents(compIds) : {};

    return poItems.map((it) => {
          let total = 0, done = 0, discussion = 0, pending = 0, reviewableTotal = 0, reviewableSelesai = 0;
      const components = (it.components || []).map((c) => {
        const specs = specsMap[c.id] || [];
        c.specs = specs;
        c.specSummary = buildSpecSummary(specs);
        c.specDoneCount = specs.filter((s) => ['CONFIRMED', 'RESOLVED'].includes(s.review_status)).length;
        const p = computeReviewProgress(specs);
                total += p.total; done += p.selesai; discussion += p.discussion; pending += p.pending;
        reviewableTotal += p.reviewableTotal; reviewableSelesai += p.reviewableSelesai;
        return c;
      });
      it.components = components;
      it.reviewProgress = { total, selesai: done, reviewableTotal, reviewableSelesai, discussion, pending };
      return it;
    });
  }, []);

  const fetchPO = useCallback(async () => {
    setLoading(true);
    try {
      const { data: poData, error: poError } = await supabase
        .from('ppm_meeting_pos')
        .select('*')
        .eq('id', poId)
        .single();
      if (poError) throw poError;
      setPO(poData);

      const { data: meetingData, error: meetingError } = await supabase
        .from('ppm_meetings')
        .select('*')
        .eq('id', meetingId)
        .single();
      if (meetingError) throw meetingError;
      setMeeting(meetingData);

      const poItems = await fetchPOItems(poId, true);
      const enriched = await enrichItemsWithSpecs(poItems);
      setItems(enriched);
    } catch (error) {
      console.error('Error fetching PO:', error);
    } finally {
      setLoading(false);
    }
  }, [meetingId, poId, enrichItemsWithSpecs]);

  useEffect(() => { fetchPO(); }, [fetchPO]);

  // Light refresh - update items/components without full-page loading spinner
  // Used after adding/editing/deleting components or items so the UI updates
  // instantly without a page "refresh" feel.
  const refreshItems = useCallback(async () => {
    try {
      const poItems = await fetchPOItems(poId, true);
      const enriched = await enrichItemsWithSpecs(poItems);
      setItems(enriched);
    } catch (error) {
      console.error('Error refreshing items:', error);
    }
  }, [poId, enrichItemsWithSpecs]);

  const handleItemSaved = () => {
    refreshItems();
  };

  const toggleExpand = (itemId) => {
    setExpandedItemId(prev => prev === itemId ? null : itemId);
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm('Hapus Item Produk?\n\nSemua komponen pada item ini juga akan dihapus.')) return;
    setDeletingId(item.id);
    try {
      await deletePOItem(item.id);
      toast.success('Item produk dihapus');
      refreshItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Gagal menghapus item produk');
    } finally {
      setDeletingId(null);
    }
  };

  const moveItem = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const current = items[index];
    const target = items[targetIndex];
    try {
      await swapPOItemSort(current.id, target.id);
      refreshItems();
    } catch (error) {
      console.error('Error reordering items:', error);
      toast.error('Gagal mengubah urutan item');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (!po || !meeting) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon">PO tidak ditemukan</div>
          <Link to="/ppm" className="btn-primary mt-4">Kembali</Link>
        </div>
      </div>
    );
  }

  const statusColorKey = PPM_PO_STATUS_COLORS[po.status] || 'gray';
  const statusBadgeClass = BADGE_COLOR_CLASSES[statusColorKey] || 'badge-gray';
  const statusLabel = PPM_PO_STATUS_LABELS[po.status] || po.status;

  // M2: PO-level Technical Review summary aggregate
  const poReview = items.reduce((acc, it) => {
    const p = it.reviewProgress || { total: 0, selesai: 0, discussion: 0, pending: 0 };
      acc.total += p.total; acc.selesai += p.selesai; acc.discussion += p.discussion; acc.pending += p.pending; acc.reviewableTotal += p.reviewableTotal; acc.reviewableSelesai += p.reviewableSelesai;
    return acc;
  }, { total: 0, selesai: 0, reviewableTotal: 0, reviewableSelesai: 0, discussion: 0, pending: 0 });

  // Handler to open Specification Manager for a specific component
  const openSpecManager = (component) => {
    setExpandedCompId(component.id);
    setSpecManagerComponent(component);
  };

  return (
    <div className="page-container">
      <div className="mb-6">
        <Link to={'/ppm/' + meetingId} className="btn-ghost btn-sm mb-4 inline-flex">
          <ArrowLeft size={16} />
          Meeting PPM
        </Link>
        <h1 className="page-title mb-1">{po.po_number}</h1>
        <p className="text-sm text-ink-400">{po.customer_name}</p>
        {po.project_name && <p className="text-sm text-ink-300 mt-1">{po.project_name}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={'badge ' + statusBadgeClass}>{statusLabel}</span>
          {items.length > 0 ? (
            <span className="badge badge-green">{items.length} Item Produk</span>
          ) : (
            <span className="badge badge-yellow">Setup Item Produk Belum Lengkap</span>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-ink-500 mb-1">Nomor PO</p>
            <p className="text-sm text-white font-mono">{po.po_number}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500 mb-1">Customer</p>
            <p className="text-sm text-white">{po.customer_name}</p>
          </div>
          {po.project_name && (
            <div>
              <p className="text-xs text-ink-500 mb-1">Project</p>
              <p className="text-sm text-white">{po.project_name}</p>
            </div>
          )}
          {po.deadline && (
            <div>
              <p className="text-xs text-ink-500 mb-1">Deadline</p>
              <p className="text-sm text-white">{formatDateLongID(po.deadline)}</p>
            </div>
          )}
          {po.description && (
            <div className="md:col-span-2">
              <p className="text-xs text-ink-500 mb-1">Description</p>
              <p className="text-sm text-white">{po.description}</p>
            </div>
          )}
        </div>
      </div>


      {/* ============ TECHNICAL REVIEW SUMMARY ============ */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-400" />
            <h2 className="card-title">Technical Review</h2>
          </div>
          {items.length > 0 && (
            <span className={'badge ' + BADGE_COLOR_CLASSES[(poReview.reviewableTotal && poReview.reviewableSelesai === poReview.reviewableTotal) ? 'green' : 'yellow']}>
              TOTAL {poReview.reviewableSelesai} / {poReview.reviewableTotal} selesai
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-ink-400">Belum ada item untuk technical review.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const p = it.reviewProgress || { total: 0, selesai: 0, discussion: 0, pending: 0 };
              return (
                <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 rounded-lg px-3 py-2">
                  <span className="text-sm text-white truncate">{it.item_name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-ink-300 font-mono">{p.selesai} / {p.total}</span>
                    {p.discussion > 0 && <span className="badge badge-orange">{p.discussion} perlu dibahas</span>}
                    {p.pending > 0 && <span className="badge badge-yellow">{p.pending} pending</span>}
                    {p.total === 0 && <span className="badge badge-gray">belum ada spesifikasi</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============ PRODUCT ITEM SECTION ============ */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-primary-400" />
            <h2 className="card-title">Produk dalam PO ini</h2>
          </div>
          {canManage && (
            <button
              onClick={() => { setEditingItem(null); setItemModalOpen(true); }}
              className="btn-primary"
            >
              <Plus size={16} />
              + Tambah Item Produk
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-lg">
            <p className="text-sm text-ink-400 mb-1">Belum ada Item Produk</p>
            {canManage && (
              <p className="text-xs text-ink-500 mb-3">Tambahkan item produk untuk mulai menyusun komponen</p>
            )}
            {canManage && (
              <button
                onClick={() => { setEditingItem(null); setItemModalOpen(true); }}
                className="btn-secondary btn-sm"
              >
                <Plus size={14} />Tambah Item Produk
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const isExpanded = expandedItemId === item.id;
              return (
                <div key={item.id} className="border border-white/10 rounded-lg overflow-hidden">
                  {/* Header row - clickable to expand */}
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-500/10 text-primary-400 font-bold text-sm flex-shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-white mb-1 break-words">{item.item_name}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-300">
                            {item.product_types?.name && <span>Jenis: {item.product_types.name}</span>}
                            {item.quantity != null && <span>Qty: {item.quantity} pcs</span>}
                            {item.gender_category && <span>Gender: {item.gender_category}</span>}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs text-ink-400">{item.component_count} komponen</span>
                            {item.reviewProgress && (
                              <span className="text-xs text-ink-300">
                                • Technical Review: <span className="text-primary-400 font-medium">{item.reviewProgress.reviewableSelesai || 0}/{item.reviewProgress.reviewableTotal || item.reviewProgress.total}</span> selesai
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-ink-500 mt-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-ink-400">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Action buttons row */}
                  <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
                    <button
                      onClick={() => setComponentModalItem(item)}
                      className="btn-secondary btn-sm"
                    >
                      <Settings2 size={14} />
                      Kelola Komponen
                    </button>
                    <button
                      onClick={() => setTechReviewItem(item)}
                      className="btn-secondary btn-sm"
                      title="Mulai / lanjutkan Technical Review item ini"
                    >
                      <ClipboardList size={14} />
                      Mulai Technical Review
                    </button>
                    {canManage && (
                      <>
                        <button
                          onClick={() => { setEditingItem(item); setItemModalOpen(true); }}
                          className="p-1.5 text-ink-400 hover:text-white"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          disabled={deletingId === item.id}
                          className="p-1.5 text-ink-400 hover:text-red-400 disabled:opacity-30"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0 || !canManage}
                          className="p-1.5 text-ink-400 hover:text-white disabled:opacity-30"
                          title="Naik"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => moveItem(index, 1)}
                          disabled={index === items.length - 1 || !canManage}
                          className="p-1.5 text-ink-400 hover:text-white disabled:opacity-30"
                          title="Turun"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Expandable component list */}
                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 py-3 bg-black/20">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-ink-300 uppercase tracking-wide">Komponen</h4>
                        <span className="text-xs text-ink-400">{item.component_count} komponen</span>
                      </div>
                      {item.components && item.components.length > 0 ? (
                        <div className="space-y-2">
                          {item.components.map((comp, ci) => {
                            const compExpanded = expandedCompId === comp.id;
                            const compLabel = comp.location_label
                              ? comp.component_name_snapshot + ' - ' + comp.location_label
                              : comp.component_name_snapshot;
                                                        const totalSpecs = comp.specs ? comp.specs.filter((s) => isSpecificationReviewable(s)).length : 0;
                            return (
                              <div key={comp.id} className="border border-white/10 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => { setExpandedItemId(item.id); setExpandedCompId(prev => prev === comp.id ? null : comp.id); }}
                                  className="w-full text-left px-3 py-2 hover:bg-white/[0.02] flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-ink-500 font-mono text-xs w-5 flex-shrink-0">{String(ci + 1).padStart(2, '0')}</span>
                                    <span className="text-sm text-white truncate">{compLabel}</span>
                                    {comp.is_custom && (
                                      <span className="badge badge-yellow text-[10px] px-1.5 py-0.5 flex-shrink-0">Custom</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs flex-shrink-0">
                                    {comp.specSummary && comp.specSummary.length > 0 && (
                                      <span className="text-ink-400 hidden sm:inline truncate max-w-[260px]">{comp.specSummary.join(' • ')}</span>
                                    )}
                                    <span className={'badge ' + BADGE_COLOR_CLASSES[(totalSpecs && comp.specDoneCount === totalSpecs) ? 'green' : 'gray']}>
                                      {comp.specDoneCount}/{totalSpecs}
                                    </span>
                                    {compExpanded ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}
                                  </div>
                                </button>

                                {compExpanded && (
                                  <div className="border-t border-white/10 px-3 py-3 space-y-2 bg-black/20">
                                    {comp.specs && comp.specs.length > 0 ? (
                                      comp.specs.map((spec) => (
                                        <div key={spec.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                          <div className="min-w-0">
                                                                                        <p className="text-white font-medium">{getSpecDisplayLabel(spec)}</p>
                                            {getSpecHelperText(spec) && <p className="text-xs text-ink-400">{getSpecHelperText(spec)}</p>}
                                            <p className="text-xs text-ink-400">
                                              {formatSpecValue(spec)}
                                              <span className="mx-1">•</span>
                                              Sumber: {SOURCE_TYPE_LABELS[spec.source_type] || spec.source_type}
                                            </p>
                                          </div>
                                          <span className={'badge ' + (BADGE_COLOR_CLASSES[REVIEW_STATUS_COLORS[spec.review_status]] || 'badge-gray')}>
                                            {REVIEW_STATUS_LABELS[spec.review_status]}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-xs text-ink-400">Belum ada spesifikasi. Gunakan "Kelola Spesifikasi".</p>
                                    )}
                                    <div className="pt-1">
                                      <button onClick={() => openSpecManager(comp)} className="btn-secondary btn-sm">
                                        <Settings2 size={14} /> Kelola Spesifikasi
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-ink-400">Belum ada komponen. Klik "Kelola Komponen" untuk menambahkan.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card-title mb-4">Dokumen PO</h2>
        {po.document_url ? (
          <div className="document-viewer">
            {isImageDocument(po.document_type) ? (
              <img
                src={po.document_url}
                alt={po.document_name || 'Dokumen PO'}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg border border-white/10"
              />
            ) : po.document_type === 'pdf' ? (
              <iframe
                src={po.document_url}
                title={po.document_name || 'Dokumen PDF'}
                className="w-full h-[70vh] rounded-lg border border-white/10"
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-ink-400">Tipe dokumen tidak didukung untuk preview</p>
                <a href={po.document_url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-flex">
                  Download Dokumen
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-ink-400">
            Dokumen tidak tersedia
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        meetingPoId={poId}
        profile={profile}
        item={editingItem}
        onSaved={handleItemSaved}
      />
      <ComponentManagerModal
        open={!!componentModalItem}
        onClose={() => setComponentModalItem(null)}
        item={componentModalItem}
        profile={profile}
        onSaved={handleItemSaved}
      />
      <SpecificationManagerModal
        open={!!specManagerComponent}
        onClose={() => setSpecManagerComponent(null)}
        component={specManagerComponent}
        profile={profile}
        onSaved={handleItemSaved}
      />
      <TechnicalReviewModal
        open={!!techReviewItem}
        onClose={() => setTechReviewItem(null)}
        item={techReviewItem}
        profile={profile}
        onSaved={handleItemSaved}
      />
    </div>
  );
}

// ============================================================
// M2 helper: ringkasan singkat spesifikasi sebuah komponen
// Contoh: "Regular • Tinggi 5 cm" / "Gamblok • 12 x 15 cm"
// ============================================================
function buildSpecSummary(specs) {
  // M2.1: summary hanya spesifikasi yang mempunyai nilai (jangan memenuhi UI dengan field kosong).
  const filled = (specs || []).filter((s) => hasSpecValue(s)).slice(0, 3);
  return filled.map((s) => getSpecDisplayLabel(s) + String.fromCharCode(8212) + formatSpecValue(s));
}
