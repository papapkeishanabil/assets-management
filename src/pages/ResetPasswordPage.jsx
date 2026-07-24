import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Lock, ArrowRight, Building2, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success('Password berhasil direset. Silakan login.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 p-4 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="orb w-[600px] h-[600px] bg-primary-600/20 top-[-200px] left-[-200px] animate-orbit"></div>
      <div className="orb w-[500px] h-[500px] bg-indigo-600/15 bottom-[-150px] right-[10%] animate-orbit" style={{ animationDelay: '-10s' }}></div>
      <div className="absolute inset-0 dot-grid-bg opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-glow-blue">
            <Building2 size={26} className="text-white" />
          </div>
          <div className="text-xs font-mono font-medium text-primary-400 uppercase tracking-wider mb-1">Harmas Asset System</div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
        </div>

        <div className="glass rounded-xl p-8 shadow-soft-lg">
          <div className="mb-6">
            <div className="text-xs font-mono font-medium text-primary-400 uppercase tracking-wider mb-2">Password Baru</div>
            <h2 className="text-xl font-bold text-white mb-1">Buat Password Baru</h2>
            <p className="text-ink-400 text-sm">Masukkan password baru untuk akun Anda.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Password Baru</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="Min. 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-500 hover:text-ink-200 transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Konfirmasi Password Baru</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Menyimpan...
                </>
              ) : (
                <>
                  <Lock size={16} />
                  Reset Password
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
