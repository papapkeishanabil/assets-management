import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Settings2, Pencil, Trash2, Plus, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { formatDateLongID, PPM_PO_STATUS_LABELS, PPM_PO_STATUS_COLORS, BADGE_COLOR_CLASSES, isImageDocument } from '../lib/constants';
import ProductItemModal from '../components/ppm/ProductItemModal';
import ComponentManagerModal from '../components/ppm/ComponentManagerModal';
import {
  fetchPOItems,
  deletePOItem,
  swapPOItemSort
} from '../lib/ppm-m1-helpers';

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

  // Permission check: meeting creator or super_admin can manage items
  const canManage = role && (
    role.role_name === 'super_admin' ||
    (meeting && profile && meeting.created_by === profile.id)
  );

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
      setItems(poItems);
    } catch (error) {
      console.error('Error fetching PO:', error);
    } finally {
      setLoading(false);
    }
  }, [meetingId, poId]);

  useEffect(() => { fetchPO(); }, [fetchPO]);

  // Light refresh - update items/components without full-page loading spinner
  // Used after adding/editing/deleting components or items so the UI updates
  // instantly without a page "refresh" feel.
  const refreshItems = useCallback(async () => {
    try {
      const poItems = await fetchPOItems(poId, true);
      setItems(poItems);
    } catch (error) {
      console.error('Error refreshing items:', error);
    }
  }, [poId]);

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
                        <div className="space-y-1.5">
                          {item.components.map((comp, ci) => (
                            <div key={comp.id} className="flex items-center gap-2 text-sm">
                              <span className="text-ink-500 font-mono text-xs w-5 flex-shrink-0">{String(ci + 1).padStart(2, '0')}</span>
                              <span className="text-white truncate">{comp.component_name_snapshot}</span>
                              {comp.is_custom && (
                                <span className="badge badge-yellow text-[10px] px-1.5 py-0.5 flex-shrink-0">Custom</span>
                              )}
                              {comp.location_label && (
                                <span className="text-ink-400 text-xs truncate">- {comp.location_label}</span>
                              )}
                            </div>
                          ))}
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
    </div>
  );
}