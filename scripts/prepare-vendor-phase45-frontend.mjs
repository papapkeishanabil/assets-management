// Build + scan only. Does not deploy, push Git, or write the database.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const target='https://uwlxkwyauxwewoexfgwi.supabase.co',project='prj_2MBxDEiNjz80jfB2L0dQ55hUbG0P',team='team_gulGpJeEXpB77MplKv8w4Ilo';
const linked=JSON.parse(fs.readFileSync('.vercel/project.json','utf8'));assert.equal(linked.projectId,project);assert.equal(linked.orgId,team);
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim(),commit=git(['rev-parse','HEAD']);
assert.ok(git(['log','-1','--format=%s']).includes('phase 5'),'Review release source commit before building');
const paths=['src','api','public','index.html','package.json','package-lock.json','vite.config.js','tailwind.config.js','postcss.config.js','vercel.json'];
assert.equal(git(['ls-files','--others','--exclude-standard','--',...paths]),'','Untracked runtime source must be reviewed');
const normalize=(f,b)=>/\.(?:jsx?|tsx?|css|html|json|svg|txt|xml|webmanifest)$/.test(f)?b.toString('utf8').replaceAll('\r\n','\n'):b;
const files=git(['ls-files','--',...paths]).split('\n'),sourceHashes={};
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const file of files){const original=execFileSync('git',['show',`${commit}:${file}`]),actual=fs.readFileSync(file);assert.equal(sha(normalize(file,actual)),sha(normalize(file,original)),'Runtime source differs from tested commit: '+file);sourceHashes[file]=sha(normalize(file,actual));}
const cache=fs.readFileSync('.vercel/.env.production.local','utf8');
const value=key=>{const m=cache.match(new RegExp('^'+key+'=(.*)$','m'));assert.ok(m,key+' missing from local build cache');return m[1].trim().replace(/^(['"])(.*)\1$/,'$2');};
const url=value('VITE_SUPABASE_URL'),key=value('VITE_SUPABASE_PUBLISHABLE_KEY');assert.equal(url,target);assert.ok(key.length>20&&!/your_|placeholder/i.test(key));
if(key.startsWith('eyJ')){const p=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(p.role,'anon');assert.equal(p.ref,'uwlxkwyauxwewoexfgwi');}else assert.ok(key.startsWith('sb_publishable_'));
const settings=await fetch(target+'/auth/v1/settings',{headers:{apikey:key},signal:AbortSignal.timeout(20000)});assert.equal(settings.status,200,'Public build config does not authenticate to intended project');await settings.arrayBuffer();
const build=spawnSync('cmd.exe',['/d','/s','/c','vercel.cmd build --prod'],{encoding:'utf8',maxBuffer:12e6,env:{...process.env,VERCEL_NO_UPDATE_NOTIFIER:'1'}});
fs.writeFileSync('.vercel/phase45-build.log',(build.stdout||'')+'\n'+(build.stderr||''));assert.equal(build.status,0,'Vercel build failed; inspect private .vercel/phase45-build.log');
const output='.vercel/output',walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]),artifact=walk(output),violations=[];
for(const file of artifact){const body=fs.readFileSync(file).toString('utf8');if(/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/.test(body))violations.push(file);
 for(const m of body.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){try{const p=JSON.parse(Buffer.from(m[0].split('.')[1],'base64url'));if(p.role==='service_role'||p.iss?.includes('vercel.com'))violations.push(file);}catch{}}
 if(/(?:^|[\\/])\.env|\.(?:dump|sql|pem)$/.test(file))violations.push(file);
}assert.equal(violations.length,0,'Private credential/environment/dump found in artifact');
const js=artifact.filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(f,'utf8')).join('\n');
const checks={public_config_valid:true,samples:js.includes('vendor_record_sample_qc'),decisions:js.includes('vendor_record_decision'),activation:js.includes('activate_vendor_candidate'),approval_menu:js.includes('Persetujuan Vendor'),free_maps:js.includes('tile.openstreetmap.org'),no_private_artifacts:true};assert.ok(Object.values(checks).every(Boolean));
const staticRoot=path.join(output,'static'),assets=artifact.filter(f=>f.startsWith(staticRoot+path.sep)).map(f=>({path:'/'+path.relative(staticRoot,f).replaceAll('\\','/'),sha256:sha(fs.readFileSync(f))}));
const html=fs.readFileSync(path.join(staticRoot,'index.html'),'utf8'),entry=html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1],css=html.match(/href="(\/assets\/index-[^"]+\.css)"/)?.[1];assert.ok(entry&&css);
const selected=['/index.html',entry,css,'/sw.js',...assets.filter(a=>/^\/assets\/(?:VendorSamplesPage-|VendorApprovalsPage-|VendorDecisionPanel-|VendorSamplesPanel-|vendor-sampling-|MasterVendorLocationsPanel-|VendorSourcingPanel-|VendorMapPage-|leaflet-src-|leaflet-.*\.css)/.test(a.path)).map(a=>a.path)];
const report={checked_at:new Date().toISOString(),commit,project_id:project,team_id:team,target:'production staged without domain',checks,scanned_files:artifact.length,entry,assets,selected,source_sha256:sourceHashes,cloud_environment_changed:false,production_database_write:false,git_push:false,deployed:false};
fs.writeFileSync('.vercel/phase45-artifact.json',JSON.stringify(report,null,2)+'\n');fs.mkdirSync('docs/vendor-management/phase45-release-evidence',{recursive:true});fs.writeFileSync('docs/vendor-management/phase45-release-evidence/FRONTEND_PREFLIGHT.json',JSON.stringify({...report,assets:undefined,source_sha256:undefined},null,2)+'\n');
console.log(JSON.stringify({prepared:true,commit,checks,scanned_files:artifact.length,selected_assets:selected.length,deployed:false}));
