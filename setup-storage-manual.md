# Setup Storage untuk Foto Aset (Manual)

Error "must be owner of table objects" terjadi karena tabel `storage.objects` dimiliki oleh Supabase system dan tidak bisa diubah via SQL.

## Langkah-langkah Manual:

### 1. Buka Supabase Dashboard
- Login ke https://supabase.com/dashboard
- Pilih project Anda

### 2. Buat Storage Bucket
- Klik menu **Storage** di sidebar kiri
- Klik tombol **"New bucket"**
- Isi form:
  - **Name**: `assets`
  - **Public bucket**: ✅ ON (centang)
  - **File size limit**: `5 MB`
  - **Allowed MIME types**: `image/png, image/jpeg, image/jpg, image/webp`
- Klik **"Create bucket"**

### 3. Setup RLS Policies
Setelah bucket dibuat:

1. Klik pada bucket **assets** yang baru dibuat
2. Klik tab **"Policies"**
3. Klik **"New policy"**
4. Pilih **"For full customization"**
5. Isi form:

**Policy 1: Public Read Access**
- Policy name: `Public read access`
- Allowed operation: ✅ SELECT
- Target roles: `public`
- USING expression: `bucket_id = 'assets'`

**Policy 2: Authenticated Upload**
- Policy name: `Authenticated upload`
- Allowed operation: ✅ INSERT
- Target roles: `authenticated`
- WITH CHECK expression: `bucket_id = 'assets' AND auth.role() = 'authenticated'`

**Policy 3: Authenticated Delete**
- Policy name: `Authenticated delete`
- Allowed operation: ✅ DELETE
- Target roles: `authenticated`
- USING expression: `bucket_id = 'assets' AND auth.role() = 'authenticated'`

6. Klik **"Review"** lalu **"Save policy"**

### 4. Verifikasi
- Coba upload foto di form aset
- Jika berhasil, setup sudah benar

## Catatan:
- Bucket harus **public** agar foto bisa ditampilkan
- RLS policies diperlukan untuk keamanan
- Setelah setup, fitur upload foto akan berfungsi

## Troubleshooting:
Jika masih error "Bucket not found":
1. Pastikan bucket name exactly `assets` (lowercase)
2. Pastikan bucket sudah di-set sebagai public
3. Clear browser cache (Ctrl+Shift+R)
4. Cek console browser (F12) untuk error detail