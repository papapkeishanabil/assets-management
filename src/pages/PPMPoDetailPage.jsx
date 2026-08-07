import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { formatDateLongID, PPM_PO_STATUS_LABELS, PPM_PO_STATUS_COLORS, BADGE_COLOR_CLASSES, isImageDocument } from '../lib/constants';

export default function PPMPoDetailPage() {
  const { meetingId, poId } = useParams();
  const [po, setPO] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPO = async () => {
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
    } catch (error) {
      console.error('Error fetching PO:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPO(); }, [meetingId, poId]);

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
        <div className="mt-2">
          <span className={'badge ' + statusBadgeClass}>{statusLabel}</span>
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
    </div>
  );
}