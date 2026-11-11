// Interactive execution only after separate explicit approval has been recorded by the release agent.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const approval=JSON.parse(fs.readFileSync('.vercel/ofissio-migration-approval.json','utf8'));assert.equal(approval.explicit_user_approval,true);assert.equal(approval.consumed,false);assert.ok(process.stdin.isTTY);
process.stdout.write('\x1b]0;HARMAS - Migration Katalog Ofissio DISETUJUI\x07');
console.log('Target produksi: uwlxkwyauxwewoexfgwi. Hanya 202611110003.');
console.log('Migration sudah disetujui terpisah. Backup diperiksa/diulang bila berubah, lalu migration Ofissio dalam satu transaksi.');
console.log('Tidak mengaktifkan kandidat, membuat akun, push Git, atau deploy frontend. Password tidak ditampilkan/disimpan.');
fs.writeFileSync('.vercel/ofissio-release-status.json',JSON.stringify({state:'WAITING_FOR_APPROVED_MIGRATION_PASSWORD',backup_directory:approval.backup_directory,updated_at:new Date().toISOString(),pid:process.pid,production_migration_executed:false})+'\n');
async function password(){readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('Password PostgreSQL HARMAS: ');return new Promise((resolve,reject)=>{let value='';function key(text,event){if(event?.ctrl&&event.name==='c'){done();value='';reject(Error('Dibatalkan'));}else if(event?.name==='return'){done();resolve(value);value='';}else if(event?.name==='backspace'){value=value.slice(0,-1);}else if(text&&!event?.ctrl&&!event?.meta&&!/[\r\n\x1b]/.test(text))value+=text;}function done(){process.stdin.off('keypress',key);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('keypress',key);});}
try{process.env.PGPASSWORD=await password();if(!process.env.PGPASSWORD.trim())throw Error('Password kosong');const child=spawn(process.execPath,['scripts/apply-approved-vendor-ofissio.mjs'],{cwd:root,env:process.env,stdio:'inherit'});process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);})||0;}
catch(error){console.error(error.message);process.exitCode=1;}
finally{delete process.env.PGPASSWORD;console.log('Password dibersihkan. Periksa status sebelum mengulang langkah apa pun.');}
