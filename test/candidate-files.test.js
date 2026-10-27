import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { candidateFiles, createWaliFiles } from '../src/wali-files.js';
import { createCandidates } from '../src/candidates.js';
const access={permissions:['view_any_calon::santri']};
test('candidate document types follow the Laravel level mapping',()=>{
 for(const [level,payment,diploma] of [['Madrasah','madrasah','sd'],["Darul 'Ilmi",'darul_ilmi','smp'],["Ma'had 'Aly",'mahad_aly','sma']]) assert.deepEqual(candidateFiles({jenjang:level}).map(([f])=>f),['foto','foto_akta_lahir','foto_kartu_keluarga',`foto_pembayaran_psb_${payment}`,`foto_ijazah_${diploma}`,...(level==='Madrasah'?[]:[level==="Darul 'Ilmi"?'foto_surat_komitment_darul_ilmi':'foto_surat_komitment_mahad_aly'])]);
 assert.equal(candidateFiles({jenjang:'Mahdon Tarbawi'}).at(-1)[0],'foto_pembayaran_psb_mahdon_tarbawi');
});
test('candidate files enforce permission, eligible record, level, path and read-only access',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'candidate-files-'));
 try {
  await writeFile(join(dir,'image.png'),await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer());
  let row={jenjang:'Madrasah',foto:'image.png',foto_akta_lahir:'image.png',foto_kartu_keluarga:'image.png',foto_pembayaran_psb_madrasah:'image.png',foto_ijazah_sd:'image.png'};let query;
  const db={getConnection:async()=>({release(){},execute:async(sql,args)=>{query={sql,args};return [row?[row]:[]];}})};
  const files=createWaliFiles(db,pathToFileURL(dir+'/'));const request={user:{},access,id:'1',scope:'candidate'};
  for(const [field] of candidateFiles(row))assert.equal((await files({...request,field})).status,200);
  assert.match(query.sql,/status NOT IN/);assert.deepEqual(query.args,['1']);
  assert.equal((await files({...request,access:{permissions:[]},field:'foto'})).status,403);
  assert.equal((await files({...request,field:'foto',action:'delete'})).status,403);
  assert.equal((await files({...request,field:'foto_ijazah_smp'})).status,404);
  row.foto='../image.png';assert.equal((await files({...request,field:'foto'})).status,404);
  row=null;assert.equal((await files({...request,field:'foto'})).status,404);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('candidate table displays links only for available level-specific files',async()=>{
 const row={id:1,nama:'Ali',jenjang:'Madrasah',foto:'image.png',foto_ijazah_sd:'image.png',table_total:1};
 const db={getConnection:async()=>({release(){},execute:async sql=>[sql.includes('status_catatan')||sql.includes('FROM penerimaan_santris')?[]:[row]]})};
 const result=await createCandidates(db)({access});assert.match(result.body,/calon-santri\/1\/berkas\/foto/);assert.match(result.body,/calon-santri\/1\/berkas\/foto_ijazah_sd/);assert.doesNotMatch(result.body,/calon-santri\/1\/berkas\/foto_akta_lahir/);
});
