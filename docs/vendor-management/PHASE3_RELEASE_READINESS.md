# Persiapan rilis Fase 3 — 9 November 2026

Status: **kode/test lokal difinalisasi dalam commit terpisah; produksi belum siap
untuk migration sampai preflight dan backup terbaru terverifikasi**. Migration, push dan
deployment produksi tidak dilakukan pada pekerjaan persiapan ini. Preview frontend
kemudian sudah [READY](PHASE3_PREVIEW_DEPLOYMENT_20261109.md) atas permintaan user;
backend produksi tetap belum dipasang. Hash commit dilaporkan setelah
commit berhasil; isi commit dapat dilihat dengan `git show --stat HEAD`.

## Yang selesai

- Implementasi dan 110 pemeriksaan lokal lulus; build lulus dengan warning bundle
  yang dijelaskan di [laporan implementasi](PHASE3_IMPLEMENTATION_REPORT.md).
- Driver [preflight](../../scripts/preflight-vendor-phase3-production.mjs) dan
  [SQL SELECT statis](../../scripts/sql/vendor-phase3-preflight-readonly.sql) disiapkan.
  Mencakup benturan objek Fase 3, 11 helper/guard/RPC beserta ACL, RLS/policy/trigger,
  kolom retrofit K3, policy/izin Storage, module key, 17 baseline tabel dan orphan.
- Driver [backup PostgreSQL](../../scripts/backup-vendor-phase3-production.ps1)
  memakai PGPASSWORD dari environment, host/user project HARMAS tetap, SSL dan
  transaksi SELECT `READ ONLY`. Tidak membaca kunci dari file legacy.
- Dump custom menyertakan ownership/ACL, hash SHA-256, daftar archive, metadata
  preflight dan manifest ke direktori baru di luar repo. Dump di dalam repo ditolak.
  `PreflightOnly` tidak membuat dump. Tidak ada perintah restore atau migration otomatis.
- SQL preflight diuji pada Docker sintetis, parser PowerShell/JavaScript lulus dan
  guard password kosong menolak sebelum koneksi/penulisan file. Lihat
  [bukti pemeriksaan tooling](phase3-evidence/RELEASE_TOOL_CHECKS.txt).
- Lima uji reviewer offline lulus: snapshot kompatibel sintetis, benturan tabel,
  perubahan ACL anon, drift checksum dan snapshot kedaluwarsa. Seluruh fixture/output
  sintetis berada di TEMP, tidak membuat hasil produksi palsu. Bukti:
  [reviewer test](phase3-evidence/PREFLIGHT_REVIEWER_TEST_RESULTS.txt).

Uji SQL tooling awal mengasumsikan 11 fungsi tersedia lokal; fixture Docker memang
tidak menyediakan `exec_sql`. Ekspektasi lokal dikoreksi menjadi daftar 10 fungsi
yang tersedia. Ekspektasi produksi tetap 11; query SQL sudah dapat dieksekusi lokal.
Fixture reviewer offline awal juga dilengkapi dengan agregat bucket/baseline sintetis
sebelum lima skenario final lulus; tidak menggunakan data hasil preflight baru produksi.
Skrip backup belum diuji melalui koneksi produksi atau menghasilkan dump baru.

## Yang masih tertunda

Sesi alat belum memiliki `PGPASSWORD`. User memilih menyediakan PGPASSWORD melalui
lingkungan terminal, kemudian menegaskan **PostgreSQL langsung dengan PGPASSWORD saja**;
jalur service key/RPC dihapus dari tooling baru. Jangan meminta nilainya di chat.
Pengisian pada terminal lain tidak otomatis memperbarui environment proses alat ini;
skrip dapat dijalankan dari terminal yang sudah memiliki variabel tersebut.

Upaya mengambil service key dari file legacy ditolak pemeriksaan persetujuan otomatis
karena dinilai sebagai pengambilan kredensial dari sumber tidak standar dan tidak
tercakup izin saat ini. Perintah tidak dieksekusi. Tidak mencoba jalur lain untuk
mengambil key yang sama. Alternatif aman: kredensial yang disediakan user melalui
environment, atau koneksi PostgreSQL langsung menggunakan PGPASSWORD.

**Preflight produksi belum dijalankan dan backup baru belum dibuat.** Tidak ada
`PRODUCTION_PREFLIGHT.json` hasil baru yang diklaim lulus. Snapshot produksi Fase 1+2
sebelumnya tetap bukti historis dan tidak menggantikan preflight Fase 3.

## Menjalankan dari PowerShell yang memiliki PGPASSWORD

Jalankan dari root repo. Password database adalah password koneksi PostgreSQL
project HARMAS, bukan publishable key. Contoh ini meminta input tersembunyi dan
menghapus environment sesi setelah selesai; jangan mengganti dengan password literal.

```powershell
$securePassword = Read-Host 'Password PostgreSQL HARMAS' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
try {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/backup-vendor-phase3-production.ps1 -PreflightOnly
  if ($LASTEXITCODE -ne 0) { throw 'Preflight gagal; jangan lanjutkan backup/rilis' }
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/backup-vendor-phase3-production.ps1
  if ($LASTEXITCODE -ne 0) { throw 'Backup gagal; jangan lanjutkan rilis' }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Variable securePassword -ErrorAction SilentlyContinue
}
```

`ExecutionPolicy Bypass` hanya untuk proses skrip yang direview; tidak mengubah
kebijakan PowerShell mesin. Perintah tetap tidak menjalankan migration. Folder default
`D:\Backups\harmas-pre-phase3-<timestamp>-<id>\`; tidak meng-overwrite backup lama.
Kredensial tidak disertakan dalam argumen pg_dump, manifest atau repo. Setelah selesai,
laporkan lokasi manifest saja, tanpa password/dump di chat.

Driver memakai snapshot konsisten pg_dump sendiri. Snapshot metadata sebelum/selesai
bukan snapshot yang diekspor bersama dump; **kecocokan isi dump wajib dibuktikan saat
restore**. Aktivitas pengguna yang terjadi saat backup harus ditinjau jika checksum
berbeda. Manifest sengaja tetap `ready_for_production_migration=false` setelah dump.

## Verifikasi sesudah dump, sebelum meminta izin migration

1. Verifikasi hash dan daftar archive, lalu restore ke Supabase terisolasi yang
   kompatibel dengan versi/extension produksi. Jangan restore ke stack fixture lama
   atau project produksi. Cocokkan tabel, jumlah/checksum, FK/orphan, policy/RLS,
   trigger/helper/ACL, sequence dan identitas sesuai scope backup.
2. Pisahkan salinan blob Storage dan inventarisnya. Dump database hanya memuat
   metadata Storage, bukan berkas. Verifikasi ukuran/hash dan download pada salinan
   terisolasi. Jangan menyebut backup lengkap tanpa verifikasi ini.
3. Uji migration Fase 3 di hasil restore. Backup Fase 2 sebelumnya mengalami error
   extension pg_cron/pg_net/vault pada postgres:17 standar; jangan mengulang klaim
   restore platform penuh dari lingkungan yang tidak kompatibel.
4. Review preflight terbaru dan verifikasi backup. Baru minta izin eksplisit untuk
   satu migration Fase 3. Setelah verifikasi DB/RLS, minta izin terpisah push/deploy.
5. Google Maps tetap memerlukan API key/Map ID; fallback daftar dapat dirilis lebih
   dulu. UAT ponsel/GPS dan Google nyata belum dilaksanakan.

File environment, dump, raw data dan kredensial tidak masuk commit. Pekerjaan lain
di `.superdesign/` dan `scripts/check-finance-policies.js` dibiarkan utuh.
