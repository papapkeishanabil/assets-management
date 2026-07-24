import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { UserPlus, ArrowRight, Shield, Building2 } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.full_name || !form.email || !form.password) {
      toast.error('Silakan isi data yang wajib');
      return;
    }
    if (form.password !== form.confirm_password) {
      toast.error('Password tidak cocok');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name }
        }
      });
      if (authError) throw authError;

      if (authData.user) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('role_name', 'pelaksana')
          .single();

        const { error: profileError } = await supabase.from('user_profiles').insert([{
          auth_user_id: authData.user.id,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || '',
          department: form.department || '',
          position: form.position || '',
          role_id: roleData?.id || null,
          account_status: 'PENDING'
        }]);
        if (profileError) throw profileError;
      }

      toast.success('Registrasi berhasil! Akun Anda menunggu persetujuan Super Admin.');
      navigate('/login');
    } catch (error) {
      if (error.message?.includes('already registered') || error.code === 'user_already_exists') {
        toast.error('Email sudah terdaftar. Silakan login.');
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 p-4 py-8 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="orb w-[600px] h-[600px] bg-primary-600/20 top-[-200px] left-[-200px] animate-orbit"></div>
      <div className="orb w-[500px] h-[500px] bg-indigo-600/15 bottom-[-150px] right-[10%] animate-orbit" style={{ animationDelay: '-10s' }}></div>
      <div className="absolute inset-0 dot-grid-bg opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-lg relative">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-glow-blue">
            <Building2 size={26} className="text-white" />
          </div>
          <div className="text-xs font-mono font-medium text-primary-400 uppercase tracking-wider mb-1">Harmas Asset System</div>
          <h1 className="text-xl font-bold text-white">Daftar Akun Baru</h1>
        </div>

        <div className="glass rounded-xl p-8 shadow-soft-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Nama Lengkap <span className="text-danger-400">*</span></label>
                <input type="text" name="full_name" className="input" placeholder="Nama lengkap" value={form.full_name} onChange={handleChange} required />
              </div>
              <div className="md:col-span-2">
                <label className="label">Email <span className="text-danger-400">*</span></label>
                <input type="email" name="email" className="input" placeholder="nama@harmas.co.id" value={form.email} onChange={handleChange} required />
              </div>
              <div>
                <label className="label">No. WhatsApp</label>
                <input type="tel" name="phone" className="input" placeholder="08xxxx" value={form.phone} onChange={handleChange} />
              </div>
              <div>
                <label className="label">Departemen</label>
                <input type="text" name="department" className="input" placeholder="Departemen" value={form.department} onChange={handleChange} />
              </div>
              <div>
                <label className="label">Jabatan</label>
                <input type="text" name="position" className="input" placeholder="Jabatan" value={form.position} onChange={handleChange} />
              </div>
              <div></div>
              <div>
                <label className="label">Password <span className="text-danger-400">*</span></label>
                <input type="password" name="password" className="input" placeholder="Min. 6 karakter" value={form.password} onChange={handleChange} required />
              </div>
              <div>
                <label className="label">Konfirmasi Password <span className="text-danger-400">*</span></label>
                <input type="password" name="confirm_password" className="input" placeholder="Ulangi password" value={form.confirm_password} onChange={handleChange} required />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Daftar
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-ink-400 text-sm">
              Sudah punya akun?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                Masuk
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-500 font-mono">
          <Shield size={12} className="text-primary-500" />
          AKUN DIPROSES ADMIN · v1.0.0
        </div>
      </div>
    </div>
  );
}
