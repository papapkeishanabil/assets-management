import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn, Shield, Building2, Activity, ArrowRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email dan password wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Login berhasil');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email atau password salah'
        : error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, title: 'Keamanan Berlapis', desc: 'Data aset perusahaan terenkripsi & terlindungi' },
    { icon: Building2, title: 'Manajemen Terpusat', desc: 'Kelola seluruh aset dari satu dashboard' },
    { icon: Activity, title: 'Monitoring Real-time', desc: 'Notifikasi jadwal pemeliharaan otomatis' },
  ];

  return (
    <div className="min-h-screen flex bg-ink-950 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="orb w-[600px] h-[600px] bg-primary-600/20 top-[-200px] left-[-200px] animate-orbit"></div>
      <div className="orb w-[500px] h-[500px] bg-indigo-600/15 bottom-[-150px] right-[10%] animate-orbit" style={{ animationDelay: '-10s' }}></div>
      <div className="absolute inset-0 dot-grid-bg opacity-30 pointer-events-none"></div>

      {/* Theme Toggle - top right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left — Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="mb-12">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center mb-8 shadow-glow-blue">
              <Building2 size={28} className="text-white" />
            </div>
            <div className="text-xs font-mono font-medium text-primary-400 uppercase tracking-wider mb-3">Harmas Asset System</div>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight tracking-tight">
              Manajemen Aset<br />
              <span className="shimmer-text">CV Harmas Industri Sandang</span>
            </h1>
            <p className="text-ink-300 text-base max-w-md leading-relaxed">
              Sistem terintegrasi untuk mengelola, memantau, dan mengoptimalkan seluruh aset perusahaan.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4 group">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 group-hover:bg-white/10 group-hover:border-primary-500/30 transition-all">
                  <feature.icon size={18} className="text-primary-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">{feature.title}</h3>
                  <p className="text-ink-400 text-xs mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-2 text-xs text-ink-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-success-400 live-dot text-success-400"></span>
            SYSTEM ONLINE · v1.0.0
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-md relative">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-glow-blue">
              <Building2 size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Harmas Asset System</h1>
            <p className="text-ink-400 text-xs mt-1 font-mono">CV HARMAS INDUSTRI SANDANG</p>
          </div>

          {/* Form Card */}
          <div className="glass rounded-xl p-8 lg:p-10 shadow-soft-lg">
            <div className="mb-8">
              <div className="text-xs font-mono font-medium text-primary-400 uppercase tracking-wider mb-2">Sign In</div>
              <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">Selamat Datang</h2>
              <p className="text-ink-400 text-sm">Silakan masuk ke akun Anda</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink-200 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="nama@harmas.co.id"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-ink-200">Password</label>
                  <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
                    Lupa password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-11"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
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

              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-300">
                <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30" />
                Ingat saya di perangkat ini
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base"
              >
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
                    <LogIn size={16} />
                    Masuk
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <p className="text-ink-400 text-sm">
                Belum punya akun?{' '}
                <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                  Daftar di sini
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-ink-500 font-mono">
            © 2026 CV Harmas Industri Sandang
          </div>
        </div>
      </div>
    </div>
  );
}
