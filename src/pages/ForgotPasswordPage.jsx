import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Mail, ArrowRight, Building2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Silakan masukkan email');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      setSent(true);
      toast.success('Email reset password telah dikirim');
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
          <h1 className="text-2xl font-bold text-white">Lupa Password</h1>
        </div>

        <div className="glass rounded-xl p-8 shadow-soft-lg">
          {sent ? (
            <div className="text-center py-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-success-500/10 border border-success-500/20 flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-success-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Email Terkirim</h2>
              <p className="text-ink-400 text-sm mb-4">
                Silakan cek inbox email <strong className="text-white font-mono">{email}</strong> untuk link reset password.
              </p>
              <p className="text-xs text-ink-500 mb-6">
                Tidak menerima email? Periksa folder spam atau
                <button onClick={() => setSent(false)} className="text-primary-400 hover:text-primary-300 font-medium ml-1">
                  kirim ulang
                </button>
              </p>
              <Link to="/login" className="btn-secondary w-full">
                <ArrowLeft size={14} />
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-xs font-mono font-medium text-primary-400 uppercase tracking-wider mb-2">Reset Password</div>
                <h2 className="text-xl font-bold text-white mb-1">Kirim Link Reset</h2>
                <p className="text-ink-400 text-sm">
                  Masukkan email Anda dan kami akan mengirimkan link reset password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="nama@harmas.co.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Mail size={16} />
                      Kirim Email Reset
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                <p className="text-ink-400 text-sm">
                  Ingat password?{' '}
                  <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                    Masuk
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
