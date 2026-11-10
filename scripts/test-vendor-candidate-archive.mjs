// All writes are disposable fixtures in the named loopback Docker stack only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const api='http://127.0.0.1:54321', origin='http://127.0.0.1:7023',db='supabase_db_harmas-vendor-test';
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:12e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const sql=q=>docker(['exec','-i',db,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],q);
const kong=docker(['exec','supabase_kong_harmas-vendor-test','cat','/home/kong/kong.yml']);
const anon=kong.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
const secret=[...kong.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(m=>m[0]).find(k=>JSON.parse(Buffer.from(k.split('.')[1],'base64url')).role==='service_role');
assert.ok(anon&&secret&&process.env.PLAYWRIGHT_PACKAGE_PATH);
const client=key=>createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}}),service=client(secret);
const tables=['vendors','assets','user_profiles','roles','role_permissions','notifications','vendor_candidates','vendor_locations','vendor_location_photos','vendor_followups','vendor_status_history','vendor_activity_logs','auth.users','auth.identities'];
const snapshot=()=>sql(`SELECT jsonb_object_agg(name,hash) FROM (${tables.map(t=>`SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) hash FROM ${t.includes('.')?t:`public.${t}`} x`).join(' UNION ALL ')}) q;`);
const security=()=>sql(`SELECT jsonb_build_object('policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','storage')),'helpers',(SELECT jsonb_agg(jsonb_build_object('name',oid::regprocedure::text,'definition',pg_get_functiondef(oid),'acl',proacl) ORDER BY oid::regprocedure::text) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('is_app_role','my_profile_id','vendor_guard_restricted_columns','profiles_guard_admin_fields','vendor_followups_guard','vendor_followups_audit','vendor_locations_guard')));`);
const before=snapshot(),securityBefore=security();
const migration=readFileSync('supabase/migrations/202611100001_vendor_candidate_archive.sql','utf8');
const rollback=readFileSync('supabase/rollbacks/202611100001_vendor_candidate_archive_rollback.sql','utf8');
const dir='docs/vendor-management/candidate-archive-evidence';mkdirSync(dir,{recursive:true});
const checks=[],accounts=[],sessions={},errors=[],external=[],writes=[];
const run=randomUUID().slice(0,8),password=`Local-${randomUUID()}!9`;
const ids=Array.from({length:4},()=>randomUUID()),master=randomUUID(),location=randomUUID();
const name=`[ARCH-${run}] Prospek`,linkedName=`[ARCH-${run}] Vendor Terhubung`;
let server,browser,page,applied=false;
const pass=check=>{checks.push({check,pass:true});console.log(`PASS | ${check}`);};
async function account(role,status='ACTIVE'){
 const email=`archive-${run}-${role}-${status}@harmas.local`,a=await service.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(a.error);accounts.push(a.data.user.id);
 const r=await service.from('roles').select('id').eq('role_name',role).single();assert.ifError(r.error);
 const p=await service.from('user_profiles').insert({auth_user_id:a.data.user.id,email,full_name:`[ARCH] ${role}`,role_id:r.data.id,account_status:status}).select('id').single();assert.ifError(p.error);
 const c=client(anon),login=await c.auth.signInWithPassword({email,password});assert.ifError(login.error);
 return {client:c,session:login.data.session,profileId:p.data.id};
}
async function row(id=ids[0]){const r=await service.from('vendor_candidates').select('*').eq('id',id).single();assert.ifError(r.error);return r.data;}
async function archive(actor,record,state=true,reason='Alasan uji pengarsipan'){
 return actor.client.rpc('vendor_set_candidate_archive',{p_candidate_id:record.id,p_archive:state,p_reason:reason,p_expected_updated_at:record.updated_at});
}
const archivedEvents=()=>Number(sql(`SELECT count(*) FROM public.vendor_activity_logs WHERE candidate_id='${ids[0]}' AND action='candidate_archived';`));
try {
 sql(migration);applied=true;sql(migration);
 assert.equal(security(),securityBefore);
 const unchangedExisting=sql("SELECT count(*) FROM public.vendor_candidates WHERE archived_at IS NOT NULL OR archived_by IS NOT NULL OR archive_reason IS NOT NULL;");assert.equal(unchangedExisting,'0');
 pass('Migration applies twice; no existing archive values, security helpers/guards/RLS unchanged');
 for(const role of ['sourcing','hrd','super_admin','direksi','finance','pelaksana'])sessions[role]=await account(role);
 sessions.inactive=await account('sourcing','PENDING');
 sql(`INSERT INTO public.vendors(id,vendor_code,vendor_name,is_active) VALUES('${master}','AR-${run}','${linkedName}',true);
 INSERT INTO public.vendor_candidates(id,business_name,process_stage,qualification_status,operational_status) VALUES
 ('${ids[0]}','${name}','CONTACTING','UNDER_EVALUATION','NOT_ACTIVE'),('${ids[1]}','${linkedName}','CLOSED','APPROVED','ACTIVE'),
 ('${ids[2]}','[ARCH-${run}] Keputusan','LEAD','APPROVED','NOT_ACTIVE'),('${ids[3]}','[ARCH-${run}] Cadangan uji','LEAD','PROSPECT','NOT_ACTIVE');
 UPDATE public.vendor_candidates SET vendor_id='${master}' WHERE id='${ids[1]}';
 INSERT INTO public.vendor_locations(id,candidate_id,location_name,location_type,latitude,longitude,coordinate_source,created_by) VALUES('${location}','${ids[0]}','Workshop Arsip','WORKSHOP_JAHIT',-6.92,107.62,'MANUAL','${sessions.sourcing.profileId}');`);
 const masterBefore=sql("SELECT md5(jsonb_agg(to_jsonb(v) ORDER BY id)::text) FROM public.vendors v;");
 const s=sessions.sourcing;
 assert.ok((await archive({client:client(anon)},await row())).error);
 for(const r of ['direksi','finance','pelaksana','inactive'])assert.ok((await archive(sessions[r],await row())).error,r);
 pass('Anonymous, Direksi, Finance, Pelaksana and inactive Sourcing cannot archive');
 for(const reason of [null,'  ', 'abcd','x'.repeat(1001)])assert.ok((await archive(s,await row(),true,reason)).error);
 assert.ok((await archive(s,{id:randomUUID(),updated_at:new Date().toISOString()})).error);
 pass('Invalid reason and nonexistent candidate rejected');
 for(const id of [ids[1],ids[2]])assert.ok((await archive(s,await row(id))).error);
 for(const status of ['RESERVE','REJECTED','FROZEN']){sql(`UPDATE public.vendor_candidates SET qualification_status='${status}' WHERE id='${ids[2]}';`);assert.ok((await archive(s,await row(ids[2]))).error);}
 sql(`UPDATE public.vendor_candidates SET qualification_status='PROSPECT',operational_status='ACTIVE' WHERE id='${ids[2]}';`);assert.ok((await archive(s,await row(ids[2]))).error);
 pass('Linked vendors, operational ACTIVE and every final decision remain protected');
 assert.ok((await s.client.from('vendor_candidates').update({archived_at:new Date().toISOString(),archived_by:s.profileId,archive_reason:'spoof'}).eq('id',ids[0])).error);
 assert.ok((await s.client.from('vendor_candidates').insert({business_name:'forged',archived_at:new Date().toISOString()})).error);
 assert.ok((await s.client.from('vendor_candidates').update({qualification_status:'APPROVED'}).eq('id',ids[0])).error);
 assert.ok((await s.client.from('vendor_candidates').update({operational_status:'ACTIVE'}).eq('id',ids[0])).error);
 pass('Direct archive metadata spoof and direct approval/activation remain blocked');
 const f=await s.client.from('vendor_followups').insert({candidate_id:ids[0],internal_pic_id:s.profileId,channel:'WHATSAPP',contact_at:new Date().toISOString(),contact_result:'Riwayat tetap',next_action:'Hubungi ulang',next_action_due:'2026-01-01T00:00:00Z'}).select('*').single();assert.ifError(f.error);
 const dashBefore=await s.client.rpc('vendor_sourcing_dashboard');assert.ifError(dashBefore.error);
 let current=await row(),events=archivedEvents();const result=await archive(s,current);assert.ifError(result.error);
 current=await row();assert.ok(current.archived_at);assert.equal(current.archived_by,s.profileId);
 let followup=await service.from('vendor_followups').select('*').eq('id',f.data.id).single();assert.ifError(followup.error);assert.equal(followup.data.task_status,'DIBATALKAN');assert.equal(followup.data.contact_result,'Riwayat tetap');
 assert.equal(archivedEvents(),events+1);
 assert.equal(sql(`SELECT actor_id FROM public.vendor_activity_logs WHERE candidate_id='${ids[0]}' AND action='candidate_archived' ORDER BY id DESC LIMIT 1;`),s.profileId);
 pass('Archive records authoritative actor/reason and cancels open task atomically; follow-up content retained');
 const dashboard=await s.client.rpc('vendor_sourcing_dashboard');assert.ifError(dashboard.error);assert.equal(dashboard.data.kpis.total,dashBefore.data.kpis.total-1);
 const points=await s.client.from('vendor_map_points').select('candidate_id').eq('candidate_id',ids[0]);assert.ifError(points.error);assert.equal(points.data.length,0);
 const monitoring=await s.client.rpc('vendor_location_monitoring');assert.ifError(monitoring.error);
 const reminder=sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{"sub":"${s.session.user.id}","role":"authenticated"}'; SELECT public.vendor_remind_overdue_followups() IS NOT NULL; SELECT count(*) FROM public.notifications WHERE reference_id='${f.data.id}'; ROLLBACK;`);assert.ok(reminder.endsWith('\n0'));
 assert.equal(sql("SELECT md5(jsonb_agg(to_jsonb(v) ORDER BY id)::text) FROM public.vendors v;"),masterBefore);
 pass('Archived candidate excluded from sourcing dashboard/map; no archived task reminder or master change');
 assert.ok((await s.client.from('vendor_candidates').update({notes:'tamper'}).eq('id',ids[0])).error);
 assert.ok((await s.client.from('vendor_contacts').insert({candidate_id:ids[0],contact_name:'tamper'})).error);
 assert.ok((await s.client.from('vendor_locations').update({city:'tamper'}).eq('id',location)).error);
 assert.ok((await s.client.from('vendor_followups').insert({candidate_id:ids[0],internal_pic_id:s.profileId,channel:'WHATSAPP',contact_at:new Date().toISOString(),contact_result:'tamper'})).error);
 for(const r of ['sourcing','hrd','super_admin']){const d=await sessions[r].client.from('vendor_candidates').delete().eq('id',ids[0]).select('id');assert.ok(d.error||d.data.length===0);}
 assert.ok((await row()).archived_at);
 pass('Archived profile and child writes blocked; physical DELETE denied even for Super Admin');
 const again=await archive(s,current);assert.ifError(again.error);assert.equal(archivedEvents(),events+1);
 assert.ifError((await archive(s,current,false,'Kandidat akan dinilai kembali')).error);current=await row();assert.equal(current.archived_at,null);
 followup=await service.from('vendor_followups').select('task_status').eq('id',f.data.id).single();assert.equal(followup.data.task_status,'DIBATALKAN');
 pass('Repeated archive is idempotent; restoration preserves closed tasks and creates audit reason');
 const stale=current;assert.ifError((await s.client.from('vendor_candidates').update({notes:'profil berubah'}).eq('id',ids[0])).error);
 assert.ok((await archive(s,stale)).error);assert.equal((await row()).archived_at,null);
 current=await row();events=archivedEvents();const concurrent=await Promise.all([archive(s,current),archive(s,current)]);concurrent.forEach(r=>assert.ifError(r.error));assert.equal(archivedEvents(),events+1);
 assert.ifError((await archive(s,await row(),false,'Pulihkan setelah uji konkurensi')).error);
 pass('Stale confirmation rejected; concurrent archive produces exactly one event');
 for(const r of ['hrd','super_admin']){assert.ifError((await archive(sessions[r],await row())).error);assert.ifError((await archive(sessions[r],await row(),false,'Pulihkan oleh administrator')).error);}
 pass('HRD and Super Admin retain authorized archive/restore flow');

 const {createServer}=await import('vite');server=await createServer({envFile:false,define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(api),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(anon)},server:{host:'127.0.0.1',port:7023,strictPort:true},clearScreen:false});await server.listen();
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);browser=await chromium.launch({headless:true});
 async function context(role){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});await ctx.addInitScript(a=>localStorage.setItem('sb-127-auth-token',JSON.stringify(a)),sessions[role].session);
  await ctx.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'});if(!['127.0.0.1','localhost'].includes(url.hostname)){external.push(url.hostname);return route.abort();}if(url.pathname==='/rest/v1/role_permissions')return route.fulfill({json:['vendor_management','vendor_followups','vendor_map'].map(module_key=>({module_key,can_access:true}))});if(url.pathname==='/rest/v1/rpc/vendor_remind_overdue_followups')return route.fulfill({json:0});if(url.origin===api&&!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(url.pathname);return route.continue();});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));page=p;return{ctx,p};
 }
 const source=await context('sourcing');page=source.p;
 await page.goto(origin+'/vendor/database');await page.getByRole('heading',{name:'Database Calon Vendor',exact:true}).waitFor();await page.getByPlaceholder('Cari nama atau kode calon vendor...').fill(`[ARCH-${run}]`);
 let target=page.locator('tbody tr').filter({hasText:name});await target.waitFor();assert.equal(await page.locator('tbody tr').filter({hasText:linkedName}).count(),0);
 pass('Browser default list separates prospects from active linked profiles');
 await target.getByRole('button',{name:`Hapus dari daftar ${name}`,exact:true}).click();let dialog=page.getByRole('dialog',{name:'Hapus calon vendor dari daftar?',exact:true});
 const calls=writes.filter(p=>p.endsWith('/vendor_set_candidate_archive')).length;
 await dialog.getByRole('button',{name:'Batal',exact:true}).click();assert.equal(writes.filter(p=>p.endsWith('/vendor_set_candidate_archive')).length,calls);assert.equal((await row()).archived_at,null);
 pass('Cancel confirmation does not write or archive');
 await target.getByRole('button',{name:`Hapus dari daftar ${name}`,exact:true}).click();dialog=page.getByRole('dialog',{name:'Hapus calon vendor dari daftar?',exact:true});
 await dialog.getByLabel('Alasan penghapusan dari daftar',{exact:true}).fill('     ');await dialog.getByRole('button',{name:'Hapus dari Daftar',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(writes.filter(p=>p.endsWith('/vendor_set_candidate_archive')).length,calls);
 await dialog.getByLabel('Alasan penghapusan dari daftar',{exact:true}).fill('Tidak memenuhi kapasitas produksi');
 const pattern='**/rest/v1/rpc/vendor_set_candidate_archive';await page.route(pattern,r=>r.fulfill({status:500,json:{message:'Kegagalan uji lokal'}}));
 await dialog.getByRole('button',{name:'Hapus dari Daftar',exact:true}).click();await dialog.getByText('Kegagalan uji lokal',{exact:true}).waitFor();assert.equal(await dialog.getByLabel('Alasan penghapusan dari daftar',{exact:true}).inputValue(),'Tidak memenuhi kapasitas produksi');await page.unroute(pattern);
 await dialog.getByRole('button',{name:'Hapus dari Daftar',exact:true}).click();await dialog.waitFor({state:'detached'});await target.waitFor({state:'detached'});assert.ok((await row()).archived_at);
 pass('Reason validation and failure retry preserve draft; confirmed archive disappears from working list');
 await page.getByLabel('Tampilkan data',{exact:true}).selectOption('archives');target=page.locator('tbody tr').filter({hasText:name});await target.waitFor();
 await target.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();await page.getByText('Profil ini hanya dapat dilihat.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Edit Profil',exact:true}).count(),0);
 await page.getByRole('button',{name:'Riwayat',exact:true}).click();await page.getByText('Tidak memenuhi kapasitas produksi',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Follow-Up',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Catat Follow-Up',exact:true}).count(),0);
 await page.getByRole('button',{name:'Lokasi & Foto',exact:true}).click();await page.getByRole('heading',{name:'Workshop Arsip',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Tambah Lokasi',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Edit lokasi',exact:true}).count(),0);
 pass('Archive detail retains history/reason/location while editing and follow-up creation are hidden');
 await page.goto(origin+'/vendor/database');await page.getByPlaceholder('Cari nama atau kode calon vendor...').fill(name);await page.getByLabel('Tampilkan data',{exact:true}).selectOption('archives');target=page.locator('tbody tr').filter({hasText:name});await target.getByRole('button',{name:`Pulihkan ${name}`,exact:true}).click();
 dialog=page.getByRole('dialog',{name:'Pulihkan calon vendor?',exact:true});await dialog.getByLabel('Alasan pemulihan',{exact:true}).fill('Kapasitas telah dievaluasi ulang');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:dir+'/restore-mobile.png',fullPage:true});
 await dialog.getByRole('button',{name:'Pulihkan Kandidat',exact:true}).click();await dialog.waitFor({state:'detached'});await target.waitFor({state:'detached'});await page.getByLabel('Tampilkan data',{exact:true}).selectOption('prospects');await page.locator('tbody tr').filter({hasText:name}).waitFor();assert.equal((await row()).archived_at,null);
 pass('Restore from archive works on mobile and returns candidate to working list');
 await page.setViewportSize({width:1440,height:1000});await page.getByPlaceholder('Cari nama atau kode calon vendor...').fill(linkedName);await page.getByLabel('Tampilkan data',{exact:true}).selectOption('linked');target=page.locator('tbody tr').filter({hasText:linkedName});await target.waitFor();assert.equal(await target.getByRole('button',{name:/Hapus dari daftar/}).count(),0);await page.screenshot({path:dir+'/linked-vendor-protected.png',fullPage:true});
 pass('Linked active vendor remains accessible in its own view and has no removal button');await source.ctx.close();
 const director=await context('direksi');await director.p.goto(origin+'/vendor/database');await director.p.getByRole('heading',{name:'Database Calon Vendor',exact:true}).waitFor();assert.equal(await director.p.getByRole('button',{name:/Hapus dari daftar|Pulihkan /}).count(),0);await director.ctx.close();
 assert.deepEqual(errors,[]);assert.ok(!external.some(h=>h.endsWith('supabase.co')));assert.equal(security(),securityBefore);
 pass('Direksi gets no archive control; zero browser errors/production requests; security baseline preserved');
} catch(error){checks.push({check:error.message,pass:false});if(page&&!page.isClosed())await page.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally {
 await browser?.close();await server?.close();
 if(applied){const list=ids.map(id=>`'${id}'`).join(',');sql(`BEGIN;ALTER TABLE public.vendor_followups DISABLE TRIGGER trg_vendor_followups_guard;ALTER TABLE public.vendor_locations DISABLE TRIGGER trg_vendor_locations_guard;
 DELETE FROM public.vendor_followups WHERE candidate_id IN(${list});DELETE FROM public.vendor_locations WHERE candidate_id IN(${list});
 ALTER TABLE public.vendor_followups ENABLE TRIGGER trg_vendor_followups_guard;ALTER TABLE public.vendor_locations ENABLE TRIGGER trg_vendor_locations_guard;
 DELETE FROM public.vendor_candidates WHERE id IN(${list});DELETE FROM public.vendors WHERE id='${master}';COMMIT;`);}
 for(const id of accounts){const p=await service.from('user_profiles').delete().eq('auth_user_id',id);assert.ifError(p.error);assert.ifError((await service.auth.admin.deleteUser(id)).error);}
 if(applied){sql(rollback);sql(rollback);}
 const unchanged=snapshot()===before&&security()===securityBefore;checks.push({check:'Rollback twice and cleanup restore 14 table checksums and security helpers/guards/RLS',pass:unchanged});
 writeFileSync(dir+'/RESULTS.json',JSON.stringify({checked_at:new Date().toISOString(),target:'Docker synthetic + loopback browser only',production_accessed:false,accounts_cleaned:accounts.length,checks,browser_errors:errors,permission_switches_mocked:true},null,2)+'\n');assert.ok(unchanged,'Cleanup/baseline mismatch');
}
