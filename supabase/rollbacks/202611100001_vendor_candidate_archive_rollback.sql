-- Manual rollback only. Restore pre-archive reads; archived records reappear.
-- Archive metadata columns are dropped; permanent activity/follow-up histories are retained.
BEGIN;
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
    WHERE (p_category_id IS NULL OR c.category_id = p_category_id)
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
    WHERE f.task_status = 'OPEN' AND f.next_action_due < now()
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
WHERE public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']);

CREATE OR REPLACE FUNCTION public.vendor_location_monitoring(p_category_id uuid DEFAULT NULL,p_pic_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('incomplete',count(*) FILTER(WHERE NOT s.is_complete),'unverified',count(*) FILTER(WHERE s.is_complete AND NOT s.is_verified),
    'verified',count(*) FILTER(WHERE s.is_complete AND s.is_verified),'unmapped',count(*) FILTER(WHERE s.mapped_count=0))
  FROM public.vendor_location_summary s JOIN public.vendor_candidates c ON c.id=s.candidate_id
  WHERE (p_category_id IS NULL OR c.category_id=p_category_id) AND (p_pic_id IS NULL OR c.internal_pic_id=p_pic_id);
$$;
DROP FUNCTION IF EXISTS public.vendor_set_candidate_archive(uuid,boolean,text,timestamptz);
DROP TRIGGER IF EXISTS trg_vendor_candidate_archive_guard ON public.vendor_candidates;
DROP FUNCTION IF EXISTS public.vendor_candidate_archive_guard();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_contacts','vendor_candidate_specialties','vendor_followups','vendor_locations','vendor_location_photos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_vendor_archived_child_guard ON public.%I',t);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.vendor_archived_child_guard();
DROP INDEX IF EXISTS public.idx_vendor_candidates_unarchived;
ALTER TABLE public.vendor_candidates DROP COLUMN IF EXISTS archived_at,DROP COLUMN IF EXISTS archived_by,DROP COLUMN IF EXISTS archive_reason;
NOTIFY pgrst,'reload schema'; COMMIT;
