import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Search, Calendar, Users, Eye, Copy } from 'lucide-react';
import {
  formatDate,
  PPM_MEETING_STATUS,
  PPM_MEETING_STATUS_LABELS,
  PPM_MEETING_STATUS_COLORS,
  BADGE_COLOR_CLASSES
} from '../lib/constants';

export default function PPMMeetingsPage() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canCreate = role && ['super_admin', 'hrd', 'direksi'].includes(role.role_name);

  const statusBadge = (status) => {
    const colorKey = PPM_MEETING_STATUS_COLORS[status] || 'gray';
    const badgeClass = BADGE_COLOR_CLASSES[colorKey] || 'badge-gray';
    return (
      <span className={`badge ${badgeClass}`}>
        {PPM_MEETING_STATUS_LABELS[status] || status}
      </span>
    );
  };

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ppm_meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all((data || []).map(async (meeting) => {
        let createdByName = '-';
        if (meeting.created_by) {
          const { data: creator } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', meeting.created_by)
            .single();
          if (creator) createdByName = creator.full_name;
        }

        const { count } = await supabase
          .from('ppm_meeting_pos')
          .select('*', { count: 'exact', head: true })
          .eq('meeting_id', meeting.id);

        return { ...meeting, created_by_name: createdByName, po_count: count || 0 };
      }));
      setMeetings(enriched);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Gagal memuat daftar meeting');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleCreateMeeting = () => {
    navigate('/ppm/create');
  };

  const copyMeetingLink = (meetingId) => {
    const url = `${window.location.origin}/ppm/${meetingId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link meeting berhasil disalin');
  };

  const shareToWhatsApp = (meeting) => {
    const url = `${window.location.origin}/ppm/${meeting.id}`;
    const dateStr = meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }) : '-';
    const poCount = meeting.po_count || 0;
    const message = "PPM - Meeting Production Order\n" + dateStr + "\n" + poCount + " Production Order\n\nBuka Meeting:\n" + url;
    const encodedMessage = encodeURIComponent(message);
    window.open("https://wa.me/?text=" + encodedMessage, '_blank', 'noopener,noreferrer');
  };

  if (!canCreate) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={48} /></div>
          <h3 className="empty-state-title">Akses Ditolak</h3>
          <p className="empty-state-text">Anda tidak memiliki permission untuk mengakses modul PPM.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title mb-1">Pre-Production Meeting</h1>
          <p className="text-sm text-ink-400">
            Kelola meeting dan pembahasan spesifikasi Production Order.
          </p>
        </div>
        <button onClick={handleCreateMeeting} className="btn-primary">
          <Plus size={16} />
          + Buat Meeting
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="text"
            placeholder="Cari meeting..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
        ) : meetings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Calendar size={48} /></div>
            <h3 className="empty-state-title">Belum ada Meeting PPM</h3>
            <p className="empty-state-text">Jadwalkan meeting Production Order pertama.</p>
            <button onClick={handleCreateMeeting} className="btn-primary mt-4">
              <Plus size={16} />
              + Buat Meeting
            </button>
          </div>
        ) : (
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Meeting ID</th>
                  <th>Judul</th>
                  <th>Tanggal</th>
                  <th>Waktu</th>
                  <th>Jumlah PO</th>
                  <th>Status</th>
                  <th>Dibuat oleh</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => (
                  <tr key={meeting.id}>
                    <td className="font-mono text-xs text-ink-400">{meeting.meeting_code}</td>
                    <td className="font-medium text-white">{meeting.title || '-'}</td>
                    <td>{meeting.meeting_date ? formatDate(meeting.meeting_date) : '-'}</td>
                    <td>{meeting.meeting_time ? meeting.meeting_time.substring(0, 5) : '-'}</td>
                    <td>
                      <span className="flex items-center gap-1">
                        <Users size={14} className="text-ink-500" />
                        {meeting.po_count || '-'}
                      </span>
                    </td>
                    <td>{statusBadge(meeting.status)}</td>
                    <td className="text-sm text-ink-300">{meeting.created_by_name || '-'}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyMeetingLink(meeting.id); }}
                          className="btn-ghost btn-sm"
                          title="Salin link meeting"
                        >
                          <Copy size={14} />
                        </button>
                        <Link
                          to={`/ppm/${meeting.id}`}
                          className="btn-secondary btn-sm"
                          title="Buka meeting"
                        >
                          <Eye size={14} />
                          Buka Meeting
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
