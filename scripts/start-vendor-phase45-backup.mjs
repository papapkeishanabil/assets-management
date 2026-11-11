// Interactive local terminal. Password hidden, held in memory only, cleared on completion.
import fs from 'node:fs';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
if(!process.stdin.isTTY)throw Error('Open this helper in an interactive terminal');
process.stdout.write('\x1b]0;HARMAS - Backup Fase 4 dan 5 - READ ONLY\x07');
console.log('HARMAS: preflight produksi READ ONLY, backup, dan uji restore offline Fase 4 + 5.');
console.log('Target: uwlxkwyauxwewoexfgwi. TIDAK menjalankan migration produksi, push, atau deploy.');
console.log('Password tidak ditampilkan/disimpan. Jangan kirim password ke chat.');
fs.mkdirSync('.vercel',{recursive:true});fs.writeFileSync('.vercel/phase45-release-status.json',JSON.stringify({state:'WAITING_FOR_PASSWORD',pid:process.pid,updated_at:new Date().toISOString(),production_migration_executed:false})+'\n');
async function password(){readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('Password PostgreSQL HARMAS: ');return new Promise((resolve,reject)=>{let value='';function key(text,event){if(event?.ctrl&&event.name==='c'){done();value='';reject(Error('Dibatalkan'));}else if(event?.name==='return'){done();resolve(value);value='';}else if(event?.name==='backspace'){value=value.slice(0,-1);}else if(text&&!event?.ctrl&&!event?.meta&&!/[\r\n\x1b]/.test(text)){value+=text;}}function done(){process.stdin.off('keypress',key);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('keypress',key);});}
try{process.env.PGPASSWORD=await password();if(!process.env.PGPASSWORD.trim())throw Error('Password kosong');const child=spawn(process.execPath,['scripts/backup-vendor-phase45-release.mjs'],{cwd:root,env:process.env,stdio:'inherit'});const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});process.exitCode=code||0;}
catch(error){console.error(error.message);process.exitCode=1;}
finally{delete process.env.PGPASSWORD;console.log('Password sudah dibersihkan. Persiapan selesai/berhenti; tidak ada migration produksi.');}
