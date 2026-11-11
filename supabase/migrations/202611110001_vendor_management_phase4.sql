-- Phase 4: samples + QC, additive vendor_* objects only. Never executes approval/activation.
BEGIN;
DO $$ DECLARE t text; BEGIN
  IF NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_candidates' AND column_name='archived_at') THEN
    RAISE EXCEPTION 'Migration arsip kandidat harus tersedia sebelum Fase 4';
  END IF;
  FOREACH t IN ARRAY ARRAY['vendor_samples','vendor_qc_parameters','vendor_sample_qc_runs','vendor_qc_run_revisions','vendor_sample_change_history'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL AND obj_description(to_regclass('public.'||t),'pg_class') IS DISTINCT FROM 'HARMAS vendor phase4 202611110001' THEN
      RAISE EXCEPTION 'Objek Fase 4 sudah ada tanpa penanda migration: %; review manual diperlukan',t;
    END IF;
  END LOOP;
  IF EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename IN ('vendor_samples','vendor_qc_parameters','vendor_sample_qc_runs','vendor_qc_run_revisions','vendor_sample_change_history') AND policyname NOT IN ('Vendor phase4 read','Vendor samples insert','Vendor samples update','Vendor qc parameters write')) THEN
    RAISE EXCEPTION 'Policy Fase 4 tidak dikenal; hentikan sebelum mengaktifkan RLS';
  END IF;
  IF EXISTS(SELECT FROM storage.buckets WHERE id='vendor-sample-files' AND (public OR file_size_limit IS DISTINCT FROM 5242880 OR allowed_mime_types IS DISTINCT FROM ARRAY['application/pdf','image/jpeg','image/png','image/webp'])) THEN
    RAISE EXCEPTION 'Konfigurasi bucket bukti yang sudah ada tidak cocok';
  END IF;
END $$;
CREATE SEQUENCE IF NOT EXISTS public.vendor_sample_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.vendor_qc_code_seq;
GRANT USAGE ON SEQUENCE public.vendor_sample_code_seq TO authenticated;
CREATE TABLE IF NOT EXISTS public.vendor_samples(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sample_code text NOT NULL UNIQUE,
 candidate_id uuid NOT NULL REFERENCES public.vendor_candidates(id) ON DELETE RESTRICT,
 sample_type text NOT NULL CHECK(sample_type IN ('JAHIT_PRODUK','BORDIR','SWATCH_KAIN','UJI_KAIN','PRINTING','CUTTING','FINISHING','AKSESORIS','LAINNYA')),
 product_code text CHECK(length(product_code)<=100),brief text NOT NULL CHECK(length(btrim(brief)) BETWEEN 5 AND 10000),techpack_path text,
 material_source text NOT NULL CHECK(material_source IN ('HARMAS','VENDOR','GABUNGAN','TIDAK_RELEVAN')),
 quantity numeric NOT NULL CHECK(quantity>0 AND quantity<'Infinity'::numeric),unit text NOT NULL CHECK(length(btrim(unit)) BETWEEN 1 AND 50),cost numeric(14,2) CHECK(cost>=0 AND cost<'Infinity'::numeric),
 assigned_at timestamptz,target_date date,received_at timestamptz,internal_pic_id uuid REFERENCES public.user_profiles(id),
 status text NOT NULL DEFAULT 'BRIEF_DIBUAT' CHECK(status IN ('BRIEF_DIBUAT','DITUGASKAN','DIKERJAKAN','SAMPEL_DITERIMA','SEDANG_QC','PERLU_REVISI','SELESAI','DIBATALKAN')),
 revision_note text,related_sample_id uuid REFERENCES public.vendor_samples(id) ON DELETE RESTRICT,notes text,
 created_by uuid NOT NULL REFERENCES public.user_profiles(id),created_at timestamptz NOT NULL DEFAULT now(),updated_by uuid NOT NULL REFERENCES public.user_profiles(id),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(related_sample_id IS DISTINCT FROM id)
);
CREATE INDEX IF NOT EXISTS idx_vendor_samples_candidate ON public.vendor_samples(candidate_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_samples_status_due ON public.vendor_samples(status,target_date);
CREATE TABLE IF NOT EXISTS public.vendor_qc_parameters(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category_id uuid REFERENCES public.vendor_categories(id),parameter_name text NOT NULL CHECK(length(btrim(parameter_name)) BETWEEN 2 AND 150),
 weight numeric NOT NULL DEFAULT 1 CHECK(weight>0 AND weight<=100),is_active boolean NOT NULL DEFAULT true,display_order integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_qc_parameter_name ON public.vendor_qc_parameters(coalesce(category_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(parameter_name));
INSERT INTO public.vendor_qc_parameters(parameter_name,display_order) VALUES('Kesesuaian Spek',1),('Ukuran/Gramasi',2),('Hasil Pengerjaan',3),('Bahan/Warna',4),('Finishing',5),('Fungsi/Ketahanan',6) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.vendor_sample_qc_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),qc_code text NOT NULL UNIQUE,sample_id uuid NOT NULL REFERENCES public.vendor_samples(id) ON DELETE RESTRICT,
 candidate_id uuid NOT NULL REFERENCES public.vendor_candidates(id) ON DELETE RESTRICT,run_no integer NOT NULL CHECK(run_no>0),
 inspector_name text NOT NULL CHECK(length(btrim(inspector_name)) BETWEEN 2 AND 200),inspector_employee_id uuid REFERENCES public.employees(id),inspected_at timestamptz NOT NULL,
 parameter_scores jsonb NOT NULL,parameter_snapshot jsonb NOT NULL,sample_snapshot jsonb NOT NULL,avg_score numeric(5,2) NOT NULL,pass_mark numeric(5,2) NOT NULL CHECK(pass_mark BETWEEN 1 AND 5),
 decision text NOT NULL CHECK(decision IN ('LULUS','REVISI','TIDAK_LULUS')),findings text,required_fixes text,revision_due date,
 photos jsonb NOT NULL DEFAULT '[]',document_path text,notes text,reinspection_note text,
 input_by uuid NOT NULL REFERENCES public.user_profiles(id),input_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES public.user_profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),edit_reason text,UNIQUE(sample_id,run_no)
);
CREATE INDEX IF NOT EXISTS idx_vendor_qc_runs_sample ON public.vendor_sample_qc_runs(sample_id,run_no DESC);
CREATE TABLE IF NOT EXISTS public.vendor_qc_run_revisions(
 id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,qc_run_id uuid NOT NULL REFERENCES public.vendor_sample_qc_runs(id) ON DELETE RESTRICT,
 edited_by uuid NOT NULL REFERENCES public.user_profiles(id),edited_at timestamptz NOT NULL DEFAULT now(),edit_reason text NOT NULL,
 old_values jsonb NOT NULL,new_values jsonb NOT NULL
);
-- Full sample changes stay behind the same role boundary as the samples.
-- The existing general activity log receives only code/status metadata.
CREATE TABLE IF NOT EXISTS public.vendor_sample_change_history(
 id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,sample_id uuid NOT NULL REFERENCES public.vendor_samples(id) ON DELETE RESTRICT,
 changed_by uuid NOT NULL REFERENCES public.user_profiles(id),changed_at timestamptz NOT NULL DEFAULT now(),old_values jsonb,new_values jsonb NOT NULL
);
COMMENT ON TABLE public.vendor_samples IS 'HARMAS vendor phase4 202611110001';
COMMENT ON TABLE public.vendor_qc_parameters IS 'HARMAS vendor phase4 202611110001';
COMMENT ON TABLE public.vendor_sample_qc_runs IS 'HARMAS vendor phase4 202611110001';
COMMENT ON TABLE public.vendor_qc_run_revisions IS 'HARMAS vendor phase4 202611110001';
COMMENT ON TABLE public.vendor_sample_change_history IS 'HARMAS vendor phase4 202611110001';

CREATE OR REPLACE FUNCTION public.vendor_sample_file_path(p_path text,p_candidate uuid,p_sample uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT p_path IS NULL OR (split_part(p_path,'/',1)=p_candidate::text AND split_part(p_path,'/',2)=p_sample::text
 AND p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$');
$$;
REVOKE ALL ON FUNCTION public.vendor_sample_file_path(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_sample_file_path(text,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_samples_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE system_context boolean:=auth.role()='service_role' OR current_user IN ('postgres','supabase_admin'); c public.vendor_candidates%ROWTYPE; actor uuid:=public.my_profile_id(); previous_qc boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Sampel dan riwayatnya tidak boleh dihapus' USING ERRCODE='42501'; END IF;
 IF NOT coalesce(system_context,false) AND NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN RAISE EXCEPTION 'Akses sampel ditolak' USING ERRCODE='42501'; END IF;
 -- Serialize sibling sample changes so aggregate candidate stage cannot race.
 SELECT * INTO c FROM public.vendor_candidates WHERE id=NEW.candidate_id FOR NO KEY UPDATE;
 IF c.id IS NULL OR c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Kandidat tidak tersedia/diarsipkan' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
   IF NOT coalesce(system_context,false) AND NEW.status<>'BRIEF_DIBUAT' THEN RAISE EXCEPTION 'Sampel baru harus dimulai dari Brief Dibuat'; END IF;
   NEW.sample_code:='S-'||lpad(nextval('public.vendor_sample_code_seq')::text,4,'0');NEW.created_by:=coalesce(actor,NEW.created_by);NEW.created_at:=now();
 ELSE
   IF ROW(NEW.id,NEW.sample_code,NEW.candidate_id,NEW.created_by,NEW.created_at,NEW.related_sample_id) IS DISTINCT FROM ROW(OLD.id,OLD.sample_code,OLD.candidate_id,OLD.created_by,OLD.created_at,OLD.related_sample_id) THEN RAISE EXCEPTION 'Identitas dan pencatat sampel tidak dapat diganti' USING ERRCODE='42501'; END IF;
   SELECT EXISTS(SELECT FROM public.vendor_sample_qc_runs WHERE sample_id=NEW.id) INTO previous_qc;
   IF previous_qc AND ROW(NEW.sample_type,NEW.product_code,NEW.brief,NEW.material_source,NEW.quantity,NEW.unit,NEW.techpack_path) IS DISTINCT FROM ROW(OLD.sample_type,OLD.product_code,OLD.brief,OLD.material_source,OLD.quantity,OLD.unit,OLD.techpack_path) THEN RAISE EXCEPTION 'Brief/bahan/jumlah/techpack sudah menjadi bukti QC; buat sampel terkait baru'; END IF;
   IF NEW.status IS DISTINCT FROM OLD.status AND NOT coalesce(system_context,false) THEN
     IF NOT ((OLD.status='BRIEF_DIBUAT' AND NEW.status IN ('DITUGASKAN','DIBATALKAN')) OR (OLD.status='DITUGASKAN' AND NEW.status IN ('DIKERJAKAN','DIBATALKAN')) OR (OLD.status='DIKERJAKAN' AND NEW.status IN ('SAMPEL_DITERIMA','DIBATALKAN')) OR (OLD.status='SAMPEL_DITERIMA' AND NEW.status IN ('SEDANG_QC','DIBATALKAN')) OR (OLD.status='SEDANG_QC' AND NEW.status='DIBATALKAN') OR (OLD.status='PERLU_REVISI' AND NEW.status IN ('DIKERJAKAN','DIBATALKAN'))) THEN RAISE EXCEPTION 'Perpindahan status sampel tidak valid; hasil akhir hanya melalui pencatatan QC'; END IF;
     IF (OLD.status='PERLU_REVISI' OR NEW.status='DIBATALKAN') AND length(coalesce(btrim(NEW.revision_note),''))<5 THEN RAISE EXCEPTION 'Alasan revisi/pembatalan minimal 5 karakter'; END IF;
   END IF;
 END IF;
 IF NEW.related_sample_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.vendor_samples WHERE id=NEW.related_sample_id AND candidate_id=NEW.candidate_id AND id<>NEW.id) THEN RAISE EXCEPTION 'Sampel terkait harus milik kandidat yang sama'; END IF;
 IF NEW.internal_pic_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.user_profiles WHERE id=NEW.internal_pic_id AND account_status='ACTIVE') THEN RAISE EXCEPTION 'PIC harus merupakan pengguna aktif'; END IF;
 IF NEW.status NOT IN ('BRIEF_DIBUAT','DIBATALKAN') AND (NEW.assigned_at IS NULL OR NEW.target_date IS NULL OR NEW.internal_pic_id IS NULL) THEN RAISE EXCEPTION 'Tanggal penugasan, target dan PIC wajib diisi'; END IF;
 IF NEW.status IN ('SAMPEL_DITERIMA','SEDANG_QC','PERLU_REVISI','SELESAI') AND (NEW.received_at IS NULL OR NEW.received_at<NEW.assigned_at) THEN RAISE EXCEPTION 'Tanggal penerimaan harus ada dan tidak mendahului penugasan'; END IF;
 IF NEW.target_date IS NOT NULL AND NEW.assigned_at IS NOT NULL AND NEW.target_date<(NEW.assigned_at AT TIME ZONE 'Asia/Jakarta')::date THEN RAISE EXCEPTION 'Target tidak boleh mendahului penugasan'; END IF;
 IF NOT public.vendor_sample_file_path(NEW.techpack_path,NEW.candidate_id,NEW.id) THEN RAISE EXCEPTION 'Path techpack tidak valid'; END IF;
 NEW.updated_by:=coalesce(actor,NEW.updated_by,NEW.created_by);NEW.updated_at:=clock_timestamp();RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_samples_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_samples_guard ON public.vendor_samples;
CREATE TRIGGER trg_vendor_samples_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_samples FOR EACH ROW EXECUTE FUNCTION public.vendor_samples_guard();

CREATE OR REPLACE FUNCTION public.vendor_sampling_sync_stage(p_candidate uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE stage text;
BEGIN
 WITH leaves AS (SELECT s.* FROM public.vendor_samples s WHERE s.candidate_id=p_candidate AND s.status<>'DIBATALKAN' AND NOT EXISTS(SELECT FROM public.vendor_samples child WHERE child.related_sample_id=s.id AND child.status<>'DIBATALKAN'))
 SELECT CASE WHEN bool_or(status='PERLU_REVISI') THEN 'SAMPLE_REVISION' WHEN bool_or(status='SEDANG_QC') THEN 'QC_REVIEW' WHEN bool_or(status='SAMPEL_DITERIMA') THEN 'SAMPLE_RECEIVED' WHEN bool_or(status='DIKERJAKAN') THEN 'SAMPLE_IN_PROGRESS' WHEN bool_or(status='DITUGASKAN') THEN 'SAMPLE_ASSIGNED'
 WHEN count(*)>0 AND bool_and(status='SELESAI') AND NOT EXISTS(SELECT FROM leaves l WHERE (SELECT decision FROM public.vendor_sample_qc_runs WHERE sample_id=l.id ORDER BY run_no DESC LIMIT 1) IS DISTINCT FROM 'LULUS') THEN 'AWAITING_APPROVAL' ELSE NULL END INTO stage FROM leaves;
 UPDATE public.vendor_candidates SET process_stage=coalesce(stage,'CONTACTING'),updated_by=public.my_profile_id() WHERE id=p_candidate AND archived_at IS NULL AND vendor_id IS NULL AND operational_status='NOT_ACTIVE' AND qualification_status NOT IN ('APPROVED','RESERVE','REJECTED','FROZEN') AND (stage IS NOT NULL OR process_stage IN ('SAMPLE_ASSIGNED','SAMPLE_IN_PROGRESS','SAMPLE_RECEIVED','QC_REVIEW','SAMPLE_REVISION','AWAITING_APPROVAL')) AND process_stage IS DISTINCT FROM coalesce(stage,'CONTACTING');
END $$;
REVOKE ALL ON FUNCTION public.vendor_sampling_sync_stage(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.vendor_samples_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW IS DISTINCT FROM OLD THEN
 INSERT INTO public.vendor_sample_change_history(sample_id,changed_by,old_values,new_values) VALUES(NEW.id,coalesce(public.my_profile_id(),NEW.created_by),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,old_values,new_values,actor_id) VALUES(NEW.candidate_id,'vendor_samples',NEW.id,CASE WHEN TG_OP='INSERT' THEN 'sample_created' ELSE 'sample_updated' END,CASE WHEN TG_OP='UPDATE' THEN jsonb_build_object('sample_code',OLD.sample_code,'status',OLD.status) ELSE NULL END,jsonb_build_object('sample_code',NEW.sample_code,'status',NEW.status),coalesce(public.my_profile_id(),NEW.created_by));
 END IF;
 PERFORM public.vendor_sampling_sync_stage(NEW.candidate_id);RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_samples_audit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_samples_audit ON public.vendor_samples;
CREATE TRIGGER trg_vendor_samples_audit AFTER INSERT OR UPDATE ON public.vendor_samples FOR EACH ROW EXECUTE FUNCTION public.vendor_samples_audit();

CREATE OR REPLACE FUNCTION public.vendor_qc_parameters_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Nonaktifkan rubrik; jangan menghapus jejak parameter' USING ERRCODE='42501'; END IF;
 IF NOT coalesce(auth.role()='service_role' OR current_user IN ('postgres','supabase_admin'),false) AND NOT public.is_app_role(ARRAY['hrd','super_admin']) THEN RAISE EXCEPTION 'Hanya administrator yang mengelola rubrik' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_qc_parameters_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_qc_parameters_guard ON public.vendor_qc_parameters;
CREATE TRIGGER trg_vendor_qc_parameters_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_qc_parameters FOR EACH ROW EXECUTE FUNCTION public.vendor_qc_parameters_guard();
CREATE OR REPLACE FUNCTION public.vendor_qc_runs_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' OR NOT coalesce(auth.role()='service_role' OR current_user IN ('postgres','supabase_admin'),false) THEN RAISE EXCEPTION 'QC permanen: gunakan fungsi pencatatan/koreksi dengan alasan' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (length(coalesce(btrim(NEW.edit_reason),''))<5 OR ROW(NEW.id,NEW.sample_id,NEW.candidate_id,NEW.run_no,NEW.qc_code,NEW.created_by,NEW.created_at,NEW.input_by,NEW.input_at,NEW.parameter_snapshot,NEW.sample_snapshot) IS DISTINCT FROM ROW(OLD.id,OLD.sample_id,OLD.candidate_id,OLD.run_no,OLD.qc_code,OLD.created_by,OLD.created_at,OLD.input_by,OLD.input_at,OLD.parameter_snapshot,OLD.sample_snapshot)) THEN RAISE EXCEPTION 'Koreksi QC wajib alasan dan tidak boleh mengganti identitas/snapshot hasil'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_qc_runs_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_qc_runs_guard ON public.vendor_sample_qc_runs;
CREATE TRIGGER trg_vendor_qc_runs_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_sample_qc_runs FOR EACH ROW EXECUTE FUNCTION public.vendor_qc_runs_guard();
CREATE OR REPLACE FUNCTION public.vendor_qc_runs_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN INSERT INTO public.vendor_qc_run_revisions(qc_run_id,edited_by,edit_reason,old_values,new_values) VALUES(NEW.id,public.my_profile_id(),NEW.edit_reason,to_jsonb(OLD),to_jsonb(NEW)); END IF;
 INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,old_values,new_values,actor_id) VALUES(NEW.candidate_id,'vendor_sample_qc_runs',NEW.id,CASE WHEN TG_OP='INSERT' THEN 'qc_recorded' ELSE 'qc_corrected' END,NULL,jsonb_build_object('qc_code',NEW.qc_code,'run_no',NEW.run_no),public.my_profile_id());RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_qc_runs_audit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_qc_runs_audit ON public.vendor_sample_qc_runs;
CREATE TRIGGER trg_vendor_qc_runs_audit AFTER INSERT OR UPDATE ON public.vendor_sample_qc_runs FOR EACH ROW EXECUTE FUNCTION public.vendor_qc_runs_audit();
CREATE OR REPLACE FUNCTION public.vendor_qc_revisions_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP<>'INSERT' OR NOT coalesce(auth.role()='service_role' OR current_user IN ('postgres','supabase_admin'),false) THEN RAISE EXCEPTION 'Riwayat koreksi QC permanen dan dibuat otomatis' USING ERRCODE='42501'; END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_qc_revisions_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_qc_revisions_guard ON public.vendor_qc_run_revisions;
CREATE TRIGGER trg_vendor_qc_revisions_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_qc_run_revisions FOR EACH ROW EXECUTE FUNCTION public.vendor_qc_revisions_guard();
DROP TRIGGER IF EXISTS trg_vendor_sample_history_guard ON public.vendor_sample_change_history;
CREATE TRIGGER trg_vendor_sample_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_sample_change_history FOR EACH ROW EXECUTE FUNCTION public.vendor_qc_revisions_guard();

CREATE OR REPLACE FUNCTION public.vendor_record_sample_qc(p_sample_id uuid,p_payload jsonb,p_qc_id uuid DEFAULT NULL,p_expected_updated_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.vendor_samples%ROWTYPE; c public.vendor_candidates%ROWTYPE; old_q public.vendor_sample_qc_runs%ROWTYPE; q public.vendor_sample_qc_runs%ROWTYPE;
 actor uuid; rubric jsonb; item jsonb; total numeric:=0; weights numeric:=0; score numeric; latest integer; is_latest boolean; desired text; allowed_keys text[]:=ARRAY['inspector_name','inspector_employee_id','inspected_at','parameter_scores','pass_mark','decision','findings','required_fixes','revision_due','photos','document_path','notes','reinspection_note','edit_reason'];
BEGIN
 IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN RAISE EXCEPTION 'Akses pencatatan QC ditolak' USING ERRCODE='42501'; END IF;
 actor:=public.my_profile_id();IF actor IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE NOT k=ANY(allowed_keys)) THEN RAISE EXCEPTION 'Identitas/field QC tidak valid' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.vendor_samples WHERE id=p_sample_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Sampel tidak ditemukan'; END IF;
 SELECT * INTO c FROM public.vendor_candidates WHERE id=s.candidate_id FOR NO KEY UPDATE;IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Kandidat diarsipkan; QC tidak dapat diubah'; END IF;
 SELECT coalesce(max(run_no),0) INTO latest FROM public.vendor_sample_qc_runs WHERE sample_id=s.id;
 IF p_qc_id IS NOT NULL THEN
   SELECT * INTO old_q FROM public.vendor_sample_qc_runs WHERE id=p_qc_id AND sample_id=s.id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Hasil QC tidak ditemukan'; END IF;
   IF old_q.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'QC sudah berubah; muat ulang sebelum mengoreksi' USING ERRCODE='40001'; END IF;
   IF length(coalesce(btrim(p_payload->>'edit_reason'),''))<5 THEN RAISE EXCEPTION 'Alasan koreksi minimal 5 karakter'; END IF;
   rubric:=old_q.parameter_snapshot;q:=old_q;is_latest:=old_q.run_no=latest;
 ELSE
   IF s.status<>'SEDANG_QC' THEN RAISE EXCEPTION 'Sampel harus diterima dan berstatus Sedang QC'; END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',parameter_name,'weight',weight) ORDER BY display_order,id),'[]') INTO rubric FROM public.vendor_qc_parameters WHERE is_active AND (category_id IS NULL OR category_id=c.category_id);
   q.id:=gen_random_uuid();q.sample_id:=s.id;q.candidate_id:=s.candidate_id;q.run_no:=latest+1;q.qc_code:='QC-'||lpad(nextval('public.vendor_qc_code_seq')::text,4,'0');q.input_by:=actor;q.input_at:=clock_timestamp();q.created_by:=actor;q.created_at:=q.input_at;q.parameter_snapshot:=rubric;q.sample_snapshot:=to_jsonb(s);is_latest:=true;
   IF latest>0 AND length(coalesce(btrim(p_payload->>'reinspection_note'),''))<5 THEN RAISE EXCEPTION 'Catatan pemeriksaan ulang minimal 5 karakter'; END IF;
 END IF;
 IF jsonb_array_length(rubric)=0 OR jsonb_typeof(p_payload->'parameter_scores') IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_payload->'parameter_scores'))<>jsonb_array_length(rubric) THEN RAISE EXCEPTION 'Isi semua skor rubrik yang berlaku'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(rubric) LOOP
   IF jsonb_typeof(p_payload->'parameter_scores'->(item->>'id')) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Skor rubrik wajib berupa angka'; END IF;
   score:=(p_payload->'parameter_scores'->>(item->>'id'))::numeric;IF score<1 OR score>5 OR trunc(score)<>score THEN RAISE EXCEPTION 'Skor harus bilangan bulat 1 sampai 5'; END IF;
   total:=total+score*(item->>'weight')::numeric;weights:=weights+(item->>'weight')::numeric;
 END LOOP;
 q.avg_score:=round(total/weights,2);q.pass_mark:=(p_payload->>'pass_mark')::numeric;IF q.pass_mark IS NULL OR q.pass_mark<1 OR q.pass_mark>5 THEN RAISE EXCEPTION 'Batas lulus wajib diisi antara 1 dan 5'; END IF;
 q.decision:=p_payload->>'decision';IF q.decision IS NULL OR q.decision NOT IN ('LULUS','REVISI','TIDAK_LULUS') THEN RAISE EXCEPTION 'Keputusan QC tidak valid'; END IF;
 IF q.decision='LULUS' AND q.avg_score<q.pass_mark THEN RAISE EXCEPTION 'Nilai di bawah batas lulus tidak dapat dinyatakan Lulus'; END IF;
 q.inspector_employee_id:=nullif(p_payload->>'inspector_employee_id','')::uuid;q.inspector_name:=btrim(p_payload->>'inspector_name');
 IF q.inspector_employee_id IS NOT NULL THEN SELECT full_name INTO q.inspector_name FROM public.employees WHERE id=q.inspector_employee_id;IF NOT FOUND THEN RAISE EXCEPTION 'Petugas QC tidak ditemukan'; END IF;END IF;
 IF q.inspector_name IS NULL OR length(q.inspector_name)<2 OR length(q.inspector_name)>200 THEN RAISE EXCEPTION 'Nama pemeriksa QC wajib diisi'; END IF;
 q.inspected_at:=(p_payload->>'inspected_at')::timestamptz;IF q.inspected_at IS NULL OR q.inspected_at<s.received_at OR q.inspected_at>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Tanggal pemeriksaan tidak valid; QC harus setelah sampel diterima'; END IF;
 q.findings:=nullif(btrim(p_payload->>'findings'),'');q.required_fixes:=nullif(btrim(p_payload->>'required_fixes'),'');q.revision_due:=nullif(p_payload->>'revision_due','')::date;
 IF q.decision<>'LULUS' AND length(coalesce(q.findings,''))<5 THEN RAISE EXCEPTION 'Temuan wajib untuk hasil Revisi/Tidak Lulus'; END IF;
 IF q.decision='REVISI' AND (length(coalesce(q.required_fixes,''))<5 OR q.revision_due IS NULL OR q.revision_due<(q.inspected_at AT TIME ZONE 'Asia/Jakarta')::date) THEN RAISE EXCEPTION 'Revisi memerlukan instruksi dan batas waktu yang valid'; END IF;
 q.photos:=coalesce(p_payload->'photos','[]');IF jsonb_typeof(q.photos)<>'array' OR jsonb_array_length(q.photos)>10 THEN RAISE EXCEPTION 'Maksimal 10 foto bukti QC'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(q.photos) LOOP
   IF jsonb_typeof(item)<>'object' OR item->>'path' IS NULL OR NOT public.vendor_sample_file_path(item->>'path',s.candidate_id,s.id) OR lower(item->>'path') LIKE '%.pdf' THEN RAISE EXCEPTION 'Path foto QC tidak valid'; END IF;
   IF EXISTS(SELECT FROM jsonb_object_keys(item) k WHERE k NOT IN ('path','caption')) OR (item ? 'caption' AND item->'caption'<>'null'::jsonb AND (jsonb_typeof(item->'caption')<>'string' OR length(item->>'caption')>200)) THEN RAISE EXCEPTION 'Keterangan foto harus teks maksimal 200 karakter'; END IF;
 END LOOP;
 q.document_path:=nullif(p_payload->>'document_path','');IF NOT public.vendor_sample_file_path(q.document_path,s.candidate_id,s.id) THEN RAISE EXCEPTION 'Path dokumen QC tidak valid'; END IF;
 q.notes:=nullif(btrim(p_payload->>'notes'),'');q.reinspection_note:=nullif(btrim(p_payload->>'reinspection_note'),'');q.parameter_scores:=p_payload->'parameter_scores';q.edit_reason:=nullif(btrim(p_payload->>'edit_reason'),'');q.updated_at:=clock_timestamp();
 desired:=CASE WHEN q.decision='REVISI' THEN 'PERLU_REVISI' ELSE 'SELESAI' END;
 IF p_qc_id IS NOT NULL AND is_latest AND q.decision IS DISTINCT FROM old_q.decision AND s.status NOT IN ('PERLU_REVISI','SELESAI') THEN RAISE EXCEPTION 'Pengerjaan sudah dilanjutkan; keputusan lama tidak dapat diubah saat revisi berjalan'; END IF;
 IF p_qc_id IS NULL THEN INSERT INTO public.vendor_sample_qc_runs SELECT q.*;
 ELSE UPDATE public.vendor_sample_qc_runs SET inspector_name=q.inspector_name,inspector_employee_id=q.inspector_employee_id,inspected_at=q.inspected_at,parameter_scores=q.parameter_scores,avg_score=q.avg_score,pass_mark=q.pass_mark,decision=q.decision,findings=q.findings,required_fixes=q.required_fixes,revision_due=q.revision_due,photos=q.photos,document_path=q.document_path,notes=q.notes,reinspection_note=q.reinspection_note,edit_reason=q.edit_reason,updated_at=q.updated_at WHERE id=q.id; END IF;
 IF is_latest AND (p_qc_id IS NULL OR s.status IN ('PERLU_REVISI','SELESAI')) THEN UPDATE public.vendor_samples SET status=desired WHERE id=s.id;END IF;
 PERFORM public.vendor_sampling_sync_stage(s.candidate_id);RETURN q.id;
END $$;
REVOKE ALL ON FUNCTION public.vendor_record_sample_qc(uuid,jsonb,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_record_sample_qc(uuid,jsonb,uuid,timestamptz) TO authenticated;

ALTER TABLE public.vendor_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_qc_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sample_qc_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_qc_run_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sample_change_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.vendor_samples,public.vendor_qc_parameters TO authenticated;
GRANT SELECT ON public.vendor_sample_qc_runs,public.vendor_qc_run_revisions TO authenticated;
GRANT SELECT ON public.vendor_sample_change_history TO authenticated;
REVOKE ALL ON public.vendor_sample_change_history FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.vendor_sample_change_history FROM authenticated;
REVOKE ALL ON public.vendor_samples,public.vendor_qc_parameters,public.vendor_sample_qc_runs,public.vendor_qc_run_revisions FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.vendor_sample_qc_runs,public.vendor_qc_run_revisions FROM authenticated;
REVOKE DELETE ON public.vendor_samples,public.vendor_qc_parameters FROM authenticated;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['vendor_samples','vendor_qc_parameters','vendor_sample_qc_runs','vendor_qc_run_revisions','vendor_sample_change_history'] LOOP
 EXECUTE format('DROP POLICY IF EXISTS "Vendor phase4 read" ON public.%I',t);
 EXECUTE format('CREATE POLICY "Vendor phase4 read" ON public.%I FOR SELECT TO authenticated USING(public.is_app_role(ARRAY[''sourcing'',''hrd'',''super_admin'',''direksi'']))',t);
 END LOOP;
END $$;
DROP POLICY IF EXISTS "Vendor samples insert" ON public.vendor_samples;
CREATE POLICY "Vendor samples insert" ON public.vendor_samples FOR INSERT TO authenticated WITH CHECK(public.is_app_role(ARRAY['sourcing','hrd','super_admin']));
DROP POLICY IF EXISTS "Vendor samples update" ON public.vendor_samples;
CREATE POLICY "Vendor samples update" ON public.vendor_samples FOR UPDATE TO authenticated USING(public.is_app_role(ARRAY['sourcing','hrd','super_admin'])) WITH CHECK(public.is_app_role(ARRAY['sourcing','hrd','super_admin']));
DROP POLICY IF EXISTS "Vendor qc parameters write" ON public.vendor_qc_parameters;
CREATE POLICY "Vendor qc parameters write" ON public.vendor_qc_parameters FOR ALL TO authenticated USING(public.is_app_role(ARRAY['hrd','super_admin'])) WITH CHECK(public.is_app_role(ARRAY['hrd','super_admin']));

CREATE OR REPLACE VIEW public.vendor_sample_monitor WITH(security_invoker=true) AS
SELECT s.*,c.business_name,c.candidate_code,c.category_id,c.archived_at AS candidate_archived_at,c.vendor_id,c.internal_pic_id AS candidate_pic_id,
 (SELECT count(*) FROM public.vendor_sample_qc_runs WHERE sample_id=s.id) AS qc_count,
 q.decision AS latest_decision,q.avg_score AS latest_score,q.revision_due AS latest_revision_due
FROM public.vendor_samples s JOIN public.vendor_candidates c ON c.id=s.candidate_id LEFT JOIN LATERAL(SELECT decision,avg_score,revision_due FROM public.vendor_sample_qc_runs WHERE sample_id=s.id ORDER BY run_no DESC LIMIT 1) q ON true;
REVOKE ALL ON public.vendor_sample_monitor FROM PUBLIC,anon;GRANT SELECT ON public.vendor_sample_monitor TO authenticated;
CREATE OR REPLACE FUNCTION public.vendor_sampling_dashboard(p_category_id uuid DEFAULT NULL,p_pic_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']) THEN RAISE EXCEPTION 'Akses monitoring sampel ditolak' USING ERRCODE='42501';END IF;
 RETURN (SELECT jsonb_build_object('samples',count(*),'vendors',count(DISTINCT candidate_id),'running',count(*) FILTER(WHERE status IN ('DITUGASKAN','DIKERJAKAN','PERLU_REVISI')),'awaiting_qc',count(*) FILTER(WHERE status IN ('SAMPEL_DITERIMA','SEDANG_QC')),'passed',count(*) FILTER(WHERE latest_decision='LULUS'),'revision',count(*) FILTER(WHERE status='PERLU_REVISI'),'overdue',count(*) FILTER(WHERE status NOT IN ('SELESAI','DIBATALKAN') AND target_date<(now() AT TIME ZONE 'Asia/Jakarta')::date),'qc_runs',coalesce(sum(qc_count),0)) FROM public.vendor_sample_monitor WHERE candidate_archived_at IS NULL AND (p_category_id IS NULL OR category_id=p_category_id) AND (p_pic_id IS NULL OR candidate_pic_id=p_pic_id));
END $$;
REVOKE ALL ON FUNCTION public.vendor_sampling_dashboard(uuid,uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.vendor_sampling_dashboard(uuid,uuid) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('vendor-sample-files','vendor-sample-files',false,5242880,ARRAY['application/pdf','image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.vendor_sample_storage_access(p_path text,p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR NOT public.is_app_role(CASE WHEN p_write THEN ARRAY['sourcing','hrd','super_admin'] ELSE ARRAY['sourcing','hrd','super_admin','direksi'] END) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT FROM public.vendor_samples s JOIN public.vendor_candidates c ON c.id=s.candidate_id WHERE s.id::text=split_part(p_path,'/',2) AND s.candidate_id::text=split_part(p_path,'/',1) AND public.vendor_sample_file_path(p_path,s.candidate_id,s.id) AND (NOT p_write OR c.archived_at IS NULL));
END $$;
REVOKE ALL ON FUNCTION public.vendor_sample_storage_access(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_sample_storage_access(text,boolean) TO PUBLIC;
DROP POLICY IF EXISTS "Vendor sample files read gate" ON storage.objects;
CREATE POLICY "Vendor sample files read gate" ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING(bucket_id<>'vendor-sample-files' OR public.vendor_sample_storage_access(name,false));
DROP POLICY IF EXISTS "Vendor sample files insert gate" ON storage.objects;
CREATE POLICY "Vendor sample files insert gate" ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(bucket_id<>'vendor-sample-files' OR public.vendor_sample_storage_access(name,true));
DROP POLICY IF EXISTS "Vendor sample files update gate" ON storage.objects;
CREATE POLICY "Vendor sample files update gate" ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(bucket_id<>'vendor-sample-files') WITH CHECK(bucket_id<>'vendor-sample-files');
DROP POLICY IF EXISTS "Vendor sample files delete gate" ON storage.objects;
CREATE POLICY "Vendor sample files delete gate" ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING(bucket_id<>'vendor-sample-files');
DROP POLICY IF EXISTS "Vendor sample files read" ON storage.objects;
CREATE POLICY "Vendor sample files read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='vendor-sample-files' AND public.vendor_sample_storage_access(name,false));
DROP POLICY IF EXISTS "Vendor sample files insert" ON storage.objects;
CREATE POLICY "Vendor sample files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='vendor-sample-files' AND public.vendor_sample_storage_access(name,true));
NOTIFY pgrst,'reload schema';COMMIT;
