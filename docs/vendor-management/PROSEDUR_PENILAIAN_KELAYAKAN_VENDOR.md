# Prosedur penilaian kelayakan calon vendor

Status per 11 November 2026: pendataan, follow-up, lokasi, GPS, foto dan
verifikasi lokasi sudah tersedia di produksi. **Pengujian sampel/QC terstruktur
(Fase 4) selesai diuji lokal, menunggu persetujuan migration/deploy; Fase 5
persetujuan/aktivasi belum diimplementasikan.** Mengganti
tahap proses atau memilih “Menunggu Approval” tidak menghasilkan persetujuan.

| Langkah | Petugas | Pemeriksaan dan bukti | Ketersediaan |
|---|---|---|---|
| 1. Daftarkan kandidat | Sourcing/Resources | Nama usaha, kategori/spesialisasi, kontak, wilayah, PIC internal | Tersedia di Calon Vendor |
| 2. Verifikasi profil dan kemampuan | Sourcing/Resources | Kontak dapat dihubungi, jenis pekerjaan sesuai, kapasitas, MOQ, lead time, harga indikatif dan syarat pembayaran; catat informasi dan tindak lanjut | Profil dan Follow-Up tersedia |
| 3. Survei fasilitas | Sourcing/Resources; verifikasi oleh HRD/Super Admin | Alamat, GPS fasilitas sebenarnya, foto tampak luar/produksi/mesin yang relevan; cek kecocokan lokasi | Lokasi & Foto dan Peta tersedia; Sourcing tidak menetapkan status terverifikasi |
| 4. Uji sampel dan QC | Sourcing mengoordinasikan; petugas QC memeriksa | Brief/spesifikasi, sampel, hasil pemeriksaan, kekurangan dan revisi; setiap pemeriksaan ulang menjadi putaran baru | Fase 4 selesai lokal; belum di produksi |
| 5. Putuskan kelayakan | Direksi/Super Admin | Tinjau hasil profil, lokasi, sampel/QC dan pertimbangan komersial; keputusan Disetujui/Cadangan/Ditolak/Dibekukan disertai alasan | Fase 5, belum tersedia |
| 6. Aktifkan untuk operasional | Approver melalui tindakan aktivasi | Persetujuan sah, lokasi utama/GPS/foto dan syarat QC atau pengecualian beralasan; cek duplikasi master dan relasi aset | Fase 5, belum tersedia |

Rubrik QC Fase 4 mencakup kesesuaian spesifikasi, ukuran/gramasi, hasil
pengerjaan, bahan/warna, finishing, dan fungsi/ketahanan, dengan skor 1–5. Parameter
yang relevan, bobot dan batas lulus harus disepakati manajemen sesuai kategori;
implementasi lokal menghitung nilai berbobot dari rubrik dan memvalidasi batas
lulus yang wajib diisi per pemeriksaan. Belum ada ambang perusahaan yang
ditetapkan otomatis oleh aplikasi. Jika sampel perlu revisi,
vendor memperbaiki dan menjalani pemeriksaan ulang. Lulus QC tetap memerlukan
keputusan manajemen dan tindakan aktivasi terpisah.

Tidak ada role/login QC baru. Dalam Fase 4, Sourcing memasukkan hasil atas
nama pemeriksa QC dengan nama/tanggal pemeriksa, bukti, identitas penginput dan
riwayat koreksi. Sourcing tidak mendapat kewenangan persetujuan akhir.

Panduan layar, alur status sampel, batas akses dan hasil 73 pemeriksaan lokal:
[Fase 4 — kesiapan lokal](PHASE4_LOCAL_READINESS_20261111.md).

Untuk kondisi sekarang, staf dapat melengkapi profil, komunikasi dan lokasi dahulu.
Penilaian sampel/QC formal dilakukan sesuai prosedur internal dengan bukti yang
dipertahankan; jangan menganggap indikator tahap proses sebagai hasil QC digital.

Profil **vendor aktif terhubung**, seperti Agus Kartiwa pada gambar pengguna,
dibuat untuk menghubungkan master vendor yang sudah aktif ke fasilitas/lokasi.
Label “Disetujui/Aktif” pada profil tersebut tidak membuktikan bahwa alur QC baru
telah dijalankan. Profil ini dipertahankan dan dikelompokkan terpisah dari prospek baru.

Rujukan desain: HANDOFF_CODEX.md §8, AUDIT_DAN_RENCANA_IMPLEMENTASI.md bagian C–G.
