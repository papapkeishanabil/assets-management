-- Fase 3: lokasi, foto privat, peta dan retrofit vendor aktif. Additive/idempotent.
-- Tidak menjalankan aktivasi/approval atau menulis master vendors/assets/profil.
-- Rollback TERPISAH: supabase/rollbacks/202611090001_vendor_management_phase3_rollback.sql
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.is_app_role(text[])') IS NULL OR to_regprocedure('public.my_profile_id()') IS NULL THEN
    RAISE EXCEPTION 'Prasyarat hardening v3 belum tersedia';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('vendor_locations','vendor_location_photos')
    AND policyname NOT IN ('Vendor locations read','Vendor locations insert','Vendor locations update','Vendor photos read','Vendor photos insert','Vendor photos update')) THEN
    RAISE EXCEPTION 'Policy lokasi/foto tidak dikenal; audit policy dorman dahulu';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='vendor-photos' AND (public OR file_size_limit IS DISTINCT FROM 5242880
    OR allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg','image/png','image/webp']::text[])) THEN
    RAISE EXCEPTION 'Bucket vendor-photos existing berbeda; jangan mengubah privasi/batasnya diam-diam';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vendor_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.vendor_candidates(id) ON DELETE RESTRICT,
  location_name text NOT NULL CHECK (length(btrim(location_name))>0),
  location_type text NOT NULL CHECK (location_type IN ('RUMAH_PRODUKSI','WORKSHOP_JAHIT','WORKSHOP_BORDIR','PABRIK','GUDANG','TOKO','KANTOR','LAINNYA')),
  is_primary boolean NOT NULL DEFAULT false,
  address_line text, village text, district text, city text, province text, postal_code text,
  latitude decimal(9,6), longitude decimal(10,6), google_place_id text,
  coordinate_source text CHECK (coordinate_source IN ('MANUAL','PICK_ON_MAP','DEVICE_GPS','MAPS_LINK','GEOCODE')),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED','NEEDS_REVISIT','VERIFIED')),
  verified_by uuid REFERENCES public.user_profiles(id), verified_at timestamptz, verification_notes text,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL)=(longitude IS NULL)),
  CHECK (latitude BETWEEN -90 AND 90), CHECK (longitude BETWEEN -180 AND 180),
  CHECK (latitude IS NULL OR coordinate_source IS NOT NULL),
  CHECK ((verification_status='UNVERIFIED')=(verified_by IS NULL AND verified_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_locations_one_primary ON public.vendor_locations(candidate_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_vendor_locations_candidate ON public.vendor_locations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_vendor_locations_city ON public.vendor_locations(city);
CREATE INDEX IF NOT EXISTS idx_vendor_locations_verification ON public.vendor_locations(verification_status);

CREATE TABLE IF NOT EXISTS public.vendor_location_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.vendor_locations(id) ON DELETE RESTRICT,
  storage_path text UNIQUE NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('EXTERIOR','ENTRANCE','PRODUCTION_AREA','MACHINES','WAREHOUSE','OTHER')),
  caption text, taken_at timestamptz,
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id), uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_cover boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0,
  file_mime text NOT NULL CHECK (file_mime IN ('image/jpeg','image/png','image/webp')),
  file_size integer NOT NULL CHECK (file_size BETWEEN 1 AND 5242880),
  is_archived boolean NOT NULL DEFAULT false, archived_by uuid REFERENCES public.user_profiles(id), archived_at timestamptz,
  CHECK (NOT (is_archived AND is_cover)),
  CHECK (is_archived=(archived_by IS NOT NULL AND archived_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_vendor_location_photos_location ON public.vendor_location_photos(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_location_photos_one_cover ON public.vendor_location_photos(location_id) WHERE is_cover AND NOT is_archived;

CREATE OR REPLACE FUNCTION public.vendor_locations_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE trusted boolean := current_user IN ('postgres','supabase_admin'); verification_changed boolean; physical_changed boolean := false;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Lokasi permanen: hapus tidak diizinkan' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('vendor-location:'||NEW.candidate_id::text,0));
    IF NOT EXISTS (SELECT 1 FROM public.vendor_locations WHERE candidate_id=NEW.candidate_id) THEN NEW.is_primary:=true; END IF;
    IF auth.role()='authenticated' THEN NEW.created_by:=public.my_profile_id(); END IF;
    NEW.created_at:=now();
    verification_changed:=NEW.verification_status<>'UNVERIFIED' OR NEW.verified_by IS NOT NULL OR NEW.verified_at IS NOT NULL OR NEW.verification_notes IS NOT NULL;
  ELSE
    IF (NEW.id,NEW.candidate_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.candidate_id,OLD.created_by,OLD.created_at) THEN
      RAISE EXCEPTION 'Identitas dan pembuat lokasi immutable' USING ERRCODE='42501';
    END IF;
    IF OLD.is_primary AND NOT NEW.is_primary AND NOT trusted THEN
      RAISE EXCEPTION 'Ganti lokasi utama melalui vendor_set_primary_location' USING ERRCODE='42501';
    END IF;
    verification_changed:=(NEW.verification_status,NEW.verified_by,NEW.verified_at,NEW.verification_notes) IS DISTINCT FROM (OLD.verification_status,OLD.verified_by,OLD.verified_at,OLD.verification_notes);
    physical_changed:=(NEW.address_line,NEW.village,NEW.district,NEW.city,NEW.province,NEW.postal_code,NEW.latitude,NEW.longitude,NEW.location_type)
      IS DISTINCT FROM (OLD.address_line,OLD.village,OLD.district,OLD.city,OLD.province,OLD.postal_code,OLD.latitude,OLD.longitude,OLD.location_type);
  END IF;
  IF verification_changed AND NOT (trusted OR public.is_app_role(ARRAY['hrd','super_admin'])) THEN
    RAISE EXCEPTION 'Verifikasi lokasi hanya HRD/Super Admin' USING ERRCODE='42501';
  END IF;
  IF physical_changed THEN
    NEW.verification_status:='UNVERIFIED'; NEW.verification_notes:=NULL;
  END IF;
  IF NEW.latitude IS NULL THEN NEW.coordinate_source:=NULL; END IF;
  IF NEW.verification_status='VERIFIED' THEN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL OR nullif(btrim(NEW.address_line),'') IS NULL
      OR nullif(btrim(NEW.city),'') IS NULL OR nullif(btrim(NEW.province),'') IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.vendor_location_photos WHERE location_id=NEW.id AND photo_type='EXTERIOR' AND NOT is_archived) THEN
      RAISE EXCEPTION 'Verifikasi perlu alamat, kota/provinsi, koordinat dan foto exterior aktif';
    END IF;
  END IF;
  IF NEW.verification_status='UNVERIFIED' THEN NEW.verified_by:=NULL; NEW.verified_at:=NULL;
  ELSIF TG_OP='INSERT' OR verification_changed THEN NEW.verified_by:=public.my_profile_id(); NEW.verified_at:=now(); END IF;
  NEW.updated_by:=coalesce(public.my_profile_id(),NEW.updated_by,NEW.created_by); NEW.updated_at:=now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_locations_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_locations_guard ON public.vendor_locations;
CREATE TRIGGER trg_vendor_locations_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_locations FOR EACH ROW EXECUTE FUNCTION public.vendor_locations_guard();

CREATE OR REPLACE FUNCTION public.vendor_photos_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE obj record; c_id uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Foto permanen: arsipkan, jangan hapus riwayat' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT candidate_id INTO c_id FROM public.vendor_locations WHERE id=NEW.location_id;
    PERFORM pg_advisory_xact_lock(hashtextextended('vendor-cover:'||NEW.location_id::text,0));
    IF NEW.storage_path NOT IN (c_id::text||'/'||NEW.location_id::text||'/'||NEW.id::text||'.webp',
      c_id::text||'/'||NEW.location_id::text||'/'||NEW.id::text||'.jpg',c_id::text||'/'||NEW.location_id::text||'/'||NEW.id::text||'.png') THEN
      RAISE EXCEPTION 'Path foto tidak sesuai kandidat/lokasi/id';
    END IF;
    SELECT metadata,coalesce(owner_id,owner::text) AS owner_id INTO obj FROM storage.objects WHERE bucket_id='vendor-photos' AND name=NEW.storage_path;
    IF NOT FOUND OR obj.metadata->>'mimetype' IS DISTINCT FROM NEW.file_mime OR (obj.metadata->>'size')::bigint IS DISTINCT FROM NEW.file_size THEN
      RAISE EXCEPTION 'File belum ada atau metadata ukuran/MIME tidak cocok';
    END IF;
    IF auth.role()='authenticated' THEN
      IF obj.owner_id IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'File harus milik pengunggah' USING ERRCODE='42501'; END IF;
      NEW.uploaded_by:=public.my_profile_id();
    END IF;
    NEW.uploaded_at:=now();
    IF NEW.is_archived THEN RAISE EXCEPTION 'Foto baru tidak boleh langsung diarsipkan'; END IF;
    NEW.archived_by:=NULL; NEW.archived_at:=NULL;
    IF NOT EXISTS (SELECT 1 FROM public.vendor_location_photos WHERE location_id=NEW.location_id AND NOT is_archived) THEN NEW.is_cover:=true; END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['photo_type','caption','taken_at','is_cover','sort_order','is_archived','archived_by','archived_at']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['photo_type','caption','taken_at','is_cover','sort_order','is_archived','archived_by','archived_at']) THEN
      RAISE EXCEPTION 'Identitas/file/pengunggah foto immutable' USING ERRCODE='42501';
    END IF;
    IF (NEW.is_archived,NEW.archived_by,NEW.archived_at) IS DISTINCT FROM (OLD.is_archived,OLD.archived_by,OLD.archived_at) THEN
      IF NOT public.is_app_role(ARRAY['super_admin']) THEN RAISE EXCEPTION 'Arsip foto hanya Super Admin' USING ERRCODE='42501'; END IF;
      IF NEW.is_archived THEN NEW.archived_by:=public.my_profile_id(); NEW.archived_at:=now(); NEW.is_cover:=false;
      ELSE NEW.archived_by:=NULL; NEW.archived_at:=NULL; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_photos_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_photos_guard ON public.vendor_location_photos;
CREATE TRIGGER trg_vendor_photos_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_location_photos FOR EACH ROW EXECUTE FUNCTION public.vendor_photos_guard();

CREATE OR REPLACE FUNCTION public.vendor_location_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c_id uuid;
BEGIN
  IF TG_TABLE_NAME='vendor_locations' THEN c_id:=NEW.candidate_id;
  ELSE SELECT candidate_id INTO c_id FROM public.vendor_locations WHERE id=NEW.location_id; END IF;
  IF TG_OP='INSERT' OR NEW IS DISTINCT FROM OLD THEN
    INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,old_values,new_values,actor_id)
    VALUES(c_id,TG_TABLE_NAME,NEW.id,CASE WHEN TG_TABLE_NAME='vendor_locations' THEN 'location_' ELSE 'location_photo_' END||lower(TG_OP),
      CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),public.my_profile_id());
  END IF;
  -- IF bersarang: record lokasi tidak memiliki field photo_type/is_archived;
  -- resolusi field PL/pgSQL tidak boleh bergantung pada short-circuit AND.
  IF TG_TABLE_NAME='vendor_location_photos' THEN
    IF TG_OP='UPDATE' THEN
      IF OLD.photo_type='EXTERIOR' OR NEW.is_archived THEN
        UPDATE public.vendor_locations SET verification_status='UNVERIFIED',verification_notes=NULL,verified_by=NULL,verified_at=NULL
        WHERE id=NEW.location_id AND verification_status='VERIFIED' AND NOT EXISTS
          (SELECT 1 FROM public.vendor_location_photos WHERE location_id=NEW.location_id AND photo_type='EXTERIOR' AND NOT is_archived);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_location_audit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_locations_audit ON public.vendor_locations;
CREATE TRIGGER trg_vendor_locations_audit AFTER INSERT OR UPDATE ON public.vendor_locations FOR EACH ROW EXECUTE FUNCTION public.vendor_location_audit();
DROP TRIGGER IF EXISTS trg_vendor_photos_audit ON public.vendor_location_photos;
CREATE TRIGGER trg_vendor_photos_audit AFTER INSERT OR UPDATE ON public.vendor_location_photos FOR EACH ROW EXECUTE FUNCTION public.vendor_location_audit();

ALTER TABLE public.vendor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_location_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_locations,public.vendor_location_photos FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.vendor_locations,public.vendor_location_photos TO authenticated;
REVOKE DELETE ON public.vendor_locations,public.vendor_location_photos FROM authenticated;
DROP POLICY IF EXISTS "Vendor locations read" ON public.vendor_locations;
CREATE POLICY "Vendor locations read" ON public.vendor_locations FOR SELECT TO authenticated USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']));
DROP POLICY IF EXISTS "Vendor locations insert" ON public.vendor_locations;
CREATE POLICY "Vendor locations insert" ON public.vendor_locations FOR INSERT TO authenticated WITH CHECK(public.is_app_role(ARRAY['sourcing','hrd','super_admin']));
DROP POLICY IF EXISTS "Vendor locations update" ON public.vendor_locations;
CREATE POLICY "Vendor locations update" ON public.vendor_locations FOR UPDATE TO authenticated USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin'])) WITH CHECK(public.is_app_role(ARRAY['sourcing','hrd','super_admin']));
DROP POLICY IF EXISTS "Vendor photos read" ON public.vendor_location_photos;
CREATE POLICY "Vendor photos read" ON public.vendor_location_photos FOR SELECT TO authenticated USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']));
DROP POLICY IF EXISTS "Vendor photos insert" ON public.vendor_location_photos;
CREATE POLICY "Vendor photos insert" ON public.vendor_location_photos FOR INSERT TO authenticated WITH CHECK(public.is_app_role(ARRAY['sourcing','hrd','super_admin']));
DROP POLICY IF EXISTS "Vendor photos update" ON public.vendor_location_photos;
CREATE POLICY "Vendor photos update" ON public.vendor_location_photos FOR UPDATE TO authenticated USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin'])) WITH CHECK(public.is_app_role(ARRAY['sourcing','hrd','super_admin']));

CREATE OR REPLACE FUNCTION public.vendor_set_primary_location(p_location_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c_id uuid;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN RAISE EXCEPTION 'Akses lokasi utama ditolak' USING ERRCODE='42501'; END IF;
  SELECT candidate_id INTO c_id FROM public.vendor_locations WHERE id=p_location_id;
  IF c_id IS NULL THEN RAISE EXCEPTION 'Lokasi tidak ditemukan'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vendor-location:'||c_id::text,0));
  UPDATE public.vendor_locations SET is_primary=false WHERE candidate_id=c_id AND is_primary AND id<>p_location_id;
  UPDATE public.vendor_locations SET is_primary=true WHERE id=p_location_id AND NOT is_primary;
END $$;
CREATE OR REPLACE FUNCTION public.vendor_set_cover_photo(p_photo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l_id uuid;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN RAISE EXCEPTION 'Akses foto cover ditolak' USING ERRCODE='42501'; END IF;
  SELECT location_id INTO l_id FROM public.vendor_location_photos WHERE id=p_photo_id AND NOT is_archived;
  IF l_id IS NULL THEN RAISE EXCEPTION 'Foto tidak ditemukan/diarsipkan'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vendor-cover:'||l_id::text,0));
  UPDATE public.vendor_location_photos SET is_cover=false WHERE location_id=l_id AND is_cover AND id<>p_photo_id;
  UPDATE public.vendor_location_photos SET is_cover=true WHERE id=p_photo_id AND NOT is_cover;
END $$;

-- K3: hanya menghubungkan master yang SUDAH aktif; tidak membuat master baru,
-- tidak mengubah prospect existing menjadi APPROVED, tidak menulis vendors/aset.
CREATE OR REPLACE FUNCTION public.vendor_link_existing_active(p_vendor_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.vendors%ROWTYPE; c_id uuid; actor uuid;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN RAISE EXCEPTION 'Akses retrofit vendor ditolak' USING ERRCODE='42501'; END IF;
  actor:=public.my_profile_id();
  PERFORM pg_advisory_xact_lock(hashtextextended('vendor-master-link:'||p_vendor_id::text,0));
  SELECT * INTO v FROM public.vendors WHERE id=p_vendor_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master vendor aktif tidak ditemukan'; END IF;
  SELECT id INTO c_id FROM public.vendor_candidates WHERE vendor_id=p_vendor_id ORDER BY created_at,id LIMIT 1;
  IF c_id IS NOT NULL THEN RETURN c_id; END IF;
  INSERT INTO public.vendor_candidates(business_name,business_type,internal_pic_id,process_stage,qualification_status,operational_status,vendor_id,notes,created_by)
  VALUES(v.vendor_name,'USAHA',actor,'CLOSED','APPROVED','ACTIVE',v.id,'Retrofit lokasi master vendor yang sudah aktif; bukan persetujuan/aktivasi kandidat baru.',actor) RETURNING id INTO c_id;
  IF coalesce(nullif(v.contact_person,''),nullif(v.phone_number,''),nullif(v.whatsapp_number,'')) IS NOT NULL THEN
    INSERT INTO public.vendor_contacts(candidate_id,contact_name,phone,whatsapp,email,is_primary,created_by)
    VALUES(c_id,coalesce(nullif(v.contact_person,''),v.vendor_name),v.phone_number,v.whatsapp_number,v.email,true,actor);
  END IF;
  INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,new_values,actor_id)
  VALUES(c_id,'vendor_candidates',c_id,'legacy_vendor_linked',jsonb_build_object('vendor_id',v.id,'reason','K3: lokasi vendor aktif existing'),actor);
  RETURN c_id;
END $$;
REVOKE ALL ON FUNCTION public.vendor_set_primary_location(uuid),public.vendor_set_cover_photo(uuid),public.vendor_link_existing_active(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_set_primary_location(uuid),public.vendor_set_cover_photo(uuid),public.vendor_link_existing_active(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.vendor_location_summary WITH (security_invoker=true) AS
SELECT c.id AS candidate_id,count(l.id) AS location_count,count(l.id) FILTER(WHERE l.latitude IS NOT NULL) AS mapped_count,
  coalesce(bool_or(l.is_primary AND l.latitude IS NOT NULL AND nullif(btrim(l.address_line),'') IS NOT NULL
    AND nullif(btrim(l.city),'') IS NOT NULL AND nullif(btrim(l.province),'') IS NOT NULL AND EXISTS
      (SELECT 1 FROM public.vendor_location_photos p WHERE p.location_id=l.id AND p.photo_type='EXTERIOR' AND NOT p.is_archived)),false) AS is_complete,
  coalesce(bool_or(l.is_primary AND l.verification_status='VERIFIED'),false) AS is_verified
FROM public.vendor_candidates c LEFT JOIN public.vendor_locations l ON l.candidate_id=c.id
WHERE public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']) GROUP BY c.id;

CREATE OR REPLACE VIEW public.vendor_map_points WITH (security_invoker=true) AS
SELECT c.id AS candidate_id,c.candidate_code,c.business_name,c.category_id,cat.name AS category_name,c.internal_pic_id,up.full_name AS pic_name,
  c.process_stage,c.qualification_status,c.operational_status,c.vendor_id,
  ARRAY(SELECT specialty_id FROM public.vendor_candidate_specialties WHERE candidate_id=c.id) AS specialty_ids,
  l.id AS location_id,l.location_name,l.location_type,l.is_primary,l.address_line,l.village,l.district,l.city,l.province,l.postal_code,
  l.latitude,l.longitude,l.verification_status,s.mapped_count,s.is_complete,s.is_verified,
  photo.storage_path AS cover_path,photo.id AS cover_photo_id,
  contact.phone,contact.whatsapp
FROM public.vendor_candidates c
LEFT JOIN public.vendor_locations l ON l.candidate_id=c.id
LEFT JOIN public.vendor_categories cat ON cat.id=c.category_id
LEFT JOIN public.user_profiles up ON up.id=c.internal_pic_id
JOIN public.vendor_location_summary s ON s.candidate_id=c.id
LEFT JOIN LATERAL (SELECT p.id,p.storage_path FROM public.vendor_location_photos p WHERE p.location_id=l.id AND NOT p.is_archived ORDER BY p.is_cover DESC,p.sort_order,p.uploaded_at,p.id LIMIT 1) photo ON true
LEFT JOIN LATERAL (SELECT ct.phone,ct.whatsapp FROM public.vendor_contacts ct WHERE ct.candidate_id=c.id ORDER BY ct.is_primary DESC,ct.created_at,ct.id LIMIT 1) contact ON true
WHERE public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']);
REVOKE ALL ON public.vendor_location_summary,public.vendor_map_points FROM PUBLIC,anon;
GRANT SELECT ON public.vendor_location_summary,public.vendor_map_points TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_location_monitoring(p_category_id uuid DEFAULT NULL,p_pic_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('incomplete',count(*) FILTER(WHERE NOT s.is_complete),'unverified',count(*) FILTER(WHERE s.is_complete AND NOT s.is_verified),
    'verified',count(*) FILTER(WHERE s.is_complete AND s.is_verified),'unmapped',count(*) FILTER(WHERE s.mapped_count=0))
  FROM public.vendor_location_summary s JOIN public.vendor_candidates c ON c.id=s.candidate_id
  WHERE (p_category_id IS NULL OR c.category_id=p_category_id) AND (p_pic_id IS NULL OR c.internal_pic_id=p_pic_id);
$$;
REVOKE ALL ON FUNCTION public.vendor_location_monitoring(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_location_monitoring(uuid,uuid) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('vendor-photos','vendor-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.vendor_photo_valid_path(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT cardinality(string_to_array(p_path,'/'))=3
    AND split_part(p_path,'/',3) ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'
    AND EXISTS(SELECT 1 FROM public.vendor_locations WHERE id::text=split_part(p_path,'/',2) AND candidate_id::text=split_part(p_path,'/',1));
$$;
REVOKE ALL ON FUNCTION public.vendor_photo_valid_path(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_photo_valid_path(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.vendor_photo_can_remove(p_path text,p_owner text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.is_app_role(ARRAY['sourcing','hrd','super_admin'])
    AND (p_owner=auth.uid()::text OR public.is_app_role(ARRAY['super_admin']))
    AND NOT EXISTS(SELECT 1 FROM public.vendor_location_photos WHERE storage_path=p_path);
$$;
REVOKE ALL ON FUNCTION public.vendor_photo_can_remove(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_photo_can_remove(text,text) TO PUBLIC;
-- Predicate bounded, tanpa data/parameter role arbitrer. SECURITY DEFINER
-- mencegah planner policy PUBLIC meminta EXECUTE helper v3 dari role anon.
-- Helper existing is_app_role/my_profile_id tetap tidak dibuka untuk anon.
CREATE OR REPLACE FUNCTION public.vendor_photo_reader()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN false; END IF;
  RETURN public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']);
END $$;
CREATE OR REPLACE FUNCTION public.vendor_photo_upload_allowed(p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN false; END IF;
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN RETURN false; END IF;
  RETURN public.vendor_photo_valid_path(p_path);
END $$;
REVOKE ALL ON FUNCTION public.vendor_photo_reader(),public.vendor_photo_upload_allowed(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_photo_reader(),public.vendor_photo_upload_allowed(text) TO PUBLIC;

-- Restrictive gate mencakup PUBLIC agar policy permissive lama/global tidak
-- membuka bucket baru ini. Semua bucket selain vendor-photos tetap true/utuh.
DROP POLICY IF EXISTS "Vendor storage read gate" ON storage.objects;
CREATE POLICY "Vendor storage read gate" ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING
 (bucket_id<>'vendor-photos' OR public.vendor_photo_reader());
DROP POLICY IF EXISTS "Vendor storage insert gate" ON storage.objects;
CREATE POLICY "Vendor storage insert gate" ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK
 (bucket_id<>'vendor-photos' OR public.vendor_photo_upload_allowed(name));
DROP POLICY IF EXISTS "Vendor storage update gate" ON storage.objects;
CREATE POLICY "Vendor storage update gate" ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(bucket_id<>'vendor-photos') WITH CHECK(bucket_id<>'vendor-photos');
DROP POLICY IF EXISTS "Vendor storage delete gate" ON storage.objects;
CREATE POLICY "Vendor storage delete gate" ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING
 (bucket_id<>'vendor-photos' OR public.vendor_photo_can_remove(name,coalesce(owner_id,owner::text)));
DROP POLICY IF EXISTS "Vendor storage read" ON storage.objects;
CREATE POLICY "Vendor storage read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='vendor-photos' AND public.vendor_photo_reader());
DROP POLICY IF EXISTS "Vendor storage insert" ON storage.objects;
CREATE POLICY "Vendor storage insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='vendor-photos' AND public.vendor_photo_upload_allowed(name));
DROP POLICY IF EXISTS "Vendor storage delete orphan" ON storage.objects;
CREATE POLICY "Vendor storage delete orphan" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='vendor-photos' AND public.vendor_photo_can_remove(name,coalesce(owner_id,owner::text)));
NOTIFY pgrst,'reload schema';
COMMIT;
