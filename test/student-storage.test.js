import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, unlink, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { studentFile, studentRoot, legacyStudentRoot } from '../src/student-storage.js';
import { createWaliFiles } from '../src/wali-files.js';

test('Storage santri: Node menulis disk Laravel, Laravel membaca/menulis, fallback Node lama dan isolasi KK', async () => {
 let row = {id:1,jenjang:'Madrasah',no_kk:'123'}, stored;
 const db = {getConnection:async()=>({release(){},async beginTransaction(){},async commit(){},async rollback(){},async execute(sql,args){
  if(sql.startsWith('SELECT')) return [[...(args[1] === '123' ? [row] : [])]];
  if(sql.startsWith('UPDATE')){stored=args[0];row.foto_akta_lahir=stored;return [{affectedRows:1}];}
  throw new Error('Unexpected query');
 }})};
 const files = createWaliFiles(db), image = await sharp({create:{width:4,height:4,channels:3,background:'red'}}).png().toBuffer();
 const request = {user:{nomor_kk:'123'},access:{permissions:['view_any_santri::wali','update_santri::wali']},id:'1',field:'foto_akta_lahir'};
 const name = 'storage-test-' + randomBytes(16).toString('hex') + '.jpg';
 try {
  assert.equal((await files({...request,action:'upload',image})).status,303);
  assert.ok(stored.startsWith('uploads/node-wali/'));
  const bytes = await readFile(new URL(stored,studentRoot)); assert.equal((await sharp(bytes).metadata()).format,'jpeg');
  const {stdout} = await promisify(execFile)('php',['-r',"require 'vendor/autoload.php'; $app=require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); echo hash('sha256',Illuminate\\Support\\Facades\\Storage::disk('public')->get(getenv('STUDENT_TEST_PATH')));"],{cwd:new URL('../../',import.meta.url),env:{...process.env,STUDENT_TEST_PATH:stored}});
  const {createHash} = await import('node:crypto'); assert.equal(stdout,createHash('sha256').update(bytes).digest('hex'));
  await promisify(execFile)('php',['-r',"require 'vendor/autoload.php'; $app=require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); Illuminate\\Support\\Facades\\Storage::disk('public')->put(getenv('STUDENT_TEST_FILE'),base64_decode(getenv('STUDENT_TEST_IMAGE')));"],{cwd:new URL('../../',import.meta.url),env:{...process.env,STUDENT_TEST_FILE:name,STUDENT_TEST_IMAGE:bytes.toString('base64')}});
  row.foto_akta_lahir=name;
  assert.equal((await files(request)).status,200);
  assert.equal((await files({...request,user:{nomor_kk:'456'}})).status,404);
  assert.equal((await files({...request,access:{permissions:[]}})).status,403);
  await mkdir(legacyStudentRoot,{recursive:true}); await writeFile(new URL(name,legacyStudentRoot),bytes);
  await unlink(new URL(name,studentRoot));
  assert.equal((await files(request)).status,200);
  assert.equal(await studentFile('../../.env'),null);
  assert.equal((await files({...request,action:'delete'})).status,303); assert.equal(row.foto_akta_lahir,null);
  assert.equal((await files(request)).status,404);
 } finally {
  if(stored)await unlink(new URL(stored,studentRoot)).catch(()=>{});
  await unlink(new URL(name,studentRoot)).catch(()=>{});await unlink(new URL(name,legacyStudentRoot)).catch(()=>{});
 }
});
