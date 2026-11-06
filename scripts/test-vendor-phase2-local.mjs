// Hanya Docker lokal terisolasi. Tidak membaca .env atau menghubungi produksi.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const container = 'supabase_db_harmas-vendor-test';
const migration = readFileSync(new URL('../supabase/migrations/202611060001_vendor_management_phase2.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../supabase/rollbacks/202611060001_vendor_management_phase2_rollback.sql', import.meta.url), 'utf8');
const evidence = [];
function sql(input) {
  const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', maxBuffer: 8e6 });
  return { ok: r.status === 0, out: r.stdout?.trim() || '', error: r.stderr?.trim() || r.error?.message || '' };
}
function must(input) {
  const result = sql(input);
  assert.ok(result.ok, result.error);
  return result.out;
}
function record(label, detail) { const line = `PASS | ${label} | ${detail}`; evidence.push(line); console.log(line); }
const existingSnapshot = () => must(`SELECT jsonb_build_object(
 'tables',(SELECT jsonb_object_agg(t,checksum) FROM (
  SELECT 'vendors' t,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) checksum FROM public.vendors x
  UNION ALL SELECT 'assets',md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.assets x
  UNION ALL SELECT 'user_profiles',md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.user_profiles x
  UNION ALL SELECT 'roles',md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.roles x
  UNION ALL SELECT 'role_permissions',md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.role_permissions x
  UNION ALL SELECT 'notifications',md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.notifications x) q),
 'policies',(SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname)::text) FROM pg_policies p WHERE schemaname='public' AND tablename <> 'vendor_followups'),
 'guards',(SELECT md5(string_agg(pg_get_functiondef(oid),'' ORDER BY proname)) FROM pg_proc WHERE oid IN ('public.vendor_guard_restricted_columns()'::regprocedure,'public.profiles_guard_admin_fields()'::regprocedure,'public.is_app_role(text[])'::regprocedure,'public.my_profile_id()'::regprocedure))
);`);

// Fixture sintetis lama hanya memiliki 5 kolom notifikasi. Lengkapi KHUSUS Docker
// berdasarkan schema-only backup lokal 2026-11-05; bukan bagian migration produksi.
must(`ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message text,
 ADD COLUMN IF NOT EXISTS notification_type varchar(50), ADD COLUMN IF NOT EXISTS reference_type varchar(50),
 ADD COLUMN IF NOT EXISTS reference_id uuid, ADD COLUMN IF NOT EXISTS reference_url text,
 ADD COLUMN IF NOT EXISTS notification_date date, ADD COLUMN IF NOT EXISTS read_at timestamptz;`);
const before = existingSnapshot();
must(migration);
must(migration);
assert.equal(existingSnapshot(), before);
record('Migration idempotent 2x', 'COMMIT 2x; checksum data, policy existing, dan fungsi guard tetap sama');

const structure = must(`SELECT relrowsecurity FROM pg_class WHERE oid='public.vendor_followups'::regclass;
SELECT count(*) FROM pg_policies WHERE tablename='vendor_followups';
SELECT count(*) FROM pg_policies WHERE tablename='vendor_followups' AND cmd='DELETE';
SELECT prosecdef FROM pg_proc WHERE oid='public.vendor_sourcing_dashboard(uuid,uuid)'::regprocedure;
SELECT prosecdef FROM pg_proc WHERE oid='public.vendor_remind_overdue_followups()'::regprocedure;
SELECT has_function_privilege('anon','public.vendor_sourcing_dashboard(uuid,uuid)','EXECUTE');
SELECT has_function_privilege('anon','public.vendor_remind_overdue_followups()','EXECUTE');`);
assert.equal(structure, 't\n3\n0\nf\nf\nf\nf');
record('Struktur / RLS / ACL', structure.replaceAll('\n', ', '));
const uid = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const pid = (n) => `11111111-0000-4000-a000-${String(n).padStart(12, '0')}`;
const cid = (n) => `22222222-0000-4000-a000-${String(n).padStart(12, '0')}`;
const fid = (n) => `33333333-0000-4000-a000-${String(n).padStart(12, '0')}`;
const categoryId = '44444444-0000-4000-a000-000000000001';
const fixture = `
INSERT INTO public.vendor_categories(id,name) VALUES ('${categoryId}','Uji Fase 2 Isolasi');
INSERT INTO public.vendor_candidates(id,business_name,category_id,internal_pic_id,process_stage,qualification_status) VALUES
 ('${cid(1)}','Siti Maemunah','${categoryId}','${pid(4)}','LEAD','PROSPECT'),
 ('${cid(2)}','Uji QC','${categoryId}','${pid(3)}','QC_REVIEW','UNDER_EVALUATION'),
 ('${cid(3)}','Uji Approval','${categoryId}','${pid(4)}','AWAITING_APPROVAL','PENDING_APPROVAL'),
 ('${cid(4)}','Uji Approved','${categoryId}','${pid(4)}','CLOSED','APPROVED'),
 ('${cid(5)}','Uji Sampel','${categoryId}','${pid(4)}','SAMPLE_IN_PROGRESS','UNDER_EVALUATION'),
 ('${cid(6)}','Uji Arsip','${categoryId}','${pid(4)}','ABANDONED','PROSPECT');
INSERT INTO public.vendor_followups(id,candidate_id,internal_pic_id,channel,contact_outcome,contact_result,next_action,next_action_due,created_by)
SELECT ('33333333-0000-4000-a000-' || lpad(g::text,12,'0'))::uuid,'${cid(1)}',CASE WHEN g=3 THEN '${pid(3)}'::uuid ELSE '${pid(4)}'::uuid END,
 'WHATSAPP',CASE WHEN g=2 THEN 'TIDAK_TERHUBUNG' ELSE 'TERHUBUNG' END,'Kontak ' || g,'Aksi ' || g,now() + (g - 2) * interval '2 days' + CASE WHEN g=2 THEN interval '1 hour' ELSE interval '0 hours' END,'${pid(4)}'
FROM generate_series(1,3) g;`;
function role(n, name = 'authenticated') {
  return `SET LOCAL ROLE ${name}; SELECT set_config('request.jwt.claims','${JSON.stringify({ role: name, ...(n ? { sub: uid(n) } : {}) })}',true);`;
}
function check(label, who, operation, expected = 'PASS', setup = '') {
  const result = sql(`BEGIN; ${fixture} ${setup} ${who} ${operation}; ROLLBACK;`);
  if (expected instanceof RegExp) {
    assert.ok(!result.ok && expected.test(result.error), `${label}\n${result.out}\n${result.error}`);
    record(label, result.error.split('\n')[0]);
  } else {
    assert.ok(result.ok && result.out.includes(expected), `${label}\n${result.out}\n${result.error}`);
    record(label, expected);
  }
}
const assertion = (condition) => `DO $$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION 'ASSERT gagal'; END IF; END $$; SELECT 'PASS'`;
const insert = `INSERT INTO public.vendor_followups(candidate_id,internal_pic_id,channel,contact_result,created_by) VALUES ('${cid(1)}','${pid(4)}','TELEPON','Hasil baru','${pid(1)}')`;
for (const [name,n] of [['sourcing',4],['hrd',3],['super_admin',1]]) {
  check(`INSERT ${name}`,role(n),`${insert}; ${assertion(`EXISTS(SELECT 1 FROM public.vendor_followups WHERE contact_result='Hasil baru' AND created_by='${pid(n)}')`)}`);
  check(`CLOSE ${name}`,role(n),`UPDATE public.vendor_followups SET task_status='SELESAI' WHERE id='${fid(1)}'; ${assertion(`EXISTS(SELECT 1 FROM public.vendor_followups WHERE id='${fid(1)}' AND completed_at IS NOT NULL)`)}`);
  check(`DELETE ${name} ditolak`,role(n),`DELETE FROM public.vendor_followups WHERE id='${fid(1)}'`,/permission denied|permanen/);
  for (const field of ["qualification_status='APPROVED'", "operational_status='ACTIVE'"]) {
    check(`Guard Fase 1 ${name} ${field}`,role(n),`UPDATE public.vendor_candidates SET ${field} WHERE id='${cid(1)}'`,/DITOLAK: keputusan kelayakan/);
  }
}
for (const [name,n,setup] of [['direksi',2,''],['pelaksana',5,''],['finance',5,`UPDATE public.user_profiles SET role_id=(SELECT id FROM public.roles WHERE role_name='finance') WHERE id='${pid(5)}';`]]) {
  check(`READ ${name}`,role(n),assertion(`(SELECT count(*) FROM public.vendor_followups WHERE candidate_id='${cid(1)}')=3`),'PASS',setup);
  check(`INSERT ${name} ditolak`,role(n),insert,/row-level security/,setup);
  check(`UPDATE ${name} 0 row`,role(n),`UPDATE public.vendor_followups SET task_status='SELESAI' WHERE id='${fid(1)}'; ${assertion(`EXISTS(SELECT 1 FROM public.vendor_followups WHERE id='${fid(1)}' AND task_status='OPEN')`)}`,'PASS',setup);
}
check('Anon tidak melihat log',role(null,'anon'),assertion(`(SELECT count(*) FROM public.vendor_followups)=0`));
check('Anon INSERT ditolak',role(null,'anon'),insert,/permission denied|row-level security/);
check('JWT tanpa sub ditolak',role(null),insert,/row-level security|not-null/);
check('Akun disabled ditolak',role(4),insert,/row-level security/,`UPDATE public.user_profiles SET account_status='DISABLED' WHERE id='${pid(4)}';`);
for (const [column,value] of [['contact_result',"'Timpa'"],['contact_outcome',"'TIDAK_TERHUBUNG'"],['new_info',"'Timpa'"],['candidate_id',`'${cid(2)}'`],['internal_pic_id',`'${pid(3)}'`],['created_by',`'${pid(1)}'`],['created_at',"now()-interval '1 day'"],['next_action_due',"now()+interval '1 day'"],['attachment_path',"'ganti.pdf'"]]) {
  check(`Append-only ${column}`,role(4),`UPDATE public.vendor_followups SET ${column}=${value} WHERE id='${fid(1)}'`,/hanya task_status/);
}
check('DELETE backend juga ditolak','',`DELETE FROM public.vendor_followups WHERE id='${fid(1)}'`,/DELETE tidak diizinkan/);
check('Waktu selesai otoritatif',role(4),`UPDATE public.vendor_followups SET task_status='SELESAI',completed_at='2000-01-01' WHERE id='${fid(1)}'; ${assertion(`EXISTS(SELECT 1 FROM public.vendor_followups WHERE id='${fid(1)}' AND completed_at=now())`)}`);
check('Cancel tetap tanpa completed_at',role(4),`UPDATE public.vendor_followups SET task_status='DIBATALKAN' WHERE id='${fid(1)}'; ${assertion(`EXISTS(SELECT 1 FROM public.vendor_followups WHERE id='${fid(1)}' AND completed_at IS NULL)`)}`);
check('Buka ulang terminal ditolak',role(4),`UPDATE public.vendor_followups SET task_status='SELESAI' WHERE id='${fid(1)}'; UPDATE public.vendor_followups SET task_status='OPEN' WHERE id='${fid(1)}'`,/Tugas sudah ditutup/);
check('Tiga follow-up berbeda tidak tertimpa',role(4),assertion(`(SELECT count(DISTINCT contact_result) FROM public.vendor_followups WHERE candidate_id='${cid(1)}')=3`));
check('Reapply migration dengan log terisi','',`${migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')}; ${assertion(`(SELECT count(*) FROM public.vendor_followups WHERE candidate_id='${cid(1)}')=3`)}`);
check('Hasil kosong ditolak',role(4),insert.replace("'Hasil baru'","'  '"),/check constraint/);
check('Channel invalid ditolak',role(4),insert.replace("'TELEPON'","'SMS'"),/check constraint/);
check('FK kandidat invalid ditolak',role(4),insert.replace(cid(1),cid(9)),/foreign key/);
check('Audit actor dari JWT',role(3),`UPDATE public.vendor_followups SET task_status='SELESAI' WHERE id='${fid(1)}'; ${assertion(`EXISTS(SELECT 1 FROM public.vendor_activity_logs WHERE entity_id='${fid(1)}' AND action='followup_task_closed' AND actor_id='${pid(3)}' AND old_values->>'task_status'='OPEN' AND new_values->>'task_status'='SELESAI')`)}`);
check('INSERT audit palsu ditolak',role(4),`INSERT INTO public.vendor_activity_logs(entity_table,action) VALUES ('vendor_followups','palsu')`,/row-level security/);
check('KPI dan prioritas akurat',role(4),`DO $$ DECLARE d jsonb; BEGIN d:=public.vendor_sourcing_dashboard('${categoryId}',NULL);
 IF d->'kpis' <> '{"total":6,"new_leads":1,"needs_followup":4,"overdue":1,"location_incomplete":null,"samples_running":1,"awaiting_qc":1,"awaiting_approval":1,"approved":1,"vendors_attempted":1,"vendors_contacted":1,"followup_activities":3,"open_tasks":3,"completed_tasks":0,"cancelled_tasks":0}'::jsonb THEN RAISE EXCEPTION 'KPI salah %',d; END IF;
 IF d->'priority'->0->>'id' <> '${cid(1)}' THEN RAISE EXCEPTION 'Urutan salah'; END IF;
 END $$; SELECT 'PASS'`);
check('Dashboard filter kategori + PIC',role(2),assertion(`public.vendor_sourcing_dashboard('${categoryId}','${pid(3)}')->'kpis'->>'total'='1'`));
check('Dashboard kosong valid',role(4),assertion(`public.vendor_sourcing_dashboard('${cid(9)}',NULL)->'kpis'->>'total'='0'`));
check('Produktivitas memisahkan pencatat dan PIC tugas',role(4),`DO $$ DECLARE d jsonb; s jsonb; h jsonb; BEGIN
 d:=public.vendor_sourcing_dashboard('${categoryId}',NULL);
 SELECT value INTO s FROM jsonb_array_elements(d->'pic_productivity') WHERE value->>'pic_id'='${pid(4)}';
 SELECT value INTO h FROM jsonb_array_elements(d->'pic_productivity') WHERE value->>'pic_id'='${pid(3)}';
 IF s->>'activities_recorded'<>'3' OR s->>'vendors_contacted'<>'1' OR s->>'open_tasks'<>'2' OR h->>'activities_recorded'<>'0' OR h->>'open_tasks'<>'1' THEN RAISE EXCEPTION 'Atribusi salah %',d; END IF;
 END $$; SELECT 'PASS'`);
check('KPI tugas selesai dan batal terpisah',role(4),`UPDATE public.vendor_followups SET task_status='SELESAI' WHERE id='${fid(1)}'; UPDATE public.vendor_followups SET task_status='DIBATALKAN' WHERE id='${fid(2)}'; ${assertion(`public.vendor_sourcing_dashboard('${categoryId}',NULL)->'kpis' @> '{"followup_activities":3,"vendors_contacted":1,"open_tasks":1,"completed_tasks":1,"cancelled_tasks":1,"overdue":0}'::jsonb`)}`);
check('Log belum dinilai tidak diasumsikan kontak berhasil',role(4),`${insert.replace(cid(1),cid(2))}; ${assertion(`public.vendor_sourcing_dashboard('${categoryId}',NULL)->'kpis' @> '{"vendors_attempted":2,"vendors_contacted":1,"followup_activities":4}'::jsonb`)}`);
check('Outcome invalid ditolak',role(4),insert.replace('channel,contact_result','channel,contact_outcome,contact_result').replace("'TELEPON','Hasil baru'","'TELEPON','ASUMSI','Hasil baru'"),/check constraint/);
check('Policy tak dikenal memblokir reapply','',`CREATE POLICY "unexpected dormant" ON public.vendor_followups FOR SELECT TO anon USING (true); ${migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')}`,/Policy vendor_followups tidak dikenal/);
check('Dashboard tanpa limit REST',role(4),assertion(`public.vendor_sourcing_dashboard('${categoryId}',NULL)->'kpis'->>'total'='1011'`),'PASS',`INSERT INTO public.vendor_candidates(business_name,category_id) SELECT 'Banyak '||g,'${categoryId}' FROM generate_series(1,1005) g;`);
check('Dashboard finance ditolak',role(5),`SELECT public.vendor_sourcing_dashboard()`,/Akses dashboard/);
check('Anon dashboard RPC ditolak',role(null,'anon'),`SELECT public.vendor_sourcing_dashboard()`,/permission denied/);
check('Reminder INSERT + deduplikasi',role(4),`SELECT public.vendor_remind_overdue_followups(); SELECT public.vendor_remind_overdue_followups(); ${assertion(`(SELECT count(*) FROM public.notifications WHERE reference_id='${fid(1)}' AND user_id='${pid(4)}' AND notification_date=(now() AT TIME ZONE 'Asia/Jakarta')::date)=1`)}`);
check('Reminder tidak berulang setelah pergantian hari',role(4),`INSERT INTO public.notifications(id,user_id,title,reference_id,notification_date) VALUES (md5('vendor-followup:${fid(1)}:${pid(4)}')::uuid,'${pid(4)}','Reminder kemarin','${fid(1)}',(now() AT TIME ZONE 'Asia/Jakarta')::date-1); ${assertion(`public.vendor_remind_overdue_followups()=0 AND (SELECT count(*) FROM public.notifications WHERE reference_id='${fid(1)}')=1`)}`);
check('Reminder lintas pengirim tetap satu',role(3),`SELECT public.vendor_remind_overdue_followups(); RESET ROLE; ${role(4)} SELECT public.vendor_remind_overdue_followups(); ${assertion(`(SELECT count(*) FROM public.notifications WHERE reference_id='${fid(1)}')=1`)}`);
check('Reminder tidak dikirim untuk tugas selesai',role(4),`UPDATE public.vendor_followups SET task_status='SELESAI' WHERE id='${fid(1)}'; SELECT public.vendor_remind_overdue_followups(); ${assertion(`NOT EXISTS(SELECT 1 FROM public.notifications WHERE reference_id='${fid(1)}')`)}`);
check('Reminder direksi ditolak',role(2),`SELECT public.vendor_remind_overdue_followups()`,/Akses reminder/);
check('Notifikasi hanya penerima dapat baca',role(3),`SELECT public.vendor_remind_overdue_followups(); ${assertion(`NOT EXISTS(SELECT 1 FROM public.notifications WHERE reference_id='${fid(1)}')`)}`);
check('Penerima pakai profile.id bukan auth.uid',role(4),`SELECT public.vendor_remind_overdue_followups(); ${assertion(`EXISTS(SELECT 1 FROM public.notifications WHERE reference_id='${fid(1)}' AND user_id='${pid(4)}' AND reference_url LIKE '/vendor/followups?candidate=%&overdue=1')`)}`);

assert.equal(existingSnapshot(),before);
record('Data existing setelah seluruh skenario', 'Checksum identik; semua fixture/transaksi uji ROLLBACK');
assert.equal(must('SELECT count(*) FROM public.vendor_followups;'),'0', 'Rollback hanya diuji pada tabel lokal kosong');
must(rollback); must(rollback);
assert.equal(must("SELECT to_regclass('public.vendor_followups') IS NULL;"),'t');
assert.equal(existingSnapshot(),before);
must(migration);
record('Rollback 2x + apply ulang', 'PASS; objek Fase 2 hilang lalu pulih, existing tetap sama');
must(`SELECT setval('public.vendor_followup_code_seq',9999,true);`);
check('Kode FU melewati 9999 tidak terpotong',role(4),assertion(`(SELECT count(*) FROM public.vendor_followups WHERE candidate_id='${cid(1)}' AND followup_code IN ('FU-10000','FU-10001','FU-10002'))=3`));
must(`SELECT setval('public.vendor_followup_code_seq',1,false);`);
evidence.push(`TOTAL: ${evidence.length} PASS; 0 FAIL`, `SNAPSHOT EXISTING: ${before}`);
writeFileSync(new URL('../docs/vendor-management/PHASE2_LOCAL_TEST_RESULTS.txt',import.meta.url),evidence.join('\n')+'\n');
console.log(evidence.at(-2));
