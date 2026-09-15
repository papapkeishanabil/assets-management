-- Tambahkan role Finance jika belum ada
INSERT INTO public.roles (role_name, description)
VALUES ('finance', 'Finance / Keuangan - akses terbatas')
ON CONFLICT (role_name) DO NOTHING;
