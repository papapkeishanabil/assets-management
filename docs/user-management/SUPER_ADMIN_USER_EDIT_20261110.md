# Super Admin: edit identitas dan password pengguna

Status 10 November 2026: **backend dideploy pengguna sebagai smooth-task; frontend disiapkan untuk rilis sesuai persetujuan**.
Ruang lingkup dikoreksi user menjadi pengelolaan pengguna lain oleh Super Admin,
bukan penambahan self-service pada Profil Saya. Perubahan awal self-service yang
belum di-commit sudah dibatalkan; halaman Profil Saya dan AuthContext tidak berubah.
Pemeriksaan endpoint produksi hanya tanpa sesi/token palsu. Tidak ada penulisan akun produksi, push Git, migration atau perubahan RLS.

## Cara menggunakan

Pada **Pengguna**, setiap baris memiliki dua tombol baru:

1. **Edit Identitas**: nama lengkap, email login, telepon/WhatsApp, departemen,
   subdepartemen dan jabatan. Email login disinkronkan dengan Supabase Auth.
2. **Ubah Password**: masukkan password baru dan konfirmasi, lalu simpan. Password
   lama tidak diperlukan dan tidak dapat dibaca. Pengguna memakai password baru
   saat login berikutnya; pengiriman password dilakukan admin di luar aplikasi.

Role, status akun, persetujuan dan tautan ke Auth tidak diubah lewat kedua form ini.
Kontrol role/status existing tetap terpisah. Password tidak dikirim bersama form
identitas, tidak disimpan di user_profiles/localStorage dan tidak dikembalikan API.
Nilai password dihapus ketika form ditutup atau berhasil disimpan. Field memakai
autocomplete new-password, tombol tampil/sembunyi, validasi konfirmasi dan batas
8–128 karakter; kebijakan tambahan Auth tetap berlaku.

## Implementasi dan otorisasi

| File | Fungsi |
|---|---|
| `src/pages/UsersPage.jsx` | Tombol per baris dan guard halaman Super Admin existing |
| `src/components/AdminUserEditModal.jsx` | Dua mode form, validasi, loading, retry, Escape/focus dan tampilan mobile |
| `src/lib/admin-user-helpers.js` | Pemanggilan fungsi serta pesan error/network/backend belum tersedia |
| `supabase/functions/admin-update-user/index.ts` | Adapter Edge dengan SDK dipin ke 2.110.8; secret dibaca dari env bawaan Supabase |
| `supabase/functions/admin-update-user/handler.js` | Otorisasi server, validasi input/target, perubahan Auth/profil dan log audit |
| `scripts/test-admin-user-management.mjs` | Integrasi Auth/PostgREST, role, kegagalan sinkronisasi dan browser lokal |

Alur: browser mengirim access token pengguna ke **Edge Function smooth-task** (source folder admin-update-user).
Backend memvalidasi token dengan Auth getUser, lalu membaca **role dan status akun
terkini dari database**. Hanya profile ACTIVE dengan role super_admin diterima.
Metadata user, role dari body dan Auth user ID dari browser tidak dipercaya.
Target ditentukan melalui profile_id dan tautan auth_user_id yang dibaca di backend.

Reset memakai [Supabase Auth Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
Service role hanya tersedia di backend melalui env, tidak dimasukkan ke bundle
browser. Input memakai allowlist; upaya menyisipkan role_id, status, approval atau
auth_user_id ditolak. Departemen/subdepartemen divalidasi hubungannya. Reset password
tidak mengaktifkan akun nonaktif atau mengganti role. Tidak mengklaim semua access
token/sesi lama otomatis dicabut seketika; perilaku sesi mengikuti Auth.

Endpoint hanya menerima POST/OPTIONS, respons no-store dan error tidak berisi stack,
request body, password atau secret. Log terstruktur mencatat request ID, actor
profile, target profile, tindakan, hasil dan nama field yang berubah; bukan nilainya.
Log ini bukan tabel audit baru dan retensinya mengikuti platform. Audit native Auth
tetap berjalan melalui API resmi; tidak ada SQL langsung ke auth.users.

## Sinkronisasi email dan konflik

Pengubahan email oleh Super Admin langsung menetapkan email login yang dikonfirmasi.
UI memberi keterangan bahwa email baru berlaku untuk login berikutnya. Pastikan
alamat yang dimasukkan memang benar; fitur ini bukan alur verifikasi email mandiri.

Auth dan profil publik adalah dua API terpisah, sehingga perubahan email tidak
merupakan satu transaksi database. Handler:

- Menolak form dengan updated_at yang sudah berubah, dan menulis timestamp baru.
- Memutakhirkan Auth, kemudian profil dengan kondisi ID/Auth ID/timestamp lama.
- Jika profil gagal, mengembalikan perubahan Auth selama versinya belum berubah lagi.
- Jika ada perubahan Auth/profil serentak, tidak memulihkan snapshot identitas lama dan mengembalikan HTTP 409
  needs_review dengan instruksi memeriksa email login. Tidak mengembalikan sukses palsu.

Kondisi gagal/serentak diuji terhadap Auth nyata lokal dengan fault injection pada
write profil. Password memiliki tindakan terpisah, tanpa rangkaian sinkronisasi ini.

## Bukti pengujian

**22/22 kelompok uji PASS**, [RESULTS.json](evidence/RESULTS.json).

| Skenario | Bukti |
|---|---|
| Tanpa token/token palsu | 401 sebelum mutasi |
| HRD, Direksi, Sourcing, Pelaksana, Finance, SA tidak aktif | 403 |
| Role diubah setelah sesi dibuat | Role database terkini dipakai; tetap ditolak |
| Unknown fields/Auth ID palsu/target hilang | Ditolak, tidak mengubah akun |
| Password pendek/kosong/konfirmasi berbeda | Tidak tersimpan; mismatch UI tidak mengirim request |
| Identitas/organisasi | Tersimpan pada target, role/status/approval/Auth link utuh |
| Form stale | 409 |
| Email berubah | Profil/Auth sama; login email baru berhasil, email lama gagal |
| Email duplikat | Ditolak, profil tetap |
| Write profil gagal sesudah Auth | Kompensasi Auth berhasil; login alamat semula masih valid |
| Auth berubah serentak | Perubahan baru dipertahankan, 409 needs_review |
| Profil berubah serentak | Tidak mengembalikan snapshot Auth lama; 409 needs_review untuk pemeriksaan |
| Reset password | Password baru berhasil login, password sebelumnya gagal; akun lain utuh |
| UI end-to-end | Browser → handler backend → Auth/PostgREST Docker → baris pengguna diperbarui |
| Backend belum tersedia | Pesan jelas, draft tetap ada; retry berhasil sesudah endpoint tersedia |
| Cancel/Escape/mobile/guard | Batal tidak menulis, 390px tanpa overflow, HRD ditolak dari /users |
| Audit/error | Actor/target tercatat tanpa password; nol pageerror/request ke Supabase produksi |
| Cleanup | 9 akun sementara dihapus, checksum **14 tabel** kembali identik termasuk Auth users/identities |

Stack Docker sintetis menggunakan schema organisasi pendukung yang dibuat hanya
jika belum ada. Sesudah pengujian, tabel/kolom pendukung baru tersebut dikembalikan
ke keadaan semula. Tidak ada schema atau fixture produksi yang diubah.

Uji backend/injeksi kegagalan memanggil handler Web Request/Response yang sama,
dengan Supabase Auth/PostgREST nyata Docker. Uji browser final meneruskan path fungsi
lokal ke **entrypoint Deno asli**, SDK 2.110.8 yang dipin, dengan koneksi runtime
dibatasi ke Docker loopback. **Deno 2.9.6 check entrypoint exit 0**, dan penyimpanan
identitas/password melalui browser → Deno → Docker berhasil. Runtime lokal kemudian
dihentikan. Fungsi cloud dideploy pengguna sebagai smooth-task dan penolakan request tanpa otorisasi sudah diperiksa; belum ada UAT mutasi akun produksi.

`npm run build` exit 0; warning bundle utama existing >500 kB tetap ada. Scan bundle
frontend menemukan **0 kredensial privat/service-role JWT**. Hash sumber/artifact:
[VERIFICATION_SUMMARY.json](evidence/VERIFICATION_SUMMARY.json).
Screenshot data sintetis: [edit identitas](evidence/admin-identity-desktop.png),
[ubah password mobile](evidence/admin-password-mobile.png).

## Catatan rilis

Tidak perlu migration baru; kolom profil/organisasi sudah menjadi schema aplikasi
existing. Rilis harus mencakup **fungsi Supabase smooth-task (source admin-update-user) dan frontend**:

1. Verifikasi project Supabase HARMAS dan kredensial deployment yang sudah tersedia;
   jangan mengambil service key produksi dari file legacy atau meminta password di chat.
2. Deploy fungsi baru menggunakan env bawaan platform dan pemeriksaan token aktif.
   Jangan mengubah atau melemahkan policy RLS existing.
3. Verifikasi runtime/gateway dan penolakan akses tanpa token. UAT mutasi akun
   produksi memerlukan akun target dan izin yang sesuai; jangan mengganti password
   akun bisnis hanya untuk melakukan pengujian.
4. Build/stage/deploy frontend sesuai prosedur rilis Vercel existing, dengan validasi
   konfigurasi publik Supabase. Hash dan deployment final dicatat dalam laporan rilis.
5. Super Admin membuka Pengguna dan mencoba fungsi pada akun yang disetujui.

Push Git juga belum dijalankan. User sudah menyetujui deployment fitur ini. Rollback frontend dapat kembali ke deployment sebelumnya;
penghapusan/penonaktifan fungsi baru dan perubahan produksi lain tetap melalui
persetujuan. Jangan menjalankan ulang migration vendor untuk fitur pengguna ini.
