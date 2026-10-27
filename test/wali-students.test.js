import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createWaliStudents } from '../src/wali-students.js';
import { pool } from '../src/db.js';
const user={nomor_kk:'1111111111111111'},access={permissions:['view_any_santri::wali','view_santri::wali']},params=new URLSearchParams();
test('wali menolak tanpa izin, KK kosong, ID dan pencarian tidak valid sebelum SQL',async()=>{
 const students=createWaliStudents(()=>{throw Error('SQL tidak boleh dijalankan');});
 assert.equal((await students(user,{permissions:[]},params)).status,403);
 assert.equal((await students(user,{permissions:['view_any_santri::wali']},params,'1')).status,403);
 assert.equal((await students({nomor_kk:null},access,params)).status,200);
 assert.equal((await students({nomor_kk:''},access,params,'1')).status,404);
 for(const id of ['../1','1/edit','0','1 OR 1=1'])assert.equal((await students(user,access,params,id)).status,404);
 for(const q of ['page=-1','page=abc','q='+ 'a'.repeat(101),'sort=nama%3BDELETE','sort=nama&direction=sideways'])assert.equal((await students(user,access,new URLSearchParams(q))).status,422);
});
test('pengurutan daftar dan ekspor dibatasi kolom yang diizinkan serta KK pengguna',async()=>{
 const calls=[];
 const students=createWaliStudents(async(sql,args)=>{calls.push({sql,args});return [{id:1,nama:'Z',nama_arab:'',jenjang:'Madrasah',status:'aktif',table_total:1}];});
 const list=await students(user,access,new URLSearchParams('sort=jenjang&direction=desc&status=aktif'));
 assert.match(list.body,/aria-sort="descending"/);
 assert.match(calls[0].sql,/ORDER BY jenjang DESC, id ASC/);
 assert.equal(calls[0].args[0],user.nomor_kk);
 const result=await students(user,access,new URLSearchParams('sort=jenjang&direction=desc&status=aktif&export=xlsx'));
 assert.match(calls[1].sql,/ORDER BY jenjang DESC, id ASC/);
 assert.deepEqual(calls[1].args,calls[0].args);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(result.xlsx);
 assert.equal(workbook.getWorksheet('Data').getCell('A2').value,'Z');
});
test('SQL wali: pencarian literal, pagination dan isolasi KK pada tabel TEMPORARY',async()=>{
 const c=await pool.getConnection();
 try{
 await c.query('CREATE TEMPORARY TABLE santris (id BIGINT PRIMARY KEY, no_kk VARCHAR(16), nama VARCHAR(255), nama_arab VARCHAR(255), jenjang VARCHAR(255), status VARCHAR(255), nomor_pendaftaran VARCHAR(255), nisn VARCHAR(20), tempat_lahir VARCHAR(255), tanggal_lahir INT, bulan_lahir INT, tahun_lahir INT)');
 const students=createWaliStudents(async(sql,args)=>(await c.execute(sql,args))[0]);
 await c.execute('INSERT INTO santris(id,no_kk,nama) VALUES(1,?,?),(2,?,?)',[user.nomor_kk,'<script>100%</script>','2222222222222222','Rahasia']);
 for(let id=3;id<=23;id++)await c.execute('INSERT INTO santris(id,no_kk,nama) VALUES(?,?,?)',[id,user.nomor_kk,'Z Santri '+id]);
 await c.execute("UPDATE santris SET jenjang='Madrasah',status='aktif' WHERE id=1");
 const list=await students(user,access,params);assert.equal(list.status,200);assert.match(list.body,/&lt;script&gt;/);assert.doesNotMatch(list.body,/Rahasia/);assert.match(list.body,/Selanjutnya/);
 const next=await students(user,access,new URLSearchParams('page=2'));assert.match(next.body,/Sebelumnya/);assert.doesNotMatch(next.body,/Selanjutnya/);
 const literal=await students(user,access,new URLSearchParams('q=%'));assert.match(literal.body,/100%/);assert.doesNotMatch(literal.body,/Z Santri/);
 const exported=await students(user,access,new URLSearchParams('export=xlsx'));
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(exported.xlsx);
 const names=workbook.getWorksheet('Data').getColumn(1).values;
 assert.ok(names.includes('<script>100%</script>'));assert.ok(!names.includes('Rahasia'));assert.equal(workbook.getWorksheet('Data').rowCount,23);
 const filtered=await students(user,access,new URLSearchParams('jenjang=Madrasah&status=aktif&export=xlsx'));
 const filteredBook=new ExcelJS.Workbook();await filteredBook.xlsx.load(filtered.xlsx);assert.equal(filteredBook.getWorksheet('Data').rowCount,2);
 assert.equal((await students(user,{permissions:[]},new URLSearchParams('export=xlsx'))).status,403);
 assert.equal((await students(user,access,params,'1')).status,200);
 for(const id of ['2','999'])assert.equal((await students(user,access,params,id)).status,404);
 }finally{await c.query('DROP TEMPORARY TABLE IF EXISTS santris');c.release();}
});
test.after(()=>pool.end());
