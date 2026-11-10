-- Candidate removal is reversible archival, never physical DELETE.
-- Additive to vendor_* only. No production execution without explicit approval.
BEGIN;
ALTER TABLE public.vendor_candidates
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_vendor_candidates_unarchived ON public.vendor_candidates(created_at DESC) WHERE archived_at IS NULL;

-- Invoker guard: direct REST writes cannot forge archive metadata or edit an archive.
CREATE OR REPLACE FUNCTION public.vendor_candidate_archive_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role()='service_role' OR current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.archive_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Arsip hanya melalui tindakan Hapus dari daftar' USING ERRCODE='42501';
    END IF;
  ELSIF OLD.archived_at IS NOT NULL OR
    ROW(NEW.archived_at,NEW.archived_by,NEW.archive_reason) IS DISTINCT FROM ROW(OLD.archived_at,OLD.archived_by,OLD.archive_reason) THEN
    RAISE EXCEPTION 'Profil arsip tidak dapat diubah langsung; gunakan tindakan arsip/pulihkan' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vendor_candidate_archive_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_vendor_candidate_archive_guard ON public.vendor_candidates;
CREATE TRIGGER trg_vendor_candidate_archive_guard BEFORE INSERT OR UPDATE ON public.vendor_candidates FOR EACH ROW EXECUTE FUNCTION public.vendor_candidate_archive_guard();

-- Preserve existing child guards; prevent new edits to archived candidate data.
CREATE OR REPLACE FUNCTION public.vendor_archived_child_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE row_data jsonb; candidate uuid; archive_time timestamptz; row_index integer;
BEGIN
  IF auth.role()='service_role' OR current_user IN ('postgres','supabase_admin') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  FOR row_index IN 1..2 LOOP
    IF row_index=1 AND TG_OP='INSERT' OR row_index=2 AND TG_OP='DELETE' THEN CONTINUE; END IF;
    row_data:=CASE WHEN row_index=1 THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    IF TG_TABLE_NAME='vendor_location_photos' THEN
      SELECT l.candidate_id INTO candidate FROM public.vendor_locations l WHERE l.id=(row_data->>'location_id')::uuid;
    ELSE candidate:=(row_data->>'candidate_id')::uuid; END IF;
    SELECT c.archived_at INTO archive_time FROM public.vendor_candidates c WHERE c.id=candidate FOR KEY SHARE;
    IF archive_time IS NOT NULL THEN RAISE EXCEPTION 'Kandidat diarsipkan; pulihkan sebelum mengubah data' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.vendor_archived_child_guard() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_contacts','vendor_candidate_specialties','vendor_followups','vendor_locations','vendor_location_photos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_vendor_archived_child_guard ON public.%I',t);
    EXECUTE format('CREATE TRIGGER trg_vendor_archived_child_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.vendor_archived_child_guard()',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.vendor_set_candidate_archive(p_candidate_id uuid,p_archive boolean,p_reason text,p_expected_updated_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.vendor_candidates%ROWTYPE; actor uuid; reason text:=btrim(p_reason); closed_tasks integer:=0;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN RAISE EXCEPTION 'Akses arsip kandidat ditolak' USING ERRCODE='42501'; END IF;
  actor:=public.my_profile_id();
  IF actor IS NULL OR p_archive IS NULL THEN RAISE EXCEPTION 'Identitas/tindakan tidak valid' USING ERRCODE='22023'; END IF;
  IF reason IS NULL OR length(reason)<5 OR length(reason)>1000 THEN RAISE EXCEPTION 'Alasan wajib 5–1000 karakter' USING ERRCODE='22023'; END IF;
  SELECT * INTO c FROM public.vendor_candidates WHERE id=p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kandidat tidak ditemukan' USING ERRCODE='P0002'; END IF;
  IF c.vendor_id IS NOT NULL OR c.operational_status<>'NOT_ACTIVE' OR c.qualification_status IN ('APPROVED','RESERVE','REJECTED','FROZEN') THEN
    RAISE EXCEPTION 'Vendor terhubung/aktif atau memiliki keputusan akhir tidak dapat dihapus dari daftar' USING ERRCODE='42501';
  END IF;
  IF (c.archived_at IS NOT NULL)=p_archive THEN RETURN c.id; END IF;
  IF c.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Data sudah berubah. Muat ulang daftar sebelum melanjutkan' USING ERRCODE='40001'; END IF;
  IF p_archive THEN
    -- Cancel open tasks atomically, through the existing append-only/status audit guards.
    UPDATE public.vendor_followups SET task_status='DIBATALKAN' WHERE candidate_id=c.id AND task_status='OPEN';
    GET DIAGNOSTICS closed_tasks=ROW_COUNT;
  END IF;
  UPDATE public.vendor_candidates SET archived_at=CASE WHEN p_archive THEN now() ELSE NULL END,
    archived_by=CASE WHEN p_archive THEN actor ELSE NULL END,archive_reason=CASE WHEN p_archive THEN reason ELSE NULL END,updated_by=actor WHERE id=c.id;
  INSERT INTO public.vendor_activity_logs(candidate_id,entity_table,entity_id,action,old_values,new_values,actor_id)
    VALUES(c.id,'vendor_candidates',c.id,CASE WHEN p_archive THEN 'candidate_archived' ELSE 'candidate_restored' END,
      jsonb_build_object('archived_at',c.archived_at,'archived_by',c.archived_by,'archive_reason',c.archive_reason),
      jsonb_build_object('archived',p_archive,'reason',reason,'cancelled_tasks',closed_tasks),actor);
  RETURN c.id;
END $$;
REVOKE ALL ON FUNCTION public.vendor_set_candidate_archive(uuid,boolean,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_set_candidate_archive(uuid,boolean,text,timestamptz) TO authenticated;

-- Existing invoker monitoring functions keep role checks, aggregation and reminder deduplication.
CREATE OR REPLACE FUNCTION public.vendor_sourcing_dashboard(p_category_id uuid DEFAULT NULL, p_pic_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']) THEN
    RAISE EXCEPTION 'Akses dashboard vendor ditolak' USING ERRCODE = '42501';
  END IF;
  WITH candidates AS (
    SELECT c.*, cat.name AS category_name, up.full_name AS pic_name
    FROM public.vendor_candidates c
    LEFT JOIN public.vendor_categories cat ON cat.id = c.category_id
    LEFT JOIN public.user_profiles up ON up.id = c.internal_pic_id
    WHERE c.archived_at IS NULL AND (p_category_id IS NULL OR c.category_id = p_category_id)
      AND (p_pic_id IS NULL OR c.internal_pic_id = p_pic_id)
  ), monitoring AS (
    SELECT c.*, f.total_followups, f.successful_contacts, f.open_tasks, f.completed_tasks,
      f.cancelled_tasks, f.overdue_tasks, f.next_due,
      (c.process_stage NOT IN ('CLOSED','ABANDONED') AND
        (f.total_followups = 0 OR f.open_tasks > 0)) AS needs_followup
    FROM candidates c
    CROSS JOIN LATERAL (
      SELECT count(*) AS total_followups,
        count(*) FILTER (WHERE contact_outcome = 'TERHUBUNG') AS successful_contacts,
        count(*) FILTER (WHERE task_status = 'OPEN') AS open_tasks,
        count(*) FILTER (WHERE task_status = 'SELESAI') AS completed_tasks,
        count(*) FILTER (WHERE task_status = 'DIBATALKAN') AS cancelled_tasks,
        count(*) FILTER (WHERE task_status = 'OPEN' AND next_action_due < now()) AS overdue_tasks,
        min(next_action_due) FILTER (WHERE task_status = 'OPEN') AS next_due
      FROM public.vendor_followups WHERE candidate_id = c.id
    ) f
  ), activities AS (
    SELECT f.* FROM public.vendor_followups f JOIN candidates c ON c.id = f.candidate_id
  ), recorded AS (
    SELECT created_by AS pic_id, count(*) AS activities_recorded,
      count(DISTINCT candidate_id) AS vendors_attempted,
      count(DISTINCT candidate_id) FILTER (WHERE contact_outcome = 'TERHUBUNG') AS vendors_contacted
    FROM activities GROUP BY created_by
  ), assigned AS (
    SELECT internal_pic_id AS pic_id,
      count(*) FILTER (WHERE task_status = 'OPEN') AS open_tasks,
      count(*) FILTER (WHERE task_status = 'OPEN' AND next_action_due < now()) AS overdue_tasks,
      count(*) FILTER (WHERE task_status = 'SELESAI') AS completed_tasks,
      count(*) FILTER (WHERE task_status = 'DIBATALKAN') AS cancelled_tasks
    FROM activities GROUP BY internal_pic_id
  ), productivity AS (
    SELECT up.id AS pic_id, up.full_name AS pic_name, r.role_name,
      coalesce(rec.activities_recorded,0) AS activities_recorded,
      coalesce(rec.vendors_attempted,0) AS vendors_attempted,
      coalesce(rec.vendors_contacted,0) AS vendors_contacted,
      coalesce(a.open_tasks,0) AS open_tasks, coalesce(a.overdue_tasks,0) AS overdue_tasks,
      coalesce(a.completed_tasks,0) AS completed_tasks, coalesce(a.cancelled_tasks,0) AS cancelled_tasks
    FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id
    LEFT JOIN recorded rec ON rec.pic_id = up.id LEFT JOIN assigned a ON a.pic_id = up.id
    WHERE (r.role_name = 'sourcing' AND up.account_status = 'ACTIVE') OR rec.pic_id IS NOT NULL OR a.pic_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
      'total', count(*), 'new_leads', count(*) FILTER (WHERE process_stage = 'LEAD'),
      'vendors_attempted', count(*) FILTER (WHERE total_followups > 0),
      'vendors_contacted', count(*) FILTER (WHERE successful_contacts > 0),
      'followup_activities', coalesce(sum(total_followups),0),
      'open_tasks', coalesce(sum(open_tasks),0),
      'completed_tasks', coalesce(sum(completed_tasks),0),
      'cancelled_tasks', coalesce(sum(cancelled_tasks),0),
      'needs_followup', count(*) FILTER (WHERE needs_followup),
      'overdue', coalesce(sum(overdue_tasks),0), 'location_incomplete', NULL,
      'samples_running', count(*) FILTER (WHERE process_stage IN ('SAMPLE_ASSIGNED','SAMPLE_IN_PROGRESS','SAMPLE_REVISION')),
      'awaiting_qc', count(*) FILTER (WHERE process_stage IN ('SAMPLE_RECEIVED','QC_REVIEW')),
      'awaiting_approval', count(*) FILTER (WHERE process_stage = 'AWAITING_APPROVAL' OR qualification_status = 'PENDING_APPROVAL'),
      'approved', count(*) FILTER (WHERE qualification_status = 'APPROVED')
    ) FROM monitoring),
    'priority', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.overdue_tasks DESC, p.next_due NULLS LAST, p.created_at), '[]'::jsonb)
      FROM (SELECT id,candidate_code,business_name,category_name,pic_name,process_stage,
          total_followups,open_tasks,overdue_tasks,next_due,created_at
        FROM monitoring WHERE needs_followup OR overdue_tasks > 0
        ORDER BY overdue_tasks DESC, next_due NULLS LAST, created_at LIMIT 20) p),
    'stages', (SELECT coalesce(jsonb_object_agg(process_stage, n), '{}'::jsonb)
      FROM (SELECT process_stage,count(*) AS n FROM candidates GROUP BY process_stage) s),
    'pic_productivity', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.activities_recorded DESC,p.pic_name,p.pic_id), '[]'::jsonb) FROM productivity p)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_remind_overdue_followups()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_count integer := 0; v_day date := (now() AT TIME ZONE 'Asia/Jakarta')::date; v_row record;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN
    RAISE EXCEPTION 'Akses reminder vendor ditolak' USING ERRCODE = '42501';
  END IF;
  FOR v_row IN
    SELECT f.id, f.internal_pic_id, f.next_action, f.candidate_id, c.business_name
    FROM public.vendor_followups f JOIN public.vendor_candidates c ON c.id = f.candidate_id
    JOIN public.user_profiles up ON up.id = f.internal_pic_id AND up.account_status = 'ACTIVE'
    WHERE c.archived_at IS NULL AND f.task_status = 'OPEN' AND f.next_action_due < now()
  LOOP
    BEGIN
      -- Jangan ON CONFLICT: itu memerlukan SELECT atas notifikasi PIC lain,
      -- sedangkan policy existing hanya mengizinkan penerima membaca miliknya.
      INSERT INTO public.notifications(id,user_id,notification_type,title,message,reference_type,reference_id,reference_url,notification_date)
      VALUES (md5('vendor-followup:' || v_row.id::text || ':' || v_row.internal_pic_id::text)::uuid,
        v_row.internal_pic_id, 'VENDOR_FOLLOWUP_OVERDUE', 'Follow-up vendor terlambat',
        v_row.business_name || ': ' || v_row.next_action, 'vendor_followup', v_row.id,
        '/vendor/followups?candidate=' || v_row.candidate_id::text || '&overdue=1', v_day);
      v_count := v_count + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- ID deterministik; aman terhadap pemanggilan serentak.
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

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
WHERE c.archived_at IS NULL AND public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']);

CREATE OR REPLACE FUNCTION public.vendor_location_monitoring(p_category_id uuid DEFAULT NULL,p_pic_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('incomplete',count(*) FILTER(WHERE NOT s.is_complete),'unverified',count(*) FILTER(WHERE s.is_complete AND NOT s.is_verified),
    'verified',count(*) FILTER(WHERE s.is_complete AND s.is_verified),'unmapped',count(*) FILTER(WHERE s.mapped_count=0))
  FROM public.vendor_location_summary s JOIN public.vendor_candidates c ON c.id=s.candidate_id
  WHERE c.archived_at IS NULL AND (p_category_id IS NULL OR c.category_id=p_category_id) AND (p_pic_id IS NULL OR c.internal_pic_id=p_pic_id);
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
