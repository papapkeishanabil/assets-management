// Verifikasi pascarilis tanpa membuat akun, login, data uji, migration, push/deploy.
// SELECT metadata/agregat diakhiri exception (rollback); browser tetap anonim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const api = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const site = 'https://harmas-asset-management.vercel.app';
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
assert.ok(serviceKey && anonKey,'Butuh SUPABASE_SERVICE_KEY dan SUPABASE_ANON_KEY melalui env sesi');
const folder = new URL('../docs/vendor-management/production-verification-20261109/',import.meta.url);
mkdirSync(folder,{recursive:true});
const checks = [];
const pass = (label) => { checks.push({status:'PASS',label}); console.log(`PASS | ${label}`); };
const query = `SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'source',p.prosrc,'definition',pg_get_functiondef(p.oid),'definer',p.prosecdef,'config',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('vendor_followups_guard','vendor_followups_audit','vendor_sourcing_dashboard','vendor_remind_overdue_followups','is_app_role','my_profile_id','profiles_guard_admin_fields','vendor_guard_restricted_columns','vendor_record_activity','vendor_record_status_change','exec_sql')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public' AND tablename IN ('vendor_followups','user_profiles','roles','notifications')),
 'rls',(SELECT jsonb_object_agg(relname,relrowsecurity) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('vendor_followups','vendor_candidates','user_profiles','roles','notifications')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) ORDER BY tgname) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.vendor_followups'::regclass,'public.vendor_candidates'::regclass,'public.user_profiles'::regclass)),
 'profiles_by_role',(SELECT jsonb_agg(to_jsonb(q) ORDER BY role_name,account_status) FROM (SELECT r.role_name,up.account_status,count(*) AS count FROM public.user_profiles up JOIN public.roles r ON r.id=up.role_id GROUP BY r.role_name,up.account_status) q),
 'baseline',(SELECT jsonb_object_agg(name,jsonb_build_object('count',n,'checksum',checksum)) FROM (
 SELECT 'vendors' name,count(*) n,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) checksum FROM public.vendors x
 UNION ALL SELECT 'assets',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.assets x
 UNION ALL SELECT 'user_profiles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.user_profiles x
 UNION ALL SELECT 'roles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.roles x
 UNION ALL SELECT 'role_permissions',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.role_permissions x
 UNION ALL SELECT 'notifications',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.notifications x
 UNION ALL SELECT 'employees',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.employees x
 UNION ALL SELECT 'contracts',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.contracts x
 UNION ALL SELECT 'vendor_candidates',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_candidates x
 UNION ALL SELECT 'vendor_followups',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_followups x) q),
 'asset_vendor_links',(SELECT count(*) FROM public.assets WHERE vendor_id IS NOT NULL),
 'asset_vendor_orphans',(SELECT count(*) FROM public.assets a LEFT JOIN public.vendors v ON v.id=a.vendor_id WHERE a.vendor_id IS NOT NULL AND v.id IS NULL)
)`;
async function snapshot() {
  const sql = `DO $uat$ DECLARE v jsonb; BEGIN ${query} INTO v; RAISE EXCEPTION 'UAT_READONLY:%',v::text; END $uat$;`;
  const r = await fetch(`${api}/rest/v1/rpc/exec_sql`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});
  const body = await r.json();
  assert.equal(r.status,400); assert.equal(body.code,'P0001'); assert.ok(body.message.startsWith('UAT_READONLY:'));
  return JSON.parse(body.message.slice('UAT_READONLY:'.length));
}
const result = {checked_at:new Date().toISOString(),target:site,mode:'anonymous browser + read-only production metadata',checks};
let browser;
try {
  result.before = await snapshot();
  const before = result.before;
  const migration = readFileSync(new URL('../supabase/migrations/202611060001_vendor_management_phase2.sql',import.meta.url),'utf8');
  for(const name of ['vendor_followups_guard','vendor_followups_audit','vendor_sourcing_dashboard','vendor_remind_overdue_followups']) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const source = migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${escaped}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`));
    assert.ok(source,`Source migration ${name} tidak ditemukan`);
    assert.equal(before.functions.find((f)=>f.name===name)?.source.trim(),source[1].trim(),`Drift fungsi ${name}`);
  }
  pass('Keempat isi fungsi Fase 2 produksi identik dengan migration yang direview');
  assert.ok(Object.values(before.rls).every(Boolean));
  assert.equal(before.policies.filter((p)=>p.tablename==='vendor_followups').length,3);
  assert.ok(!before.policies.some((p)=>p.tablename==='vendor_followups' && p.cmd==='DELETE'));
  assert.ok(before.triggers.every((t)=>t.enabled==='O'));
  pass('RLS aktif, tiga policy follow-up tanpa DELETE, guard/audit trigger enabled');
  const old = JSON.parse(readFileSync(new URL('../docs/vendor-management/PHASE2_PRODUCTION_READONLY.json',import.meta.url),'utf8')).data;
  assert.deepEqual(before.policies.filter((p)=>p.tablename!=='vendor_followups'),old.policies.filter((p)=>['user_profiles','roles','notifications'].includes(p.tablename)));
  for(const f of old.functions) assert.equal(before.functions.find((p)=>p.name===f.signature.split('(')[0])?.definition,f.definition,`Drift guard/helper existing ${f.signature}`);
  pass('Delapan policy hardening dan tujuh fungsi existing tetap identik dengan snapshot pra-Fase 2');
  const exec = before.functions.find((f)=>f.name==='exec_sql');
  assert.ok(!exec.anon_execute && !exec.authenticated_execute);
  for(const name of ['vendor_sourcing_dashboard','vendor_remind_overdue_followups']) {
    const f=before.functions.find((x)=>x.name===name);
    assert.ok(!f.definer && !f.anon_execute && f.authenticated_execute);
  }
  pass('exec_sql tertutup anon/authenticated; dua RPC Fase 2 tetap INVOKER dan tertutup anon');
  assert.equal(before.asset_vendor_orphans,0);
  for(const name of ['vendors','assets']) assert.deepEqual(before.baseline[name],old.baseline[name]);
  pass('Checksum vendors/assets sama dengan pra-Fase 2; relasi aset-vendor tidak yatim');
  for(const table of ['user_profiles','roles','notifications','vendor_candidates','vendor_followups']) {
    const r=await fetch(`${api}/rest/v1/${table}?select=id&limit=1`,{headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`},signal:AbortSignal.timeout(20000)});
    if(r.status===200) assert.deepEqual(await r.json(),[],`Kebocoran anon ${table}`);
    else assert.ok([401,403].includes(r.status),`Status anon ${table}: ${r.status}`);
  }
  pass('Lima endpoint internal menolak/menyembunyikan data dari anon');
  const html=await fetch(site,{signal:AbortSignal.timeout(20000)}); assert.equal(html.status,200);
  const entry=(await html.text()).match(/src="([^"\s]*\/assets\/[^"\s]+\.js)"/);assert.ok(entry);
  const bundle=await fetch(new URL(entry[1],site),{signal:AbortSignal.timeout(20000)});assert.equal(bundle.status,200);
  const js=await bundle.text();
  assert.ok(js.includes('vendor/followups') && js.includes('Produktivitas PIC Sourcing') && js.includes('contact_outcome'));
  assert.ok(!js.includes(serviceKey),'Service key ditemukan pada bundle');
  result.bundle={path:entry[1],sha256:createHash('sha256').update(js).digest('hex'),service_key_present:false};
  pass('Bundle publik berisi Fase 2, HTTP 200, dan tidak memuat service key');
  const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const errors=[];const blocked=[];
  await context.route('**/*',async(route)=>{
    const req=route.request();const url=new URL(req.url());
    if(!['GET','HEAD','OPTIONS'].includes(req.method())){blocked.push({method:req.method(),path:url.pathname});return route.abort();}
    if(![new URL(site).hostname,new URL(api).hostname,'fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))return route.abort();
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',(e)=>errors.push(e.message));
  for(const path of ['/vendor','/vendor/database','/vendor/followups','/vendors']) {
    await page.goto(site+path);
    await page.waitForURL(/\/login/);
  }
  await page.screenshot({path:fileURLToPath(new URL('anonymous-login-desktop.png',folder)),animations:'disabled',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:fileURLToPath(new URL('anonymous-login-mobile.png',folder)),animations:'disabled',fullPage:true});
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(blocked.length,0,JSON.stringify(blocked));
  result.anonymous_browser={pageerrors:errors,blocked_write_requests:blocked};
  pass('Browser anonim dialihkan ke login pada empat route; tanpa pageerror atau request tulis');
  result.after=await snapshot();
  assert.deepEqual(result.after,result.before,'Ada perubahan produksi selama pemeriksaan; periksa aktivitas pengguna lain');
  pass('Snapshot/checksum sepuluh tabel dan metadata identik sebelum/sesudah pemeriksaan');
  const sourcing=before.profiles_by_role.filter((r)=>r.role_name==='sourcing' && r.account_status==='ACTIVE').reduce((n,r)=>n+r.count,0);
  result.authenticated_uat={status:'PENDING',active_sourcing_profiles:sourcing,reason:sourcing===0?'Belum ada akun Sourcing produksi; perlu penetapan akun atau izin eksplisit akun uji sementara':'Kredensial akun UAT belum diberikan melalui env sesi'};
} catch(error) {
  checks.push({status:'FAIL',label:error.message});throw error;
} finally {
  await browser?.close();
  writeFileSync(new URL('READONLY_RESULTS.json',folder),JSON.stringify(result,null,2)+'\n');
}
