import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
<<<<<<< HEAD
import { useRolePermissions } from '../../hooks/useRolePermissions';
=======
import { supabase } from '../../lib/supabase';
>>>>>>> modul-PPM
import { ROLE_LABELS, ROLES } from '../../lib/constants';
import ThemeToggle from '../ThemeToggle';
import BrandLogo from '../BrandLogo';
import HelpModal from '../HelpModal';
import {
  Users, User, LogOut, Menu, X,
  ChevronDown, FolderTree, MapPin, Building2,
  Truck, Package, Home, Bell, Search, Settings,
<<<<<<< HEAD
  Wrench, Shield, Calendar, AlertCircle, AlertTriangle,
  HelpCircle, Smartphone, Download, BellRing, UserCheck,
  FileText, History, Lock
=======
  Wrench, Shield, Calendar, CalendarDays, AlertCircle, AlertTriangle,
  HelpCircle, Smartphone, Download, BellRing, UserCheck, ClipboardCheck, MessageSquare
>>>>>>> modul-PPM
} from 'lucide-react';

export default function MainLayout() {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [inspectionPending, setInspectionPending] = useState(0);

  const isInspectionReviewer = role && ['super_admin', 'hrd', 'direksi'].includes(role.role_name);

  useEffect(() => {
    if (!isInspectionReviewer || !profile?.id) return;
    let mounted = true;
    const load = async () => {
      try {
        const { count } = await supabase
          .from('maintenance_records')
          .select('*', { count: 'exact', head: true })
          .eq('inspection_status', 'menunggu_penilaian');
        if (mounted) setInspectionPending(count || 0);
      } catch (e) {
        console.error('Error loading inspection queue:', e);
      }
    };
    load();
    return () => { mounted = false; };
  }, [isInspectionReviewer, profile?.id]);

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setProfileOpen(false);
        setNotificationOpen(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const roleLabel = role ? ROLE_LABELS[role.role_name] || role.role_name : '-';

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    ...(role?.role_name === ROLES.SUPER_ADMIN
      ? [
          { to: '/users', icon: Users, label: 'Pengguna' },
          { to: '/roles', icon: Shield, label: 'Role & Hak Akses' },
          { to: '/roles/permissions', icon: Lock, label: 'Akses Modul per Role' },
        ]
      : []),
  ];

  const masterDataItems = [
    { to: '/categories', icon: FolderTree, label: 'Kategori Aset', roles: ['super_admin', 'hrd'] },
    { to: '/locations', icon: MapPin, label: 'Lokasi Aset', roles: ['super_admin', 'hrd'] },
    { to: '/departments', icon: Building2, label: 'Struktur Organisasi', roles: ['super_admin'] },
    { to: '/asset-responsibles', icon: UserCheck, label: 'Penanggung Jawab', roles: ['super_admin', 'hrd'] },
    { to: '/vendors', icon: Truck, label: 'Vendor', roles: ['super_admin', 'hrd'] },
  ];

  const assetItems = [
    { to: '/assets', icon: Package, label: 'Daftar Aset' },
  ];

  const maintenanceItems = [
    { to: '/maintenance/schedules', icon: Calendar, label: 'Jadwal Pemeliharaan' },
<<<<<<< HEAD
    { to: '/maintenance/executions', icon: History, label: 'Pelaksanaan Pemeliharaan' },
    { to: '/maintenance/drafts', icon: FileText, label: 'Draft Pemeliharaan', roles: ['super_admin', 'hrd'] },
=======
    { to: '/schedule-executions', icon: CalendarDays, label: 'Pelaksanaan Jadwal' },
>>>>>>> modul-PPM
    { to: '/maintenance/types', icon: FolderTree, label: 'Jenis Pemeliharaan', roles: ['super_admin', 'hrd'] },
  ];

  const { hasAccess } = useRolePermissions();
  const canAccessMasterData = role && ['super_admin', 'hrd'].includes(role.role_name);
  const canAccessMaintenance = role && ['super_admin', 'hrd', 'direksi', 'pelaksana'].includes(role.role_name);

  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  const SectionLabel = ({ children }) => (
    <div className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500 flex items-center gap-2">
      <span>{children}</span>
      <div className="flex-1 h-px bg-white/5"></div>
    </div>
  );

  const navLinkClass = ({ isActive }) =>
    `relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'nav-active-glow text-white'
        : 'text-ink-300 hover:bg-white/5 hover:text-white'
    }`;

  const subNavLinkClass = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 ml-3 border-l border-white/5 rounded-r-md text-sm transition-all ${
      isActive
        ? 'text-white bg-white/[0.06]'
        : 'text-ink-400 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-ink-950 relative">
      {/* Ambient orbs */}
      <div className="orb w-[500px] h-[500px] bg-primary-600/15 top-[-200px] left-[-150px] animate-orbit pointer-events-none fixed"></div>
      <div className="orb w-[400px] h-[400px] bg-indigo-600/10 bottom-[-100px] right-[10%] animate-orbit pointer-events-none fixed" style={{ animationDelay: '-10s' }}></div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-ink-990/85 backdrop-blur-xl border-r border-white/5
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:fixed lg:z-40
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="absolute inset-0 dot-grid-bg opacity-30 pointer-events-none"></div>

        {/* Logo */}
        <div className="relative h-20 px-4 flex items-center justify-between border-b border-white/5">
          <BrandLogo compact className="w-[185px] h-[58px]" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-ink-400 hover:text-white hover:bg-white/5 p-1.5 rounded-md transition-all"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto p-3 space-y-0.5 h-[calc(100vh-14rem)]">
          <SectionLabel>Menu</SectionLabel>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={navLinkClass}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {canAccessMasterData && (
            <>
              <SectionLabel>Master Data</SectionLabel>
              {masterDataItems.map((item) => {
                const itemRoles = item.roles || ['super_admin', 'hrd'];
                const canAccessItem = role && itemRoles.includes(role.role_name);
                if (!canAccessItem) return null;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={navLinkClass}
                  >
                    <item.icon size={16} className="flex-shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </>
          )}

          <SectionLabel>Aset</SectionLabel>
          {assetItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={navLinkClass}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}

          <SectionLabel>SDM & Kontrak</SectionLabel>
          {canAccessMasterData && (
            <NavLink
              to="/employees"
              onClick={() => setSidebarOpen(false)}
              className={navLinkClass}
            >
              <Users size={16} className="flex-shrink-0" />
              Data Karyawan
            </NavLink>
          )}
          <NavLink
            to="/contracts"
            onClick={() => setSidebarOpen(false)}
            className={navLinkClass}
          >
            <FileText size={16} className="flex-shrink-0" />
            Daftar Kontrak
          </NavLink>
          {canAccessMasterData && (
            <><NavLink
              to="/contracts/types"
              onClick={() => setSidebarOpen(false)}
              className={navLinkClass}
            >
              <FolderTree size={16} className="flex-shrink-0" />
              Jenis Kontrak
            </NavLink></>
          )}

          {canAccessMaintenance && (
            <>
              <SectionLabel>Pemeliharaan</SectionLabel>
              {maintenanceItems.map((item) => {
                const itemRoles = item.roles || ['super_admin', 'hrd', 'direksi', 'pelaksana'];
                const canAccessItem = role && itemRoles.includes(role.role_name);
                if (!canAccessItem) return null;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={navLinkClass}
                  >
                    <item.icon size={16} className="flex-shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </>
          )}
          <SectionLabel>PPM / Produksi</SectionLabel>
          <NavLink
            to="/ppm"
            onClick={() => setSidebarOpen(false)}
            className={navLinkClass}
          >
            <MessageSquare size={16} className="flex-shrink-0" />
            <span className="flex-1">Meeting PPM</span>
          </NavLink>
          <SectionLabel>Pemeriksaan</SectionLabel>
          <NavLink
            to="/inspections"
            onClick={() => setSidebarOpen(false)}
            className={navLinkClass}
          >
            <ClipboardCheck size={16} className="flex-shrink-0" />
            <span className="flex-1">Hasil Pemeriksaan</span>
            {isInspectionReviewer && inspectionPending > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-ink-950 bg-warning-400">
                {inspectionPending > 99 ? '99+' : inspectionPending}
              </span>
            )}
          </NavLink>
                  {role?.role_name === ROLES.SUPER_ADMIN && (
            <>
              <SectionLabel>Pengaturan</SectionLabel>
              <NavLink
                to="/settings"
                onClick={() => setSidebarOpen(false)}
                className={navLinkClass}
              >
                <Settings size={16} className="flex-shrink-0" />
                Instalasi Aplikasi
              </NavLink>
              <NavLink
                to="/settings/system-notification-test"
                onClick={() => setSidebarOpen(false)}
                className={navLinkClass}
              >
                <BellRing size={16} className="flex-shrink-0" />
                Tes Notifikasi Sistem
              </NavLink>
            </>
          )}</nav>

        {/* User Info */}
        <div className="relative border-t border-white/5 p-3">
          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 p-2 rounded-md hover:bg-white/5 transition-all"
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white shadow-glow-blue">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-990"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-ink-400 font-mono truncate">{roleLabel}</p>
            </div>
            <Settings size={14} className="text-ink-500" />
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64 relative">
        {/* Top Bar */}
        <header className="h-16 bg-ink-950/70 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 flex items-center px-4 lg:px-8 gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-ink-300 hover:bg-white/5 hover:text-white rounded-md transition-all"
            aria-label="Buka menu"
            aria-expanded={sidebarOpen}
            aria-controls="main-sidebar"
          >
            <Menu size={18} />
          </button>

          <div className="hidden lg:flex items-center gap-2 text-sm">
            <span className="text-ink-400 font-mono">Harmas</span>
            <span className="text-ink-600">/</span>
            <span className="font-medium text-white">Dashboard</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md ml-auto lg:ml-8">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Cari aset, kode, atau serial..."
                className="w-full pl-9 pr-12 py-1.5 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:bg-white/[0.08] focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
              />
              <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 text-[10px] text-ink-400 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 font-mono">âŒ˜K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-1.5 mr-2 px-2 py-1 rounded-md bg-success-500/10 border border-success-500/20">
              <span className="relative w-1.5 h-1.5 rounded-full bg-success-400 live-dot text-success-400"></span>
              <span className="text-[11px] font-medium text-success-300 font-mono">LIVE</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 text-ink-300 hover:bg-white/5 hover:text-white rounded-md transition-all"
                aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
                aria-expanded={notificationOpen}
              >
                <Bell size={18} className={unreadCount > 0 ? 'bell-ring text-white' : ''} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 flex items-center justify-center">
                    <span className="absolute inline-flex h-4 w-4 rounded-full bg-rose-500 opacity-60 animate-ping"></span>
                    <span className="relative inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-ink-950 shadow-glow-rose">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  </span>
                )}
              </button>

              {notificationOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 topbar-popover rounded-xl shadow-soft-lg z-50 animate-scale-in max-h-[480px] flex flex-col">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        Notifikasi
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-mono text-primary-300 bg-primary-500/10 px-1.5 py-0.5 rounded">{unreadCount} BARU</span>
                        )}
                      </h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsRead()}
                          className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors"
                        >
                          Tandai dibaca
                        </button>
                      )}
                    </div>

                    <div className="overflow-y-auto flex-1">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <Bell size={32} className="mx-auto text-ink-700 mb-3" />
                          <p className="text-sm text-ink-400">Belum ada notifikasi</p>
                        </div>
                      ) : (
                        notifications.slice(0, 8).map(n => {
                          const IconMap = {
                            Calendar, AlertCircle, AlertTriangle, Bell, FileText
                          };
                          const isContractNotif = n.notification_type?.startsWith('CONTRACT_');
                          const isDraftNotif = n.notification_type === 'DRAFT_SUBMITTED';
                          const iconName = isContractNotif ? 'FileText'
                            : isDraftNotif ? 'FileText'
                            : n.notification_type === 'REMINDER_7_DAYS' || n.notification_type === 'REMINDER_3_DAYS' || n.notification_type === 'REMINDER_1_DAY' || n.notification_type === 'REMINDER_CUSTOM' ? 'Calendar'
                            : n.notification_type === 'DUE_TODAY' ? 'AlertCircle'
                            : n.notification_type === 'OVERDUE' ? 'AlertTriangle' : 'Bell';
                          const Icon = IconMap[iconName];
                          const colorKey = isContractNotif
                            ? (n.notification_type === 'CONTRACT_DUE_TODAY' || n.notification_type === 'CONTRACT_OVERDUE' ? 'red' : 'blue')
                            : isDraftNotif ? 'yellow'
                            : n.notification_type === 'REMINDER_7_DAYS' ? 'blue'
                            : n.notification_type === 'REMINDER_3_DAYS' ? 'yellow'
                            : n.notification_type === 'REMINDER_1_DAY' ? 'orange' : n.notification_type === 'REMINDER_CUSTOM' ? 'blue' : 'red';
                          const colorMap = {
                            blue: 'text-primary-300 bg-primary-500/10 border-primary-500/20',
                            yellow: 'text-warning-300 bg-warning-500/10 border-warning-500/20',
                            orange: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
                            red: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
                            gray: 'text-ink-300 bg-white/5 border-white/10',
                          };
                          return (
                            <div
                              key={n.id}
                              className={`px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-all border-b border-white/5 ${
                                !n.is_read ? 'bg-primary-500/[0.04]' : ''
                              }`}
                              onClick={() => {
                                markAsRead(n.id);
                                setNotificationOpen(false);
                                if (n.reference_url) navigate(n.reference_url);
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-1.5 rounded-md border flex-shrink-0 ${colorMap[colorKey]}`}>
                                  <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white line-clamp-1">{n.title}</p>
                                  <p className="text-xs text-ink-400 mt-0.5 line-clamp-2">{n.message}</p>
                                  <p className="text-[11px] text-ink-500 mt-1 font-mono">
                                    {new Date(n.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                  </p>
                                </div>
                                {!n.is_read && (
                                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full flex-shrink-0 mt-1.5 shadow-[0_0_6px_rgba(59,130,246,0.6)]"></div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {notifications.length > 8 && (
                      <div className="px-4 py-2.5 border-t border-white/5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setNotificationOpen(false);
                            navigate('/notifications');
                          }}
                          className="w-full text-center text-xs text-primary-400 hover:text-primary-300 font-medium py-1 transition-colors"
                        >
                          Lihat semua ({notifications.length})
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setHelpOpen(true)}
              className="p-2 text-ink-300 hover:bg-white/5 hover:text-white rounded-md transition-all"
              aria-label="Bantuan"
              aria-haspopup="dialog"
            >
              <HelpCircle size={18} />
            </button>

            <ThemeToggle />

            <div className="w-px h-6 bg-white/10 mx-1.5"></div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 hover:bg-white/5 rounded-md transition-all"
                aria-label="Menu profil"
                aria-expanded={profileOpen}
              >
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
                    {initials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-950"></div>
                </div>
                <ChevronDown size={12} className="text-ink-400 hidden md:block" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 topbar-popover rounded-xl shadow-soft-lg z-50 py-2 animate-scale-in">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-semibold text-white truncate leading-5">{profile?.full_name}</p>
                      <p className="text-xs text-ink-400 mt-1 truncate font-mono leading-4">{profile?.email}</p>
                      <div className="mt-2 inline-flex max-w-full items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium bg-primary-500/10 text-primary-300 border border-primary-500/20">
                        <Shield size={10} />
                        <span className="truncate">{roleLabel}</span>
                      </div>
                    </div>
                    <div className="py-1">
                      <NavLink
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-200 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <User size={14} className="text-ink-400" />
                        Profil Saya
                      </NavLink>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut size={14} />
                        Keluar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8 max-w-[1600px] mx-auto animate-fade-in relative">
          <Outlet />
        </main>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
