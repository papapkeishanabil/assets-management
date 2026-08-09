# TESTING — PPM Test Guide

## Test runner
Semua test PPM adalah skrip Node (ESM) di `scripts/`. Mereka memakai
`scripts/_ppm-env.js` untuk memuat kredensial dari `.env.local`.

| Command | Apa yang diuji | Perlu `SUPABASE_SERVICE_KEY`? |
|---|---|---|
| `npm run test:ppm:m1`    | M1 Product Item + Component (48)        | ya |
| `npm run test:ppm:m1.1`  | M1.1 Default Component Set + Drag (40)  | ya |
| `npm run test:ppm:m2`    | M2/M2.1/M2.2 specs + technical review   | ya |
| `npm run test:ppm`       | aggregate: M1 → M1.1 → M2               | ya |

## Requirement environment
1. Salin `.env.example` → `.env.local`.
2. Isi `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (public).
3. Isi `SUPABASE_SERVICE_KEY` (service_role) + `SUPABASE_ANON_KEY` (publishable)
   untuk keperluan DB + RLS test.
4. `.env.local` adalah **gitignored** — tidak pernah commit.

### Tanpa key
Script akan **abort dengan pesan jelas** (`assertServiceKey()`) dan `exit(1)`.
Jangan biarkan test crash ambigu atau — yang jauh lebih buruk — menggunakan
key yang di-hardcode.

## Test data safety (KRITIS — jangan direvisi)
- Setiap run memakai `TEST_RUN_ID` unik (`__TEST_M1__`, `__TEST_M1_1__`,
  `__TEST_M2__`).
- Cleanup hanya berdasarkan **created ID + marker sweep** — **TIDAK** berdasarkan
  nama bisnis nyata.
- ✅ diizinkan: `WHERE item_name LIKE '%__TEST_M2__%'`
- ❌ dilarang: delete by `"Kemeja ERT"`, `"Celana ERT"`, nomor PO produksi,
  pelanggan `PT WIKA` / `PT AKP`, atau nama apa pun di luar marker.

## Hasil terakhir (verified)
- M1: 48 PASS / 0 FAIL
- M1.1: 40 PASS / 0 FAIL
- M2 + M2.1 + M2.2: 68 + 31 → (`node scripts/test-ppm-m2.js` melaporkan
  68 = 12 M2.1 + 56 M2 core; M2.2 31 PASS dilaporkan terpisah)
- Build: PASS
- Manual responsive browser (Chrome emulation): PASS
- Physical HP device: **NOT TESTED** (DEFERRED sampai staging/Vercel)

## Browser / manual testing
- Gunakan Chrome DevTools responsive → mobile 375px.
- Skenario wajib lihat di `docs/ppm/milestones/M2_2_REPORT.md` ("Manual
  responsive browser: PASS").
- Jika AI tidak dapat membuka browser, laporkan **NOT TESTED** — jangan claim
  PASS.

## Build
```bash
npm run build
```
Harus lulus tanpa error (Vite). Jangan abaikan warning "chunks larger than
500 kB" — itu *warning*, bukan failure.

## Regresi
Setiap milestone baru — termasuk M2.2 — **wajib lolaskan regressi M1, M1.1, M2
sebelum LOCKED**. `npm run test:ppm` adalah regression gabungan.
