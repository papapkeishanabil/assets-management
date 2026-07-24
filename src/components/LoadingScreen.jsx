import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-ink-950 flex items-center justify-center z-50 overflow-hidden">
      {/* Ambient orbs */}
      <div className="orb w-[500px] h-[500px] bg-primary-600/20 top-[-200px] left-[-150px] animate-orbit"></div>
      <div className="orb w-[400px] h-[400px] bg-indigo-600/15 bottom-[-100px] right-[10%] animate-orbit" style={{ animationDelay: '-10s' }}></div>
      <div className="absolute inset-0 dot-grid-bg opacity-30 pointer-events-none"></div>

      <div className="relative text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-glow-blue mx-auto">
            <Loader2 size={36} className="text-white animate-spin" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-ink-880 rounded-full shadow-soft flex items-center justify-center border border-white/10">
            <div className="w-3 h-3 bg-success-400 rounded-full live-dot text-success-400"></div>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Memuat...</h3>
        <p className="text-sm text-ink-400 font-mono">Sedang mempersiapkan halaman</p>
      </div>
    </div>
  );
}
