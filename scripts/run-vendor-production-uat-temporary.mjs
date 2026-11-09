// Scope yang disetujui user: dua akun uji sementara (super_admin + sourcing),
// UAT baca, cabut sesi dan hapus akun/profil baru; tanpa data bisnis dummy.
// Kredensial hanya env/memori. Ledger hanya UUID/marker agar cleanup dapat diaudit.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const api='https://uwlxkwyauxwewoexfgwi.supabase.co';
const key=process.env.SUPABASE_SERVICE_KEY;
assert.ok(key && process.env.SUPABASE_ANON_KEY && process.env.PLAYWRIGHT_PACKAGE_PATH,'Butuh key dan Playwright melalui env sesi');
const folder=new URL('../docs/vendor-management/production-verification-20261109/',import.meta.url);
mkdirSync(folder,{recursive:true});
const runId=randomUUID();
const report={started_at:new Date().toISOString(),run_id:runId,scope:'two temporary privileged accounts; business data read-only; delete after UAT',accounts:[],checks:[]};
const save=()=>writeFileSync(new URL('TEMPORARY_ACCOUNT_LIFECYCLE.json',folder),JSON.stringify(report,null,2)+'\n');
const pass=(label)=>{report.checks.push({status:'PASS',label});console.log(`PASS | ${label}`);save();};
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function request(path,options={}) {
  return fetch(api+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});
}
async function recoverCreatedId(record) {
  // Jika respons create hilang, cari email unik run ini lalu validasi marker;
  // jangan memakai users[0] atau menganggap parameter filter admin pasti bekerja.
  for(let page=1;page<=20;page++) {
    const r=await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
    assert.equal(r.status,200);const body=await r.json();const users=body.users||[];
    const user=users.find((u)=>u.email===record.email);
    if(user) {assert.equal(user.user_metadata?.harmas_vendor_uat_run,runId);return user.id;}
    if(users.length<100)return null;
  }
  throw new Error('Listing cleanup mencapai batas; periksa akun email unik run ini');
}
async function baseline() {
  const sql=`DO $uat$ DECLARE v jsonb; BEGIN
    SELECT jsonb_object_agg(name,jsonb_build_object('count',n,'checksum',checksum)) INTO v FROM (
      SELECT 'vendors' name,count(*) n,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) checksum FROM public.vendors x
      UNION ALL SELECT 'assets',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.assets x
      UNION ALL SELECT 'user_profiles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.user_profiles x
      UNION ALL SELECT 'roles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.roles x
      UNION ALL SELECT 'role_permissions',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.role_permissions x
      UNION ALL SELECT 'notifications',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.notifications x
      UNION ALL SELECT 'employees',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.employees x
      UNION ALL SELECT 'contracts',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.contracts x
      UNION ALL SELECT 'vendor_candidates',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_candidates x
      UNION ALL SELECT 'vendor_followups',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_followups x
      UNION ALL SELECT 'auth_users',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM auth.users x
    ) q; RAISE EXCEPTION 'UAT_BASELINE:%',v::text; END $uat$;`;
  const r=await request('/rest/v1/rpc/exec_sql',{method:'POST',body:JSON.stringify({sql})});
  const body=await r.json();assert.equal(r.status,400);assert.ok(body.message?.startsWith('UAT_BASELINE:'));
  return JSON.parse(body.message.slice('UAT_BASELINE:'.length));
}
const secrets=[];
let failure;
try {
  report.before=await baseline();save();
  const rolesResponse=await request('/rest/v1/roles?select=id,role_name&role_name=in.(super_admin,sourcing)');
  assert.equal(rolesResponse.status,200);const roles=await rolesResponse.json();
  assert.equal(roles.length,2);
  // Tidak ada akun existing yang dicari/diambil alih: email unik dan marker per run.
  for(const role of ['super_admin','sourcing']) {
    const email=`vendor-uat-${role.replace('_','-')}-${runId}@harmas-test.local`;
    const password=randomBytes(36).toString('base64url')+'aA1!';
    const record={role,email,marker:runId,created:false,deleted:false};
    report.accounts.push(record);save();
    const created=await request('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:`UAT sementara ${role}`,harmas_vendor_uat_run:runId}})});
    assert.ok(created.ok,`Pembuatan akun ${role} gagal: HTTP ${created.status}`);
    const user=await created.json();assert.ok(user.id);
    record.auth_user_id=user.id;record.created=true;secrets.push({role,email,password});save();
    assert.equal(user.email,email);assert.equal(user.user_metadata?.harmas_vendor_uat_run,runId);
    const lookup=await request(`/rest/v1/user_profiles?select=id,auth_user_id&auth_user_id=eq.${user.id}`);
    assert.equal(lookup.status,200);const profiles=await lookup.json();assert.ok(profiles.length<=1);
    const payload={full_name:`UAT sementara ${role}`,email,role_id:roles.find((r)=>r.role_name===role).id,account_status:'ACTIVE'};
    // Bila trigger Auth membuat profil, hanya baris untuk UID baru ini yang disentuh.
    const profile=await request(profiles.length?`/rest/v1/user_profiles?id=eq.${profiles[0].id}&auth_user_id=eq.${user.id}`:'/rest/v1/user_profiles',{
      method:profiles.length?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(profiles.length?payload:{...payload,auth_user_id:user.id})
    });
    assert.ok(profile.ok,`Profil UAT ${role} gagal: HTTP ${profile.status}`);
    const data=await profile.json();assert.equal(data.length,1);record.profile_id=data[0].id;save();
    pass(`Akun/profil sementara ${role} dibuat; tidak mengubah akun existing`);
  }
  const childEnv={...process.env};delete childEnv.SUPABASE_SERVICE_KEY;
  for(const a of secrets) {
    const prefix=a.role==='super_admin'?'HARMAS_UAT_ADMIN':'HARMAS_UAT_SOURCING';
    childEnv[`${prefix}_EMAIL`]=a.email;childEnv[`${prefix}_PASSWORD`]=a.password;
  }
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('./test-vendor-production-authenticated-readonly.mjs',import.meta.url))],{
    env:childEnv,cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',maxBuffer:4e6,timeout:180000
  });
  // Child hanya mengeluarkan label hasil; jangan keluarkan stderr yang bisa
  // memuat request internals. Bukti kegagalan teredaksi tersimpan oleh harness.
  if(child.stdout)process.stdout.write(child.stdout);
  report.browser_exit=child.status;
  assert.equal(child.status,0,'UAT browser gagal; cleanup tetap dijalankan');
  const uat=JSON.parse(readFileSync(new URL('AUTHENTICATED_RESULTS.json',folder),'utf8'));
  assert.ok(!uat.results.some((r)=>r.status==='FAIL'),'Ada pemeriksaan/logout UAT yang gagal');
  pass('UAT baca kedua role selesai dan sesi UAT telah logout');
} catch(error) {
  failure=error;report.checks.push({status:'FAIL',label:error.message});save();
} finally {
  // Hapus hanya UID yang baru dikembalikan oleh create + email/marker yang cocok.
  for(const record of [...report.accounts].reverse()) {
    try {
      record.auth_user_id??=await recoverCreatedId(record);
      if(!record.auth_user_id) {record.deleted=true;pass(`Tidak ada akun sementara ${record.role} yang perlu dihapus`);continue;}
      const lookup=await request(`/auth/v1/admin/users/${record.auth_user_id}`);
      if(lookup.status!==404) {
        assert.equal(lookup.status,200);const user=await lookup.json();
        assert.equal(user.id,record.auth_user_id);assert.equal(user.email,record.email);
        assert.equal(user.user_metadata?.harmas_vendor_uat_run,runId,'Marker tidak cocok: jangan menghapus akun');
        const removed=await request(`/auth/v1/admin/users/${record.auth_user_id}`,{method:'DELETE'});
        assert.ok(removed.ok,`Hapus akun ${record.role}: HTTP ${removed.status}`);
      }
      const authCheck=await request(`/auth/v1/admin/users/${record.auth_user_id}`);assert.equal(authCheck.status,404);
      const profileCheck=await request(`/rest/v1/user_profiles?select=id&auth_user_id=eq.${record.auth_user_id}`);
      assert.equal(profileCheck.status,200);assert.deepEqual(await profileCheck.json(),[]);
      record.deleted=true;pass(`Akun Auth dan profil sementara ${record.role} dipastikan sudah terhapus`);
    } catch(error) {
      record.cleanup_error=error.message;failure??=error;report.checks.push({status:'FAIL',label:`Cleanup ${record.role}: ${error.message}`});save();
    }
  }
  try {
    report.after=await baseline();assert.deepEqual(report.after,report.before,'Data bisnis/akun existing berubah selama UAT; periksa baseline');
    pass('Checksum sebelas tabel, termasuk auth.users/user_profiles, kembali identik dengan baseline sebelum UAT');
  } catch(error) {failure??=error;report.checks.push({status:'FAIL',label:error.message});}
  report.finished_at=new Date().toISOString();report.complete=!failure;save();
}
if(failure) {console.error('UAT belum lulus; lihat lifecycle dan hasil browser. Akun tersisa:',report.accounts.filter((a)=>!a.deleted).map((a)=>a.auth_user_id).join(',')||'tidak ada');process.exitCode=1;}
