-- Phase 5: explicit management decision and activation. Migration itself never writes master data.
-- Only the validated activation RPC may INSERT a new vendor; existing vendors/assets are never updated.
BEGIN;
DO $$ DECLARE t text; BEGIN
 IF to_regprocedure('pg_catalog.sha256(bytea)') IS NULL THEN RAISE EXCEPTION 'PostgreSQL SHA-256 diperlukan untuk fingerprint bukti';END IF;
 IF to_regclass('public.vendor_sample_qc_runs') IS NULL OR to_regprocedure('public.vendor_record_sample_qc(uuid,jsonb,uuid,timestamptz)') IS NULL THEN RAISE EXCEPTION 'Fase 4 harus terpasang lebih dahulu';END IF;
 FOREACH t IN ARRAY ARRAY['vendor_decisions','vendor_activations','vendor_decision_code_seq','vendor_activation_master_code_seq'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL AND obj_description(to_regclass('public.'||t),'pg_class') IS DISTINCT FROM 'HARMAS vendor phase5 202611110002' THEN RAISE EXCEPTION 'Objek Fase 5 tidak dikenal: %',t;END IF;
 END LOOP;
 IF EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename IN ('vendor_decisions','vendor_activations') AND policyname<>'Vendor phase5 read') THEN RAISE EXCEPTION 'Policy Fase 5 tidak dikenal; review dahulu';END IF;
 IF EXISTS(SELECT FROM storage.buckets WHERE id='vendor-decision-files' AND (public OR file_size_limit IS DISTINCT FROM 5242880 OR allowed_mime_types IS DISTINCT FROM ARRAY['application/pdf','image/jpeg','image/png','image/webp'])) THEN RAISE EXCEPTION 'Bucket keputusan existing berbeda';END IF;
END $$;
CREATE SEQUENCE IF NOT EXISTS public.vendor_decision_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.vendor_activation_master_code_seq;
REVOKE ALL ON SEQUENCE public.vendor_decision_code_seq,public.vendor_activation_master_code_seq FROM PUBLIC,anon,authenticated;
COMMENT ON SEQUENCE public.vendor_decision_code_seq IS 'HARMAS vendor phase5 202611110002';
COMMENT ON SEQUENCE public.vendor_activation_master_code_seq IS 'HARMAS vendor phase5 202611110002';
CREATE TABLE IF NOT EXISTS public.vendor_decisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),decision_no bigint NOT NULL UNIQUE,decision_code text NOT NULL UNIQUE,
 candidate_id uuid NOT NULL REFERENCES public.vendor_candidates(id) ON DELETE RESTRICT,
 decided_by uuid NOT NULL REFERENCES public.user_profiles(id),decided_at timestamptz NOT NULL,
 decision text NOT NULL CHECK(decision IN ('APPROVED','RESERVE','REJECTED','FROZEN')),
 basis_reason text NOT NULL CHECK(length(btrim(basis_reason)) BETWEEN 10 AND 5000),scope_limit text,
 sample_ref_id uuid REFERENCES public.vendor_samples(id),qc_ref_id uuid REFERENCES public.vendor_sample_qc_runs(id),
 effective_from date NOT NULL,reeval_date date CHECK(reeval_date>=effective_from),follow_up_action text,pic_id uuid REFERENCES public.user_profiles(id),proof_path text,
 override_reason text CHECK(override_reason IS NULL OR length(btrim(override_reason)) BETWEEN 10 AND 2000),
 basis_snapshot jsonb NOT NULL,basis_token text NOT NULL,missing_checks text[] NOT NULL,
 request_id uuid NOT NULL UNIQUE,request_payload jsonb NOT NULL,created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vendor_decisions_latest ON public.vendor_decisions(candidate_id,decision_no DESC);
CREATE TABLE IF NOT EXISTS public.vendor_activations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL UNIQUE REFERENCES public.vendor_candidates(id) ON DELETE RESTRICT,
 decision_id uuid NOT NULL REFERENCES public.vendor_decisions(id),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 created_master boolean NOT NULL,activated_by uuid NOT NULL REFERENCES public.user_profiles(id),activated_at timestamptz NOT NULL,
 basis_snapshot jsonb NOT NULL,master_snapshot jsonb NOT NULL,previous_status jsonb NOT NULL
);
COMMENT ON TABLE public.vendor_decisions IS 'HARMAS vendor phase5 202611110002';
COMMENT ON TABLE public.vendor_activations IS 'HARMAS vendor phase5 202611110002';
CREATE OR REPLACE FUNCTION public.vendor_phase5_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP<>'INSERT' OR NOT coalesce(auth.role()='service_role' OR current_user IN ('postgres','supabase_admin'),false) THEN RAISE EXCEPTION 'Keputusan/aktivasi permanen: gunakan tindakan tervalidasi; catat keputusan baru untuk koreksi' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_phase5_immutable() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_decisions_immutable ON public.vendor_decisions;
CREATE TRIGGER trg_vendor_decisions_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_decisions FOR EACH ROW EXECUTE FUNCTION public.vendor_phase5_immutable();
DROP TRIGGER IF EXISTS trg_vendor_activations_immutable ON public.vendor_activations;
CREATE TRIGGER trg_vendor_activations_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_activations FOR EACH ROW EXECUTE FUNCTION public.vendor_phase5_immutable();
ALTER TABLE public.vendor_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_activations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_decisions,public.vendor_activations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vendor_decisions,public.vendor_activations TO authenticated;
DROP POLICY IF EXISTS "Vendor phase5 read" ON public.vendor_decisions;
CREATE POLICY "Vendor phase5 read" ON public.vendor_decisions FOR SELECT TO authenticated USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']));
DROP POLICY IF EXISTS "Vendor phase5 read" ON public.vendor_activations;
CREATE POLICY "Vendor phase5 read" ON public.vendor_activations FOR SELECT TO authenticated USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']));

CREATE OR REPLACE FUNCTION public.vendor_phase5_phone(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN digits LIKE '0062%' THEN substring(digits FROM 3) WHEN digits LIKE '0%' THEN '62'||substring(digits FROM 2) ELSE digits END FROM (SELECT regexp_replace(coalesce(p_text,''),'[^0-9]','','g') digits) q;
$$;
REVOKE ALL ON FUNCTION public.vendor_phase5_phone(text) FROM PUBLIC,anon,authenticated;

-- Internal, role-bounded public RPC below. Snapshot all approval-relevant input, not just stage labels.
CREATE OR REPLACE FUNCTION public.vendor_phase5_state(p_candidate_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.vendor_candidates%ROWTYPE;loc public.vendor_locations%ROWTYPE;basis jsonb;contacts jsonb;photos jsonb;samples jsonb;matches jsonb;checks jsonb;
 normalized_name text;phones text[];match_ok boolean;qc_ok boolean;exterior_ok boolean;identity_ok boolean;contact_ok boolean;
BEGIN
 SELECT * INTO c FROM public.vendor_candidates WHERE id=p_candidate_id;IF NOT FOUND THEN RAISE EXCEPTION 'Kandidat tidak ditemukan' USING ERRCODE='P0002';END IF;
 SELECT * INTO loc FROM public.vendor_locations WHERE candidate_id=c.id AND is_primary;
 SELECT coalesce(jsonb_agg(to_jsonb(ct) ORDER BY ct.is_primary DESC,ct.created_at,ct.id),'[]') INTO contacts FROM public.vendor_contacts ct WHERE candidate_id=c.id;
 SELECT coalesce(array_agg(DISTINCT n) FILTER(WHERE length(n) BETWEEN 8 AND 15),ARRAY[]::text[]) INTO phones FROM public.vendor_contacts ct CROSS JOIN LATERAL (VALUES(public.vendor_phase5_phone(ct.phone)),(public.vendor_phase5_phone(ct.whatsapp))) v(n) WHERE candidate_id=c.id;
 contact_ok:=cardinality(phones)>0 AND EXISTS(SELECT FROM public.vendor_contacts ct WHERE ct.candidate_id=c.id AND length(btrim(ct.contact_name))>=2 AND (length(public.vendor_phase5_phone(ct.phone)) BETWEEN 8 AND 15 OR length(public.vendor_phase5_phone(ct.whatsapp)) BETWEEN 8 AND 15));
 identity_ok:=length(btrim(c.business_name)) BETWEEN 2 AND 255 AND EXISTS(SELECT FROM public.vendor_categories WHERE id=c.category_id AND is_active);
 normalized_name:=regexp_replace(lower(btrim(c.business_name)),'[^[:alnum:]]','','g');
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'vendor_code',v.vendor_code,'vendor_name',v.vendor_name,'is_active',v.is_active,
  'exact_name',regexp_replace(lower(btrim(v.vendor_name)),'[^[:alnum:]]','','g')=normalized_name,
  'phone_match',public.vendor_phase5_phone(v.phone_number)=ANY(phones) OR public.vendor_phase5_phone(v.whatsapp_number)=ANY(phones),
  'other_candidate_id',(SELECT id FROM public.vendor_candidates WHERE vendor_id=v.id AND id<>c.id ORDER BY created_at,id LIMIT 1),
  'master',to_jsonb(v)) ORDER BY v.id),'[]') INTO matches FROM public.vendors v
 WHERE v.id=c.vendor_id OR regexp_replace(lower(btrim(v.vendor_name)),'[^[:alnum:]]','','g')=normalized_name OR public.vendor_phase5_phone(v.phone_number)=ANY(phones) OR public.vendor_phase5_phone(v.whatsapp_number)=ANY(phones);
 match_ok:=CASE WHEN c.vendor_id IS NOT NULL THEN jsonb_array_length(matches)=1 AND (matches->0->>'id')::uuid=c.vendor_id AND (matches->0->>'is_active')::boolean AND matches->0->>'other_candidate_id' IS NULL
 ELSE jsonb_array_length(matches)=0 OR (jsonb_array_length(matches)=1 AND (matches->0->>'exact_name')::boolean AND (matches->0->>'phone_match')::boolean AND (matches->0->>'is_active')::boolean AND matches->0->>'other_candidate_id' IS NULL) END;
 SELECT coalesce(jsonb_agg(jsonb_build_object('photo',to_jsonb(p),'file_exists',EXISTS(SELECT FROM storage.objects WHERE bucket_id='vendor-photos' AND name=p.storage_path)) ORDER BY p.id),'[]'),
 coalesce(bool_or(p.photo_type='EXTERIOR' AND EXISTS(SELECT FROM storage.objects WHERE bucket_id='vendor-photos' AND name=p.storage_path)),false) INTO photos,exterior_ok FROM public.vendor_location_photos p WHERE location_id=loc.id AND NOT is_archived;
 SELECT coalesce(jsonb_agg(jsonb_build_object('sample_id',s.id,'sample_code',s.sample_code,'status',s.status,'updated_at',s.updated_at,'latest_qc',to_jsonb(q)) ORDER BY s.id),'[]'),
 count(*)>0 AND coalesce(bool_and(s.status='SELESAI' AND coalesce(q.decision='LULUS' AND q.avg_score>=q.pass_mark,false)),false) INTO samples,qc_ok
 FROM public.vendor_samples s LEFT JOIN LATERAL(SELECT r.* FROM public.vendor_sample_qc_runs r WHERE sample_id=s.id ORDER BY run_no DESC LIMIT 1) q ON true
 WHERE s.candidate_id=c.id AND s.status<>'DIBATALKAN' AND NOT EXISTS(SELECT FROM public.vendor_samples child WHERE child.related_sample_id=s.id AND child.status<>'DIBATALKAN');
 basis:=jsonb_build_object('candidate',to_jsonb(c)-ARRAY['process_stage','qualification_status','operational_status','vendor_id','activated_at','activated_by','updated_by','updated_at','archived_at','archived_by','archive_reason'],
  'contacts',contacts,'location',CASE WHEN loc.id IS NULL THEN NULL ELSE to_jsonb(loc) END,'photos',photos,'samples',samples,'master_matches',matches);
 checks:=jsonb_build_array(
  jsonb_build_object('key','identity','label','Nama usaha dan kategori aktif','passed',coalesce(identity_ok,false),'overrideable',false),
  jsonb_build_object('key','contact','label','Kontak bernama dengan telepon/WhatsApp valid','passed',coalesce(contact_ok,false),'overrideable',false),
  jsonb_build_object('key','master_match','label','Identitas master jelas dan tidak terhubung ke profil lain','passed',coalesce(match_ok,false),'overrideable',false),
  jsonb_build_object('key','primary_location','label','Lokasi utama dengan alamat, kota dan provinsi','passed',loc.id IS NOT NULL AND nullif(btrim(loc.address_line),'') IS NOT NULL AND nullif(btrim(loc.city),'') IS NOT NULL AND nullif(btrim(loc.province),'') IS NOT NULL,'overrideable',true),
  jsonb_build_object('key','coordinates','label','Koordinat lokasi utama valid','passed',coalesce(loc.latitude BETWEEN -90 AND 90 AND loc.longitude BETWEEN -180 AND 180,false),'overrideable',true),
  jsonb_build_object('key','exterior','label','Foto tampak luar aktif dan file privat tersedia','passed',exterior_ok,'overrideable',true),
  jsonb_build_object('key','verified','label','Lokasi utama terverifikasi HRD/Super Admin','passed',coalesce(loc.verification_status='VERIFIED',false),'overrideable',true),
  jsonb_build_object('key','qc','label','Semua sampel efektif selesai dan QC terakhir Lulus','passed',qc_ok,'overrideable',true));
 RETURN jsonb_build_object('candidate_id',c.id,'candidate_code',c.candidate_code,'business_name',c.business_name,'qualification_status',c.qualification_status,'operational_status',c.operational_status,'vendor_id',c.vendor_id,'archived_at',c.archived_at,'updated_at',c.updated_at,
 'basis',basis,'basis_token',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(basis::text,'UTF8')),'hex'),'checks',checks,'missing_checks',(SELECT coalesce(jsonb_agg(x->>'key'),'[]') FROM jsonb_array_elements(checks) x WHERE NOT (x->>'passed')::boolean));
END $$;
REVOKE ALL ON FUNCTION public.vendor_phase5_state(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.vendor_approval_checklist(p_candidate_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE state jsonb;latest jsonb;
BEGIN
 IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']) THEN RAISE EXCEPTION 'Akses persetujuan ditolak' USING ERRCODE='42501';END IF;
 state:=public.vendor_phase5_state(p_candidate_id);
 SELECT to_jsonb(d)-'request_payload' INTO latest FROM public.vendor_decisions d WHERE candidate_id=p_candidate_id ORDER BY decision_no DESC LIMIT 1;
 RETURN state||jsonb_build_object('latest_decision',latest,'basis_changed',latest IS NOT NULL AND latest->>'basis_token' IS DISTINCT FROM state->>'basis_token');
END $$;
REVOKE ALL ON FUNCTION public.vendor_approval_checklist(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_approval_checklist(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_record_decision(p_candidate_id uuid,p_payload jsonb,p_expected_updated_at timestamptz,p_basis_token text,p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.vendor_candidates%ROWTYPE;d public.vendor_decisions%ROWTYPE;state jsonb;actor uuid;key text;today date:=(now() AT TIME ZONE 'Asia/Jakarta')::date;
 allowed text[]:=ARRAY['decision','basis_reason','scope_limit','sample_ref_id','qc_ref_id','effective_from','reeval_date','follow_up_action','pic_id','proof_path','override_reason'];
BEGIN
 IF NOT public.is_app_role(ARRAY['direksi','super_admin']) THEN RAISE EXCEPTION 'Keputusan hanya Direksi/Super Admin' USING ERRCODE='42501';END IF;
 actor:=public.my_profile_id();IF actor IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Identitas/payload keputusan tidak valid';END IF;
 IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE NOT k=ANY(allowed)) THEN RAISE EXCEPTION 'Field keputusan tidak diizinkan';END IF;
 -- Same lock order in decision/activation. Short transaction; no network requests inside it.
 LOCK TABLE public.vendors IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.vendor_contacts,public.vendor_locations,public.vendor_location_photos,public.vendor_samples,public.vendor_sample_qc_runs IN SHARE MODE;
 SELECT * INTO d FROM public.vendor_decisions WHERE request_id=p_request_id;
 IF FOUND THEN IF d.candidate_id<>p_candidate_id OR d.decided_by<>actor OR d.request_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'ID permintaan sudah digunakan untuk keputusan berbeda';END IF;RETURN d.id;END IF;
 SELECT * INTO c FROM public.vendor_candidates WHERE id=p_candidate_id FOR UPDATE;
 IF NOT FOUND OR c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Kandidat tidak tersedia/diarsipkan';END IF;
 state:=public.vendor_phase5_state(c.id);
 IF c.updated_at IS DISTINCT FROM p_expected_updated_at OR state->>'basis_token' IS DISTINCT FROM p_basis_token THEN RAISE EXCEPTION 'Data penilaian sudah berubah; muat ulang checklist' USING ERRCODE='40001';END IF;
 d.id:=gen_random_uuid();d.candidate_id:=c.id;d.decided_by:=actor;d.decided_at:=clock_timestamp();d.created_at:=d.decided_at;d.decision_no:=nextval('public.vendor_decision_code_seq');d.decision_code:='K-'||lpad(d.decision_no::text,greatest(4,length(d.decision_no::text)),'0');
 d.decision:=p_payload->>'decision';IF d.decision IS NULL OR d.decision NOT IN ('APPROVED','RESERVE','REJECTED','FROZEN') THEN RAISE EXCEPTION 'Keputusan tidak valid';END IF;
 d.basis_reason:=btrim(p_payload->>'basis_reason');IF d.basis_reason IS NULL OR length(d.basis_reason) NOT BETWEEN 10 AND 5000 THEN RAISE EXCEPTION 'Dasar keputusan wajib 10–5000 karakter';END IF;
 d.override_reason:=nullif(btrim(p_payload->>'override_reason'),'');IF d.override_reason IS NOT NULL AND length(d.override_reason) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Alasan pengecualian wajib 10–2000 karakter';END IF;
 IF d.decision='APPROVED' THEN
  FOR key IN SELECT x->>'key' FROM jsonb_array_elements(state->'checks') x WHERE NOT (x->>'passed')::boolean AND NOT (x->>'overrideable')::boolean LOOP RAISE EXCEPTION 'Persyaratan identitas wajib belum terpenuhi: %',key;END LOOP;
  IF jsonb_array_length(state->'missing_checks')>0 AND d.override_reason IS NULL THEN RAISE EXCEPTION 'Lokasi/QC belum memenuhi syarat; pengecualian approver wajib alasan tertulis';END IF;
 END IF;
 d.effective_from:=coalesce(nullif(p_payload->>'effective_from','')::date,today);
 IF d.effective_from<>today THEN RAISE EXCEPTION 'Tanggal efektif harus hari ini (WIB); keputusan terjadwal/backdate belum didukung';END IF;
 d.reeval_date:=nullif(p_payload->>'reeval_date','')::date;IF d.reeval_date<d.effective_from THEN RAISE EXCEPTION 'Evaluasi ulang tidak boleh mendahului keputusan';END IF;
 d.scope_limit:=nullif(btrim(p_payload->>'scope_limit'),'');d.follow_up_action:=nullif(btrim(p_payload->>'follow_up_action'),'');d.pic_id:=nullif(p_payload->>'pic_id','')::uuid;
 IF d.pic_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.user_profiles WHERE id=d.pic_id AND account_status='ACTIVE') THEN RAISE EXCEPTION 'PIC keputusan harus aktif';END IF;
 d.sample_ref_id:=nullif(p_payload->>'sample_ref_id','')::uuid;d.qc_ref_id:=nullif(p_payload->>'qc_ref_id','')::uuid;
 IF d.qc_ref_id IS NULL AND d.sample_ref_id IS NULL THEN SELECT (x->>'sample_id')::uuid,(x->'latest_qc'->>'id')::uuid INTO d.sample_ref_id,d.qc_ref_id FROM jsonb_array_elements(state->'basis'->'samples') x WHERE x->'latest_qc'->>'decision'='LULUS' LIMIT 1;END IF;
 IF (d.sample_ref_id IS NULL)<>(d.qc_ref_id IS NULL) OR (d.qc_ref_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.vendor_sample_qc_runs q JOIN public.vendor_samples s ON s.id=q.sample_id WHERE q.id=d.qc_ref_id AND s.id=d.sample_ref_id AND s.candidate_id=c.id AND q.run_no=(SELECT max(run_no) FROM public.vendor_sample_qc_runs WHERE sample_id=s.id))) THEN RAISE EXCEPTION 'Referensi sampel/QC harus putaran terakhir milik kandidat yang sama';END IF;
 d.proof_path:=nullif(p_payload->>'proof_path','');IF d.proof_path IS NOT NULL AND (d.proof_path !~ ('^'||c.id::text||'/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$') OR NOT EXISTS(SELECT FROM storage.objects WHERE bucket_id='vendor-decision-files' AND name=d.proof_path)) THEN RAISE EXCEPTION 'Bukti keputusan privat tidak tersedia/path tidak valid';END IF;
 d.basis_snapshot:=state->'basis';d.basis_token:=state->>'basis_token';SELECT coalesce(array_agg(x),ARRAY[]::text[]) INTO d.missing_checks FROM jsonb_array_elements_text(state->'missing_checks') x;
 d.request_id:=p_request_id;d.request_payload:=p_payload;INSERT INTO public.vendor_decisions SELECT d.*;
 UPDATE public.vendor_candidates SET qualification_status=d.decision,process_stage=CASE WHEN d.decision='REJECTED' THEN 'ABANDONED' ELSE 'CLOSED' END,updated_by=actor WHERE id=c.id;
 INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,new_values,actor_id) VALUES(c.id,'vendor_decisions',d.id,'decision_recorded',jsonb_build_object('decision_code',d.decision_code,'decision',d.decision),actor);
 RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.vendor_record_decision(uuid,jsonb,timestamptz,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_record_decision(uuid,jsonb,timestamptz,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_vendor_candidate(p_candidate_id uuid,p_expected_decision_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.vendor_candidates%ROWTYPE;d public.vendor_decisions%ROWTYPE;v public.vendors%ROWTYPE;state jsonb;actor uuid;ct public.vendor_contacts%ROWTYPE;loc public.vendor_locations%ROWTYPE;new_master boolean:=false;code text;category_name text;activation_id uuid;activation_time timestamptz;code_no bigint;
BEGIN
 IF NOT public.is_app_role(ARRAY['direksi','super_admin']) THEN RAISE EXCEPTION 'Aktivasi hanya Direksi/Super Admin' USING ERRCODE='42501';END IF;
 actor:=public.my_profile_id();IF actor IS NULL THEN RAISE EXCEPTION 'Identitas pengaktif tidak valid';END IF;
 LOCK TABLE public.vendors IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.vendor_contacts,public.vendor_locations,public.vendor_location_photos,public.vendor_samples,public.vendor_sample_qc_runs IN SHARE MODE;
 SELECT * INTO c FROM public.vendor_candidates WHERE id=p_candidate_id FOR UPDATE;
 IF NOT FOUND OR c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Kandidat tidak tersedia/diarsipkan';END IF;
 SELECT * INTO d FROM public.vendor_decisions WHERE candidate_id=c.id ORDER BY decision_no DESC LIMIT 1;
 IF NOT FOUND OR d.decision<>'APPROVED' OR c.qualification_status<>'APPROVED' THEN RAISE EXCEPTION 'Keputusan terakhir harus Disetujui';END IF;
 IF p_expected_decision_id IS NOT NULL AND p_expected_decision_id<>d.id THEN RAISE EXCEPTION 'Keputusan sudah berubah; muat ulang sebelum aktivasi' USING ERRCODE='40001';END IF;
 IF d.effective_from>(now() AT TIME ZONE 'Asia/Jakarta')::date OR d.reeval_date<(now() AT TIME ZONE 'Asia/Jakarta')::date THEN RAISE EXCEPTION 'Keputusan belum berlaku/sudah perlu evaluasi ulang';END IF;
 IF c.operational_status='ACTIVE' AND c.vendor_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT FROM public.vendors WHERE id=c.vendor_id AND is_active) THEN RAISE EXCEPTION 'Master tertaut tidak aktif; periksa operasional secara terpisah';END IF;
  RETURN c.vendor_id;
 END IF;
 IF c.operational_status<>'NOT_ACTIVE' THEN RAISE EXCEPTION 'Reaktivasi vendor suspended/inactive bukan aktivasi kandidat baru';END IF;
 state:=public.vendor_phase5_state(c.id);
 IF state->>'basis_token' IS DISTINCT FROM d.basis_token THEN RAISE EXCEPTION 'Data pendukung berubah setelah keputusan; catat penilaian baru sebelum aktivasi' USING ERRCODE='40001';END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(state->'checks') x WHERE NOT (x->>'passed')::boolean AND (NOT (x->>'overrideable')::boolean OR d.override_reason IS NULL OR NOT (x->>'key'=ANY(d.missing_checks)))) THEN RAISE EXCEPTION 'Persyaratan aktivasi belum terpenuhi atau tidak tercakup pengecualian';END IF;
 IF c.vendor_id IS NOT NULL THEN SELECT * INTO v FROM public.vendors WHERE id=c.vendor_id;
 ELSIF jsonb_array_length(state->'basis'->'master_matches')=1 THEN SELECT * INTO v FROM public.vendors WHERE id=(state->'basis'->'master_matches'->0->>'id')::uuid;
 ELSE
  LOOP code_no:=nextval('public.vendor_activation_master_code_seq');code:='VND-AM-'||lpad(code_no::text,greatest(6,length(code_no::text)),'0');EXIT WHEN NOT EXISTS(SELECT FROM public.vendors WHERE vendor_code=code);END LOOP;
  SELECT * INTO ct FROM public.vendor_contacts WHERE candidate_id=c.id AND length(btrim(contact_name))>=2 AND (length(public.vendor_phase5_phone(phone)) BETWEEN 8 AND 15 OR length(public.vendor_phase5_phone(whatsapp)) BETWEEN 8 AND 15) ORDER BY is_primary DESC,created_at,id LIMIT 1;
  SELECT * INTO loc FROM public.vendor_locations WHERE candidate_id=c.id AND is_primary;
  SELECT name INTO category_name FROM public.vendor_categories WHERE id=c.category_id;
  INSERT INTO public.vendors(vendor_code,vendor_name,vendor_type,contact_person,whatsapp_number,phone_number,email,address,city,service_type,notes,is_active,created_by)
  VALUES(code,c.business_name,CASE category_name WHEN 'Jahit' THEN 'MAKLUN_JAHIT' WHEN 'Bordir' THEN 'MAKLUN_BORDIR' ELSE 'LAINNYA' END,ct.contact_name,ct.whatsapp,ct.phone,ct.email,loc.address_line,loc.city,category_name,'Aktivasi kandidat '||c.candidate_code,true,actor) RETURNING * INTO v;
  new_master:=true;
 END IF;
 IF v.id IS NULL OR NOT coalesce(v.is_active,false) OR EXISTS(SELECT FROM public.vendor_candidates WHERE vendor_id=v.id AND id<>c.id) THEN RAISE EXCEPTION 'Identitas master tidak valid/telah terhubung ke kandidat lain';END IF;
 INSERT INTO public.vendor_activations(candidate_id,decision_id,vendor_id,created_master,activated_by,activated_at,basis_snapshot,master_snapshot,previous_status)
 VALUES(c.id,d.id,v.id,new_master,actor,clock_timestamp(),state->'basis',to_jsonb(v),jsonb_build_object('vendor_id',c.vendor_id,'operational_status',c.operational_status,'process_stage',c.process_stage)) RETURNING id,activated_at INTO activation_id,activation_time;
 UPDATE public.vendor_candidates SET vendor_id=v.id,operational_status='ACTIVE',process_stage='CLOSED',activated_at=activation_time,activated_by=actor,updated_by=actor WHERE id=c.id;
 INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,new_values,actor_id) VALUES(c.id,'vendor_activations',activation_id,'vendor_activated',jsonb_build_object('vendor_id',v.id,'decision_code',d.decision_code,'created_master',new_master),actor);
 RETURN v.id;
END $$;
REVOKE ALL ON FUNCTION public.activate_vendor_candidate(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activate_vendor_candidate(uuid,uuid) TO authenticated;

-- New private proof bucket only; all existing policies/guards remain intact.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('vendor-decision-files','vendor-decision-files',false,5242880,ARRAY['application/pdf','image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.vendor_decision_file_access(p_path text,p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR NOT public.is_app_role(CASE WHEN p_write THEN ARRAY['direksi','super_admin'] ELSE ARRAY['sourcing','hrd','direksi','super_admin'] END) THEN RETURN false;END IF;
 RETURN p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$' AND EXISTS(SELECT FROM public.vendor_candidates WHERE id::text=split_part(p_path,'/',1) AND (NOT p_write OR archived_at IS NULL));
END $$;
REVOKE ALL ON FUNCTION public.vendor_decision_file_access(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_decision_file_access(text,boolean) TO PUBLIC;
DROP POLICY IF EXISTS "Vendor decision files read gate" ON storage.objects;
CREATE POLICY "Vendor decision files read gate" ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING(bucket_id<>'vendor-decision-files' OR public.vendor_decision_file_access(name,false));
DROP POLICY IF EXISTS "Vendor decision files insert gate" ON storage.objects;
CREATE POLICY "Vendor decision files insert gate" ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(bucket_id<>'vendor-decision-files' OR public.vendor_decision_file_access(name,true));
DROP POLICY IF EXISTS "Vendor decision files update gate" ON storage.objects;
CREATE POLICY "Vendor decision files update gate" ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(bucket_id<>'vendor-decision-files') WITH CHECK(bucket_id<>'vendor-decision-files');
DROP POLICY IF EXISTS "Vendor decision files delete gate" ON storage.objects;
CREATE POLICY "Vendor decision files delete gate" ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING(bucket_id<>'vendor-decision-files');
DROP POLICY IF EXISTS "Vendor decision files read" ON storage.objects;
CREATE POLICY "Vendor decision files read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='vendor-decision-files' AND public.vendor_decision_file_access(name,false));
DROP POLICY IF EXISTS "Vendor decision files insert" ON storage.objects;
CREATE POLICY "Vendor decision files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='vendor-decision-files' AND public.vendor_decision_file_access(name,true));
NOTIFY pgrst,'reload schema';COMMIT;
