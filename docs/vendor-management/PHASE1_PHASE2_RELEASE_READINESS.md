# Kesiapan rilis terintegrasi Manajemen Vendor Fase 1 + Fase 2

Tanggal: 6 November 2026 (WIB). **Migration produksi, push Git dan deployment BELUM dilakukan.** Backup baru sebelum Fase 2 juga belum dibuat; dokumen ini menyiapkan langkah dan gerbang persetujuannya.

Commit lokal Fase 2 menggunakan pesan persis:

```text
feat(vendor): implement phase 2 sourcing followup and dashboard
```

Hash commit tersedia pada laporan akhir chat dan `git log -1 --format=fuller`; tidak ditanam ke file di dalam commit yang sama. Commit harus memuat hanya kode/dokumen/pengujian Vendor, tanpa .env/kredensial atau file unrelated. Fase 1 sudah ada pada riwayat lokal sampai `2596bbba`; tidak perlu menjalankan ulang migration Fase 1 di produksi.

## Keputusan kesiapan

**Secara teknis siap diajukan untuk migration produksi Fase 2**, berdasarkan uji lokal dan review read-only objek produksi. **Belum boleh dieksekusi** sebelum backup baru berhasil diverifikasi dan user memberi persetujuan eksplisit migration. Push dan deploy memerlukan persetujuan tersendiri; keduanya tidak dijalankan oleh laporan ini.

| Pemeriksaan | Hasil / bukti |
|---|---|
| SQL lokal setelah finalisasi | 71 PASS / 0 FAIL — [log](PHASE2_LOCAL_TEST_RESULTS.txt) |
| Browser/REST lokal setelah finalisasi | 20 PASS / 0 FAIL — [log](phase2-evidence/BROWSER_RESULTS.txt) |
| Build frontend Fase 1+2 | Lulus — [output build](PHASE2_BUILD_RESULTS.txt); warning bundle >500 kB tetap ada |
| Perbandingan objek produksi dengan lokal | 8 pemeriksaan lulus — [hasil review](PHASE2_READINESS_CHECKS.txt) |
| Snapshot produksi pertama | SELECT saja; transaksi dipaksa rollback — [metadata](PHASE2_PRODUCTION_READONLY.json) |
| Snapshot produksi kedua | Metadata, policy, definisi fungsi dan checksum identik — [recheck](PHASE2_PRODUCTION_READONLY_RECHECK.txt) |
| Backup baru sebelum migration | **Belum dilakukan**, harus dipenuhi pada jendela rilis |
| Migration produksi / push / deploy | **Belum dilakukan; menunggu persetujuan terpisah** |

## Hasil final review migration

- File yang diajukan: [202611060001_vendor_management_phase2.sql](../../supabase/migrations/202611060001_vendor_management_phase2.sql). Rollback berada di [supabase/rollbacks](../../supabase/rollbacks/202611060001_vendor_management_phase2_rollback.sql), di luar runner migration otomatis.
- Hanya menambah/mengelola objek Fase 2: vendor_followups, sequence, indeks, policy, trigger serta dua RPC. Tidak mengubah data/schema/policy vendors, assets, user_profiles, roles, role_permissions, employees atau contracts. Migration tidak membuat notifikasi; RPC membuat INSERT baru hanya saat monitoring digunakan setelah rilis.
- Prasyarat is_app_role/my_profile_id tersedia. Bila vendor_followups berisi policy yang tidak dikenal, migration **gagal sebelum mengaktifkan RLS**, sehingga policy dorman tidak ikut menyala diam-diam. Tidak menjalankan hardening lama yang memiliki DROP helper CASCADE.
- Produksi belum memiliki tabel/sequence/RPC Fase 2: tidak ada benturan nama. Semua kolom reminder dan primary key notifications.id tersedia. Tidak ada CHECK notification_type yang menolak tipe baru.
- RLS aktif pada 10 tabel yang diperiksa. Delapan policy user_profiles/roles/notifications dan seluruh policy pipeline terkait yang dibandingkan identik **beserta ekspresinya** dengan lokal; tidak hanya nama. Policy fixture `test read profiles` dikecualikan karena hanya ada di lokal.
- Enam definisi helper/guard/audit yang dibandingkan identik produksi–lokal. Trigger guard profil/kandidat/audit aktif. is_app_role/my_profile_id SECURITY DEFINER dengan search_path terkunci; anon tidak bisa mengeksekusinya. exec_sql tetap tidak dapat dieksekusi anon/authenticated.
- Sourcing, HRD dan Super Admin menulis follow-up; Direksi membaca. Guard Fase 1 tetap melarang APPROVED/ACTIVE melalui UPDATE langsung, termasuk Super Admin. Tidak menambah role QC.
- Sourcing/Direksi memiliki module key vendor_management dan vendor_followups di produksi. Super Admin memakai bypass frontend yang sah. HRD belum memiliki vendor_followups; penambahan akses HRD hanya bila user memutuskan melalui UI role.
- Riwayat follow-up immutable selain task_status/completed_at. Hasil keterhubungan juga immutable. Aktor/timestamp ditetapkan server; perubahan status memiliki old/new dan aktor pada vendor_activity_logs. Tugas selesai/batal tidak dapat dibuka ulang.
- Reminder menggunakan ID deterministik **per tugas/PIC, tanpa tanggal**; refresh, request serentak, retry dan pergantian hari tidak mengirim ulang kejadian sama. Rumus key yang sama wajib dipakai scheduler mendatang.

## Baseline produksi pada pemeriksaan read-only

| Data | Jumlah |
|---|---:|
| vendors | 10 |
| assets | 55 |
| assets.vendor_id terisi | 16 |
| relasi aset–vendor yatim | 0 |
| user_profiles | 6 |
| employees | 44 |
| contracts | 27 |
| roles | 6 |
| role_permissions | 152 |
| notifications | 115 |
| vendor_candidates | 0 |

Kedua probe memiliki checksum sama pada sembilan tabel, termasuk notifikasi dan kandidat. Tidak membuat akun uji produksi atau menjalankan RPC reminder di produksi. Pemeriksaan ini adalah snapshot; ulangi baseline saat backup/migration bila aplikasi sudah berubah sejak pemeriksaan.

## Definisi metrik dashboard

Semua metrik memakai himpunan kandidat yang sama setelah filter kategori dan PIC pemilik kandidat. Tidak ada filter rentang waktu pada Fase 2; metrik adalah sepanjang riwayat.

| Metrik | Definisi |
|---|---|
| Total kandidat unik | Count baris vendor_candidates, satu id dihitung sekali |
| Vendor dengan upaya kontak | Kandidat unik yang memiliki setidaknya satu log follow-up |
| Vendor berhasil dihubungi | Kandidat unik yang memiliki minimal satu contact_outcome=TERHUBUNG |
| Aktivitas follow-up | Count baris vendor_followups; bukan jumlah vendor |
| Tahap proses | Count kandidat menurut process_stage; kandidat tepat pada satu tahap |
| Tugas terbuka / overdue / selesai / batal | Count tugas menurut task_status; overdue hanya OPEN dengan deadline < now() |
| Produktivitas PIC: aktivitas dan vendor | Berdasarkan created_by pencatat; vendor DISTINCT per PIC |
| Produktivitas PIC: tugas | Berdasarkan internal_pic_id penanggung jawab tugas, terpisah dari pencatat |
| Sampel/QC | Count kandidat berdasarkan tahap proses sampai Fase 4; bukan jumlah sampel/QC aktual |
| Kelengkapan lokasi | Belum dinilai sampai Fase 3; tidak mengarang angka |

Semua PIC Sourcing aktif ditampilkan meskipun nol aktivitas. PIC dengan kontribusi atau tugas juga ditampilkan beserta perannya (misalnya admin). Satu vendor yang dicatat beberapa PIC muncul pada tiap baris PIC; jangan menjumlahkan kolom vendor per PIC untuk memperoleh total vendor unik global.

Field hasil keterhubungan ditambahkan agar istilah “berhasil dihubungi” tidak disimpulkan dari adanya log. Pilihan: TERHUBUNG/TIDAK_TERHUBUNG/BELUM_DINILAI. Data lama pada iterasi lokal tetap belum dinilai; tidak diklasifikasi otomatis sebagai berhasil. Pada produksi tabel Fase 2 belum ada.

## Integrasi frontend dan perlindungan modul existing

- `/vendors` tetap Master Data → Vendor dengan VendorsPage dan HRDRoute existing. File VendorsPage tidak diubah, query master tidak dialihkan ke kandidat.
- `/vendor`, `/vendor/database`, `/vendor/database/:id`, `/vendor/followups` memakai tabel vendor_* dan guard role/module key. Penantian loading permission mencegah redirect sebelum hasil permission tersedia.
- Smoke test browser Super Admin membuka Master Vendor dan menghitung seluruh vendor sintetis, tanpa mencampur kandidat pipeline; checksum vendors/assets tidak berubah.
- Sourcing dan Super Admin dapat membuka dashboard/follow-up; Direksi tidak mendapat tombol tulis; URL langsung HRD tanpa module key ditolak. Semua diuji dengan akun lokal yang sudah ada.
- Tidak mengubah API aset, routing Master Vendor, tabel existing, dependency, konfigurasi Vercel atau service worker. Perbaikan layout terbatas pada menu vendor, ID sidebar dan clipping dekorasi viewport/mobile.
- Tidak menguji seluruh CRUD modul aset/SDM/kontrak di browser produksi. Checklist smoke test pascarilis tetap wajib; bukti lokal tidak menggantikan pemeriksaan produksi setelah persetujuan.

## Urutan rilis dan gerbang persetujuan

1. **Commit lokal Fase 2** dengan pesan di atas, setelah pengujian dan scan staged diff. Jangan stage `.superdesign/`, `scripts/check-finance-policies.js`, .env atau kredensial. Jangan push.
2. **Final review** commit, hash migration, frontend Fase 1+2 dan snapshot keamanan. Dokumen/bukti saat ini memenuhi langkah ini; bila kode atau database berubah, review ulang bagian terkait.
3. **Backup terbaru sebelum migration.** Pilih jendela minim aktivitas; capture baseline baru dan konfirmasi host/project produksi. Jangan memakai ulang dump 4/5 November sebagai satu-satunya backup rilis ini.
4. **Verifikasi backup** melalui listing, checksum SHA-256 dan restore penuh ke database Docker baru yang terisolasi. Lulus gate restore sebelum mengajukan eksekusi.
5. **Persetujuan eksplisit migration**, lalu jalankan hanya file Fase 2 yang direview dalam transaksi. Hentikan bila prasyarat/objek/policy berbeda. Jangan menjalankan seluruh folder historis migration lewat db push/reset.
6. **Verifikasi database/RLS produksi**: tabel/kolom/indeks/policy/trigger/RPC/ACL, data existing dan relasi aset. Bandingkan baseline; akun real tidak dipakai untuk test destruktif tanpa izin.
7. **Persetujuan terpisah push dan deployment.** Periksa terlebih dahulu apakah push branch utama otomatis memicu deployment. Jika iya, perlakukan push sebagai tindakan yang bisa merilis frontend: jangan push dengan izin “push saja” bila deployment belum disetujui. Verifikasi repo/branch/commit/project/environment sebelum tindakan apa pun.
8. **Deploy frontend Fase 1+2 sebagai satu versi** setelah migration lolos; uji akun Super Admin dan Sourcing yang sudah ditentukan user. Tidak membuat akun privilese baru tanpa izin. Setelah lolos, prioritas berikutnya adalah Fase 3 lokasi/GPS/foto/Maps.

Panduan deployment digunakan hanya untuk menyiapkan urutan ini; tidak ada Vercel command, perubahan konfigurasi CI atau deployment yang dijalankan.

## Backup dan cara verifikasi yang diperlukan

- Gunakan database dump custom format postgres:17, host pooler HARMAS yang telah dipakai sebelumnya (`aws-0-ap-southeast-1.pooler.supabase.com:6543`, user `postgres.uwlxkwyauxwewoexfgwi`). Pastikan kredensial DB berasal dari env `PGPASSWORD` dalam sesi, bukan literal command, source code, atau file yang di-commit.
- Simpan dump bertimestamp jelas, misalnya `D:\Backups\harmas-<tanggal-jam-WIB>-pre-vendor-phase2.dump`, di luar repo; directory tujuan harus diverifikasi sebelum penulisan. Jangan menimpa backup existing.
- Untuk container pg_dump, teruskan `--env PGPASSWORD` tanpa nilai literal di argumen; mount folder backup yang sudah diverifikasi. Jangan mencetak password/key pada log atau menyimpan kredensial ke evidence.
- Pastikan pg_dump exit 0 dan file berukuran wajar; hitung SHA-256; `pg_restore --list` harus sukses. Listing saja belum dianggap verifikasi penuh.
- Buat container/database baru yang namanya khusus verifikasi backup, tidak memakai project Supabase produksi atau stack aplikasi lain. Siapkan role yang diperlukan dump (`anon`, `authenticated`, `service_role`, dan role lain bila daftar restore memerlukannya), lalu restore penuh sesuai prosedur backup sebelumnya.
- Verifikasi hasil restore terhadap snapshot backup yang konsisten: jumlah/checksum tabel kritis, 16 relasi aset-vendor atau nilai baseline terbaru, 0 orphan, RLS/policy/guard/helper/ACL, dan objek Fase 1. Jika aplikasi masih aktif menulis, jangan menyamakan snapshot dump dengan SELECT terpisah tanpa memperhitungkan waktunya.
- Simpan bukti hash dump, hasil restore dan baseline di laporan rilis tanpa data/kredensial sensitif. Pertahankan file dump; pembersihan container verifikasi hanya setelah target absolut/nama diperiksa dan bukti dipertahankan.
- Backup/restore belum dijalankan pada finalisasi ini. Akses password database atau lokasi backup yang tidak tersedia harus diselesaikan sebelum gate migration; jangan mengganti dengan backup lama yang belum memuat keadaan terbaru.

## Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Frontend baru dirilis sebelum migration | Gate migration + verifikasi dahulu; halaman baru membutuhkan tabel/RPC Fase 2 |
| Policy/helper berubah setelah snapshot | Probe ulang saat rilis, bandingkan definisi; stop bila drift atau policy asing |
| Push memicu deploy otomatis | Periksa integrasi Git sebelum push; izin deploy harus sudah ada bila autodeploy aktif |
| PWA menampilkan bundle lama | Verifikasi hard refresh/registrasi SW dan sumber asset versi baru sesudah deploy |
| Bundle ~1,2 MB | Build lulus; pantau first load. Code splitting tetap backlog, bukan perubahan mendadak saat rilis |
| Salah menafsirkan metrik | Label vendor DISTINCT, aktivitas, tugas dan peran pencatat/PIC dibedakan; outcome eksplisit |
| Reminder dianggap selalu otomatis | UI/dokumen menyebut pemeriksaan saat monitoring dipakai; [rancangan terjadwal](PHASE2_SCHEDULED_REMINDER_DESIGN.md) belum diaktifkan |
| Penulisan saat smoke test | Pakai data kandidat uji yang ditandai dan disetujui; append-only tetap permanen; jangan membuat data dummy tanpa scope yang jelas |
| Rollback menghilangkan riwayat follow-up | Pulihkan frontend lebih dahulu jika aman; pertahankan schema additive bila tidak perlu drop. SQL rollback hanya dengan izin dan backup baru |

## Checklist pascamigration dan pascadeployment

Database (setelah izin migration):

- [ ] Objek Fase 2 sesuai file/hash yang direview; policy hanya 3 yang diharapkan, tidak ada policy DELETE.
- [ ] Helper/guard/policy existing tetap sama; anon/authenticated tetap tidak dapat exec_sql.
- [ ] Sourcing insert/tutup tugas sah; edit isi/hasil/PIC/tanggal dan DELETE ditolak; Direksi hanya baca.
- [ ] Guard APPROVED/ACTIVE tetap menolak semua UPDATE langsung app role termasuk Super Admin.
- [ ] created_by/at, completed_at dan audit old/new benar; data existing dan relasi aset tidak berubah.

Frontend (setelah izin push/deploy):

- [ ] Build yang dirilis sesuai commit yang disetujui; env Supabase menunjuk project yang benar; service key tidak ada pada bundle.
- [ ] Super Admin: dashboard, Database Calon Vendor, detail, follow-up, form dan audit dapat digunakan.
- [ ] Sourcing: menu dan URL sesuai permission; tiga aktivitas pada satu kandidat tetap dihitung satu vendor; penutupan tugas benar.
- [ ] Metrik unik, outcome, tahap, aktivitas, tugas dan produktivitas PIC sesuai query verifikasi.
- [ ] Reminder satu per kejadian tugas/PIC; refresh/dua tab/pergantian hari tidak menduplikasi; tautan notifikasi benar.
- [ ] Direksi tanpa tombol tulis; role tanpa module key ditolak; anon tidak membaca data internal.
- [ ] Master Data → Vendor tetap menampilkan vendor aktif existing; kandidat tidak masuk dropdown vendor aset/kontrak.
- [ ] Smoke test baca daftar/detail aset, 16 relasi vendor atau baseline terbaru, SDM/kontrak, notifikasi dan akses role existing.
- [ ] Desktop/mobile dark/light, loading/empty/error, modal keyboard dan refresh PWA berfungsi.
- [ ] Catat hasil, masalah dan keputusan go/no-go; setelah lolos, lanjutkan perencanaan **Fase 3** atas instruksi user.

Tidak satu pun checkbox produksi di atas dianggap sudah dilakukan berdasarkan hasil lokal.
