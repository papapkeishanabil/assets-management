# Deploy backend melalui Dashboard Supabase

Paket untuk project **uwlxkwyauxwewoexfgwi**, fungsi **admin-update-user**.
Source commit **b5d07ba5**; paket berisi dua file yang sama dengan source teruji.
Tidak mengandung .env atau kredensial. Persetujuan deployment sudah diberikan user.

1. Buka https://supabase.com/dashboard/project/uwlxkwyauxwewoexfgwi/functions .
2. Pilih **Deploy a new function → Via Editor**.
3. Seret file **admin-update-user.zip** di folder ini ke editor. Pastikan muncul
   `index.ts` dan `handler.js` di tingkat yang sama. Entry point: `index.ts`.
4. Nama fungsi harus persis **admin-update-user**. Biarkan **Verify JWT** aktif.
5. Klik **Deploy function**, lalu tunggu status aktif/berhasil.
6. Beri tahu Codex **“Sudah dideploy di Supabase”** agar endpoint dapat diperiksa
   dan frontend staging dipromosikan ke domain utama.

Jangan memakai tombol pengujian untuk mereset password akun bisnis pada tahap ini.
Pemeriksaan endpoint sebelum rilis cukup menggunakan request tanpa akses yang sah;
UAT perubahan akun dilakukan pada target yang disetujui.

Supabase mendokumentasikan unggah ZIP lewat editor pada
[panduan Dashboard](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore#migrating-edge-functions).
Tidak perlu memberikan token atau password Supabase kepada Codex untuk alur ini.
