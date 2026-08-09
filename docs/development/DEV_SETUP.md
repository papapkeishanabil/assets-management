# DEV SETUP — Getting the project running locally

## Prerequisites
- Node.js `>=22.15.0` (lihat `.nvmrc`)
- npm `>=10.9.2`
- Akses ke project Supabase (URL + anon/publishable key + service_role key)

`.nvmrc` berisi versi Node yang **terbukti build + test lulus** di mesin dev.
Jangan naik level utama (mis. Node 20→22) tanpa re-verify build + semua test.

## FIRST TIME (PC baru)

```bash
git clone <repo>
cd harmas-assets-management
nvm use            # atau `nvm install` mengikuti .nvmrc
npm install
```

Buat berkas env lokal (gitignored, **tidak pernah commit**):

```bash
cp .env.example .env.local
# isi:
# VITE_SUPABASE_URL=https://<your-ref>.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
# SUPABASE_SERVICE_KEY=<service_role_jwt>     # hanya untuk tooling Node
# SUPABASE_ANON_KEY=<publishable-key>         # untuk test RLS
```

> `VITE_` prefix hanya untuk kode yang di-bundle Vite (frontend). `SUPABASE_*`
> tanpa prefix hanya dibaca oleh `scripts/_ppm-env.js` (Node tooling).

### Jalankan

```bash
npm run build        # PRODUCTION build
npm run test:ppm     # aggregate regression (M1 -> M1.1 -> M2)
npm run dev          # dev server
```

## EXISTING PC (setelah git pull)

```bash
git pull
nvm use
npm install          # selalu jalankan: package-lock.json bisa update
npm run build
npm run test:ppm     # jika SUPABASE_SERVICE_KEY tersedia
npm run dev
```

## ⚠️ JANGAN

- `npm audit fix --force` — dapat menaikkan major dependency hingga
  Vite 6 / React 19 dan merusak build + regressi. Audit hanya **manual
  review** tiap dependency + regression plan.
- `npm install <pkg>@latest` major upgrade tanpa regression plan.
- Commit `.env` / `.env.local` — lihat `.gitignore`.

## Environment variables reference

| Variable | Digunakan oleh | Aman di-frontend? |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend + tooling | ✅ public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend + tooling | ✅ public (anon) |
| `SUPABASE_SERVICE_KEY` | Node tooling only | ❌ service_role — jangan expose |
| `SUPABASE_ANON_KEY` | Node tooling (RLS test) | ⚠️ gunakan publishable |

Lihat `.env.example` (hanya template, tidak berisi secret).
