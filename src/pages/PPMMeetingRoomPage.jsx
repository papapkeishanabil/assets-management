import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMeetingFocus } from '../contexts/MeetingFocusContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Clock, Users, Copy, MessageCircle, Eye, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import { formatDateLongID, PPM_MEETING_STATUS, PPM_MEETING_STATUS_LABELS, PPM_MEETING_STATUS_COLORS, PPM_PO_STATUS_LABELS, PPM_PO_STATUS_COLORS, BADGE_COLOR_CLASSES } from '../lib/constants';

export default function PPMMeetingRoomPage() {
  const { meetingId } = useParams();
  const { profile, role } = useAuth();
  const { setMeetingFocus } = useMeetingFocus();
  const [meeting, setMeeting] = useState(null);
  const [poList, setPOList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingMeeting, setUpdatingMeeting] = useState(false);

  const canManage = role && (
    role.role_name === 'super_admin' ||
    (meeting && profile && meeting.created_by === profile.id)
  );

  const statusBadge = (status, type) => {
    const labels = type === 'meeting' ? PPM_MEETING_STATUS_LABELS : PPM_PO_STATUS_LABELS;
    const colors = type === 'meeting' ? PPM_MEETING_STATUS_COLORS : PPM_PO_STATUS_COLORS;
    const colorKey = colors[status] || 'gray';
    const badgeClass = BADGE_COLOR_CLASSES[colorKey] || 'badge-gray';
    return <span className={'badge ' + badgeClass}>{labels[status] || status}</span>;
  };

  const fetchMeeting = async () => {
    setLoading(true);
    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from('ppm_meetings')
        .select('*')
        .eq('id', meetingId)
        .single();
      if (meetingError) throw meetingError;
      setMeeting(meetingData);

      const { data: pos, error: poError } = await supabase
        .from('ppm_meeting_pos')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('sort_order');
      if (poError) throw poError;
      setPOList(pos || []);
    } catch (error) {
      console.error('Error fetching meeting:', error);
      toast.error('Gagal memuat data meeting');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMeeting(); }, [meetingId]);

  // Meeting Focus Mode: sidebar otomatis hidden saat status IN_PROGRESS,
  // kembali normal saat status berubah (COMPLETED / SCHEDULED / CANCELLED).
  useEffect(() => {
    if (meeting) setMeetingFocus(meeting.id, meeting.status);
  }, [meeting && meeting.id, meeting && meeting.status, setMeetingFocus]);

  const copyLink = () => {
    const url = window.location.origin + '/ppm/' + meetingId;
    navigator.clipboard.writeText(url);
    toast.success('Link meeting berhasil disalin');
  };

    const shareWhatsApp = () => {
    const url = window.location.origin + '/ppm/' + meetingId;
    const dateStr = meeting?.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';
    const poCount = poList.length;
    const message = 'PPM - Meeting Production Order\n' + dateStr + '\n' + poCount + ' Production Order\n\nBuka Meeting:\n' + url;
    window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
  };

  // Mulai / Selesaikan / Buka Kembali meeting (RLS di backend memvalidasi
  // bahwa user adalah creator atau super_admin). Focus Mode otomatis
  // mengikuti perubahan status via setMeetingFocus.
  const updateMeetingStatus = async (status) => {
    if (!meeting) return;
    setUpdatingMeeting(true);
    try {
      const { error } = await supabase
        .from('ppm_meetings')
        .update({ status })
        .eq('id', meeting.id);
      if (error) throw error;
      toast.success(
        status === PPM_MEETING_STATUS.IN_PROGRESS
          ? 'Meeting dimulai — Focus Mode aktif'
          : 'Meeting selesai'
      );
      await fetchMeeting();
    } catch (error) {
      console.error('Error updating meeting status:', error);
      toast.error('Gagal mengubah status meeting');
    } finally {
      setUpdatingMeeting(false);
    }
  };

  const handleFinishMeeting = async () => {
    if (!window.confirm('Selesaikan meeting ini? Status meeting akan menjadi Selesai.')) return;
    await updateMeetingStatus(PPM_MEETING_STATUS.COMPLETED);
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

  if (!meeting) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={48} /></div>
          <h3 className="empty-state-title">Meeting tidak ditemukan</h3>
          <Link to="/ppm" className="btn-primary mt-4">Kembali ke Daftar Meeting</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/ppm" className="btn-ghost btn-sm"><ArrowLeft size={16} /></Link>
            <div>
              <h1 className="page-title mb-1">Meeting Production Order</h1>
              <p className="text-sm text-ink-400">{formatDateLongID(meeting.meeting_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-ink-400">{poList.length} Production Order</span>
            {statusBadge(meeting.status, 'meeting')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && meeting.status === PPM_MEETING_STATUS.SCHEDULED && (
            <button
              onClick={() => updateMeetingStatus(PPM_MEETING_STATUS.IN_PROGRESS)}
              disabled={updatingMeeting}
              className="btn-success"
              title="Mulai meeting — sidebar otomatis disembunyikan (Focus Mode)"
            >
              <Play size={16} />
              Mulai Meeting
            </button>
          )}
          {canManage && meeting.status === PPM_MEETING_STATUS.IN_PROGRESS && (
            <button
              onClick={handleFinishMeeting}
              disabled={updatingMeeting}
              className="btn-primary"
              title="Akhiri meeting — sidebar kembali normal"
            >
              <CheckCircle2 size={16} />
              Selesaikan Meeting
            </button>
          )}
          {canManage && meeting.status === PPM_MEETING_STATUS.COMPLETED && (
            <button
              onClick={() => updateMeetingStatus(PPM_MEETING_STATUS.IN_PROGRESS)}
              disabled={updatingMeeting}
              className="btn-secondary"
              title="Buka kembali meeting yang sudah selesai"
            >
              <RotateCcw size={16} />
              Buka Kembali
            </button>
          )}
          <button onClick={copyLink} className="btn-secondary"><Copy size={16} />Salin Link Meeting</button>
          <button onClick={shareWhatsApp} className="btn-success"><MessageCircle size={16} />Bagikan WhatsApp</button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-ink-500 mb-1">Meeting ID</p>
            <p className="text-sm font-mono text-white">{meeting.meeting_code}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500 mb-1">Tanggal</p>
            <p className="text-sm text-white">{formatDateLongID(meeting.meeting_date)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500 mb-1">Waktu</p>
            <p className="text-sm text-white">{meeting.meeting_time || '-'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {poList.map((po, index) => (
          <div key={po.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-500/10 text-primary-400 font-bold text-sm">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{po.po_number}</h3>
                  <p className="text-sm text-ink-300 mb-2">{po.customer_name}</p>
                  {po.project_name && <p className="text-sm text-ink-400">{po.project_name}</p>}
                  <div className="mt-2">{statusBadge(po.status, 'po')}</div>
                </div>
              </div>
              <Link to={'/ppm/' + meetingId + '/po/' + po.id} className="btn-primary">
                <Eye size={16} />
                Buka PO
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
