import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import {
  Package, AlertTriangle, CheckCircle, Wrench,
  ArrowRight, Calendar, ExternalLink, TrendingUp, X
} from 'lucide-react';

// Sapaan dinamis berdasarkan waktu lokal browser
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'Selamat Pagi';
  if (hour >= 11 && hour < 15) return 'Selamat Siang';
  if (hour >= 15 && hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    total: 0, active: 0, inactive: 0, overdue: 0
  });
  const [recentAssets, setRecentAssets] = useState([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { notifications, unreadCount, runReminderCheck, markAsRead } = useNotifications();
  const [showPopup, setShowPopup] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    runReminderCheck();
  }, []);

  useEffect(() => {
    if (notifications.length === 0) return;
    const dismissed = sessionStorage.getItem('dashboard_popup_dismissed');
    if (dismissed) return;

    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;

    const priority = unread.find(n => n.notification_type === 'OVERDUE') ||
                     unread.find(n => n.notification_type === 'DUE_TODAY') ||
                     unread.find(n => n.notification_type === 'REMINDER_1_DAY') ||
                     unread[0];
    setShowPopup(priority);
    sessionStorage.setItem('dashboard_popup_dismissed', '1');
  }, [notifications]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const [
        totalRes,
        activeRes,
        overdueRes,
        recentRes,
        upcomingRes,
        categoriesRes,
        assetsRes
      ] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }),
        supabase.from('assets').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('maintenance_schedules')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .lt('next_maintenance_date', today),
        supabase.from('assets')
          .select('id, asset_code, asset_name, brand, is_active, category_id')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('maintenance_schedules')
          .select(`
            id, next_maintenance_date,
            asset:assets!inner(id, asset_code, asset_name, is_active),
            maintenance_type:maintenance_types!left(maintenance_name)
          `)
          .eq('is_active', true)
          .eq('asset.is_active', true)
          .gte('next_maintenance_date', today)
          .lte('next_maintenance_date', nextWeekStr)
          .order('next_maintenance_date', { ascending: true })
          .limit(5),
        supabase.from('asset_categories').select('id, category_name').eq('is_active', true),
        supabase.from('assets').select('category_id').eq('is_active', true)
      ]);

      const totalNum = totalRes.count || 0;
      const activeNum = activeRes.count || 0;

      setStats({
        total: totalNum,
        active: activeNum,
        inactive: totalNum - activeNum,
        overdue: overdueRes.count || 0
      });
      setRecentAssets(recentRes.data || []);
      setUpcomingSchedules(upcomingRes.data || []);

      const catNameMap = {};
      (categoriesRes.data || []).forEach(c => {
        catNameMap[c.id] = c.category_name;
      });
      const catCountMap = {};
      (assetsRes.data || []).forEach(a => {
        if (!a.category_id) {
          catCountMap['Lainnya'] = (catCountMap['Lainnya'] || 0) + 1;
          return;
        }
        const name = catNameMap[a.category_id] || 'Lainnya';
        catCountMap[name] = (catCountMap[name] || 0) + 1;
      });
      setCategoryStats(
        Object.entries(catCountMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activePercent = stats.total > 0 ? Math.round((stats.active / stats.total) * 1000) / 10 : 0;
  // Sapaan mengikuti waktu, lalu nama lengkap (termasuk gelar, mis. "Bu Widi").
  const greeting = getGreeting();
  const displayName = profile?.full_name?.trim() || 'User';

  const statCards = [
    {
      label: 'Total Aset',
      value: stats.total,
      sub: `${stats.inactive} nonaktif`,
      icon: Package,
      orbColor: 'bg-primary-500/15',
      iconBg: 'bg-primary-500/10 border-primary-500/20 text-primary-400',
      sparkline: 'primary',
      trend: '+5%',
      trendColor: 'text-success-300 bg-success-500/10'
    },
    {
      label: 'Aset Aktif',
      value: stats.active,
      sub: `${activePercent}% dari total`,
      icon: CheckCircle,
      orbColor: 'bg-success-500/15',
      iconBg: 'bg-success-500/10 border-success-500/20 text-success-400',
      progressValue: activePercent,
      progressColor: 'from-success-500 to-success-400',
      progressGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]'
    },
    {
      label: 'Jadwal Terlambat',
      value: stats.overdue,
      sub: stats.overdue > 0 ? 'Perlu tindakan' : 'Aman',
      icon: AlertTriangle,
      orbColor: 'bg-rose-500/15',
      iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      urgent: stats.overdue > 0,
      pulse: stats.overdue > 0
    },
    {
      label: 'Aset Nonaktif',
      value: stats.inactive,
      sub: `${stats.total} total aset`,
      icon: Wrench,
      orbColor: 'bg-amber-500/15',
      iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    }
  ];

  const catColors = ['bg-primary-500', 'bg-primary-400', 'bg-primary-300', 'bg-indigo-400', 'bg-ink-500'];
  const totalCats = categoryStats.reduce((sum, [, count]) => sum + count, 0) || 1;

  const dismissPopup = () => {
    setShowPopup(null);
    sessionStorage.setItem('dashboard_popup_dismissed', '1');
  };

  return (
    <div className="space-y-6 lg:space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-medium text-primary-400 uppercase tracking-wider">Dashboard</span>
            <span className="text-ink-600">·</span>
            <span className="text-xs text-ink-400 font-mono">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
            {greeting}, <span className="shimmer-text">{displayName}</span>
          </h1>
          <p className="text-sm text-ink-400 mt-1">Overview real-time aset dan pemeliharaan perusahaan</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/assets/new"
            className="btn-secondary"
          >
            <Package size={14} />
            Tambah Aset
          </Link>
          <Link
            to="/maintenance/schedules"
            className="btn-primary"
          >
            <Calendar size={14} />
            Jadwal
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className="glass glass-hover spotlight rounded-xl p-5 relative overflow-hidden">
            <div className={`orb w-32 h-32 ${stat.orbColor} top-0 right-0 ${stat.pulse ? 'animate-pulse-slow' : ''}`}></div>
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${stat.iconBg}`}>
                  <stat.icon size={16} />
                </div>
                {stat.trend && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded font-mono ${stat.trendColor}`}>
                    <TrendingUp size={10} />
                    {stat.trend}
                  </span>
                )}
                {stat.urgent && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded font-mono">
                    <span className="w-1 h-1 rounded-full bg-rose-400 live-dot text-rose-400"></span>
                    URGENT
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-1">{stat.label}</div>
              {loading ? (
                <div className="h-9 w-20 bg-white/5 rounded animate-pulse"></div>
              ) : (
                <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">
                  {stat.value.toLocaleString('id-ID')}
                </div>
              )}
              <div className="text-xs text-ink-500 mt-1 font-mono">{stat.sub}</div>

              {stat.sparkline === 'primary' && (
                <div className="flex items-end gap-0.5 mt-3 h-6">
                  {[40, 55, 45, 65, 60, 75, 70, 85, 80, 100, 95].map((h, i) => (
                    <div
                      key={i}
                      className={`w-1 ${i === 10 ? 'bg-primary-300 shadow-[0_0_6px_rgba(59,130,246,0.6)]' : i > 7 ? 'bg-primary-400' : 'bg-primary-500/60'} rounded-sm`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              )}
              {stat.progressValue !== undefined && (
                <div className="mt-3">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${stat.progressColor} rounded-full ${stat.progressGlow} transition-all duration-700`}
                      style={{ width: `${stat.progressValue}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Assets Table */}
        <div className="lg:col-span-2 glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Aset Terbaru
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-300 bg-primary-500/10 px-1.5 py-0.5 rounded font-mono border border-primary-500/20">
                  <span className="w-1 h-1 rounded-full bg-primary-400 live-dot text-primary-400"></span>
                  REAL-TIME
                </span>
              </h2>
              <p className="text-xs text-ink-400 mt-0.5">5 aset terakhir ditambahkan</p>
            </div>
            <Link to="/assets" className="inline-flex items-center gap-1 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors">
              Lihat semua
              <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-white/5 rounded-md"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/5 rounded w-3/4"></div>
                    <div className="h-2 bg-white/[0.03] rounded w-1/2"></div>
                  </div>
                  <div className="h-5 w-16 bg-white/5 rounded-full"></div>
                </div>
              ))}
            </div>
          ) : recentAssets.length === 0 ? (
            <div className="text-center py-12">
              <Package size={40} className="mx-auto mb-3 text-ink-700" />
              <p className="text-sm text-ink-400 mb-4">Belum ada aset tercatat</p>
              <Link to="/assets/new" className="btn-primary btn-sm">
                <Package size={12} />
                Tambah aset pertama
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Kode</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Nama Aset</th>
                  <th className="hidden md:table-cell text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Brand</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>
                    <td className="px-5 py-3 font-mono text-xs text-ink-300">{asset.asset_code}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-white">{asset.asset_name}</div>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3 text-ink-300 font-mono text-xs">{asset.brand || '—'}</td>
                    <td className="px-5 py-3">
                      {asset.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-success-500/10 text-success-300 border border-success-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-success-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span>
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-ink-400 border border-white/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-500"></span>
                          Nonaktif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Upcoming schedules */}
          <div className="glass rounded-xl p-5 relative overflow-hidden">
            <div className="orb w-32 h-32 bg-indigo-500/10 top-0 right-0"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Jadwal Mendekati</h2>
                <span className="text-xs text-ink-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">7 HARI</span>
              </div>
              {upcomingSchedules.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar size={28} className="mx-auto mb-2 text-ink-700" />
                  <p className="text-xs text-ink-400">Tidak ada jadwal mendesak</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingSchedules.map((s) => {
                    const d = new Date(s.next_maintenance_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
                    const isToday = diff === 0;
                    const isOverdue = diff < 0;
                    const tone = isOverdue ? 'rose' : isToday ? 'amber' : diff <= 2 ? 'amber' : 'neutral';
                    const toneMap = {
                      rose: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
                      amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
                      neutral: 'bg-white/5 border-white/10 text-ink-200'
                    };
                    return (
                      <Link
                        key={s.id}
                        to={`/maintenance/schedules/${s.id}`}
                        className="flex items-start gap-3 -mx-2 p-2 rounded-md hover:bg-white/5 transition-all group"
                      >
                        <div className={`flex-shrink-0 w-10 h-10 border rounded-md flex flex-col items-center justify-center ${toneMap[tone]}`}>
                          <div className="text-[10px] font-medium leading-none uppercase font-mono">
                            {d.toLocaleDateString('id-ID', { month: 'short' })}
                          </div>
                          <div className="text-sm font-bold tabular-nums leading-none mt-0.5">{d.getDate()}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate group-hover:text-primary-300 transition-colors">
                            {s.maintenance_type?.maintenance_name || 'Pemeliharaan'}
                          </div>
                          <div className="text-xs text-ink-400 mt-0.5 truncate font-mono">
                            {s.asset?.asset_code} · {s.asset?.asset_name}
                          </div>
                          <div className="text-[11px] text-ink-500 mt-0.5 font-mono">
                            {isToday ? 'Hari ini' : isOverdue ? `Terlambat ${Math.abs(diff)} hari` : `${diff} hari lagi`}
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-ink-600 group-hover:text-primary-400 transition-colors flex-shrink-0 mt-1" />
                      </Link>
                    );
                  })}
                </div>
              )}
              <Link
                to="/maintenance/schedules"
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-primary-300 hover:text-primary-200 bg-primary-500/10 hover:bg-primary-500/15 border border-primary-500/20 rounded-md transition-all"
              >
                Lihat semua jadwal
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {/* Distribution */}
          {categoryStats.length > 0 && (
            <div className="glass rounded-xl p-5 relative overflow-hidden">
              <div className="orb w-32 h-32 bg-primary-500/10 bottom-0 left-0"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">Distribusi Kategori</h2>
                  <span className="text-xs text-ink-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">{stats.active} AKTIF</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-0.5">
                  {categoryStats.map(([, count], idx) => (
                    <div
                      key={idx}
                      className={catColors[idx]}
                      style={{ width: `${(count / totalCats) * 100}%` }}
                      title={`${count} aset`}
                    ></div>
                  ))}
                </div>
                <div className="space-y-2.5">
                  {categoryStats.map(([name, count], idx) => (
                    <div key={name} className="flex items-center gap-3 text-sm">
                      <div className={`w-1.5 h-1.5 rounded-full ${catColors[idx]} ${idx === 0 ? 'shadow-[0_0_6px_rgba(59,130,246,0.6)]' : ''}`}></div>
                      <span className="flex-1 text-ink-200 truncate">{name}</span>
                      <span className="font-mono text-ink-400 text-xs">{((count / totalCats) * 100).toFixed(1)}%</span>
                      <span className="font-medium text-white tabular-nums w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Popup */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="glass rounded-xl shadow-soft-lg max-w-md w-full p-6 animate-scale-in relative">
            <button
              onClick={dismissPopup}
              className="absolute top-3 right-3 p-1.5 text-ink-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg flex-shrink-0 ${
                showPopup.notification_type === 'OVERDUE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                showPopup.notification_type === 'DUE_TODAY' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-primary-500/10 text-primary-400 border border-primary-500/20'
              }`}>
                {showPopup.notification_type === 'OVERDUE' ? <AlertTriangle size={20} /> :
                 showPopup.notification_type === 'DUE_TODAY' ? <AlertTriangle size={20} /> :
                 <Calendar size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white mb-1.5">{showPopup.title}</h3>
                <p className="text-sm text-ink-300 mb-3 leading-relaxed">{showPopup.message}</p>
                {showPopup.maintenance_schedule?.asset && (
                  <div className="text-xs text-ink-400 mb-3 font-mono bg-white/[0.03] px-2.5 py-1.5 rounded-md border border-white/5">
                    {showPopup.maintenance_schedule.asset.asset_code} · {showPopup.maintenance_schedule.asset.asset_name}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-white/5">
              <button
                onClick={() => { markAsRead(showPopup.id); dismissPopup(); }}
                className="btn-ghost btn-sm"
              >
                Tandai dibaca
              </button>
              {showPopup.reference_url && (
                <button
                  onClick={() => {
                    markAsRead(showPopup.id);
                    dismissPopup();
                    navigate(showPopup.reference_url);
                  }}
                  className="btn-primary btn-sm"
                >
                  Lihat jadwal
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
