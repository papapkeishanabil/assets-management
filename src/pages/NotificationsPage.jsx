import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, CheckCheck, Filter, X, Calendar, AlertCircle, AlertTriangle, ExternalLink, FileText, ClipboardList, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '../lib/constants';
import {
  getNotificationFilterLabel,
  getNotificationIcon,
  getNotificationColor,
  isUpcomingNotification,
  isDueNotification,
  isOverdueNotification,
  formatRelativeDate
} from '../lib/notification-helpers';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const FILTER_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'unread', label: 'Belum Dibaca' },
  { value: 'read', label: 'Sudah Dibaca' },
  { value: 'upcoming', label: 'Mendatang' },
  { value: 'due', label: 'Jatuh Tempo' },
  { value: 'overdue', label: 'Terlambat' },
  { value: 'drafts', label: 'Draft' }
];

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (profile?.id) fetchNotifications();
  }, [profile]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          maintenance_schedule:maintenance_schedules!left(
            id,
            asset:assets!left(id, asset_code, asset_name),
            maintenance_type:maintenance_types!left(id, maintenance_code, maintenance_name)
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Gagal memuat notifikasi');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', profile.id);

      if (error) throw error;
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
    } catch (error) {
      toast.error(error.message);
    }
  };

  const markAllRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      toast.success('Semua notifikasi ditandai sudah dibaca');
      fetchNotifications();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification.id);
    if (notification.reference_url) {
      navigate(notification.reference_url);
    }
  };

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      switch (filter) {
        case 'unread':
          return !n.is_read;
        case 'read':
          return n.is_read;
        case 'upcoming':
          return isUpcomingNotification(n.notification_type);
        case 'due':
          return isDueNotification(n.notification_type);
        case 'overdue':
          return isOverdueNotification(n.notification_type);
        case 'drafts':
          return n.notification_type === 'DRAFT_SUBMITTED';
        default:
          return true;
      }
    });
  }, [notifications, filter]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Notifikasi</h1>
          <p className="text-sm text-ink-400 mt-1">Pusat notifikasi dan pemberitahuan</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-sm">
              <CheckCheck size={16} />
              Tandai Dibaca ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === opt.value
                  ? 'bg-gradient-to-br from-primary-500 to-indigo-600 shadow-glow-blue text-white'
                  : 'bg-white/5 text-ink-200 hover:bg-white/10 border border-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-ink-400">
        Menampilkan {filteredNotifications.length} notifikasi
        {filter !== 'all' && ` (filter: ${getNotificationFilterLabel(filter)})`}
      </div>

      {/* Notifications list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon"><Bell size={48} /></div>
            <h3 className="empty-state-title">Belum ada notifikasi</h3>
            <p className="empty-state-text">
              {filter === 'all'
                ? 'Tidak ada notifikasi saat ini'
                : `Tidak ada notifikasi pada filter "${getNotificationFilterLabel(filter)}"`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredNotifications.map(n => {
              const IconName = getNotificationIcon(n.notification_type);
              const IconMap = {
                Calendar: Calendar,
                AlertCircle: AlertCircle,
                AlertTriangle: AlertTriangle,
                Bell: Bell,
                FileText: FileText,
                ClipboardList: ClipboardList,
                CheckCircle2: CheckCircle2
              };
              const Icon = IconMap[IconName] || Bell;
              const color = getNotificationColor(n.notification_type);
              const colorClasses = {
                blue: 'text-primary-300 bg-primary-500/10 border border-primary-500/20',
                yellow: 'text-warning-300 bg-warning-500/10 border border-warning-500/20',
                orange: 'text-orange-300 bg-orange-500/10 border border-orange-500/20',
                red: 'text-danger-300 bg-danger-500/10 border border-danger-500/20',
                gray: 'text-ink-300 bg-white/5 border border-white/10'
              };

              return (
                <div
                  key={n.id}
                  className={`p-4 cursor-pointer transition-all hover:bg-white/5 ${
                    !n.is_read ? 'border-l-4 border-l-primary-500 bg-primary-500/[0.05]' : ''
                  }`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colorClasses[color] || colorClasses.gray} flex-shrink-0`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-white">{n.title}</p>
                        <span className="text-xs text-ink-500 whitespace-nowrap">
                          {formatRelativeDate(n.created_at)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-sm text-ink-300 mt-1 line-clamp-2">{n.message}</p>
                      )}
                      {n.maintenance_schedule?.asset && (
                        <p className="text-xs text-ink-400 mt-1">
                          Aset: <span className="font-mono">{n.maintenance_schedule.asset.asset_code}</span> - {n.maintenance_schedule.asset.asset_name}
                        </p>
                      )}
                      {n.maintenance_schedule?.maintenance_type && (
                        <p className="text-xs text-ink-400">
                          Jenis: {n.maintenance_schedule.maintenance_type.maintenance_name}
                        </p>
                      )}
                      <p className="text-xs text-ink-500 mt-2">
                        {formatDateTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1"></div>
                    )}
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
