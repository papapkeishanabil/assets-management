import { useState } from 'react';
import {
  HelpCircle, X, ChevronDown, Search,
  Package, Calendar, Bell, Shield, Mail, Phone, Book,
  Users, FileText, FileSignature, Hash, Upload, Download
} from 'lucide-react';

const FAQS = [
  {
    q: 'Bagaimana cara menambahkan aset baru?',
    a: 'Buka menu Aset → Daftar Aset, lalu klik tombol "Tambah Aset". Isi formulir (kode, nama, kategori, lokasi, penanggung jawab) dan simpan. Aset baru akan langsung muncul di daftar.',
    keywords: ['aset', 'tambah aset', 'asset', 'baru', 'kode aset'],
  },
  {
    q: 'Bagaimana notifikasi pemeliharaan bekerja?',
    a: 'Sistem mengirim notifikasi otomatis H-7, H-3, H-1 sebelum jadwal pemeliharaan, pada hari-H, dan saat terlambat. Notifikasi muncul di ikon lonceng pada kanan atas.',
    keywords: ['notifikasi', 'pemeliharaan', 'jadwal', 'pengingat', 'notifikasi'],
  },
  {
    q: 'Bagaimana cara mengubah role atau hak akses pengguna?',
    a: 'Hanya Super Admin yang dapat mengelola pengguna. Buka menu Pengguna untuk menambah/mengubah, atau menu Role & Hak Akses untuk mengatur permission per role.',
    keywords: ['role', 'akses', 'pengguna', 'user', 'permission', 'admin'],
  },
  {
    q: 'Apa saja role yang tersedia di sistem ini?',
    a: 'Super Admin (akses penuh), HRD (manajemen master data & pengguna terbatas), Direksi (pemeliharaan & laporan), dan Pelaksana (pemeliharaan operasional).',
    keywords: ['role', 'admin', 'hrd', 'direksi', 'pelaksana', 'akses'],
  },
  {
    q: 'Bagaimana cara menjadwalkan pemeliharaan aset?',
    a: 'Buka menu Pemeliharaan → Jadwal Pemeliharaan, klik "Tambah Jadwal", lalu pilih aset, jenis pemeliharaan, dan tanggal. Sistem akan mengingatkan secara otomatis.',
    keywords: ['jadwal', 'pemeliharaan', 'maintenance', 'schedule', 'tambah jadwal'],
  },
  {
    q: 'Bagaimana cara logout atau mengganti profil?',
    a: 'Klik avatar profil di pojok kanan atas. Pilih "Profil Saya" untuk mengubah data, atau "Keluar" untuk logout dari sistem.',
    keywords: ['logout', 'profil', 'keluar', 'ganti profil', 'avatar'],
  },
  {
    q: 'Bagaimana cara menambahkan data karyawan baru?',
    a: 'Buka menu SDM & Kontrak → Data Karyawan, klik "Tambah Karyawan". Pilih Divisi → Departemen → Sub Departemen, isi tanggal masuk, lalu NIK akan di-generate otomatis (14 digit angka). Lengkapi data karyawan dan klik Simpan.',
    keywords: ['karyawan', 'pegawai', 'tambah karyawan', 'data karyawan', 'sdm', 'NIK'],
  },
  {
    q: 'Bagaimana format NIK karyawan?',
    a: 'NIK terdiri dari 14 digit angka: [Divisi 2 digit][Departemen 2 digit][Sub Departemen 2 digit][Tahun 4 digit][Nomor Urut 4 digit]. Contoh: 01010420260001. Nomor urut bersifat global (berdasarkan jumlah keseluruhan karyawan), sehingga unik dan tidak ada yang sama.',
    keywords: ['NIK', 'format NIK', 'nik generator', '14 digit', 'nomor induk'],
  },
  {
    q: 'Bagaimana cara import data karyawan dari Excel/CSV?',
    a: 'Klik "Import Excel" di halaman Data Karyawan. Download template CSV terlebih dahulu, isi data sesuai format (Nama, Divisi, Departemen, Sub Departemen, Tipe, Posisi, Tanggal Masuk, dll). Upload file CSV atau tempel data langsung. NIK akan di-generate otomatis untuk setiap karyawan.',
    keywords: ['import', 'excel', 'csv', 'template', 'upload', 'karyawan'],
  },
  {
    q: 'Bagaimana cara membuat kontrak karyawan/vendor?',
    a: 'Buka menu SDM & Kontrak → Daftar Kontrak, klik "Tambah Kontrak". Pilih jenis kontrak (PKWT, PKWTT, Outsourcing, Vendor, dll), isi pihak terkait (karyawan/vendor), tanggal mulai & akhir, dan nilai kontrak. Sistem akan mengirim notifikasi otomatis sebelum kontrak berakhir.',
    keywords: ['kontrak', 'contract', 'pkwt', 'pkwtt', 'outsourcing', 'vendor', 'tambah kontrak'],
  },
  {
    q: 'Bagaimana notifikasi kontrak bekerja?',
    a: 'Sistem mengirim notifikasi otomatis H-7, H-3, H-1 sebelum kontrak berakhir, pada hari-H, dan saat kontrak sudah lewat. Notifikasi muncul di ikon lonceng dan di dashboard. Kontrak yang akan habis dalam 30 hari juga ditampilkan di dashboard.',
    keywords: ['notifikasi', 'kontrak', 'habis', 'berakhir', 'pengingat'],
  },
  {
    q: 'Bagaimana cara mengelola jenis kontrak?',
    a: 'Buka menu SDM & Kontrak → Jenis Kontrak. Hanya Super Admin dan HRD yang dapat menambah/mengubah jenis kontrak. Jenis kontrak dikategorikan menjadi: Karyawan (PKWT, PKWTT, dll), Vendor (Maintenance, Pengadaan, dll), dan Lainnya.',
    keywords: ['jenis kontrak', 'tipe kontrak', 'kategori kontrak', 'master kontrak'],
  },
  {
    q: 'Siapa yang dapat mengakses menu SDM & Kontrak?',
    a: 'Menu SDM & Kontrak dapat diakses oleh Super Admin dan HRD. Mereka dapat menambah, mengubah, dan menghapus data karyawan serta kontrak. Role lain (Direksi, Pelaksana) tidak memiliki akses ke menu ini.',
    keywords: ['akses', 'sdm', 'kontrak', 'role', 'permission', 'hak akses'],
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

  const filtered = FAQS.filter((f) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      f.q.toLowerCase().includes(q) ||
      f.a.toLowerCase().includes(q) ||
      (f.keywords && f.keywords.some(k => k.includes(q)))
    );
  });

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
                { icon: Users, label: 'SDM & Kontrak', color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
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

          {/* SDM & Kontrak Module Guide */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-indigo-300" />
              <p className="text-sm font-semibold text-indigo-300">Panduan Modul SDM & Kontrak</p>
            </div>
            <div className="space-y-3">
              {/* Data Karyawan */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Users size={14} className="text-indigo-400" />
                  <p className="text-xs font-semibold text-white">1. Data Karyawan</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Klik <b>Tambah Karyawan</b> di halaman Data Karyawan</p>
                  <p>• Pilih <b>Divisi → Departemen → Sub Departemen</b> (dropdown bertingkat)</p>
                  <p>• Isi <b>Tanggal Masuk</b> — NIK auto-generate (14 digit angka)</p>
                  <p>• Lengkapi data: nama, tipe karyawan, posisi, kontak</p>
                  <p>• Klik <b>Simpan</b></p>
                </div>
              </div>
              {/* NIK Generator */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Hash size={14} className="text-indigo-400" />
                  <p className="text-xs font-semibold text-white">2. Format NIK (14 digit)</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• <b>2 digit</b> Divisi (urutan divisi)</p>
                  <p>• <b>2 digit</b> Departemen (urutan departemen)</p>
                  <p>• <b>2 digit</b> Sub Departemen (0 jika tidak ada)</p>
                  <p>• <b>4 digit</b> Tahun masuk</p>
                  <p>• <b>4 digit</b> Nomor urut global (unik per karyawan)</p>
                  <p className="font-mono text-indigo-300 mt-1">Contoh: 01-04-00-2026-0001</p>
                </div>
              </div>
              {/* Import Excel */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Upload size={14} className="text-indigo-400" />
                  <p className="text-xs font-semibold text-white">3. Import Data Karyawan (Excel/CSV)</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Klik <b>Template CSV</b> untuk download format</p>
                  <p>• Isi data: Nama, Divisi, Departemen, Sub Departemen, Tipe, Posisi, Tanggal Masuk, dll</p>
                  <p>• Klik <b>Import Excel</b> → upload file atau tempel data</p>
                  <p>• NIK di-generate otomatis untuk setiap karyawan</p>
                </div>
              </div>
              {/* Daftar Kontrak */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <FileSignature size={14} className="text-indigo-400" />
                  <p className="text-xs font-semibold text-white">4. Daftar Kontrak</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Klik <b>Tambah Kontrak</b> di halaman Daftar Kontrak</p>
                  <p>• Pilih <b>Jenis Kontrak</b> (PKWT, PKWTT, Outsourcing, Vendor, dll)</p>
                  <p>• Pilih <b>Pihak Terkait</b> (karyawan atau vendor)</p>
                  <p>• Isi tanggal mulai & akhir, nilai kontrak</p>
                  <p>• Sistem kirim notifikasi H-7, H-3, H-1 sebelum kontrak berakhir</p>
                </div>
              </div>
              {/* Jenis Kontrak */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <FileText size={14} className="text-indigo-400" />
                  <p className="text-xs font-semibold text-white">5. Jenis Kontrak</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Kelola jenis kontrak di menu <b>Jenis Kontrak</b></p>
                  <p>• Kategori: <b>Karyawan</b> (PKWT, PKWTT, dll), <b>Vendor</b> (Maintenance, Pengadaan), <b>Lainnya</b></p>
                  <p>• Hanya Super Admin & HRD yang dapat mengelola</p>
                </div>
              </div>
              {/* Dashboard */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Download size={14} className="text-indigo-400" />
                  <p className="text-xs font-semibold text-white">6. Dashboard Kontrak</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Dashboard menampilkan <b>Kontrak Akan Habis</b> (30 hari ke depan)</p>
                  <p>• Mini cards: Total Kontrak, Aktif, Akan Habis, Habis</p>
                  <p>• Klik kontrak untuk lihat detail</p>
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Module Guide */}
          <div className="rounded-lg border border-warning-500/20 bg-warning-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-warning-300" />
              <p className="text-sm font-semibold text-warning-300">Panduan Modul Pemeliharaan</p>
            </div>
            <div className="space-y-3">
              {/* Jadwal Pemeliharaan */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Calendar size={14} className="text-warning-400" />
                  <p className="text-xs font-semibold text-white">1. Jadwal Pemeliharaan Rutin</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Buka menu <b>Pemeliharaan → Jadwal Pemeliharaan</b>, klik "Tambah Jadwal"</p>
                  <p>• Pilih <b>Jenis Pemeliharaan</b> (Ganti Oli, Pemeriksaan, Servis Ringan, dll)</p>
                  <p>• Pilih <b>Aset</b> (opsional untuk jenis Kerja Bakti)</p>
                  <p>• Isi <b>Tanggal Pemeliharaan Terakhir</b> dan <b>Kilometer Terakhir</b></p>
                  <p>• Pilih <b>Tipe Penjadwalan</b>: Waktu, Kilometer, atau Keduanya</p>
                  <p>• Set <b>Interval</b>: misal 1 bulan atau 5000 km</p>
                  <p>• Sistem akan menghitung <b>jadwal berikutnya</b> secara otomatis</p>
                  <p>• Klik <b>Simpan</b></p>
                </div>
              </div>
              {/* Riwayat Pelaksanaan */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <FileText size={14} className="text-warning-400" />
                  <p className="text-xs font-semibold text-white">2. Catat Pelaksanaan Pemeliharaan</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Buka <b>Detail Jadwal Pemeliharaan</b></p>
                  <p>• Klik <b>"Catat Pelaksanaan"</b></p>
                  <p>• Isi <b>Tanggal Pelaksanaan</b> dan <b>Hasil Pekerjaan</b></p>
                  <p>• Upload <b>Foto Bukti</b> (maks 5MB per foto)</p>
                  <p>• Klik <b>Simpan Pelaksanaan</b></p>
                  <p>• Jadwal berikutnya akan <b>diperbarui otomatis</b></p>
                </div>
              </div>
              {/* Site Visit */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Package size={14} className="text-warning-400" />
                  <p className="text-xs font-semibold text-white">3. Site Visit (Kunjungan Vendor)</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• <b>Otomatis</b> dibuat ketika status aset diubah menjadi <b>"Dipinjamkan"</b></p>
                  <p>• Trigger akan membuat jadwal <b>Kunjungan Vendor</b> (interval 1 bulan)</p>
                  <p>• Saat mencatat pelaksanaan, isi:</p>
                  <p className="pl-3">- <b>Kondisi Mesin</b> (Baik, Perlu Perhatian, Rusak Ringan, Rusak Berat)</p>
                  <p className="pl-3">- <b>Rekomendasi</b> (Kembalikan ke pabrik, Perbaiki di vendor, Pantau)</p>
                  <p className="pl-3">- <b>Nama Kontak di Vendor</b></p>
                  <p>• Foto bukti kunjungan dapat diupload</p>
                </div>
              </div>
              {/* Kerja Bakti */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Users size={14} className="text-warning-400" />
                  <p className="text-xs font-semibold text-white">4. Kerja Bakti (Pekerjaan Umum)</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Pilih <b>Jenis Pemeliharaan: "Kerja Bakti"</b></p>
                  <p>• <b>Aset opsional</b> — tidak perlu pilih aset untuk pekerjaan umum</p>
                  <p>• Isi <b>Area Lokasi</b> (Kantor, Pabrik, Gudang, Area Produksi, Parkir, Taman)</p>
                  <p>• Isi <b>Jumlah Peserta</b> (berapa orang)</p>
                  <p>• Deskripsi <b>Hasil Pekerjaan</b> (misal: Area produksi A dan B sudah dibersihkan)</p>
                  <p>• Upload <b>Foto Dokumentasi</b></p>
                  <p>• Contoh penggunaan: kebersihan pabrik, pengangkutan sampah, perawatan taman</p>
                </div>
              </div>
              {/* Vendor Contact */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Mail size={14} className="text-warning-400" />
                  <p className="text-xs font-semibold text-white">5. Vendor Contact (Aset di Lokasi Vendor)</p>
                </div>
                <div className="text-xs text-ink-300 leading-relaxed pl-5 space-y-1">
                  <p>• Saat membuat aset dengan <b>Lokasi Vendor</b>, pilih <b>Vendor</b> sebagai penanggung jawab</p>
                  <p>• Isi <b>Nama Kontak di Vendor</b> (orang yang bisa dihubungi)</p>
                  <p>• Kolom ini akan muncul di detail aset untuk memudahkan komunikasi</p>
                </div>
              </div>
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
