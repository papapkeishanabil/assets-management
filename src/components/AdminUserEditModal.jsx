import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Save, Edit3, X } from 'lucide-react';
import { submitAdminUserChange } from '../lib/admin-user-helpers';

export default function AdminUserEditModal({ user, mode, departments, subDepartments, onClose, onSaved }) {
  const passwordMode = mode === 'password';
  const title = passwordMode ? 'Ubah Password Pengguna' : 'Edit Identitas Pengguna';
  const [form, setForm] = useState({ full_name: user.full_name || '', email: user.email || '', phone: user.phone || '', department: user.department || '',
    department_id: user.department_id || '', sub_department_id: user.sub_department_id || '', position: user.position || '', password: '', confirmation: '' });
  const [visible, setVisible] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const busy = useRef(false), dialog = useRef(null);
  const field = (name) => (event) => { setError(''); setForm((old) => ({ ...old, [name]: event.target.value })); };
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('input')?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape' && !busy.current) onClose();
      if (event.key !== 'Tab') return;
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [onClose]);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy.current) return;
    setError('');
    if (passwordMode && (form.password.length < 8 || !form.password.trim())) { setError('Password baru minimal 8 karakter.'); return; }
    if (passwordMode && form.password !== form.confirmation) { setError('Konfirmasi password baru tidak cocok.'); return; }
    if (!passwordMode && !form.full_name.trim()) { setError('Nama lengkap wajib diisi.'); return; }
    busy.current = true; setSaving(true);
    try {
      const payload = passwordMode ? { action: 'reset_password', profile_id: user.id, password: form.password }
        : { action: 'update_profile', profile_id: user.id, expected_updated_at: user.updated_at, profile: Object.fromEntries(
          ['full_name', 'email', 'phone', 'department', 'department_id', 'sub_department_id', 'position'].map((key) => [key, form[key]])) };
      await submitAdminUserChange(payload);
      setForm((old) => ({ ...old, password: '', confirmation: '' })); setVisible(false);
      onSaved(passwordMode ? 'Password pengguna berhasil diubah.' : 'Identitas pengguna berhasil diperbarui.');
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setSaving(false); }
  };
  const subs = subDepartments.filter((s) => s.department_id === form.department_id);
  const legacyDepartment = !user.department_id && Boolean(user.department);
  return <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy.current) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="admin-user-modal-title" className="modal-content bg-ink-900 max-w-xl p-5 sm:p-6">
      <div className="flex justify-between items-start gap-3 mb-5"><div><h2 id="admin-user-modal-title" className="text-lg font-semibold text-white flex items-center gap-2">{passwordMode ? <KeyRound size={18} className="text-primary-400" /> : <Edit3 size={18} className="text-primary-400" />}{title}</h2><p className="text-xs text-ink-400 mt-1 break-all">{user.full_name} · {user.email}</p></div><button type="button" aria-label="Tutup perubahan pengguna" className="btn-ghost !p-1.5" disabled={saving} onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving} className="space-y-4">
          {passwordMode ? <>
            <p className="text-sm text-ink-300">Tetapkan password baru untuk pengguna ini. Password lama tidak diperlukan dan tidak dapat ditampilkan.</p>
            <label className="block"><span className="label">Password baru</span><div className="relative"><input type={visible ? 'text' : 'password'} className="input pr-11" value={form.password} onChange={field('password')} autoComplete="new-password" minLength={8} maxLength={128} required /><button type="button" aria-label={visible ? 'Sembunyikan password baru' : 'Tampilkan password baru'} aria-pressed={visible} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" onClick={() => setVisible((v) => !v)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
            <label className="block"><span className="label">Konfirmasi password baru</span><input type={visible ? 'text' : 'password'} className="input" value={form.confirmation} onChange={field('confirmation')} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
            <p className="text-xs text-ink-400">Minimal 8 karakter. Sampaikan password baru kepada pengguna melalui saluran yang aman.</p>
          </> : <>
            <label className="block"><span className="label">Nama lengkap</span><input className="input" value={form.full_name} onChange={field('full_name')} maxLength={200} required /></label>
            <div><label className="label" htmlFor="admin-user-email">Email login</label><input id="admin-user-email" aria-describedby="admin-email-hint" type="email" className="input" value={form.email} onChange={field('email')} maxLength={254} required /><p id="admin-email-hint" className="text-xs text-ink-400 mt-1">Perubahan email berlaku untuk login berikutnya. Pastikan alamat benar.</p></div>
            <label className="block"><span className="label">Nomor WhatsApp / telepon</span><input type="tel" className="input" value={form.phone} onChange={field('phone')} maxLength={40} /></label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className="label">Departemen</span><select className="input" value={form.department_id || (legacyDepartment && form.department ? '__legacy' : '')} onChange={(event) => {
                const id = event.target.value; setForm((old) => ({ ...old, department_id: id === '__legacy' ? '' : id, sub_department_id: '', department: id === '__legacy' ? user.department : departments.find((d) => d.id === id)?.department_name || '' }));
              }}><option value="">Tanpa departemen</option>{legacyDepartment && <option value="__legacy">{user.department} (data lama)</option>}{user.department_id && !departments.some((d) => d.id === user.department_id) && <option value={user.department_id}>{user.department || 'Departemen sebelumnya'}</option>}{departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}</select></label>
              <label className="block"><span className="label">Subdepartemen</span><select className="input" value={form.sub_department_id} disabled={!form.department_id} onChange={field('sub_department_id')}><option value="">Tanpa subdepartemen</option>{form.sub_department_id === user.sub_department_id && !subs.some((s) => s.id === user.sub_department_id) && user.sub_department_id && <option value={user.sub_department_id}>Subdepartemen sebelumnya</option>}{subs.map((s) => <option key={s.id} value={s.id}>{s.sub_department_name}</option>)}</select></label>
            </div>
            <label className="block"><span className="label">Jabatan</span><input className="input" value={form.position} onChange={field('position')} maxLength={150} /></label>
          </>}
          {error && <p role="alert" className="text-sm text-danger-400">{error}</p>}
          <div className="flex flex-wrap gap-2 pt-2"><button type="submit" className="btn-primary">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{saving ? 'Menyimpan…' : passwordMode ? 'Simpan Password Baru' : 'Simpan Identitas'}</button><button type="button" className="btn-ghost" onClick={onClose}>Batal</button></div>
        </fieldset>
      </form>
    </section>
  </div>;
}
