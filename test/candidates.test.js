import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createCandidates } from '../src/candidates.js';
function fixture(){
 const calls=[];
 const db={getConnection:async()=>({release(){},async execute(sql,args=[]){calls.push({sql,args});if(sql.includes('FROM status_catatan'))return [[{status:'Menunggu'},{status:'Santri'}]];if(sql.includes('FROM penerimaan_santris'))return [[{id:2,kode_gelombang:'G2'}]];if(sql.startsWith('SELECT id,nama,status'))return [[{id:1,nama:'<Ali>',status:'Menunggu'}]];if(sql.startsWith('UPDATE')||sql.startsWith('DELETE'))return [{affectedRows:1}];return [[{id:1,nama:'<Ali>',nomor_pendaftaran:'P1',status:'Menunggu',table_total:1}]];}})};
 return {run:createCandidates(db),calls};
}
const access={permissions:['view_any_calon::santri','update_calon::santri']};
test('list enforces permissions, literal search, filters, ordering and escaping',async()=>{
 const {run,calls}=fixture();assert.equal((await run({access:{permissions:[]}})).status,403);
 const result=await run({access,params:new URLSearchParams('q=%25&status=Menunggu&gelombang=2&sort=nama&direction=desc')});
 assert.equal(result.status,200);assert.match(result.body,/&lt;Ali&gt;/);const query=calls.find(c=>c.sql.includes('COUNT(*) OVER'));assert.equal(query.args[0],'%!%%');assert.match(query.sql,/ORDER BY s\.nama DESC/);assert.ok(query.args.includes('Menunggu'));assert.equal((await run({access,params:new URLSearchParams('status=invalid')})).status,422);
});
test('export contains filtered data and status writes require permission and a known status',async()=>{
 const {run,calls}=fixture();const result=await run({access,params:new URLSearchParams('export=xlsx&jenis_kelamin=Perempuan')});const book=new ExcelJS.Workbook();await book.xlsx.load(result.xlsx);assert.equal(book.worksheets[0].getCell('A2').value,'<Ali>');assert.ok(calls.some(c=>c.args.includes('Perempuan')));
 assert.equal((await run({access:{permissions:['view_any_calon::santri']},action:'status',id:'1',data:{status:'Santri'}})).status,403);
 assert.equal((await run({access,action:'status',id:'1',data:{status:'invalid'}})).status,422);
 assert.equal((await run({access,action:'status',id:'1',data:{status:'Santri'}})).status,303);
 assert.ok(calls.some(c=>c.sql.startsWith('UPDATE')&&c.args[0]==='Santri'));
});
test('multiple filters and inclusive dates propagate to query and export links',async()=>{
 const {run,calls}=fixture();const result=await run({access,params:new URLSearchParams('status=Menunggu&status=Santri&gelombang=2&from=2026-01-01&until=2026-01-31')});
 assert.equal(result.status,200);assert.match(result.body,/multiple/);assert.match(result.body,/status=Menunggu&amp;status=Santri/);const query=calls.find(c=>c.sql.includes('COUNT(*) OVER'));assert.match(query.sql,/s\.status IN \(\?,\?\)/);assert.ok(query.args.includes('2026-01-31'));
 for(const query of ['from=2026-02-30','from=2026-02-01&until=2026-01-01','status=Menunggu&status=invalid'])assert.equal((await run({access,params:new URLSearchParams(query)})).status,422);
});
test('notes and deletion require their own permissions and validate input',async()=>{
 const {run,calls}=fixture();assert.equal((await run({access:{permissions:[]},action:'note',id:'1',data:{catatan:'x'}})).status,403);assert.equal((await run({access,action:'delete',id:'1',data:{}})).status,403);assert.equal((await run({access,action:'note',id:'1',data:{catatan:'x'.repeat(256)}})).status,422);assert.equal((await run({access,action:'note',id:'1',data:{catatan:'Perbaiki data'}})).status,303);assert.ok(calls.some(c=>c.sql.startsWith('UPDATE')&&c.args[0]==='Perbaiki data'));assert.equal((await run({access:{permissions:['delete_calon::santri']},action:'delete',id:'1',data:{}})).status,303);assert.ok(calls.some(c=>c.sql.startsWith('DELETE')&&c.sql.includes('status NOT IN')));
});
test('bulk status validates selected IDs, permission and status before changing candidates',async()=>{
 const {run,calls}=fixture();
 assert.equal((await run({access:{permissions:[]},action:'bulkStatus',data:{id_1:'1'}})).status,403);
 assert.equal((await run({access,action:'bulkStatus',data:{id_1:'1',unexpected:'1'}})).status,422);
 const form=await run({access,action:'bulkStatus',csrf:'token',data:{id_1:'1',id_2:'1'}});assert.equal(form.status,200);assert.match(form.body,/id_2/);
 assert.equal((await run({access,action:'bulkStatus',data:{id_1:'1',status:'invalid'}})).status,422);
 assert.equal((await run({access,action:'bulkStatus',data:{id_1:'1',id_2:'1',status:'Santri'}})).status,303);
 const update=calls.find(c=>c.sql.startsWith('UPDATE'));assert.match(update.sql,/status NOT IN/);assert.deepEqual(update.args,['Santri','1','2']);
});
test('candidate search covers contact, gender and date and defaults to newest',async()=>{
 const {run,calls}=fixture();const result=await run({access,params:new URLSearchParams('q=2026')});
 const query=calls.find(c=>c.sql.includes('COUNT(*) OVER'));assert.match(query.sql,/s\.jenis_kelamin LIKE/);assert.match(query.sql,/s\.nomor_hp LIKE/);assert.match(query.sql,/CAST\(s\.created_at AS CHAR\) LIKE/);assert.match(query.sql,/ORDER BY s\.created_at DESC/);assert.match(result.body,/Ubah status terpilih/);
});
test('WhatsApp links normalize numbers and encode the recipient name',async()=>{
 const db={getConnection:async()=>({release(){},async execute(sql){if(sql.includes('FROM status_catatan'))return [[]];if(sql.includes('FROM penerimaan_santris'))return [[]];return [[{id:1,nama:'<Ali>',nomor_hp:'0812-345',table_total:1}]];}})};
 const result=await createCandidates(db)({access});assert.match(result.body,/https:\/\/wa\.me\/62812345\?text=/);assert.match(result.body,/%3CAli%3E/);assert.match(result.body,/0812-345/);
});
test('additional candidate column sorts apply to the list and export and reject SQL expressions',async()=>{
 for(const column of ['nisn','nik','asal_sekolah','jenis_kelamin','nomor_hp']){
  for(const exportParam of ['', '&export=xlsx']){
   const {run,calls}=fixture();const result=await run({access,params:new URLSearchParams(`sort=${column}&direction=asc${exportParam}`)});
   assert.equal(result.status,200);assert.match(calls.find(c=>c.sql.includes('COUNT(*) OVER')).sql,new RegExp(`ORDER BY s\\.${column} ASC`));
   if(!exportParam)assert.match(result.body,new RegExp(`sort=${column}`));
  }
 }
 const {run}=fixture();assert.equal((await run({access,params:new URLSearchParams('sort=nama%20DESC%3BDELETE')})).status,422);
});
test('status, wave and note sorting applies to list and export',async()=>{
 for(const [column,sqlColumn] of [['status','s.status'],['kode_gelombang','p.kode_gelombang'],['catatan','s.catatan']]){
  for(const suffix of ['', '&export=xlsx']){
   const {run,calls}=fixture();const result=await run({access,params:new URLSearchParams(`sort=${column}&direction=asc${suffix}`)});
   assert.equal(result.status,200);assert.ok(calls.find(c=>c.sql.includes('COUNT(*) OVER')).sql.includes(`ORDER BY ${sqlColumn} ASC`));
   if(!suffix)assert.match(result.body,new RegExp(`sort=${column}`));
  }
 }
});
test('status and wave searches use literal escaping on list and export',async()=>{
 for(const suffix of ['', '&export=xlsx']){
  const {run,calls}=fixture();assert.equal((await run({access,params:new URLSearchParams(`q=%25_${suffix}`)})).status,200);
  const query=calls.find(c=>c.sql.includes('COUNT(*) OVER'));assert.match(query.sql,/s\.status LIKE \? ESCAPE '!'/);assert.match(query.sql,/p\.kode_gelombang LIKE \? ESCAPE '!'/);assert.equal(query.args[9],'%!%!_%');assert.equal(query.args[10],'%!%!_%');
 }
});
test('selected candidate export requires list permission and exports only eligible selected IDs',async()=>{
 const {run,calls}=fixture();
 assert.equal((await run({access:{permissions:[]},action:'bulkExport',data:{id_1:'1'}})).status,403);
 assert.equal((await run({access,action:'bulkExport',data:{id_1:'1',bad:'1'}})).status,422);
 const result=await run({access:{permissions:['view_any_calon::santri']},action:'bulkExport',data:{id_1:'1',id_2:'1'}});
 const sql=calls.find(c=>c.sql.includes('s.id IN'));assert.deepEqual(sql.args,['1','2']);assert.match(sql.sql,/s.status NOT IN/);
 const book=new ExcelJS.Workbook();await book.xlsx.load(result.xlsx);assert.equal(book.worksheets[0].getCell('A2').value,'<Ali>');
 const page=await run({access:{permissions:['view_any_calon::santri']}});assert.match(page.body,/Ekspor Excel terpilih/);assert.doesNotMatch(page.body,/Ubah status terpilih/);
});
