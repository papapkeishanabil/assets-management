# Rancangan reminder terjadwal — tahap pengembangan berikutnya

Status: **rancangan saja**, belum mengaktifkan job/extension, membuat akun backend, atau mengubah produksi.

## Mekanisme Fase 2 yang dirilis

Dashboard/halaman Follow-Up melakukan pemeriksaan ketika dibuka atau di-refresh oleh role pengelola yang memiliki module key. Tombol Ingatkan PIC melakukan pemeriksaan yang sama. Tidak ada pengiriman otomatis ketika monitoring tidak digunakan. Hasilnya berupa notifikasi in-app, bukan jaminan email/web push.

Satu kejadian overdue adalah satu pasangan `followup.id + internal_pic_id`. Tanggal tidak menjadi bagian ID notifikasi:

```text
notification.id = md5('vendor-followup:' + followup.id + ':' + internal_pic_id)::uuid
```

`notification_date` tetap mencatat tanggal pengiriman dalam WIB. Karena tugas/deadline/PIC immutable dan tugas terminal tidak dibuka kembali, satu tugas tidak memiliki kejadian overdue kedua. Tindak lanjut baru dibuat sebagai baris baru, sehingga dapat menghasilkan pengingat baru yang sah. Membaca notifikasi tidak mengizinkan pengiriman ulang. Riwayat notifikasi tidak dihapus ketika tugas selesai.

Database menjamin keunikan melalui primary key notifications.id. Insert normal menangkap unique_violation; jangan mengganti dengan ON CONFLICT pada jalur authenticated, karena policy SELECT hanya mengizinkan pembacaan notifikasi penerima sendiri. Deduplikasi berlaku pada request serentak, retry, pengirim berbeda dan pergantian hari. Migrasi Fase 2 belum pernah dijalankan di produksi, sehingga tidak ada konversi notifikasi harian versi prototipe yang perlu dilakukan.

## Arsitektur yang diusulkan

Rekomendasi: job Supabase/Postgres `pg_cron` setiap 15 menit, setelah dukungan extension dan kebijakan hosting diperiksa. Seluruh seleksi dan insert tetap di transaksi database, tanpa service key di browser. Alternatif jika cron database tidak tersedia: endpoint server terproteksi yang dipanggil scheduler hosting. Pilih satu pemicu terjadwal utama; kedua pemicu tetap harus memakai kunci deduplikasi yang sama dengan monitoring.

Alur job:

1. Ambil advisory transaction lock dengan key tetap khusus job reminder vendor. Bila terkunci, hentikan putaran baru; primary key tetap menjadi penjaga terakhir bila job berjalan bersama monitoring.
2. Pilih tugas `OPEN` dengan `next_action_due < now()` dan PIC aktif. Tanggal disimpan timestamptz; gunakan WIB hanya untuk label/tanggal notifikasi.
3. Proses batch terbatas, misalnya 500 tugas. Urutkan deadline/id; kandidat yang telah memiliki notifikasi deterministik tidak perlu diulang pada putaran berikutnya.
4. Gunakan fungsi internal bersama untuk membentuk notifikasi dan ID yang sama. Jangan menduplikasi rumus ID di dua implementasi yang dapat berbeda.
5. Commit insert atomik. Bila proses mati sebelum commit, retry aman; bila sudah commit, primary key mencegah duplikasi.
6. Catat agregat waktu mulai/selesai, jumlah dipindai/dibuat/duplikat/gagal dan error teredaksi pada tabel baru `vendor_reminder_job_runs`. Jangan menyimpan token, isi kontak, atau secret.

Fungsi scheduler baru memerlukan migration additive tersendiri. Fungsi tersebut tidak mengambil candidate/user_id/SQL arbitrer dari pemanggil, memakai nama schema penuh dan search_path terkunci. Bila memakai SECURITY DEFINER, owner dan EXECUTE dibatasi ke konteks backend tepercaya (`postgres`/`service_role` sesuai implementasi yang direview), bukan PUBLIC/anon/authenticated. Tiga policy existing user_profiles/roles/notifications, guard profil dan guard kandidat tetap dipertahankan. RPC monitoring authenticated saat ini tidak dibuka untuk backend dengan menghapus pemeriksaan rolenya.

Pada alternatif endpoint server: autentikasi scheduler dengan secret dari environment server, tidak dari VITE_*; tolak request tanpa secret; gunakan timeout, bounded batch, retry dengan backoff dan status health. Pemasangan scheduler, secret dan akun/otorisasi backend membutuhkan persetujuan terpisah. Tidak ada biaya/provider/integrasi baru yang dipasang oleh pekerjaan Fase 2 ini.

## Acceptance criteria tahap terjadwal

- Tugas menjadi overdue ketika tidak ada pengguna membuka aplikasi → satu notifikasi dibuat paling lambat satu interval job ditambah toleransi eksekusi.
- Dua worker + monitoring + retry serentak → satu notifikasi untuk pasangan tugas/PIC yang sama.
- Putaran berikutnya, hari berikutnya, serta notifikasi yang sudah dibaca → tidak mengirim ulang kejadian sama.
- Tugas selesai/batal atau PIC disabled sebelum pemindaian → tidak dikirim. Bila penutupan bersamaan dengan pengiriman, gunakan lock row tugas atau evaluasi ulang di transaksi untuk menetapkan urutan yang konsisten.
- Crash sebelum/sesudah commit, batas batch >500 dan kelanjutan putaran → tidak hilang atau duplikat.
- UTC/WIB, deadline tepat di batas waktu, aktor audit backend, izin fungsi, dan tidak adanya perubahan tabel existing diuji di Docker terisolasi.
- Error job terpantau; tidak mengaktifkan scheduler sebelum metrik dan cara menonaktifkannya diketahui.

## Gerbang rilis berikutnya

Setelah Fase 1+2 aktif dan teruji, **prioritas user adalah Fase 3: lokasi vendor, GPS, foto workshop/pabrik, Google Maps**. Reminder terjadwal tetap backlog/rancangan sampai prioritas implementasinya disetujui. Persetujuan Fase 2 tidak dianggap sebagai izin mengaktifkan scheduler.
