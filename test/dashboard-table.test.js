import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { tableQuery,renderTable,selectedTableIds,tableExcel,tableFilters,tableRowActions } from '../src/dashboard-table.js';

test('filter, ekspor dan aksi bersama memvalidasi dan mengamankan data',async()=>{
 const filters=[{name:'status',options:[{value:'aktif'}]}];
 assert.deepEqual(tableFilters(new URLSearchParams('status=aktif'),filters),{status:'aktif'});
 assert.equal(tableFilters(new URLSearchParams('status=lain'),filters),null);
 const bytes=await tableExcel([{name:'=1+1',note:'a,"b"'}],[{key:'name',label:'Nama'},{key:'note',label:'Catatan'}]);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);const sheet=workbook.getWorksheet('Data');
 assert.equal(sheet.getCell('A2').value,'=1+1');assert.equal(sheet.getCell('B2').value,'a,"b"');
 assert.match(tableRowActions([{label:'<Edit>',href:'/x?a=1&b=2'}]),/&lt;Edit&gt;/);
});

test('tableQuery membatasi halaman/urutan dan mempertahankan pencarian literal',()=>{
 const q=tableQuery(new URLSearchParams('q=%25_%21&page=2&sort=name&direction=desc'),{sorts:['name'],defaultSort:'name'});
 assert.equal(q.pattern,'%!%!_!!%');assert.equal(q.offset,20);assert.equal(q.limit,21);assert.equal(q.direction,'desc');
 for(const input of ['page=0','page=-1','page=9999999','sort=name%3BDROP','direction=up','q='+ 'x'.repeat(101)])assert.equal(tableQuery(new URLSearchParams(input),{sorts:['name'],defaultSort:'name'}),null);
});
test('renderTable meng-escape isi, menyediakan navigasi, aksi massal dan nilai nol',()=>{
 const query=tableQuery(new URLSearchParams('q=%3Cx%3E&page=2&sort=name&direction=desc'),{sorts:['name'],defaultSort:'name',pageSize:1});
 const html=renderTable({base:'/dashboard/test',query,rows:[{id:1,name:'<script>',count:0},{id:2,name:'Lain',count:3}],columns:[{key:'name',label:'Nama'},{key:'count',label:'Jumlah'}],title:'data',searchLabel:'Cari',emptyText:'Kosong',sortOptions:[{value:'name',label:'Nama'}],bulk:{action:'/dashboard/test/delete',csrf:'<token>',rowLabel:r=>r.name,confirm:'Hapus?'}});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/<td data-column="1">0<\/td>/);assert.match(html,/data-table-select-all/);assert.match(html,/&lt;token&gt;/);assert.match(html,/Sebelumnya/);assert.match(html,/Selanjutnya/);assert.doesNotMatch(html,/Lain/);assert.match(html,/sort=name/);
 assert.deepEqual(selectedTableIds({_csrf:'x',id_1:'1',id_2:'1'}),['1','2']);
 for(const data of [{_csrf:'x'},{id_1:'0'},{id_1:'1',bad:'1'},{id_0:'1'}])assert.equal(selectedTableIds(data),null);
});
