import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import { query,pool } from '../src/db.js';
import { publicStorageRoot } from '../src/config.js';
const root=resolve(fileURLToPath(publicStorageRoot));
let saved=0,existing=0,failed=0;
try {
 const paths=new Set(['og/og_360p.webp','og/og.webp']);
 for(const r of await query("SELECT thumbnail AS path FROM artikels WHERE status='published' AND deleted_at IS NULL UNION SELECT gambar AS path FROM galeri_fasilitas"))if(r.path)paths.add(r.path);
 const richRows=await query("SELECT isi AS body FROM artikels WHERE status='published' AND deleted_at IS NULL UNION ALL SELECT deskripsi AS body FROM program_pendidikans UNION ALL SELECT deskripsi AS body FROM kurikulum_tahfizhs");
 for(const row of richRows)for(const match of String(row.body||'').matchAll(/(?:https?:\/\/mahadalyusro\.sch\.id)?\/storage\/([^"'<>\s]+)/g)){try{paths.add(decodeURIComponent(match[1]));}catch{}}
 const queue=[...paths].filter(p=>/\.(png|jpe?g|webp|gif)$/i.test(p)&&!p.includes('..'));
 const approved=[];
 async function worker(){while(queue.length){const path=queue.shift();const target=resolve(root,path);if(!target.startsWith(root+sep)){failed++;continue;}approved.push(path);try{await access(target);existing++;continue;}catch{}try{const {stdout:bytes}=await run('curl',['--fail','--silent','--show-error','--max-time','15','https://mahadalyusro.sch.id/storage/'+path.split('/').map(encodeURIComponent).join('/')],{encoding:'buffer',maxBuffer:15*1024*1024});if(!(bytes[0]===255&&bytes[1]===216)&&bytes.subarray(1,4).toString()!=='PNG'&&bytes.subarray(0,4).toString()!=='RIFF'&&bytes.subarray(0,3).toString()!=='GIF')throw Error('not an image');await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);saved++;}catch{failed++;}}}
 await Promise.all(Array.from({length:4},worker));
 const previous=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../templates/public-assets.json',import.meta.url),'utf8').catch(()=>'[]'));
 await writeFile(new URL('../templates/public-assets.json',import.meta.url),JSON.stringify([...new Set([...previous,...approved])],null,2));
 console.log(JSON.stringify({saved,existing,failed}));
}finally{await pool.end();}
