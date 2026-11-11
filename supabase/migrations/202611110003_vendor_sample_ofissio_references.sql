-- Ofissio catalog references: immutable at sample creation; no existing data rewrite.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.vendor_sample_qc_runs') IS NULL OR to_regclass('public.vendor_decisions') IS NULL THEN
  RAISE EXCEPTION 'Fase 4 dan 5 harus terpasang terlebih dahulu';
 END IF;
 IF to_regclass('public.vendor_sample_product_references') IS NOT NULL AND obj_description(to_regclass('public.vendor_sample_product_references'),'pg_class') IS DISTINCT FROM 'HARMAS Ofissio sample reference 202611110003' THEN
  RAISE EXCEPTION 'Objek referensi produk tidak dikenal; review manual diperlukan';
 END IF;
 IF EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename='vendor_sample_product_references' AND policyname<>'Vendor product reference read') THEN
  RAISE EXCEPTION 'Policy referensi produk tidak dikenal';
 END IF;
 IF EXISTS(SELECT FROM storage.buckets WHERE id='vendor-product-references' AND (public OR file_size_limit IS DISTINCT FROM 5242880 OR allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg','image/png','image/webp'])) THEN
  RAISE EXCEPTION 'Bucket referensi produk existing tidak cocok';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vendor_sample_product_references(
 sample_id uuid PRIMARY KEY REFERENCES public.vendor_samples(id) ON DELETE RESTRICT,
 source text NOT NULL DEFAULT 'OFISSIO' CHECK(source='OFISSIO'),
 product_id text NOT NULL CHECK(product_id ~ '^wc-[0-9]+$'),
 product_code text NOT NULL CHECK(length(btrim(product_code)) BETWEEN 1 AND 100),
 product_name text NOT NULL CHECK(length(btrim(product_name)) BETWEEN 1 AND 300),
 material text NOT NULL CHECK(length(material)<=500),
 product_url text NOT NULL CHECK(product_url ~ '^https://ofissio\.com/product/[a-z0-9-]+$'),
 source_image_url text NOT NULL CHECK(source_image_url ~ '^https://woo\.ofissio\.com/wp-content/uploads/[A-Za-z0-9_./%~-]+\.(webp|png|jpe?g)$'),
 image_path text NOT NULL UNIQUE,
 image_sha256 text NOT NULL CHECK(image_sha256 ~ '^[0-9a-f]{64}$'),
 image_mime text NOT NULL CHECK(image_mime IN ('image/jpeg','image/png','image/webp')),
 image_size integer NOT NULL CHECK(image_size BETWEEN 1 AND 5242880),
 request_payload jsonb NOT NULL CHECK(jsonb_typeof(request_payload)='object'),
 captured_by uuid NOT NULL REFERENCES public.user_profiles(id),
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE public.vendor_sample_product_references IS 'HARMAS Ofissio sample reference 202611110003';
REVOKE ALL ON public.vendor_sample_product_references FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vendor_sample_product_references TO authenticated;
GRANT SELECT,INSERT ON public.vendor_sample_product_references TO service_role;
ALTER TABLE public.vendor_sample_product_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor product reference read" ON public.vendor_sample_product_references;
CREATE POLICY "Vendor product reference read" ON public.vendor_sample_product_references FOR SELECT TO authenticated
 USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']));

CREATE OR REPLACE FUNCTION public.vendor_product_reference_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Acuan produk permanen; buat sampel terkait baru' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION public.vendor_product_reference_immutable() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_product_reference_immutable ON public.vendor_sample_product_references;
CREATE TRIGGER trg_vendor_product_reference_immutable BEFORE UPDATE OR DELETE ON public.vendor_sample_product_references
 FOR EACH ROW EXECUTE FUNCTION public.vendor_product_reference_immutable();

CREATE OR REPLACE FUNCTION public.vendor_sample_reference_code_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.product_code IS DISTINCT FROM OLD.product_code AND EXISTS(SELECT FROM public.vendor_sample_product_references WHERE sample_id=OLD.id) THEN
  RAISE EXCEPTION 'Kode produk acuan dikunci; buat sampel terkait baru' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_sample_reference_code_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_sample_reference_code_guard ON public.vendor_samples;
CREATE TRIGGER trg_vendor_sample_reference_code_guard BEFORE UPDATE ON public.vendor_samples
 FOR EACH ROW EXECUTE FUNCTION public.vendor_sample_reference_code_guard();

-- Only a verified server request may create a reference. Existing sample guards/audits still run.
CREATE OR REPLACE FUNCTION public.vendor_create_ofissio_sample(p_actor_auth_id uuid,p_sample jsonb,p_reference jsonb,p_request_id uuid)
RETURNS public.vendor_samples LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid;role_name text;s public.vendor_samples%ROWTYPE;r public.vendor_sample_product_references%ROWTYPE;request_value jsonb;candidate uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Hanya backend terverifikasi' USING ERRCODE='42501'; END IF;
 SELECT p.id,roles.role_name INTO actor,role_name FROM public.user_profiles p JOIN public.roles ON roles.id=p.role_id
 WHERE p.auth_user_id=p_actor_auth_id AND p.account_status='ACTIVE';
 IF actor IS NULL OR role_name NOT IN ('sourcing','hrd','super_admin') OR (role_name<>'super_admin' AND NOT EXISTS(SELECT FROM public.user_profiles p JOIN public.role_permissions rp ON rp.role_id=p.role_id WHERE p.id=actor AND rp.module_key='vendor_samples' AND rp.can_access)) THEN
  RAISE EXCEPTION 'Akses sampel ditolak' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_sample) IS DISTINCT FROM 'object' OR jsonb_typeof(p_reference) IS DISTINCT FROM 'object'
 OR EXISTS(SELECT FROM jsonb_object_keys(p_sample) k WHERE k NOT IN ('candidate_id','sample_type','brief','material_source','quantity','unit','cost','internal_pic_id','assigned_at','target_date','received_at','notes','revision_note','related_sample_id'))
 OR EXISTS(SELECT FROM jsonb_object_keys(p_reference) k WHERE k NOT IN ('id','sku','name','material','product_url','image_url','image_path','image_sha256','image_mime','image_size')) THEN
  RAISE EXCEPTION 'Payload referensi tidak valid';
 END IF;
 request_value:=jsonb_build_object('sample',p_sample,'product_id',p_reference->>'id','sku',p_reference->>'sku');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,611110003));
 SELECT * INTO r FROM public.vendor_sample_product_references WHERE sample_id=p_request_id;
 IF FOUND THEN
  IF r.captured_by<>actor OR r.request_payload IS DISTINCT FROM request_value THEN RAISE EXCEPTION 'Permintaan sudah digunakan dengan data berbeda' USING ERRCODE='40001';END IF;
  SELECT * INTO s FROM public.vendor_samples WHERE id=r.sample_id;RETURN s;
 END IF;
 candidate:=(p_sample->>'candidate_id')::uuid;
 PERFORM 1 FROM public.vendor_candidates WHERE id=candidate AND archived_at IS NULL FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kandidat tidak tersedia/diarsipkan' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT FROM public.vendor_samples WHERE id=p_request_id) THEN RAISE EXCEPTION 'ID sampel sudah digunakan' USING ERRCODE='40001';END IF;
 IF p_reference->>'image_path' IS DISTINCT FROM (candidate::text||'/'||p_request_id::text||'/'||(p_reference->>'image_sha256')||(CASE p_reference->>'image_mime' WHEN 'image/webp' THEN '.webp' WHEN 'image/png' THEN '.png' WHEN 'image/jpeg' THEN '.jpg' ELSE '.invalid' END)) THEN
  RAISE EXCEPTION 'Path foto acuan tidak valid';
 END IF;
 IF NOT EXISTS(SELECT FROM storage.objects WHERE bucket_id='vendor-product-references' AND name=p_reference->>'image_path'
 AND (metadata->>'size')::bigint=(p_reference->>'image_size')::bigint AND metadata->>'mimetype'=p_reference->>'image_mime') THEN
  RAISE EXCEPTION 'Salinan foto acuan belum tersedia';
 END IF;
 INSERT INTO public.vendor_samples(id,candidate_id,sample_type,product_code,brief,material_source,quantity,unit,cost,internal_pic_id,assigned_at,target_date,received_at,notes,revision_note,related_sample_id,status,created_by,updated_by)
 VALUES(p_request_id,candidate,p_sample->>'sample_type',p_reference->>'sku',p_sample->>'brief',p_sample->>'material_source',(p_sample->>'quantity')::numeric,p_sample->>'unit',(p_sample->>'cost')::numeric,(p_sample->>'internal_pic_id')::uuid,(p_sample->>'assigned_at')::timestamptz,(p_sample->>'target_date')::date,(p_sample->>'received_at')::timestamptz,p_sample->>'notes',p_sample->>'revision_note',(p_sample->>'related_sample_id')::uuid,'BRIEF_DIBUAT',actor,actor) RETURNING * INTO s;
 INSERT INTO public.vendor_sample_product_references(sample_id,product_id,product_code,product_name,material,product_url,source_image_url,image_path,image_sha256,image_mime,image_size,request_payload,captured_by)
 VALUES(s.id,p_reference->>'id',p_reference->>'sku',p_reference->>'name',p_reference->>'material',p_reference->>'product_url',p_reference->>'image_url',p_reference->>'image_path',p_reference->>'image_sha256',p_reference->>'image_mime',(p_reference->>'image_size')::integer,request_value,actor) RETURNING * INTO r;
 INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,new_values,actor_id)
 VALUES(candidate,'vendor_sample_product_references',s.id,'sample_product_reference_saved',jsonb_build_object('sample_code',s.sample_code,'source',r.source,'product_code',r.product_code,'image_sha256',r.image_sha256,'captured_at',r.captured_at),actor);
 RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.vendor_create_ofissio_sample(uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_create_ofissio_sample(uuid,jsonb,jsonb,uuid) TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('vendor-product-references','vendor-product-references',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.vendor_product_reference_storage_read(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']) AND EXISTS(SELECT FROM public.vendor_sample_product_references WHERE image_path=p_path);
$$;
REVOKE ALL ON FUNCTION public.vendor_product_reference_storage_read(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_product_reference_storage_read(text) TO PUBLIC;
DROP POLICY IF EXISTS "Vendor product reference files read gate" ON storage.objects;
CREATE POLICY "Vendor product reference files read gate" ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
 USING(bucket_id<>'vendor-product-references' OR public.vendor_product_reference_storage_read(name));
DROP POLICY IF EXISTS "Vendor product reference files insert gate" ON storage.objects;
CREATE POLICY "Vendor product reference files insert gate" ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(bucket_id<>'vendor-product-references');
DROP POLICY IF EXISTS "Vendor product reference files update gate" ON storage.objects;
CREATE POLICY "Vendor product reference files update gate" ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(bucket_id<>'vendor-product-references') WITH CHECK(bucket_id<>'vendor-product-references');
DROP POLICY IF EXISTS "Vendor product reference files delete gate" ON storage.objects;
CREATE POLICY "Vendor product reference files delete gate" ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING(bucket_id<>'vendor-product-references');
DROP POLICY IF EXISTS "Vendor product reference files read" ON storage.objects;
CREATE POLICY "Vendor product reference files read" ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='vendor-product-references' AND public.vendor_product_reference_storage_read(name));
COMMIT;
