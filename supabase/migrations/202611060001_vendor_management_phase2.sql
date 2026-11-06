-- Fase 2: Follow-Up & Dashboard Sourcing. Additive, idempotent.
-- Prasyarat: Fase 1 + hardening is_app_role/my_profile_id (v3).
-- Tidak mengubah tabel, policy, guard, atau data existing.
-- RPC reminder hanya INSERT notifikasi baru ketika dipanggil authenticated.
-- Rollback TERPISAH: supabase/rollbacks/202611060001_vendor_management_phase2_rollback.sql
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.is_app_role(text[])') IS NULL OR to_regprocedure('public.my_profile_id()') IS NULL THEN
    RAISE EXCEPTION 'Prasyarat Fase 1 + hardening helper v3 belum tersedia';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_followups'
    AND policyname NOT IN ('Vendor followups read','Vendor followups insert','Vendor followups close task')) THEN
    RAISE EXCEPTION 'Policy vendor_followups tidak dikenal; audit dahulu, jangan aktifkan policy dorman';
  END IF;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.vendor_followup_code_seq START 1;
CREATE TABLE IF NOT EXISTS public.vendor_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Padding minimal 4 digit; jangan LPAD(...,4) yang memotong nomor >=10000.
  followup_code text UNIQUE NOT NULL DEFAULT 'FU-' || regexp_replace('000' || nextval('public.vendor_followup_code_seq')::text, '^0+(?=[0-9]{4})', ''),
  candidate_id uuid NOT NULL REFERENCES public.vendor_candidates(id) ON DELETE RESTRICT,
  contact_at timestamptz NOT NULL DEFAULT now(),
  internal_pic_id uuid NOT NULL REFERENCES public.user_profiles(id),
  channel text NOT NULL CHECK (channel IN ('TELEPON','WHATSAPP','KUNJUNGAN','EMAIL','VIDEO_CALL','PAMERAN','LAINNYA')),
  contact_outcome text NOT NULL DEFAULT 'BELUM_DINILAI'
    CHECK (contact_outcome IN ('TERHUBUNG','TIDAK_TERHUBUNG','BELUM_DINILAI')),
  contact_result text NOT NULL CHECK (length(btrim(contact_result)) > 0),
  new_info text,
  next_action text,
  next_action_due timestamptz,
  task_status text NOT NULL DEFAULT 'OPEN' CHECK (task_status IN ('OPEN','SELESAI','DIBATALKAN')),
  completed_at timestamptz,
  attachment_path text,
  notes text,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (next_action_due IS NULL OR nullif(btrim(next_action), '') IS NOT NULL),
  CHECK ((task_status = 'SELESAI') = (completed_at IS NOT NULL))
);
-- Kompatibilitas iterasi lokal sebelum rilis; log lama tetap BELUM_DINILAI,
-- tidak diasumsikan sebagai kontak berhasil dan tidak ditulis ulang.
ALTER TABLE public.vendor_followups ADD COLUMN IF NOT EXISTS contact_outcome text NOT NULL DEFAULT 'BELUM_DINILAI'
  CHECK (contact_outcome IN ('TERHUBUNG','TIDAK_TERHUBUNG','BELUM_DINILAI'));
CREATE INDEX IF NOT EXISTS idx_vendor_followups_candidate ON public.vendor_followups(candidate_id, contact_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_vendor_followups_pic ON public.vendor_followups(internal_pic_id);
CREATE INDEX IF NOT EXISTS idx_vendor_followups_open_due ON public.vendor_followups(next_action_due) WHERE task_status = 'OPEN';

-- INVOKER: jangan jadikan guard SECURITY DEFINER (konteks pemanggil penting).
CREATE OR REPLACE FUNCTION public.vendor_followups_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Follow-up permanen: DELETE tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['task_status','completed_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['task_status','completed_at']) THEN
      RAISE EXCEPTION 'Follow-up permanen: hanya task_status/completed_at boleh diubah' USING ERRCODE = '42501';
    END IF;
    IF OLD.task_status <> 'OPEN' AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Tugas sudah ditutup; catat follow-up baru' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- JWT otoritatif, bukan identitas/timestamp kiriman browser.
    IF auth.role() = 'authenticated' THEN
      NEW.created_by := public.my_profile_id();
    END IF;
    NEW.created_at := now();
  END IF;
  NEW.completed_at := CASE WHEN NEW.task_status = 'SELESAI'
    THEN CASE WHEN TG_OP = 'UPDATE' AND OLD.task_status = 'SELESAI' THEN OLD.completed_at ELSE now() END
    ELSE NULL END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_followups_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_vendor_followups_guard ON public.vendor_followups;
CREATE TRIGGER trg_vendor_followups_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_followups
  FOR EACH ROW EXECUTE FUNCTION public.vendor_followups_guard();

CREATE OR REPLACE FUNCTION public.vendor_followups_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW IS DISTINCT FROM OLD THEN
    INSERT INTO public.vendor_activity_logs(candidate_id, entity_table, entity_id, action, old_values, new_values, actor_id)
    VALUES (NEW.candidate_id, 'vendor_followups', NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN 'followup_created' ELSE 'followup_task_closed' END,
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW),
      coalesce(public.my_profile_id(), NEW.created_by));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_followups_audit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_vendor_followups_audit ON public.vendor_followups;
CREATE TRIGGER trg_vendor_followups_audit AFTER INSERT OR UPDATE ON public.vendor_followups
  FOR EACH ROW EXECUTE FUNCTION public.vendor_followups_audit();

ALTER TABLE public.vendor_followups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.vendor_followups TO authenticated;
REVOKE DELETE ON public.vendor_followups FROM anon, authenticated;
GRANT USAGE ON SEQUENCE public.vendor_followup_code_seq TO authenticated;
DROP POLICY IF EXISTS "Vendor followups read" ON public.vendor_followups;
CREATE POLICY "Vendor followups read" ON public.vendor_followups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor followups insert" ON public.vendor_followups;
CREATE POLICY "Vendor followups insert" ON public.vendor_followups FOR INSERT TO authenticated
  WITH CHECK (public.is_app_role(ARRAY['sourcing','hrd','super_admin']) AND created_by = public.my_profile_id());
DROP POLICY IF EXISTS "Vendor followups close task" ON public.vendor_followups;
CREATE POLICY "Vendor followups close task" ON public.vendor_followups FOR UPDATE TO authenticated
  USING (public.is_app_role(ARRAY['sourcing','hrd','super_admin']))
  WITH CHECK (public.is_app_role(ARRAY['sourcing','hrd','super_admin']));

-- Agregasi di server: tidak terpotong batas REST 1.000 baris.
-- KPI sampel/QC = jumlah kandidat pada tahap pipeline, bukan jumlah sampel.
-- Lokasi belum dinilai sampai tabel lokasi Fase 3 tersedia (NULL, bukan angka palsu).
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
REVOKE ALL ON FUNCTION public.vendor_sourcing_dashboard(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_sourcing_dashboard(uuid,uuid) TO authenticated;

-- Dipicu saat halaman monitoring dibuka/di-refresh; bukan scheduler latar belakang.
-- INVOKER: INSERT memakai policy notifications authenticated yang SUDAH ADA.
-- Satu kejadian overdue = satu tugas/PIC; tanpa tanggal pada ID, sehingga
-- refresh, pengirim serentak, atau pergantian hari tidak mengirim ulang kejadian sama.
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
REVOKE ALL ON FUNCTION public.vendor_remind_overdue_followups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_remind_overdue_followups() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
