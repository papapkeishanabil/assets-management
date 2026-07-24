import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Settings, Plus, X, Calendar, Download, Smartphone, CheckCircle2, AlertTriangle, Info, Bell, ExternalLink } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/constants';

export default function SettingsPage() {
  const { role } = useAuth();
  const {
    isStandalone, isInstalled, isInstallable, swStatus,
    installApp
  } = usePWA();
  const [workingDays, setWorkingDays] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', holiday_name: '', holiday_type: 'libur_nasional' });
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState(null);

  const isSuperAdmin = role?.role_name === ROLES.SUPER_ADMIN;

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data: wd } = await supabase.from('working_days').select('*');
    setWorkingDays(wd || []);
    const { data: h } = await supabase.from('holidays').select('*').order('holiday_date');
    setHolidays(h || []);
  };

  const toggleWorkingDay = async (dayId, current) => {
    const { error } = await supabase.from('working_days').update({ is_working_day: !current }).eq('id', dayId);
    if (error) { toast.error(error.message); return; }
    toast.success('Hari kerja diperbarui');
    fetchSettings();
  };

  const addHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.holiday_date || !holidayForm.holiday_name) { toast.error('Isi tanggal dan nama'); return; }
    const { error } = await supabase.from('holidays').insert([holidayForm]);
    if (error) { toast.error(error.message); return; }
    toast.success('Hari libur ditambahkan');
    setShowHolidayForm(false);
    setHolidayForm({ holiday_date: '', holiday_name: '', holiday_type: 'libur_nasional' });
    fetchSettings();
  };

  const deleteHoliday = async (id) => {
    if (!confirm('Hapus hari libur ini?')) return;
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Hari libur dihapus');
    fetchSettings();
  };

  const handleInstall = async () => {
    setInstalling(true);
    setInstallMessage(null);
    const result = await installApp();
    setInstallMessage(result);
    if (result.outcome === 'accepted') toast.success(result.message);
    else if (result.outcome === 'dismissed') toast(result.message);
    else if (result.outcome === 'error') toast.error(result.message);
    setInstalling(false);
  };

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Pengaturan</h1>
        <p className="text-sm text-ink-400 mt-1">Konfigurasi aplikasi</p>
      </div>

      {/* Instalasi Aplikasi */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
            <Smartphone size={18} className="text-primary-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Instalasi Aplikasi</h3>
            <p className="text-xs text-ink-400 mt-0.5">Install Harmas Asset Management sebagai Progressive Web App</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-sm text-ink-300">Status instalasi</span>
            <span className={`text-xs font-medium px-2 py-1 rounded border ${
              isInstalled || isStandalone
                ? 'text-success-300 bg-success-500/10 border-success-500/20'
                : 'text-warning-300 bg-warning-500/10 border-warning-500/20'
            }`}>
              {isInstalled || isStandalone ? 'Aplikasi sudah di-install' : 'Aplikasi belum di-install'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-sm text-ink-300">Dukungan browser</span>
            <span className={`text-xs font-medium px-2 py-1 rounded border ${
              isInstallable || isInstalled || isStandalone
                ? 'text-success-300 bg-success-500/10 border-success-500/20'
                : 'text-ink-300 bg-white/5 border-white/10'
            }`}>
              {isInstallable
                ? 'Browser mendukung instalasi'
                : (isInstalled || isStandalone)
                  ? 'Sudah ter-install'
                  : 'Browser belum menawarkan instalasi'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-sm text-ink-300">Mode tampilan</span>
            <span className={`text-xs font-medium px-2 py-1 rounded border ${
              isStandalone
                ? 'text-success-300 bg-success-500/10 border-success-500/20'
                : 'text-ink-300 bg-white/5 border-white/10'
            }`}>
              {isStandalone ? 'Berjalan dalam mode standalone' : 'Berjalan di browser'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-ink-300">Service worker</span>
            <span className="text-xs font-mono text-ink-400">{swStatus}</span>
          </div>
        </div>

        {isInstallable && (
          <button onClick={handleInstall} disabled={installing} className="btn-primary">
            <Download size={16} />
            {installing ? 'Memproses instalasi...' : 'Install Harmas Asset Management'}
          </button>
        )}

        {!isInstallable && !isInstalled && !isStandalone && (
          <div className="flex items-start gap-2 p-3 bg-white/[0.03] border border-white/10 rounded-lg">
            <Info size={16} className="text-primary-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-ink-300 space-y-1">
              <p>Browser belum menawarkan prompt instalasi. Coba salah satu cara berikut:</p>
              <ul className="list-disc list-inside text-ink-400 space-y-0.5">
                <li>Chrome/Edge: menu (⋮) → Install app / Install Harmas Asset Management</li>
                <li>Pastikan aplikasi dibuka melalui HTTPS atau localhost</li>
                <li>Pastikan service worker aktif dan manifest valid</li>
              </ul>
            </div>
          </div>
        )}

        {(isInstalled || isStandalone) && (
          <div className="flex items-center gap-2 p-3 bg-success-500/10 border border-success-500/20 rounded-lg">
            <CheckCircle2 size={16} className="text-success-400 flex-shrink-0" />
            <p className="text-sm text-success-300">Aplikasi sudah ter-install dan siap digunakan sebagai aplikasi desktop/mobile.</p>
          </div>
        )}

        {installMessage && installMessage.outcome === 'not_available' && (
          <div className="flex items-center gap-2 p-3 mt-3 bg-warning-500/10 border border-warning-500/20 rounded-lg">
            <AlertTriangle size={16} className="text-warning-400 flex-shrink-0" />
            <p className="text-sm text-warning-300">{installMessage.message}</p>
          </div>
        )}
      </div>

      {/* Tes Notifikasi - Super Admin */}
      {isSuperAdmin && (
        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                <Bell size={18} className="text-primary-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Tes Notifikasi Sistem</h3>
                <p className="text-xs text-ink-400 mt-0.5">Diagnostik dan uji notifikasi sistem melalui service worker</p>
              </div>
            </div>
            <Link to="/settings/system-notification-test" className="btn-secondary btn-sm">
              Buka Halaman Tes <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-base font-semibold text-white mb-4">Kalender Hari Kerja</h3>
        <p className="text-xs text-ink-400 mb-4">Atur hari kerja perusahaan. Jadwal pemeliharaan akan menyesuaikan hari kerja.</p>
        <div className="grid grid-cols-7 gap-2">
          {workingDays.map(wd => (
            <button
              key={wd.id}
              onClick={() => toggleWorkingDay(wd.id, wd.is_working_day)}
              className={`p-3 rounded-lg text-center transition-all ${
                wd.is_working_day ? 'bg-gradient-to-br from-primary-500 to-indigo-600 shadow-glow-blue text-white' : 'bg-white/5 text-ink-500 border border-white/10'
              }`}
            >
              <p className="text-xs font-medium">{dayNames[wd.day_of_week]}</p>
              <p className="text-[10px] mt-1">{wd.is_working_day ? 'Kerja' : 'Libur'}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Hari Libur</h3>
            <p className="text-xs text-ink-400 mt-0.5">Daftar hari libur nasional dan perusahaan</p>
          </div>
          <button onClick={() => setShowHolidayForm(true)} className="btn-primary btn-sm"><Plus size={16} /> Tambah</button>
        </div>

        {holidays.length === 0 ? (
          <p className="text-sm text-ink-400 py-4 text-center">Belum ada hari libur</p>
        ) : (
          <div className="space-y-2">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">{h.holiday_name}</p>
                  <p className="text-xs text-ink-400 font-mono">{h.holiday_date} - {h.holiday_type}</p>
                </div>
                <button onClick={() => deleteHoliday(h.id)} className="btn-danger btn-sm"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showHolidayForm && (
        <div className="modal-overlay" onClick={() => setShowHolidayForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Calendar size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Tambah Hari Libur</h3>
              </div>
              <button onClick={() => setShowHolidayForm(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={addHoliday} className="space-y-4">
              <div>
                <label className="label">Tanggal</label>
                <input type="date" className="input" value={holidayForm.holiday_date} onChange={e => setHolidayForm({...holidayForm, holiday_date: e.target.value})} required />
              </div>
              <div>
                <label className="label">Nama Hari Libur</label>
                <input type="text" className="input" value={holidayForm.holiday_name} onChange={e => setHolidayForm({...holidayForm, holiday_name: e.target.value})} required placeholder="Contoh: Tahun Baru" />
              </div>
              <div>
                <label className="label">Tipe</label>
                <select className="input" value={holidayForm.holiday_type} onChange={e => setHolidayForm({...holidayForm, holiday_type: e.target.value})}>
                  <option value="libur_nasional">Libur Nasional</option>
                  <option value="libur_perusahaan">Libur Perusahaan</option>
                  <option value="cuti_bersama">Cuti Bersama</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowHolidayForm(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">Tambah</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
