-- Correct QR/service authorization for user_profiles.id != auth.users.id.

DROP POLICY IF EXISTS "Active users read asset service records" ON public.asset_service_records;
CREATE POLICY "Active users read asset service records" ON public.asset_service_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);

DROP POLICY IF EXISTS "Active users create asset service records" ON public.asset_service_records;
CREATE POLICY "Active users create asset service records" ON public.asset_service_records FOR INSERT WITH CHECK (
  reported_by IN (
    SELECT up.id FROM public.user_profiles up
    WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
  )
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
  uploaded_by IN (
    SELECT up.id FROM public.user_profiles up
    WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
  )
);

DROP POLICY IF EXISTS "Active users read service photo objects" ON storage.objects;
CREATE POLICY "Active users read service photo objects" ON storage.objects FOR SELECT USING (
  bucket_id = 'asset-service-photos'
  AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);

DROP POLICY IF EXISTS "Active users upload service photo objects" ON storage.objects;
CREATE POLICY "Active users upload service photo objects" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'asset-service-photos'
  AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE')
);

CREATE OR REPLACE FUNCTION public.resolve_asset_qr(p_token UUID) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id
  FROM public.assets a
  WHERE a.qr_token = p_token
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_asset_qr(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_asset_qr(UUID) TO authenticated;
