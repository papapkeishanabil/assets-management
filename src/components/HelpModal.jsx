import { useState } from 'react';
import {
  HelpCircle, X, ChevronDown, Search,
  Package, Calendar, Bell, Shield, Mail, Phone, Book
} from 'lucide-react';

const FAQS = [
  {
    q: 'Bagaimana cara menambahkan aset baru?',
    a: 'Buka menu Aset → Daftar Aset, lalu klik tombol "Tambah Aset". Isi formulir (kode, nama, kategori, lokasi, penanggung jawab) dan simpan. Aset baru akan langsung muncul di daftar.',
  },
  {
    q: 'Bagaimana notifikasi pemeliharaan bekerja?',
    a: 'Sistem mengirim notifikasi otomatis H-7, H-3, H-1 sebelum jadwal pemeliharaan, pada hari-H, dan saat terlambat. Notifikasi muncul di ikon lonceng pada kanan atas.',
  },
  {
    q: 'Bagaimana cara mengubah role atau hak akses pengguna?',
    a: 'Hanya Super Admin yang dapat mengelola pengguna. Buka menu Pengguna untuk menambah/mengubah, atau menu Role & Hak Akses untuk mengatur permission per role.',
  },
  {
    q: 'Apa saja role yang tersedia di sistem ini?',
    a: 'Super Admin (akses penuh), HRD (manajemen master data & pengguna terbatas), Direksi (pemeliharaan & laporan), dan Pelaksana (pemeliharaan operasional).',
  },
  {
    q: 'Bagaimana cara menjadwalkan pemeliharaan aset?',
    a: 'Buka menu Pemeliharaan → Jadwal Pemeliharaan, klik "Tambah Jadwal", lalu pilih aset, jenis pemeliharaan, dan tanggal. Sistem akan mengingatkan secara otomatis.',
  },
  {
    q: 'Bagaimana cara logout atau mengganti profil?',
    a: 'Klik avatar profil di pojok kanan atas. Pilih "Profil Saya" untuk mengubah data, atau "Keluar" untuk logout dari sistem.',
  },
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Cari aset, kode, atau serial' },
  { keys: ['Esc'], desc: 'Tutup modal / popup' },
];

export default function HelpModal({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState(null);

  if (!open) return null;

  const filtered = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(query.toLowerCase()) ||
      f.a.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass rounded-xl shadow-soft-lg max-w-2xl w-full max-h-[88vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/15 border border-primary-500/25 flex items-center justify-center">
              <HelpCircle size={20} className="text-primary-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Pusat Bantuan</h2>
              <p className="text-xs text-ink-400">Panduan singkat & FAQ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"
            aria-label="Tutup bantuan"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/5 flex-shrink-0">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari pertanyaan..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:bg-white/[0.08] focus:border-primary-500/50 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Quick links */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
              Menu Cepat
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { icon: Package, label: 'Daftar Aset', color: 'text-primary-300 bg-primary-500/10 border-primary-500/20' },
                { icon: Calendar, label: 'Pemeliharaan', color: 'text-warning-300 bg-warning-500/10 border-warning-500/20' },
                { icon: Bell, label: 'Notifikasi', color: 'text-rose-300 bg-rose-500/10 border-rose-500/20' },
                { icon: Shield, label: 'Profil', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-md border ${item.color}`}
                >
                  <item.icon size={18} />
                  <span className="text-[11px] font-medium text-center">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shortcuts */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
              Pintasan Keyboard
            </p>
            <div className="space-y-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.desc} className="flex items-center justify-between text-sm">
                  <span className="text-ink-300">{s.desc}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="text-[10px] text-ink-300 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 font-mono"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
              Pertanyaan Umum
            </p>
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <Book size={28} className="mx-auto text-ink-700 mb-2" />
                <p className="text-sm text-ink-400">Tidak ada hasil untuk "{query}"</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((f, i) => {
                  const isOpen = openIdx === i;
                  return (
                    <div
                      key={f.q}
                      className="rounded-md border border-white/10 bg-white/[0.02] overflow-hidden"
                    >
                      <button
                        onClick={() => setOpenIdx(isOpen ? null : i)}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-all"
                      >
                        <span className="text-sm font-medium text-white">{f.q}</span>
                        <ChevronDown
                          size={14}
                          className={`text-ink-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-3.5 pb-3 text-sm text-ink-300 leading-relaxed animate-fade-in">
                          {f.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="rounded-md border border-white/10 bg-white/[0.02] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
              Butuh Bantuan Lagi?
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-ink-300">
                <Mail size={14} className="text-ink-500" />
                <span>admin@harmas.co.id</span>
              </div>
              <div className="flex items-center gap-2 text-ink-300">
                <Phone size={14} className="text-ink-500" />
                <span>Hubungi IT Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary w-full">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
