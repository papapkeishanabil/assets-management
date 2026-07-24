import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, ACCOUNT_STATUS_LABELS, formatDateTime } from '../lib/constants';
import toast from 'react-hot-toast';
import { User, Save, Shield, Mail, Phone, Building2, Briefcase, Calendar, Edit3, X } from 'lucide-react';

export default function ProfilePage() {
  const { profile, role, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    department: profile?.department || '',
    position: profile?.position || ''
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(form);
      toast.success('Profil berhasil diperbarui');
      setEditing(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = role ? ROLE_LABELS[role.role_name] || role.role_name : '-';
  const statusLabel = profile?.account_status ? ACCOUNT_STATUS_LABELS[profile.account_status] || profile.account_status : '-';
  const statusKey = (profile?.account_status || '').toLowerCase();
  const statusColor =
    statusKey === 'active' ? 'badge-green'
    : statusKey === 'pending' ? 'badge-yellow'
    : statusKey === 'suspended' ? 'badge-red'
    : 'badge-gray';

  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  const InfoField = ({ icon: Icon, label, value }) => (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">
        <Icon size={11} />
        {label}
      </div>
      <p className="font-medium text-white text-sm">{value || '-'}</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1 tracking-tight">Profil Saya</h1>
        <p className="text-sm text-ink-400">Kelola informasi akun dan preferensi Anda</p>
      </div>

      {/* Profile Header Card */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 dot-grid-bg opacity-20 pointer-events-none"></div>
        <div className="relative flex items-center gap-4 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-xl font-semibold text-white shadow-glow-blue">
              {initials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success-400 ring-2 ring-ink-990 live-dot text-success-400"></div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{profile?.full_name}</h2>
            <p className="text-sm text-ink-400 font-mono truncate">{profile?.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="badge-blue">
                <Shield size={10} />
                {roleLabel}
              </span>
              <span className={statusColor}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Details / Edit Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="section-title">
              <User size={16} className="text-primary-400" />
              Informasi Pengguna
            </h3>
            <p className="section-subtitle">Data diri dan kontak Anda</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary">
              <Edit3 size={14} />
              Edit Profil
            </button>
          )}
        </div>

        {!editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoField icon={User} label="Nama Lengkap" value={profile?.full_name} />
            <InfoField icon={Mail} label="Email" value={profile?.email} />
            <InfoField icon={Phone} label="No. WhatsApp" value={profile?.phone} />
            <InfoField icon={Building2} label="Departemen" value={profile?.department} />
            <InfoField icon={Briefcase} label="Jabatan" value={profile?.position} />
            <InfoField icon={Calendar} label="Bergabung" value={formatDateTime(profile?.created_at)} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
            <div>
              <label className="label">Nama Lengkap</label>
              <input
                type="text"
                name="full_name"
                className="input"
                value={form.full_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">No. WhatsApp</label>
                <input
                  type="tel"
                  name="phone"
                  className="input"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">Departemen</label>
                <input
                  type="text"
                  name="department"
                  className="input"
                  value={form.department}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label className="label">Jabatan</label>
              <input
                type="text"
                name="position"
                className="input"
                value={form.position}
                onChange={handleChange}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Simpan Perubahan
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    full_name: profile?.full_name || '',
                    phone: profile?.phone || '',
                    department: profile?.department || '',
                    position: profile?.position || ''
                  });
                }}
                className="btn-ghost"
              >
                <X size={14} />
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
