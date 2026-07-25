import { useState, useEffect } from 'react';
import { usePWA } from '../hooks/usePWA';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../lib/constants';
import { Bell, BellOff, BellRing, CheckCircle2, XCircle, AlertTriangle, Shield, RefreshCw, Info, Send } from 'lucide-react';

function StatusRow({ label, status, detail }) {
  const configs = {
    success: { icon: CheckCircle2, text: 'text-success-400' },
    warning: { icon: AlertTriangle, text: 'text-warning-400' },
    error: { icon: XCircle, text: 'text-danger-400' },
    info: { icon: Info, text: 'text-primary-400' }
  };
  const cfg = configs[status] || configs.info;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-ink-300">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-ink-500 font-mono">{detail}</span>}
        <Icon size={16} className={cfg.text} />
      </div>
    </div>
  );
}

export default function SystemNotificationTestPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const push = usePushNotifications();

  const h = usePWA();
  const registration = h.registration;
  const isStandalone = h.isStandalone;
  const isInstalled = h.isInstalled;
  const isInstallable = h.isInstallable;
  const swStatus = h.swStatus;
  const notificationPermission = h.notificationPermission;
  const requestNotificationPermission = h.requestNotificationPermission;
  const sendTestNotification = h.sendTestNotification;
  const verifyNotification = h.verifyNotification;

  const [lastCheck] = useState(new Date().toISOString());
  const [testResult, setTestResult] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [error, setError] = useState(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [tabFocused, setTabFocused] = useState(typeof document !== 'undefined' ? document.hasFocus() : true);

  useEffect(() => {
    const update = () => setTabFocused(document.hasFocus());
    update();
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const [checklist, setChecklist] = useState(() => {
    try {
      const saved = localStorage.getItem('harmas-notification-checklist');
      return saved ? JSON.parse(saved) : [
        { id: 1, label: 'Aplikasi berjalan melalui HTTPS atau localhost.', status: 'untested' },
        { id: 2, label: 'Service worker aktif.', status: 'untested' },
        { id: 3, label: 'Permission notifikasi diberikan.', status: 'untested' },
        { id: 4, label: 'Tombol tes ditekan.', status: 'untested' },
        { id: 5, label: 'getNotifications() menemukan notifikasi.', status: 'untested' },
        { id: 6, label: 'Banner terlihat pada layar perangkat.', status: 'untested' },
        { id: 7, label: 'Notifikasi masuk ke Notification Center.', status: 'untested' },
        { id: 8, label: 'Klik notifikasi membuka aplikasi.', status: 'untested' },
        { id: 9, label: 'Halaman jadwal terbuka.', status: 'untested' },
        { id: 10, label: 'Banner navigasi berhasil tampil.', status: 'untested' }
      ];
    } catch { return []; }
  });

  const isSuperAdmin = role?.role_name === ROLES.SUPER_ADMIN;
  const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasNotificationsAPI = 'Notification' in window;
  const hasSWAPI = 'serviceWorker' in navigator;

  const swLabels = { active: 'Aktif', installing: 'Memasang', installed: 'Terpasang', waiting: 'Menunggu', activating: 'Mengaktifkan', redundant: 'Redundan', checking: 'Memeriksa', unsupported: 'Tidak didukung', error: 'Gagal' };
  const getSWLabel = s => swLabels[s] || s;
  const getSWStatus = s => s === 'active' ? 'success' : (s === 'unsupported' || s === 'error' || s === 'redundant' ? 'error' : (s === 'installing' || s === 'waiting' || s === 'activating' ? 'warning' : 'info'));

  const permLabels = { granted: 'Diberikan', denied: 'Ditolak', default: 'Belum diputuskan', unsupported: 'Tidak didukung' };
  const getLabel = p => permLabels[p] || p;

  const getPermStatus = p => p === 'granted' ? 'success' : (p === 'denied' || p === 'unsupported' ? 'error' : 'warning');

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    setError(null);
    try {
      const result = await requestNotificationPermission();
      if (result === 'granted') { /* ok */ }
      if (result === 'denied') setError('Izin notifikasi ditolak. Pengguna harus mengaktifkannya kembali melalui pengaturan browser atau perangkat.');
      else if (result === 'unsupported') setError('Perangkat atau browser ini tidak mendukung notifikasi web.');
    } catch (err) { setError(err.message); }
    setIsRequestingPermission(false);
  };

  const handleSendTest = async () => {
    setIsSending(true);
    setTestResult(null);
    setVerificationResult(null);
    setError(null);
    try {
      const result = await sendTestNotification();
      setTestResult(result);
      updateChecklist(4, 'success');
      setTimeout(async () => {
        setIsVerifying(true);
        try {
          const v = await verifyNotification();
          setVerificationResult(v);
          if (v.found) updateChecklist(5, 'success');
        } catch (e) { setVerificationResult({ found: false, notifications: [], error: e.message }); }
        setIsVerifying(false);
      }, 500);
    } catch (err) {
      setError(err.message);
      setTestResult({ error: err.message });
    }
    setIsSending(false);
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const v = await verifyNotification();
      setVerificationResult(v);
      updateChecklist(5, v.found ? 'success' : 'failed');
    } catch (e) { setVerificationResult({ found: false, notifications: [], error: e.message }); }
    setIsVerifying(false);
  };

  const updateChecklist = (id, status) => {
    setChecklist(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, status } : i);
      localStorage.setItem('harmas-notification-checklist', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleChecklist = (id) => {
    setChecklist(prev => {
      const item = prev.find(i => i.id === id);
      const cycle = { success: 'failed', failed: 'untested', untested: 'success' };
      const st = cycle[item.status] || 'untested';
      const updated = prev.map(i => i.id === id ? { ...i, status: st } : i);
      localStorage.setItem('harmas-notification-checklist', JSON.stringify(updated));
      return updated;
    });
  };

  const resetAll = () => {
    const reset = checklist.map(i => ({ ...i, status: 'untested' }));
    setChecklist(reset);
    localStorage.setItem('harmas-notification-checklist', JSON.stringify(reset));
  };

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div className="card text-center py-12">
          <Shield size={48} className="mx-auto text-warning-400 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Akses Terbatas</h2>
          <p className="text-ink-400">Halaman ini hanya dapat diakses oleh Super Admin.</p>
        </div>
      </div>
    );
  }

  const isControlled = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);

  useEffect(() => {
    if (swStatus === 'active' && !isControlled) {
      setNeedsRefresh(true);
    }
  }, [swStatus, isControlled]);


  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {needsRefresh && (
        <div className="p-4 bg-warning-500/10 border border-warning-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <RefreshCw size={20} className="text-warning-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning-300">Service Worker belum mengontrol halaman ini.</p>
              <p className="text-xs text-ink-400 mt-1">
                SW sudah aktif di latar belakang, tetapi halaman ini perlu dimuat ulang agar SW dapat mengambil alih kontrol.
                Notifikasi hanya bisa diuji setelah halaman di-refresh.
              </p>
              <button onClick={() => window.location.reload()} className="btn-secondary btn-sm mt-3">
                <RefreshCw size={14} /> Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Tes Notifikasi Sistem</h1>
        <p className="text-sm text-ink-400 mt-1">Uji coba notifikasi sistem melalui Notifications API dan service worker</p>
      </div>

      {/* Notifikasi Perangkat (Web Push) */}
      <div className="card">
        <h3 className="text-base font-semibold text-white mb-2">Notifikasi Perangkat (Push)</h3>
        <p className="text-xs text-ink-400 mb-4">
          Berlangganan untuk menerima pengingat jadwal langsung di perangkat — bahkan saat aplikasi tidak dibuka. Aktif per-user per-perangkat.
        </p>
        {!push.supported ? (
          <div className="flex items-center gap-2 p-3 bg-warning-500/10 border border-warning-500/20 rounded-lg">
            <BellOff size={18} className="text-warning-400 flex-shrink-0" />
            <p className="text-sm text-warning-300">
              Push belum tersedia. Pastikan VAPID key (VITE_VAPID_PUBLIC_KEY) sudah dikonfigurasi dan halaman via HTTPS/localhost.
            </p>
          </div>
        ) : push.subscribed ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-success-400" />
              <span className="text-sm text-success-300">Perangkat ini sudah berlangganan push.</span>
            </div>
            <button onClick={() => push.unsubscribe()} disabled={push.loading} className="btn-secondary btn-sm">
              {push.loading ? 'Memproses...' : 'Berhenti Berlangganan'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BellRing size={18} className="text-primary-400" />
              <span className="text-sm text-ink-300">Belum berlangganan di perangkat ini.</span>
            </div>
            <button onClick={() => push.subscribe()} disabled={push.loading} className="btn-primary btn-sm">
              <BellRing size={14} /> {push.loading ? 'Memproses...' : 'Aktifkan Push'}
            </button>
          </div>
        )}
        {push.error && <p className="text-xs text-danger-400 mt-2">{push.error}</p>}
      </div>

      {/* Panel Diagnostik */}
      <div className="card">
        <h3 className="text-base font-semibold text-white mb-4">Panel Diagnostik</h3>
        <div className="divide-y divide-white/5">
          <StatusRow label="HTTPS atau localhost" status={isSecure ? 'success' : 'error'} detail={isSecure ? (window.location.protocol === 'https:' ? 'HTTPS' : 'localhost') : 'HTTP'} />
          <StatusRow label="Notifications API" status={hasNotificationsAPI ? 'success' : 'error'} detail={hasNotificationsAPI ? 'Tersedia' : 'Tidak tersedia'} />
          <StatusRow label="Notification.permission" status={getPermStatus(notificationPermission)} detail={getLabel(notificationPermission)} />
          <StatusRow label="Service Worker API" status={hasSWAPI ? 'success' : 'error'} detail={hasSWAPI ? 'Tersedia' : 'Tidak tersedia'} />
          <StatusRow label="Status SW terdaftar" status={swStatus === 'unsupported' ? 'error' : registration ? 'success' : 'warning'} detail={registration ? 'Terdaftar' : 'Belum'} />
          <StatusRow label="Status SW aktif" status={getSWStatus(swStatus)} detail={getSWLabel(swStatus)} />
          <StatusRow label="Mode standalone" status={isStandalone ? 'success' : 'info'} detail={isStandalone ? 'Ya' : 'Tidak'} />
          <StatusRow label="Aplikasi ter-install" status={isInstalled ? 'success' : 'info'} detail={isInstalled ? 'Ya' : 'Belum'} />
          <StatusRow label="Pemeriksaan terakhir" status="info" detail={new Date(lastCheck).toLocaleString('id-ID')} />
        </div>
      </div>

      {/* Izin Notifikasi */}
      <div className="card">
        <h3 className="text-base font-semibold text-white mb-2">Izin Notifikasi</h3>
        <p className="text-xs text-ink-400 mb-4">Permission hanya diminta setelah tombol ditekan. Tidak diminta otomatis saat login atau halaman dibuka.</p>
        {notificationPermission === 'granted' && (
          <div className="flex items-center gap-2 p-3 bg-success-500/10 border border-success-500/20 rounded-lg mb-4">
            <BellRing size={18} className="text-success-400 flex-shrink-0" />
            <p className="text-sm text-success-300">Izin notifikasi sistem berhasil diberikan.</p>
          </div>
        )}
        {notificationPermission === 'default' && (
          <div className="flex items-center gap-2 p-3 bg-warning-500/10 border border-warning-500/20 rounded-lg mb-4">
            <Bell size={18} className="text-warning-400 flex-shrink-0" />
            <p className="text-sm text-warning-300">Izin notifikasi belum diberikan.</p>
          </div>
        )}
        {notificationPermission === 'denied' && (
          <div className="flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg mb-4">
            <BellOff size={18} className="text-danger-400 flex-shrink-0" />
            <p className="text-sm text-danger-300">Izin notifikasi ditolak. Pengguna harus mengaktifkannya kembali melalui pengaturan browser atau perangkat.</p>
          </div>
        )}
        {notificationPermission === 'unsupported' && (
          <div className="flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg mb-4">
            <XCircle size={18} className="text-danger-400 flex-shrink-0" />
            <p className="text-sm text-danger-300">Perangkat atau browser ini tidak mendukung notifikasi web.</p>
          </div>
        )}
        {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
          <button onClick={handleRequestPermission} className="btn-primary">
            {isRequestingPermission ? 'Meminta izin...' : 'Aktifkan Notifikasi Sistem'}
          </button>
        )}
      </div>

      {/* Kirim Notifikasi Uji */}
      <div className="card">
        <h3 className="text-base font-semibold text-white mb-2">Kirim Notifikasi Sistem Uji</h3>
        <p className="text-xs text-ink-400 mb-4">Menggunakan serviceWorkerRegistration.showNotification() untuk menampilkan notifikasi sistem.</p>
        <button onClick={handleSendTest} disabled={isSending || notificationPermission !== 'granted' || swStatus !== 'active' || !isControlled} className="btn-primary">
          <Send size={16} /> {isSending ? 'Mengirim...' : 'Kirim Notifikasi Sistem Uji'}
        </button>
        {notificationPermission !== 'granted' && <p className="text-xs text-warning-400 mt-2">Tombol tidak aktif: izin notifikasi belum diberikan.</p>}
        {swStatus !== 'active' && <p className="text-xs text-warning-400 mt-2">Tombol tidak aktif: service worker belum aktif ({getSWLabel(swStatus)}).</p>}
        {swStatus === 'active' && !isControlled && <p className="text-xs text-warning-400 mt-2">Tombol tidak aktif: SW aktif tetapi belum mengontrol halaman. Muat ulang halaman.</p>}

        {tabFocused && (
          <p className="text-xs text-ink-400 mt-2">
            Tips: jika notifikasi tidak muncul sebagai banner, coba minimalkan jendela browser. Saat tab aktif, beberapa browser hanya menyimpan notifikasi di Notification Center.
          </p>
        )}

        {testResult && (
          <div className="mt-4 space-y-3">
            <div className={`p-3 rounded-lg border ${testResult.success ? 'bg-success-500/10 border-success-500/20' : 'bg-danger-500/10 border-danger-500/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                {testResult.success ? <CheckCircle2 size={16} className="text-success-400" /> : <XCircle size={16} className="text-danger-400" />}
                <span className="text-sm font-medium text-white">{testResult.success ? 'Notifikasi berhasil dikirim' : 'Gagal mengirim notifikasi'}</span>
              </div>
              <div className="text-xs text-ink-400 space-y-1 mt-2">
                <p>Waktu pengiriman: {testResult.time ? new Date(testResult.time).toLocaleString('id-ID') : '-'}</p>
                <p>Permission: {getLabel(notificationPermission)}</p>
                <p>Status SW: {getSWLabel(swStatus)}</p>
                <p>Tag: {testResult.tag || '-'}</p>
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${verificationResult?.found ? 'bg-success-500/10 border-success-500/20' : 'bg-warning-500/10 border-warning-500/20'}`}>
              {isVerifying ? (
                <div className="flex items-center gap-2"><RefreshCw size={16} className="text-primary-400 animate-spin" /><span className="text-sm text-ink-300">Memverifikasi...</span></div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    {verificationResult?.found ? <CheckCircle2 size={16} className="text-success-400" /> : <AlertTriangle size={16} className="text-warning-400" />}
                    <span className="text-sm font-medium text-white">
                      {verificationResult?.found ? 'Notifikasi berhasil dibuat dan terdaftar pada service worker.' : 'Perintah notifikasi dijalankan, tetapi notifikasi aktif tidak ditemukan.'}
                    </span>
                  </div>
                  <div className="text-xs text-ink-400 space-y-1 mt-2">
                    <p>Hasil getNotifications(): {verificationResult?.found ? `Ditemukan ${verificationResult.count} notifikasi` : 'Tidak ditemukan'}</p>
                    {verificationResult?.error && <p className="text-danger-400">Error: {verificationResult.error}</p>}
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-ink-500 italic">Tampilan banner pada layar tetap perlu dikonfirmasi satu kali pada perangkat nyata karena banner ditampilkan oleh sistem operasi.</p>

            {verificationResult && !verificationResult?.found && (
              <button onClick={handleVerify} disabled={isVerifying} className="btn-secondary btn-sm">
                <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} /> Verifikasi Ulang
              </button>
            )}

            {error && <p className="text-xs text-danger-400 mt-2">{error}</p>}
          </div>
        )}
      </div>

      {/* Checklist Pengujian Manual */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Checklist Pengujian Manual</h3>
            <p className="text-xs text-ink-400 mt-0.5">Simpan status pengujian di local storage</p>
          </div>
          <button onClick={resetAll} className="btn-secondary btn-sm"><RefreshCw size={14} /> Reset</button>
        </div>
        <div className="space-y-2">
          {checklist.map(item => {
            const st = item.status;
            const badgeColor = st === 'success' ? 'text-success-400 bg-success-500/10 border-success-500/20' : st === 'failed' ? 'text-danger-400 bg-danger-500/10 border-danger-500/20' : 'text-warning-400 bg-warning-500/10 border-warning-500/20';
            const badgeLabel = st === 'success' ? 'Berhasil' : st === 'failed' ? 'Gagal' : 'Belum diuji';
            const BadgeIcon = st === 'success' ? CheckCircle2 : st === 'failed' ? XCircle : AlertTriangle;
            return (
              <div key={item.id} onClick={() => toggleChecklist(item.id)} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/5 hover:bg-white/[0.06] cursor-pointer transition-all">
                <span className="text-sm text-ink-200">{item.id}. {item.label}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${badgeColor}`}>
                  <BadgeIcon size={12} /> {badgeLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

