import { tableQuery, renderTable, selectedTableIds, tableRowActions, tableExport, tableFilters } from './dashboard-table.js';
import { pool } from './db.js';
import { esc } from './dashboard-shell.js';

const base='/dashboard/status-catatan';
const idValid=value=>/^[1-9]\d{0,14}$/.test(String(value));
const result=(status,message)=>({status,title:'Status Catatan',body:`<section><p>${esc(message)}</p><a href="${base}">Kembali ke daftar</a></section>`});
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatUpdatedAt(value){
 if(value==null)return '—';
 const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::\d{2})?$/);
 if(!match||Number(match[2])<1||Number(match[2])>12)return String(value);
 return `${match[3]} ${months[Number(match[2])-1]} ${match[1]} ${match[4]}:${match[5]}`;
}
const checks=[['status','Status',255,true],['pesan_whatsapp','Pesan WhatsApp',65535,true],['label_tombol','Label Tombol',255,true],['nomor_wa','Nomor WhatsApp atau tautan HTTPS',255,true],['catatan','Catatan untuk Ditampilkan ke User',65535,false]];
function form(row,csrf,errors=[],data=row){
 const isNew=!row.id;
 const inputs=checks.map(([key,label,max,required])=>`<label class="field"><span class="field-label">${esc(label)}${required?' <span class="required">*</span>':''}</span><span class="input-wrap">${['pesan_whatsapp','catatan'].includes(key)?`<textarea name="${key}" maxlength="${max}" rows="${key==='catatan'?3:5}" ${required?'required':''}>${esc(data[key]??'')}</textarea>`:`<input name="${key}" maxlength="${max}" value="${esc(data[key]??'')}" ${required?'required':''}>`}</span>${key==='pesan_whatsapp'?'<small>Gunakan {nama} dan {nomor} sebagai placeholder.</small>':''}</label>`).join('');
 return {status:errors.length?422:200,title:isNew?'Tambah Status Catatan':'Edit Status Catatan',body:`<section class="status-note-form"><form method="post" action="${base}/${isNew?'create':`${esc(row.id)}/edit`}"><input type="hidden" name="_csrf" value="${esc(csrf)}">${errors.length?`<div class="message" role="alert">${errors.map(e=>`<p>${esc(e)}</p>`).join('')}</div>`:''}${inputs}<button type="submit">Simpan</button> <a href="${base}">Batal</a></form></section>`};
}
export function createStatusNotes(db=pool){
 return async function statusNotes({access,action='list',id,params=new URLSearchParams(),csrf='',data}){
  const permission={list:'view_any',create:'create',edit:'update',delete:'delete_any'}[action];
  if(!permission)return result(404,'Halaman tidak ditemukan.');
  if(!access.permissions.includes(`${permission}_status::catatan`))return result(403,'Anda tidak memiliki izin untuk tindakan ini.');
  if(action==='edit'&&!idValid(id))return result(404,'Status tidak ditemukan.');
  const c=await db.getConnection();
  try{
   if(action==='list'){
    const query=tableQuery(params,{sorts:['status','updated_at'],defaultSort:'status'});
    if(!query)return result(422,'Pencarian, urutan, atau halaman tidak valid.');
    const filters=[{name:'tombol',label:'Label tombol'}];const values=tableFilters(params,filters);if(!values)return result(422,'Filter tidak valid.');
    const [rows]=await c.execute(`SELECT COUNT(*) OVER() AS table_total,id,status,label_tombol,nomor_wa,updated_at FROM status_catatan WHERE status LIKE ? ESCAPE '!' AND (? = '' OR label_tombol = ?) ORDER BY ${query.sort} ${query.direction.toUpperCase()},id LIMIT ${params.has('export')?10001:query.limit} OFFSET ${params.has('export')?0:query.offset}`,[query.pattern,values.tombol,values.tombol]);
    const canDelete=access.permissions.includes('delete_any_status::catatan'),canEdit=access.permissions.includes('update_status::catatan');
    const columns=[{key:'status',label:'Status'},{key:'label_tombol',label:'Tombol'},{key:'nomor_wa',label:'Nomor WA'},{key:'updated_at',label:'Diubah',value:row=>formatUpdatedAt(row.updated_at)}];
    const exported=await tableExport(params,rows,columns,'Status Catatan');if(exported)return exported;
    if(canEdit)columns.push({label:'Aksi',html:row=>tableRowActions([{label:'Edit',href:`${base}/${row.id}/edit`}])});
    const table=renderTable({base,query,rows,columns,exportable:true,filters:filters.map(f=>({...f,value:values[f.name]})),title:'status catatan',searchLabel:'Cari status',emptyText:'Tidak ada status yang cocok.',sortOptions:[{value:'status',label:'Status'},{value:'updated_at',label:'Diubah'}],bulk:canDelete?{action:`${base}/delete`,csrf,rowLabel:row=>row.status,confirm:'Hapus status yang dipilih?'}:null});
    return {status:200,title:'Status Catatan',body:`<section>${access.permissions.includes('create_status::catatan')?`<p class="table-create"><a href="${base}/create">Tambah Status Catatan</a></p>`:''}${table}</section>`};
   }
   if(action==='delete'){
    if(!data)return result(405,'Metode tidak tersedia.');
    const ids=selectedTableIds(data);
    if(!ids)return result(422,'Pilih satu sampai 100 status yang akan dihapus.');
    await c.execute(`DELETE FROM status_catatan WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);return {status:303};
   }
   let row={};
   if(action==='edit'){const [rows]=await c.execute('SELECT id,status,pesan_whatsapp,label_tombol,nomor_wa,catatan FROM status_catatan WHERE id=?',[id]);if(!rows.length)return result(404,'Status tidak ditemukan.');row=rows[0];}
   if(!data)return form(row,csrf);
   const values={},errors=[];
   for(const [key,label,max,required] of checks){const value=String(data[key]??'').trim();values[key]=value||null;if((required&&!value)||value.length>max)errors.push(`${label} wajib sesuai batas panjang.`);}
   if(values.nomor_wa&&!/^\+?\d{9,15}$/.test(values.nomor_wa)){
    try{const url=new URL(values.nomor_wa);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{errors.push('Nomor WhatsApp harus 9–15 digit atau tautan HTTPS yang valid.');}
   }
   if(errors.length)return form(row,csrf,errors,data);
   try{
    if(action==='create')await c.execute('INSERT INTO status_catatan (status,pesan_whatsapp,label_tombol,nomor_wa,catatan,created_at,updated_at) VALUES (?,?,?,?,?,NOW(),NOW())',Object.values(values));
    else {const [updated]=await c.execute('UPDATE status_catatan SET status=?,pesan_whatsapp=?,label_tombol=?,nomor_wa=?,catatan=?,updated_at=NOW() WHERE id=?',[...Object.values(values),id]);if(!updated.affectedRows)return result(404,'Status tidak ditemukan.');}
   }catch(error){if(error.code==='ER_DUP_ENTRY')return form(row,csrf,['Status sudah digunakan.'],data);throw error;}
   return {status:303};
  }finally{c.release();}
 };
}
export const statusNotes=createStatusNotes();
