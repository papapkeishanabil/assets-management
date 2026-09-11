-- Stable QR tokens and authenticated asset-service reporting.
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS qr_token UUID DEFAULT gen_random_uuid();
UPDATE public.assets SET qr_token = gen_random_uuid() WHERE qr_token IS NULL;
ALTER TABLE public.assets ALTER COLUMN qr_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_qr_token ON public.assets(qr_token);

CREATE TABLE IF NOT EXISTS public.asset_service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  notes TEXT,
  cost NUMERIC(15,2),
  vendor_id UUID REFERENCES public.vendors(id),
  vendor_name VARCHAR(255),
  service_status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (service_status IN ('OPEN','IN_PROGRESS','COMPLETED')),
  reported_by UUID NOT NULL REFERENCES public.user_profiles(id),
  completed_by UUID REFERENCES public.user_profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_service_records_asset ON public.asset_service_records(asset_id, service_date DESC);

CREATE TABLE IF NOT EXISTS public.asset_service_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_record_id UUID NOT NULL REFERENCES public.asset_service_records(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  photo_name VARCHAR(255),
  caption TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.asset_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_service_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users read asset service records" ON public.asset_service_records;
CREATE POLICY "Active users read asset service records" ON public.asset_service_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);
DROP POLICY IF EXISTS "Active users create asset service records" ON public.asset_service_records;
CREATE POLICY "Active users create asset service records" ON public.asset_service_records FOR INSERT WITH CHECK (
  reported_by IN (SELECT up.id FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);
DROP POLICY IF EXISTS "Managers update asset service records" ON public.asset_service_records;
CREATE POLICY "Managers update asset service records" ON public.asset_service_records FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id
  WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE' AND r.role_name IN ('super_admin','hrd')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id
  WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE' AND r.role_name IN ('super_admin','hrd')
));

DROP POLICY IF EXISTS "Active users read asset service photos" ON public.asset_service_photos;
CREATE POLICY "Active users read asset service photos" ON public.asset_service_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);
DROP POLICY IF EXISTS "Active users upload asset service photos" ON public.asset_service_photos;
CREATE POLICY "Active users upload asset service photos" ON public.asset_service_photos FOR INSERT WITH CHECK (
  uploaded_by IN (SELECT up.id FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);

INSERT INTO storage.buckets (id, name, public) VALUES ('asset-service-photos','asset-service-photos',false)
ON CONFLICT (id) DO UPDATE SET public = false;
DROP POLICY IF EXISTS "Active users read service photo objects" ON storage.objects;
CREATE POLICY "Active users read service photo objects" ON storage.objects FOR SELECT USING (
  bucket_id = 'asset-service-photos' AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);
DROP POLICY IF EXISTS "Active users upload service photo objects" ON storage.objects;
CREATE POLICY "Active users upload service photo objects" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'asset-service-photos' AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);

CREATE OR REPLACE FUNCTION public.get_public_asset_by_qr(p_token UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'asset_code',a.asset_code,'asset_name',a.asset_name,'brand',a.brand,'model',a.model,
    'category_name',ac.category_name,'location_name',al.location_name,
    'condition_name',acond.condition_name,'status_name',astat.status_name,'is_active',a.is_active,
    'responsible_name',CASE WHEN al.location_type = 'Lokasi Vendor' THEN COALESCE(v.vendor_name,'-') ELSE COALESCE(
      (SELECT string_agg(ar.responsible_name, ', ' ORDER BY ara.is_primary DESC, ar.responsible_name)
       FROM public.asset_responsible_assignments ara JOIN public.asset_responsibles ar ON ar.id = ara.responsible_id
       WHERE ara.asset_id = a.id), up.full_name, '-') END,
    'photo_url',(SELECT ap.photo_url FROM public.asset_photos ap WHERE ap.asset_id = a.id ORDER BY ap.is_primary DESC, ap.created_at ASC LIMIT 1),
    'repair_in_progress',EXISTS (SELECT 1 FROM public.asset_service_records sr WHERE sr.asset_id = a.id AND sr.service_status IN ('OPEN','IN_PROGRESS')),
    'repair_status',(SELECT sr.service_status FROM public.asset_service_records sr WHERE sr.asset_id = a.id AND sr.service_status IN ('OPEN','IN_PROGRESS') ORDER BY sr.created_at DESC LIMIT 1),
    'repair_date',(SELECT sr.service_date FROM public.asset_service_records sr WHERE sr.asset_id = a.id AND sr.service_status IN ('OPEN','IN_PROGRESS') ORDER BY sr.created_at DESC LIMIT 1),
    'repair_description',(SELECT sr.description FROM public.asset_service_records sr WHERE sr.asset_id = a.id AND sr.service_status IN ('OPEN','IN_PROGRESS') ORDER BY sr.created_at DESC LIMIT 1)
  )
  FROM public.assets a
  LEFT JOIN public.asset_categories ac ON ac.id=a.category_id
  LEFT JOIN public.asset_locations al ON al.id=a.location_id
  LEFT JOIN public.asset_conditions acond ON acond.id=a.condition_id
  LEFT JOIN public.asset_statuses astat ON astat.id=a.status_id
  LEFT JOIN public.vendors v ON v.id=a.vendor_id
  LEFT JOIN public.user_profiles up ON up.id=a.responsible_user_id
  WHERE a.qr_token=p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_asset_qr(p_token UUID) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id FROM public.assets a WHERE a.qr_token=p_token AND EXISTS (
    SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id=auth.uid() AND up.account_status='ACTIVE'
  ) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_asset_by_qr(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_asset_by_qr(UUID) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_asset_qr(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_asset_qr(UUID) TO authenticated;
