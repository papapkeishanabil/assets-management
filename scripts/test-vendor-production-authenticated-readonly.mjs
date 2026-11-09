// UAT baca dengan akun yang SUDAH disediakan/disetujui. Tidak membuat akun/data.
// Env: SUPABASE_ANON_KEY, PLAYWRIGHT_PACKAGE_PATH,
// HARMAS_UAT_ADMIN_EMAIL/PASSWORD, HARMAS_UAT_SOURCING_EMAIL/PASSWORD.
// Login/logout mengubah metadata sesi Auth; seluruh data bisnis hanya dibaca.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const site='https://harmas-asset-management.vercel.app';
const api='https://uwlxkwyauxwewoexfgwi.supabase.co';
const key=process.env.SUPABASE_ANON_KEY;
assert.ok(key && process.env.PLAYWRIGHT_PACKAGE_PATH,'Butuh anon key dan Playwright melalui env');
const accounts=[
  {role:'super_admin',email:process.env.HARMAS_UAT_ADMIN_EMAIL,password:process.env.HARMAS_UAT_ADMIN_PASSWORD},
  {role:'sourcing',email:process.env.HARMAS_UAT_SOURCING_EMAIL,password:process.env.HARMAS_UAT_SOURCING_PASSWORD}
];
assert.ok(accounts.every((a)=>a.email && a.password),'Sediakan kedua akun UAT melalui env; jangan membuat akun tanpa persetujuan');
const folder=new URL('../docs/vendor-management/production-verification-20261109/',import.meta.url);
mkdirSync(folder,{recursive:true});
const results=[];
const sessions=[];
const pass=(label)=>{results.push({status:'PASS',label});console.log(`PASS | ${label}`);};
let browser;
try {
  const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);
  browser=await chromium.launch({headless:true});
  for(const account of accounts) {
    const login=await fetch(`${api}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password}),signal:AbortSignal.timeout(20000)});
    assert.equal(login.status,200,`Login UAT ${account.role} gagal; tidak ada perubahan password otomatis`);
    const session=await login.json();sessions.push(session);
    const headers={apikey:key,Authorization:`Bearer ${session.access_token}`};
    const pr=await fetch(`${api}/rest/v1/user_profiles?select=id,role_id,account_status&auth_user_id=eq.${encodeURIComponent(session.user.id)}`,{headers});
    assert.equal(pr.status,200);const profiles=await pr.json();
    assert.equal(profiles.length,1,'Profil harus sudah tersedia; tidak membuat profil melalui browser');
    assert.equal(profiles[0].account_status,'ACTIVE');
    const rr=await fetch(`${api}/rest/v1/roles?select=role_name&id=eq.${encodeURIComponent(profiles[0].role_id)}`,{headers});
    assert.equal(rr.status,200);assert.equal((await rr.json())[0]?.role_name,account.role);
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
    await ctx.addInitScript((auth)=>localStorage.setItem('sb-uwlxkwyauxwewoexfgwi-auth-token',JSON.stringify(auth)),session);
    const suppressed=[];const denied=[];const errors=[];const httpErrors=[];
    await ctx.route('**/*',async(route)=>{
      const request=route.request();const url=new URL(request.url());
      if(url.origin===api && request.method()==='POST' && url.pathname==='/rest/v1/rpc/vendor_remind_overdue_followups') {
        suppressed.push('automatic reminder');
        // Sengaja tidak menguji reminder pada mode baca. Respons ini hanya
        // mencegah side effect auto-check UI; jangan dihitung sebagai hasil RPC nyata.
        return route.fulfill({status:200,contentType:'application/json',body:'0'});
      }
      if(!['GET','HEAD','OPTIONS'].includes(request.method()) && !(url.origin===api && request.method()==='POST' && url.pathname==='/rest/v1/rpc/vendor_sourcing_dashboard')) {
        denied.push({method:request.method(),path:url.pathname});return route.abort();
      }
      if(![new URL(site).hostname,new URL(api).hostname,'fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))return route.abort();
      return route.continue();
    });
    const page=await ctx.newPage();page.on('pageerror',(e)=>errors.push(e.message));
    page.on('response',(r)=>{if(r.url().startsWith(api+'/rest/v1/') && r.status()>=400)httpErrors.push({path:new URL(r.url()).pathname,status:r.status()});});
    await page.goto(site+'/vendor');
    await page.getByRole('heading',{name:'Produktivitas PIC Sourcing'}).waitFor();
    await page.screenshot({path:fileURLToPath(new URL(`${account.role}-dashboard.png`,folder)),fullPage:true,animations:'disabled'});
    pass(`${account.role}: login/profil/role nyata dan dashboard dari RPC produksi berhasil`);
    await page.goto(site+'/vendor/database');
    await page.getByRole('heading',{name:'Database Calon Vendor'}).waitFor();
    await page.goto(site+'/vendor/followups');
    await page.getByRole('button',{name:'Catat Follow-Up'}).waitFor();
    await page.getByText('Belum ada follow-up sesuai filter.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Catat Follow-Up'}).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'detached'});
    pass(`${account.role}: Database Calon Vendor, Follow-Up kosong dan modal dapat dibuka tanpa submit`);
    if(account.role==='super_admin') {
      await page.goto(site+'/vendors');
      await page.getByRole('heading',{name:'Master Vendor',exact:true}).waitFor();
      await page.locator('tbody tr').first().waitFor();
      assert.ok(await page.locator('tbody tr').count()>0);
      pass('super_admin: Master Data Vendor tetap dapat dibaca');
    }
    assert.equal(errors.length,0,JSON.stringify(errors));
    assert.equal(httpErrors.length,0,JSON.stringify(httpErrors));
    assert.equal(denied.length,0,JSON.stringify(denied));
    pass(`${account.role}: tidak ada pageerror, REST error, atau percobaan tulis bisnis`);
    results.push({status:'NOTE',label:`${account.role}: reminder otomatis dinonaktifkan oleh harness baca (${suppressed.length} request); CRUD/reminder nyata belum diuji`});
    await ctx.close();
  }
} catch(error) {
  results.push({status:'FAIL',label:error.message});throw error;
} finally {
  await browser?.close();
  // Hanya cabut sesi UAT yang dibuat script ini, bukan sesi login pengguna lain.
  for(const session of sessions) {
    try {
      const r=await fetch(`${api}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(20000)});
      results.push({status:r.ok?'PASS':'FAIL',label:`Logout sesi UAT sendiri: HTTP ${r.status}`});
    } catch {
      results.push({status:'FAIL',label:'Logout sesi UAT gagal; lifecycle harus menghapus akun sementara untuk mencabut sesi'});
    }
  }
  writeFileSync(new URL('AUTHENTICATED_RESULTS.json',folder),JSON.stringify({checked_at:new Date().toISOString(),mode:'business data read-only; actual Auth login/logout; reminder suppressed',results},null,2)+'\n');
}
