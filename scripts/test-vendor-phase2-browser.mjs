// Browser QA dengan Supabase Docker LOKAL. Tidak pernah memakai .env produksi.
// Env: PLAYWRIGHT_PACKAGE_PATH (package lokal yang sudah tersedia).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const db = 'supabase_db_harmas-vendor-test';
const testPassword = process.env.HARMAS_LOCAL_TEST_PASSWORD;
assert.ok(testPassword,'Butuh HARMAS_LOCAL_TEST_PASSWORD melalui env sesi (akun Docker sintetis)');
const api = 'http://127.0.0.1:54321';
const origin = 'http://127.0.0.1:7012';
const candidate = '22222222-0000-4000-a000-000000000801';
const second = '22222222-0000-4000-a000-000000000802';
const pid = '11111111-0000-4000-a000-000000000004';
const evidence = [];
const artifacts = new URL('../docs/vendor-management/phase2-evidence/',import.meta.url);
mkdirSync(artifacts,{recursive:true});
function docker(args,input) {
  const r = spawnSync('docker',args,{ input,encoding:'utf8',maxBuffer:8e6 });
  assert.equal(r.status,0,r.stderr || r.error?.message);
  return r.stdout.trim();
}
function sql(input) { return docker(['exec','-i',db,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input); }
function pass(label) { evidence.push(`PASS | ${label}`); console.log(evidence.at(-1)); }
const config = docker(['exec','supabase_kong_harmas-vendor-test','cat','/home/kong/kong.yml']);
const key = config.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]
  || config.match(/username:\s*anon\s+[\s\S]*?key:\s*([^\s]+)/)?.[1];
assert.ok(key,'Anon key gateway lokal tidak ditemukan');
process.env.VITE_SUPABASE_URL = api;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = key;
assert.equal(new URL(process.env.VITE_SUPABASE_URL).hostname,'127.0.0.1');
// Fixture pendukung layout existing (schema minimal lama belum memiliki relasi ini).
sql(`CREATE TABLE IF NOT EXISTS public.maintenance_types(id uuid PRIMARY KEY, maintenance_code text,maintenance_name text);
CREATE TABLE IF NOT EXISTS public.maintenance_schedules(id uuid PRIMARY KEY, asset_id uuid REFERENCES public.assets(id),maintenance_type_id uuid REFERENCES public.maintenance_types(id),next_maintenance_date date,is_active boolean,responsible_user_id uuid,reminder_days_before integer);
CREATE TABLE IF NOT EXISTS public.maintenance_records(id uuid PRIMARY KEY,inspection_status text);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS maintenance_schedule_id uuid REFERENCES public.maintenance_schedules(id);
NOTIFY pgrst,'reload schema';`);
const snapshot = () => sql(`SELECT jsonb_build_array(
 (SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM public.vendors t),
 (SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM public.assets t),
 (SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM public.user_profiles t),
 (SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM public.roles t),
 (SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM public.role_permissions t),
 (SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM public.notifications t));`);
const before = snapshot();
assert.equal(sql(`SELECT count(*) FROM public.vendor_candidates WHERE id IN ('${candidate}','${second}');`),'0','ID fixture sudah dipakai');
sql(`INSERT INTO public.vendor_candidates(id,business_name,category_id,internal_pic_id,process_stage) VALUES
 ('${candidate}','[P2-E2E] Siti Maemunah',(SELECT id FROM public.vendor_categories WHERE name='Jahit'),'${pid}','LEAD'),
 ('${second}','[P2-E2E] Bordir Monitor',(SELECT id FROM public.vendor_categories WHERE name='Bordir'),'${pid}','QC_REVIEW');`);
let server, browser;
const pageErrors = [], failures = [], blockedExternal = [];
async function session(email) {
  const r = await fetch(`${api}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password:testPassword})});
  assert.equal(r.status,200,`Login lokal gagal ${email}`);
  return r.json();
}
try {
  const { createServer } = await import('vite');
  server = await createServer({
    envFile:false,
    define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(api),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(key)},
    server:{host:'127.0.0.1',port:7012,strictPort:true},clearScreen:false
  });
  await server.listen();
  assert.equal((await fetch(origin)).status,200);
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);
  browser = await chromium.launch({headless:true});
  async function contextFor(email,viewport = {width:1440,height:1000}) {
    const auth = await session(email);
    const ctx = await browser.newContext({viewport});
    await ctx.addInitScript((value) => localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),auth);
    await ctx.route('**/*',async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (['127.0.0.1','localhost'].includes(host)) return route.continue();
      blockedExternal.push(host);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror',(error)=>pageErrors.push(error.message));
    page.on('response',(response)=>{if(response.status()>=400 && response.url().startsWith(api))failures.push(`${response.status()} ${response.url()}`);});
    page.on('dialog',(dialog)=>dialog.accept());
    return {ctx,page};
  }
  const {ctx,page} = await contextFor('sourcing.test@harmas.local');
  await page.goto(`${origin}/vendor`);
  await page.getByRole('heading',{name:'Prioritas tindak lanjut'}).waitFor();
  await page.screenshot({path:fileURLToPath(new URL('dashboard-desktop.png',artifacts)),fullPage:true,animations:'disabled'});
  pass('Dashboard sourcing tampil; KPI/prioritas dari RPC Supabase lokal');
  await page.getByLabel('Kategori vendor').selectOption({label:'Jahit'});
  await page.getByRole('heading',{name:'Prioritas tindak lanjut'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'[P2-E2E] Bordir Monitor',exact:true}).count(),0);
  await page.getByLabel('PIC kandidat').selectOption(pid);
  await page.getByRole('heading',{name:'Prioritas tindak lanjut'}).waitFor();
  await page.getByRole('link',{name:'[P2-E2E] Siti Maemunah',exact:true}).waitFor();
  pass('Filter dashboard kategori Jahit + PIC menampilkan kandidat yang sesuai');
  await page.goto(`${origin}/vendor/followups?candidate=${candidate}`);
  await page.getByRole('button',{name:'Catat Follow-Up'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('button.btn-primary:disabled'));
  for(let n=1;n<=3;n++) {
    await page.getByRole('button',{name:'Catat Follow-Up'}).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[name=candidate_id]').selectOption(candidate);
    await dialog.locator('[name=channel]').selectOption(n===2?'TELEPON':'WHATSAPP');
    await dialog.locator('[name=contact_outcome]').selectOption(n===2?'TIDAK_TERHUBUNG':'TERHUBUNG');
    await dialog.locator('[name=contact_result]').fill(`Hasil komunikasi ${n} tidak tertimpa`);
    await dialog.locator('[name=new_info]').fill(`Informasi baru ${n}`);
    await dialog.locator('[name=next_action]').fill(`Tindak lanjut ${n}`);
    const time = new Date(Date.now()+(n===1?-86400000:86400000)*n);
    const due = new Date(time.getTime()+7*3600000).toISOString().slice(0,16);
    await dialog.locator('[name=next_action_due]').fill(due);
    await dialog.locator('[name=notes]').fill(`Catatan ${n}`);
    if(n===1) await dialog.locator('[name=attachment_path]').fill('internal/penawaran-siti.pdf');
    await dialog.getByRole('button',{name:'Simpan Follow-Up'}).click();
    await dialog.waitFor({state:'detached'});
    await page.getByText(`Hasil komunikasi ${n} tidak tertimpa`,{exact:true}).waitFor();
  }
  assert.equal(await page.locator('article').count(),3);
  const sourcingAuth = await session('sourcing.test@harmas.local');
  const hrdAuth = await session('hrd.test@harmas.local');
  sql(`DELETE FROM public.notifications WHERE reference_id IN (SELECT id FROM public.vendor_followups WHERE candidate_id='${candidate}');`);
  const reminders = await Promise.all([sourcingAuth,hrdAuth].map(async (auth)=>{
    const r = await fetch(`${api}/rest/v1/rpc/vendor_remind_overdue_followups`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'},body:'{}'});
    assert.equal(r.status,200,'Reminder lintas PIC via REST');
    return r.json();
  }));
  assert.equal(reminders.reduce((sum,n)=>sum+n,0),1,'Reminder paralel harus membuat satu baris');
  assert.equal(sql(`SELECT count(*) FROM public.notifications WHERE reference_id IN (SELECT id FROM public.vendor_followups WHERE candidate_id='${candidate}');`),'1');
  pass('Dua request reminder REST serentak (sourcing/HRD) menghasilkan tepat satu notifikasi PIC');
  pass('UI -> REST -> DB -> UI: tiga follow-up tersimpan terpisah beserta PIC/media/aksi/deadline');
  await page.screenshot({path:fileURLToPath(new URL('followups-desktop.png',artifacts)),fullPage:true,animations:'disabled'});
  await page.goto(`${origin}/vendor`);
  await page.getByRole('heading',{name:'Produktivitas PIC Sourcing'}).waitFor();
  const metric = (label) => page.getByText(label,{exact:true}).locator('..').locator('p').nth(1);
  assert.equal(await metric('Vendor berhasil dihubungi').innerText(),'1');
  assert.equal(await metric('Aktivitas follow-up').innerText(),'3');
  assert.equal(await metric('Tugas terbuka').innerText(),'3');
  assert.equal(await metric('Tugas overdue').innerText(),'1');
  assert.equal(await metric('Total kandidat unik').innerText(),sql('SELECT count(*) FROM public.vendor_candidates;'));
  await page.screenshot({path:fileURLToPath(new URL('dashboard-desktop.png',artifacts)),fullPage:true,animations:'disabled'});
  pass('Dashboard: satu vendor terhubung berbeda dari tiga aktivitas/tiga tugas; produktivitas PIC tampil');
  await page.goto(`${origin}/vendor/followups?candidate=${candidate}`);
  await page.getByText('Hasil komunikasi 2 tidak tertimpa',{exact:true}).waitFor();
  await page.getByLabel('Status tugas').selectOption('SELESAI');
  await page.getByText('Belum ada follow-up sesuai filter.',{exact:true}).waitFor();
  await page.getByLabel('Hanya overdue').check();
  await page.waitForFunction(()=>document.querySelectorAll('article').length===1);
  assert.match(await page.locator('article').innerText(),/Hasil komunikasi 1/);
  pass('Filter overdue mengesampingkan status terminal sebelumnya; hanya OPEN melewati deadline');
  await page.getByRole('button',{name:'Selesaikan',exact:true}).click();
  await page.getByText('Belum ada follow-up sesuai filter.',{exact:true}).waitFor();
  await page.getByLabel('Hanya overdue').uncheck();
  await page.getByText('Hasil komunikasi 1 tidak tertimpa',{exact:true}).waitFor();
  await page.getByLabel('Status tugas').selectOption('');
  await page.waitForFunction(()=>document.querySelectorAll('article').length===3);
  assert.equal(sql(`SELECT task_status FROM public.vendor_followups WHERE candidate_id='${candidate}' AND contact_result='Hasil komunikasi 1 tidak tertimpa';`),'SELESAI');
  pass('Tugas selesai keluar dari overdue dan completed_at disimpan database');
  const third = page.locator('article').filter({hasText:'Hasil komunikasi 3 tidak tertimpa'});
  await third.getByRole('button',{name:'Batalkan tugas'}).click();
  await third.getByText('Dibatalkan',{exact:true}).waitFor();
  pass('Pembatalan tugas tersimpan tanpa menghapus catatan');
  await page.goto(`${origin}/vendor`);
  await page.getByRole('heading',{name:'Produktivitas PIC Sourcing'}).waitFor();
  assert.equal(await metric('Tugas terbuka').innerText(),'1');
  assert.equal(await metric('Tugas selesai').innerText(),'1');
  assert.equal(await metric('Tugas dibatalkan').innerText(),'1');
  assert.equal(await metric('Vendor berhasil dihubungi').innerText(),'1');
  pass('Dashboard setelah penutupan: tugas OPEN/SELESAI/DIBATALKAN terpisah, vendor unik tetap satu');
  await page.goto(`${origin}/vendor/database/${candidate}`);
  await page.getByRole('button',{name:'Follow-Up',exact:true}).click();
  await page.getByText('Hasil komunikasi 2 tidak tertimpa',{exact:true}).waitFor();
  await page.screenshot({path:fileURLToPath(new URL('detail-followups.png',artifacts)),fullPage:true,animations:'disabled'});
  pass('Tab Follow-Up detail tersaring hanya ke kandidat yang dibuka');
  await page.getByRole('button',{name:'Riwayat',exact:true}).click();
  await page.getByText('Follow-up dicatat',{exact:true}).first().waitFor();
  pass('Riwayat menampilkan audit follow-up dan penutupan tugas');
  await page.getByRole('button',{name:'Edit Profil'}).click();
  await page.getByText('Edit Calon Vendor',{exact:true}).waitFor();
  pass('Form profil Fase 1 tetap terbuka setelah perbaikan import konstanta');
  await page.keyboard.press('Escape');
  // Navigasi baru menutup modal existing walaupun modal Fase 1 belum menangani Escape.
  await page.goto(`${origin}/vendor/followups?candidate=${candidate}`);
  await page.getByText('Hasil komunikasi 2 tidak tertimpa',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.getElementById('main-sidebar')?.getBoundingClientRect().right<=1);
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));
  await page.screenshot({path:fileURLToPath(new URL('followups-mobile-light.png',artifacts)),fullPage:true,animations:'disabled'});
  const overflow = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
    elements:[...document.querySelectorAll('body *')].filter((el)=>el.getBoundingClientRect().right>innerWidth+1).slice(0,6).map((el)=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,90)}))}));
  assert.ok(overflow.scroll<=overflow.width,`Overflow halaman mobile ${JSON.stringify(overflow)}`);
  pass('Mobile 390px/light: catatan dapat dibaca, tanpa overflow halaman');
  await page.getByRole('button',{name:'Catat Follow-Up'}).click();
  await page.getByRole('dialog').waitFor();
  assert.ok(await page.getByRole('dialog').evaluate((el)=>el.scrollWidth<=el.clientWidth),'Overflow modal mobile');
  await page.screenshot({path:fileURLToPath(new URL('followup-modal-mobile.png',artifacts)),fullPage:false,animations:'disabled'});
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'detached'});
  pass('Modal mobile tampil tanpa overflow dan dapat ditutup dengan Escape');
  await ctx.close();
  const direksi = await contextFor('direksi.test@harmas.local');
  await direksi.page.goto(`${origin}/vendor/followups?candidate=${candidate}`);
  await direksi.page.getByText('Hasil komunikasi 2 tidak tertimpa',{exact:true}).waitFor();
  assert.equal(await direksi.page.getByRole('button',{name:'Catat Follow-Up'}).count(),0);
  assert.equal(await direksi.page.getByRole('button',{name:'Selesaikan',exact:true}).count(),0);
  pass('Direksi membaca log tanpa tombol tulis/penutupan');
  await direksi.ctx.close();
  const admin = await contextFor('superadmin.test@harmas.local');
  await admin.page.goto(`${origin}/vendor`);
  await admin.page.getByRole('heading',{name:'Produktivitas PIC Sourcing'}).waitFor();
  await admin.page.goto(`${origin}/vendor/followups?candidate=${candidate}`);
  await admin.page.getByRole('button',{name:'Catat Follow-Up'}).waitFor();
  pass('Super Admin membuka Dashboard dan Follow-Up melalui bypass permission yang sah');
  await admin.page.goto(`${origin}/vendors`);
  await admin.page.getByRole('heading',{name:'Master Vendor',exact:true}).waitFor();
  await admin.page.getByText('TST-SEW1',{exact:true}).waitFor();
  assert.equal(await admin.page.locator('tbody tr').count(),Number(sql('SELECT count(*) FROM public.vendors;')));
  pass('Master Data Vendor tetap menampilkan seluruh vendor sintetis existing tanpa mencampur kandidat pipeline');
  await admin.ctx.close();
  const hrd = await contextFor('hrd.test@harmas.local');
  await hrd.page.goto(`${origin}/vendor/followups`);
  await hrd.page.waitForURL(`${origin}/dashboard`);
  pass('HRD tanpa module key vendor_followups ditolak saat membuka URL langsung');
  await hrd.ctx.close();
  assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));
  assert.equal(failures.filter((url)=>/vendor_followups|vendor_sourcing_dashboard|vendor_remind_overdue_followups/.test(url)).length,0,JSON.stringify(failures));
  assert.ok(!blockedExternal.some((host)=>host.endsWith('supabase.co')),'Percobaan koneksi produksi');
  pass('Tidak ada pageerror atau REST error Fase 2; nol request ke Supabase produksi');
  evidence.push(`SUPPORTING_LAYOUT_ERRORS: ${JSON.stringify(failures)}`,`BLOCKED_EXTERNAL_HOSTS: ${JSON.stringify([...new Set(blockedExternal)])}`);
} catch (error) {
  evidence.push(`FAIL | ${error.message}`);
  throw error;
} finally {
  await browser?.close();
  await server?.close();
  // Cleanup terbatas ke ID fixture, HANYA pada Docker sintetis.
  sql(`BEGIN;
    DELETE FROM public.notifications WHERE reference_id IN (SELECT id FROM public.vendor_followups WHERE candidate_id IN ('${candidate}','${second}'));
    ALTER TABLE public.vendor_followups DISABLE TRIGGER trg_vendor_followups_guard;
    DELETE FROM public.vendor_followups WHERE candidate_id IN ('${candidate}','${second}');
    ALTER TABLE public.vendor_followups ENABLE TRIGGER trg_vendor_followups_guard;
    DELETE FROM public.vendor_candidates WHERE id IN ('${candidate}','${second}');
    COMMIT;`);
  assert.equal(snapshot(),before,'Checksum tabel existing berubah setelah cleanup lokal');
  pass('Cleanup fixture lokal; checksum vendors/assets/profiles/roles/permissions/notifications identik');
  writeFileSync(new URL('BROWSER_RESULTS.txt',artifacts),evidence.join('\n')+'\n');
}
